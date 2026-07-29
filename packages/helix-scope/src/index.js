import { createScopeDirective } from './directive.js';
import { ScopeManager } from './manager.js';

const HelixScopePlugin = {
    name: 'scope',
    version: import.meta.env.VITE_SCOPE_VERSION || '0.0.0',
    install(app, options = {}) {
        app.directive('scope', createScopeDirective(app));

        const root = (typeof window !== 'undefined' ? window : globalThis);
        if (root.Helix) {
            if (Object.isExtensible(root.Helix)) {
                root.Helix.scope = ScopeManager;
                root.Helix.$scope = ScopeManager;
            }
        }

        if (Object.isExtensible(app)) {
            app.$scope = ScopeManager;
        }
    }
};

HelixScopePlugin.ScopeManager = ScopeManager;

// Register globally — run synchronously so the directive is available
// before Helix.mount() processes the DOM.
const root = (typeof window !== 'undefined' ? window : globalThis);
if (root.Helix) {
    if (typeof root.Helix.directive === 'function') {
        root.Helix.directive('scope', createScopeDirective(root.Helix));
    }
    if (Object.isExtensible(root.Helix)) {
        root.Helix.scope = ScopeManager;
        root.Helix.$scope = ScopeManager;
    }
} else if (typeof console !== 'undefined') {
    console.warn('[helix-scope] Helix not found - load helix.js before this script.');
}

export default HelixScopePlugin;
