# Helix.js Framework

Helix.js is a blazing-fast, lightweight, O(1) reactive JavaScript framework inspired by Vue.js. This repository is structured as a clean Git project containing the latest production-ready Helix Core library, its official plugin ecosystem, and archives of past versions.

---

## 📁 Repository Structure

```
helix_framework/
├── dist/                 # Production distribution builds
│   └── helix.js          # Core framework library (v11.1.7-fix2 Zenith Edition)
├── plugins/              # Active stable plugins & custom directives
│   ├── directives.js     # Custom directives (v-fetch, etc.)
│   ├── helix-axios.js    # Axios HTTP client plugin (v2.2.0)
│   ├── helix-behavior.js # DOM behavior pipe scripting (v1.3.1)
│   ├── helix-fetch.js    # Fetch client wrapper plugin (v2.8.2)
│   ├── helix-form.js     # Form serialization & type casting (v2.0.0)
│   ├── helix-loader.js   # Global/Local loading spinner & overlays (v2.5)
│   ├── helix-model.js    # In-memory database AST models & Top-K stream (v2.2.1)
│   ├── helix-notify.js   # SweetAlert2 toast & modals wrapper (v2.1)
│   └── helix-validation.js # Zero-config form & field validation (v2.1.5)
├── archive/              # Safe historical repository copy (Legacy versions)
│   ├── core/             # Deprecated framework base versions (v11.1.4 to v11.1.7-base)
│   └── plugins/          # Legacy plugin versions (v2.0.0)
├── index.html            # Helix Core & reactivity playground
├── index-validation.html # Helix Validate integration example
└── .gitignore            # Git exclusion configs
```

---

## 🚀 Installation & Quick Start

To use Helix.js, load the core script and any required plugins in your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Helix App</title>
  <!-- Load Core Helix -->
  <script src="./dist/helix.js"></script>
</head>
<body>
  <div id="app">
    <h1>Hello, <span v-text="state.name"></span></h1>
    <input v-model="state.name" placeholder="Type name...">
    <button @click="increment">Clicks: <span v-text="state.count"></span></button>
  </div>

  <script>
    Helix.mount('#app', ({ reactive }) => {
      const state = reactive({
        name: 'World',
        count: 0
      });

      const increment = () => {
        state.count++;
      };

      return {
        state,
        increment
      };
    });
  </script>
</body>
</html>
```

---

## 🧠 Helix Core API Reference

### 1. Global Configuration (`Helix.config`)
Configure global framework variables prior to mounting any apps:
* **`Helix.config.prefix`** (Default: `'v-'`): Change the prefix of custom directives.
* **`Helix.config.debug`** (Default: `false`): Enable warning and trace log outputs in the developer console.
* **`Helix.config.allowInlineExpressions`** (Default: `true`): Allows running inline JavaScript expressions in HTML elements.
* **`Helix.config.removeAttributeBindings`** (Default: `false`): Strips custom directives from DOM nodes after mounting.

### 2. Reactivity System
* **`Helix.reactive(object)`**: Generates a deep reactive Proxy. Changes to properties nested anywhere inside trigger DOM renders.
* **`Helix.ref(value)`**: Wraps a primitive value in a reactive container with a single `.value` property.
* **`Helix.watch(getter, callback, options)`**: Observes reactive changes and triggers custom actions.
  * *Options*: `immediate: true` (run callback immediately on bind), `deep: true` (deeply watch nested object structures).
  ```javascript
  Helix.watch(() => state.count, (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
  });
  ```
* **`Helix.effect(fn)`**: Executes a function immediately, tracks all reactive properties read during execution, and automatically re-runs when those properties change.
  ```javascript
  Helix.effect(() => {
    console.log("Current user email is: ", state.user.email);
  });
  ```

### 3. Custom Directives API
Register global directives that bind to DOM element lifecycle events:
```javascript
Helix.directive('focus', {
  mounted(el, binding) {
    el.focus();
  },
  updated(el, binding) {
    // Fired when binding value updates
  },
  unmounted(el) {
    // Teardown listeners here
  }
});
```

---

## 🔌 Core Plugins Documentation

All stable, production plugins are located in the `plugins/` directory.

### 1. Helix Validation (`plugins/helix-validation.js` - v2.1.5)
Zero-configuration interactive validation framework. Bind a form using the `v-validate` (or `data-hx-form`) directive and define rules using HTML data attributes.

#### Zero-JS Rules (via DOM attributes):
| Attribute | Description | Example |
|---|---|---|
| `data-hx-required` | Field is mandatory | `<input data-hx-required>` |
| `data-hx-email` | Must be a valid email format | `<input data-hx-email>` |
| `data-hx-url` | Must be a valid URL | `<input data-hx-url>` |
| `data-hx-numeric` | Value must be numbers only | `<input data-hx-numeric>` |
| `data-hx-integer` | Value must be integers only | `<input data-hx-integer>` |
| `data-hx-minlength="n"` | Minimum string length is `n` | `<input data-hx-minlength="5">` |
| `data-hx-maxlength="n"` | Maximum string length is `n` | `<input data-hx-maxlength="20">` |
| `data-hx-min="n"` | Minimum numerical value is `n` | `<input data-hx-min="18">` |
| `data-hx-max="n"` | Maximum numerical value is `n` | `<input data-hx-max="100">` |
| `data-hx-between="min,max"` | Numerical value must be between bounds | `<input data-hx-between="1,10">` |
| `data-hx-pattern="regex"` | Value must match regex | `<input data-hx-pattern="^[A-Z]+$">` |
| `data-hx-same-as="#id"` | Must match the value of target selector | `<input data-hx-same-as="#password">` |
| `data-hx-one-of="a,b,c"` | Value must match one of comma-split keys | `<input data-hx-one-of="admin,editor">` |
| `data-hx-debounce="ms"` | Debounce time in milliseconds | `<input data-hx-debounce="500">` |
| `data-hx-{rule}-message` | Custom error message for the specific rule | `data-hx-required-message="Email required!"` |

#### Programmatic APIs:
Instantiated automatically on the Helix instance or returned via injection:
```javascript
const $v = Helix.$validation;

