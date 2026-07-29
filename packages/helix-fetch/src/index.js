import { createEngines } from './engines.js';
import { FetchError } from './error.js';
import { makeCreateRequest } from './request.js';

const HelixFetchPlugin = {
    name: 'fetch',
    version: import.meta.env.VITE_FETCH_VERSION || '0.0.0',

    install(app, options = {}) {
        const { reactive } = (typeof Helix !== 'undefined' ? Helix : app);

        if (!reactive) {
            console.error('[Helix Fetch] Core reactivity primitives missing from compilation runtime context.');
            return () => {};
        }

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
            cache: false,
            ttl: 5000,
            staleTime: 0,
            maxCacheEntries: 500,
            maxCacheMemory: 50 * 1024 * 1024,
            cacheHeaders: [],
            memoryCache: false,
            retry: false,
            retryCount: 2,
            retryDelay: 300,
            retryCondition: (err) => {
                const c = err.classification;
                return c === 'transport' || c === 'dns' || c === 'timeout' || c === 'server' || c === 'offline' || !err.status || err.status >= 500;
            },
            queue: false,
            maxConcurrent: 10,
            queueStrategy: 'fifo',
            priorityAgingMs: 5000,
            polling: false,
            pollInterval: 0,
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
            upload: false,
            debug: false,
            enableTracing: false,
            traceIdHeader: 'x-trace-id',
            requestIdHeader: 'x-request-id',
            loader: false,
            timeout: 0,
            responseType: 'json',
            validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
            debounce: 0,
            ...options
        };

        const bus = app.$bus || (typeof window !== 'undefined' && window.Helix && window.Helix.$bus);
        const emit = (event, payload) => {
            try { if (bus && typeof bus.emit === 'function') bus.emit(`fetch:${event}`, payload); }
            catch (e) { }
        };

        const requestInterceptors = [];
        const responseInterceptors = [];

        const engines = createEngines(app, config, emit, requestInterceptors, responseInterceptors);

        const createRequest = makeCreateRequest(app, config, emit, engines);

        function upload(url, options = {}) {
            const merged = {
                ...options,
                method: options.method || 'POST',
                dedupe: false,
                cache: false
            };
            if (config.upload === true && (options.onProgress || options.onUploadProgress)) {
                merged.transport = 'xhr';
                merged.onUploadProgress = options.onProgress || options.onUploadProgress;
            }
            const body = options.formData || options.body || options.data;
            return createRequest(merged.method, url, body, merged)();
        }

        const $fetch = {
            request: (cfg = {}) => {
                const { method = 'GET', url = '', data = null, params, headers, ...rest } = cfg;
                if (!url) throw new FetchError('request() requires a URL', cfg, 0, null, null);
                return createRequest(method.toUpperCase(), url, data, { ...config, ...rest, headers, params })();
            },
            create: (instanceDefaults = {}) => {
                const instCfg = { ...config, ...instanceDefaults };
                const build = (method) => (url, body, opt) => createRequest(method, url, body, { ...instCfg, ...opt })();
                return {
                    request: (cfg = {}) => {
                        const { method = 'GET', url = '', data = null, params, headers, ...rest } = cfg;
                        if (!url) throw new FetchError('request() requires a URL', cfg, 0, null, null);
                        return createRequest(method.toUpperCase(), url, data, { ...instCfg, ...rest, headers, params })();
                    },
                    get: build('GET'), post: build('POST'), put: build('PUT'),
                    delete: build('DELETE'), patch: build('PATCH'),
                    upload: (url, opt) => upload(url, { ...instCfg, ...opt }),
                    defaults: instCfg,
                    addRequestInterceptor: $fetch.addRequestInterceptor,
                    addResponseInterceptor: $fetch.addResponseInterceptor,
                    invalidate: $fetch.invalidate,
                    invalidateExact: $fetch.invalidateExact,
                    clearCache: $fetch.clearCache,
                };
            },
            defaults: config,
            get: (url, opt) => createRequest('GET', url, null, { ...config, ...opt })(),
            post: (url, body, opt) => createRequest('POST', url, body, { ...config, ...opt })(),
            put: (url, body, opt) => createRequest('PUT', url, body, { ...config, ...opt })(),
            delete: (url, opt) => createRequest('DELETE', url, null, { ...config, ...opt })(),
            patch: (url, body, opt) => createRequest('PATCH', url, body, { ...config, ...opt })(),
            mutate: (url, opt) => createRequest(opt?.method || 'POST', url, null, { ...config, lazy: true, ...opt })(),
            upload: (url, opt) => upload(url, { ...config, ...opt }),
            addRequestInterceptor: (fn) => { requestInterceptors.push(fn); return () => { const i = requestInterceptors.indexOf(fn); if (i !== -1) requestInterceptors.splice(i, 1); }; },
            addResponseInterceptor: (fn) => { responseInterceptors.push(fn); return () => { const i = responseInterceptors.indexOf(fn); if (i !== -1) responseInterceptors.splice(i, 1); }; },
            invalidate: (tagOrPart = '') => engines.cacheEngine ? engines.cacheEngine.invalidate(tagOrPart) : undefined,
            invalidateExact: (key) => engines.cacheEngine ? engines.cacheEngine.invalidateExact(key) : undefined,
            clearCache: () => engines.cacheEngine ? engines.cacheEngine.clear() : undefined
        };

        app.$fetch = $fetch;

        if (typeof app.namespace === 'function') {
            try {
                app.namespace('fetch', {
                    $fetch,
                    addRequestInterceptor: $fetch.addRequestInterceptor,
                    addResponseInterceptor: $fetch.addResponseInterceptor,
                    invalidate: $fetch.invalidate,
                    invalidateExact: $fetch.invalidateExact,
                    clearCache: $fetch.clearCache
                });
            } catch (e) {
                console.warn('[HelixFetch] app.namespace() failed:', e.message);
            }
        }

        if (typeof app.provide === 'function') {
            try { app.provide('$fetch', $fetch); } catch (e) { }
        }

        if (typeof window !== 'undefined' && window.Helix) {
            window.Helix.$fetch = $fetch;
        }

        emit('plugin:ready', {
            version: '2.8.7', bus: !!bus, engines: {
                cache: !!engines.cacheEngine,
                queue: !!engines.queueEngine,
                retry: !!engines.retryEngine,
                polling: !!engines.visibilityEngine,
                upload: !!engines.xhrTransport,
                debug: config.debug === true
            }
        });

        if (app && typeof app.onAppUnmount === 'function') {
            app.onAppUnmount(() => {
                engines.dedupeEngine.clear();
                if (engines.queueEngine) engines.queueEngine.clear();
                if (engines.cacheEngine) engines.cacheEngine.clear();
                if (engines.visibilityEngine) engines.visibilityEngine.detach();
                app.$loader?.hide?.();
                emit('plugin:destroy');
            });
        }

        return () => {
            engines.dedupeEngine.clear();
            if (engines.queueEngine) engines.queueEngine.clear();
            if (engines.cacheEngine) engines.cacheEngine.clear();
            if (engines.visibilityEngine) engines.visibilityEngine.detach();
            app.$loader?.hide?.();
            emit('plugin:destroy');
        };
    }
};

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixFetchPlugin = HelixFetchPlugin;

export default HelixFetchPlugin;
