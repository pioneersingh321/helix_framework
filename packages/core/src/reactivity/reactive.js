import {
    RAW,
    IS_REACTIVE,
    IS_READONLY,
    IS_SHALLOW,
    SKIP,
    reactiveMap,
    readonlyMap,
    targetMap,
    warn,
    EffectScope
} from '../shared/shared.js';
import { track, trigger, pauseTracking, resumeTracking } from './effect.js';

const arrayInstrumentations = {};
["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].forEach((method) => {
    arrayInstrumentations[method] = function (...args) {
        pauseTracking();
        const res = Array.prototype[method].apply(this[RAW], args);
        resumeTracking();
        const depsMap = targetMap.get(this[RAW]);
        if (depsMap && depsMap.has("length")) {
            trigger(this[RAW], "length");
        }
        trigger(this[RAW], "*");
        return res;
    };
});

// --- Map & Set Collection Instrumentations ---
const mapInstrumentations = {
    get(key) {
        const target = this[RAW];
        const rawKey = toRaw(key);
        track(target, rawKey);
        const res = target.get(rawKey);
        if (this[IS_READONLY]) {
            return typeof res === "object" && res !== null && !isRaw(res) ? readonly(res) : res;
        }
        if (this[IS_SHALLOW]) {
            return res;
        }
        return typeof res === "object" && res !== null && !isRaw(res) ? reactive(res) : res;
    },
    has(key) {
        const target = this[RAW];
        const rawKey = toRaw(key);
        track(target, rawKey);
        return target.has(rawKey);
    },
    set(key, value) {
        if (this[IS_READONLY]) {
            warn(`[Helix] Set operation on readonly Map failed.`, "reactive");
            return this;
        }
        const target = this[RAW];
        const rawKey = toRaw(key);
        const rawValue = toRaw(value);
        const hadKey = target.has(rawKey);
        const oldValue = target.get(rawKey);
        target.set(rawKey, rawValue);
        if (!hadKey) {
            trigger(target, rawKey);
            trigger(target, "size");
            trigger(target, "*");
        } else if (oldValue !== rawValue) {
            trigger(target, rawKey);
            trigger(target, "*");
        }
        return this;
    },
    delete(key) {
        if (this[IS_READONLY]) {
            warn(`[Helix] Delete operation on readonly Map failed.`, "reactive");
            return false;
        }
        const target = this[RAW];
        const rawKey = toRaw(key);
        const hadKey = target.has(rawKey);
        const res = target.delete(rawKey);
        if (hadKey) {
            trigger(target, rawKey);
            trigger(target, "size");
            trigger(target, "*");
        }
        return res;
    },
    clear() {
        if (this[IS_READONLY]) {
            warn(`[Helix] Clear operation on readonly Map failed.`, "reactive");
            return;
        }
        const target = this[RAW];
        const hadEntries = target.size > 0;
        const oldKeys = Array.from(target.keys());
        target.clear();
        if (hadEntries) {
            trigger(target, "size");
            trigger(target, "*");
            oldKeys.forEach((k) => trigger(target, k));
        }
    },
    forEach(callback, thisArg) {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        target.forEach((val, key) => {
            const wrappedVal = isReadonly
                ? (typeof val === "object" && val !== null && !isRaw(val) ? readonly(val) : val)
                : isShallow
                ? val
                : (typeof val === "object" && val !== null && !isRaw(val) ? reactive(val) : val);
            callback.call(thisArg, wrappedVal, key, this);
        });
    },
    keys() {
        const target = this[RAW];
        track(target, "*");
        return target.keys();
    },
    values() {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        const iterator = target.values();
        return {
            next() {
                const { value, done } = iterator.next();
                if (done) return { value: undefined, done: true };
                const wrapped = isReadonly
                    ? (typeof value === "object" && value !== null && !isRaw(value) ? readonly(value) : value)
                    : isShallow
                    ? value
                    : (typeof value === "object" && value !== null && !isRaw(value) ? reactive(value) : value);
                return { value: wrapped, done: false };
            },
            [Symbol.iterator]() { return this; }
        };
    },
    entries() {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        const iterator = target.entries();
        return {
            next() {
                const { value, done } = iterator.next();
                if (done) return { value: undefined, done: true };
                const [k, v] = value;
                const wrappedV = isReadonly
                    ? (typeof v === "object" && v !== null && !isRaw(v) ? readonly(v) : v)
                    : isShallow
                    ? v
                    : (typeof v === "object" && v !== null && !isRaw(v) ? reactive(v) : v);
                return { value: [k, wrappedV], done: false };
            },
            [Symbol.iterator]() { return this; }
        };
    },
    [Symbol.iterator]() {
        return mapInstrumentations.entries.call(this);
    }
};

