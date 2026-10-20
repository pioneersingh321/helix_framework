import { resolvePath } from '../compiler/compiler.js';
import { isRef } from '../reactivity/ref.js';
import { hasGlobalModule, getGlobalModule, createModulesProxy } from '../app/module.js';

const componentProxyCache = new WeakMap();

let idCounter = 0;
export function uniqueId(prefix = "hx") {
    return `${prefix}-${++idCounter}`;
}
export const id = uniqueId;

export function dispatchEventHelper(targetOrEvent, eventNameOrDetail, detail = null, options = {}) {
    let target = null;
    let eventName = "";
    let evtDetail = null;
    let opts = {};

    if (typeof targetOrEvent === "string") {
        eventName = targetOrEvent;
        evtDetail = eventNameOrDetail;
        target = this?.$el || this?.root || (typeof document !== "undefined" ? document : null);
        opts = (detail && typeof detail === "object" && !Array.isArray(detail)) ? detail : {};
    } else {
        target = targetOrEvent;
        eventName = String(eventNameOrDetail || "");
        evtDetail = detail;
        opts = (options && typeof options === "object" && !Array.isArray(options)) ? options : {};
    }

    if (!target || typeof target.dispatchEvent !== "function") {
        if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
            target = document;
        } else if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            target = window;
        }
    }

    if (!target || typeof target.dispatchEvent !== "function" || !eventName) return false;

    const customEvent = typeof CustomEvent !== "undefined"
        ? new CustomEvent(eventName, {
            bubbles: opts.bubbles !== false,
            composed: opts.composed !== false,
            cancelable: opts.cancelable !== false,
            ...opts,
            detail: evtDetail
        })
        : { type: eventName, detail: evtDetail };

    return target.dispatchEvent(customEvent);
}
export const dispatch = dispatchEventHelper;

export function getOrCreateAppCtxProxy(baseAppCtx, app) {
    let appMap = componentProxyCache.get(baseAppCtx);
    if (!appMap) {
        appMap = new WeakMap();
        componentProxyCache.set(baseAppCtx, appMap);
    }
    let proxy = appMap.get(app || baseAppCtx);
    if (!proxy) {
        proxy = new Proxy(baseAppCtx, {
            get(target, prop, receiver) {
                if (prop in target) {
                    const val = target[prop];
                    return isRef(val) ? val.value : val;
                }
                if (prop === "$dispatch") {
                    return (eventName, detail, options) => {
                        const rootEl = target?.$el || target?.root || (typeof document !== "undefined" ? document : null);
                        return dispatchEventHelper(rootEl, eventName, detail, options);
                    };
                }
                if (prop === "$id") {
                    return (p = "id") => uniqueId(p);
                }
                if (prop === "$root") {
                    return target?.$el || target?.root || null;
                }
                if (prop === "$app") {
                    return app || (typeof window !== "undefined" && window.Helix) || (typeof globalThis !== "undefined" && globalThis.Helix) || null;
                }
                if (prop === "$modules") {
                    return app ? app.$modules : createModulesProxy(null);
                }
                if (app && typeof app.hasModule === "function" && app.hasModule(prop)) {
                    return app.module(prop);
                }
                if (hasGlobalModule(prop)) {
                    return app && typeof app.module === "function" ? app.module(prop) : getGlobalModule(prop);
                }
                if (app && prop in app) {
                    const val = app[prop];
                    return isRef(val) ? val.value : val;
                }
                const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
                if (globalHelix && prop in globalHelix) {
                    const val = globalHelix[prop];
                    return isRef(val) ? val.value : val;
                }
                return undefined;
            },
            set(target, prop, value, receiver) {
                target[prop] = value;
                return true;
            },
            has(target, prop) {
                if (prop in target) return true;
                if (prop === "$dispatch" || prop === "$id" || prop === "$root" || prop === "$app" || prop === "$modules") return true;
                if (app && typeof app.hasModule === "function" && app.hasModule(prop)) return true;
                if (hasGlobalModule(prop)) return true;
                if (app && prop in app) return true;
                const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
                if (globalHelix && prop in globalHelix) return true;
                return false;
            }
        });
        appMap.set(app || baseAppCtx, proxy);
    }
    return proxy;
}

