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
        mounted(el, { value, ctx }) {
            const parts = getPathParts(value);
            const last = parts.pop();
            const parent = parts.reduce((acc, part) => acc?.[part], ctx);
            if (parent) parent[last] = el;
            if (ctx && typeof ctx === "object") {
                if (!ctx.$refs) ctx.$refs = {};
                ctx.$refs[value] = el;
            }
        }
    };

    dirs.text = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, instance, trackCleanup }) {
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
            trackCleanup(() => cleanup(e));
        }
    };

    dirs.html = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, instance, trackCleanup }) {
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
            trackCleanup(() => cleanup(e));
        }
    };

    dirs.model = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, modifiers = [], ctx, instance, trackCleanup }) {
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

            const updateModel = (e2) => {
                const parts = getPathParts(val);
                const last = parts.pop();
                const parent = parts.reduce((acc, part) => acc?.[part], ctx);
                if (parent) {
                    if (isCheck) {
                        parent[last] = e2.target.checked;
                    } else if (isRadio) {
                        parent[last] = e2.target.value;
                    } else if (isSelectMultiple) {
                        const selected = Array.from(e2.target.selectedOptions).map(opt => opt.value);
                        parent[last] = selected;
                    } else {
                        let rawValue = e2.target.value;
                        if (isTrim && typeof rawValue === "string") {
                            rawValue = rawValue.trim();
                        }
                        if (isNumber) {
                            const num = rawValue === "" ? "" : Number(rawValue);
                            parent[last] = Number.isNaN(num) ? rawValue : num;
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

            let initialRan = false;
            const updateFn = () => {
                const current = resolvePath(val, ctx);
                let changed = false;
                if (isRadio) {
                    const shouldCheck = current === el.value;
                    if (el.checked !== shouldCheck) { el.checked = shouldCheck; changed = true; }
                } else if (isCheck) {
                    const shouldCheck = !!current;
                    if (el.checked !== shouldCheck) { el.checked = shouldCheck; changed = true; }
                } else if (isSelectMultiple) {
                    const selectedValues = Array.isArray(current) ? current : [];
                    Array.from(el.options).forEach(opt => {
                        const sel = selectedValues.includes(opt.value);
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
            trackCleanup(() => {
                if (debounceTimer) clearTimeout(debounceTimer);
                el.removeEventListener(evtType, handler);
                cleanup(e);
            });
        }
    };

    dirs.bind = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, arg, ctx, instance, trackCleanup }) {
            if (!arg) return;
            const trimmed = val.trim();
            const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
            let initialRan = false;
            const updateFn = () => {
                let result;
                if (isObjectLiteral && (arg === "class" || arg === "style")) {
                    result = resolveExpression(val, ctx, { contextName: `v-bind:${arg}`, forceExpression: true });
                } else if (isObjectLiteral) {
                    result = resolveExpression(val, ctx, { contextName: "v-bind object" });
                } else {
                    result = resolveExpression(val, ctx, { contextName: `v-bind:${arg}`, fallback: void 0 });
                }
                if (arg === "class") {
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
                } else if (arg === "style") {
                    el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.STYLE;
                    if (typeof result === "object" && result !== null) Object.assign(el.style, result);
                    else {
                        const newStyle = result || "";
                        if (el.style.cssText !== newStyle) el.style.cssText = newStyle;
                    }
                } else if (arg === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
                    const newValue = result ?? "";
                    if (el.value !== newValue) el.value = newValue;
                } else if (typeof result === "boolean") {
                    if (result) {
                        if (!el.hasAttribute(arg)) el.setAttribute(arg, "");
                    } else {
                        if (el.hasAttribute(arg)) el.removeAttribute(arg);
                    }
                } else {
                    const newValue = result ?? "";
                    if (el.getAttribute(arg) !== newValue) el.setAttribute(arg, newValue);
                }
                if (initialRan && instance) queueComponentUpdated(instance);
            };
            const e = effect(updateFn, { name: `bind: ${arg}`, area: "directive" });
            initialRan = true;
            trackCleanup(() => cleanup(e));
        }
    };

    dirs.on = {
        mounted(el, { value: val, arg, modifiers = [], ctx, trackCleanup }) {
            const evtType = arg || "click";
            const isWindow = modifiers.includes("window");
            const isDocument = modifiers.includes("document");
            const isOutside = modifiers.includes("outside");
            const isPrevent = modifiers.includes("prevent");
            const isStop = modifiers.includes("stop");
            const isSelf = modifiers.includes("self");
            const isOnce = modifiers.includes("once");
            const isPassive = modifiers.includes("passive");
            const isCapture = modifiers.includes("capture");

            const keyModifiers = {
                enter: ["Enter"],
                escape: ["Escape", "Esc"],
                esc: ["Escape", "Esc"],
                tab: ["Tab"],
                space: [" ", "Spacebar"],
                up: ["ArrowUp", "Up"],
                down: ["ArrowDown", "Down"],
                left: ["ArrowLeft", "Left"],
                right: ["ArrowRight", "Right"],
                delete: ["Delete", "Backspace"]
            };

            const parseArgs = (str) => {
                const args = [];
                if (!str) return args;
                let depth = 0, current = '', inQuote = false, quoteChar = '';
                for (let i = 0; i < str.length; i++) {
                    const ch = str[i];
                    if (!inQuote && (ch === '"' || ch === "'")) {
                        inQuote = true; quoteChar = ch; current += ch;
                    } else if (inQuote && ch === quoteChar && str[i - 1] !== '\\') {
                        inQuote = false; current += ch;
                    } else if (!inQuote && (ch === '(' || ch === '{' || ch === '[')) {
                        depth++; current += ch;
                    } else if (!inQuote && (ch === ')' || ch === '}' || ch === ']')) {
                        depth--; current += ch;
                    } else if (!inQuote && ch === ',' && depth === 0) {
                        args.push(current.trim()); current = '';
                    } else {
                        current += ch;
                    }
                }
                if (current.trim()) args.push(current.trim());
                return args;
            };

            const executeHandler = (e) => {
                if (isPrevent) e.preventDefault();
                if (isStop) e.stopPropagation();
                if (isSelf && e.target !== el) return;

                if (modifiers.includes("ctrl") && !e.ctrlKey) return;
                if (modifiers.includes("alt") && !e.altKey) return;
                if (modifiers.includes("shift") && !e.shiftKey) return;
                if (modifiers.includes("meta") && !e.metaKey) return;

                for (const keyMod in keyModifiers) {
                    if (modifiers.includes(keyMod)) {
                        if (!e.key || !keyModifiers[keyMod].includes(e.key)) {
                            return;
                        }
                    }
                }

                let targetFn;
                let thisArg = ctx;
                let args = [e];
                const trimmed = val ? val.trim() : "";
                const parenIdx = trimmed.indexOf('(');

                if (parenIdx > -1 && trimmed.endsWith(')')) {
                    const fnPath = trimmed.slice(0, parenIdx).trim();
                    const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();
                    targetFn = resolveRaw(fnPath, ctx);

                    if (fnPath.includes('.')) {
                        const parts = getPathParts(fnPath);
                        if (parts.length > 1) {
                            const rawParent = resolveRaw(parts.slice(0, -1).join('.'), ctx);
                            const parentObj = isRef(rawParent) ? rawParent.value : rawParent;
                            if (parentObj && (typeof parentObj === 'object' || typeof parentObj === 'function')) {
                                thisArg = parentObj;
                            }
                        }
                    }

                    if (argsStr) {
                        const rawArgs = parseArgs(argsStr);
                        args = rawArgs.map(a => {
                            if (a === '$event') return e;
                            const resolved = resolvePath(a, ctx);
                            if (resolved !== undefined) return resolved;
                            try { return JSON.parse(a); } catch { }
                            if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
                                return a.slice(1, -1);
                            }
                            return a;
                        });
                    } else {
                        args = [];
                    }
                } else {
                    targetFn = resolveRaw(trimmed, ctx);
                    if (trimmed.includes('.')) {
                        const parts = getPathParts(trimmed);
                        if (parts.length > 1) {
                            const rawParent = resolveRaw(parts.slice(0, -1).join('.'), ctx);
                            const parentObj = isRef(rawParent) ? rawParent.value : rawParent;
                            if (parentObj && (typeof parentObj === 'object' || typeof parentObj === 'function')) {
                                thisArg = parentObj;
                            }
                        }
                    }
                }

                if (typeof targetFn === "function") {
                    try {
                        targetFn.call(thisArg, ...args);
                    } catch (err) {
                        handleError(err, `Event @${evtType}`);
                    }
                } else if (appConfig.allowInlineExpressions) {
                    try {
                        new Function("$ctx", "$event", `with($ctx) { ${val} }`)(ctx, e);
                    } catch (err) {
                        handleError(err, `Event @${evtType}`);
                    }
                } else {
                    try {
                        const isCall = trimmed.endsWith(')');
                        const fn = new Function("$ctx", "$event", `with($ctx) { return (${isCall ? trimmed : trimmed + '($event)'}); }`);
                        fn(ctx, e);
                    } catch (inlineErr) {
                        warn(`Handler not found: ${val}`, "event");
                    }
                }
            };

            if (isOutside) {
                const outsideHandler = (e) => {
                    if (!el.contains(e.target) && el !== e.target) {
                        executeHandler(e);
                    }
                };
                if (typeof document !== 'undefined') {
                    document.addEventListener("click", outsideHandler);
                    trackCleanup(() => document.removeEventListener("click", outsideHandler));
                }
                return;
            }

            const listenerTarget = isWindow && typeof window !== "undefined"
                ? window
                : (isDocument && typeof document !== "undefined" ? document : el);

            const hasOpts = isOnce || isPassive || isCapture;
            const listenerOpts = hasOpts ? { once: isOnce, passive: isPassive, capture: isCapture } : isCapture;

            listenerTarget.addEventListener(evtType, executeHandler, listenerOpts);
            trackCleanup(() => listenerTarget.removeEventListener(evtType, executeHandler, listenerOpts));
        }
    };

    dirs.show = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, instance, trackCleanup }) {
            let initialRan = false;
            const updateFn = () => {
                const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-show" });
                const newDisplay = shouldShow ? "" : "none";
                if (el.style.display !== newDisplay) {
                    el.style.display = newDisplay;
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            };
            const e = effect(updateFn, { name: `show: ${val}`, area: "directive" });
            initialRan = true;
            trackCleanup(() => cleanup(e));
        }
    };

    dirs.if = {
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
                    if (activeNodes.length > 0) {
                        activeNodes.forEach((n) => destroyNode(n));
                        activeNodes = [];
                    }
                    currentBranchIndex = matchedIndex;
                    if (matchedIndex >= 0) {
                        const template = branchList[matchedIndex].el;
                        if (template.tagName === 'TEMPLATE' && template.content) {
                            const clone = template.content.cloneNode(true);
                            activeNodes = Array.from(clone.childNodes);
                            activeNodes.forEach((n) => bindNode2(n, ctx, instance, []));
                            if (placeholder.parentNode) placeholder.parentNode.insertBefore(clone, placeholder);
                        } else {
                            const node = template.cloneNode(true);
                            bindNode2(node, ctx, instance, []);
                            if (placeholder.parentNode) placeholder.parentNode.insertBefore(node, placeholder);
                            activeNodes = [node];
                        }
                    }
                    if (initialRan && instance) queueComponentUpdated(instance);
                }
            }, { name: `if: ${val}`, area: "directive" });
            initialRan = true;

            trackCleanup(() => {
                cleanup(e);
                activeNodes.forEach((n) => destroyNode(n));
                activeNodes = [];
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            });
        }
    };

    dirs.for = {
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

                if (oldStart > oldEnd) {
                    const anchor = getAnchor(newItems, newEnd + 1);
                    const parentNode = placeholder.parentNode;
                    for (let i = newStart; i <= newEnd; i++) {
                        const itemRecord = createItemRecord(list[i], i, newKeys[i]);
                        newItems[i] = itemRecord;
                        if (parentNode) {
                            for (let k = 0; k < itemRecord.nodes.length; k++) {
                                parentNode.insertBefore(itemRecord.nodes[k], anchor);
                            }
                        }
                    }
                } else if (newStart > newEnd) {
                    for (let i = oldStart; i <= oldEnd; i++) {
                        renderedItems[i].nodes.forEach((n) => destroyNode(n));
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
                            prevItem.nodes.forEach((n) => destroyNode(n));
                            continue;
                        }
                        const newIndex = keyToNewIndexMap.get(prevItem.key);
                        if (newIndex === undefined) {
                            prevItem.nodes.forEach((n) => destroyNode(n));
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

    dirs.ref.priority = 100;
    dirs.if.priority = 100;
    dirs.for.priority = 90;
    dirs.model.priority = 50;
    dirs.bind.priority = 10;
    dirs.on.priority = 10;
    dirs.text.priority = 5;
    dirs.html.priority = 5;
    dirs.show.priority = 5;

    return dirs;
}
