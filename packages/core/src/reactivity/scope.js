import { EffectScope, activeScope, setActiveScope, currentInstance, handleError, warn } from '../shared/shared.js';

export function effectScope(detached = false) {
    const scope = new EffectScope();
    if (!detached && activeScope) {
        if (!activeScope.scopes) activeScope.scopes = [];
        activeScope.scopes.push(scope);
    }
    return scope;
}

export function getCurrentScope() {
    return activeScope;
}

export function onScopeDispose(fn) {
    if (typeof fn !== 'function') return;
    if (activeScope) {
        if (!activeScope.cleanups) activeScope.cleanups = [];
        activeScope.cleanups.push(fn);
    } else if (currentInstance && currentInstance.scope) {
        if (!currentInstance.scope.cleanups) currentInstance.scope.cleanups = [];
        currentInstance.scope.cleanups.push(fn);
    } else if (currentInstance && currentInstance.cleanups) {
        currentInstance.cleanups.push(fn);
    } else {
        warn("onScopeDispose() called with no active EffectScope or instance lifecycle.", "scope");
    }
}
