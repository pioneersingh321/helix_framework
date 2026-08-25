export function getPrefix() {
    const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
    return (root.Helix && root.Helix.config && root.Helix.config.prefix) || 'hx-';
}
