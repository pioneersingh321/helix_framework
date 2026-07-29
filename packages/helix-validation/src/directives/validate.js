import { getCurrentContext, getContextFromBinding } from '../core/context.js';
import { parseDataHx, renderField, getFormFromEl, bindFieldEl } from '../shared/manager.js';
import { field } from '../form/field.js';
import { runRemote, resolvePrefix, createLookupRegistry } from '../shared/utils.js';
import { normalizeRules } from '../core/parser.js';

export const validateDirective = {
    mounted(el, binding) {
        const localContext = getContextFromBinding(binding);
        const app = localContext.app;
        const config = localContext.config;
        const prefix = resolvePrefix(app);
        let bindVal = binding.value;
        if (bindVal && typeof bindVal === 'object') {
            if (typeof app.isRef === 'function' && app.isRef(bindVal)) {
                bindVal = bindVal.value;
            } else if (bindVal.__isRef || bindVal.__v_isRef) {
                bindVal = bindVal.value;
            }
        }
        let ctrl, fid, dOpts = {};

        // Resolve parent form from provides tree, falling back to DOM lookup
        let parentForm = null;
        if (binding.instance) {
            let inst = binding.instance;
            while (inst) {
                if (inst.provides && inst.provides['$form']) {
                    parentForm = inst.provides['$form'];
                    break;
                }
                inst = inst.parent;
            }
        }
        if (!parentForm) {
            parentForm = getFormFromEl(el, localContext);
        }

        const name = el.getAttribute('name') || el.getAttribute('id');

        // Resolve field if already defined on form
        let resolvedField = null;
        if (typeof bindVal === 'string') {
            if (bindVal.includes('.fields.')) {
                const parts = bindVal.split('.fields.');
                const formName = parts[0];
                const fieldPath = parts[1];
                const targetForm = (parentForm && parentForm.name === formName) ? parentForm : null;
                if (targetForm) {
                    resolvedField = targetForm.field(fieldPath);
                }
            } else if (parentForm) {
                resolvedField = parentForm.field(bindVal);
            }
        } else if (!bindVal && name && parentForm) {
            resolvedField = parentForm.field(name);
        }

        if (bindVal && bindVal._type === 'field') {
            ctrl = bindVal;
            fid = ctrl.name || ctrl._id;
            const parsed = parseDataHx(el, localContext, createLookupRegistry(ctrl, localContext));
            if (parsed.ruleFns.length) ctrl.addRule(parsed.ruleFns);
            dOpts = parsed.opts;
            if (dOpts.message && !ctrl.message) ctrl.message = dOpts.message;
        } else if (resolvedField) {
            ctrl = resolvedField;
            fid = ctrl.name || ctrl._id;
            const parsed = parseDataHx(el, localContext, createLookupRegistry(ctrl, localContext));
            if (parsed.ruleFns.length) ctrl.addRule(parsed.ruleFns);
            dOpts = parsed.opts;
            if (dOpts.message && !ctrl.message) ctrl.message = dOpts.message;
        } else {
            const parsed = parseDataHx(el, localContext, parentForm ? createLookupRegistry(parentForm, localContext) : null);
            let rFns = parsed.ruleFns.slice();
            if (typeof bindVal === 'string' && !bindVal.includes('.fields.')) {
                rFns = normalizeRules(bindVal, parentForm ? createLookupRegistry(parentForm, localContext) : localContext._registry).concat(rFns);
            }

            const fieldName = name || `hxv${localContext.seq + 1}`;
            fid = fieldName;
            dOpts = parsed.opts;

            let initial;
            if (el.type === 'checkbox') {
                initial = !!el.checked;
            } else if (el.type === 'radio') {
                const scope = el.form || el.closest('form') || document;
                const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(fieldName) : fieldName;
                const checked = scope.querySelector(
                    `input[type=radio][name="${escapedName}"]:checked`
                );
                initial = checked ? checked.value : '';
            } else if (el.isContentEditable) {
                initial = el.textContent || '';
            } else {
                initial = el.value || '';
            }

            ctrl = field(initial, rFns, {
                name: fieldName,
                trigger: dOpts.trigger,
                autoDirty: dOpts.autoDirty,
                lazy: dOpts.lazy,
                group: dOpts.group,
                message: dOpts.message,
            }, localContext);

            if (parentForm && !parentForm.fields[fieldName] && !dOpts.excluded) {
                parentForm.add(fieldName, ctrl);
            }
        }

        // BIND THE FIELD EL
        bindFieldEl(el, ctrl, dOpts, localContext);

        localContext.dirUpdaters.set(el, (newB) => {
            const nv = newB.value;
            if (nv && nv._type === 'field' && nv !== ctrl) {
                ctrl = nv; el.__hxField = ctrl;
                fid = ctrl.name || ctrl._id;
            }
        });
    },

    updated(el, binding) {
        const localContext = getContextFromBinding(binding);
        const u = localContext.dirUpdaters.get(el);
        if (u) u(binding);
    },

    unmounted(el, binding) {
        const localContext = getContextFromBinding(binding);
        const cleanup = localContext.dirCleanups.get(el);
        if (cleanup) { cleanup(); localContext.dirCleanups.delete(el); localContext.dirUpdaters.delete(el); }
    }
};
