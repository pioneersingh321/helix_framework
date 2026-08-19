import {
    currentInstance,
    handleError,
    warn
} from '../shared/shared.js';
import { queuePostFlushCb } from '../reactivity/scheduler.js';

export function getCurrentInstance() {
    return currentInstance;
}

export function onMounted(fn) {
    if (currentInstance) currentInstance.hooks.mount.push(fn);
}

export function onMount(fn) {
    warn(`[Helix] onMount is deprecated. Use onMounted instead.`, "config");
    return onMounted(fn);
}

export function onBeforeMount(fn) {
    if (currentInstance) currentInstance.hooks.beforeMount.push(fn);
}

export function onUnmounted(fn) {
    if (currentInstance) currentInstance.hooks.destroy.push(fn);
}

export function onDestroy(fn) {
    warn(`[Helix] onDestroy is deprecated. Use onUnmounted instead.`, "config");
    return onUnmounted(fn);
}

export function onBeforeUnmount(fn) {
    if (currentInstance) currentInstance.hooks.beforeUnmount.push(fn);
}

export function onUpdated(fn) {
    if (currentInstance) currentInstance.hooks.updated.push(fn);
}

export function queueComponentUpdated(instance) {
    if (!instance || !instance.hooks || !instance.hooks.updated || instance.hooks.updated.length === 0) return;
    if (!instance._isUpdatedQueued) {
        instance._isUpdatedQueued = true;
        queuePostFlushCb(() => {
            instance._isUpdatedQueued = false;
            if (instance && instance.hooks && instance.hooks.updated) {
                instance.hooks.updated.forEach((fn) => {
                    try {
                        fn();
                    } catch (e) {
                        handleError(e, "component onUpdated", instance);
                    }
                });
            }
        });
    }
}

export function provide(key, value) {
    if (!currentInstance) return;
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent ? currentInstance.parent.provides : null;
    if (provides === parentProvides) {
        provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
}

export function inject(key, defaultValue) {
    if (!currentInstance) return;
    const provides = currentInstance.provides;
    if (provides && key in provides) return provides[key];
    return defaultValue;
}

export function validateProp(name, value, def) {
    if (!def) return value;
    if (def.required && (value === void 0 || value === null)) {
        warn(`Prop "${name}" is required but was not provided.`, "prop");
        return value;
    }
    if (value === void 0 && def.hasOwnProperty("default")) {
        return typeof def.default === "function" ? def.default() : def.default;
    }
    if (value !== void 0 && def.type) {
        const types = Array.isArray(def.type) ? def.type : [def.type];
        const isValid = types.some((type) => {
            if (type === String) return typeof value === "string";
            if (type === Number) return typeof value === "number";
            if (type === Boolean) return typeof value === "boolean";
            if (type === Array) return Array.isArray(value);
            if (type === Object) return typeof value === "object" && value !== null && !Array.isArray(value);
            return value instanceof type;
        });
        if (!isValid) {
            warn(`Type mismatch for prop "${name}". Expected ${types.map((t) => t.name).join(" or ")} but got ${typeof value}.`, "prop");
        }
    }
    return value;
}

export function validateEmit(eventName, args, emitsDef) {
    if (!emitsDef) return true;
    const isArray = Array.isArray(emitsDef);
    const isDeclared = isArray ? emitsDef.includes(eventName) : emitsDef.hasOwnProperty(eventName);
    if (!isDeclared) {
        warn(`Component emitted event "${eventName}" but it is not declared in the emits option.`, "event");
        return false;
    }
    if (!isArray && typeof emitsDef[eventName] === "function") {
        const isValid = emitsDef[eventName](...args);
        if (!isValid) {
            warn(`Invalid payload for emitted event "${eventName}". Validator returned false.`, "event");
            return false;
        }
    }
    return true;
}
