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
        }
    };
    dirs.text = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, trackCleanup }) {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.TEXT;
            const updateFn = () => {
                const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-text" });
                const newText = typeof res === "object" && res !== null ? JSON.stringify(res) : res ?? "";
                if (el.textContent !== newText) el.textContent = newText;
            };
            const e = effect(updateFn, { name: `text: ${val}`, area: "directive" });
            trackCleanup(() => cleanup(e));
        }
    };
    dirs.html = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, trackCleanup }) {
            const updateFn = () => {
                const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-html" });
                const newHtml = sanitizeHtml(res || "");
                if (el.innerHTML !== newHtml) el.innerHTML = newHtml;
            };
            const e = effect(updateFn, { name: `html: ${val}`, area: "directive" });
            trackCleanup(() => cleanup(e));
        }
    };
    dirs.model = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, trackCleanup }) {
            const isCheck = el.type === "checkbox";
            const isRadio = el.type === "radio";
            const isSelect = el.tagName === "SELECT";
            const isSelectMultiple = isSelect && el.multiple;
            const evtType = isCheck || isRadio || isSelect ? "change" : "input";
            const handler = (e2) => {
                const parts = getPathParts(val);
                const last = parts.pop();
                const parent = parts.reduce((acc, part) => acc?.[part], ctx);
                if (parent) {
                    if (isCheck) parent[last] = e2.target.checked;
                    else if (isRadio) parent[last] = e2.target.value;
                    else if (isSelectMultiple) {
                        const selected = Array.from(e2.target.selectedOptions).map(opt => opt.value);
                        parent[last] = selected;
                    }
                    else {
                        const rawValue = e2.target.value;
                        if (el.type === "number") {
                            const num = rawValue === "" ? "" : Number(rawValue);
                            parent[last] = Number.isNaN(num) ? rawValue : num;
                        } else parent[last] = rawValue;
                    }
                }
            };
            el.addEventListener(evtType, handler);
            const updateFn = () => {
                const current = resolvePath(val, ctx);
                if (isRadio) {
                    const shouldCheck = current === el.value;
                    if (el.checked !== shouldCheck) el.checked = shouldCheck;
                } else if (isCheck) {
                    const shouldCheck = !!current;
                    if (el.checked !== shouldCheck) el.checked = shouldCheck;
                } else if (isSelectMultiple) {
                    const selectedValues = Array.isArray(current) ? current : [];
                    Array.from(el.options).forEach(opt => {
                        opt.selected = selectedValues.includes(opt.value);
                    });
                } else {
                    const newValue = current ?? "";
                    if (el.value !== newValue) el.value = newValue;
                }
            };
            const e = effect(updateFn, { name: `model: ${val}`, area: "directive" });
            trackCleanup(() => {
                el.removeEventListener(evtType, handler);
                cleanup(e);
            });
        }
    };
    dirs.bind = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, arg, ctx, trackCleanup }) {
            if (!arg) return;
            const trimmed = val.trim();
            const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
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
            };
            const e = effect(updateFn, { name: `bind: ${arg}`, area: "directive" });
            trackCleanup(() => cleanup(e));
        }
    };
    dirs.on = {
        mounted(el, { value: val, arg, modifiers, ctx, trackCleanup }) {
            const evtType = arg || "click";

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

            const handler = (e) => {
                if (modifiers.includes("prevent")) e.preventDefault();
                if (modifiers.includes("stop")) e.stopPropagation();

                let targetFn;
                let args = [e];

                const trimmed = val.trim();
                const parenIdx = trimmed.indexOf('(');

                if (parenIdx > -1 && trimmed.endsWith(')')) {
                    const fnPath = trimmed.slice(0, parenIdx).trim();
                    const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();

                    targetFn = resolveRaw(fnPath, ctx);

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
                    targetFn = resolveRaw(val, ctx);
                }

                if (typeof targetFn === "function") {
                    try {
                        targetFn.call(ctx, ...args);
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
                    warn(`Handler not found: ${val}`, "event");
                }
            };

            el.addEventListener(evtType, handler);
            trackCleanup(() => el.removeEventListener(evtType, handler));
        }
    };
    dirs.show = {
        mounted(el, binding) {
            this.updated(el, binding);
        },
        updated(el, { value: val, ctx, trackCleanup }) {
            const updateFn = () => {
                const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-show" });
                const newDisplay = shouldShow ? "" : "none";
                if (el.style.display !== newDisplay) el.style.display = newDisplay;
            };
            const e = effect(updateFn, { name: `show: ${val}`, area: "directive" });
            trackCleanup(() => cleanup(e));
        }
    };
    dirs.if = {
        mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
            const placeholder = document.createComment(` ${appConfig.prefix}if: ${val} `);
            if (el.parentNode) {
                el.parentNode.insertBefore(placeholder, el);
                el.remove();
            }
            const template = el;
            let nodes = [];
            const e = effect(() => {
                const isTrue = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-if" });
                if (isTrue && nodes.length === 0) {
                    if (template.tagName === 'TEMPLATE' && template.content) {
                        const clone = template.content.cloneNode(true);
                        nodes = Array.from(clone.childNodes);
                        nodes.forEach((n) => bindNode2(n, ctx, instance, []));
                        if (placeholder.parentNode) placeholder.parentNode.insertBefore(clone, placeholder);
                    } else {
                        const node = template.cloneNode(true);
                        bindNode2(node, ctx, instance, []);
                        if (placeholder.parentNode) placeholder.parentNode.insertBefore(node, placeholder);
                        nodes = [node];
                    }
                } else if (!isTrue && nodes.length > 0) {
                    nodes.forEach((n) => destroyNode(n));
                    nodes = [];
                }
            }, { name: `if: ${val}`, area: "directive" });
            trackCleanup(() => {
                cleanup(e);
                nodes.forEach((n) => destroyNode(n));
                nodes = [];
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            });
        }
    };
    dirs.for = {
        mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
            const match = val.match(/^(?:(?:\(([^,]+),\s*([^)]+)\)|([^\s]+))\s+in\s+(.+))$/);
            if (!match) return warn(`[for] Invalid syntax: ${val}`, "compiler");
            const itemName = match[1] || match[3];
            const indexName = match[2];
            const listPath = match[4];
            const templateTarget = (el.tagName === 'TEMPLATE' && el.content)
                ? (el.content.firstElementChild || el)
                : el;
            const keyPath = el.getAttribute(`${appConfig.prefix}key`) || el.getAttribute(":key") ||
                (el.tagName === 'TEMPLATE' && el.content && el.content.firstElementChild ?
                    (el.content.firstElementChild.getAttribute(`${appConfig.prefix}key`) || el.content.firstElementChild.getAttribute(":key")) : null);
            el.removeAttribute(`${appConfig.prefix}key`);
            el.removeAttribute(":key");
            const placeholder = document.createComment(` ${appConfig.prefix}for: ${val} `);
            el.parentNode.insertBefore(placeholder, el);
            el.remove();
            let renderedNodes = [];

            const updateFn = () => {
                let list = [];
                const directList = resolvePath(listPath, ctx);
                if (Array.isArray(directList)) list = directList;
                else if (appConfig.allowInlineExpressions) {
                    try {
                        list = new Function("$ctx", `with($ctx) { return ${listPath} }`)(ctx) || [];
                    } catch (err) {
                        handleError(err, `${appConfig.prefix}for expression: ${listPath}`);
                    }
                } else {
                    warn(`Inline expressions disabled. Use a computed property for complex lists: ${listPath}`, "compiler");
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
                let oldEnd = renderedNodes.length - 1;
                let newEnd = list.length - 1;

                while (oldStart <= oldEnd && newStart <= newEnd && renderedNodes[oldStart].__hx_key === newKeys[newStart]) {
                    const node = renderedNodes[oldStart];
                    node.__hx_scope[itemName] = list[newStart];
                    if (indexName) node.__hx_scope[indexName] = newStart;
                    oldStart++;
                    newStart++;
                }

                while (oldStart <= oldEnd && newStart <= newEnd && renderedNodes[oldEnd].__hx_key === newKeys[newEnd]) {
                    const node = renderedNodes[oldEnd];
                    node.__hx_scope[itemName] = list[newEnd];
                    if (indexName) node.__hx_scope[indexName] = newEnd;
                    oldEnd--;
                    newEnd--;
                }

                const newNodes = new Array(list.length);
                for (let i = 0; i < newStart; i++) {
                    newNodes[i] = renderedNodes[i];
                }
                for (let i = newEnd + 1; i < list.length; i++) {
                    const oldIndex = oldEnd + 1 + (i - (newEnd + 1));
                    newNodes[i] = renderedNodes[oldIndex];
                }

                if (oldStart > oldEnd) {
                    const anchor = newEnd + 1 < list.length ? newNodes[newEnd + 1] : placeholder;
                    const parentNode = placeholder.parentNode;
                    for (let i = newStart; i <= newEnd; i++) {
                        const key = newKeys[i];
                        const item = list[i];
                        const node = templateTarget.cloneNode(true);
                        node.__hx_key = key;
                        node.__hx_scope = reactive({ [itemName]: item });
                        if (indexName) node.__hx_scope[indexName] = i;
                        const childCtx = Object.setPrototypeOf(node.__hx_scope, ctx);
                        bindNode2(node, childCtx, instance, []);
                        newNodes[i] = node;
                        if (parentNode) parentNode.insertBefore(node, anchor);
                    }
                } else if (newStart > newEnd) {
                    for (let i = oldStart; i <= oldEnd; i++) {
                        destroyNode(renderedNodes[i]);
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
                        const prevChild = renderedNodes[i];
                        if (patched >= toBePatched) {
                            destroyNode(prevChild);
                            continue;
                        }
                        const newIndex = keyToNewIndexMap.get(prevChild.__hx_key);
                        if (newIndex === undefined) {
                            destroyNode(prevChild);
                        } else {
                            newIndexToOldIndexMap[newIndex - newStart] = i + 1;
                            prevChild.__hx_scope[itemName] = list[newIndex];
                            if (indexName) prevChild.__hx_scope[indexName] = newIndex;
                            newNodes[newIndex] = prevChild;
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
                        const anchor = newIndex + 1 < list.length ? newNodes[newIndex + 1] : placeholder;

                        if (newIndexToOldIndexMap[i] === 0) {
                            const key = newKeys[newIndex];
                            const item = list[newIndex];
                            const node = templateTarget.cloneNode(true);
                            node.__hx_key = key;
                            node.__hx_scope = reactive({ [itemName]: item });
                            if (indexName) node.__hx_scope[indexName] = newIndex;
                            const childCtx = Object.setPrototypeOf(node.__hx_scope, ctx);
                            bindNode2(node, childCtx, instance, []);
                            newNodes[newIndex] = node;
                            if (parentNode) parentNode.insertBefore(node, anchor);
                        } else if (moved) {
                            if (j < 0 || i !== lisSequence[j]) {
                                if (parentNode) parentNode.insertBefore(newNodes[newIndex], anchor);
                            } else {
                                j--;
                            }
                        }
                    }
                }

                renderedNodes = newNodes;
            };
            const e = effect(updateFn, { name: `for: ${listPath}`, area: "directive" });
            const teardown = () => {
                cleanup(e);
                renderedNodes.forEach((n) => destroyNode(n));
                renderedNodes = [];
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

