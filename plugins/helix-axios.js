/**
 * Helix.js Axios Plugin v2.2
 * Aligned with Helix.js v11.1.x Plugin Architecture (requires >= 11.1.5)
 *
 * v2.2 fixes (over v2.1):
 *  #1  GET/HEAD no longer attach a request body (adapter-safe).
 *  #2  Default retry is now restricted to idempotent methods; `method` is
 *      threaded into retryCondition so POST/PATCH aren't silently re-fired.
 *  #3  Dedupe fingerprint now includes headers + responseType (no cross-token merge).
 *  #4  Followers ref-count the shared request; the controller aborts only when the
 *      owner AND every follower have released -> follower cancel now works.
 *  #6  Reactive state is run-ID guarded: a stale/out-of-order response can no longer
 *      clobber a newer one.
 *  #7  uploadProgress / downloadProgress are now separate fields (no backwards jump).
 *  #8  Dedupe keys are stable (object keys sorted) so {a,b} === {b,a}.
 *  #9  CSRF cookie read is anchored (split on "; ") instead of a loose substring match.
 *  #10 Full-jitter backoff (Math.random() * min(max, base*2^n)) with a delay ceiling.
 *  #11 normalizeError keeps the original error under `originalError`.
 *  #12 Reactive state exposes `completedAt` (with `timestamp` kept as a deprecated alias).
 *  #13 Reactive state now also exposes `headers` (response metadata).
 *  #14 Added `useUpload()` as the explicit reactive name; `upload()` kept as an alias.
 *
 *  #5  (never-settling request leak) is bounded by `timeout` (default 10s) and by the
 *      app.unmount() cleanup which aborts every live controller. Only reachable with an
 *      explicit `timeout: 0` against a server that never responds — documented, not patched.
 */

