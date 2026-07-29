import { isCancel, normalizeError, sleep, getDedupeKey } from './utils.js';
import { BODYLESS_METHODS, DEFAULTS } from './constants.js';

export const activeControllers = new Set();

export function linkSignal(userSignal, onAbort) {
    if (!userSignal) return () => {};
    if (userSignal.aborted) {
        onAbort();
        return () => {};
    }
    userSignal.addEventListener('abort', onAbort);
    return () => userSignal.removeEventListener('abort', onAbort);
}

export function driveHooks(responsePromise, hooks, onCleanup) {
    const out = responsePromise.then(
        (res) => {
            hooks.onSuccess?.(res);
            return res.data;
        },
        (err) => {
            hooks.onError?.(err);
            throw err;
        }
    );
    const fin = () => {
        hooks.onSettle?.();
        onCleanup?.();
    };
    out.then(fin, fin);
    return out;
}

async function retryWithBackoff(fn, { retries, delay, maxDelay, condition, method }) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            if (isCancel(err)) throw normalizeError(err);

            const normalized = normalizeError(err);
            const shouldRetry = condition(normalized, method) && attempt < retries;
            if (!shouldRetry) throw normalized;

            const ceiling = Math.min(maxDelay ?? Infinity, delay * Math.pow(2, attempt));
            await sleep(Math.random() * ceiling);
            attempt++;
        }
    }
}

export function executeRequest(instance, pending, method, url, data, config = {}, hooks = {}) {
    const {
        signal: userSignal,
        dedupe,
        retries,
        retryDelay,
        retryCondition,
        ...axiosConfig
    } = config;

    const useDedupe = dedupe ?? DEFAULTS.dedupe;
    const dedupeKey = useDedupe ? getDedupeKey(method, url, axiosConfig, data) : null;

    hooks.onStart?.();

    if (useDedupe && pending.has(dedupeKey)) {
        const entry = pending.get(dedupeKey);
        entry.refs++;

        let released = false;
        let detach = () => {};
        const release = () => {
            if (released) return;
            released = true;
            detach();
            entry.refs--;
            if (entry.refs <= 0) {
                try { entry.controller.abort(); } catch {}
            }
        };
        detach = linkSignal(userSignal, release);

        const out = driveHooks(entry.promise, hooks, () => { detach(); });
        out.cancel = release;
        return out;
    }

    const controller = new AbortController();

    if (hooks.onUploadProgress) {
        axiosConfig.onUploadProgress = (e) => {
            if (e.lengthComputable) hooks.onUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
    }
    if (hooks.onDownloadProgress) {
        axiosConfig.onDownloadProgress = (e) => {
            if (e.lengthComputable) hooks.onDownloadProgress(Math.round((e.loaded / e.total) * 100));
        };
    }

    const exec = () => {
        const requestConfig = { method, url, ...axiosConfig, signal: controller.signal };
        if (!BODYLESS_METHODS.includes(String(method).toLowerCase())) {
            requestConfig.data = data;
        }
        return instance(requestConfig);
    };

    const responsePromise = retryWithBackoff(exec, {
        retries: retries ?? DEFAULTS.retries,
        delay: retryDelay ?? DEFAULTS.retryDelay,
        maxDelay: DEFAULTS.maxRetryDelay,
        condition: retryCondition ?? DEFAULTS.retryCondition,
        method
    });

    const entry = { promise: responsePromise, controller, refs: 1 };
    activeControllers.add(controller);
    if (useDedupe) pending.set(dedupeKey, entry);

    let released = false;
    let detach = () => {};
    const release = () => {
        if (released) return;
        released = true;
        detach();
        if (useDedupe) {
            entry.refs--;
            if (entry.refs <= 0) {
                try { controller.abort(); } catch {}
            }
        } else {
            try { controller.abort(); } catch {}
        }
    };
    detach = linkSignal(userSignal, release);

    const out = driveHooks(responsePromise, hooks, () => {
        detach();
        activeControllers.delete(controller);
        if (useDedupe && pending.get(dedupeKey) === entry) pending.delete(dedupeKey);
    });

    out.cancel = release;
    return out;
}
