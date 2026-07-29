# helix-validation — Refactor Brief

Target: `packages/validate` in the Helix.js monorepo.
Current source: single-file build `helix-validation.js` v2.1.5 (2916 lines).

---

## 1. API Access Contract (non-negotiable)

Everything is consumed off the global instance, same as every other Helix plugin
(`helix-scope`, `helix-fetch`, `helix-model`, etc.). No named-import consumption pattern.

```js
// ✅ correct — only supported pattern
const $v = Helix.$validation;
$v.rules.add('customRule', fn);
$v.field(...);
$v.form(...);

// ❌ not supported / not documented
import { rules, field, form } from 'helix-validation';
```

Rules for the build:
- `install(app, options)` attaches the public API to `app.$validation` **and** mirrors it to
  `window.Helix.$validation` — this is the only mirror. Do not also duplicate the same object
  into `app.namespace('validation', {...})` as a second literal copy of 30 keys.
- Internal ES module `export { ... }` statements may stay in `src/` for build tooling only
  (bundling, tree-shaking during dev). They are **not** the documented/public interface and
  should not appear in README usage examples.
- Global assignment ordering bug fix (root.HelixValidationPlugin assigned after exports
  populated) must be preserved in the new file layout — re-verify after the split, this is
  an easy regression to reintroduce when files are recombined by Rollup.
- Follow the established autoload pattern: call `install()` directly rather than
  `Helix.use(Plugin, {})` inside the plugin's own autoload block, so a later explicit
  `Helix.use(HelixValidationPlugin, options)` from user code can still reconfigure it.

---

## 2. KEEP (core — used every day, Parsley-equivalent baseline)

| Item | Current location |
|---|---|
| `parseRuleStr`, `normalizeRules` | parser / rule-string compiler |
| `_registry` (global) + per-app `localRegistry` (rules.add/remove/get/has/list) | registry |
| `field()` controller | controllers |
| `form()` controller | controllers |
| `list()` controller | controllers — **kept**, see §4 (now required for Angular FormArray parity, not removed) |
| `scanForms`, `parseDataHx`, `getFormFromEl`, MutationObserver scan/schedule | dom scanning |
| `renderField`, `ensureErrSpan`, `getClassTarget`, `escapeHtml` | dom rendering |
| Built-in rules: `required`, `email`, `url`, `numeric`, `integer`, `pattern`, `minLength`, `maxLength`, `min`, `max`, `between`, `sameAs`, `oneOf` | rules |
| `requiredIf`, `requiredUnless` | rules |
| `runRemote` (remote/async validation) | remote |
| `check()` standalone validator | utils |
| `mkRule`, `mkFactory`, `resolveParam`, `resolveMsg`, `isEmpty` | rule utils |
| Directives `hx-validate`, `hx-form`, `hx-list` (progressive-enhancement `data-*` scan path included) | directive.js |

---

## 3. REMOVE from core → optional add-on packages

These are not part of the daily-use surface and should not be loaded/parsed by default.
Same registry, same `install()` pattern, just a separate script tag / separate plugin.

| Item | Move to | Why |
|---|---|---|
| `zodAdapter`, `yupAdapter`, `ajvAdapter`, `adapter()` registry | `helix-validation-schema` | Pulls in assumptions about 3 external libraries nobody using plain attribute validation needs loaded. |
| `useForm()` | fold into `form()` itself, delete the separate wrapper — it's not adding distinct behavior over calling `form()` directly with a context lookup. | Reduces surface duplication. |

**Not removing `or` / `and` / `not` / `each`** — reclassified in §4, they map directly to
Angular's `Validators.compose` / `Validators.composeAsync`, which is now an explicit target.

---

## 4. ADD — Angular Reactive Forms parity

Goal: `field()`/`form()`/`list()` should cover the same control surface as Angular's
`FormControl` / `FormGroup` / `FormArray`, expressed with Helix's own naming, not Angular's.

| Angular Reactive Forms | Helix equivalent | Status |
|---|---|---|
| `FormControl` | `field()` | have |
| `FormGroup` | `form()` | have |
| `FormArray` (`push`, `insert`, `removeAt`, `at`, `length`) | `list()` | **have partial — audit `list()`'s current add/remove API against this shape and fill gaps** |
| `Validators.compose([...])` | `and(...ruleFns)` | have, rename doc-facing alias `and` → also expose as `compose` for discoverability, same function |
| `Validators.composeAsync([...])` | needs a proper async variant, not just `withAsync` bolted onto one rule | **add** |
| `control.setValidators(newRules)` / `clearValidators()` | this is exactly the **per-field/per-form scoped `rules.add()`** feature discussed and not yet built | **add** — see §5 |
| `control.updateValueAndValidity()` | `form.validate()` / `field.validate()` should already re-run; confirm parity, expose same name as an alias if missing on `field()` | verify |
| `control.markAsTouched()` / `markAsUntouched()` | `touch()` exists; **`untouch()` is missing** | **add** |
| `control.markAsDirty()` / `markAsPristine()` | `dirty` exists as read state; no explicit setter methods | **add** `markDirty()` / `markPristine()` |
| `control.markAsPending()` | `pending` exists as read state during async; confirm it's settable indirectly via remote/async rule run, no manual setter needed | keep as-is |
| `control.disable()` / `enable()` | no equivalent currently | **add** — disabled fields skip validation and are excluded from `values()`/`rawValues()`, matching Angular behavior |
| `control.reset(value)` | `reset()` exists | have — confirm it accepts an optional value arg like Angular does |
| `control.valueChanges` (Observable) | `on('change', cb)` via existing `createEventEmitter` | have the emitter, **confirm `change` event is actually emitted on every value set**, not just on directive-driven input events |
| `control.statusChanges` (Observable) | no `status` event currently emitted | **add** — emit on `valid`/`invalid`/`pending` transitions |
| `group.get('path.to.control')` | `get()` exists | have |
| `group.patchValue()` / `setValue()` | `patch()` / `set()` exist | have |

