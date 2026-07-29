import { registry } from './registry.js';
import { EventEmitter } from './events.js';

function createScopeProxy(name) {
    return {
        refresh(options) {
            const controllers = registry.get(name);
            if (controllers) {
                const promises = [];
                for (const ctrl of controllers) {
                    promises.push(ctrl.refresh(options));
                }
                return Promise.all(promises);
            }
            return Promise.resolve();
        },
        reset() {
            const controllers = registry.get(name);
            if (controllers) {
                for (const ctrl of controllers) {
                    ctrl.reset();
                }
            }
        },
        abort() {
            const controllers = registry.get(name);
            if (controllers) {
                for (const ctrl of controllers) {
                    ctrl.abort();
                }
            }
        },
        destroy() {
            const controllers = registry.get(name);
            if (controllers) {
                for (const ctrl of Array.from(controllers)) {
                    ctrl.destroy();
                }
            }
        },
        get state() {
            const controllers = registry.get(name);
            if (controllers && controllers.size > 0) {
                return Array.from(controllers)[0].state;
            }
            return undefined;
        },
        get loading() {
            const controllers = registry.get(name);
            if (controllers && controllers.size > 0) {
                return Array.from(controllers)[0].state.$loading;
            }
            return false;
        },
        get error() {
            const controllers = registry.get(name);
            if (controllers && controllers.size > 0) {
                return Array.from(controllers)[0].state.$error;
            }
            return null;
        },
        get data() {
            const controllers = registry.get(name);
            if (controllers && controllers.size > 0) {
                return Array.from(controllers)[0].state.$data;
            }
            return undefined;
        },
        get defaults() {
            const controllers = registry.get(name);
            if (controllers && controllers.size > 0) {
                return Array.from(controllers)[0].defaults;
            }
            return undefined;
        },
        get controllers() {
            const controllers = registry.get(name);
            return controllers ? Array.from(controllers) : [];
        }
    };
}

const ScopeManagerBase = function(name) {
    if (typeof name === 'string') {
        return createScopeProxy(name);
    }
};

ScopeManagerBase.on = function(event, callback) {
    return EventEmitter.on(event, callback);
};

ScopeManagerBase.off = function(event, callback) {
    EventEmitter.off(event, callback);
};

ScopeManagerBase.emit = function(event, data) {
    EventEmitter.emit(event, data);
};

ScopeManagerBase.refresh = async function(name, options) {
    let names = [];
    let opts = {};

    if (name === undefined) {
        names = Array.from(registry.keys());
    } else if (typeof name === 'string') {
        names = [name];
        if (options && typeof options === 'object') {
            opts = options;
        }
    } else if (Array.isArray(name)) {
        names = name;
        if (options && typeof options === 'object') {
            opts = options;
        }
    } else if (name && typeof name === 'object') {
        names = Array.from(registry.keys());
        opts = name;
    }

    const isParallel = opts.parallel !== false;

    if (isParallel) {
        const promises = [];
        for (const n of names) {
            const controllers = registry.get(n);
            if (controllers) {
                for (const ctrl of controllers) {
                    promises.push(ctrl.refresh(opts));
                }
            }
        }
        await Promise.all(promises);
    } else {
        for (const n of names) {
            const controllers = registry.get(n);
            if (controllers) {
                for (const ctrl of controllers) {
                    await ctrl.refresh(opts);
                }
            }
        }
    }
};

ScopeManagerBase.reset = function(name) {
    let names = [];
    if (name === undefined) {
        names = Array.from(registry.keys());
    } else if (typeof name === 'string') {
        names = [name];
    } else if (Array.isArray(name)) {
        names = name;
    }

    for (const n of names) {
        const controllers = registry.get(n);
        if (controllers) {
            for (const ctrl of controllers) {
                ctrl.reset();
            }
        }
    }
};

ScopeManagerBase.abort = function(name) {
    let names = [];
    if (name === undefined) {
        names = Array.from(registry.keys());
    } else if (typeof name === 'string') {
        names = [name];
    } else if (Array.isArray(name)) {
        names = name;
    }

    for (const n of names) {
        const controllers = registry.get(n);
        if (controllers) {
            for (const ctrl of controllers) {
                ctrl.abort();
            }
        }
    }
};

ScopeManagerBase.destroy = function() {
    for (const controllers of registry.values()) {
        for (const ctrl of Array.from(controllers)) {
            ctrl.destroy();
        }
    }
    registry.clear();

    const root = (typeof window !== 'undefined' ? window : globalThis);
    if (root.Helix) {
        if (root.Helix.scope) delete root.Helix.scope;
        if (root.Helix.$scope) delete root.Helix.$scope;
    }
};

ScopeManagerBase.get = function(name) {
    const controllers = registry.get(name);
    return controllers ? Array.from(controllers) : [];
};

ScopeManagerBase.first = function(name) {
    const controllers = registry.get(name);
    if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0];
    }
    return null;
};

ScopeManagerBase.has = function(name) {
    return registry.has(name) && registry.get(name).size > 0;
};

ScopeManagerBase.config = {
    deepMerge: false,
    arrayStrategy: 'replace',
    backoff: true,
    retryDelay: 1000,
    resetOnRefresh: false
};

ScopeManagerBase.list = function() {
    return Array.from(registry.keys());
};


export const ScopeManager = new Proxy(ScopeManagerBase, {
    get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        }

        if (typeof prop === 'symbol' || prop.startsWith('_') || prop === 'then') {
            return Reflect.get(target, prop, receiver);
        }

        return createScopeProxy(prop);
    }
});
