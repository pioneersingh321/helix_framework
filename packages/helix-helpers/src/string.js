import { _unref } from './shared.js';

export function createStringMethods(H) {
    return {
        capitalize(str) {
            const s = _unref(str);
            if (!H.isString(s) || s.length === 0) return s;
            return s.charAt(0).toUpperCase() + s.slice(1);
        },

        titleCase(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        },

        camelCase(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            return s
                .trim()
                .replace(/[_\-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
                .replace(/^(.)/, c => c.toLowerCase());
        },

        kebabCase(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            return s
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();
        },

        snakeCase(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            return H.kebabCase(s).replace(/-/g, '_');
        },

        truncate(str, len = 50, suffix = '...') {
            const s = _unref(str);
            const l = _unref(len) ?? 50;
            const suf = _unref(suffix) ?? '...';
            if (!H.isString(s) || s.length <= l) return s;
            const subLen = Math.max(0, l - suf.length);
            return s.slice(0, subLen) + suf;
        },

        slugify(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            return s
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },

        padStart(str, len, char = '0') {
            const s = String(_unref(str) ?? '');
            const l = _unref(len);
            const c = String(_unref(char) ?? '0');
            if (s.length >= l) return s;
            return c.repeat(l - s.length) + s;
        },

        padEnd(str, len, char = ' ') {
            const s = String(_unref(str) ?? '');
            const l = _unref(len);
            const c = String(_unref(char) ?? ' ');
            if (s.length >= l) return s;
            return s + c.repeat(l - s.length);
        },

        escapeHtml(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return s.replace(/[&<>"']/g, c => map[c]);
        },

        unescapeHtml(str) {
            const s = _unref(str);
            if (!H.isString(s)) return s;
            const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
            return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, c => map[c]);
        }
    };
}
