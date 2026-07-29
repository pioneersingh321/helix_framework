export function createValidationMethods(H) {
    return {
        isEmail(str) {
            if (!H.isString(str)) return false;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
        },

        isUrl(str) {
            if (!H.isString(str)) return false;
            try { new URL(str); return true; } catch { return false; }
        },

        isPhone(str, c = 'US') {
            if (!H.isString(str)) return false;
            const p = {
                US: /^\+?1?\s?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
                UK: /^\+?44\s?7\d{3}\s?\d{6}$/,
                IN: /^\+?91\s?[6-9]\d{9}$/,
            };
            return (p[c] || p.US).test(str);
        },

        minLength(str, len) {
            return H.isString(str) && str.length >= len;
        },

        maxLength(str, len) {
            return H.isString(str) && str.length <= len;
        },

        range(num, min, max) {
            return H.isNumber(num) && num >= min && num <= max;
        },

        isHexColor(str) {
            return H.isString(str) && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(str);
        }
    };
}
