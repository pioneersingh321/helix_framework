import { getCurrentContext } from '../core/context.js';
import { runRules, buildValidationContext } from '../core/runner.js';
import { normalizeRules } from '../core/parser.js';
import { createEventEmitter } from '../shared/events.js';
import { isEmpty, createRuleRegistry, createLookupRegistry, runMiddleware } from '../shared/utils.js';
import { STATUS, EVENTS } from '../constants.js';

export function field(initialValue, ruleDefs, opts, localContext) {
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};

    const _id       = ctx.uid();
    const value     = app.isRef(initialValue) ? initialValue : app.ref(initialValue !== undefined ? initialValue : '');
    const dirty     = app.ref(false);
    const touched   = app.ref(false);
    const pending   = app.ref(false);
    const disabled  = app.ref(false);

    const _ruleErrors   = app.ref([]);
    const _remoteErrors = app.ref([]);
    const _serverErrors = app.ref([]);
    const _crossErrors  = app.ref([]);

    const _tagged = app.computed(() => [
        ..._ruleErrors.value,
        ..._remoteErrors.value,
        ..._serverErrors.value,
        ..._crossErrors.value,
    ]);
    const errors  = app.computed(() => {
        const msgs = _tagged.value.map(t => t.message);
        const currentMode = _f.mode || config.mode;
        if (currentMode === 'firstError') {
            return msgs.slice(0, 1);
        }
        if (currentMode === 'allErrors') {
            return msgs;
        }
        return config.showAllErrors ? msgs : msgs.slice(0, 1);
    });

    const valid     = app.computed(() => errors.value.length === 0 && !pending.value);
    const invalid   = app.computed(() => !valid.value);
    const pristine  = app.computed(() => !dirty.value);

    const error       = app.computed(() => errors.value[0] || null);
    const firstError  = error;
    const hasError    = invalid;
    const errorCount  = app.computed(() => errors.value.length);
    const isValidating = pending;
    const enabled   = app.computed(() => !disabled.value);
    const status    = app.computed(() => {
        if (disabled.value)          return STATUS.DISABLED;
        if (pending.value)           return STATUS.PENDING;
        if (errors.value.length > 0) return STATUS.INVALID;
        return STATUS.VALID;
    });

    const $errors = app.computed(() => (dirty.value || touched.value) ? errors.value : []);
    const $valid  = app.computed(() => errors.value.length === 0);

    const emitter = createEventEmitter();
    const _stoppers     = [];

    if (opts.onBeforeValidate) emitter.on('beforeValidate', opts.onBeforeValidate);
    if (opts.onAfterValidate) emitter.on('afterValidate', opts.onAfterValidate);
    if (opts.onBeforeRemote) emitter.on('beforeRemote', opts.onBeforeRemote);
    if (opts.onAfterRemote) emitter.on('afterRemote', opts.onAfterRemote);

    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];

    if (opts.beforeValidation) _beforeValidation.push(opts.beforeValidation);
    if (opts.afterValidation) _afterValidation.push(opts.afterValidation);
    if (opts.onSuccess) _onSuccess.push(opts.onSuccess);
    if (opts.onFailure) _onFailure.push(opts.onFailure);

    const stopDirty = app.watch(value, () => {
        if (!dirty.value) { dirty.value = true; emitter.emit({ type: EVENTS.DIRTY }); }
        emitter.emit({ type: EVENTS.CHANGE, value: value.value });
    }, { immediate: false });
    _stoppers.push(stopDirty);

    if (opts.autoDirty) {
        const stopAuto = app.watch(value, () => { dirty.value = true; }, { immediate: false });
        _stoppers.push(stopAuto);
    }

    const set = (val, opts2) => {
        value.value = val;
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
        if (_f._serverWatcherStop) { _f._serverWatcherStop(); _f._serverWatcherStop = null; }
        emitter.emit({ type: 'reset' });
    };

    const touch   = (opts2) => {
        touched.value = true;
        emitter.emit({ type: 'touch' });
        if (!(opts2 && opts2.self) && _f._parent && _f._parent.touch) _f._parent.touch({ self: true });
    };
    const untouch = () => { touched.value = false; };

    const markDirty = () => {
        dirty.value = true;
        emitter.emit({ type: 'dirty' });
    };
    const markPristine = () => {
        dirty.value = false;
    };

    const enable  = () => { disabled.value = false; };
    const disable = () => { disabled.value = true; };

    const setErrors = (msgs) => {
        const arr = Array.isArray(msgs) ? msgs : (msgs ? [msgs] : []);
        _serverErrors.value = arr.map(m => ({ message: m, source: 'server', rule: null }));
        emitter.emit({ type: 'error' });
    };
    const clearErrors = () => {
        _ruleErrors.value   = [];
        _remoteErrors.value = [];
        _serverErrors.value = [];
        _crossErrors.value  = [];
    };

    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;

    let _ruleDefs = Array.isArray(ruleDefs) ? ruleDefs.slice() : (ruleDefs ? [ruleDefs] : []);

    let _resolvedRulesCached = null;

    const getResolvedRules = () => {
        if (!_resolvedRulesCached) {
            _resolvedRulesCached = normalizeRules(_ruleDefs, createLookupRegistry(_f, ctx));
        }
        return _resolvedRulesCached;
    };

    const setRules   = (r) => {
        _ruleDefs = Array.isArray(r) ? r.slice() : (r ? [r] : []);
        _resolvedRulesCached = null;
    };
    const addRule    = (r) => {
        if (Array.isArray(r)) {
            _ruleDefs = _ruleDefs.concat(r);
        } else if (r) {
            _ruleDefs.push(r);
        }
        _resolvedRulesCached = null;
    };
    const removeRule = (r) => {
        _ruleDefs = _ruleDefs.filter(item => {
            if (typeof r === 'string') {
                if (typeof item === 'string') {
                    const itemClean = item.split('|').map(s => s.split(':')[0].trim()).join('');
                    return itemClean !== r;
                }
                const name = item.meta?.name || item._ruleName;
                return name !== r;
            }
            return item !== r;
        });
        _resolvedRulesCached = null;
    };
    const hasRule    = (r) => getResolvedRules().some(fn => typeof r === 'string' ? (fn.meta?.name === r || fn._ruleName === r) : fn === r);

    const setValidators = setRules;
    const clearValidators = () => setRules([]);

    const getRules = () => {
        return getResolvedRules().map(fn => ({
            name: fn.meta?.name || fn._ruleName || 'anonymous',
            priority: fn.meta?.priority !== undefined ? fn.meta.priority : (fn._priority || 1),
            params: fn.meta?.params || fn._params || {}
        }));
    };

    const validate = (opts2) => {
        opts2 = opts2 || {};
        const isSilent = opts2.silent;
        if (disabled.value) return Promise.resolve(true);
        if (opts.lazy && !touched.value && !dirty.value && !isSilent) return Promise.resolve(true);

        if (!isSilent) emitter.emit(EVENTS.BEFORE_VALIDATE);

        pending.value = true;

        const validationCtx = buildValidationContext(_f, Object.assign({ signal: _f._runAbort ? _f._runAbort.signal : undefined }, opts2));
        const initialVal = value.value;

        return runMiddleware(_beforeValidation, initialVal, validationCtx)
            .then(() => {
                return runRules(_f, getResolvedRules(), value.value, opts2);
            })
            .then(result => {
                if (result === null) {
                    return !invalid.value; // stale
                }
                const isValid = result.tagged.length === 0;
                if (!isSilent) {
                    _ruleErrors.value = result.tagged;
                    emitter.emit({ type: EVENTS.VALIDATED, valid: isValid });
                    emitter.emit(EVENTS.AFTER_VALIDATE, { valid: isValid, errors: errors.value });
                }

                const finalErrors = isSilent ? [] : errors.value;
                return runMiddleware(_afterValidation, isValid, finalErrors, validationCtx)
                    .then(() => {
                        if (isValid) {
                            return runMiddleware(_onSuccess, value.value, validationCtx).then(() => true);
                        } else {
                            return runMiddleware(_onFailure, finalErrors, validationCtx).then(() => false);
                        }
                    });
            })
            .finally(() => {
                pending.value = false;
            });
    };

    const _destroy = () => {
        if (_f._serverWatcherStop) { _f._serverWatcherStop(); _f._serverWatcherStop = null; }
        if (_f._depWatcherStop)    { _f._depWatcherStop(); _f._depWatcherStop = null; }
        if (_f._runAbort)          { try { _f._runAbort.abort(); } catch (_) {} _f._runAbort = null; }
        _stoppers.forEach(s => s && s());
        _stoppers.length = 0;
        emitter.listeners.length = 0;
    };

    const addGroup = (groupName) => {
        if (!_f._group) {
            _f._group = [groupName];
        } else if (Array.isArray(_f._group)) {
            if (!_f._group.includes(groupName)) _f._group.push(groupName);
        } else {
            if (_f._group !== groupName) _f._group = [_f._group, groupName];
        }
    };

    const removeGroup = (groupName) => {
        if (!_f._group) return;
        if (Array.isArray(_f._group)) {
            _f._group = _f._group.filter(g => g !== groupName);
            if (_f._group.length === 0) _f._group = null;
        } else {
            if (_f._group === groupName) _f._group = null;
        }
    };

    const hasGroup = (groupName) => {
        if (!_f._group) return false;
        if (Array.isArray(_f._group)) return _f._group.includes(groupName);
        return _f._group === groupName;
    };

    const stopStatusWatch = app.watch(status, (newStatus) => {
        emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });
    _stoppers.push(stopStatusWatch);

    const _f = {
        _id, _type: 'field', _parent: null, _context: ctx,
        _runId: null,
        _runAbort: null,
        _serverWatcherStop: null,
        _depWatcherStop: null,
        _emit: emitter.emit,

        _ruleErrors, _remoteErrors, _serverErrors, _crossErrors,
        _tagged,

        _autoDirty: opts.autoDirty || false,
        _lazy:      opts.lazy      || false,
        _group:     opts.group     || null,
        _dependsOn: Array.isArray(opts.dependsOn) ? opts.dependsOn : (opts.dependsOn ? [opts.dependsOn] : []),

        get _rules() { return getResolvedRules(); },
        rules: localRules,
        _localRules,

        name:       opts.name || null,
        updateOn:   opts.updateOn || opts.trigger || config.trigger,
        mode:       opts.mode || null,
        beforeRule: opts.beforeRule || null,
        afterRule:  opts.afterRule || null,
        message:    opts.message || null,

        value, errors, dirty, touched, pending, disabled,
        valid, invalid, pristine, enabled, status,
        $errors, $valid,
        error, firstError, hasError, errorCount, isValidating,

        on: emitter.on,
        set, reset,
        touch, untouch,
        enable, disable,
        setErrors, clearErrors,
        setRules, addRule, removeRule, hasRule,
        setValidators, clearValidators,
        markDirty, markPristine,
        addGroup, removeGroup, hasGroup,
        getRules,
        validate,
        _destroy,

        pipe(rule) {
            addRule(rule);
            return _f;
        },
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

    return _f;
}
