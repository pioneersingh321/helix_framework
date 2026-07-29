export function getPrefix() {
    if (typeof window !== 'undefined' && window.Helix && window.Helix.config && window.Helix.config.prefix) {
        return window.Helix.config.prefix;
    }
    if (typeof globalThis !== 'undefined' && globalThis.Helix && globalThis.Helix.config && globalThis.Helix.config.prefix) {
        return globalThis.Helix.config.prefix;
    }
    return 'hx-';
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
