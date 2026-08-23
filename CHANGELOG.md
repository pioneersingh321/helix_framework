# 📜 Changelog

All notable changes to the **Helix.js** framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [11.1.21] - 2026-08-23

### 🚀 Added
- **Vue 3.5-Style `useTemplateRef(key)` Composition API**:
  - Returns a `shallowRef(null)` registered to the component instance's `templateRefs` registry.
  - Integrates with `dirs.ref` (`ref="key"`, `:ref="key"`, `ref:key`) to auto-populate target DOM element or component instance on mount.
  - Automatically resets ref value to `null` upon element unmount and `destroyNode()`.
  - Enhanced function refs (`:ref="(el) => ..."` / `:ref="handleRef"`) with mount element forwarding and unmount `null` invocations.
  - Preserves full backward compatibility with legacy `ctx.$refs`.

- **Component Error Boundaries (`onErrorCaptured`)**:
  - `onErrorCaptured((err, instance, info) => boolean | void)` lifecycle hook.
  - Catches errors occurring in descendant components across `setup()`, lifecycle hooks (`onMounted`, `onUpdated`, `onUnmounted`), watchers, directives, and event listeners.
  - Hierarchical bubbling stops immediately when an error boundary hook returns `false`.

- **W3C Standard Web Components Generator (`defineCustomElement`)**:
  - Compiles any standard Helix component into a native W3C Custom Element (`class extends HTMLElement`).
  - **Open Shadow DOM / Light DOM**: Configurable shadow root encapsulation with component-scoped `<style>` injection.
  - **Reactive Props Proxy (C-01)**: Dynamic property proxy delegating reads/writes directly to `_props`, ensuring `setAttribute()` and property mutations (`el.prop = ...`) reactively update templates without stale snapshot freezes.
  - **Mount Generation Tokens & Disconnect Safety (C-02)**: Prevents asynchronous mount/disconnect race conditions via generation IDs (`_mountToken`), immediately discarding stale mounts if an element is disconnected before `app.mount()` finishes.
  - **Native Custom Events**: Component `emit(event, data)` calls automatically dispatch bubbling native `CustomEvent` instances.

- **Dynamic Components (`<component :is="...">` / `hx-is`)**:
  - Dynamic component mounting supporting string component names (e.g. `:is="currentTab"`), component definition objects, or reactive refs.
  - Automatically tears down stale instances and mounts newly selected components upon reactive state changes.

- **Prefix-Defined Slots (`h-slot`, `hx-slot`, `custom-slot`, `#`)**:
  - Dynamic slot directive extraction honoring configured application prefixes (`${appConfig.prefix}slot:name`, `${appConfig.prefix}slot="props"`).
  - Full support for `#` shorthand syntax (`#header="props"`, `#default`) and `v-slot` compatibility.

- **Built-in Teleport Engine (`hx-teleport` & `<Teleport>`)**:
  - Transports DOM subtrees into external portal targets (e.g. `body`, `#modal-target`) while retaining reactive context and event bubbling.
  - Features dynamic target reactivity, `:disabled` toggling with anchor return, and cascade cleanup.

- **Built-in Transition & Animation Engine (`hx-transition`, `<Transition>`, `<TransitionGroup>`)**:
  - CSS transition phases (`enter-from`, `enter-active`, `enter-to`, `leave-from`, `leave-active`, `leave-to`) on `hx-show` and `hx-if`.
  - Lifecycle cancellation safety with `cancelTransition()` and hook events (`@before-enter`, `@enter`, `@after-enter`, `@before-leave`, `@leave`, `@after-leave`).
  - FLIP list animations with automatic invert transforms (`recordPositions` / `applyFlip`) on `hx-for` list reordering.

- **Advanced Event Handling & Modifiers (`hx-on` / `@`)**:
  - **Click & Mouse Modifiers**: `@click.left`, `@click.right`, `@click.middle`, and `@click.outside` (click-outside detection for dropdowns/modals).
  - **Keyboard Modifiers & Aliases**: Key filters (`.enter`, `.esc`, `.tab`, `.space`, `.delete`, `.up`, `.down`, `.left`, `.right`, `.page-down`, `.page-up`) and single alphanumeric keys (`.a`-`.z`, `.0`-`.9`).
  - **System Modifiers & `.exact`**: Combinations with `.ctrl`, `.alt`, `.shift`, `.meta`, plus `.exact` strict modifier enforcement.
  - **Event Flow & Options**: `.stop`, `.prevent`, `.self`, `.once`, `.passive`, `.capture`, `.window`, and `.document` listeners.
  - **Dynamic Event Binding**: Support for runtime expressions like `@[dynamicEvent]="handler"`.

### 🛠️ Fixed
- Fixed Custom Element prop reactivity snapshot decoupling (C-01).
- Fixed Custom Element async mount/disconnect race condition leaving orphan apps (C-02).
- Fixed function ref context overwriting during unmount.
- Fixed mock DOM innerHTML text extraction and attribute change callbacks.
- Fixed `teleportDemo` property scoping in root demo template (`index.html`).

---

## [11.1.19] - 2026-08-20

### 🚀 Added
- **Single-Execution Plugin Engine**:
  - Added `_executed` lifecycle tracking to `Helix.use()` and `app.use()`, ensuring `install()` runs strictly once across multiple calls.
  - Added semver compatibility validation.

- **Unified ScopeScheduler**:
  - Replaced multiple interval timer loops with a centralized `ScopeScheduler` driving dirty scope refreshes with microtask batch deduplication.

- **DevTools & Profiling APIs**:
  - Real-time dependency inspection via `Helix.devtools.getDependencies()`.
  - Component hierarchy introspection via `Helix.inspectTree()`.
  - Performance profiling via `Helix.profile()` and `Helix.getProfileData()`.

- **Virtual DOM–Less Keyed List Diffing (`hx-for`)**:
  - Two-pointer head/tail fast-path trimming and Longest Increasing Subsequence (LIS) optimization for $O(1)$ appends and prepends.

---

## [11.1.18] - 2026-08-10

### 🚀 Added
- **Anti-FOUC Cloaking (`hx-cloak`)**: Auto-injected CSS hiding unmounted elements until initialization completes.
- **Server State Hydration (`hx-data`)**: Auto-hydration of server-rendered JSON payloads into reactive root state.
- **Priority Batching**: `Helix.batch()`, `Helix.batch.high()`, `Helix.batch.low()`, and priority effects (`"high"`, `"normal"`, `"low"`).
- **Deep Reactive Collections**: Deep proxy reactivity for `Map`, `Set`, and `Date`.
- **Dynamic Directive Arguments**: Attribute argument expressions such as `hx-bind:[attrName]="val"` and `@[eventName]="handler"`.

---

## [11.1.0] - 2026-07-15

### 🚀 Initial Stable Release
- Signal-native reactivity system (`ref`, `reactive`, `computed`, `effect`, `watch`, `effectScope`).
- Declarative directives (`hx-if`, `hx-for`, `hx-model`, `hx-bind`, `hx-on`, `hx-show`).
- Dependency injection (`provide` / `inject`).
- Scoped component architecture with slot distribution and lifecycle hooks.
- Global pub/sub event bus (`Helix.$bus`).
