# @helix/core (`helix-core`)

The core reactive framework engine for **Helix.js** (v11.1.17).

`helix-core` provides fine-grained reactivity, component architecture, template directive binding, dependency injection, and a robust plugin registry system.

---

## Features

- ⚡ **Fine-Grained Reactivity Engine**: `reactive()`, `ref()`, `computed()`, `effect()`, `watch()`, `watchEffect()`, `memo()`, and `effectScope()`.
- 🧩 **Component Architecture**: Lightweight setup-based component registration with `Helix.component()` and `createApp()`.
- 🔌 **Plugin System**: Seamless global and app-level plugin installation with `Helix.use()` and `app.use()`.
- 🎯 **Directive Engine**: Custom directive registration (`Helix.directive()`) with lifecycle hooks (`mounted`, `updated`, `unmounted`).
- ⚡ **Scheduler & Batching**: Optimised async render queues (`queueJob`, `queuePostFlushCb`, `batch`).
- 📡 **Event Bus**: Built-in pub/sub event system (`$bus`).
- 🛠️ **DevTools & Profiler**: Dynamic component tree inspection (`inspectTree()`), active effect tracking, and memory profiling.

---

## Installation & Setup

### CDN / Browser Script
```html
<script src="path/to/helix.js"></script>
```

### ES Module Import
```javascript
import { createApp, reactive, computed, ref, watch } from 'helix-core';
```

---

## Basic Usage

### 1. Creating and Mounting an Application

```html
<div id="app">
  <h1 hx-text="state.title"></h1>
  <button @click="increment">Count: <span hx-text="state.count"></span></button>
</div>

<script>
  Helix.mount('#app', ({ reactive }) => {
    const state = reactive({
      title: 'Hello Helix.js',
      count: 0
    });

    const increment = () => {
      state.count++;
    };

    return { state, increment };
  });
</script>
```

### 2. Standalone Reactivity & Watchers

```javascript
import { reactive, computed, watch, effect } from 'helix-core';

const store = reactive({
  apples: 5,
  oranges: 10
});

const totalFruits = computed(() => store.apples + store.oranges);

effect(() => {
  console.log(`Total fruits available: ${totalFruits.value}`);
});

watch(() => store.apples, (newVal, oldVal) => {
  console.log(`Apples updated from ${oldVal} to ${newVal}`);
});

store.apples = 12; // Triggers effect & watcher automatically
```

### 3. Registering Custom Directives

```javascript
Helix.directive('tooltip', {
  mounted(el, binding) {
    el.setAttribute('title', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('title', binding.value);
  }
});
```

---

## API Reference

### Core Reactivity
- `reactive(object)`: Creates a deep reactive proxy.
- `ref(value)`: Creates a reactive reference container (`ref.value`).
- `computed(getter)`: Creates a memoized reactive getter.
- `effect(fn, options)`: Runs a function reactively when dependencies change.
- `watch(source, cb, options)`: Watches a reactive source or getter for changes.
- `memo(runner, depsFn)`: Optimized memoized computation block.

### Application Lifecycle
- `Helix.createApp(rootComponent)`: Initializes an application instance.
- `Helix.mount(selector, setupFn)`: Mounts an app onto a DOM selector.
- `Helix.use(plugin, options)`: Installs a global plugin.
- `Helix.component(name, definition)`: Registers a component globally.
- `Helix.directive(name, definition)`: Registers a directive globally.

---

## License

MIT © Helix Framework Team
