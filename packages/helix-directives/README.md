# helix-directives

Directives plugin for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

Currently ships one directive — **`debounce`** — with more planned. New
directives are added by dropping a file into `src/directives/` (see
"Adding a new directive" below); nothing else about the plugin's shape needs
to change.

## Installation

```html
<script src="helix.js"></script>
<script src="helix-directives.js"></script>
```

```js
Helix.use(HelixDirectivesPlugin);
```

## `hx-debounce`

```html
<!-- bare function reference, default event (input), default delay (300ms) -->
<input hx-debounce="handleSearch">

<!-- call syntax with $event -->
<input hx-debounce="handleSearch($event)">

<!-- explicit delay -->
<input hx-debounce="[handleSearch($event), 500]">

<!-- custom event via directive argument -->
<button hx-debounce:click="[saveDraft(), 1000]">Save</button>
```

Value syntax:
- `fnName` — a bare reference to a function on the current context.
- `fnName(args...)` — call syntax; `$event` in the argument list resolves to the real event object, other arguments resolve against the context, then fall back to JSON literals, then quoted string literals.
- `[expression, delayMs]` — wraps either of the above with an explicit delay (default `300`).

## Rewritten from the original single-file version

This plugin previously implemented its own parallel `scan()` / `MutationObserver`-based
directive system *alongside* registering through Helix's native `app.directive()` —
meaning every directive risked being mounted twice. That parallel system also built
attribute names as `` `${prefix}-${name}` ``, assuming a dash-less prefix like `'h'`,
but Helix's real default `config.prefix` is `'h-'` (dash already included) — so with
an unconfigured app, the custom scanner would look for `h--debounce` and silently
match nothing. On top of that, cleanup was tracked in a separate `mountedElements`
map that Core's actual node-destruction path (`destroyNode`) never touches, so
listeners and timers were never actually cleaned up when an element left the DOM via
`hx-if`/`hx-for`/unmount.

This version drops that entire parallel system and registers directives purely
through Core's native `app.directive()` — the same mechanism every other plugin in
this ecosystem (`scope`, `loader`, `tooltip`) correctly uses — and uses Core's own
`binding.trackCleanup` for lifecycle integration, so cleanup actually runs when Core
tears down the node.

Also fixed: the `[expression, delay]` value parser used a naive
`inner.lastIndexOf(',')` to split the expression from the delay, which broke as soon
as the wrapped expression had its own multiple arguments — e.g. `[refreshData(a, b)]`
with no delay override would misread the comma between `a` and `b` as the delay
separator and truncate the call. Replaced with a depth-aware splitter (respects
nested `()`/`{}`/`[]` and quoted strings) that only treats the value as
`[expression, delay]` when there are exactly two top-level parts and the second is a
bare integer.

Not auto-installed on script load, either — matches every other plugin in this
ecosystem.

## Adding a new directive

```js
// src/directives/whatever.js
export function createWhateverDirective(app, config) {
    return {
        mounted(el, binding) { /* ... */ },
        updated(el, binding) { /* ... */ },
    };
}
```

```js
// src/index.js
import { createWhateverDirective } from './directives/whatever.js';

const directiveFactories = {
    debounce: createDebounceDirective,
    whatever: createWhateverDirective  // <- add here
};
```

That's it — no scanner, no MutationObserver, no separate cleanup tracking to wire up.

## Development

```bash
npm install
npm run build
```
