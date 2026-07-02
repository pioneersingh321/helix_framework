/**
 * Helix.js Notify Plugin v2.1
 * Aligned with Helix.js v11.1.x Plugin Architecture
 *
 * Features:
 * - SweetAlert2 wrapper with themes (clinical, glass, dark)
 * - Serialized toast queue with backlog cap and auto-drain
 * - Promise-based alerts, confirms, prompts
 * - Query builder with direct event methods (.onConfirmed/.onCancelled/.onDenied/.onDismissed)
 * - Async loading dialogs with success/error states + real cancellation (AbortSignal)
 * - Plugin metadata, cleanup lifecycle, namespaced API
 *
 * --- v2.1 changelog (bug fixes) ---
 *  1.  Toast queue now SERIALIZES (SweetAlert2 is single-instance); queueLimit is a
 *      backlog cap, not a concurrency level. Dropped/over-cap toasts resolve, never hang.
 *  2.  Query builder no longer emits unhandledrejection when only .onError is used.
 *  3.  confirm3 / confirm3Query are now registered on the namespace.
 *  4.  async / asyncQuery now pass an AbortSignal to promiseFn and honour real cancellation.
 *  5.  install() always returns a cleanup function (no-op on the missing-Swal path).
 *  6.  queueLimit is clamped to >= 1 (was a deadlock at <= 0).
 *  7.  Query builder defers dialog open by one microtask so the full handler chain attaches first.
 *  9.  prompt inputValidator allows falsy-but-valid values (0, etc); only blocks empty/null.
 * 10.  Injected <style> is removed on cleanup.
 * 11.  confirm3 (Promise form) now returns `cancelled`, matching confirm3Query.
 * 12.  Dead `resultMapper` param removed from the query builder.
 *
 * NOTE (SweetAlert2 constraint, not a plugin bug): a modal (confirm/alert/prompt/async)
 * and a toast cannot be visible at the same time — opening one closes the other. The
 * toast queue only coordinates toasts among themselves.
 *
 * CONTRACT CHANGE: promiseFn passed to async()/asyncQuery() now receives an AbortSignal
 *   as its first argument:  notify.async(t, x, (signal) => fetch(url, { signal }))
 * Old promiseFns that ignore the argument continue to work unchanged.
 */

const HelixNotifyPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.x)
    // ==========================================
    name: 'notify',
    version: '2.1.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        if (typeof Swal === 'undefined') {
            console.error('[Helix.js][$notify] SweetAlert2 is required. Load it before this plugin.');
            // Fix #5: always return a cleanup fn so the host's uninstall path never throws.
            return () => {};
        }

        // ==========================================
        // 1. THEMES & CONFIG
        // ==========================================
        const themes = {
            clinical: {
                confirmColor: '#007bff',
                cancelColor: '#6c757d',
                denyColor: '#f59e0b',
                popupClass: 'hx-swal-clinical',
                toastPosition: 'top-end'
            },
            glass: {
                confirmColor: '#4f46e5',
                cancelColor: '#f43f5e',
                denyColor: '#f59e0b',
                popupClass: 'hx-swal-glass',
                toastPosition: 'bottom-end'
            },
            dark: {
                confirmColor: '#10b981',
                cancelColor: '#ef4444',
                denyColor: '#f59e0b',
                popupClass: 'hx-swal-dark',
                toastPosition: 'top-end'
            }
        };

        const defaults = {
            theme: 'clinical',
            toastTimer: 3000,
            queueLimit: 3,
            ...options
        };

        const themeConfig = themes[defaults.theme] || themes.clinical;
        const config = { ...themeConfig, ...defaults };

        // Fix #6: clamp backlog cap to a sane minimum (>= 1 prevents a stalled queue).
        const queueLimit = Math.max(1, Number(config.queueLimit) || 1);

        // ==========================================
        // 2. CSS AUTO-INJECTION
        // ==========================================
        const styleId = 'hx-notify-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                .hx-swal-clinical { border-radius: 8px !important; font-family: 'Inter', sans-serif; border: 1px solid #e5e7eb !important; }
                .hx-swal-glass { background: rgba(255, 255, 255, 0.8) !important; backdrop-filter: blur(12px) !important; border-radius: 16px !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important; }
                .hx-swal-dark { background: #1f2937 !important; color: #f9fafb !important; border-radius: 12px !important; }
                .swal2-popup { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
            `;
            document.head.appendChild(style);
        }

        // ==========================================
        // 3. TOAST QUEUE (serialized — Fix #1, #6)
        // ==========================================
        // SweetAlert2 only renders one popup at a time, so toasts MUST run one-at-a-time.
        // queueLimit caps how many may sit *pending* behind the active one; overflow drops
        // the oldest pending toast and resolves its promise as { dropped: true } so awaits
        // never hang.
        let activeToast = false;
        const toastQueue = [];

        const drainToast = () => {
            if (activeToast || toastQueue.length === 0) return;
            activeToast = true;
            const { fn, resolve } = toastQueue.shift();
            Promise.resolve()
                .then(fn)
                .then(resolve, resolve)        // resolve on success OR swal error; never reject
                .finally(() => {
                    activeToast = false;
                    drainToast();
                });
        };

        const enqueueToast = (fn) => new Promise((resolve) => {
            toastQueue.push({ fn, resolve });
            // Backlog cap: keep at most `queueLimit` pending (active one is already shifted out).
            while (toastQueue.length > queueLimit) {
                const dropped = toastQueue.shift();
                dropped.resolve({ dropped: true });
            }
            drainToast();
        });

        const Toast = Swal.mixin({
            toast: true,
            position: config.toastPosition,
            showConfirmButton: false,
            showCloseButton: config.showCloseButton ?? false,
            timer: config.toastTimer,
            timerProgressBar: true,
            customClass: { popup: config.popupClass },
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });

        // ==========================================
        // 4. QUERY BUILDER with Direct Events (Fix #2, #7, #12)
        // ==========================================
        function createQuery(promiseFactory) {
            const handlers = {
                onConfirmed: null,
                onCancelled: null,
                onDismissed: null,
                onDenied: null,
                onSuccess: null,
                onError: null,
                onFinally: null
            };

            let started = false;
            let resolveOuter, rejectOuter;
            const promise = new Promise((res, rej) => { resolveOuter = res; rejectOuter = rej; });

            // Fix #2: swallow rejection on an internal branch so consumers that only use
            // .onError(...) (and never await / .catch) don't trigger unhandledrejection.
            // The consumer's own .then/.catch/await still receives the real rejection.
            promise.catch(() => {});

            const execute = async () => {
                try {
                    const result = await promiseFactory();

                    if (result.confirmed && handlers.onConfirmed) handlers.onConfirmed(result);
                    if (result.cancelled && handlers.onCancelled) handlers.onCancelled(result);
                    if (result.dismissed && handlers.onDismissed) handlers.onDismissed(result);
                    if (result.denied && handlers.onDenied) handlers.onDenied(result);
                    if (handlers.onSuccess && !result.error) handlers.onSuccess(result);

                    resolveOuter(result);
                } catch (err) {
                    if (handlers.onError) handlers.onError(err);
                    rejectOuter(err);
                } finally {
                    if (handlers.onFinally) handlers.onFinally();
                }
            };

            // Fix #7: defer one microtask so a synchronous handler chain
            // (.onConfirmed(a).onCancelled(b)...) is fully attached before the dialog opens.
            const start = () => { if (!started) { started = true; execute(); } };
            queueMicrotask(start);

            return {
                onConfirmed(fn) { handlers.onConfirmed = fn; return this; },
                onCancelled(fn) { handlers.onCancelled = fn; return this; },
                onDismissed(fn) { handlers.onDismissed = fn; return this; },
                onDenied(fn) { handlers.onDenied = fn; return this; },
                onSuccess(fn) { handlers.onSuccess = fn; return this; },
                onError(fn) { handlers.onError = fn; return this; },
                onFinally(fn) { handlers.onFinally = fn; return this; },
                then: promise.then.bind(promise),
                catch: promise.catch.bind(promise),
                finally: promise.finally.bind(promise)
            };
        }

        // ==========================================
        //  Shared async-dialog runner (Fix #4)
        // ==========================================
        // Wires an AbortController into the loading dialog. promiseFn receives the signal;
        // pressing Cancel aborts it. Returns a normalized result object.
        const runAsyncDialog = async (title, text, promiseFn, options = {}) => {
            const {
                successTitle = 'Success', successText = 'Operation completed.',
                showSuccess = true, showError = true, errorTitle = 'Error',
                allowCancel = false, ...ext
            } = options;

            const controller = new AbortController();
            let userCancelled = false;

            // Fire (do NOT await) — watch for a cancel dismissal to abort the work.
            Swal.fire({
                title, text,
                allowOutsideClick: false,
                allowEscapeKey: allowCancel,
                showConfirmButton: false,
                showCancelButton: allowCancel,
                cancelButtonText: 'Cancel',
                cancelButtonColor: config.cancelColor,
                customClass: { popup: config.popupClass },
                didOpen: () => { Swal.showLoading(); },
                ...ext
            }).then((res) => {
                if (res.dismiss === Swal.DismissReason.cancel) {
                    userCancelled = true;
                    controller.abort();
                }
            });

            try {
                const result = await promiseFn(controller.signal);

                // Op finished but the user already pressed Cancel — honour the cancel.
                if (userCancelled) {
                    Swal.close();
                    return { success: false, cancelled: true };
                }

                if (showSuccess) {
                    Swal.close();
                    await Swal.fire({
                        title: successTitle, text: successText, icon: 'success',
                        confirmButtonColor: config.confirmColor,
                        customClass: { popup: config.popupClass },
                        timer: 2000, timerProgressBar: true
                    });
                } else {
                    Swal.close();
                }
                return { success: true, data: result };
            } catch (err) {
                Swal.close();
                if (userCancelled || err?.name === 'AbortError') {
                    return { success: false, cancelled: true };
                }
                if (showError) {
                    await Swal.fire({
                        title: errorTitle,
                        text: err?.message || err?.data?.message || 'Operation failed',
                        icon: 'error',
                        confirmButtonColor: config.confirmColor,
                        customClass: { popup: config.popupClass }
                    });
                }
                return { success: false, error: err };
            }
        };

        // ==========================================
        // 5. $notify API
        // ==========================================
        const $notify = {
            // ----- Toast (serialized) -----
            toast: {
                success: (title, ext = {}) => enqueueToast(() => Toast.fire({ icon: 'success', title, ...ext })),
                error: (title, ext = {}) => enqueueToast(() => Toast.fire({ icon: 'error', title, ...ext })),
                info: (title, ext = {}) => enqueueToast(() => Toast.fire({ icon: 'info', title, ...ext })),
                warning: (title, ext = {}) => enqueueToast(() => Toast.fire({ icon: 'warning', title, ...ext })),
                question: (title, ext = {}) => enqueueToast(() => Toast.fire({ icon: 'question', title, ...ext })),
                fire: (title, icon = 'info', ext = {}) => enqueueToast(() => Toast.fire({ icon, title, ...ext }))
            },

            // ----- Alert -----
            alert: async (title, text, icon = 'info', ext = {}) => {
                return await Swal.fire({ title, text, icon, confirmButtonColor: config.confirmColor, customClass: { popup: config.popupClass }, ...ext });
            },

            // ----- Confirm (Promise) -----
            confirm: async (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
                const res = await Swal.fire({
                    title, text, icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: config.confirmColor,
                    cancelButtonColor: config.cancelColor,
                    confirmButtonText: confirmText,
                    customClass: { popup: config.popupClass },
                    ...ext
                });
                return !!res.isConfirmed;
            },

            // ----- Confirm Query -----
            confirmQuery: (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
                return createQuery(async () => {
                    const res = await Swal.fire({
                        title, text, icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: config.confirmColor,
                        cancelButtonColor: config.cancelColor,
                        confirmButtonText: confirmText,
                        customClass: { popup: config.popupClass },
                        ...ext
                    });
                    return {
                        confirmed: res.isConfirmed,
                        cancelled: res.isDismissed && res.dismiss === Swal.DismissReason.cancel,
                        dismissed: res.isDismissed,
                        value: res.value
                    };
                });
            },

            // ----- Confirm3 (Promise) -----
            confirm3: async (title, text, opts = {}) => {
                const { confirmText = 'Yes', denyText = 'No', cancelText = 'Cancel', ...ext } = opts;
                const res = await Swal.fire({
                    title, text, icon: 'question',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: confirmText,
                    denyButtonText: denyText,
                    cancelButtonText: cancelText,
                    confirmButtonColor: config.confirmColor,
                    denyButtonColor: config.denyColor,
                    cancelButtonColor: config.cancelColor,
                    customClass: { popup: config.popupClass },
                    ...ext
                });
                return {
                    confirmed: res.isConfirmed,
                    denied: res.isDenied,
                    // Fix #11: parity with confirm3Query.
                    cancelled: res.isDismissed && res.dismiss === Swal.DismissReason.cancel,
                    dismissed: res.isDismissed,
                    value: res.value
                };
            },

            // ----- Confirm3 Query -----
            confirm3Query: (title, text, opts = {}) => {
                const { confirmText = 'Yes', denyText = 'No', cancelText = 'Cancel', ...ext } = opts;
                return createQuery(async () => {
                    const res = await Swal.fire({
                        title, text, icon: 'question',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: confirmText,
                        denyButtonText: denyText,
                        cancelButtonText: cancelText,
                        confirmButtonColor: config.confirmColor,
                        denyButtonColor: config.denyColor,
                        cancelButtonColor: config.cancelColor,
                        customClass: { popup: config.popupClass },
                        ...ext
                    });
                    return {
                        confirmed: res.isConfirmed,
                        denied: res.isDenied,
                        cancelled: res.isDismissed && res.dismiss === Swal.DismissReason.cancel,
                        dismissed: res.isDismissed,
                        value: res.value
                    };
                });
            },

            // ----- Prompt (Promise) -----
            prompt: async (title, options = {}) => {
                const {
                    input = 'text', inputLabel = '', inputPlaceholder = '',
                    inputValue = '', inputOptions = null, inputAttributes = {},
                    validationMessage = 'This field is required', allowEmpty = false,
                    confirmText = 'Submit', ...ext
                } = options;

                const { value, isConfirmed, isDismissed } = await Swal.fire({
                    title, input, inputLabel, inputPlaceholder, inputValue,
                    inputOptions, inputAttributes,
                    showCancelButton: true,
                    confirmButtonText: confirmText,
                    confirmButtonColor: config.confirmColor,
                    cancelButtonColor: config.cancelColor,
                    customClass: { popup: config.popupClass },
                    // Fix #9: only empty/null are invalid — 0 and other falsy-but-valid values pass.
                    inputValidator: allowEmpty ? undefined : (val) => {
                        if (val === '' || val === null || val === undefined) return validationMessage;
                    },
                    ...ext
                });
                return { value, confirmed: isConfirmed, dismissed: isDismissed };
            },

            // ----- Prompt Query -----
            promptQuery: (title, options = {}) => {
                const {
                    input = 'text', inputLabel = '', inputPlaceholder = '',
                    inputValue = '', inputOptions = null, inputAttributes = {},
                    validationMessage = 'This field is required', allowEmpty = false,
                    confirmText = 'Submit', ...ext
                } = options;

                return createQuery(async () => {
                    const res = await Swal.fire({
                        title, input, inputLabel, inputPlaceholder, inputValue,
                        inputOptions, inputAttributes,
                        showCancelButton: true,
                        confirmButtonText: confirmText,
                        confirmButtonColor: config.confirmColor,
                        cancelButtonColor: config.cancelColor,
                        customClass: { popup: config.popupClass },
                        inputValidator: allowEmpty ? undefined : (val) => {
                            if (val === '' || val === null || val === undefined) return validationMessage;
                        },
                        ...ext
                    });
                    return {
                        value: res.value,
                        confirmed: res.isConfirmed,
                        cancelled: res.isDismissed && res.dismiss === Swal.DismissReason.cancel,
                        dismissed: res.isDismissed
                    };
                });
            },

            // ----- Async (Promise) -----
            async: (title, text, promiseFn, options = {}) =>
                runAsyncDialog(title, text, promiseFn, options),

            // ----- Async Query -----
            asyncQuery: (title, text, promiseFn, options = {}) =>
                createQuery(async () => {
                    const r = await runAsyncDialog(title, text, promiseFn, options);
                    if (r.success) return { success: true, data: r.data, confirmed: true };
                    if (r.cancelled) return { success: false, cancelled: true, dismissed: true };
                    throw r.error;
                }),

            raw: Swal
        };

        // ==========================================
        // 6. NAMESPACED API REGISTRATION (Helix v11.1.x) — Fix #3
        // ==========================================
        app.namespace('notify', {
            $notify,
            toast: $notify.toast,
            alert: $notify.alert,
            confirm: $notify.confirm,
            confirmQuery: $notify.confirmQuery,
            confirm3: $notify.confirm3,
            confirm3Query: $notify.confirm3Query,
            prompt: $notify.prompt,
            promptQuery: $notify.promptQuery,
            async: $notify.async,
            asyncQuery: $notify.asyncQuery,
            raw: Swal
        });

        // Backward compatibility: flat access
        app.$notify = $notify;

        // Provide for inject()
        if (app.provide) {
            app.provide('$notify', $notify);
        }

        // ==========================================
        // 7. CLEANUP LIFECYCLE (Helix v11.1.x) — Fix #10
        // ==========================================
        return () => {
            // Resolve any pending toasts so awaiters don't hang past teardown.
            while (toastQueue.length) {
                const pending = toastQueue.shift();
                pending.resolve({ dropped: true });
            }
            activeToast = false;
            Swal.close();
            const styleEl = document.getElementById(styleId);
            if (styleEl) styleEl.remove();
        };
    }
};