import { FUNCTION_CALL_RE } from './constants.js';
import { resolveCallArgs } from './content-parser.js';

function applyAsyncResult(state, el, result, updateTooltip) {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        if (result.title !== undefined) state.content = result.title;
        else if (result.content !== undefined) state.content = result.content;
        else {
            console.warn('[Helix.js][$tooltip] async hx-tooltip result has no "title" or "content" key.');
            state.content = '';
        }
        if (result.html !== undefined) state.html = !!result.html;
        if (result.placement !== undefined) state.placement = result.placement;
        if (result.theme !== undefined) state.theme = result.theme;
        if (result.animation !== undefined) state.animation = result.animation;
        if (result.interactive !== undefined) state.interactive = !!result.interactive;
    } else {
        state.content = result == null ? '' : result;
    }
    updateTooltip(el, state.content);
}

// Fires the call if `contentRaw` is function-call-shaped. Returns true if it
// handled it (caller should skip the normal reactive resolveContent path
// entirely), false otherwise. Mirrors hx-scope's async architecture: called
// ONCE at mount, token-guarded against a destroyed/unmounted anchor resolving
// late.
export function tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip) {
    const trimmed = (contentRaw || '').trim();
    const match = trimmed.match(FUNCTION_CALL_RE);
    if (!match) return false;

    const fnPath = match[1];
    const rawArgs = match[2];
    const fn = app.resolvePath(fnPath, ctx);

    if (typeof fn !== 'function') {
        console.warn(`[Helix.js][$tooltip] hx-tooltip could not find a function at "${fnPath}" for the call "${trimmed}".`);
        state.content = '';
        return true;
    }

    const args = resolveCallArgs(app, rawArgs, ctx, el);
    let destroyed = false;
    trackCleanup(() => { destroyed = true; });

    Promise.resolve()
        .then(() => fn.apply(ctx, args))
        .then((result) => {
            if (destroyed) return; // anchor was unmounted before this resolved
            applyAsyncResult(state, el, result, updateTooltip);
        })
        .catch((err) => {
            if (destroyed) return;
            console.error(`[Helix.js][$tooltip] async hx-tooltip call "${trimmed}" failed:`, err);
            state.content = '';
            updateTooltip(el, state.content);
        });

    return true;
}
