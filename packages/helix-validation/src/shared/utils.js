import { getCurrentContext } from '../core/context.js';
import { MSGS } from './defaults.js';
import { normalizeRules } from '../core/parser.js';
import { runRules } from '../core/runner.js';

export function isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string')         return v.trim() === '';
    if (Array.isArray(v))              return v.length === 0;
    return false;
}

export function resolveParam(val) {
    if (typeof val === 'function') return val();
    if (val && typeof val === 'object' && 'value' in val) return val.value;
    return val;
}

export function mkRule(fn, name, priority, params) {
    fn.meta = {
        name,
        priority,
        params: params || {}
    };
    fn._ruleName = name;
    fn._priority = priority;
    if (params) fn._params = params;
    return fn;
}

export function mkFactory(fn) {
    fn._isRuleFactory = true;
    return fn;
}

export function resolveMsg(name, params, value, ctxOrLocalContext) {
    let localContext;
    if (ctxOrLocalContext) {
        localContext = ctxOrLocalContext._context || ctxOrLocalContext;
    } else {
        localContext = getCurrentContext();
    }
    const config = localContext.config;
    const custom = config.messages[name];
    if (custom) {
        return typeof custom === 'function'
            ? custom({ value, params, rule: name })
            : custom;
    }
    const def = MSGS[name];
    if (def) return typeof def === 'function' ? def({ value, p: params, rule: name }) : def;
    return 'Invalid value.';
}

const remoteCaches = new WeakMap();

export function runRemote(el, url, value, opts, localContext) {
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};

    const cacheEnabled = opts.cache ?? config.remote.cache ?? false;
    const ttl = opts.ttl ?? config.remote.ttl ?? 5000;
    const cacheKey = opts.key ? opts.key(value) : String(value);

    if (cacheEnabled) {
        let elCache = remoteCaches.get(el);
        if (!elCache) {
            elCache = new Map();
            remoteCaches.set(el, elCache);
        }
        const cached = elCache.get(cacheKey);
        if (cached && (cached.timestamp + ttl > Date.now())) {
            return Promise.resolve(cached.result);
        }
    }

    if (ctx.remoteAborts.has(el)) ctx.remoteAborts.get(el).abort();
    const ctrl = new AbortController();
    ctx.remoteAborts.set(el, ctrl);

    const method  = (opts.method || config.remote.method).toUpperCase();
    const param   = opts.param || config.remote.param;
    const headers = Object.assign({}, config.remote.headers, opts.headers || {});

    let fetchUrl = url;
    let body;

    if (method === 'GET') {
        fetchUrl = url + (url.includes('?') ? '&' : '?') + param + '=' + encodeURIComponent(value);
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ [param]: value });
    }

    const $http = app.namespace && typeof app.namespace === 'function'
        ? (app.namespace('axios') && app.namespace('axios').$http) : null;

    const req = ($http && method === 'GET')
        ? $http.get(fetchUrl, { signal: ctrl.signal, headers })
        : fetch(fetchUrl, { method, headers, body, signal: ctrl.signal })
            .then(res => {
                if (!res.ok) return { valid: false, message: opts.fallback || 'Validation failed.' };
                return res.json();
            });

    return req
        .then(json => {
            let result;
            if (json.errors && Array.isArray(json.errors)) {
                result = { valid: false, message: json.errors[0] };
            } else {
                result = { valid: json.valid !== false, message: json.message || null };
            }
            if (cacheEnabled && result) {
                let elCache = remoteCaches.get(el);
                if (elCache) {
                    elCache.set(cacheKey, { result, timestamp: Date.now() });
                }
            }
            return result;
        })
        .catch(err => {
            if (err && err.name === 'AbortError') return { aborted: true };
            return { valid: false, message: 'Connection error. Please try again.' };
        })
        .finally(() => {
            if (ctx.remoteAborts.get(el) === ctrl) {
                ctx.remoteAborts.delete(el);
            }
        });
}

export function check(value, ruleDefs, opts2) {
    const localContext = getCurrentContext();
    const wantTagged = !!(opts2 && opts2.tagged);
    const dummy = { _runId: null, _runAbort: null, _type: 'field', _parent: null, _context: localContext };
    return runRules(dummy, normalizeRules(ruleDefs, localContext._registry), value)
        .then(r => {
            if (dummy._runAbort) { try { dummy._runAbort.abort(); } catch (_) {} dummy._runAbort = null; }
            if (!r) return [];
            return wantTagged ? r.tagged : r.errors;
        });
}

export function getForm(selectorOrEl, localContext) {
    const ctx = localContext || getCurrentContext();
    const el = typeof selectorOrEl === 'string'
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;
    if (!el) return null;
    let f = ctx.formContextMap.get(el) || ctx.autoForms.get(el);
    if (!f && ctx.scanForms) {
        ctx.scanForms(ctx, el, true);
        f = ctx.formContextMap.get(el) || ctx.autoForms.get(el);
    }
    return f || null;
}

