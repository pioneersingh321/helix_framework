export class ExpressionCache {
    constructor(maxSize = 500) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return undefined;
        const val = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key, val) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, val);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

export class TemplateMetadataCache {
    constructor() {
        this.metadata = new WeakMap();
    }

    get(node) {
        return this.metadata.get(node);
    }

    set(node, data) {
        this.metadata.set(node, data);
    }

    has(node) {
        return this.metadata.has(node);
    }
}

export const globalExpressionCache = new ExpressionCache(500);
export const globalTemplateMetadataCache = new TemplateMetadataCache();
