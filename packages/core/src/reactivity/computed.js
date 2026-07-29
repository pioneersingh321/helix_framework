import {
    IS_REF,
    handleError,
    warn
} from '../shared/shared.js';
import { track, trigger, effect } from './effect.js';

export function computed(getterOrOptions) {
    let getter, setter;
    if (typeof getterOrOptions === "function") {
        getter = getterOrOptions;
        setter = () => warn(`[Helix] 💥 Write operation failed: computed value is readonly.`, "computed");
    } else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set || (() => warn(`[Helix] 💥 Write operation failed: no setter provided.`, "computed"));
    }
    let value;
    let dirty = true;
    let hasError = false;
    let errorValue = null;
    const computedRef = {};
    const runner = effect(getter, {
        lazy: true,
        area: "computed",
        scheduler: () => {
            if (!dirty) {
                dirty = true;
                trigger(computedRef, "value");
            }
        }
    });
    Object.defineProperty(computedRef, "value", {
        get() {
            if (dirty) {
                try {
                    value = runner();
                    hasError = false;
                    errorValue = null;
                } catch (err) {
                    hasError = true;
                    errorValue = err;
                    handleError(err, "computed getter");
                }
                dirty = false;
            }
            if (hasError) throw errorValue;
            track(computedRef, "value");
            return value;
        },
        set(newValue) {
            setter(newValue);
            if (!dirty) {
                dirty = true;
                trigger(computedRef, "value");
            }
        }
    });
    computedRef[IS_REF] = true;
    return computedRef;
}
