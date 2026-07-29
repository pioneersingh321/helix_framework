import { ControllerRegistry } from '../../core/src/registry.js';

export const coreRegistry = new ControllerRegistry();

// Keep same API and variable exports so other files work unchanged
export const registry = coreRegistry.registry;

export function registerController(name, controller) {
    coreRegistry.register(name, controller);
}

export function unregisterController(name, controller) {
    coreRegistry.unregister(name, controller);
}
