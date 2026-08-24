import { _unref } from './shared.js';

export function createValidationMethods(H) {
    return {
        isEmail(str) {
            const s = _unref(str);
            if (!H.isString(s)) return false;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        },

        isUrl(str, options = {}) {
            const s = _unref(str);
            if (!H.isString(s)) return false;
            const opts = _unref(options) || {};
            const allowed = opts.protocols || ['http:', 'https:'];
            try {
                const u = new URL(s);
                return Array.isArray(allowed) ? allowed.includes(u.protocol) : true;
            } catch {
                return false;
            }
        },

        isPhone(str, c = 'US') {
            const s = _unref(str);
            if (!H.isString(s)) return false;
            const country = _unref(c) || 'US';
            const p = {
                US: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
                UK: /^\+?44[-.\s]?7\d{3}[-.\s]?\d{6}$/,
                IN: /^\+?91[-.\s]?[6-9]\d{4}[-.\s]?\d{5}$|^\+?91[-.\s]?[6-9]\d{9}$|^[6-9]\d{9}$/
            };
            return (p[country] || p.US).test(s.trim());
        },

        minLength(str, len) {
            const s = _unref(str);
            const l = _unref(len);
            return H.isString(s) && s.length >= l;
        },

        maxLength(str, len) {
            const s = _unref(str);
            const l = _unref(len);
            return H.isString(s) && s.length <= l;
        },

        range(num, min, max) {
            const n = _unref(num);
            const mn = _unref(min);
            const mx = _unref(max);
            return H.isNumber(n) && n >= mn && n <= mx;
        },

        isHexColor(str) {
            const s = _unref(str);
            return H.isString(s) && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(s);
        }
    };
}
