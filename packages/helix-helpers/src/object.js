import { _hasOwn, _isPlainObject, _toPath } from './shared.js';

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

        cloneDeep(obj, _map = new WeakMap()) {
            if (obj === null || typeof obj !== 'object') return obj;

            if (_map.has(obj)) return _map.get(obj);

            const copyDescriptors = (src, target, exclude = []) => {
                const descriptors = Object.getOwnPropertyDescriptors(src);
                for (const k of Reflect.ownKeys(descriptors)) {
                    if (exclude.includes(k) || (Array.isArray(src) && /^\d+$/.test(k))) continue;
                    const desc = descriptors[k];
                    if ('value' in desc) {
                        desc.value = H.cloneDeep(desc.value, _map);
                    }
                    try {
                        Object.defineProperty(target, k, desc);
                    } catch {
                        target[k] = H.cloneDeep(src[k], _map);
                    }
                }
            };

            if (obj instanceof Date) {
                const cloneDate = new Date(obj.getTime());
                _map.set(obj, cloneDate);
                copyDescriptors(obj, cloneDate);
                return cloneDate;
            }

            if (obj instanceof RegExp) {
                const cloneReg = new RegExp(obj.source, obj.flags);
                _map.set(obj, cloneReg);
                copyDescriptors(obj, cloneReg);
                return cloneReg;
            }

            if (Array.isArray(obj)) {
                const cloneArr = [];
                _map.set(obj, cloneArr);
                for (let i = 0; i < obj.length; i++) {
                    cloneArr[i] = H.cloneDeep(obj[i], _map);
                }
                copyDescriptors(obj, cloneArr, ['length']);
                return cloneArr;
            }

            if (obj instanceof Map) {
                const cloneMap = new Map();
                _map.set(obj, cloneMap);
                obj.forEach((v, k) => {
                    cloneMap.set(H.cloneDeep(k, _map), H.cloneDeep(v, _map));
                });
                copyDescriptors(obj, cloneMap);
                return cloneMap;
            }

            if (obj instanceof Set) {
                const cloneSet = new Set();
                _map.set(obj, cloneSet);
                obj.forEach(v => {
                    cloneSet.add(H.cloneDeep(v, _map));
                });
                copyDescriptors(obj, cloneSet);
                return cloneSet;
            }

            const proto = Object.getPrototypeOf(obj);
            const clone = Object.create(proto);
            _map.set(obj, clone);
            copyDescriptors(obj, clone);

            return clone;
        },

        deepMerge(target, ...sources) {
            let result = _isPlainObject(target) ? { ...target } : {};
            for (const s of sources) {
                if (_isPlainObject(s)) {
                    for (const k of Reflect.ownKeys(s)) {
                        if (_hasOwn(s, k)) {
                            if (_isPlainObject(s[k]) && _isPlainObject(result[k])) {
                                result[k] = H.deepMerge(result[k], s[k]);
                            } else {
                                result[k] = H.cloneDeep(s[k]);
                            }
                        }
                    }
                }
            }
            return result;
        },

        merge(target, ...sources) {
            if (!target || typeof target !== 'object') target = {};
            for (const s of sources) {
                if (_isPlainObject(s)) {
                    for (const k of Reflect.ownKeys(s)) {
                        if (_hasOwn(s, k)) {
                            if (_isPlainObject(s[k])) {
                                if (!target[k] || typeof target[k] !== 'object') target[k] = {};
                                H.merge(target[k], s[k]);
                            } else {
                                target[k] = s[k];
                            }
                        }
                    }
                }
            }
            return target;
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
                const nextKey = ks[i + 1];
                const isNextIndex = /^\d+$/.test(nextKey);
                if (!(k in c) || typeof c[k] !== 'object' || c[k] === null || (isNextIndex && !Array.isArray(c[k])) || (!isNextIndex && Array.isArray(c[k]))) {
                    c[k] = isNextIndex ? [] : {};
                }
                c = c[k];
            }
            c[ks[ks.length - 1]] = val;
            return obj;
        }
    };
}
