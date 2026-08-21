/**
 * storeToRefs() utility for Helix Store
 * Converts state properties to refs and computed getters to computed refs while preserving actions
 */

export function storeToRefs(store) {
  if (!store || typeof store !== 'object') {
    return {};
  }

  const rawState = store.$state || store;
  const result = {};

  const stateKeys = store._stateKeys || new Set(Object.keys(rawState));
  const getterKeys = store._getterKeys || new Set();

  // 1. Convert state properties to refs
  stateKeys.forEach(key => {
    if (typeof Helix !== 'undefined' && Helix.toRef) {
      result[key] = Helix.toRef(rawState, key);
    } else if (typeof Helix !== 'undefined' && Helix.computed) {
      result[key] = Helix.computed({
        get: () => rawState[key],
        set: (v) => { rawState[key] = v; }
      });
    }
  });

  // 2. Convert computed getters to computed refs
  getterKeys.forEach(key => {
    if (typeof Helix !== 'undefined' && Helix.computed) {
      result[key] = Helix.computed(() => store[key]);
    }
  });

  return result;
}
