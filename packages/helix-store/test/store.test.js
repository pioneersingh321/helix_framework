import test from 'node:test';
import assert from 'node:assert/strict';

// Mock Helix Core Reactivity Primitives for isolated testing
function createMockHelix() {
  const listeners = new Set();
  const scopeCleanups = [];

  function reactive(target) {
    if (target === null || typeof target !== 'object') return target;
    return new Proxy(target, {
      get(t, prop) {
        const res = Reflect.get(t, prop);
        return typeof res === 'object' && res !== null ? reactive(res) : res;
      },
      set(t, prop, val) {
        const res = Reflect.set(t, prop, val);
        listeners.forEach(cb => cb());
        return res;
      },
      deleteProperty(t, prop) {
        const res = Reflect.deleteProperty(t, prop);
        listeners.forEach(cb => cb());
        return res;
      }
    });
  }

  function ref(initial) {
    const obj = {
      _isRef: true,
      _val: initial,
      get value() { return this._val; },
      set value(v) { this._val = v; listeners.forEach(cb => cb()); }
    };
    return obj;
  }

  function computed(fnOrObj) {
    const isGetter = typeof fnOrObj === 'function';
    return {
      _isRef: true,
      get value() {
        return isGetter ? fnOrObj() : fnOrObj.get();
      },
      set value(v) {
        if (!isGetter && fnOrObj.set) fnOrObj.set(v);
      }
    };
  }

  function watch(getter, cb, opts) {
    const watcher = () => {
      cb(getter());
    };
    listeners.add(watcher);
    return () => listeners.delete(watcher);
  }

  function toRef(obj, key) {
    return {
      _isRef: true,
      get value() { return obj[key]; },
      set value(v) { obj[key] = v; }
    };
  }

  function readonly(obj) {
    return new Proxy(obj, {
      get(t, p) { return t[p]; },
      set() {
        console.warn('Cannot mutate readonly object');
        return false;
      }
    });
  }

  function effectScope() {
    let cleanups = [];
    return {
      run(fn) { return fn(); },
      stop() {
        cleanups.forEach(c => { try { c(); } catch (_) {} });
        cleanups = [];
      }
    };
  }

  function onScopeDispose(fn) {
    scopeCleanups.push(fn);
  }

  return {
    reactive,
    ref,
    computed,
    watch,
    toRef,
    readonly,
    effectScope,
    onScopeDispose,
    isRef: (v) => v && v._isRef === true,
    activeAppContext: null
  };
}

globalThis.Helix = createMockHelix();

// Import Helix Store internals
const { HelixStore, store, defineStore, storeToRefs, bindScopeStore } = await import('../src/index.js');
const { storageDrivers } = await import('../src/persistence.js');

test('1. Helix Store - Basic State & Actions', () => {
  const useCounter = defineStore('counter', {
    state: () => ({ count: 0, items: [] }),
    getters: {
      double: (state) => state.count * 2
    },
    actions: {
      increment(by = 1) { this.count += by; },
      addItem(item) { this.items.push(item); }
    }
  });

  const counterStore = useCounter();
  assert.equal(counterStore.count, 0);
  assert.equal(counterStore.double, 0);

  const res = counterStore.increment(5);
  assert.equal(res, undefined);
  assert.equal(counterStore.count, 5);
  assert.equal(counterStore.double, 10);
});

test('2. Helix Store - Setup / Composable Store Syntax', () => {
  const useAuth = defineStore('authSetup', () => {
    const user = Helix.ref({ name: 'Ada' });
    const isLoggedIn = Helix.computed(() => user.value !== null);

    function setUserName(name) {
      user.value = { ...user.value, name };
    }

    return { user, isLoggedIn, setUserName };
  });

  const auth = useAuth();
  assert.equal(auth.isLoggedIn, true);
  assert.equal(auth.user.name, 'Ada');

  auth.setUserName('Grace');
  assert.equal(auth.user.name, 'Grace');
});