// Create field validation manually
const emailField = $v.field('', 'required|email', { debounce: 300 });

// Programmatic rule validation
$v.check('not-an-email', 'required|email').then(errors => {
  console.log(errors); // ['Must be a valid email address']
});
```

---

### 2. Helix Behavior Scripting (`plugins/helix-behavior.js` - v1.3.1)
An interactive pipe-delimited HTML script tool enabling simple reactive trigger cycles inside standard elements without writing custom JS.

#### Pipeline Syntax:
Add `h-pipe` attributes on your HTML structure:
```html
<button h-pipe="click -> toggle(active) | wait(1000) | hide">
  Click Me
</button>
```

#### Built-in Pipeline Commands:
* **DOM Mutations**:
  * `put(value, selector?)`: Sets value or textContent.
  * `html(content, selector?)`: Injects innerHTML.
  * `swap(content, selector?)`: Swaps outerHTML.
  * `toggle(className)` / `add(className)` / `remove(className)`: Class modifications.
  * `take(className)`: Restricts class exclusively to this element among its siblings.
  * `show()` / `hide()`: Changes element visibility.
  * `empty()`: Deletes all child nodes.
  * `removeEl()`: Deletes the element.
  * `focus()` / `blur()`: Standard browser focus toggles.
  * `scroll()`: Scrolls page smoothly to current element.
* **Control Flows & Requests**:
  * `fetch(url, options)`: Performs async HTTP fetch.
  * `wait(ms)`: Halts pipeline execution for specified milliseconds.
  * `send(eventName)` / `trigger(eventName)`: Dispatches custom DOM events.
  * `prevent()`: Invokes `event.preventDefault()`.
  * `stop()`: Invokes `event.stopPropagation()`.
  * `set(statePath, value)`: Updates Helix reactive state values directly.
  * `fallback(value)`: Catches pipe errors and fallbacks to static values.

#### Graph Cycle Detection:
The behavior engine compiles pipes into dependency graphs. If a cross-reactive cycle loop is detected (e.g. element A triggers element B, which triggers element A), the engine freezes both nodes automatically to prevent browser memory lockups and outputs a `[behavior] CROSS-CYCLE DETECTED` console error.

---

### 3. Helix Fetch (`plugins/helix-fetch.js` - v2.8.2)
A unified Fetch wrapper featuring request queueing, automatic background polling, and AbortController request cancellation.

#### Key APIs:
* **`Helix.$fetch.get(url, options)`** / **`post(url, body, options)`** / **`put()`** / **`delete()`** / **`patch()`**
* **`Helix.$fetch.request(config)`**: Initiates queries.
  * *Config Options*:
    * `pollInterval`: Run background queries periodically.
    * `tag`: Tag string for bulk cache invalidation.
    * `cache`: Enable response caching.
    * `timeout`: Request timeout limit.
* **`Helix.$fetch.mutate(url, options)`**: Declares lazy requests that must be executed explicitly via returned `.execute()` handlers.
* **`Helix.$fetch.invalidate(tag)`**: Invalidates cached responses sharing the tag.
* **`Helix.$fetch.clearCache()`**: Drops all cached queries.

---

### 4. Helix Axios (`plugins/helix-axios.js` - v2.2.0)
An advanced Axios wrapper supporting retry backoffs (idempotent request guard), request deduplication fingerprints, and out-of-order response guardrails.

#### Key APIs:
* **`Helix.$http.get(url, config)`** / **`post()`** / **`put()`** / **`patch()`** / **`delete()`** / **`head()`** / **`options()`**
* **Reactive Hooks**:
  * **`Helix.$http.useGet(url, options)`** / **`usePost()`** / **`usePut()`** / **`usePatch()`** / **`useDelete()`**
  * Returns a reactive object: `{ data, error, loading, completedAt, headers, execute(), cancel() }`.
* **`Helix.$http.useUpload(url, file, config)`**: Uploads binary attachments with structured progress bars.
* **`Helix.$http.setToken(token, type)`** / **`clearToken()`**: Configures/wipes Bearer auth headers.
* **`Helix.$http.raw`**: Underlying base Axios instance.

---

### 5. Helix Form (`plugins/helix-form.js` - v2.0.0)
Extracts and serializes DOM forms directly into typed JSON structures, supporting arrays and nested structures via name indices.

#### Input Naming Syntaxes:
* `name="user[name]"`: Serializes into `{ user: { name: 'value' } }`
* `name="tags[]"`: Serializes into `{ tags: ['value'] }`
* `name="age:number"`: Automatically casts string input into standard numeric variable.
* `name="active:boolean"`: Automatically casts checkbox/string to Boolean.

#### APIs:
* **`Helix.$form.serializeJSON(formElement)`**: Returns structured JSON values.
* **`Helix.$form.toFormData(object)`**: Converts nested objects directly into `FormData` layouts suitable for multipart uploads.
* **`Helix.$form.preparePayload(body, headers)`**: Auto-detects structures and sets up multipart vs JSON payloads.

---

### 6. Helix Loader (`plugins/helix-loader.js` - v2.5)
Renders page-level overlays or specific element containers with animations.

#### APIs:
* **`Helix.$loader.show(config)`**: Shows the global overlay.
  * *Config Options*: `theme: 'glass' | 'dark'`, `text: 'Loading...'`, `allowHtmlIcon: false`.
* **`Helix.$loader.hide()`**: Dismisses overlays.
* **`Helix.$loader.text(newText)`**: Changes message contents dynamically.
* **`v-loading` (Directive)**: Binds element-level loading cards.
  * Example: `<div v-loading="state.isLoading" hx-loading-config="theme:glass"></div>`

---

### 7. Helix Notify (`plugins/helix-notify.js` - v2.1)
An overlay wrapper for SweetAlert2, organizing Toast notification queues, custom clinical or glass alert dialogs, and AbortSignal async modal flows.

#### APIs:
* **`Helix.$notify.toast(title, options)`**: Queue-safe, non-blocking toast popups.
* **`Helix.$notify.alert(title, text, options)`**: Standard popup messages.
* **`Helix.$notify.confirm(title, text, options)`**: Promise-based confirmations.
* **`Helix.$notify.confirm3(title, text, options)`**: Confirm dialogs with three buttons (e.g. Yes, No, Cancel).
* **`Helix.$notify.prompt(title, placeholder, options)`**: Reads text input values asynchronously.
* **`Helix.$notify.async(title, text, promiseFn, options)`**: Locks screen with spinner until `promiseFn` resolves or rejects. Supports abort parameters.

---

### 8. Helix Model (`plugins/helix-model.js` - v2.2.1)
A client-side query and storage engine featuring AST compile paths, sorted index hashes, and memory-safe paging.

#### Fluent Queries:
```javascript
const DB = Helix.$model(usersData);

const results = DB
  .where('role', '=', 'admin')
  .whereBetween('age', [21, 65])
  .orderBy('name', 'asc')
  .limit(10)
  .get(); // Materializes array
```

#### Query Builders list:
* `where(field, operator, value)` / `whereNot(...)`
* `whereIn(field, values[])` / `whereNotIn(...)`
* `whereBetween(field, [min, max])` / `whereNotBetween(...)`
* `whereInstanceOf(type)`
* `search(fields[], queryText)`: Text search indexing.
* `orderBy(field, direction)` / `sortBy(field)` / `sortByDesc(field)`
* `limit(count, offset)` / `forPage(page, perPage)`
* `select(fields)` / `except(fields)`: Projections.
* `pluck(field)`: Flattens to single column array.
* `unique(field)`: Filters out duplicate entries.
* `groupBy(field)`: Returns key-grouped maps.
* `join()`, `leftJoin()`, `rightJoin()`, `innerJoin()`: Combine model collections.

#### Materialization:
* `get()` / `all()` / `toArray()`: Returns execution array.
* `first()` / `last()`: Returns matching boundary object.
* `count()`: Total matches.
* `paginate(perPage, currentPage)`: Returns pagination metadata and rows.

---
