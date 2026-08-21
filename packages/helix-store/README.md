# 🏬 Helix Store (`helix-store`)

[![Version](https://img.shields.io/badge/version-1.0.0-indigo.svg?style=flat-square)](#)
[![Reactivity](https://img.shields.io/badge/reactivity-signal--native-blue.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

A modern, signal-native, zero-ceremony reactive state management library built specifically for **Helix.js**. Designed for high-performance enterprise applications (HRMS, ERP), interactive visual builders, and scoped component trees.

---

## ⚡ Key Highlights

* 🚀 **Zero-Build & Bundler Ready:** Use via `<script src="plugins/store/helix-store.min.js">` in plain HTML or `import { defineStore } from 'helix-store'` in modern bundlers.
* 🌐 **Global Template Auto-Binding:** Access any store in HTML templates via `$store.<id>` or `store.<id>` with zero boilerplate.
* 🧠 **Signal-Native Reactivity:** Backed by `Helix.reactive()`, `Helix.computed()`, `Helix.watch()`, and `Helix.effectScope()`.
* 🛡️ **Deep Mutation Bridge:** Automatically tracks top-level, nested properties (`store.user.name = ...`), array operations (`store.items.push(...)`), `$patch()`, and `$state` replacements.
* 🔄 **Deterministic Undo & Redo:** Full snapshot-based history engine with empty-transaction suppression, property deletion, and hydration exclusion.
* 💾 **Production-Grade Persistence:** Pluggable storage drivers (`localStorage`, `sessionStorage`, IndexedDB), selective path filtering, debounced writes, expiration, version migration, and `store.$ready`.
* ⚡ **Async Action Tracking:** Auto-tracked `$loading[action]`, `$errors[action]`, `$cancel(action)`, and non-invasive `this.$signal` cancellation.
* 🌳 **Scoped Lifecycle Isolation:** Full integration with `Helix.effectScope()` and `Helix.scope` for scope-local stores that automatically clean up when unmounted.

---

## 📦 Installation

### 1. Browser Direct Script (No Build Step)
```html
<!-- Load Helix Core and Helix Store Plugin -->
<script src="dist/helix.js"></script>
<script src="plugins/store/helix-store.min.js"></script>
```

### 2. NPM / ES Module
```bash
npm install helix-store
```
```javascript
import Helix from 'helix';
import { HelixStore, defineStore, store, storeToRefs } from 'helix-store';

Helix.use(HelixStore);
```

---

## 🏁 Quick Start: The 3 Flavors of Helix Store

Helix Store supports 3 developer-friendly patterns depending on your application needs:

### Flavor 1: Instant Simple Store (`Helix.store`)
Ideal for builders, interactive forms, and quick reactive state:

```javascript
// Define and retrieve in one line
const builder = Helix.store('builderStore', {
  currentStageId: null,
  stages: [{ id: 1, name: 'Initial Screening' }],
  
  openSettings(stage) {
    this.currentStageId = stage.id;
  },
  addStage(name) {
    this.stages.push({ id: Date.now(), name });
  }
});

// Direct access anywhere in JavaScript
builder.openSettings(builder.stages[0]);
```

### Flavor 2: Structured Options Store (`Helix.defineStore`)
Ideal for domain models, HRMS, and enterprise business logic:

```javascript
import { defineStore } from 'helix-store';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    roles: []
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.roles.includes('admin'),
    displayName: (state) => state.user ? `${state.user.firstName} ${state.user.lastName}` : 'Guest'
  },
  actions: {
    async login(credentials) {
      const signal = this.$signal; // In-flight AbortSignal
      const res = await Helix.$fetch.post('/api/auth/login', credentials, { signal });
      this.user = res.data.user;
      this.token = res.data.token;
      this.roles = res.data.roles;
    },
    logout() {
      this.$reset();
    }
  },
  persist: {
    driver: 'localStorage',
    paths: ['token', 'user']
  }
});
```

### Flavor 3: Composable / Setup Store (`Helix.defineStore(id, setupFn)`)
Ideal for modern composable logic using Helix refs, computeds, and watchers:

```javascript
export const useCartStore = defineStore('cart', () => {
  const items = Helix.ref([]);
  const discountCode = Helix.ref('');

  const count = Helix.computed(() => items.value.length);
  const total = Helix.computed(() => {
    return items.value.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  });

  function addItem(product) {
    items.value.push({ ...product, quantity: 1 });
  }

  function clearCart() {
    items.value = [];
  }

  return { items, discountCode, count, total, addItem, clearCart };
});
```

---

## 🎨 Global Template Auto-Binding

All registered stores are **automatically injected into template directives** (`hx-text`, `hx-bind`, `hx-for`, `hx-if`, `@click`, etc.) via `$store.<id>` or `store.<id>` with zero boilerplate:

```html
<div id="app">
  <!-- Direct State Binding -->
  <h4>Total Stages: <span hx-text="$store.builderStore.stages.length">0</span></h4>

  <!-- Actions & Events in @click -->
  <button class="btn btn-primary" @click="$store.builderStore.openAddStage()">
    <i class="ri-add-line"></i> Add Stage
  </button>

  <!-- Keyed List Iteration -->
  <ol class="list-group">
    <template hx-for="stg in $store.builderStore.stages">
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span hx-text="stg.name"></span>
        <button class="btn btn-sm btn-outline-danger" @click="$store.builderStore.deleteStage(stg.id)">
          Delete
        </button>
      </li>
    </template>
  </ol>
</div>
```

---

## 🔄 State Mutations, Batching & Transactions

### 1. Direct Mutations (Deep Proxies)
```javascript
const store = Helix.store('editor', { project: { title: 'Draft', tags: ['v1'] } });

// All deeply tracked automatically
store.project.title = 'Published';
store.project.tags.push('v2');
```

### 2. `$patch()` Multi-Property Updates
```javascript
// Object form
store.$patch({
  count: 10,
  user: { name: 'Ada' }
});

// Function form (direct mutation inside a batch)
store.$patch((state) => {
  state.items.push({ id: 1 });
  state.lastUpdated = Date.now();
});
```

### 3. Full State Replacement (`$state = ...`)
Replaces the entire state tree and cleans up orphaned keys:
```javascript
store.$state = {
  name: 'New Application',
  version: '2.0.0'
};
```

### 4. Atomic Transactions (`$transaction`)
Group multiple operations into a single mutation event and snapshot:
```javascript
store.$transaction(() => {
  store.stageId = 4;
  store.reorderList();
  store.historyMeta = 'Reordered Stages';
}, 'Reorder Stage Operation');
```

---

## ⏳ Async Action Tracking & Cancellation

Async actions automatically manage reactive `$loading` and `$errors` dictionaries:

```javascript
const useSearch = defineStore('search', {
  state: () => ({ query: '', results: [] }),
  actions: {
    async search(keyword) {
      // 1. Clean AbortSignal access
      const signal = this.$signal;
      
      const res = await Helix.$fetch.get(`/api/search?q=${keyword}`, { signal });
      this.results = res.data;
      return this.results;
    }
  }
});

const store = useSearch();

// Trigger action
store.search('engineering');

// Reactive state in template/JS
console.log(store.$loading.search); // true while executing
console.log(store.$errors.search);  // null or Error message

// Cancel the current in-flight search
store.$cancel('search');
```

---

## 💾 Persistence Subsystem

Configure enterprise storage policies directly in store definitions:

```javascript
export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: 'dark',
    sidebarCollapsed: false,
    authToken: 'xyz-secret',
    cachedTempData: null
  }),
  persist: {
    driver: 'localStorage', // 'localStorage' | 'sessionStorage' | custom driver
    key: 'hx_app_settings', // Custom storage key
    paths: ['theme', 'sidebarCollapsed', 'authToken'], // Selective persistence
    debounce: 300,          // Debounce writes (ms)
    expiresIn: 86400000,    // TTL in ms (e.g. 24 hours)
    version: 2,             // Schema version
    migrate(oldState, oldVersion) {
      if (oldVersion === 1) {
        return { ...oldState, theme: oldState.darkMode ? 'dark' : 'light' };
      }
      return oldState;
    }
  }
});
```

### Async Hydration Readiness (`$ready`)
```javascript
const store = useSettingsStore();

// Await hydration from storage drivers (guaranteed to resolve to the store)
await store.$ready;
console.log('Store hydrated successfully:', store.theme);
```

---

## ⏪ History Subsystem (Undo / Redo)

Enable declarative undo/redo history tracking:

```javascript
export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    zoom: 1.0,
    elements: []
  }),
  history: {
    maxDepth: 50 // Limit undo stack size (default: 50)
  }
});

const canvas = useCanvasStore();

canvas.elements.push({ id: 'el-1', x: 100, y: 150 });
canvas.zoom = 1.2;

// Check undo capability
console.log(canvas.$canUndo); // true

// Perform undo
canvas.$undo(); // Restores zoom = 1.0
canvas.$undo(); // Restores elements = []

// Perform redo
canvas.$redo(); // Restores elements = [{ id: 'el-1', x: 100, y: 150 }]
```

---

## 🌿 Scope Stores & Auto-Disposal

Bind lifecycle stores to a specific `Helix.scope` or `EffectScope`. When the scope unmounts, the store is automatically disposed and cleaned up:

```javascript
import { bindScopeStore } from 'helix-store';

const componentScope = Helix.effectScope();

const localStore = bindScopeStore(
  componentScope,
  HelixStore,
  'pageLocalStore',
  {
    state: () => ({ filterText: '' })
  }
);

// When component unmounts:
componentScope.stop(); 
// -> automatically calls localStore.$dispose() and cleans up all watchers!
```

---

## 🛠️ API Reference Table

| Method / Property | Type | Description |
| :--- | :--- | :--- |
| `Helix.store(id, state)` | `Function` | Resolves or creates a simple store instance |
| `Helix.defineStore(id, def)` | `Function` | Creates a reusable store hook `use<Name>Store()` |
| `storeToRefs(store)` | `Function` | Extracts state properties and getters as reactive `refs` |
| `bindScopeStore(scope, ...)` | `Function` | Binds a store instance to an `EffectScope` with auto-cleanup |
| `store.$id` | `string` | Unique store identifier |
| `store.$state` | `Object` | Get current state or assign new state (`store.$state = {...}`) |
| `store.$ready` | `Promise<Store>` | Resolves with the store instance after persistence hydration |
| `store.$loading` | `Object` | Reactive loading dictionary keyed by action name |
| `store.$errors` | `Object` | Reactive error dictionary keyed by action name |
| `store.$signal` | `AbortSignal` | Active `AbortSignal` for the currently running action |
| `store.$patch(obj\|fn)` | `Function` | Apply batched state changes |
| `store.$reset()` | `Function` | Reset store state back to raw initial state |
| `store.$snapshot()` | `Function` | Return an immutable deep clone of current state |
| `store.$restore(snap)` | `Function` | Restore state from a previous snapshot |
| `store.$transaction(fn)` | `Function` | Run multiple mutations as a single transaction |
| `store.$undo()` | `Function` | Undo the last mutation/transaction |
| `store.$redo()` | `Function` | Redo the previously undone mutation |
| `store.$cancel(action)` | `Function` | Explicitly abort an active in-flight action |
| `store.$watch(target, cb)` | `Function` | Watch store property or getter with auto-cleanup |
| `store.$subscribe(cb)` | `Function` | Subscribe to all store mutation records |
| `store.$dispose()` | `Function` | Flushes persistence and cleans up all watchers & managers |

---

## 🧪 Testing & Verification

Run the full automated test matrix (32 unit & real Helix core integration tests):

```bash
cd packages/helix-store
npm test
```

---

## 📄 License

MIT © [Helix.js Framework](https://github.com/pioneersingh321/helix_framework)
