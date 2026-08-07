export const normalizeHeaders = (h = {}) =>
    Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

export const resolveHeaders = (method, cfg, req, override) => ({
    ...normalizeHeaders(cfg.common),
    ...normalizeHeaders(cfg[method.toLowerCase()]),
    ...normalizeHeaders(req),
    ...normalizeHeaders(override)
});

export const buildSearchParams = (obj) => {
    const sp = new URLSearchParams();

    const appendRecursive = (val, prefix = '') => {
        if (val === null || val === undefined) return;

        if (val instanceof Date) {
            sp.append(prefix, val.toISOString());
            return;
        }

        if (Array.isArray(val)) {
            val.forEach((item, index) => {
                if (typeof item === 'object' && item !== null && !(item instanceof Date) && !isFile(item)) {
                    appendRecursive(item, `${prefix}[${index}]`);
                } else {
                    appendRecursive(item, `${prefix}[]`);
                }
            });
            return;
        }

        if (typeof val === 'object' && !isFile(val)) {
            Object.keys(val).forEach(key => {
                const fullKey = prefix ? `${prefix}[${key}]` : key;
                appendRecursive(val[key], fullKey);
            });
            return;
        }

        sp.append(prefix, val);
    };

    if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            appendRecursive(obj[key], key);
        });
    }

    return sp;
};

export const isFile = (val) =>
    (typeof File !== 'undefined' && val instanceof File) ||
    (typeof Blob !== 'undefined' && val instanceof Blob) ||
    (typeof FileList !== 'undefined' && val instanceof FileList);

export const containsFiles = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    if (isFile(obj)) return true;
    if (Array.isArray(obj)) return obj.some(containsFiles);
    return Object.values(obj).some(containsFiles);
};

export const objectToFormData = (obj, form = new FormData(), namespace = '') => {
    if (!obj || typeof obj !== 'object' || obj instanceof Date || isFile(obj)) {
        form.append(namespace, obj === null ? '' : obj);
    } else {
        Object.keys(obj).forEach(prop => {
            const formKey = namespace ? `${namespace}[${prop}]` : prop;
            objectToFormData(obj[prop], form, formKey);
        });
    }
    return form;
};

export const serializeForm = (formElement, emptyAsNull = true) => {
    const result = {};
    const castValue = (val, type) => {
        if (type === 'number') return val === '' ? null : Number(val);
        if (type === 'boolean') return !['false', '0', '', null].includes(val);
        if (type === 'null') return val || null;
        if (type === 'array' || type === 'object') { try { return JSON.parse(val); } catch { return val; } }
        return val;
    };
    const deepAssign = (target, pathArray, value) => {
        let current = target;
        pathArray.forEach((key, index) => {
            if (index === pathArray.length - 1) {
                if (key === '') { if (!Array.isArray(current)) return; current.push(value); }
                else if (current[key] !== undefined) { if (!Array.isArray(current[key])) current[key] = [current[key]]; current[key].push(value); }
                else current[key] = value;
            } else {
                if (key === '') key = current.length;
                if (!current[key]) current[key] = pathArray[index + 1] === '' ? [] : {};
                current = current[key];
            }
        });
    };
    formElement.querySelectorAll('input, select, textarea').forEach(field => {
        if (!field.name || field.disabled || field.closest('fieldset[disabled]')) return;
        const type = field.type?.toLowerCase?.() || '';
        if (['submit', 'button', 'reset'].includes(type)) return;
        let value;
        if (type === 'checkbox') { if (field.checked) value = !field.hasAttribute('value') || field.value; else return; }
        else if (type === 'radio') { if (!field.checked) return; value = field.value; }
        else if (type === 'file') { if (field.files.length === 0) return; value = field.multiple ? Array.from(field.files) : field.files[0]; }
        else { value = field.tagName === 'SELECT' && field.multiple ? Array.from(field.selectedOptions).map(o => o.value) : field.value; }
        if (value === '' && emptyAsNull) value = null;
        let rawName = field.name, castType = null;
        if (rawName.includes(':')) { const p = rawName.split(':'); castType = p.pop(); rawName = p.join(':'); }
        if (type !== 'file' && !(value instanceof File)) value = castValue(value, castType);
        const pathArray = rawName.replace(/\]/g, '').split('[');
        deepAssign(result, pathArray, value);
    });
    return result;
};

export const prepareSmartPayload = (body, headers) => {
    let activeBody = body, activeHeaders = { ...headers };
    if (typeof HTMLFormElement !== 'undefined' && activeBody instanceof HTMLFormElement) activeBody = serializeForm(activeBody);
    if (typeof FormData !== 'undefined' && activeBody instanceof FormData) { delete activeHeaders['content-type']; return { payload: activeBody, headers: activeHeaders }; }
    if (activeBody && typeof activeBody === 'object') {
        if (containsFiles(activeBody)) { activeBody = objectToFormData(activeBody); delete activeHeaders['content-type']; }
        else {
            const type = (activeHeaders['content-type'] || '').toLowerCase();
            if (type.includes('application/x-www-form-urlencoded')) activeBody = buildSearchParams(activeBody).toString();
            else activeBody = JSON.stringify(activeBody);
        }
    }
    return { payload: activeBody, headers: activeHeaders };
};

