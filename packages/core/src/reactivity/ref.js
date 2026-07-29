import {
    RAW,
    IS_REF,
    IS_SHALLOW,
    warn
} from '../shared/shared.js';
import { track, trigger } from './effect.js';

export function ref(value) {
    const refObj = {};
    Object.defineProperty(refObj, "value", {
        get() {
            track(refObj, "value");
            return value;
        },
        set(newVal) {
            if (value !== newVal) {
                value = newVal;
                trigger(refObj, "value");
            }
        }
    });
    refObj[IS_REF] = true;
    refObj[RAW] = refObj;
    return refObj;
}

export function customRef(factory) {
    let value;
    let _track;
    let _trigger;
    const refObj = {};
    Object.defineProperty(refObj, "value", {
        get() {
            _track();
            return value;
        },
        set(newVal) {
            if (value !== newVal) {
                value = newVal;
                _trigger();
            }
        }
    });
    refObj[IS_REF] = true;
    refObj[RAW] = refObj;
    const { track: trackFn, trigger: triggerFn } = factory(
        () => { if (_track) _track(); },
        () => { if (_trigger) _trigger(); }
    );
    _track = trackFn;
    _trigger = triggerFn;
    return refObj;
}

export function shallowRef(value) {
    const refObj = {};
    Object.defineProperty(refObj, "value", {
        get() {
            track(refObj, "value");
            return value;
        },
        set(newVal) {
            if (value !== newVal) {
                value = newVal;
                trigger(refObj, "value");
            }
        }
    });
    refObj[IS_REF] = true;
    refObj[IS_SHALLOW] = true;
    refObj[RAW] = refObj;
    return refObj;
}

export function triggerRef(refObj) {
    if (refObj && refObj[IS_REF]) {
        trigger(refObj, "value");
    } else {
        warn(`triggerRef() expects a ref object.`, "ref");
    }
}

export function toValue(source) {
    return isRef(source) ? source.value : source;
}

export function unref(val) {
    return isRef(val) ? val.value : val;
}

export function isRef(val) {
    return !!(val && val[IS_REF] === true);
}

export function toRef(object, key) {
    const refObj = {};
    Object.defineProperty(refObj, "value", {
        get() {
            track(object, key);
            return object[key];
        },
        set(newVal) {
            object[key] = newVal;
        }
    });
    refObj[IS_REF] = true;
    refObj[RAW] = refObj;
    return refObj;
}

export function toRefs(object) {
    const result = {};
    for (const key of Object.keys(object)) result[key] = toRef(object, key);
    return result;
}
