import { generateId } from './utils.js';

export const classifyError = (err) => {
    if (!err) return 'unknown';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    const msg = (err.message || '').toLowerCase();
    const name = err.name || '';
    if (msg.includes('offline') || msg.includes('network')) return 'offline';
    if (name === 'AbortError') return msg.includes('timeout') ? 'timeout' : 'transport';
    if (msg.includes('dns') || msg.includes('enotfound') || msg.includes('getaddrinfo')) return 'dns';
    if (msg.includes('fetch') || msg.includes('failed to fetch')) return 'transport';
    const status = err.status || 0;
    if (status === 0) return 'transport';
    if (status === 401 || status === 403) return 'auth';
    if (status === 408) return 'timeout';
    if (status === 409) return 'conflict';
    if (status === 422 || status === 400) return 'validation';
    if (status >= 500) return 'server';
    if (status >= 400) return 'client';
    return 'unknown';
};

export class FetchError extends Error {
    constructor(message, cfg, status, data, request, classification = null, trace = null) {
        super(message);
        this.name = 'FetchError';
        this.config = cfg;
        this.status = status;
        this.data = data;
        this.request = request;
        this.timestamp = Date.now();
        this.classification = classification || classifyError(this);
        this.trace = trace || { requestId: generateId(), traceId: generateId(), spanId: generateId() };
    }
}
