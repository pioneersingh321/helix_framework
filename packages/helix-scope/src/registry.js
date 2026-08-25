export class ControllerRegistry {
    constructor() {
        this.registry = new Map();
    }
    register(name, controller) {
        this.registry.set(name, controller);
    }
    unregister(name) {
        this.registry.delete(name);
    }
}

export const coreRegistry = new ControllerRegistry();

// Keep same API and variable exports so other files work unchanged
export const registry = coreRegistry.registry;

export function registerController(name, controller) {
    coreRegistry.register(name, controller);
}

export function unregisterController(name, controller) {
    coreRegistry.unregister(name, controller);
}
