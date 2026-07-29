export function onComponentMount(instance, callback) {
    let root = instance;
    while (root && root.parent) {
        root = root.parent;
    }
    if (root && root.hooks && Array.isArray(root.hooks.mount)) {
        root.hooks.mount.push(callback);
    } else {
        callback();
    }
}
