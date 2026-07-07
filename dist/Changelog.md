# Helix.js Changelog

## v11.1.8

### Added

- **`hx-scope:<name>="expression"`** — new builtin directive (`dirs.scope`,
  registered alongside `if`/`for` in `createBuiltinDirectives`). Evaluates an
  expression (typically an async data call) and exposes the result as
  reactive state to the entire descendant subtree:

  ```html
  <div hx-scope:object="store.dashboard.getData($event, 'api/report/states', {data:'1'})">
    <div hx-if="!object?.status">Loading...</div>
    <span hx-if="object?.status" hx-text="object.count"></span>
  </div>
  ```

  - Exposed state: `object.$loading`, `object.$error`, `object.$data` (the
    raw resolved value), `object.refresh()` (re-runs the expression), plus
    every own key of a plain-object result spread directly onto `object`.
  - Because it's wired through the normal `ctx` prototype chain via
    `bindNode`, the scope's data is visible to **every** descendant
    directive automatically — `hx-if`, `hx-on`, `hx-text`, `hx-html`,
    `hx-bind`, `hx-model`, `{{ }}` text interpolation, and any custom
    directive registered via `app.directive`/`Helix.directive`. No directive
    needs special-casing to "see" scope data.

- **`${prefix}scope-default:<name>='{"key": value}'`** — optional companion
  attribute (JSON object) declaring fallback values for keys that come back
  missing or `undefined` on the resolved result, so a template doesn't have
  to handle "key not there yet" as a special case:

  ```html
  <div hx-scope:object="store.dashboard.getData(...)"
       hx-scope-default:object='{"status": false, "count": 0}'>
  ```

  Respects your app's configured `${appConfig.prefix}` (core's own default
  prefix is `"h-"`; this project's convention of `"hx-"` must be set via
  `Helix.config.prefix = 'hx-'`).

### Behavior notes / internal design

- The **initial** `run()` is deferred onto the root instance's
  `hooks.mount` (found by walking each instance's `.parent` chain to the
  top), not fired mid-bind. This lets scope expressions safely depend on
  anything a component's `onMount()` sets up elsewhere in the tree.
  Subsequent `refresh()` calls are unaffected and run immediately.
- A compile error in the scope expression logs via `console.error` and
  falls back to binding the scope's children against the **parent** `ctx`
  instead of leaving the whole subtree unbound — one bad expression no
  longer disables every other directive underneath it.
- Result keys are set before stale ones are deleted (not delete-then-set),
  so a key that persists across `refresh()` calls does a single
  old-value → new-value transition instead of a transient
  old-value → `undefined` → new-value flicker for anything watching it.
- Scope names are lowercased by core's own attribute parsing before the
  directive ever sees them (e.g. `hx-scope:myQuery` → `"myquery"`). Use
  kebab-case or all-lowercase scope names.

### Verification

- Added a hand-rolled DOM shim + smoke test (12/12 passing) covering:
  mount + deferred initial run, `hx-scope-default` fallback merge, `hx-if`
  toggling off scope state, `hx-text` re-rendering on `refresh()`, a
  genuinely custom directive reading the same live `ctx`, and the
  compile-error fallback.
- **Not yet run against this build:** the project's existing 15-bug core
  regression suite, and the other plugin files (`helix-tooltip.js`,
  `helix-model.js`, `helix-device.js`, `helix-fetch.js`, `helix-validate.js`)
  loaded alongside it. Nothing in this change touches shared internals
  (`reactive`, `bindNode`, `resolveDirective`) beyond reading from them the
  same way `dirs.for` already does, but that suite should still be run
  before treating this as release-ready.

### Migration from the standalone `helix-scope.js` plugin

No action required. `resolveDirective` checks `appDirectives → globalDirectives
→ builtinDirectives` in that order, so if an app still has the old
`Helix.directive('scope', ...)` plugin loaded, its registration silently
takes precedence over this builtin — safe to roll out without a breaking
change, and safe to remove the standalone plugin file whenever convenient.

---

## v11.1.7

- reactivity: triggers are now synchronous (schedulers fire immediately,
  work still batches via the job queue). Removes the global version
  counter so `computed` no longer recomputes on unrelated state writes.
- `hx-if`: instantiates a fresh clone per show and fully destroys it on
  hide (fixes leaked effects/listeners and within-frame duplicate
  handlers).
- `hx-for`: per-item cleanup buckets + placeholder-anchored teardown so
  nested lists tear down correctly when an ancestor `hx-if` hides.