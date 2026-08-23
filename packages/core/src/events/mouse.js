export const MOUSE_EVENTS = new Set([
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'contextmenu',
    'auxclick',
    'pointerdown',
    'pointerup'
]);

export const MOUSE_BUTTONS = {
    left: 0,
    middle: 1,
    right: 2
};

export function isMouseEvent(e, evtType) {
    return typeof evtType === "string" && MOUSE_EVENTS.has(evtType);
}

export function checkMouseModifiers(modifiers, e) {
    if (modifiers.includes("left") && e.button !== MOUSE_BUTTONS.left) return false;
    if (modifiers.includes("middle") && e.button !== MOUSE_BUTTONS.middle) return false;
    if (modifiers.includes("right") && e.button !== MOUSE_BUTTONS.right) return false;
    return true;
}
