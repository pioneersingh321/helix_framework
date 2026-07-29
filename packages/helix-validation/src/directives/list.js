import { getContextFromBinding } from '../core/context.js';
import { resolvePrefix } from '../shared/utils.js';

function tryBindList(el, binding) {
    if (el.__hxListBound) return;

    const localContext = getContextFromBinding(binding);
    const app = localContext.app;

    const raw = binding.value;
    const l = typeof raw === 'string' && app && typeof app.resolvePath === 'function'
        ? app.resolvePath(raw, binding.ctx)
        : raw;

    if (!l) return; // Wait until the FieldList is defined
    if (l._type !== 'list') {
        console.warn('[Helix Validation] hx-list: binding must be a FieldList.');
        return;
    }

    const prefix = resolvePrefix(app);

    const tmpl = el.querySelector(`[${prefix}-list-item-template]`);
    if (!tmpl) {
        console.warn(`[Helix Validation] hx-list: no [${prefix}-list-item-template] template found.`);
        return;
    }
    tmpl.style.display = 'none';

    function render() {
        el.querySelectorAll(`[${prefix}-list-item]`).forEach(n => n.remove());
        l.items.value.forEach((itemCtrl, index) => {
            const clone = tmpl.cloneNode(true);
            clone.removeAttribute(`${prefix}-list-item-template`);
            clone.style.display = '';
            clone.setAttribute(`${prefix}-list-item`, String(index));
            clone.__hxListItem = itemCtrl;
            clone.__hxListIndex = index;
            clone.querySelectorAll(`[${prefix}-remove]`).forEach(btn => {
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
    localContext.allEffects.add(effect);

    const cleanup = () => {
        if (effect && effect.stop) effect.stop();
        localContext.allEffects.delete(effect);
        localContext.allCleanups.delete(cleanup);
        el.__hxListBound = false;
    };
    localContext.dirCleanups.set(el, cleanup);
    localContext.allCleanups.add(cleanup);
    el.__hxListBound = true;
}

export const listDirective = {
    mounted(el, binding) {
        tryBindList(el, binding);
    },

    updated(el, binding) {
        tryBindList(el, binding);
    },

    unmounted(el, binding) {
        const localContext = getContextFromBinding(binding);
        const cleanup = localContext.dirCleanups.get(el);
        if (cleanup) { cleanup(); localContext.dirCleanups.delete(el); }
    }
};

