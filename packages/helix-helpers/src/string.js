export function createStringMethods(H) {
    return {
        capitalize(str) {
            if (!H.isString(str) || str.length === 0) return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        titleCase(str) {
            if (!H.isString(str)) return str;
            return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        },

        camelCase(str) {
            if (!H.isString(str)) return str;
            return str
                .trim()
                .replace(/[_\-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
                .replace(/^(.)/, c => c.toLowerCase());
        },

        kebabCase(str) {
            if (!H.isString(str)) return str;
            return str
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();
        },

        snakeCase(str) {
            if (!H.isString(str)) return str;
            return H.kebabCase(str).replace(/-/g, '_');
        },

        truncate(str, len = 50, suffix = '...') {
            if (!H.isString(str) || str.length <= len) return str;
            return str.slice(0, len) + suffix;
        },

        slugify(str) {
            if (!H.isString(str)) return str;
            return str
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },

        padStart(str, len, char = '0') {
            str = String(str);
            if (str.length >= len) return str;
            return String(char).repeat(len - str.length) + str;
        },

        padEnd(str, len, char = ' ') {
            str = String(str);
            if (str.length >= len) return str;
            return str + String(char).repeat(len - str.length);
        },

        escapeHtml(str) {
            if (!H.isString(str)) return str;
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return str.replace(/[&<>"']/g, c => map[c]);
        },

        unescapeHtml(str) {
            if (!H.isString(str)) return str;
            const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
            return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, c => map[c]);
        }
    };
}
