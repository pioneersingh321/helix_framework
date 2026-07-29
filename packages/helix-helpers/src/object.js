import { _hasOwn, _isPlainObject, _toPath } from './shared.js';

const _cloneMap = new WeakMap();

export function createObjectMethods(H, app) {
    return {
        pick(obj, keys) {
            if (!H.isObject(obj)) return {};
            const ka = Array.isArray(keys) ? keys : [keys];
            return ka.reduce((r, k) => {
                if (k in obj) r[k] = obj[k];
                return r;
            }, {});
        },

        pickBy(obj, predicate) {
            if (!H.isObject(obj)) return {};
            return Object.entries(obj).reduce((r, [k, v]) => {
                if (predicate(v, k)) r[k] = v;
                return r;
            }, {});
        },

        omit(obj, keys) {
            if (!H.isObject(obj)) return {};
            const r = { ...obj };
            (Array.isArray(keys) ? keys : [keys]).forEach(k => delete r[k]);
            return r;
        },

        omitBy(obj, predicate) {
            if (!H.isObject(obj)) return {};
            return Object.entries(obj).reduce((r, [k, v]) => {
                if (!predicate(v, k)) r[k] = v;
                return r;
            }, {});
        },

        cloneDeep(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
            if (obj instanceof Map) return new Map(Array.from(obj, ([k, v]) => [H.cloneDeep(k), H.cloneDeep(v)]));
            if (obj instanceof Set) return new Set(Array.from(obj, v => H.cloneDeep(v)));
            if (Array.isArray(obj)) return obj.map(i => H.cloneDeep(i));

            if (_cloneMap.has(obj)) return _cloneMap.get(obj);
            const clone = {};
            _cloneMap.set(obj, clone);

            for (const k of Reflect.ownKeys(obj)) {
                if (_hasOwn(obj, k) || Object.getOwnPropertyDescriptor(obj, k)) {
                    clone[k] = H.cloneDeep(obj[k]);
                }
            }
            _cloneMap.delete(obj);
            return clone;
        },

        deepMerge(target, ...sources) {
            if (!sources.length) return target;
            const s = sources.shift();
            if (!_isPlainObject(target) || !_isPlainObject(s)) return H.deepMerge(target, ...sources);
            const result = { ...target };
            for (const k of Reflect.ownKeys(s)) {
                if (_hasOwn(s, k)) {
                    if (_isPlainObject(s[k]) && _isPlainObject(result[k])) {
                        result[k] = H.deepMerge(result[k], s[k]);
                    } else {
                        result[k] = H.cloneDeep(s[k]);
                    }
                }
            }
            return H.deepMerge(result, ...sources);
        },

        merge(target, ...sources) {
            if (!sources.length) return target;
            const s = sources.shift();
            if (_isPlainObject(target) && _isPlainObject(s)) {
                for (const k of Reflect.ownKeys(s)) {
                    if (_hasOwn(s, k)) {
                        if (_isPlainObject(s[k])) {
                            if (!target[k]) target[k] = {};
                            H.merge(target[k], s[k]);
                        } else {
                            target[k] = s[k];
                        }
                    }
                }
            }
            return H.merge(target, ...sources);
        },

        hasKey(obj, key) {
            return H.isObject(obj) && _hasOwn(obj, key);
        },

        get(obj, path, def) {
            if (obj == null || path == null) return def;
            if (typeof app.resolvePath === 'function') {
                const appRes = app.resolvePath(String(path), obj);
                if (appRes !== undefined) return appRes;
            }
            let r = obj;
            for (const k of _toPath(path)) {
                if (r == null || !(k in r)) return def;
                r = r[k];
                if (typeof app.isRef === 'function' && app.isRef(r)) {
                    r = r.value;
                }
            }
            return r;
        },

        set(obj, path, val) {
            if (!obj || path == null) return obj;
            let c = obj;
            const ks = _toPath(path);
            for (let i = 0; i < ks.length - 1; i++) {
                const k = ks[i];
                if (!(k in c) || typeof c[k] !== 'object' || c[k] === null) c[k] = {};
                c = c[k];
            }
            c[ks[ks.length - 1]] = val;
            return obj;
        }
    };
}
