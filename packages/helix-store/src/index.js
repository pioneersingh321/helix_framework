/**
 * Helix Store Plugin
 * Signal-native reactive state management for Helix.js
 */
import { createStoreManager } from './store-manager.js';
import { createDefineStore } from './define-store.js';
import { storeToRefs } from './store-to-refs.js';
import { bindScopeStore } from './scope-binding.js';

// Internal Store Manager Singleton
const storeManager = createStoreManager();
const defineStore = createDefineStore(storeManager);

function createStoreFunction(manager) {
  function storeFn(id, state, appContext) {
    return manager.resolveStore(id, state, appContext);
  }

  return new Proxy(storeFn, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target) && prop !== 'then') {
        return manager.resolveStore(prop, undefined);
      }
      return target[prop];
    },
    has(target, prop) {
      return typeof prop === 'string' && (manager.hasStore(prop) || (prop in target));
    }
  });
}

const store = createStoreFunction(storeManager);

export const HelixStore = {
  name: 'store',
  version: '1.0.0',
  requires: {
    helix: '>=11.0.0'
  },
  install(app, options = {}) {
    // 1. Safe idempotent registry attachment
    if (app && !(app._storeRegistry instanceof Map)) {
      app._storeRegistry = new Map();
    }

    const templateProxy = storeManager.createTemplateProxy(app);

    // 2. Expose both $store and store on pluginAPI / app context / provide
    if (app && typeof app.provide === 'function') {
      app.provide('$store', templateProxy);
      app.provide('store', templateProxy);
    }

    // 3. Register on app namespace if namespace API exists
    if (app && typeof app.namespace === 'function') {
      app.namespace('store', {
        get: (id) => storeManager.resolveStore(id, undefined, app),
        define: defineStore,
        dispose: (id) => storeManager.disposeStore(id, app)
      });
    }

    // Attach to app instance directly
    if (app) {
      app.$store = templateProxy;
      app.store = store;
      app.defineStore = defineStore;
    }

    // Return properties for template context merge (supporting both $store and store)
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

// Global Browser Attachment & Auto-Installation Helper
function initGlobal() {
  const root = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
  
  root.HelixStore = HelixStore;
  root.HelixStorePlugin = HelixStore;

  const globalTemplateProxy = storeManager.createTemplateProxy();

  // Attach both $store and store to global window scope so template expressions resolve:
  // 1. @click="$store.builderStore.openAddStage()"
  // 2. @click="store.builderStore.openAddStage()"
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

    // Attach global template proxies to Helix root
    if (!HelixObj.$store) {
      HelixObj.$store = globalTemplateProxy;
    }

    // Attach scope helper if Helix.scope exists
    if (HelixObj.scope && typeof HelixObj.scope.store !== 'function') {
      HelixObj.scope.store = (id, def) => bindScopeStore(HelixObj.scope, storeManager, id, def);
    }

    // Auto-register plugin into Helix globalPlugins so all Helix.create() apps auto-install it
    if (typeof HelixObj.use === 'function') {
      try {
        HelixObj.use(HelixStore);
      } catch (_) {}
    }
  }
}

initGlobal();

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initGlobal, { once: true });
}

export {
  store,
  defineStore,
  storeToRefs,
  bindScopeStore
};

export default HelixStore;
