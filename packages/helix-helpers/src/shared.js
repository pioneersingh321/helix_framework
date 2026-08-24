// ==========================================
// SHARED INTERNAL HELPERS
// (not part of the public H.* API — used by multiple sections)
// ==========================================

export const _hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
export const _toStr = Object.prototype.toString;

export const _unref = (v) => {
    if (v != null && typeof v === 'object' && ('value' in v || v._isRef || v.__v_isRef)) {
        return v.value;
    }
    return v;
};

export const _isPlainObject = (v) => {
    const val = _unref(v);
    if (val === null || typeof val !== 'object') return false;
    if (_toStr.call(val) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(val);
    return proto === null || proto === Object.prototype;
};

export const _isInteger = (v) => {
    const val = _unref(v);
    return typeof val === 'number' && Number.isFinite(val) && Math.floor(val) === val;
};

export const _toPath = (path) => {
    const p = _unref(path);
    if (Array.isArray(p)) return p;
    return String(p || '')
        .replace(/\[['"]?([^'"]+)['"]?\]/g, '.$1')
        .replace(/^\./, '')
        .split('.')
        .filter(Boolean);
};

export const _serializeParam = (key, val, encode = encodeURIComponent) => {
    const rawVal = _unref(val);
    if (rawVal === null || rawVal === undefined) return '';
    if (typeof rawVal === 'boolean') return `${key}=${rawVal}`;
    if (typeof rawVal === 'number' || typeof rawVal === 'string') return `${key}=${encode(rawVal)}`;
    if (Array.isArray(rawVal)) {
        return rawVal.map((v, i) => {
            const unwrappedV = _unref(v);
            if (typeof unwrappedV === 'object' && unwrappedV !== null) {
                return _serializeParam(`${key}[${i}]`, unwrappedV, encode);
            }
            return _serializeParam(`${key}[]`, unwrappedV, encode);
        }).filter(Boolean).join('&');
    }
    if (typeof rawVal === 'object') {
        return Object.entries(rawVal)
            .map(([k, v]) => _serializeParam(`${key}[${k}]`, v, encode))
            .filter(Boolean)
            .join('&');
    }
    return '';
};