const setInstrumentations = {
    has(value) {
        const target = this[RAW];
        const rawVal = toRaw(value);
        track(target, rawVal);
        return target.has(rawVal);
    },
    add(value) {
        if (this[IS_READONLY]) {
            warn(`[Helix] Add operation on readonly Set failed.`, "reactive");
            return this;
        }
        const target = this[RAW];
        const rawVal = toRaw(value);
        const hadVal = target.has(rawVal);
        if (!hadVal) {
            target.add(rawVal);
            trigger(target, rawVal);
            trigger(target, "size");
            trigger(target, "*");
        }
        return this;
    },
    delete(value) {
        if (this[IS_READONLY]) {
            warn(`[Helix] Delete operation on readonly Set failed.`, "reactive");
            return false;
        }
        const target = this[RAW];
        const rawVal = toRaw(value);
        const hadVal = target.has(rawVal);
        const res = target.delete(rawVal);
        if (hadVal) {
            trigger(target, rawVal);
            trigger(target, "size");
            trigger(target, "*");
        }
        return res;
    },
    clear() {
        if (this[IS_READONLY]) {
            warn(`[Helix] Clear operation on readonly Set failed.`, "reactive");
            return;
        }
        const target = this[RAW];
        const hadEntries = target.size > 0;
        const oldValues = Array.from(target.values());
        target.clear();
        if (hadEntries) {
            trigger(target, "size");
            trigger(target, "*");
            oldValues.forEach((v) => trigger(target, v));
        }
    },
    forEach(callback, thisArg) {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        target.forEach((val) => {
            const wrapped = isReadonly
                ? (typeof val === "object" && val !== null && !isRaw(val) ? readonly(val) : val)
                : isShallow
                ? val
                : (typeof val === "object" && val !== null && !isRaw(val) ? reactive(val) : val);
            callback.call(thisArg, wrapped, wrapped, this);
        });
    },
    values() {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        const iterator = target.values();
        return {
            next() {
                const { value, done } = iterator.next();
                if (done) return { value: undefined, done: true };
                const wrapped = isReadonly
                    ? (typeof value === "object" && value !== null && !isRaw(value) ? readonly(value) : value)
                    : isShallow
                    ? value
                    : (typeof value === "object" && value !== null && !isRaw(value) ? reactive(value) : value);
                return { value: wrapped, done: false };
            },
            [Symbol.iterator]() { return this; }
        };
    },
    keys() {
        return setInstrumentations.values.call(this);
    },
    entries() {
        const target = this[RAW];
        const isReadonly = this[IS_READONLY];
        const isShallow = this[IS_SHALLOW];
        track(target, "*");
        const iterator = target.entries();
        return {
            next() {
                const { value, done } = iterator.next();
                if (done) return { value: undefined, done: true };
                const [k, v] = value;
                const wrapped = isReadonly
                    ? (typeof v === "object" && v !== null && !isRaw(v) ? readonly(v) : v)
                    : isShallow
                    ? v
                    : (typeof v === "object" && v !== null && !isRaw(v) ? reactive(v) : v);
                return { value: [wrapped, wrapped], done: false };
            },
            [Symbol.iterator]() { return this; }
        };
    },
    [Symbol.iterator]() {
        return setInstrumentations.values.call(this);
    }
};

// --- Date Instrumentations ---
const dateMutators = [
    "setTime", "setFullYear", "setMonth", "setDate", "setHours", "setMinutes", "setSeconds", "setMilliseconds",
    "setUTCFullYear", "setUTCMonth", "setUTCDate", "setUTCHours", "setUTCMinutes", "setUTCSeconds", "setUTCMilliseconds"
];

