import { FALLBACK_CHAINS } from './constants.js';

function coordsFor(rect, tipRect, placement, offset) {
    let top, left;
    if (placement === 'top') {
        top = rect.top - tipRect.height - offset;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else if (placement === 'bottom') {
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else if (placement === 'left') {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - offset;
    } else {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + offset;
    }
    return { top, left };
}

function fitsViewport(top, left, tipRect, viewportPadding) {
    const pad = viewportPadding;
    return top >= pad && left >= pad &&
        top + tipRect.height <= window.innerHeight - pad &&
        left + tipRect.width <= window.innerWidth - pad;
}

function visibleArea(top, left, tipRect) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const visW = Math.max(0, Math.min(left + tipRect.width, vw) - Math.max(left, 0));
    const visH = Math.max(0, Math.min(top + tipRect.height, vh) - Math.max(top, 0));
    return visW * visH;
}

// ----- middleware: flip (choose the least-clipped placement) -----
function middlewareFlip(ctx) {
    const chain = FALLBACK_CHAINS[ctx.placement] || FALLBACK_CHAINS.top;
    for (const p of chain) {
        const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
        if (fitsViewport(top, left, ctx.tipRect, ctx.viewportPadding)) { ctx.placement = p; return ctx; }
    }
    let best = chain[0], bestArea = -1;
    for (const p of chain) {
        const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
        const area = visibleArea(top, left, ctx.tipRect);
        if (area > bestArea) { bestArea = area; best = p; }
    }
    ctx.placement = best;
    return ctx;
}

// ----- middleware: offset (raw coords for the chosen placement) -----
function middlewareOffset(ctx) {
    const { top, left } = coordsFor(ctx.rect, ctx.tipRect, ctx.placement, ctx.offset);
    ctx.top = top;
    ctx.left = left;
    return ctx;
}

// ----- middleware: shift (clamp into the viewport) -----
function middlewareShift(ctx) {
    const pad = ctx.viewportPadding;
    const vw = window.innerWidth, vh = window.innerHeight;
    ctx.left = Math.min(Math.max(ctx.left, pad), vw - ctx.tipRect.width - pad);
    ctx.top = Math.min(Math.max(ctx.top, pad), vh - ctx.tipRect.height - pad);
    return ctx;
}

// ----- middleware: arrow (compute, don't apply, the perpendicular offset) -----
function middlewareArrow(ctx) {
    if (!ctx.arrowEnabled) { ctx.arrow = null; return ctx; }
    const ARROW_HALF = 4;
    const MIN_INSET = 6;
    if (ctx.placement === 'top' || ctx.placement === 'bottom') {
        const anchorCenterX = ctx.rect.left + ctx.rect.width / 2;
        let value = anchorCenterX - ctx.left - ARROW_HALF;
        value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.width - MIN_INSET - ARROW_HALF * 2);
        ctx.arrow = { axis: 'x', value };
    } else {
        const anchorCenterY = ctx.rect.top + ctx.rect.height / 2;
        let value = anchorCenterY - ctx.top - ARROW_HALF;
        value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.height - MIN_INSET - ARROW_HALF * 2);
        ctx.arrow = { axis: 'y', value };
    }
    return ctx;
}

const POSITION_MIDDLEWARE = [middlewareFlip, middlewareOffset, middlewareShift, middlewareArrow];

// rect/tipRect: DOMRect-like {top,left,right,bottom,width,height}.
// config: { offset, arrowEnabled, viewportPadding }.
export function computePosition(rect, tipRect, preferredPlacement, config) {
    let ctx = {
        rect, tipRect,
        placement: preferredPlacement,
        offset: config.offset,
        arrowEnabled: config.arrowEnabled,
        viewportPadding: config.viewportPadding,
        top: 0, left: 0, arrow: null
    };
    for (const fn of POSITION_MIDDLEWARE) ctx = fn(ctx);
    return ctx;
}

// Clamped follow-cursor position (not part of the middleware pipeline —
// follow mode positions relative to the pointer, not an anchor rect).
export function computeFollowPosition(x, y, tipRect, viewportPadding, followOffset = 14) {
    const pad = viewportPadding;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(x + followOffset, pad), vw - tipRect.width - pad);
    const top = Math.min(Math.max(y + followOffset, pad), vh - tipRect.height - pad);
    return { top, left };
}
