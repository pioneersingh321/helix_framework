import { BOUND, handleError, logger } from '../shared/shared.js';
import { destroyNode } from '../renderer/node.js';
import { parseAttribute, cleanAttributes } from './dom.js';

export function cleanupNode(node) {
    if (!node) return;
    const runCleanups = (n) => {
        if (n.__hx_cleanup) {
            n.__hx_cleanup.forEach((fn) => {
                try { fn(); } catch (e) { handleError(e, "Helix.dom.cleanup"); }
            });
            n.__hx_cleanup = null;
        }
        if (n.__hx_binding && n.__hx_binding.cleanups) {
            n.__hx_binding.cleanups.forEach((fn) => {
                try { fn(); } catch (e) { handleError(e, "Helix.dom.binding cleanup"); }
            });
            n.__hx_binding.cleanups = [];
        }
        if (n.nodeType === 1) Array.from(n.childNodes).forEach(runCleanups);
    };
    runCleanups(node);
}

export function destroy(node) {
    if (!node) return;
    destroyNode(node);
}

export function bind(node, ctx, instance, options = {}) {
    if (!node) return;
    const binding = node.__hx_binding;
    if (binding && binding.bindNode) {
        binding.bindNode(node, ctx, instance, options.cleanups || [], options.force !== false);
    } else {
        logger.warn("Cannot locate bindNode capability on element.", "dom");
    }
}

export function inspect(node) {
    if (!node) return null;
    let safeInstance = null;
    if (node.__hx_binding && node.__hx_binding.instance) {
        const inst = node.__hx_binding.instance;
        safeInstance = {
            id: inst.id || null,
            name: inst.name || null,
            hasProvides: !!inst.provides
        };
    }
    return {
        tagName: node.tagName ? node.tagName.toLowerCase() : null,
        id: node.id || null,
        bound: !!node[BOUND],
        patchFlag: node.__hx_patchFlag || 0,
        directives: node.__hx_directives ? Array.from(node.__hx_directives) : [],
        scopeKeys: node.__hx_scope ? Object.keys(node.__hx_scope) : [],
        key: node.__hx_key ?? null,
        hasCleanups: !!(node.__hx_cleanup && node.__hx_cleanup.length) || !!(node.__hx_binding && node.__hx_binding.cleanups && node.__hx_binding.cleanups.length),
        bindingMetadata: node.__hx_binding ? {
            hasCtx: !!node.__hx_binding.ctx,
            instance: safeInstance,
            cleanupCount: node.__hx_binding.cleanups ? node.__hx_binding.cleanups.length : 0
        } : null
    };
}

export function findNode(selector, root = document) {
    if (typeof selector !== "string") return null;
    return root.querySelector(selector);
}

export const domAPI = {
    bind,
    cleanup: cleanupNode,
    destroy,
    inspect,
    findNode,
    parseAttribute,
    cleanAttributes
};

export { parseAttribute, cleanAttributes };
