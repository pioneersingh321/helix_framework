export const BODYLESS_METHODS = ['get', 'head'];
export const IDEMPOTENT_METHODS = ['get', 'head', 'options'];

export const DEFAULTS = {
    baseURL: import.meta.env.VITE_AXIOS_DEFAULT_URL || '/',
    timeout: 10000,
    retries: 0,
    retryDelay: 300,
    maxRetryDelay: 30000,
    retryCondition: (err, method) =>
        IDEMPOTENT_METHODS.includes(String(method || '').toLowerCase()) &&
        (!err.status || err.status >= 500),
    dedupe: false,
    csrf: false,
    headers: {}
};
