/**
 * Helix.js Validate Plugin v2.1.5
 * Aligned with Helix.js v11.1.x Plugin Architecture (requires >= 11.1.5)
 *
 * Public API  (no Angular naming)
 * ─────────────────────────────────────────────────────────────────────────────
 *  $validation.field(value, rules, opts)   → Field
 *  $validation.form(fields, opts)          → Form
 *  $validation.list(items, validators)     → FieldList
 *  $validation.rules.add/remove/get/list
 *  $validation.helpers.*
 *  $validation.check(value, rules)         → Promise<string[]>
 *  $validation.getForm('#id')              → Form
 *
 * Field state
 * ─────────────────────────────────────────────────────────────────────────────
 *  .value .errors .valid .invalid .dirty .touched .pending .disabled .status
 *  .$errors (gated by dirty||touched)   .$valid (silent — for submit gating)
 *  .set(val)   .reset(val?)   .validate() → Promise<boolean>
 *  .touch()    .untouch()     .enable()   .disable()
 *  .setErrors(msgs)  .clearErrors()
 *  .setRules(r)  .addRule(r)  .removeRule(name)
 *  .on(event, cb)             → unsubscribe fn
 *
 * Form state  (extends Field state)
 * ─────────────────────────────────────────────────────────────────────────────
 *  .fields            — { name: Field, ... }
 *  .field(path)       — get field by dot-path / bracket-path
 *  .values()          — { name: value, ... }  (excludes disabled)
 *  .rawValues()       — includes disabled
 *  .set(name, val)    — set one field value
 *  .patch(obj)        — partial update
 *  .reset(obj?)       — reset all
 *  .validate(opts?)   — all fields + cross-field validators
 *  .touchAll()        — mark all fields touched
 *  .submit()          — touchAll → validate → onSubmit/onInvalid
 *  .add(name, field)  .remove(name)  .has(name)
 *  .setErrors(map)    — { name: ['msg'] } — server errors
 *  .setError(msg)     .clearError()        — form-level error
 *  .submitting .submitted .error .hasError
 *  .serverErrors      — reactive ref; sets + auto-clears on edit
 *
 * FieldList state
 * ─────────────────────────────────────────────────────────────────────────────
 *  .items             — reactive ref[]
 *  .length            — computed
 *  .at(i)   .push(f)  .insert(i, f)  .remove(i)  .clear()
 *  .values()  .rawValues()  .validate()  .touchAll()
 *
 * Built-in rules
 * ─────────────────────────────────────────────────────────────────────────────
 *  required  email  url  numeric  integer
 *  minLength(n)  maxLength(n)  min(n)  max(n)  between(n,n)
 *  pattern(rx)  sameAs(ref, label)  oneOf(values[])
 *
 * Helpers
 * ─────────────────────────────────────────────────────────────────────────────
 *  withMessage(msg, rule)
 *  withAsync(fn, deps[])
 *  requiredIf(condition)   requiredUnless(condition)
 *  or(...rules)  and(...rules)  not(rule, msg)
 *  each(...rules)          — validate array items
 *  i18n({ t, path? })     — i18n message factory
 *
 * Directives
 * ─────────────────────────────────────────────────────────────────────────────
 *  hx-validate   — binds a Field
 *  hx-form       — binds a Form
 *  hx-list       — binds a FieldList  (was hx-form-array)
 *
 * Zero-JS  (data-hx-* attributes)
 * ─────────────────────────────────────────────────────────────────────────────
 *  data-hx-required  data-hx-email  data-hx-url  data-hx-numeric  data-hx-integer
 *  data-hx-minlength="3"  data-hx-maxlength="100"
 *  data-hx-min="0"  data-hx-max="100"  data-hx-between="0,100"
 *  data-hx-pattern="^[A-Z]+"  data-hx-same-as="#otherField"
 *  data-hx-one-of="a,b,c"
 *  data-hx-required-if="fieldName"  data-hx-required-unless="fieldName"
 *  data-hx-{rule}-message="Custom message"
 *  data-hx-trigger="input|blur|change|eager"
 *  data-hx-debounce="400"
 *  data-hx-remote="/api/check"  data-hx-remote-message="Taken."
 *  data-hx-pending-text="Checking…"
 *  data-hx-group="step1"
 *  data-hx-class-handler="parent|.my-wrapper"
 *  data-hx-error-target="#my-errors"
 *  data-hx-excluded   data-hx-lazy   data-hx-auto-dirty
 *  data-hx-form       (on <form> element — zero-JS auto-bind)
 *
 * Install
 * ─────────────────────────────────────────────────────────────────────────────
 *  Helix.use(HelixValidatePlugin, options)  → Helix.$validation
 *  app.use(HelixValidatePlugin, options)    → app.$validation
 *  inject('$validate')                      → inside setup()
 *
 * Access
 * ─────────────────────────────────────────────────────────────────────────────
 *  Helix.$validation.getForm('#contact')
 *  Helix.namespace('validate').form({ ... })
 *  const $v = inject('$validate')
 */

