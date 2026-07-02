/**
 * Helix.js Notify Plugin v2.0
 * Aligned with Helix.js v11.1.5 Plugin Architecture
 *
 * Features:
 * - SweetAlert2 wrapper with themes (clinical, glass, dark)
 * - Toast queue with limit and auto-drain
 * - Promise-based alerts, confirms, prompts
 * - Query builder with direct event methods (.onConfirmed/.onCancelled/.onDenied/.onDismissed)
 * - Async loading dialogs with success/error states
 * - Plugin metadata, cleanup lifecycle, namespaced API
 */

const HelixNotifyPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.5)
    // ==========================================
    name: 'notify',
    version: '2.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        if (typeof Swal === 'undefined') {
            console.error('[Helix.js][$notify] SweetAlert2 is required. Load it before this plugin.');
            return;
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
        // 3. TOAST QUEUE
        // ==========================================
        let activeToasts = 0;
        const toastQueue = [];

        const runToast = (fn) => {
            if (activeToasts < config.queueLimit) {
                activeToasts++;
                fn().finally(() => {
                    activeToasts--;
                    if (toastQueue.length) runToast(toastQueue.shift());
                });
            } else {
                toastQueue.push(fn);
            }
        };

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
        // 4. QUERY BUILDER with Direct Events
        // ==========================================
        function createQuery(promiseFactory, resultMapper = null) {
            const handlers = {
                onConfirmed: null,
                onCancelled: null,
                onDismissed: null,
                onDenied: null,
                onSuccess: null,
                onError: null,
                onFinally: null
            };

            const execute = async () => {
                try {
                    const rawResult = await promiseFactory();
                    const result = resultMapper ? resultMapper(rawResult) : rawResult;

                    if (result.confirmed && handlers.onConfirmed) handlers.onConfirmed(result);
                    if (result.cancelled && handlers.onCancelled) handlers.onCancelled(result);
                    if (result.dismissed && handlers.onDismissed) handlers.onDismissed(result);
                    if (result.denied && handlers.onDenied) handlers.onDenied(result);
                    if (handlers.onSuccess && !result.error) handlers.onSuccess(result);

                    return result;
                } catch (err) {
                    if (handlers.onError) handlers.onError(err);
                    throw err;
                } finally {
                    if (handlers.onFinally) handlers.onFinally();
                }
            };

            const promise = execute();

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
        // 5. $notify API
        // ==========================================
        const $notify = {
            // ----- Toast -----
            toast: {
                success: (title, ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon: 'success', title, ...ext }).then(res))),
                error: (title, ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon: 'error', title, ...ext }).then(res))),
                info: (title, ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon: 'info', title, ...ext }).then(res))),
                warning: (title, ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon: 'warning', title, ...ext }).then(res))),
                question: (title, ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon: 'question', title, ...ext }).then(res))),
                fire: (title, icon = 'info', ext = {}) => new Promise(res => runToast(() => Toast.fire({ icon, title, ...ext }).then(res)))
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
                    inputValidator: allowEmpty ? undefined : (val) => { if (!val) return validationMessage; },
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
                        inputValidator: allowEmpty ? undefined : (val) => { if (!val) return validationMessage; },
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
            async: async (title, text, promiseFn, options = {}) => {
                const {
                    successTitle = 'Success', successText = 'Operation completed.',
                    showSuccess = true, showError = true, errorTitle = 'Error',
                    allowCancel = false, ...ext
                } = options;

                Swal.fire({
                    title, text, allowOutsideClick: false, allowEscapeKey: allowCancel,
                    showConfirmButton: false, showCancelButton: allowCancel,
                    cancelButtonText: 'Cancel', cancelButtonColor: config.cancelColor,
                    customClass: { popup: config.popupClass },
                    didOpen: () => { Swal.showLoading(); },
                    ...ext
                });

                try {
                    const result = await promiseFn();
                    if (showSuccess) {
                        Swal.close();
                        await Swal.fire({ title: successTitle, text: successText, icon: 'success', confirmButtonColor: config.confirmColor, customClass: { popup: config.popupClass }, timer: 2000, timerProgressBar: true });
                    } else {
                        Swal.close();
                    }
                    return { success: true, data: result };
                } catch (err) {
                    Swal.close();
                    if (showError) {
                        await Swal.fire({ title: errorTitle, text: err.message || err.data?.message || 'Operation failed', icon: 'error', confirmButtonColor: config.confirmColor, customClass: { popup: config.popupClass } });
                    }
                    return { success: false, error: err };
                }
            },

            // ----- Async Query -----
            asyncQuery: (title, text, promiseFn, options = {}) => {
                const {
                    successTitle = 'Success', successText = 'Operation completed.',
                    showSuccess = true, showError = true, errorTitle = 'Error',
                    allowCancel = false, ...ext
                } = options;

                return createQuery(async () => {
                    Swal.fire({
                        title, text, allowOutsideClick: false, allowEscapeKey: allowCancel,
                        showConfirmButton: false, showCancelButton: allowCancel,
                        cancelButtonText: 'Cancel', cancelButtonColor: config.cancelColor,
                        customClass: { popup: config.popupClass },
                        didOpen: () => { Swal.showLoading(); },
                        ...ext
                    });

                    try {
                        const result = await promiseFn();
                        if (showSuccess) {
                            Swal.close();
                            await Swal.fire({ title: successTitle, text: successText, icon: 'success', confirmButtonColor: config.confirmColor, customClass: { popup: config.popupClass }, timer: 2000, timerProgressBar: true });
                        } else {
                            Swal.close();
                        }
                        return { success: true, data: result, confirmed: true };
                    } catch (err) {
                        Swal.close();
                        if (showError) {
                            await Swal.fire({ title: errorTitle, text: err.message || err.data?.message || 'Operation failed', icon: 'error', confirmButtonColor: config.confirmColor, customClass: { popup: config.popupClass } });
                        }
                        throw err;
                    }
                });
            },

            raw: Swal
        };

        // ==========================================
        // 6. NAMESPACED API REGISTRATION (Helix v11.1.5)
        // ==========================================
        app.namespace('notify', {
            $notify,
            toast: $notify.toast,
            alert: $notify.alert,
            confirm: $notify.confirm,
            confirmQuery: $notify.confirmQuery,
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
        // 7. CLEANUP LIFECYCLE (Helix v11.1.5)
        // ==========================================
        return () => {
            toastQueue.length = 0;
            activeToasts = 0;
            Swal.close();
        };
    }
};