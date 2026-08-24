export function createAsyncMethods(H, timerCancels) {
    return {
        wait(ms) {
            return new Promise(r => setTimeout(r, ms));
        },

        uid(len = 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let id = '';
            for (let i = 0; i < len; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
            return id;
        },

        uuid() {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        },

        debounce(fn, wait = 300, immediate = false) {
            let timer = null;
            const cancel = () => {
                if (timer != null) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (timerCancels) timerCancels.delete(cancel);
            };
            const wrapped = function (...args) {
                const callNow = immediate && !timer;
                if (timer != null) clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    if (timerCancels) timerCancels.delete(cancel);
                    if (!immediate) fn.apply(this, args);
                }, wait);
                if (timerCancels) timerCancels.add(cancel);
                if (callNow) fn.apply(this, args);
            };
            wrapped.cancel = cancel;
            return wrapped;
        },

        throttle(fn, limit = 300, trailing = true) {
            let last = undefined, timer = null;
            const cancel = () => {
                if (timer != null) {
                    clearTimeout(timer);
                    timer = null;
                }
                last = undefined;
                if (timerCancels) timerCancels.delete(cancel);
            };
            const wrapped = function (...args) {
                const now = Date.now();
                if (last === undefined || now - last >= limit) {
                    last = now;
                    fn.apply(this, args);
                } else if (trailing) {
                    if (timer != null) clearTimeout(timer);
                    timer = setTimeout(() => {
                        last = Date.now();
                        timer = null;
                        if (timerCancels) timerCancels.delete(cancel);
                        fn.apply(this, args);
                    }, limit - (now - last));
                    if (timerCancels) timerCancels.add(cancel);
                }
            };
            wrapped.cancel = cancel;
            return wrapped;
        },

        async retry(fn, { retries = 3, delay = 300, backoff = 2, onRetry } = {}) {
            let lastErr;
            for (let i = 0; i <= retries; i++) {
                try {
                    return await fn(i);
                } catch (err) {
                    lastErr = err;
                    if (i === retries) break;
                    const waitTime = delay * Math.pow(backoff, i);
                    if (onRetry) onRetry(err, i, waitTime);
                    await H.wait(waitTime);
                }
            }
            throw lastErr;
        }
    };
}
