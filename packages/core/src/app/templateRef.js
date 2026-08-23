import { currentInstance, warn } from '../shared/shared.js';
import { shallowRef } from '../reactivity/ref.js';

/**
 * useTemplateRef - Access template refs dynamically in setup() or composables.
 *
 * @param {string} key - The template ref key to bind to (e.g. `<input ref="myInput" />`).
 * @returns {import('../reactivity/ref.js').Ref<HTMLElement | null>} A shallowRef initialized to null.
 */
export function useTemplateRef(key) {
    if (!currentInstance) {
        warn("useTemplateRef() can only be used inside setup().", "component");
        return shallowRef(null);
    }
    if (!currentInstance.templateRefs) {
        currentInstance.templateRefs = new Map();
    }
    if (currentInstance.templateRefs.has(key)) {
        return currentInstance.templateRefs.get(key);
    }
    const r = shallowRef(null);
    currentInstance.templateRefs.set(key, r);
    return r;
}
