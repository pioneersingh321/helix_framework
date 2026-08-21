# Helix Validation Plugin

A modern, highly reactive form validation plugin for Helix.js. Once registered, it makes its APIs globally available in the browser, eliminating the need for manual imports. It supports zero-JS declarative validation directly on DOM elements via HTML attributes (`hx-*` or custom configured prefixes like `mv-*`), along with a rich, composable programmatic API for form, field, and list state tracking.

---

## Features

- **Zero-JS Declarative Validation:** Clean HTML attributes (`hx-required`, `hx-email`, etc.) with automatic binding.
- **Global API Access:** APIs like `field()`, `form()`, and `list()` are exposed globally on plugin installation—no imports required.
- **Reactive State Tracking:** Automatic tracking of `dirty`, `touched`, `pending`, `valid`, `invalid`, and `errors` states at both field and form levels.
- **Angular Reactive Forms Parity:** Full support for `disable()`, `enable()`, `markDirty()`, `markPristine()`, `untouch()`, and reactive `'status'` emitters.
- **List Controller (FormArray) Parity:** Robust collection tracking supporting `removeAt()`, `setControl()`, `setValue()`, and `patchValue()`.
- **Scoped Registries:** Override global rules locally within specific field, form, or list controllers via `controller.rules.add()`.
- **Validation Interceptor Hooks:** Hook callbacks like `beforeRule` and `afterRule` to run code or override results.
- **Advanced DOM Observer:** Auto-detects and binds new forms/inputs added dynamically to the DOM.
- **Remote Async Validation:** Built-in support for remote validation with debouncing and caching.
- **Rich Composable Rules:** Combines rules logically using `or`, `and`, `not`, `each`, `transform`, `compose`, and `composeAsync` helpers.
- **i18n Localization:** Injected custom error messages with placeholder parameters support.
- **Decoupled Schema Adapters:** Light core architecture with Zod, Yup, and AJV adapter extensions moved to a separate lightweight plugin.

---

## Installation & Setup

Install the core plugin globally using `Helix.use(...)`:

```javascript
Helix.use(HelixValidationPlugin, {
    trigger: 'blur',         // Default trigger: 'blur' | 'input' | 'change' | 'always' | 'eager' | 'manual'
    mode: 'aggressive',      // Default validation mode: aggressive | lazy | eager/hybrid | passive/submitOnly | silent | firstError | allErrors
    beforeRule(name, val, ctx) { /* Run hook before rule */ },
    afterRule(name, val, res, ctx) { /* Run hook after rule */ },
    debounce: 300,          // Debounce delay (ms) for remote validation checks
    priorityEnabled: true,  // Stops validation on the first failing rule
    validateOnMount: false, // Validate all fields when the component mounts
    showAllErrors: false,   // Show only the first error message per field
    classes: {
        valid: 'hx-valid',
        invalid: 'hx-invalid',
        pending: 'hx-validating'
    },
    messages: {
        required: 'This field is required.',
        email: 'Enter a valid email address.'
    }
});
```

---

## 1. Directive Bindings vs Progressive Scanning

Helix Validation supports two distinct mechanisms of validation in templates, both of which respect Helix JS core's configured prefix (with trailing dashes normalized, e.g., `"mv-"` resolves to `"mv"`):

### Mechanism A: Progressive DOM Scan (App Configured Prefix, e.g. `mv-`)
Runs independently of Helix's template compiler. It auto-scans the DOM (and dynamically added nodes) for declarative attributes matching the app-configured prefix.
```html
<!-- If Helix prefix is configured as "mv-" (or fallback "hx-") -->
<form mv-form="newsletter">
  <input name="email" type="email" mv-field="email" mv-rules="required|email" required>
</form>
```

### Mechanism B: Helix Compiler Directives (App Configured Prefix, e.g. `mv-`)
Integrates directly into Helix's compiler and binds elements to programmatic form/field/list controllers in the component scope.
```html
<select name="type" mv-validate="myForm.fields.type">
```

---

## 2. Zero-JS Declarative HTML Attributes

For zero-JS declarative validation (Mechanism A), simply add `[prefix]-field` (e.g. `mv-field` or `hx-field`) to your input elements. The plugin reads validation rules and configurations from attributes (supporting standard HTML5 validation attributes and input types too).

### Built-in Rule Attributes

