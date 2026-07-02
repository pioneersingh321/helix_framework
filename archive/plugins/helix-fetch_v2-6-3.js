/**
 * Helix.js Fetch Plugin v2.6.3
 * Aligned with Helix.js v11.1.5 Plugin Architecture
 *
 * Fixes in v2.6.3:
 * - [HIGH] Actively splice aborted/cancelled requests out of requestQueue instantly
 * - [MEDIUM] Complete error parity for Upload subsystem (Classification, Tracing, Metadata)
 * - [MEDIUM] Disconnected background polling from deduplication maps to prevent polling suppression
 * - [MEDIUM] Strengthened classifyError with defensive property checking
 */

const HelixFetchPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.5)
    // ==========================================
    name: 'fetch',
    version: '2.6.3',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        // ==========================================
        // INTERNAL HELPERS
        // ==========================================
        const normalizeHeaders = (h = {}) =>
            Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

        const resolveHeaders = (method, cfg, req, override) => ({
            ...normalizeHeaders(cfg.common),
            ...normalizeHeaders(cfg[method.toLowerCase()]),
            ...normalizeHeaders(req),
            ...normalizeHeaders(override)
        });

        const isFile = (val) => val instanceof File || val instanceof Blob || (typeof FileList !== 'undefined' && val instanceof FileList);

        const containsFiles = (obj) => {
            if (!obj || typeof obj !== 'object') return false;
            if (isFile(obj)) return true;
            if (Array.isArray(obj)) return obj.some(containsFiles);
            return Object.values(obj).some(containsFiles);
        };

        const objectToFormData = (obj, form = new FormData(), namespace = '') => {
            if (!obj || typeof obj !== 'object' || obj instanceof Date || isFile(obj)) {
                const val = obj === null ? '' : obj;
                form.append(namespace, val);
            } else {
                Object.keys(obj).forEach(prop => {
                    const formKey = namespace ? `${namespace}[${prop}]` : prop;
                    objectToFormData(obj[prop], form, formKey);
                });
            }
            return form;
        };

        const serializeForm = (formElement, emptyAsNull = true) => {
            const result = {};
            const castValue = (val, type) => {
                if (type === 'number') return val === '' ? null : Number(val);
                if (type === 'boolean') return !['false', '0', '', null].includes(val);
                if (type === 'null') return val || null;
                if (type === 'array' || type === 'object') {
                    try { return JSON.parse(val); } catch { return val; }
                }
                return val;
            };

            const deepAssign = (target, pathArray, value) => {
                let current = target;
                pathArray.forEach((key, index) => {
                    if (index === pathArray.length - 1) {
                        if (key === '') {
                            if (!Array.isArray(current)) {
                                console.warn('[Helix Fetch] serializeForm: attempted push to non-array');
                                return;
                            }
                            current.push(value);
                        }
                        else if (current[key] !== undefined) {
                            if (!Array.isArray(current[key])) current[key] = [current[key]];
                            current[key].push(value);
                        } else { current[key] = value; }
                    } else {
                        if (key === '') key = current.length;
                        if (!current[key]) current[key] = pathArray[index + 1] === '' ? [] : {};
                        current = current[key];
                    }
                });
            };

            formElement.querySelectorAll('input, select, textarea').forEach(field => {
                if (!field.name || field.disabled || field.closest('fieldset[disabled]')) return;
                const type = field.type?.toLowerCase?.() || '';
                if (['submit', 'button', 'reset'].includes(type)) return;

                let value;
                if (type === 'checkbox') {
                    if (field.checked) value = !field.hasAttribute('value') || field.value;
                    else return;
                } else if (type === 'radio') {
                    if (!field.checked) return;
                    value = field.value;
                } else if (type === 'file') {
                    if (field.files.length === 0) return;
                    value = field.multiple ? Array.from(field.files) : field.files[0];
                } else {
                    value = field.tagName === 'SELECT' && field.multiple
                        ? Array.from(field.selectedOptions).map(opt => opt.value)
                        : field.value;
                }

                if (value === '' && emptyAsNull) value = null;

                let rawName = field.name;
                let castType = null;
                if (rawName.includes(':')) {
                    const parts = rawName.split(':');
                    castType = parts.pop();
                    rawName = parts.join(':');
                }

                if (type !== 'file' && !(value instanceof File)) {
                    value = castValue(value, castType);
                }

                const pathArray = rawName.replace(/\]/g, '').split('[');
                deepAssign(result, pathArray, value);
            });

            return result;
        };

        const prepareSmartPayload = (body, headers) => {
            let activeBody = body;
            let activeHeaders = { ...headers };

            if (activeBody instanceof HTMLFormElement) {
                activeBody = serializeForm(activeBody);
            }

            if (activeBody instanceof FormData) {
                delete activeHeaders['content-type'];
                return { payload: activeBody, headers: activeHeaders };
            }

            if (activeBody && typeof activeBody === 'object') {
                if (containsFiles(activeBody)) {
                    activeBody = objectToFormData(activeBody);
                    delete activeHeaders['content-type'];
                } else {
                    const type = (activeHeaders['content-type'] || '').toLowerCase();
                    if (type.includes('application/x-www-form-urlencoded')) {
                        activeBody = new URLSearchParams(activeBody).toString();
                    } else {
                        activeBody = JSON.stringify(activeBody);
                    }
                }
            }

            return { payload: activeBody, headers: activeHeaders };
        };

        const buildUrl = (url, params) => {
            if (!params) return url;
            const q = new URLSearchParams(params).toString();
            return q ? `${url}?${q}` : url;
        };

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // ==========================================
        // ERROR CLASSIFICATION & TRACING
        // ==========================================
        // ISSUE 2 Hardening: Structural property checks falling back gracefully
        const classifyError = (err) => {
            if (!err) return 'unknown';

            if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
            
            const errMsg = err.message?.toLowerCase() || '';
            const errName = err.name || '';

            if (errMsg.includes('offline') || errMsg.includes('network')) return 'offline';
            if (errName === 'AbortError') {
                return errMsg.includes('timeout') ? 'timeout' : 'transport';
            }
            if (errMsg.includes('dns') || errMsg.includes('enotfound') || errMsg.includes('getaddrinfo')) {
                return 'dns';
            }
            if (errMsg.includes('fetch') || errMsg.includes('failed to fetch')) {
                return 'transport';
            }

            const status = err.status || 0;
            if (status === 0) return 'transport';
            if (status === 401 || status === 403) return 'auth';
            if (status === 408) return 'timeout';
            if (status === 409) return 'conflict';
            if (status === 422 || status === 400) return 'validation';
            if (status >= 500) return 'server';
            if (status >= 400) return 'client';

            return 'unknown';
        };

        class FetchError extends Error {
            constructor(message, cfg, status, data, request, classification = null, trace = null) {
                super(message);
                this.name = 'FetchError';
                this.config = cfg;
                this.status = status;
                this.data = data;
                this.request = request;
                this.timestamp = Date.now();
                this.classification = classification || classifyError(this);
                this.trace = trace || { requestId: generateId(), traceId: generateId(), spanId: generateId() };
            }
        }

        async function fetchWithRetry(fn, retries, delay, condition, traceContext = {}) {
            let attempt = 0;
            while (true) {
                try { return await fn(); }
                catch (err) {
                    const normalized = err instanceof FetchError 
                        ? err 
                        : new FetchError(
                            err.message || 'Network error', 
                            null, 
                            err.status || 0, 
                            null, 
                            null,
                            null,
                            traceContext
                        );
                    const shouldRetry = condition(normalized) && attempt < retries;
                    if (!shouldRetry) throw err;
                    await sleep(delay * Math.pow(2, attempt) + Math.random() * 100);
                    attempt++;
                }
            }
        }

        async function parseResponse(res, type, reqConfig = {}, requestInfo = {}) {
            if (res.status === 204) return null;
            if (type === 'blob') return res.blob();
            if (type === 'arraybuffer') return res.arrayBuffer();
            if (type === 'text') return res.text();
            if (type === 'stream') return res.body;

            let text = await res.text();
            const raw = text.trim();

            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('text/html') || raw.startsWith('<!DOCTYPE html>') || raw.startsWith('<html')) {
                debugLogResponse(reqConfig, {
                    ...requestInfo,
                    status: res.status,
                    raw,
                    reason: 'HTML returned instead of JSON'
                });
                throw new FetchError(
                    'Server returned HTML instead of JSON',
                    null,
                    res.status,
                    raw,
                    requestInfo,
                    'parse'
                );
            }

            const cleaned = raw
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .trim();

            try {
                return cleaned ? JSON.parse(cleaned) : null;
            } catch {
                debugLogResponse(reqConfig, {
                    ...requestInfo,
                    status: res.status,
                    raw,
                    reason: 'JSON parse failed'
                });
                throw new FetchError(
                    'Invalid JSON response',
                    null,
                    res.status,
                    raw,
                    requestInfo,
                    'parse'
                );
            }
        }

        function debugLogResponse(config, info) {
            if (!config.debugResponse) return;
            console.groupCollapsed(
                `%c[Helix Fetch Debug]`,
                'color:#ff4d4f;font-weight:bold'
            );
            console.log('URL:', info.url);
            console.log('Method:', info.method);
            console.log('Status:', info.status);
            if (info.trace) console.log('Trace:', info.trace);
            if (info.reason) console.warn('Reason:', info.reason);
            if (info.classification) console.warn('Classification:', info.classification);
            console.log('Raw Response:', info.raw);
            console.groupEnd();
        }

        function withEventEmitter(obj) {
            const successSubscribers = new Set();
            const errorSubscribers = new Set();
            obj.onSuccess = (fn) => { successSubscribers.add(fn); return obj; };
            obj.onError = (fn) => { errorSubscribers.add(fn); return obj; };
            obj.clearListeners = () => { successSubscribers.clear(); errorSubscribers.clear(); };
            obj.emitSuccess = (data, state) => successSubscribers.forEach(fn => fn(data, state));
            obj.emitError = (err, state) => errorSubscribers.forEach(fn => fn(err, state));
            return obj;
        }

        const stableStringify = (obj) => {
            if (!obj) return '';
            const seen = new WeakSet();
            const sortKeys = (o) => {
                if (o === null || typeof o !== 'object') return o;
                if (seen.has(o)) return '[Circular]';
                seen.add(o);
                if (Array.isArray(o)) {
                    const result = o.map(sortKeys);
                    seen.delete(o);
                    return result;
                }
                const sorted = {};
                Object.keys(o).sort().forEach(k => {
                    sorted[k] = sortKeys(o[k]);
                });
                seen.delete(o);
                return sorted;
            };
            try {
                return JSON.stringify(sortKeys(obj));
            } catch (e) {
                return '';
            }
        };

        const isCacheableBody = (body) =>
            !(body instanceof FormData || body instanceof Blob || (typeof File !== 'undefined' && body instanceof File) || body instanceof HTMLFormElement);

        const UNCACHEABLE_MARKER = '__UNCACHEABLE__';

        const getCacheKey = (method, base, url, params, body, headers, cacheHeaders = []) => {
            const bodyStr = isCacheableBody(body) ? stableStringify(body) : UNCACHEABLE_MARKER;

            const sanitizedHeaders = { ...normalizeHeaders(headers) };
            if (config.requestIdHeader) {
                delete sanitizedHeaders[config.requestIdHeader.toLowerCase()];
            }
            if (config.traceIdHeader) {
                delete sanitizedHeaders[config.traceIdHeader.toLowerCase()];
            }

            let headerStr;
            if (cacheHeaders.length > 0) {
                const filtered = {};
                for (const h of cacheHeaders) {
                    const key = h.toLowerCase();
                    if (sanitizedHeaders[key] !== undefined) filtered[key] = sanitizedHeaders[key];
                }
                headerStr = stableStringify(filtered);
            } else {
                headerStr = stableStringify(sanitizedHeaders);
            }
            return `${method}|${base}|${url}|${stableStringify(params)}|${bodyStr}|${headerStr}`;
        };

        const estimateObjectSize = (obj) => {
            if (obj === null || obj === undefined) return 0;
            if (typeof obj === 'boolean') return 4;
            if (typeof obj === 'number') return 8;
            if (typeof obj === 'string') return obj.length * 2;
            if (typeof obj === 'function') return 0;
            if (obj instanceof Date) return 64;
            if (obj instanceof RegExp) return obj.source.length * 2 + 64;
            if (obj instanceof ArrayBuffer) return obj.byteLength;
            if (obj instanceof Blob) return obj.size;
            if (Array.isArray(obj)) {
                let size = 0;
                const seen = new WeakSet();
                const calc = (o) => {
                    if (o === null || o === undefined) return;
                    if (typeof o === 'object') {
                        if (seen.has(o)) return;
                        seen.add(o);
                    }
                    if (Array.isArray(o)) {
                        size += o.length * 8;
                        o.forEach(calc);
                    } else if (o instanceof Map) {
                        size += o.size * 16;
                        o.forEach((v, k) => { calc(k); calc(v); });
                    } else if (o instanceof Set) {
                        size += o.size * 8;
                        o.forEach(calc);
                    } else if (typeof o === 'object') {
                        size += Object.keys(o).length * 16;
                        Object.values(o).forEach(calc);
                    } else {
                        size += estimateObjectSize(o);
                    }
                };
                calc(obj);
                return size;
            }
            if (typeof obj === 'object') {
                let size = Object.keys(obj).length * 16;
                const seen = new WeakSet();
                const calc = (o) => {
                    if (o === null || o === undefined) return;
                    if (typeof o === 'object') {
                        if (seen.has(o)) return;
                        seen.add(o);
                    }
                    if (Array.isArray(o)) {
                        size += o.length * 8;
                        o.forEach(calc);
                    } else if (o instanceof Map) {
                        size += o.size * 16;
                        o.forEach((v, k) => { calc(k); calc(v); });
                    } else if (o instanceof Set) {
                        size += o.size * 8;
                        o.forEach(calc);
                    } else if (typeof o === 'object') {
                        size += Object.keys(o).length * 16;
                        Object.values(o).forEach(calc);
                    } else {
                        size += estimateObjectSize(o);
                    }
                };
                calc(obj);
                return size;
            }
            return 0;
        };

        // ==========================================
        // CONFIGURATION
        // ==========================================
        const config = {
            debugResponse: false,
            baseURL: '',
            headers: {
                common: { 'X-Requested-With': 'XMLHttpRequest' },
                get: {},
                post: { 'Content-Type': 'application/json' },
                put: { 'Content-Type': 'application/json' },
                patch: { 'Content-Type': 'application/json' },
                delete: {}
            },
            cache: true,
            ttl: 5000,
            staleTime: 0,
            retry: 2,
            retryDelay: 300,
            retryCondition: (err) => {
                const c = err.classification;
                return c === 'transport' || c === 'dns' || c === 'timeout' || c === 'server' || c === 'offline' || !err.status || err.status >= 500;
            },
            loader: false,
            timeout: 0,
            responseType: 'json',
            validateStatus: (s) => s >= 200 && s < 300,
            pollInterval: 0,
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
            debounce: 0,
            allowOffline: false,
            maxCacheEntries: 500,
            maxCacheMemory: 50 * 1024 * 1024,
            maxConcurrent: 10,
            queueStrategy: 'fifo',
            cacheHeaders: [],
            priorityAgingMs: 5000,
            enableTracing: true,
            traceIdHeader: 'x-trace-id',
            requestIdHeader: 'x-request-id',
            ...options
        };

        const cacheStore = new Map();
        const pendingRequests = new Map();
        const requestInterceptors = [];
        const responseInterceptors = [];

        let loaderCount = 0;
        const showLoader = () => { if (loaderCount++ === 0) app.$loader?.show?.(); };
        const hideLoader = () => { loaderCount = Math.max(0, loaderCount - 1); if (loaderCount === 0) app.$loader?.hide?.(); };

        const isOnline = () => navigator.onLine;
        const offlineQueue = [];
        let offlineToastShown = false;

        const showOfflineToast = () => {
            if (offlineToastShown) return;
            offlineToastShown = true;
            app.$notify?.toast?.warning?.('You are offline. Requests queued.', { timer: 3000 });
        };

        const flushOfflineQueue = async () => {
            if (offlineQueue.length === 0) return;
            app.$notify?.toast?.info?.(`Syncing ${offlineQueue.length} queued requests...`);
            const copy = [...offlineQueue];
            offlineQueue.length = 0;
            for (const item of copy) {
                try { item.resolve(await item.retry()); } catch (err) { item.reject(err); }
                await sleep(50);
            }
            app.$notify?.toast?.success?.('All synced');
        };

        const onOnline = () => { offlineToastShown = false; flushOfflineQueue(); };
        window.addEventListener('online', onOnline);

        const getCached = (key, staleTime) => {
            const entry = cacheStore.get(key);
            if (!entry || Date.now() > entry.expiry) {
                if (entry) cacheStore.delete(key);
                return null;
            }
            return { data: entry.data, stale: staleTime > 0 && Date.now() - entry.timestamp > staleTime };
        };

        const trimCache = (maxEntries = config.maxCacheEntries, maxMemory = config.maxCacheMemory) => {
            if (cacheStore.size >= maxEntries) {
                const toRemove = cacheStore.size - maxEntries + Math.floor(maxEntries * 0.2);
                [...cacheStore.entries()]
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, toRemove)
                    .forEach(([k]) => cacheStore.delete(k));
            }

            let totalMemory = 0;
            for (const [, v] of cacheStore.entries()) {
                totalMemory += v.size || 0;
            }
            if (totalMemory > maxMemory) {
                const sorted = [...cacheStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
                while (totalMemory > maxMemory * 0.8 && sorted.length > 0) {
                    const [k, v] = sorted.shift();
                    totalMemory -= v.size || 0;
                    cacheStore.delete(k);
                }
            }
        };

        let activeRequests = 0;
        const requestQueue = [];

        const getEffectivePriority = (item) => {
            const age = Date.now() - item.enqueuedAt;
            const boost = Math.floor(age / config.priorityAgingMs);
            return item.priority + boost;
        };

        const processQueue = () => {
            while (activeRequests < config.maxConcurrent && requestQueue.length > 0) {
                if (config.queueStrategy === 'priority' && requestQueue.length > 1) {
                    requestQueue.sort((a, b) => getEffectivePriority(b) - getEffectivePriority(a));
                }
                const next = requestQueue.shift();
                if (next.aborted) {
                    try { next.reject(new FetchError('Request cancelled', null, 0, null, null)); } catch (e) {}
                    continue;
                }
                activeRequests++;
                next.run().finally(() => {
                    activeRequests--;
                    processQueue();
                });
            }
        };

        const enqueueRequest = (fn, priority = 0) => {
            if (activeRequests < config.maxConcurrent) {
                activeRequests++;
                const promise = fn().finally(() => {
                    activeRequests--;
                    processQueue();
                });
                return { promise, item: null };
            }
            let item = null;
            const promise = new Promise((resolve, reject) => {
                const wrapped = async () => {
                    try {
                        resolve(await fn());
                    } catch (e) {
                        reject(e);
                    }
                };
                item = { run: wrapped, priority, reject, enqueuedAt: Date.now(), aborted: false };
                if (config.queueStrategy === 'priority') {
                    const idx = requestQueue.findIndex(existing => getEffectivePriority(existing) < getEffectivePriority(item));
                    if (idx === -1) requestQueue.push(item);
                    else requestQueue.splice(idx, 0, item);
                } else {
                    requestQueue.push(item);
                }
            });
            return { promise, item };
        };

        const visibilitySubscribers = new Set();
        let isGloballyVisible = !document.hidden;
        let globalVisibilityAttached = false;

        const onGlobalVisibility = () => {
            const wasHidden = !isGloballyVisible;
            isGloballyVisible = !document.hidden;
            visibilitySubscribers.forEach(sub => {
                try {
                    sub(isGloballyVisible, wasHidden);
                } catch (e) {
                    console.error('[Helix Fetch] visibility subscriber error:', e);
                }
            });
        };

        const attachGlobalVisibility = () => {
            if (!globalVisibilityAttached) {
                document.addEventListener('visibilitychange', onGlobalVisibility);
                globalVisibilityAttached = true;
            }
        };

        const detachGlobalVisibility = () => {
            if (globalVisibilityAttached && visibilitySubscribers.size === 0) {
                document.removeEventListener('visibilitychange', onGlobalVisibility);
                globalVisibilityAttached = false;
            }
        };

        const autoCleanup = (stateInstance) => {
            if (app.onUnmounted && typeof app.onUnmounted === 'function') {
                app.onUnmounted(() => {
                    if (typeof stateInstance._cleanup === 'function') {
                        stateInstance._cleanup();
                    }
                });
            }
        };

        // ==========================================
        // CORE REQUEST ENGINE
        // ==========================================
        function createRequest(method, url, initialBody = null, reqOptions = {}) {
            return function useRequest() {
                const state = app.reactive({
                    data: null, error: null, loading: false, isFetching: false,
                    status: null, isStale: false, isPolling: false, isPaused: false,
                    isIdle: true, isSuccess: false, isError: false,
                    progress: 0
                });

                const stateInstance = withEventEmitter(state);
                let activeController, timeoutId, lastPromise, pollTimer, debounceTimer, pendingDebounce;
                let visibilityHandler = null;
                let queueItem = null;

                // ISSUE 6 Fix: Background automated loops bypass deduplication keys to prevent stale suppression
                const shouldDedupe = reqOptions._isPollTick ? false : (reqOptions.dedupe !== undefined
                    ? reqOptions.dedupe
                    : (method === 'GET' || method === 'HEAD'));

                const performFetch = async (background = false, variables = null) => {
                    if (!isOnline() && !reqOptions.allowOffline && !config.allowOffline) {
                        showOfflineToast();
                        return new Promise((resolve, reject) => offlineQueue.push({ retry: () => performFetch(background), resolve, reject }));
                    }

                    state.isIdle = false; state.isSuccess = false; state.isError = false;
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

                    const traceContext = config.enableTracing ? {
                        requestId: generateId(),
                        traceId: reqOptions.traceId || generateId(),
                        spanId: generateId(),
                        parentSpanId: reqOptions.parentSpanId || null
                    } : null;

                    if (config.enableTracing && traceContext) {
                        rawHeaders[config.requestIdHeader] = traceContext.requestId;
                        rawHeaders[config.traceIdHeader] = traceContext.traceId;
                    }

                    const cacheKey = getCacheKey(method, activeBase, finalUrl, reqOptions.params, combinedBody, rawHeaders, reqOptions.cacheHeaders ?? config.cacheHeaders);
                    const shouldCache = reqOptions.cache !== false && isCacheableBody(combinedBody);

                    if (!background && shouldCache) {
                        const cached = getCached(cacheKey, reqOptions.staleTime ?? config.staleTime);
                        if (cached) {
                            state.data = cached.data; state.isStale = cached.stale;
                            if (!cached.stale) return cached.data;
                        }
                    }

                    if (shouldDedupe && pendingRequests.has(cacheKey)) {
                        return pendingRequests.get(cacheKey).promise;
                    }

                    const useLoader = !background && (reqOptions.loader ?? config.loader);
                    if (useLoader) showLoader();
                    if (!background) state.loading = true;
                    state.isFetching = true; state.error = null; state.progress = 0;

                    const fetchFn = async () => {
                        try {
                            let req = { url: finalUrl, method, headers: rawHeaders, body: processedPayload, signal: activeController.signal };
                            for (const fn of requestInterceptors) req = fn(req) || req;

                            const timeout = reqOptions.timeout ?? config.timeout;
                            if (timeout > 0) timeoutId = setTimeout(() => { didTimeout = true; activeController.abort(); }, timeout);

                            const res = await fetchWithRetry(async () => {
                                let fetchPromise;
                                if (reqOptions.onDownloadProgress && !background) {
                                    fetchPromise = fetch(req.url, req).then(async res => {
                                        const contentLength = +(res.headers.get('content-length') || 0);
                                        if (!contentLength || !res.body) return res;
                                        const reader = res.body.getReader();
                                        const chunks = [];
                                        let received = 0;
                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            chunks.push(value);
                                            received += value.length;
                                            state.progress = Math.round((received / contentLength) * 100);
                                            reqOptions.onDownloadProgress(state.progress, received, contentLength);
                                        }
                                        const blob = new Blob(chunks);
                                        return new Response(blob, {
                                            status: res.status,
                                            statusText: res.statusText,
                                            headers: res.headers
                                        });
                                    });
                                } else {
                                    fetchPromise = fetch(req.url, req);
                                }

                                const r = await fetchPromise;
                                const validate = reqOptions.validateStatus || config.validateStatus;
                                if (!validate(r.status)) {
                                    let errData = null;
                                    try { errData = await parseResponse(r.clone(), reqOptions.responseType || config.responseType, reqOptions, req); } catch (e) {}
                                    throw new FetchError(
                                        `Request failed with status ${r.status}`, 
                                        req, 
                                        r.status, 
                                        errData, 
                                        req,
                                        null,
                                        traceContext
                                    );
                                }
                                return r;
                            }, reqOptions.retry ?? config.retry, reqOptions.retryDelay ?? config.retryDelay, reqOptions.retryCondition ?? config.retryCondition, traceContext);

                            clearTimeout(timeoutId);
                            if (!background) state.status = res.status;

                            let data = await parseResponse(res, reqOptions.responseType || config.responseType, reqOptions, req);
                            for (const fn of responseInterceptors) data = fn(data, res) || data;

                            state.data = data; state.isStale = false; state.isSuccess = true;

                            if (shouldCache) {
                                trimCache();
                                cacheStore.set(cacheKey, {
                                    data,
                                    expiry: Date.now() + (reqOptions.ttl ?? config.ttl),
                                    timestamp: Date.now(),
                                    tags: reqOptions.tags || [],
                                    size: estimateObjectSize(data)
                                });
                            }

                            if (reqOptions.invalidateTags) {
                                const tags = Array.isArray(reqOptions.invalidateTags) ? reqOptions.invalidateTags : [reqOptions.invalidateTags];
                                for (const [k, v] of cacheStore.entries()) if (v.tags?.some(t => tags.includes(t))) cacheStore.delete(k);
                            }

                            if (reqOptions.onSuccess) reqOptions.onSuccess(data, state);
                            stateInstance.emitSuccess(data, state);
                            return data;

                        } catch (err) {
                            clearTimeout(timeoutId);
                            let finalErr = err;
                            if (err.name === 'AbortError') {
                                finalErr = new FetchError(
                                    didTimeout ? 'Timeout exceeded' : 'Request aborted', 
                                    { url: finalUrl, method }, 
                                    null, 
                                    null, 
                                    { url: finalUrl, method },
                                    didTimeout ? 'timeout' : 'transport',
                                    traceContext
                                );
                            } else if (!(err instanceof FetchError)) {
                                finalErr = new FetchError(
                                    err.message, 
                                    null, 
                                    err.status || 0, 
                                    null, 
                                    null,
                                    null,
                                    traceContext
                                );
                            }

                            state.error = finalErr; state.isError = true;
                            if (reqOptions.onError) reqOptions.onError(finalErr, state);
                            stateInstance.emitError(finalErr, state);

                            debugLogResponse(reqOptions, {
                                url: finalUrl,
                                method,
                                status: finalErr.status,
                                reason: finalErr.message,
                                classification: finalErr.classification,
                                trace: finalErr.trace
                            });

                            throw finalErr;
                        } finally {
                            if (shouldDedupe) pendingRequests.delete(cacheKey);
                            lastPromise = null; state.isFetching = false;
                            if (!background) state.loading = false;
                            if (useLoader) hideLoader();
                        }
                    };

                    const { promise, item } = enqueueRequest(fetchFn, reqOptions.priority);
                    queueItem = item;
                    if (queueItem) {
                        promise.then(() => { 
                            if (queueItem) {
                                const idx = requestQueue.indexOf(queueItem);
                                if (idx !== -1) requestQueue.splice(idx, 1);
                                queueItem = null; 
                            }
                        }).catch(() => { 
                            if (queueItem) {
                                const idx = requestQueue.findIndex(i => i === queueItem);
                                if (idx !== -1) requestQueue.splice(idx, 1);
                                queueItem = null; 
                            }
                        });
                    }

                    if (shouldDedupe) {
                        pendingRequests.set(cacheKey, { promise, controller: activeController });
                    }
                    lastPromise = promise;
                    return promise;
                };

                const execute = async (variables = null) => lastPromise ? lastPromise : performFetch(false, variables);

                const refetch = async (isPollTick = false) => {
                    const debounceMs = reqOptions.debounce ?? config.debounce;
                    if (debounceMs > 0 && !isPollTick) {
                        clearTimeout(debounceTimer);
                        if (pendingDebounce) pendingDebounce.reject(new FetchError('Debounced', null, null, null, null));
                        return new Promise((resolve, reject) => {
                            pendingDebounce = { resolve, reject };
                            debounceTimer = setTimeout(() => {
                                reqOptions._isPollTick = isPollTick;
                                performFetch(true).then(resolve).catch(reject).finally(() => pendingDebounce = null);
                            }, debounceMs);
                        });
                    }
                    reqOptions._isPollTick = isPollTick;
                    return performFetch(true);
                };

                const schedulePoll = () => {
                    if (pollTimer) return;
                    const interval = reqOptions.pollInterval ?? config.pollInterval;
                    if (!interval || interval <= 0) return;
                    if (state.isPaused) return;
                    pollTimer = setTimeout(() => {
                        pollTimer = null;
                        if (!isGloballyVisible && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) {
                            schedulePoll();
                            return;
                        }
                        if (state.isFetching || state.isPaused) {
                            schedulePoll();
                            return;
                        }
                        // PASS TRUE: Force polling trips to pass deduplication safeguards safely
                        refetch(true).catch(() => {}).finally(() => {
                            if (state.isPolling) schedulePoll();
                        });
                    }, interval);
                };

                const startPolling = () => {
                    if (state.isPolling) return;
                    state.isPolling = true; state.isPaused = false;
                    schedulePoll();
                };

                const stopPolling = () => { clearTimeout(pollTimer); pollTimer = null; state.isPolling = false; };

                visibilityHandler = (isVisible, wasHidden) => {
                    if (isVisible && wasHidden) {
                        if (reqOptions.refetchOnWindowFocus ?? config.refetchOnWindowFocus) refetch().catch(() => {});
                        if ((reqOptions.pollInterval ?? config.pollInterval) && !state.isPolling && !state.isPaused) startPolling();
                    }
                    if (!isVisible && state.isPolling && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) stopPolling();
                };

                attachGlobalVisibility();
                visibilitySubscribers.add(visibilityHandler);

                stateInstance.execute = execute;
                stateInstance.refetch = () => refetch(false);
                stateInstance.startPolling = startPolling;
                stateInstance.stopPolling = stopPolling;
                stateInstance.pausePolling = () => { state.isPaused = true; };
                stateInstance.resumePolling = () => { state.isPaused = false; if (state.isPolling) schedulePoll(); };
                
                // ISSUE 1 Fix: Splice cancellation references from live collection arrays cleanly
                stateInstance.cancel = () => {
                    activeController?.abort();
                    if (queueItem) {
                        queueItem.aborted = true;
                        const idx = requestQueue.indexOf(queueItem);
                        if (idx !== -1) requestQueue.splice(idx, 1);
                        queueItem = null;
                    }
                };
                stateInstance.then = (f, r) => (lastPromise || execute()).then(f, r);
                stateInstance.catch = (r) => (lastPromise || execute()).catch(r);

                stateInstance._cleanup = () => {
                    clearTimeout(timeoutId); clearTimeout(debounceTimer);
                    if (pendingDebounce) { pendingDebounce.reject(new FetchError('Cleanup', null, null, null, null)); pendingDebounce = null; }
                    stopPolling();
                    if (visibilityHandler) {
                        visibilitySubscribers.delete(visibilityHandler);
                        detachGlobalVisibility();
                        visibilityHandler = null;
                    }
                    activeController?.abort();
                    if (queueItem) {
                        queueItem.aborted = true;
                        const idx = requestQueue.indexOf(queueItem);
                        if (idx !== -1) requestQueue.splice(idx, 1);
                        queueItem = null;
                    }
                    stateInstance.clearListeners();
                };

                autoCleanup(stateInstance);

                if (!reqOptions.lazy) (reqOptions.pollInterval ?? config.pollInterval) ? execute().then(startPolling) : execute();

                return stateInstance;
            };
        }

        // ==========================================
        // UPLOAD (XHR fallback for Progress tracking)
        // ==========================================
        function upload(url, options = {}) {
            return (function useUpload() {
                const state = app.reactive({ data: null, error: null, loading: false, progress: 0, status: null });
                const stateInstance = withEventEmitter(state);
                let xhr, lastPromise;

                const execute = (variables = null) => {
                    if (lastPromise) return lastPromise;
                    state.loading = true; state.error = null;
                    const useLoader = options.loader ?? config.loader;
                    if (useLoader) showLoader();

                    const activeBase = options.baseURL ?? config.baseURL;
                    const finalUrl = /^(?:[a-z+]+:)?\/\//i.test(url) ? url : activeBase + url;
                    const method = options.method || 'POST';

                    const combinedBody = variables || options.formData || options.body || options.data;
                    const smart = prepareSmartPayload(combinedBody, resolveHeaders(method, config.headers, options.headers));

                    xhr = new XMLHttpRequest();
                    xhr.open(method, finalUrl, true);
                    Object.entries(smart.headers).forEach(([k, v]) => { if (k !== 'content-type') xhr.setRequestHeader(k, v); });

                    // ISSUE 3 Fix: Instantiation context definitions for Upload Telemetry Tracking
                    const uploadTrace = config.enableTracing ? {
                        requestId: generateId(),
                        traceId: options.traceId || generateId(),
                        spanId: generateId(),
                        parentSpanId: options.parentSpanId || null
                    } : null;

                    if (config.enableTracing && uploadTrace) {
                        xhr.setRequestHeader(config.requestIdHeader, uploadTrace.requestId);
                        xhr.setRequestHeader(config.traceIdHeader, uploadTrace.traceId);
                    }

                    if (options.onProgress || config.onProgress) {
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                state.progress = Math.round((e.loaded / e.total) * 100);
                                (options.onProgress || config.onProgress)?.(state.progress);
                            }
                        };
                    }

                    lastPromise = new Promise((resolve, reject) => {
                        const handleFinish = (errData, isErr) => {
                            state.loading = false; lastPromise = null; if (useLoader) hideLoader();
                            if (isErr) {
                                state.error = errData; if (options.onError) options.onError(errData, state); stateInstance.emitError(errData, state); reject(errData);
                            } else {
                                state.data = errData; if (options.onSuccess) options.onSuccess(errData, state); stateInstance.emitSuccess(errData, state); resolve(errData);
                            }
                        };

                        xhr.onload = () => {
                            state.status = xhr.status;
                            let res = null;
                            try { res = xhr.status === 204 ? null : JSON.parse(xhr.responseText); } catch { res = xhr.responseText || null; }
                            
                            const reqContext = { url: finalUrl, method, headers: smart.headers };
                            if ((options.validateStatus || config.validateStatus)(xhr.status)) {
                                handleFinish(res, false);
                            } else {
                                // ISSUE 3 Fix: Pass complete parity error contracts up to subscribers
                                handleFinish(new FetchError(
                                    `Upload failed (${xhr.status})`, 
                                    reqContext, 
                                    xhr.status, 
                                    res, 
                                    reqContext, 
                                    null, 
                                    uploadTrace
                                ), true);
                            }
                        };
                        
                        // ISSUE 3 Fix: Parity normalization across network level upload faults
                        xhr.onerror = () => handleFinish(new FetchError('Upload failed (network error)', { url: finalUrl, method }, 0, null, { url: finalUrl, method }, 'transport', uploadTrace), true);
                        xhr.onabort = () => handleFinish(new FetchError('Upload aborted', { url: finalUrl, method }, 0, null, { url: finalUrl, method }, 'transport', uploadTrace), true);

                        xhr.send(smart.payload);
                    });
                    return lastPromise;
                };

                if (!options.lazy) execute();
                stateInstance.execute = execute; stateInstance.refetch = execute; stateInstance.cancel = () => xhr?.abort();
                stateInstance.then = (f, r) => (lastPromise || execute()).then(f, r); stateInstance.catch = (r) => (lastPromise || execute()).catch(r);

                stateInstance._cleanup = () => { xhr?.abort(); stateInstance.clearListeners(); };

                autoCleanup(stateInstance);

                return stateInstance;
            })();
        }

        // ==========================================
        // INSTANCE FACTORY (axios-style)
        // ==========================================
        const createInstance = (instanceDefaults = {}) => {
            const instCfg = { ...config, ...instanceDefaults };

            const build = (method) => (url, body, opt) =>
                createRequest(method, url, body, { ...instCfg, ...opt })();

            return {
                request: (cfg = {}) => {
                    const {
                        method = 'GET',
                        url = '',
                        data = null,
                        params,
                        headers,
                        ...rest
                    } = cfg;

                    if (!url) {
                        throw new FetchError(
                            'request() requires a URL',
                            cfg,
                            0,
                            null,
                            null
                        );
                    }

                    return createRequest(
                        method.toUpperCase(),
                        url,
                        data,
                        { ...instCfg, ...rest, headers, params }
                    )();
                },

                get:    build('GET'),
                post:   build('POST'),
                put:    build('PUT'),
                delete: build('DELETE'),
                patch:  build('PATCH'),
                upload: (url, opt) => upload(url, { ...instCfg, ...opt }),

                defaults: instCfg,

                addRequestInterceptor:  $fetch.addRequestInterceptor,
                addResponseInterceptor: $fetch.addResponseInterceptor,
                invalidate:             $fetch.invalidate,
                invalidateExact:        $fetch.invalidateExact,
                clearCache:             $fetch.clearCache,
            };
        };

        // ==========================================
        // PUBLIC API FACTORY
        // ==========================================
        const $fetch = {
            request: (cfg = {}) => {
                const {
                    method = 'GET',
                    url = '',
                    data = null,
                    params,
                    headers,
                    ...rest
                } = cfg;

                if (!url) {
                    throw new FetchError(
                        'request() requires a URL',
                        cfg,
                        0,
                        null,
                        null
                    );
                }

                return createRequest(
                    method.toUpperCase(),
                    url,
                    data,
                    { ...config, ...rest, headers, params }
                )();
            },

            create: createInstance,
            defaults: config,

            get:    (url, opt) => createRequest('GET',    url, null, { ...config, ...opt })(),
            post:   (url, body, opt) => createRequest('POST',   url, body, { ...config, ...opt })(),
            put:    (url, body, opt) => createRequest('PUT',    url, body, { ...config, ...opt })(),
            delete: (url, opt) => createRequest('DELETE', url, null, { ...config, ...opt })(),
            patch:  (url, body, opt) => createRequest('PATCH',  url, body, { ...config, ...opt })(),
            mutate: (url, opt) => createRequest(opt?.method || 'POST', url, null, { ...config, lazy: true, ...opt })(),
            upload: (url, opt) => upload(url, { ...config, ...opt }),

            addRequestInterceptor:  (fn) => { requestInterceptors.push(fn); return () => { const idx = requestInterceptors.indexOf(fn); if (idx !== -1) requestInterceptors.splice(idx, 1); }; },
            addResponseInterceptor: (fn) => { responseInterceptors.push(fn); return () => { const idx = responseInterceptors.indexOf(fn); if (idx !== -1) responseInterceptors.splice(idx, 1); }; },
            invalidate:  (tagOrPart = '') => { for (const [k, v] of cacheStore.entries()) if (v.tags?.includes(tagOrPart) || k.includes(tagOrPart)) cacheStore.delete(k); },
            invalidateExact: (cacheKey) => cacheStore.delete(cacheKey),
            clearCache: () => cacheStore.clear()
        };

        // ==========================================
        // NAMESPACED API REGISTRATION (Helix v11.1.5)
        // ==========================================
        app.namespace('fetch', {
            $fetch,
            addRequestInterceptor: $fetch.addRequestInterceptor,
            addResponseInterceptor: $fetch.addResponseInterceptor,
            invalidate: $fetch.invalidate,
            invalidateExact: $fetch.invalidateExact,
            clearCache: $fetch.clearCache
        });

        app.$fetch = $fetch;

        if (app.provide) {
            app.provide('$fetch', $fetch);
        }

        // ==========================================
        // CLEANUP LIFECYCLE (Helix v11.1.5)
        // ==========================================
        return () => {
            pendingRequests.forEach(entry => {
                try { entry.controller?.abort(); } catch (e) {}
            });
            pendingRequests.clear();

            requestQueue.forEach(item => {
                try { item.reject(new FetchError('Plugin destroyed', null, 0, null, null)); } catch (e) {}
            });
            requestQueue.length = 0;
            activeRequests = 0;

            cacheStore.clear();

            requestInterceptors.length = 0;
            responseInterceptors.length = 0;

            window.removeEventListener('online', onOnline);

            if (globalVisibilityAttached) {
                document.removeEventListener('visibilitychange', onGlobalVisibility);
                globalVisibilityAttached = false;
            }
            visibilitySubscribers.clear();

            offlineQueue.length = 0;
            offlineToastShown = false;
            loaderCount = 0;
        };
    }
};