import { compile } from './compiler.js';

export function parseDefaults(defaultsRaw) {
    if (!defaultsRaw) return null;
    const trimmed = defaultsRaw.trim();

    // Check if it is a JSON literal
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { type: 'static', value: parsed };
        }
    } catch (e) {}

    // Otherwise, treat as dynamic expression and compile it once
    try {
        const evaluator = compile(trimmed);
        return { type: 'dynamic', evaluator };
    } catch (err) {
        console.error(`[helix-scope] Failed to compile default expression: ${trimmed}`, err);
        return null;
    }
}

export function evaluateDefaults(parsedDefaults, ctx) {
    if (!parsedDefaults) return null;
    if (parsedDefaults.type === 'static') {
        return parsedDefaults.value;
    }

    try {
        const val = parsedDefaults.evaluator(ctx);
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            return val;
        }
        console.warn('[helix-scope] Default expression did not evaluate to an object:', val);
    } catch (err) {
        console.error('[helix-scope] Error evaluating default expression:', err);
    }
    return null;
}
