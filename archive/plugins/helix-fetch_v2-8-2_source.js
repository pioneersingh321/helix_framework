/**
 * Helix.js Fetch Plugin v2.8.2 — Critical Fix Release
 * Fixes: regex regression, queue resolver, cache collision,
 *        unstable heap comparator, circular stringify crash
 */

const HelixFetchPlugin = {
    name: 'fetch',
    version: '2.8.2',
    requires: { helix: '>=11.1.5' },

    install(app, options = {}) {
        'use strict';

        // ═══════════════════════════════════════════════════════════════
        // 0. HELPERS
        // ═══════════════════════════════════════════════════════════════
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
                form.append(namespace, obj === null ? '' : obj);
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
                if (type === 'array' || type === 'object') { try { return JSON.parse(val); } catch { return val; } }
                return val;
            };
            const deepAssign = (target, pathArray, value) => {
                let current = target;
                pathArray.forEach((key, index) => {
                    if (index === pathArray.length - 1) {
                        if (key === '') { if (!Array.isArray(current)) return; current.push(value); }
                        else if (current[key] !== undefined) { if (!Array.isArray(current[key])) current[key] = [current[key]]; current[key].push(value); }
                        else current[key] = value;
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
                if (type === 'checkbox') { if (field.checked) value = !field.hasAttribute('value') || field.value; else return; }
                else if (type === 'radio') { if (!field.checked) return; value = field.value; }
                else if (type === 'file') { if (field.files.length === 0) return; value = field.multiple ? Array.from(field.files) : field.files[0]; }
                else { value = field.tagName === 'SELECT' && field.multiple ? Array.from(field.selectedOptions).map(o => o.value) : field.value; }
                if (value === '' && emptyAsNull) value = null;
                let rawName = field.name, castType = null;
                if (rawName.includes(':')) { const p = rawName.split(':'); castType = p.pop(); rawName = p.join(':'); }
                if (type !== 'file' && !(value instanceof File)) value = castValue(value, castType);
                const pathArray = rawName.replace(/\]/g, '').split('[');
                deepAssign(result, pathArray, value);
            });
            return result;
        };

        const prepareSmartPayload = (body, headers) => {
            let activeBody = body, activeHeaders = { ...headers };
            if (activeBody instanceof HTMLFormElement) activeBody = serializeForm(activeBody);
            if (activeBody instanceof FormData) { delete activeHeaders['content-type']; return { payload: activeBody, headers: activeHeaders }; }
            if (activeBody && typeof activeBody === 'object') {
                if (containsFiles(activeBody)) { activeBody = objectToFormData(activeBody); delete activeHeaders['content-type']; }
                else {
                    const type = (activeHeaders['content-type'] || '').toLowerCase();
                    if (type.includes('application/x-www-form-urlencoded')) activeBody = new URLSearchParams(activeBody).toString();
                    else activeBody = JSON.stringify(activeBody);
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
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        const withEventEmitter = (obj) => {
            const successSubscribers = new Set(), errorSubscribers = new Set();
            obj.onSuccess = (fn) => { successSubscribers.add(fn); return obj; };
            obj.onError = (fn) => { errorSubscribers.add(fn); return obj; };
            obj.clearListeners = () => { successSubscribers.clear(); errorSubscribers.clear(); };
            obj.emitSuccess = (data, state) => successSubscribers.forEach(fn => fn(data, state));
            obj.emitError = (err, state) => errorSubscribers.forEach(fn => fn(err, state));
            return obj;
        };

        // FIX 5: Circular-safe stable stringify with WeakSet guard
        const fastStableStringify = (obj, seen = null) => {
            if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
            if (!seen) seen = new WeakSet();
            if (seen.has(obj)) return '"[Circular]"';
            seen.add(obj);
            let result;
            if (Array.isArray(obj)) {
                result = '[' + obj.map(v => fastStableStringify(v, seen)).join(',') + ']';
            } else {
                const keys = Object.keys(obj).sort();
                result = '{' + keys.map(k => JSON.stringify(k) + ':' + fastStableStringify(obj[k], seen)).join(',') + '}';
            }
            seen.delete(obj);
            return result;
        };

        const isCacheableBody = (body) =>
            !(body instanceof FormData || body instanceof Blob || (typeof File !== 'undefined' && body instanceof File) || body instanceof HTMLFormElement);

        const UNCACHEABLE_MARKER = '__UNCACHEABLE__';

        // FIX 3: Hash large bodies by content hash, not just length
        const hashLargeBody = (str) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h |= 0;
            }
            return (h >>> 0).toString(16);
        };

        const getCacheKey = (method, base, url, params, body, headers, cacheHeaders = []) => {
            let bodyStr = UNCACHEABLE_MARKER;
            if (isCacheableBody(body)) {
                const bodyJson = fastStableStringify(body);
                // FIX 3: Use hash for large bodies instead of just length
                bodyStr = bodyJson.length > 102400
                    ? '__LARGE_BODY_' + bodyJson.length + '_' + hashLargeBody(bodyJson) + '__'
                    : bodyJson;
            }
            const sanitizedHeaders = { ...normalizeHeaders(headers) };
            if (config.requestIdHeader) delete sanitizedHeaders[config.requestIdHeader.toLowerCase()];
            if (config.traceIdHeader) delete sanitizedHeaders[config.traceIdHeader.toLowerCase()];
            let headerStr;
            if (cacheHeaders.length > 0) {
                const filtered = {};
                for (const h of cacheHeaders) { const key = h.toLowerCase(); if (sanitizedHeaders[key] !== undefined) filtered[key] = sanitizedHeaders[key]; }
                headerStr = fastStableStringify(filtered);
            } else headerStr = fastStableStringify(sanitizedHeaders);
            return `${method}|${base}|${url}|${fastStableStringify(params)}|${bodyStr}|${headerStr}`;
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
            let size = 0;
            const seen = new WeakSet();
            const calc = (o) => {
                if (o === null || o === undefined) return;
                if (typeof o === 'object') { if (seen.has(o)) return; seen.add(o); }
                if (Array.isArray(o)) { size += o.length * 8; o.forEach(calc); }
                else if (o instanceof Map) { size += o.size * 16; o.forEach((v, k) => { calc(k); calc(v); }); }
                else if (o instanceof Set) { size += o.size * 8; o.forEach(calc); }
                else if (typeof o === 'object') { size += Object.keys(o).length * 16; Object.values(o).forEach(calc); }
                else size += estimateObjectSize(o);
            };
            calc(obj);
            return size;
        };

        // ═══════════════════════════════════════════════════════════════
        // 1. CONFIGURATION — ALL GATES DEFAULT FALSE (opt-in)
        // ═══════════════════════════════════════════════════════════════
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
            validateStatus: (s) => s >= 200 && s < 300,
            debounce: 0,
            ...options
        };

        // ═══════════════════════════════════════════════════════════════
        // 2. NATIVE BUS
        // ═══════════════════════════════════════════════════════════════
        const bus = app.$bus || (window.Helix && window.Helix.$bus);
        const emit = (event, payload) => { if (bus) bus.emit(`fetch:${event}`, payload); };

        // ═══════════════════════════════════════════════════════════════
        // 3. ENGINES
        // ═══════════════════════════════════════════════════════════════

        const classifyError = (err) => {
            if (!err) return 'unknown';
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
            const msg = (err.message || '').toLowerCase();
            const name = err.name || '';
            if (msg.includes('offline') || msg.includes('network')) return 'offline';
            if (name === 'AbortError') return msg.includes('timeout') ? 'timeout' : 'transport';
            if (msg.includes('dns') || msg.includes('enotfound') || msg.includes('getaddrinfo')) return 'dns';
            if (msg.includes('fetch') || msg.includes('failed to fetch')) return 'transport';
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

        const debugLogResponse = (cfg, info) => {
            if (!cfg.debugResponse) return;
            console.groupCollapsed(`%c[Helix Fetch Debug]`, 'color:#ff4d4f;font-weight:bold');
            console.log('URL:', info.url);
            console.log('Method:', info.method);
            console.log('Status:', info.status);
            if (info.trace) console.log('Trace:', info.trace);
            if (info.reason) console.warn('Reason:', info.reason);
            if (info.classification) console.warn('Classification:', info.classification);
            console.log('Raw Response:', info.raw);
            console.groupEnd();
        };

        // ─── Cache Engine (opt-in) ───
        const cacheStore = new Map();
        const cacheEngine = config.cache === true ? {
            get(key, staleTime) {
                const entry = cacheStore.get(key);
                if (!entry || Date.now() > entry.expiry) { if (entry) cacheStore.delete(key); return null; }
                const stale = staleTime > 0 && Date.now() - entry.timestamp > staleTime;
                if (!stale) emit('cache:hit', { key, entry });
                else emit('cache:stale', { key, entry });
                return { data: entry.data, stale };
            },
            set(key, data, ttl, tags = []) {
                this._trim();
                cacheStore.set(key, {
                    data, expiry: Date.now() + ttl, timestamp: Date.now(), tags,
                    size: config.memoryCache ? estimateObjectSize(data) : 0
                });
                emit('cache:set', { key, ttl, tags });
            },
            invalidate(tagOrPart) {
                for (const [k, v] of cacheStore.entries()) {
                    if (v.tags?.includes(tagOrPart) || k.includes(tagOrPart)) {
                        cacheStore.delete(k);
                        emit('cache:invalidate', { key: k, tag: tagOrPart });
                    }
                }
            },
            invalidateExact(key) {
                cacheStore.delete(key);
                emit('cache:invalidate', { key });
            },
            clear() {
                cacheStore.clear();
                emit('cache:clear');
            },
            _trim(maxEntries = config.maxCacheEntries, maxMemory = config.maxCacheMemory) {
                if (cacheStore.size >= maxEntries) {
                    const toRemove = cacheStore.size - maxEntries + Math.floor(maxEntries * 0.2);
                    [...cacheStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, toRemove).forEach(([k]) => cacheStore.delete(k));
                }
                if (config.memoryCache) {
                    let totalMemory = 0;
                    for (const [, v] of cacheStore.entries()) totalMemory += v.size || 0;
                    if (totalMemory > maxMemory) {
                        const sorted = [...cacheStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
                        while (totalMemory > maxMemory * 0.8 && sorted.length > 0) {
                            const [k, v] = sorted.shift();
                            totalMemory -= v.size || 0;
                            cacheStore.delete(k);
                        }
                    }
                }
            }
        } : null;

        // ─── Dedupe Engine (lightweight, always on for GET) ───
        const pendingRequests = new Map();
        const dedupeEngine = {
            get(key) { return pendingRequests.get(key); },
            acquire(key, promise, controller) {
                const existing = pendingRequests.get(key);
                if (existing) { existing.consumers++; return existing.promise; }
                pendingRequests.set(key, { promise, controller, consumers: 1 });
                emit('dedupe:set', { key });
                return promise;
            },
            release(key) {
                const entry = pendingRequests.get(key);
                if (!entry) return;
                entry.consumers--;
                if (entry.consumers <= 0) {
                    pendingRequests.delete(key);
                    emit('dedupe:delete', { key });
                }
            },
            abort(key) {
                const entry = pendingRequests.get(key);
                if (entry) { entry.controller?.abort(); pendingRequests.delete(key); emit('dedupe:delete', { key }); }
            },
            clear() { pendingRequests.clear(); }
        };

        // ─── Queue Engine (opt-in) ───
        let activeRequests = 0;
        let queueEngine = null;
        if (config.queue === true) {
            // FIX 4: Stable heap comparator — priority computed once at insertion, cached on item
            class PriorityHeap {
                constructor(comparator) { this.heap = []; this.comparator = comparator; }
                push(item) {
                    // Compute effective priority once and freeze it
                    item._effectivePriority = (item.priority || 0) + Math.floor((Date.now() - item.enqueuedAt) / config.priorityAgingMs);
                    this.heap.push(item);
                    this._siftUp(this.heap.length - 1);
                }
                pop() {
                    if (this.heap.length === 0) return undefined;
                    const top = this.heap[0];
                    const end = this.heap.pop();
                    if (this.heap.length > 0) { this.heap[0] = end; this._siftDown(0); }
                    return top;
                }
                remove(item) {
                    const idx = this.heap.indexOf(item);
                    if (idx === -1) return false;
                    const end = this.heap.pop();
                    if (idx < this.heap.length) {
                        this.heap[idx] = end;
                        if (this.comparator(end, item) < 0) this._siftUp(idx);
                        else this._siftDown(idx);
                    }
                    return true;
                }
                get length() { return this.heap.length; }
                _siftUp(i) {
                    const item = this.heap[i];
                    while (i > 0) {
                        const parent = (i - 1) >> 1;
                        if (this.comparator(item, this.heap[parent]) >= 0) break;
                        this.heap[i] = this.heap[parent]; i = parent;
                    }
                    this.heap[i] = item;
                }
                _siftDown(i) {
                    const len = this.heap.length, item = this.heap[i];
                    while (true) {
                        let child = (i << 1) + 1;
                        if (child >= len) break;
                        const right = child + 1;
                        if (right < len && this.comparator(this.heap[right], this.heap[child]) < 0) child = right;
                        if (this.comparator(item, this.heap[child]) <= 0) break;
                        this.heap[i] = this.heap[child]; i = child;
                    }
                    this.heap[i] = item;
                }
            }

            const requestQueue = new PriorityHeap((a, b) => b._effectivePriority - a._effectivePriority);

            queueEngine = {
                enqueue(fn, priority = 0) {
                    if (activeRequests < config.maxConcurrent) {
                        activeRequests++;
                        const promise = fn().finally(() => { activeRequests--; this.process(); });
                        return { promise, item: null };
                    }
                    let item = null;
                    // FIX 2: Capture BOTH resolve and reject on the queue item
                    const promise = new Promise((resolve, reject) => {
                        item = { run: fn, priority, resolve, reject, enqueuedAt: Date.now(), aborted: false };
                        if (config.queueStrategy === 'fifo') item.priority = 0;
                        requestQueue.push(item);
                        emit('queue:enqueue', { priority, queueLength: requestQueue.length });
                    });
                    return { promise, item };
                },
                process() {
                    while (activeRequests < config.maxConcurrent && requestQueue.length > 0) {
                        const next = requestQueue.pop();
                        if (!next || next.aborted) {
                            if (next) try { next.reject(new FetchError('Request cancelled', null, 0, null, null)); } catch {}
                            continue;
                        }
                        activeRequests++;
                        emit('queue:dequeue', { activeRequests, queueLength: requestQueue.length });
                        next.run().then(next.resolve, next.reject).finally(() => { activeRequests--; this.process(); });
                    }
                },
                remove(item) {
                    if (!item) return;
                    const inHeap = requestQueue.remove(item);
                    if (inHeap) {
                        item.aborted = true;
                        try { item.reject(new FetchError('Request cancelled', null, 0, null, null)); } catch {}
                        emit('queue:remove', { queueLength: requestQueue.length });
                    }
                },
                clear() {
                    while (requestQueue.length > 0) {
                        const item = requestQueue.pop();
                        if (item) try { item.reject(new FetchError('Plugin destroyed', null, 0, null, null)); } catch {}
                    }
                    activeRequests = 0;
                }
            };
        }

        // ─── Visibility Engine (opt-in) ───
        let visibilityEngine = null;
        if (config.polling === true) {
            const visibilitySubscribers = new Set();
            let isGloballyVisible = !document.hidden;
            let globalVisibilityAttached = false;
            visibilityEngine = {
                handler() {
                    const wasHidden = !isGloballyVisible;
                    isGloballyVisible = !document.hidden;
                    visibilitySubscribers.forEach(sub => { try { sub(isGloballyVisible, wasHidden); } catch (e) {} });
                },
                attach() {
                    if (!globalVisibilityAttached) {
                        document.addEventListener('visibilitychange', this.handler);
                        globalVisibilityAttached = true;
                    }
                },
                detach() {
                    if (globalVisibilityAttached) {
                        document.removeEventListener('visibilitychange', this.handler);
                        globalVisibilityAttached = false;
                        visibilitySubscribers.clear();
                    }
                },
                subscribe(fn) { visibilitySubscribers.add(fn); this.attach(); },
                unsubscribe(fn) { visibilitySubscribers.delete(fn); if (visibilitySubscribers.size === 0) this.detach(); }
            };
        }

        // ─── Loader Engine ───
        const activeLoaderTokens = new Set();
        const loaderEngine = {
            show(token) {
                activeLoaderTokens.add(token);
                if (activeLoaderTokens.size === 1) app.$loader?.show?.();
            },
            hide(token) {
                activeLoaderTokens.delete(token);
                if (activeLoaderTokens.size === 0) app.$loader?.hide?.();
            },
            reset() {
                activeLoaderTokens.clear();
                app.$loader?.hide?.();
            }
        };

        // ─── Retry Engine (opt-in) ───
        const retryEngine = config.retry === true ? {
            async run(fn, retries, delay, condition, traceContext = {}) {
                let attempt = 0;
                while (true) {
                    try { return await fn(); }
                    catch (err) {
                        const normalized = err instanceof FetchError ? err : new FetchError(err.message || 'Network error', null, err.status || 0, null, null, null, traceContext);
                        if (!condition(normalized) || attempt >= retries) throw err;
                        emit('retry:attempt', { attempt: attempt + 1, delay: delay * Math.pow(2, attempt), err: normalized });
                        await sleep(delay * Math.pow(2, attempt) + Math.random() * 100);
                        attempt++;
                    }
                }
            }
        } : null;

        // ─── Parse Engine ───
        const parseEngine = {
            async run(res, type, reqConfig = {}, requestInfo = {}) {
                if (res.status === 204) return null;
                if (type === 'blob') return res.blob();
                if (type === 'arraybuffer') return res.arrayBuffer();
                if (type === 'text') return res.text();
                if (type === 'stream') return res.body;
                let text = await res.text();
                const raw = text.trim();
                const ct = (res.headers.get('content-type') || '').toLowerCase();
                if (ct.includes('text/html') || raw.startsWith('<!DOCTYPE html>') || raw.startsWith('<html')) {
                    debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw, reason: 'HTML returned instead of JSON' });
                    throw new FetchError('Server returned HTML instead of JSON', null, res.status, raw, requestInfo, 'parse');
                }
                // FIX 1: Corrected regex — single <, word boundary
                const cleaned = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
                try { return cleaned ? JSON.parse(cleaned) : null; }
                catch {
                    debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw, reason: 'JSON parse failed' });
                    throw new FetchError('Invalid JSON response', null, res.status, raw, requestInfo, 'parse');
                }
            }
        };

        // ─── Interceptor Engine ───
        const requestInterceptors = [];
        const responseInterceptors = [];
        const interceptorEngine = {
            request(req) { let out = req; for (const fn of requestInterceptors) out = fn(out) || out; return out; },
            response(data, res) { let out = data; for (const fn of responseInterceptors) out = fn(out, res) || out; return out; }
        };

        // ═══════════════════════════════════════════════════════════════
        // 4. TRANSPORTS
        // ═══════════════════════════════════════════════════════════════

        async function fetchTransport(req, options, controller, state) {
            let fetchPromise;
            if (options.onDownloadProgress) {
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
                        if ('progress' in state) state.progress = Math.round((received / contentLength) * 100);
                        options.onDownloadProgress(state.progress, received, contentLength);
                    }
                    const blob = new Blob(chunks);
                    return new Response(blob, { status: res.status, statusText: res.statusText, headers: res.headers });
                });
            } else {
                fetchPromise = fetch(req.url, req);
            }
            return fetchPromise;
        }

        let xhrTransport = null;
        if (config.upload === true) {
            xhrTransport = function(req, options, controller, state) {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(req.method, req.url, true);
                    Object.entries(req.headers).forEach(([k, v]) => {
                        if (k.toLowerCase() !== 'content-type' || v) xhr.setRequestHeader(k, v);
                    });

                    if (options.onUploadProgress) {
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                if ('progress' in state) state.progress = Math.round((e.loaded / e.total) * 100);
                                options.onUploadProgress(state.progress, e.loaded, e.total);
                            }
                        };
                    }
                    if (options.onDownloadProgress) {
                        xhr.onprogress = (e) => {
                            if (e.lengthComputable) {
                                if ('progress' in state) state.progress = Math.round((e.loaded / e.total) * 100);
                                options.onDownloadProgress(state.progress, e.loaded, e.total);
                            }
                        };
                    }

                    xhr.onload = () => {
                        const headers = new Map();
                        const rawHeaders = xhr.getAllResponseHeaders().trim();
                        if (rawHeaders) {
                            rawHeaders.split(/\r?\n/).forEach(line => {
                                const idx = line.indexOf(':');
                                if (idx > 0) headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
                            });
                        }
                        resolve({
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            url: req.url,
                            headers: {
                                get: (name) => headers.get(name.toLowerCase()) || null,
                                has: (name) => headers.has(name.toLowerCase()),
                                forEach: (fn) => headers.forEach((v, k) => fn(v, k)),
                                entries: () => headers.entries(),
                                keys: () => headers.keys(),
                                values: () => headers.values()
                            },
                            text: () => Promise.resolve(xhr.responseText),
                            json: () => { try { return Promise.resolve(JSON.parse(xhr.responseText)); } catch (e) { return Promise.reject(e); } },
                            blob: () => Promise.resolve(new Blob([xhr.response])),
                            arrayBuffer: () => Promise.resolve(xhr.response),
                            clone: () => resolve({ text: () => Promise.resolve(xhr.responseText) })
                        });
                    };

                    xhr.onerror = () => reject(new FetchError('Network error', req, 0, null, req, 'transport'));
                    xhr.onabort = () => reject(new FetchError('Request aborted', req, 0, null, req, 'transport'));
                    xhr.ontimeout = () => reject(new FetchError('Timeout exceeded', req, 0, null, req, 'timeout'));

                    const onAbort = () => { if (xhr.readyState !== 4) xhr.abort(); };
                    controller.signal.addEventListener('abort', onAbort);

                    xhr.send(req.body);
                });
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // 5. CORE REQUEST FACTORY
        // ═══════════════════════════════════════════════════════════════
        function createRequest(method, url, initialBody = null, reqOptions = {}) {
            return function useRequest() {
                const state = app.reactive({
                    data: null,
                    error: null,
                    loading: false,
                    isFetching: false,
                    status: null,
                    isIdle: true,
                    isSuccess: false,
                    isError: false
                });

                const mayCache = config.cache === true && reqOptions.cache !== false && (method === 'GET' || method === 'HEAD');
                if (mayCache) state.isStale = false;

                const mayPoll = config.polling === true && (reqOptions.pollInterval ?? config.pollInterval) > 0;
                if (mayPoll) {
                    state.isPolling = false;
                    state.isPaused = false;
                }

                const mayProgress = reqOptions.onDownloadProgress || reqOptions.onUploadProgress;
                if (mayProgress) state.progress = 0;

                const stateInstance = withEventEmitter(state);
                let activeController, timeoutId, lastPromise, pollTimer, debounceTimer, pendingDebounce;
                let visibilityHandler = null;
                let queueItem = null;
                const loaderToken = generateId();

                const shouldDedupe = reqOptions._isPollTick ? false : (reqOptions.dedupe !== undefined
                    ? reqOptions.dedupe
                    : (method === 'GET' || method === 'HEAD'));

                const performFetch = async (background = false, variables = null, pollTick = false) => {
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
                        cacheKey = getCacheKey(method, activeBase, finalUrl, reqOptions.params, combinedBody, rawHeaders, reqOptions.cacheHeaders ?? config.cacheHeaders);
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
                    if (useLoader) loaderEngine.show(loaderToken);
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
                                    try { errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req); } catch {}
                                    throw new FetchError(`Request failed with status ${r.status}`, req, r.status, errData, req, null, traceContext);
                                }
                                return r;
                            }, reqOptions.retry ?? config.retryCount, reqOptions.retryDelay ?? config.retryDelay, reqOptions.retryCondition ?? config.retryCondition, traceContext) : (async () => {
                                const r = await transportFn(req, reqOptions, activeController, state);
                                clearTimeout(timeoutId);
                                const validate = reqOptions.validateStatus || config.validateStatus;
                                if (!validate(r.status)) {
                                    let errData = null;
                                    try { errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req); } catch {}
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

                            debugLogResponse(reqOptions, { url: finalUrl, method, status: finalErr.status, reason: finalErr.message, classification: finalErr.classification, trace: finalErr.trace });

                            throw finalErr;
                        } finally {
                            if (shouldDedupe && cacheKey) dedupeEngine.release(cacheKey);
                            lastPromise = null; state.isFetching = false;
                            if (!background) state.loading = false;
                            if (useLoader) loaderEngine.hide(loaderToken);
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
                                performFetch(true, null, true).then(resolve).catch(reject).finally(() => pendingDebounce = null);
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
                            if (!isGloballyVisible && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) { schedulePoll(); return; }
                            if (state.isFetching || state.isPaused) { schedulePoll(); return; }
                            refetch(true).catch(() => {}).finally(() => { if (state.isPolling) schedulePoll(); });
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
                                if (reqOptions.refetchOnWindowFocus ?? config.refetchOnWindowFocus) refetch().catch(() => {});
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

                stateInstance._cleanup = () => {
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

                if (app.onUnmounted && typeof app.onUnmounted === 'function') {
                    app.onUnmounted(() => { if (typeof stateInstance._cleanup === 'function') stateInstance._cleanup(); });
                }

                if (!reqOptions.lazy) {
                    if (config.polling === true && (reqOptions.pollInterval ?? config.pollInterval)) {
                        execute().then(startPolling);
                    } else {
                        execute();
                    }
                }

                return stateInstance;
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // 6. UPLOAD
        // ═══════════════════════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════════════════════
        // 7. PUBLIC API
        // ═══════════════════════════════════════════════════════════════
        const createInstance = (instanceDefaults = {}) => {
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
        };

        const $fetch = {
            request: (cfg = {}) => {
                const { method = 'GET', url = '', data = null, params, headers, ...rest } = cfg;
                if (!url) throw new FetchError('request() requires a URL', cfg, 0, null, null);
                return createRequest(method.toUpperCase(), url, data, { ...config, ...rest, headers, params })();
            },
            create: createInstance,
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
            invalidate: (tagOrPart = '') => cacheEngine ? cacheEngine.invalidate(tagOrPart) : undefined,
            invalidateExact: (key) => cacheEngine ? cacheEngine.invalidateExact(key) : undefined,
            clearCache: () => cacheEngine ? cacheEngine.clear() : undefined
        };

        // ═══════════════════════════════════════════════════════════════
        // 8. REGISTRATION
        // ═══════════════════════════════════════════════════════════════
        app.namespace('fetch', {
            $fetch,
            addRequestInterceptor: $fetch.addRequestInterceptor,
            addResponseInterceptor: $fetch.addResponseInterceptor,
            invalidate: $fetch.invalidate,
            invalidateExact: $fetch.invalidateExact,
            clearCache: $fetch.clearCache
        });

        app.$fetch = $fetch;
        if (app.provide) app.provide('$fetch', $fetch);

        emit('plugin:ready', { version: '2.8.2', bus: !!bus, engines: {
            cache: !!cacheEngine,
            queue: !!queueEngine,
            retry: !!retryEngine,
            polling: !!visibilityEngine,
            upload: !!xhrTransport,
            debug: config.debug === true
        }});

        // ═══════════════════════════════════════════════════════════════
        // 9. CLEANUP
        // ═══════════════════════════════════════════════════════════════
        return () => {
            dedupeEngine.clear();
            if (queueEngine) queueEngine.clear();
            if (cacheEngine) cacheEngine.clear();
            if (visibilityEngine) visibilityEngine.detach();
            loaderEngine.reset();
            emit('plugin:destroy');
        };
    }
};