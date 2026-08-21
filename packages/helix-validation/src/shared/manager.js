import { 
    getCurrentContext 
} from '../core/context.js';
import { 
    required, 
    email, 
    url, 
    pattern 
} from '../rules/string.js';
import { 
    numeric, 
    integer, 
    minLength, 
    maxLength, 
    min, 
    max, 
    between 
} from '../rules/number.js';
import { 
    sameAs, 
    equalto,
    oneOf 
} from '../rules/array.js';
import { requiredIf, requiredUnless, withMessage } from '../merge.js';
import { normalizeRules } from '../core/parser.js';
import { field } from '../form/field.js';
import { form } from '../form/form.js';
import { runRemote, resolvePrefix, escapeHtml, getClassTarget } from './utils.js';
import { getActiveUIDriver } from './ui.js';

export function ensureErrSpan(el, fid, className) {
    const id   = `hx-err-${fid}`;
    const next = el.nextElementSibling;
    if (next && next.id === id) {
        if (className) next.className = className;
        return next;
    }
    const span = document.createElement('span');
    span.id = id;
    span.className = className || 'hx-error-msg';
    span.setAttribute('role', 'alert');
    span.setAttribute('aria-live', 'polite');
    el.insertAdjacentElement('afterend', span);
    return span;
}

export function renderField(el, ctrl, fid, dOpts, localContext) {
    const ctx = localContext || getCurrentContext();
    const uiDriver = getActiveUIDriver(ctx);
    uiDriver.renderField(el, ctrl, fid, dOpts, ctx);
}

export function getFormFromEl(el, localContext) {
    const ctx = localContext || getCurrentContext();
    let node = el ? el.parentElement : null;
    while (node) { if (ctx.formContextMap.has(node)) return ctx.formContextMap.get(node); node = node.parentElement; }
    return null;
}

function parseRules(lowerName, v, prefix, ruleFns, boolMap, paramMap, ctx, registry) {
    const reg = registry || ctx._registry;
    if (boolMap[lowerName]) {
        const fn = boolMap[lowerName]();
        if (fn) ruleFns.push(fn);
        return true;
    }
    if (paramMap[lowerName]) {
        const fn = paramMap[lowerName](v);
        if (fn) ruleFns.push(fn);
        return true;
    }
    if (lowerName === 'type' || lowerName === 'data-parsley-type') {
        const lowerVal = v.toLowerCase();
        if (lowerVal === 'email') ruleFns.push(email);
        if (lowerVal === 'url') ruleFns.push(url);
        if (lowerVal === 'number' || lowerVal === 'digits') ruleFns.push(numeric);
        if (lowerVal === 'integer') ruleFns.push(integer);
        return true;
    }
    if (lowerName === `${prefix}-rule` || lowerName === `${prefix}-rules` || lowerName === 'hx-rule' || lowerName === 'hx-rules' || lowerName === 'rule' || lowerName === 'rules' || lowerName === 'data-parsley-rule') {
        const parsedRules = normalizeRules(v, reg);
        ruleFns.push(...parsedRules);
        return true;
    }
    return false;
}

