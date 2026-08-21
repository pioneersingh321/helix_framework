# Helix Store Plugin (`Helix.store` / `Helix.defineStore`)

A modular, lightweight, signal-native reactive state management architecture for Helix.js. Designed for zero-build browser simplicity, enterprise scalability (HRMS/ERP), interactive builder/editor applications, and deep integration with Helix scopes and directives.

---

## 4-Tier Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Helix Store Plugin                            │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Core (Lightweight & Signal-Native)                                   │
│    • Helix.store() (Simple Store)    • Helix.defineStore() (Full Store) │
│    • Reactive State (ref/reactive)   • Cached Computed Getters          │
│    • Actions & Methods               • storeToRefs()                    │
│    • $patch() & $state replacement   • $reset()                         │
│    • $watch() (Targeted Path Watch)  • $subscribe() (State Observer)    │
│    • $readonly (Immutable View)      • $dispose() (Lifecycle Cleanup)   │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Advanced Application Layer                                           │
│    • $transaction() (Atomic Batches) • $snapshot() / $restore()         │
│    • Transaction-based Undo / Redo   • $select() (Selector Slices)      │
│    • Store Events ($emit / $on)      • $onAction() Interceptors         │
│    • Async Action State ($loading)   • Request Cancellation ($cancel)   │
│    • Hierarchical Namespaces         • Lazy Store Initialization        │
│    • Declarative Store Injection     • Testing & Mocking Isolation      │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Optional Pluggable Modules                                           │
│    • Persistence Drivers             • Schema Validation Engine         │
│    • Cross-Tab Sync (Broadcast)      • Optimistic Network Rollback      │
│    • DevTools & Timeline Inspector                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. Helix Core Integration                                               │
│    • Scope Integration (Helix.scope) • Template Context Auto-Injection  │
│    • Directive Auto-Binding          • AppContext Isolation & Safety    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Design Philosophy: Helix-Native over Pinia Clone

> **Guiding Principle:** Use Pinia for proven architectural concepts, but make the implementation **100% Helix-Native**.

```
Pinia (Proven State Concepts)
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Helix Store Plugin                       │
├─────────────────────────────────────────────────────────────┤
│  • Helix Reactive Primitives (ref, reactive, computed)      │
│  • Helix Scopes & Directive Isolation (hx-scope)            │
│  • Helix Template Directives (hx-model, hx-bind, @click)   │
│  • Helix Lifecycle & Effect-Scope Teardown                  │
│  • Helix Namespace Engine (app.namespace('store', ...))     │
│  • Zero-Build Browser Architecture (<script> native)        │
└─────────────────────────────────────────────────────────────┘
```

Helix Store is designed to feel like an authentic, cohesive part of the Helix ecosystem. It avoids unnecessary abstractions, keeping overhead near zero while delivering a unified mental model across JS and HTML templates:

### The Access Triad

```
┌───────────────────────────────┬─────────────────────────────────┬───────────────────────────────┐
│       JavaScript Access       │        Store Definition         │        Template Access        │
│        Helix.store()          │       Helix.defineStore()       │        $store or store        │
├───────────────────────────────┼─────────────────────────────────┼───────────────────────────────┤
│ • Instant simple stores       │ • Enterprise domain stores      │ • Direct template binding     │
│ • Zero-ceremony state object  │ • Options or Composable setup   │ • Works in hx-model, hx-if,   │
│ • Direct read/write in JS     │ • Actions & cached getters      │   hx-bind, and @click         │
│ • Retrieve existing stores    │ • Lifecycle & dependency guards │ • Both $store and store work! │
└───────────────────────────────┴─────────────────────────────────┴───────────────────────────────┘
```

1. **JavaScript Direct Access (`Helix.store`):** Instant reactive state without ceremony for builders, widgets, and simple pages (`Helix.store('builderStore', { currentStageId: null })`).
2. **Store Definition (`Helix.defineStore`):** Full structure with actions, cached computed getters, and lifecycle controls for large-scale applications (HRMS, ERP, complex interactive editors).
3. **Template Direct Access (`$store` or `store`):** Zero-boilerplate global directive binding in templates (`<button @click="store.builderStore.deleteStage(10)">` or `<button @click="$store.builderStore.deleteStage(10)">`).

