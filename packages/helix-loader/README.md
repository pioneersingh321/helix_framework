# helix-loader

Helix Loader Plugin v2.5 for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

## Installation

```html
<script src="helix.js"></script>
<script src="helix-loader.js"></script>
```

```js
Helix.use(HelixLoaderPlugin, {
  theme: 'glass',      // glass | dark | light | clinical | ocean | emerald | sunset | cyberpunk
  icon: 'spinner',      // 'spinner' | 'dots' | a Font Awesome/Remix class string | () => HTMLElement
  text: 'Loading…'
});
```

## Features

- **Global overlay**: a full-page loading overlay with reference counting, so nested `show()`/`hide()` calls don't flicker each other off.
- **`v-loading` directive**: per-element loading overlays, pooled and recycled for large lists.
- **Themes**: eight built-in themes (`glass`, `dark`, `light`, `clinical`, `ocean`, `emerald`, `sunset`, `cyberpunk`), each overridable per-instance via `hx-loading-config`.
- **Anti-flicker & minimum duration**: `antiFlicker` delays showing the overlay for very fast operations; `minDuration` keeps it visible long enough to avoid a jarring flash.
- **Progress bar**: `$loader.progress(percent)`, with auto-hide on completion.
- **`$loader.wrap(promiseOrFn)`**: wraps an async operation, showing/hiding the loader automatically.
- **Namespaced API**: `Helix.namespace('loader', …)` plus `app.$loader` / `app.provide('$loader', …)`.

## Public API

```js
$loader.show(text?)
$loader.hide(force?)
$loader.text(val)
$loader.progress(percent)
$loader.wrap(fnOrPromise, { text? })
$loader.state   // reactive: { count, active, visible, text, progress }
```

## `v-loading` directive

```html
<div v-loading="isLoading" hx-loading-config='{"theme":"dark","icon":"dots"}'>
  ...
</div>
```

## Development

Install dependencies:
```bash
npm install
```

Build the package:
```bash
npm run build
```
