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
            if (!H.isString(str) || !str.trim()) return {};
            const cleanStr = str.startsWith('?') ? str.slice(1) : str;
            const result = {};
            const params = new URLSearchParams(cleanStr);

            const parseKeys = (key) => {
                const keys = [];
                const re = /^([^\[\]]+)|\[([^\[\]]*)\]/g;
                let match;
                while ((match = re.exec(key)) !== null) {
                    keys.push(match[1] !== undefined ? match[1] : match[2]);
                }
                return keys.length ? keys : [key];
            };

            for (const [rawKey, val] of params) {
                const path = parseKeys(rawKey);
                let curr = result;
                for (let i = 0; i < path.length - 1; i++) {
                    const segment = path[i];
                    const nextSegment = path[i + 1];
                    const isNextIndex = nextSegment !== '' && /^\d+$/.test(nextSegment);

                    if (!(segment in curr) || typeof curr[segment] !== 'object' || curr[segment] === null) {
                        curr[segment] = (isNextIndex || nextSegment === '') ? [] : {};
                    }
                    curr = curr[segment];
                }

                const lastSegment = path[path.length - 1];
                if (lastSegment === '') {
                    if (Array.isArray(curr)) {
                        curr.push(val);
                    }
                } else if (lastSegment in curr) {
                    if (Array.isArray(curr[lastSegment])) {
                        curr[lastSegment].push(val);
                    } else {
                        curr[lastSegment] = [curr[lastSegment], val];
                    }
                } else {
                    curr[lastSegment] = val;
                }
            }
            return result;
        }
    };
}