export const buildUrl = (url, params) => {
    if (!params) return url;
    const q = buildSearchParams(params).toString();
    if (!q) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${q}`;
};

export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const withEventEmitter = (obj) => {
    const successSubscribers = new Set(), errorSubscribers = new Set();
    obj.onSuccess = (fn) => { successSubscribers.add(fn); return obj; };
    obj.onError = (fn) => { errorSubscribers.add(fn); return obj; };
    obj.clearListeners = () => { successSubscribers.clear(); errorSubscribers.clear(); };
    obj.emitSuccess = (data, state) => successSubscribers.forEach(fn => fn(data, state));
    obj.emitError = (err, state) => errorSubscribers.forEach(fn => fn(err, state));
    return obj;
};

export const fastStableStringify = (obj, seen = null) => {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (obj instanceof Date) return JSON.stringify(obj.toISOString());
    if (obj instanceof RegExp) return JSON.stringify(obj.toString());
    if (obj instanceof URLSearchParams) return JSON.stringify(obj.toString());
    if (!seen) seen = new WeakSet();
    if (seen.has(obj)) return '"[Circular]"';
    seen.add(obj);
    let result;
    if (Array.isArray(obj)) {
        result = '[' + obj.map(v => fastStableStringify(v, seen)).join(',') + ']';
    } else if (obj instanceof Map) {
        const entries = Array.from(obj.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        result = 'Map{' + entries.map(([k, v]) => fastStableStringify(k, seen) + ':' + fastStableStringify(v, seen)).join(',') + '}';
    } else if (obj instanceof Set) {
        const items = Array.from(obj).sort((a, b) => String(a).localeCompare(String(b)));
        result = 'Set[' + items.map(v => fastStableStringify(v, seen)).join(',') + ']';
    } else {
        const keys = Object.keys(obj).sort();
        result = '{' + keys.map(k => JSON.stringify(k) + ':' + fastStableStringify(obj[k], seen)).join(',') + '}';
    }
    seen.delete(obj);
    return result;
};

export const isCacheableBody = (body) =>
    !((typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof Blob !== 'undefined' && body instanceof Blob) ||
      (typeof File !== 'undefined' && body instanceof File) ||
      (typeof HTMLFormElement !== 'undefined' && body instanceof HTMLFormElement));

export const UNCACHEABLE_MARKER = '__UNCACHEABLE__';

export const hashLargeBody = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return (h >>> 0).toString(16);
};

export const getCacheKey = (config, method, base, url, params, body, headers, cacheHeaders = []) => {
    let bodyStr = UNCACHEABLE_MARKER;
    if (isCacheableBody(body)) {
        const bodyJson = fastStableStringify(body);
        bodyStr = bodyJson.length > 102400
            ? '__LARGE_BODY_' + bodyJson.length + '_' + hashLargeBody(bodyJson) + '__'
            : bodyJson;
    }
    const sanitizedHeaders = { ...normalizeHeaders(headers) };
    if (config.requestIdHeader) delete sanitizedHeaders[config.requestIdHeader.toLowerCase()];
    if (config.traceIdHeader) delete sanitizedHeaders[config.traceIdHeader.toLowerCase()];
    let headerStr;
    if (cacheHeaders.length > 0) {
        const filtered = {};
        for (const h of cacheHeaders) { const key = h.toLowerCase(); if (sanitizedHeaders[key] !== undefined) filtered[key] = sanitizedHeaders[key]; }
        headerStr = fastStableStringify(filtered);
    } else headerStr = fastStableStringify(sanitizedHeaders);
    return `${method}|${base}|${url}|${fastStableStringify(params)}|${bodyStr}|${headerStr}`;
};

export const estimateObjectSize = (obj) => {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'string') return obj.length * 2;
    if (typeof obj === 'function') return 0;
    if (obj instanceof Date) return 64;
    if (obj instanceof RegExp) return obj.source.length * 2 + 64;
    if (obj instanceof ArrayBuffer) return obj.byteLength;
    if (obj instanceof Blob) return obj.size;
    let size = 0;
    const seen = new WeakSet();
    const calc = (o) => {
        if (o === null || o === undefined) return;
        if (typeof o === 'object') { if (seen.has(o)) return; seen.add(o); }
        if (Array.isArray(o)) { size += o.length * 8; o.forEach(calc); }
        else if (o instanceof Map) { size += o.size * 16; o.forEach((v, k) => { calc(k); calc(v); }); }
        else if (o instanceof Set) { size += o.size * 8; o.forEach(calc); }
        else if (typeof o === 'object') { size += Object.keys(o).length * 16; Object.values(o).forEach(calc); }
        else size += estimateObjectSize(o);
    };
    calc(obj);
    return size;
};
