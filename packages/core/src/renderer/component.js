import { resolvePath } from '../compiler/compiler.js';

const componentProxyCache = new WeakMap();

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
                if (prop in target) return target[prop];
                if (app && prop in app) return app[prop];
                const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
                if (globalHelix && prop in globalHelix) return globalHelix[prop];
                return undefined;
            },
            set(target, prop, value, receiver) {
                target[prop] = value;
                return true;
            },
            has(target, prop) {
                if (prop in target) return true;
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

export function createSlots(slotEls, ctx, instance, bindNode) {
    const slots = {};
    slotEls.forEach((el) => {
        if (el.nodeType !== 1) return;
        let slotName = "default";
        let slotProps = null;
        Array.from(el.attributes || []).forEach((attr) => {
            if (attr.name.startsWith("v-slot:") || attr.name.startsWith("#")) {
                slotName = attr.name.replace(/^(v-slot:|#)/, "") || "default";
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
                    if (attr.name.startsWith("v-slot:") || attr.name.startsWith("#")) {
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