---

## Feature Priority Matrix

| Priority | Feature | Implementation Type | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **P0** | `Helix.store()` | **Core** | Instant lightweight reactive object store |
| **P0** | `Helix.defineStore()` | **Core** | Structured domain store (Options & Setup flavors) |
| **P0** | Reactive State | **Core** | Deep signal reactivity via Helix `ref()` / `reactive()` |
| **P0** | Getters / Computed | **Core** | True cached signal getters via `Helix.computed()` |
| **P0** | Actions & Methods | **Core** | Sync & async methods bound to store context |
| **P0** | `$patch()` | **Core** | Batched object or function state mutations |
| **P0** | `$reset()` | **Core** | Restore store to initial definition state |
| **P0** | `$state` | **Core** | Direct root state replacement & snapshot ingestion |
| **P0** | `$dispose()` | **Core** | Explicit store teardown & effect scope cleanup |
| **P1** | `$subscribe()` | **Core** | Global store mutation listener with metadata |
| **P1** | `$watch()` | **Core** | Targeted path / expression watcher |
| **P1** | `$transaction()` | **Core** | Group multi-step mutations into 1 atomic cycle |
| **P1** | `$snapshot()` / `$restore()` | **Core** | Instant immutable state snapshotting & rollback |
| **P1** | `$select()` | **Core** | Granular state slice selectors to minimize re-renders |
| **P1** | `$onAction()` | **Core** | Action execution hooks, error boundaries & telemetry |
| **P1** | Cross-Store Composition | **Core** | Lazy dependency injection & inter-store calls |
| **P2** | Persistence | **Plugin** | Pluggable storage drivers (`localStorage`, `sessionStorage`) |
| **P2** | Undo / Redo History | **Module** | Transaction-based logical history stack |
| **P2** | DevTools Inspector | **Plugin** | State tree viewer, action log & mutation timeline |
| **P2** | Cross-Tab Synchronization | **Plugin** | Real-time `BroadcastChannel` multi-window sync |
| **P2** | Schema Validation | **Plugin** | Delegation to `helix-validation` rule engine |
| **P3** | IndexedDB Driver | **Extension** | Asynchronous persistent storage for large payloads |
| **P3** | Optimistic UI Rollback | **Extension** | Automatic mutation reversion on network failure |
| **P3** | SSR Hydration | **Extension** | Server state extraction and client hydration |

---

## Table of Contents

