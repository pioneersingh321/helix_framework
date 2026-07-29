import { getCurrentContext } from '../core/context.js';
import { normalizeRules } from '../core/parser.js';
import { runRules, buildValidationContext } from '../core/runner.js';
import { createEventEmitter } from '../shared/events.js';
import { createRuleRegistry, createLookupRegistry, runMiddleware } from '../shared/utils.js';
import { STATUS, EVENTS } from '../constants.js';

export function list(initialItems, validators, opts, localContext) {
    let _l;
    let options = opts || {};
    let ctx;
    if (localContext) {
        ctx = localContext;
    } else if (options && options._context) {
        ctx = options;
        options = {};
    } else {
        ctx = getCurrentContext();
    }
    const app = ctx.app;
    const config = ctx.config;
    const _id    = ctx.uid();
    const initial = Array.isArray(initialItems) ? initialItems.slice() : [];
    const items  = app.ref(initial);
    const length = app.computed(() => items.value.length);

    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];

    if (options.beforeValidation) _beforeValidation.push(options.beforeValidation);
    if (options.afterValidation) _afterValidation.push(options.afterValidation);
    if (options.onSuccess) _onSuccess.push(options.onSuccess);
    if (options.onFailure) _onFailure.push(options.onFailure);

    const errors  = app.ref([]);
    const _tagged = app.ref([]);
    const disabled = app.ref(false);
    const enabled = app.computed(() => !disabled.value);

    const valid   = app.computed(() =>
        items.value.every(c => c.valid.value) && errors.value.length === 0
    );
    const invalid = app.computed(() => !valid.value);
    const pending = app.computed(() => items.value.some(c => c.pending.value));
    const $valid  = app.computed(() =>
        items.value.every(c => c.$valid.value) && errors.value.length === 0
    );
    const status = app.computed(() => {
        if (disabled.value) return STATUS.DISABLED;
        if (pending.value) return STATUS.PENDING;
        if (invalid.value) return STATUS.INVALID;
        return STATUS.VALID;
    });

    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;

    let _validatorDefs = Array.isArray(validators) ? validators.slice() : (validators ? [validators] : []);

    let _resolvedValidatorsCached = null;

    const getResolvedValidators = () => {
        if (!_resolvedValidatorsCached) {
            _resolvedValidatorsCached = normalizeRules(_validatorDefs, createLookupRegistry(_l, ctx));
        }
        return _resolvedValidatorsCached;
    };

    const at     = (i)    => items.value[i] || null;
    const push   = (c)    => { c._parent = _l; items.value = items.value.concat(c); };
    const insert = (i, c) => { c._parent = _l; const a = items.value.slice(); a.splice(i, 0, c); items.value = a; };
    const remove = (i)    => {
        const removed = items.value[i];
        if (removed && removed._destroy) removed._destroy();
        const a = items.value.slice(); a.splice(i, 1); items.value = a;
    };
    const removeAt = remove;
    const clear  = ()     => {
        items.value.forEach(c => { if (c && c._destroy) c._destroy(); });
        items.value = [];
    };
    
    const setControl = (i, c) => { c._parent = _l; const a = items.value.slice(); a[i] = c; items.value = a; };
    
    const setValue = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((val, i) => {
            const c = items.value[i];
            if (c && c.set) c.set(val, { silent: true });
        });
    };

    const set = (first, second) => {
        if (typeof first === 'number') {
            setControl(first, second);
        } else {
            setValue(first);
        }
    };

    const patchValue = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((val, i) => {
            const c = items.value[i];
            if (c && c.patch) c.patch(val);
            else if (c && c.set) c.set(val, { silent: true });
        });
    };

    const patch = patchValue;

    const disable = () => {
        disabled.value = true;
        items.value.forEach(c => { if (c.disable) c.disable(); });
    };
    const enable = () => {
        disabled.value = false;
        items.value.forEach(c => { if (c.enable) c.enable(); });
    };

    const markDirty = () => {
        items.value.forEach(c => { if (c.markDirty) c.markDirty(); });
    };
    const markPristine = () => {
        items.value.forEach(c => { if (c.markPristine) c.markPristine(); });
    };
    const untouch = () => {
        items.value.forEach(c => { if (c.untouch) c.untouch(); });
    };

    const values    = () => items.value.filter(c => !(c.disabled && c.disabled.value)).map(c => c._type === 'form' || c._type === 'list' ? c.values() : c.value.value);
    const rawValues = () => items.value.filter(c => !(c.disabled && c.disabled.value)).map(c => c._type === 'form' || c._type === 'list' ? c.rawValues() : c.value.value);

    const touchAll = () => {
        items.value.forEach(c => {
            if (c.touchAll) c.touchAll();
            else if (c.touch) c.touch({ self: true });
        });
    };

    const validate = (opts2) => {
        opts2 = opts2 || {};
        const isSilent = opts2.silent;

        const validationCtx = buildValidationContext(_l, opts2);
        const currentVals = values();

        return runMiddleware(_beforeValidation, currentVals, validationCtx)
            .then(() => {
                return Promise.all(items.value.map(c => c.validate ? c.validate(opts2) : Promise.resolve(true)));
            })
            .then(itemsOK => {
                const allItemsValid = itemsOK.every(Boolean);
                const resolvedVals = getResolvedValidators();
                if (!resolvedVals.length) {
                    if (!isSilent) {
                        errors.value  = [];
                        _tagged.value = [];
                    }
                    return allItemsValid;
                }
                return runRules(_l, resolvedVals, values(), opts2).then(result => {
                    if (!result) return allItemsValid;
                    const listTagged = result.tagged.map(t => ({ ...t, source: 'list' }));
                    if (!isSilent) {
                        _tagged.value = listTagged;
                        errors.value  = listTagged.map(t => t.message);
                    }
                    return allItemsValid && (isSilent ? listTagged.length === 0 : errors.value.length === 0);
                });
            })
            .then(finalValid => {
                const finalErrors = errors.value;
                return runMiddleware(_afterValidation, finalValid, finalErrors, validationCtx)
                    .then(() => {
                        if (finalValid) {
                            return runMiddleware(_onSuccess, values(), validationCtx).then(() => true);
                        } else {
                            return runMiddleware(_onFailure, finalErrors, validationCtx).then(() => false);
                        }
                    });
            });
    };

    const setValidators = (v) => {
        _validatorDefs = Array.isArray(v) ? v.slice() : (v ? [v] : []);
        _resolvedValidatorsCached = null;
    };
    const clearErrors   = ()  => { errors.value = []; _tagged.value = []; };

    const reset = (vals) => {
        vals = vals || [];
        items.value.forEach((c, i) => { if (c.reset) c.reset(vals[i]); });
        errors.value  = [];
        _tagged.value = [];
    };

    const emitter = createEventEmitter();

    const stopStatusWatch = app.watch(status, (newStatus) => {
        emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });

    const _destroy = () => {
        if (_l._runAbort) { try { _l._runAbort.abort(); } catch (_) {} _l._runAbort = null; }
        items.value.forEach(c => { if (c && c._destroy) c._destroy(); });
        stopStatusWatch();
        emitter.listeners.length = 0;
    };

    _l = {
        _id, _type: 'list', _parent: null, _context: ctx,
        _runId: null, _runAbort: null,
        _tagged,
        items, length, errors,
        valid, invalid, pending, status, $valid,
        disabled, enabled,
        at, push, insert, remove, removeAt, clear, set, setControl, setValue, patch, patchValue,
        disable, enable,
        markDirty, markPristine, untouch,
        values, rawValues,
        touchAll, validate, reset,
        setValidators, clearErrors,
        on: emitter.on,
        rules: localRules,
        _localRules,
        _destroy,

        beforeValidation(fn) {
            if (typeof fn === 'function' && !_beforeValidation.includes(fn)) _beforeValidation.push(fn);
            return _l;
        },
        afterValidation(fn) {
            if (typeof fn === 'function' && !_afterValidation.includes(fn)) _afterValidation.push(fn);
            return _l;
        },
        onSuccess(fn) {
            if (typeof fn === 'function' && !_onSuccess.includes(fn)) _onSuccess.push(fn);
            return _l;
        },
        onFailure(fn) {
            if (typeof fn === 'function' && !_onFailure.includes(fn)) _onFailure.push(fn);
            return _l;
        },
    };
    initial.forEach(c => { if (c) c._parent = _l; });
    return _l;
}
