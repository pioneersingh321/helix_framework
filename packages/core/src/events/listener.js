import { isKeyboardEvent, filterKeyModifiers, matchesKey } from './keyboard.js';
import { isMouseEvent, checkMouseModifiers } from './mouse.js';
import { checkSystemModifiers, checkExact, getListenerOptions, getListenerTarget } from './modifiers.js';
import { resolveRaw, resolvePath, resolveExpression, getPathParts } from '../compiler/compiler.js';
import { isRef } from '../reactivity/ref.js';
import { handleError, warn } from '../shared/shared.js';

export function parseEventArgs(str) {
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
}

export function createEventListener(el, binding, appConfig = {}) {
    const { value: val, arg, modifiers = [], ctx, trackCleanup } = binding;
    const evtType = arg || "click";

    const isStop = modifiers.includes("stop");
    const isPrevent = modifiers.includes("prevent");
    const isPassive = modifiers.includes("passive");
    const isSelf = modifiers.includes("self");
    const isOutside = modifiers.includes("outside");
    const isOnce = modifiers.includes("once");

    if (isPassive && isPrevent) {
        warn(`@${evtType}.passive.prevent cannot call preventDefault() because passive listeners cannot preventDefault().`, "event");
    }

    const executeHandler = (e) => {
        const isKeyboard = isKeyboardEvent(e, evtType);
        const isMouse = isMouseEvent(e, evtType);

        // 1. Check Key Modifiers
        const keyMods = filterKeyModifiers(modifiers, isKeyboard, evtType);
        if (keyMods.length > 0) {
            if (!e.key || !keyMods.some(mod => matchesKey(mod, e.key))) {
                return false;
            }
        }

        // 2. Check Mouse Modifiers
        if (isMouse && !isKeyboard && !checkMouseModifiers(modifiers, e)) {
            return false;
        }

        // 3. Check System Modifiers
        if (!checkSystemModifiers(modifiers, e)) {
            return false;
        }

        // 4. Check .exact
        if (!checkExact(modifiers, e)) {
            return false;
        }

        // 5. Check .self
        if (isSelf && e.target !== el) {
            return false;
        }

        // 6. Apply .stop and .prevent (ONLY AFTER all filtering passes!)
        if (isStop) e.stopPropagation();
        if (isPrevent && !isPassive) e.preventDefault();

        // 7. Execute Handler
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
                const rawArgs = parseEventArgs(argsStr);
                args = rawArgs.map(a => {
                    if (a === '$event') return e;
                    if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
                        return a.slice(1, -1);
                    }
                    const resolved = resolvePath(a, ctx);
                    if (resolved !== undefined) return resolved;
                    try { return JSON.parse(a); } catch { }
                    try {
                        const evalResult = resolveExpression(a, ctx);
                        if (evalResult !== undefined) return evalResult;
                    } catch { }
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
                console.log("DEBUG listener error: val=", val, "ctx=", ctx);
                handleError(err, `Event @${evtType}`);
            }
        } else {
            warn(`Handler not found: ${val}. Inline expressions are disabled. Set allowInlineExpressions: true in config to enable inline JavaScript.`, "event");
        }
        return true;
    };

    const target = getListenerTarget(el, modifiers);
    const options = getListenerOptions(modifiers);

    const bind = () => {
        let isCleaned = false;
        if (isOutside) {
            const outsideOptions = typeof options === 'object' ? { ...options, once: false } : false;
            let unbindOutside = null;
            const outsideHandler = (e) => {
                const isContained = typeof e.composedPath === 'function' ? e.composedPath().includes(el) : el.contains(e.target);
                if (!isContained && el !== e.target) {
                    const executed = executeHandler(e);
                    if (executed && isOnce && unbindOutside) {
                        unbindOutside();
                    }
                }
            };
            if (typeof document !== 'undefined') {
                document.addEventListener(evtType, outsideHandler, outsideOptions);
                unbindOutside = () => {
                    if (isCleaned) return;
                    isCleaned = true;
                    document.removeEventListener(evtType, outsideHandler, outsideOptions);
                };
                if (trackCleanup) trackCleanup(unbindOutside);
                return unbindOutside;
            }
            return () => {};
        }

        target.addEventListener(evtType, executeHandler, options);
        const unbind = () => {
            if (isCleaned) return;
            isCleaned = true;
            target.removeEventListener(evtType, executeHandler, options);
        };
        if (trackCleanup) trackCleanup(unbind);
        return unbind;
    };

    return {
        target,
        eventName: evtType,
        handler: executeHandler,
        options,
        isOutside,
        bind
    };
}
