import {
    VERSION,
    globalPlugins,
    globalDirectives,
    globalComponents,
    satisfiesVersion,
    handleError,
    warn
} from '../shared/shared.js';

export function definePlugin(definition) {
    if (typeof definition === "function") {
        return {
            name: definition.name || "anonymous-plugin",
            install: definition
        };
    }
    if (typeof definition === "object" && definition !== null) {
        if (typeof definition.install !== "function" && typeof definition.setup !== "function") {
            warn("Plugin definition missing 'install' or 'setup' method.", "plugin");
        }
        return definition;
    }
    throw new TypeError("Plugin definition must be a function or an object with an install method.");
}

export function validatePluginDependencies(plugin, helixVersion = VERSION) {
    if (!plugin || typeof plugin !== "object" || !plugin.requires) return true;
    const req = plugin.requires;
    let valid = true;
    Object.keys(req).forEach((depName) => {
        const expectedRange = req[depName];
        if (depName === "helix" || depName === "helix-core") {
            if (!satisfiesVersion(helixVersion, expectedRange)) {
                warn(`Plugin "${plugin.name}" requires Helix ${expectedRange}, but current version is ${helixVersion}.`, "plugin");
                valid = false;
            }
        } else {
            const installed = globalPlugins.find((p) => p.name === depName || (p.plugin && p.plugin.name === depName));
            if (!installed) {
                warn(`Plugin "${plugin.name}" requires missing dependency "${depName}" (${expectedRange}).`, "plugin");
                valid = false;
            } else if (expectedRange && !satisfiesVersion(installed.version || "0.0.0", expectedRange)) {
                warn(`Plugin "${plugin.name}" requires ${depName} ${expectedRange}, but found ${installed.version}.`, "plugin");
                valid = false;
            }
        }
    });
    return valid;
}

export function triggerPluginLifecycle(hookName, HelixAPI, options = {}) {
    globalPlugins.forEach((entry) => {
        const plugin = entry.plugin;
        if (!plugin || typeof plugin !== "object") return;
        const hook = plugin[hookName];
        if (typeof hook === "function") {
            try {
                hook.call(plugin, HelixAPI, entry.options || options);
            } catch (err) {
                handleError(err, `Plugin lifecycle ${hookName}: ${entry.name || "anonymous"}`);
            }
        }
    });
}

export function validatePluginOptions(options = {}, schema = {}) {
    if (!schema || typeof schema !== "object") return options;
    const validated = { ...options };
    Object.keys(schema).forEach((key) => {
        const spec = schema[key];
        if (validated[key] === undefined && spec.default !== undefined) {
            validated[key] = typeof spec.default === "function" ? spec.default() : spec.default;
        }
        if (spec.required && validated[key] === undefined) {
            warn(`Plugin option '${key}' is required.`, "plugin");
        }
        if (spec.type && validated[key] !== undefined) {
            const actualType = Array.isArray(validated[key]) ? "array" : typeof validated[key];
            if (actualType !== spec.type) {
                warn(`Plugin option '${key}' expected type '${spec.type}', received '${actualType}'.`, "plugin");
            }
        }
    });
    return validated;
}

export function createPluginRegistry() {
    return {
        list() {
            return globalPlugins.map((p) => ({
                name: p.name,
                version: p.version,
                installedAt: p.installedAt || null,
                hasCleanup: !!p.cleanup,
                namespaces: p.namespaces || [],
                directives: p.directives || [],
                components: p.components || []
            }));
        },
        has(name) {
            return globalPlugins.some((p) => p.name === name);
        },
        get(name) {
            const p = globalPlugins.find((p) => p.name === name);
            if (!p) return null;
            return {
                name: p.name,
                version: p.version,
                installedAt: p.installedAt || null,
                hasCleanup: !!p.cleanup,
                namespaces: p.namespaces || [],
                directives: p.directives || [],
                components: p.components || [],
                plugin: p.plugin
            };
        },
        dependsOn(pluginName, dependencyName) {
            const p = globalPlugins.find((p) => p.name === pluginName);
            if (!p || !p.plugin || !p.plugin.requires) return false;
            const req = p.plugin.requires;
            if (req[dependencyName]) {
                const dep = globalPlugins.find((d) => d.name === dependencyName);
                if (!dep) return false;
                return satisfiesVersion(dep.version || "0.0.0", req[dependencyName]);
            }
            return false;
        },
        getByNamespace(ns) {
            return globalPlugins.filter((p) => p.namespaces && p.namespaces.includes(ns));
        },
        count() {
            return globalPlugins.length;
        }
    };
}
