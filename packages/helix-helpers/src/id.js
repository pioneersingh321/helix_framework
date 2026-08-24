let helperIdCounter = 0;

function getDefaultPrefix(app) {
    const raw = app?.config?.prefix ||
        (typeof window !== 'undefined' && window.Helix?.config?.prefix) ||
        (typeof globalThis !== 'undefined' && globalThis.Helix?.config?.prefix) ||
        'hx';
    // Strip trailing '-' or ':' so e.g. 'hx-' -> 'hx', 'h-' -> 'h'
    return String(raw).replace(/[-:]+$/, '') || 'hx';
}

export function createIdMethods(H, app) {
    return {
        id(prefix) {
            const p = prefix != null ? prefix : getDefaultPrefix(app);
            return `${p}-${++helperIdCounter}`;
        },

        uniqueId(prefix) {
            const p = prefix != null ? prefix : getDefaultPrefix(app);
            const randomSuffix = typeof H.uid === 'function' ? H.uid(8) : Math.random().toString(36).slice(2, 10);
            return `${p}-${randomSuffix}`;
        }
    };
}
