import {
    VERSION,
    globalPlugins,
    globalComponents,
    globalDirectives,
    incrementGlobalInstanceId,
    currentInstance,
    setCurrentInstance,
    warn,
    trace,
    handleError,
    satisfiesVersion,
    BOUND,
    logger
} from '../shared/shared.js';
import { globalConfig } from './config.js';
import { createBus } from './bus.js';
import { makeBindNode } from '../renderer/mount.js';
import { destroyNode } from '../renderer/node.js';
import {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly
} from '../reactivity/reactive.js';
import {
    ref,
    isRef,
    toRef,
    toRefs
} from '../reactivity/ref.js';
import { effect } from '../reactivity/effect.js';
import { computed } from '../reactivity/computed.js';
import { watch, watchEffect } from '../reactivity/watch.js';
import { nextTick } from '../shared/shared.js';
import {
    onMount,
    onMounted,
    onBeforeMount,
    onDestroy,
    onUnmounted,
    onBeforeUnmount,
    onUpdated,
    inject,
    provide
} from './lifecycle.js';
import { resolvePath } from '../compiler/compiler.js';

export function createApp(rootComponent = {}) {
    const appComponents = {};
    const appDirectives = {};
    const appPlugins = [];
    const appProvides = Object.create(null);
    let isMounted = false;
    let rootElement = null;
    let rootInstance = null;
    let unmountCallbacks = [];
    const appConfig = Object.create(globalConfig);
    Object.freeze(appConfig);
    const appContext = {
        config: appConfig,
        components: appComponents,
        directives: appDirectives,
        provides: appProvides,
        app: null
    };
    const bindNode = makeBindNode(appContext);
    
    const globalAPI = {
        reactive,
        shallowReactive,
        readonly,
        shallowReadonly,
        ref,
        isRef,
        toRef,
        toRefs,
        computed,
        effect,
        watch,
        watchEffect,
        nextTick,
        onMount,
        onMounted,
        onBeforeMount,
        onDestroy,
        onUnmounted,
        onBeforeUnmount,
        onUpdated,
        provide,
        inject,
        $bus: null,
        resolvePath
    };

    const app = {
        version: VERSION,
        config: appConfig,
        $bus: createBus(),
        rebind(node, options) {
            const binding = node.__hx_binding;
            const instance = (options && typeof options === "object" && options.instance) || (binding && binding.instance);
            if (!instance) {
                logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
                return;
            }
            const ctx = (options && typeof options === "object" && ("ctx" in options || "context" in options))
                ? (options.ctx || options.context)
                : options;
            if (binding && binding.bindNode) {
                binding.bindNode(node, ctx, instance, [], true);
            } else {
                bindNode(node, ctx, instance, [], true);
            }
        },
        component(name, definition) {
            if (typeof name !== "string") {
                warn(`Component name must be a string.`, "component");
                return app;
            }
            const key = name.toLowerCase();
            if (definition === void 0) return appComponents[key];
            appComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
            return app;
        },
        directive(name, definition) {
            if (typeof name !== "string") {
                warn(`Directive name must be a string.`, "directive");
                return app;
            }
            const key = name.toLowerCase();
            if (definition === void 0) return appDirectives[key];
            if (typeof definition === "function") {
                appDirectives[key] = {
                    mounted: definition,
                    updated: definition
                };
            } else {
                appDirectives[key] = definition;
            }
            return app;
        },
        removeDirective(name) {
            if (typeof name !== "string") {
                warn(`Directive name must be a string.`, "directive");
                return app;
            }
            const key = name.toLowerCase();
            delete appDirectives[key];
            return app;
        },
        removeNamespace(name) {
            if (typeof name !== "string") {
                warn(`Namespace name must be a string.`, "namespace");
                return app;
            }
            delete app._namespaces[name];
            return app;
        },
        unuse(plugin) {
            if (!plugin) return app;
            const idx = appPlugins.findIndex((p) => p.plugin === plugin || (plugin.name && p.name === plugin.name));
            if (idx > -1) {
                const entry = appPlugins[idx];
                if (typeof entry.cleanup === "function") {
                    try { entry.cleanup(); } catch (e) { handleError(e, `plugin cleanup: ${entry.name || "anonymous"}`); }
                }
                appPlugins.splice(idx, 1);
            }
            return app;
        },
        use(plugin, options = {}) {
            if (!plugin) return app;
            if (appPlugins.some((p) => p.plugin === plugin)) return app;

            if (plugin.name) {
                if (appPlugins.some((p) => p.name === plugin.name)) {
                    warn(`Plugin "${plugin.name}" is already installed on this app.`, "plugin");
                    return app;
                }
                if (plugin.requires && plugin.requires.helix) {
                    if (!satisfiesVersion(app.version, plugin.requires.helix)) {
                        warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but app version is ${app.version}.`, "plugin");
                        return app;
                    }
                }
            }

            const rawPluginAPI = {
                config: appConfig,
                component: app.component.bind(app),
                directive: app.directive.bind(app),
                removeDirective: app.removeDirective.bind(app),
                removeNamespace: app.removeNamespace.bind(app),
                provide: app.provide.bind(app),
                use: app.use.bind(app),
                unuse: app.unuse.bind(app),
                mount: app.mount.bind(app),
                unmount: app.unmount.bind(app),
                version: app.version,
                namespace: app.namespace.bind(app),
                registry: app.registry,
                $bus: app.$bus,
                reactive,
                shallowReactive,
                readonly,
                shallowReadonly,
                ref,
                isRef,
                toRef,
                toRefs,
                computed,
                effect,
                watch,
                watchEffect,
                nextTick,
                onMount,
                onMounted,
                onBeforeMount,
                onDestroy,
                onUnmounted,
                onBeforeUnmount,
                onUpdated,
                inject,
                resolvePath
            };

            const pluginAPI = new Proxy(rawPluginAPI, {
                get(target, prop, receiver) {
                    if (prop in target) return target[prop];
                    return app[prop];
                },
                set(target, prop, value, receiver) {
                    target[prop] = value;
                    app[prop] = value;
                    return true;
                },
                deleteProperty(target, prop) {
                    delete target[prop];
                    delete app[prop];
                    return true;
                }
            });

            let cleanup = null;
            let installPromise = null;
            if (typeof plugin.install === "function") {
                const result = plugin.install(pluginAPI, options);
                if (result && typeof result.then === "function") {
                    installPromise = result;
                } else {
                    cleanup = result;
                }
            } else if (typeof plugin === "function") {
                const result = plugin(pluginAPI, options);
                if (result && typeof result.then === "function") {
                    installPromise = result;
                } else {
                    cleanup = result;
                }
            }

            const entry = {
                plugin,
                options,
                name: plugin.name || null,
                version: plugin.version || null,
                cleanup: typeof cleanup === "function" ? cleanup : null,
                promise: installPromise || null,
                installedAt: Date.now(),
                _executed: true
            };
            appPlugins.push(entry);
            if (installPromise) {
                installPromise.then(() => { entry.promise = null; }).catch((err) => {
                    handleError(err, `async plugin install: ${plugin.name || "anonymous"}`);
                    entry.promise = null;
                });
            }
            return app;
        },
        provide(key, value) {
            appProvides[key] = value;
            return app;
        },
        async mount(rootSelector) {
            if (isMounted) {
                warn(`App already mounted. Call unmount() first.`, "core");
                return rootInstance;
            }
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) {
                warn(`[mount] Cannot find element: ${rootSelector}`, "core");
                return null;
            }

            const pendingAsync = appPlugins.filter((p) => p.promise).map((p) => p.promise);
            if (pendingAsync.length > 0) {
                await Promise.all(pendingAsync);
            }

            const instance = {
                id: incrementGlobalInstanceId(),
                root: rootElement,
                hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
                cleanups: [],
                provides: Object.create(appProvides)
            };
            rootInstance = instance;
            setCurrentInstance(instance);

            const pluginAPI = {
                config: appConfig,
                component: app.component.bind(app),
                directive: app.directive.bind(app),
                provide: app.provide.bind(app),
                use: app.use.bind(app),
                mount: app.mount.bind(app),
                unmount: app.unmount.bind(app),
                runWithContext: app.runWithContext.bind(app),
                version: app.version,
                namespace: app.namespace.bind(app),
                registry: app.registry,
                $bus: app.$bus,
                reactive,
                shallowReactive,
                readonly,
                shallowReadonly,
                ref,
                isRef,
                toRef,
                toRefs,
                computed,
                effect,
                watch,
                watchEffect,
                nextTick,
                onMount,
                onMounted,
                onBeforeMount,
                onDestroy,
                onUnmounted,
                onBeforeUnmount,
                onUpdated,
                inject,
                resolvePath
            };

            [...globalPlugins, ...appPlugins].forEach((p) => {
                if (p._executed) return;
                p._executed = true;
                if (typeof p.plugin.install === "function") {
                    const result = p.plugin.install(pluginAPI, p.options);
                    if (typeof result === "function" && !p.cleanup) p.cleanup = result;
                } else if (typeof p.plugin === "function") {
                    const result = p(pluginAPI, p.options);
                    if (typeof result === "function" && !p.cleanup) p.cleanup = result;
                }
            });

            globalAPI.$bus = app.$bus;
            const baseAppCtx = {
                ...globalAPI,
                ...pluginAPI,
                directive: app.directive.bind(app),
                watch,
                watchEffect,
                resolvePath,
                reactive,
                shallowReactive,
                readonly,
                shallowReadonly,
                ref,
                isRef,
                toRef,
                toRefs,
                computed,
                effect,
                nextTick,
                onMount,
                onMounted,
                onBeforeMount,
                onDestroy,
                onUnmounted,
                onBeforeUnmount,
                onUpdated,
                provide,
                inject,
                $bus: app.$bus
            };

            const appCtx = new Proxy(baseAppCtx, {
                get(target, prop, receiver) {
                    if (prop in target) return target[prop];
                    if (prop in app) return app[prop];
                    const globalHelix = (typeof window !== 'undefined' && window.Helix) ||
                        (typeof globalThis !== 'undefined' && globalThis.Helix) ||
                        null;
                    if (globalHelix && prop in globalHelix) return globalHelix[prop];
                    return undefined;
                },
                set(target, prop, value, receiver) {
                    target[prop] = value;
                    return true;
                },
                has(target, prop) {
                    if (prop in target) return true;
                    if (prop in app) return true;
                    const globalHelix = (typeof window !== 'undefined' && window.Helix) ||
                        (typeof globalThis !== 'undefined' && globalThis.Helix) ||
                        null;
                    if (globalHelix && prop in globalHelix) return true;
                    return false;
                },
                ownKeys(target) {
                    const keys = new Set(Reflect.ownKeys(target));
                    Reflect.ownKeys(app).forEach(k => keys.add(k));
                    const globalHelix = (typeof window !== 'undefined' && window.Helix) ||
                        (typeof globalThis !== 'undefined' && globalThis.Helix) ||
                        null;
                    if (globalHelix) {
                        Reflect.ownKeys(globalHelix).forEach(k => keys.add(k));
                    }
                    return Array.from(keys);
                },
                getOwnPropertyDescriptor(target, prop) {
                    const desc = Reflect.getOwnPropertyDescriptor(target, prop);
                    if (desc) return desc;
                    const appDesc = Reflect.getOwnPropertyDescriptor(app, prop);
                    if (appDesc) return appDesc;
                    const globalHelix = (typeof window !== 'undefined' && window.Helix) ||
                        (typeof globalThis !== 'undefined' && globalThis.Helix) ||
                        null;
                    if (globalHelix) {
                        const globalDesc = Reflect.getOwnPropertyDescriptor(globalHelix, prop);
                        if (globalDesc) return globalDesc;
                    }
                    return undefined;
                }
            });

            let ctx;
            try {
                if (typeof rootComponent === "function") {
                    ctx = rootComponent(appCtx);
                } else if (rootComponent.setup) {
                    ctx = rootComponent.setup(appCtx);
                } else {
                    ctx = reactive({});
                }
            } catch (err) {
                handleError(err, "Root setup");
                setCurrentInstance(null);
                return null;
            }
            setCurrentInstance(null);
            trace("Initial Mount Binding", () => bindNode(rootElement, ctx, instance));
            instance.hooks.beforeMount.forEach((fn) => fn());
            instance.hooks.mount.forEach((fn) => fn());
            isMounted = true;

            return instance;
        },
        unmount() {
            if (!isMounted || !rootElement) {
                warn(`App is not mounted.`, "core");
                return app;
            }
            if (rootInstance) {
                rootInstance.hooks.beforeUnmount.forEach((fn) => fn());
                rootInstance.cleanups.forEach((fn) => {
                    try { fn(); } catch (e) { handleError(e, "app unmount cleanup"); }
                });
                rootInstance.hooks.destroy.forEach((fn) => fn());
                rootInstance.hooks.unmounted.forEach((fn) => fn());
            }

            [...appPlugins].reverse().forEach((p) => {
                if (typeof p.cleanup === "function") {
                    try { p.cleanup(); } catch (e) { handleError(e, `plugin cleanup: ${p.name || "anonymous"}`); }
                }
            });

            Array.from(rootElement.childNodes).forEach((child) => destroyNode(child));
            if (rootElement.__hx_cleanup) {
                rootElement.__hx_cleanup.forEach((fn) => fn());
                rootElement.__hx_cleanup = null;
            }
            rootElement[BOUND] = false;
            unmountCallbacks.forEach((fn) => fn());
            isMounted = false;
            rootInstance = null;
            return app;
        },
        onAppUnmount(callback) {
            if (typeof callback === "function") unmountCallbacks.push(callback);
            return app;
        },
        registry: {
            list() {
                return appPlugins.map((p) => ({
                    name: p.name,
                    version: p.version,
                    installedAt: p.installedAt || null,
                    async: !!p.promise,
                    hasCleanup: !!p.cleanup
                }));
            },
            has(name) {
                return appPlugins.some((p) => p.name === name);
            },
            get(name) {
                const p = appPlugins.find((p) => p.name === name);
                if (!p) return null;
                return {
                    name: p.name,
                    version: p.version,
                    options: p.options,
                    installedAt: p.installedAt || null,
                    async: !!p.promise,
                    hasCleanup: !!p.cleanup
                };
            },
            dependsOn(pluginName, dependencyName) {
                const p = appPlugins.find((p) => p.name === pluginName);
                if (!p || !p.plugin || !p.plugin.requires) return false;
                const req = p.plugin.requires;
                if (req[dependencyName]) {
                    const dep = appPlugins.find((d) => d.name === dependencyName);
                    if (!dep) return false;
                    return satisfiesVersion(dep.version || "0.0.0", req[dependencyName]);
                }
                return false;
            },
            count() {
                return appPlugins.length;
            }
        },
        _namespaces: Object.create(null),
        namespace(name, apis) {
            if (typeof name !== "string") {
                warn(`Namespace name must be a string.`, "namespace");
                return app;
            }
            if (apis === void 0) {
                return app._namespaces[name] || Object.create(null);
            }
            if (typeof apis === "object" && apis !== null) {
                if (!app._namespaces[name]) app._namespaces[name] = Object.create(null);
                Object.keys(apis).forEach((key) => {
                    if (app._namespaces[name][key] !== undefined) {
                        warn(`Namespace "${name}" already has API "${key}". Overwriting.`, "namespace");
                    }
                    app._namespaces[name][key] = apis[key];
                });
            }
            return app;
        },
        onUnmount(callback) {
            warn(`[Helix] app.onUnmount is deprecated. Use app.onAppUnmount instead.`, "config");
            return app.onAppUnmount(callback);
        },
        runWithContext(fn) {
            const prevInstance = currentInstance;
            const tempInstance = { provides: appProvides, parent: null };
            setCurrentInstance(tempInstance);
            try {
                return fn();
            } finally {
                setCurrentInstance(prevInstance);
            }
        }
    };

    appContext.app = app;
    return app;
}
