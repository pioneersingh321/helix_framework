import {
    PatchFlags,
    BOUND,
    nodePool,
    staticNodeCache,
    handleError
} from '../shared/shared.js';

export function recycleNode(tagName) {
    const pool = nodePool.get(tagName);
    if (pool && pool.length > 0) {
        return pool.pop();
    }
    return null;
}

export function reclaimNode(node) {
    const tagName = node.tagName;
    if (!tagName) return;
    if (!nodePool.has(tagName)) nodePool.set(tagName, []);
    const pool = nodePool.get(tagName);
    if (pool.length < 50) {
        node.innerHTML = "";
        pool.push(node);
    }
}

export function fastUpdateNode(node, ctx, instance) {
    const flag = node.__hx_patchFlag || 0;
    if (!flag || flag === 0) return false;
    return true;
}

export function destroyNode(node) {
    if (!node || node.__hx_destroying) return;
    node.__hx_destroying = true;
    const runCleanups = (n) => {
        if (!n || n.__hx_cleaned) return;
        n.__hx_cleaned = true;
        if (n.__hx_cleanup) {
            const cleanups = n.__hx_cleanup;
            n.__hx_cleanup = null;
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch (e) {
                    handleError(e, "destroyNode cleanup");
                }
            });
        }
        if (n.__hx_binding && n.__hx_binding.cleanups) {
            const cleanups = n.__hx_binding.cleanups;
            n.__hx_binding.cleanups = [];
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch (e) {
                    handleError(e, "destroyNode binding cleanup");
                }
            });
        }
        if (n.__hx_scope) {
            if (n.__hx_scope.stop && typeof n.__hx_scope.stop === "function") {
                try {
                    n.__hx_scope.stop();
                } catch (e) {
                    handleError(e, "destroyNode scope stop");
                }
            }
            n.__hx_scope = null;
        }
        if (n.__hx_key !== undefined) {
            n.__hx_key = null;
        }
        if (n.nodeType === 1) Array.from(n.childNodes).forEach(runCleanups);
    };
    runCleanups(node);
    if (node.parentNode) node.remove();
    node[BOUND] = false;
    node.__hx_destroying = false;
}
