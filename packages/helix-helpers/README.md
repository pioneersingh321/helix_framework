# helix-helpers

Direct-access utility library plugin for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

## Installation

```html
<script src="helix.js"></script>
<script src="helix-helpers.js"></script>
```

```js
Helix.use(HelixHelpersPlugin);
```

## Usage

```js
app.$h.camelCase('foo_bar');       // 'fooBar'
app.$h.groupBy(items, 'category'); // { a: [...], b: [...] }
```

Or via injection:
```js
const { $h } = inject('$h');
```

## Module layout

Split along the library's natural sections rather than the directive/controller
plugin template — this plugin has no directives, just a flat set of utility
functions grouped by domain:

- `shared.js` — private internal helpers used across sections (`_toPath`, `_isPlainObject`, `_serializeParam`, etc.)
- `types.js` — type checking (`isArray`, `isPlainObject`, `isEqual`, `isEmpty`, ...)
- `string.js` — `camelCase`, `kebabCase`, `slugify`, `escapeHtml`, ...
- `array.js` — `groupBy`, `sortBy`, `chunk`, `partition`, `difference`, ...
- `object.js` — `get`, `set`, `pick`, `omit`, `cloneDeep`, `deepMerge`, `merge`
- `date.js` — `formatDate`, `timeAgo`, `addDays`, ...
- `number.js` — `formatNumber`, `formatCurrency`, `round`, `clamp`, ...
- `validation.js` — `isEmail`, `isUrl`, `isPhone`, `isHexColor`, ...
- `dom.js` — `scrollTo`, `copyToClipboard`, `downloadFile`
- `data.js` — `stringify`, `parseJSON`, `toQueryString`, `fromQueryString`
- `async.js` — `debounce`, `throttle`, `retry`, `wait`, `uid`, `uuid`
- `index.js` — assembles the sections into `H`, registers `app.$h` / `app.namespace('helpers', ...)` / `inject('$h')`, returns cleanup

Each section is a factory function `createXMethods(H, ...)` that receives the
**final** shared `H` object by reference. Cross-section calls like `groupBy()`
(in `array.js`) calling `H.get()` (defined in `object.js`), or `retry()`
calling `H.wait()`, resolve correctly because `H` is fully populated by the
time any method actually *runs* — the same way the original single
object-literal version worked (methods referencing sibling methods on the
same object, just spread across files instead of one file).

## Notes on this version vs. the original single-file plugin

- **Not auto-installed.** The original version called `Helix.use(HelixHelpersPlugin)`
  automatically at script-load time if `window.Helix` already existed. That's
  inconsistent with every other Helix plugin (`scope`, `loader`, `fetch`, `axios`,
  `model`, `tooltip`) and would silently block a later explicit
  `Helix.use(HelixHelpersPlugin, options)` call, since core's plugin registry
  rejects a second install under the same name. This version just exposes
  `window.HelixHelpersPlugin` and expects an explicit `Helix.use(...)` call.
- **Removed the unused third `instance` parameter** from `install(app, options, instance)`.
  Core's plugin system never passes a third argument — the original file's own
  comments already correctly identified this exact pattern for why
  `app.onAppUnmount` doesn't work either, but the parameter itself was left in
  place; it's now gone.
- Everything else — behavior of every `H.*` method, the `_cloneMap`/`_equalMap`
  circular-reference handling, the `_timerCancels` cleanup tracking for
  `debounce`/`throttle` — is unchanged.

## Development

```bash
npm install
npm run build
```
