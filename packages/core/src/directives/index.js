import {
    PatchFlags,
    handleError,
    warn,
    vForKeyMap,
    getLIS
} from '../shared/shared.js';
import {
    effect,
    cleanup
} from '../reactivity/effect.js';
import {
    reactive
} from '../reactivity/reactive.js';
import {
    isRef
} from '../reactivity/ref.js';
import {
    resolveExpression,
    resolvePath,
    resolveRaw,
    getPathParts
} from '../compiler/compiler.js';
import {
    sanitizeHtml
} from '../compiler/html.js';
import {
    destroyNode
} from '../renderer/node.js';
import {
    queueComponentUpdated
} from '../app/lifecycle.js';
import {
    createEventListener
} from '../events/index.js';
import {
    resolveTransitionConfig,
    enter,
    leave,
    cancelTransition,
    recordPositions,
    applyFlip
} from '../renderer/transition.js';
import {
    resolveTeleportTarget
} from '../renderer/teleport.js';

export function dispatchDirectiveHook(directive, hookName, el, binding, extra = {}) {
    if (!directive || typeof directive !== "object") return;
    const hook = directive[hookName];
    if (typeof hook === "function") {
        try {
            hook.call(directive, el, binding, extra);
        } catch (err) {
            handleError(err, `Directive hook '${hookName}'`);
        }
    }
}

