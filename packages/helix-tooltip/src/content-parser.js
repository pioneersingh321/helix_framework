import { PATH_LIKE_RE, EXPRESSION_HINT_RE } from './constants.js';

export function splitTopLevel(str, delimiter) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (quote) {
            current += ch;
            if (ch === quote && str[i - 1] !== '\\') quote = null;
            continue;
        }
        if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
        if (ch === '{' || ch === '[' || ch === '(') { depth++; current += ch; continue; }
        if (ch === '}' || ch === ']' || ch === ')') { depth--; current += ch; continue; }
        if (ch === delimiter && depth === 0) { parts.push(current); current = ''; continue; }
        current += ch;
    }
    if (current.trim() !== '') parts.push(current);
    return parts;
}

export function findTopLevelColon(str) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (quote) { if (ch === quote && str[i - 1] !== '\\') quote = null; continue; }
        if (ch === "'" || ch === '"') { quote = ch; continue; }
        if (ch === '{' || ch === '[' || ch === '(') { depth++; continue; }
        if (ch === '}' || ch === ']' || ch === ')') { depth--; continue; }
        if (ch === ':' && depth === 0) return i;
    }
    return -1;
}

// Returns { key: rawValueString, ... } or null if too malformed to trust
// (caller warns rather than silently rendering nothing useful).
export function parseObjectLiteral(trimmed) {
    const inner = trimmed.slice(1, -1);
    const out = {};
    for (const rawPair of splitTopLevel(inner, ',')) {
        const pair = rawPair.trim();
        if (!pair) continue;
        const colonIdx = findTopLevelColon(pair);
        if (colonIdx === -1) return null;
        let key = pair.slice(0, colonIdx).trim();
        if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
            key = key.slice(1, -1);
        }
        if (!/^[a-zA-Z_$][\w$]*$/.test(key)) return null;
        out[key] = pair.slice(colonIdx + 1).trim();
    }
    return out;
}

// hx-tooltip's top-level content grammar: quoted literal, plain ctx path,
// EXPRESSION_HINT_RE-flagged near-miss (warns), or plain prose fallback.
// Not a JS expression evaluator by design — see the plugin's own CONTRACT docs.
export function resolveContent(app, rawVal, ctx, el) {
    const trimmed = (rawVal || '').trim();
    const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
    const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
    if (isSingleQuoted || isDoubleQuoted) return trimmed.slice(1, -1);

    if (PATH_LIKE_RE.test(trimmed)) {
        const resolved = app.resolvePath(trimmed, ctx);
        return resolved === undefined ? '' : resolved;
    }

    if (EXPRESSION_HINT_RE.test(trimmed)) {
        console.warn(
            `[Helix.js][$tooltip] hx-tooltip does not evaluate expressions, only a ` +
            `quoted literal or a plain ctx path is supported. Got: "${trimmed}"` +
            (el && el.tagName ? ` on <${el.tagName.toLowerCase()}>` : '') +
            `. Rendering empty instead of the literal expression text.`
        );
        return '';
    }

    // Plain prose, e.g. hx-tooltip="Delete this item" — not a path attempt at all.
    return trimmed;
}

// Resolves ONE object-config value: same restricted vocabulary as top-level
// content, plus number/boolean/null literals (useful for delay/html/etc).
export function resolveScalarValue(app, raw, ctx, el, key) {
    const trimmed = (raw || '').trim();
    const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
    const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
    if (isSingleQuoted || isDoubleQuoted) return trimmed.slice(1, -1);
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null' || trimmed === 'undefined') return null;
    if (PATH_LIKE_RE.test(trimmed)) {
        const resolved = app.resolvePath(trimmed, ctx);
        return resolved === undefined ? null : resolved;
    }
    console.warn(
        `[Helix.js][$tooltip] Unsupported value for "${key}" in hx-tooltip object config: "${trimmed}". ` +
        `Use a quoted string, number, true/false, null, or a plain ctx path.` +
        (el && el.tagName ? ` (on <${el.tagName.toLowerCase()}>)` : '')
    );
    return null;
}

export function resolveCallArgs(app, rawArgs, ctx, el) {
    const trimmed = (rawArgs || '').trim();
    if (!trimmed) return [];
    return splitTopLevel(trimmed, ',').map((rawArg) => {
        const a = rawArg.trim();
        if (a === '$event') {
            return { type: 'tooltip', target: el, currentTarget: el, preventDefault() { }, stopPropagation() { } };
        }
        return resolveScalarValue(app, a, ctx, el, 'argument');
    });
}

export function parseNumberModifier(modifiers, prefix) {
    for (const m of modifiers) {
        if (m.startsWith(prefix)) {
            const n = parseInt(m.slice(prefix.length), 10);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

export function parsePrefixedModifier(modifiers, prefix) {
    const m = modifiers.find((x) => x.startsWith(prefix));
    return m ? m.slice(prefix.length) : null;
}