const dateGetters = [
    "getTime", "getFullYear", "getMonth", "getDate", "getDay", "getHours", "getMinutes", "getSeconds", "getMilliseconds",
    "getTimezoneOffset", "getUTCFullYear", "getUTCMonth", "getUTCDate", "getUTCDay", "getUTCHours", "getUTCMinutes", "getUTCSeconds",
    "getUTCMilliseconds", "toISOString", "toUTCString", "toDateString", "toTimeString", "toLocaleDateString", "toLocaleTimeString",
    "toLocaleString", "toString", "valueOf", "toJSON"
];

const dateInstrumentations = {};
dateMutators.forEach((method) => {
    dateInstrumentations[method] = function (...args) {
        if (this[IS_READONLY]) {
            warn(`[Helix] Mutation operation on readonly Date failed: ${method}`, "reactive");
            return this[RAW].getTime();
        }
        const target = this[RAW];
        const res = target[method].apply(target, args);
        trigger(target, "*");
        trigger(target, "getTime");
        trigger(target, "value");
        return res;
    };
});

dateGetters.forEach((method) => {
    dateInstrumentations[method] = function (...args) {
        const target = this[RAW];
        track(target, "*");
        track(target, "getTime");
        return target[method].apply(target, args);
    };
});

const hasDOM = typeof Node !== "undefined";

export function isRaw(value) {
    if (!value || typeof value !== "object") return false;
    if (value[SKIP]) return true;
    const ctorName = value.constructor ? value.constructor.name : "";
    if (
        ctorName === "EffectScope" ||
        ctorName === "WeakSet" ||
        ctorName === "WeakMap" ||
        ctorName === "RegExp" ||
        ctorName === "Promise" ||
        value instanceof WeakSet ||
        value instanceof WeakMap ||
        value instanceof RegExp ||
        value instanceof Promise ||
        value instanceof EffectScope
    ) {
        return true;
    }
    if (!hasDOM) return false;
    return (
        value instanceof Node ||
        value instanceof Event ||
        value instanceof NodeList ||
        value instanceof HTMLCollection ||
        value instanceof DOMTokenList ||
        value instanceof Window ||
        value instanceof Document ||
        value instanceof CSSStyleDeclaration
    );
}

const boundMethodCache = new WeakMap();

function getBoundMethod(fn, receiver) {
    let methodMap = boundMethodCache.get(receiver);
    if (!methodMap) {
        methodMap = new WeakMap();
        boundMethodCache.set(receiver, methodMap);
    }
    let bound = methodMap.get(fn);
    if (!bound) {
        bound = fn.bind(receiver);
        methodMap.set(fn, bound);
    }
    return bound;
}

export function reactive(target) {
    if (typeof target !== "object" || target === null) return target;
    if (isRaw(target)) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) return target;
    if (target[SKIP]) return target;
    if (reactiveMap.has(target)) return reactiveMap.get(target);

    const isMapTarget = target instanceof Map;
    const isSetTarget = target instanceof Set;
    const isDateTarget = target instanceof Date;

    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return true;
            if (key === IS_READONLY) return false;

            if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            if (isMapTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (mapInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(mapInstrumentations, key, receiver);
                }
            }
            if (isSetTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (setInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(setInstrumentations, key, receiver);
                }
            }
            if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(dateInstrumentations, key, receiver);
            }

            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const isBuiltin = obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp || (obj.constructor && obj.constructor.name === "EffectScope");
                const bindTarget = isBuiltin ? obj : receiver;
                return getBoundMethod(res, bindTarget);
            }
            track(obj, key);
            if (Array.isArray(obj)) track(obj, "*");
            return typeof res === "object" && res !== null && !isRaw(res) ? reactive(res) : res;
        },
        set(obj, key, value, receiver) {
            const oldValue = obj[key];
            const res = Reflect.set(obj, key, value, receiver);
            if (oldValue !== value || (Array.isArray(obj) && key === "length")) {
                trigger(obj, key);
                if (Array.isArray(obj)) trigger(obj, "*");
            }
            return res;
        }
    });
    reactiveMap.set(target, proxy);
    return proxy;
}