| Attribute | Description | Example |
| :--- | :--- | :--- |
| `hx-required` / `required` / `require` | Demands a non-empty value | `required` |
| `hx-email` / `type="email"` | Validates standard email structure | `type="email"` |
| `hx-url` / `type="url"` | Validates absolute/relative URLs | `type="url"` |
| `hx-numeric` / `type="number"` | Value must be a valid number | `type="number"` |
| `hx-integer` | Value must be a whole integer | `hx-integer` |
| `hx-minlength="n"` / `minlength="n"` | Demands at least `n` characters | `minlength="6"` |
| `hx-maxlength="n"` / `maxlength="n"` | Demands at most `n` characters | `maxlength="20"` |
| `hx-min="n"` / `min="n"` | Numeric value must be `>= n` | `min="18"` |
| `hx-max="n"` / `max="n"` | Numeric value must be `<= n` | `max="100"` |
| `hx-between="min,max"` | Numeric value must be inside range | `hx-between="1,10"` |
| `hx-pattern="regex"` / `pattern="regex"` | Matches value against regex | `pattern="^[A-Z]+$"` |
| `hx-one-of="a,b,c"` | Value must match one of the choices | `hx-one-of="user,admin"` |
| `hx-same-as="#id"` | Matches value of another element | `hx-same-as="#password"` |
| `hx-rule="rulesStr"` | Inline list of pipe-separated rules | `hx-rule="required|email|minLength:4"` |

---

## 3. Programmatic API

Create fully reactive fields, forms, and lists programmatically. After registering the plugin, these APIs are available globally.

### `field(initialValue, rules, options)`

Creates a reactive validation field. Exposes full validation status and state utilities:

```javascript
const username = field('john_doe', 'required|minLength:4', {
    name: 'username',
    trigger: 'input',
    autoDirty: true
});

// Reactivity
username.value.value = 'abc'; // triggers validation
console.log(username.valid.value);   // false
console.log(username.errors.value);  // ['Must be at least 4 characters.']

// Parity Utilities
username.disable(); // Excluded from values extraction, locks DOM input
username.enable();
username.markDirty();
username.markPristine();
username.untouch();

// Subscribe to status changes (VALID, INVALID, PENDING, DISABLED)
username.on('status', ({ status }) => {
    console.log('Status changed to:', status);
});
```

### `form(fieldDefs, options)`

Aggregates multiple fields, forms, or lists into a single validating object. Exposes cascading state controls:

```javascript
const registrationForm = form({
    email: field('', 'required|email'),
    password: field('', 'required|minLength:8'),
    confirmPassword: field('', 'required|sameAs:password')
}, {
    onSubmit(values, formInstance) {
        // Send values to API
    },
    onInvalid(values, formInstance) {
        console.warn('Form validation failed!', formInstance.errors.value);
    }
});

// Cascading Parity Utilities
registrationForm.disable(); // Recursively disables all fields
registrationForm.enable();
registrationForm.markDirty();
registrationForm.markPristine();

registrationForm.on('status', ({ status }) => {
    console.log('Form status changed to:', status);
});

// Error aggregation helpers
console.log(registrationForm.getErrors());      // { email: ['Required.'], password: [...] }
console.log(registrationForm.getFirstErrors()); // { email: 'Required.', password: '...' }
console.log(registrationForm.errorCount());     // 2
console.log(registrationForm.hasErrors());      // true
```

### `list(initialItems, validators, localContext)`

