import {
    VERSION,
    globalPlugins,
    globalComponents,
    globalDirectives,
    incrementGlobalInstanceId,
    currentInstance,
    setCurrentInstance,
    EffectScope,
    globalApps,
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
    let mountedRootSelector = null;
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

    let rootCtx = null;

    const app = {
        version: VERSION,
        config: appConfig,
        $bus: createBus(),
        rebind(node, options) {
            if (typeof node === "string") {
                node = document.querySelector(node);
            }
            if (node && !node.nodeType && (typeof node.length === "number" || typeof node[Symbol.iterator] === "function")) {
                Array.from(node).forEach(n => this.rebind(n, options));
                return;
            }
            if (!node || node.nodeType !== 1) return;

            const binding = node.__hx_binding;
            const instance = (options && typeof options === "object" && options.instance) || (binding && binding.instance) || rootInstance;
            let ctx = (options && typeof options === "object" && ("ctx" in options || "context" in options))
                ? (options.ctx || options.context)
                : (options || (binding && binding.ctx) || rootCtx);
            if (!ctx) ctx = rootCtx;

            if (!instance || !ctx) {
                logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
                return;
            }

            const activeBindNode = (binding && binding.bindNode) || bindNode;
            const allElements = [node, ...Array.from(node.querySelectorAll('*'))];
            allElements.forEach(el => {
                if (el.__hx_binding && el.__hx_binding.cleanups) {
                    el.__hx_binding.cleanups.forEach((fn) => {
                        try { fn(); } catch (e) {}
                    });
                    el.__hx_binding.cleanups.length = 0;
                }
                el[BOUND] = false;
                el.__hx_static = false;
                activeBindNode(el, ctx, instance, [], true);
            });
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
            const installMethod = typeof plugin.install === "function" ? plugin.install : (typeof plugin.setup === "function" ? plugin.setup : (typeof plugin === "function" ? plugin : null));
            if (installMethod) {
                try {
                    const result = installMethod(pluginAPI, options);
                    if (result && typeof result.then === "function") {
                        installPromise = result;
                    } else if (typeof result === "function") {
                        cleanup = result;
                    }
                } catch (err) {
                    handleError(err, `plugin install: ${plugin.name || "anonymous"}`);
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

            if (typeof document !== "undefined" && document.readyState === "loading") {
                await new Promise((resolve) => {
                    document.addEventListener("DOMContentLoaded", resolve, { once: true });
                });
            }

            mountedRootSelector = typeof rootSelector === "string" ? rootSelector : (rootSelector && rootSelector.id ? `#${rootSelector.id}` : "root");
            rootElement = typeof rootSelector === "string" && typeof document !== "undefined" && typeof document.querySelector === "function"
                ? document.querySelector(rootSelector)
                : (rootSelector && rootSelector.nodeType === 1 ? rootSelector : null);
            if (!rootElement) {
                console.warn(`[Helix] mount() failed: no element matches "${rootSelector}"`);
                return null;
            }

            let initialData = {};
            const hxDataAttr = rootElement.getAttribute(`${appConfig.prefix}data`) || rootElement.getAttribute(`data-${appConfig.prefix}data`);
            if (hxDataAttr) {
                try {
                    initialData = JSON.parse(hxDataAttr);
                } catch (e) {
                    if (appConfig.allowInlineExpressions) {
                        try {
                            initialData = new Function(`return (${hxDataAttr})`)();
                        } catch (err) {
                            logger.warn(`Failed to parse ${appConfig.prefix}data attribute: ${hxDataAttr}`, "template");
                        }
                    } else {
                        logger.warn(`Failed to parse JSON in ${appConfig.prefix}data attribute. Inline JS evaluation is disabled (allowInlineExpressions = false).`, "security");
                    }
                }
                rootElement.removeAttribute(`${appConfig.prefix}data`);
                rootElement.removeAttribute(`data-${appConfig.prefix}data`);
            }

            const pendingAsync = [...globalPlugins, ...appPlugins].filter((p) => p.promise).map((p) => p.promise);
            if (pendingAsync.length > 0) {
                await Promise.all(pendingAsync);
            }

            const scope = new EffectScope();
            const instance = {
                id: incrementGlobalInstanceId(),
                root: rootElement,
                scope,
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
                ctx = scope.run(() => {
                    let res;
                    if (typeof rootComponent === "function") {
                        res = rootComponent(appCtx);
                    } else if (rootComponent.setup) {
                        res = rootComponent.setup(appCtx);
                    } else if (typeof rootComponent === "object" && Object.keys(rootComponent).length > 0) {
                        res = reactive({ ...initialData, ...rootComponent });
                    } else {
                        res = reactive({ ...initialData });
                    }
                    if (res && typeof res === "object") {
                        if (Object.keys(initialData).length > 0) {
                            Object.assign(res, initialData);
                        }
                        if (!res.$refs) res.$refs = {};
                    }
                    return res;
                });
            } catch (err) {
                handleError(err, "Root setup");
                setCurrentInstance(null);
                scope.stop();
                return null;
            }
            rootCtx = ctx;
            setCurrentInstance(null);

            globalApps.register(rootSelector, rootElement, instance, app);

            // Remove cloak on root element and descendants
            if (rootElement.hasAttribute(`${appConfig.prefix}cloak`)) rootElement.removeAttribute(`${appConfig.prefix}cloak`);
            rootElement.querySelectorAll?.(`[${appConfig.prefix}cloak]`)?.forEach((el) => {
                el.removeAttribute(`${appConfig.prefix}cloak`);
            });

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
                if (rootInstance.scope) {
                    rootInstance.scope.stop();
                }
                rootInstance.hooks.destroy.forEach((fn) => fn());
                rootInstance.hooks.unmounted.forEach((fn) => fn());
            }

            globalApps.unregister(mountedRootSelector, rootElement, rootInstance);

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
        rebind(targetNode) {
            if (!isMounted || !rootElement) {
                warn("Cannot rebind: app is not mounted.", "core");
                return app;
            }
            let target = targetNode;
            if (typeof target === "string") {
                target = rootElement.querySelector(target);
            }
            if (target && !target.nodeType && (typeof target.length === "number" || typeof target[Symbol.iterator] === "function")) {
                Array.from(target).forEach((n) => app.rebind(n));
                return app;
            }
            if (!target || target.nodeType !== 1) return app;

            const allElements = [target, ...Array.from(target.querySelectorAll('*'))];
            allElements.forEach((el) => {
                if (el.__hx_binding && el.__hx_binding.cleanups) {
                    el.__hx_binding.cleanups.forEach((fn) => {
                        try { fn(); } catch (e) {}
                    });
                    el.__hx_binding.cleanups.length = 0;
                }
                if (Array.isArray(el.__hx_cleanup)) {
                    el.__hx_cleanup.forEach((fn) => {
                        try { fn(); } catch (e) {}
                    });
                    el.__hx_cleanup = null;
                }
                el[BOUND] = false;
                el.__hx_static = false;
                bindNode(el, rootCtx, rootInstance, [], true);
            });
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
