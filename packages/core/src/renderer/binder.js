import {
    BOUND,
    staticNodeCache,
    incrementGlobalInstanceId,
    currentInstance,
    setCurrentInstance,
    EffectScope,
    handleError,
    warn,
    globalDirectives,
    globalComponents,
    logger
} from '../shared/shared.js';
import {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    toRaw,
    markRaw,
    isShallow,
    isProxy
} from '../reactivity/reactive.js';
import {
    ref,
    isRef,
    toRef,
    toRefs,
    shallowRef,
    triggerRef,
    unref,
    toValue,
    customRef
} from '../reactivity/ref.js';
import {
    effect,
    cleanup,
    track,
    trigger
} from '../reactivity/effect.js';
import {
    watch,
    watchEffect
} from '../reactivity/watch.js';
import {
    computed
} from '../reactivity/computed.js';
import {
    nextTick
} from '../shared/shared.js';
import {
    onBeforeMount,
    onMounted,
    onBeforeUnmount,
    onUnmounted,
    onUpdated,
    queueComponentUpdated,
    provide,
    inject,
    validateProp,
    validateEmit,
    onMount,
    onDestroy
} from '../app/lifecycle.js';
import { resolvePath, resolveRaw } from '../compiler/compiler.js';
import { bindTextInterpolation } from '../compiler/delimiter.js';
import { createBuiltinDirectives } from '../directives/index.js';
import { createSlots, renderSlots, getOrCreateAppCtxProxy } from './component.js';

export function normalizeDirective(definition) {
    if (typeof definition === "function") {
        return {
            mounted: definition,
            updated: definition
        };
    }
    return definition || {};
}

export function createDirectiveHook(dirName, hookName, el, binding, instance, normalized) {
    if (!normalized) return null;
    const hookMap = {
        'bind': 'beforeMount',
        'inserted': 'mounted',
        'update': 'beforeUpdate',
        'componentUpdated': 'updated',
        'unbind': 'unmounted'
    };
    let actualHookName = hookName;
    if (normalized[hookName] === undefined && hookMap[hookName]) {
        actualHookName = hookMap[hookName];
    }
    const hook = normalized[actualHookName];
    if (typeof hook !== "function") return null;
    return () => {
        try {
            hook.call(normalized, el, binding);
        } catch (err) {
            handleError(err, `directive ${dirName} ${hookName}`);
        }
    };
}

const scheduleRaf = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 0);

function ensureCloakStyles(appConfig) {
    if (typeof document === "undefined" || appConfig.autoInjectCloak === false) return;
    const rule = `[${appConfig.prefix}cloak] { display: none !important; }`;
    let style = document.getElementById("helix-cloak-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "helix-cloak-style";
        style.textContent = rule;
        if (document.head) {
            document.head.appendChild(style);
        }
    } else if (!style.textContent.includes(`[${appConfig.prefix}cloak]`)) {
        style.textContent += `\n${rule}`;
    }
}

