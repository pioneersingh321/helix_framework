# 🧬 Helix.js Framework

[![Version](https://img.shields.io/badge/version-11.1.7--fix3-indigo.svg?style=flat-square)](https://github.com/pioneersingh321/helix_framework)
[![Bundle Size](https://img.shields.io/badge/bundle-109KB--uncompressed-teal.svg?style=flat-square)](#)
[![Reactivity](https://img.shields.io/badge/reactivity-signal--native-blue.svg?style=flat-square)](#)
[![Build Step](https://img.shields.io/badge/build-zero--build--step-orange.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

![Helix.js Banner](./helix_banner.png)

Helix.js is a lightweight, Vue-inspired reactive JavaScript framework that brings fine-grained, signal-native reactivity, declarative HTML directives, scoped components, and a robust plugin ecosystem directly to the browser. 

All of this is bundled in a **single dependency-free file** that runs out of the box with **no compilation, no bundler (Vite/Webpack), and no build steps**.

---

## 🗺️ Table of Contents

- [✨ Core Features](#-core-features)
- [📁 Repository Structure](#-repository-structure)
- [🚀 Installation & Setup](#-installation--setup)
- [🏁 Quick Start](#-quick-start)
- [🧠 Core Reactivity API](#-core-reactivity-api)
- [🔌 Directive Bindings Reference](#-directive-bindings-reference)
- [📦 Component Architecture](#-component-architecture)
- [🔏 Dependency Injection](#-dependency-injection)
- [📢 Event Bus](#-event-bus)
- [🧩 Plugins & namespaces](#-plugins--namespaces)
- [⚙️ Global Configuration](#-global-configuration)
- [⚡ Ecosystem Plugins (Interactive)](#-ecosystem-plugins-interactive)
- [🔬 Advanced Design Patterns](#-advanced-design-patterns)
- [🧪 Testing & Local Demos](#-testing--local-demos)

---

## ✨ Core Features

*   🚀 **Zero Build Step:** Drop in a single `<script>` tag and start writing reactive UIs directly in your HTML.
*   ⚡ **Fine-Grained Reactivity:** A proxy-based signal system with `ref`, `reactive`, `computed`, `effect`, and `watch` modeled after Vue 3's reactive engine.
*   🎨 **Declarative HTML Directives:** Bind data with `h-if`, `h-for`, `h-model`, `h-bind`, and `h-on` (with `:` and `@` shorthands).
*   🧱 **Composable Scoped Components:** Define elements with `setup()`, props, custom emits, slots, and an effect-scope cleanup model.
*   🛡️ **Memory-Safe Teardown:** Automatic listener and watcher garbage collection when components or conditional scopes are unmounted.
*   🔌 **First-Class Plugins:** Extensible plugin system featuring semver dependency resolution, namespace isolation, and hook cleanups.

---

## 📁 Repository Structure

```
helix_framework/
├── dist/                 # Production distribution builds
│   └── helix.js          # Core framework library (v11.1.7-fix3 Zenith Edition)
├── plugins/              # Official stable plugins & custom directives
│   ├── directives.js     # Extra custom directives (v-fetch, etc.)
│   ├── helix-axios.js    # Axios HTTP client plugin (v2.2.0)
│   ├── helix-behavior.js # DOM behavior pipe scripting (v1.3.1)
│   ├── helix-fetch.js    # Fetch client wrapper plugin (v2.8.2)
│   ├── helix-form.js     # Form serialization & type casting (v2.0.0)
│   ├── helix-loader.js   # Global/Local loading spinner & overlays (v2.5)
│   ├── helix-model.js    # Client-side AST database queries (v2.2.1)
│   ├── helix-notify.js   # SweetAlert2 toast & modal wrapper (v2.1)
│   └── helix-validation.js # Zero-config form & field validation (v2.1.5)
├── archive/              # Safe historical repository copy (Legacy versions)
│   ├── core/             # Deprecated framework base versions (v11.1.4 to v11.1.7-base)
│   └── plugins/          # Legacy plugin versions
├── index.html            # Helix Core & reactivity playground
├── index-validation.html # Helix Validate integration playground
├── helix_banner.png      # Framework banner asset
└── .gitignore            # Git exclusion configs
```

---

## 🚀 Installation & Setup

### 1. Direct Browser Import (Recommended)
Simply load the core script and any required plugins in your HTML file:

```html
<!-- Load Core Helix -->
<script src="./dist/helix.js"></script>
<script>
  // Helix is available globally on the window object
  const { createApp, ref, reactive } = Helix;
</script>
```

### 2. Modern ES Module Wrapper
If you use a bundler, import the script for its global side effects and destructure from `window.Helix`:

```javascript
import "./dist/helix.js";
const { createApp, ref, computed } = window.Helix;
```

---

## 🏁 Quick Start

Here is a simple example demonstrating reactive text, input modeling, conditional logic, and list rendering using default directive syntax:

```html
<div id="app">
  <h1>{{ title }}</h1>
  <p>Count is: {{ count }}</p>
  
  <!-- Directives default to the "h-" prefix -->
  <button @click="increment">+1 Increment</button>
  <input h-model="title" placeholder="Update title..." />
  
  <p h-if="count >= 5">🎉 Count is 5 or higher!</p>
</div>

<script src="./dist/helix.js"></script>
<script>
  const { createApp, ref } = Helix;

  createApp({
    setup() {
      const title = ref("Hello Helix!");
      const count = ref(0);
      const increment = () => count.value++;

      // Variables returned from setup() are exposed to the template context
      return { title, count, increment };
    }
  }).mount("#app");
</script>
```

> [!TIP]
> **Prefer Vue-Style `v-` Directives?**
> By default, Helix uses the `h-` prefix. You can switch to Vue's `v-` prefix globally before mounting your app:
> ```javascript
> Helix.config.prefix = 'v-';
> Helix.config.allowInlineExpressions = true; // Enables evaluating full inline JS
> ```

---

## 🧠 Core Reactivity API

Helix implements a fine-grained, proxy-based dependency tracking system modeled on Vue 3's reactive core.

### `ref(value)`
Wraps a primitive or object in a reactive box. Read and write values via the `.value` property.
```javascript
const count = ref(0);
count.value++;            // triggers dependent updates
console.log(count.value); // 1
```

### `reactive(object)`
Generates a deep reactive Proxy of an object or array. Updates to nested properties are tracked automatically.
```javascript
const state = reactive({ user: { name: "Ada" }, list: [] });
state.user.name = "Grace"; // triggers updates
state.list.push("Item 1"); // array mutations are tracked cleanly
```

### `computed(getter)`
Generates a cached, lazily-evaluated derived value. It will only re-calculate when its reactive dependencies change.
```javascript
const first = ref("Ada");
const last = ref("Lovelace");
const fullName = computed(() => `${first.value} ${last.value}`);

console.log(fullName.value); // "Ada Lovelace"
```

### `effect(fn, options?)`
Runs a function immediately while tracking reactive variables read during execution. Automatically re-runs when those variables change. Returns a runner with a `.stop()` method.
```javascript
const stop = effect(() => {
  document.title = `Count: ${count.value}`;
});
stop(); // stops future reactions
```

### `watch(source, callback, options?)`
Watches a `ref`, `reactive` object, or getter function, invoking a callback when changes occur. Passes the unwrapped new and old values.
```javascript
// Watch a reactive getter
watch(() => state.user.name, (next, prev) => {
  console.log(`Name changed from ${prev} to ${next}`);
}, { immediate: true, deep: true });

// Watch a Ref directly
watch(count, (newVal) => console.log(`Count is: ${newVal}`));
```

### `watchEffect(fn, options?)`
Similar to `effect`, but integrates scheduler flush options (`pre`, `post`, `sync`) and supports an `onCleanup` callback to tear down stale side effects (like intervals).
```javascript
watchEffect((onCleanup) => {
  const timer = setInterval(() => console.log('tick'), 1000);
  onCleanup(() => clearInterval(timer)); // called when effect is re-triggered or stopped
});
```

### 🛠️ Reactivity Utilities

| API Method | Purpose |
| :--- | :--- |
| `shallowRef` / `shallowReactive` | Restricts reactivity strictly to the root properties. |
| `readonly` / `shallowReadonly` | Returns an immutable, read-only wrapper of a reactive object. |
| `isRef` / `unref` / `toValue` | Inspects, unwraps, or extracts value variables. |
| `toRef` / `toRefs` | Destructures reactive object properties into distinct reactive refs. |
| `toRaw` / `markRaw` | Wipes reactivity proxy tracking or flags objects to skip reactivity. |
| `isProxy` / `isShallow` | Inspects the Proxy characteristics of an object. |
| `customRef` | Creates custom refs specifying explicit dependency tracking (`track` / `trigger`). |
| `nextTick` | Awaits the resolution of the next queued DOM rendering flush. |
| `EffectScope` | Aggregates multiple effects for collective garbage collection. |

---

## 🔌 Directive Bindings Reference

All directives use the `h-` prefix by default. Attribute shorthand `:` stands for `h-bind:`, and `@` represents `h-on:`.

### 1. Interpolation & Text
*   **`{{ expression }}`**: Double-brace syntax inserts text values safely.
*   **`h-text="message"`**: Updates the node's `textContent`.
*   **`h-html="richMessage"`**: Updates the node's `innerHTML`.
    > [!WARNING]
    > **XSS Vulnerability:** Never render unsanitized user-generated content via `h-html`.

### 2. Attribute Bindings (`h-bind` / `:`)
Binds reactive state to standard element attributes (e.g., `:href`, `:src`, `:disabled`).
```html
<a :href="url">Link</a>
<button :disabled="isPending">Submit</button>
```

#### Advanced Bindings:
*   **Classes (Accepts Objects):** Automatically parses class lists (supports multi-class keys).
    ```html
    <i :class="{ 'ri-heart-fill text-danger': isLiked, 'ri-heart-line': !isLiked }"></i>
    ```
*   **Styles (Accepts Objects):**
    ```html
    <div :style="{ color: activeColor, fontSize: fontSize + 'px' }"></div>
    ```

### 3. Event Handling (`h-on` / `@`)
Listens to native DOM events. Supports inline invocations, custom arguments, and event parameter references (`$event`).
```html
<button @click="increment">Click</button>
<button @click="deleteItem(item.id, $event)">Delete</button>
```

#### Event Modifiers:
*   `@submit.prevent`: Invokes `event.preventDefault()`.
*   `@click.stop`: Invokes `event.stopPropagation()`.

### 4. Two-Way Model Bindings (`h-model`)
Synchronizes state with forms including inputs, textareas, checkboxes, radio inputs, and select dropdowns.
```html
<input type="text" h-model="form.email" />
<input type="checkbox" h-model="form.agree" />
<select h-model="form.city">
  <option value="london">London</option>
</select>
```

### 5. Conditional Rendering (`h-if`)
Conditionally renders an element. Elements under `h-if` are fully created when truthy and completely destroyed along with nested event handlers when falsy to prevent memory leaks.
```html
<div h-if="isLoggedIn">Welcome Back!</div>
```

### 6. List Rendering (`h-for`)
Loops through arrays to render lists of items. Providing a `:key` enables optimal DOM node reconciliation via Helix's **longest-increasing-subsequence** diff algorithm.
```html
<ul>
  <li h-for="item in items" :key="item.id">{{ item.name }}</li>
</ul>
```

### 7. Template Refs (`h-ref`)
References elements directly inside the component scope.
```html
<input h-ref="usernameInput" />
```
```javascript
setup() {
  const usernameInput = ref(null);
  onMounted(() => usernameInput.value.focus());
  return { usernameInput };
}
```

### 8. Visibility Toggle (`h-show`)
Toggles an element's visibility using the CSS `display` property, preserving the element in the DOM tree.
```html
<div h-show="isToggled">Toggle display:none style</div>
```

---

## 📦 Component Architecture

You can register components globally on the main Helix constructor or isolate them inside specific app scope setups.

```javascript
const app = createApp({});

app.component("counter-widget", {
  props: ['initialValue'],
  emits: ['update'],
  setup({ props, emit }) {
    const count = ref(props.initialValue || 0);
    const inc = () => {
      count.value++;
      emit('update', count.value);
    };
    return { count, inc };
  },
  template: `
    <div class="widget">
      <p>Widget Count: {{ count }}</p>
      <button @click="inc">Increment</button>
    </div>
  `
});

app.mount("#app");
```

### Component Lifecycle Hooks
Register hooks inside the `setup()` block to capture state events:

| Lifecycle Hook | Event Trigger |
| :--- | :--- |
| `onBeforeMount(fn)` | Fired before elements are compiled or injected into the DOM. |
| `onMounted(fn)` / `onMount(fn)` | Fired immediately after elements are mounted to the DOM tree. |
| `onUpdated(fn)` | Fired after reactive DOM updates are flushed. |
| `onBeforeUnmount(fn)` | Fired before a component is torn down and destroyed. |
| `onUnmounted(fn)` / `onDestroy(fn)` | Fired after component elements, watchers, and listeners are removed. |

---

## 🔏 Dependency Injection

Share global values or reactive states across deeply-nested components without resorting to prop-drilling.

```javascript
// Ancestor Provider Component
setup() {
  const theme = reactive({ dark: true });
  provide("themeConfig", theme);
}

// Deeply Nested Descendant Consumer Component
setup() {
  const theme = inject("themeConfig", { dark: false }); // supports default fallbacks
  return { theme };
}
```

---

## 📢 Event Bus

Helix exposes a central pub-sub event bus (`$bus`) on both the global class and individual application instances to handle decoupled communications.

```javascript
// Register a callback
Helix.$bus.on("notify-user", (message) => alert(message));

// Fire an event
Helix.$bus.emit("notify-user", "Processing Finished!");

// Clean up listener
Helix.$bus.off("notify-user", handler);
```
> [!NOTE]
> Event listeners registered inside component scopes or `EffectScope` are automatically unregistered on teardown to eliminate memory leaks.

---

## 🧩 Plugins & Namespaces

Extend Helix with global namespaces, custom components, and custom directives using `app.use()`. The system features semver dependency resolution.

```javascript
const NetworkPlugin = {
  name: "helix-network",
  version: "1.0.0",
  requires: { "helix-fetch": ">=2.0.0" }, // plugin dependencies check
  install(app, options) {
    // 1. Expose namespace APIs
    app.namespace("net", {
      ping: () => console.log("Pong")
    });

    // 2. Register directives
    app.directive("ping-on-click", {
      mounted(el) {
        el.addEventListener("click", app.$net.ping);
      }
    });

    // 3. Return cleanup teardown callback
    return () => {
      app.removeDirective("ping-on-click");
      app.removeNamespace("net");
    };
  }
};

app.use(NetworkPlugin);
```

### Plugin Registry Inspection
```javascript
Helix.registry.list();            // Lists all active plugins with versions and installation dates
Helix.registry.has("helix-fetch"); // Returns true if installed
Helix.registry.dependsOn("a", "b");// Evaluates semver ranges
```

---

## ⚙️ Global Configuration

Configure global configuration parameters prior to mounting any application instances.

```javascript
Helix.config.debug = true;         // Enables developer console warning flags
Helix.config.prefix = "h-";        // Sets custom directive attributes
Helix.config.delimiters = ["{{", "}}"]; // Custom text interpolators
```

| Config Option | Default Value | Description |
| :--- | :--- | :--- |
| `debug` | `false` | Enable validation and performance traces inside the developer console. |
| `prefix` | `"h-"` | Custom HTML tag prefix for directive bindings. |
| `delimiters` | `["{{", "}}"]` | Opening and closing string sequences for template text variables. |
| `allowInlineExpressions` | `false` | Enables executing full inline JS code. (E.g. `@click="state.val++"`). |
| `removeAttributeBindings` | `true` | Wipes custom directives (`h-if`, `h-model`) from nodes after compilation. |
| `rethrowErrors` | `true` | Directs error handler cycles to re-throw runtime failures. |
| `slowThreshold` | `2` | Threshold limit in milliseconds for logging slow operation warnings. |

---

## ⚡ Ecosystem Plugins (Interactive)

Expand the sections below to explore the official plugins shipped within the `plugins/` directory:

<details>
<summary>📂 1. Helix Validation (helix-validation.js - v2.1.5)</summary>
<br>

A zero-configuration, interactive validation engine. Apply rules directly via DOM data attributes or validate objects programmatically.

#### Zero-JS Validation Attributes:
| Attribute Rule | Validation Condition | Example |
| :--- | :--- | :--- |
| `data-hx-required` | Field cannot be blank. | `<input data-hx-required>` |
| `data-hx-email` | Matches email regex standards. | `<input data-hx-email>` |
| `data-hx-url` | Matches URL formatting. | `<input data-hx-url>` |
| `data-hx-numeric` | Restricts value input to numbers. | `<input data-hx-numeric>` |
| `data-hx-integer` | Restricts value input to integers. | `<input data-hx-integer>` |
| `data-hx-minlength="n"` | String length must be at least `n`. | `<input data-hx-minlength="6">` |
| `data-hx-maxlength="n"` | String length cannot exceed `n`. | `<input data-hx-maxlength="20">` |
| `data-hx-min="n"` | Number must be greater than or equal to `n`. | `<input data-hx-min="18">` |
| `data-hx-max="n"` | Number must be less than or equal to `n`. | `<input data-hx-max="100">` |
| `data-hx-between="min,max"` | Numerical value must fit inside range bounds. | `<input data-hx-between="1,10">` |
| `data-hx-pattern="regex"` | Evaluates value against custom regex. | `<input data-hx-pattern="^[A-Z]+$">` |
| `data-hx-same-as="#id"` | Value must match selected field element value. | `<input data-hx-same-as="#password">` |
| `data-hx-one-of="a,b,c"` | Matches one of the comma-split keys. | `<input data-hx-one-of="admin,editor">` |
| `data-hx-debounce="ms"` | Debounces input triggers by set milliseconds. | `<input data-hx-debounce="500">` |
| `data-hx-{rule}-message` | Replaces validation message with custom string. | `data-hx-required-message="Name is required"` |

#### Programmatic API Usage:
```javascript
const $v = Helix.$validation;

// Create validation field instances manually
const fieldObj = $v.field('initVal', 'required|email', { debounce: 300 });

// Run validations on a string value programmatically
$v.check('invalid-email', 'required|email').then(errors => {
  console.log(errors); // ['Must be a valid email address']
});
```
</details>

<details>
<summary>📂 2. Helix Behavior Scripting (helix-behavior.js - v1.3.1)</summary>
<br>

A powerful pipeline execution engine that handles DOM events and state triggers declaratively within standard elements without writing custom JavaScript scripts.

#### Syntax Overview:
```html
<button h-pipe="click -> toggle(active) | wait(1000) | hide">
  Run Pipeline
</button>
```

#### Supported Pipeline Commands:
*   **DOM Manipulations:**
    *   `put(val, selector?)`: Inserts text value or matches targets.
    *   `html(markup, selector?)`: Injects `innerHTML` tags.
    *   `swap(markup, selector?)`: Swaps `outerHTML` layouts.
    *   `add(class)` / `remove(class)` / `toggle(class)`: Modifies class names.
    *   `take(class)`: Exclusively applies class to node among sister nodes.
    *   `show()` / `hide()`: Toggles display visibility.
    *   `empty()` / `removeEl()`: Deletes child nodes or target element.
    *   `focus()` / `blur()` / `scroll()`: Triggers focus status or scrolls page smoothly.
*   **Logical Pipelines:**
    *   `fetch(url, options)`: Fires network fetch requests.
    *   `wait(ms)`: Stalls pipeline execution for set duration.
    *   `send(event)` / `trigger(event)`: Fires custom DOM Events.
    *   `prevent()` / `stop()`: Invokes standard event controls.
    *   `set(path, value)`: Updates reactive state values.
    *   `fallback(value)`: Gracefully overrides pipe crash exceptions.

> [!NOTE]
> **Cycle Safety Guards:** The behavior script engine compiles pipelines into tracking graphs. If a cross-trigger infinite loop is detected (e.g. element A triggers B, which triggers A), it instantly freezes both nodes to protect browser thread safety and outputs a `[behavior] CROSS-CYCLE DETECTED` error log.
</details>

<details>
<summary>📂 3. Helix Fetch (helix-fetch.js - v2.8.2)</summary>
<br>

A lightweight fetch request wrapper featuring execution queueing, automatic background polling, response caching, and AbortController integrations.

```javascript
// HTTP Methods
Helix.$fetch.get('/api/users', { cache: true, timeout: 5000 });
Helix.$fetch.post('/api/users', { name: 'Grace' }, { tag: 'userGroup' });

// Background polling
Helix.$fetch.request({
  url: '/api/status',
  pollInterval: 10000, // Query status endpoint every 10 seconds
});

// Cache Invalidation
Helix.$fetch.invalidate('userGroup'); // Invalidates cached items matching tag
Helix.$fetch.clearCache();            // Clears complete query cache
```
</details>

<details>
<summary>📂 4. Helix Axios (helix-axios.js - v2.2.0)</summary>
<br>

An advanced Axios networking plugin featuring automatic exponential backoff retries, request deduplication, out-of-order execution guardrails, and file uploads.

```javascript
// Reactive query hooks
const { data, loading, error, execute, cancel } = Helix.$http.useGet('/api/data', {
  retry: 3,            // Retry failed requests up to 3 times
  retryDelay: 1000,    // Delay 1000ms before retry
  dedupe: true         // Deduplicate simultaneous requests
});

// Upload progress tracking
Helix.$http.useUpload('/api/upload', file, {
  onProgress: (progressEvent) => console.log(progressEvent.percentage)
});

// Auth Tokens
Helix.$http.setToken('my-auth-token', 'Bearer');
```
</details>

<details>
<summary>📂 5. Helix Form (helix-form.js - v2.0.0)</summary>
<br>

Extracts and serializes DOM form controls directly into structured, typed JSON objects.

#### Form Naming Rules:
*   `name="profile[name]"`: Serializes into nested object: `{ profile: { name: 'Value' } }`.
*   `name="interests[]"`: Serializes into a standard array list: `{ interests: ['Value'] }`.
*   `name="age:number"`: Coerces value directly into a `Number`.
*   `name="agree:boolean"`: Coerces values into a `Boolean`.

#### API:
```javascript
// Serialize form to JSON
const data = Helix.$form.serializeJSON(document.querySelector('form'));

// Serialize nested objects into FormData layouts for upload payload
const formData = Helix.$form.toFormData({ user: { avatar: file, name: 'Ada' } });
```
</details>

<details>
<summary>📂 6. Helix Loader (helix-loader.js - v2.5)</summary>
<br>

Renders animated page-level loading screens or localized container loader widgets.

```javascript
// Launch global loading spinner overlay
Helix.$loader.show({ theme: 'glass', text: 'Updating Database...' });

// Dismiss active overlays
Helix.$loader.hide();

// Reactive directive layout
// Toggles a glass card loading indicator over the element automatically
```
```html
<div v-loading="state.isLoading" hx-loading-config="theme:glass;text:Fetching..."></div>
```
</details>

<details>
<summary>📂 7. Helix Notify (helix-notify.js - v2.1)</summary>
<br>

Integrates SweetAlert2 to manage toast queues, notification alerts, and Promise-based confirm dialogs.

```javascript
// Trigger a non-blocking toast
Helix.$notify.toast('Database updated successfully', { type: 'success' });

// Prompts and confirm dialogs
Helix.$notify.confirm('Delete user?', 'This action cannot be undone.')
  .then(confirmed => {
    if (confirmed) console.log("User deleted.");
  });

// Execute async tasks with full-screen block loading overlay
Helix.$notify.async('Filing tax forms', 'Please wait...', apiRequestPromise);
```
</details>

<details>
<summary>📂 8. Helix Model (helix-model.js - v2.2.1)</summary>
<br>

A robust in-memory database query and data model utility. Query datasets with AST compile paths, sorted index hashes, paging, and joins.

```javascript
const DB = Helix.$model(rawUsersList);

// Query builder execution
const admins = DB
  .where('role', '=', 'admin')
  .whereBetween('age', [18, 35])
  .orderBy('name', 'asc')
  .limit(10)
  .get(); // Resolves compiled query into dataset array
```

#### Query Builders API:
*   `where(...)` / `whereNot(...)` / `whereIn(...)` / `whereBetween(...)`
*   `search(fields[], queryStr)`: Indexed text search.
*   `orderBy(...)` / `sortBy(...)` / `sortByDesc(...)`
*   `limit(count, offset)` / `forPage(page, perPage)`
*   `select(fields)` / `except(fields)`: Data projections.
*   `join()`, `leftJoin()`, `rightJoin()`, `innerJoin()`: Joins multiple datasets together.
*   `groupBy(field)`: Returns data grouped by field keys.
*   `paginate(perPage, currentPage)`: Returns pagination metadata and subset rows.
</details>

---

## 🔬 Advanced Design Patterns

These architectural patterns demonstrate how to build robust, scalable architectures with Helix.js (as seen in `index.html`).

### 1. Global Standalone Reactive Stores
Isolate state logic from UI rendering components. Declare external global stores that can be imported and shared across multiple apps or widgets.

```javascript
// Define a central global store
const AuthStore = Helix.reactive({
  user: null,
  isAuthenticated: false,
  
  login(userData) {
    this.user = userData;
    this.isAuthenticated = true;
  },
  logout() {
    this.user = null;
    this.isAuthenticated = false;
  }
});
```

### 2. Microtask Batching & Post-Flush Queueing (`queuePostFlushCb`)
Helix updates DOM nodes asynchronously by batching changes in a microtask scheduler to optimize performance. If you need to read DOM values immediately after modifying state, use `queuePostFlushCb`.

```javascript
import { queuePostFlushCb } from 'Helix';

function updateUI() {
  state.count = 500; // Queue DOM update

  // DOM elements are not updated immediately:
  console.log(document.getElementById('display').innerText); // "0"

  // Read the updated DOM after the scheduler flushes updates:
  queuePostFlushCb(() => {
    console.log(document.getElementById('display').innerText); // "500"
  });
}
```

### 3. Component Communication via Custom Events
Ensure decoupled component structures using Vue-style emits to bubbles event payloads up the UI tree.

```javascript
Helix.component("profile-editor", {
  emits: ['save-profile'],
  setup({ reactive, emit }) {
    const profile = reactive({ name: "" });
    const submit = () => {
      emit("saveProfile", { ...profile }); // Emits camelCase events safely
    };
    return { profile, submit };
  },
  template: `
    <form @submit.prevent="submit">
      <input h-model="profile.name" />
      <button type="submit">Save</button>
    </form>
  `
});
```

---

## 🧪 Testing & Local Demos

To play with the examples and verify features locally:

### Option 1: Direct File Access (No Server Required)
Simply open the HTML files directly in your browser:
*   **Helix playground & API demos:** Open [index.html](file:///d:/mamp/htdocs/helix_framework/index.html) directly in your browser.
*   **Zero-Config validation playground:** Open [index-validation.html](file:///d:/mamp/htdocs/helix_framework/index-validation.html) directly in your browser.

### Option 2: Local Web Server (MAMP / PHP)
If you are hosting the workspace under a local web server like MAMP, access them via localhost:
*   **Helix playground & API demos:** [http://localhost/helix_framework/index.html](http://localhost/helix_framework/index.html)
*   **Zero-Config validation playground:** [http://localhost/helix_framework/index-validation.html](http://localhost/helix_framework/index-validation.html)
