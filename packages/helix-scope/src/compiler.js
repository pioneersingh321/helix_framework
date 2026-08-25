export function compile(expression) {
    const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (root.Helix && typeof root.Helix.compile === 'function') {
        return root.Helix.compile(expression);
    }
    return new Function('$ctx', `with($ctx){ return (${expression}); }`);
}