export function parseSlotAttribute(attrName, prefix = "h-") {
    if (!attrName) return { isSlot: false, name: "" };

    // 1. Shorthand # (e.g. #header, #default)
    if (attrName.startsWith("#")) {
        const name = attrName.slice(1) || "default";
        return { isSlot: true, name };
    }

    // 2. Prefix-defined slot (e.g. h-slot:header, hx-slot:header, custom-slot:header, h-slot)
    const slotPrefix = `${prefix}slot`;
    if (attrName === slotPrefix) {
        return { isSlot: true, name: "default" };
    }
    if (attrName.startsWith(`${slotPrefix}:`)) {
        const name = attrName.slice(slotPrefix.length + 1) || "default";
        return { isSlot: true, name };
    }
    if (attrName.startsWith(`${slotPrefix}.`)) {
        const name = attrName.slice(slotPrefix.length + 1) || "default";
        return { isSlot: true, name };
    }

    // 3. Standard v-slot (e.g. v-slot:header, v-slot)
    if (attrName === "v-slot") {
        return { isSlot: true, name: "default" };
    }
    if (attrName.startsWith("v-slot:")) {
        const name = attrName.slice("v-slot:".length) || "default";
        return { isSlot: true, name };
    }
    if (attrName.startsWith("v-slot.")) {
        const name = attrName.slice("v-slot.".length) || "default";
        return { isSlot: true, name };
    }

    return { isSlot: false, name: "" };
}

export function createSlots(slotEls, ctx, instance, bindNode, prefix = "h-") {
    const slots = {};
    slotEls.forEach((el) => {
        if (el.nodeType !== 1) return;
        let slotName = "default";
        let slotProps = null;
        Array.from(el.attributes || []).forEach((attr) => {
            const parsed = parseSlotAttribute(attr.name, prefix);
            if (parsed.isSlot) {
                slotName = parsed.name || "default";
                const attrVal = attr.value.trim();
                if (attrVal) slotProps = attrVal;
            }
        });
        if (!slots[slotName]) slots[slotName] = [];
        slots[slotName].push({ el, props: slotProps });
    });
    const slotOutlets = {};
    Object.keys(slots).forEach((name) => {
        const slotDefs = slots[name];
        slotOutlets[name] = (scopeProps = {}) => {
            const fragment = document.createDocumentFragment();
            slotDefs.forEach((slotDef) => {
                const clone = slotDef.el.cloneNode(true);
                if (slotDef.props) {
                    const slotCtx = Object.create(ctx);
                    Object.keys(scopeProps).forEach((key) => {
                        slotCtx[key] = scopeProps[key];
                    });
                    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(slotDef.props)) {
                        slotCtx[slotDef.props] = scopeProps;
                    }
                    bindNode(clone, slotCtx, instance);
                } else {
                    bindNode(clone, ctx, instance);
                }
                Array.from(clone.attributes || []).forEach((attr) => {
                    const parsed = parseSlotAttribute(attr.name, prefix);
                    if (parsed.isSlot) {
                        clone.removeAttribute(attr.name);
                    }
                });
                fragment.appendChild(clone);
            });
            return fragment;
        };
    });
    return slotOutlets;
}

export function renderSlots(slotOutlets, templateEl, parentCtx, instance, bindNode) {
    const slotElements = templateEl.querySelectorAll("slot");
    slotElements.forEach((slotEl) => {
        const name = slotEl.getAttribute("name") || "default";
        const outlet = slotOutlets[name];
        if (outlet) {
            const scopeAttr = slotEl.getAttribute(":scope") || slotEl.getAttribute("v-bind:scope");
            let scopeProps = {};
            if (scopeAttr) {
                const resolved = resolvePath(scopeAttr, parentCtx);
                if (resolved && typeof resolved === "object") scopeProps = resolved;
            }
            const content = outlet(scopeProps);
            slotEl.innerHTML = "";
            slotEl.appendChild(content);
        } else {
            const fallback = document.createDocumentFragment();
            Array.from(slotEl.childNodes).forEach((child) => fallback.appendChild(child));
            slotEl.innerHTML = "";
            slotEl.appendChild(fallback);
            Array.from(slotEl.childNodes).forEach((child) => bindNode(child, parentCtx, instance));
        }
    });

    const nestedTemplates = templateEl.querySelectorAll("template");
    nestedTemplates.forEach((tpl) => {
        if (tpl.content) {
            renderSlots(slotOutlets, tpl.content, parentCtx, instance, bindNode);
        }
    });
}
