import { sleep } from '../../core/src/utils.js';

export { sleep };

export function getAxiosLib() {
    return typeof window !== 'undefined' && window.axios ? window.axios : (typeof globalThis !== 'undefined' && globalThis.axios ? globalThis.axios : null);
}

export function isCancel(err) {
    const axiosLib = getAxiosLib();
    return (axiosLib && typeof axiosLib.isCancel === 'function' && axiosLib.isCancel(err)) ||
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError';
}

export function normalizeError(err) {
    if (isCancel(err)) {
        return {
            name: 'CanceledError',
            status: null,
            data: null,
            message: 'Request canceled',
            headers: {},
            config: err?.config || null,
            canceled: true,
            originalError: err
        };
    }
    if (err?.response) {
        return {
            name: 'AxiosError',
            status: err.response.status,
            data: err.response.data,
            message: err.response.data?.message || `Request failed with status ${err.response.status}`,
            headers: err.response.headers,
            config: err.config,
            canceled: false,
            originalError: err
        };
    }
    if (err?.request) {
        return {
            name: 'NetworkError',
            status: 0,
            data: null,
            message: err.message || 'Network error — no response received',
            headers: {},
            config: err.config,
            canceled: false,
            originalError: err
        };
    }
    return {
        name: 'RequestError',
        status: null,
        data: null,
        message: err?.message || 'Request setup error',
        headers: {},
        config: null,
        canceled: false,
        originalError: err
    };
}

export function stableStringify(value) {
    const seen = new WeakSet();
    const walk = (val) => {
        if (val === null || typeof val !== 'object') return val;
        if (typeof FormData !== 'undefined' && val instanceof FormData) {
            try {
                const parts = [];
                for (const [k, v] of val.entries()) {
                    parts.push([k, typeof v === 'string' ? v : '[blob]']);
                }
                parts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
                return { __formdata: parts };
            } catch {
                return '[formdata]';
            }
        }
        if (seen.has(val)) return '[circular]';
        seen.add(val);
        if (Array.isArray(val)) return val.map(walk);
        const out = {};
        for (const k of Object.keys(val).sort()) out[k] = walk(val[k]);
        return out;
    };
    try {
        return JSON.stringify(walk(value));
    } catch {
        return '[unserializable]';
    }
}

export function getDedupeKey(method, url, axiosConfig, data) {
    const fingerprint = {
        headers: axiosConfig.headers || null,
        responseType: axiosConfig.responseType || null,
        params: axiosConfig.params || null,
        data: data ?? null
    };
    return `${method}|${url}|${stableStringify(fingerprint)}`;
}

export function readCookie(name) {
    const jar = typeof document !== 'undefined' && document.cookie ? document.cookie.split('; ') : [];
    for (const pair of jar) {
        const eq = pair.indexOf('=');
        const key = eq > -1 ? pair.slice(0, eq) : pair;
        if (key === name) {
            try { return decodeURIComponent(pair.slice(eq + 1)); }
            catch { return pair.slice(eq + 1); }
        }
    }
    return null;
}
