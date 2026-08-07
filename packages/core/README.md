# @helix/core (`helix-core`)

The core reactive framework engine for **Helix.js** (v11.1.18).

`helix-core` provides fine-grained reactivity, setup-based component architecture, template directive binding, dependency injection, async component suspense, error boundaries, memory profiling, and a single-execution plugin registry.

---

## Key Features

### ⚡ 1. Fine-Grained Reactivity Engine
- **Proxies & Refs**: `reactive()`, `shallowReactive()`, `readonly()`, `shallowReadonly()`, `ref()`, `shallowRef()`, `customRef()`, `toRef()`, `toRefs()`, `toValue()`.
- **Computed & Memo**: `computed()` for memoized values and `memo()` for custom dependency array tracking.
- **Effects & Watchers**: `effect()`, `simpleEffect()`, `batch()`, `watch()`, and `watchEffect()`.
- **Effect Scopes**: `effectScope()`, `getCurrentScope()`, `onScopeDispose()`, `createEffectGroup()`, and `ScopeScheduler` for clean memory management.

### 🔌 2. Single-Execution Plugin System (v11.1.18 Compliant)
- **Global & App Plugins**: `Helix.use()` and `app.use()` with automated deduplication (`_executed` state tracking).
- **Dependency Validation**: `validatePluginDependencies()` with semver range resolution.
- **Plugin Lifecycle**: `definePlugin()`, `triggerPluginLifecycle()`, and `registry` inspection.

### 🧩 3. Component & Template System
- **App Instances**: `Helix.createApp()` and `Helix.mount()`.
- **Global & Local Components**: `Helix.component()` and `app.component()`.
- **Custom Directives**: `Helix.directive()` supporting `mounted`, `updated`, and `unmounted` hooks.
- **Namespaces**: `Helix.namespace()` for grouping APIs under modular namespaces.

### ⏳ 4. Async Components & Suspense
- **Async Loaders**: `defineAsyncComponent()` with retries, timeouts, and fallback handling.
- **Preloading**: `preload()` and `preloadAll()` for instant user interaction.
- **Suspense Component**: Built-in `<Suspense>` component for managing loading and error UI states.

### 🛡️ 5. Error Boundaries & Resilience
- **Error Boundaries**: `createErrorBoundary()` and `onErrorCaptured()` to catch descendant component errors gracefully.
- **Global Error Handler**: `Helix.onError()` for global exception logging and recovery.

### 🛠️ 6. DevTools, Inspection & Profiler
- **Component Tree Inspector**: `inspectTree()` and `inspectComponent()`.
- **Dependency Inspector**: `inspectDeps()` and active effect graph inspection.
- **Performance Profiler**: `profile()` and `getProfileData()` to measure render and compute performance.
- **Memory Diagnostics**: `checkMemoryLeaks()` for memory leak tracking.

---

## Installation & Setup

### CDN / Browser Script
```html
<script src="path/to/helix.js"></script>
```

### ES Module Import
```javascript
import { 
  createApp, 
  reactive, 
  computed, 
  ref, 
  watch, 
  effectScope, 
  defineAsyncComponent 
} from 'helix-core';
```

---

## Framework Configuration (`Helix.config`)

Helix provides global configuration defaults via `Helix.config`:

```javascript
// Configure framework options before mounting apps
Helix.config.prefix = 'hx-';                 // Default directive prefix (e.g. hx-text, hx-model)
Helix.config.debug = true;                   // Enables detailed console debugging
Helix.config.allowInlineExpressions = true;  // Allows inline expressions in directives
Helix.config.warnInlineExpressions = false;  // Disables warnings for inline expressions
Helix.config.removeAttributeBindings = true; // Removes directive attributes after compilation
Helix.config.delimiters = ["{{", "}}"];      // Interpolation delimiters
Helix.config.slowThreshold = 2;              // Render slow threshold warning (ms)
Helix.config.rethrowErrors = true;           // Rethrows errors to global window error handler
```

