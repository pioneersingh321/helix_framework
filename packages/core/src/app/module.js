import { reactive, toRaw } from '../reactivity/reactive.js';
import { warn, handleError, currentInstance, globalApps } from '../shared/shared.js';

/**
 * Global module definitions and singleton instances.
 */
export const globalModuleRegistry = new Map();
export const globalModuleInstances = new Map();

let defaultGlobalHelix = null;

export function setDefaultGlobalHelix(helix) {
    defaultGlobalHelix = helix;
}

/**
 * Helper to get the currently active or mounted Helix app.
 */
export function getActiveApp() {
    if (currentInstance && currentInstance.app) {
        return currentInstance.app;
    }
    const all = globalApps.all();
    if (all && all.length > 0) {
        return all[all.length - 1].app;
    }
    return null;
}

/**
 * Helper to get the global Helix object.
 */
export function getGlobalHelix() {
    if (defaultGlobalHelix) return defaultGlobalHelix;
    if (typeof window !== 'undefined' && window.Helix) return window.Helix;
    if (typeof globalThis !== 'undefined' && globalThis.Helix) return globalThis.Helix;
    return null;
}

/**
 * Deep clone helper for restoring initial state on $reset().
 */
function cloneValue(val) {
    if (val === null || typeof val !== 'object') return val;
    if (typeof val === 'function' || val.nodeType !== undefined) return val;
    if (Array.isArray(val)) {
        return val.map(cloneValue);
    }
    if (val instanceof Date) return new Date(val.getTime());
    if (val instanceof RegExp) return new RegExp(val.source, val.flags);
    if (val instanceof Set) {
        const s = new Set();
        val.forEach(v => s.add(cloneValue(v)));
        return s;
    }
    if (val instanceof Map) {
        const m = new Map();
        val.forEach((v, k) => m.set(k, cloneValue(v)));
        return m;
    }
    const copy = {};
    for (const key of Object.keys(val)) {
        copy[key] = cloneValue(val[key]);
    }
    return copy;
}

/**
 * Creates a rich module context proxy for factory functions.
 * Exposes core reactivity, app/global plugins ($fetch, $notify, $bus, etc.),
 * and the $app reference for parameter destructuring.
 * 
 * @param {object|null} app - Helix app instance
 * @returns {object} Module context proxy
 */
export function createModuleContext(app = null) {
    const target = Object.create(null);
    return new Proxy(target, {
        get(t, prop, receiver) {
            if (typeof prop !== 'string' || prop === 'then') return undefined;
            if (prop === '$app') {
                return app || getActiveApp() || getGlobalHelix() || null;
            }
            // 1. App-level properties & plugins
            const activeApp = app || getActiveApp();
            if (activeApp && prop in activeApp) {
                return activeApp[prop];
            }
            // 2. Global Helix properties & plugins
            const globalHelix = getGlobalHelix();
            if (globalHelix && prop in globalHelix) {
                return globalHelix[prop];
            }
            return undefined;
        },
        has(t, prop) {
            if (typeof prop !== 'string') return false;
            if (prop === '$app') return true;
            const activeApp = app || getActiveApp();
            if (activeApp && prop in activeApp) return true;
            const globalHelix = getGlobalHelix();
            if (globalHelix && prop in globalHelix) return true;
            return false;
        },
        ownKeys(t) {
            const keys = new Set(['$app']);
            const activeApp = app || getActiveApp();
            if (activeApp) {
                Reflect.ownKeys(activeApp).forEach(k => {
                    if (typeof k === 'string' && !k.startsWith('_')) keys.add(k);
                });
            }
            const globalHelix = getGlobalHelix();
            if (globalHelix) {
                Reflect.ownKeys(globalHelix).forEach(k => {
                    if (typeof k === 'string' && !k.startsWith('_')) keys.add(k);
                });
            }
            return Array.from(keys);
        },
        getOwnPropertyDescriptor(t, prop) {
            const activeApp = app || getActiveApp();
            if (activeApp && prop in activeApp) {
                return {
                    value: activeApp[prop],
                    writable: false,
                    enumerable: true,
                    configurable: true
                };
            }
            const globalHelix = getGlobalHelix();
            if (globalHelix && prop in globalHelix) {
                return {
                    value: globalHelix[prop],
                    writable: false,
                    enumerable: true,
                    configurable: true
                };
            }
            if (prop === '$app') {
                return {
                    value: app || getActiveApp() || getGlobalHelix() || null,
                    writable: false,
                    enumerable: true,
                    configurable: true
                };
            }
            return undefined;
        }
    });
}

/**
 * Creates a reactive module instance from a definition.
 * 
 * @param {string} name - Module name
 * @param {object|function} definition - Module definition object or factory function
 * @param {object|null} app - Helix app instance
 * @returns {object} Reactive module proxy
 */
