# Helix.js

A lightweight, Vue-inspired reactive JavaScript framework — signal-native reactivity, declarative HTML directives, components, and a plugin ecosystem, all in a single dependency-free file that runs directly in the browser.

**Version:** `11.1.19` · **Size:** single file, no build step · **License:** MIT

---

## Table of contents

- [Why Helix](#why-helix)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Reactivity API](#reactivity-api)
- [Template directives](#template-directives)
- [Components](#components)
- [Lifecycle hooks](#lifecycle-hooks)
- [Dependency injection](#dependency-injection)
- [Event bus](#event-bus)
- [Plugins & namespaces](#plugins--namespaces)
- [Configuration](#configuration)
- [Full API reference](#full-api-reference)
- [Contributing](#contributing)

---

## Why Helix

- **No build step.** Drop in one `<script>` tag and write reactive UIs directly in your HTML.
- **Fine-grained reactivity.** A proxy-based signal system with `ref`, `reactive`, `computed`, `effect`, and `watch`, modeled on the Vue 3 reactivity core.
- **Declarative directives.** `hx-if`, `hx-for`, `hx-model`, `hx-bind`, `hx-on`, and more, with `:` and `@` shorthands.
- **Composable.** Components with `setup()`, props, emits, slots, provide/inject, and an effect-scope-based cleanup model.
- **Extensible.** A first-class plugin system with versioned dependencies, namespaces, and lifecycle-managed teardown.

---

## Installation

### Browser (recommended)

```html
<script src="helix_v11-1-7.js"></script>
<script>
  // Helix is available on the global object as `window.Helix`
  const { createApp, ref } = Helix;
</script>
```

### Via a module wrapper

The file attaches to `window.Helix`. If you use a bundler, import it for its side effect and read from the global, or wrap it in your own ES module re-export.

```js
import "./helix_v11-1-7.js";
const { createApp, reactive, computed } = window.Helix;
```

---

## Quick start

```html
<div id="app">
  <h1>{{ title }}</h1>
  <p>Count is {{ count }}</p>
  <button @click="increment">+1</button>
  <input hx-model="title" />
</div>

<script src="helix_v11-1-7.js"></script>
<script>
  const { createApp, ref } = Helix;

  createApp({
    setup() {
      const title = ref("Hello Helix");
      const count = ref(0);
      const increment = () => count.value++;

      // Whatever you return becomes the template context.
      return { title, count, increment };
    }
  }).mount("#app");
</script>
```

`mount()` is asynchronous (it awaits any async plugins), so you can `await app.mount("#app")` if you need to run code after the first render.

### Shorthand: mount in one call

```js
Helix.mount("#app", () => {
  const count = Helix.ref(0);
  return { count, inc: () => count.value++ };
});
```

---

## Core concepts

Helix separates **state** (reactive data) from **template** (HTML annotated with directives). You describe state in a `setup()` function and return it; the framework tracks which pieces of state each directive reads and updates the DOM automatically when they change.

Text interpolation uses double braces by default:

```html
<span>{{ user.name }}</span>
```

Directives are HTML attributes prefixed with `hx-` (configurable), with `:` as shorthand for `hx-bind` and `@` as shorthand for `hx-on`.

---

## Reactivity API

### `ref(value)`

A single reactive value. Read and write through `.value`. If an object is passed, it is deeply converted using `reactive()` so nested property mutations automatically trigger dependent effects. For raw, shallow references without deep proxying, use `shallowRef()`.

```js
const count = ref(0);
count.value++;            // triggers dependents
console.log(count.value); // 1

// Deep object reactivity (Vue 3 parity)
const user = ref({ profile: { name: "Ada" } });
user.value.profile.name = "Grace"; // triggers updates
```

### `reactive(object)`

A deeply reactive proxy of an object or array.

```js
const state = reactive({ user: { name: "Ada" }, todos: [] });
state.user.name = "Grace"; // reactive
state.todos.push("Ship");  // array mutations are reactive
```

### `computed(getter)`

A cached, lazily-evaluated derived value. Recomputes only when a dependency it actually read changes.

```js
const first = ref("Ada");
const last = ref("Lovelace");
const full = computed(() => `${first.value} ${last.value}`);
console.log(full.value); // "Ada Lovelace"
```

### `effect(fn, options?)`

Runs `fn` immediately and re-runs it whenever its reactive dependencies change. Returns a runner with a `.stop()` method.

```js
const stop = effect(() => {
  document.title = `Count: ${count.value}`;
});
stop(); // stop reacting
```

### `watch(source, callback, options?)`

Watches a ref, a reactive object, or a getter function and calls back with the new and old values. Supports `{ immediate, deep, flush }`.

```js
watch(() => state.user.name, (next, prev) => {
  console.log(`name changed from ${prev} to ${next}`);
});

// Watching a ref passes the unwrapped value to the callback:
watch(count, (n) => console.log(n));
```

### `watchEffect(fn, options?)`

Like `effect`, but integrates with the scheduler flush timing (`pre` / `post` / `sync`) and supports an `onCleanup` callback for cancelling stale side effects.

```js
watchEffect((onCleanup) => {
  const id = setInterval(tick, 1000);
  onCleanup(() => clearInterval(id));
});
```

### Reactive Collections (`Map`, `Set`, `Date`)

Helix proxies `Map`, `Set`, and `Date` instances with deep reactivity:

```js
// Reactive Map
const map = reactive(new Map());
map.set("user", "Alice");
console.log(map.get("user")); // Reactive read

// Reactive Set
const set = reactive(new Set());
set.add("admin");
console.log(set.has("admin")); // Reactive check

// Reactive Date
const date = reactive(new Date());
date.setFullYear(2027); // Mutator triggers dependent effects
```

### Tracking Controls & `untrack`

Pause and resume reactive dependency tracking or run a block without subscribing:

```js
// untrack: read state inside an effect without creating a subscription
effect(() => {
  const currentCount = untrack(() => state.count);
  console.log("Only runs when other tracked dependencies change", state.name);
});

// Bulk mutation tracking control:
Helix.pauseTracking();
state.a = 1;
state.b = 2;
Helix.resumeTracking();
```

### Utilities

| Helper | Purpose |
| --- | --- |
| `isReactive`, `isReadonly` | Checks whether an object is a reactive proxy or readonly wrapper |
| `shallowRef` / `shallowReactive` | Reactivity only at the top level |
| `readonly` / `shallowReadonly` | Immutable reactive views (supports Objects, Arrays, Maps, Sets) |
| `isRef`, `unref`, `toValue` | Ref inspection / unwrapping |
| `toRef`, `toRefs` | Convert reactive properties to refs |
| `toRaw`, `markRaw` | Escape / opt out of reactivity |
| `isProxy`, `isShallow` | Proxy inspection |
| `customRef` | Build a ref with custom track/trigger (e.g. debounced) |
| `triggerRef` | Force-trigger a `shallowRef` |
| `untrack` | Execute a function without tracking reactive dependencies |
| `pauseTracking` / `resumeTracking` | Stack-safe tracking pause/resume |
| `nextTick` | Await the next DOM flush |
| `EffectScope` / `effectScope` | Group effects for collective disposal |
| `onScopeDispose` | Register cleanup callback in the active scope or component |

---

## Template directives

All directives use the `hx-` prefix by default. `:x` is shorthand for `hx-bind:x` and `@x` is shorthand for `hx-on:x`.

### Anti-FOUC Cloaking — `hx-cloak`

Hides unmounted markup on slow-loading pages until Helix mounts. Injects `[hx-cloak] { display: none !important; }` automatically and strips the attribute once rendered:

```html
<div hx-cloak>
  <h1>{{ title }}</h1>
</div>
```

### Text & HTML

```html
<span hx-text="message"></span>   <!-- sets textContent -->
<div hx-html="richContent"></div> <!-- sets innerHTML (trusted content only) -->
<span>{{ message }}</span>       <!-- interpolation -->
```

### Attribute binding — `hx-bind` / `:`

```html
<a :href="url">link</a>
<img :src="avatar" :alt="name" />

<!-- Boolean attributes toggle presence -->
<button :disabled="isBusy">Save</button>
```

**Class bindings** accept a string or an object. Object keys may contain multiple space-separated classes:

```html
<i :class="{ 'ri-heart-fill text-danger': item.featured == '1', 'ri-heart-line': !item.featured }"></i>
```

**Style bindings** accept a string or an object:

```html
<div :style="{ color: theme.color, fontSize: size + 'px' }"></div>
```

### Event handling — `hx-on` / `@`

```html
<button @click="save">Save</button>

<!-- Inline call with arguments and the native event -->
<button @click="remove(item.id, $event)">Delete</button>

<!-- Event Modifiers -->
<form @submit.prevent="onSubmit">…</form>
<a @click.stop="noop">…</a>
<div @click.outside="closeModal">…</div>
<button @keydown.window.escape="close">Escape anywhere</button>
<input @keydown.enter="submit" />
```

**Supported Event Modifiers:**
- **DOM/Propagation:** `.prevent` (`preventDefault`), `.stop` (`stopPropagation`), `.self`, `.once`, `.passive`, `.capture`
- **Targeting:** `.outside` (detects clicks outside the element), `.window` (attaches to `window`), `.document` (attaches to `document`)
- **Key Filters:** `.enter`, `.escape`, `.tab`, `.space`, `.up`, `.down`, `.left`, `.right`, `.delete`
- **System Keys:** `.ctrl`, `.alt`, `.shift`, `.meta`

### Two-way binding — `hx-model`

Works with text inputs, textareas, checkboxes, radios, and selects with built-in modifiers:

```html
<!-- Default on input -->
<input hx-model="form.email" />

<!-- Modifiers -->
<input hx-model.lazy="form.username" />            <!-- Listens on 'change' -->
<input hx-model.debounce.300ms="searchQuery" />    <!-- Debounces state updates by 300ms -->
<input hx-model.trim="form.name" />                <!-- Trims leading/trailing whitespace -->
<input hx-model.number="form.age" type="number" /> <!-- Auto-coerces to numeric type -->

<input type="checkbox" hx-model="form.subscribe" />
<input type="radio" value="a" hx-model="form.choice" />
<select hx-model="form.country">…</select>
<select multiple hx-model="form.tags">…</select>
```

### Conditional rendering — `hx-if` / `hx-else-if` / `hx-else`

Multi-branch conditional rendering with full DOM element teardown and recreation:

```html
<div hx-if="status === 'loading'">
  <p>Loading data...</p>
</div>
<div hx-else-if="status === 'error'">
  <p>An error occurred.</p>
</div>
<div hx-else>
  <p>Content loaded successfully!</p>
</div>
```

### List rendering — `hx-for`

Iterate arrays, numbers (ranges), objects, Maps, and Sets:

```html
<!-- Array iteration with stable key -->
<ul>
  <li hx-for="item in items" :key="item.id">{{ item.name }}</li>
</ul>

<!-- Range iteration (1 to 5) -->
<div hx-for="n in 5">Page {{ n }}</div>

<!-- Object iteration (value, key) -->
<div hx-for="(val, key) in user">{{ key }}: {{ val }}</div>

<!-- Multi-root list item using <template hx-for> -->
<template hx-for="item in items" :key="item.id">
  <dt>{{ item.term }}</dt>
  <dd>{{ item.definition }}</dd>
</template>
```

### Subtree Skip — `hx-ignore` / `hx-static`

Tells Helix to ignore this element and its descendants. Ideal for 3rd-party non-reactive widgets (Leaflet maps, Chart.js, TinyMCE, CKEditor):

```html
<div id="chart-container" hx-ignore>
  <!-- Third-party library manipulates DOM here without interference -->
</div>
```

### Server State Hydration — `hx-data`

Allows server-side templates (PHP, Laravel, Django, Rails) to provide initial JSON state directly on the root element:

```html
<div id="app" hx-data='{"count": 10, "user": "Ada"}'>
  <span>{{ user }}: {{ count }}</span>
</div>
```

### Template refs & `$refs` — `hx-ref`

Access underlying DOM nodes directly via `ctx.$refs[name]`:

```html
<input hx-ref="emailInput" />
```

```js
setup({ $refs }) {
  onMount(() => {
    $refs.emailInput.focus();
  });
  return {};
}
```

### Visibility — `hx-show`

```html
<div hx-show="isVisible">Toggles display:none instead of removing</div>
```

---

## Components

Register components globally or per app, then use them as custom elements.

```js
const app = createApp({ setup() { return {}; } });

app.component("user-card", {
  setup({ props, emit, slots }) {
    const expanded = ref(false);
    const toggle = () => {
      expanded.value = !expanded.value;
      emit("toggled", expanded.value);
    };
    return { expanded, toggle, name: props.name };
  },
  template: `
    <div class="card" @click="toggle">
      <strong>{{ name }}</strong>
      <p hx-show="expanded"><slot></slot></p>
    </div>
  `
});

app.mount("#app");
```

```html
<user-card name="Ada" @toggled="onToggle">Bio goes here</user-card>
```

The component `setup({ props, emit, slots, ... })` receives props, an `emit` function for custom events, `slots`, and the full reactivity/lifecycle API. Async `setup` functions are supported and awaited during mount.

---

## Lifecycle hooks

Call these inside `setup()`:

| Hook | Fires |
| --- | --- |
| `onBeforeMount(fn)` | Before the app/component is inserted |
| `onMount(fn)` / `onMounted(fn)` | After mount |
| `onUpdated(fn)` | After a reactive update flush |
| `onBeforeUnmount(fn)` | Before teardown |
| `onDestroy(fn)` / `onUnmounted(fn)` | After teardown |

```js
setup() {
  onMount(() => console.log("mounted"));
  onUnmounted(() => console.log("cleaned up"));
  return {};
}
```

---

## Dependency injection

Share values down the tree without prop-drilling.

```js
// Ancestor
setup() {
  provide("theme", reactive({ color: "indigo" }));
  return {};
}

// Descendant component
setup() {
  const theme = inject("theme", /* default */ { color: "gray" });
  return { theme };
}
```

You can also `app.provide(key, value)` at the app level.

---

## Event bus

Every app and the global object expose a `$bus` for decoupled messaging.

```js
Helix.$bus.on("notify", (msg) => console.log(msg));
Helix.$bus.once("ready", () => init());
Helix.$bus.emit("notify", "Saved!");
Helix.$bus.off("notify", handler);
```

Listeners registered inside a component or effect scope are cleaned up automatically when that scope is disposed. The bus methods are safe to destructure (`const { emit } = Helix.$bus`).

---

## Plugins & namespaces

Install functionality with `app.use(plugin, options)`. A plugin is an object with an `install` function and optional metadata.

```js
const MyPlugin = {
  name: "my-plugin",
  version: "1.0.0",
  requires: { "helix-model": ">=2.0.0" }, // optional versioned dependencies
  install(app, options) {
    // register directives, namespaces, provide values, etc.
    app.namespace("my", {
      hello: (name) => `Hi ${name}`
    });

    // Return an optional cleanup function run on unmount
    return () => { /* teardown */ };
  }
};

app.use(MyPlugin, { debug: true });
```

**Namespaces** expose grouped APIs on the app (`app.$my.hello("Ada")`). Plugins may also register directives via `app.directive(name, def)`. Both directives and namespaces can be removed with `app.removeDirective(name)` and `app.removeNamespace(name)` during cleanup.

The plugin **registry** lets you introspect what's installed:

```js
Helix.registry.list();            // [{ name, version, installedAt, hasCleanup }]
Helix.registry.has("helix-model");
Helix.registry.dependsOn("a", "b");
```

Version ranges support `>=`, `>`, `<=`, `<`, `^`, `~`, and exact matches, including semver pre-release ordering (`1.0.0-alpha` < `1.0.0`).

---

## Configuration

Global defaults live on `Helix.config` (sealed — you can change values, not shape):

```js
Helix.config.debug = true;         // enable [Helix] warnings
Helix.config.prefix = "hx-";       // directive prefix
Helix.config.delimiters = ["{{", "}}"];
Helix.config.allowInlineExpressions = false; // enable with caution (uses new Function)
Helix.config.removeAttributeBindings = true;
Helix.config.rethrowErrors = true;
Helix.config.slowThreshold = 2;    // ms; perf tracing threshold
Helix.config.htmxIntegration = false; // auto-rebind on HTMX swap
Helix.config.autoInjectCloak = true;  // auto-inject cloak style rules
```

| Option | Default | Description |
| --- | --- | --- |
| `debug` | `false` | Emit developer warnings via `console.warn` |
| `prefix` | `"hx-"` | Directive attribute prefix |
| `delimiters` | `["{{", "}}"]` | Text interpolation delimiters |
| `allowInlineExpressions` | `false` | Allow full JS expressions in bindings (security-sensitive — never enable with untrusted input) |
| `removeAttributeBindings` | `true` | Strip directive attributes from the DOM after binding |
| `rethrowErrors` | `true` | Re-throw errors after the error handler runs |
| `slowThreshold` | `2` | Millisecond threshold for slow-operation tracing |
| `htmxIntegration` | `false` | Automatically listen to `htmx:afterSwap` / `htmx:load` and rebind swapped DOM |
| `autoInjectCloak` | `true` | Automatically inject `[${prefix}cloak]` display:none style tag in `<head>` |

> **Security note:** `allowInlineExpressions` evaluates strings with `new Function`. Keep it `false` unless every expression source is fully trusted, and never bind untrusted user input through it.

---

## App Registry (`Helix.$apps`) & HTMX Integration

### Multi-App Registry (`Helix.$apps`)
Track, inspect, and coordinate multiple Helix apps on the same page:

```js
// Look up by selector, DOM element, or instance ID
const appEntry = Helix.$apps.get("#chat-widget");
console.log(appEntry.instance, appEntry.app);

// Check or list all mounted apps
if (Helix.$apps.has("#sidebar-app")) {
  const allApps = Helix.$apps.list(); // Array of { selector, element, instance, app, id, mountedAt }
}
```

### Official HTMX Re-bind Integration
Automatically rebinds reactive directives when HTMX replaces HTML fragments:

```js
// Enable globally:
Helix.enableHtmx(); // or Helix.config.htmxIntegration = true;
```

When HTMX swaps HTML into `#app` via `hx-get="/api/items" hx-swap="innerHTML"`:
1. Strips any incoming `[hx-cloak]` attributes so content shows immediately without FOUC.
2. Identifies which Helix app instance owns the swapped target.
3. Automatically triggers `app.rebind(target)` to mount reactive directives and clean up stale event listeners.

---

## New Core APIs (v11.1.19)

### Public DOM API (`Helix.dom`)
Low-level DOM utilities for directive and plugin authors:
```js
Helix.dom.bind(node, ctx, instance);    // Explicitly bind a DOM node
Helix.dom.cleanup(node);                // Run cleanups on element & subtree without removal
Helix.dom.destroy(node);                // Clean up bindings and remove element from DOM
Helix.dom.inspect(node);                // Inspect binding metadata, directives, and patch flags
Helix.dom.findNode(selector, root);     // DOM selector helper
```

### Effect Groups (`Helix.effectGroup`)
Manage multiple reactive effects as a single unit:
```js
const group = Helix.createEffectGroup("MyGroup");
group.add(Helix.effect(() => { ... }));

group.pause();   // Suspend execution of all effects in group
group.resume();  // Resume execution
group.stop();    // Stop and cleanup all effects in group
```

### Batch Transactions & Priorities (`Helix.batch`)
Group multiple reactive state updates to flush synchronously without intermediate renders:
```js
Helix.batch(() => {
    state.count++;
    state.name = "Alice";
});

// Priority batching:
Helix.batch.high(() => { ... }); // Priority 10
Helix.batch.low(() => { ... });  // Priority -10
```

Effect priority options:
```js
Helix.effect(() => { ... }, { priority: "high" });   // "high" (10), "normal" (0), "low" (-10)
```

### Async Components & Fallbacks (`Helix.defineAsyncComponent`)
Template-driven Promise-based component lazy-loading:
```js
const UserCard = Helix.defineAsyncComponent({
    name: "UserCard",
    loader: () => import("./UserCard.js"),
    loadingComponent: { template: "<div>Loading...</div>" },
    errorComponent: { template: "<div>Failed to load.</div>" },
    delay: 200,      // Delay before showing loadingComponent
    timeout: 3000,   // Max load time before throwing timeout
    retries: 3,
    onError(err, retry, fail, attempt) {
        if (err.status === 503 && attempt < 5) retry();
        else fail();
    }
});

// Preload APIs
Helix.preload([UserCard, Dashboard]);
Helix.preloadAll();
```

### Error Boundaries (`createErrorBoundary` & `onErrorCaptured`)
Prevent component errors from crashing the application tree:
```js
const Boundary = Helix.createErrorBoundary({
    template: "<div class='error'>A child component failed to load.</div>"
});
```

### Plugin Lifecycle Hooks
Plugins can implement lifecycle hooks matching application lifecycles:
```js
const MyPlugin = Helix.definePlugin({
    name: "my-plugin",
    install(app, opts) {},
    mounted(app, opts) {},
    updated(app, opts) {},
    unmount(app, opts) {},
    destroy(app, opts) {}
});
```

### Unified ScopeScheduler
- Replaces individual timer loops with a single unified tick engine (`ScopeScheduler`).
- Batches `scope.refresh()` calls: calling `scope.refresh()` multiple times in 1 tick executes microtask flushing exactly **1 time**.

### Top-Level `effectScope()` & `onScopeDispose()`
Create scoped effect trees for composables and reusable libraries:
```js
const scope = Helix.effectScope();
scope.run(() => {
    Helix.effect(() => { ... });
    Helix.onScopeDispose(() => {
        // Runs automatically when scope.stop() is executed
    });
});
scope.stop(); // Stops all effects and disposes callbacks
```

### Built-in `<suspense>` Component
Template-driven async UI state container:
```js
Helix.component("my-app", {
    template: `
        <suspense>
            <template #fallback><div>Loading async module...</div></template>
            <template #default><my-async-card></my-async-card></template>
        </suspense>
    `
});
```

### Component Tree Inspector (`Helix.inspectTree`) & Devtools
Introspect mounted component hierarchies in real-time:
```js
const tree = Helix.inspectTree(appInstance);
// Returns JSON representation: { id, name, children: [...] }

// Browser Devtools Extension Hook:
window.__HELIX_DEVTOOLS__.on("component:mount", (inst) => { ... });
```

### Performance Profiler (`Helix.profile`)
Measure effect runs, render time, and component mount metrics:
```js
const result = Helix.profile(() => {
    state.count++;
});

const metrics = Helix.getProfileData();
// { duration, effectRuns, mountCount, updateCount }
```

### Memoized Computations (`Helix.memo`)
Cache heavy calculation results and re-evaluate only when inputs or dependencies change:
```js
const memoizedResult = Helix.memo(
    () => state.multiplier * state.count,
    () => [state.multiplier, state.count]
);

console.log(memoizedResult.value); // Returns cached output without re-evaluating getter
```

### Multi-Source Watch & `once` Option
Watch multiple reactive sources simultaneously or auto-unwatch after 1 trigger:
```js
Helix.watch([refA, () => state.b], ([newA, newB], [oldA, oldB]) => {
    console.log(`Changed: ${newA}, ${newB}`);
});

Helix.watch(state, (newVal) => { ... }, { once: true });
```

### DevTools Introspection APIs (`Helix.devtools`)
Inspect active scopes, running effects, dependency graphs, and timing metrics:
```js
const scopes = Helix.devtools.getScopes();
const effects = Helix.devtools.getEffects();
const deps = Helix.devtools.getDependencies(targetObject);
const timings = Helix.devtools.getTimings();
```

### Virtual DOM–Less Keyed List Diffing (`hx-for`)
`hx-for` directive uses head/tail fast-path trimming and **Longest Increasing Subsequence (LIS)** optimization:
- **Head/Tail Trimming**: Synchronizes matching prefix/suffix nodes in-place without moving DOM elements.
- **Longest Increasing Subsequence (`getLIS`)**: Calculates the minimum DOM operations required for middle-sequence reordering and moves ONLY nodes that have actually changed positions.
- **DocumentFragment Batching**: Inserts newly created list items with 1 single DOM reflow.
- Reduces 10,000-item append/prepend operations from $O(N \log N)$ to **$O(1)$**.

### Dynamic DOM Rebinding (`Helix.rebind` / `app.rebind`)
Re-compiles and re-binds reactive state to dynamically inserted DOM elements (e.g. DataTables, jQuery plugins, or AJAX HTML content):
```js
// Accepts selectors, jQuery objects, NodeLists, or DOM elements:
Helix.rebind('#dataTable');
Helix.rebind($('#dataTable'));

// DataTables draw hook:
table.on('draw.dt', function () {
    Helix.rebind($('#dataTable'));
});
```
- **Automatic Event Cleanup**: Runs existing listener cleanups (`removeEventListener`) on already-bound elements before re-compiling to prevent duplicate event triggers.
- **Recursive Subtree Rebinding**: Recursively traverses and compiles all uncompiled child nodes (`<tr>`, `<button @click="...">`, etc.).
- **Context Fallback**: Automatically falls back to app `rootCtx` or searches parent ancestor nodes for binding context.

---

## Full API reference

**App creation**
`createApp(rootComponent)` · `Helix.mount(selector, setupFn)` · `app.mount(selector)` · `app.unmount()` · `app.onAppUnmount(fn)`

**Registration**
`app.component(name, def)` · `app.directive(name, def)` · `app.removeDirective(name)` · `app.use(plugin, opts)` · `app.namespace(name, apis)` · `app.removeNamespace(name)` · `app.provide(key, val)` · `Helix.definePlugin(def)` · `Helix.directives(map)`

**Reactivity & Transactions**
`reactive` · `shallowReactive` · `readonly` · `shallowReadonly` · `ref` · `shallowRef` · `customRef` · `triggerRef` · `computed` · `effect` · `watch` · `watchEffect` · `simpleEffect` · `EffectScope` · `batch` (`batch.high`, `batch.low`) · `createEffectGroup` (`effectGroup`) · `inspectDeps`

**DOM & Component Utilities**
`Helix.dom` (`bind`, `cleanup`, `destroy`, `inspect`, `findNode`) · `defineAsyncComponent` · `preload` · `preloadAll` · `createErrorBoundary` · `onErrorCaptured` · `inspectComponent` · `ScopeScheduler` · `scopeScheduler` · `onError` · `checkMemoryLeaks`

**Ref utilities**
`isRef` · `unref` · `toValue` · `toRef` · `toRefs` · `toRaw` · `markRaw` · `isShallow` · `isProxy`

**Lifecycle**
`onBeforeMount` · `onMount` / `onMounted` · `onUpdated` · `onBeforeUnmount` · `onDestroy` / `onUnmounted`

**DI & context**
`provide` · `inject` · `getCurrentInstance` · `runWithContext`

**Scheduling**
`nextTick` · `queueJob` · `queuePreFlushCb` · `queuePostFlushCb` · `queueIdleJob`

**Messaging & registry**
`Helix.$bus` (`on` / `off` / `once` / `emit`) · `Helix.registry` (`list` / `has` / `get` / `dependsOn`)

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b fix/my-fix`.
2. Make surgical, well-scoped changes and match the conventions of adjacent code.
3. Add a focused smoke test that fails before your change and passes after (Node.js is sufficient for the reactive core with a minimal DOM shim).
4. Update the changelog header in `helix_v11-1-7.js` and this README if you change public behavior.
5. Open a pull request describing the bug or feature, with reproduction steps.

```bash
git clone <your-fork-url>
cd helix
git checkout -b fix/my-fix
# ... edit, test ...
git commit -m "fix: describe the change"
git push origin fix/my-fix
```

Bug reports are most useful with a severity note, the affected file and line, a minimal reproduction, and the observed vs. expected behavior.

---

*Helix.js — reactive UI without the build step.*