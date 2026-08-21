/**
 * Utility functions for Helix Store Plugin
 */

export function isObject(val) {
  return val !== null && typeof val === 'object';
}

export function isFunction(val) {
  return typeof val === 'function';
}

export function isPromise(val) {
  return isObject(val) && isFunction(val.then);
}

/**
 * Deep clone supporting structuredClone with recursive fallback for older environments
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch (_) {
      // Fallback for non-cloneable objects (e.g. functions, DOM nodes)
    }
  }

  if (Array.isArray(obj)) return obj.map(deepClone);
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj);
  if (obj instanceof Set) return new Set(Array.from(obj, deepClone));
  if (obj instanceof Map) {
    const map = new Map();
    obj.forEach((v, k) => map.set(deepClone(k), deepClone(v)));
    return map;
  }

  const clone = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key]);
  }
  return clone;
}

export function getPathValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = Array.isArray(path) ? path : path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export function setPathValue(obj, path, value) {
  if (!obj || !path) return;
  const parts = Array.isArray(path) ? path : path.split('.');
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

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that keys do not collide with reserved store methods or state
 */
export const RESERVED_STORE_KEYS = new Set([
  '$id', '$state', '$readonly', '$patch', '$reset', '$snapshot', '$restore',
  '$dispose', '$disposed', '$subscribe', '$watch', '$select', '$transaction',
  '$emit', '$on', '$off', '$undo', '$redo', '$canUndo', '$canRedo',
  '$loading', '$errors', '$cancel', '_stateKeys', '_getterKeys', '_actionKeys'
]);

export function validateStoreKeys(storeId, stateKeys, getterKeys, actionKeys) {
  const allKeys = [...stateKeys, ...getterKeys, ...actionKeys];
  for (const key of allKeys) {
    if (RESERVED_STORE_KEYS.has(key)) {
      throw new Error(`[Helix:Store] Store "${storeId}" cannot define reserved key "${key}".`);
    }
  }

  // Check state vs actions collisions
  for (const k of stateKeys) {
    if (actionKeys.includes(k)) {
      throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and an action in store "${storeId}".`);
    }
    if (getterKeys.includes(k)) {
      throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and a getter in store "${storeId}".`);
    }
  }
}
