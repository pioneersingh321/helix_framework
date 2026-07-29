export function inspectComponent(instance) {
    if (!instance) return null;
    return {
        id: instance.id || null,
        name: instance.name || "Anonymous",
        root: instance.root || null,
        parent: instance.parent ? { id: instance.parent.id, name: instance.parent.name } : null,
        provides: instance.provides ? { ...instance.provides } : {},
        cleanupsCount: instance.cleanups ? instance.cleanups.length : 0,
        hooks: instance.hooks ? {
            beforeMount: instance.hooks.beforeMount ? instance.hooks.beforeMount.length : 0,
            mount: instance.hooks.mount ? instance.hooks.mount.length : 0,
            updated: instance.hooks.updated ? instance.hooks.updated.length : 0,
            beforeUnmount: instance.hooks.beforeUnmount ? instance.hooks.beforeUnmount.length : 0,
            unmounted: instance.hooks.unmounted ? instance.hooks.unmounted.length : 0
        } : {},
        hasScope: !!instance.scope
    };
}