Aggregates collections of fields or forms (similar to Angular's `FormArray`):

```javascript
const userList = list([
    field('Alice', 'required'),
    field('Bob', 'required')
]);

// Collection Mutators & Parity Controls
userList.push(field('Charlie', 'required'));
userList.insert(0, field('Zoe', 'required'));
userList.removeAt(1); // Removes element at index 1
userList.setControl(0, field('Override', 'required'));

// Value Updates
userList.setValue(['NewAlice', 'NewBob']); // Replaces control values
userList.patchValue(['PatchedAlice']);      // Patches matching elements

// State Controls
userList.disable(); // Disables all list items recursively
userList.enable();
userList.markDirty();
userList.markPristine();
userList.untouch();
```

---

## 4. Custom Scoped Registries

Define custom validation rules globally or override them within specific fields, forms, or lists locally:

```javascript
// Global Registration
rules.add('accepted', (value) => {
    return (value === true || value === 'true' || value === 'on' || value === 1)
        ? null
        : 'You must accept the terms of service.';
});

// Scoped Local Overrides
const customForm = form({
    username: field('', 'required|usernameValid')
});

customForm.rules.add('usernameValid', (v) => {
    return /^[a-zA-Z0-9_]+$/.test(v) ? null : 'Username contains invalid characters.';
});
```

---

## 5. Rule Composition & Helpers

Helpers to format, logically bind, or compose rule functions are available globally:

- **`compose(...rules)`** / **`and(...rules)`**: Logical intersection of validators.
- **`composeAsync(...rules)`**: Evaluates async rules in parallel and resolves to the first error.
- **`withMessage(msg, rule)`**: Custom message overrides.
- **`withAsync(asyncFn, options)`**: Wrap async validation functions with optional cache and TTL.
- **`or(...rules)`**: Logical union of validators.
- **`not(rule)`**: Logical negation of a validator.
- **`each(rule)`**: Validates elements inside array values.
- **`transform(fn)`**: Pipelines a value transformation before running subsequent rules.

---

## 6. Decoupled Schema Adapters

Third-party schema adapters (for Zod, Yup, and AJV) are decoupled into the companion package `helix-validation-schema` to optimize core bundle weight.

### Registration:

```javascript
import HelixValidationSchemaPlugin from 'helix-validation-schema';

// Register the schema plugin alongside Core Validation
Helix.use(HelixValidationSchemaPlugin);
```

### Usage:

```javascript
import { zodAdapter } from 'helix-validation-schema';
import { z } from 'zod';

const mySchema = z.object({
    email: z.string().email(),
    age: z.number().min(18)
});

const myForm = form({
    email: field(''),
    age: field('')
}, {
    schema: zodAdapter(mySchema)
});
```

---

## 7. Verification & Programmatic Checks

### `check(value, rules, options)`

Evaluate rules against a static value programmatically without creating reactive fields:

```javascript
check('hello', 'required|minLength:10').then(errors => {
    console.log(errors); // ['Must be at least 10 characters.']
});
```

### `getForm(selectorOrEl)`

Lookup the programmatic form instance associated with a DOM element:

```javascript
const formInstance = getForm('#registration-form');
formInstance.submit();
```

---

## 8. Parsley.js HTML-First Quickstart & Migration

Helix Validation provides full drop-in support for Parsley.js style HTML-first validation. Write plain HTML with zero JavaScript, or migrate existing Parsley forms effortlessly.

### Complete HTML-First Registration Form

```html
<form hx-form id="signup-form">
  <!-- HTML5 auto-inferred rules + custom message attribute -->
  <div class="form-group">
    <label>Email</label>
    <input 
      name="email" 
      type="email" 
      required 
      hx-msg-required="Email address is required!"
      hx-msg-email="Please provide a valid email format."
    />
  </div>

  <!-- Min length constraint + custom error placement -->
  <div class="form-group">
    <label>Password</label>
    <div id="pw-wrapper">
      <input 
        id="password" 
        name="password" 
        type="password" 
        minlength="8" 
        required 
        hx-error-container="#pw-errors"
        hx-class-target="#pw-wrapper"
        hx-msg-minlength="Password must contain at least 8 characters"
      />
    </div>
    <div id="pw-errors"></div>
  </div>

  <!-- Equal-To match rule (password confirmation) -->
  <div class="form-group">
    <label>Confirm Password</label>
    <input 
      name="confirm_password" 
      type="password" 
      required 
      hx-equalto="#password" 
      hx-msg-equalto="Passwords do not match!"
    />
  </div>

  <!-- Multi-step form groups -->
  <fieldset hx-group="step-1">
    <legend>Step 1 Information</legend>
    <input name="first_name" required />
  </fieldset>

  <button type="submit">Register</button>
</form>
```

### Multi-Step Wizard Validation

Validate specific groups/steps independently:

```javascript
const myForm = getForm('#signup-form');

// Validate only step-1 fields
const step1Passed = await myForm.validateGroup('step-1');
if (step1Passed) {
    showStep2();
}
```

### Drop-In Parsley Attribute Mapping

| Parsley.js Attribute | Helix Equivalent | Description |
| :--- | :--- | :--- |
| `data-parsley-validate` | `hx-form` / `data-parsley-validate` | Automatically scans and binds form |
| `data-parsley-required` | `required` / `hx-required` | Required field constraint |
| `data-parsley-type="email"` | `type="email"` / `hx-email` | Email validation |
| `data-parsley-minlength="n"` | `minlength="n"` / `hx-minlength="n"` | Minimum character length |
| `data-parsley-equalto="#target"` | `hx-equalto="#target"` | Matches value of target element |
| `data-parsley-errors-container="#el"` | `hx-error-container="#el"` | Custom element for error text |
| `data-parsley-class-handler="#el"` | `hx-class-target="#el"` | Custom element for valid/invalid classes |
| `data-parsley-<rule>-message="..."` | `hx-msg-<rule>="..."` | Custom message for specific rule |
| `data-parsley-group="step-1"` | `hx-group="step-1"` | Groups fields for step-by-step validation |
| `data-parsley-trigger="blur"` | `hx-trigger="eager"` | Eager re-validation after initial blur |
