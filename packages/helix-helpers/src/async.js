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
            let timer;
            const wrapped = function (...args) {
                const callNow = immediate && !timer;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    if (!immediate) fn.apply(this, args);
                }, wait);
                if (callNow) fn.apply(this, args);
            };
            wrapped.cancel = () => clearTimeout(timer);

            // Tracked so the plugin's single cleanup() (returned from install())
            // can cancel any still-pending debounce timers on app unmount.
            timerCancels.add(wrapped.cancel);
            return wrapped;
        },

        throttle(fn, limit = 300, trailing = true) {
            let last, timer;
            const wrapped = function (...args) {
                const now = Date.now();
                if (!last || now - last >= limit) {
                    last = now;
                    fn.apply(this, args);
                } else if (trailing) {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        last = Date.now();
                        fn.apply(this, args);
                    }, limit - (now - last));
                }
            };
            wrapped.cancel = () => clearTimeout(timer);

            // Tracked so the plugin's single cleanup() (returned from install())
            // can cancel any still-pending throttle timers on app unmount.
            timerCancels.add(wrapped.cancel);
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
