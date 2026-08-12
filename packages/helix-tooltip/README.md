# 💬 @helix/tooltip (`helix-tooltip`)

[![Version](https://img.shields.io/badge/version-0.0.0-indigo.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

A high-performance, event-delegated tooltip plugin for **Helix.js**. Built with zero-config autoloading, reactive data binding, smart viewport-middleware positioning, cursor following, async function resolvers, and full CSS custom property theming.

---

## 🗺️ Table of Contents

- [✨ Key Features](#-key-features)
- [📦 Installation & Autoloading](#-installation--autoloading)
- [🏁 Directive Syntax & Modifiers](#-directive-syntax--modifiers)
- [⚙️ Object Configuration Schema](#%EF%B8%8F-object-configuration-schema)
- [⏳ Async Tooltip Resolvers](#-async-tooltip-resolvers)
- [🛠️ Global Configuration Reference](#%EF%B8%8F-global-configuration-reference)
- [🔌 Programmatic API (`app.$tooltip`)](#-programmatic-api-apptooltip)
- [🎨 CSS Variables & Custom Styling](#-css-variables--custom-styling)
- [♿ Accessibility & Touch Support](#-accessibility--touch-support)

---

## ✨ Key Features

*   🚀 **Zero-Config Autoloading:** Drop in `<script src="helix-tooltip.js"></script>` and use `hx-tooltip` immediately without manual registration.
*   ⚡ **Event-Delegated Engine:** Operates via singleton document-level event listeners, guaranteeing zero per-anchor DOM listeners and minimal memory usage even with thousands of tooltips on a single page.
*   🧭 **Smart Positioning Middleware:** Includes automatic viewport edge flipping (`top` ↔ `bottom`, `left` ↔ `right`), boundary shifting/clamping, and pixel-precise arrow alignment.
*   🔄 **Fine-Grained Reactivity:** Automatically updates content when underlying Helix signals (`ref`, `reactive`, `computed`) change via `watchEffect`.
*   ⏳ **Async Function Resolvers:** Supports Promise-returning functions directly inside the directive (`hx-tooltip="loadBio(user.id)"`) with automatic token-guarded cancellation for unmounted anchors.
*   🎯 **Cursor-Following & Live Tracking:** Positional tracking that follows mouse movements (`.follow`) or continuously updates during dynamic layout shifts (`liveTracking: true`).
*   🛡️ **HTML Sanitization:** Safe rendering of HTML content (`.html`) with pluggable custom sanitizers (`DOMPurify`).
*   📱 **Touch Long-Press:** Built-in mobile support featuring long-press triggers for touch devices.

---

## 📦 Installation & Autoloading

### 1. Browser Script (Zero-Config Autoloading)
When loaded via a standard `<script>` tag alongside Helix, `helix-tooltip` automatically initializes itself:

```html
<script src="path/to/helix.js"></script>
<script src="path/to/helix-tooltip.js"></script>

<!-- Ready to use out of the box! -->
<button hx-tooltip="'Hello World!'">Hover Me</button>
```

### 2. Explicit Plugin Registration & Options
You can configure global defaults at registration time using `app.use()` or `Helix.use()`:

```javascript
import Helix from 'helix-core';
import HelixTooltipPlugin from 'helix-tooltip';

const app = Helix.createApp({ ... });

app.use(HelixTooltipPlugin, {
    placement: 'bottom',
    theme: 'dark',
    animation: 'slide',
    showDelay: 200,
    hideDelay: 100,
    offset: 10,
    arrow: true
});

app.mount('#app');
```

---

## 🏁 Directive Syntax & Modifiers

The `hx-tooltip` directive accepts string literals (in single quotes `'...'`), reactive context paths (`user.bio`), async functions, or JavaScript configuration objects.

```html
<!-- Quoted string literal -->
<button hx-tooltip="'Saved!'">Hover me</button>

<!-- Reactive state property -->
<span hx-tooltip.right.light="user.bio">Status</span>

<!-- Trigger argument shorthand -->
<button hx-tooltip:click="'Click to show tooltip'">Click Me</button>

<!-- Rich HTML content -->
<span hx-tooltip.html="'<b>Bold</b> notification text'">Hover for detail</span>

<!-- Interactive popup (allows hovering inside the tooltip) -->
<div hx-tooltip.interactive.hide-150="'<button>Action</button>'" hx-tooltip.html>Options</div>

<!-- Cursor-following tooltip -->
<canvas hx-tooltip:manual.follow="'X: 12, Y: 34'">Chart</canvas>

<!-- Custom show and hide delays -->
<button hx-tooltip.delay-500="'Slow to show and hide'">Delayed</button>
<button hx-tooltip.show-300.hide-100="'Custom show/hide timing'">Timing</button>
```

### Modifiers Quick Reference

| Modifier Group | Modifiers | Description |
|---|---|---|
| **Placement** | `.top`, `.bottom`, `.left`, `.right` | Preferred tooltip positioning relative to anchor element. |
| **Triggers** | `.hover`, `.click`, `.focus`, `.manual` | Event trigger mode. Argument syntax `hx-tooltip:click` is also supported. |
| **Themes** | `.dark`, `.light`, `.theme-<name>` | Tooltip visual theme (`.theme-purple` applies `.hx-tooltip-purple`). |
| **Animations** | `.zoom`, `.fade`, `.slide`, `.flip`, `.anim-<name>` | Entrance/exit animation style (`.anim-bounce` applies `.hx-tooltip-anim-bounce`). |
| **Delays** | `.delay-<ms>`, `.show-<ms>`, `.hide-<ms>` | Configures show and hide delays in milliseconds (e.g. `.delay-300`, `.show-500`, `.hide-100`). |
| **Content** | `.html` | Treats tooltip content string as HTML instead of plain text. |
| **Behavior** | `.interactive` | Keeps tooltip open when mouse moves over the tooltip popup itself. |
| **Tracking** | `.follow` | Positions the tooltip relative to mouse cursor coordinates. |

---

## ⚙️ Object Configuration Schema

Instead of chaining modifiers, you can pass an object literal directly to `hx-tooltip` for dynamic, programmatic control:

```html
<button hx-tooltip="{ 
    title: user.name, 
    placement: 'right', 
    theme: 'light', 
    animation: 'slide', 
    showDelay: 200, 
    hideDelay: 100,
    interactive: true,
    offset: 12
}">
  User Profile
</button>
```

### Supported Object Schema Properties

```typescript
interface TooltipObjectConfig {
    title?: string;          // Main content (alternative to 'content')
    content?: string;        // Main content (alternative to 'title')
    placement?: 'top' | 'bottom' | 'left' | 'right';
    trigger?: 'hover' | 'click' | 'focus' | 'manual';
    theme?: 'dark' | 'light' | string;
    animation?: 'zoom' | 'fade' | 'slide' | 'flip' | string;
    showDelay?: number;      // Delay before showing (ms)
    hideDelay?: number;      // Delay before hiding (ms)
    delay?: number;          // Applies to both showDelay and hideDelay (ms)
    html?: boolean;          // Render content as HTML
    interactive?: boolean;   // Enable pointer interaction inside tooltip
    follow?: boolean;        // Follow cursor movement
    disabled?: boolean;      // Disable tooltip display
    className?: string;      // Custom CSS class added to container
    maxWidth?: number | string; // Custom max-width limit (px or string)
    offset?: number;         // Offset distance from anchor (px)
    arrow?: boolean;         // Toggle arrow display
}
```

---

## ⏳ Async Tooltip Resolvers

`hx-tooltip` supports async function execution directly inside directive expressions. The function is executed once when the element mounts, and its promise resolution updates the tooltip content:

```html
<button hx-tooltip="loadUserBio(user.id)">Hover for Bio</button>
```

### Async Functions Returning Objects
Async functions can return a scalar string **OR** a full configuration object to dynamically configure tooltip parameters on resolution:

```javascript
setup() {
    async function loadUserBio(userId) {
        const data = await fetch(`/api/users/${userId}`).then(res => res.json());
        return {
            title: `<b>${data.name}</b><br>${data.bio}`,
            html: true,
            theme: 'light',
            placement: 'right',
            interactive: true
        };
    }

    return { loadUserBio };
}
```

---

## 🛠️ Global Configuration Reference

All 17 framework options can be configured during `app.use()` plugin initialization or updated at runtime via `app.$tooltip.setDefaults(options)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `placement` | `string` | `'top'` | Default placement (`'top'`, `'bottom'`, `'left'`, `'right'`). |
| `theme` | `string` | `'dark'` | Visual theme name (`'dark'`, `'light'`, or custom theme class). |
| `animation` | `string` | `'zoom'` | Transition animation (`'zoom'`, `'fade'`, `'slide'`, `'flip'`). |
| `showDelay` | `number` | `100` | Delay in milliseconds before showing tooltip. |
| `hideDelay` | `number` | `60` | Delay in milliseconds before hiding tooltip. |
| `offset` | `number` | `8` | Distance in pixels between anchor element and tooltip. |
| `viewportPadding` | `number` | `8` | Minimum distance in pixels from viewport edge. |
| `maxWidth` | `number` | `240` | Maximum tooltip container width in pixels. |
| `arrow` | `boolean` | `true` | Show or hide the directional tooltip arrow. |
| `zIndex` | `number` | `9999` | `z-index` property for the singleton tooltip container. |
| `appendTo` | `string` | `'body'` | Selector for element to which tooltip container is appended. |
| `closeOnClickOutside` | `boolean` | `true` | Automatically hide active tooltip on document click outside. |
| `closeOnEscape` | `boolean` | `true` | Automatically hide active tooltip when pressing `Escape`. |
| `longPressDelay` | `number` | `450` | Touch long-press duration (ms) for mobile touch devices. |
| `sanitize` | `function` | `null` | Custom sanitizer callback `(html, { el }) => string`. |
| `liveTracking` | `boolean` | `false` | Enable continuous position recalculation on scroll/layout shift. |
| `ariaLive` | `boolean\|string` | `false` | Sets `aria-live` attribute (`'polite'`, `'assertive'`, or `true`). |

---

## 🔌 Programmatic API (`app.$tooltip`)

The plugin registers a global `$tooltip` API on the app instance (`app.$tooltip`), global Helix object (`Helix.$tooltip`), and dependency injection context (`inject('$tooltip')`):

```javascript
// Show tooltip programmatically on a DOM element
app.$tooltip.show(element, 'Custom Content', { placement: 'right', theme: 'light' });

// Hide currently active tooltip
app.$tooltip.hide({ immediate: false });

// Toggle tooltip state
app.$tooltip.toggle(element, 'Toggled Content');

// Hide all active tooltips immediately
app.$tooltip.hideAll();

// Update content of active tooltip on element
app.$tooltip.update(element, 'Updated Content');

// Check if element's tooltip is currently visible
if (app.$tooltip.isVisible(element)) {
    console.log('Tooltip is visible!');
}

// Update global defaults at runtime
app.$tooltip.setDefaults({ theme: 'light', showDelay: 200 });

// Access raw singleton DOM element
const tooltipNode = app.$tooltip.raw();

// Destroy tooltip instance and remove event listeners
app.$tooltip.destroy();
```

---

## 🎨 CSS Variables & Custom Styling

`helix-tooltip` uses CSS Custom Properties for zero-overhead theme customization. You can override variables globally or inside specific theme classes:

```css
/* Global tooltip custom property overrides */
:root {
    --hx-tooltip-bg: #0f172a;
    --hx-tooltip-fg: #f8fafc;
    --hx-tooltip-padding: 8px 12px;
    --hx-tooltip-radius: 8px;
    --hx-tooltip-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    --hx-tooltip-border: #334155;
}

/* Custom theme class (.theme-purple modifier -> .hx-tooltip-purple) */
.hx-tooltip-purple {
    --hx-tooltip-bg: #7e22ce;
    --hx-tooltip-fg: #ffffff;
    --hx-tooltip-shadow: 0 4px 14px rgba(126, 34, 206, 0.4);
}

/* Custom animation class (.anim-bounce modifier -> .hx-tooltip-anim-bounce) */
.hx-tooltip-anim-bounce {
    transform: translateY(10px);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
}
.hx-tooltip-anim-bounce.hx-tooltip-visible {
    transform: translateY(0);
}
```

Usage with custom theme and animation modifiers:
```html
<button hx-tooltip.theme-purple.anim-bounce="'Custom Purple Bounce!'">
  Custom Style
</button>
```

---

## ♿ Accessibility & Touch Support

*   **ARIA Compliance:** Automatically sets `role="tooltip"`, `aria-hidden="true/false"`, and updates `aria-describedby` on the active anchor element.
*   **Keyboard Navigation:** Supports `.focus` triggers for keyboard focus state and dismisses tooltips on `Escape` keypress (`closeOnEscape: true`).
*   **Mobile Touch Support:** Includes built-in touch long-press detection (`longPressDelay: 450ms`) for touchscreens where hover states are unavailable.

---

## 📄 License

MIT © Helix Framework Team