export function createBuiltinDirectives(appConfig) {
    const dirs = {};

    dirs.ref = {
        selfManaged: true,
        mounted(el, { value, ctx, instance, trackCleanup }) {
            if (!value) return;

            // 1. Function ref passed directly (e.g. :ref="(el) => ...")
            if (typeof value === "function") {
                try { value(el); } catch (err) { handleError(err, "function ref mount", instance); }
                if (trackCleanup) {
                    trackCleanup(() => {
                        try { value(null); } catch (err) { handleError(err, "function ref unmount", instance); }
                    });
                }
                return;
            }

            // 2. useTemplateRef registry on component instance
            if (instance && instance.templateRefs && instance.templateRefs.has(value)) {
                const tRef = instance.templateRefs.get(value);
                tRef.value = el;
                if (trackCleanup) {
                    trackCleanup(() => {
                        if (tRef.value === el) tRef.value = null;
                    });
                }
            }

            // 3. Function ref on context (e.g. :ref="handleRef")
            if (ctx && typeof ctx[value] === "function") {
                const fn = ctx[value];
                try { fn(el); } catch (err) { handleError(err, "context function ref mount", instance); }
                if (trackCleanup) {
                    trackCleanup(() => {
                        try { fn(null); } catch (err) { handleError(err, "context function ref unmount", instance); }
                    });
                }
                return;
            }

            // 4. Reactive ref or property on context
            const parts = getPathParts(value);
            const last = parts.pop();
            const parent = parts.reduce((acc, part) => acc?.[part], ctx);
            if (parent && last !== undefined) {
                if (isRef(parent[last])) {
                    parent[last].value = el;
                    if (trackCleanup) {
                        trackCleanup(() => {
                            if (parent[last] && parent[last].value === el) parent[last].value = null;
                        });
                    }
                } else {
                    parent[last] = el;
                    if (trackCleanup) {
                        trackCleanup(() => {
                            if (parent[last] === el) parent[last] = null;
                        });
                    }
                }
            }

            // 5. Legacy $refs dictionary
            if (ctx && typeof ctx === "object") {
                if (!ctx.$refs) ctx.$refs = {};
                ctx.$refs[value] = el;
                if (trackCleanup) {
                    trackCleanup(() => {
                        if (ctx.$refs && ctx.$refs[value] === el) {
                            delete ctx.$refs[value];
                        }
                    });
                }
            }
        }
    };

    dirs.intersect = {
        selfManaged: true,
        mounted(el, { value: val, arg, modifiers = [], ctx, instance, trackCleanup }) {
            if (!val) return;

            const isLeave = arg === "leave" || modifiers.includes("leave");
            const isOnce = modifiers.includes("once");
            const isHalf = modifiers.includes("half");
            const isFull = modifiers.includes("full");

            let threshold = 0;
            if (isFull) threshold = 1.0;
            else if (isHalf) threshold = 0.5;
            else {
                const threshMod = modifiers.find(m => m === "threshold" || m.startsWith("threshold"));
                if (threshMod) {
                    let numStr = null;
                    if (threshMod.includes(".") || threshMod.includes("-")) {
                        numStr = threshMod.replace(/^threshold[.-]/, "");
                    } else {
                        const idx = modifiers.indexOf(threshMod);
                        numStr = modifiers[idx + 1];
                    }
                    if (numStr) {
                        const parsed = parseFloat(numStr);
                        if (!isNaN(parsed)) {
                            threshold = parsed > 1 ? parsed / 100 : parsed;
                        }
                    }
                }
            }
            threshold = Math.min(1.0, Math.max(0, threshold));

            let rootMargin = "0px";
            const marginMod = modifiers.find(m => m === "margin" || m.startsWith("margin"));
            if (marginMod) {
                let valStr = null;
                if (marginMod.includes(".") || marginMod.includes("-")) {
                    valStr = marginMod.replace(/^margin[.-]/, "");
                    if (marginMod.startsWith("margin.-") || marginMod.startsWith("margin.--")) {
                        valStr = "-" + marginMod.replace(/^margin\.[-]+/, "");
                    }
                } else {
                    const idx = modifiers.indexOf(marginMod);
                    valStr = modifiers[idx + 1];
                }
                if (valStr) {
                    rootMargin = valStr.replace(/_/g, " ");
                }
            }

            const runHandler = (entry) => {
                const fn = resolveRaw(val, ctx);
                if (typeof fn === "function") {
                    try {
                        fn.call(ctx, entry);
                    } catch (err) {
                        handleError(err, `${appConfig.prefix}intersect handler`, instance);
                    }
                } else {
                    resolveExpression(val, ctx, { contextName: `${appConfig.prefix}intersect`, forceExpression: true });
                }
            };

            if (typeof IntersectionObserver === "undefined") {
                runHandler({ target: el, isIntersecting: true, intersectionRatio: 1 });
                return;
            }

            let triggered = false;
            const observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    const matchesCondition = isLeave ? !entry.isIntersecting : entry.isIntersecting;
                    if (matchesCondition) {
                        if (isOnce) {
                            if (triggered) break;
                            triggered = true;
                            observer.unobserve(el);
                            observer.disconnect();
                        }
                        runHandler(entry);
                        if (isOnce) break;
                    }
                }
            }, {
                threshold,
                rootMargin
            });

            observer.observe(el);

            if (trackCleanup) {
                trackCleanup(() => {
                    observer.unobserve(el);
                    observer.disconnect();
                });
            }
        }
    };

    dirs.text = {
        selfManaged: true,
        mounted(el, { value: val, ctx, instance, trackCleanup }) {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.TEXT;
            let initialRan = false;
            const updateFn = () => {
                const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-text" });
                const newText = typeof res === "object" && res !== null ? JSON.stringify(res) : res ?? "";
                if (el.textContent !== newText) {
                    el.textContent = newText;
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            };
            const e = effect(updateFn, { name: `text: ${val}`, area: "directive" });
            initialRan = true;
            let isCleaned = false;
            trackCleanup(() => {
                if (isCleaned) return;
                isCleaned = true;
                cleanup(e);
            });
        }
    };

    dirs.html = {
        selfManaged: true,
        mounted(el, { value: val, ctx, instance, trackCleanup }) {
            let initialRan = false;
            const updateFn = () => {
                const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-html" });
                const newHtml = sanitizeHtml(res || "");
                if (el.innerHTML !== newHtml) {
                    el.innerHTML = newHtml;
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            };
            const e = effect(updateFn, { name: `html: ${val}`, area: "directive" });
            initialRan = true;
            let isCleaned = false;
            trackCleanup(() => {
                if (isCleaned) return;
                isCleaned = true;
                cleanup(e);
            });
        }
    };

    dirs.model = {
        selfManaged: true,
        mounted(el, { value: val, modifiers = [], ctx, instance, trackCleanup }) {
            const isCheck = el.type === "checkbox";
            const isRadio = el.type === "radio";
            const isSelect = el.tagName === "SELECT";
            const isSelectMultiple = isSelect && el.multiple;
            const isLazy = modifiers.includes("lazy");
            const isTrim = modifiers.includes("trim");
            const isNumber = modifiers.includes("number") || el.type === "number";

            let debounceTime = null;
            const debounceMod = modifiers.find(m => m === "debounce" || m.startsWith("debounce"));
            if (debounceMod) {
                const idx = modifiers.indexOf(debounceMod);
                const nextMod = modifiers[idx + 1];
                let ms = 250;
                if (nextMod && /^\d+(ms)?$/.test(nextMod)) {
                    ms = parseInt(nextMod, 10);
                } else if (debounceMod.includes("-") || debounceMod.includes(".")) {
                    const parts = debounceMod.split(/[-.]/);
                    if (parts[1] && /^\d+(ms)?$/.test(parts[1])) {
                        ms = parseInt(parts[1], 10);
                    }
                }
                debounceTime = ms;
            }

            const evtType = isCheck || isRadio || isSelect ? "change" : (isLazy ? "change" : "input");
            let debounceTimer = null;

            const toNumber = (v) => {
                if (v === "" || v === null || v === undefined) return "";
                const n = parseFloat(v);
                return isNaN(n) ? v : n;
            };

            let trueVal = true;
            let falseVal = false;
            if (isCheck) {
                if (el.hasAttribute("true-value")) trueVal = el.getAttribute("true-value");
                else if (el.hasAttribute(":true-value")) trueVal = resolvePath(el.getAttribute(":true-value"), ctx);
                else if (appConfig.prefix && el.hasAttribute(`${appConfig.prefix}bind:true-value`)) trueVal = resolvePath(el.getAttribute(`${appConfig.prefix}bind:true-value`), ctx);
                if (el.hasAttribute("false-value")) falseVal = el.getAttribute("false-value");
                else if (el.hasAttribute(":false-value")) falseVal = resolvePath(el.getAttribute(":false-value"), ctx);
                else if (appConfig.prefix && el.hasAttribute(`${appConfig.prefix}bind:false-value`)) falseVal = resolvePath(el.getAttribute(`${appConfig.prefix}bind:false-value`), ctx);
            }

            const updateModel = (e2) => {
                const parts = getPathParts(val);
                const last = parts.pop();
                const parent = parts.reduce((acc, part) => acc?.[part], ctx);
                if (parent) {
                    if (isCheck) {
                        const current = parent[last];
                        if (Array.isArray(current)) {
                            const valToMatch = isNumber ? toNumber(el.value) : el.value;
                            const idx = current.indexOf(valToMatch);
                            if (e2.target.checked && idx === -1) {
                                current.push(valToMatch);
                            } else if (!e2.target.checked && idx > -1) {
                                current.splice(idx, 1);
                            }
                        } else {
                            parent[last] = e2.target.checked ? trueVal : falseVal;
                        }
                    } else if (isRadio) {
                        parent[last] = isNumber ? toNumber(e2.target.value) : e2.target.value;
                    } else if (isSelectMultiple) {
                        const selected = Array.from(e2.target.selectedOptions || []).map(opt => isNumber ? toNumber(opt.value) : opt.value);
                        parent[last] = selected;
                    } else {
                        let rawValue = e2.target.value;
                        if (isTrim && typeof rawValue === "string") {
                            rawValue = rawValue.trim();
                        }
                        if (isNumber) {
                            parent[last] = toNumber(rawValue);
                        } else {
                            parent[last] = rawValue;
                        }
                    }
                }
            };

            const handler = (e2) => {
                if (debounceTime !== null && evtType === "input") {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        updateModel(e2);
                    }, debounceTime);
                } else {
                    updateModel(e2);
                }
            };

            el.addEventListener(evtType, handler);

            let blurHandler = null;
            if (isTrim && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
                blurHandler = () => {
                    if (typeof el.value === "string") {
                        const trimmed = el.value.trim();
                        if (el.value !== trimmed) {
                            el.value = trimmed;
                        }
                    }
                };
                el.addEventListener("blur", blurHandler);
            }

            let initialRan = false;
            const updateFn = () => {
                const current = resolvePath(val, ctx);
                let changed = false;
                if (isRadio) {
                    const shouldCheck = String(current) === String(el.value);
                    if (el.checked !== shouldCheck) { el.checked = shouldCheck; changed = true; }
                } else if (isCheck) {
                    if (Array.isArray(current)) {
                        const shouldCheck = current.includes(el.value) || current.includes(Number(el.value));
                        if (el.checked !== shouldCheck) { el.checked = shouldCheck; changed = true; }
                    } else {
                        const shouldCheck = (current === trueVal || (trueVal === true && Boolean(current)));
                        if (el.checked !== shouldCheck) { el.checked = shouldCheck; changed = true; }
                    }
                } else if (isSelectMultiple) {
                    const selectedValues = Array.isArray(current) ? current.map(String) : [];
                    Array.from(el.options || []).forEach(opt => {
                        const sel = selectedValues.includes(String(opt.value));
                        if (opt.selected !== sel) { opt.selected = sel; changed = true; }
                    });
                } else {
                    const newValue = current ?? "";
                    if (el.value !== newValue) { el.value = newValue; changed = true; }
                }
                if (changed && initialRan && instance) queueComponentUpdated(instance);
            };

            const e = effect(updateFn, { name: `model: ${val}`, area: "directive" });
            initialRan = true;
            let isCleaned = false;
            trackCleanup(() => {
                if (isCleaned) return;
                isCleaned = true;
                if (debounceTimer) clearTimeout(debounceTimer);
                el.removeEventListener(evtType, handler);
                if (blurHandler) el.removeEventListener("blur", blurHandler);
                cleanup(e);
            });
        }
    };

    dirs.bind = {
        selfManaged: true,
        mounted(el, { value: val, arg, ctx, instance, trackCleanup }) {
            if (!arg) return;
            const isDynamicArg = arg.startsWith("[") && arg.endsWith("]");
            const dynamicArgExp = isDynamicArg ? arg.slice(1, -1).trim() : null;

            const trimmed = val ? val.trim() : "";
            const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
            let initialRan = false;
            let lastAppliedArg = null;

            const updateFn = () => {
                const effectiveArg = isDynamicArg
                    ? resolveExpression(dynamicArgExp, ctx, { contextName: "dynamic-arg" })
                    : arg;

                if (lastAppliedArg && lastAppliedArg !== effectiveArg) {
                    if (lastAppliedArg === "class") el.className = "";
                    else if (lastAppliedArg === "style") el.style.cssText = "";
                    else el.removeAttribute(lastAppliedArg);
                }
                lastAppliedArg = effectiveArg;

                if (!effectiveArg || typeof effectiveArg !== "string") return;

                let result;
                if (isObjectLiteral && (effectiveArg === "class" || effectiveArg === "style")) {
                    result = resolveExpression(val, ctx, { contextName: `v-bind:${effectiveArg}`, forceExpression: true });
                } else if (isObjectLiteral) {
                    result = resolveExpression(val, ctx, { contextName: "v-bind object" });
                } else {
                    result = resolveExpression(val, ctx, { contextName: `v-bind:${effectiveArg}`, fallback: void 0 });
                }

                if (effectiveArg === "class") {
                    el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.CLASS;
                    if (typeof result === "object" && result !== null) {
                        Object.keys(result).forEach((k) => {
                            k.split(/\s+/).filter(Boolean).forEach((cls) => {
                                el.classList.toggle(cls, !!result[k]);
                            });
                        });
                    } else {
                        const newClass = result || "";
                        if (el.className !== newClass) el.className = newClass;
                    }
                } else if (effectiveArg === "style") {
                    el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.STYLE;
                    if (typeof result === "object" && result !== null) Object.assign(el.style, result);
                    else {
                        const newStyle = result || "";
                        if (el.style.cssText !== newStyle) el.style.cssText = newStyle;
                    }
                } else if (effectiveArg === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
                    const newValue = result ?? "";
                    if (el.value !== newValue) el.value = newValue;
                } else if (typeof result === "boolean") {
                    if (result) {
                        if (!el.hasAttribute(effectiveArg)) el.setAttribute(effectiveArg, "");
                    } else {
                        if (el.hasAttribute(effectiveArg)) el.removeAttribute(effectiveArg);
                    }
                } else {
                    const newValue = result ?? "";
                    if (el.getAttribute(effectiveArg) !== newValue) el.setAttribute(effectiveArg, newValue);
                }
                if (initialRan && instance) queueComponentUpdated(instance);
            };
            const e = effect(updateFn, { name: `bind: ${arg}`, area: "directive" });
            initialRan = true;
            let isCleaned = false;
            trackCleanup(() => {
                if (isCleaned) return;
                isCleaned = true;
                cleanup(e);
                if (lastAppliedArg && isDynamicArg) {
                    el.removeAttribute(lastAppliedArg);
                }
            });
        }
    };

    dirs.on = {
        selfManaged: true,
        mounted(el, binding) {
            const { arg, ctx, trackCleanup } = binding;
            if (arg && arg.startsWith("[") && arg.endsWith("]")) {
                const dynamicExp = arg.slice(1, -1).trim();
                let currentUnbind = null;
                let lastEvtType = null;
                const updateEffect = effect(() => {
                    const dynamicEvt = resolveExpression(dynamicExp, ctx, { contextName: "dynamic-event" });
                    if (dynamicEvt !== lastEvtType) {
                        if (currentUnbind) {
                            currentUnbind();
                            currentUnbind = null;
                        }
                        lastEvtType = dynamicEvt;
                        if (dynamicEvt && typeof dynamicEvt === "string") {
                            const dynBinding = { ...binding, arg: dynamicEvt };
                            const listener = createEventListener(el, dynBinding, appConfig);
                            currentUnbind = listener.bind();
                        }
                    }
                }, { name: `on:[${dynamicExp}]`, area: "directive" });
                let isCleaned = false;
                trackCleanup(() => {
                    if (isCleaned) return;
                    isCleaned = true;
                    cleanup(updateEffect);
                    if (currentUnbind) currentUnbind();
                });
            } else {
                const listener = createEventListener(el, binding, appConfig);
                listener.bind();
            }
        }
    };

    dirs.show = {
        selfManaged: true,
        mounted(el, { value: val, ctx, instance, trackCleanup }) {
            let initialRan = false;
            let currentVisible = null;
            const updateFn = () => {
                const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: `${appConfig.prefix}show` });
                if (shouldShow === currentVisible) return;
                currentVisible = shouldShow;
                const transConfig = el.__hx_transition_config || resolveTransitionConfig(el, appConfig);

                if (shouldShow) {
                    el.style.display = "";
                    if (transConfig) {
                        enter(el, transConfig);
                    }
                    if (initialRan && instance) queueComponentUpdated(instance);
                } else {
                    if (transConfig && initialRan) {
                        leave(el, transConfig, ({ cancelled } = {}) => {
                            if (!cancelled && currentVisible === false) {
                                el.style.display = "none";
                            }
                        });
                    } else {
                        el.style.display = "none";
                    }
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            };
            const e = effect(updateFn, { name: `show: ${val}`, area: "directive" });
            initialRan = true;
            let isCleaned = false;
            trackCleanup(() => {
                if (isCleaned) return;
                isCleaned = true;
                cancelTransition(el);
                cleanup(e);
            });
        }
    };

    dirs.if = {
        selfManaged: true,
        mounted(el, { value: val, branches, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
            const branchList = (branches && branches.length > 0) ? branches : [{ el, exp: val, type: 'if' }];
            const placeholder = document.createComment(` ${appConfig.prefix}if-chain `);
            const anchorEl = branchList[0].el || el;
            if (anchorEl.parentNode) {
                anchorEl.parentNode.insertBefore(placeholder, anchorEl);
            }
            branchList.forEach((b) => {
                if (b.el && b.el.parentNode) {
                    b.el.remove();
                }
            });

            let currentBranchIndex = -1;
            let activeNodes = [];
            let initialRan = false;

            const e = effect(() => {
                let matchedIndex = -1;
                for (let i = 0; i < branchList.length; i++) {
                    const b = branchList[i];
                    if (b.type === 'else') {
                        matchedIndex = i;
                        break;
                    }
                    const isTrue = resolveExpression(b.exp, ctx, { asBoolean: true, fallback: false, contextName: `${appConfig.prefix}${b.type}` });
                    if (isTrue) {
                        matchedIndex = i;
                        break;
                    }
                }

                if (matchedIndex !== currentBranchIndex) {
                    const exitingNodes = [...activeNodes];
                    activeNodes = [];
                    currentBranchIndex = matchedIndex;

                    if (exitingNodes.length > 0) {
                        exitingNodes.forEach((n) => {
                            const transConfig = n.__hx_transition_config || resolveTransitionConfig(n, appConfig);
                            if (transConfig && initialRan) {
                                leave(n, transConfig, ({ cancelled } = {}) => {
                                    destroyNode(n);
                                });
                            } else {
                                destroyNode(n);
                            }
                        });
                    }

                    if (matchedIndex >= 0) {
                        const template = branchList[matchedIndex].el;
                        if (template.tagName === 'TEMPLATE' && template.content) {
                            const clone = template.content.cloneNode(true);
                            activeNodes = Array.from(clone.childNodes);
                            if (placeholder.parentNode) placeholder.parentNode.insertBefore(clone, placeholder);
                            activeNodes.forEach((n) => {
                                bindNode2(n, ctx, instance, []);
                                const transConfig = n.__hx_transition_config || resolveTransitionConfig(n, appConfig);
                                if (transConfig) enter(n, transConfig);
                            });
                        } else {
                            const node = template.cloneNode(true);
                            if (placeholder.parentNode) placeholder.parentNode.insertBefore(node, placeholder);
                            bindNode2(node, ctx, instance, []);
                            activeNodes = [node];
                            const transConfig = node.__hx_transition_config || resolveTransitionConfig(node, appConfig);
                            if (transConfig) enter(node, transConfig);
                        }
                    }
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            }, { name: `if: ${val}`, area: "directive" });
            initialRan = true;

            trackCleanup(() => {
                cleanup(e);
                activeNodes.forEach((n) => {
                    cancelTransition(n);
                    destroyNode(n);
                });
                activeNodes = [];
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            });
        }
    };

    dirs.for = {
        selfManaged: true,
        mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
            const forMatch = val.match(/^\s*(?:\(([^)]+)\)|([^\s]+))\s+in\s+(.+)$/);
            if (!forMatch) return warn(`[for] Invalid syntax: ${val}`, "compiler");
            const args = forMatch[1] ? forMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [forMatch[2].trim()];
            const itemName = args[0];
            const keyName = args[1] || null;
            const indexName = args[2] || null;
            const listPath = forMatch[3].trim();

            const keyPath = el.getAttribute(`${appConfig.prefix}key`) || el.getAttribute(":key") ||
                (el.tagName === 'TEMPLATE' && el.content && el.content.firstElementChild ?
                    (el.content.firstElementChild.getAttribute(`${appConfig.prefix}key`) || el.content.firstElementChild.getAttribute(":key")) : null);
            el.removeAttribute(`${appConfig.prefix}key`);
            el.removeAttribute(":key");
            const placeholder = document.createComment(` ${appConfig.prefix}for: ${val} `);
            el.parentNode.insertBefore(placeholder, el);
            el.remove();
            let renderedItems = [];

            const getAnchor = (items, idx) => {
                for (let k = idx; k < items.length; k++) {
                    if (items[k] && items[k].nodes) {
                        for (let n = 0; n < items[k].nodes.length; n++) {
                            if (items[k].nodes[n].parentNode) {
                                return items[k].nodes[n];
                            }
                        }
                    }
                }
                return placeholder;
            };

            let isKeyedIteration = false;
            let iterationKeys = [];

            const createItemRecord = (item, index, key) => {
                const itemScope = reactive({ [itemName]: item });
                if (keyName) {
                    itemScope[keyName] = isKeyedIteration && iterationKeys[index] !== undefined ? iterationKeys[index] : index;
                }
                if (indexName) {
                    itemScope[indexName] = index;
                }
                const childCtx = Object.setPrototypeOf(itemScope, ctx);

                let nodes;
                if (el.tagName === 'TEMPLATE' && el.content) {
                    const clone = el.content.cloneNode(true);
                    nodes = Array.from(clone.childNodes);
                    nodes.forEach((n) => bindNode2(n, childCtx, instance, []));
                } else {
                    const node = el.cloneNode(true);
                    bindNode2(node, childCtx, instance, []);
                    nodes = [node];
                }
                return { key, scope: itemScope, nodes };
            };

            const updateItemScope = (itemRecord, item, index) => {
                itemRecord.scope[itemName] = item;
                if (keyName) {
                    itemRecord.scope[keyName] = isKeyedIteration && iterationKeys[index] !== undefined ? iterationKeys[index] : index;
                }
                if (indexName) {
                    itemRecord.scope[indexName] = index;
                }
            };

            const updateFn = () => {
                let list = [];
                isKeyedIteration = false;
                iterationKeys = [];

                const processRawCollection = (raw) => {
                    if (Array.isArray(raw)) {
                        list = raw;
                    } else if (typeof raw === "number") {
                        list = Array.from({ length: raw }, (_, i) => i + 1);
                    } else if (raw instanceof Map || (raw && typeof raw.entries === "function" && typeof raw.get === "function")) {
                        isKeyedIteration = true;
                        const entries = Array.from(raw.entries());
                        if (keyName) {
                            iterationKeys = entries.map(([k]) => k);
                            list = entries.map(([, v]) => v);
                        } else {
                            iterationKeys = entries.map(([k]) => k);
                            list = entries;
                        }
                    } else if (raw instanceof Set || (raw && typeof raw.values === "function" && typeof raw.add === "function")) {
                        list = Array.from(raw.values());
                    } else if (raw && typeof raw === "object") {
                        isKeyedIteration = true;
                        iterationKeys = Object.keys(raw);
                        list = iterationKeys.map((k) => raw[k]);
                    }
                };

                if (!isNaN(Number(listPath)) && listPath !== "") {
                    const count = parseInt(listPath, 10);
                    list = Array.from({ length: count }, (_, i) => i + 1);
                } else {
                    const directList = resolvePath(listPath, ctx);
                    if (directList !== undefined && directList !== null) {
                        processRawCollection(directList);
                    } else if (appConfig.allowInlineExpressions) {
                        try {
                            const evaluated = new Function("$ctx", `with($ctx) { return ${listPath} }`)(ctx);
                            if (evaluated !== undefined && evaluated !== null) {
                                processRawCollection(evaluated);
                            }
                        } catch (err) {
                            handleError(err, `${appConfig.prefix}for expression: ${listPath}`);
                        }
                    } else {
                        warn(`Inline expressions disabled. Use a computed property for complex lists: ${listPath}`, "compiler");
                    }
                }

                const usedKeys = new Set();
                const newKeys = list.map((item, index) => {
                    let key;
                    if (keyPath) key = getPathParts(keyPath).reduce((acc, part) => acc?.[part], item);
                    else if (item && typeof item === "object") {
                        key = vForKeyMap.get(item);
                        if (!key) {
                            key = Symbol("auto-key");
                            vForKeyMap.set(item, key);
                        }
                    } else key = item;

                    if (usedKeys.has(key)) {
                        const newKey = typeof key === "symbol" ? Symbol(`dup-${index}`) : `${String(key)}_dup_${index}`;
                        if (item && typeof item === "object" && keyPath) {
                            vForKeyMap.set(item, newKey);
                        }
                        key = newKey;
                    }
                    usedKeys.add(key);
                    return key;
                });

                let oldStart = 0;
                let newStart = 0;
                let oldEnd = renderedItems.length - 1;
                let newEnd = list.length - 1;

                while (oldStart <= oldEnd && newStart <= newEnd && renderedItems[oldStart].key === newKeys[newStart]) {
                    updateItemScope(renderedItems[oldStart], list[newStart], newStart);
                    oldStart++;
                    newStart++;
                }

                while (oldStart <= oldEnd && newStart <= newEnd && renderedItems[oldEnd].key === newKeys[newEnd]) {
                    updateItemScope(renderedItems[oldEnd], list[newEnd], newEnd);
                    oldEnd--;
                    newEnd--;
                }

                const newItems = new Array(list.length);
                for (let i = 0; i < newStart; i++) {
                    newItems[i] = renderedItems[i];
                }
                for (let i = newEnd + 1; i < list.length; i++) {
                    const oldIndex = oldEnd + 1 + (i - (newEnd + 1));
                    newItems[i] = renderedItems[oldIndex];
                }

                const allOldNodes = renderedItems.flatMap((item) => item.nodes || []);
                const oldPositions = initialRan ? recordPositions(allOldNodes) : null;

                const removeRecord = (itemRecord) => {
                    if (!itemRecord || !itemRecord.nodes) return;
                    itemRecord.nodes.forEach((n) => {
                        const transConfig = resolveTransitionConfig(n, appConfig);
                        if (transConfig && initialRan) {
                            leave(n, transConfig, () => destroyNode(n));
                        } else {
                            destroyNode(n);
                        }
                    });
                };

                if (oldStart > oldEnd) {
                    const anchor = getAnchor(newItems, newEnd + 1);
                    const parentNode = placeholder.parentNode;
                    for (let i = newStart; i <= newEnd; i++) {
                        const itemRecord = createItemRecord(list[i], i, newKeys[i]);
                        newItems[i] = itemRecord;
                        if (parentNode) {
                            for (let k = 0; k < itemRecord.nodes.length; k++) {
                                parentNode.insertBefore(itemRecord.nodes[k], anchor);
                                const transConfig = resolveTransitionConfig(itemRecord.nodes[k], appConfig);
                                if (transConfig && initialRan) enter(itemRecord.nodes[k], transConfig);
                            }
                        }
                    }
                } else if (newStart > newEnd) {
                    for (let i = oldStart; i <= oldEnd; i++) {
                        removeRecord(renderedItems[i]);
                    }
                } else {
                    const toBePatched = newEnd - newStart + 1;
                    const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
                    const keyToNewIndexMap = new Map();
                    for (let i = newStart; i <= newEnd; i++) {
                        keyToNewIndexMap.set(newKeys[i], i);
                    }

                    let patched = 0;
                    let moved = false;
                    let maxNewIndexSoFar = 0;

                    for (let i = oldStart; i <= oldEnd; i++) {
                        const prevItem = renderedItems[i];
                        if (patched >= toBePatched) {
                            removeRecord(prevItem);
                            continue;
                        }
                        const newIndex = keyToNewIndexMap.get(prevItem.key);
                        if (newIndex === undefined) {
                            removeRecord(prevItem);
                        } else {
                            newIndexToOldIndexMap[newIndex - newStart] = i + 1;
                            updateItemScope(prevItem, list[newIndex], newIndex);
                            newItems[newIndex] = prevItem;
                            if (newIndex >= maxNewIndexSoFar) {
                                maxNewIndexSoFar = newIndex;
                            } else {
                                moved = true;
                            }
                            patched++;
                        }
                    }

                    const lisSequence = moved ? getLIS(newIndexToOldIndexMap) : [];
                    let j = lisSequence.length - 1;
                    const parentNode = placeholder.parentNode;

                    for (let i = toBePatched - 1; i >= 0; i--) {
                        const newIndex = newStart + i;
                        const anchor = getAnchor(newItems, newIndex + 1);

                        if (newIndexToOldIndexMap[i] === 0) {
                            const itemRecord = createItemRecord(list[newIndex], newIndex, newKeys[newIndex]);
                            newItems[newIndex] = itemRecord;
                            if (parentNode) {
                                for (let k = 0; k < itemRecord.nodes.length; k++) {
                                    parentNode.insertBefore(itemRecord.nodes[k], anchor);
                                    const transConfig = resolveTransitionConfig(itemRecord.nodes[k], appConfig);
                                    if (transConfig && initialRan) enter(itemRecord.nodes[k], transConfig);
                                }
                            }
                        } else if (moved) {
                            if (j < 0 || i !== lisSequence[j]) {
                                if (parentNode) {
                                    const itemRecord = newItems[newIndex];
                                    for (let k = 0; k < itemRecord.nodes.length; k++) {
                                        parentNode.insertBefore(itemRecord.nodes[k], anchor);
                                    }
                                }
                            } else {
                                j--;
                            }
                        }
                    }
                }

                if (oldPositions && oldPositions.size > 0) {
                    const cleanPrefix = appConfig.prefix ? (appConfig.prefix.endsWith('-') ? appConfig.prefix.slice(0, -1) : appConfig.prefix) : 'h';
                    applyFlip(oldPositions, `${cleanPrefix}-move`);
                }

                renderedItems = newItems;
                if (initialRan && instance) queueComponentUpdated(instance);
            };
            let initialRan = false;
            const e = effect(updateFn, { name: `for: ${listPath}`, area: "directive" });
            initialRan = true;
            const teardown = () => {
                cleanup(e);
                renderedItems.forEach((item) => {
                    item.nodes.forEach((n) => destroyNode(n));
                });
                renderedItems = [];
            };
            trackCleanup(teardown);
            placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
            placeholder.__hx_cleanup.push(teardown);
        }
    };

    dirs.teleport = {
        selfManaged: true,
        mounted(el, { value: targetSelector, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
            const placeholder = document.createComment(` ${appConfig.prefix}teleport `);
            const parent = el.parentNode;
            if (parent) {
                parent.insertBefore(placeholder, el);
                el.remove();
            }

            let renderedNodes = [];
            const isTemplate = el.tagName === 'TEMPLATE' && el.content;

            if (isTemplate) {
                const clone = el.content.cloneNode(true);
                renderedNodes = Array.from(clone.childNodes);
                renderedNodes.forEach((n) => bindNode2(n, ctx, instance, []));
            } else {
                bindNode2(el, ctx, instance, []);
                renderedNodes = [el];
            }

            const updatePlacement = () => {
                let resolvedSel = targetSelector;
                if (typeof targetSelector === 'string' && targetSelector.trim()) {
                    const trimmed = targetSelector.trim();
                    if (trimmed.startsWith('#') || trimmed.startsWith('.') || trimmed.startsWith('[') || trimmed === 'body' || trimmed === 'head') {
                        resolvedSel = trimmed;
                    } else {
                        try {
                            const evalVal = resolveExpression(trimmed, ctx, { fallback: trimmed, contextName: "hx-teleport" });
                            if (evalVal !== undefined && evalVal !== null && typeof evalVal !== 'function') {
                                resolvedSel = evalVal;
                            }
                        } catch {
                            resolvedSel = trimmed;
                        }
                    }
                }
                const target = resolveTeleportTarget(resolvedSel);
                if (target) {
                    renderedNodes.forEach((n) => {
                        target.appendChild(n);
                    });
                } else {
                    warn(`[Helix Teleport] Target container "${resolvedSel || targetSelector}" not found in document.`, "teleport");
                    if (placeholder && placeholder.parentNode) {
                        renderedNodes.forEach((n) => {
                            placeholder.parentNode.insertBefore(n, placeholder);
                        });
                    }
                }
            };

            const e = effect(updatePlacement, { name: `teleport: ${targetSelector}`, area: "directive" });

            let isDestroying = false;
            const teardown = () => {
                if (isDestroying) return;
                isDestroying = true;
                cleanup(e);
                const nodesToDestroy = [...renderedNodes];
                renderedNodes = [];
                nodesToDestroy.forEach((n) => {
                    destroyNode(n);
                });
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            };

            trackCleanup(teardown);
            placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
            placeholder.__hx_cleanup.push(teardown);
        }
    };

    dirs.transition = {
        mounted(el, { value, modifiers = [] }) {}
    };

    dirs.ref.priority = 100;
    dirs.if.priority = 100;
    dirs.teleport.priority = 100;
    dirs.for.priority = 90;
    dirs.transition.priority = 80;
    dirs.model.priority = 50;
    dirs.bind.priority = 10;
    dirs.on.priority = 10;
    dirs.text.priority = 5;
    dirs.html.priority = 5;
    dirs.show.priority = 5;

    return dirs;
}