---

## 5. Per-form / per-field scoped rule registration (blocking dependency for §4's setValidators)

Not present today — `rules.add()` only writes to the single per-app registry, so a rule
registered anywhere is visible to every form. Needed:

1. Each `form()` (and optionally each `field()`) gets its own empty `_localRules` Map — not
   cloned from the app registry, just an override layer.
2. Controller exposes `.rules` with the same `add/remove/get/has/list` shape as the app-level
   one, e.g. `formContact.rules.add(name, fn)`.
3. Rule-string resolution order becomes: **field's own `_localRules` (if `field()` gets one)
   → parent form's `_localRules` → app-level registry**. Must be resolved live, not
   pre-baked, so rules added after the form/fields already exist are still picked up by
   fields added later (`form.add(...)`).
4. This is the same mechanism `setValidators()`/`clearValidators()` from §4 should be built on
   top of — don't build two separate dynamic-rule systems.

---

## 6. Known structural bugs to fix while doing this pass

- **Three near-duplicate functions**: `getContextFromBinding`, `getContextFromBinding$1`,
  `getContextFromBinding$2` — one copy-pasted per directive (`hx-validate`/`hx-form`/`hx-list`).
  Merge into a single `getContextFromBinding(binding, type)`. This is very likely the root
  cause of the still-open `[Helix Validation] hx-form: binding must be a Form` warning —
  a fix applied to one copy doesn't propagate to the others. **Fix this before anything else
  in this list**, it's currently an open, mid-investigation bug.
- Triple API exposure (`window.Helix.$validation`, `app.namespace('validation', {...})`,
  `app.$validation`) duplicates ~30 keys twice in the install() body — collapse per §1.
- Confirm the module-level singleton fix (optional `localContext` param on `field()`/`form()`/
  `list()`) is preserved once files are split — a re-split is a common place to accidentally
  reintroduce a shared default context.

---

## 7. Proposed module layout

```
packages/helix-validation/src/
├── index.js               # install() only — wires everything, single export point
├── constants.js            # INSTALL_MARK, emailRx, getDefaultConfig, MSGS
├── context.js               # activeContext, setActiveContext, getCurrentContext, appContexts
├── registry.js               # global _registry + rules.add/remove/get/has/list factory
│                              #   (factory reused for per-app AND per-form/per-field, per §5)
├── parser.js                  # parseRuleStr, normalizeRules
├── rules/
│   ├── basic.js                 # required, email, url, numeric, integer, pattern
│   ├── bounds.js                 # minLength, maxLength, min, max, between
│   ├── compare.js                 # sameAs, oneOf, requiredIf, requiredUnless
│   ├── compose.js                  # and/compose, or, not, each, withAsync (composeAsync target)
│   └── utils.js                     # mkRule, mkFactory, resolveParam, resolveMsg, isEmpty
├── remote.js                         # runRemote
├── controllers/
│   ├── field.js                       # + disable/enable, markDirty/markPristine, untouch, .rules
│   ├── form.js                         # + disable/enable, .rules, statusChanges emit
│   └── list.js                          # FormArray-parity audit target
├── dom/
│   ├── scan.js                           # scanForms, scheduleScan, observer start/stop
│   ├── parse-attrs.js                     # parseDataHx, getFormFromEl
│   └── render.js                           # renderField, ensureErrSpan, getClassTarget, escapeHtml
├── directive.js                             # registerDirectives + ONE getContextFromBinding
└── events.js                                 # createEventEmitter (valueChanges/statusChanges)
```

Adapters (`zodAdapter`/`yupAdapter`/`ajvAdapter`) live entirely outside this tree, in a
separate `packages/validate-schema` package that registers into the same registry via
`Helix.$validation.rules.add(...)` at install time — it never gets imported by core.

---

## 8. Suggested work order

1. Fix the `getContextFromBinding` triplication + open `hx-form` binding bug (§6).
2. Split the file per §7 without changing behavior (mechanical move).
3. Collapse triple API exposure to one canonical path (§1/§6).
4. Implement scoped `rules` registry on `form()`/`field()` (§5).
5. Build `setValidators`/`clearValidators`/`disable`/`enable`/`untouch`/`markDirty`/
   `markPristine`/`statusChanges` on top of it (§4).
6. Audit `list()` against `FormArray` shape, fill gaps (§4).
7. Move zod/yup/ajv adapters out to `validate-schema` (§3).
8. Update README/examples to only ever show `Helix.$validation.*` usage (§1).