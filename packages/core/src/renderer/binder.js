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
    proxyRefs,
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
import { resolvePath, resolveRaw, resolveExpression } from '../compiler/compiler.js';
import { bindTextInterpolation } from '../compiler/delimiter.js';
import { createBuiltinDirectives } from '../directives/index.js';
import { createSlots, renderSlots, getOrCreateAppCtxProxy, parseSlotAttribute } from './component.js';
import { destroyNode } from './node.js';

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
    if (typeof document === "undefined" || !document.getElementById || !document.createElement || appConfig.autoInjectCloak === false) return;
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
        if (tagName === "component" || node.hasAttribute(":is") || node.hasAttribute(`${appConfig.prefix}is`) || (tagName === "component" && node.hasAttribute("is"))) {
            bindDynamicComponentNode(node, ctx, instance, cleanupTarget, force);
            return;
        }

        const compDef = resolveComponent(tagName);
        if (compDef) {
            bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force);
            return;
        }

        bindElementNode(node, ctx, instance, cleanupTarget, force);
    }

    function bindDynamicComponentNode(node, ctx, instance, cleanupTarget, force) {
        node[BOUND] = true;
        const isAttr = node.getAttribute(":is") || node.getAttribute(`${appConfig.prefix}is`) || node.getAttribute("is");
        node.removeAttribute(":is");
        node.removeAttribute(`${appConfig.prefix}is`);
        node.removeAttribute("is");

        const parent = node.parentNode;
        if (!parent) return;

        const doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
        const placeholder = doc ? doc.createComment(" component-anchor ") : { nodeType: 8, textContent: " component-anchor " };
        parent.insertBefore(placeholder, node);
        parent.removeChild(node);

        const slotChildren = Array.from(node.childNodes || []).map((c) => c.cloneNode(true));
        const originalAttrs = Array.from(node.attributes || []).map((a) => ({ name: a.name, value: a.value }));

        let currentMountedNode = null;
        let currentCleanups = [];

        const teardownCurrent = () => {
            currentCleanups.forEach((fn) => {
                try { fn(); } catch (e) { handleError(e, "dynamic component cleanup", instance); }
            });
            currentCleanups = [];
            if (currentMountedNode) {
                const p = currentMountedNode.parentNode;
                destroyNode(currentMountedNode);
                if (p && currentMountedNode.parentNode === p) {
                    p.removeChild(currentMountedNode);
                }
                currentMountedNode = null;
            }
        };

        if (cleanupTarget) {
            cleanupTarget.push(teardownCurrent);
        }

        const e = effect(() => {
            let target = resolveExpression(isAttr, ctx);
            if (isRef(target)) target = target.value;

            teardownCurrent();

            if (!target) return;

            let targetDef = null;
            let targetTagName = "div";

            if (typeof target === "string") {
                const resolved = resolveComponent(target.toLowerCase());
                if (resolved) {
                    targetDef = resolved;
                    targetTagName = target.toLowerCase();
                } else {
                    targetTagName = target.toLowerCase();
                }
            } else if (typeof target === "object" && target !== null) {
                targetDef = target;
                targetTagName = (target.name || "anonymous-component").toLowerCase();
            } else if (typeof target === "function") {
                targetDef = { setup: target };
                targetTagName = "function-component";
            }

            const instanceNode = doc ? doc.createElement(targetTagName) : { nodeType: 1, tagName: targetTagName.toUpperCase() };
            originalAttrs.forEach((attr) => {
                instanceNode.setAttribute(attr.name, attr.value);
            });
            slotChildren.forEach((child) => {
                instanceNode.appendChild(child.cloneNode(true));
            });

            if (placeholder.parentNode) {
                placeholder.parentNode.insertBefore(instanceNode, placeholder);
            }
            currentMountedNode = instanceNode;

            if (targetDef) {
                bindComponentNode(instanceNode, targetDef, targetTagName, ctx, instance, currentCleanups, true);
            } else {
                bindElementNode(instanceNode, ctx, instance, currentCleanups, true);
            }
        }, { name: `dynamic component: ${isAttr}`, area: "component" });

        if (cleanupTarget) {
            cleanupTarget.push(() => cleanup(e));
        }
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
            name: tagName,
            root: node,
            parent: instance,
            provides: instance ? instance.provides : null,
            hooks: {
                mount: [],
                beforeMount: [],
                destroy: [],
                beforeUnmount: [],
                updated: []
            },
            cleanups: [],
            scope
        };

        const childNodes = Array.from(node.childNodes);
        const slotTemplates = [];
        childNodes.forEach((child) => {
            if (child.nodeType === 1) {
                const hasSlotAttr = Array.from(child.attributes || []).some(
                    (attr) => parseSlotAttribute(attr.name, appConfig.prefix).isSlot
                );
                if (hasSlotAttr) {
                    slotTemplates.push(child);
                }
            }
        });
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
        const slots = createSlots(slotTemplates, ctx, childInst, bindNode, appConfig.prefix);
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
                const handler = resolvePath(attr.value, ctx);
                if (typeof handler === "function") {
                    if (!listeners[evtName]) listeners[evtName] = [];
                    listeners[evtName].push(handler);
                }
            } else {
                let propName = attr.name;
                let isBind = false;
                if (propName.startsWith(":")) {
                    isBind = true;
                    propName = propName.slice(1);
                } else if (propName.startsWith(`${appConfig.prefix}bind:`)) {
                    isBind = true;
                    propName = propName.slice(`${appConfig.prefix}bind:`.length);
                }
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
        });
        const prevInstance = currentInstance;
        setCurrentInstance(childInst);
        let childCtx;
        try {
            const baseSetupCtx = {
                ...globalAPI,
                props,
                emit,
                slots,
                attrs: {},
                root: node,
                app: appConfig
            };
            const setupCtx = getOrCreateAppCtxProxy(baseSetupCtx, appConfig);
            if (typeof compDefNormalized.setup === "function") {
                childCtx = scope.run(() => proxyRefs(compDefNormalized.setup(setupCtx)));
            } else {
                childCtx = baseSetupCtx;
            }
        } catch (err) {
            handleError(err, `<${tagName}> setup`, childInst);
        } finally {
            setCurrentInstance(prevInstance);
        }

        const finishMount = () => {
            childInst.hooks.beforeMount.forEach((fn) => fn(node));
            if (compDefNormalized.template) {
                node.innerHTML = compDefNormalized.template;
                renderSlots(slots, node, ctx, childInst, bindNode);
                Array.from(node.childNodes).forEach((child) => bindNode(child, childCtx, childInst, undefined, true));
            } else if (compDefNormalized.render) {
                const renderResult = compDefNormalized.render(childCtx);
                if (typeof renderResult === "string") {
                    node.innerHTML = renderResult;
                    renderSlots(slots, node, ctx, childInst, bindNode);
                    Array.from(node.childNodes).forEach((child) => bindNode(child, childCtx, childInst, undefined, true));
                }
            } else {
                if (slots.default) {
                    const defaultContent = slots.default();
                    node.appendChild(defaultContent);
                }
            }
            childInst.hooks.mount.forEach((fn) => fn(node));
            hasMounted = true;
        };

        if (compDefNormalized.async) {
            compDefNormalized.async().then(() => finishMount());
        } else {
            finishMount();
        }
    }

    function bindElementNode(node, ctx, instance, cleanupTarget, force) {
        if (node[BOUND] && !force) return;

        const binding = node.__hx_binding ??= {
            cleanups: []
        };
        binding.ctx = ctx;
        binding.instance = instance;
        binding.bindNode = bindNode;
        binding.cleanups.length = 0;

        const trackCleanup = (fn) => {
            if (cleanupTarget) {
                cleanupTarget.push(fn);
            }
            if (node.__hx_binding) {
                node.__hx_binding.cleanups.push(fn);
            }
            (node.__hx_cleanup = node.__hx_cleanup || []).push(fn);
        };

        // prefix-pre directive: skip compilation for element and entire subtree
        if (node.hasAttribute(`${appConfig.prefix}pre`)) {
            node.removeAttribute(`${appConfig.prefix}pre`);
            node[BOUND] = true;
            node.__hx_static = true;
            return;
        }

        // prefix-ignore / prefix-static directive: skip binding children for third-party widgets
        if (node.hasAttribute(`${appConfig.prefix}ignore`) || node.hasAttribute(`${appConfig.prefix}static`)) {
            node.removeAttribute(`${appConfig.prefix}ignore`);
            node.removeAttribute(`${appConfig.prefix}static`);
            node[BOUND] = true;
            node.__hx_static = true;
            return;
        }

        // prefix-once directive: evaluate once on mount and freeze reactive subscriptions
        if (node.hasAttribute(`${appConfig.prefix}once`)) {
            node.removeAttribute(`${appConfig.prefix}once`);
            const onceScope = new EffectScope();
            onceScope.run(() => {
                bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force);
            });
            onceScope.stop();
            node[BOUND] = true;
            node.__hx_static = true;
            return;
        }

        // prefix-memo directive: subtree memoization
        if (node.hasAttribute(`${appConfig.prefix}memo`)) {
            const memoExp = node.getAttribute(`${appConfig.prefix}memo`);
            node.removeAttribute(`${appConfig.prefix}memo`);
            const templateNodes = Array.from(node.childNodes).map((c) => c.cloneNode(true));
            let prevDeps = null;
            let currentScope = null;
            const updateMemo = () => {
                const currentDeps = resolveExpression(memoExp, ctx, { contextName: "hx-memo" });
                if (Array.isArray(prevDeps) && Array.isArray(currentDeps) &&
                    prevDeps.length === currentDeps.length &&
                    prevDeps.every((dep, idx) => Object.is(dep, currentDeps[idx]))) {
                    return;
                }
                prevDeps = Array.isArray(currentDeps) ? [...currentDeps] : currentDeps;
                if (currentScope) currentScope.stop();
                currentScope = new EffectScope();
                currentScope.run(() => {
                    while (node.firstChild) {
                        node.removeChild(node.firstChild);
                    }
                    templateNodes.forEach((tplNode) => {
                        const cloned = tplNode.cloneNode(true);
                        node.appendChild(cloned);
                        bindNode(cloned, ctx, instance, cleanupTarget, true);
                    });
                });
                currentScope.stop();
            };
            const memoEffect = effect(updateMemo, { name: `memo: ${memoExp}`, area: "directive" });
            trackCleanup(() => {
                cleanup(memoEffect);
                if (currentScope) currentScope.stop();
            });
            return;
        }

        bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force);
    }

    function bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force) {
        const trackCleanup = (fn) => {
            if (cleanupTarget) {
                cleanupTarget.push(fn);
            }
            if (node.__hx_binding) {
                node.__hx_binding.cleanups.push(fn);
            }
            (node.__hx_cleanup = node.__hx_cleanup || []).push(fn);
        };

        if (node.hasAttribute(`${appConfig.prefix}teleport`)) {
            const val = node.getAttribute(`${appConfig.prefix}teleport`);
            node.removeAttribute(`${appConfig.prefix}teleport`);
            const dir = resolveDirective("teleport");
            if (dir) {
                const bindingObj = { value: val, ctx, instance, trackCleanup, bindNode };
                const hook = createDirectiveHook("teleport", "mounted", node, bindingObj, instance, normalizeDirective(dir));
                if (hook) hook();
            }
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

        // Custom Directive Logic
        const dynamicDirectives = node.getAttribute(`${appConfig.prefix}directive`);
        if (dynamicDirectives) {
            const dirExpressions = dynamicDirectives.split(";").map(d => d.trim()).filter(Boolean);
            dirExpressions.forEach(expr => {
                const [dirName, bindingValueExpr] = expr.split(":").map(s => s.trim());
                if (dirName && bindingValueExpr) {
                    const dir = resolveDirective(dirName);
                    if (dir) {
                        const val = resolveExpression(bindingValueExpr, ctx);
                        const bindingObj = {
                            name: dirName,
                            value: val,
                            ctx,
                            instance,
                            trackCleanup,
                            bindNode
                        };
                        const hook = createDirectiveHook(dirName, "mounted", node, bindingObj, instance, normalizeDirective(dir));
                        if (hook) hook();
                    }
                }
            });
        }

        // Structural directive: prefix-if
        if (node.hasAttribute(`${appConfig.prefix}if`)) {
            node[BOUND] = true;
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
                if (name.startsWith(appConfig.prefix) || name.startsWith(":") || name.startsWith("@") || name === "ref" || name.startsWith("ref:") || name.startsWith("ref.")) {
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
            const attrName = attr.name;
            if (attrName === "ref" || attrName.startsWith("ref:") || attrName.startsWith("ref.")) {
                isDir = true;
                dirName = "ref";
                const rest = attrName.replace(/^ref:?/, "");
                const [base, ...mods] = rest.split(".");
                arg = base || null;
                modifiers = mods.map(m => m.toLowerCase());
            } else if (attrName.startsWith(appConfig.prefix)) {
                isDir = true;
                const rawRest = attrName.slice(appConfig.prefix.length);
                const colonIdx = rawRest.indexOf(":");
                let rest;
                if (colonIdx > -1) {
                    dirName = rawRest.slice(0, colonIdx).toLowerCase();
                    rest = rawRest.slice(colonIdx + 1);
                    if (rest.startsWith("[")) {
                        const closingIdx = rest.lastIndexOf("]");
                        if (closingIdx > -1) {
                            arg = rest.slice(0, closingIdx + 1);
                            const modsRest = rest.slice(closingIdx + 1);
                            modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map(m => m.toLowerCase()) : [];
                        } else {
                            arg = rest;
                            modifiers = [];
                        }
                    } else {
                        const [base, ...mods] = rest.split(".");
                        arg = base || null;
                        modifiers = mods.map(m => m.toLowerCase());
                    }
                } else {
                    const [base, ...mods] = rawRest.split(".");
                    dirName = base.toLowerCase();
                    arg = null;
                    modifiers = mods.map(m => m.toLowerCase());
                }
            } else if (attrName.startsWith(":")) {
                isDir = true;
                const rest = attrName.slice(1);
                if (rest === "ref" || rest.startsWith("ref:") || rest.startsWith("ref.")) {
                    dirName = "ref";
                    const [base, ...mods] = rest.replace(/^ref:?/, "").split(".");
                    arg = base || null;
                    modifiers = mods.map(m => m.toLowerCase());
                } else {
                    dirName = "bind";
                    if (rest.startsWith("[")) {
                        const closingIdx = rest.lastIndexOf("]");
                        if (closingIdx > -1) {
                            arg = rest.slice(0, closingIdx + 1);
                            const modsRest = rest.slice(closingIdx + 1);
                            modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map(m => m.toLowerCase()) : [];
                        } else {
                            arg = rest;
                            modifiers = [];
                        }
                    } else {
                        const [base, ...mods] = rest.split(".");
                        arg = base || null;
                        modifiers = mods.map(m => m.toLowerCase());
                    }
                }
            } else if (attrName.startsWith("@")) {
                isDir = true;
                dirName = "on";
                const rest = attrName.slice(1);
                if (rest.startsWith("[")) {
                    const closingIdx = rest.lastIndexOf("]");
                    if (closingIdx > -1) {
                        arg = rest.slice(0, closingIdx + 1);
                        const modsRest = rest.slice(closingIdx + 1);
                        modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map(m => m.toLowerCase()) : [];
                    } else {
                        arg = rest;
                        modifiers = [];
                    }
                } else {
                    const [base, ...mods] = rest.split(".");
                    arg = base || null;
                    modifiers = mods.map(m => m.toLowerCase());
                }
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
            if (!normalized.selfManaged && (normalized.beforeUpdate || normalized.updated)) {
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
