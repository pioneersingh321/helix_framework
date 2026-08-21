/**
 * Scope Binding for Helix Store
 * Integrates stores with Helix.scope lifecycle
 */

export function bindScopeStore(scopeInstance, managerOrPlugin, storeId, definition) {
  if (!scopeInstance) return null;

  const resolveFn = typeof managerOrPlugin?.resolveStore === 'function' 
    ? managerOrPlugin.resolveStore.bind(managerOrPlugin)
    : (typeof managerOrPlugin?.store === 'function' ? managerOrPlugin.store : managerOrPlugin);

  const storeInstance = resolveFn(storeId, definition, scopeInstance);

  if (typeof scopeInstance.onDispose === 'function') {
    scopeInstance.onDispose(() => {
      storeInstance.$dispose();
    });
  } else if (typeof scopeInstance.onUnmounted === 'function') {
    scopeInstance.onUnmounted(() => {
      storeInstance.$dispose();
    });
  }

  return storeInstance;
}
