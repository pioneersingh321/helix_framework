import {
    handleError
} from '../shared/shared.js';
import { effect, cleanup } from './effect.js';
import { isRef } from './ref.js';
import { queueJob, queuePostFlushCb } from './scheduler.js';

export function watch(source, cb, options = {}) {
    const { deep = false, immediate = false, flush = "pre", once = false } = options;
    const isArraySource = Array.isArray(source);
    let getter;

    if (isArraySource) {
        getter = () => source.map((s) => {
            if (isRef(s)) return s.value;
            if (typeof s === "function") return s();
            return deep ? traverse(s) : s;
        });
    } else if (isRef(source)) {
        getter = () => (deep ? traverse(source.value) : source.value);
    } else if (typeof source === "function") {
        getter = deep ? () => traverse(source()) : source;
    } else {
        getter = deep ? () => traverse(source) : () => source;
    }

    let oldVal;
    let isStopped = false;
    let watchCleanupFn = null;

    const stopWatcher = () => {
        if (isStopped) return;
        isStopped = true;
        if (watchCleanupFn) {
            try {
                watchCleanupFn();
            } catch (err) {
                handleError(err, "watch final cleanup");
            }
            watchCleanupFn = null;
        }
        cleanup(runner);
    };

    const job = () => {
        if (isStopped) return;
        if (watchCleanupFn) {
            try {
                watchCleanupFn();
            } catch (err) {
                handleError(err, "watch cleanup");
            }
            watchCleanupFn = null;
        }
        const newVal = runner();
        const onCleanup = (fn) => {
            if (typeof fn === "function") watchCleanupFn = fn;
        };
        cb(newVal, oldVal, onCleanup);
        oldVal = isArraySource ? [...newVal] : newVal;
        if (once) stopWatcher();
    };

    const runner = effect(getter, {
        lazy: true,
        area: "watch",
        scheduler: () => {
            if (flush === "sync") job();
            else if (flush === "post") queuePostFlushCb(job);
            else queueJob(job);
        }
    });

    oldVal = runner();
    if (isArraySource && Array.isArray(oldVal)) {
        oldVal = [...oldVal];
    }

    if (immediate) job();

    return stopWatcher;
}

export function watchEffect(effectFn, options = {}) {
    const { flush = "pre" } = options;
    let isStopped = false;
    let watchCleanupFn = null;

    const stopWatcher = () => {
        if (isStopped) return;
        isStopped = true;
        if (watchCleanupFn) {
            try {
                watchCleanupFn();
            } catch (err) {
                handleError(err, "watchEffect final cleanup");
            }
            watchCleanupFn = null;
        }
        cleanup(runner);
    };

    const job = () => {
        if (isStopped) return;
        if (watchCleanupFn) {
            try {
                watchCleanupFn();
            } catch (err) {
                handleError(err, "watchEffect cleanup");
            }
            watchCleanupFn = null;
        }
        const onCleanup = (fn) => {
            if (typeof fn === "function") watchCleanupFn = fn;
        };
        try {
            runner(onCleanup);
        } catch (err) {
            handleError(err, "watchEffect");
        }
    };

    const runner = effect((onCleanup) => {
        if (watchCleanupFn) {
            try {
                watchCleanupFn();
            } catch (err) {
                handleError(err, "watchEffect cleanup");
            }
            watchCleanupFn = null;
        }
        effectFn(onCleanup);
    }, {
        lazy: true,
        area: "watch",
        scheduler: () => {
            if (flush === "sync") job();
            else if (flush === "post") queuePostFlushCb(job);
            else queueJob(job);
        }
    });

    job();
    return stopWatcher;
}

export function traverse(value, seen = new Set()) {
    if (typeof value !== "object" || value === null || seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) traverse(value[i], seen);
    } else if (isRef(value)) {
        traverse(value.value, seen);
    } else if (value instanceof Set || value instanceof Map) {
        value.forEach((v) => traverse(v, seen));
    } else {
        for (const key in value) traverse(value[key], seen);
    }
    return value;
}
