import { getAxiosLib } from './utils.js';
import { createAxiosInstance } from './factory.js';
import { buildHttp } from './manager.js';
import { activeControllers } from './request.js';

const HelixAxiosPlugin = {
    name: 'axios',
    version: import.meta.env.VITE_AXIOS_VERSION || '0.0.0',
    requires: {
        helix: '>=11.1.5'
    },
    install(app, options = {}) {
        const axiosLib = getAxiosLib();
        if (!axiosLib) {
            console.error('[Helix Axios] axios library not found. Load axios before this plugin.');
            return () => { };
        }

        const baseAxios = createAxiosInstance(options);
        const $http = buildHttp(baseAxios, app);

        app.namespace('axios', {
            $http,
            create: (opts) => buildHttp(createAxiosInstance(opts), app),
            setToken: $http.setToken,
            clearToken: $http.clearToken,
            raw: $http.raw
        });

        app.$http = $http;

        if (app.provide) {
            app.provide('$http', $http);
        }

        return () => {
            activeControllers.forEach(c => {
                try { c.abort(); } catch { }
            });
            activeControllers.clear();
        };
    }
};

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixAxiosPlugin = HelixAxiosPlugin;

export default HelixAxiosPlugin;
