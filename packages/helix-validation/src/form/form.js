import { getCurrentContext } from '../core/context.js';
import { normalizeRules } from '../core/parser.js';
import { field } from './field.js';
import { createEventEmitter } from '../shared/events.js';
import { createRuleRegistry, walkLeafFields, createLookupRegistry, parsePath, resolvePath, runMiddleware } from '../shared/utils.js';
import { buildValidationContext } from '../core/runner.js';
import { STATUS, EVENTS } from '../constants.js';
import { getActiveUIDriver } from '../shared/ui.js';

export function form(fieldDefs, opts, localContext) {
    let _f;
    let _el = null;
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};

    const isPlainObject = (val) => {
        if (!val || typeof val !== 'object') return false;
        if (app && typeof app.isRef === 'function' && app.isRef(val)) return false;
        const proto = Object.getPrototypeOf(val);
        return proto === Object.prototype || proto === null;
    };

    const _id       = ctx.uid();
    const submitting = app.ref(false);
    const submitted  = app.ref(false);
    const submitAttempted = app.ref(false);
    const error      = app.ref(null);
    const hasError   = app.computed(() => !!error.value);
    const disabled   = app.ref(false);
    const enabled    = app.computed(() => !disabled.value);

    const _fieldsVersion = app.ref(0);

    const valid   = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).every(c => c.valid.value); });
    const invalid = app.computed(() => !valid.value);
    const dirty   = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.dirty.value); });
    const touched = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.touched.value); });
    const pending = app.computed(() => { void _fieldsVersion.value; return Object.values(_fields).some(c => c.pending.value); });
    const isValidating = pending;
    const status  = app.computed(() => {
        if (disabled.value) return STATUS.DISABLED;
        if (pending.value) return STATUS.PENDING;
        if (invalid.value) return STATUS.INVALID;
        return STATUS.VALID;
    });

    const $valid = app.computed(() => {
        void _fieldsVersion.value;
        return Object.values(_fields).every(c => c.$valid.value);
    });

    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;

    let _crossValidatorDefs = Array.isArray(opts.validators) ? opts.validators.slice() : (opts.validators ? [opts.validators] : []);

    let _resolvedCrossValidatorsCached = null;

    const getResolvedCrossValidators = () => {
        if (!_resolvedCrossValidatorsCached) {
            _resolvedCrossValidatorsCached = normalizeRules(_crossValidatorDefs, createLookupRegistry(_f, ctx));
        }
        return _resolvedCrossValidatorsCached;
    };

    const _fields = {};
    const _stoppers = [];

    function _registerField(name, ctrl) {
        if (_fields[name] && _fields[name] !== ctrl) {
            console.warn(`[Helix Validation] form: field "${name}" already exists — overwriting.`);
            const prev = _fields[name];
            if (prev._crossWatcherStop) { prev._crossWatcherStop(); prev._crossWatcherStop = null; }
            if (prev._depWatcherStop) { prev._depWatcherStop(); prev._depWatcherStop = null; }
            if (typeof prev._destroy === 'function') prev._destroy();
            prev._parent = null;
        }
        ctrl.name    = name;
        ctrl._parent = _f;
        _fields[name] = ctrl;
        _fieldsVersion.value++;

        if (ctrl._crossErrors && ctrl.value && app.watch) {
            if (ctrl._crossWatcherStop) ctrl._crossWatcherStop();
            const stop = app.watch(ctrl.value, () => {
                if (ctrl._crossErrors.value.length) ctrl._crossErrors.value = [];
            }, { immediate: false });
            ctrl._crossWatcherStop = stop;
        }

        if (_f) _setupDependencyWatcher(ctrl);
    }

    function _setupDependencyWatcher(ctrl) {
        if (ctrl._dependsOn && ctrl._dependsOn.length && app.watch) {
            if (ctrl._depWatcherStop) { ctrl._depWatcherStop(); ctrl._depWatcherStop = null; }
            const stopDep = app.watch(
                () => ctrl._dependsOn.map(dep => {
                    const depCtrl = typeof dep === 'string' ? getField(dep) : dep;
                    return depCtrl ? depCtrl.value.value : undefined;
                }),
                () => {
                    if (ctrl.validate) ctrl.validate();
                },
                { deep: true, immediate: false }
            );
            ctrl._depWatcherStop = stopDep;
        }
    }

    Object.keys(fieldDefs || {}).forEach(name => {
        const def = fieldDefs[name];
        if (def === undefined) return;
        let ctrl;
        if (def && (def._type === 'field' || def._type === 'form' || def._type === 'list')) {
            ctrl = def;
        } else if (Array.isArray(def)) {
            const [val, r, o] = def;
            ctrl = field(val, r, Object.assign({ name }, o || {}), ctx);
        } else if (isPlainObject(def)) {
            ctrl = form(def, {}, ctx);
        } else {
            ctrl = field(def, [], {}, ctx);
        }
        _registerField(name, ctrl);
    });

    const getField = (path) => resolvePath(_f, path);

    const syncDOMValues = () => {
        if (!_el) return;
        _el.querySelectorAll('[name]').forEach(input => {
            const name = input.getAttribute('name');
            const c = _fields[name];
            if (c) {
                let domVal;
                if (input.type === 'checkbox') {
                    domVal = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) {
                        domVal = input.value;
                    } else {
                        return;
                    }
                } else if (input.isContentEditable) {
                    domVal = input.textContent || '';
                } else {
                    domVal = input.value || '';
                }
                if (c.value.value !== domVal) {
                    c.value.value = domVal;
                }
            }
        });
    };

    const values = () => {
        syncDOMValues();
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
        syncDOMValues();
        const out = {};
        Object.keys(_fields).forEach(k => {
            const c = _fields[k];
            if (c.disabled && c.disabled.value) return;
            out[k] = c._type === 'form' ? c.rawValues()
                   : c._type === 'list' ? c.rawValues()
                   : c.value.value;
        });
        return out;
    };

    const set = (path, val) => {
        const c = getField(path);
        if (c) { c.set(val, { silent: true }); return; }

        if (!config.autoCreatePath && !opts.autoCreatePath) {
            console.warn(`[Helix Validation] form.set: path "${path}" not found.`);
            return;
        }

        const parts = parsePath(path);
        let cur = _f;
        for (let i = 0; i < parts.length - 1; i++) {
            const seg = parts[i];
            if (cur._type !== 'form') {
                console.warn(`[Helix Validation] form.set: can't auto-create through non-form at "${seg}".`);
                return;
            }
            if (!cur.fields[seg]) cur.add(seg, form({}, {}, ctx));
            cur = cur.fields[seg];
        }
        if (cur._type === 'form') {
            const leaf = parts[parts.length - 1];
            cur.add(leaf, field(val, [], {}, ctx));
        }
    };

    const patch = (obj) => {
        const deepPatch = (targetForm, data) => {
            Object.keys(data).forEach(k => {
                const val = data[k];
                let c = targetForm.fields[k];
                if (!c) {
                    if (config.autoCreatePath || opts.autoCreatePath) {
                        if (val && typeof val === 'object' && !Array.isArray(val)) {
                            c = form({}, {}, ctx);
                            targetForm.add(k, c);
                        } else {
                            c = field(undefined, [], {}, ctx);
                            targetForm.add(k, c);
                        }
                    } else {
                        return;
                    }
                }
                
                if (c._type === 'form' && val && typeof val === 'object' && !Array.isArray(val)) {
                    deepPatch(c, val);
                } else if (c.set) {
                    c.set(val, { silent: true });
                }
            });
        };
        deepPatch(_f, obj);
    };

    const reset = (obj) => {
        obj = obj || {};
        Object.keys(_fields).forEach(k => {
            if (_fields[k].reset) _fields[k].reset(obj[k]);
        });
        submitted.value = false;
        submitAttempted.value = false;
        error.value     = null;
        if (opts.serverErrors) opts.serverErrors.value = {};

        const uiDriver = getActiveUIDriver(ctx);
        if (uiDriver && uiDriver.onFormReset && _el) {
            uiDriver.onFormReset(_el, ctx);
        }

        emitter.emit({ type: EVENTS.RESET });
    };

    const touch    = (opts2) => { if (!(opts2 && opts2.self)) touchAll(); };
    const touchAll = () => {
        Object.values(_fields).forEach(c => {
            if (c.touchAll)     c.touchAll();
            else if (c.touch)   c.touch({ self: true });
        });
    };

    const add    = (name, ctrl) => { _registerField(name, ctrl); };
    const remove = (name) => {
        if (!_fields[name]) return;
        const c = _fields[name];
        if (c._crossWatcherStop) { c._crossWatcherStop(); c._crossWatcherStop = null; }
        if (c._depWatcherStop) { c._depWatcherStop(); c._depWatcherStop = null; }
        if (typeof c._destroy === 'function') c._destroy();
        c._parent = null;
        delete _fields[name];
        _fieldsVersion.value++;
    };
    const has    = (name) => !!_fields[name];

    const setErrors = (errMap) => {
        Object.keys(errMap || {}).forEach(k => {
            const c = getField(k);
            if (c) c.setErrors(Array.isArray(errMap[k]) ? errMap[k] : [errMap[k]]);
        });
    };

    const setError   = (msg) => { error.value = msg; };
    const clearError = ()    => { error.value = null; };

    const get = (path) => {
        const c = getField(path);
        return c ? (c._type === 'form' || c._type === 'list' ? c.values() : c.value.value) : undefined;
    };

    const exists = (path) => {
        return getField(path) !== null;
    };

    const removeAtPath = (path) => {
        const parts = parsePath(path);
        if (parts.length === 1) {
            remove(parts[0]);
            return;
        }
        let cur = _f;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur) return;
            if (cur._type === 'form') cur = cur.fields[parts[i]];
            else if (cur._type === 'list') cur = cur.items.value[Number(parts[i])];
            else return;
        }
        const leaf = parts[parts.length - 1];
        if (cur && cur.remove) cur.remove(leaf);
    };

    const validate = (opts2) => {
        syncDOMValues();
        opts2 = opts2 || {};
        const group = opts2.group;
        const fieldsToValidate = Array.isArray(opts2) ? opts2 : opts2.fields;
        let   ctrls = Object.values(_fields);

        const isSilent = opts2.silent;
        if (!isSilent) emitter.emit(EVENTS.BEFORE_VALIDATE);

        const validationCtx = buildValidationContext(_f, opts2);
        const currentVals = values();

        return runMiddleware(_beforeValidation, currentVals, validationCtx)
            .then(() => {
                if (fieldsToValidate) {
                    ctrls = ctrls.filter(c => fieldsToValidate.includes(c.name) || fieldsToValidate.some(p => c.name && (c.name === p || c.name.startsWith(p + '.'))));
                } else if (group) {
                    const groups = Array.isArray(group) ? group : [group];
                    ctrls = ctrls.filter(c => {
                        if (!c._group) return false;
                        const fieldGroups = Array.isArray(c._group) ? c._group : [c._group];
                        return fieldGroups.some(g => groups.includes(g));
                    });
                }

                if (opts2.touch) {
                    ctrls.forEach(c => { if (c.touch) c.touch({ self: true }); });
                }

                if (!group && !fieldsToValidate && !isSilent) {
                    Object.values(_fields).forEach(c => {
                        if (c._crossErrors) c._crossErrors.value = [];
                    });
                }

                let checkFields;
                if (opts2.stopOnFirst) {
                    let chain = Promise.resolve(true);
                    ctrls.forEach(c => {
                        chain = chain.then(passing => {
                            if (!passing) return false;
                            return c.validate ? c.validate(opts2) : Promise.resolve(true);
                        });
                    });
                    checkFields = chain;
                } else {
                    checkFields = Promise.all(ctrls.map(c => c.validate ? c.validate(opts2) : Promise.resolve(true)))
                        .then(results => results.every(Boolean));
                }

                return checkFields;
            })
            .then(allValid => {
                if (opts2.stopOnFirst && !allValid) {
                    if (!isSilent) emitter.emit(EVENTS.AFTER_VALIDATE, { valid: false });
                    return false;
                }

                let checkCross;
                const resolvedCross = getResolvedCrossValidators();
                if (group || !resolvedCross.length) {
                    checkCross = Promise.resolve(allValid);
                } else {
                    const vals = values();
                    checkCross = resolvedCross.reduce((chain, xv) =>
                        chain.then(passing => {
                            if (!passing) return false;
                            return Promise.resolve(xv(vals, _f, validationCtx)).then(errs => {
                                if (!errs) return true;
                                if (isSilent) return false;

                                Object.keys(errs).forEach(k => {
                                    const c = getField(k);
                                    if (!c || !c._crossErrors) return;
                                    const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];
                                    const newErrs = arr.map(m => ({ message: m, source: 'cross', rule: null }));
                                    const existing = c._crossErrors.value || [];
                                    const combined = existing.concat(newErrs);
                                    const unique = [];
                                    const seenMsgs = new Set();
                                    combined.forEach(err => {
                                        if (err && err.message && !seenMsgs.has(err.message)) {
                                            seenMsgs.add(err.message);
                                            unique.push(err);
                                        }
                                    });
                                    c._crossErrors.value = unique;
                                });
                                return false;
                            });
                        }),
                        Promise.resolve(allValid)
                    );
                }

                return checkCross.then(finalValid => {
                    if (opts.schema && !group && !fieldsToValidate) {
                        return Promise.resolve(opts.schema(values())).then(schemaRes => {
                            if (!schemaRes.valid) {
                                if (!isSilent) {
                                    Object.keys(schemaRes.errors).forEach(path => {
                                        const c = getField(path);
                                        if (c) c.setErrors(schemaRes.errors[path]);
                                    });
                                }
                                emitter.emit(EVENTS.AFTER_VALIDATE, { valid: false });
                                return false;
                            }
                            if (!isSilent) emitter.emit(EVENTS.AFTER_VALIDATE, { valid: finalValid });
                            return finalValid;
                        });
                    }
                    if (!isSilent) emitter.emit(EVENTS.AFTER_VALIDATE, { valid: finalValid });
                    return finalValid;
                });
            })
            .then(finalValid => {
                const uiDriver = getActiveUIDriver(ctx);
                if (uiDriver && uiDriver.onFormValidate && _el) {
                    uiDriver.onFormValidate(_el, finalValid, ctx);
                }

                if (!finalValid) {
                    focusFirstInvalid(opts2);
                }

                const finalErrors = getErrors();
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

    const getFocusOptions = (opts2) => {
        const localVal = opts2.focusFirstInvalid;
        const formVal = opts.focusFirstInvalid;
        const globalVal = config.focusFirstInvalid;
        
        let val = localVal !== undefined ? localVal
                : formVal !== undefined ? formVal
                : globalVal;
                
        if (!val) return { enabled: false };
        if (typeof val === 'boolean') {
            return {
                enabled: val,
                scroll: true,
                behavior: 'smooth',
                block: 'center',
                select: true
            };
        }
        return Object.assign({
            enabled: true,
            scroll: true,
            behavior: 'smooth',
            block: 'center',
            select: true
        }, val);
    };

    const focusFirstInvalid = (runOpts) => {
        runOpts = runOpts || {};
        const fOpts = getFocusOptions(runOpts);
        if (!fOpts.enabled || !_el) return false;

        const invalidCtrls = Object.values(_fields).filter(c => c.invalid && c.invalid.value);
        if (!invalidCtrls.length) return false;

        const boundPairs = [];
        for (const el of ctx.boundFieldEls) {
            if (el.__hxField && invalidCtrls.includes(el.__hxField)) {
                if (_el.contains(el)) {
                    boundPairs.push({ el, ctrl: el.__hxField });
                }
            }
        }

        if (!boundPairs.length) return false;

        boundPairs.sort((a, b) => {
            const pos = a.el.compareDocumentPosition(b.el);
            if (pos & 4) return -1; // DOCUMENT_POSITION_FOLLOWING
            if (pos & 2) return 1;  // DOCUMENT_POSITION_PRECEDING
            return 0;
        });

        const canFocus = (el) => {
            return (
                el &&
                !el.disabled &&
                el.offsetParent !== null &&
                typeof el.focus === 'function'
            );
        };

        const targetPair = boundPairs.find(p => canFocus(p.el));
        if (!targetPair) return false;

        const { el, ctrl } = targetPair;

        emitter.emit('beforeFocusInvalid', { el, control: ctrl });

        const uiDriver = getActiveUIDriver(ctx);
        if (uiDriver && typeof uiDriver.focusField === 'function') {
            uiDriver.focusField(el, ctrl, fOpts, ctx);
        } else {
            if (fOpts.scroll) {
                el.scrollIntoView({
                    behavior: fOpts.behavior,
                    block: fOpts.block
                });
            }
            el.focus();
            if (fOpts.select && typeof el.select === 'function') {
                try { el.select(); } catch (e) {}
            }
        }

        emitter.emit('afterFocusInvalid', { el, control: ctrl });
        return true;
    };

    const bind = (name, bindOpts) => {
        bindOpts = bindOpts || {};
        const c = getField(name);
        if (!c) {
            console.warn(`[Helix Validation] form.bind: field "${name}" not found.`);
            return [app.ref(''), {}];
        }
        const trigger = bindOpts.trigger || c.updateOn || config.trigger;
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

    const _childChanged = () => {
        if (_f._parent && _f._parent._childChanged) _f._parent._childChanged();
    };

    const emitter = createEventEmitter();

    if (opts.onBeforeSubmit) emitter.on('beforeSubmit', opts.onBeforeSubmit);
    if (opts.onAfterSubmit) emitter.on('afterSubmit', opts.onAfterSubmit);
    if (opts.onBeforeValidate) emitter.on('beforeValidate', opts.onBeforeValidate);
    if (opts.onAfterValidate) emitter.on('afterValidate', opts.onAfterValidate);

    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];

    if (opts.beforeValidation) _beforeValidation.push(opts.beforeValidation);
    if (opts.afterValidation) _afterValidation.push(opts.afterValidation);
    if (opts.onSuccess) _onSuccess.push(opts.onSuccess);
    if (opts.onFailure) _onFailure.push(opts.onFailure);

    const submit = () => {
        submitAttempted.value = true;
        touchAll();
        emitter.emit(EVENTS.BEFORE_SUBMIT);
        emitter.emit({ type: EVENTS.SUBMIT });

        return validate().then(ok => {
            if (!ok) {
                if (opts.onInvalid) opts.onInvalid(values(), _f);
                emitter.emit({ type: EVENTS.INVALID });
                return;
            }

            submitting.value = true;
            emitter.emit({ type: EVENTS.SUBMITTING });

            const afterSubmit = opts.onSubmit
                ? Promise.resolve(opts.onSubmit(values(), _f))
                : Promise.resolve();

            return afterSubmit
                .then(() => {
                    submitted.value = true;
                    emitter.emit({ type: EVENTS.SUBMITTED });
                    emitter.emit(EVENTS.AFTER_SUBMIT, { valid: true });
                    if (opts.resetOnSubmit) reset();
                })
                .catch(err => {
                    emitter.emit({ type: EVENTS.ERROR, error: err });
                    emitter.emit(EVENTS.AFTER_SUBMIT, { valid: false, error: err });
                    throw err;
                })
                .finally(() => { submitting.value = false; });
        });
    };

    if (opts.serverErrors) {
        const stopExt = app.watch(opts.serverErrors, (errs) => {
            if (!errs) return;
            Object.keys(errs).forEach(k => {
                const c = getField(k);
                if (!c) return;

                const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];
                c._serverErrors.value = arr.map(m => ({ message: m, source: 'server', rule: null }));

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

    const disable = () => {
        disabled.value = true;
        Object.values(_fields).forEach(c => { if (c.disable) c.disable(); });
    };
    const enable = () => {
        disabled.value = false;
        Object.values(_fields).forEach(c => { if (c.enable) c.enable(); });
    };

    const setValidators = (v) => {
        _crossValidatorDefs = Array.isArray(v) ? v.slice() : (v ? [v] : []);
        _resolvedCrossValidatorsCached = null;
    };
    const clearValidators = () => {
        _crossValidatorDefs = [];
        _resolvedCrossValidatorsCached = null;
    };

    const markDirty = () => {
        Object.values(_fields).forEach(c => { if (c.markDirty) c.markDirty(); });
    };
    const markPristine = () => {
        Object.values(_fields).forEach(c => { if (c.markPristine) c.markPristine(); });
    };

    const getErrors = () => {
        const out = {};
        walkLeafFields(_fields, (path, ctrl) => {
            if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
                out[path] = ctrl.errors.value.slice();
            }
        });
        return out;
    };

    const getErrorDetails = () => {
        const out = {};
        walkLeafFields(_fields, (path, ctrl) => {
            if (ctrl._tagged && ctrl._tagged.value && ctrl._tagged.value.length) {
                out[path] = ctrl._tagged.value.map(t => ({
                    message: t.message,
                    source: t.source,
                    rule: t.rule,
                    index: t.index
                }));
            }
        });
        return out;
    };

    const getFirstErrors = () => {
        const out = {};
        walkLeafFields(_fields, (path, ctrl) => {
            if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
                out[path] = ctrl.errors.value[0];
            }
        });
        return out;
    };

    const errorCount = () => {
        let count = 0;
        walkLeafFields(_fields, (path, ctrl) => {
            if (ctrl.errors && ctrl.errors.value) {
                count += ctrl.errors.value.length;
            }
        });
        return count;
    };

    const hasErrors = () => {
        let has = false;
        walkLeafFields(_fields, (path, ctrl) => {
            if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
                has = true;
                return false;
            }
        });
        return has;
    };

    const stopStatusWatch = app.watch(status, (newStatus) => {
        emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });
    _stoppers.push(stopStatusWatch);

    const _destroy = () => {
        _stoppers.forEach(s => s && s());
        _stoppers.length = 0;
        Object.values(_fields).forEach(c => {
            if (c._crossWatcherStop) { c._crossWatcherStop(); c._crossWatcherStop = null; }
            if (c._depWatcherStop) { c._depWatcherStop(); c._depWatcherStop = null; }
            if (c._destroy) c._destroy();
        });
        emitter.listeners.length = 0;
    };

    _f = {
        _id, _type: 'form', _parent: null, _context: ctx,
        _stoppers, _emit: emitter.emit,
        _childChanged,
        get fields() { return _fields; },
        get _el() { return _el; },
        set _el(val) { _el = val; },

        valid, invalid, dirty, touched, pending, status, $valid,
        submitting, submitted, submitAttempted, error, hasError,
        disabled, enabled,
        isValidating,

        field:      getField,
        get,
        exists,
        values,     rawValues,
        toJSON:     values,
        serialize:  values,

        set,        patch,     reset,
        touch,      touchAll,
        disable,    enable,
        add,        remove: removeAtPath,    has,
        setErrors,  setError,  clearError,
        setValidators, clearValidators,
        markDirty,  markPristine,
        getErrors,  getErrorDetails, getFirstErrors,  errorCount,  hasErrors,
        validate,   validateGroup(groupName, groupOpts) { return validate(Object.assign({}, groupOpts, { group: groupName })); },
        submit,     focusFirstInvalid,
        bind,       on: emitter.on,
        rules: localRules,
        _localRules,
        _destroy,

        beforeValidation(fn) {
            if (typeof fn === 'function' && !_beforeValidation.includes(fn)) _beforeValidation.push(fn);
            return _f;
        },
        afterValidation(fn) {
            if (typeof fn === 'function' && !_afterValidation.includes(fn)) _afterValidation.push(fn);
            return _f;
        },
        onSuccess(fn) {
            if (typeof fn === 'function' && !_onSuccess.includes(fn)) _onSuccess.push(fn);
            return _f;
        },
        onFailure(fn) {
            if (typeof fn === 'function' && !_onFailure.includes(fn)) _onFailure.push(fn);
            return _f;
        },
    };

    Object.values(_fields).forEach(c => {
        if (c) {
            c._parent = _f;
            _setupDependencyWatcher(c);
        }
    });

    return _f;
}
