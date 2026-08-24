# @helix-js/directives (helix-directives)

Official Directives Plugin for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

`helix-directives` provides high-performance, accessible, and reactive directives for common UI patterns including event debouncing, smooth height collapsing, modal focus trapping with deep-tree inert background isolation, clipboard copying, and intersection observer viewport detection.

---

## 📦 Installation & Setup

### Script Tag (Browser)
```html
<script src="helix.js"></script>
<script src="helix-directives.js"></script>
<script>
    Helix.use(HelixDirectivesPlugin);
</script>
```

### Module / NPM
```javascript
import Helix from '@helix-js/core';
import HelixDirectivesPlugin from '@helix-js/directives';

Helix.use(HelixDirectivesPlugin);
```

---

## 🚀 Directives

### 1. `hx-debounce`
Debounces input, change, click, or custom events with reactive context resolution and automatic cancellation of pending timers upon component update.

```html
<!-- Bare function reference on context (default event: input, default delay: 300ms) -->
<input hx-debounce="handleSearch">

<!-- Call syntax with event object -->
<input hx-debounce="handleSearch($event)">

<!-- Nested property access from event -->
<input hx-debounce="handleSearch($event.target.value)">

<!-- Explicit delay override -->
<input hx-debounce="[handleSearch($event.target.value), 500]">

<!-- Custom event type via directive argument -->
<button hx-debounce:click="[saveDraft(), 1000]">Save Draft</button>
```

#### Syntax:
- `fnName`: Function name resolved against current context.
- `fnName(args...)`: Call syntax. `$event` passes the native event object; `$event.<path>` extracts nested event properties (e.g. `$event.target.value`).
- `[expression, delayMs]`: Overrides default delay (in milliseconds).

---

### 2. `hx-collapse`
Smoothly animates height between `minHeight` and natural content height (`scrollHeight`) using hardware-accelerated CSS transitions.

```html
<!-- Toggled by boolean state in context -->
<div hx-collapse="isOpen">
    <p>Collapsible accordion or dropdown content...</p>
</div>

<!-- Custom transition duration (default: 300ms) -->
<div hx-collapse.duration.500ms="isOpen">
    ...
</div>

<!-- Minimum height when collapsed (default: 0px / hidden) -->
<div hx-collapse.min.40px="isOpen">
    ...
</div>

<!-- Combined modifiers -->
<div hx-collapse.duration.200ms.min.20px="isOpen">
    ...
</div>
```

#### Modifiers:
- `.duration.<ms>` / `.<ms>ms`: Transition duration in milliseconds (e.g. `.duration.400ms` or `.400ms`).
- `.min.<px>` / `.min-<px>`: Minimum visible height in pixels when collapsed (e.g. `.min.40px`).
- Automatically cancels pending animation frames and cleans up inline styles on teardown.

---

### 3. `hx-trap`
Traps keyboard focus (`Tab` / `Shift+Tab` cycling) within an element, with optional background scroll locking (`.noscroll`) and deep-tree outside element isolation (`.inert`).

```html
<!-- Traps focus when showModal is truthy -->
<div hx-trap="showModal" class="modal">
    <button @click="showModal = false">Close</button>
    <input type="text" placeholder="First Name" />
</div>

<!-- Traps focus and prevents document body scrolling -->
<div hx-trap.noscroll="showModal" class="modal">
    ...
</div>

<!-- Traps focus, locks scroll, and marks background elements inert & aria-hidden -->
<div hx-trap.noscroll.inert="showModal" class="modal">
    ...
</div>
```

#### Features & Modifiers:
- `.noscroll`: Safely locks `document.body.style.overflow = 'hidden'`. Supports nested/overlapping traps with reference-counted locking so closing an inner modal keeps the body locked for the outer modal.
- `.inert`: Traverses DOM tree hierarchy to mark all non-ancestor siblings `inert = true` and `aria-hidden="true"`. Restores original attributes cleanly on modal close.
- **Focus Restoration**: Automatically captures `document.activeElement` before opening and restores focus to the opener element on close (if the element is connected and not disabled).
- **Tabindex Handling**: If the modal container has no focusable children, it temporarily adds `tabindex="-1"` and removes it cleanly on deactivation.

