import { escapeHtml, getClassTarget, resolvePrefix } from './utils.js';

export const uiDrivers = new Map();

export function registerUI(name, driver) {
    uiDrivers.set(name, driver);
}

export function resolveClasses(driverOrName, config) {
    const driver = typeof driverOrName === 'string'
        ? (uiDrivers.get(driverOrName) || uiDrivers.get('custom'))
        : (driverOrName || uiDrivers.get('custom'));
    const driverClasses = driver.classes || {};
    const globalClasses = config.classes || {};
    const uiClasses = (config.ui && config.ui.classes) || {};
    return Object.assign({}, driverClasses, globalClasses, uiClasses);
}

export function getActiveUIDriver(ctx) {
    const config = ctx.config;
    const ui = config.ui || 'custom';
    const driverName = typeof ui === 'string' ? ui : (ui.driver || 'custom');
    return uiDrivers.get(driverName) || uiDrivers.get('custom');
}

function setContainerHtml(container, html) {
    if (container.__hxLastContent === html) return;
    container.innerHTML = html;
    container.__hxLastContent = html;
}

function ensureErrSpan(el, fid, className) {
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

function getOrCreateBootstrapFeedback(el, fid, feedbackType, clsName) {
    const id = `hx-err-${fid}`;
    let sibling = el.nextElementSibling;
    while (sibling) {
        if (sibling.id === id || sibling.classList.contains(clsName)) {
            return sibling;
        }
        sibling = sibling.nextElementSibling;
    }
    const div = document.createElement('div');
    div.id = id;
    div.className = clsName;
    el.insertAdjacentElement('afterend', div);
    return div;
}

// 1. Custom (Default) UI Driver
const customDriver = {
    classes: {
        valid: 'hx-valid',
        invalid: 'hx-invalid',
        pending: 'hx-validating',
        feedback: 'hx-error-msg',
        form: 'hx-form-validated'
    },
    renderField(el, ctrl, fid, dOpts, ctx) {
        const config = ctx.config;
        const target = getClassTarget(el, dOpts.classHandler);
        const cls = resolveClasses(this, config);
        const container = (dOpts.errTarget && document.querySelector(dOpts.errTarget)) || ensureErrSpan(el, fid, cls.feedback);

        const renderCtx = { el, control: ctrl, fieldId: fid, displayOptions: dOpts, localContext: ctx };
        const globalBeforeRender = ctx.beforeRenderMiddlewares || [];
        globalBeforeRender.forEach(mw => {
            try { mw(renderCtx); } catch (err) { console.error('[Helix Validation] beforeRender middleware error:', err); }
        });

        const triggerAfterRender = () => {
            const globalAfterRender = ctx.afterRenderMiddlewares || [];
            globalAfterRender.forEach(mw => {
                try { mw(renderCtx); } catch (err) { console.error('[Helix Validation] afterRender middleware error:', err); }
            });
        };

        const currentMode = ctrl.mode || config.mode;
        if (currentMode === 'silent') {
            target.classList.remove(cls.valid, cls.invalid, cls.pending);
            setContainerHtml(container, '');
            triggerAfterRender();
            return;
        }

        const prefix = resolvePrefix(ctx);

        if (ctrl.pending.value) {
            target.classList.remove(cls.valid, cls.invalid);
            target.classList.add(cls.pending);
            el.setAttribute('aria-invalid', 'false');
            el.removeAttribute('aria-describedby');
            el.setAttribute(`data-${prefix}-pending`, '');
            setContainerHtml(container, dOpts.pendingText
                ? `<span class="hx-err hx-err--pending">${escapeHtml(dOpts.pendingText)}</span>` : '');
            triggerAfterRender();
            return;
        }

        el.removeAttribute(`data-${prefix}-pending`);
        const showErrs = ctrl.$errors.value.length > 0;
        const isClean  = ctrl.errors.value.length === 0;

        target.classList.remove(cls.valid, cls.invalid, cls.pending);
        if (showErrs) {
            target.classList.add(cls.invalid);
            el.setAttribute('aria-invalid', 'true');
            el.setAttribute('aria-describedby', `hx-err-${fid}`);
            const tagged = ctrl._tagged.value.filter(t => t && t.message);
            const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
            setContainerHtml(container, toShow
                .map(t => `<span class="hx-err hx-err--${escapeHtml(t.source)}">${escapeHtml(t.message)}</span>`)
                .join(''));
        } else {
            el.setAttribute('aria-invalid', 'false');
            el.removeAttribute('aria-describedby');
            setContainerHtml(container, '');
            if (isClean && ctrl.touched.value) {
                target.classList.add(cls.valid);
            }
        }
        triggerAfterRender();
    },
    onFormValidate(formEl, valid, ctx) {
        const cls = resolveClasses(this, ctx.config);
        if (cls.form) {
            formEl.classList.add(cls.form);
        }
        if (valid) {
            if (cls.invalid) formEl.classList.remove(cls.invalid);
            if (cls.valid) formEl.classList.add(cls.valid);
        } else {
            if (cls.valid) formEl.classList.remove(cls.valid);
            if (cls.invalid) formEl.classList.add(cls.invalid);
        }
    },
    onFormReset(formEl, ctx) {
        const cls = resolveClasses(this, ctx.config);
        if (cls.form) {
            formEl.classList.remove(cls.form);
        }
        if (cls.valid) formEl.classList.remove(cls.valid);
        if (cls.invalid) formEl.classList.remove(cls.invalid);
    }
};

// 2. Bootstrap 5 UI Driver
const bootstrap5Driver = {
    classes: {
        valid: 'is-valid',
        invalid: 'is-invalid',
        pending: 'is-pending',
        feedback: 'invalid-feedback',
        success: 'valid-feedback',
        form: 'was-validated'
    },
    renderField(el, ctrl, fid, dOpts, ctx) {
        const config = ctx.config;
        const target = getClassTarget(el, dOpts.classHandler);
        const cls = resolveClasses(this, config);

        const renderCtx = { el, control: ctrl, fieldId: fid, displayOptions: dOpts, localContext: ctx };
        const globalBeforeRender = ctx.beforeRenderMiddlewares || [];
        globalBeforeRender.forEach(mw => {
            try { mw(renderCtx); } catch (err) { console.error('[Helix Validation] beforeRender middleware error:', err); }
        });

        const triggerAfterRender = () => {
            const globalAfterRender = ctx.afterRenderMiddlewares || [];
            globalAfterRender.forEach(mw => {
                try { mw(renderCtx); } catch (err) { console.error('[Helix Validation] afterRender middleware error:', err); }
            });
        };

        const currentMode = ctrl.mode || config.mode;
        if (currentMode === 'silent') {
            target.classList.remove(cls.valid, cls.invalid, cls.pending);
            triggerAfterRender();
            return;
        }

        const prefix = resolvePrefix(ctx);
        const isTooltip = (config.ui && config.ui.feedback === 'tooltip') || dOpts.feedback === 'tooltip';
        
        const feedbackClass = isTooltip ? 'invalid-tooltip' : cls.feedback;
        const successClass = isTooltip ? 'valid-tooltip' : cls.success;

        if (ctrl.pending.value) {
            target.classList.remove(cls.valid, cls.invalid);
            target.classList.add(cls.pending);
            el.setAttribute('aria-invalid', 'false');
            el.removeAttribute('aria-describedby');
            el.setAttribute(`data-${prefix}-pending`, '');
            
            const prevErr = document.getElementById(`hx-err-${fid}`);
            if (prevErr) prevErr.remove();

            triggerAfterRender();
            return;
        }

        el.removeAttribute(`data-${prefix}-pending`);
        const showErrs = ctrl.$errors.value.length > 0;
        const isClean  = ctrl.errors.value.length === 0;

        target.classList.remove(cls.valid, cls.invalid, cls.pending);
        
        const prevErr = document.getElementById(`hx-err-${fid}`);
        if (prevErr) prevErr.remove();

        if (showErrs) {
            target.classList.add(cls.invalid);
            el.setAttribute('aria-invalid', 'true');
            el.setAttribute('aria-describedby', `hx-err-${fid}`);
            
            const tagged = ctrl._tagged.value.filter(t => t && t.message);
            const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
            const errorMsg = toShow.map(t => t.message).join(', ');

            const container = getOrCreateBootstrapFeedback(el, fid, 'invalid', feedbackClass);
            setContainerHtml(container, escapeHtml(errorMsg));
        } else {
            el.setAttribute('aria-invalid', 'false');
            el.removeAttribute('aria-describedby');
            
            if (isClean && ctrl.touched.value) {
                target.classList.add(cls.valid);
                const successMsg = dOpts.successMessage || (config.ui && config.ui.successMessage);
                if (successMsg) {
                    const container = getOrCreateBootstrapFeedback(el, fid, 'valid', successClass);
                    setContainerHtml(container, escapeHtml(successMsg));
                }
            }
        }
        triggerAfterRender();
    },
    onFormValidate(formEl, valid, ctx) {
        const cls = resolveClasses(this, ctx.config);
        if (cls.form) {
            formEl.classList.add(cls.form);
        }
        if (valid) {
            if (cls.invalid) formEl.classList.remove(cls.invalid);
            if (cls.valid) formEl.classList.add(cls.valid);
        } else {
            if (cls.valid) formEl.classList.remove(cls.valid);
            if (cls.invalid) formEl.classList.add(cls.invalid);
        }
    },
    onFormReset(formEl, ctx) {
        const cls = resolveClasses(this, ctx.config);
        if (cls.form) {
            formEl.classList.remove(cls.form);
        }
        if (cls.valid) formEl.classList.remove(cls.valid);
        if (cls.invalid) formEl.classList.remove(cls.invalid);
    }
};

// 3. Tailwind UI Driver
const tailwindDriver = Object.assign({}, customDriver, {
    classes: {
        valid: 'border-green-500 text-green-900 placeholder-green-700 focus:border-green-500 focus:ring-green-500',
        invalid: 'border-red-500 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500',
        pending: 'border-blue-500 focus:border-blue-500 focus:ring-blue-500',
        feedback: 'text-sm text-red-600 mt-2',
        success: 'text-sm text-green-600 mt-2',
        form: 'space-y-4'
    }
});

uiDrivers.set('custom', customDriver);
uiDrivers.set('bootstrap5', bootstrap5Driver);
uiDrivers.set('bootstrap4', bootstrap5Driver); // alias
uiDrivers.set('tailwind', tailwindDriver);
