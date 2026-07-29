import { resolveMsg } from '../shared/utils.js';

export const _registry = new Map();

const onAddListeners = new Set();
const onRemoveListeners = new Set();

export const rules = {
    add(name, fn, meta) {
        if (fn && typeof fn === 'object' && typeof fn.validate === 'function') {
            const validateFn = fn.validate;
            const messageTemplate = fn.message;
            const priority = fn.priority || 1;
            const factory = (...args) => {
                const innerRule = (v, ctx) => {
                    const res = validateFn(v, ...args);
                    if (res === true || res === null || res === undefined) return null;
                    if (res === false) {
                        let msg = messageTemplate || 'Invalid value.';
                        if (args.length > 1 && !msg.includes('{1}')) {
                            msg = msg.replace(/\{0\}/g, args.join(', '));
                        } else {
                            args.forEach((arg, idx) => {
                                msg = msg.replace(new RegExp(`\\{${idx}\\}`, 'g'), arg);
                            });
                        }
                        return msg;
                    }
                    return res;
                };
                innerRule.meta = { name, priority, params: {} };
                innerRule._ruleName = name;
                innerRule._priority = priority;
                return innerRule;
            };
            factory._isRuleFactory = true;
            fn = factory;
        }

        if (typeof name !== 'string' || typeof fn !== 'function') return;
        if (!fn.meta) fn.meta = {};
        if (!fn.meta.name) fn.meta.name = name;
        if (!fn._ruleName) fn._ruleName = name;
        _registry.set(name, { fn, priority: (meta && meta.priority) || fn.meta.priority || 1 });
        onAddListeners.forEach(cb => { try { cb(name, fn, meta); } catch (_) {} });
    },
    remove(name) {
        _registry.delete(name);
        onRemoveListeners.forEach(cb => { try { cb(name); } catch (_) {} });
    },
    get(name) {
        return _registry.get(name) || null;
    },
    has(name) {
        return _registry.has(name);
    },
    list() {
        return Array.from(_registry.keys());
    },
    onAdd(cb) {
        if (typeof cb === 'function') onAddListeners.add(cb);
        return () => onAddListeners.delete(cb);
    },
    onRemove(cb) {
        if (typeof cb === 'function') onRemoveListeners.add(cb);
        return () => onRemoveListeners.delete(cb);
    }
};
