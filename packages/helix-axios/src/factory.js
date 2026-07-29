import { getAxiosLib, readCookie } from './utils.js';
import { DEFAULTS } from './constants.js';

export function createAxiosInstance(config = {}) {
    const axiosLib = getAxiosLib();
    if (!axiosLib) {
        throw new Error('[Helix Axios] axios library not found. Load axios before this plugin.');
    }

    const merged = { ...DEFAULTS, ...config };

    const instance = axiosLib.create({
        baseURL: merged.baseURL,
        timeout: merged.timeout,
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            ...merged.headers
        }
    });

    if (merged.csrf) {
        instance.interceptors.request.use((cfg) => {
            const token = readCookie('XSRF-TOKEN');
            if (token) {
                cfg.headers = cfg.headers || {};
                cfg.headers['X-XSRF-TOKEN'] = token;
            }
            return cfg;
        });
    }

    return instance;
}
