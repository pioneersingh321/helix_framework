/**
 * Store Instance Factory
 * Implements unified dynamic Proxy, deep mutation bridge, EffectScope disposal,
 * true state key deletion on replacement, and decoupled mutation dispatch.
 */
import { isObject, isFunction, deepClone, deepEqual, validateStoreKeys } from './utils.js';
import { createTransactionManager } from './transactions.js';
import { createStoreEventBus } from './events.js';
import { createAsyncStateManager } from './async-state.js';
import { createHistoryManager } from './history.js';
import { createSubscriptionManager } from './subscriptions.js';
import { setupPersistence } from './persistence.js';

export function createStoreInstance(storeId, definition, appContext, onDisposeCallback) {
  let disposed = false;
  let isHydrating = false;
  const isSetupStore = isFunction(definition);
  let rawInitialState = {};
  let actions = {};
  let getters = {};
  let persistConfig = null;
  let historyConfig = null;

  // Extract components from Options Store
  if (!isSetupStore && isObject(definition)) {
    if (isFunction(definition.state)) {
      rawInitialState = definition.state();
    } else if (isObject(definition.state)) {
      rawInitialState = definition.state;
    }
    actions = definition.actions || {};
    getters = definition.getters || {};
    persistConfig = definition.persist || null;
    historyConfig = definition.history || null;
  }

  const stateKeyList = Object.keys(rawInitialState);
  const getterKeyList = Object.keys(getters);
  const actionKeyList = Object.keys(actions);
  validateStoreKeys(storeId, stateKeyList, getterKeyList, actionKeyList);

  // 1. Reactive State Core
  const reactiveFn = (typeof Helix !== 'undefined' && Helix.reactive) ? Helix.reactive : (obj => obj);
  const state = reactiveFn(deepClone(rawInitialState));

  // 2. Lifecycle Scope
  const effectScope = (typeof Helix !== 'undefined' && Helix.effectScope) ? Helix.effectScope() : null;

  // 3. Subsystem Managers
  const subscriptionManager = createSubscriptionManager(storeId);
  const eventBus = createStoreEventBus();
  const asyncManager = createAsyncStateManager(reactiveFn);

  let previousSnapshot = deepClone(rawInitialState);
  let persistenceAdapter = { save: () => {}, flush: () => {}, remove: () => {}, ready: Promise.resolve() };

  const setupStateKeys = new Set(stateKeyList);
  const setupGetterKeys = new Set(getterKeyList);
  const setupActionKeys = new Set(actionKeyList);
  const computedGetters = new Map();
  const wrappedActions = new Map();

  // Forward declaration of storeProxy to allow reference within action/getter closures
  let storeProxy;

  // Single Authoritative State Replacement Primitive
  function replaceState(newState) {
    if (!isObject(newState)) return;

    // True Property Deletion: delete keys not present in newState
    Object.keys(state).forEach(k => {
      if (!(k in newState)) {
        delete state[k];
        setupStateKeys.delete(k);
      }
    });

    // Assign all keys from newState with deep clone
    Object.keys(newState).forEach(k => {
      setupStateKeys.add(k);
      state[k] = deepClone(newState[k]);
    });
  }

  // 4. Deterministic History Manager (Opt-in / Lazy)
  const historyManager = createHistoryManager(
    historyConfig,
    (restoredState) => {
      // Replaces state cleanly on undo/redo with true deletion
      replaceState(restoredState);
      previousSnapshot = deepClone(state);
      dispatchMutation({
        type: 'history_restore',
        storeId,
        timestamp: Date.now(),
        after: previousSnapshot
      });
    }
  );

  // 5. Decoupled Mutation Dispatch Pipeline
  function dispatchMutation(mutationRecord) {
    subscriptionManager.notify(mutationRecord, state);
    if (!isHydrating) {
      persistenceAdapter.save(state);
    }
  }

  // 6. Transaction Manager
  const transactionManager = createTransactionManager(
    storeId,
    () => state,
    (record) => {
      previousSnapshot = deepClone(state);
      dispatchMutation(record);
    },
    (entry) => {
      if (!isHydrating) {
        historyManager.record(entry);
      }
    }
  );

  // 7. Deep Mutation Bridge (Authoritative tracking for top-level, nested, array, and $patch mutations)
  let stopMutationWatcher = null;
  function initMutationBridge() {
    if (typeof Helix !== 'undefined' && Helix.watch) {
      stopMutationWatcher = Helix.watch(
        () => state,
        () => {
          if (disposed) return;
          if (transactionManager.isInTransaction()) return;
          if (historyManager.isPerformingUndoRedo()) return;

          // Exclude Persistence Hydration from History
          if (isHydrating) {
            previousSnapshot = deepClone(state);
            return;
          }

          const shouldSnapshot = historyManager.isEnabled();
          const currentSnapshot = shouldSnapshot ? deepClone(state) : state;

          const mutationRecord = {
            type: 'mutation',
            storeId,
            timestamp: Date.now(),
            before: shouldSnapshot ? previousSnapshot : undefined,
            after: shouldSnapshot ? currentSnapshot : undefined
          };

          if (shouldSnapshot) {
            if (!deepEqual(previousSnapshot, currentSnapshot)) {
              historyManager.record({
                title: 'Mutation',
                before: previousSnapshot,
                after: currentSnapshot
              });
              previousSnapshot = currentSnapshot;
            }
          }

          dispatchMutation(mutationRecord);
        },
        { deep: true, flush: 'sync' }
      );
    }
  }

  if (effectScope) {
    effectScope.run(() => {
      initMutationBridge();
    });
  } else {
    initMutationBridge();
  }

  // 8. Core Methods ($patch, $reset, $state, $readonly, $dispose, $snapshot, $restore)
  function patch(patchObjOrFn) {
    transactionManager.runTransaction(() => {
      if (isFunction(patchObjOrFn)) {
        patchObjOrFn(state);
      } else if (isObject(patchObjOrFn)) {
        Object.keys(patchObjOrFn).forEach(key => {
          setupStateKeys.add(key);
          state[key] = patchObjOrFn[key];
        });
      }
    }, 'Patch State');
  }

  function reset() {
    transactionManager.runTransaction(() => {
      replaceState(deepClone(rawInitialState));
    }, 'Reset State');
  }

  function replace(newState) {
    transactionManager.runTransaction(() => {
      replaceState(deepClone(newState));
    }, 'Replace State');
  }

  function snapshot() {
    return deepClone(state);
  }

  function restore(snap) {
    if (!isObject(snap)) return;
    transactionManager.runTransaction(() => {
      replaceState(deepClone(snap));
    }, 'Restore Snapshot');
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    // 1. Flush any pending debounced persistence writes
    if (persistenceAdapter && typeof persistenceAdapter.flush === 'function') {
      try { persistenceAdapter.flush(); } catch (_) {}
    }

    // 2. Stop mutation watcher
    if (stopMutationWatcher) {
      try { stopMutationWatcher(); } catch (_) {}
    }

    // 3. Stop EffectScope (stops all computed getters and internal effect watchers)
    if (effectScope) {
      try { effectScope.stop(); } catch (_) {}
    }

    // 4. Clear all subsystem managers
    subscriptionManager.clear();
    eventBus.clear();
    asyncManager.clear();
    historyManager.clear();

    if (onDisposeCallback) {
      onDisposeCallback();
    }
  }

  // Internal store methods/properties dictionary
  const internalMembers = {
    $id: storeId,
    get $disposed() { return disposed; },
    get $ready() {
      return persistenceAdapter && persistenceAdapter.ready
        ? persistenceAdapter.ready.then(() => storeProxy)
        : Promise.resolve(storeProxy);
    },
    get $state() { return state; },
    set $state(newState) { replace(newState); },
    get $readonly() {
      if (typeof Helix !== 'undefined' && Helix.readonly) {
        return Helix.readonly(state);
      }
      return deepClone(state);
    },
    $patch: patch,
    $reset: reset,
    $snapshot: snapshot,
    $restore: restore,
    $dispose: dispose,
    $subscribe: (cb, opts) => subscriptionManager.subscribe(cb, opts),
    $watch: (getter, cb, opts) => subscriptionManager.watch(getter, cb, opts, storeProxy),
    $select: (selectorFn) => subscriptionManager.select(selectorFn, state),
    $transaction: (fn, title) => transactionManager.runTransaction(fn, title),
    $emit: eventBus.emit,
    $on: eventBus.on,
    $off: eventBus.off,
    $undo: historyManager.undo,
    $redo: historyManager.redo,
    get $canUndo() { return historyManager.getCanUndo(); },
    get $canRedo() { return historyManager.getCanRedo(); },
    get $loading() { return asyncManager.loading; },
    get $errors() { return asyncManager.errors; },
    get $signal() { return asyncManager.getSignal(); },
    $cancel: asyncManager.cancel,
    _stateKeys: setupStateKeys,
    _getterKeys: setupGetterKeys,
    _actionKeys: setupActionKeys
  };

  // 9. Dynamic Store Proxy
  storeProxy = new Proxy(internalMembers, {
    get(target, prop) {
      if (typeof prop === 'symbol') return target[prop];

      // 1. Internal methods and $-prefixed properties
      if (prop in target) {
        return target[prop];
      }

      // 2. Computed Getters
      if (computedGetters.has(prop)) {
        return computedGetters.get(prop).value;
      }

      // 3. Actions (bound to storeProxy)
      if (wrappedActions.has(prop)) {
        return wrappedActions.get(prop);
      }

      // 4. Reactive State Properties (including dynamic properties)
      return state[prop];
    },

    set(target, prop, value) {
      if (disposed) {
        console.warn(`[Helix:Store] Attempted to mutate property "${String(prop)}" on disposed store "${storeId}".`);
        return true;
      }

      if (prop === '$state') {
        replace(value);
        return true;
      }

      if (computedGetters.has(prop)) {
        console.error(`[Helix:Store] Cannot assign to computed getter "${String(prop)}" on store "${storeId}".`);
        return false;
      }

      setupStateKeys.add(prop);
      state[prop] = value;
      return true;
    },

    has(target, prop) {
      return (prop in target) || computedGetters.has(prop) || wrappedActions.has(prop) || (prop in state);
    },

    ownKeys() {
      const keys = new Set([
        ...Object.keys(internalMembers),
        ...computedGetters.keys(),
        ...wrappedActions.keys(),
        ...Object.keys(state)
      ]);
      return Array.from(keys);
    },

    getOwnPropertyDescriptor(target, prop) {
      if (prop in target) {
        return Object.getOwnPropertyDescriptor(target, prop);
      }
      if (computedGetters.has(prop)) {
        return {
          get: () => computedGetters.get(prop).value,
          enumerable: true,
          configurable: true
        };
      }
      if (wrappedActions.has(prop)) {
        return {
          value: wrappedActions.get(prop),
          enumerable: true,
          configurable: true,
          writable: true
        };
      }
      if (prop in state) {
        return Object.getOwnPropertyDescriptor(state, prop);
      }
      return undefined;
    }
  });

  // 10. Computed Getters Map (Instantiated with storeProxy)
  getterKeyList.forEach(key => {
    if (typeof Helix !== 'undefined' && Helix.computed) {
      if (effectScope) {
        effectScope.run(() => {
          computedGetters.set(key, Helix.computed(() => getters[key].call(storeProxy, state)));
        });
      } else {
        computedGetters.set(key, Helix.computed(() => getters[key].call(storeProxy, state)));
      }
    } else {
      computedGetters.set(key, { value: getters[key].call(storeProxy, state) });
    }
  });

  // 11. Actions Map (Single Wrapping Pass with storeProxy)
  actionKeyList.forEach(key => {
    wrappedActions.set(key, asyncManager.wrapAction(key, actions[key], storeProxy));
  });

  // 12. Setup Store Evaluation (if functional setup)
  if (isSetupStore) {
    let setupResult = {};
    if (effectScope) {
      effectScope.run(() => {
        setupResult = definition(appContext) || {};
      });
    } else {
      setupResult = definition(appContext) || {};
    }

    Object.keys(setupResult).forEach(key => {
      const val = setupResult[key];
      if (isFunction(val)) {
        setupActionKeys.add(key);
        wrappedActions.set(key, asyncManager.wrapAction(key, val, storeProxy));
      } else if (typeof Helix !== 'undefined' && Helix.isRef && Helix.isRef(val)) {
        setupGetterKeys.add(key);
        computedGetters.set(key, val);
      } else {
        setupStateKeys.add(key);
        state[key] = val;
      }
    });
  }

  // 13. Persistence Hydration Integration
  if (persistConfig) {
    const hydrationPatcher = (hydratedData) => {
      isHydrating = true;
      try {
        patch(hydratedData);
      } finally {
        isHydrating = false;
        previousSnapshot = deepClone(state);
      }
    };
    persistenceAdapter = setupPersistence(storeId, persistConfig, state, hydrationPatcher);
  }

  return storeProxy;
}
