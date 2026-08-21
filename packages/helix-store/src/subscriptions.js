/**
 * @typedef {Object} MutationRecord
 * @property {'mutation' | 'patch' | 'transaction' | 'reset' | 'replace' | 'hydration' | 'history_restore'} type
 * @property {string} storeId
 * @property {number} timestamp
 * @property {any} [before]
 * @property {any} [after]
 * @property {string} [title]
 * @property {string} [key]
 * @property {any} [value]
 * @property {any} [oldValue]
 */
import { getPathValue } from './utils.js';

export function createSubscriptionManager(storeId) {
  const subscribers = new Set();
  const watchers = new Set();

  function subscribe(callback, options = {}) {
    subscribers.add(callback);
    const unsubscribe = () => {
      subscribers.delete(callback);
    };

    if (!options.detached && typeof Helix !== 'undefined' && typeof Helix.onScopeDispose === 'function') {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {}
    }

    return unsubscribe;
  }

  function notify(mutation, state) {
    subscribers.forEach(cb => {
      try {
        cb(mutation, state);
      } catch (err) {
        console.error(`[Helix:Store:Subscription] Error in subscriber for "${storeId}":`, err);
      }
    });
  }

  function watch(getterOrPath, callback, options = {}, storeContext) {
    if (typeof Helix === 'undefined' || !Helix.watch) {
      console.warn('[Helix:Store] Helix.watch is required for $watch.');
      return () => {};
    }

    const getter = typeof getterOrPath === 'string'
      ? () => getPathValue(storeContext || {}, getterOrPath)
      : (typeof getterOrPath === 'function' ? () => getterOrPath.call(storeContext, storeContext) : getterOrPath);

    const unwatch = Helix.watch(getter, callback, options);
    watchers.add(unwatch);

    const unsubscribe = () => {
      watchers.delete(unwatch);
      try { unwatch(); } catch (_) {}
    };

    if (!options.detached && typeof Helix.onScopeDispose === 'function') {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {}
    }

    return unsubscribe;
  }

  function select(selectorFn, storeState) {
    if (typeof Helix === 'undefined' || !Helix.computed) {
      return { value: selectorFn(storeState) };
    }
    return Helix.computed(() => selectorFn(storeState));
  }

  function clear() {
    subscribers.clear();
    watchers.forEach(unwatch => {
      try { unwatch(); } catch (_) {}
    });
    watchers.clear();
  }

  return {
    subscribe,
    notify,
    watch,
    select,
    clear
  };
}
