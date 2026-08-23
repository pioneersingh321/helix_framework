import { warn } from '../shared/shared.js';

export const KEYBOARD_EVENTS = new Set([
    'keydown',
    'keyup',
    'keypress'
]);

export const KEY_ALIASES = {
    enter: ["Enter"],
    tab: ["Tab"],
    delete: ["Delete", "Backspace"],
    esc: ["Escape", "Esc"],
    escape: ["Escape", "Esc"],
    space: [" ", "Space", "Spacebar"],
    up: ["ArrowUp", "Up"],
    down: ["ArrowDown", "Down"],
    left: ["ArrowLeft", "Left"],
    right: ["ArrowRight", "Right"],
    home: ["Home"],
    end: ["End"],
    "page-up": ["PageUp"],
    pageup: ["PageUp"],
    "page-down": ["PageDown"],
    pagedown: ["PageDown"],
    insert: ["Insert"],
    "caps-lock": ["CapsLock"],
    capslock: ["CapsLock"],
    "num-lock": ["NumLock"],
    numlock: ["NumLock"],
    "scroll-lock": ["ScrollLock"],
    scrolllock: ["ScrollLock"],
    f1: ["F1"], f2: ["F2"], f3: ["F3"], f4: ["F4"],
    f5: ["F5"], f6: ["F6"], f7: ["F7"], f8: ["F8"],
    f9: ["F9"], f10: ["F10"], f11: ["F11"], f12: ["F12"]
};

export const NON_KEY_MODIFIERS = new Set([
    "capture", "once", "passive",
    "window", "document", "outside",
    "stop", "prevent", "self",
    "ctrl", "alt", "shift", "meta", "exact"
]);

export function isValidKeyModifier(mod) {
    if (!mod || typeof mod !== "string") return false;
    const lower = mod.toLowerCase();
    if (KEY_ALIASES[lower]) return true;
    // Single character (letters, numbers, basic symbols)
    if (lower.length === 1) return true;
    return false;
}

export function matchesKey(keyMod, eventKey) {
    if (!eventKey) return false;
    const lowerKey = eventKey.toLowerCase();
    const lowerMod = keyMod.toLowerCase();
    if (KEY_ALIASES[lowerMod]) {
        return KEY_ALIASES[lowerMod].some(alias => alias.toLowerCase() === lowerKey || alias === eventKey);
    }
    if (lowerKey === lowerMod) return true;
    const hyp = eventKey.replace(/\B([A-Z])/g, '-$1').toLowerCase();
    if (hyp === lowerMod) return true;
    return false;
}

export function isKeyboardEvent(e, evtType) {
    return typeof evtType === "string" && KEYBOARD_EVENTS.has(evtType);
}

export function filterKeyModifiers(modifiers, isKeyboard, evtType = "keydown") {
    if (!isKeyboard) return [];
    return modifiers.filter(m => {
        if (NON_KEY_MODIFIERS.has(m)) return false;
        if (isValidKeyModifier(m)) return true;
        warn(`Unknown keyboard modifier '.${m}' on @${evtType}. Allowed modifiers are key aliases (enter, esc, etc.), single characters (a-z, 0-9), or standard event modifiers.`, "event");
        return false;
    });
}