### Configuration Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `prefix` | `string` | `'hx-'` | Prefix used for HTML template directives (e.g. `hx-text`, `hx-model`, `hx-if`). |
| `debug` | `boolean` | `false` | Enables verbose debug mode in developer console. |
| `allowInlineExpressions` | `boolean` | `false` | Enables inline JS expression evaluation inside template directives. |
| `warnInlineExpressions` | `boolean` | `false` | Triggers console warnings when inline JS expressions are evaluated. |
| `removeAttributeBindings` | `boolean` | `true` | Automatically strips directive attributes from DOM elements after mounting. |
| `delimiters` | `string[]` | `["{{", "}}"]` | Custom interpolation syntax delimiters. |
| `slowThreshold` | `number` | `2` | Execution threshold (ms) for reporting slow renders or effects. |
| `rethrowErrors` | `boolean` | `true` | Controls whether uncaught template errors bubble up to global window error events. |
| `htmlSanitizer` | `function` | `null` | Pluggable custom sanitizer callback for `hx-html` (e.g. `(html) => DOMPurify.sanitize(html)`). |

---

## Feature Examples

### 1. Application & Components

```html
<div id="app">
  <h1 hx-text="state.title"></h1>
  <user-card></user-card>
</div>

<script>
  Helix.component('user-card', ({ reactive }) => {
    const user = reactive({ name: 'Alice', role: 'Architect' });
    return {
      user,
      template: `<div class="card">
        <h4 hx-text="user.name"></h4>
        <p hx-text="user.role"></p>
      </div>`
    };
  });

  Helix.mount('#app', ({ reactive }) => {
    const state = reactive({ title: 'Dashboard' });
    return { state };
  });
</script>
```

### 2. Effect Scopes & Automatic Cleanup

```javascript
import { effectScope, reactive, watch, onScopeDispose } from 'helix-core';

const scope = effectScope();
const state = reactive({ count: 0 });

scope.run(() => {
  watch(() => state.count, (val) => {
    console.log(`Count changed to ${val}`);
  });

  onScopeDispose(() => {
    console.log('Effect scope cleaned up!');
  });
});

state.count++; // Logs: Count changed to 1

// Stop scope and dispose all internal watchers/effects
scope.stop();
state.count++; // No log (scope is inactive)
```

### 3. Async Component with Fallback

```javascript
import { defineAsyncComponent } from 'helix-core';

const AsyncChart = defineAsyncComponent({
  loader: () => import('./ChartComponent.js'),
  delay: 200,
  timeout: 5000,
  retries: 3
});
```

### 4. Memory Profiling & Performance Measurement

```javascript
import { profile, getProfileData } from 'helix-core';

profile(() => {
  // Execute heavy computations or reactive updates
  for (let i = 0; i < 1000; i++) {
    state.items.push(i);
  }
});

const metrics = getProfileData();
console.log(`Execution Duration: ${metrics.duration}ms`);
```

---

## Dynamic DOM Rebinding (`Helix.rebind`)

Re-compiles and re-binds reactive state to dynamically inserted DOM elements (e.g., DataTables, jQuery plugins, or AJAX HTML content):

```javascript
// Rebind by CSS selector, DOM element, jQuery object, or NodeList
Helix.rebind('#dataTable');
Helix.rebind($('#dataTable'));

// DataTables draw callback integration:
table.on('draw.dt', function () {
    Helix.rebind($('#dataTable'));
});
```

- **Automatic Listener Cleanup**: Cleans up existing event listeners (`removeEventListener`) on already-bound elements before re-compiling to eliminate duplicate event triggers.
- **Recursive Subtree Traversal**: Recursively traverses and compiles all newly added child elements (`<tr>`, `<button @click="...">`, etc.).
- **Flexible Selector Support**: Works seamlessly with string selectors, jQuery objects, NodeLists, or DOM elements.

---

## API Summary

| Module | Core Exports |
|---|---|
| **Reactivity** | `reactive`, `ref`, `computed`, `effect`, `watch`, `watchEffect`, `memo`, `batch`, `toRaw`, `toRef`, `toRefs`, `toValue`, `customRef` |
| **Scope** | `effectScope`, `getCurrentScope`, `onScopeDispose`, `ScopeScheduler`, `createEffectGroup` |
| **App & Runtime** | `createApp`, `mount`, `component`, `directive`, `provide`, `inject`, `rebind`, `namespace` |
| **Plugins** | `use`, `unuse`, `definePlugin`, `validatePluginDependencies`, `triggerPluginLifecycle`, `registry` |
| **Async & Suspense** | `defineAsyncComponent`, `preload`, `preloadAll`, `Suspense` |
| **Diagnostics** | `createErrorBoundary`, `onErrorCaptured`, `inspectTree`, `inspectDeps`, `profile`, `checkMemoryLeaks` |

---

## License

MIT © Helix Framework Team
