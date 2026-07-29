import { executeRequest } from './request.js';
import { createReactiveRequest } from './reactive.js';
import { createAxiosInstance } from './factory.js';

export function buildHttp(axiosInstance, app) {
    const pending = new Map();

    const req = (method, url, data, config) =>
        executeRequest(axiosInstance, pending, method, url, data, config || {}, {});

    const reactive = (method, url, data, opt) =>
        createReactiveRequest(app, axiosInstance, pending, method, url, data, opt)();

    const makeUpload = (url, file, config = {}) => {
        const { fieldName = 'file', ...rest } = config;
        const formData = new FormData();
        formData.append(fieldName, file);
        return reactive('post', url, formData, rest);
    };

    const http = {
        get: (url, config) => req('get', url, null, config),
        post: (url, data, config) => req('post', url, data, config),
        put: (url, data, config) => req('put', url, data, config),
        patch: (url, data, config) => req('patch', url, data, config),
        delete: (url, config) => req('delete', url, null, config),
        head: (url, config) => req('head', url, null, config),
        options: (url, config) => req('options', url, null, config),

        useGet: (url, opt) => reactive('get', url, null, opt),
        usePost: (url, body, opt) => reactive('post', url, body, opt),
        usePut: (url, body, opt) => reactive('put', url, body, opt),
        usePatch: (url, body, opt) => reactive('patch', url, body, opt),
        useDelete: (url, opt) => reactive('delete', url, null, opt),

        useUpload: makeUpload,
        upload: makeUpload,

        create: (opts) => buildHttp(createAxiosInstance(opts), app),

        setToken: (token, type = 'Bearer') => {
            axiosInstance.defaults.headers.common['Authorization'] = `${type} ${token}`;
        },

        clearToken: () => {
            delete axiosInstance.defaults.headers.common['Authorization'];
        },

        raw: axiosInstance
    };

    return http;
}
