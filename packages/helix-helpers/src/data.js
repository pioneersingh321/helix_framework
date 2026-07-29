import { _serializeParam } from './shared.js';

export function createDataMethods(H) {
    return {
        stringify: (obj) => JSON.stringify(obj),

        parseJSON(str, def = null) {
            try { return JSON.parse(str); } catch { return def; }
        },

        toQueryString(obj) {
            if (!H.isObject(obj)) return '';
            return Object.entries(obj)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => _serializeParam(k, v))
                .filter(Boolean)
                .join('&');
        },

        fromQueryString(str) {
            if (!H.isString(str)) return {};
            const result = {};
            for (const [k, v] of new URLSearchParams(str)) {
                if (result[k] !== undefined) {
                    result[k] = [].concat(result[k], v);
                } else {
                    result[k] = v;
                }
            }
            return result;
        }
    };
}
