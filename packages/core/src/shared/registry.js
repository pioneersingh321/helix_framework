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

export class AppRegistry {
    constructor() {
        this._bySelector = new Map();
        this._byElement = new Map();
        this._byId = new Map();
        this._entries = new Set();
    }

    register(selector, element, instance, app) {
        const entry = {
            selector: typeof selector === 'string' ? selector : null,
            element,
            rootElement: element,
            instance,
            app,
            id: instance ? instance.id : null,
            mountedAt: Date.now()
        };
        this._entries.add(entry);
        if (typeof selector === 'string') {
            this._bySelector.set(selector, entry);
        }
        if (element) {
            this._byElement.set(element, entry);
        }
        if (instance && instance.id) {
            this._byId.set(instance.id, entry);
        }
        return entry;
    }

    unregister(selector, element, instance) {
        let targetEntry = null;
        if (instance && this._byId.has(instance.id)) {
            targetEntry = this._byId.get(instance.id);
        } else if (element && this._byElement.has(element)) {
            targetEntry = this._byElement.get(element);
        } else if (typeof selector === 'string' && this._bySelector.has(selector)) {
            targetEntry = this._bySelector.get(selector);
        }
        if (targetEntry) {
            this._entries.delete(targetEntry);
            if (targetEntry.selector) this._bySelector.delete(targetEntry.selector);
            if (targetEntry.element) this._byElement.delete(targetEntry.element);
            if (targetEntry.id) this._byId.delete(targetEntry.id);
        }
    }

    get(key) {
        if (typeof key === 'string') {
            return this._bySelector.get(key) || null;
        }
        if (typeof key === 'number') {
            return this._byId.get(key) || null;
        }
        if (key && key.nodeType === 1) {
            return this._byElement.get(key) || null;
        }
        return null;
    }

    has(key) {
        return this.get(key) !== null;
    }

    list() {
        return Array.from(this._entries);
    }

    all() {
        return Array.from(this._entries);
    }

    values() {
        return this._entries.values();
    }

    keys() {
        return this._bySelector.keys();
    }

    entries() {
        return Array.from(this._entries).map((e) => [e.selector || e.id, e]);
    }

    forEach(callback, thisArg) {
        this._entries.forEach((entry) => {
            callback.call(thisArg, entry, entry.selector || entry.id, this);
        });
    }

    get size() {
        return this._entries.size;
    }

    clear() {
        this._bySelector.clear();
        this._byElement.clear();
        this._byId.clear();
        this._entries.clear();
    }

    [Symbol.iterator]() {
        return this._entries[Symbol.iterator]();
    }
}

export const globalApps = new AppRegistry();
