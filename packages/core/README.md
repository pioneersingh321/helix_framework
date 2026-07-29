# @helix/core (`helix-core`)

The core reactive framework engine for **Helix.js** (v11.1.17).

`helix-core` provides fine-grained reactivity, setup-based component architecture, template directive binding, dependency injection, async component suspense, error boundaries, memory profiling, and a single-execution plugin registry.

---

## Key Features

### ⚡ 1. Fine-Grained Reactivity Engine
- **Proxies & Refs**: `reactive()`, `shallowReactive()`, `readonly()`, `shallowReadonly()`, `ref()`, `shallowRef()`, `customRef()`, `toRef()`, `toRefs()`, `toValue()`.
- **Computed & Memo**: `computed()` for memoized values and `memo()` for custom dependency array tracking.
- **Effects & Watchers**: `effect()`, `simpleEffect()`, `batch()`, `watch()`, and `watchEffect()`.
- **Effect Scopes**: `effectScope()`, `getCurrentScope()`, `onScopeDispose()`, `createEffectGroup()`, and `ScopeScheduler` for clean memory management.

### 🔌 2. Single-Execution Plugin System (v11.1.17 Compliant)
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