function parseMessages(lowerName, v, prefix, msgOverrides) {
    let msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-(.+)-message$`));
    if (msgMatch && msgMatch[1] !== 'remote') {
        msgOverrides[msgMatch[1]] = v;
        return true;
    }
    msgMatch = lowerName.match(/^data-parsley-(.+)-message$/);
    if (msgMatch && msgMatch[1] !== 'error' && msgMatch[1] !== 'remote') {
        msgOverrides[msgMatch[1]] = v;
        return true;
    }
    msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-msg-(.+)$`));
    if (msgMatch) {
        msgOverrides[msgMatch[1]] = v;
        return true;
    }
    msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-error-(.+)$`));
    if (msgMatch && msgMatch[1] !== 'container' && msgMatch[1] !== 'target' && msgMatch[1] !== 'message') {
        msgOverrides[msgMatch[1]] = v;
        return true;
    }
    return false;
}

function parseBehavior(lowerName, v, prefix, opts, el, ruleFns, ctx) {
    if (lowerName === `${prefix}-required-if` || lowerName === 'hx-required-if') {
        const parentForm = getFormFromEl(el, ctx);
        if (parentForm) {
            ruleFns.push(requiredIf(() => {
                const c = parentForm.field(v);
                return c ? !!c.value.value : false;
            }));
        }
        return true;
    }
    if (lowerName === `${prefix}-required-unless` || lowerName === 'hx-required-unless') {
        const parentForm = getFormFromEl(el, ctx);
        if (parentForm) {
            ruleFns.push(requiredUnless(() => {
                const c = parentForm.field(v);
                return c ? !!c.value.value : false;
            }));
        }
        return true;
    }
    if (lowerName === `${prefix}-debounce` || lowerName === 'hx-debounce' || lowerName === 'data-parsley-debounce')   { opts.debounce = Number(v); return true; }
    if (lowerName === `${prefix}-trigger` || lowerName === 'hx-trigger' || lowerName === 'data-parsley-trigger')    { opts.trigger = v; return true; }
    if (lowerName === `${prefix}-group` || lowerName === 'hx-group' || lowerName === 'data-parsley-group')      { opts.group = v.includes(',') ? v.split(',').map(s => s.trim()) : v; return true; }
    if (lowerName === `${prefix}-excluded` || lowerName === 'hx-excluded' || lowerName === 'data-parsley-excluded')   { opts.excluded = true; return true; }
    if (lowerName === `${prefix}-auto-dirty` || lowerName === 'hx-auto-dirty') { opts.autoDirty = true; return true; }
    if (lowerName === `${prefix}-lazy` || lowerName === 'hx-lazy')       { opts.lazy = true; return true; }
    if (lowerName === `${prefix}-depends-on` || lowerName === 'hx-depends-on') { opts.dependsOn = v.split(',').map(s => s.trim()); return true; }
    if (lowerName === `${prefix}-mode` || lowerName === 'hx-mode')       { opts.mode = v; return true; }
    return false;
}

function parseDisplay(lowerName, v, prefix, opts) {
    if (lowerName === `${prefix}-pending-text` || lowerName === 'hx-pending-text' || lowerName === 'data-hx-pending-text')     { opts.pendingText = v; return true; }
    if (lowerName === `${prefix}-class-handler` || lowerName === `${prefix}-class-target` || lowerName === 'hx-class-target' || lowerName === 'hx-class-handler' || lowerName === 'data-parsley-class-handler')    { opts.classHandler = v; return true; }
    if (lowerName === `${prefix}-error-target` || lowerName === `${prefix}-error-container` || lowerName === `${prefix}-errors-container` || lowerName === 'hx-error-container' || lowerName === 'hx-errors-container' || lowerName === 'data-parsley-errors-container')     { opts.errTarget = v; return true; }
    if (lowerName === `${prefix}-message` || lowerName === `${prefix}-msg` || lowerName === `${prefix}-error-message` || lowerName === 'hx-msg' || lowerName === 'hx-message' || lowerName === 'hx-error-message' || lowerName === 'data-parsley-error-message' || lowerName === 'message') { opts.message = v; return true; }
    return false;
}

function parseRemote(lowerName, v, prefix, opts) {
    if (lowerName === `${prefix}-remote` || lowerName === 'hx-remote' || lowerName === 'data-parsley-remote')         { opts.remoteUrl = v; return true; }
    if (lowerName === `${prefix}-remote-message` || lowerName === 'hx-remote-message' || lowerName === 'data-parsley-remote-message') { opts.remoteOpts.fallback = v; return true; }
    if (lowerName === `${prefix}-remote-options` || lowerName === 'hx-remote-options' || lowerName === 'data-parsley-remote-options') { try { Object.assign(opts.remoteOpts, JSON.parse(v)); } catch {} return true; }
    return false;
}

export function parseDataHx(el, localContext, customRegistry) {
    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    const registry = customRegistry || ctx._registry;
    
    const ruleFns = [];
    const msgOverrides = {};
    const opts = {
        remoteUrl: null, remoteOpts: {}, debounce: null, trigger: null,
        group: null, excluded: false, autoDirty: false, lazy: false,
        pendingText: '', classHandler: null, errTarget: null, dependsOn: [],
        message: null,
    };

    const boolMap = {
        [`${prefix}-required`]:  () => required,
        'hx-required':           () => required,
        'required':              () => required,
        [`${prefix}-require`]:   () => required,
        'hx-require':            () => required,
        'require':               () => required,
        'data-parsley-required': () => required,
        [`${prefix}-email`]:     () => email,
        'hx-email':              () => email,
        [`${prefix}-url`]:       () => url,
        'hx-url':                () => url,
        [`${prefix}-numeric`]:   () => numeric,
        'hx-numeric':            () => numeric,
        [`${prefix}-integer`]:   () => integer,
        'hx-integer':            () => integer,
    };
    const paramMap = {
        [`${prefix}-minlength`]:       (v) => minLength(Number(v)),
        'hx-minlength':                (v) => minLength(Number(v)),
        'minlength':                   (v) => minLength(Number(v)),
        'data-parsley-minlength':      (v) => minLength(Number(v)),
        [`${prefix}-maxlength`]:       (v) => maxLength(Number(v)),
        'hx-maxlength':                (v) => maxLength(Number(v)),
        'maxlength':                   (v) => maxLength(Number(v)),
        'data-parsley-maxlength':      (v) => maxLength(Number(v)),
        [`${prefix}-min`]:             (v) => min(Number(v)),
        'hx-min':                      (v) => min(Number(v)),
        'min':                         (v) => min(Number(v)),
        'data-parsley-min':            (v) => min(Number(v)),
        [`${prefix}-max`]:             (v) => max(Number(v)),
        'hx-max':                      (v) => max(Number(v)),
        'max':                         (v) => max(Number(v)),
        'data-parsley-max':            (v) => max(Number(v)),
        [`${prefix}-between`]:         (v) => { const [a, b] = v.split(','); return between(Number(a), Number(b)); },
        'hx-between':                  (v) => { const [a, b] = v.split(','); return between(Number(a), Number(b)); },
        'data-parsley-range':          (v) => {
            const parts = v.replace(/[\[\]]/g, '').split(',');
            return between(Number(parts[0]), Number(parts[1]));
        },
        'data-parsley-length':         (v) => {
            const parts = v.replace(/[\[\]]/g, '').split(',');
            return between(Number(parts[0]), Number(parts[1]));
        },
        [`${prefix}-pattern`]:         (v) => pattern(v),
        'hx-pattern':                  (v) => pattern(v),
        'pattern':                     (v) => pattern(v),
        'data-parsley-pattern':        (v) => pattern(v),
        [`${prefix}-one-of`]:          (v) => oneOf(v.split(',')),
        'hx-one-of':                   (v) => oneOf(v.split(',')),
        [`${prefix}-equalto`]:         (v) => equalto(v),
        'hx-equalto':                  (v) => equalto(v),
        'data-parsley-equalto':        (v) => equalto(v),
        'equalto':                     (v) => equalto(v),
        [`${prefix}-same-as`]:         (v) => equalto(v),
        'hx-same-as':                  (v) => equalto(v),
    };

    Array.from(el.attributes).forEach(({ name: a, value: v }) => {
        const lowerName = a.toLowerCase();
        if (parseRules(lowerName, v, prefix, ruleFns, boolMap, paramMap, ctx, registry)) return;
        if (parseMessages(lowerName, v, prefix, msgOverrides)) return;
        if (parseBehavior(lowerName, v, prefix, opts, el, ruleFns, ctx)) return;
        if (parseDisplay(lowerName, v, prefix, opts)) return;
        if (parseRemote(lowerName, v, prefix, opts)) return;
    });

    if (!opts.group && el && el.closest) {
        const groupAncestor = el.closest(`[${prefix}-group], [data-parsley-group], [hx-group]`);
        if (groupAncestor && groupAncestor !== el) {
            const gVal = groupAncestor.getAttribute(`${prefix}-group`) || groupAncestor.getAttribute('data-parsley-group') || groupAncestor.getAttribute('hx-group');
            if (gVal) {
                opts.group = gVal.includes(',') ? gVal.split(',').map(s => s.trim()) : gVal;
            }
        }
    }

    const seenRules = new Set();
    const uniqueRuleFns = [];
    ruleFns.forEach(fn => {
        const name = fn.meta?.name || fn._ruleName;
        if (name) {
            if (seenRules.has(name)) return;
            seenRules.add(name);
        }
        uniqueRuleFns.push(fn);
    });

    const finalFns = Object.keys(msgOverrides).length
        ? uniqueRuleFns.map(fn => {
            const name = fn.meta?.name || fn._ruleName;
            const lowerName = name ? name.toLowerCase() : '';
            const customMsg = name && (msgOverrides[name] || msgOverrides[lowerName]);
            return customMsg
                ? withMessage(customMsg, fn)
                : fn;
        })
        : uniqueRuleFns;

    return { ruleFns: finalFns, opts };
}

export function bindFieldEl(el, ctrl, fOpts, ctx) {
    if (el.__hxBound) return; // already bound
    
    const app = ctx.app;
    const config = ctx.config;
    const prefix = resolvePrefix(ctx);
    const fid = ctrl.name || ctrl._id;

    el.__hxField = ctrl;
    if (!el.id) el.id = `hx-field-${fid}`;
    el.setAttribute('aria-invalid', 'false');

    const trigger = fOpts.trigger || ctrl.updateOn || config.trigger;
    const mode = fOpts.mode || ctrl.mode || config.mode || null;
    let actualTrigger = trigger;
    if (mode) {
        if (mode === 'submitOnly' || mode === 'passive') actualTrigger = 'submit';
        else if (mode === 'aggressive') actualTrigger = 'input';
        else if (mode === 'lazy') actualTrigger = 'blur';
        else if (mode === 'eager' || mode === 'hybrid') actualTrigger = 'eager';
    }

    const debounceMs = fOpts.debounce != null ? fOpts.debounce : (fOpts.remoteUrl ? config.debounce : 0);
    const remoteUrl = fOpts.remoteUrl || null;
    const remoteOpts = fOpts.remoteOpts || {};
    const dispOpts = {
        classHandler: fOpts.classHandler,
        errTarget: fOpts.errTarget,
        pendingText: fOpts.pendingText || '',
        silent: mode === 'silent' || fOpts.silent || ctrl.silent || config.silent,
        showAllErrors: mode === 'allErrors' ? true : (mode === 'firstError' ? false : (fOpts.showAllErrors ?? ctrl.showAllErrors ?? config.showAllErrors))
    };

    let _remoteTimer = null;
    let _eagerOn = false;
    let _hasValidated = false;

    function doValidate() {
        if (actualTrigger === 'manual' || actualTrigger === 'submit') return Promise.resolve(true);
        if (actualTrigger === 'once' && _hasValidated) return Promise.resolve(true);
        if (actualTrigger === 'dirty' && !ctrl.dirty.value) return Promise.resolve(true);
        if (actualTrigger === 'touched' && !ctrl.touched.value) return Promise.resolve(true);

        return ctrl.validate().then(() => {
            _hasValidated = true;
            renderField(el, ctrl, fid, dispOpts, ctx);

            if (remoteUrl && ctrl.errors.value.length === 0 && !ctrl.disabled.value) {
                if (config.minChars && String(ctrl.value.value).length < config.minChars) return;

                if (_remoteTimer) clearTimeout(_remoteTimer);
                _remoteTimer = setTimeout(() => {
                    _remoteTimer = null;
                    const checkedValue = ctrl.value.value;
                    ctrl.pending.value = true;
                    renderField(el, ctrl, fid, dispOpts, ctx);
                    runRemote(el, remoteUrl, checkedValue, remoteOpts, ctx).then(result => {
                        ctrl.pending.value = false;
                        if (!result || result.aborted) return;
                        if (ctrl.value.value !== checkedValue) return;

                        if (!result.valid) {
                            const msg = result.message || 'Invalid value.';
                            ctrl._remoteErrors.value = [{ message: msg, source: 'remote', rule: null }];
                        } else {
                            ctrl._remoteErrors.value = [];
                        }
                        renderField(el, ctrl, fid, dispOpts, ctx);
                    });
                }, debounceMs || config.debounce);
            }
        });
    }

    function readInputValue(e) {
        const t = e.target;
        if (t.type === 'checkbox') return t.checked;
        if (t.type === 'radio') {
            const rname = ctrl.name || el.getAttribute('name');
            const scope = el.form || el.closest('form') || document;
            const escapedRname = rname && typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(rname) : rname;
            const checked = escapedRname
                ? scope.querySelector(`input[type=radio][name="${escapedRname}"]:checked`)
                : (t.checked ? t : null);
            return checked ? checked.value : '';
        }
        if (t.isContentEditable || t.value === undefined) return t.textContent;
        return t.value;
    }

    function onInput(e) {
        ctrl.value.value = readInputValue(e);
        if (ctrl._autoDirty) ctrl.dirty.value = true;
        if (actualTrigger === 'input' || actualTrigger === 'change' || actualTrigger === 'always') doValidate();
        if (actualTrigger === 'eager' && (_eagerOn || ctrl.touched.value)) { doValidate(); _eagerOn = true; }
        if (actualTrigger === 'dirty' || actualTrigger === 'touched') doValidate();
    }
    function onBlur() {
        ctrl.touch();
        if (!_eagerOn && ctrl.errors.value.length > 0) _eagerOn = true;
        if (actualTrigger === 'blur' || actualTrigger === 'eager' || actualTrigger === 'always' || actualTrigger === 'once') doValidate();
        if (actualTrigger === 'dirty' || actualTrigger === 'touched') doValidate();
    }
    function onChange(e) {
        if (e.target.type === 'radio' && !e.target.checked) return;
        ctrl.value.value = readInputValue(e);
        if (actualTrigger === 'change' || actualTrigger === 'always' || actualTrigger === 'once') doValidate();
        if (actualTrigger === 'dirty' || actualTrigger === 'touched') doValidate();
    }

    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
    el.addEventListener('change', onChange);

    const effect = app.effect(() => {
        el.disabled = ctrl.disabled.value;
        void ctrl._tagged.value;
        void ctrl.pending.value;
        void ctrl.touched.value;
        void ctrl.dirty.value;
        renderField(el, ctrl, fid, dispOpts, ctx);
    });
    ctx.allEffects.add(effect);
    ctx.boundFieldEls.add(el);

    if (config.validateOnMount && !ctrl._lazy) doValidate();

    const cleanup = () => {
        el.removeEventListener('input', onInput);
        el.removeEventListener('blur', onBlur);
        el.removeEventListener('change', onChange);
        if (effect && effect.stop) effect.stop();
        ctx.allEffects.delete(effect);
        if (_remoteTimer) clearTimeout(_remoteTimer);
        if (ctx.remoteAborts.has(el)) { ctx.remoteAborts.get(el).abort(); ctx.remoteAborts.delete(el); }
        if (!dispOpts.errTarget) {
            const span = document.getElementById(`hx-err-${fid}`);
            if (span && span === el.nextElementSibling) span.remove();
        }
        el.classList.remove(config.classes.valid, config.classes.invalid, config.classes.pending);
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
        el.removeAttribute(`data-${prefix}-pending`);
        delete el.__hxField;
        ctx.boundFieldEls.delete(el);
        el.__hxBound = false;
    };
    ctx.dirCleanups.set(el, cleanup);
    ctx.allCleanups.add(cleanup);
    el.__hxBound = true;
}

export function scanForms(localContext, targetNode, force) {
    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    
    const formSelector = `[${prefix}-form], [data-parsley-validate], [hx-form]`;
    const formsToScan = [];
    if (targetNode) {
        if (targetNode.nodeType === 1) {
            if (force || (targetNode.matches && targetNode.matches(formSelector))) {
                formsToScan.push(targetNode);
            }
            if (targetNode.querySelectorAll) {
                formsToScan.push(...targetNode.querySelectorAll(formSelector));
            }
        }
    } else {
        formsToScan.push(...document.querySelectorAll(formSelector));
    }

    formsToScan.forEach(formEl => {
        if (ctx.formContextMap.has(formEl) || formEl.__hxAutoBound) return;

        const fieldDefs = {};
        formEl.querySelectorAll('[name]').forEach(input => {
            const { ruleFns, opts: fOpts } = parseDataHx(input, ctx);
            if (!ruleFns.length && !fOpts.remoteUrl && !input.__hxField) return;
            const name = input.getAttribute('name');

            let initial;
            if (input.type === 'checkbox') {
                initial = !!input.checked;
            } else if (input.type === 'radio') {
                const scope = input.form || input.closest('form') || formEl;
                const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name;
                const checked = scope.querySelector(
                    `input[type=radio][name="${escapedName}"]:checked`
                );
                initial = checked ? checked.value : '';
            } else {
                initial = input.value || '';
            }

            let ctrl;
            if (input.__hxField) {
                ctrl = input.__hxField;
                fieldDefs[name] = ctrl;
            } else {
                ctrl = field(initial, ruleFns, {
                    name, trigger: fOpts.trigger, autoDirty: fOpts.autoDirty,
                    lazy: fOpts.lazy, group: fOpts.group, message: fOpts.message,
                }, ctx);
                fieldDefs[name] = ctrl;
            }
            bindFieldEl(input, ctrl, fOpts, ctx);
        });

        const f = form(fieldDefs, {}, ctx);
        f._el = formEl;
        ctx.formContextMap.set(formEl, f);
        ctx.autoForms.set(formEl, f);
        formEl.__hxAutoBound = true;

        const onFormSubmit = e => { e.preventDefault(); f.submit(); };
        formEl.addEventListener('submit', onFormSubmit);

        const cleanup = () => {
            formEl.removeEventListener('submit', onFormSubmit);
            ctx.autoForms.delete(formEl);
            ctx.autoFormCleanups.delete(formEl);
            ctx.formContextMap.delete(formEl);
            delete formEl.__hxAutoBound;
            if (typeof f._destroy === 'function') f._destroy();
            ctx.allCleanups.delete(cleanup);
        };
        ctx.autoFormCleanups.set(formEl, cleanup);
        ctx.allCleanups.add(cleanup);
    });
}

function disposeFieldEl(fieldEl, localContext) {
    const fc = localContext.dirCleanups.get(fieldEl);
    if (fc) { fc(); localContext.dirCleanups.delete(fieldEl); localContext.dirUpdaters.delete(fieldEl); }
}

export function cleanupRemovedNode(node, localContext) {
    if (!node || node.nodeType !== 1) return;
    if (node.isConnected) return; // re-inserted

    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    if (ctx.autoFormCleanups.has(node)) ctx.autoFormCleanups.get(node)();
    if (node.querySelectorAll) {
        node.querySelectorAll(`[${prefix}-form]`).forEach(f => {
            if (ctx.autoFormCleanups.has(f)) ctx.autoFormCleanups.get(f)();
        });
    }

    if (ctx.boundFieldEls.has(node)) {
        disposeFieldEl(node, ctx);
    }
    if (node.querySelectorAll) {
        node.querySelectorAll('*').forEach(child => {
            if (ctx.boundFieldEls.has(child)) disposeFieldEl(child, ctx);
        });
    }
}

const _raf = (typeof requestAnimationFrame !== 'undefined')
    ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
const _caf = (typeof cancelAnimationFrame !== 'undefined')
    ? cancelAnimationFrame : clearTimeout;

export function scheduleScan(localContext, targetNode) {
    const ctx = localContext || getCurrentContext();
    if (targetNode) ctx._scanTargets.add(targetNode);
    if (ctx._scanScheduled) return;
    ctx._scanScheduled = true;
    ctx._scanHandle = _raf(() => {
        ctx._scanScheduled = false;
        ctx._scanHandle    = null;
        
        const targets = Array.from(ctx._scanTargets);
        ctx._scanTargets.clear();
        
        if (targets.length) {
            targets.forEach(t => scanForms(ctx, t));
        } else {
            scanForms(ctx);
        }
    });
}

export function startObserver(options, localContext) {
    const ctx = localContext || getCurrentContext();
    if (options.observe && typeof MutationObserver !== 'undefined') {
        const prefix = resolvePrefix(ctx);
        ctx._autoFormObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.removedNodes) cleanupRemovedNode(node, ctx);
            }
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    let hasForm = false;
                    if (node.matches && node.matches(`[${prefix}-form]`)) {
                        hasForm = true;
                    } else if (node.querySelector && node.querySelector(`[${prefix}-form]`)) {
                        hasForm = true;
                    }
                    if (hasForm) {
                        scheduleScan(ctx, node);
                    }
                }
            }
        });
        ctx._autoFormObserver.observe(document.body, { childList: true, subtree: true });
    }
}

export function stopObserver(localContext) {
    const ctx = localContext || getCurrentContext();
    if (!ctx) return;
    if (ctx._autoFormObserver) {
        ctx._autoFormObserver.disconnect();
        ctx._autoFormObserver = null;
    }
    if (ctx._scanScheduled && ctx._scanHandle != null) {
        _caf(ctx._scanHandle);
        ctx._scanScheduled = false;
        ctx._scanHandle = null;
    }
    ctx._scanTargets.clear();
}
