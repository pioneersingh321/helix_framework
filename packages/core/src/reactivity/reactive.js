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

const hasDOM = typeof Node !== "undefined";

export function isRaw(value) {
    if (!value || typeof value !== "object") return false;
    if (value[SKIP]) return true;
    const ctorName = value.constructor ? value.constructor.name : "";
    if (
        ctorName === "EffectScope" ||
        ctorName === "Set" ||
        ctorName === "Map" ||
        ctorName === "WeakSet" ||
        ctorName === "WeakMap" ||
        ctorName === "Date" ||
        ctorName === "RegExp" ||
        ctorName === "Promise" ||
        value instanceof Set ||
        value instanceof Map ||
        value instanceof WeakSet ||
        value instanceof WeakMap ||
        value instanceof Date ||
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
    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return true;
            if (key === IS_READONLY) return false;
            if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const isBuiltin = obj instanceof Set || obj instanceof Map || obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof Date || obj instanceof RegExp || (obj.constructor && obj.constructor.name === "EffectScope");
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
    return new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return true;
            if (key === IS_READONLY) return false;
            if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
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
    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return false;
            if (key === IS_READONLY) return true;
            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const bindTarget = (obj instanceof Set || obj instanceof Map || obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof Date || obj instanceof RegExp) ? obj : receiver;
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
    return new Proxy(target, {
        get(obj, key, receiver) {
            if (key === RAW) return obj;
            if (key === IS_REACTIVE) return false;
            if (key === IS_READONLY) return true;
            const res = Reflect.get(obj, key, receiver);
            if (typeof res === "function") {
                const bindTarget = (obj instanceof Set || obj instanceof Map || obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof Date || obj instanceof RegExp) ? obj : receiver;
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

export function isShallow(value) {
    return !!(value && value[IS_SHALLOW] === true);
}
