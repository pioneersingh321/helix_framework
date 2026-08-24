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

## Enhanced Capabilities & Correctness Guarantees

- **Not Auto-Installed**: Fully matches every sibling Helix plugin (`scope`, `loader`, `fetch`, `axios`, `directives`). Simply registers `root.HelixHelpersPlugin` and expects explicit `Helix.use(HelixHelpersPlugin, options)`.
- **True Circular Data Structure Support**: `cloneDeep` and `isEqual` natively support circular Arrays, circular Maps (keys and values), circular Sets, circular Objects, and arbitrary cross-references.
- **Deep Clone Supported Types**: Deeply clones Primitives, Plain Objects, Arrays, Maps, Sets, Dates, and RegExps while preserving prototypes, property descriptors, and custom properties across all container types. Standard reference types (Functions, Promises, DOM nodes, WeakMaps) are safely preserved by reference.
- **Deep Map & Set Equality**: `isEqual` performs structural recursive pair-equality on Map entries and Set values, including complex circular Map/Set graphs.
- **Structured Bracket-Path Query Strings**: `toQueryString` and `fromQueryString` seamlessly round-trip nested objects (`user[name]`, `user[address][city]`) and arrays (`tags[]`, `items[0]`).
- **Container Type Safety in `set()`**: `H.set({}, 'users.0.name', 'John')` automatically creates Array containers for numeric path segments, replacing any existing mismatched non-Array containers when encountering numeric indices.
- **Distinct ID Semantics**: `H.id(prefix)` generates deterministic sequential DOM IDs (`hx-1`, `hx-2`), while `H.uniqueId(prefix)` generates collision-resistant random IDs (`hx-a1b2c3d4`).
- **SSR & Headless Execution Safety**: `scrollTo`, `copyToClipboard`, `downloadFile`, `collapse`, `intersect`, and `trapFocus` gracefully guard against missing DOM primitives in headless, testing, or server environments.
- **Explicit Event Dispatch Overloads**: Supports both global `dispatch(eventName, detail, options)` and element-targeted `dispatch(target, eventName, detail, options)`.
- **Proper Timer & Cancellation Semantics**: `debounce.cancel()` and `throttle.cancel()` reset timers and state cleanly.
- **Destructuring-Safe Methods**: `const { copy } = inject('$h')` works without `this` binding dependency.
- **Multi-Currency, Locale & UTC Support**: `formatCurrency` accepts either currency strings or options objects (`locale`, `currencyDisplay`, etc.), `formatNumber` accepts custom locales, and `formatDate` supports optional `{ utc: true }` mode.
- **Comprehensive Automated Test Suite**: Exhaustive test suite covering all 12 modules, circular reference graphs, provider lifecycle cleanup, and production bundle sandbox validation.

## Development & Testing

```bash
npm install
npm test          # Runs source test suite (works cleanly on fresh checkout)
npm run build     # Builds production IIFE bundles to dist/ and copies to plugins/helpers/
npm run test:build # Rebuilds bundle and executes full suite with dist validation
```
