import { config } from './config.js';
import { model } from './model.js';

const HelixModelPlugin = {
  // ==========================================
  // PLUGIN METADATA (Helix v11.1.5)
  // ==========================================
  name: 'model',
  version: import.meta.env.VITE_MODEL_VERSION || '0.0.0',
  requires: {
    helix: '>=11.1.5'
  },

  install(app, options = {}) {
    if (options.asyncBatchSize) config.asyncBatchSize = options.asyncBatchSize;
    if (options.maxHeapSize) config.maxHeapSize = options.maxHeapSize;
    config.app = app;

    // ==========================================
    // NAMESPACED API REGISTRATION (Helix v11.1.5)
    // ==========================================
    app.namespace('model', {
      $model: model,
      macro: model.macro,
      registerOperator: model.registerOperator
    });

    // Backward compatibility: flat access
    app.$model = model;

    // Provide for inject()
    if (app.provide) {
      app.provide('$model', model);
    }

    // ==========================================
    // CLEANUP LIFECYCLE (Helix v11.1.5)
    // ==========================================
    // Return cleanup function — Helix calls it on app.unmount()
    return () => {
      // Model plugin is mostly stateless per-query.
      // Queries created via app.$model() hold their own state.
      // No global resources to release.
    };
  }
};

// Expose globally AND autoload with zero required setup.
//
// If Helix is already present when this script runs, install immediately
// with default config (asyncBatchSize: 8, maxHeapSize: 1000) — no explicit
// Helix.use() call needed for app.$model / bare model() usage to work.
//
// This calls install() DIRECTLY, not Helix.use(). Helix.use() registers the
// plugin in Core's plugin registry under its name, and Core rejects a second
// install under the same name — so if the autoload used Helix.use(), a later
// explicit Helix.use(HelixModelPlugin, { asyncBatchSize, maxHeapSize }) call
// would be silently rejected, unable to actually apply real options (this was
// the exact bug an earlier version of this plugin had). Calling install()
// directly never touches that registry, so it doesn't occupy a slot — a later
// Helix.use(HelixModelPlugin, options) still works normally and overrides the
// autoloaded config.asyncBatchSize/maxHeapSize on top (safe to re-run: it's
// just reassigning a few fields on the shared config object and re-registering
// the same namespace/provide/app.$model bindings).

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixModelPlugin = HelixModelPlugin;

if (root.Helix && typeof root.Helix.namespace === 'function') {
  HelixModelPlugin.install(root.Helix, {});
}

export default HelixModelPlugin;
export { model };
