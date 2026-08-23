export const SYSTEM_MODIFIERS = ["ctrl", "alt", "shift", "meta"];

export function checkSystemModifiers(modifiers, e) {
    if (modifiers.includes("ctrl") && !e.ctrlKey) return false;
    if (modifiers.includes("alt") && !e.altKey) return false;
    if (modifiers.includes("shift") && !e.shiftKey) return false;
    if (modifiers.includes("meta") && !e.metaKey) return false;
    return true;
}

export function checkExact(modifiers, e) {
    if (!modifiers.includes("exact")) return true;
    const hasCtrl = modifiers.includes("ctrl");
    const hasAlt = modifiers.includes("alt");
    const hasShift = modifiers.includes("shift");
    const hasMeta = modifiers.includes("meta");

    if (!hasCtrl && e.ctrlKey) return false;
    if (!hasAlt && e.altKey) return false;
    if (!hasShift && e.shiftKey) return false;
    if (!hasMeta && e.metaKey) return false;
    return true;
}

export function getListenerOptions(modifiers) {
    const isCapture = modifiers.includes("capture");
    const isOnce = modifiers.includes("once");
    const isPassive = modifiers.includes("passive");
    const hasNativeOpts = isCapture || isOnce || isPassive;
    return hasNativeOpts ? { capture: isCapture, once: isOnce, passive: isPassive } : false;
}

export function getListenerTarget(el, modifiers) {
    if (modifiers.includes("window") && typeof window !== "undefined") return window;
    if (modifiers.includes("document") && typeof document !== "undefined") return document;
    return el;
}
