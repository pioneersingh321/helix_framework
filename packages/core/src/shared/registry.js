export class ControllerRegistry {
    constructor() {
        this.registry = new Map();
    }

    register(name, controller) {
        if (!this.registry.has(name)) {
            this.registry.set(name, new Set());
        }
        this.registry.get(name).add(controller);
    }

    unregister(name, controller) {
        const controllers = this.registry.get(name);
        if (controllers) {
            controllers.delete(controller);
            if (controllers.size === 0) {
                this.registry.delete(name);
            }
        }
    }

    get(name) {
        return this.registry.get(name);
    }

    has(name) {
        return this.registry.has(name);
    }

    keys() {
        return this.registry.keys();
    }

    values() {
        return this.registry.values();
    }

    clear() {
        this.registry.clear();
    }
}
