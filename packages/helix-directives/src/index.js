import { createDebounceDirective } from './directives/debounce.js';

// Directive factories, keyed by the name they're registered under.
// Each factory is (app, config) => directiveDefinition.
// Adding a new directive later: write src/directives/whatever.js exporting
// createWhateverDirective(app, config), import it above, add one line here.
const directiveFactories = {
    debounce: createDebounceDirective
};

const HelixDirectivesPlugin = {
    name: 'directives',
    version: import.meta.env.VITE_DIRECTIVES_VERSION || '0.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {
        const config = { ...options };
        const debug = !!config.debug;

        const isReconfigure = !!app.__helixDirectivesInstalled;

        const registeredNames = [];
        for (const [name, factory] of Object.entries(directiveFactories)) {
            if (typeof app.directive !== 'function') break;
            const def = factory(app, config);
            app.directive(name, def);
            registeredNames.push(name);
        }

        if (debug) console.log(`[directives] ${isReconfigure ? 're-installed (reconfigured)' : 'installed'}:`, registeredNames, '| config:', config);

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

        app.__helixDirectivesInstalled = true;

        return () => {
            registeredNames.forEach(name => {
                if (typeof app.removeDirective === 'function') app.removeDirective(name);
            });
            if (app.$directives === api) delete app.$directives;
            delete app.__helixDirectivesInstalled;
            if (bus && typeof bus.emit === 'function') {
                try { bus.emit('plugin:directives:destroyed', { version: HelixDirectivesPlugin.version }); } catch (e) {}
            }
        };
    }
};

// Expose globally AND autoload with zero required setup.
//
// If Helix is already present when this script runs, install immediately
// with default options — no explicit Helix.use() call needed for the common
// case of "just give me h-debounce with defaults".
//
// This calls install() DIRECTLY, not Helix.use(). That's deliberate: Helix.use()
// registers the plugin in Core's plugin registry under its name, and Core
// rejects a second install under the same name — so if the autoload used
// Helix.use(), a later explicit Helix.use(HelixDirectivesPlugin, { debug: true })
// call would be silently rejected, unable to actually apply real options
// (this was the exact bug this plugin previously had, and the one every other
// plugin in this ecosystem still avoids by not auto-installing at all).
// Calling install() directly never touches that registry, so it doesn't
// occupy a slot — a later Helix.use(HelixDirectivesPlugin, options) still
// works normally, and install()'s own guard above (isReconfigure) allows it
// to safely re-run and apply the new options on top.
const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixDirectivesPlugin = HelixDirectivesPlugin;

if (root.Helix && typeof root.Helix.directive === 'function') {
    HelixDirectivesPlugin.install(root.Helix, {});
}

export default HelixDirectivesPlugin;
