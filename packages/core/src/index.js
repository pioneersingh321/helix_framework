import {
    VERSION,
    globalPlugins,
    globalComponents,
    globalDirectives,
    targetMap,
    reactiveMap,
    readonlyMap,
    nextTick,
    EffectScope,
    PatchFlags,
    openBlock,
    closeBlock,
    lazyBind,
    markTrace,
    measureTrace,
    satisfiesVersion,
    currentInstance,
    setCurrentInstance,
    handleError,
    onErrorGlobal,
    warn,
    BOUND,
    logger
} from './shared/shared.js';
import { globalConfig } from './app/config.js';
import { createApp } from './app/app.js';
import { createBus } from './app/bus.js';
import {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    markRaw,
    toRaw,
    isRaw,
    isProxy,
    isShallow
} from './reactivity/reactive.js';
import {
    ref,
    shallowRef,
    triggerRef,
    isRef,
    unref,
    toValue,
    toRef,
    toRefs,
    customRef
} from './reactivity/ref.js';
import { computed } from './reactivity/computed.js';
import { effect, simpleEffect, batch } from './reactivity/effect.js';
import { watch, watchEffect } from './reactivity/watch.js';
import {
    getCurrentInstance,
    onMount,
    onMounted,
    onBeforeMount,
    onDestroy,
    onUnmounted,
    onBeforeUnmount,
    onUpdated,
    provide,
    inject
} from './app/lifecycle.js';
import { resolvePath } from './compiler/compiler.js';
import {
    queueJob,
    queuePreFlushCb,
    queuePostFlushCb,
    queueIdleJob
} from './reactivity/scheduler.js';
import { domAPI } from './dom/index.js';
import { createEffectGroup, effectGroup } from './reactivity/group.js';
import { inspectDeps } from './reactivity/inspector.js';
import { ScopeScheduler, globalScopeScheduler } from './reactivity/scopeScheduler.js';
import { effectScope, getCurrentScope, onScopeDispose } from './reactivity/scope.js';
import { definePlugin, triggerPluginLifecycle, validatePluginDependencies } from './app/plugin.js';
import { defineAsyncComponent, preload, preloadAll } from './app/asyncComponent.js';
import { createErrorBoundary, onErrorCaptured } from './app/errorBoundary.js';
import { inspectComponent } from './app/inspector.js';
import { checkMemoryLeaks } from './shared/memory.js';
import { Suspense } from './renderer/suspense.js';
import { initDevtools, inspectTree, devtoolsAPI } from './devtools/devtools.js';
import { profile, getProfileData } from './shared/profiler.js';
import { memo } from './reactivity/memo.js';

const globalNamespaces = Object.create(null);
const globalProvides = Object.create(null);

