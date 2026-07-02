Helix.directive('fetch', {
    mounted(el, binding, vnode) {
        const ctx = binding.instance;
        const getConfig = typeof binding.value === 'function' 
            ? binding.value 
            : () => binding.value;

        let currentInstance = null;
        let stopWatch = null;
        let isDestroyed = false;

        const rawPoll = el.getAttribute('h-poll');
        const pollMs = rawPoll ? parseInt(rawPoll, 10) : 0;
        const isPoll = !isNaN(pollMs) && pollMs > 0;
        const abortId = el.getAttribute('h-abort') || getConfig()?.abortId || generateId();

        const runFetch = (cfg) => {
            if (isDestroyed) return;

            if (currentInstance) {
                currentInstance.cancel?.();
                currentInstance.stopPolling?.();
                currentInstance._cleanup?.();
            }

            el.setAttribute('h-fetch-loading', '');
            el.removeAttribute('h-fetch-done');
            el.removeAttribute('h-fetch-error');

            const runId = {};
            el._hxFetchRun = runId;

            const reqConfig = {
                ...cfg,
                abortId,
                onSuccess: (res) => {
                    if (isDestroyed || el._hxFetchRun !== runId) return;
                    el.removeAttribute('h-fetch-loading');
                    el.setAttribute('h-fetch-done', '');

                    if (cfg.storeKey && ctx) {
                        const parts = cfg.storeKey.split('.');
                        let target = ctx;
                        for (let i = 0; i < parts.length - 1; i++) {
                            target = target?.[parts[i]];
                        }
                        if (target && parts.length > 0) {
                            const key = parts[parts.length - 1];
                            target[key] = res.data ?? res;
                        }
                    }
                    cfg.onSuccess?.(res);
                },
                onError: (err) => {
                    if (isDestroyed || el._hxFetchRun !== runId) return;
                    el.setAttribute('h-fetch-error', err.message || 'error');
                    cfg.onError?.(err);
                }
            };

            if (isPoll) {
                // FIX: Helix.$fetch instead of app.$fetch
                currentInstance = Helix.$fetch.request({ ...reqConfig, lazy: true, pollInterval: pollMs });
                currentInstance.execute().catch(() => {}).then(() => {
                    if (!isDestroyed && el._hxFetchRun === runId) currentInstance.startPolling();
                });
            } else {
                // FIX: Helix.$fetch instead of app.$fetch
                currentInstance = Helix.$fetch.request(reqConfig);
            }
        };

        if (typeof binding.value === 'function') {
            // FIX: Helix.watch instead of app.watch
            stopWatch = Helix.watch(binding.value, (newCfg) => {
                if (newCfg && newCfg.url) runFetch(newCfg);
            }, { immediate: true });
        } else {
            const initial = getConfig();
            if (initial && initial.url) runFetch(initial);
        }

        const cleanup = () => {
            isDestroyed = true;
            stopWatch?.();
            currentInstance?.cancel?.();
            currentInstance?.stopPolling?.();
            currentInstance?._cleanup?.();
            el.removeAttribute('h-fetch-loading');
            el.removeAttribute('h-fetch-done');
            el.removeAttribute('h-fetch-error');
            delete el._hxFetchRun;
        };

        el._hxFetchCleanup = cleanup;

        if (ctx && Helix.onUnmounted) {
            Helix.onUnmounted(cleanup);
        }
    },

    updated(el, binding, vnode) {
        if (typeof binding.value !== 'function') {
            const newCfg = binding.value;
            const oldCfg = el._hxFetchLastConfig;
            if (oldCfg !== newCfg) {
                el._hxFetchCleanup?.();
                this.mounted(el, binding, vnode);
            }
            el._hxFetchLastConfig = newCfg;
        }
    },

    unmounted(el) {
        el._hxFetchCleanup?.();
        delete el._hxFetchCleanup;
        delete el._hxFetchLastConfig;
    }
});