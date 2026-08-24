import { createDebounceDirective } from './directives/debounce.js';
import { createCollapseDirective } from './directives/collapse.js';
import { createTrapDirective } from './directives/trap.js';
import { createClipboardDirective } from './directives/clipboard.js';
import { createIntersectDirective } from './directives/intersect.js';

// Directive factories, keyed by the name they're registered under.
const directiveFactories = {
    debounce: createDebounceDirective,
    collapse: createCollapseDirective,
    trap: createTrapDirective,
    clipboard: createClipboardDirective,
    intersect: createIntersectDirective
};

const HelixDirectivesPlugin = {
    name: 'directives',
    version: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DIRECTIVES_VERSION) || '2.2.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {
        const config = { ...options };
        const debug = !!config.debug;

        const registeredNames = [];
        for (const [name, factory] of Object.entries(directiveFactories)) {
            if (typeof app.directive !== 'function') break;
            const def = factory(app, config);
            app.directive(name, def);
            registeredNames.push(name);
        }

        if (debug) console.log('[directives] installed:', registeredNames, '| config:', config);

        const api = {
            names: registeredNames,
            version: HelixDirectivesPlugin.version
        };

        if (typeof app.namespace === 'function') {
            try { app.namespace('directives', api); } catch (e) {}
        }

        app.$directives = api;

        if (typeof app.provide === 'function') {
            try { app.provide('$directives', api); } catch (e) {}
        }

        const bus = app.$bus || (typeof window !== 'undefined' && window.Helix && window.Helix.$bus);
        if (bus && typeof bus.emit === 'function') {
            try { bus.emit('plugin:directives:installed', { version: HelixDirectivesPlugin.version, names: registeredNames }); } catch (e) {}
        }

        return () => {
            registeredNames.forEach(name => {
                if (typeof app.removeDirective === 'function') app.removeDirective(name);
            });
            if (app.$directives === api) delete app.$directives;
            if (typeof app.removeNamespace === 'function') {
                try { app.removeNamespace('directives'); } catch (e) {}
            }
            if (bus && typeof bus.emit === 'function') {
                try { bus.emit('plugin:directives:destroyed', { version: HelixDirectivesPlugin.version }); } catch (e) {}
            }
        };
    }
};

// Expose globally on window / globalThis for script-tag usage
const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixDirectivesPlugin = HelixDirectivesPlugin;

export default HelixDirectivesPlugin;
