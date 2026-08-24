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
import { createEventMethods } from './events.js';
import { createIdMethods } from './id.js';

const HelixHelpersPlugin = {

    name: 'helpers',
    version: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_HELPERS_VERSION) || '1.1.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {
        const _timerCancels = new Set();
        const logWarn = (msg, err) => {
            if (options.debug && typeof console !== 'undefined' && console.warn) {
                console.warn(`[Helix Helpers] ${msg}:`, err);
            }
        };

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
            createAsyncMethods(H, _timerCancels),
            createEventMethods(H),
            createIdMethods(H, app)
        );

        // ═══════════════════════════════════════════════════════════════
        // REGISTRATION
        // ═══════════════════════════════════════════════════════════════

        // Optional namespace (guarded)
        if (typeof app.namespace === 'function') {
            try { app.namespace('helpers', H); } catch (e) { logWarn('Failed to register namespace', e); }
        }

        // Flat access: app.$h.camelCase(...)
        app.$h = H;

        // Injectable access for components using inject('$h')
        if (typeof app.provide === 'function') {
            try {
                app.provide('helper', H);
                app.provide('$h', H);
            } catch (e) { logWarn('Failed to provide $h', e); }
        }

        const bus = app.$bus || app.bus || (typeof window !== 'undefined' && window.Helix && window.Helix.$bus);
        if (bus && typeof bus.emit === 'function') {
            try { bus.emit('plugin:helpers:installed', { version: HelixHelpersPlugin.version }); } catch (e) { logWarn('Failed to emit install event', e); }
        }

        if (typeof window !== 'undefined') {
            window.HelixHelpers = H;
        }

        const cleanup = () => {
            _timerCancels.forEach(cancel => { try { cancel(); } catch (e) { } });
            _timerCancels.clear();
            if (typeof window !== 'undefined') {
                delete window.HelixHelpers;
            }
            if (app.$h === H) delete app.$h;
            if (app._provides) {
                if (app._provides['$h'] === H) delete app._provides['$h'];
                if (app._provides['helper'] === H) delete app._provides['helper'];
            }
            if (app.provides) {
                if (app.provides['$h'] === H) delete app.provides['$h'];
                if (app.provides['helper'] === H) delete app.provides['helper'];
            }
            if (bus && typeof bus.emit === 'function') {
                try { bus.emit('plugin:helpers:destroyed'); } catch (e) { logWarn('Failed to emit destroy event', e); }
            }
        };

        return cleanup;
    }
};

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixHelpersPlugin = HelixHelpersPlugin;

export default HelixHelpersPlugin;
