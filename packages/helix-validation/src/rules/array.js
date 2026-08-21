import { isEmpty, resolveMsg, mkRule, mkFactory, resolveParam } from '../shared/utils.js';
import { rules } from '../core/registry.js';

export const sameAs = mkFactory((otherRef, label) => mkRule(
    (v, ctx) => {
        let other = resolveParam(otherRef);
        if (typeof other === 'string' && ctx && ctx.parent && typeof ctx.parent.field === 'function') {
            const otherCtrl = ctx.parent.field(other);
            if (otherCtrl) other = otherCtrl.value.value;
        }
        return v !== other ? resolveMsg('sameAs', { label }, v, ctx) : null;
    },
    'sameAs', 4, { label }
));

export const equalto = mkFactory((targetSelectorOrFn, label) => mkRule(
    (v, ctx) => {
        let otherVal = undefined;
        if (typeof targetSelectorOrFn === 'function') {
            otherVal = targetSelectorOrFn();
        } else if (typeof targetSelectorOrFn === 'string') {
            if (ctx && ctx.parent && typeof ctx.parent.field === 'function') {
                const otherCtrl = ctx.parent.field(targetSelectorOrFn);
                if (otherCtrl) {
                    otherVal = otherCtrl.value && otherCtrl.value.value !== undefined ? otherCtrl.value.value : otherCtrl.value;
                }
            }
            if (otherVal === undefined && typeof document !== 'undefined') {
                let el = null;
                try { el = document.querySelector(targetSelectorOrFn); } catch (e) {}
                if (!el) {
                    try { el = document.querySelector(`[name="${targetSelectorOrFn}"]`); } catch (e) {}
                }
                if (!el && !targetSelectorOrFn.startsWith('#') && !targetSelectorOrFn.startsWith('.')) {
                    try { el = document.getElementById(targetSelectorOrFn); } catch (e) {}
                }
                if (el) {
                    otherVal = el.value !== undefined ? el.value : el.textContent;
                }
            }
        }
        return v !== otherVal ? resolveMsg('equalto', { label: label || targetSelectorOrFn }, v, ctx) : null;
    },
    'equalto', 4, { target: targetSelectorOrFn, label }
));

export const oneOf = mkFactory((values) => mkRule(
    (v, ctx) => {
        const resolvedValues = resolveParam(values) || [];
        return !isEmpty(v) && !resolvedValues.includes(v) ? resolveMsg('oneOf', { values: resolvedValues }, v, ctx) : null;
    },
    'oneOf', 4, { values }
));

// Register rules
rules.add('sameAs', sameAs);
rules.add('equalto', equalto);
rules.add('equalTo', equalto);
rules.add('oneOf', oneOf);
