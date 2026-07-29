export function compile(expression) {
    const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
    if (Helix && typeof Helix.compile === 'function') {
        return Helix.compile(expression);
    }
    return new Function(
        "$ctx",
        `with($ctx){ return (${expression}); }`
    );
}