---

### 4. `hx-clipboard`
Copies text or reactive context values to the user's clipboard, applying a temporary feedback class and dispatching custom `@copied` events.

```html
<!-- Copies text content / input value of the element -->
<button hx-clipboard>Copy Code</button>

<!-- Copies bound context value -->
<button hx-clipboard="shareUrl">Copy Link</button>

<!-- Custom feedback class (default: .copied) -->
<button hx-clipboard.class.copied-active="shareUrl">Copy</button>

<!-- Custom feedback duration in milliseconds (default: 2000ms) -->
<button hx-clipboard.class.is-copied.duration.1000="shareUrl">Copy</button>

<!-- Listening to @copied event -->
<button hx-clipboard="token" @copied="onTokenCopied($event)">
    Copy Token
</button>
```

#### Events & Modifiers:
- `.class.<className>` / `.class-<name>`: Class added to the element upon successful copy.
- `.duration.<ms>`: Duration in milliseconds before removing the feedback class.
- `@copied` CustomEvent: Dispatched after every copy attempt. Event payload:
  ```javascript
  event.detail = {
      text: "https://example.com",
      success: true // boolean indicating if clipboard API succeeded
  };
  ```

---

### 5. `hx-intersect`
Executes a handler when an element enters or leaves the browser viewport using `IntersectionObserver`.

```html
<!-- Fires when element enters viewport -->
<div hx-intersect="loadMoreItems">...</div>

<!-- Passes IntersectionObserverEntry to handler -->
<div hx-intersect="onVisible($event)">...</div>

<!-- Fires only once (disconnects observer immediately) -->
<div hx-intersect.once="loadExpensiveData">...</div>

<!-- Custom visibility threshold -->
<div hx-intersect.threshold.50="onHalfVisible">...</div>
<div hx-intersect.threshold.75="onThreeQuartersVisible">...</div>
<div hx-intersect.half="onHalfVisible">...</div>
<div hx-intersect.full="onFullyVisible">...</div>

<!-- Custom rootMargin (with negative offsets and multi-values) -->
<div hx-intersect.margin.100px="prefetchNextPage">...</div>
<div hx-intersect.margin.-20px="onNearBottom">...</div>
<div hx-intersect.margin.10px_20px="onMargined">...</div>

<!-- Trigger when leaving viewport (:leave) -->
<div hx-intersect:leave="pauseVideo">...</div>
```

#### Threshold & Margin Rules:
- `.half`: 0.50 (50% visibility)
- `.full`: 1.00 (100% visibility)
- `.threshold.<percentage>`: Treated as a percentage:
  - `threshold.50` $\rightarrow$ 0.50 (Recommended)
  - `threshold.75` $\rightarrow$ 0.75
  - `threshold.100` $\rightarrow$ 1.00
  - `threshold.10` $\rightarrow$ 0.10
- `.margin.<css-value>`: Root margin offset. Use `_` for spaces (e.g. `10px_20px` $\rightarrow$ `"10px 20px"`) and `-` for negative margins (`margin.-50px`).
- `:leave`: Triggers handler when `entry.isIntersecting === false`.

---

## 🔄 Lifecycle Integration

All directives strictly follow Helix's reactive **`mounted()` + `updated()` + `cleanup`** lifecycle:
- **Automatic Cleanup**: Directives register their teardown functions with Helix Core's `trackCleanup`, guaranteeing complete removal of event listeners, observers, timers, and DOM mutations when elements are removed via `hx-if` or `hx-for`.
- **Dynamic Updates**: If directive values, modifiers, or contexts change at runtime, `updated()` reconciles state and observers dynamically.

---

## 🛠️ Testing & Verification

Run the comprehensive unit test suite:
```bash
node test-directives.js
```
Runs 60 automated assertions covering focus traps, deep-tree inert isolation, debounce timer cancellation, clipboard events, and observer lifecycle.
