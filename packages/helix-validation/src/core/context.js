export const INSTALL_MARK = Symbol.for('helix.validate.installed');
export const emailRx = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Shared app & config context fallback pointer
export let activeContext = null;

export function setActiveContext(ctx) {
    activeContext = ctx;
}

// Global registry of all app contexts
export const appContexts = new WeakMap();

// Dynamic getter for the current context
export function getCurrentContext() {
    // 1. Try to get it from Helix.getCurrentInstance() if we are inside a component setup
    if (typeof window !== 'undefined' && window.Helix && typeof window.Helix.getCurrentInstance === 'function') {
        const inst = window.Helix.getCurrentInstance();
        if (inst && inst.provides && inst.provides['$validation']) {
            return inst.provides['$validation']._context;
        }
    }
    // 2. Fall back to the active/most-recently-installed context
    return activeContext;
}

// Single canonical getContextFromBinding helper
export function getContextFromBinding(binding) {
    if (binding && binding.instance && binding.instance.provides && binding.instance.provides['$validation']) {
        return binding.instance.provides['$validation']._context;
    }
    return getCurrentContext();
}

