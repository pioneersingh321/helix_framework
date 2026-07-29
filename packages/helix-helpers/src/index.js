import { createTypeMethods } from './types.js';
import { createStringMethods } from './string.js';
import { createArrayMethods } from './array.js';
import { createObjectMethods } from './object.js';
import { createDateMethods } from './date.js';
import { createNumberMethods } from './number.js';
import { createValidationMethods } from './validation.js';
import { createDomMethods } from './dom.js';
import { createDataMethods } from './data.js';
import { createAsyncMethods } from './async.js';

const HelixHelpersPlugin = {

    name: 'helpers',
    version: import.meta.env.VITE_HELPERS_VERSION || '0.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {
        const _timerCancels = new Set();

        // H is built progressively, but every section closes over this same
        // object reference — cross-references like H.get(...) inside groupBy()
        // or H.wait(...) inside retry() resolve correctly at CALL time (once H
        // is fully populated below), not at definition time. Mirrors how the
        // original single object-literal version worked (self-referencing via
        // shorthand methods that all existed on the same object by the time
        // any of them actually ran).
        const H = {};
        Object.assign(
            H,
            createTypeMethods(H),
            createStringMethods(H),
            createArrayMethods(H),
            createObjectMethods(H, app),
            createDateMethods(H),
            createNumberMethods(H),
            createValidationMethods(H),
            createDomMethods(H),
            createDataMethods(H),
            createAsyncMethods(H, _timerCancels)
        );

        // ═══════════════════════════════════════════════════════════════
        // REGISTRATION
        // ═══════════════════════════════════════════════════════════════

        // Optional namespace (guarded)
        if (typeof app.namespace === 'function') {
            try { app.namespace('helpers', H); } catch (e) { }
        }

        // Flat access, matching the $notify / $device convention: app.$h.camelCase(...)
        app.$h = H;

        // Injectable access for components using inject('$h')
        if (typeof app.provide === 'function') {
            try {
                app.provide('helper', H);
                app.provide('$h', H);
            } catch (e) { }
        }

        const bus = app.$bus || app.bus || (typeof window !== 'undefined' && window.Helix && window.Helix.$bus);
        if (bus && typeof bus.emit === 'function') {
            try { bus.emit('plugin:helpers:installed', { version: HelixHelpersPlugin.version }); } catch (e) { }
        }

        if (typeof window !== 'undefined') {
            window.HelixHelpers = H;
            window.__HELIX_HELPERS__ = H;
        }

        // NOTE: app.onAppUnmount does not exist on the pluginAPI object the framework
        // passes to install() (only app.unmount()/instance-level lifecycle hooks are
        // exposed there, and install() is always called with exactly 2 arguments —
        // no third `instance` param). Registering cleanup that way would be a silent
        // no-op. Instead, return a cleanup function: the framework stores whatever
        // install() returns as the plugin's cleanup and calls it automatically from
        // app.unmount().
        const cleanup = () => {
            _timerCancels.forEach(cancel => { try { cancel(); } catch (e) { } });
            _timerCancels.clear();
            if (typeof window !== 'undefined') {
                delete window.HelixHelpers;
                delete window.__HELIX_HELPERS__;
            }
            if (app.$h === H) delete app.$h;
            if (bus && typeof bus.emit === 'function') {
                try { bus.emit('plugin:helpers:destroyed'); } catch (e) { }
            }
        };

        return cleanup;
    }
};

// Expose globally for `Helix.use(HelixHelpersPlugin, options)`.
// Not auto-installed — matches every sibling plugin (scope, loader, fetch, axios,
// model, tooltip): auto-installing at script-load with no options would silently
// block a later Helix.use(HelixHelpersPlugin, options) call from actually applying
// options, since core's plugin registry rejects a second install under the same
// name. (This plugin has no options today, but the pattern should stay consistent
// with the rest of the ecosystem regardless.)
const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixHelpersPlugin = HelixHelpersPlugin;

if (root.Helix && typeof root.Helix.reactive === 'function') {
    HelixHelpersPlugin.install(root.Helix, {});
}

export default HelixHelpersPlugin;
