import { _isPlainObject } from './shared.js';

const _equalMap = new WeakMap();

export function createTypeMethods(H) {
    return {
        isArray: (v) => Array.isArray(v),
        isObject: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
        isPlainObject: (v) => _isPlainObject(v),
        isString: (v) => typeof v === 'string',
        isNumber: (v) => typeof v === 'number' && Number.isFinite(v),
        isBoolean: (v) => typeof v === 'boolean',
        isFunction: (v) => typeof v === 'function',
        isNull: (v) => v === null,
        isUndefined: (v) => v === undefined,
        isNil: (v) => v === null || v === undefined,
        isDate: (v) => v instanceof Date,
        isRegExp: (v) => v instanceof RegExp,
        isPromise: (v) => v instanceof Promise || (v !== null && typeof v === 'object' && typeof v.then === 'function'),
        isMap: (v) => v instanceof Map,
        isSet: (v) => v instanceof Set,
        isWeakMap: (v) => v instanceof WeakMap,
        isWeakSet: (v) => v instanceof WeakSet,
        isSymbol: (v) => typeof v === 'symbol',

        isEmpty(v) {
            if (v == null) return true;
            if (typeof v === 'string' || Array.isArray(v)) return v.length === 0;
            if (v instanceof Map || v instanceof Set) return v.size === 0;
            if (_isPlainObject(v)) return Object.keys(v).length === 0;
            return false;
        },

        isEqual(a, b) {
            if (a === b) return true;
            if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
            if (a == null || b == null) return false;
            if (typeof a !== typeof b) return false;
            if (typeof a !== 'object') return false;

            let stack = _equalMap.get(a);
            if (!stack) { stack = new WeakSet(); _equalMap.set(a, stack); }
            if (stack.has(b)) return true;
            stack.add(b);

            if (Array.isArray(a) !== Array.isArray(b)) { stack.delete(b); return false; }
            if (a instanceof Date && b instanceof Date) { const r = a.getTime() === b.getTime(); stack.delete(b); return r; }
            if (a instanceof RegExp && b instanceof RegExp) { const r = a.toString() === b.toString(); stack.delete(b); return r; }

            const keysA = Reflect.ownKeys(a);
            const keysB = Reflect.ownKeys(b);
            if (keysA.length !== keysB.length) { stack.delete(b); return false; }

            const result = keysA.every(k => keysB.includes(k) && H.isEqual(a[k], b[k]));
            stack.delete(b);
            return result;
        }
    };
}
