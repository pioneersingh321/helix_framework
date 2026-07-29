import { executeRequest } from './request.js';

export function createReactiveRequest(app, instance, pending, method, url, data = null, reqOptions = {}) {
    return function useRequest() {
        const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
        const reactiveFn = (app && typeof app.reactive === 'function') ? app.reactive.bind(app) : (Helix && typeof Helix.reactive === 'function' ? Helix.reactive : null);
        const getCurrentInstance = (Helix && typeof Helix.getCurrentInstance === 'function')
            ? Helix.getCurrentInstance
            : (app && typeof app.getCurrentInstance === 'function' ? app.getCurrentInstance : null);
        const callerInstance = getCurrentInstance ? getCurrentInstance() : null;

        if (!reactiveFn) {
            throw new Error('[Helix Axios] reactive engine not found. Ensure Helix is loaded.');
        }

        const state = reactiveFn({
            data: null,
            error: null,
            loading: false,
            status: null,
            headers: null,
            progress: 0,
            uploadProgress: 0,
            downloadProgress: 0,
            completedAt: null,
            timestamp: null
        });

        const { signal: hookSignal, lazy, ...baseOpts } = reqOptions;

        let lastPromise = null;
        let runId = 0;

        const execute = (override = {}) => {
            const current = ++runId;
            const isCurrent = () => current === runId;

            const config = { ...baseOpts, ...override };
            if (hookSignal) config.signal = hookSignal;

            const hooks = {
                onStart: () => {
                    if (!isCurrent()) return;
                    state.loading = true;
                    state.error = null;
                    state.progress = 0;
                    state.uploadProgress = 0;
                    state.downloadProgress = 0;
                },
                onUploadProgress: (pct) => {
                    if (!isCurrent()) return;
                    state.uploadProgress = pct;
                    state.progress = pct;
                },
                onDownloadProgress: (pct) => {
                    if (!isCurrent()) return;
                    state.downloadProgress = pct;
                    state.progress = pct;
                },
                onSuccess: (res) => {
                    if (!isCurrent()) return;
                    state.data = res.data;
                    state.status = res.status;
                    state.headers = res.headers;
                    state.completedAt = Date.now();
                    state.timestamp = state.completedAt;
                },
                onError: (err) => {
                    if (!isCurrent()) return;
                    state.error = err;
                    state.status = err.status;
                },
                onSettle: () => {
                    if (!isCurrent()) return;
                    state.loading = false;
                }
            };

            lastPromise = executeRequest(instance, pending, method, url, data, config, hooks);
            return lastPromise;
        };

        const inst = state;
        inst.execute = execute;
        inst.cancel = () => { lastPromise?.cancel?.(); };
        inst.promise = () => lastPromise || (lastPromise = execute());

        inst.then = (f, r) => {
            if (!lastPromise) lastPromise = execute();
            return lastPromise.then(f, r);
        };
        inst.catch = (r) => {
            if (!lastPromise) lastPromise = execute();
            return lastPromise.catch(r);
        };

        if (callerInstance && Array.isArray(callerInstance.cleanups)) {
            callerInstance.cleanups.push(() => { inst.cancel(); });
        }

        if (!lazy) execute();

        return inst;
    };
}
