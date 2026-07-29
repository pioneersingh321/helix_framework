import {
    activeScope,
    currentInstance,
    warn
} from '../shared/shared.js';

export function createBus() {
    const listeners = new Map();
    const onceWrappers = new WeakMap();

    const _emitError = (event, error, listener) => {
        const errorHandlers = listeners.get('bus:error');
        if (errorHandlers) {
            for (const fn of [...errorHandlers]) {
                try { fn({ event, error, listener }); } catch (_) { }
            }
        }
    };

    const bus = {
        on(event, handler) {
            if (typeof handler !== "function") {
                warn(`Bus handler for "${event}" must be a function.`, "event");
                return () => { };
            }
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);

            const cleanup = () => {
                const set = listeners.get(event);
                if (set) { set.delete(handler); if (set.size === 0) listeners.delete(event); }
            };

            if (activeScope && activeScope.active) {
                activeScope._busListeners.push(cleanup);
            }
            else if (currentInstance && currentInstance.cleanups) {
                currentInstance.cleanups.push(cleanup);
            }

            return cleanup;
        },
        off(event, handler) {
            const set = listeners.get(event);
            if (!set) return;
            const wrapped = onceWrappers.get(handler);
            set.delete(wrapped || handler);
            if (wrapped) onceWrappers.delete(handler);
            if (set.size === 0) listeners.delete(event);
        },
        once(event, handler) {
            const wrapped = (...args) => {
                bus.off(event, wrapped);
                onceWrappers.delete(handler);
                handler(...args);
            };
            onceWrappers.set(handler, wrapped);
            return bus.on(event, wrapped);
        },
        emit(event, ...args) {
            const set = listeners.get(event);
            if (!set) return;
            for (const fn of [...set]) {
                try { fn(...args); }
                catch (e) { _emitError(event, e, fn); }
            }
        },
        all() {
            const result = {};
            listeners.forEach((set, evt) => { result[evt] = set.size; });
            return result;
        },
        clear() { listeners.clear(); }
    };
    return bus;
}
