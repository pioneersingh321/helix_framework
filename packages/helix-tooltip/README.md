# helix-tooltip

Tooltip plugin (v1.7.0) for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

## Installation

```html
<script src="helix.js"></script>
<script src="helix-tooltip.js"></script>
```

That's it — **`hx-tooltip` works immediately, no `Helix.use()` call required.** As long as `helix.js` loads first, the plugin installs itself automatically with default options.

To pass options, `Helix.use()` still works normally and reconfigures on top of the autoloaded defaults:
```js
Helix.use(HelixTooltipPlugin, { theme: 'light', showDelay: 200 });
```
(Technical note, same pattern as `helix-directives`/`helix-helpers`/`helix-model`: autoload calls `install()` directly rather than `Helix.use()`, so it never occupies a slot in Core's plugin registry — that's what keeps a later explicit `Helix.use()` call from being silently rejected as "already registered.")

## Usage

```html
<button hx-tooltip="'Saved!'">Hover me</button>
<span hx-tooltip.right.light="user.bio">Reactive content</span>
<button hx-tooltip:click="'Click me again to dismiss'">Click trigger</button>
<div hx-tooltip:manual="'Controlled from code'">...</div>

<span hx-tooltip.html="'<b>Bold</b> text'">Rich content</span>
<div hx-tooltip.interactive.hide-150="'<button>Click me</button>'" hx-tooltip.html>...</div>
<canvas hx-tooltip:manual.follow="'x: 12, y: 34'">Chart</canvas>
<button hx-tooltip.delay-500="'Slow to appear'">Delayed</button>
<button hx-tooltip.slide="'Slides in'">Slide animation</button>

<!-- Object-config alternative to modifier chains -->
<button hx-tooltip="{ title: user.name, placement: 'top', trigger: 'hover', delay: 300 }">
  Object config
</button>

<!-- Async content, resolved once at mount -->
<button hx-tooltip="loadUserBio(user.id)">Hover for bio</button>
```

See the full grammar/contract in `src/index.js`'s header comment (carried over
from the original — placement/theme/animation modifiers, `.delay-<ms>` /
`.show-<ms>` / `.hide-<ms>`, the quoted-literal-or-ctx-path-only content rule,
and the object-config schema).

Programmatic API: `app.$tooltip.{show,hide,toggle,hideAll,update,isVisible,setDefaults,destroy}`.

## Module layout

```
src/
  constants.js        placements, fallback chains, default options, parsing regexes
  style.js             CSS injection, reference-counted per app instance
  position.js           pure Floating-UI-style middleware pipeline (flip -> offset -> shift -> arrow)
  content-parser.js     object-config / content-grammar parsing (no shared state)
  async-content.js      hx-tooltip="asyncFn()" resolution
  index.js               the stateful controller: owns the singleton tooltip
                          element, active-anchor state, timers/observers;
                          wires together everything above; registers the
                          directive, delegated document-level listeners, and
                          the public API; autoloads
```

Unlike `helix-helpers` (mostly independent utility sections) or
`helix-directives` (one directive, minimal shared state), this plugin has a
genuinely large amount of state shared across positioning, show/hide, live
tracking, and the delegated event handlers — the singleton tooltip element,
the currently-active anchor, in-flight timers, `ResizeObserver`/
`IntersectionObserver` instances. Splitting that further would mean either
passing a dozen getters/setters into every extracted function or introducing
a mutable "context object" purely to satisfy a module boundary — so `index.js`
stays as the controller for that state, while everything that's genuinely
independent (positioning math, content/object-config parsing, style
injection, async content resolution) is factored out and covered by its own
tests.

## Fixed during modularization

`splitTopLevel()` and `findTopLevelColon()` (used to parse function-call
arguments and object-config key/value pairs) tracked nesting depth for
`{}`/`[]` but not `()`. In practice this meant a comma inside a nested call —
e.g. `hx-tooltip="notify(formatDate(item.created, 'YYYY-MM-DD'))"` — got
misread as the outer argument separator, silently corrupting the parse into
two malformed fragments instead of one (still-unsupported, since nested
function calls aren't part of the argument grammar) but now at least
correctly-delimited value. Fixed to track all three bracket types together,
matching the equivalent arg-splitters in `helix-fetch`, `helix-axios`, and
`helix-directives`.

Everything else — the full grammar, the middleware pipeline, event
delegation, live tracking, accessibility attributes, cleanup lifecycle — is
unchanged from the original; it was already careful about the things that
usually go wrong here (correct use of `mouseover`/`mouseout` rather than
`mouseenter`/`mouseleave` for delegation, a destroyed-guard on late-resolving
async content, idempotent `destroy()`).

## Development

```bash
npm install
npm run build
```