export function createModuleInstance(name, definition, app = null) {
    let raw = definition;
    if (typeof definition === 'function') {
        try {
            raw = definition(createModuleContext(app));
        } catch (err) {
            handleError(err, `module factory: ${name}`);
            raw = {};
        }
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        warn(`Module "${name}" definition must be an object or a factory function returning an object.`, "module");
        raw = {};
    }

    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const initialState = {};
    const baseTarget = {};
    const methods = {};
    let mountedHook = null;
    let destroyHook = null;

    for (const [key, desc] of Object.entries(descriptors)) {
        if (key === 'mounted' && typeof desc.value === 'function') {
            mountedHook = desc.value;
            continue;
        }
        if ((key === 'destroy' || key === 'onDestroy' || key === 'unmounted') && typeof desc.value === 'function') {
            destroyHook = desc.value;
            continue;
        }

        if (desc.get || desc.set) {
            Object.defineProperty(baseTarget, key, {
                get: desc.get,
                set: desc.set,
                enumerable: true,
                configurable: true
            });
        } else if (typeof desc.value === 'function') {
            methods[key] = desc.value;
        } else {
            baseTarget[key] = desc.value;
            initialState[key] = cloneValue(toRaw(desc.value));
        }
    }

    let boundApp = app;

    // Attach non-enumerable metadata and $app reference
    Object.defineProperty(baseTarget, '$name', {
        value: name,
        writable: false,
        enumerable: false,
        configurable: true
    });

    Object.defineProperty(baseTarget, '$app', {
        get() {
            return boundApp || getActiveApp() || getGlobalHelix() || null;
        },
        set(newApp) {
            boundApp = newApp;
        },
        enumerable: false,
        configurable: true
    });

    // Provide fallback prototype delegation for plugins on `this` ($fetch, $notify, $bus, etc.)
    const moduleScopeProto = new Proxy(Object.create(null), {
        get(t, prop, receiver) {
            if (typeof prop !== 'string' || prop === 'then') return undefined;
            const activeApp = boundApp || getActiveApp();
            if (activeApp && prop in activeApp) {
                const val = activeApp[prop];
                return typeof val === 'function' ? val.bind(activeApp) : val;
            }
            const globalHelix = getGlobalHelix();
            if (globalHelix && prop in globalHelix) {
                const val = globalHelix[prop];
                return typeof val === 'function' ? val.bind(globalHelix) : val;
            }
            return undefined;
        },
        has(t, prop) {
            if (typeof prop !== 'string') return false;
            const activeApp = boundApp || getActiveApp();
            if (activeApp && prop in activeApp) return true;
            const globalHelix = getGlobalHelix();
            if (globalHelix && prop in globalHelix) return true;
            return false;
        }
    });

    Object.setPrototypeOf(baseTarget, moduleScopeProto);

    // Make baseTarget reactive
    const reactiveInstance = reactive(baseTarget);

    // Bind methods so `this` always points to reactiveInstance
    for (const [methodName, fn] of Object.entries(methods)) {
        baseTarget[methodName] = fn.bind(reactiveInstance);
    }

    // Provide $reset()
    Object.defineProperty(baseTarget, '$reset', {
        value: function $reset() {
            for (const [key, val] of Object.entries(initialState)) {
                reactiveInstance[key] = cloneValue(val);
            }
        },
        writable: true,
        enumerable: false,
        configurable: true
    });

    // Save lifecycle hooks non-enumerably
    if (mountedHook) {
        Object.defineProperty(baseTarget, '__hx_module_mounted', {
            value: mountedHook.bind(reactiveInstance),
            enumerable: false,
            configurable: true
        });
    }
    if (destroyHook) {
        Object.defineProperty(baseTarget, '__hx_module_destroy', {
            value: destroyHook.bind(reactiveInstance),
            enumerable: false,
            configurable: true
        });
    }

    return reactiveInstance;
}

/**
 * Checks if a global module definition or instance exists.
 */
export function hasGlobalModule(name) {
    if (typeof name !== 'string') return false;
    return globalModuleRegistry.has(name) || globalModuleInstances.has(name);
}

/**
 * Resolves or instantiates a global module singleton.
 */
export function getGlobalModule(name) {
    if (typeof name !== 'string') return undefined;
    if (globalModuleInstances.has(name)) {
        return globalModuleInstances.get(name);
    }
    if (globalModuleRegistry.has(name)) {
        const def = globalModuleRegistry.get(name);
        const inst = createModuleInstance(name, def, null);
        globalModuleInstances.set(name, inst);
        return inst;
    }
    return undefined;
}

/**
 * Registers or retrieves a global module.
 */
export function moduleGlobal(name, definition) {
    if (typeof name !== 'string') {
        warn('Module name must be a string.', 'module');
        return undefined;
    }

    if (definition !== undefined) {
        globalModuleRegistry.set(name, definition);
        // Create/update global singleton instance
        const inst = createModuleInstance(name, definition, null);
        globalModuleInstances.set(name, inst);
        return inst;
    }

    // Lookup: check if active app has an override first
    const activeApp = getActiveApp();
    if (activeApp && typeof activeApp.hasModule === 'function' && activeApp.hasModule(name)) {
        return activeApp.module(name);
    }

    return getGlobalModule(name);
}

/**
 * Creates a template-friendly $modules proxy for an app or global.
 */
export function createModulesProxy(app = null) {
    return new Proxy(Object.create(null), {
        get(target, prop) {
            if (typeof prop !== 'string' || prop === 'then') return undefined;
            if (app && typeof app.module === 'function') {
                return app.module(prop);
            }
            return getGlobalModule(prop);
        },
        has(target, prop) {
            if (typeof prop !== 'string') return false;
            if (app && typeof app.hasModule === 'function') {
                return app.hasModule(prop);
            }
            return hasGlobalModule(prop);
        }
    });
}
