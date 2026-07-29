import { getContextFromBinding } from '../core/context.js';
import { resolvePrefix } from '../shared/utils.js';

function tryBindForm(el, binding) {
    if (el.__hxFormBound) return;

    const localContext = getContextFromBinding(binding);
    const app = localContext.app;

    const raw = binding.value;
    const f = typeof raw === 'string' && app && typeof app.resolvePath === 'function'
        ? app.resolvePath(raw, binding.ctx)
        : raw;

    if (!f) return; // Wait until the form is defined
    if (f._type !== 'form') {
        console.warn('[Helix Validation] hx-form: binding must be a Form.');
        return;
    }

    localContext.formContextMap.set(el, f);
    if (app.provide) app.provide('$validate.context', f);
    f._el = el;

    if (binding.instance) {
        let inst = binding.instance;
        if (!inst.provides || inst.provides === (inst.parent ? inst.parent.provides : null)) {
            inst.provides = Object.create(inst.parent ? inst.parent.provides : null);
        }
        inst.provides['$form'] = f;
    }

    function onSubmit(e) { e.preventDefault(); f.submit(); }
    el.addEventListener('submit', onSubmit);

    const prefix = resolvePrefix(app);

    const effect = app.effect(() => {
        if (f.submitting.value) {
            el.setAttribute(`${prefix}-submitting`, '');
            el.querySelectorAll(`[type=submit]:not([${prefix}-no-disable])`)
                .forEach(btn => { btn.disabled = true; });
        } else {
            el.removeAttribute(`${prefix}-submitting`);
            el.querySelectorAll(`[type=submit]:not([${prefix}-no-disable])`)
                .forEach(btn => { btn.disabled = false; });
        }
    });
    localContext.allEffects.add(effect);

    const cleanup = () => {
        el.removeEventListener('submit', onSubmit);
        if (effect && effect.stop) effect.stop();
        localContext.allEffects.delete(effect);
        localContext.formContextMap.delete(el);
        localContext.allCleanups.delete(cleanup);
        el.__hxFormBound = false;
    };
    localContext.dirCleanups.set(el, cleanup);
    localContext.allCleanups.add(cleanup);
    el.__hxFormBound = true;
}

export const formDirective = {
    mounted(el, binding) {
        tryBindForm(el, binding);
    },

    updated(el, binding) {
        tryBindForm(el, binding);
    },

    unmounted(el, binding) {
        const localContext = getContextFromBinding(binding);
        const cleanup = localContext.dirCleanups.get(el);
        if (cleanup) { cleanup(); localContext.dirCleanups.delete(el); }
    }
};

