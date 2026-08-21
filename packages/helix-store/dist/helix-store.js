(function(exports) {
  "use strict";
  function isObject(val) {
    return val !== null && typeof val === "object";
  }
  function isFunction(val) {
    return typeof val === "function";
  }
  function isPromise(val) {
    return isObject(val) && isFunction(val.then);
  }
  function deepClone(obj) {
    if (obj === null || typeof obj !== "object")
      return obj;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(obj);
      } catch (_) {
      }
    }
    if (Array.isArray(obj))
      return obj.map(deepClone);
    if (obj instanceof Date)
      return new Date(obj.getTime());
    if (obj instanceof RegExp)
      return new RegExp(obj);
    if (obj instanceof Set)
      return new Set(Array.from(obj, deepClone));
    if (obj instanceof Map) {
      const map = /* @__PURE__ */ new Map();
      obj.forEach((v, k) => map.set(deepClone(k), deepClone(v)));
      return map;
    }
    const clone = {};
    for (const key of Object.keys(obj)) {
      clone[key] = deepClone(obj[key]);
    }
    return clone;
  }
  function getPathValue(obj, path) {
    if (!obj || !path)
      return void 0;
    const parts = Array.isArray(path) ? path : path.split(".");
    let curr = obj;
    for (const part of parts) {
      if (curr === null || curr === void 0)
        return void 0;
      curr = curr[part];
    }
    return curr;
  }
  function setPathValue(obj, path, value) {
    if (!obj || !path)
      return;
    const parts = Array.isArray(path) ? path : path.split(".");
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in curr) || !isObject(curr[part])) {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }
  function deepEqual(a, b) {
    if (a === b)
      return true;
    if (a === null || typeof a !== "object" || b === null || typeof b !== "object") {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
      return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  const RESERVED_STORE_KEYS = /* @__PURE__ */ new Set([
    "$id",
    "$state",
    "$readonly",
    "$patch",
    "$reset",
    "$snapshot",
    "$restore",
    "$dispose",
    "$disposed",
    "$subscribe",
    "$watch",
    "$select",
    "$transaction",
    "$emit",
    "$on",
    "$off",
    "$undo",
    "$redo",
    "$canUndo",
    "$canRedo",
    "$loading",
    "$errors",
    "$cancel",
    "_stateKeys",
    "_getterKeys",
    "_actionKeys"
  ]);
  function validateStoreKeys(storeId, stateKeys, getterKeys, actionKeys) {
    const allKeys = [...stateKeys, ...getterKeys, ...actionKeys];
    for (const key of allKeys) {
      if (RESERVED_STORE_KEYS.has(key)) {
        throw new Error(`[Helix:Store] Store "${storeId}" cannot define reserved key "${key}".`);
      }
    }
    for (const k of stateKeys) {
      if (actionKeys.includes(k)) {
        throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and an action in store "${storeId}".`);
      }
      if (getterKeys.includes(k)) {
        throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and a getter in store "${storeId}".`);
      }
    }
  }
  function createTransactionManager(storeId, getStateFn, notifySubscribers, recordHistory) {
    let transactionDepth = 0;
    let currentTransactionTitle = null;
    let rootBeforeSnapshot = null;
    function runTransaction(fn, title = "Transaction") {
      if (transactionDepth > 0) {
        return fn();
      }
      transactionDepth = 1;
      currentTransactionTitle = title;
      rootBeforeSnapshot = deepClone(getStateFn());
      try {
        const result = fn();
        return result;
      } finally {
        const afterSnapshot = deepClone(getStateFn());
        transactionDepth = 0;
        const hasChanged = !deepEqual(rootBeforeSnapshot, afterSnapshot);
        if (hasChanged) {
          const aggregatedMutation = {
            type: "transaction",
            storeId,
            title: currentTransactionTitle,
            timestamp: Date.now(),
            before: rootBeforeSnapshot,
            after: afterSnapshot
          };
          if (recordHistory) {
            recordHistory({
              title: currentTransactionTitle,
              before: rootBeforeSnapshot,
              after: afterSnapshot
            });
          }
          if (notifySubscribers) {
            notifySubscribers(aggregatedMutation);
          }
        }
        rootBeforeSnapshot = null;
        currentTransactionTitle = null;
      }
    }
    function isInTransaction() {
      return transactionDepth > 0;
    }
    return {
      runTransaction,
      isInTransaction
    };
  }
  function createStoreEventBus() {
    const listeners = /* @__PURE__ */ new Map();
    function on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, /* @__PURE__ */ new Set());
      }
      listeners.get(event).add(handler);
      const unsubscribe = () => off(event, handler);
      if (typeof Helix !== "undefined" && typeof Helix.onScopeDispose === "function") {
        try {
          Helix.onScopeDispose(unsubscribe);
        } catch (_) {
        }
      }
      return unsubscribe;
    }
    function off(event, handler) {
      if (!listeners.has(event))
        return;
      if (!handler) {
        listeners.delete(event);
      } else {
        listeners.get(event).delete(handler);
        if (listeners.get(event).size === 0) {
          listeners.delete(event);
        }
      }
    }
    function emit(event, ...payload) {
      if (!listeners.has(event))
        return;
      listeners.get(event).forEach((handler) => {
        try {
          handler(...payload);
        } catch (err) {
          console.error(`[Helix:Store:Event] Error in handler for "${event}":`, err);
        }
      });
    }
    function clear() {
      listeners.clear();
    }
    return { on, off, emit, clear };
  }
  function createAsyncStateManager(reactiveFn) {
    const loading = reactiveFn({});
    const errors = reactiveFn({});
    const abortControllers = /* @__PURE__ */ new Map();
    const callCounters = /* @__PURE__ */ new Map();
    let currentActiveAction = null;
    function wrapAction(actionName, actionFn, storeContext) {
      return function(...args) {
        if (abortControllers.has(actionName)) {
          try {
            abortControllers.get(actionName).abort();
          } catch (_) {
          }
        }
        const controller = new AbortController();
        abortControllers.set(actionName, controller);
        const currentCallId = (callCounters.get(actionName) || 0) + 1;
        callCounters.set(actionName, currentCallId);
        const normalizedArgs = [...args];
        const lastArg = normalizedArgs[normalizedArgs.length - 1];
        if (lastArg && typeof lastArg === "object" && !Array.isArray(lastArg)) {
          if (!("signal" in lastArg)) {
            lastArg.signal = controller.signal;
          }
        } else if (actionFn.length > normalizedArgs.length) {
          normalizedArgs.push({ signal: controller.signal });
        }
        currentActiveAction = actionName;
        let result;
        try {
          result = actionFn.apply(storeContext, normalizedArgs);
        } catch (syncErr) {
          if (callCounters.get(actionName) === currentCallId) {
            abortControllers.delete(actionName);
          }
          throw syncErr;
        } finally {
          currentActiveAction = null;
        }
        if (!isPromise(result)) {
          if (callCounters.get(actionName) === currentCallId) {
            abortControllers.delete(actionName);
          }
          return result;
        }
        loading[actionName] = true;
        errors[actionName] = null;
        return result.then((value) => {
          if (callCounters.get(actionName) === currentCallId) {
            loading[actionName] = false;
            abortControllers.delete(actionName);
          }
          return value;
        }).catch((err) => {
          var _a;
          if (callCounters.get(actionName) === currentCallId) {
            loading[actionName] = false;
            abortControllers.delete(actionName);
            const isAbort = (err == null ? void 0 : err.name) === "AbortError" || (err == null ? void 0 : err.code) === 20 || ((_a = err == null ? void 0 : err.message) == null ? void 0 : _a.includes("aborted"));
            if (!isAbort) {
              errors[actionName] = (err == null ? void 0 : err.message) || String(err);
              throw err;
            }
          }
          return void 0;
        });
      };
    }
    function getSignal(actionName) {
      const targetAction = actionName || currentActiveAction;
      if (targetAction && abortControllers.has(targetAction)) {
        return abortControllers.get(targetAction).signal;
      }
      return void 0;
    }
    function cancel(actionName) {
      const controller = abortControllers.get(actionName);
      if (controller) {
        try {
          controller.abort();
        } catch (_) {
        }
      }
    }
    function clear() {
      abortControllers.forEach((ctrl) => {
        try {
          ctrl.abort();
        } catch (_) {
        }
      });
      abortControllers.clear();
      callCounters.clear();
      currentActiveAction = null;
    }
    return {
      loading,
      errors,
      wrapAction,
      getSignal,
      cancel,
      clear
    };
  }
  function createHistoryManager(historyConfig, restoreStateFn) {
    const isEnabled = historyConfig === true || typeof historyConfig === "object" && historyConfig !== null && historyConfig.enabled !== false;
    const maxHistory = typeof historyConfig === "object" && (historyConfig == null ? void 0 : historyConfig.max) ? historyConfig.max : 50;
    let undoStack = [];
    let redoStack = [];
    let isPerformingUndoRedo = false;
    function record({ title = "Action", before, after }) {
      if (!isEnabled || isPerformingUndoRedo)
        return;
      undoStack.push({
        title,
        before: deepClone(before),
        after: deepClone(after),
        timestamp: Date.now()
      });
      if (undoStack.length > maxHistory) {
        undoStack.shift();
      }
      redoStack = [];
    }
    function undo() {
      if (!isEnabled || undoStack.length === 0)
        return false;
      isPerformingUndoRedo = true;
      try {
        const entry = undoStack.pop();
        redoStack.push(entry);
        restoreStateFn(deepClone(entry.before));
        return true;
      } finally {
        isPerformingUndoRedo = false;
      }
    }
    function redo() {
      if (!isEnabled || redoStack.length === 0)
        return false;
      isPerformingUndoRedo = true;
      try {
        const entry = redoStack.pop();
        undoStack.push(entry);
        restoreStateFn(deepClone(entry.after));
        return true;
      } finally {
        isPerformingUndoRedo = false;
      }
    }
    function getCanUndo() {
      return isEnabled && undoStack.length > 0;
    }
    function getCanRedo() {
      return isEnabled && redoStack.length > 0;
    }
    function clear() {
      undoStack = [];
      redoStack = [];
    }
    return {
      record,
      undo,
      redo,
      getCanUndo,
      getCanRedo,
      clear,
      isEnabled: () => isEnabled,
      isPerformingUndoRedo: () => isPerformingUndoRedo
    };
  }
  function createSubscriptionManager(storeId) {
    const subscribers = /* @__PURE__ */ new Set();
    const watchers = /* @__PURE__ */ new Set();
    function subscribe(callback, options = {}) {
      subscribers.add(callback);
      const unsubscribe = () => {
        subscribers.delete(callback);
      };
      if (!options.detached && typeof Helix !== "undefined" && typeof Helix.onScopeDispose === "function") {
        try {
          Helix.onScopeDispose(unsubscribe);
        } catch (_) {
        }
      }
      return unsubscribe;
    }
    function notify(mutation, state) {
      subscribers.forEach((cb) => {
        try {
          cb(mutation, state);
        } catch (err) {
          console.error(`[Helix:Store:Subscription] Error in subscriber for "${storeId}":`, err);
        }
      });
    }
    function watch(getterOrPath, callback, options = {}, storeContext) {
      if (typeof Helix === "undefined" || !Helix.watch) {
        console.warn("[Helix:Store] Helix.watch is required for $watch.");
        return () => {
        };
      }
      const getter = typeof getterOrPath === "string" ? () => getPathValue(storeContext || {}, getterOrPath) : typeof getterOrPath === "function" ? () => getterOrPath.call(storeContext, storeContext) : getterOrPath;
      const unwatch = Helix.watch(getter, callback, options);
      watchers.add(unwatch);
      const unsubscribe = () => {
        watchers.delete(unwatch);
        try {
          unwatch();
        } catch (_) {
        }
      };
      if (!options.detached && typeof Helix.onScopeDispose === "function") {
        try {
          Helix.onScopeDispose(unsubscribe);
        } catch (_) {
        }
      }
      return unsubscribe;
    }
    function select(selectorFn, storeState) {
      if (typeof Helix === "undefined" || !Helix.computed) {
        return { value: selectorFn(storeState) };
      }
      return Helix.computed(() => selectorFn(storeState));
    }
    function clear() {
      subscribers.clear();
      watchers.forEach((unwatch) => {
        try {
          unwatch();
        } catch (_) {
        }
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
  const memoryStorage = /* @__PURE__ */ new Map();
  const storageDrivers = {
    localStorage: {
      get(key) {
        if (typeof window !== "undefined" && window.localStorage)
          return window.localStorage.getItem(key);
        return memoryStorage.get(key) || null;
      },
      set(key, val) {
        if (typeof window !== "undefined" && window.localStorage)
          return window.localStorage.setItem(key, val);
        memoryStorage.set(key, val);
      },
      remove(key) {
        if (typeof window !== "undefined" && window.localStorage)
          return window.localStorage.removeItem(key);
        memoryStorage.delete(key);
      }
    },
    sessionStorage: {
      get(key) {
        if (typeof window !== "undefined" && window.sessionStorage)
          return window.sessionStorage.getItem(key);
        return memoryStorage.get(key) || null;
      },
      set(key, val) {
        if (typeof window !== "undefined" && window.sessionStorage)
          return window.sessionStorage.setItem(key, val);
        memoryStorage.set(key, val);
      },
      remove(key) {
        if (typeof window !== "undefined" && window.sessionStorage)
          return window.sessionStorage.removeItem(key);
        memoryStorage.delete(key);
      }
    }
  };
  function setupPersistence(storeId, persistConfig, storeState, patchFn) {
    if (!persistConfig) {
      return {
        save: () => {
        },
        flush: () => {
        },
        remove: () => {
        },
        ready: Promise.resolve()
      };
    }
    const config = typeof persistConfig === "string" ? { driver: persistConfig } : persistConfig === true ? { driver: "localStorage" } : { ...persistConfig };
    const driverName = config.driver || "localStorage";
    const driver = (typeof driverName === "string" ? storageDrivers[driverName] : driverName) || storageDrivers.localStorage;
    const storageKey = config.key || `hx_store_${storeId}`;
    const paths = Array.isArray(config.paths) ? config.paths : null;
    const currentVersion = config.version || 1;
    const debounceTime = typeof config.debounce === "number" ? config.debounce : 0;
    let pendingSaveTimer = null;
    let latestSerializedPayload = null;
    let readyPromise = Promise.resolve();
    try {
      const raw = driver.get(storageKey);
      const handleHydratedData = (data) => {
        if (data) {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          if (parsed && typeof parsed === "object") {
            if (parsed._expiresAt && Date.now() > parsed._expiresAt) {
              driver.remove(storageKey);
              return;
            }
            let stateData = parsed._state !== void 0 ? parsed._state : parsed;
            const savedVersion = parsed._version || 1;
            if (config.version && config.version !== savedVersion && typeof config.migrate === "function") {
              try {
                stateData = config.migrate(stateData, savedVersion);
              } catch (migErr) {
                console.error(`[Helix:Store:Persistence] Migration failed for store "${storeId}":`, migErr);
              }
            }
            patchFn(stateData);
          }
        }
      };
      if (raw instanceof Promise) {
        readyPromise = raw.then(handleHydratedData).catch((err) => {
          console.error(`[Helix:Store:Persistence] Async hydration failed for "${storeId}":`, err);
        });
      } else {
        handleHydratedData(raw);
      }
    } catch (err) {
      console.error(`[Helix:Store:Persistence] Failed to hydrate store "${storeId}":`, err);
    }
    function preparePayload(currentState) {
      let dataToSave = {};
      if (paths && paths.length > 0) {
        paths.forEach((p) => {
          const val = getPathValue(currentState, p);
          if (val !== void 0) {
            setPathValue(dataToSave, p, deepClone(val));
          }
        });
      } else {
        dataToSave = deepClone(currentState);
      }
      const payload = {
        _state: dataToSave,
        _version: currentVersion,
        _timestamp: Date.now()
      };
      if (config.expiresIn && typeof config.expiresIn === "number") {
        payload._expiresAt = Date.now() + config.expiresIn;
      }
      return JSON.stringify(payload);
    }
    async function writePayloadToDriver(serialized) {
      try {
        await Promise.resolve(driver.set(storageKey, serialized));
      } catch (err) {
        console.error(`[Helix:Store:Persistence] Failed to persist store "${storeId}":`, err);
      }
    }
    function save(currentState) {
      latestSerializedPayload = preparePayload(currentState);
      if (debounceTime > 0) {
        if (pendingSaveTimer !== null)
          clearTimeout(pendingSaveTimer);
        pendingSaveTimer = setTimeout(() => {
          pendingSaveTimer = null;
          if (latestSerializedPayload)
            writePayloadToDriver(latestSerializedPayload);
        }, debounceTime);
      } else {
        if (pendingSaveTimer === null) {
          pendingSaveTimer = Promise.resolve().then(() => {
            pendingSaveTimer = null;
            if (latestSerializedPayload)
              writePayloadToDriver(latestSerializedPayload);
          });
        }
      }
    }
    function flush() {
      if (pendingSaveTimer !== null) {
        if (typeof pendingSaveTimer === "number")
          clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
      }
      if (latestSerializedPayload) {
        writePayloadToDriver(latestSerializedPayload);
      }
    }
    function remove() {
      if (pendingSaveTimer !== null) {
        if (typeof pendingSaveTimer === "number")
          clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
      }
      try {
        driver.remove(storageKey);
      } catch (_) {
      }
    }
    return { save, flush, remove, ready: readyPromise };
  }
  function createStoreInstance(storeId, definition, appContext, onDisposeCallback) {
    let disposed = false;
    let isHydrating = false;
    const isSetupStore = isFunction(definition);
    let rawInitialState = {};
    let actions = {};
    let getters = {};
    let persistConfig = null;
    let historyConfig = null;
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
    const reactiveFn = typeof Helix !== "undefined" && Helix.reactive ? Helix.reactive : (obj) => obj;
    const state = reactiveFn(deepClone(rawInitialState));
    const effectScope = typeof Helix !== "undefined" && Helix.effectScope ? Helix.effectScope() : null;
    const subscriptionManager = createSubscriptionManager(storeId);
    const eventBus = createStoreEventBus();
    const asyncManager = createAsyncStateManager(reactiveFn);
    let previousSnapshot = deepClone(rawInitialState);
    let persistenceAdapter = { save: () => {
    }, flush: () => {
    }, remove: () => {
    }, ready: Promise.resolve() };
    const setupStateKeys = new Set(stateKeyList);
    const setupGetterKeys = new Set(getterKeyList);
    const setupActionKeys = new Set(actionKeyList);
    const computedGetters = /* @__PURE__ */ new Map();
    const wrappedActions = /* @__PURE__ */ new Map();
    let storeProxy;
    function replaceState(newState) {
      if (!isObject(newState))
        return;
      Object.keys(state).forEach((k) => {
        if (!(k in newState)) {
          delete state[k];
          setupStateKeys.delete(k);
        }
      });
      Object.keys(newState).forEach((k) => {
        setupStateKeys.add(k);
        state[k] = deepClone(newState[k]);
      });
    }
    const historyManager = createHistoryManager(
      historyConfig,
      (restoredState) => {
        replaceState(restoredState);
        previousSnapshot = deepClone(state);
        dispatchMutation({
          type: "history_restore",
          storeId,
          timestamp: Date.now(),
          after: previousSnapshot
        });
      }
    );
    function dispatchMutation(mutationRecord) {
      subscriptionManager.notify(mutationRecord, state);
      if (!isHydrating) {
        persistenceAdapter.save(state);
      }
    }
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
    let stopMutationWatcher = null;
    function initMutationBridge() {
      if (typeof Helix !== "undefined" && Helix.watch) {
        stopMutationWatcher = Helix.watch(
          () => state,
          () => {
            if (disposed)
              return;
            if (transactionManager.isInTransaction())
              return;
            if (historyManager.isPerformingUndoRedo())
              return;
            if (isHydrating) {
              previousSnapshot = deepClone(state);
              return;
            }
            const shouldSnapshot = historyManager.isEnabled();
            const currentSnapshot = shouldSnapshot ? deepClone(state) : state;
            const mutationRecord = {
              type: "mutation",
              storeId,
              timestamp: Date.now(),
              before: shouldSnapshot ? previousSnapshot : void 0,
              after: shouldSnapshot ? currentSnapshot : void 0
            };
            if (shouldSnapshot) {
              if (!deepEqual(previousSnapshot, currentSnapshot)) {
                historyManager.record({
                  title: "Mutation",
                  before: previousSnapshot,
                  after: currentSnapshot
                });
                previousSnapshot = currentSnapshot;
              }
            }
            dispatchMutation(mutationRecord);
          },
          { deep: true, flush: "sync" }
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
    function patch(patchObjOrFn) {
      transactionManager.runTransaction(() => {
        if (isFunction(patchObjOrFn)) {
          patchObjOrFn(state);
        } else if (isObject(patchObjOrFn)) {
          Object.keys(patchObjOrFn).forEach((key) => {
            setupStateKeys.add(key);
            state[key] = patchObjOrFn[key];
          });
        }
      }, "Patch State");
    }
    function reset() {
      transactionManager.runTransaction(() => {
        replaceState(deepClone(rawInitialState));
      }, "Reset State");
    }
    function replace(newState) {
      transactionManager.runTransaction(() => {
        replaceState(deepClone(newState));
      }, "Replace State");
    }
    function snapshot() {
      return deepClone(state);
    }
    function restore(snap) {
      if (!isObject(snap))
        return;
      transactionManager.runTransaction(() => {
        replaceState(deepClone(snap));
      }, "Restore Snapshot");
    }
    function dispose() {
      if (disposed)
        return;
      disposed = true;
      if (persistenceAdapter && typeof persistenceAdapter.flush === "function") {
        try {
          persistenceAdapter.flush();
        } catch (_) {
        }
      }
      if (stopMutationWatcher) {
        try {
          stopMutationWatcher();
        } catch (_) {
        }
      }
      if (effectScope) {
        try {
          effectScope.stop();
        } catch (_) {
        }
      }
      subscriptionManager.clear();
      eventBus.clear();
      asyncManager.clear();
      historyManager.clear();
      if (onDisposeCallback) {
        onDisposeCallback();
      }
    }
    const internalMembers = {
      $id: storeId,
      get $disposed() {
        return disposed;
      },
      get $ready() {
        return persistenceAdapter && persistenceAdapter.ready ? persistenceAdapter.ready.then(() => storeProxy) : Promise.resolve(storeProxy);
      },
      get $state() {
        return state;
      },
      set $state(newState) {
        replace(newState);
      },
      get $readonly() {
        if (typeof Helix !== "undefined" && Helix.readonly) {
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
      get $canUndo() {
        return historyManager.getCanUndo();
      },
      get $canRedo() {
        return historyManager.getCanRedo();
      },
      get $loading() {
        return asyncManager.loading;
      },
      get $errors() {
        return asyncManager.errors;
      },
      get $signal() {
        return asyncManager.getSignal();
      },
      $cancel: asyncManager.cancel,
      _stateKeys: setupStateKeys,
      _getterKeys: setupGetterKeys,
      _actionKeys: setupActionKeys
    };
    storeProxy = new Proxy(internalMembers, {
      get(target, prop) {
        if (typeof prop === "symbol")
          return target[prop];
        if (prop in target) {
          return target[prop];
        }
        if (computedGetters.has(prop)) {
          return computedGetters.get(prop).value;
        }
        if (wrappedActions.has(prop)) {
          return wrappedActions.get(prop);
        }
        return state[prop];
      },
      set(target, prop, value) {
        if (disposed) {
          console.warn(`[Helix:Store] Attempted to mutate property "${String(prop)}" on disposed store "${storeId}".`);
          return true;
        }
        if (prop === "$state") {
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
        return prop in target || computedGetters.has(prop) || wrappedActions.has(prop) || prop in state;
      },
      ownKeys() {
        const keys = /* @__PURE__ */ new Set([
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
        return void 0;
      }
    });
    getterKeyList.forEach((key) => {
      if (typeof Helix !== "undefined" && Helix.computed) {
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
    actionKeyList.forEach((key) => {
      wrappedActions.set(key, asyncManager.wrapAction(key, actions[key], storeProxy));
    });
    if (isSetupStore) {
      let setupResult = {};
      if (effectScope) {
        effectScope.run(() => {
          setupResult = definition(appContext) || {};
        });
      } else {
        setupResult = definition(appContext) || {};
      }
      Object.keys(setupResult).forEach((key) => {
        const val = setupResult[key];
        if (isFunction(val)) {
          setupActionKeys.add(key);
          wrappedActions.set(key, asyncManager.wrapAction(key, val, storeProxy));
        } else if (typeof Helix !== "undefined" && Helix.isRef && Helix.isRef(val)) {
          setupGetterKeys.add(key);
          computedGetters.set(key, val);
        } else {
          setupStateKeys.add(key);
          state[key] = val;
        }
      });
    }
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
  function createSimpleStore(storeId, initialObj = {}, appContext, onDispose) {
    let state = {};
    let actions = {};
    let getters = {};
    if (isObject(initialObj)) {
      if (typeof initialObj.state === "function") {
        state = initialObj.state();
        actions = initialObj.actions || {};
        getters = initialObj.getters || {};
      } else if (isObject(initialObj.state)) {
        state = initialObj.state;
        actions = initialObj.actions || {};
        getters = initialObj.getters || {};
      } else {
        Object.keys(initialObj).forEach((key) => {
          const val = initialObj[key];
          if (isFunction(val)) {
            actions[key] = val;
          } else {
            state[key] = val;
          }
        });
      }
    }
    const definition = {
      state: () => state,
      actions,
      getters
    };
    return createStoreInstance(storeId, definition, appContext, onDispose);
  }
  function createStoreManager() {
    const definitions = /* @__PURE__ */ new Map();
    const globalRegistry = /* @__PURE__ */ new Map();
    const initLocksByAppContext = /* @__PURE__ */ new WeakMap();
    const globalInitLocks = /* @__PURE__ */ new Set();
    function getActiveAppContext(explicitContext) {
      if (explicitContext && typeof explicitContext === "object") {
        return explicitContext;
      }
      if (typeof Helix !== "undefined") {
        if (typeof Helix.getCurrentInstance === "function") {
          const inst = Helix.getCurrentInstance();
          if (inst && inst.appContext)
            return inst.appContext;
        }
        if (Helix.activeAppContext)
          return Helix.activeAppContext;
        if (Helix.activeApp)
          return Helix.activeApp;
      }
      return null;
    }
    function getRegistry(appContext) {
      const ctx = getActiveAppContext(appContext);
      if (ctx && ctx._storeRegistry instanceof Map) {
        return ctx._storeRegistry;
      }
      return globalRegistry;
    }
    function getInitLocks(appContext) {
      const ctx = getActiveAppContext(appContext);
      if (ctx && typeof ctx === "object") {
        if (!initLocksByAppContext.has(ctx)) {
          initLocksByAppContext.set(ctx, /* @__PURE__ */ new Set());
        }
        return initLocksByAppContext.get(ctx);
      }
      return globalInitLocks;
    }
    function registerDefinition(id, definition) {
      if (definitions.has(id)) {
        console.warn(`[Helix:Store] Store definition "${id}" is already registered. Duplicate definition ignored.`);
        return;
      }
      definitions.set(id, definition);
    }
    function resolveStore(id, initialState, appContext) {
      if (!id || typeof id !== "string") {
        throw new Error("[Helix:Store] Store identifier must be a valid non-empty string.");
      }
      const resolvedAppContext = getActiveAppContext(appContext);
      const registry = getRegistry(resolvedAppContext);
      if (registry.has(id)) {
        const existing = registry.get(id);
        if (!existing.$disposed) {
          return existing;
        }
      }
      const initializingStores = getInitLocks(resolvedAppContext);
      if (initializingStores.has(id)) {
        const chain = Array.from(initializingStores).concat(id).join(" -> ");
        throw new Error(`[Helix:Store] Circular dependency detected during store initialization: ${chain}`);
      }
      initializingStores.add(id);
      try {
        const onDispose = () => {
          registry.delete(id);
        };
        let storeInstance;
        if (definitions.has(id)) {
          const definition = definitions.get(id);
          storeInstance = createStoreInstance(id, definition, resolvedAppContext, onDispose);
        } else {
          storeInstance = createSimpleStore(id, initialState || {}, resolvedAppContext, onDispose);
        }
        registry.set(id, storeInstance);
        return storeInstance;
      } finally {
        initializingStores.delete(id);
      }
    }
    function hasStore(id, appContext) {
      const registry = getRegistry(appContext);
      return registry.has(id) && !registry.get(id).$disposed;
    }
    function disposeStore(id, appContext) {
      const registry = getRegistry(appContext);
      if (registry.has(id)) {
        const store2 = registry.get(id);
        if (store2 && typeof store2.$dispose === "function") {
          store2.$dispose();
        }
        registry.delete(id);
      }
    }
    function clearAll(appContext) {
      const registry = getRegistry(appContext);
      registry.forEach((store2) => {
        if (store2 && typeof store2.$dispose === "function") {
          store2.$dispose();
        }
      });
      registry.clear();
    }
    function createTemplateProxy(appContext) {
      return new Proxy({}, {
        get(target, prop) {
          if (typeof prop !== "string" || prop.startsWith("__") || prop === "then")
            return void 0;
          if (!hasStore(prop, appContext) && !definitions.has(prop)) {
            return resolveStore(prop, void 0, appContext);
          }
          return resolveStore(prop, void 0, appContext);
        },
        has(target, prop) {
          return typeof prop === "string" && (hasStore(prop, appContext) || definitions.has(prop));
        }
      });
    }
    return {
      registerDefinition,
      resolveStore,
      hasStore,
      disposeStore,
      clearAll,
      createTemplateProxy,
      getRegistry
    };
  }
  function createDefineStore(storeManager2) {
    const hooks = /* @__PURE__ */ new Map();
    return function defineStore2(id, definitionOrOptions) {
      if (!id || typeof id !== "string") {
        throw new Error("[Helix:Store] defineStore requires a string identifier as first argument.");
      }
      if (hooks.has(id)) {
        console.warn(`[Helix:Store] Store definition "${id}" is already registered. Returning existing store hook.`);
        return hooks.get(id);
      }
      storeManager2.registerDefinition(id, definitionOrOptions);
      const useStore = function useStore2(appContext) {
        return storeManager2.resolveStore(id, void 0, appContext);
      };
      hooks.set(id, useStore);
      return useStore;
    };
  }
  function storeToRefs(store2) {
    if (!store2 || typeof store2 !== "object") {
      return {};
    }
    const rawState = store2.$state || store2;
    const result = {};
    const stateKeys = store2._stateKeys || new Set(Object.keys(rawState));
    const getterKeys = store2._getterKeys || /* @__PURE__ */ new Set();
    stateKeys.forEach((key) => {
      if (typeof Helix !== "undefined" && Helix.toRef) {
        result[key] = Helix.toRef(rawState, key);
      } else if (typeof Helix !== "undefined" && Helix.computed) {
        result[key] = Helix.computed({
          get: () => rawState[key],
          set: (v) => {
            rawState[key] = v;
          }
        });
      }
    });
    getterKeys.forEach((key) => {
      if (typeof Helix !== "undefined" && Helix.computed) {
        result[key] = Helix.computed(() => store2[key]);
      }
    });
    return result;
  }
  function bindScopeStore(scopeInstance, managerOrPlugin, storeId, definition) {
    if (!scopeInstance)
      return null;
    const resolveFn = typeof (managerOrPlugin == null ? void 0 : managerOrPlugin.resolveStore) === "function" ? managerOrPlugin.resolveStore.bind(managerOrPlugin) : typeof (managerOrPlugin == null ? void 0 : managerOrPlugin.store) === "function" ? managerOrPlugin.store : managerOrPlugin;
    const storeInstance = resolveFn(storeId, definition, scopeInstance);
    if (typeof scopeInstance.onDispose === "function") {
      scopeInstance.onDispose(() => {
        storeInstance.$dispose();
      });
    } else if (typeof scopeInstance.onUnmounted === "function") {
      scopeInstance.onUnmounted(() => {
        storeInstance.$dispose();
      });
    }
    return storeInstance;
  }
  const storeManager = createStoreManager();
  const defineStore = createDefineStore(storeManager);
  function createStoreFunction(manager) {
    function storeFn(id, state, appContext) {
      return manager.resolveStore(id, state, appContext);
    }
    return new Proxy(storeFn, {
      get(target, prop) {
        if (typeof prop === "string" && !(prop in target) && prop !== "then") {
          return manager.resolveStore(prop, void 0);
        }
        return target[prop];
      },
      has(target, prop) {
        return typeof prop === "string" && (manager.hasStore(prop) || prop in target);
      }
    });
  }
  const store = createStoreFunction(storeManager);
  const HelixStore = {
    name: "store",
    version: "1.0.0",
    requires: {
      helix: ">=11.0.0"
    },
    install(app, options = {}) {
      if (app && !(app._storeRegistry instanceof Map)) {
        app._storeRegistry = /* @__PURE__ */ new Map();
      }
      const templateProxy = storeManager.createTemplateProxy(app);
      if (app && typeof app.provide === "function") {
        app.provide("$store", templateProxy);
        app.provide("store", templateProxy);
      }
      if (app && typeof app.namespace === "function") {
        app.namespace("store", {
          get: (id) => storeManager.resolveStore(id, void 0, app),
          define: defineStore,
          dispose: (id) => storeManager.disposeStore(id, app)
        });
      }
      if (app) {
        app.$store = templateProxy;
        app.store = store;
        app.defineStore = defineStore;
      }
      return {
        $store: templateProxy,
        store: templateProxy
      };
    },
    store,
    defineStore,
    storeToRefs,
    bindScopeStore
  };
  function initGlobal() {
    const root = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
    root.HelixStore = HelixStore;
    root.HelixStorePlugin = HelixStore;
    const globalTemplateProxy = storeManager.createTemplateProxy();
    if (!root.$store) {
      root.$store = globalTemplateProxy;
    }
    if (!root.store) {
      root.store = globalTemplateProxy;
    }
    const HelixObj = root.Helix;
    if (HelixObj) {
      HelixObj.store = store;
      HelixObj.defineStore = defineStore;
      HelixObj.storeToRefs = storeToRefs;
      if (!HelixObj.$store) {
        HelixObj.$store = globalTemplateProxy;
      }
      if (HelixObj.scope && typeof HelixObj.scope.store !== "function") {
        HelixObj.scope.store = (id, def) => bindScopeStore(HelixObj.scope, storeManager, id, def);
      }
      if (typeof HelixObj.use === "function") {
        try {
          HelixObj.use(HelixStore);
        } catch (_) {
        }
      }
    }
  }
  initGlobal();
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initGlobal, { once: true });
  }
  exports.HelixStore = HelixStore;
  exports.bindScopeStore = bindScopeStore;
  exports.default = HelixStore;
  exports.defineStore = defineStore;
  exports.store = store;
  exports.storeToRefs = storeToRefs;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixStorePlugin = this.HelixStorePlugin || {});
