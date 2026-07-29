# helix-validation — Agent Brief (v3)

Supersedes the earlier module-split brief. This one is focused on a concrete, currently-open
bug plus a scope clarification the last few rounds have been dancing around without naming
directly.

---

## 1. THE ROOT BUG — scan-marker prefix is wrongly coupled to `app.config.prefix`

This is almost certainly why every `hx-*` attribute example so far has "not worked," across
multiple rounds, for multiple reasons that all trace back to the same design mistake.

### What's happening in the code today

Every DOM-scanning function (`scanForms`, `parseDataHx`, `cleanupRemovedNode`, the submit-button
selector, the list-item selectors — 8 call sites total) derives its attribute prefix like this:

```js
const rawPrefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
const prefix = rawPrefix.replace(/-+$/, "");
// then used as: `[${prefix}-form]`, `${prefix}-rules`, `${prefix}-field`, etc.
```

This ties the plugin's own DOM-marker namespace (`hx-form`, `hx-field`, `hx-rules`, `hx-remote`,
`hx-debounce`, ...) to **Helix core's configurable directive prefix** — the same prefix used for
`Helix.config.prefix = "mv-"` and core directives like `mv-if`/`mv-bind`/`mv-for` in this project.

Since this project's app is configured with `prefix: "mv-"`, the scan ends up looking for
`[mv-form]`, `mv-field`, `mv-rules` — **never** `hx-form`/`hx-field`/`hx-rules`. So:

```html
<form hx-form="newsletter">
  <input hx-field="email" hx-rules="required|email" name="email" type="email" required>
</form>
```

...is never found by `scanForms` at all. Not a subtle bug — the entire progressive-enhancement
path is a silent no-op for this app, and has been every time it was tried with plain `hx-*`
attributes.

### The fix

**`hx-*` is the plugin's own fixed namespace and must not be derived from `app.config.prefix`
at all.** Change every one of the 8 call sites from:

```js
const rawPrefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
const prefix = rawPrefix.replace(/-+$/, "");
```

to a single hardcoded constant:

```js
const prefix = "hx"; // plugin's own namespace — intentionally independent of Helix core's directive prefix
```

Pull this into one shared constant (`SCAN_PREFIX = "hx"`) rather than repeating the literal in
8 places, so it can't drift again.

---

## 2. Two different attribute mechanisms exist in this file — name them so they stop colliding

This has been the source of confusion across the last several rounds. There are genuinely two
separate systems here, with different rules, and they need to be documented as such:

| | Mechanism | Prefix source | Example |
|---|---|---|---|
| **A. Progressive DOM scan** | Plain `querySelectorAll` over raw attributes, runs independently of Helix's compiler | **Fixed `hx-`**, per §1 fix — never `app.config.prefix` | `<form hx-form="newsletter"><input hx-field="email" hx-rules="required\|email"></form>` |
| **B. Helix core directives** | `app.directive("validate"/"form"/"list", ...)`, goes through Helix's compiler (`bindNode`), binds to reactive `ctx` values by path | **`app.config.prefix`** (e.g. `mv-` in this project) — this is correct and should stay as-is | `<select mv-validate="someFieldRef">` bound to an actual reactive Form/Field object in scope |

Mechanism A is what almost every real usage of this plugin should reach for (declarative,
Parsley-style, works the moment `Helix.$validation` exists, no JS wiring needed).

Mechanism B is for the advanced case where you already have a `field()`/`form()`/`list()`
object in JS and want to bind an element directly to that object by reference.

**Action:** rename internally so this isn't two things sharing one word. Suggest:
- Keep `hx-validate`, `hx-form`, `hx-list` as the **directive** names (mechanism B, tied to `app.config.prefix`).
- Keep `hx-field`, `hx-rules`, `hx-form` *(as a scan marker, not a directive)* for mechanism A, always fixed `hx-`.
- Note the name collision: `hx-form` is used as **both** a mechanism-A scan marker and could be
  confused with the mechanism-B `${app.config.prefix}form` directive if the app prefix happened
  to literally be `hx-`. Document clearly that mechanism A's `hx-form` is not the same attribute
  as mechanism B's directive, even in the (rare) case they'd render identically.

---

## 3. Native HTML attribute validation — already working correctly, confirmed

This part of the ask is **done and verified working** in the current upload — no action needed:

```html
<input name="email" type="email" required minlength="5" maxlength="50">
<input name="age" type="number" min="18" max="99">
<input name="code" pattern="^[A-Z]{3}$">
```

`parseDataHx`'s `boolMap`/`paramMap` read these directly off the element's native attributes
(`required`, `minlength`, `maxlength`, `min`, `max`, `pattern`) with no `hx-`/`data-` prefix
needed, plus `type="email"`/`type="url"`/`type="number"` auto-add the matching rule. Verified
these are boolean/presence-correct (native `required` has no meaningful value, and the code
treats it as presence-only, not value-based) — this is correct.

Minor note: there's also a defensive `require`/`hx-require` alias (misspelling of `required`)
in `boolMap`. This isn't a real HTML attribute — it was added to paper over a typo seen in one
example (`require=""`). Harmless, but flag as a deliberate typo-tolerance shim, not a standard
attribute, so it doesn't get "corrected" away by someone who doesn't know why it's there.

---

## 4. Work order

1. **Fix §1 first** — collapse all 8 prefix-derivation call sites to a single fixed `"hx"`
   constant. This unblocks every declarative usage example that's been tried so far.
2. Rename/document per §2 so mechanism A vs B don't get conflated again in future bug reports.
3. Re-test the exact HTML from this round:
   ```html
   <form hx-form="newsletter">
     <input hx-field="email" hx-rules="required|email" name="email" type="email" required>
   </form>
   ```
   confirm `scanForms` finds the form, `parseDataHx` picks up both `hx-rules="required|email"`
   **and** the native `required`/`type="email"` attributes without duplicating the `required`
   rule (dedup by `fn._ruleName` already exists in `parseDataHx` — confirm it also dedups across
   "native-derived" and "hx-rules-derived" rules of the same name, not just within one source).
4. Re-test the earlier `<select mv-validate="required">` case (mechanism B) separately, using
   the app's real `mv-` prefix, to confirm both mechanisms work side by side without interfering.