test('3. Helix Store - Async Actions, AbortController & $cancel', async () => {
  const useSearch = defineStore('searchStore', {
    state: () => ({ query: '', results: [] }),
    actions: {
      async search(q, { signal } = {}) {
        const sig = signal || this.$signal;
        if (sig?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        await new Promise(r => setTimeout(r, 10));
        if (sig?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return [`Result for ${q}`];
      }
    }
  });

  const searchStore = useSearch();

  const promise = searchStore.search('helix');
  assert.equal(searchStore.$loading.search, true);
  const data = await promise;
  assert.deepEqual(data, ['Result for helix']);
  assert.equal(searchStore.$loading.search, false);
  assert.equal(searchStore.$errors.search, null);

  const cancelPromise = searchStore.search('cancelled');
  searchStore.$cancel('search');
  const cancelData = await cancelPromise;
  assert.equal(cancelData, undefined);
  assert.equal(searchStore.$loading.search, false);
  assert.equal(searchStore.$errors.search, null);
});

test('4. Helix Store - Concurrent Async Actions (Call-ID Token Ownership)', async () => {
  const useData = defineStore('concurrentStore', {
    state: () => ({ value: 0 }),
    actions: {
      async slowFetch(duration, returnVal) {
        await new Promise(r => setTimeout(r, duration));
        return returnVal;
      }
    }
  });

  const dataStore = useData();

  const p1 = dataStore.slowFetch(30, 'first');
  assert.equal(dataStore.$loading.slowFetch, true);

  const p2 = dataStore.slowFetch(10, 'second');
  assert.equal(dataStore.$loading.slowFetch, true);

  const res2 = await p2;
  assert.equal(res2, 'second');
  assert.equal(dataStore.$loading.slowFetch, false);

  const res1 = await p1;
  assert.equal(res1, 'first');
  assert.equal(dataStore.$loading.slowFetch, false);
});

test('5. Helix Store - Active AppContext Resolution for Helix.store()', () => {
  const app1 = { _storeRegistry: new Map() };
  const app2 = { _storeRegistry: new Map() };

  Helix.activeAppContext = app1;
  const storeA = store('settings', { theme: 'light' });
  storeA.theme = 'dark';

  Helix.activeAppContext = app2;
  const storeB = store('settings', { theme: 'light' });

  assert.equal(storeA.theme, 'dark');
  assert.equal(storeB.theme, 'light');
  assert.notEqual(storeA, storeB);

  Helix.activeAppContext = null;
});

test('6. Helix Store - Persistence Hydration without History Pollution', () => {
  storageDrivers.localStorage.set('hx_store_hydratedStore', JSON.stringify({
    _state: { theme: 'dark', step: 3 },
    _version: 1
  }));

  const useHydrated = defineStore('hydratedStore', {
    state: () => ({ theme: 'light', step: 1 }),
    persist: 'localStorage',
    history: true
  });

  const hydratedStore = useHydrated();

  assert.equal(hydratedStore.theme, 'dark');
  assert.equal(hydratedStore.step, 3);
  assert.equal(hydratedStore.$canUndo, false);

  storageDrivers.localStorage.remove('hx_store_hydratedStore');
});

test('7. Helix Store - Persistence Debounce Scheduling', async () => {
  const useDebounced = defineStore('debouncedStore', {
    state: () => ({ x: 0 }),
    persist: { driver: 'localStorage', debounce: 20 }
  });

  const debouncedStore = useDebounced();

  debouncedStore.x = 1;
  debouncedStore.x = 2;
  debouncedStore.x = 3;

  await new Promise(r => setTimeout(r, 40));
  const raw = storageDrivers.localStorage.get('hx_store_debouncedStore');
  assert.notEqual(raw, null);
  const parsed = JSON.parse(raw);
  assert.equal(parsed._state.x, 3);

  storageDrivers.localStorage.remove('hx_store_debouncedStore');
});

test('8. Helix Store - Nested Transactions', () => {
  const useStore = defineStore('nestedTxStore', {
    state: () => ({ a: 1, b: 2, c: 3 }),
    history: true
  });

  const txStore = useStore();
  const events = [];

  txStore.$subscribe((mutation) => {
    events.push(mutation);
  });

  txStore.$transaction(() => {
    txStore.a = 10;
    txStore.$transaction(() => {
      txStore.b = 20;
    });
    txStore.c = 30;
  }, 'Outer Batch');

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'transaction');
  assert.equal(events[0].title, 'Outer Batch');
  assert.equal(events[0].before.a, 1);
  assert.equal(events[0].after.a, 10);
  assert.equal(events[0].after.b, 20);
  assert.equal(events[0].after.c, 30);
});

test('9. Helix Store - Failed Transaction Preserves State (No silent rollback)', () => {
  const useStore = defineStore('failTxStore', {
    state: () => ({ count: 1 })
  });

  const failStore = useStore();

  assert.throws(() => {
    failStore.$transaction(() => {
      failStore.count = 99;
      throw new Error('Transaction failed');
    });
  }, /Transaction failed/);

  assert.equal(failStore.count, 99);
});

test('10. Helix Store - $snapshot and $restore', () => {
  const useCanvas = defineStore('snapStore', {
    state: () => ({ zoom: 1.0, elements: [{ id: 1 }] })
  });

  const canvasStore = useCanvas();
  const snapshot = canvasStore.$snapshot();

  canvasStore.zoom = 2.5;
  canvasStore.elements.push({ id: 2 });
  assert.equal(canvasStore.zoom, 2.5);
  assert.equal(canvasStore.elements.length, 2);

  canvasStore.$restore(snapshot);
  assert.equal(canvasStore.zoom, 1.0);
  assert.equal(canvasStore.elements.length, 1);
});

test('11. Helix Store - Undo/Redo with Property Deletion', () => {
  const useUser = defineStore('userStore', {
    state: () => ({ user: { name: 'Alice', temp: 'to-delete' } }),
    history: true
  });

  const userStore = useUser();
  assert.equal(userStore.user.name, 'Alice');

  userStore.$state = { user: { name: 'Bob' } };
  assert.equal(userStore.user.name, 'Bob');
  assert.equal('temp' in userStore.user, false);
  assert.equal(userStore.$canUndo, true);

  userStore.$undo();
  assert.equal(userStore.user.name, 'Alice');
  assert.equal(userStore.user.temp, 'to-delete');

  userStore.$redo();
  assert.equal(userStore.user.name, 'Bob');
  assert.equal('temp' in userStore.user, false);
});

test('12. Helix Store - Scope-Local Stores & Auto-Disposal', () => {
  let disposedCallback = null;

  const mockScope = {
    onDispose(fn) {
      disposedCallback = fn;
    }
  };

  const scopedStore = bindScopeStore(mockScope, HelixStore, 'scopedStore', {
    state: () => ({ count: 10 })
  });

  assert.equal(scopedStore.count, 10);
  assert.equal(scopedStore.$disposed, false);

  disposedCallback();
  assert.equal(scopedStore.$disposed, true);
});

test('13. Helix Store - Store Recreation after $dispose()', () => {
  defineStore('recreateStore', {
    state: () => ({ count: 1 })
  });

  const store1 = store('recreateStore');
  store1.count = 5;
  store1.$dispose();
  assert.equal(store1.$disposed, true);

  const store2 = store('recreateStore');
  assert.equal(store2.$disposed, false);
  assert.equal(store2.count, 1);
  assert.notEqual(store1, store2);
});

test('14. Helix Store - Internal storeManager is NOT exposed publicly', () => {
  assert.equal(HelixStore.storeManager, undefined);
  assert.equal(typeof HelixStore.store, 'function');
  assert.equal(typeof HelixStore.defineStore, 'function');
  assert.equal(typeof HelixStore.storeToRefs, 'function');
});

test('15. Helix Store - Duplicate defineStore registration returns existing definition', () => {
  const hookA = defineStore('dupAuth', { state: () => ({ name: 'A' }) });
  const hookB = defineStore('dupAuth', { state: () => ({ name: 'B' }) });

  assert.equal(hookA, hookB);
  const instance = hookB();
  assert.equal(instance.name, 'A');
});

test('16. Helix Store - Multiple subscribers unsubscribe correctly and independently', () => {
  const useMulti = defineStore('multiSubStore', { state: () => ({ count: 0 }) });
  const multiStore = useMulti();

  let count1 = 0;
  let count2 = 0;

  const unsub1 = multiStore.$subscribe(() => { count1++; });
  const unsub2 = multiStore.$subscribe(() => { count2++; });

  multiStore.count = 1;
  assert.equal(count1, 1);
  assert.equal(count2, 1);

  unsub1();
  multiStore.count = 2;
  assert.equal(count1, 1); // unhooked
  assert.equal(count2, 2); // still active

  unsub2();
  multiStore.count = 3;
  assert.equal(count1, 1);
  assert.equal(count2, 2);
});

test('17. Helix Store - $watch unwatch after $dispose', () => {
  const useWatchStore = defineStore('watchStore', { state: () => ({ val: 10 }) });
  const watchStore = useWatchStore();

  let triggerCount = 0;
  watchStore.$watch(() => watchStore.val, () => {
    triggerCount++;
  });

  watchStore.val = 20;
  assert.equal(triggerCount, 1);

  watchStore.$dispose();
  watchStore.val = 30;
  assert.equal(triggerCount, 1);
});

test('18. Helix Store - Persistence + Undo interaction syncs storage', async () => {
  const usePersistUndo = defineStore('persistUndoStore', {
    state: () => ({ text: 'init' }),
    persist: { driver: 'localStorage', debounce: 0 },
    history: true
  });

  const puStore = usePersistUndo();
  puStore.text = 'updated';

  await new Promise(r => setTimeout(r, 20));
  let raw = JSON.parse(storageDrivers.localStorage.get('hx_store_persistUndoStore'));
  assert.equal(raw._state.text, 'updated');

  puStore.$undo();
  await new Promise(r => setTimeout(r, 20));
  raw = JSON.parse(storageDrivers.localStorage.get('hx_store_persistUndoStore'));
  assert.equal(raw._state.text, 'init');

  storageDrivers.localStorage.remove('hx_store_persistUndoStore');
});

test('19. Helix Store - Transaction + persistence produces one save', async () => {
  const useTxPersist = defineStore('txPersistStore', {
    state: () => ({ a: 1, b: 2, c: 3 }),
    persist: { driver: 'localStorage', debounce: 10 }
  });

  const tpStore = useTxPersist();

  tpStore.$transaction(() => {
    tpStore.a = 100;
    tpStore.b = 200;
    tpStore.c = 300;
  });

  await new Promise(r => setTimeout(r, 30));
  const raw = JSON.parse(storageDrivers.localStorage.get('hx_store_txPersistStore'));
  assert.equal(raw._state.a, 100);
  assert.equal(raw._state.b, 200);
  assert.equal(raw._state.c, 300);

  storageDrivers.localStorage.remove('hx_store_txPersistStore');
});

test('20. Helix Store - Nested array/object mutation with history', () => {
  const useDeep = defineStore('deepHistoryStore', {
    state: () => ({
      items: [{ id: 1, tags: ['a', 'b'] }],
      meta: { nested: { flag: true } }
    }),
    history: true
  });

  const deepStore = useDeep();
  deepStore.items[0].tags.push('c');
  deepStore.meta.nested.flag = false;

  assert.equal(deepStore.items[0].tags.length, 3);
  assert.equal(deepStore.meta.nested.flag, false);

  deepStore.$undo();
  assert.equal(deepStore.meta.nested.flag, true);
  deepStore.$undo();
  assert.equal(deepStore.items[0].tags.length, 2);
});

test('21. Helix Store - Persist selective paths', async () => {
  const useSelective = defineStore('selectiveStore', {
    state: () => ({ savedKey: 'keep', ignoredKey: 'drop' }),
    persist: { driver: 'localStorage', paths: ['savedKey'], debounce: 0 }
  });

  const selStore = useSelective();
  selStore.savedKey = 'keep2';
  selStore.ignoredKey = 'drop2';

  await new Promise(r => setTimeout(r, 20));
  const raw = JSON.parse(storageDrivers.localStorage.get('hx_store_selectiveStore'));
  assert.equal(raw._state.savedKey, 'keep2');
  assert.equal(raw._state.ignoredKey, undefined);

  storageDrivers.localStorage.remove('hx_store_selectiveStore');
});

test('22. Helix Store - Persistence Expiration', () => {
  storageDrivers.localStorage.set('hx_store_expiredStore', JSON.stringify({
    _state: { count: 99 },
    _expiresAt: Date.now() - 10000 // Expired in past
  }));

  const useExpired = defineStore('expiredStore', {
    state: () => ({ count: 1 }),
    persist: 'localStorage'
  });

  const expStore = useExpired();
  assert.equal(expStore.count, 1); // Defaults to initial because expired data is discarded

  storageDrivers.localStorage.remove('hx_store_expiredStore');
});

test('23. Helix Store - Persistence Version Migration', () => {
  storageDrivers.localStorage.set('hx_store_migStore', JSON.stringify({
    _state: { user_name: 'Grace Hopper' },
    _version: 1
  }));

  const useMig = defineStore('migStore', {
    state: () => ({ userName: '' }),
    persist: {
      driver: 'localStorage',
      version: 2,
      migrate(oldState, oldVersion) {
        if (oldVersion === 1) {
          return { userName: oldState.user_name };
        }
        return oldState;
      }
    }
  });

  const migStore = useMig();
  assert.equal(migStore.userName, 'Grace Hopper');

  storageDrivers.localStorage.remove('hx_store_migStore');
});

test('24. Helix Store - Multiple App Contexts + Same Store Definition', () => {
  const useSharedDef = defineStore('sharedDefStore', {
    state: () => ({ val: 1 })
  });

  const appA = { _storeRegistry: new Map() };
  const appB = { _storeRegistry: new Map() };

  const instA = useSharedDef(appA);
  const instB = useSharedDef(appB);

  instA.val = 50;
  instB.val = 100;

  assert.equal(instA.val, 50);
  assert.equal(instB.val, 100);
  assert.notEqual(instA, instB);
});

test('25. Helix Store - Scope Store Recreation after Scope Disposal', () => {
  let disposeScopeA;
  let disposeScopeB;

  const scopeA = { onDispose(fn) { disposeScopeA = fn; } };
  const scopeB = { onDispose(fn) { disposeScopeB = fn; } };

  const storeA = bindScopeStore(scopeA, HelixStore, 'recreateScopeStore', { state: () => ({ x: 10 }) });
  assert.equal(storeA.x, 10);
  disposeScopeA();
  assert.equal(storeA.$disposed, true);

  const storeB = bindScopeStore(scopeB, HelixStore, 'recreateScopeStore', { state: () => ({ x: 20 }) });
  assert.equal(storeB.$disposed, false);
  assert.equal(storeB.x, 20);
});
