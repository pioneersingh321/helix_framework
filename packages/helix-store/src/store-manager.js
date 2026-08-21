/**
 * Store Manager & Registry
 * Manages store definitions, lazy instantiation, per-app circular dependency detection, and template proxying
 */
import { createStoreInstance } from './store-instance.js';
import { createSimpleStore } from './simple-store.js';

export function createStoreManager() {
  const definitions = new Map();
  const globalRegistry = new Map();
  const initLocksByAppContext = new WeakMap();
  const globalInitLocks = new Set();

  function getActiveAppContext(explicitContext) {
    if (explicitContext && typeof explicitContext === 'object') {
      return explicitContext;
    }
    if (typeof Helix !== 'undefined') {
      if (typeof Helix.getCurrentInstance === 'function') {
        const inst = Helix.getCurrentInstance();
        if (inst && inst.appContext) return inst.appContext;
      }
      if (Helix.activeAppContext) return Helix.activeAppContext;
      if (Helix.activeApp) return Helix.activeApp;
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
    if (ctx && typeof ctx === 'object') {
      if (!initLocksByAppContext.has(ctx)) {
        initLocksByAppContext.set(ctx, new Set());
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
    if (!id || typeof id !== 'string') {
      throw new Error('[Helix:Store] Store identifier must be a valid non-empty string.');
    }

    const resolvedAppContext = getActiveAppContext(appContext);
    const registry = getRegistry(resolvedAppContext);

    // 1. Idempotent Return if already instantiated and active
    if (registry.has(id)) {
      const existing = registry.get(id);
      if (!existing.$disposed) {
        return existing;
      }
    }

    // 2. Per-App Circular Dependency Guard (with try/finally safety)
    const initializingStores = getInitLocks(resolvedAppContext);
    if (initializingStores.has(id)) {
      const chain = Array.from(initializingStores).concat(id).join(' -> ');
      throw new Error(`[Helix:Store] Circular dependency detected during store initialization: ${chain}`);
    }

    initializingStores.add(id);
    try {
      const onDispose = () => {
        registry.delete(id);
      };

      let storeInstance;
      if (definitions.has(id)) {
        // Defined Store
        const definition = definitions.get(id);
        storeInstance = createStoreInstance(id, definition, resolvedAppContext, onDispose);
      } else {
        // Simple Store
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
      const store = registry.get(id);
      if (store && typeof store.$dispose === 'function') {
        store.$dispose();
      }
      registry.delete(id);
    }
  }

  function clearAll(appContext) {
    const registry = getRegistry(appContext);
    registry.forEach(store => {
      if (store && typeof store.$dispose === 'function') {
        store.$dispose();
      }
    });
    registry.clear();
  }

  // Create dynamic template proxy ($store.cart, store.builderStore)
  function createTemplateProxy(appContext) {
    return new Proxy({}, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop.startsWith('__') || prop === 'then') return undefined;

        if (!hasStore(prop, appContext) && !definitions.has(prop)) {
          return resolveStore(prop, undefined, appContext);
        }

        return resolveStore(prop, undefined, appContext);
      },
      has(target, prop) {
        return typeof prop === 'string' && (hasStore(prop, appContext) || definitions.has(prop));
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
