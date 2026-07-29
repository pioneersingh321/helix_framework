import { IS_REF, handleError } from '../shared/shared.js';
import { track, trigger, effect } from './effect.js';

export function memo(fn, depsOrKeyFn) {
    if (typeof fn !== "function") {
        throw new TypeError("[Helix.memo] First argument must be a function.");
    }

    let value;
    let dirty = true;
    let lastKeys = null;
    const memoRef = {};

    const evaluateKeys = () => {
        if (typeof depsOrKeyFn === "function") {
            try { return depsOrKeyFn(); } catch (e) { return null; }
        }
        if (Array.isArray(depsOrKeyFn)) {
            return depsOrKeyFn;
        }
        return null;
    };

    const keysChanged = (newKeys) => {
        if (!newKeys || !lastKeys) return true;
        if (Array.isArray(newKeys) && Array.isArray(lastKeys)) {
            if (newKeys.length !== lastKeys.length) return true;
            for (let i = 0; i < newKeys.length; i++) {
                if (newKeys[i] !== lastKeys[i]) return true;
            }
            return false;
        }
        return newKeys !== lastKeys;
    };

    const runner = effect(fn, {
        lazy: true,
        area: "memo",
        scheduler: () => {
            if (!dirty) {
                dirty = true;
                trigger(memoRef, "value");
            }
        }
    });

    Object.defineProperty(memoRef, "value", {
        get() {
            const currentKeys = evaluateKeys();
            if (dirty || keysChanged(currentKeys)) {
                try {
                    value = runner();
                    lastKeys = currentKeys;
                } catch (err) {
                    handleError(err, "memo getter");
                }
                dirty = false;
            }
            track(memoRef, "value");
            return value;
        }
    });

    memoRef[IS_REF] = true;
    return memoRef;
}
