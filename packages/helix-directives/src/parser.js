function isEscaped(str, index) {
    let count = 0;
    for (let i = index - 1; i >= 0; i--) {
        if (str[i] === '\\') {
            count++;
        } else {
            break;
        }
    }
    return count % 2 !== 0;
}

// Splits a string on top-level commas only — respects nested (), {}, [], and
// quoted strings, so e.g. "fn(a, b), 500" splits into ["fn(a, b)", "500"],
// not ["fn(a", " b)", " 500"].
export function splitTopLevel(str) {
    const parts = [];
    let depth = 0, current = '', inQuote = false, quoteChar = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (!inQuote && (ch === '"' || ch === "'" || ch === '`')) {
            inQuote = true; quoteChar = ch; current += ch;
        } else if (inQuote && ch === quoteChar && !isEscaped(str, i)) {
            inQuote = false; current += ch;
        } else if (!inQuote && (ch === '(' || ch === '{' || ch === '[')) {
            depth++; current += ch;
        } else if (!inQuote && (ch === ')' || ch === '}' || ch === ']')) {
            depth--; current += ch;
        } else if (!inQuote && ch === ',' && depth === 0) {
            parts.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

// Parses "fnPath(arg1, arg2)" -> { fnPath, args: [...] }, or a bare
// "fnPath" (no parens) -> { fnPath, args: [] }.
export function parseCall(str) {
    if (!str) return null;
    const trimmed = str.trim();
    const parenIdx = trimmed.indexOf('(');
    if (parenIdx > -1 && trimmed.endsWith(')')) {
        const fnPath = trimmed.slice(0, parenIdx).trim();
        const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();
        return { fnPath, args: argsStr ? splitTopLevel(argsStr) : [] };
    }
    return { fnPath: trimmed, args: [] };
}

// Resolves a dotted/bracket path against ctx. Prefers the real Helix
// resolvePath (via `app`, the plugin API object — not a `typeof Helix`
// global check, which would depend on script load order); falls back to a
// safe manual walk, unwrapping refs at each step via app.isRef, if app
// isn't available or the path doesn't resolve through it.
export function resolvePath(app, ctx, path, fallback) {
    if (!path) return fallback;
    if (typeof path !== 'string') return path;

    if (app && typeof app.resolvePath === 'function') {
        const res = app.resolvePath(path, ctx);
        if (res !== undefined) return res;
    }

    const parts = path.replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1').split('.').filter(Boolean);
    let val = ctx;
    for (const p of parts) {
        if (val == null) return fallback;
        val = val[p];
        if (app && typeof app.isRef === 'function' && app.isRef(val)) {
            val = val.value;
        }
    }
    return val !== undefined ? val : fallback;
}

export function resolveBool(app, ctx, path) {
    return !!resolvePath(app, ctx, path, false);
}

// Resolves a parsed call's argument list against ctx: "$event" -> the real
// event object, otherwise a ctx path, then a JSON literal, then a quoted
// string literal, falling back to the raw text.
export function evaluateArgs(app, ctx, argList, extra = {}) {
    return argList.map(a => {
        if (a === '$event') return extra.event;
        const resolved = resolvePath(app, ctx, a);
        if (resolved !== undefined) return resolved;
        try { return JSON.parse(a); } catch {}
        if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
            return a.slice(1, -1);
        }
        return a;
    });
}
