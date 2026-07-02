# Helix.js Framework

Helix.js is a blazing-fast, lightweight, O(1) reactive JavaScript framework inspired by Vue.js. This repository contains the latest stable Helix Core framework and its official plugins.

---

## 📁 Repository Structure

The project has been organized into a clean structure suitable for git projects:

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

## 🚀 Quick Start

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

### Configuration (`Helix.config`)
Configure global features before mounting your application.
```javascript
Helix.config.prefix = 'v-';              // Custom directive prefix
Helix.config.debug = true;                // Enable debug warnings
Helix.config.allowInlineExpressions = true; // Allow simple JS in attribute directives
```

### Reactivity
* **`Helix.reactive(object)`**: Creates a deep reactive proxy of the provided object.
* **`Helix.watch(getter, callback, options)`**: Observes a reactive getter and fires a callback on change.
  ```javascript
  Helix.watch(() => state.count, (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
  });
  ```
* **`Helix.effect(fn)`**: Runs a function immediately and auto-tracks reactive variables inside it to re-run on updates.
  ```javascript
  Helix.effect(() => {
    document.title = `Count: ${state.count}`;
  });
  ```

---

## 🔌 Core Plugins Overview

All active plugins are located under the `plugins/` directory:

### 1. Helix Validation (`plugins/helix-validation.js` - v2.1.5)
Zero-configuration interactive form validation. Simply add the `v-validate` directive and validation attributes to your input elements.
* **Usage**:
  ```html
  <script src="./plugins/helix-validation.js"></script>
  ```
  ```html
  <form id="signupForm" v-validate>
    <input name="email" data-hx-rules="required|email">
    <span class="hx-error-msg"></span>
  </form>
  ```

### 2. Helix Fetch (`plugins/helix-fetch.js` - v2.8.2)
A unified Fetch wrapper featuring asynchronous request queueing, automatic background polling, and AbortController request cancellation.
* **Usage**:
  ```javascript
  const fetchInstance = Helix.$fetch.request({
    url: '/api/data',
    pollInterval: 5000,
    onSuccess: (data) => console.log(data)
  });
  ```

### 3. Helix Axios (`plugins/helix-axios.js` - v2.2.0)
An advanced Axios wrapper supporting retry backoffs (idempotent request guard), request deduplication fingerprints, and out-of-order response guardrails.
* **Usage**:
  ```javascript
  Helix.$axios.get('/api/resource', { dedupe: true });
  ```

### 4. Helix Loader (`plugins/helix-loader.js` - v2.5)
Provides a global loading overlay as well as target-specific loaders using clean Glassmorphism or Dark themes.
* **Usage**:
  ```html
  <div v-loading="state.isLoading" hx-loading-config="theme:glass;icon:spinner"></div>
  ```

### 5. Helix Notify (`plugins/helix-notify.js` - v2.1)
An overlay wrapper for SweetAlert2, organizing Toast notification queues, custom clinical or glass alert dialogs, and AbortSignal async modal flows.
* **Usage**:
  ```javascript
  Helix.$notify.toast('Item added!', { type: 'success' });
  ```

### 6. Helix Model (`plugins/helix-model.js` - v2.2.1)
An in-memory query engine featuring structured index keys, AST parsing, filtering pipelines, and memory-safe Top-K streams.

### 7. Helix Behavior (`plugins/helix-behavior.js` - v1.3.1)
An interactive pipe-delimited HTML script tool enabling simple reactive trigger cycles inside standard elements without writing custom JS.

---

## 🛠️ Development & Git Commands

To set up a local development copy:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd helix_framework
   ```

2. **Check Git Status**:
   ```bash
   git status
   ```

3. **Running Examples**:
   You can serve this project directory using local HTTP servers (e.g., MAMP, live-server, or python http.server).
   ```bash
   python -m http.server 8000
   ```
   Open `http://localhost:8000/index.html` or `http://localhost:8000/index-validation.html` to run interactive dashboards and view console tests.
