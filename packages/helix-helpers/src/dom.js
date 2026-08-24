export function createDomMethods(H) {
    return {
        scrollTo(target, behavior = 'smooth', block = 'start') {
            if (typeof window === 'undefined') return;
            if (typeof target === 'string') {
                if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
                    document.querySelector(target)?.scrollIntoView({ behavior, block });
                }
            } else if (typeof Element !== 'undefined' && target instanceof Element) {
                target.scrollIntoView({ behavior, block });
            } else if (typeof target === 'number') {
                if (typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: target, behavior });
                }
            } else {
                if (typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: 0, behavior });
                }
            }
        },

        async copyToClipboard(text) {
            if (!H.isString(text)) return false;
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                throw new Error('Clipboard API unavailable');
            } catch {
                if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
                    return false;
                }
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    return true;
                } catch {
                    return false;
                } finally {
                    document.body.removeChild(ta);
                }
            }
        },

        copy(text) {
            return H.copyToClipboard(text);
        },

        downloadFile(content, filename, type = 'text/plain') {
            if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
                return false;
            }
            try {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    if (a.parentNode) document.body.removeChild(a);
                }, 100);
                return true;
            } catch {
                return false;
            }
        },

        trapFocus(element, options = {}) {
            if (!element) return () => {};
            const FOCUSABLE = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
            const prevActive = typeof document !== 'undefined' ? document.activeElement : null;

            const getFocusables = () => {
                if (typeof element.querySelectorAll !== 'function') return [];
                return Array.from(element.querySelectorAll(FOCUSABLE)).filter(el => {
                    return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
                });
            };

            const onKeydown = (e) => {
                if (e.key !== 'Tab') return;
                const focusables = getFocusables();
                if (focusables.length === 0) {
                    e.preventDefault();
                    return;
                }
                const firstEl = focusables[0];
                const lastEl = focusables[focusables.length - 1];

                const containsActive = typeof element.contains === 'function' ? element.contains(document.activeElement) : false;

                if (e.shiftKey) {
                    if (document.activeElement === firstEl || !containsActive) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl || !containsActive) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            };

            if (typeof document !== 'undefined') {
                document.addEventListener('keydown', onKeydown);
            }

            const focusables = getFocusables();
            if (focusables.length > 0) {
                focusables[0].focus();
            } else if (typeof element.focus === 'function') {
                if (typeof element.hasAttribute === 'function' && !element.hasAttribute('tabindex')) {
                    element.setAttribute('tabindex', '-1');
                }
                element.focus();
            }

            const cleanup = () => {
                if (typeof document !== 'undefined') {
                    document.removeEventListener('keydown', onKeydown);
                }
                if (prevActive && typeof prevActive.focus === 'function') {
                    try { prevActive.focus(); } catch (err) {}
                }
            };
            return cleanup;
        },

        releaseFocus(previousElement) {
            if (previousElement && typeof previousElement.focus === 'function') {
                previousElement.focus();
            }
        },

        collapse(element, isOpen, options = {}) {
            if (!element || !element.style || typeof element.scrollHeight !== 'number') return;
            const duration = options.duration || 300;
            const minHeight = options.minHeight || 0;
            const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));

            element.style.transitionProperty = 'height';
            element.style.transitionDuration = `${duration}ms`;
            element.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';

            if (isOpen) {
                element.style.display = '';
                element.style.overflow = 'hidden';
                element.style.height = `${minHeight}px`;
                const fullHeight = element.scrollHeight;
                nextFrame(() => {
                    element.style.height = `${fullHeight}px`;
                    setTimeout(() => {
                        element.style.height = '';
                        element.style.overflow = '';
                    }, duration);
                });
            } else {
                element.style.height = `${element.scrollHeight}px`;
                element.style.overflow = 'hidden';
                nextFrame(() => {
                    element.style.height = `${minHeight}px`;
                    setTimeout(() => {
                        if (minHeight === 0) element.style.display = 'none';
                    }, duration);
                });
            }
        },

        intersect(element, callback, options = {}) {
            if (!element || typeof callback !== 'function') return () => {};
            if (typeof IntersectionObserver === 'undefined') {
                if (options.fallback === 'visible') {
                    callback({ target: element, isIntersecting: true, intersectionRatio: 1 });
                }
                return () => {};
            }
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        callback(entry);
                        if (options.once) {
                            observer.unobserve(element);
                            observer.disconnect();
                        }
                    } else if (options.leave) {
                        callback(entry);
                    }
                });
            }, {
                threshold: options.threshold || 0,
                rootMargin: options.rootMargin || '0px'
            });
            observer.observe(element);
            return () => {
                observer.unobserve(element);
                observer.disconnect();
            };
        }
    };
}
