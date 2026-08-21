import test from 'node:test';
import assert from 'node:assert/strict';

// Import Real Helix Core from packages/core
import HelixCore from '../../core/src/index.js';

// Attach real core to globalThis
globalThis.Helix = HelixCore;

// Import Helix Store internals
const { HelixStore, store, defineStore, storeToRefs } = await import('../src/index.js');
const { storageDrivers } = await import('../src/persistence.js');

test('Integration (Real Core) - Store with real Helix.reactive and Helix.computed', () => {
  const useCounter = defineStore('realCoreCounter', {
    state: () => ({ count: 1, multiplier: 3 }),
    getters: {
      total: (state) => state.count * state.multiplier
    },
    actions: {
      inc() { this.count++; }
    }
  });

  const cStore = useCounter();
  assert.equal(cStore.count, 1);
  assert.equal(cStore.total, 3);

  cStore.inc();
  assert.equal(cStore.count, 2);
  assert.equal(cStore.total, 6);
});

test('Integration (Real Core) - store.$watch() backed directly by real Helix.watch', async () => {
  const useWatch = defineStore('realCoreWatch', {
    state: () => ({ user: { name: 'Ada' } })
  });

  const wStore = useWatch();
  let seenName = '';

  wStore.$watch(() => wStore.user.name, (newName) => {
    seenName = newName;
  }, { flush: 'sync' });

  wStore.user.name = 'Grace';
  assert.equal(seenName, 'Grace');
});

test('Integration (Real Core) - Deep nested and Array mutations with real reactivity', () => {
  const useBuilder = defineStore('realCoreBuilder', {
    state: () => ({
      stages: [{ id: 1, name: 'Stage 1' }],
      config: { zoom: 1.0 }
    }),
    history: true
  });

  const bStore = useBuilder();

  bStore.stages.push({ id: 2, name: 'Stage 2' });
  bStore.config.zoom = 1.5;

  assert.equal(bStore.stages.length, 2);
  assert.equal(bStore.config.zoom, 1.5);
  assert.equal(bStore.$canUndo, true);

  // Undo zoom
  bStore.$undo();
  assert.equal(bStore.config.zoom, 1.0);

  // Undo stages push
  bStore.$undo();
  assert.equal(bStore.stages.length, 1);
  assert.equal(bStore.stages[0].name, 'Stage 1');
});

test('Integration (Real Core) - storeToRefs() with real Helix.toRef and Helix.computed', () => {
  const useCart = defineStore('realCoreCart', {
    state: () => ({ items: [10, 20] }),
    getters: {
      sum: (state) => state.items.reduce((a, b) => a + b, 0)
    }
  });

  const cart = useCart();
  const refs = storeToRefs(cart);

  assert.equal(refs.sum.value, 30);
  assert.equal(refs.items.value.length, 2);

  cart.items.push(30);
  assert.equal(refs.sum.value, 60);
});

test('Integration (Real Core) - Clean AbortSignal access via this.$signal without polluting positional arguments', async () => {
  const useActionStore = defineStore('realCoreActionStore', {
    state: () => ({ lastId: null, argCount: 0 }),
    actions: {
      deleteStage(stageId) {
        // Positional argument must NOT be polluted with extra objects
        this.argCount = arguments.length;
        this.lastId = stageId;
        return { deleted: stageId };
      },
      async fetchItem(id) {
        const signal = this.$signal;
        assert.equal(typeof signal?.aborted, 'boolean');
        await new Promise(r => setTimeout(r, 10));
        return { id, signalPresent: !!signal };
      }
    }
  });

  const aStore = useActionStore();
  const deleteRes = aStore.deleteStage(42);

  // Strictly 1 argument passed, strictly 1 argument received
  assert.equal(aStore.argCount, 1);
  assert.equal(aStore.lastId, 42);
  assert.equal(deleteRes.deleted, 42);

  // Async action with this.$signal
  const fetchRes = await aStore.fetchItem(100);
  assert.equal(fetchRes.id, 100);
  assert.equal(fetchRes.signalPresent, true);
});

test('Integration (Real Core) - Template expressions support both $store.<id> and store.<id>', () => {
  Helix.store('builderStoreIntegration', {
    stageCount: 0,
    openAddStage() {
      this.stageCount++;
      return this.stageCount;
    }
  });

  // 1. Check direct $store.<id> evaluation (e.g. @click="$store.builderStoreIntegration.openAddStage()")
  const res1 = globalThis.$store.builderStoreIntegration.openAddStage();
  assert.equal(res1, 1);

  // 2. Check direct store.<id> evaluation (e.g. @click="store.builderStoreIntegration.openAddStage()")
  const res2 = globalThis.store.builderStoreIntegration.openAddStage();
  assert.equal(res2, 2);

  // 3. Check calling store as a function vs property access
  const directStore = store('builderStoreIntegration');
  assert.equal(directStore.stageCount, 2);
  assert.equal(store.builderStoreIntegration.stageCount, 2);
});

test('Integration (Real Core) - $ready promise contract resolves to store instance', async () => {
  const useAsyncStore = defineStore('realCoreReady', {
    state: () => ({ readyVal: 42 }),
    persist: 'localStorage'
  });

  const rStore = useAsyncStore();
  const resolved = await rStore.$ready;

  assert.equal(resolved, rStore);
  assert.equal(resolved.readyVal, 42);
});

test('Integration (Real Core) - $dispose() flushes debounced persistence before teardown', async () => {
  const useFlush = defineStore('realCoreFlush', {
    state: () => ({ status: 'pending' }),
    persist: { driver: 'localStorage', debounce: 500 }
  });

  const fStore = useFlush();
  fStore.status = 'saved_before_dispose';

  // Dispose immediately while debounce timer is still pending
  fStore.$dispose();

  // Flushed immediately upon disposal
  const raw = JSON.parse(storageDrivers.localStorage.get('hx_store_realCoreFlush'));
  assert.equal(raw._state.status, 'saved_before_dispose');
  assert.equal(fStore.$disposed, true);

  storageDrivers.localStorage.remove('hx_store_realCoreFlush');
});