export function resolvePrefix(appOrCtx) {
    const app = (appOrCtx && appOrCtx.app) ? appOrCtx.app : appOrCtx;
    const rawPrefix = (app && app.config && app.config.prefix) || 'hx-';
    return rawPrefix.replace(/-+$/, '');
}

export function createRuleRegistry(initialMapOrParent) {
    const registry = (initialMapOrParent instanceof Map) ? initialMapOrParent : new Map();
    const onAddListeners = new Set();
    const onRemoveListeners = new Set();

    return {
        _registry: registry,
        add(name, fn, meta) {
            if (fn && typeof fn === 'object' && typeof fn.validate === 'function') {
                const validateFn = fn.validate;
                const messageTemplate = fn.message;
                const priority = fn.priority || 1;
                const factory = (...args) => {
                    const innerRule = (v, ctx) => {
                        const res = validateFn(v, ...args);
                        if (res === true || res === null || res === undefined) return null;
                        if (res === false) {
                            let msg = messageTemplate || 'Invalid value.';
                            if (args.length > 1 && !msg.includes('{1}')) {
                                msg = msg.replace(/\{0\}/g, args.join(', '));
                            } else {
                                args.forEach((arg, idx) => {
                                    msg = msg.replace(new RegExp(`\\{${idx}\\}`, 'g'), arg);
                                });
                            }
                            return msg;
                        }
                        return res;
                    };
                    innerRule.meta = { name, priority, params: {} };
                    innerRule._ruleName = name;
                    innerRule._priority = priority;
                    return innerRule;
                };
                factory._isRuleFactory = true;
                fn = factory;
            }

            if (typeof name !== 'string' || typeof fn !== 'function') return;
            if (!fn.meta) fn.meta = {};
            if (!fn.meta.name) fn.meta.name = name;
            if (!fn._ruleName) fn._ruleName = name;
            registry.set(name, { fn, priority: (meta && meta.priority) || fn.meta.priority || 1 });
            onAddListeners.forEach(cb => { try { cb(name, fn, meta); } catch (_) {} });
        },
        remove(name) {
            registry.delete(name);
            onRemoveListeners.forEach(cb => { try { cb(name); } catch (_) {} });
        },
        get(name) {
            return registry.get(name) || null;
        },
        has(name) {
            return registry.has(name);
        },
        list() {
            return Array.from(registry.keys());
        },
        onAdd(cb) {
            if (typeof cb === 'function') onAddListeners.add(cb);
            return () => onAddListeners.delete(cb);
        },
        onRemove(cb) {
            if (typeof cb === 'function') onRemoveListeners.add(cb);
            return () => onRemoveListeners.delete(cb);
        }
    };
}

export function walkLeafFields(fields, cb) {
    const collect = (path, ctrl) => {
        if (ctrl.disabled && ctrl.disabled.value) return true;
        if (ctrl._type === 'form') {
            const keys = Object.keys(ctrl.fields);
            for (let i = 0; i < keys.length; i++) {
                if (!collect(path ? `${path}.${keys[i]}` : keys[i], ctrl.fields[keys[i]])) {
                    return false;
                }
            }
        } else if (ctrl._type === 'list') {
            const items = ctrl.items.value;
            for (let i = 0; i < items.length; i++) {
                if (!collect(path ? `${path}.${i}` : String(i), items[i])) {
                    return false;
                }
            }
        } else {
            return cb(path, ctrl) !== false;
        }
        return true;
    };
    const keys = Object.keys(fields);
    for (let i = 0; i < keys.length; i++) {
        if (!collect(keys[i], fields[keys[i]])) {
            break;
        }
    }
}

export function createLookupRegistry(control, ctx) {
    return {
        get(name) {
            let cur = control;
            while (cur) {
                if (cur._localRules && cur._localRules.has(name)) {
                    return cur._localRules.get(name);
                }
                cur = cur._parent;
            }
            return (ctx && ctx._registry && ctx._registry.get(name)) || null;
        }
    };
}

export function parsePath(path) {
    if (path == null) return [];
    return String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
}

export function resolvePath(rootControl, path) {
    const parts = parsePath(path);
    let cur = rootControl;
    for (let i = 0; i < parts.length; i++) {
        if (!cur) return null;
        if (cur._type === 'form') cur = cur.fields[parts[i]];
        else if (cur._type === 'list') cur = cur.items.value[Number(parts[i])];
        else return null;
    }
    return cur || null;
}

export function runMiddleware(hooks, ...args) {
    if (!hooks || !hooks.length) return Promise.resolve();
    return hooks.reduce((chain, fn) => {
        return chain.then(() => Promise.resolve(fn(...args)));
    }, Promise.resolve());
}

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function getClassTarget(el, handler) {
    if (!handler)             return el;
    if (handler === 'parent') return el.parentElement || el;
    try { return document.querySelector(handler) || el; } catch { return el; }
}
