export const PLACEMENTS = ['top', 'bottom', 'left', 'right'];

export const FALLBACK_CHAINS = {
    top: ['top', 'bottom', 'right', 'left'],
    bottom: ['bottom', 'top', 'right', 'left'],
    left: ['left', 'right', 'top', 'bottom'],
    right: ['right', 'left', 'top', 'bottom']
};

export const DEFAULT_OPTIONS = {
    placement: 'top',
    theme: 'dark',
    animation: 'zoom',
    showDelay: 100,
    hideDelay: 60,
    offset: 8,
    viewportPadding: 8,
    maxWidth: 240,
    arrow: true,
    zIndex: 9999,
    appendTo: 'body',
    closeOnClickOutside: true,
    closeOnEscape: true,
    longPressDelay: 450,
    sanitize: null,
    liveTracking: false,
    ariaLive: false
};

// hx-tooltip's value grammar (see the CONTRACT section of the plugin's own
// header docs): a quoted literal, a plain ctx path, an object-config literal,
// or a function call. These four regexes classify which shape a given value is.
export const PATH_LIKE_RE = /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
export const EXPRESSION_HINT_RE = /\?\.|\?\?|\|\||&&|===|!==|=>|\(\)/;
export const OBJECT_LITERAL_RE = /^\{[\s\S]*\}$/;
export const FUNCTION_CALL_RE = /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\(([\s\S]*)\)$/;

export const TRIGGER_WORDS = ['hover', 'click', 'focus', 'manual'];
export const ANIMATION_WORDS = ['fade', 'zoom', 'slide', 'flip'];