const HelixValidatePlugin = {
    name:    'validate',
    version: '2.1.5',
    requires: { helix: '>=11.1.5' },

    install(app, options = {}) {

        // =====================================================================
        // 0. INSTALL GUARD
        // =====================================================================
        const INSTALL_MARK = Symbol.for('helix.validate.installed');
        if (app[INSTALL_MARK]) {
            console.warn('[Helix Validate] already installed; skipping.');
            return () => {};
        }

        // =====================================================================
        // 1. CONFIG
        // =====================================================================
        // FIX (BUG-012): use nullish coalescing consistently so explicit falsy
        // values (e.g. trigger:'' for manual-only validation, minChars:0) are
        // preserved instead of being silently replaced by defaults.
        const config = {
            trigger:            options.trigger             ?? 'blur',
            debounce:           options.debounce            ?? 300,
            priorityEnabled:    options.priorityEnabled     ?? true,
            validateOnMount:    options.validateOnMount     ?? false,
            showAllErrors:      options.showAllErrors       ?? false,
            minChars:           options.minChars            ?? 0,
            classes: Object.assign(
                { valid: 'hx-valid', invalid: 'hx-invalid', pending: 'hx-validating' },
                options.classes || {}
            ),
            messages:  Object.assign({}, options.messages || {}),
            remote: Object.assign(
                { method: 'GET', param: 'value', headers: {} },
                options.remote || {}
            ),
        };

        // =====================================================================
        // 2. INTERNALS
        // =====================================================================
        let _seq = 0;
        const uid = () => `hxv${++_seq}`;

        const dirCleanups    = new WeakMap();
        const dirUpdaters    = new WeakMap();
        const allCleanups    = new Set();
        const allEffects     = new Set();
        const formContextMap = new WeakMap(); // form el → Form
        const autoForms      = new Map();
        const autoFormCleanups = new Map();   // form el → cleanup fn (FIX C2)
        const boundFieldEls  = new Set();     // hx-validate els (FIX N1/M11)
        const remoteAborts   = new WeakMap(); // input el → AbortController

        // =====================================================================
        // 3. ERROR MESSAGES
        // =====================================================================
        const MSGS = {
            required:  ()       => 'This field is required.',
            email:     ()       => 'Enter a valid email address.',
            url:       ()       => 'Enter a valid URL.',
            numeric:   ()       => 'Must be a number.',
            integer:   ()       => 'Must be a whole number.',
            minLength: ({ p })  => `Must be at least ${p.min} characters.`,
            maxLength: ({ p })  => `Must be at most ${p.max} characters.`,
            min:       ({ p })  => `Must be at least ${p.min}.`,
            max:       ({ p })  => `Must be at most ${p.max}.`,
            between:   ({ p })  => `Must be between ${p.min} and ${p.max}.`,
            pattern:   ()       => 'Invalid format.',
            sameAs:    ({ p })  => `Must match ${p.label || 'the other field'}.`,
            oneOf:     ({ p })  => `Must be one of: ${(p.values || []).join(', ')}.`,
        };

        function resolveMsg(name, params, value) {
            const custom = config.messages[name];
            if (custom) {
                return typeof custom === 'function'
                    ? custom({ value, params, rule: name })
                    : custom;
            }
            const def = MSGS[name];
            if (def) return typeof def === 'function' ? def({ value, p: params, rule: name }) : def;
            return 'Invalid value.';
        }

        // =====================================================================
        // 4. RULE REGISTRY
        // =====================================================================
        const _registry = new Map();

        const rules = {
            add(name, fn, meta) {
                if (typeof name !== 'string') return;
                _registry.set(name, { fn, priority: (meta && meta.priority) || fn._priority || 1, name });
            },
            remove: (name)  => _registry.delete(name),
            get:    (name)  => { const m = _registry.get(name); return m ? m.fn : null; },
            has:    (name)  => _registry.has(name),
            list:   ()      => Array.from(_registry.keys()),
            _meta:  (name)  => _registry.get(name) || null,
        };

        // =====================================================================
        // 5. BUILT-IN RULES
        // =====================================================================
        function isEmpty(v) {
            if (v === null || v === undefined) return true;
            if (typeof v === 'string')         return v.trim() === '';
            if (Array.isArray(v))              return v.length === 0;
            return false;
        }

        function mkRule(fn, name, priority, params) {
            fn._ruleName = name;
            fn._priority = priority;
            if (params) fn._params = params;
            return fn;
        }

        // Primitives
        const required = mkRule(
            (v) => isEmpty(v) ? resolveMsg('required', {}, v) : null,
            'required', 32
        );

        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const email = mkRule(
            (v) => !isEmpty(v) && !emailRx.test(String(v)) ? resolveMsg('email', {}, v) : null,
            'email', 16
        );

        const url = mkRule(
            (v) => {
                if (isEmpty(v)) return null;
                try { new URL(v); return null; } catch { return resolveMsg('url', {}, v); }
            },
            'url', 16
        );

        const numeric = mkRule(
            (v) => !isEmpty(v) && !isFinite(Number(v)) ? resolveMsg('numeric', {}, v) : null,
            'numeric', 16
        );

        const integer = mkRule(
            (v) => !isEmpty(v) && !Number.isInteger(Number(v)) ? resolveMsg('integer', {}, v) : null,
            'integer', 16
        );

        // Factories
        const minLength = (min) => mkRule(
            (v) => !isEmpty(v) && String(v).length < min ? resolveMsg('minLength', { min }, v) : null,
            'minLength', 8, { min }
        );

        const maxLength = (max) => mkRule(
            (v) => !isEmpty(v) && String(v).length > max ? resolveMsg('maxLength', { max }, v) : null,
            'maxLength', 8, { max }
        );

        const min = (mn) => mkRule(
            (v) => !isEmpty(v) && Number(v) < mn ? resolveMsg('min', { min: mn }, v) : null,
            'min', 8, { min: mn }
        );

        const max = (mx) => mkRule(
            (v) => !isEmpty(v) && Number(v) > mx ? resolveMsg('max', { max: mx }, v) : null,
            'max', 8, { max: mx }
        );

        const between = (mn, mx) => mkRule(
            (v) => {
                if (isEmpty(v)) return null;
                const n = Number(v);
                return (n < mn || n > mx) ? resolveMsg('between', { min: mn, max: mx }, v) : null;
            },
            'between', 8, { min: mn, max: mx }
        );

        // FIX #10: compile the RegExp once at factory time, not on every validate.
        const pattern = (regex, msg) => {
            const rx = typeof regex === 'string' ? new RegExp(regex) : regex;
            return mkRule(
                (v) => {
                    if (isEmpty(v)) return null;
                    return !rx.test(v) ? (msg || resolveMsg('pattern', { pattern: regex }, v)) : null;
                },
                'pattern', 16, { pattern: regex }
            );
        };

        // FIX #9: safer ref detection — check for the 'value' property's
        // presence rather than reading it and comparing to undefined (which
        // can mis-classify computed refs whose .value happens to be undefined).
        const sameAs = (otherRef, label) => mkRule(
            (v) => {
                let other;
                if (typeof otherRef === 'function') {
                    other = otherRef();
                } else if (otherRef && typeof otherRef === 'object' && 'value' in otherRef) {
                    other = otherRef.value;
                } else {
                    other = otherRef;
                }
                return v !== other ? resolveMsg('sameAs', { label }, v) : null;
            },
            'sameAs', 4, { label }
        );

        const oneOf = (values) => mkRule(
            (v) => !isEmpty(v) && !values.includes(v) ? resolveMsg('oneOf', { values }, v) : null,
            'oneOf', 4, { values }
        );

        // Register built-ins
        [
            ['required', required,  32], ['email',     email,     16],
            ['url',      url,       16], ['numeric',   numeric,   16],
            ['integer',  integer,   16], ['minLength', minLength,  8],
            ['maxLength',maxLength,  8], ['min',       min,        8],
            ['max',      max,        8], ['between',   between,    8],
            ['pattern',  pattern,   16], ['sameAs',    sameAs,     4],
            ['oneOf',    oneOf,      4],
        ].forEach(([n, fn, p]) => _registry.set(n, { fn, priority: p, name: n }));

        // =====================================================================
        // 6. RULE STRING PARSER  "required|email|minLength:3"
        // =====================================================================
        function parseRuleStr(str) {
            return str.split('|').reduce((acc, seg) => {
                seg = seg.trim();
                if (!seg) return acc;
                const colonIdx = seg.indexOf(':');
                const name = colonIdx > -1 ? seg.slice(0, colonIdx) : seg;
                const rawArgs = colonIdx > -1 ? seg.slice(colonIdx + 1).split(',') : [];
                // FIX (BUG-011): only coerce plain decimal integers/floats to
                // Number. Bare Number() also accepts hex ("0x10" → 16) and
                // scientific ("1e3" → 1000), which silently distorts rule
                // boundaries typed into attributes.
                const args = rawArgs.map(a => {
                    const trimmed = a.trim();
                    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
                });

                const meta = _registry.get(name);
                if (!meta) { console.warn(`[Helix Validate] Unknown rule: "${name}"`); return acc; }

                // FIX (BUG-008): only invoke factory rules with the parsed args.
                // Direct validators (required, email, …) carry a _ruleName on
                // the function itself; calling them with args would run the
                // validation immediately and yield a non-function, crashing the
                // pipeline later. Such args are ignored with a warning.
                let fn;
                if (args.length && !meta.fn._ruleName) {
                    const produced = meta.fn(...args);
                    if (typeof produced === 'function') {
                        fn = produced;
                    } else {
                        console.warn(`[Helix Validate] Rule "${name}" did not return a validator; ignoring args.`);
                        fn = meta.fn;
                    }
                } else if (args.length) {
                    console.warn(`[Helix Validate] Rule "${name}" takes no arguments; ignoring them.`);
                    fn = meta.fn;
                } else {
                    fn = meta.fn;
                }
                if (!fn._priority) fn._priority = meta.priority;
                return acc.concat(fn);
            }, []);
        }

        function normalizeRules(r) {
            if (!r) return [];
            if (typeof r === 'string')   return parseRuleStr(r);
            if (typeof r === 'function') return [r];
            if (Array.isArray(r)) {
                return r.reduce((acc, item) => {
                    if (typeof item === 'string')   return acc.concat(parseRuleStr(item));
                    if (typeof item === 'function') return acc.concat(item);
                    return acc;
                }, []);
            }
            return [];
        }

        // =====================================================================
        // 7. HELPERS
        // =====================================================================
        function withMessage(message, ruleFn) {
            // FEAT A: forward ctx to wrapped rule
            const fn = (value, ctx) => {
                const result = ruleFn(value, ctx);
                const transform = (r) => {
                    if (r === null) return null;
                    return typeof message === 'function'
                        ? message({ value, params: ruleFn._params || {}, rule: ruleFn._ruleName })
                        : message;
                };
                return result && typeof result.then === 'function' ? result.then(transform) : transform(result);
            };
            fn._ruleName = ruleFn._ruleName;
            fn._priority = ruleFn._priority || 1;
            fn._params   = ruleFn._params;
            return fn;
        }

        // FIX #2 / FEAT A: withAsync rules now receive the full ctx (which
        // contains the AbortSignal). For backward compat, the signal is also
        // passed as the legacy 2nd positional arg.
        function withAsync(asyncFn, deps) {
            const fn = (value, ctx) => {
                const signal = ctx && ctx.signal ? ctx.signal : undefined;
                // Three-arg form keeps backward compat with (v, signal) callers
                // while also exposing the full ctx on the 3rd positional.
                return asyncFn(value, signal, ctx);
            };
            fn._priority = asyncFn._priority || 0;
            fn._deps     = deps || [];
            fn._isAsync  = true;
            return fn;
        }

        function requiredIf(condition) {
            const fn = (v) => {
                const on = typeof condition === 'function' ? condition()
                    : (condition && condition.value !== undefined ? condition.value : !!condition);
                return on && isEmpty(v) ? resolveMsg('required', {}, v) : null;
            };
            fn._ruleName = 'requiredIf';
            fn._priority = 32;
            return fn;
        }

        function requiredUnless(condition) {
            const fn = (v) => {
                const off = typeof condition === 'function' ? !condition()
                    : (condition && condition.value !== undefined ? !condition.value : !condition);
                return off && isEmpty(v) ? resolveMsg('required', {}, v) : null;
            };
            fn._ruleName = 'requiredUnless';
            fn._priority = 32;
            return fn;
        }

        // FEAT A: all combinators forward ctx through to inner rules so async
        // rules nested inside or/and/not/each still get the AbortSignal.
        function or(...ruleFns) {
            const fn = (v, ctx) => Promise.all(ruleFns.map(r => Promise.resolve(r(v, ctx)))).then(results => {
                return results.some(r => r === null) ? null : (results.find(r => r !== null) || 'Invalid value.');
            });
            fn._priority = Math.min(...ruleFns.map(r => r._priority || 1));
            return fn;
        }

        function and(...ruleFns) {
            const fn = (v, ctx) => ruleFns.reduce(
                (chain, r) => chain.then(acc => acc !== null ? acc : Promise.resolve(r(v, ctx))),
                Promise.resolve(null)
            );
            fn._priority = Math.min(...ruleFns.map(r => r._priority || 1));
            return fn;
        }

        function not(ruleFn, message = 'Invalid value.') {
            const fn = (v, ctx) => Promise.resolve(ruleFn(v, ctx)).then(r => r === null ? message : null);
            fn._priority = ruleFn._priority || 1;
            return fn;
        }

        // each — validate every item in an array field (ctx forwarded)
        function each(...ruleFns) {
            const fn = (value, ctx) => {
                if (!Array.isArray(value)) return null;
                return Promise.all(
                    value.map((item) =>
                        ruleFns.reduce(
                            (chain, r) => chain.then(found => found || Promise.resolve(r(item, ctx)).then(res => res || null)),
                            Promise.resolve(null)
                        )
                    )
                ).then(results => {
                    const errs = {};
                    results.forEach((r, i) => { if (r !== null) errs[i] = r; });
                    return Object.keys(errs).length ? errs : null;
                });
            };
            fn._priority  = 1;
            fn._isEach    = true;
            return fn;
        }

        // i18n message factory
        function i18n({ t, path }) {
            const resolvePath = path || (({ rule }) => `validation.${rule}`);
            return (ruleFn) => withMessage(
                ({ value: v, params, rule }) =>
                    t(resolvePath({ rule: ruleFn._ruleName || rule, value: v, params }), params || {}),
                ruleFn
            );
        }

        const helpers = { withMessage, withAsync, requiredIf, requiredUnless, or, and, not, each, i18n };

        // =====================================================================
        // 8. RULE RUNNER  (priority tiers, run-ID stale guard, abort signal)
        // =====================================================================
        // FIX #2 / FEAT A: per-run AbortController is plumbed through to every
        // rule via ctx.signal. When a new run starts on the same field, the
        // previous controller is aborted, so in-flight async rules can cancel
        // their network/work. Rules can read ctx for field/form/signal access.
        function runRules(ctrl, ruleFns, value) {
            if (!ruleFns || !ruleFns.length) return Promise.resolve({ errors: [], tagged: [] });

            // Abort previous run's controller, if any (cancels in-flight async).
            if (ctrl._runAbort) {
                try { ctrl._runAbort.abort(); } catch (_) {}
            }
            const controller = new AbortController();
            ctrl._runAbort = controller;

            const runId = uid();
            ctrl._runId = runId;

            // ctx — passed as 2nd arg to every rule
            // Old (value) => ... rules just ignore it; new rules can read it.
            const ctx = {
                field:  ctrl._type === 'field' ? ctrl : null,
                form:   ctrl._parent && ctrl._parent._type === 'form' ? ctrl._parent : null,
                signal: controller.signal,
            };

            // Group by descending priority
            const byP = {};
            ruleFns.forEach(r => {
                const p = r._priority != null ? r._priority : 1;
                (byP[p] = byP[p] || []).push(r);
            });
            const tiers = Object.keys(byP).map(Number).sort((a, b) => b - a);

            const tagged = [];
            const errors = [];

            return tiers.reduce((chain, tier) => {
                return chain.then(stop => {
                    if (stop) return true;

                    return Promise.all(byP[tier].map(rule =>
                        Promise.resolve(rule(value, ctx)).then(res => {  // FEAT A: pass ctx
                            if (ctrl._runId !== runId) return null; // stale
                            return { rule, res };
                        }).catch(err => {
                            if (err && err.name === 'AbortError') return null;
                            return { rule, res: 'Validation error.' };
                        })
                    )).then(tierResults => {
                        if (ctrl._runId !== runId) return true; // stale — abort

                        const tierErrs = [];
                        tierResults.forEach(entry => {
                            if (!entry || entry.res === null) return;
                            if (entry.rule._isEach && typeof entry.res === 'object') {
                                Object.entries(entry.res).forEach(([i, msg]) => {
                                    tierErrs.push({ message: msg, source: 'rule', rule: entry.rule._ruleName || null, index: Number(i) });
                                });
                            } else if (typeof entry.res === 'string') {
                                tierErrs.push({ message: entry.res, source: 'rule', rule: entry.rule._ruleName || null });
                            }
                        });

                        if (tierErrs.length) {
                            tierErrs.forEach(e => { tagged.push(e); errors.push(e.message); });
                            return config.priorityEnabled; // stop lower tiers if priority mode
                        }
                        return false;
                    });
                });
            }, Promise.resolve(false)).then(() => {
                // FIX (BUG-003): if this run was superseded, report it as stale
                // (null) so callers don't write partial/empty results or reset
                // pending while a newer run is still in flight.
                const stale = ctrl._runId !== runId;
                // Clear the controller reference once this run completes.
                if (ctrl._runAbort === controller) ctrl._runAbort = null;
                return stale ? null : { errors, tagged };
            });
        }

        // =====================================================================
        // 9. FIELD  (base reactive unit)
        // =====================================================================
        function field(initialValue, ruleDefs, opts) {
            opts = opts || {};

            const _id       = uid();
            const value     = app.ref(initialValue !== undefined ? initialValue : '');
            const dirty     = app.ref(false);
            const touched   = app.ref(false);
            const pending   = app.ref(false);
            const disabled  = app.ref(false);

            // FEAT B: errors are split into per-source channels. The public
            // `errors` and `_tagged` refs are computed merges of all four, so
            // each channel can be updated independently without one source
            // stomping another (e.g. a passing rule run won't clear remote
            // errors and vice versa).
            const _ruleErrors   = app.ref([]); // { message, source:'rule',   rule }
            const _remoteErrors = app.ref([]); // { message, source:'remote', rule:null }
            const _serverErrors = app.ref([]); // { message, source:'server', rule:null }
            const _crossErrors  = app.ref([]); // { message, source:'cross',  rule:null }

            const _tagged = app.computed(() => [
                ..._ruleErrors.value,
                ..._remoteErrors.value,
                ..._serverErrors.value,
                ..._crossErrors.value,
            ]);
            const errors  = app.computed(() => _tagged.value.map(t => t.message));

            const valid     = app.computed(() => errors.value.length === 0 && !pending.value);
            const invalid   = app.computed(() => !valid.value);
            const pristine  = app.computed(() => !dirty.value);
            const enabled   = app.computed(() => !disabled.value);
            const status    = app.computed(() => {
                if (disabled.value)          return 'DISABLED';
                if (pending.value)           return 'PENDING';
                if (errors.value.length > 0) return 'INVALID';
                return 'VALID';
            });

            // $errors — gated by interaction; $valid — always computed (submit-button gating)
            const $errors = app.computed(() => (dirty.value || touched.value) ? errors.value : []);
            const $valid  = app.computed(() => errors.value.length === 0);

            const _listeners = [];
            const _stoppers  = [];

            function _emit(event) { _listeners.forEach(cb => cb(event)); }

            // Track dirty automatically on value change
            const stopDirty = app.watch(value, () => {
                if (!dirty.value) { dirty.value = true; _emit({ type: 'dirty' }); }
                _emit({ type: 'change', value: value.value });
            }, { immediate: false });
            _stoppers.push(stopDirty);

            // FIX #1: opts.autoDirty was previously read into a closure that
            // the directive could never see. Now exposed on _f below.
            if (opts.autoDirty) {
                const stopAuto = app.watch(value, () => { dirty.value = true; }, { immediate: false });
                _stoppers.push(stopAuto);
            }

            // Public event subscription
            const on = (event, cb) => {
                const wrapped = (e) => { if (e.type === event) cb(e); };
                _listeners.push(wrapped);
                return () => { const i = _listeners.indexOf(wrapped); if (i > -1) _listeners.splice(i, 1); };
            };

            // Mutation
            const set = (val, opts2) => {
                value.value = val;
                _emit({ type: 'change', value: val });
                if (!(opts2 && opts2.silent) && _f._parent && _f._parent._childChanged) {
                    _f._parent._childChanged();
                }
            };

            const reset = (val) => {
                value.value          = val !== undefined ? val : initialValue;
                _ruleErrors.value    = [];
                _remoteErrors.value  = [];
                _serverErrors.value  = [];
                _crossErrors.value   = [];
                dirty.value          = false;
                touched.value        = false;
                pending.value        = false;
                // Dispose any pending server-error watcher
                if (_f._serverWatcherStop) { _f._serverWatcherStop(); _f._serverWatcherStop = null; }
                _emit({ type: 'reset' });
            };

            const touch   = (opts2) => {
                touched.value = true;
                _emit({ type: 'touch' });
                if (!(opts2 && opts2.self) && _f._parent && _f._parent.touch) _f._parent.touch({ self: true });
            };
            const untouch = () => { touched.value = false; };

            const enable  = () => { disabled.value = false; _emit({ type: 'status', status: 'VALID' }); };
            const disable = () => { disabled.value = true;  _emit({ type: 'status', status: 'DISABLED' }); };

            // setErrors / clearErrors operate on the server channel (the most
            // common caller is external code injecting server-side errors).
            const setErrors = (msgs) => {
                const arr = Array.isArray(msgs) ? msgs : (msgs ? [msgs] : []);
                _serverErrors.value = arr.map(m => ({ message: m, source: 'server', rule: null }));
                _emit({ type: 'error' });
            };
            const clearErrors = () => {
                _ruleErrors.value   = [];
                _remoteErrors.value = [];
                _serverErrors.value = [];
                _crossErrors.value  = [];
            };

            // Rule management
            let _ruleFns = normalizeRules(ruleDefs);
            const setRules   = (r) => { _ruleFns = normalizeRules(r); };
            const addRule    = (r) => { _ruleFns = _ruleFns.concat(normalizeRules(r)); };
            const removeRule = (r) => {
                if (typeof r === 'string') _ruleFns = _ruleFns.filter(fn => fn._ruleName !== r);
                else                       _ruleFns = _ruleFns.filter(fn => fn !== r);
            };
            const hasRule    = (r) => _ruleFns.some(fn => typeof r === 'string' ? fn._ruleName === r : fn === r);

            // Validate — runs rule channel; leaves remote/server/cross untouched.
            const validate = () => {
                if (disabled.value) return Promise.resolve(true);
                if (opts.lazy && !touched.value && !dirty.value) return Promise.resolve(true);

                pending.value = true;
                return runRules(_f, _ruleFns, value.value).then(result => {
                    // FIX (BUG-003): bail on a stale run BEFORE mutating state.
                    // A superseded run must not flip pending to false (UI flicker)
                    // nor overwrite _ruleErrors with its partial/empty tally —
                    // the newer run owns both.
                    if (result === null) return !invalid.value; // stale
                    pending.value = false;

                    // FEAT B: only update the rule channel. Other channels
                    // (remote, server, cross) keep their current contents.
                    _ruleErrors.value = result.tagged;
                    _emit({ type: 'validated', valid: errors.value.length === 0 });
                    return errors.value.length === 0;
                });
            };

            const _destroy = () => {
                if (_f._serverWatcherStop) { _f._serverWatcherStop(); _f._serverWatcherStop = null; }
                if (_f._runAbort)          { try { _f._runAbort.abort(); } catch (_) {} _f._runAbort = null; }
                _stoppers.forEach(s => s && s());
                _stoppers.length = 0;
                _listeners.length = 0;
            };

            const _f = {
                _id, _type: 'field', _parent: null,
                _runId: null,
                _runAbort: null,            // FIX #2: per-run controller
                _serverWatcherStop: null,   // FIX #6: per-field server watcher
                _emit,

                // Internal channels — read by form.serverErrors and renderField
                _ruleErrors, _remoteErrors, _serverErrors, _crossErrors,
                _tagged,

                // FIX #1: actually expose autoDirty so onInput() can see it
                _autoDirty: opts.autoDirty || false,
                _lazy:      opts.lazy      || false,
                _group:     opts.group     || null,

                // Rule list reflection
                get _rules() { return _ruleFns; },

                // Reactive state
                name:       opts.name || null,
                updateOn:   opts.updateOn || opts.trigger || config.trigger,

                value, errors, dirty, touched, pending, disabled,
                valid, invalid, pristine, enabled, status,
                $errors, $valid,

                // API
                on, set, reset,
                touch, untouch,
                enable, disable,
                setErrors, clearErrors,
                setRules, addRule, removeRule, hasRule,
                validate,
                _destroy,
            };

            return _f;
        }

        // =====================================================================
        // 10. FORM  (collection of fields)
        // =====================================================================
        function form(fieldDefs, opts) {
            opts = opts || {};

            // Create a lightweight base with form-level state
            const _id       = uid();
            const submitting = app.ref(false);
            const submitted  = app.ref(false);
            const error      = app.ref(null);
            const hasError   = app.computed(() => !!error.value);

            // FIX (BUG-001): _fields is a plain object, so adding/removing a key
            // (add(), remove(), autoCreatePath) is invisible to the reactivity
            // system — the aggregate computeds below would only ever track the
            // child refs they read on their last run, never the membership of
            // _fields itself. This version ref is bumped whenever the field set
            // changes, forcing the aggregates to recompute over the new members.
            const _fieldsVersion = app.ref(0);

            // Aggregate state derived from all child fields.
            // FIX (BUG-010): read the _fields registry directly instead of
            // _f.fields. Identical reference (the getter just returns _fields),
            // but removes the forward dependency on _f, which is declared far
            // below — these only worked due to lazy computed evaluation.
            const valid   = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).every(c => c.valid.value); });
            const invalid = app.computed(() => !valid.value);
            const dirty   = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.dirty.value); });
            const touched = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.touched.value); });
            const pending = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.pending.value); });
            const status  = app.computed(() => {
                if (pending.value) return 'PENDING';
                if (invalid.value) return 'INVALID';
                return 'VALID';
            });

            // $valid — all silent errors empty (for submit-button gating)
            const $valid = app.computed(() => {
                void _fieldsVersion.value;
                return Object.values(_fields).every(c => c.$valid.value);
            });

            // Cross-validators
            let _crossValidators = normalizeRules(opts.validators || []);

            // ── Field registry ───────────────────────────────────────────────
            const _fields = {};
            const _stoppers = [];

            function _registerField(name, ctrl) {
                // FIX (v2.1.1): warn on silent overwrite and tear down the
                // previous control first so its reactive watchers don't leak.
                if (_fields[name] && _fields[name] !== ctrl) {
                    console.warn(`[Helix Validate] form: field "${name}" already exists — overwriting.`);
                    const prev = _fields[name];
                    // FIX (BUG-006): stop the previous control's cross-error
                    // watcher so it doesn't keep watching a destroyed ref.
                    if (prev._crossWatcherStop) { prev._crossWatcherStop(); prev._crossWatcherStop = null; }
                    if (typeof prev._destroy === 'function') prev._destroy();
                    prev._parent = null;
                }
                ctrl.name    = name;
                ctrl._parent = _f;
                _fields[name] = ctrl;
                _fieldsVersion.value++; // FIX (BUG-001): membership changed

                // FIX #3 (defensive): also clear cross-errors for this field
                // when its value changes, in case the user is showing cross
                // errors live without re-running form.validate() immediately.
                // FIX (BUG-006): keep a single watcher per control — stop any
                // prior one before creating a new one, so repeated registration
                // (HMR, dynamic rebuilds) can't pile up duplicate watchers.
                if (ctrl._crossErrors && ctrl.value && app.watch) {
                    if (ctrl._crossWatcherStop) ctrl._crossWatcherStop();
                    const stop = app.watch(ctrl.value, () => {
                        if (ctrl._crossErrors.value.length) ctrl._crossErrors.value = [];
                    }, { immediate: false });
                    // FIX (BUG-013): track the watcher only on the control (not
                    // in the form's _stoppers array). Pushing here meant every
                    // re-registration left its now-stopped predecessor lingering
                    // in _stoppers forever. Teardown stops it via the control
                    // (see form._destroy / remove()).
                    ctrl._crossWatcherStop = stop;
                }
            }

            // Accept shorthand: 'email': [initialVal, rules, opts?]
            // or a pre-built Field
            Object.keys(fieldDefs || {}).forEach(name => {
                const def = fieldDefs[name];
                if (!def) return;
                let ctrl;
                if (def._type === 'field' || def._type === 'form' || def._type === 'list') {
                    ctrl = def;
                } else if (Array.isArray(def)) {
                    const [val, r, o] = def;
                    ctrl = field(val, r, Object.assign({ name }, o || {}));
                } else {
                    console.warn(`[Helix Validate] form: "${name}" — use [value, rules] or a Field.`);
                    return;
                }
                _registerField(name, ctrl);
            });

            // ── Path accessor (dot + bracket notation) ───────────────────────
            function getField(path) {
                if (path == null) return null;
                const parts = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
                let cur = _f;
                for (let i = 0; i < parts.length; i++) {
                    if (!cur) return null;
                    if (cur._type === 'form') cur = cur.fields[parts[i]];
                    else if (cur._type === 'list') cur = cur.items.value[Number(parts[i])];
                    else return null;
                }
                return cur || null;
            }

            // ── Value helpers ────────────────────────────────────────────────
            const values = () => {
                const out = {};
                Object.keys(_fields).forEach(k => {
                    const c = _fields[k];
                    if (c.disabled && c.disabled.value) return;
                    out[k] = c._type === 'form' ? c.values()
                           : c._type === 'list' ? c.values()
                           : c.value.value;
                });
                return out;
            };

            const rawValues = () => {
                const out = {};
                Object.keys(_fields).forEach(k => {
                    const c = _fields[k];
                    out[k] = c._type === 'form' ? c.rawValues()
                           : c._type === 'list' ? c.rawValues()
                           : c.value.value;
                });
                return out;
            };

            // set — update one field by path (dot/bracket notation supported)
            // FEAT C: when install option { autoCreatePath: true } is set,
            // intermediate forms/lists are created on the fly for paths that
            // don't yet exist. Without that option, set() on a missing path
            // just warns (the prior behavior).
            const set = (path, val) => {
                const c = getField(path);
                if (c) { c.set(val, { silent: true }); return; }

                if (!config.autoCreatePath && !opts.autoCreatePath) {
                    console.warn(`[Helix Validate] form.set: path "${path}" not found.`);
                    return;
                }

                // Auto-create chain of nested forms for the missing path.
                const parts = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
                let cur = _f;
                for (let i = 0; i < parts.length - 1; i++) {
                    const seg = parts[i];
                    if (cur._type !== 'form') {
                        console.warn(`[Helix Validate] form.set: can't auto-create through non-form at "${seg}".`);
                        return;
                    }
                    if (!cur.fields[seg]) cur.add(seg, form({}));
                    cur = cur.fields[seg];
                }
                if (cur._type === 'form') {
                    const leaf = parts[parts.length - 1];
                    cur.add(leaf, field(val));
                }
            };

            // patch — partial object update (recursive for nested forms)
            const patch = (obj) => {
                Object.keys(obj).forEach(k => {
                    const c = getField(k);
                    if (!c) return;
                    if (c._type === 'form' && obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
                        c.patch(obj[k]);
                    } else if (c.set) {
                        c.set(obj[k], { silent: true });
                    }
                });
            };

            // reset — all fields
            const reset = (obj) => {
                obj = obj || {};
                Object.keys(_fields).forEach(k => {
                    if (_fields[k].reset) _fields[k].reset(obj[k]);
                });
                submitted.value = false;
                error.value     = null;
                if (opts.serverErrors) opts.serverErrors.value = {};
                _emit({ type: 'reset' });
            };

            // touch / touchAll
            const touch    = (opts2) => {
                // Called by child fields when they bubble up — noop at form level
            };
            const touchAll = () => {
                Object.values(_fields).forEach(c => {
                    if (c.touchAll)     c.touchAll();
                    else if (c.touch)   c.touch({ self: true });
                });
            };

            // ── Field management ─────────────────────────────────────────────
            const add    = (name, ctrl) => { _registerField(name, ctrl); };
            // FIX #7: destroy the child to stop its reactive watchers before
            // we drop the reference. Without _destroy(), the dirty-tracker,
            // autoDirty watcher, and server-error watcher all leak.
            const remove = (name) => {
                if (!_fields[name]) return;
                const c = _fields[name];
                // FIX (BUG-006): stop the cross-error watcher for this control.
                if (c._crossWatcherStop) { c._crossWatcherStop(); c._crossWatcherStop = null; }
                if (typeof c._destroy === 'function') c._destroy();
                c._parent = null;
                delete _fields[name];
                _fieldsVersion.value++; // FIX (BUG-001): membership changed
            };
            const has    = (name) => !!_fields[name];

            // ── Error helpers ────────────────────────────────────────────────
            const setErrors = (errMap) => {
                Object.keys(errMap || {}).forEach(k => {
                    const c = getField(k);
                    if (c) c.setErrors(Array.isArray(errMap[k]) ? errMap[k] : [errMap[k]]);
                });
            };

            const setError   = (msg) => { error.value = msg; };
            const clearError = ()    => { error.value = null; };

            // ── Validation ───────────────────────────────────────────────────
            // FIX #3: cross-validator errors used to flow through setErrors,
            // which writes to each field's server channel. Once written, they
            // were never cleared on subsequent passing runs. Now they use the
            // dedicated _crossErrors channel which is wiped at the start of
            // every full validate() and auto-cleared on field edits below.
            const validate = (opts2) => {
                opts2 = opts2 || {};
                const group = opts2.group;
                let   ctrls = Object.values(_fields);

                if (group) {
                    const groups = Array.isArray(group) ? group : [group];
                    ctrls = ctrls.filter(c => c._group && groups.includes(c._group));
                }

                // FIX #3: wipe cross errors before re-running (only for full
                // validation, not group-filtered runs).
                if (!group) {
                    Object.values(_fields).forEach(c => {
                        if (c._crossErrors) c._crossErrors.value = [];
                    });
                }

                return Promise.all(ctrls.map(c => c.validate ? c.validate() : Promise.resolve(true)))
                    .then(results => {
                        const allValid = results.every(Boolean);
                        if (group || !_crossValidators.length) return allValid;

                        const vals = values();
                        return _crossValidators.reduce((chain, xv) =>
                            chain.then(passing => {
                                if (!passing) return false;
                                return Promise.resolve(xv(vals, _f)).then(errs => {
                                    if (!errs) return true;
                                    // Write to the dedicated cross channel
                                    // (NOT setErrors, which would pollute server channel).
                                    Object.keys(errs).forEach(k => {
                                        const c = getField(k);
                                        if (!c || !c._crossErrors) return;
                                        const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];
                                        c._crossErrors.value = c._crossErrors.value.concat(
                                            arr.map(m => ({ message: m, source: 'cross', rule: null }))
                                        );
                                    });
                                    return false;
                                });
                            }),
                            Promise.resolve(allValid)
                        );
                    });
            };

            // ── bind() — returns [valueRef, element props] for a named field ─
            const bind = (name, bindOpts) => {
                bindOpts = bindOpts || {};
                const c = getField(name);
                if (!c) {
                    console.warn(`[Helix Validate] form.bind: field "${name}" not found.`);
                    return [app.ref(''), {}];
                }
                const trigger = bindOpts.trigger || c.updateOn || config.trigger;
                // FIX (M5): scope the generated id/aria target with the form's
                // unique id so two forms sharing a field name (e.g. "email")
                // don't emit colliding DOM ids / mis-targeted aria-describedby.
                const fieldId = `hx-field-${_id}-${name}`;
                return [c.value, {
                    id:                 fieldId,
                    name,
                    'aria-invalid':     app.computed(() => c.invalid.value),
                    'aria-describedby': `hx-err-${_id}-${name}`,
                    onBlur:  () => { c.touch(); if (trigger === 'blur' || trigger === 'eager') c.validate(); },
                    onInput: (e) => { c.set(e.target.value); if (trigger === 'input') c.validate(); },
                }];
            };

            // ── Child changed — bubble to parent ─────────────────────────────
            const _childChanged = () => {
                if (_f._parent && _f._parent._childChanged) _f._parent._childChanged();
            };

            // ── Event emitter ────────────────────────────────────────────────
            const _evtListeners = [];
            const _emit = (event) => _evtListeners.forEach(cb => cb(event));
            const on = (event, cb) => {
                const wrapped = (e) => { if (e.type === event) cb(e); };
                _evtListeners.push(wrapped);
                return () => { const i = _evtListeners.indexOf(wrapped); if (i > -1) _evtListeners.splice(i, 1); };
            };

            // ── submit ───────────────────────────────────────────────────────
            const submit = () => {
                touchAll();
                _emit({ type: 'submit' });

                return validate().then(ok => {
                    if (!ok) {
                        if (opts.onInvalid) opts.onInvalid(values(), _f);
                        _emit({ type: 'invalid' });
                        return;
                    }

                    submitting.value = true;
                    _emit({ type: 'submitting' });

                    const afterSubmit = opts.onSubmit
                        ? Promise.resolve(opts.onSubmit(values(), _f))
                        : Promise.resolve();

                    return afterSubmit
                        .then(() => {
                            submitted.value = true;
                            _emit({ type: 'submitted' });
                            if (opts.resetOnSubmit) reset();
                        })
                        .catch(err => {
                            _emit({ type: 'error', error: err });
                            throw err;
                        })
                        .finally(() => { submitting.value = false; });
                });
            };

            // ── serverErrors — reactive injection with auto-clear on edit ────
            // FIX #6: every time serverErrors changed, this used to create a
            // brand-new per-field watcher and forget the previous one. After
            // N rounds of server validation, N orphan watchers were running
            // per field. Now each field keeps its own _serverWatcherStop slot
            // and we dispose the previous watcher before installing a new one.
            // Also uses _serverErrors channel directly (no more errors.value
            // mutation, since errors is now a computed).
            if (opts.serverErrors) {
                const stopExt = app.watch(opts.serverErrors, (errs) => {
                    if (!errs) return;
                    Object.keys(errs).forEach(k => {
                        const c = getField(k);
                        if (!c) return;

                        const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];

                        // FEAT B: write to the dedicated server channel.
                        c._serverErrors.value = arr.map(m => ({ message: m, source: 'server', rule: null }));

                        // FIX #6: dispose the previous auto-clear watcher
                        // before creating a new one. Without this, every
                        // server-error update piled on a fresh watcher.
                        if (c._serverWatcherStop) c._serverWatcherStop();

                        const stopOnce = app.watch(c.value, () => {
                            c._serverErrors.value = [];
                            const updated = Object.assign({}, opts.serverErrors.value);
                            delete updated[k];
                            opts.serverErrors.value = updated;
                            if (c._serverWatcherStop) {
                                c._serverWatcherStop();
                                c._serverWatcherStop = null;
                            }
                        }, { immediate: false });
                        c._serverWatcherStop = stopOnce;
                    });
                }, { deep: true, immediate: false });
                _stoppers.push(stopExt);
            }

            // FIX #7 (form side): expose _destroy so a parent form removing
            // a nested-form child can fully tear it down.
            const _destroy = () => {
                _stoppers.forEach(s => s && s());
                _stoppers.length = 0;
                Object.values(_fields).forEach(c => {
                    // FIX (BUG-013): stop the form-owned cross-error watcher
                    // that now lives on the control instead of _stoppers.
                    if (c._crossWatcherStop) { c._crossWatcherStop(); c._crossWatcherStop = null; }
                    if (c._destroy) c._destroy();
                });
                _evtListeners.length = 0;
            };

            const _f = {
                _id, _type: 'form', _parent: null,
                _stoppers, _emit,
                _childChanged,
                get fields() { return _fields; },

                // Reactive state
                valid, invalid, dirty, touched, pending, status, $valid,
                submitting, submitted, error, hasError,

                // API
                field:      getField,
                values,     rawValues,
                set,        patch,     reset,
                touch,      touchAll,
                add,        remove,    has,
                setErrors,  setError,  clearError,
                validate,   submit,
                bind,       on,
                _destroy,
            };

            return _f;
        }

        // =====================================================================
        // 11. FIELD LIST  (dynamic ordered collection)
        // =====================================================================
        function list(initialItems, validators) {
            const _id    = uid();
            const items  = app.ref(Array.isArray(initialItems) ? initialItems.slice() : []);
            const length = app.computed(() => items.value.length);

            // FIX #4: surface list-level validator errors on a dedicated
            // errors ref. Without this, `list(items, [minLength(2)])` was a
            // silent no-op: validators were stored, never run, never shown.
            const errors  = app.ref([]); // string[]
            const _tagged = app.ref([]); // { message, source:'list', rule }

            // FIX #4: list-level validity now considers both children AND
            // list-level validator results.
            const valid   = app.computed(() =>
                items.value.every(c => c.valid.value) && errors.value.length === 0
            );
            const invalid = app.computed(() => !valid.value);
            const pending = app.computed(() => items.value.some(c => c.pending.value));
            const $valid  = app.computed(() =>
                items.value.every(c => c.$valid.value) && errors.value.length === 0
            );

            let _validators = normalizeRules(validators || []);

            const at     = (i)    => items.value[i] || null;
            const push   = (c)    => { c._parent = _l; items.value = items.value.concat(c); };
            const insert = (i, c) => { c._parent = _l; const a = items.value.slice(); a.splice(i, 0, c); items.value = a; };
            const remove = (i)    => {
                // Tear down the removed item to stop its watchers.
                const removed = items.value[i];
                if (removed && removed._destroy) removed._destroy();
                const a = items.value.slice(); a.splice(i, 1); items.value = a;
            };
            const clear  = ()     => {
                items.value.forEach(c => { if (c && c._destroy) c._destroy(); });
                items.value = [];
            };
            const set    = (i, c) => { c._parent = _l; const a = items.value.slice(); a[i] = c; items.value = a; };

            const values    = () => items.value.map(c => c._type === 'form' ? c.values()    : c.value.value);
            const rawValues = () => items.value.map(c => c._type === 'form' ? c.rawValues() : c.value.value);

            const touchAll = () => {
                items.value.forEach(c => {
                    if (c.touchAll) c.touchAll();
                    else if (c.touch) c.touch({ self: true });
                });
            };

            // FIX #4: run list-level validators after items, with priority
            // tiers + run-id stale guard (same engine as fields).
            // FIX (C5): the run-state (_runId/_runAbort) now lives on the
            // persistent _l object instead of a throwaway stub recreated each
            // call, so a new list.validate() correctly aborts/stale-guards the
            // previous in-flight list-level async validators.
            const validate = () => {
                return Promise.all(items.value.map(c => c.validate ? c.validate() : Promise.resolve(true)))
                    .then(itemsOK => {
                        const allItemsValid = itemsOK.every(Boolean);
                        if (!_validators.length) {
                            errors.value  = [];
                            _tagged.value = [];
                            return allItemsValid;
                        }
                        // Pass the array of items' values to list-level rules.
                        return runRules(_l, _validators, values()).then(result => {
                            if (!result) return allItemsValid;
                            const listTagged = result.tagged.map(t => ({ ...t, source: 'list' }));
                            _tagged.value = listTagged;
                            errors.value  = listTagged.map(t => t.message);
                            return allItemsValid && errors.value.length === 0;
                        });
                    });
            };

            const setValidators = (v) => { _validators = normalizeRules(v); };
            const clearErrors   = ()  => { errors.value = []; _tagged.value = []; };

            const reset = (vals) => {
                vals = vals || [];
                items.value.forEach((c, i) => { if (c.reset) c.reset(vals[i]); });
                errors.value  = [];
                _tagged.value = [];
            };

            const _destroy = () => {
                // FIX (C5): abort any in-flight list-level validation run.
                if (_l._runAbort) { try { _l._runAbort.abort(); } catch (_) {} _l._runAbort = null; }
                items.value.forEach(c => { if (c && c._destroy) c._destroy(); });
            };

            const _l = {
                _id, _type: 'list', _parent: null,
                _runId: null, _runAbort: null,   // FIX (C5): persistent run-state
                _tagged,
                items, length, errors,
                valid, invalid, pending, $valid,
                at, push, insert, remove, clear, set,
                values, rawValues,
                touchAll, validate, reset,
                setValidators, clearErrors,
                _destroy,
            };
            return _l;
        }

        // =====================================================================
        // 12. REMOTE VALIDATION
        // =====================================================================
        function runRemote(el, url, value, opts) {
            opts = opts || {};
            if (remoteAborts.has(el)) remoteAborts.get(el).abort();
            const ctrl = new AbortController();
            remoteAborts.set(el, ctrl);

            const method  = (opts.method || config.remote.method).toUpperCase();
            const param   = opts.param || config.remote.param;
            const headers = Object.assign({}, config.remote.headers, opts.headers || {});

            let fetchUrl = url;
            let body;

            if (method === 'GET') {
                fetchUrl = url + (url.includes('?') ? '&' : '?') + param + '=' + encodeURIComponent(value);
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify({ [param]: value });
            }

            const $http = app.namespace && typeof app.namespace === 'function'
                ? (app.namespace('axios') && app.namespace('axios').$http) : null;

            const req = ($http && method === 'GET')
                ? $http.get(fetchUrl, { signal: ctrl.signal, headers })
                : fetch(fetchUrl, { method, headers, body, signal: ctrl.signal })
                    .then(res => {
                        if (!res.ok) return { valid: false, message: opts.fallback || 'Validation failed.' };
                        return res.json();
                    });

            return req
                .then(json => {
                    if (json.errors && Array.isArray(json.errors)) return { valid: false, message: json.errors[0] };
                    return { valid: json.valid !== false, message: json.message || null };
                })
                .catch(err => {
                    if (err && err.name === 'AbortError') return null;
                    return { valid: false, message: 'Connection error. Please try again.' };
                });
        }

        // =====================================================================
        // 13. DATA-HX-* ATTRIBUTE PARSER
        // =====================================================================
        function getFormFromEl(el) {
            let node = el ? el.parentElement : null;
            while (node) { if (formContextMap.has(node)) return formContextMap.get(node); node = node.parentElement; }
            return null;
        }

        function parseDataHx(el) {
            const ruleFns = [];
            // FIX (M12): per-element message overrides collected here instead
            // of being written into the shared config.messages, which leaked
            // one field's custom message to every other form/field.
            const msgOverrides = {};
            const opts = {
                remoteUrl: null, remoteOpts: {}, debounce: null, trigger: null,
                group: null, excluded: false, autoDirty: false, lazy: false,
                pendingText: '', classHandler: null, errTarget: null,
            };

            const boolMap = {
                'data-hx-required': () => required,
                'data-hx-email':    () => email,
                'data-hx-url':      () => url,
                'data-hx-numeric':  () => numeric,
                'data-hx-integer':  () => integer,
            };
            const paramMap = {
                'data-hx-minlength': (v) => minLength(Number(v)),
                'data-hx-maxlength': (v) => maxLength(Number(v)),
                'data-hx-min':       (v) => min(Number(v)),
                'data-hx-max':       (v) => max(Number(v)),
                'data-hx-between':   (v) => { const [a, b] = v.split(','); return between(Number(a), Number(b)); },
                'data-hx-pattern':   (v) => pattern(v),
                'data-hx-one-of':    (v) => oneOf(v.split(',')),
                'data-hx-same-as':   (v) => {
                    const t = document.querySelector(v) || document.querySelector(`[name="${v}"]`);
                    return t ? sameAs(() => t.value, v) : null;
                },
            };

            Array.from(el.attributes).forEach(({ name: a, value: v }) => {
                if (boolMap[a])  { const fn = boolMap[a]();  if (fn) ruleFns.push(fn); return; }
                if (paramMap[a]) { const fn = paramMap[a](v); if (fn) ruleFns.push(fn); return; }

                // FIX (M12): record per-element override instead of mutating
                // the global config.messages. Exclude 'remote' so that
                // data-hx-remote-message reaches its dedicated handler below
                // (previously it was swallowed here and never applied).
                const msgMatch = a.match(/^data-hx-(.+)-message$/);
                if (msgMatch && msgMatch[1] !== 'remote') { msgOverrides[msgMatch[1]] = v; return; }

                if (a === 'data-hx-required-if') {
                    const parentForm = getFormFromEl(el);
                    if (parentForm) ruleFns.push(requiredIf(() => { const c = parentForm.field(v); return c ? !!c.value.value : false; }));
                    return;
                }
                if (a === 'data-hx-required-unless') {
                    const parentForm = getFormFromEl(el);
                    if (parentForm) ruleFns.push(requiredUnless(() => { const c = parentForm.field(v); return c ? !!c.value.value : false; }));
                    return;
                }

                if (a === 'data-hx-remote')           { opts.remoteUrl = v; return; }
                if (a === 'data-hx-remote-message')   { opts.remoteOpts.fallback = v; return; }
                if (a === 'data-hx-remote-options')   { try { Object.assign(opts.remoteOpts, JSON.parse(v)); } catch {} return; }
                if (a === 'data-hx-debounce')         { opts.debounce = Number(v); return; }
                if (a === 'data-hx-trigger')          { opts.trigger = v; return; }
                if (a === 'data-hx-group')            { opts.group = v; return; }
                if (a === 'data-hx-excluded')         { opts.excluded = true; return; }
                if (a === 'data-hx-auto-dirty')       { opts.autoDirty = true; return; }
                if (a === 'data-hx-lazy')             { opts.lazy = true; return; }
                if (a === 'data-hx-pending-text')     { opts.pendingText = v; return; }
                if (a === 'data-hx-class-handler')    { opts.classHandler = v; return; }
                if (a === 'data-hx-error-target')     { opts.errTarget = v; return; }
                if (a === 'data-hx-errors-container') { opts.errTarget = v; return; }
            });

            // FIX (M12): apply any per-element message overrides by wrapping
            // the matching rule(s) with withMessage — scoped to this field only.
            // NOTE (N2): overrides are keyed by rule name, so if the same rule
            // type appears twice on one element (e.g. two patterns), the single
            // data-hx-{rule}-message applies to all instances of that rule.
            const finalFns = Object.keys(msgOverrides).length
                ? ruleFns.map(fn =>
                    (fn._ruleName && msgOverrides[fn._ruleName])
                        ? withMessage(msgOverrides[fn._ruleName], fn)
                        : fn)
                : ruleFns;

            return { ruleFns: finalFns, opts };
        }

        // =====================================================================
        // 14. DOM HELPERS
        // =====================================================================
        function getClassTarget(el, handler) {
            if (!handler)             return el;
            if (handler === 'parent') return el.parentElement || el;
            try { return document.querySelector(handler) || el; } catch { return el; }
        }

        function ensureErrSpan(el, fid) {
            const id   = `hx-err-${fid}`;
            const next = el.nextElementSibling;
            if (next && next.id === id) return next;
            const span = document.createElement('span');
            span.id = id;
            span.className = 'hx-error-msg';
            span.setAttribute('role', 'alert');
            span.setAttribute('aria-live', 'polite');
            el.insertAdjacentElement('afterend', span);
            return span;
        }

        function renderField(el, ctrl, fid, dOpts) {
            dOpts = dOpts || {};
            const target    = getClassTarget(el, dOpts.classHandler);
            const container = (dOpts.errTarget && document.querySelector(dOpts.errTarget)) || ensureErrSpan(el, fid);
            const cls       = config.classes;

            target.classList.remove(cls.valid, cls.invalid, cls.pending);

            if (ctrl.pending.value) {
                target.classList.add(cls.pending);
                el.setAttribute('data-hx-pending', '');
                el.setAttribute('aria-invalid', 'false');
                el.removeAttribute('aria-describedby');
                container.innerHTML = dOpts.pendingText
                    ? `<span class="hx-err hx-err--pending">${dOpts.pendingText}</span>` : '';
                return;
            }

            el.removeAttribute('data-hx-pending');
            const showErrs = (ctrl.dirty.value || ctrl.touched.value) && ctrl.errors.value.length > 0;
            const isClean  = ctrl.errors.value.length === 0;

            if (showErrs) {
                target.classList.add(cls.invalid);
                el.setAttribute('aria-invalid', 'true');
                el.setAttribute('aria-describedby', `hx-err-${fid}`);
                const tagged = ctrl._tagged.value.filter(t => t && t.message);
                const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
                container.innerHTML = toShow
                    .map(t => `<span class="hx-err hx-err--${t.source}">${t.message}</span>`)
                    .join('');
            } else if (isClean && ctrl.touched.value) {
                target.classList.add(cls.valid);
                el.setAttribute('aria-invalid', 'false');
                el.removeAttribute('aria-describedby');
                container.innerHTML = '';
            } else {
                el.setAttribute('aria-invalid', 'false');
                el.removeAttribute('aria-describedby');
                container.innerHTML = '';
            }
        }

        // =====================================================================
        // 15. HX-VALIDATE DIRECTIVE  (binds a Field)
        // =====================================================================
        app.directive('validate', {
            mounted(el, binding) {
                const bindVal = binding.value;
                let ctrl, fid, dOpts = {};

                // A — pre-built Field passed directly
                if (bindVal && bindVal._type === 'field') {
                    ctrl = bindVal;
                    fid  = ctrl.name || ctrl._id;

                // B — build from data-hx-* + optional string binding
                } else {
                    const parsed = parseDataHx(el);
                    let   rFns   = parsed.ruleFns.slice();
                    if (typeof bindVal === 'string') rFns = normalizeRules(bindVal).concat(rFns);

                    const name = el.getAttribute('name') || el.getAttribute('id') || uid();
                    fid   = name;
                    dOpts = parsed.opts;

                    // FIX #8: read the right DOM property for the input type.
                    //   checkbox → boolean .checked
                    //   radio    → the value of the checked radio in the group
                    //              (or '' if none is currently checked)
                    //   other    → string .value
                    let initial;
                    if (el.type === 'checkbox') {
                        initial = !!el.checked;
                    } else if (el.type === 'radio') {
                        // FIX (v2.1.1): scope the checked-radio lookup to the
                        // field's owning form so identical radio names in other
                        // forms can't be picked up.
                        const scope = el.form || el.closest('form') || document;
                        const checked = scope.querySelector(
                            `input[type=radio][name="${name}"]:checked`
                        );
                        initial = checked ? checked.value : '';
                    } else if (el.isContentEditable) {
                        // FEAT (M1): support contenteditable custom inputs.
                        initial = el.textContent || '';
                    } else {
                        initial = el.value || '';
                    }

                    ctrl  = field(initial, rFns, {
                        name,
                        trigger:   dOpts.trigger,
                        autoDirty: dOpts.autoDirty,
                        lazy:      dOpts.lazy,
                        group:     dOpts.group,
                    });

                    // Register on nearest parent hx-form
                    const parentForm = getFormFromEl(el);
                    if (parentForm && !parentForm.fields[name] && !dOpts.excluded) {
                        parentForm.add(name, ctrl);
                    }
                }

                el.__hxField = ctrl;
                if (!el.id) el.id = `hx-field-${fid}`;
                el.setAttribute('aria-invalid', 'false');

                const trigger    = dOpts.trigger || ctrl.updateOn || config.trigger;
                const debounceMs = dOpts.debounce != null ? dOpts.debounce : (dOpts.remoteUrl ? config.debounce : 0);
                const remoteUrl  = dOpts.remoteUrl || null;
                const remoteOpts = dOpts.remoteOpts || {};
                const dispOpts   = { classHandler: dOpts.classHandler, errTarget: dOpts.errTarget, pendingText: dOpts.pendingText || '' };

                let _remoteTimer = null;
                let _eagerOn     = false;

                function doValidate() {
                    return ctrl.validate().then(() => {
                        renderField(el, ctrl, fid, dispOpts);

                        if (remoteUrl && ctrl.errors.value.length === 0 && !ctrl.disabled.value) {
                            if (config.minChars && String(ctrl.value.value).length < config.minChars) return;

                            // FIX (v2.1.1): flip pending on only after the
                            // debounce settles (inside the timer), so rapid
                            // typing no longer flickers the "Checking…" state.
                            if (_remoteTimer) clearTimeout(_remoteTimer);
                            _remoteTimer = setTimeout(() => {
                                _remoteTimer = null;
                                ctrl.pending.value = true;
                                renderField(el, ctrl, fid, dispOpts);
                                runRemote(el, remoteUrl, ctrl.value.value, remoteOpts).then(result => {
                                    ctrl.pending.value = false;
                                    if (result === null) return;

                                    // FIX #5 / FEAT B: write directly to the
                                    // remote channel. Replaces, never appends,
                                    // so repeated failures can't pile up as
                                    // "Taken Taken Taken". A passing response
                                    // also clears the channel.
                                    if (!result.valid) {
                                        const msg = result.message || 'Invalid value.';
                                        ctrl._remoteErrors.value = [{ message: msg, source: 'remote', rule: null }];
                                    } else {
                                        ctrl._remoteErrors.value = [];
                                    }
                                    renderField(el, ctrl, fid, dispOpts);
                                });
                            }, debounceMs || config.debounce);
                        }
                    });
                }

                // FIX (v2.1.1): read the correct value per input type.
                //   checkbox → boolean .checked
                //   radio    → the value of the checked radio in the group,
                //              scoped to the owning form (not the whole doc)
                //   other    → string .value
                function readInputValue(e) {
                    const t = e.target;
                    if (t.type === 'checkbox') return t.checked;
                    if (t.type === 'radio') {
                        const rname = ctrl.name || el.getAttribute('name');
                        const scope = el.form || el.closest('form') || document;
                        const checked = rname
                            ? scope.querySelector(`input[type=radio][name="${rname}"]:checked`)
                            : (t.checked ? t : null);
                        return checked ? checked.value : '';
                    }
                    // FEAT (M1): contenteditable elements have no .value.
                    if (t.isContentEditable || t.value === undefined) return t.textContent;
                    return t.value;
                }

                function onInput(e) {
                    ctrl.value.value = readInputValue(e);
                    if (ctrl._autoDirty) ctrl.dirty.value = true;
                    if (trigger === 'input' || trigger === 'change') doValidate();
                    if (trigger === 'eager' && (_eagerOn || ctrl.touched.value)) { doValidate(); _eagerOn = true; }
                }
                function onBlur() {
                    ctrl.touch();
                    if (!_eagerOn && ctrl.errors.value.length > 0) _eagerOn = true;
                    if (trigger === 'blur' || trigger === 'eager') doValidate();
                }
                function onChange(e) {
                    // FIX (C4): ignore the uncheck event of a radio being
                    // deselected so it can't clobber the group's value with ''.
                    if (e.target.type === 'radio' && !e.target.checked) return;
                    ctrl.value.value = readInputValue(e);
                    if (trigger === 'change') doValidate();
                }

                el.addEventListener('input',  onInput);
                el.addEventListener('blur',   onBlur);
                el.addEventListener('change', onChange);

                // Reactive: keep DOM in sync with field state.
                // FIX (C3): depend on the full _tagged channel (not just
                // errors.length) so a message change that keeps the same count
                // (e.g. "Required" → "Invalid email") still re-renders. Also
                // track pending/touched/dirty since renderField reads them.
                const effect = app.effect(() => {
                    void ctrl._tagged.value;
                    void ctrl.pending.value;
                    void ctrl.touched.value;
                    void ctrl.dirty.value;
                    renderField(el, ctrl, fid, dispOpts);
                });
                allEffects.add(effect);

                if (config.validateOnMount && !ctrl._lazy) doValidate();

                dirUpdaters.set(el, (newB) => {
                    const nv = newB.value;
                    if (nv && nv._type === 'field' && nv !== ctrl) {
                        ctrl = nv; el.__hxField = ctrl;
                        fid  = ctrl.name || ctrl._id;
                    }
                });

                const cleanup = () => {
                    el.removeEventListener('input',  onInput);
                    el.removeEventListener('blur',   onBlur);
                    el.removeEventListener('change', onChange);
                    if (effect && effect.stop) effect.stop();
                    allEffects.delete(effect);
                    if (_remoteTimer) clearTimeout(_remoteTimer);
                    if (remoteAborts.has(el)) { remoteAborts.get(el).abort(); remoteAborts.delete(el); }
                    if (!dOpts.errTarget) {
                        const span = document.getElementById(`hx-err-${fid}`);
                        if (span && span === el.nextElementSibling) span.remove();
                    }
                    el.classList.remove(config.classes.valid, config.classes.invalid, config.classes.pending);
                    el.removeAttribute('aria-invalid');
                    el.removeAttribute('aria-describedby');
                    el.removeAttribute('data-hx-pending');
                    delete el.__hxField;
                    boundFieldEls.delete(el); // FIX N1/M11
                    allCleanups.delete(cleanup);
                };
                dirCleanups.set(el, cleanup);
                allCleanups.add(cleanup);
                // FIX (BUG-004): only track elements when the MutationObserver
                // is active. When observe is off this set is never read, so
                // populating it would just pin removed nodes in memory (the
                // strong Set would block GC of fields removed outside the
                // directive lifecycle).
                if (options.observe) boundFieldEls.add(el);
            },

            updated(el, binding) {
                const u = dirUpdaters.get(el);
                if (u) u(binding);
            },

            unmounted(el) {
                const cleanup = dirCleanups.get(el);
                if (cleanup) { cleanup(); dirCleanups.delete(el); dirUpdaters.delete(el); }
            }
        });

        // =====================================================================
        // 16. HX-FORM DIRECTIVE  (binds a Form)
        // =====================================================================
        app.directive('form', {
            mounted(el, binding) {
                const f = binding.value;
                if (!f || f._type !== 'form') {
                    console.warn('[Helix Validate] hx-form: binding must be a Form.');
                    return;
                }

                formContextMap.set(el, f);
                if (app.provide) app.provide('$validate.context', f);

                function onSubmit(e) { e.preventDefault(); f.submit(); }
                el.addEventListener('submit', onSubmit);

                const effect = app.effect(() => {
                    if (f.submitting.value) {
                        el.setAttribute('data-hx-submitting', '');
                        el.querySelectorAll('[type=submit]:not([data-hx-no-disable])')
                            .forEach(btn => { btn.disabled = true; });
                    } else {
                        el.removeAttribute('data-hx-submitting');
                        el.querySelectorAll('[type=submit]:not([data-hx-no-disable])')
                            .forEach(btn => { btn.disabled = false; });
                    }
                });
                allEffects.add(effect);

                const cleanup = () => {
                    el.removeEventListener('submit', onSubmit);
                    if (effect && effect.stop) effect.stop();
                    allEffects.delete(effect);
                    formContextMap.delete(el);
                    allCleanups.delete(cleanup);
                };
                dirCleanups.set(el, cleanup);
                allCleanups.add(cleanup);
            },

            unmounted(el) {
                const cleanup = dirCleanups.get(el);
                if (cleanup) { cleanup(); dirCleanups.delete(el); }
            }
        });

        // =====================================================================
        // 17. HX-LIST DIRECTIVE  (binds a FieldList)
        // =====================================================================
        app.directive('list', {
            mounted(el, binding) {
                const l = binding.value;
                if (!l || l._type !== 'list') {
                    console.warn('[Helix Validate] hx-list: binding must be a FieldList.');
                    return;
                }

                const tmpl = el.querySelector('[hx-list-item]');
                if (!tmpl) {
                    console.warn('[Helix Validate] hx-list: no [hx-list-item] template found.');
                    return;
                }
                tmpl.style.display = 'none';

                function render() {
                    el.querySelectorAll('[data-hx-list-item]').forEach(n => n.remove());
                    l.items.value.forEach((itemCtrl, index) => {
                        const clone = tmpl.cloneNode(true);
                        clone.removeAttribute('hx-list-item');
                        clone.style.display = '';
                        clone.setAttribute('data-hx-list-item', String(index));
                        clone.__hxListItem  = itemCtrl;
                        clone.__hxListIndex = index;
                        clone.querySelectorAll('[data-hx-remove]').forEach(btn => {
                            btn.addEventListener('click', () => l.remove(index));
                        });
                        el.insertBefore(clone, tmpl);
                    });
                }

                render();
                const effect = app.effect(() => {
                    void l.items.value.length;
                    render();
                });
                allEffects.add(effect);

                const cleanup = () => {
                    if (effect && effect.stop) effect.stop();
                    allEffects.delete(effect);
                    allCleanups.delete(cleanup);
                };
                dirCleanups.set(el, cleanup);
                allCleanups.add(cleanup);
            },

            unmounted(el) {
                const cleanup = dirCleanups.get(el);
                if (cleanup) { cleanup(); dirCleanups.delete(el); }
            }
        });

        // =====================================================================
        // 18. AUTO-BIND SCANNER  (data-hx-form on <form>)
        // =====================================================================
        function scanForms() {
            document.querySelectorAll('[data-hx-form]').forEach(formEl => {
                // FIX (v2.1.1): double-bind guard. The WeakMap check protects
                // against re-scans, and the __hxAutoBound flag survives a
                // detach/reinsert cycle to prevent duplicate submit handlers.
                if (formContextMap.has(formEl) || formEl.__hxAutoBound) return;

                const fieldDefs = {};
                formEl.querySelectorAll('[name]').forEach(input => {
                    const { ruleFns, opts: fOpts } = parseDataHx(input);
                    if (!ruleFns.length && !fOpts.remoteUrl) return;
                    const name = input.getAttribute('name');

                    // FIX #8 (same logic as directive)
                    // FIX (v2.1.1): scope the checked-radio lookup to this form.
                    let initial;
                    if (input.type === 'checkbox') {
                        initial = !!input.checked;
                    } else if (input.type === 'radio') {
                        const scope = input.form || input.closest('form') || formEl;
                        const checked = scope.querySelector(
                            `input[type=radio][name="${name}"]:checked`
                        );
                        initial = checked ? checked.value : '';
                    } else {
                        initial = input.value || '';
                    }

                    fieldDefs[name] = field(initial, ruleFns, {
                        name, trigger: fOpts.trigger, autoDirty: fOpts.autoDirty,
                        lazy: fOpts.lazy, group: fOpts.group,
                    });
                });

                const f = form(fieldDefs);
                formContextMap.set(formEl, f);
                autoForms.set(formEl, f);
                formEl.__hxAutoBound = true;

                // FIX (v2.1.1): keep a reference to the submit handler and
                // register a cleanup so plugin teardown removes the listener
                // (previously leaked) instead of leaving it bound.
                const onFormSubmit = e => { e.preventDefault(); f.submit(); };
                formEl.addEventListener('submit', onFormSubmit);

                const cleanup = () => {
                    formEl.removeEventListener('submit', onFormSubmit);
                    autoForms.delete(formEl);
                    autoFormCleanups.delete(formEl);
                    formContextMap.delete(formEl);
                    delete formEl.__hxAutoBound;
                    if (typeof f._destroy === 'function') f._destroy();
                    allCleanups.delete(cleanup);
                };
                autoFormCleanups.set(formEl, cleanup);
                allCleanups.add(cleanup);
            });
        }

        // FIX (C2): tear down auto-bound forms whose elements were removed from
        // the DOM. Without this, autoForms (a strong Map) and the form's
        // reactive watchers/submit listener leaked until plugin teardown.
        //
        // FIX (N3): skip nodes that are still connected — a remove-then-reinsert
        // within the same tick leaves the node attached by the time this async
        // observer callback runs, so tearing it down would wrongly unbind it.
        //
        // FIX (N1/M11): also dispose standalone hx-validate fields (not just
        // [data-hx-form] elements) found in the removed subtree, since raw DOM
        // removal / innerHTML replacement never fires the directive's unmounted
        // hook.
        function disposeFieldEl(fieldEl) {
            const fc = dirCleanups.get(fieldEl);
            if (fc) { fc(); dirCleanups.delete(fieldEl); dirUpdaters.delete(fieldEl); }
        }

        function cleanupRemovedNode(node) {
            if (!node || node.nodeType !== 1) return;
            if (node.isConnected) return; // FIX N3: re-inserted, leave it bound

            // Auto-bound forms (self + descendants)
            if (autoFormCleanups.has(node)) autoFormCleanups.get(node)();
            if (node.querySelectorAll) {
                node.querySelectorAll('[data-hx-form]').forEach(f => {
                    if (autoFormCleanups.has(f)) autoFormCleanups.get(f)();
                });
            }

            // Standalone directive-bound fields (self + descendants). Iterate
            // the tracked set and match by containment, since dirCleanups is a
            // WeakMap and can't be enumerated.
            boundFieldEls.forEach(fieldEl => {
                if (fieldEl === node || node.contains(fieldEl)) disposeFieldEl(fieldEl);
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', scanForms);
        } else {
            scanForms();
        }

        // FIX (v2.1.1): coalesce observer-triggered scans into a single
        // rAF (fallback setTimeout) tick so a burst of DOM mutations does
        // not run scanForms() once per mutation batch.
        let _scanScheduled = false;
        let _scanHandle    = null;
        const _raf = (typeof requestAnimationFrame !== 'undefined')
            ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
        const _caf = (typeof cancelAnimationFrame !== 'undefined')
            ? cancelAnimationFrame : clearTimeout;
        function scheduleScan() {
            if (_scanScheduled) return;
            _scanScheduled = true;
            _scanHandle = _raf(() => {
                _scanScheduled = false;
                _scanHandle    = null;
                scanForms();
            });
        }

        // FIX #11: dynamic DOM support — opt-in via install option { observe: true }.
        // Watches for [data-hx-form] elements added after initial scan and binds
        // them lazily. Stored on _autoFormObserver for cleanup teardown.
        let _autoFormObserver = null;
        if (options.observe && typeof MutationObserver !== 'undefined') {
            _autoFormObserver = new MutationObserver((mutations) => {
                // FIX (C2): always dispose auto-forms whose nodes were removed,
                // across every mutation record (done in its own pass so the
                // added-node early-exit below can't skip removals).
                for (const m of mutations) {
                    for (const node of m.removedNodes) cleanupRemovedNode(node);
                }
                let touched = false;
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (node.matches && node.matches('[data-hx-form]')) { touched = true; break; }
                        if (node.querySelector && node.querySelector('[data-hx-form]')) { touched = true; break; }
                    }
                    if (touched) break;
                }
                if (touched) scheduleScan();
            });
            _autoFormObserver.observe(document.body, { childList: true, subtree: true });
        }

        // =====================================================================
        // 19. UTILS
        // =====================================================================

        // check — one-off field validation, no reactive state
        // FIX (v2.1.1): the dummy now carries a _runAbort slot and clears it
        // after completion so the per-run AbortController can't leak.
        // FEAT (M8): pass { tagged: true } to receive the structured tagged
        // entries ({ message, source, rule, index? }) instead of bare strings,
        // so callers can tell which rule failed. Default stays Promise<string[]>.
        function check(value, ruleDefs, opts2) {
            const wantTagged = !!(opts2 && opts2.tagged);
            const dummy = { _runId: null, _runAbort: null };
            return runRules(dummy, normalizeRules(ruleDefs), value)
                .then(r => {
                    if (dummy._runAbort) { try { dummy._runAbort.abort(); } catch (_) {} dummy._runAbort = null; }
                    if (!r) return [];
                    return wantTagged ? r.tagged : r.errors;
                });
        }

        // getForm — retrieve auto-bound or directive-bound Form by DOM element/selector
        function getForm(selectorOrEl) {
            const el = typeof selectorOrEl === 'string'
                ? document.querySelector(selectorOrEl)
                : selectorOrEl;
            if (!el) return null;
            return formContextMap.get(el) || autoForms.get(el) || null;
        }

        // =====================================================================
        // 20. $validation API
        // =====================================================================
        const $validation = {
            // Core factories
            field,
            form,
            list,

            // Rule registry
            rules,

            // Helpers
            helpers,
            withMessage,
            withAsync,
            requiredIf,
            requiredUnless,
            or,
            and,
            not,
            each,
            i18n,

            // Utils
            check,
            getForm,

            // Meta
            config,
            version: '2.1.5',
        };

        // =====================================================================
        // 21. NAMESPACE  (mirrors notify plugin exactly)
        // =====================================================================
        app.namespace('validate', {
            $validation,

            // Factories
            field,
            form,
            list,

            // Rule registry
            rules,

            // Helpers
            helpers,
            withMessage,
            withAsync,
            requiredIf,
            requiredUnless,
            or,
            and,
            not,
            each,
            i18n,

            // Utils
            check,
            getForm,

            // Meta
            config,
            version: '2.1.5',
        });

        // Flat access — Helix.use() sets app = Helix → Helix.$validation
        app.$validation = $validation;
        app[INSTALL_MARK] = true;

        // Provide for inject()
        if (app.provide) app.provide('$validate', $validation);

        // =====================================================================
        // 22. CLEANUP
        // =====================================================================
        return () => {
            Array.from(allCleanups).forEach(fn => fn());
            allCleanups.clear();

            allEffects.forEach(e => { if (e && e.stop) e.stop(); });
            allEffects.clear();

            // FIX (v2.1.1): disconnect the auto-form observer and cancel any
            // pending scheduled scan so neither leaks past teardown.
            if (_autoFormObserver) { _autoFormObserver.disconnect(); _autoFormObserver = null; }
            if (_scanScheduled && _scanHandle != null) { _caf(_scanHandle); _scanScheduled = false; _scanHandle = null; }

            autoForms.clear();
            autoFormCleanups.clear();
            boundFieldEls.clear();

            if (app.removeDirective) {
                app.removeDirective('validate');
                app.removeDirective('form');
                app.removeDirective('list');
            }
            if (app.removeNamespace) app.removeNamespace('validate');
            if (app.$validation === $validation) delete app.$validation;
            delete app[INSTALL_MARK];
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelixValidatePlugin;
}