export function shallowReactive(target) {
    if (typeof target !== "object" || target === null) return target;
    if (isRaw(target)) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) return target;
    if (target[SKIP]) return target;

    const isMapTarget = target instanceof Map;
    const isSetTarget = target instanceof Set;
    const isDateTarget = target instanceof Date;

    return new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return true;
            if (key === IS_READONLY) return false;
            if (key === IS_SHALLOW) return true;

            if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            if (isMapTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (mapInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(mapInstrumentations, key, receiver);
                }
            }
            if (isSetTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (setInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(setInstrumentations, key, receiver);
                }
            }
            if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(dateInstrumentations, key, receiver);
            }

            track(obj, key);
            if (Array.isArray(obj)) track(obj, "*");
            return Reflect.get(obj, key, receiver);
        },
        set(obj, key, value, receiver) {
            const oldValue = obj[key];
            const res = Reflect.set(obj, key, value, receiver);
            if (oldValue !== value || (Array.isArray(obj) && key === "length")) {
                trigger(obj, key);
                if (Array.isArray(obj)) trigger(obj, "*");
            }
            return res;
        }
    });
}

export function readonly(target) {
    if (typeof target !== "object" || target === null) return target;
    if (isRaw(target)) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) target = target[RAW];
    if (readonlyMap.has(target)) return readonlyMap.get(target);

    const isMapTarget = target instanceof Map;
    const isSetTarget = target instanceof Set;
    const isDateTarget = target instanceof Date;

    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return false;
            if (key === IS_READONLY) return true;

            if (isMapTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (mapInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(mapInstrumentations, key, receiver);
                }
            }
            if (isSetTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (setInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(setInstrumentations, key, receiver);
                }
            }
            if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(dateInstrumentations, key, receiver);
            }

            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const bindTarget = (obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp) ? obj : receiver;
                return getBoundMethod(res, bindTarget);
            }
            return typeof res === "object" && res !== null && !isRaw(res) ? readonly(res) : res;
        },
        set() {
            warn(`[Helix] Set operation on readonly target failed.`, "reactive");
            return true;
        },
        deleteProperty() {
            warn(`[Helix] Delete operation on readonly target failed.`, "reactive");
            return true;
        }
    });
    readonlyMap.set(target, proxy);
    return proxy;
}

export function shallowReadonly(target) {
    if (typeof target !== "object" || target === null) return target;
    if (isRaw(target)) return target;
    if (target[IS_READONLY]) return target;

    const isMapTarget = target instanceof Map;
    const isSetTarget = target instanceof Set;
    const isDateTarget = target instanceof Date;

    return new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return false;
            if (key === IS_READONLY) return true;
            if (key === IS_SHALLOW) return true;

            if (isMapTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (mapInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(mapInstrumentations, key, receiver);
                }
            }
            if (isSetTarget) {
                if (key === "size") {
                    track(obj, "size");
                    track(obj, "*");
                    return obj.size;
                }
                if (setInstrumentations.hasOwnProperty(key)) {
                    return Reflect.get(setInstrumentations, key, receiver);
                }
            }
            if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(dateInstrumentations, key, receiver);
            }

            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const bindTarget = (obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp) ? obj : receiver;
                return getBoundMethod(res, bindTarget);
            }
            return res;
        },
        set() {
            warn(`[Helix] Set operation on shallowReadonly target failed.`, "reactive");
            return true;
        },
        deleteProperty() {
            warn(`[Helix] Delete operation on shallowReadonly target failed.`, "reactive");
            return true;
        }
    });
}

export function markRaw(value) {
    if (typeof value === "object" && value !== null) {
        Object.defineProperty(value, SKIP, { value: true, configurable: true, enumerable: false, writable: false });
    }
    return value;
}

export function toRaw(observed) {
    return observed && observed[RAW] ? observed[RAW] : observed;
}

export function isProxy(value) {
    return !!(value && (value[IS_REACTIVE] || value[IS_READONLY]));
}

export function isReactive(value) {
    if (isReadonly(value)) {
        return isReactive(value[RAW]);
    }
    return !!(value && value[IS_REACTIVE]);
}

export function isReadonly(value) {
    return !!(value && value[IS_READONLY]);
}

export function isShallow(value) {
    return !!(value && value[IS_SHALLOW] === true);
}