const HelixAxiosPlugin = {
    name: 'axios',
    version: '2.2.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        // ==========================================
        // 0. AXIOS LIBRARY (single source)
        // ==========================================
        const axiosLib = typeof axios !== 'undefined' ? axios : null;
        if (!axiosLib) {
            console.error('[Helix Axios] axios library not found. Load axios before this plugin.');
            return; // nothing to install
        }

        const BODYLESS_METHODS = ['get', 'head'];
        const IDEMPOTENT_METHODS = ['get', 'head', 'options'];

        // ==========================================
        // 1. DEFAULTS & CONFIG
        // ==========================================
        const defaults = {
            baseURL: '/',
            timeout: 10000,
            retries: 0,
            retryDelay: 300,
            maxRetryDelay: 30000,
            // Only retry idempotent methods by default. Pass a custom retryCondition
            // to opt POST/PATCH in explicitly.
            retryCondition: (err, method) =>
                IDEMPOTENT_METHODS.includes(String(method || '').toLowerCase()) &&
                (!err.status || err.status >= 500),
            dedupe: false,
            csrf: false,
            headers: {},
            ...options
        };

        // ==========================================
        // 2. CANCELLATION DETECTION
        // ==========================================
        const isCancel = (err) =>
            (typeof axiosLib.isCancel === 'function' && axiosLib.isCancel(err)) ||
            err?.code === 'ERR_CANCELED' ||
            err?.name === 'CanceledError' ||
            err?.name === 'AbortError';

        // ==========================================
        // 3. ERROR NORMALIZER
        // ==========================================
        const normalizeError = (err) => {
            if (isCancel(err)) {
                return {
                    name: 'CanceledError',
                    status: null,
                    data: null,
                    message: 'Request canceled',
                    headers: {},
                    config: err?.config || null,
                    canceled: true,
                    originalError: err
                };
            }
            if (err?.response) {
                return {
                    name: 'AxiosError',
                    status: err.response.status,
                    data: err.response.data,
                    message: err.response.data?.message || `Request failed with status ${err.response.status}`,
                    headers: err.response.headers,
                    config: err.config,
                    canceled: false,
                    originalError: err
                };
            }
            if (err?.request) {
                return {
                    name: 'NetworkError',
                    status: 0,
                    data: null,
                    message: err.message || 'Network error — no response received',
                    headers: {},
                    config: err.config,
                    canceled: false,
                    originalError: err
                };
            }
            return {
                name: 'RequestError',
                status: null,
                data: null,
                message: err?.message || 'Request setup error',
                headers: {},
                config: null,
                canceled: false,
                originalError: err
            };
        };

        // ==========================================
        // 4. RETRY WITH BACKOFF (full jitter)
        // ==========================================
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        async function retryWithBackoff(fn, { retries, delay, maxDelay, condition, method }) {
            let attempt = 0;
            while (true) {
                try {
                    return await fn();
                } catch (err) {
                    // A cancelled request is final — never retry it.
                    if (isCancel(err)) throw normalizeError(err);

                    const normalized = normalizeError(err);
                    const shouldRetry = condition(normalized, method) && attempt < retries;
                    if (!shouldRetry) throw normalized;

                    const ceiling = Math.min(maxDelay ?? Infinity, delay * Math.pow(2, attempt));
                    await sleep(Math.random() * ceiling); // full jitter
                    attempt++;
                }
            }
        }

        // ==========================================
        // 5. STABLE SERIALIZER + DEDUPE KEY
        // ==========================================
        // Sorts object keys (stable across literal order) and is FormData/circular-safe.
        function stableStringify(value) {
            const seen = new WeakSet();
            const walk = (val) => {
                if (val === null || typeof val !== 'object') return val;
                if (typeof FormData !== 'undefined' && val instanceof FormData) {
                    try {
                        const parts = [];
                        for (const [k, v] of val.entries()) {
                            parts.push([k, typeof v === 'string' ? v : '[blob]']);
                        }
                        parts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
                        return { __formdata: parts };
                    } catch {
                        return '[formdata]';
                    }
                }
                if (seen.has(val)) return '[circular]';
                seen.add(val);
                if (Array.isArray(val)) return val.map(walk);
                const out = {};
                for (const k of Object.keys(val).sort()) out[k] = walk(val[k]);
                return out;
            };
            try {
                return JSON.stringify(walk(value));
            } catch {
                return '[unserializable]';
            }
        }

        // Fingerprint includes the fields that actually change the response. baseURL/timeout
        // are omitted on purpose: the dedupe map is per-instance, and timeout doesn't change
        // response content.
        function getDedupeKey(method, url, axiosConfig, data) {
            const fingerprint = {
                headers: axiosConfig.headers || null,
                responseType: axiosConfig.responseType || null,
                params: axiosConfig.params || null,
                data: data ?? null
            };
            return `${method}|${url}|${stableStringify(fingerprint)}`;
        }

        // ==========================================
        // 6. COOKIE READER (anchored)
        // ==========================================
        function readCookie(name) {
            const jar = typeof document !== 'undefined' && document.cookie ? document.cookie.split('; ') : [];
            for (const pair of jar) {
                const eq = pair.indexOf('=');
                const key = eq > -1 ? pair.slice(0, eq) : pair;
                if (key === name) {
                    try { return decodeURIComponent(pair.slice(eq + 1)); }
                    catch { return pair.slice(eq + 1); }
                }
            }
            return null;
        }

        // ==========================================
        // 7. AXIOS INSTANCE FACTORY
        // ==========================================
        function createAxiosInstance(config = {}) {
            const merged = { ...defaults, ...config };

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
                // Read the token on every request so a rotated token (e.g. post-login) is used.
                instance.interceptors.request.use((cfg) => {
                    const token = readCookie('XSRF-TOKEN');
                    if (token) {
                        cfg.headers = cfg.headers || {};
                        cfg.headers['X-XSRF-TOKEN'] = token;
                    }
                    return cfg;
                });
            }

            return instance;
        }

        const baseAxios = createAxiosInstance(options);

        // ==========================================
        // 8. SHARED STATE
        // ==========================================
        // Every live request's controller — used by app.unmount() cleanup to abort everything.
        const activeControllers = new Set();

        // ==========================================
        // 9. SIGNAL LINKING
        // ==========================================
        // Bridge a caller-provided AbortSignal to a callback (typically a release()).
        // Returns detach() to remove the listener (call on settle to avoid leaks).
        function linkSignal(userSignal, onAbort) {
            if (!userSignal) return () => {};
            if (userSignal.aborted) {
                onAbort();
                return () => {};
            }
            userSignal.addEventListener('abort', onAbort);
            return () => userSignal.removeEventListener('abort', onAbort);
        }

        // ==========================================
        // 10. HOOK DRIVER
        // ==========================================
        // Drives lifecycle hooks from a response promise and resolves to res.data.
        // Used by both owner and follower (deduped) paths so their state stays in sync.
        function driveHooks(responsePromise, hooks, onCleanup) {
            const out = responsePromise.then(
                (res) => {
                    hooks.onSuccess?.(res);
                    return res.data;
                },
                (err) => {
                    // err is already normalized by retryWithBackoff.
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

        // ==========================================
        // 11. CORE REQUEST (shared by imperative + reactive)
        // ==========================================
        // `pending` is the per-instance dedupe map. Returns a promise resolving to res.data;
        // every returned promise carries .cancel() (= release for deduped requests).
        function executeRequest(instance, pending, method, url, data, config = {}, hooks = {}) {
            const {
                signal: userSignal,
                dedupe,
                retries,
                retryDelay,
                retryCondition,
                ...axiosConfig
            } = config;

            const useDedupe = dedupe ?? defaults.dedupe;
            const dedupeKey = useDedupe ? getDedupeKey(method, url, axiosConfig, data) : null;

            hooks.onStart?.();

            // ---------- Follower: share an in-flight identical request ----------
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
                    // Abort the shared request only when the last subscriber leaves.
                    if (entry.refs <= 0) {
                        try { entry.controller.abort(); } catch { /* ignore */ }
                    }
                };
                detach = linkSignal(userSignal, release);

                const out = driveHooks(entry.promise, hooks, () => { detach(); });
                out.cancel = release;
                return out;
            }

            // ---------- Owner: new request with its own controller ----------
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
                // Never attach a body to GET/HEAD — adapter behavior is inconsistent otherwise.
                if (!BODYLESS_METHODS.includes(String(method).toLowerCase())) {
                    requestConfig.data = data;
                }
                return instance(requestConfig);
            };

            const responsePromise = retryWithBackoff(exec, {
                retries: retries ?? defaults.retries,
                delay: retryDelay ?? defaults.retryDelay,
                maxDelay: defaults.maxRetryDelay,
                condition: retryCondition ?? defaults.retryCondition,
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
                        try { controller.abort(); } catch { /* ignore */ }
                    }
                } else {
                    try { controller.abort(); } catch { /* ignore */ }
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

        // ==========================================
        // 12. REACTIVE REQUEST FACTORY
        // ==========================================
        function createReactiveRequest(instance, pending, method, url, data = null, reqOptions = {}) {
            return function useRequest() {
                const state = app.reactive({
                    data: null,
                    error: null,
                    loading: false,
                    status: null,
                    headers: null,
                    progress: 0,          // legacy combined; prefer the two below
                    uploadProgress: 0,
                    downloadProgress: 0,
                    completedAt: null,
                    timestamp: null       // deprecated alias of completedAt
                });

                // Captured once for the lifetime of this hook (no mutation of reqOptions).
                const { signal: hookSignal, lazy, ...baseOpts } = reqOptions;

                let lastPromise = null;
                let runId = 0; // guards against out-of-order responses (#6)

                const execute = (override = {}) => {
                    const current = ++runId;
                    const isCurrent = () => current === runId;

                    const config = { ...baseOpts, ...override };
                    if (hookSignal) config.signal = hookSignal;

                    // NOTE: if Helix exposes a batch/nextTick scheduler, wrap the multi-write
                    // hooks so synchronous triggers (v11.1.7+) flush effects only once.
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
                            state.progress = pct; // legacy
                        },
                        onDownloadProgress: (pct) => {
                            if (!isCurrent()) return;
                            state.downloadProgress = pct;
                            state.progress = pct; // legacy (may reset at the upload->download boundary)
                        },
                        onSuccess: (res) => {
                            if (!isCurrent()) return; // ignore stale/out-of-order response
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

                // Preferred accessor for the underlying promise.
                inst.promise = () => lastPromise || (lastPromise = execute());

                // Thenable for convenience: `await http.useGet(...)` resolves to data (not the
                // state object). Kept for compatibility — prefer .promise() in new code.
                inst.then = (f, r) => {
                    if (!lastPromise) lastPromise = execute();
                    return lastPromise.then(f, r);
                };
                inst.catch = (r) => {
                    if (!lastPromise) lastPromise = execute();
                    return lastPromise.catch(r);
                };

                if (!lazy) execute();

                return inst;
            };
        }

        // ==========================================
        // 13. PUBLIC API
        // ==========================================
        function buildHttp(axiosInstance) {
            const pending = new Map(); // per-instance dedupe registry

            const req = (method, url, data, config) =>
                executeRequest(axiosInstance, pending, method, url, data, config || {}, {});

            const reactive = (method, url, data, opt) =>
                createReactiveRequest(axiosInstance, pending, method, url, data, opt)();

            const makeUpload = (url, file, config = {}) => {
                const { fieldName = 'file', ...rest } = config;
                const formData = new FormData();
                formData.append(fieldName, file);
                // No manual Content-Type — the browser/axios sets the multipart boundary.
                return reactive('post', url, formData, rest);
            };

            const http = {
                get: (url, config) => req('get', url, null, config),
                post: (url, data, config) => req('post', url, data, config),
                put: (url, data, config) => req('put', url, data, config),
                patch: (url, data, config) => req('patch', url, data, config),
                delete: (url, config) => req('delete', url, null, config),
                head: (url, config) => req('head', url, null, config),
                options: (url, config) => req('options', url, null, config),

                useGet: (url, opt) => reactive('get', url, null, opt),
                usePost: (url, body, opt) => reactive('post', url, body, opt),
                usePut: (url, body, opt) => reactive('put', url, body, opt),
                usePatch: (url, body, opt) => reactive('patch', url, body, opt),
                useDelete: (url, opt) => reactive('delete', url, null, opt),

                // Both return a reactive request. `useUpload` is the explicit name;
                // `upload` is kept as an alias for back-compat.
                useUpload: makeUpload,
                upload: makeUpload,

                create: (opts) => buildHttp(createAxiosInstance(opts)),

                setToken: (token, type = 'Bearer') => {
                    axiosInstance.defaults.headers.common['Authorization'] = `${type} ${token}`;
                },

                clearToken: () => {
                    delete axiosInstance.defaults.headers.common['Authorization'];
                },

                raw: axiosInstance
            };

            return http;
        }

        const $http = buildHttp(baseAxios);

        // ==========================================
        // 14. NAMESPACED API REGISTRATION
        // ==========================================
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
        // 15. CLEANUP LIFECYCLE
        // ==========================================
        // Aborting each controller rejects its request, whose driveHooks cleanup removes it
        // from its per-instance dedupe map — covers imperative AND reactive requests.
        return () => {
            activeControllers.forEach(c => {
                try { c.abort(); } catch { /* ignore */ }
            });
            activeControllers.clear();
        };
    }
};