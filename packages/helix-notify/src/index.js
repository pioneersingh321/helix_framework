/**
 * Helix.js Notify Plugin v2.2.6 (Helix v11.1.6 Compliant)
 * Global (Helix.$notify) + App Context destructuring (const { $notify } = appCtx)
 * Includes 6 Premium Themes: clinical, glass, dark, neon, brutal, aurora.
 * Automatically loads SweetAlert2 from CDN if not already defined on the page.
 */
const HelixNotifyPlugin = (function () {
    "use strict";

    let swalLoadPromise = null;

    /**
     * Fallback SweetAlert2 object if offline or headless environment
     */
    function createFallbackSwal() {
        return {
            fire: (opts = {}) => {
                const title = typeof opts === 'string' ? opts : (opts.title || '');
                const text = typeof opts === 'object' ? (opts.text || '') : '';
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert(`${title}\n${text}`.trim());
                } else {
                    console.log(`[HelixNotify:Alert] ${title} ${text}`);
                }
                return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
            },
            mixin: function (mixinOpts) {
                return {
                    fire: (opts = {}) => {
                        const title = typeof opts === 'string' ? opts : (opts.title || '');
                        console.log(`[HelixNotify:Toast] ${title}`);
                        return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false });
                    }
                };
            },
            close: () => {},
            showLoading: () => {},
            stopTimer: () => {},
            resumeTimer: () => {},
            DismissReason: {
                cancel: 'cancel',
                backdrop: 'backdrop',
                close: 'close',
                esc: 'esc',
                timer: 'timer'
            }
        };
    }

    /**
     * Ensures SweetAlert2 is available, auto-injecting from CDN if not defined
     */
    function ensureSwal(options = {}) {
        const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
        if (root.Swal) {
            return Promise.resolve(root.Swal);
        }

        if (swalLoadPromise) {
            return swalLoadPromise;
        }

        if (typeof document === 'undefined') {
            return Promise.resolve(createFallbackSwal());
        }

        const cdnUrl = options.cdnUrl || 'https://cdn.jsdelivr.net/npm/sweetalert2@11';

        // Check if a script tag with sweetalert2 already exists on the page
        const existingScript = document.querySelector('script[src*="sweetalert2"]');
        if (existingScript) {
            swalLoadPromise = new Promise((resolve) => {
                if (root.Swal) return resolve(root.Swal);
                const onLoad = () => resolve(root.Swal || createFallbackSwal());
                const onError = () => resolve(createFallbackSwal());
                existingScript.addEventListener('load', onLoad, { once: true });
                existingScript.addEventListener('error', onError, { once: true });
                // 5s fallback timeout
                setTimeout(() => resolve(root.Swal || createFallbackSwal()), 5000);
            });
            return swalLoadPromise;
        }

        // Dynamically inject SweetAlert2 script tag
        swalLoadPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = cdnUrl;
            script.async = true;
            script.onload = () => {
                resolve(root.Swal || createFallbackSwal());
            };
            script.onerror = () => {
                console.warn('[HelixNotify] Failed to auto-load SweetAlert2 from CDN:', cdnUrl);
                resolve(createFallbackSwal());
            };
            (document.head || document.body || document.documentElement).appendChild(script);
        });

        return swalLoadPromise;
    }

    function install(api, options = {}) {
        // Idempotency
        if (api.$notify) return;

        // ── 1. CONFIG & THEME REGISTRY ──
        const themes = {
            clinical: {
                confirmColor: '#007bff', cancelColor: '#6c757d', denyColor: '#f59e0b',
                popupClass: 'hx-swal-clinical', toastPosition: 'top-end'
            },
            glass: {
                confirmColor: '#4f46e5', cancelColor: '#f43f5e', denyColor: '#f59e0b',
                popupClass: 'hx-swal-glass', toastPosition: 'bottom-end'
            },
            dark: {
                confirmColor: '#10b981', cancelColor: '#ef4444', denyColor: '#f59e0b',
                popupClass: 'hx-swal-dark', toastPosition: 'top-end'
            },
            neon: {
                confirmColor: '#ec4899', cancelColor: '#3b82f6', denyColor: '#eab308',
                popupClass: 'hx-swal-neon', toastPosition: 'top-end'
            },
            brutal: {
                confirmColor: '#000000', cancelColor: '#ef4444', denyColor: '#eab308',
                popupClass: 'hx-swal-brutal', toastPosition: 'bottom-right'
            },
            aurora: {
                confirmColor: '#8b5cf6', cancelColor: '#f43f5e', denyColor: '#10b981',
                popupClass: 'hx-swal-aurora', toastPosition: 'top-center'
            }
        };

        const defaults = {
            theme: 'clinical',
            toastTimer: 3000,
            queueLimit: 3,
            showCloseButton: false,
            cdnUrl: 'https://cdn.jsdelivr.net/npm/sweetalert2@11'
        };

        const baseTheme = themes[options.theme || 'clinical'] || themes.clinical;
        const config = { ...defaults, ...baseTheme, ...options };

        // Initiate SweetAlert2 background preloading if needed
        ensureSwal(config);

        // ── 2. CSS ENGINE (FULL) ──
        const styleId = 'hx-notify-styles';
        if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .swal2-popup { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }

                .hx-swal-clinical { 
                    border-radius: 8px !important; 
                    font-family: 'Inter', system-ui, sans-serif; 
                    border: 1px solid #e5e7eb !important; 
                }

                .hx-swal-glass { 
                    background: rgba(255, 255, 255, 0.65) !important; 
                    backdrop-filter: blur(16px) saturate(180%) !important; 
                    -webkit-backdrop-filter: blur(16px) saturate(180%) !important; 
                    border-radius: 16px !important; 
                    border: 1px solid rgba(255, 255, 255, 0.4) !important;
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1) !important; 
                    color: #1f2937 !important; 
                }
                .hx-swal-glass .swal2-title, .hx-swal-glass .swal2-html-container { color: #111827 !important; }

                .hx-swal-dark { 
                    background: #1f2937 !important; 
                    color: #f9fafb !important; 
                    border-radius: 12px !important; 
                }
                .hx-swal-dark .swal2-title, .hx-swal-dark .swal2-html-container { color: #f9fafb !important; }

                .hx-swal-neon { 
                    background: #0f172a !important; 
                    color: #ffffff !important; 
                    border: 1px solid #ec4899 !important; 
                    box-shadow: 0 0 15px rgba(236, 72, 153, 0.3), inset 0 0 10px rgba(59, 130, 246, 0.1) !important; 
                    border-radius: 12px !important; 
                }
                .hx-swal-neon .swal2-title, .hx-swal-neon .swal2-html-container { 
                    color: #fdf2f8 !important; 
                    text-shadow: 0 0 6px rgba(255, 255, 255, 0.2); 
                }

                .hx-swal-brutal { 
                    background: #ffffff !important; 
                    color: #000000 !important; 
                    border: 3px solid #000000 !important; 
                    box-shadow: 6px 6px 0px #000000 !important; 
                    border-radius: 0px !important; 
                    font-family: 'Courier New', ui-monospace, monospace !important; 
                }
                .hx-swal-brutal .swal2-title, .hx-swal-brutal .swal2-html-container { 
                    color: #000000 !important; 
                    font-weight: bold !important; 
                }
                .hx-swal-brutal .swal2-confirm, .hx-swal-brutal .swal2-cancel, .hx-swal-brutal .swal2-deny { 
                    border: 2px solid #000 !important; 
                    box-shadow: 3px 3px 0px #000 !important; 
                    border-radius: 0 !important; 
                    font-weight: bold !important;
                }

                .hx-swal-aurora { 
                    background: linear-gradient(135deg, #1e1b4b, #312e81, #1e1b4b) !important; 
                    color: #ffffff !important; 
                    border: 1px solid rgba(255,255,255,0.12) !important; 
                    box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; 
                    border-radius: 20px !important; 
                }
                .hx-swal-aurora .swal2-title, .hx-swal-aurora .swal2-html-container { color: #e0e7ff !important; }
            `;
            if (document.head) {
                document.head.appendChild(style);
            }
        }

        // ── 3. TOAST ENGINE (WITH HOVER PAUSE & QUEUE) ──
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

        const getToastInstance = async () => {
            const SwalRef = await ensureSwal(config);
            return SwalRef.mixin({
                toast: true,
                position: config.toastPosition,
                showConfirmButton: false,
                showCloseButton: config.showCloseButton,
                timer: config.toastTimer,
                timerProgressBar: true,
                customClass: { popup: config.popupClass },
                didOpen: (toast) => {
                    if (SwalRef.stopTimer) toast.addEventListener('mouseenter', SwalRef.stopTimer);
                    if (SwalRef.resumeTimer) toast.addEventListener('mouseleave', SwalRef.resumeTimer);
                }
            });
        };

        // ── 4. QUERY BUILDER (DEFERRED EXECUTION) ──
        function createQuery(promiseFactory, resultMapper = null) {
            const handlers = {
                onConfirmed: null, onCancelled: null, onDismissed: null,
                onDenied: null, onSuccess: null, onError: null, onFinally: null
            };

            const executePromise = Promise.resolve().then(async () => {
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
                    if (handlers.onError) {
                        handlers.onError(err);
                        return { error: err };
                    }
                    throw err;
                } finally {
                    if (handlers.onFinally) handlers.onFinally();
                }
            });

            return {
                onConfirmed(fn) { handlers.onConfirmed = fn; return this; },
                onCancelled(fn) { handlers.onCancelled = fn; return this; },
                onDismissed(fn) { handlers.onDismissed = fn; return this; },
                onDenied(fn) { handlers.onDenied = fn; return this; },
                onSuccess(fn) { handlers.onSuccess = fn; return this; },
                onError(fn) { handlers.onError = fn; return this; },
                onFinally(fn) { handlers.onFinally = fn; return this; },
                then: executePromise.then.bind(executePromise),
                catch: executePromise.catch.bind(executePromise),
                finally: executePromise.finally.bind(executePromise)
            };
        }

        // ── 5. PUBLIC API ──
        const $notify = {
            ensureReady: () => ensureSwal(config),

            toast: {
                success: (title, ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon: 'success', title, ...ext });
                    res(r);
                    return r;
                })),
                error: (title, ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon: 'error', title, ...ext });
                    res(r);
                    return r;
                })),
                info: (title, ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon: 'info', title, ...ext });
                    res(r);
                    return r;
                })),
                warning: (title, ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon: 'warning', title, ...ext });
                    res(r);
                    return r;
                })),
                question: (title, ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon: 'question', title, ...ext });
                    res(r);
                    return r;
                })),
                fire: (title, icon = 'info', ext = {}) => new Promise(res => runToast(async () => {
                    const Toast = await getToastInstance();
                    const r = await Toast.fire({ icon, title, ...ext });
                    res(r);
                    return r;
                }))
            },

            alert: async (title, text, icon = 'info', ext = {}) => {
                const SwalRef = await ensureSwal(config);
                return SwalRef.fire({
                    title, text, icon,
                    confirmButtonColor: config.confirmColor,
                    customClass: { popup: config.popupClass },
                    ...ext
                });
            },

            confirm: async (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
                const SwalRef = await ensureSwal(config);
                const res = await SwalRef.fire({
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

            confirmQuery: (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
                return createQuery(async () => {
                    const SwalRef = await ensureSwal(config);
                    const res = await SwalRef.fire({
                        title, text, icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: config.confirmColor,
                        cancelButtonColor: config.cancelColor,
                        confirmButtonText: confirmText,
                        customClass: { popup: config.popupClass },
                        ...ext
                    });
                    const cancelReason = (SwalRef.DismissReason && SwalRef.DismissReason.cancel) || 'cancel';
                    return {
                        confirmed: !!res.isConfirmed,
                        cancelled: !!res.isDismissed && res.dismiss === cancelReason,
                        dismissed: !!res.isDismissed,
                        value: res.value
                    };
                });
            },

            confirm3: async (title, text, opts = {}) => {
                const SwalRef = await ensureSwal(config);
                const { confirmText = 'Yes', denyText = 'No', cancelText = 'Cancel', ...ext } = opts;
                const res = await SwalRef.fire({
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
                return { confirmed: !!res.isConfirmed, denied: !!res.isDenied, dismissed: !!res.isDismissed, value: res.value };
            },

            confirm3Query: (title, text, opts = {}) => {
                const { confirmText = 'Yes', denyText = 'No', cancelText = 'Cancel', ...ext } = opts;
                return createQuery(async () => {
                    const SwalRef = await ensureSwal(config);
                    const res = await SwalRef.fire({
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
                    const cancelReason = (SwalRef.DismissReason && SwalRef.DismissReason.cancel) || 'cancel';
                    return {
                        confirmed: !!res.isConfirmed,
                        denied: !!res.isDenied,
                        cancelled: !!res.isDismissed && res.dismiss === cancelReason,
                        dismissed: !!res.isDismissed,
                        value: res.value
                    };
                });
            },

            prompt: async (title, options = {}) => {
                const SwalRef = await ensureSwal(config);
                const {
                    input = 'text', inputLabel = '', inputPlaceholder = '',
                    inputValue = '', inputOptions = null, inputAttributes = {},
                    validationMessage = 'This field is required', allowEmpty = false,
                    confirmText = 'Submit', ...ext
                } = options;

                const { value, isConfirmed, isDismissed } = await SwalRef.fire({
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
                return { value, confirmed: !!isConfirmed, dismissed: !!isDismissed };
            },

            promptQuery: (title, options = {}) => {
                const {
                    input = 'text', inputLabel = '', inputPlaceholder = '',
                    inputValue = '', inputOptions = null, inputAttributes = {},
                    validationMessage = 'This field is required', allowEmpty = false,
                    confirmText = 'Submit', ...ext
                } = options;

                return createQuery(async () => {
                    const SwalRef = await ensureSwal(config);
                    const res = await SwalRef.fire({
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
                    const cancelReason = (SwalRef.DismissReason && SwalRef.DismissReason.cancel) || 'cancel';
                    return {
                        value: res.value,
                        confirmed: !!res.isConfirmed,
                        cancelled: !!res.isDismissed && res.dismiss === cancelReason,
                        dismissed: !!res.isDismissed
                    };
                });
            },

            async: async (title, text, promiseFn, options = {}) => {
                const SwalRef = await ensureSwal(config);
                const {
                    successTitle = 'Success', successText = 'Operation completed.',
                    showSuccess = true, showError = true, errorTitle = 'Error',
                    allowCancel = false, ...ext
                } = options;

                SwalRef.fire({
                    title, text, allowOutsideClick: false, allowEscapeKey: allowCancel,
                    showConfirmButton: false, showCancelButton: allowCancel,
                    cancelButtonText: 'Cancel', cancelButtonColor: config.cancelColor,
                    customClass: { popup: config.popupClass },
                    didOpen: () => { if (SwalRef.showLoading) SwalRef.showLoading(); },
                    ...ext
                });

                try {
                    const result = await promiseFn();
                    if (showSuccess) {
                        SwalRef.close();
                        await SwalRef.fire({
                            title: successTitle, text: successText, icon: 'success',
                            confirmButtonColor: config.confirmColor,
                            customClass: { popup: config.popupClass },
                            timer: 2000, timerProgressBar: true
                        });
                    } else {
                        SwalRef.close();
                    }
                    return { success: true, data: result };
                } catch (err) {
                    SwalRef.close();
                    if (showError) {
                        await SwalRef.fire({
                            title: errorTitle,
                            text: err?.message || err?.data?.message || 'Operation failed',
                            icon: 'error',
                            confirmButtonColor: config.confirmColor,
                            customClass: { popup: config.popupClass }
                        });
                    }
                    return { success: false, error: err };
                }
            },

            asyncQuery: (title, text, promiseFn, options = {}) => {
                const {
                    successTitle = 'Success', successText = 'Operation completed.',
                    showSuccess = true, showError = true, errorTitle = 'Error',
                    allowCancel = false, ...ext
                } = options;

                return createQuery(async () => {
                    const SwalRef = await ensureSwal(config);
                    SwalRef.fire({
                        title, text, allowOutsideClick: false, allowEscapeKey: allowCancel,
                        showConfirmButton: false, showCancelButton: allowCancel,
                        cancelButtonText: 'Cancel', cancelButtonColor: config.cancelColor,
                        customClass: { popup: config.popupClass },
                        didOpen: () => { if (SwalRef.showLoading) SwalRef.showLoading(); },
                        ...ext
                    });

                    try {
                        const result = await promiseFn();
                        if (showSuccess) {
                            SwalRef.close();
                            await SwalRef.fire({
                                title: successTitle, text: successText, icon: 'success',
                                confirmButtonColor: config.confirmColor,
                                customClass: { popup: config.popupClass },
                                timer: 2000, timerProgressBar: true
                            });
                        } else {
                            SwalRef.close();
                        }
                        return { success: true, data: result, confirmed: true };
                    } catch (err) {
                        SwalRef.close();
                        if (showError) {
                            await SwalRef.fire({
                                title: errorTitle,
                                text: err?.message || err?.data?.message || 'Operation failed',
                                icon: 'error',
                                confirmButtonColor: config.confirmColor,
                                customClass: { popup: config.popupClass }
                            });
                        }
                        throw err;
                    }
                });
            },

            get raw() {
                const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
                return root.Swal || null;
            }
        };

        // ── 6. ATTACH TO RECEIVED API ──
        api.$notify = $notify;

        // ── 7. NAMESPACED REGISTRATION ──
        if (api.namespace) {
            api.namespace('notify', {
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
                get raw() { return $notify.raw; }
            });
        }

        // ── 8. PROVIDE FOR inject() ──
        if (api.provide) {
            api.provide('$notify', $notify);
        }

        // ── 9. GLOBAL FALLBACK (Helix.$notify) ──
        const GlobalHelix = (typeof window !== 'undefined' && window.Helix) ||
            (typeof globalThis !== 'undefined' && globalThis.Helix) ||
            (typeof Helix !== 'undefined' ? Helix : null);

        if (GlobalHelix) {
            GlobalHelix.$notify = $notify;
        }

        // ── 10. CLEANUP ──
        const cleanup = () => {
            toastQueue.length = 0;
            activeToasts = 0;
            const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
            if (root.Swal && typeof root.Swal.close === 'function') {
                root.Swal.close();
            }
        };

        if (api.onCleanup && typeof api.onCleanup === 'function') {
            api.onCleanup(cleanup);
        }

        return cleanup;
    }

    return {
        name: 'notify',
        version: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NOTIFY_VERSION) || '2.2.6',
        requires: { helix: '>=11.1.5' },
        install
    };
})();

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixNotifyPlugin = HelixNotifyPlugin;

export default HelixNotifyPlugin;
