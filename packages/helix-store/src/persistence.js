/**
 * Pluggable Storage Driver & Persistence Engine for Helix Store
 * Supports scheduled/debounced saving, schema version migration, expiration, and $ready promise
 */
import { getPathValue, setPathValue, deepClone } from './utils.js';

export const memoryStorage = new Map();

export const storageDrivers = {
  localStorage: {
    get(key) {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
      return memoryStorage.get(key) || null;
    },
    set(key, val) {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.setItem(key, val);
      memoryStorage.set(key, val);
    },
    remove(key) {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  },
  sessionStorage: {
    get(key) {
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage.getItem(key);
      return memoryStorage.get(key) || null;
    },
    set(key, val) {
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage.setItem(key, val);
      memoryStorage.set(key, val);
    },
    remove(key) {
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  }
};

export function setupPersistence(storeId, persistConfig, storeState, patchFn) {
  if (!persistConfig) {
    return {
      save: () => {},
      flush: () => {},
      remove: () => {},
      ready: Promise.resolve()
    };
  }

  const config = typeof persistConfig === 'string' 
    ? { driver: persistConfig } 
    : (persistConfig === true ? { driver: 'localStorage' } : { ...persistConfig });

  const driverName = config.driver || 'localStorage';
  const driver = (typeof driverName === 'string' ? storageDrivers[driverName] : driverName) || storageDrivers.localStorage;
  const storageKey = config.key || `hx_store_${storeId}`;
  const paths = Array.isArray(config.paths) ? config.paths : null;
  const currentVersion = config.version || 1;
  const debounceTime = typeof config.debounce === 'number' ? config.debounce : 0;

  let pendingSaveTimer = null;
  let latestSerializedPayload = null;
  let readyPromise = Promise.resolve();

  // 1. Initial Hydration (Sync or Async)
  try {
    const raw = driver.get(storageKey);
    const handleHydratedData = (data) => {
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed && typeof parsed === 'object') {
          // Expiration Check
          if (parsed._expiresAt && Date.now() > parsed._expiresAt) {
            driver.remove(storageKey);
            return;
          }

          let stateData = parsed._state !== undefined ? parsed._state : parsed;
          const savedVersion = parsed._version || 1;

          // Migration Support
          if (config.version && config.version !== savedVersion && typeof config.migrate === 'function') {
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
      readyPromise = raw
        .then(handleHydratedData)
        .catch(err => {
          console.error(`[Helix:Store:Persistence] Async hydration failed for "${storeId}":`, err);
        });
    } else {
      handleHydratedData(raw);
    }
  } catch (err) {
    console.error(`[Helix:Store:Persistence] Failed to hydrate store "${storeId}":`, err);
  }

  // 2. Prepare Immutable Payload Snapshot (Selective Paths supported)
  function preparePayload(currentState) {
    let dataToSave = {};
    if (paths && paths.length > 0) {
      paths.forEach(p => {
        const val = getPathValue(currentState, p);
        if (val !== undefined) {
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

    if (config.expiresIn && typeof config.expiresIn === 'number') {
      payload._expiresAt = Date.now() + config.expiresIn;
    }

    return JSON.stringify(payload);
  }

  // 3. Write Snapshot to Driver (Supports Async drivers natively)
  async function writePayloadToDriver(serialized) {
    try {
      await Promise.resolve(driver.set(storageKey, serialized));
    } catch (err) {
      console.error(`[Helix:Store:Persistence] Failed to persist store "${storeId}":`, err);
    }
  }

  // 4. Scheduled / Debounced Saver
  function save(currentState) {
    latestSerializedPayload = preparePayload(currentState);

    if (debounceTime > 0) {
      if (pendingSaveTimer !== null) clearTimeout(pendingSaveTimer);
      pendingSaveTimer = setTimeout(() => {
        pendingSaveTimer = null;
        if (latestSerializedPayload) writePayloadToDriver(latestSerializedPayload);
      }, debounceTime);
    } else {
      if (pendingSaveTimer === null) {
        pendingSaveTimer = Promise.resolve().then(() => {
          pendingSaveTimer = null;
          if (latestSerializedPayload) writePayloadToDriver(latestSerializedPayload);
        });
      }
    }
  }

  function flush() {
    if (pendingSaveTimer !== null) {
      if (typeof pendingSaveTimer === 'number') clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    if (latestSerializedPayload) {
      writePayloadToDriver(latestSerializedPayload);
    }
  }

  function remove() {
    if (pendingSaveTimer !== null) {
      if (typeof pendingSaveTimer === 'number') clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    try {
      driver.remove(storageKey);
    } catch (_) {}
  }

  return { save, flush, remove, ready: readyPromise };
}
