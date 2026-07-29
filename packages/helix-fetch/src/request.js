import { FetchError } from './error.js';
import {
    resolveHeaders,
    buildUrl,
    generateId,
    withEventEmitter,
    isCacheableBody,
    getCacheKey,
    prepareSmartPayload
} from './utils.js';

export function makeCreateRequest(app, config, emit, engines) {
    const { reactive, getCurrentInstance } = (typeof Helix !== 'undefined' ? Helix : app);
    const {
        cacheEngine,
        dedupeEngine,
        queueEngine,
        visibilityEngine,
        loaderEngine,
        retryEngine,
        parseEngine,
        interceptorEngine,
        fetchTransport,
        xhrTransport
    } = engines;

    let activeRequests = 0;

    return function createRequest(method, url, initialBody = null, reqOptions = {}) {
        return function useRequest() {
            const callerInstance = typeof getCurrentInstance === 'function' ? getCurrentInstance() : null;
            const innerState = {
                data: null,
                error: null,
                loading: false,
                isFetching: false,
                status: null,
                isIdle: true,
                isSuccess: false,
                isError: false
            };

            const mayCache = config.cache === true && reqOptions.cache !== false;
            if (mayCache) innerState.isStale = false;

            const mayPoll = config.polling === true && (reqOptions.pollInterval ?? config.pollInterval) > 0;
            if (mayPoll) {
                innerState.isPolling = false;
                innerState.isPaused = false;
            }

            const mayProgress = reqOptions.onDownloadProgress || reqOptions.onUploadProgress;
            if (mayProgress) innerState.progress = 0;

            const state = reactive(innerState);
            const stateInstance = withEventEmitter(state);

            let activeController, timeoutId, lastPromise, pollTimer, debounceTimer, pendingDebounce, inFlightCount = 0;
            let visibilityHandler = null;
            let queueItem = null;
            const loaderToken = generateId();

            const performFetch = async (background = false, variables = null, pollTick = false) => {
                const shouldDedupe = pollTick ? false : (reqOptions.dedupe !== undefined
                    ? reqOptions.dedupe
                    : (method === 'GET' || method === 'HEAD'));
                state.isIdle = false; state.isSuccess = false; state.isError = false;
                inFlightCount++;
                activeController = new AbortController();
                let didTimeout = false;

                const activeBase = reqOptions.baseURL ?? config.baseURL;
                const finalUrl = buildUrl(/^(?:[a-z+]+:)?\/\//i.test(url) ? url : activeBase + url, reqOptions.params);
                let rawHeaders = resolveHeaders(method, config.headers, reqOptions.headers);

                const combinedBody = (method === 'GET' || method === 'HEAD') ? null : (variables || initialBody);
                let processedPayload = null;

                if (combinedBody && method !== 'GET' && method !== 'HEAD') {
                    const smart = prepareSmartPayload(combinedBody, rawHeaders);
                    processedPayload = smart.payload;
                    rawHeaders = smart.headers;
                }

                let traceContext = null;
                if (config.debug === true && config.enableTracing) {
                    traceContext = {
                        requestId: generateId(),
                        traceId: reqOptions.traceId || generateId(),
                        spanId: generateId(),
                        parentSpanId: reqOptions.parentSpanId || null
                    };
                    rawHeaders[config.requestIdHeader] = traceContext.requestId;
                    rawHeaders[config.traceIdHeader] = traceContext.traceId;
                }

                const shouldCache = config.cache === true && reqOptions.cache !== false && isCacheableBody(combinedBody);
                let cacheKey = null;
                if (shouldCache || shouldDedupe) {
                    cacheKey = getCacheKey(config, method, activeBase, finalUrl, reqOptions.params, combinedBody, rawHeaders, reqOptions.cacheHeaders ?? config.cacheHeaders);
                }

                if (!background && shouldCache && cacheKey && cacheEngine) {
                    const cached = cacheEngine.get(cacheKey, reqOptions.staleTime ?? config.staleTime);
                    if (cached) {
                        state.data = cached.data;
                        if ('isStale' in state) state.isStale = cached.stale;
                        if (!cached.stale) { emit('request:cachehit', { url: finalUrl, cacheKey }); return cached.data; }
                    }
                }

                if (shouldDedupe && cacheKey) {
                    const existing = dedupeEngine.get(cacheKey);
                    if (existing) {
                        dedupeEngine.acquire(cacheKey, null, null);
                        try {
                            const result = await existing.promise;
                            dedupeEngine.release(cacheKey);
                            return result;
                        } catch (err) {
                            dedupeEngine.release(cacheKey);
                            throw err;
                        }
                    }
                }

                const useLoader = !background && (reqOptions.loader ?? config.loader);
                if (useLoader && inFlightCount === 1) loaderEngine.show(loaderToken);
                if (!background) state.loading = true;
                state.isFetching = true; state.error = null;
                if ('progress' in state) state.progress = 0;

                emit('request:start', { url: finalUrl, method, background, cacheKey, trace: traceContext });

                const fetchFn = async () => {
                    try {
                        let req = { url: finalUrl, method, headers: rawHeaders, body: processedPayload, signal: activeController.signal };
                        req = interceptorEngine.request(req);

                        const timeout = reqOptions.timeout ?? config.timeout;
                        if (timeout > 0) timeoutId = setTimeout(() => { didTimeout = true; activeController.abort(); }, timeout);

                        const isXHR = reqOptions.transport === 'xhr' && xhrTransport;
                        const transportFn = isXHR ? xhrTransport : fetchTransport;
                        const res = await (retryEngine ? retryEngine.run(async () => {
                            const r = await transportFn(req, reqOptions, activeController, state);
                            clearTimeout(timeoutId);
                            const validate = reqOptions.validateStatus || config.validateStatus;
                            if (!validate(r.status)) {
                                let errData = null;
                                try { errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req); } catch { }
                                throw new FetchError(`Request failed with status ${r.status}`, req, r.status, errData, req, null, traceContext);
                            }
                            return r;
                        }, reqOptions.retry ?? config.retryCount, reqOptions.retryDelay ?? config.retryDelay, reqOptions.retryCondition ?? config.retryCondition, traceContext) : (async () => {
                            const r = await transportFn(req, reqOptions, activeController, state);
                            clearTimeout(timeoutId);
                            const validate = reqOptions.validateStatus || config.validateStatus;
                            if (!validate(r.status)) {
                                let errData = null;
                                try { errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req); } catch { }
                                throw new FetchError(`Request failed with status ${r.status}`, req, r.status, errData, req, null, traceContext);
                            }
                            return r;
                        })());

                        if (!background) state.status = res.status;

                        let data = await parseEngine.run(res, reqOptions.responseType || config.responseType, reqOptions, req);
                        data = interceptorEngine.response(data, res);

                        state.data = data;
                        if ('isStale' in state) state.isStale = false;
                        state.isSuccess = true;
                        emit('request:success', { url: finalUrl, method, status: res.status, data, cacheKey, trace: traceContext });

                        if (shouldCache && cacheKey && cacheEngine) cacheEngine.set(cacheKey, data, reqOptions.ttl ?? config.ttl, reqOptions.tags || []);

                        if (reqOptions.invalidateTags) {
                            const tags = Array.isArray(reqOptions.invalidateTags) ? reqOptions.invalidateTags : [reqOptions.invalidateTags];
                            for (const tag of tags) if (cacheEngine) cacheEngine.invalidate(tag);
                        }

                        if (reqOptions.onSuccess) reqOptions.onSuccess(data, state);
                        stateInstance.emitSuccess(data, state);
                        return data;

                    } catch (err) {
                        clearTimeout(timeoutId);
                        let finalErr = err;
                        if (err.name === 'AbortError') {
                            finalErr = new FetchError(didTimeout ? 'Timeout exceeded' : 'Request aborted', { url: finalUrl, method }, null, null, { url: finalUrl, method }, didTimeout ? 'timeout' : 'transport', traceContext);
                        } else if (!(err instanceof FetchError)) {
                            finalErr = new FetchError(err.message, null, err.status || 0, null, null, null, traceContext);
                        }

                        state.error = finalErr; state.isError = true;
                        emit('request:error', { url: finalUrl, method, error: finalErr, classification: finalErr.classification, trace: traceContext });

                        if (reqOptions.onError) reqOptions.onError(finalErr, state);
                        stateInstance.emitError(finalErr, state);

                        engines.debugLogResponse(reqOptions, { url: finalUrl, method, status: finalErr.status, reason: finalErr.message, classification: finalErr.classification, trace: finalErr.trace });

                        throw finalErr;
                    } finally {
                        if (shouldDedupe && cacheKey) dedupeEngine.release(cacheKey);
                        lastPromise = null;
                        inFlightCount = Math.max(0, inFlightCount - 1);
                        if (inFlightCount <= 0) {
                            state.isFetching = false;
                            if (!background) state.loading = false;
                            if (useLoader) loaderEngine.hide(loaderToken);
                        }
                        emit('request:end', { url: finalUrl, method, cacheKey });
                    }
                };

                let wrappedFetch = fetchFn;
                if (shouldDedupe && cacheKey) {
                    const dedupePromise = new Promise((resolve, reject) => {
                        fetchFn().then(resolve).catch(reject);
                    });
                    dedupeEngine.acquire(cacheKey, dedupePromise, activeController);
                    wrappedFetch = () => dedupePromise;
                }

                let promise;
                if (queueEngine) {
                    const { promise: qPromise, item } = queueEngine.enqueue(wrappedFetch, reqOptions.priority);
                    queueItem = item;
                    if (queueItem) {
                        qPromise.then(() => queueEngine.remove(queueItem)).catch(() => queueEngine.remove(queueItem));
                    }
                    promise = qPromise;
                } else {
                    activeRequests++;
                    promise = wrappedFetch().finally(() => { activeRequests--; });
                }

                lastPromise = promise;
                return promise;
            };

            const execute = async (variables = null) => lastPromise ? lastPromise : performFetch(false, variables, false);
            const refetch = async (pollTick = false) => {
                const debounceMs = reqOptions.debounce ?? config.debounce;
                if (debounceMs > 0 && !pollTick) {
                    clearTimeout(debounceTimer);
                    if (pendingDebounce) pendingDebounce.reject(new FetchError('Debounced', null, null, null, null));
                    return new Promise((resolve, reject) => {
                        pendingDebounce = { resolve, reject };
                        debounceTimer = setTimeout(() => {
                            performFetch(true, null, false).then(resolve).catch(reject).finally(() => pendingDebounce = null);
                        }, debounceMs);
                    });
                }
                return performFetch(true, null, pollTick);
            };

            let startPolling, stopPolling, schedulePoll;
            if (config.polling === true) {
                schedulePoll = () => {
                    if (pollTimer) return;
                    const interval = reqOptions.pollInterval ?? config.pollInterval;
                    if (!interval || interval <= 0 || state.isPaused) return;
                    pollTimer = setTimeout(() => {
                        pollTimer = null;
                        if (typeof document !== 'undefined' && document.hidden && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) { schedulePoll(); return; }
                        if (state.isFetching || state.isPaused) { schedulePoll(); return; }
                        refetch(true).catch(() => { }).finally(() => { if (state.isPolling) schedulePoll(); });
                    }, interval);
                };

                startPolling = () => {
                    if (!('isPolling' in state)) state.isPolling = false;
                    if (!('isPaused' in state)) state.isPaused = false;
                    if (state.isPolling) return;
                    state.isPolling = true;
                    state.isPaused = false;
                    schedulePoll();
                };

                stopPolling = () => { clearTimeout(pollTimer); pollTimer = null; if ('isPolling' in state) state.isPolling = false; };

                if (visibilityEngine) {
                    visibilityHandler = (isVisible, wasHidden) => {
                        if (isVisible && wasHidden) {
                            if (reqOptions.refetchOnWindowFocus ?? config.refetchOnWindowFocus) refetch().catch(() => { });
                            if ((reqOptions.pollInterval ?? config.pollInterval) && (!('isPolling' in state) || !state.isPolling) && (!('isPaused' in state) || !state.isPaused)) startPolling();
                        }
                        if (!isVisible && ('isPolling' in state) && state.isPolling && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) stopPolling();
                    };
                    visibilityEngine.subscribe(visibilityHandler);
                }
            }

            stateInstance.execute = execute;
            stateInstance.refetch = () => refetch(false);
            if (config.polling === true) {
                stateInstance.startPolling = startPolling;
                stateInstance.stopPolling = stopPolling;
                stateInstance.pausePolling = () => { if ('isPaused' in state) state.isPaused = true; };
                stateInstance.resumePolling = () => { if ('isPaused' in state) state.isPaused = false; if (('isPolling' in state) && state.isPolling) schedulePoll(); };
            }

            stateInstance.cancel = () => {
                activeController?.abort();
                if (queueItem && queueEngine) queueEngine.remove(queueItem);
                emit('request:cancel', { url });
            };

            stateInstance.then = (f, r) => (lastPromise || execute()).then(f, r);
            stateInstance.catch = (r) => (lastPromise || execute()).catch(r);

            const runCleanup = () => {
                clearTimeout(timeoutId); clearTimeout(debounceTimer);
                if (pendingDebounce) { pendingDebounce.reject(new FetchError('Cleanup', null, null, null, null)); pendingDebounce = null; }
                if (config.polling === true) stopPolling?.();
                if (visibilityHandler && visibilityEngine) { visibilityEngine.unsubscribe(visibilityHandler); visibilityHandler = null; }
                activeController?.abort();
                if (queueItem && queueEngine) queueEngine.remove(queueItem);
                loaderEngine.hide(loaderToken);
                stateInstance.clearListeners();
                emit('instance:cleanup', { url });
            };
            stateInstance._cleanup = runCleanup;

            if (callerInstance && Array.isArray(callerInstance.cleanups)) {
                callerInstance.cleanups.push(runCleanup);
            }

            if (!reqOptions.lazy) {
                if (config.polling === true && (reqOptions.pollInterval ?? config.pollInterval)) {
                    execute().then(startPolling).catch(() => { });
                } else {
                    execute().catch(() => { });
                }
            }

            return stateInstance;
        };
    };
}