function useGlobal(plugin, options = {}) {
    if (!plugin) return globalAPI;
    if (globalPlugins.some((p) => p.plugin === plugin)) return globalAPI;

    if (plugin.name) {
        if (globalPlugins.some((p) => p.name === plugin.name)) {
            warn(`Global plugin "${plugin.name}" is already registered.`, "plugin");
            return globalAPI;
        }
        if (plugin.requires && plugin.requires.helix) {
            if (!satisfiesVersion(globalAPI.version, plugin.requires.helix)) {
                warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but current version is ${globalAPI.version}.`, "plugin");
                return globalAPI;
            }
        }
    }

    let cleanup = null;
    if (typeof plugin.install === "function") {
        cleanup = plugin.install(globalAPI, options);
    } else if (typeof plugin === "function") {
        cleanup = plugin(globalAPI, options);
    }

    if (typeof plugin.mounted === "function") {
        try { plugin.mounted(globalAPI, options); } catch (e) { handleError(e, `plugin mounted: ${plugin.name || "anonymous"}`); }
    }

    globalPlugins.push({
        plugin,
        options,
        name: plugin.name || null,
        version: plugin.version || null,
        cleanup: typeof cleanup === "function" ? cleanup : null,
        installedAt: Date.now(),
        _executed: true
    });
    return globalAPI;
}

function unuseGlobal(plugin) {
    if (!plugin) return globalAPI;
    const idx = globalPlugins.findIndex((p) => p.plugin === plugin || (plugin.name && p.name === plugin.name));
    if (idx > -1) {
        const entry = globalPlugins[idx];
        if (entry.plugin && typeof entry.plugin.unmount === "function") {
            try { entry.plugin.unmount(globalAPI, entry.options); } catch (e) { handleError(e, `plugin unmount: ${entry.name || "anonymous"}`); }
        }
        if (typeof entry.cleanup === "function") {
            try { entry.cleanup(); } catch (e) { handleError(e, `global plugin cleanup: ${entry.name || "anonymous"}`); }
        }
        if (entry.plugin && typeof entry.plugin.destroy === "function") {
            try { entry.plugin.destroy(globalAPI, entry.options); } catch (e) { handleError(e, `plugin destroy: ${entry.name || "anonymous"}`); }
        }
        globalPlugins.splice(idx, 1);
    }
    return globalAPI;
}

function removeDirectiveGlobal(name) {
    if (typeof name !== "string") {
        warn(`Directive name must be a string.`, "directive");
        return globalAPI;
    }
    const key = name.toLowerCase();
    delete globalDirectives[key];
    return globalAPI;
}

function removeNamespaceGlobal(name) {
    if (typeof name !== "string") {
        warn(`Namespace name must be a string.`, "namespace");
        return globalAPI;
    }
    delete globalNamespaces[name];
    return globalAPI;
}

function componentGlobal(name, definition) {
    if (typeof name !== "string") {
        warn(`Component name must be a string.`, "component");
        return globalAPI;
    }
    const key = name.toLowerCase();
    if (definition === void 0) return globalComponents[key];
    globalComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
    return globalAPI;
}

function directiveGlobal(name, definition) {
    if (typeof name !== "string") {
        warn(`Directive name must be a string.`, "directive");
        return globalAPI;
    }
    const key = name.toLowerCase();
    if (definition === void 0) return globalDirectives[key];
    if (typeof definition === "function") {
        globalDirectives[key] = {
            mounted: definition,
            updated: definition
        };
    } else {
        globalDirectives[key] = definition;
    }
    return globalAPI;
}

function createAndMount(rootSelector, setupFn) {
    const app = createApp({ setup: setupFn });
    return app.mount(rootSelector);
}

function namespaceGlobal(name, apis) {
    if (typeof name !== "string") {
        warn(`Namespace name must be a string.`, "namespace");
        return globalAPI;
    }
    if (apis === void 0) {
        return globalNamespaces[name] || Object.create(null);
    }
    if (typeof apis === "object" && apis !== null) {
        if (!globalNamespaces[name]) globalNamespaces[name] = Object.create(null);
        Object.keys(apis).forEach((key) => {
            if (globalNamespaces[name][key] !== undefined) {
                warn(`Namespace "${name}" already has API "${key}". Overwriting.`, "namespace");
            }
            globalNamespaces[name][key] = apis[key];
        });
    }
    return globalAPI;
}

function runWithContextGlobal(fn) {
    const prevInstance = currentInstance;
    const tempInstance = { provides: globalProvides, parent: null };
    setCurrentInstance(tempInstance);
    try {
        return fn();
    } finally {
        setCurrentInstance(prevInstance);
    }
}

const globalBus = createBus();

const globalRegistry = {
    list() {
        return globalPlugins.map((p) => ({
            name: p.name,
            version: p.version,
            installedAt: p.installedAt || null,
            hasCleanup: !!p.cleanup
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
            hasCleanup: !!p.cleanup
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
    count() {
        return globalPlugins.length;
    }
};

const globalInternal = {
    targetMap,
    reactiveMap,
    readonlyMap,
    globalComponents,
    globalDirectives,
    globalPlugins
};

function rebindGlobal(node, options) {
    if (typeof node === "string") {
        node = document.querySelector(node);
    }
    if (node && !node.nodeType && (typeof node.length === "number" || typeof node[Symbol.iterator] === "function")) {
        Array.from(node).forEach(n => rebindGlobal(n, options));
        return;
    }
    if (!node || node.nodeType !== 1) return;

    let binding = node.__hx_binding;
    let instance = (options && typeof options === "object" && options.instance) || (binding && binding.instance);
    let ctx = (options && typeof options === "object" && ("ctx" in options || "context" in options))
        ? (options.ctx || options.context)
        : options;

    if (!instance || !ctx) {
        let curr = node.parentNode;
        while (curr) {
            if (curr.__hx_binding && curr.__hx_binding.instance && curr.__hx_binding.ctx) {
                if (!instance) instance = curr.__hx_binding.instance;
                if (!ctx) ctx = curr.__hx_binding.ctx;
                if (!binding) binding = curr.__hx_binding;
                break;
            }
            curr = curr.parentNode;
        }
    }

    if (!instance || !ctx) {
        logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
        return;
    }

    const activeBindNode = (binding && binding.bindNode);
    if (!activeBindNode) {
        logger.warn("Cannot locate bindNode to rebind.", "binding");
        return;
    }

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
}

function directivesGlobal(definitions) {
    if (typeof definitions === "object" && definitions !== null) {
        Object.keys(definitions).forEach((name) => {
            directiveGlobal(name, definitions[name]);
        });
    }
    return globalAPI;
}

const globalAPI = {
    createApp,
    create: createApp,
    app: createApp,
    config: globalConfig,
    component: componentGlobal,
    directive: directiveGlobal,
    directives: directivesGlobal,
    removeDirective: removeDirectiveGlobal,
    removeNamespace: removeNamespaceGlobal,
    use: useGlobal,
    rebind: rebindGlobal,
    unuse: unuseGlobal,
    mount: createAndMount,
    version: VERSION,
    namespace: namespaceGlobal,
    runWithContext: runWithContextGlobal,
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    ref,
    shallowRef,
    triggerRef,
    isRef,
    unref,
    toValue,
    toRef,
    toRefs,
    toRaw,
    isRaw,
    markRaw,
    isShallow,
    isProxy,
    customRef,
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
    getCurrentInstance,
    resolvePath,
    queueJob,
    queuePreFlushCb,
    queuePostFlushCb,
    queueIdleJob,
    EffectScope,
    simpleEffect,
    markTrace,
    measureTrace,
    PatchFlags,
    openBlock,
    closeBlock,
    lazyBind,
    logger,
    dom: domAPI,
    batch,
    effectGroup: createEffectGroup,
    createEffectGroup,
    inspectDeps,
    definePlugin,
    defineAsyncComponent,
    preload,
    preloadAll,
    createErrorBoundary,
    onErrorCaptured,
    inspectComponent,
    onError: onErrorGlobal,
    ScopeScheduler,
    scopeScheduler: globalScopeScheduler,
    triggerPluginLifecycle,
    effectScope,
    getCurrentScope,
    onScopeDispose,
    Suspense,
    inspectTree,
    validatePluginDependencies,
    profile,
    getProfileData,
    memo,
    devtools: devtoolsAPI,
    _internal: globalInternal,
    $bus: globalBus,
    registry: globalRegistry
};

if (typeof window !== 'undefined') {
    window.Helix = globalAPI;
    initDevtools();
}

export {
    createApp,
    createApp as create,
    createApp as app,
    globalConfig as config,
    componentGlobal as component,
    directiveGlobal as directive,
    directivesGlobal as directives,
    removeDirectiveGlobal as removeDirective,
    removeNamespaceGlobal as removeNamespace,
    useGlobal as use,
    unuseGlobal as unuse,
    createAndMount as mount,
    VERSION as version,
    namespaceGlobal as namespace,
    runWithContextGlobal as runWithContext,
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    ref,
    shallowRef,
    triggerRef,
    isRef,
    unref,
    toValue,
    toRef,
    toRefs,
    toRaw,
    isRaw,
    markRaw,
    isShallow,
    isProxy,
    customRef,
    computed,
    memo,
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
    getCurrentInstance,
    resolvePath,
    rebindGlobal as rebind,
    queueJob,
    queuePreFlushCb,
    queuePostFlushCb,
    queueIdleJob,
    EffectScope,
    effectScope,
    getCurrentScope,
    onScopeDispose,
    Suspense,
    simpleEffect,
    markTrace,
    measureTrace,
    PatchFlags,
    openBlock,
    closeBlock,
    lazyBind,
    logger,
    domAPI as dom,
    batch,
    createEffectGroup as effectGroup,
    createEffectGroup,
    inspectDeps,
    definePlugin,
    defineAsyncComponent,
    preload,
    preloadAll,
    createErrorBoundary,
    onErrorCaptured,
    inspectComponent,
    inspectTree,
    validatePluginDependencies,
    profile,
    getProfileData,
    devtoolsAPI as devtools,
    onErrorGlobal as onError,
    checkMemoryLeaks,
    ScopeScheduler,
    globalScopeScheduler as scopeScheduler,
    triggerPluginLifecycle,
    globalRegistry as registry,
    globalBus as $bus,
    globalInternal as _internal,
    globalAPI as default
};
