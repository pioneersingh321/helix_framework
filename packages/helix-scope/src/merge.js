export function isPlainObject(val) {
    return val && typeof val === 'object' && !Array.isArray(val);
}

export function mergeValues(target, source, seen = new WeakMap()) {
    const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
    const config = Helix?.scope?.config || {};
    const deepMerge = config.deepMerge ?? false;
    const arrayStrategy = config.arrayStrategy ?? 'replace';

    if (!deepMerge) {
        return source;
    }

    if (source && typeof source === 'object') {
        if (seen.has(source)) {
            return seen.get(source);
        }
    }

    if (Array.isArray(target) && Array.isArray(source)) {
        const result = [];
        seen.set(source, result);

        if (arrayStrategy === 'replace') {
            return source;
        } else if (arrayStrategy === 'append') {
            return [...target, ...source];
        } else if (arrayStrategy === 'prepend') {
            return [...source, ...target];
        } else if (arrayStrategy === 'merge') {
            const merged = [...target];
            seen.set(source, merged);
            for (let i = 0; i < source.length; i++) {
                if (i < merged.length) {
                    if (isPlainObject(merged[i]) && isPlainObject(source[i])) {
                        merged[i] = mergeValues(merged[i], source[i], seen);
                    } else if (Array.isArray(merged[i]) && Array.isArray(source[i])) {
                        merged[i] = mergeValues(merged[i], source[i], seen);
                    } else {
                        merged[i] = source[i];
                    }
                } else {
                    merged[i] = source[i];
                }
            }
            return merged;
        }
        return source;
    }

    if (isPlainObject(target) && isPlainObject(source)) {
        const result = { ...target };
        seen.set(source, result);
        for (const key of Object.keys(source)) {
            if (isPlainObject(result[key]) && isPlainObject(source[key])) {
                result[key] = mergeValues(result[key], source[key], seen);
            } else if (Array.isArray(result[key]) && Array.isArray(source[key])) {
                result[key] = mergeValues(result[key], source[key], seen);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    return source;
}

export function mergeWithDefaults(defaults, source) {
    const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
    const config = Helix?.scope?.config || {};
    const deepMerge = config.deepMerge ?? false;

    if (!defaults) return source;
    if (!source) return defaults;

    if (!deepMerge) {
        const result = { ...source };
        for (const key of Object.keys(defaults)) {
            if (result[key] === undefined) {
                result[key] = defaults[key];
            }
        }
        return result;
    }

    return mergeValues(defaults, source);
}
