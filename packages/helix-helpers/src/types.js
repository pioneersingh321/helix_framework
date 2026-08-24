import { _isPlainObject, _toStr } from './shared.js';

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
        isDate: (v) => _toStr.call(v) === '[object Date]',
        isRegExp: (v) => _toStr.call(v) === '[object RegExp]',
        isPromise: (v) => v !== null && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function',
        isMap: (v) => _toStr.call(v) === '[object Map]',
        isSet: (v) => _toStr.call(v) === '[object Set]',
        isWeakMap: (v) => _toStr.call(v) === '[object WeakMap]',
        isWeakSet: (v) => _toStr.call(v) === '[object WeakSet]',
        isSymbol: (v) => typeof v === 'symbol',

        isEmpty(v) {
            if (v == null) return true;
            if (typeof v === 'string' || Array.isArray(v)) return v.length === 0;
            if (v instanceof Map || v instanceof Set || _toStr.call(v) === '[object Map]' || _toStr.call(v) === '[object Set]') {
                return v.size === 0;
            }
            if (_isPlainObject(v)) return Object.keys(v).length === 0;
            return false;
        },

        isEqual(a, b, stack = new WeakMap()) {
            if (a === b) return true;
            if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
            if (a == null || b == null) return false;
            if (typeof a !== typeof b) return false;
            if (typeof a !== 'object') return false;

            let aStack = stack.get(a);
            if (!aStack) { aStack = new WeakSet(); stack.set(a, aStack); }
            if (aStack.has(b)) return true;
            aStack.add(b);

            if (Array.isArray(a) || Array.isArray(b)) {
                if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
                    aStack.delete(b);
                    return false;
                }
                const res = a.every((item, i) => H.isEqual(item, b[i], stack));
                aStack.delete(b);
                return res;
            }

            const isDateA = _toStr.call(a) === '[object Date]';
            const isDateB = _toStr.call(b) === '[object Date]';
            if (isDateA || isDateB) {
                const res = isDateA && isDateB && a.getTime() === b.getTime();
                aStack.delete(b);
                return res;
            }

            const isRegA = _toStr.call(a) === '[object RegExp]';
            const isRegB = _toStr.call(b) === '[object RegExp]';
            if (isRegA || isRegB) {
                const res = isRegA && isRegB && a.toString() === b.toString();
                aStack.delete(b);
                return res;
            }

            const isMapA = _toStr.call(a) === '[object Map]';
            const isMapB = _toStr.call(b) === '[object Map]';
            if (isMapA || isMapB) {
                if (!isMapA || !isMapB || a.size !== b.size) {
                    aStack.delete(b);
                    return false;
                }
                const entriesB = Array.from(b.entries());
                const res = Array.from(a.entries()).every(([kA, vA]) => {
                    const matchIdx = entriesB.findIndex(([kB, vB]) => H.isEqual(kA, kB, stack) && H.isEqual(vA, vB, stack));
                    if (matchIdx === -1) return false;
                    entriesB.splice(matchIdx, 1);
                    return true;
                });
                aStack.delete(b);
                return res;
            }

            const isSetA = _toStr.call(a) === '[object Set]';
            const isSetB = _toStr.call(b) === '[object Set]';
            if (isSetA || isSetB) {
                if (!isSetA || !isSetB || a.size !== b.size) {
                    aStack.delete(b);
                    return false;
                }
                const itemsB = Array.from(b.values());
                const res = Array.from(a.values()).every(vA => {
                    const matchIdx = itemsB.findIndex(vB => H.isEqual(vA, vB, stack));
                    if (matchIdx === -1) return false;
                    itemsB.splice(matchIdx, 1);
                    return true;
                });
                aStack.delete(b);
                return res;
            }

            const protoA = Object.getPrototypeOf(a);
            const protoB = Object.getPrototypeOf(b);
            if (protoA !== protoB && (protoA !== null && protoA !== Object.prototype) && (protoB !== null && protoB !== Object.prototype)) {
                aStack.delete(b);
                return false;
            }

            const keysA = Reflect.ownKeys(a);
            const keysB = Reflect.ownKeys(b);
            if (keysA.length !== keysB.length) { aStack.delete(b); return false; }

            const res = keysA.every(k => Object.prototype.hasOwnProperty.call(b, k) && H.isEqual(a[k], b[k], stack));
            aStack.delete(b);
            return res;
        }
    };
}
