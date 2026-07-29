// ==========================================
// SHARED INTERNAL HELPERS
// (not part of the public H.* API — used by multiple sections)
// ==========================================

export const _hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
export const _toStr = Object.prototype.toString;

export const _isPlainObject = (v) => {
    if (v === null || typeof v !== 'object') return false;
    if (_toStr.call(v) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === null || proto === Object.prototype;
};

export const _isInteger = (v) => typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v;

export const _toPath = (path) => {
    if (Array.isArray(path)) return path;
    return String(path)
        .replace(/\[['"]?([^'"]+)['"]?\]/g, '.$1')
        .replace(/^\./, '')
        .split('.')
        .filter(Boolean);
};

// Array values use repeated bare keys (key=v1&key=v2), matching the
// convention already established in helix-fetch.js's buildQuery(), so
// toQueryString()/fromQueryString() round-trip correctly.
export const _serializeParam = (key, val, encode = encodeURIComponent) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return `${key}=${val}`;
    if (typeof val === 'number' || typeof val === 'string') return `${key}=${encode(val)}`;
    if (Array.isArray(val)) {
        return val.map((v) => _serializeParam(key, v, encode)).filter(Boolean).join('&');
    }
    if (typeof val === 'object') {
        return Object.entries(val)
            .map(([k, v]) => _serializeParam(`${key}[${k}]`, v, encode))
            .filter(Boolean)
            .join('&');
    }
    return '';
};
