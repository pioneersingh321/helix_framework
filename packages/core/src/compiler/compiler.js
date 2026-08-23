import {
    pathCache,
    MAX_PATH_CACHE_SIZE,
    warn,
    handleError
} from '../shared/shared.js';
import { globalConfig } from '../app/config.js';
import { isRef } from '../reactivity/ref.js';

import { globalExpressionCache } from './cache.js';

export function compile(expression) {
    const cached = globalExpressionCache.get(expression);
    if (cached) return cached;
    const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
    if (Helix && typeof Helix.compile === 'function') {
        const fn = Helix.compile(expression);
        globalExpressionCache.set(expression, fn);
        return fn;
    }
    const compiledFn = new Function(
        "$ctx",
        `with($ctx){ return (${expression}); }`
    );
    globalExpressionCache.set(expression, compiledFn);
    return compiledFn;
}

export function getPathParts(path) {
    if (pathCache.has(path)) {
        const parts2 = pathCache.get(path);
        pathCache.delete(path);
        pathCache.set(path, parts2);
        return [...parts2];
    }
    const parts = path.replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1").split(".").filter(Boolean);
    if (pathCache.size >= MAX_PATH_CACHE_SIZE) {
        const firstKey = pathCache.keys().next().value;
        pathCache.delete(firstKey);
    }
    pathCache.set(path, parts);
    return [...parts];
}

export function getMatchedKey(obj, prop) {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function')) return null;
    if (prop in obj) return prop;
    const lower = String(prop).toLowerCase();
    for (const k in obj) {
        if (k.toLowerCase() === lower) return k;
    }
    try {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].toLowerCase() === lower) return keys[i];
        }
    } catch {}
    return null;
}

export function resolvePath(path, ctx) {
    try {
        const val = getPathParts(path).reduce((acc, part) => {
            const unwrapped = isRef(acc) ? acc.value : acc;
            if (unwrapped == null) return void 0;
            const matched = getMatchedKey(unwrapped, part);
            return matched ? unwrapped[matched] : unwrapped[part];
        }, ctx);
        return isRef(val) ? val.value : val;
    } catch (err) {
        warn(`Failed to resolve path: ${path}`, "compiler", err);
        return void 0;
    }
}

export function resolveRaw(path, ctx) {
    try {
        return getPathParts(path).reduce((acc, part) => {
            const unwrapped = isRef(acc) ? acc.value : acc;
            if (unwrapped == null) return void 0;
            const matched = getMatchedKey(unwrapped, part);
            return matched ? unwrapped[matched] : unwrapped[part];
        }, ctx);
    } catch (err) {
        warn(`Failed to resolve raw path: ${path}`, "compiler", err);
        return void 0;
    }
}

const SIMPLE_PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
export function isSimplePathSyntax(val) {
    return SIMPLE_PATH_RE.test(val.trim());
}

const warnedInlineExpressions = new Set();

export function resolveExpression(val, ctx, { asBoolean = false, fallback = void 0, contextName = "expression", forceExpression = false } = {}) {
    let result;
    const parts = getPathParts(val);
    let current = ctx;
    let exists = true;
    for (let i = 0; i < parts.length; i++) {
        if (current == null || (typeof current !== "object" && typeof current !== "function")) {
            exists = false;
            break;
        }
        const unwrapped = isRef(current) ? current.value : current;
        if (unwrapped == null || (typeof unwrapped !== "object" && typeof unwrapped !== "function")) {
            exists = false;
            break;
        }
        const matched = getMatchedKey(unwrapped, parts[i]);
        if (matched) {
            current = unwrapped[matched];
        } else {
            exists = false;
            break;
        }
    }
    if (exists) {
        result = isRef(current) ? current.value : current;
    } else if (isSimplePathSyntax(val)) {
        try {
            parts.reduce((acc, part) => {
                const u = isRef(acc) ? acc.value : acc;
                const m = getMatchedKey(u, part);
                return m ? u[m] : u?.[part];
            }, ctx);
        } catch (e) {}
        if (!globalConfig.allowInlineExpressions && !forceExpression) {
            warn(`Path not found: ${val}`, "compiler");
        }
        result = fallback;
    } else if (globalConfig.allowInlineExpressions || forceExpression) {
        if (globalConfig.debug && globalConfig.allowInlineExpressions && !warnedInlineExpressions.has(val)) {
            warnedInlineExpressions.add(val);
            if (globalConfig.warnInlineExpressions) {
                warn(`Security: inline expressions enabled. Never use with untrusted user input. (expression: "${val}")`, "security");
            } else {
                warn(`Security: inline expressions enabled. Never use with untrusted user input.`, "security");
            }
        }
        try {
            const compiledFn = compile(val);
            result = compiledFn(ctx);
        } catch (err) {
            handleError(err, `${contextName}: ${val}`);
            result = fallback;
        }
    } else {
        warn(`Path not found: ${val}`, "compiler");
        result = fallback;
    }
    if (!exists) {
        return result;
    }
    return asBoolean ? !!result : result;
}
