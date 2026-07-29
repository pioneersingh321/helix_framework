import { FetchError } from './error.js';
import { estimateObjectSize, generateId, isCacheableBody } from './utils.js';

export function createEngines(app, config, emit, requestInterceptors, responseInterceptors) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const debugLogResponse = (cfg, info) => {
        if (!cfg.debugResponse) return;
        if (typeof console.groupCollapsed === 'function') console.groupCollapsed(`%c[Helix Fetch Debug]`, 'color:#ff4d4f;font-weight:bold');
        console.log('URL:', info.url);
        console.log('Method:', info.method);
        console.log('Status:', info.status);
        if (info.trace) console.log('Trace:', info.trace);
        if (info.reason) console.warn('Reason:', info.reason);
        if (info.classification) console.warn('Classification:', info.classification);
        console.log('Raw Response:', info.raw);
        if (typeof console.groupEnd === 'function') console.groupEnd();
    };

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

    let activeRequests = 0;
    let queueEngine = null;
    if (config.queue === true) {
        class PriorityHeap {
            constructor(comparator) { this.heap = []; this.comparator = comparator; }
            push(item) {
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
                        if (next) try { next.reject(new FetchError('Request cancelled', null, 0, null, null)); } catch { }
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
                    try { item.reject(new FetchError('Request cancelled', null, 0, null, null)); } catch { }
                    emit('queue:remove', { queueLength: requestQueue.length });
                }
            },
            clear() {
                while (requestQueue.length > 0) {
                    const item = requestQueue.pop();
                    if (item) try { item.reject(new FetchError('Plugin destroyed', null, 0, null, null)); } catch { }
                }
                activeRequests = 0;
            }
        };
    }

    let visibilityEngine = null;
    if (config.polling === true && typeof document !== 'undefined') {
        const visibilitySubscribers = new Set();
        let isGloballyVisible = !document.hidden;
        let globalVisibilityAttached = false;
        visibilityEngine = {
            handler() {
                const wasHidden = !isGloballyVisible;
                isGloballyVisible = !document.hidden;
                visibilitySubscribers.forEach(sub => { try { sub(isGloballyVisible, wasHidden); } catch (e) { } });
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

            let parsed = null, parseError = false;
            try { parsed = raw === '' ? null : JSON.parse(raw); }
            catch { parseError = true; }
            if (!parseError) return parsed;

            if (ct.includes('text/html') || raw.startsWith('<!DOCTYPE html>') || raw.startsWith('<html')) {
                const cleaned = raw.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '').trim();
                debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw: cleaned, reason: 'HTML returned instead of JSON' });
                throw new FetchError('Server returned HTML instead of JSON', null, res.status, cleaned, requestInfo, 'parse');
            }

            const stripped = raw.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '').trim();
            if (stripped !== raw) {
                try { return stripped === '' ? null : JSON.parse(stripped); }
                catch { }
            }

            debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw, reason: 'JSON parse failed' });
            throw new FetchError('Invalid JSON response', null, res.status, raw, requestInfo, 'parse');
        }
    };

    const interceptorEngine = {
        request(req) { let out = req; for (const fn of requestInterceptors) out = fn(out) || out; return out; },
        response(data, res) { let out = data; for (const fn of responseInterceptors) out = fn(out, res) || out; return out; }
    };

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
                return new Response(blob, { status: res.status, statusText: res.statusText, headers: res.headers, ok: res.ok, redirected: res.redirected, type: res.type, url: res.url });
            });
        } else {
            fetchPromise = fetch(req.url, req);
        }
        return fetchPromise;
    }

    let xhrTransport = null;
    if (config.upload === true) {
        xhrTransport = function (req, options, controller, state) {
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
                        clone: () => ({
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
                            arrayBuffer: () => Promise.resolve(xhr.response)
                        })
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

    return {
        cacheEngine,
        dedupeEngine,
        queueEngine,
        visibilityEngine,
        loaderEngine,
        retryEngine,
        parseEngine,
        interceptorEngine,
        fetchTransport,
        xhrTransport,
        debugLogResponse
    };
}
