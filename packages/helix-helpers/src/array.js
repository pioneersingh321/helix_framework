import { _isInteger } from './shared.js';

export function createArrayMethods(H) {
    return {
        unique(arr) {
            if (!Array.isArray(arr)) return arr;
            return [...new Set(arr)];
        },

        flatten(arr, depth = Infinity) {
            if (!Array.isArray(arr)) return arr;
            return arr.flat(depth);
        },

        groupBy(arr, key) {
            if (!Array.isArray(arr)) return {};
            return arr.reduce((r, item) => {
                const k = typeof key === 'function' ? key(item) : H.get(item, key);
                (r[k] = r[k] || []).push(item);
                return r;
            }, {});
        },

        keyBy(arr, key) {
            if (!Array.isArray(arr)) return {};
            return arr.reduce((r, item) => {
                const k = typeof key === 'function' ? key(item) : H.get(item, key);
                r[k] = item;
                return r;
            }, {});
        },

        sortBy(arr, key, order = 'asc') {
            if (!Array.isArray(arr)) return arr;
            const sorted = [...arr].sort((a, b) => {
                let av = key ? H.get(a, key) : a;
                let bv = key ? H.get(b, key) : b;
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                if (typeof av === 'string' && typeof bv === 'string') {
                    return av.localeCompare(bv, undefined, { sensitivity: 'base' });
                }
                return av < bv ? -1 : av > bv ? 1 : 0;
            });
            return order === 'desc' ? sorted.reverse() : sorted;
        },

        chunk(arr, size) {
            if (!Array.isArray(arr) || !_isInteger(size) || size <= 0) return [];
            const result = [];
            for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
            return result;
        },

        pluck(arr, key) {
            if (!Array.isArray(arr)) return [];
            return arr.map(i => H.get(i, key)).filter(v => v !== undefined);
        },

        findBy(arr, key, val) {
            if (!Array.isArray(arr)) return undefined;
            return arr.find(i => H.get(i, key) === val);
        },

        removeBy(arr, key, val) {
            if (!Array.isArray(arr)) return arr;
            return arr.filter(i => H.get(i, key) !== val);
        },

        partition(arr, predicate) {
            if (!Array.isArray(arr)) return [[], []];
            return arr.reduce((acc, item) => {
                acc[predicate(item) ? 0 : 1].push(item);
                return acc;
            }, [[], []]);
        },

        difference(arr, ...others) {
            if (!Array.isArray(arr)) return [];
            const combined = new Set(others.flat());
            return arr.filter(x => !combined.has(x));
        },

        intersection(arr, ...others) {
            if (!Array.isArray(arr)) return [];
            const sets = others.map(o => new Set(o));
            return arr.filter(x => sets.every(s => s.has(x)));
        }
    };
}