export function makeBindNode(appContext) {
    const appComponents = appContext.components;
    const appDirectives = appContext.directives;
    const appConfig = appContext.config;
    const builtinDirectives = createBuiltinDirectives(appConfig);

    ensureCloakStyles(appConfig);

    const resolveDirective = (name) => {
        if (appDirectives[name]) return appDirectives[name];
        if (globalDirectives[name]) return globalDirectives[name];
        return builtinDirectives[name];
    };
    const resolveComponent = (name) => appComponents[name] || globalComponents[name];
    
    const globalAPI = {
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
        getCurrentInstance: () => currentInstance,
        resolvePath,
        rebind: (node, options) => {
            const binding = node.__hx_binding;
            const instance = (options && typeof options === "object" && options.instance) || (binding && binding.instance);
            if (!instance) {
                logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
                return;
            }
            const ctx = (options && typeof options === "object" && ("ctx" in options || "context" in options))
                ? (options.ctx || options.context)
                : options;
            bindNode(node, ctx, instance, [], true);
        }
    };

    function bindNode(node, ctx, instance, cleanupTarget, force = false) {
        if (cleanupTarget === undefined) cleanupTarget = (instance && instance.cleanups) || [];
        if (node.nodeType === 1) {
            if (node.hasAttribute(`${appConfig.prefix}cloak`)) node.removeAttribute(`${appConfig.prefix}cloak`);

            if (node[BOUND]) {
                if (!force || (node.__hx_binding && node.__hx_binding.ctx === ctx)) return;
                if (node.__hx_binding && node.__hx_binding.cleanups) {
                    node.__hx_binding.cleanups.forEach((fn) => {
                        try { fn(); } catch (e) {}
                    });
                }
                node[BOUND] = false;
                node.__hx_static = false;
                node.__hx_patchFlag = 0;
            }
            if (node.__hx_static) {
                node[BOUND] = true;
                Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
                return;
            }
        }
        if (node.nodeType === 3) {
            const delimiters = appConfig.delimiters || ['{{', '}}'];
            if (delimiters && delimiters.length === 2) {
                bindTextInterpolation(node, ctx, instance, delimiters);
            }
            return;
        }

        if (node.nodeType !== 1 || node[BOUND]) return;
        const tagName = node.tagName.toLowerCase();
        const compDef = resolveComponent(tagName);
        if (compDef) {
            bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force);
            return;
        }

        bindElementNode(node, ctx, instance, cleanupTarget, force);
    }

    function bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force) {
        const normalizeEventName = (name) => name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
        node[BOUND] = true;
        const compDefNormalized = typeof compDef === "function" ? { setup: compDef } : compDef;
        const propsDef = compDefNormalized.props || {};
        const emitsDef = compDefNormalized.emits;
        const propsTarget = {};
        Object.keys(propsDef).forEach((key) => {
            if (propsDef[key].hasOwnProperty("default")) {
                propsTarget[key] = typeof propsDef[key].default === "function" ? propsDef[key].default() : propsDef[key].default;
            }
        });
        const props = new Proxy(propsTarget, {
            get(t, k) {
                track(t, k);
                return Reflect.get(t, k);
            },
            set() {
                warn(`[Helix] Props are read-only.`, "prop");
                return false;
            }
        });
        const scope = new EffectScope();
        const childInst = {
            id: incrementGlobalInstanceId(),
            name: compDefNormalized.name || tagName,
            root: node,
            scope,
            hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
            cleanups: [],
            parent: instance,
            provides: instance ? Object.create(instance.provides || null) : Object.create(null)
        };

        const childNodes = Array.from(node.childNodes);
        const slotTemplates = [];
        childNodes.forEach((child) => {
            if (child.nodeType === 1) {
                const hasSlotDirective = Array.from(child.attributes || []).some(
                    (attr) => attr.name.startsWith("v-slot:") || attr.name.startsWith("#")
                );
                if (hasSlotDirective || child.tagName.toLowerCase() === "template") {
                    slotTemplates.push(child);
                }
            }
        });
        const slots = createSlots(slotTemplates, ctx, childInst, bindNode);
        const defaultSlotEls = childNodes.filter((child) => {
            if (child.nodeType !== 1) return true;
            return !slotTemplates.includes(child);
        });
        if (defaultSlotEls.length > 0 && !slots.default) {
            slots.default = (scopeProps = {}) => {
                const fragment = document.createDocumentFragment();
                defaultSlotEls.forEach((el) => {
                    const clone = el.cloneNode(true);
                    bindNode(clone, ctx, childInst, undefined, force);
                    fragment.appendChild(clone);
                });
                return fragment;
            };
        }

        let isComponentActive = true;
        let hasMounted = false;
        const listeners = Object.create(null);
        Array.from(node.attributes || []).forEach((attr) => {
            if (attr.name.startsWith("@") || attr.name.startsWith(`${appConfig.prefix}on:`)) {
                const evtName = normalizeEventName(
                    attr.name
                        .replace(/^@/, "")
                        .replace(new RegExp(`^${appConfig.prefix}on:`), "")
                );
                if (!listeners[evtName]) listeners[evtName] = [];
                listeners[evtName].push((...args) => {
                    const targetFn = resolveRaw(attr.value, ctx);
                    if (typeof targetFn === "function") targetFn.call(ctx, ...args);
                    else if (appConfig.allowInlineExpressions) {
                        try {
                            new Function("$ctx", "$event", `with($ctx) { ${attr.value} }`)(ctx, args[0]);
                        } catch (err) {
                            handleError(err, `emit handler: ${evtName}`);
                        }
                    } else warn(`Inline expressions disabled. Cannot execute handler: ${attr.value}`, "compiler");
                });
            } else {
                const isBind = attr.name.startsWith(appConfig.prefix + "bind:") || attr.name.startsWith(":");
                let rawPropName = isBind ? attr.name.split(":")[1] || attr.name.slice(1) : attr.name;
                const propName = rawPropName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                if (isBind) {
                    const e = effect(() => {
                        const rawValue = resolvePath(attr.value, ctx);
                        propsTarget[propName] = validateProp(propName, rawValue, propsDef[propName]);
                        trigger(propsTarget, propName);
                        if (hasMounted && isComponentActive) {
                            queueComponentUpdated(childInst);
                        }
                    }, { name: `bind: ${propName}`, area: "binding" });
                    childInst.cleanups.push(() => cleanup(e));
                } else {
                    propsTarget[propName] = validateProp(propName, attr.value, propsDef[propName]);
                }
            }
        });
        const emit = (evtName, ...args) => {
            const normalizedName = normalizeEventName(evtName);
            const isValid = validateEmit(normalizedName, args, emitsDef);
            if (!isValid) return;
            const handlers = listeners[normalizedName];
            if (handlers) for (let i = 0; i < handlers.length; i++) handlers[i](...args);
        };
        node.innerHTML = "";
        node.__hx_cleanup = node.__hx_cleanup || [];
        node.__hx_cleanup.push(() => {
            isComponentActive = false;
            hasMounted = false;
            childInst.hooks.beforeUnmount.forEach((fn) => fn());
            childInst.cleanups.forEach((fn) => {
                try { fn(); } catch (e) { handleError(e, "component unmount cleanup"); }
            });
            scope.stop();
            childInst.hooks.destroy.forEach((fn) => fn());
            childInst.hooks.unmounted.forEach((fn) => fn());
        });
        const prevInstance = currentInstance;
        setCurrentInstance(childInst);
        let childCtx;
        try {
            const baseSetupCtx = {
                ...globalAPI,
                props,
                emit,
                slots
            };
            const setupCtx = getOrCreateAppCtxProxy(baseSetupCtx, appContext.app);
            childCtx = scope.run(() => compDefNormalized.setup(setupCtx));
        } catch (err) {
            handleError(err, `<${tagName}> setup`, childInst);
            setCurrentInstance(prevInstance);
            scope.stop();
            return;
        }
        const finishMount = (resolvedCtx) => {
            if (!isComponentActive || hasMounted) return;
            setCurrentInstance(prevInstance);
            if (resolvedCtx && resolvedCtx.template) {
                node.innerHTML = resolvedCtx.template;
                renderSlots(slots, node, resolvedCtx, childInst, bindNode);
                node.childNodes.forEach((child) => {
                    if (child.nodeType === 1 && child.tagName.toLowerCase() !== "slot") {
                        bindNode(child, resolvedCtx, childInst, undefined, force);
                    }
                });
            } else {
                if (slots.default) {
                    const defaultContent = slots.default();
                    node.appendChild(defaultContent);
                }
            }
            childInst.hooks.beforeMount.forEach((fn) => fn());
            childInst.hooks.mount.forEach((fn) => fn());
            hasMounted = true;
        };
        if (childCtx instanceof Promise) {
            childCtx.then((resolvedCtx) => {
                if (isComponentActive) finishMount(resolvedCtx);
            }).catch((err) => {
                handleError(err, `<${tagName}> async setup`, childInst);
                setCurrentInstance(prevInstance);
            });
        } else finishMount(childCtx);
    }

    function bindElementNode(node, ctx, instance, cleanupTarget, force) {
        const binding = node.__hx_binding ??= {
            cleanups: []
        };
        binding.ctx = ctx;
        binding.instance = instance;
        binding.bindNode = bindNode;
        binding.cleanups.length = 0;

        const trackCleanup = (fn) => {
            if (node.__hx_binding) {
                node.__hx_binding.cleanups.push(fn);
            }
        };

        // prefix-ignore / prefix-static directive: skip binding children for third-party widgets
        if (node.hasAttribute(`${appConfig.prefix}ignore`) || node.hasAttribute(`${appConfig.prefix}static`)) {
            node.removeAttribute(`${appConfig.prefix}ignore`);
            node.removeAttribute(`${appConfig.prefix}static`);
            node[BOUND] = true;
            node.__hx_static = true;
            return;
        }

        if (node.hasAttribute(`${appConfig.prefix}for`)) {
            const val = node.getAttribute(`${appConfig.prefix}for`);
            node.removeAttribute(`${appConfig.prefix}for`);
            const dir = resolveDirective("for");
            if (dir) {
                const bindingObj = { value: val, ctx, instance, trackCleanup, bindNode };
                const hook = createDirectiveHook("for", "mounted", node, bindingObj, instance, normalizeDirective(dir));
                if (hook) hook();
            }
            return;
        }

        // Conditional branch chains: prefix-if, prefix-else-if, prefix-else
        if (node.hasAttribute(`${appConfig.prefix}if`)) {
            const ifVal = node.getAttribute(`${appConfig.prefix}if`);
            node.removeAttribute(`${appConfig.prefix}if`);

            const branches = [{ el: node, exp: ifVal, type: "if" }];

            let next = node.nextSibling;
            while (next) {
                if (next.nodeType === 3 && next.textContent.trim() === "") {
                    const wsNode = next;
                    next = next.nextSibling;
                    wsNode.remove();
                    continue;
                }
                if (next.nodeType === 8) {
                    next = next.nextSibling;
                    continue;
                }
                if (next.nodeType === 1) {
                    const elseIfVal = next.getAttribute(`${appConfig.prefix}else-if`);
                    const hasElse = next.hasAttribute(`${appConfig.prefix}else`);

                    if (elseIfVal !== null) {
                        next.removeAttribute(`${appConfig.prefix}else-if`);
                        next[BOUND] = true;
                        branches.push({ el: next, exp: elseIfVal, type: "else-if" });
                        next = next.nextSibling;
                        continue;
                    } else if (hasElse) {
                        next.removeAttribute(`${appConfig.prefix}else`);
                        next[BOUND] = true;
                        branches.push({ el: next, exp: null, type: "else" });
                        break;
                    }
                }
                break;
            }

            const dir = resolveDirective("if");
            if (dir) {
                const bindingObj = { value: ifVal, branches, ctx, instance, trackCleanup, bindNode };
                const hook = createDirectiveHook("if", "mounted", node, bindingObj, instance, normalizeDirective(dir));
                if (hook) hook();
            }
            return;
        }

        // Standalone prefix-else-if or prefix-else without preceding prefix-if
        if (node.hasAttribute(`${appConfig.prefix}else-if`) || node.hasAttribute(`${appConfig.prefix}else`)) {
            warn(`[Helix 🛠️] ${appConfig.prefix}else / ${appConfig.prefix}else-if used without preceding ${appConfig.prefix}if.`, "directive");
            node.removeAttribute(`${appConfig.prefix}else-if`);
            node.removeAttribute(`${appConfig.prefix}else`);
        }

        let hasDynamicAttr = false;
        const attrs = node.attributes;
        if (attrs) {
            for (let i = 0; i < attrs.length; i++) {
                const name = attrs[i].name;
                if (name.startsWith(appConfig.prefix) || name.startsWith(":") || name.startsWith("@")) {
                    hasDynamicAttr = true;
                    break;
                }
            }
        }
        if (!hasDynamicAttr) {
            node[BOUND] = true;
            node.__hx_static = true;
            if (node.nodeType === 1 && !staticNodeCache.has(node)) {
                staticNodeCache.set(node, node.cloneNode(true));
            }
            Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
            return;
        }
        node[BOUND] = true;
        const attrsBond = Array.from(node.attributes || []);
        const toRemove = [];
        const directiveBindings = [];
        const collectedDirectives = [];

        attrsBond.forEach((attr) => {
            let isDir = false, dirName = "", arg = null, modifiers = [];
            if (attr.name.startsWith(appConfig.prefix)) {
                isDir = true;
                const [base, ...mods] = attr.name.slice(appConfig.prefix.length).toLowerCase().split(".");
                [dirName, arg] = base.split(":");
                modifiers = mods;
            } else if (attr.name.startsWith(":")) {
                isDir = true;
                dirName = "bind";
                arg = attr.name.slice(1);
            } else if (attr.name.startsWith("@")) {
                isDir = true;
                dirName = "on";
                const [evt, ...mods] = attr.name.slice(1).split(".");
                arg = evt;
                modifiers = mods;
            }
            if (isDir) {
                const dirDef = resolveDirective(dirName);
                if (dirDef) {
                    const norm = normalizeDirective(dirDef);
                    const priority = norm.priority !== undefined ? norm.priority : (dirDef.priority !== undefined ? dirDef.priority : 0);
                    collectedDirectives.push({ attr, dirName, arg, modifiers, dirDef, priority });
                }
            }
        });

        collectedDirectives.sort((a, b) => b.priority - a.priority);

        collectedDirectives.forEach(({ attr, dirName, arg, modifiers, dirDef }) => {
            const dirCleanups = [];
            try {
                const bindingObj = {
                    el: node,
                    value: attr.value,
                    exp: attr.value,
                    arg,
                    modifiers,
                    ctx,
                    instance,
                    app: appContext.app,
                    rebind: (options) => globalAPI.rebind(node, options),
                    trackCleanup: (fn) => {
                        dirCleanups.push(fn);
                        trackCleanup(fn);
                    },
                    cleanup: (fn) => {
                        if (fn) {
                            dirCleanups.push(fn);
                            trackCleanup(fn);
                        }
                    },
                    bindNode,
                    dir: dirDef,
                    get oldValue() {
                        return this._oldValue;
                    }
                };
                const mountedHook = createDirectiveHook(dirName, "mounted", node, bindingObj, instance, normalizeDirective(dirDef));
                if (mountedHook) {
                    const res = mountedHook();
                    if (res instanceof Promise) {
                        res.catch((err) => handleError(err, `async directive mounted: ${dirName}`));
                    }
                }
                const normalized = normalizeDirective(dirDef);
                if (normalized.updated || normalized.unmounted) {
                    directiveBindings.push({ dirName, node, binding: bindingObj, normalized });
                }
                toRemove.push(attr.name);
            } catch (err) {
                logger.error("Directive Error:", err);
                dirCleanups.forEach((fn) => {
                    try { fn(); } catch (e) {}
                });
            }
        });
        directiveBindings.forEach(({ dirName, node: el, binding: bindingObj, normalized }) => {
            if (normalized.beforeUpdate || normalized.updated) {
                const updateEffect = effect(() => {
                    if (bindingObj.arg) resolvePath(bindingObj.value, bindingObj.ctx);
                }, {
                    name: `directive update: ${dirName}`,
                    area: "directive",
                    scheduler: () => {
                        bindingObj._oldValue = resolvePath(bindingObj.value, bindingObj.ctx);
                        const beforeUpdateHook = createDirectiveHook(dirName, "beforeUpdate", el, bindingObj, instance, normalized);
                        if (beforeUpdateHook) beforeUpdateHook();
                        const updatedHook = createDirectiveHook(dirName, "updated", el, bindingObj, instance, normalized);
                        if (updatedHook) updatedHook();
                        if (instance) queueComponentUpdated(instance);
                    },
                    lazy: false
                });
                trackCleanup(() => cleanup(updateEffect));
            }
            if (normalized.beforeUnmount || normalized.unmounted) {
                trackCleanup(() => {
                    const beforeUnmountHook = createDirectiveHook(dirName, "beforeUnmount", el, bindingObj, instance, normalized);
                    if (beforeUnmountHook) beforeUnmountHook();
                    const unmountedHook = createDirectiveHook(dirName, "unmounted", el, bindingObj, instance, normalized);
                    if (unmountedHook) unmountedHook();
                });
            }
        });
        scheduleRaf(() => {
            if (appConfig.removeAttributeBindings) {
                toRemove.forEach((name) => {
                    if (node.hasAttribute(name)) node.removeAttribute(name);
                });
            }
        });
        Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
    }

    return bindNode;
}