- [1. Dual API: Simple Stores vs. Defined Stores](#1-dual-api-simple-stores-vs-defined-stores)
- [2. Hierarchical Store Namespaces](#2-hierarchical-store-namespaces)
- [3. Read-Only State Views (`$readonly`)](#3-read-only-state-views-readonly)
- [4. True Computed / Getter Caching](#4-true-computed--getter-caching)
- [5. Lazy Store Initialization & Formalized Dependencies](#5-lazy-store-initialization--formalized-dependencies)
- [6. Store Domain Events (`$emit` / `$on`) vs. State Subscriptions](#6-store-domain-events-emit--on-vs-state-subscriptions)
- [7. Transaction Engine (`$transaction`)](#7-transaction-engine-transaction)
- [8. Transaction-Based History (`$undo` / `$redo`)](#8-transaction-based-history-undo--redo)
- [9. Pluggable Persistence Engine](#9-pluggable-persistence-engine)
- [10. Scope-Local Stores (`Helix.scope` Integration)](#10-scope-local-stores-helixscope-integration)
- [11. Dependency-Aware Store Injection](#11-dependency-aware-store-injection)
- [12. Targeted Watching (`$watch`) & Selectors (`$select`)](#12-targeted-watching-watch--selectors-select)
- [13. Automatic Async Action State & Request Cancellation](#13-automatic-async-action-state--request-cancellation)
- [14. Store Snapshots & Hydration (`$snapshot` / `$restore`)](#14-store-snapshots--hydration-snapshot--restore)
- [15. Destructuring Reactivity: `storeToRefs()`](#15-destructuring-reactivity-storetorefs)
- [16. DevTools Inspector & Mutation Timeline](#16-devtools-inspector--mutation-timeline)
- [17. Core Integration & AppContext Isolation](#17-core-integration--appcontext-isolation)
- [18. Phased Roadmap & Package Structure](#18-phased-roadmap--package-structure)

---

## 1. Dual API: Simple Stores vs. Defined Stores

Developers have two distinct authoring needs: quick reactive shared objects vs. enterprise-grade domain models.

### A. Simple Store (`Helix.store`)
Ideal for lightweight shared state across widgets, builders, or pages without boilerplate:
```javascript
// 1. Create and retrieve in one step
const builder = Helix.store('builderStore', {
  currentStageId: null,
  currentElementId: null,
  zoom: 1.0
});

// 2. Mutate directly:
builder.zoom = 1.25;

// 3. Retrieve later anywhere in JS:
const sameBuilder = Helix.store('builderStore');
console.log(sameBuilder.zoom); // 1.25
```

#### 🛡️ Idempotent Resolution & Anti-Destruction Lifecycle
`Helix.store(name, [initialState])` follows a strict lifecycle to prevent accidental state destruction:
```
Helix.store(name, initialState)
       │
       ├── Absent   ──► Creates new reactive store with initialState
       └── Existing ──► Returns EXISTING store instance (initialState is ignored, NOT overwritten)
```
- Calling `Helix.store('builderStore', { currentStageId: 20 })` a second time will **never** overwrite an existing store.
- If deliberate state replacement is desired, use explicit assignments: `store.$state = newState` or `store.$patch(newState)`.

---

### B. Defined Store (`Helix.defineStore`)
For domain logic with actions, computed getters, hooks, and lifecycle management:
```javascript
// 1. Options syntax
const useCartStore = Helix.defineStore('cart', {
  state: () => ({ items: [] }),
  getters: {
    total: (state) => state.items.reduce((acc, i) => acc + i.price, 0)
  },
  actions: {
    addItem(item) { this.items.push(item); }
  }
});

// 2. Composable / Setup syntax
const useAuthStore = Helix.defineStore('auth', () => {
  const user = Helix.ref(null);
  const isLoggedIn = Helix.computed(() => user.value !== null);
  function logout() { user.value = null; }
  return { user, isLoggedIn, logout };
});

// 3. Usage in JavaScript:
const cart = useCartStore(); // or Helix.store('cart')
```

---

### C. 100% Native Reactivity Compatibility

Because Helix Store is built natively on Helix's signal and proxy core, **every reactive primitive from Helix.js works directly inside stores**:

| Helix Reactive Primitive | Usage in Helix Store | Example |
| :--- | :--- | :--- |
| **`ref()` / `reactive()`** | Standard deep reactive state | `const count = Helix.ref(0);` |
| **`shallowRef()` / `shallowReactive()`** | High-performance large data (bypasses deep proxying) | `const largeDataset = Helix.shallowRef([]);` |
| **`computed()` (with getters/setters)** | Signal-cached derived values with optional write support | `const fullName = Helix.computed({ get: () => ..., set: (v) => ... });` |
| **`watch()` / `watchEffect()`** | Side-effects & auto-tracked reactions inside setup stores | `Helix.watchEffect(() => syncDraft(user.value));` |
| **`readonly()` / `shallowReadonly()`** | Immutable state views | `const safeConfig = Helix.readonly(config);` |
| **`toRef()` / `toRefs()`** | Retain reactive bindings when destructuring properties | `const { items } = Helix.toRefs(store.$state);` |
| **`toRaw()`** | Extract raw plain JavaScript objects (e.g. before posting to API) | `const rawData = Helix.toRaw(store.$state);` |
| **`markRaw()`** | Prevent third-party instances (e.g., Chart.js, Leaflet, Editor) from proxying | `store.editorInstance = Helix.markRaw(new Quill('#editor'));` |
| **`nextTick()`** | Await DOM updates after store mutations | `store.count++; await Helix.nextTick();` |
| **`effectScope()`** | Atomic lifecycle teardown of all store effects and watchers | Handled internally on `$dispose()` |

#### Example: Setup Store Utilizing All Primitives
```javascript
Helix.defineStore('editorStore', () => {
  // 1. Primitive & Object State
  const zoom = Helix.ref(1.0);
  const elements = Helix.reactive([]);
  
  // 2. Shallow Ref for Heavy Canvas Engine (Never deep-proxied)
  const engine = Helix.shallowRef(null);

  // 3. Computed with Getter & Setter
  const activeElement = Helix.computed({
    get: () => elements.find(e => e.active) || null,
    set: (elem) => { elements.forEach(e => e.active = (e.id === elem?.id)); }
  });

  // 4. Auto-tracking WatchEffect
  Helix.watchEffect(() => {
    if (zoom.value < 0.2) zoom.value = 0.2; // Enforce bounds
  });

  // 5. Raw Third-Party Library Integration
  function attachCanvas(canvasEl) {
    engine.value = Helix.markRaw(new ThirdPartyCanvasEngine(canvasEl));
  }

  return { zoom, elements, engine, activeElement, attachCanvas };
});
```

---

## 2. Hierarchical Store Namespaces

For large enterprise applications (HRMS, ERP, Multi-step Flow Builders), dot or slash notation organizes store instances logically without collisions:

```javascript
// Dot notation
Helix.store('builder.stage', { currentId: 10 });
Helix.store('builder.element', { activeElement: null });

// Slash notation
Helix.defineStore('hrms/payroll', { ... });
Helix.defineStore('hrms/employees', { ... });

// Retrieval in JS
const stage = Helix.store('builder.stage');
const payroll = Helix.store('hrms/payroll');
```

---

## 3. Read-Only State Views (`$readonly`)

Expose state to views, consumer services, or child components without permitting arbitrary external mutations.

> **Implementation Note:** Built directly on Helix core's native `readonly()` primitive from `reactive.js` (`readonly(state)`). `readonly()` internally extracts `target[RAW]` when passed a reactive proxy.

```javascript
const authStore = Helix.defineStore('auth', {
  state: () => ({ token: 'xyz123', user: { name: 'Alice' } }),
  actions: {
    setToken(token) { this.token = token; }
  }
});

const auth = Helix.store('auth');

// Read-only reactive proxy
const safeAuth = auth.$readonly;

console.log(safeAuth.token); // 'xyz123'
safeAuth.token = 'hacked';   // ⚠️ Warning in dev & mutation blocked!
```

---

## 4. True Computed / Getter Caching & Accessor Layer

Getters in Helix Store are backed directly by Helix signal primitives (`Helix.computed`), ensuring:
1. **Dependency Tracking:** Only tracks reactive properties read during getter evaluation.
2. **Signal Invalidation:** Marks dirty when dependencies change.
3. **Lazy Recomputation:** Evaluates strictly when accessed, avoiding expensive recalculations on unread state mutations.

```
State Change  ──►  Invalidate Signal  ──►  Recompute ONLY on Access
```

### ⚠️ Explicit Getter Accessor Architecture in `store-instance.js`
Helix's core `reactive.js` and `readonly.js` proxy traps do not automatically unwrap `ref`/`computed` objects stored on plain objects (they recurse on objects). Therefore, `store-instance.js` binds getters directly via `Object.defineProperty`:

```javascript
// Inside store-instance.js
Object.keys(getters).forEach(key => {
  const computedRef = Helix.computed(() => getters[key].call(storeInstance, storeState));
  
  // Explicit getter accessor ensures .value unwrapping in both JS and templates
  Object.defineProperty(storeInstance, key, {
    get: () => computedRef.value,
    enumerable: true,
    configurable: true
  });
});
```

---

## 5. Lazy Store Initialization & Circular Dependency Detection

Stores are never eagerly initialized when Helix boots. Memory allocation and signal scopes are created strictly on the **first request**.

```
Helix Boots ──► Registry Empty ──► Component requests "builder" ──► Store Instantiated
```

### Circular Dependency Guard (with `try/finally` Error Safety)
To prevent infinite recursion while avoiding lock poisoning if an initializer throws an unrelated runtime error, `store-manager.js` wraps store creation in `try ... finally`:

```javascript
// store-manager.js
if (initializingStores.has(storeId)) {
  const chain = Array.from(initializingStores).concat(storeId).join(' -> ');
  throw new Error(`[Helix:Store] Circular dependency detected during store initialization: ${chain}`);
}

initializingStores.add(storeId);
try {
  return createStoreInstance(storeId, definition, appContext);
} finally {
  // Always release lock so errors don't cause phantom circular dependency errors on retry
  initializingStores.delete(storeId);
}
```

---

## 6. Store Domain Events (`$emit` / `$on`) vs. State Subscriptions

Clear architectural separation between state observation and domain messaging:

* **`$subscribe()`** = *State changed* (property mutations, snapshots).
* **`$on()` / `$emit()`** = *Domain events* (explicit actions, signals, lifecycle events).

```javascript
const empStore = Helix.store('employee');

// Listen for domain events
const off = empStore.$on('employee:selected', (employee) => {
  Helix.notify.info(`Selected: ${employee.name}`);
});

// Emit domain event from action or workflow
empStore.$emit('employee:selected', { id: 42, name: 'Sarah' });

// State subscription (separate purpose)
empStore.$subscribe((mutation, state) => {
  console.log('State mutated:', mutation.type);
});
```

---

## 7. Transaction Engine (`$transaction`)

Execute multiple state mutations as a single atomic unit.

### Dispatch Gate Architecture
Unlike reactivity scheduling (`queueJob`), `$transaction` does not pause signal tracking. Directives and live DOM bindings (`hx-model`, `hx-text`) continue reacting immediately. Instead, `$transaction` manages a **subscription dispatch gate**:

1. Sets `inTransaction = true` on the store.
2. Lets mutations execute and `trigger()` effects live.
3. Buffers intermediate mutations into a transaction record.
4. On completion, resets `inTransaction = false` and dispatches **one aggregated mutation record** to `$subscribe` listeners and history.

```javascript
const builder = Helix.store('builder', {
  currentStageId: 1,
  currentElementId: null,
  zoom: 1.0
});

// 3 mutations collapsed into 1 atomic history & subscription event
builder.$transaction(() => {
  builder.currentStageId = 10;
  builder.currentElementId = 25;
  builder.zoom = 1.2;
}, 'Change Stage & Zoom');
```

---

## 8. Transaction-Based History (`$undo` / `$redo`)

Instead of polluting history with low-level property changes (`width`, `height`, `title`), history tracks logical transactions:

```
History Timeline
───────────────────────────────────────
1. Create Canvas
2. Add Button Element
3. Resize & Re-position  ◄─ [Current]
4. Change Background Color
```

```javascript
const store = Helix.defineStore('canvas', {
  state: () => ({ elements: [], selectedId: null }),
  history: { max: 50 }
});

store.$transaction(() => {
  store.elements.push({ id: 1, type: 'box', w: 100, h: 100 });
  store.selectedId = 1;
}, 'Add Box');

// Reverts the entire logical transaction
store.$undo();
console.log(store.elements.length); // 0

store.$redo();
console.log(store.elements.length); // 1
```

---

## 9. Storage Modes & Pluggable Persistence Engine

By default, every Helix store is **pure in-memory (variable only)** with zero storage overhead. When persistence is needed, it can be enabled declaratively per store with a simple string or configuration object.

### Storage Modes at a Glance

| Mode | Configuration | Lifetime | Use Case |
| :--- | :--- | :--- | :--- |
| **Variable Only (Default)** | `persist: false` *(or omitted)* | Active page session / RAM | Fast, ephemeral UI state, modals, active builders |
| **Session Storage** | `persist: 'session'` | Tab lifetime (survives refresh) | Multi-step wizards, checkout drafts, filter forms |
| **Local Storage** | `persist: true` or `'local'` | Permanent (across browser restarts) | User preferences, theme, auth tokens, layout state |
| **IndexedDB / LocalDB** | `persist: { driver: 'indexedDB' }` | Permanent (async large storage) | Offline data, heavy caches, draft catalogs |

---

### Usage Examples

#### 1. In-Memory Only (Default / Variable Only)
```javascript
// Pure in-memory reactive variable - zero storage overhead
const builder = Helix.store('builderStore', {
  currentStageId: null,
  activeElement: null
});
```

#### 2. Session Storage (Survives Refresh, Cleared on Tab Close)
```javascript
// Simple string shorthand:
Helix.defineStore('wizard', {
  state: () => ({ step: 1, answers: {} }),
  persist: 'session'
});
```

#### 3. Local Storage (Permanent)
```javascript
// Simple boolean shorthand:
Helix.defineStore('settings', {
  state: () => ({ theme: 'dark', sound: true }),
  persist: true
});
```

#### 4. Granular Configuration (Selective Keys, Expiration & Custom Drivers)
```javascript
Helix.defineStore('userSession', {
  state: () => ({ 
    token: '', 
    theme: 'dark', 
    temporarySearch: '' 
  }),
  persist: {
    driver: 'localStorage', // 'localStorage' | 'sessionStorage' | 'indexedDB' | custom
    key: 'hx_user_session',
    paths: ['token', 'theme'], // Only persist these keys; temporarySearch remains in-memory
    expiresIn: 7 * 24 * 60 * 60 * 1000 // 7 days TTL
  }
});
```

---

### Pluggable Async-Compatible Driver Interface

Persistence drivers adhere to a unified interface that supports both synchronous and asynchronous drivers (e.g. `IndexedDB` or remote adapters):

```typescript
interface StoreStorageDriver {
  get(key: string): any | Promise<any>;
  set(key: string, value: any): void | Promise<void>;
  remove(key: string): void | Promise<void>;
  clear(): void | Promise<void>;
}
```

---

## 10. Scope-Local Stores (`Helix.scope` Integration)

Stores can be attached to Helix Scopes (`helix-scope`). When the scope unmounts, the store is automatically disposed.

> **Graceful Degradation:** Scope integration is an optional enhancement (`requires: { 'helix-scope': '^2.0.0' }`). If `helix-scope` is not installed, calling `scope.store()` outputs a dev warning and gracefully falls back to an app-level store.

```html
<!-- Inside a scoped template boundary -->
<div hx-scope="builder as builderScope">
  <span>Active Stage: {{ $store.currentStageId }}</span>
</div>
```

```javascript
// Bound directly to a Helix Scope lifecycle
const scope = Helix.scope('builder');

scope.store('builderLocal', {
  currentStageId: 10,
  temporarySelection: []
});
```

---

## 11. Dependency-Aware Store Injection

Explicitly declare store dependencies for auto-injection into store actions:

```javascript
Helix.defineStore('payroll', {
  dependencies: ['auth', 'company'],
  state: () => ({ records: [] }),
  actions: {
    async loadPayroll() {
      // Injected automatically on `this`
      if (!this.auth.isLoggedIn) throw new Error('Unauthenticated');
      const companyId = this.company.currentId;
      this.records = await api.getPayroll(companyId, this.auth.token);
    }
  }
});
```

---

## 12. Targeted Watching (`$watch`) & Selectors (`$select`)

### A. Targeted `$watch`
Watch a specific state slice or computed expression rather than the full store:
```javascript
const store = Helix.store('builder');

const unwatch = store.$watch(
  () => store.currentStageId,
  (newStage, oldStage) => {
    console.log(`Stage changed from ${oldStage} to ${newStage}`);
  }
);
```

### B. Fine-Grained `$select` & Ref Unwrapping Rules
`$select(fn)` wraps `Helix.computed(() => fn(state))`.

```javascript
// Component A only re-evaluates when currentStageId changes
const currentStageId = store.$select(state => state.currentStageId);
```

#### ⚠️ Critical Ref Unwrapping Contract:
- **In JavaScript:** `$select()` returns a `ComputedRef`. Access its value via `.value` (`currentStageId.value`).
- **In Templates:** Helix's template compiler (`compiler.js`) automatically unwraps refs at the final path segment, so `{{ currentStageId }}` or `{{ $store.builder.currentStageId }}` evaluates seamlessly without `.value`.
- **On Store Proxies:** Store property getters (e.g. `store.netBalance`) use `Object.defineProperty` to automatically unwrap `.value` on property access in both JS and templates.

---

## 13. Automatic Async Action State & Request Cancellation

### A. Auto-Tracked Action Status
Stores automatically expose `$loading` and `$errors` dictionaries for async actions:
```javascript
const empStore = Helix.defineStore('employees', {
  state: () => ({ list: [] }),
  actions: {
    async fetchEmployees() {
      this.list = await api.getEmployees();
    }
  }
});

const emp = Helix.store('employees');
```
```html
<button @click="emp.fetchEmployees()" :disabled="emp.$loading.fetchEmployees">
  <span hx-if="emp.$loading.fetchEmployees">Loading...</span>
  <span hx-if="!emp.$loading.fetchEmployees">Refresh</span>
</button>
<p hx-if="emp.$errors.fetchEmployees" class="error">{{ emp.$errors.fetchEmployees }}</p>
```

### B. Request Cancellation & `AbortError` Handling
Actions can accept an `AbortSignal` for cancellation via `$cancel()`.

```javascript
Helix.defineStore('search', {
  actions: {
    async searchUsers(query, { signal }) {
      return await fetch(`/api/users?q=${query}`, { signal }).then(r => r.json());
    }
  }
});

// Trigger cancellation
store.$cancel('searchUsers');
```

> **Important `AbortError` Rule in `async-state.js`:** When an action is canceled, the catch handler checks `if (error.name === 'AbortError' || error.code === 20)`. It resets `$loading.searchUsers = false` and **suppresses populating `$errors.searchUsers`**, preventing false error alerts in UI templates.

---

## 14. Store Snapshots & Hydration (`$snapshot` / `$restore`)

Capture complete immutable state snapshots for debugging, testing, or optimistic rollbacks:

```javascript
const store = Helix.store('canvas');

// Capture state
const savedState = store.$snapshot();

// Mutate
store.zoom = 2.5;

// Restore
store.$restore(savedState);
```

---

## 15. Destructuring Reactivity: `storeToRefs()`

Extract reactive refs from stores without breaking signal reactivity bindings:

```javascript
Helix.createApp({
  setup() {
    const store = Helix.store('cart');
    
    // Properties become reactive refs; methods remain intact
    const { items, total } = Helix.storeToRefs(store);
    const { addItem } = store;

    return { items, total, addItem };
  }
}).mount('#app');
```

---

## 16. DevTools Inspector & Mutation Timeline

A dedicated inspection layer hooking into `Helix.globalConfig.debug`:

```
┌─────────────────────────────────────────────────────────────┐
│                     Helix Store DevTools                    │
├──────────────────────────────┬──────────────────────────────┤
│ Stores                       │ State                        │
│ • auth                       │ currentStageId:   10         │
│ • builder.stage  ◄─ Selected │ currentElementId: 25         │
│ • hrms/payroll               │ zoom:             1.2        │
├──────────────────────────────┼──────────────────────────────┤
│ Action History               │ Mutation Timeline            │
│ 12:40:01  auth/login         │ 12:40:01 [Direct] token      │
│ 12:40:05  builder/$transact  │ 12:40:05 [Tx] Change Stage   │
│ 12:40:10  builder/selectElem │ 12:40:10 [Patch] elementId   │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 17. Core Integration & AppContext Isolation

### 1. Multi-App Page Isolation
Store registries are created on the active `appContext` (`app._storeRegistry = new Map()`). `Helix.store` safely resolves the active app and warns on ambiguous multi-app pages.

### 2. Proposed Helix Core PRs for Zero-Boilerplate Template Access

To enable seamless template access without manual setup exports, we propose two explicit Core PRs:

#### Core PR #1: Dollar-Prefixed Plugin Context Merging
In `app.js`, mirror all three core rootComponent mounting branches (`function`, `setup`, or fallback) before merging `$`-prefixed properties from `pluginAPI`. User-returned properties take precedence:

```javascript
// app.js mount pipeline:
let userCtx;
if (typeof rootComponent === "function") {
  userCtx = rootComponent(appCtx);
} else if (rootComponent && rootComponent.setup) {
  userCtx = rootComponent.setup(appCtx);
} else {
  userCtx = Helix.reactive({});
}

const dollarPlugins = Object.fromEntries(
  Object.entries(pluginAPI).filter(([k]) => k.startsWith('$'))
);

// User-returned context explicitly takes precedence over default plugin bindings:
const finalCtx = { ...dollarPlugins, ...userCtx };
```

#### Core PR #2: Async Root Setup Support (Optional / Distinct PR)
Align root `createApp.mount()` with component mount logic (`mount.js`) to await `setup()` if it returns a Promise.

---

## 18. Phased Roadmap & Package Structure

### Phased Delivery Strategy

| Phase | Milestone | Features |
| :--- | :--- | :--- |
| **Phase 1** | **Core Runtime** | `Helix.store()`, `Helix.defineStore()`, reactive state, cached getters (via `Object.defineProperty`), actions, `storeToRefs()`, `$patch()`, `$reset()`, `$state`, `$watch()`, `$subscribe()`, `$dispose()`, template auto-injection |
| **Phase 2** | **Advanced Layer** | `$transaction()`, transaction-based `$undo()`/`$redo()`, `$snapshot()`/`$restore()`, `$readonly`, `$select()`, `$onAction()`, store events (`$emit`/`$on`), namespaces, lazy initialization with `try/finally` cycle detection |
| **Phase 3** | **Async & Scopes** | `$loading`/`$errors` auto-tracking, `$cancel` AbortController with AbortError filtering, `Helix.scope` integration with graceful degradation |
| **Phase 4** | **Pluggable Modules** | Persistence drivers (`localStorage`, `sessionStorage`, `IndexedDB`), DevTools timeline, Schema validation delegation, Broadcast cross-tab sync |

---

### Package Structure

```text
packages/
└── helix-store/
    ├── src/
    │   ├── index.js              # Plugin entry, auto-install, version guarding
    │   ├── store-manager.js      # AppContext registry & try/finally circular guard
    │   ├── define-store.js       # Options & Setup store builder
    │   ├── simple-store.js       # Lightweight Helix.store() implementation
    │   ├── store-instance.js     # Store proxy & Object.defineProperty getter/select accessor layer
    │   ├── transactions.js       # $transaction dispatch-gating engine
    │   ├── history.js            # Transaction-based Undo / Redo stack
    │   ├── events.js             # Store domain event bus ($emit, $on)
    │   ├── async-state.js        # $loading, $errors, and $cancel (AbortError filtering)
    │   ├── store-to-refs.js      # storeToRefs() reactive ref extraction
    │   ├── subscriptions.js      # $subscribe and $watch watchers
    │   ├── scope-binding.js      # Helix.scope integration & degradation handler
    │   ├── plugins/
    │   │   ├── persistence.js    # Multi-driver storage adapters
    │   │   ├── sync-tabs.js      # BroadcastChannel cross-tab sync
    │   │   └── devtools.js       # Mutation timeline & DevTools inspector
    │   └── utils.js              # Deep clone, proxy traps, and diffing utilities
    │
    ├── dist/
    │   ├── helix-store.js
    │   └── helix-store.min.js
    │
    ├── package.json
    ├── vite.config.js
    └── README.md
```
> **Architecture Note on Getters:** Rather than maintaining a detached `computed-getters.js` micro-file, getter caching and `$select` evaluation are unified directly inside `store-instance.js` via `Helix.computed()` and `Object.defineProperty` accessors.


