/**
 * defineStore() for Helix Store
 * Defines a structured domain store (Options or Composable setup) and returns a store hook.
 * Guards against duplicate definitions.
 */

export function createDefineStore(storeManager) {
  const hooks = new Map();

  return function defineStore(id, definitionOrOptions) {
    if (!id || typeof id !== 'string') {
      throw new Error('[Helix:Store] defineStore requires a string identifier as first argument.');
    }

    if (hooks.has(id)) {
      console.warn(`[Helix:Store] Store definition "${id}" is already registered. Returning existing store hook.`);
      return hooks.get(id);
    }

    // Register definition in StoreManager
    storeManager.registerDefinition(id, definitionOrOptions);

    // Return composable hook
    const useStore = function useStore(appContext) {
      return storeManager.resolveStore(id, undefined, appContext);
    };

    hooks.set(id, useStore);
    return useStore;
  };
}
