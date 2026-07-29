'use strict';

/**
 * Helix Plugin Logger & Registry v2.2 (Helix v11.1.6+)
 * Non-destructive interception with full safety guards.
 *
 * Disable in production: window.__HELIX_DISABLE_PLUGIN_LOGGER__ = true;
 */
(function () {
    // ── 1. EARLY EXITS ──
    if (typeof window === 'undefined') return;
    if (window.__HELIX_DISABLE_PLUGIN_LOGGER__) return;
    if (window.Helix && window.Helix._pluginLoggerInstalled) return;

    const registry = [];
    const pluginMap = new Map();
    const appUseWrappers = new WeakMap(); // Prevent duplicate wrapping per app instance

    // ── 2. SAFE CONSOLE ──
    const safeConsole = {
        groupCollapsed: (...args) => {
            if (typeof console.groupCollapsed === 'function') console.groupCollapsed(...args);
        },
        groupEnd: () => {
            if (typeof console.groupEnd === 'function') console.groupEnd();
        },
        log: (...args) => {
            if (typeof console.log === 'function') console.log(...args);
        },
        table: (...args) => {
            if (typeof console.table === 'function') console.table(...args);
        },
        warn: (...args) => {
            if (typeof console.warn === 'function') console.warn(...args);
        }
    };

    // ── 3. PLUGIN LOGGER ──
    const logPlugin = (plugin, options, source = 'unknown', bus = null) => {
        const declaredName = plugin?.name || plugin?.META?.name || null;
        const meta = {
            name: declaredName || 'anonymous',
            version: plugin?.version || plugin?.META?.version || 'unknown',
            requires: plugin?.requires || plugin?.dependencies || null,
            options: options === undefined ? undefined : { ...options },
            source,
            timestamp: new Date().toISOString()
        };

        // Only dedupe on genuinely declared names. Anonymous plugins have no
        // reliable identity to dedupe on — every one of them defaults to the
        // literal string 'anonymous', so treating that as a real key would
        // silently drop every anonymous plugin after the first.
        if (declaredName && pluginMap.has(meta.name)) {
            safeConsole.warn(`%c[Helix Plugin Logger] Duplicate plugin name ignored: "${meta.name}"`, 'color:#f59e0b;font-weight:bold');
            return pluginMap.get(meta.name);
        }

        safeConsole.groupCollapsed(
            `%c[Helix Plugin] ${meta.name}@${meta.version} [${source}]`,
            'color:#3b82f6;font-weight:bold'
        );
        safeConsole.log('Options:', meta.options);
        if (meta.requires) safeConsole.log('Requires:', meta.requires);
        safeConsole.log('Registered at:', meta.timestamp);
        safeConsole.groupEnd();

        registry.push(meta);
        // Only index genuinely-named plugins in pluginMap — keying multiple
        // distinct anonymous plugins under the same 'anonymous' key would make
        // getPlugin()/hasPlugin() return the wrong entry.
        if (declaredName) pluginMap.set(meta.name, meta);

        // Emit on the correct bus instance
        if (bus && typeof bus.emit === 'function') {
            try { bus.emit('plugin:registered', meta); } catch (e) { }
        }
        return meta;
    };

    // ── 4. PATCH HELIX (with freeze/seal guards) ──
    const patchHelix = (Helix) => {
        if (!Helix || Helix._pluginLoggerInstalled) return;

        // Mark safely — ignore if object is frozen/sealed
        try {
            Helix._pluginLoggerInstalled = true;
        } catch (e) {
            safeConsole.warn('[Helix Plugin Logger] Could not mark Helix (frozen/sealed). Logging may be unstable.');
        }

        // Capture the correct bus instance for this Helix object
        const bus = Helix?.$bus || null;

        // Intercept Helix.use()
        if (typeof Helix.use === 'function' && !Helix._originalHelixUse) {
            const originalHelixUse = Helix.use;
            Helix._originalHelixUse = originalHelixUse; // Preserve for introspection
            Helix.use = function (plugin, options) {
                const result = originalHelixUse.apply(this, arguments);
                // useGlobal() silently no-ops (no throw) when the plugin is
                // already registered under the same name or fails a
                // requires.helix version check, so a call reaching here isn't
                // proof the plugin actually got installed. Verify against the
                // real registry before reporting success.
                const name = plugin?.name || plugin?.META?.name;
                const actuallyInstalled = !name || (this.registry && this.registry.has(name));
                if (actuallyInstalled) {
                    logPlugin(plugin, options, 'Helix.use', bus);
                } else {
                    safeConsole.warn(`%c[Helix Plugin Logger] "${name}" was rejected by Helix.use() (duplicate name or unmet version requirement) — not logged.`, 'color:#ef4444;font-weight:bold');
                }
                return result;
            };
        }

        // Intercept Helix.createApp()
        if (typeof Helix.createApp === 'function' && !Helix._originalCreateApp) {
            const originalCreateApp = Helix.createApp;
            Helix._originalCreateApp = originalCreateApp;
            Helix.createApp = function (...args) {
                const app = originalCreateApp.apply(this, args);

                if (app && typeof app.use === 'function' && !appUseWrappers.has(app)) {
                    const originalAppUse = app.use;
                    app._originalAppUse = originalAppUse;
                    app.use = function (plugin, options) {
                        const result = originalAppUse.apply(this, arguments);
                        // Same rationale as Helix.use above: app.use() also
                        // silently no-ops on duplicate name / version mismatch /
                        // re-adding the same plugin object, so confirm via
                        // app.registry before logging a "registered" entry.
                        const name = plugin?.name || plugin?.META?.name;
                        const actuallyInstalled = !name || (this.registry && this.registry.has(name));
                        if (actuallyInstalled) {
                            logPlugin(plugin, options, 'app.use', bus);
                        } else {
                            safeConsole.warn(`%c[Helix Plugin Logger] "${name}" was rejected by app.use() (duplicate name or unmet version requirement) — not logged.`, 'color:#ef4444;font-weight:bold');
                        }
                        return result;
                    };
                    appUseWrappers.set(app, true);
                }

                // Retroactively log any plugins already registered internally by
                // createApp. NOTE: apps never expose a `$plugins` array (that was
                // a private closure variable named `appPlugins` in core, never
                // attached to the returned app object) — the only public surface
                // for already-installed plugins is app.registry.list(), whose
                // entries carry {name, version, installedAt, hasCleanup} but not
                // the original options/requires, so those fields will show as
                // unavailable here.
                if (app?.registry && typeof app.registry.list === 'function') {
                    app.registry.list().forEach(p => {
                        const name = p.name || 'anonymous';
                        if (p.name && !pluginMap.has(name)) {
                            logPlugin({ name: p.name, version: p.version }, undefined, 'app.internal', bus);
                        }
                    });
                }

                return app;
            };
        }

        // ── 5. EXPOSE TELEMETRY (safe injection) ──
        const inject = (key, value) => {
            if (!(key in Helix)) {
                try { Helix[key] = value; } catch (e) { }
            }
        };

        inject('$plugins', registry);
        inject('$pluginMap', pluginMap);

        if (!('listPlugins' in Helix)) {
            Helix.listPlugins = () => {
                safeConsole.table(registry.map(p => ({
                    Name: p.name,
                    Version: p.version,
                    Source: p.source,
                    Requires: p.requires ? JSON.stringify(p.requires) : '-',
                    'Registered At': p.timestamp
                })));
                return [...registry]; // Return copy, not reference
            };
        }

        if (!('getPlugin' in Helix)) {
            Helix.getPlugin = (name) => pluginMap.get(name);
        }
        if (!('hasPlugin' in Helix)) {
            Helix.hasPlugin = (name) => pluginMap.has(name);
        }

        // ── 6. RETROACTIVE SCAN (deferred, non-enumerable aware) ──
        const runRetroactiveScan = () => {
            let found = 0;
            const keys = Object.getOwnPropertyNames(window);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (!/^Helix.*Plugin$/i.test(key)) continue; // Case-insensitive regex
                const plugin = window[key];
                if (
                    plugin &&
                    (typeof plugin.install === 'function' || typeof plugin === 'function') &&
                    (plugin.name || key)
                ) {
                    const standardizedPlugin = {
                        name: plugin.name || key,
                        version: plugin.version || 'unknown',
                        requires: plugin.requires || null,
                        install: plugin.install || plugin
                    };
                    if (!pluginMap.has(standardizedPlugin.name)) {
                        logPlugin(standardizedPlugin, undefined, 'auto-detected (pre-loaded)', bus);
                        found++;
                    }
                }
            }
            if (found) {
                safeConsole.log(
                    `%c[Helix Plugin Logger] Retroactively found ${found} pre-loaded plugin(s).`,
                    'color:#f59e0b;font-weight:bold'
                );
            }
        };

        // Defer scan to avoid blocking initial paint
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(runRetroactiveScan, { timeout: 2000 });
        } else {
            setTimeout(runRetroactiveScan, 0);
        }

        safeConsole.log(
            '%c[Helix Plugin Logger] Active — intercepting Helix.use() and app.use()',
            'color:#10b981;font-weight:bold'
        );
    };

    // ── 7. ACCESSOR TRAP (permanent, no self-destruct) ──
    let currentHelix = window.Helix;
    let isSetting = false;

    if (currentHelix) {
        patchHelix(currentHelix);
    } else {
        Object.defineProperty(window, 'Helix', {
            configurable: true,
            enumerable: true,
            get() {
                return currentHelix;
            },
            set(val) {
                if (isSetting) return;
                isSetting = true;
                try {
                    currentHelix = val;
                    if (val && typeof val === 'object') patchHelix(val);
                } finally {
                    isSetting = false;
                }
            }
        });
    }
})();