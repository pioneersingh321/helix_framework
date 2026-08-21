/**
 * Simple Store Implementation
 * Instant reactive object store with automatic action extraction and collision validation
 */
import { isFunction, isObject } from './utils.js';
import { createStoreInstance } from './store-instance.js';

export function createSimpleStore(storeId, initialObj = {}, appContext, onDispose) {
  let state = {};
  let actions = {};
  let getters = {};

  if (isObject(initialObj)) {
    if (typeof initialObj.state === 'function') {
      state = initialObj.state();
      actions = initialObj.actions || {};
      getters = initialObj.getters || {};
    } else if (isObject(initialObj.state)) {
      state = initialObj.state;
      actions = initialObj.actions || {};
      getters = initialObj.getters || {};
    } else {
      Object.keys(initialObj).forEach(key => {
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
