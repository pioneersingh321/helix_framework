/**
 * Helix.js Axios Plugin v2.0
 * Aligned with Helix.js v11.1.5 Plugin Architecture
 * 
 * Features:
 * - Plugin metadata & versioning
 * - Cleanup lifecycle (returns cleanup function)
 * - Namespaced API registration
 * - Async plugin support (install can be async)
 */

const HelixAxiosPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.5)
    // ==========================================
    name: 'axios',
    version: '2.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        // ==========================================
        // 1. DEFAULTS & CONFIG
        // ==========================================
        const defaults = {
            baseURL: '/',
            timeout: 10000,
            retries: 0,
            retryDelay: 300,
            retryCondition: (err) => !err.status || err.status >= 500,
            dedupe: false,
            csrf: false,
            headers: {},
            ...options
        };

        // ==========================================
        // 2. AXIOS INSTANCE FACTORY
        // ==========================================
        function createAxiosInstance(config = {}) {
            const merged = { ...defaults, ...config };

            const axiosLib = typeof axios !== 'undefined' ? axios : null;
            if (!axiosLib) {
                console.error('[Helix Axios] axios library not found. Load axios before this plugin.');
                return null;
            }

            const instance = axiosLib.create({
                baseURL: merged.baseURL,
                timeout: merged.timeout,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                    ...merged.headers
                }
            });

            if (merged.csrf) {
                const token = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];
                if (token) instance.defaults.headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
            }

            return instance;
        }

        const baseAxios = createAxiosInstance(options);
        if (!baseAxios) return;

        // ==========================================
        // 3. PENDING REQUESTS (DEDUPE)
        // ==========================================
        const pendingRequests = new Map();
        const activeRequests = new Set();

        function getDedupeKey(method, url, data, params) {
            return `${method}|${url}|${JSON.stringify(data || null)}|${JSON.stringify(params || null)}`;
        }

        // ==========================================
        // 4. ERROR NORMALIZER
        // ==========================================
        const normalizeError = (err) => {
            if (err?.response) {
                return {
                    name: 'AxiosError',
                    status: err.response.status,
                    data: err.response.data,
                    message: err.response.data?.message || `Request failed with status ${err.response.status}`,
                    headers: err.response.headers,
                    config: err.config
                };
            }
            if (err?.request) {
                return {
                    name: 'NetworkError',
                    status: 0,
                    data: null,
                    message: err.message || 'Network error — no response received',
                    headers: {},
                    config: err.config
                };
            }
            return {
                name: 'RequestError',
                status: null,
                data: null,
                message: err?.message || 'Request setup error',
                headers: {},
                config: null
            };
        };

        // ==========================================
        // 5. RETRY WITH BACKOFF
        // ==========================================
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        async function retryWithBackoff(fn, retries, delay, condition) {
            let attempt = 0;
            while (true) {
                try {
                    return await fn();
                } catch (err) {
                    const normalized = normalizeError(err);
                    const shouldRetry = condition(normalized) && attempt < retries;
                    if (!shouldRetry) throw normalized;

                    const backoff = delay * Math.pow(2, attempt) + Math.random() * 100;
                    await sleep(backoff);
                    attempt++;
                }
            }
        }

        // ==========================================
        // 6. CORE REQUEST WRAPPER
        // ==========================================
        function request(method, url, data = null, config = {}) {
            const controller = new AbortController();
            const userSignal = config.signal;
            delete config.signal;

            if (userSignal) {
                userSignal.addEventListener('abort', () => controller.abort());
            }

            const exec = async () => {
                try {
                    const res = await baseAxios({
                        method,
                        url,
                        data,
                        ...config,
                        signal: controller.signal
                    });
                    return res.data;
                } catch (err) {
                    throw err;
                }
            };

            const promise = retryWithBackoff(
                exec,
                config.retries ?? defaults.retries,
                config.retryDelay ?? defaults.retryDelay,
                config.retryCondition ?? defaults.retryCondition
            );

            promise.cancel = () => controller.abort();
            activeRequests.add(promise);
            promise.finally(() => activeRequests.delete(promise));

            return promise;
        }

        // ==========================================
        // 7. REACTIVE REQUEST FACTORY
        // ==========================================
        function createReactiveRequest(method, url, data = null, reqOptions = {}) {
            return function useRequest() {
                const state = app.reactive({
                    data: null,
                    error: null,
                    loading: false,
                    status: null,
                    progress: 0,
                    timestamp: null
                });

                const controller = new AbortController();
                const userSignal = reqOptions.signal;
                delete reqOptions.signal;

                if (userSignal) {
                    userSignal.addEventListener('abort', () => controller.abort());
                }

                let lastPromise = null;

                const execute = async (override = {}) => {
                    state.loading = true;
                    state.error = null;
                    state.progress = 0;

                    const finalConfig = {
                        ...reqOptions,
                        ...override,
                        signal: controller.signal,
                        onUploadProgress: (e) => {
                            if (e.lengthComputable) {
                                state.progress = Math.round((e.loaded / e.total) * 100);
                            }
                        },
                        onDownloadProgress: (e) => {
                            if (e.lengthComputable) {
                                state.progress = Math.round((e.loaded / e.total) * 100);
                            }
                        }
                    };

                    const dedupeKey = getDedupeKey(method, url, data, finalConfig.params);
                    const useDedupe = finalConfig.dedupe ?? defaults.dedupe;

                    if (useDedupe && pendingRequests.has(dedupeKey)) {
                        return pendingRequests.get(dedupeKey);
                    }

                    const promise = (async () => {
                        try {
                            const res = await baseAxios({
                                method,
                                url,
                                data,
                                ...finalConfig
                            });

                            state.data = res.data;
                            state.status = res.status;
                            state.timestamp = Date.now();
                            return res.data;
                        } catch (err) {
                            const normalized = normalizeError(err);
                            state.error = normalized;
                            state.status = normalized.status;
                            throw normalized;
                        } finally {
                            state.loading = false;
                            pendingRequests.delete(dedupeKey);
                        }
                    })();

                    if (useDedupe) {
                        pendingRequests.set(dedupeKey, promise);
                    }

                    lastPromise = promise;
                    return promise;
                };

                const instance = state;
                instance.execute = execute;
                instance.cancel = () => controller.abort();

                instance.then = (f, r) => {
                    if (!lastPromise) lastPromise = execute();
                    return lastPromise.then(f, r);
                };

                instance.catch = (r) => {
                    if (!lastPromise) lastPromise = execute();
                    return lastPromise.catch(r);
                };

                if (!reqOptions.lazy) execute();

                return instance;
            };
        }

        // ==========================================
        // 8. PUBLIC API
        // ==========================================
        function buildHttp(axiosInstance) {
            const http = {
                get: (url, config) => request('get', url, null, config),
                post: (url, data, config) => request('post', url, data, config),
                put: (url, data, config) => request('put', url, data, config),
                patch: (url, data, config) => request('patch', url, data, config),
                delete: (url, config) => request('delete', url, null, config),
                head: (url, config) => request('head', url, null, config),
                options: (url, config) => request('options', url, null, config),

                useGet: (url, opt) => createReactiveRequest('get', url, null, opt)(),
                usePost: (url, body, opt) => createReactiveRequest('post', url, body, opt)(),
                usePut: (url, body, opt) => createReactiveRequest('put', url, body, opt)(),
                usePatch: (url, body, opt) => createReactiveRequest('patch', url, body, opt)(),
                useDelete: (url, opt) => createReactiveRequest('delete', url, null, opt)(),

                upload: (url, file, config = {}) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    return createReactiveRequest('post', url, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        ...config
                    })();
                },

                create: (opts) => buildHttp(createAxiosInstance(opts)),

                setToken: (token, type = 'Bearer') => {
                    axiosInstance.defaults.headers['Authorization'] = `${type} ${token}`;
                },

                clearToken: () => {
                    delete axiosInstance.defaults.headers['Authorization'];
                },

                raw: axiosInstance
            };

            return http;
        }

        const $http = buildHttp(baseAxios);

        // ==========================================
        // 9. NAMESPACED API REGISTRATION (Helix v11.1.5)
        // ==========================================
        // Register under namespace for collision-safe access
        app.namespace('axios', {
            $http,
            create: buildHttp,
            setToken: $http.setToken,
            clearToken: $http.clearToken,
            raw: $http.raw
        });

        // Backward compatibility: flat access
        app.$http = $http;

        // Provide for inject()
        if (app.provide) {
            app.provide('$http', $http);
        }

        // ==========================================
        // 10. CLEANUP LIFECYCLE (Helix v11.1.5)
        // ==========================================
        // Return cleanup function — Helix calls it on app.unmount()
        return () => {
            pendingRequests.forEach(p => p.cancel?.());
            pendingRequests.clear();
            activeRequests.forEach(r => r.cancel?.());
            activeRequests.clear();
        };
    }
};