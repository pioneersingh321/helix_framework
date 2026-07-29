import { themes, defaults, normalizeFade } from './theme.js';
import { setupStyles, releaseStyles, styleId } from './style.js';
import { buildOverlay, appendToBody } from './overlay.js';
import { buildIcon } from './icon.js';

const HelixLoaderPlugin = {
    name: 'loader',
    version: import.meta.env.VITE_LOADER_VERSION || '0.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {
        // Install marker keyed by a global Symbol — independent of app.$loader,
        // so re-assigning app.$loader elsewhere can't false-trip the guard.
        const INSTALL_MARK = Symbol.for('helix.loader.installed');
        if (app[INSTALL_MARK]) {
            console.warn('[Helix Loader] already installed on this app; skipping.');
            return () => { };
        }

        const themeConfig = themes[options.theme || defaults.theme] || themes.glass;
        const globalConfig = { ...defaults, ...themeConfig, ...options };
        globalConfig.fade = normalizeFade(globalConfig.fade);

        // HTML-injection switch: install options ONLY, never cfg/attribute.
        const HTML_ICON_ALLOWED = globalConfig.allowHtmlIcon === true;

        function log(...args) {
            if (globalConfig.debug) console.log('[Helix Loader]', ...args);
        }

        // ==========================================
        // CSS (shared across installs → ref-counted)
        // ==========================================
        setupStyles();

        // ==========================================
        // GLOBAL OVERLAY
        // ==========================================
        const { el: overlay, textEl, progressContainer, progressBar } = buildOverlay(globalConfig, {
            scoped: false,
            allowHtmlIcon: HTML_ICON_ALLOWED
        });
        overlay.id = 'hx-loader-overlay';
        appendToBody(overlay);
        log('Overlay queued for body');

        // ==========================================
        // STATE (reactive)
        // ==========================================
        const state = app.reactive({
            count: 0,
            active: false,
            visible: false,
            text: globalConfig.text,
            progress: 0
        });

        // ==========================================
        // REACTIVE BINDINGS
        // ==========================================
        const displayEffect = app.effect(() => {
            const display = state.active ? 'flex' : 'none';
            if (overlay.style.display !== display) {
                overlay.style.display = display;
                log('display →', display);
            }
        });

        const opacityEffect = app.effect(() => {
            const opacity = state.visible ? '1' : '0';
            if (overlay.style.opacity !== opacity) {
                overlay.style.opacity = opacity;
                log('opacity →', opacity);
            }
        });

        const textEffect = app.effect(() => {
            textEl.textContent = state.text;
            textEl.style.display = state.text ? 'block' : 'none';
        });

        const progressEffect = app.effect(() => {
            const p = state.progress;
            if (p > 0) {
                progressContainer.style.display = 'block';
                progressBar.style.width = `${Math.min(100, Math.max(0, p))}%`;
            } else {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }
        });

        // ==========================================
        // OVERLAY RECYCLING POOL (10,000 rows efficiency)
        // ==========================================
        const overlayPool = {
            pool: [],
            acquire(cfg, allowHtmlIcon) {
                if (this.pool.length > 0) {
                    const item = this.pool.pop();
                    const fade = normalizeFade(cfg.fade);
                    item.el.style.background = cfg.background;
                    item.el.style.zIndex = cfg.zIndex;
                    item.el.style.transition = `opacity ${fade[0]}ms ease`;
                    if (cfg.blur) {
                        item.el.style.backdropFilter = `blur(${cfg.blurAmount}px)`;
                        item.el.style.webkitBackdropFilter = `blur(${cfg.blurAmount}px)`;
                    } else {
                        item.el.style.backdropFilter = '';
                        item.el.style.webkitBackdropFilter = '';
                    }
                    item.container.innerHTML = '';
                    item.container.style.flexDirection = cfg.direction;
                    item.container.style.gap = cfg.gap;
                    item.container.appendChild(buildIcon(cfg, allowHtmlIcon));
                    return item;
                }
                return buildOverlay(cfg, { scoped: true, allowHtmlIcon });
            },
            release(item) {
                item.el.style.opacity = '0';
                item.el.style.display = 'none';
                if (item.el.parentNode) item.el.remove();

                // Enforce max pool size limit
                if (this.pool.length < (globalConfig.poolSize || 100)) {
                    this.pool.push(item);
                }
            },
            clear() {
                this.pool = [];
            }
        };

        // ==========================================
        // PUBLIC API (reference-counted, anti-flicker, minDuration, wrap)
        // ==========================================
        let flickerTimer = null;
        let minDurationTimer = null;
        let hideTimer = null;
        let shownAt = 0;

        const triggerShow = () => {
            overlay.style.transition = `opacity ${globalConfig.fade[0]}ms ease`;
            state.active = true;
            shownAt = Date.now();
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (state.count > 0) state.visible = true;
            }));
        };

        const triggerHide = () => {
            const out = globalConfig.fade[1];
            overlay.style.transition = `opacity ${out}ms ease`;
            state.visible = false;
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            if (out === 0) {
                if (state.count === 0) state.active = false;
            } else {
                hideTimer = setTimeout(() => {
                    hideTimer = null;
                    if (state.count === 0) {
                        state.active = false;
                        log('active = false (fade complete)');
                    }
                }, out);
            }
        };

        const $loader = {
            show(text) {
                if (text !== undefined) state.text = text;
                state.count++;
                log('show(), count =', state.count);

                if (state.count === 1) {
                    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                    if (minDurationTimer) { clearTimeout(minDurationTimer); minDurationTimer = null; }

                    const antiFlicker = globalConfig.antiFlicker;
                    if (antiFlicker > 0) {
                        flickerTimer = setTimeout(() => {
                            flickerTimer = null;
                            triggerShow();
                        }, antiFlicker);
                    } else {
                        triggerShow();
                    }
                }
            },

            hide(force = false) {
                state.count = force ? 0 : Math.max(0, state.count - 1);
                log('hide(), count =', state.count);

                if (state.count === 0) {
                    if (flickerTimer) {
                        clearTimeout(flickerTimer);
                        flickerTimer = null;
                        return;
                    }

                    const minDuration = globalConfig.minDuration;
                    const elapsed = Date.now() - shownAt;

                    if (minDuration > 0 && elapsed < minDuration) {
                        const remaining = minDuration - elapsed;
                        if (minDurationTimer) clearTimeout(minDurationTimer);
                        minDurationTimer = setTimeout(() => {
                            minDurationTimer = null;
                            triggerHide();
                        }, remaining);
                    } else {
                        triggerHide();
                    }
                }
            },

            text(val) {
                state.text = val;
            },

            progress(val) {
                state.progress = val;
                // Auto hide overlay when progress reaches 100%
                if (val >= 100 && globalConfig.autoHideOnComplete !== false) {
                    setTimeout(() => {
                        if (state.progress >= 100) {
                            $loader.hide();
                            state.progress = 0;
                        }
                    }, globalConfig.autoHideDelay || 250);
                }
            },

            async wrap(fnOrPromise, options = {}) {
                const loaderText = options.text || undefined;
                $loader.show(loaderText);
                try {
                    if (typeof fnOrPromise === 'function') {
                        return await fnOrPromise();
                    }
                    return await fnOrPromise;
                } finally {
                    $loader.hide();
                }
            },

            state
        };

        // ==========================================
        // DIRECTIVE: v-loading
        // ==========================================
        const directiveCleanups = new WeakMap();
        const directiveUpdaters = new WeakMap();
        const directiveEffects = new Set();
        const allDirectiveCleanups = new Set();

        app.directive('loading', {
            mounted(el, binding) {
                let patchedPosition = false;
                const prevInlinePosition = el.style.position;
                if (getComputedStyle(el).position === 'static') {
                    el.style.position = 'relative';
                    patchedPosition = true;
                }

                let localConfig = {};
                try {
                    const attr = el.getAttribute('hx-loading-config');
                    if (attr) localConfig = JSON.parse(attr);
                } catch (e) {
                    console.warn('[Helix Loader] Invalid hx-loading-config JSON:', e);
                }

                if ('allowHtmlIcon' in localConfig) delete localConfig.allowHtmlIcon;

                const localTheme = localConfig.theme ? (themes[localConfig.theme] || {}) : {};
                const cfg = { ...defaults, ...globalConfig, ...localTheme, ...localConfig };
                cfg.fade = normalizeFade(cfg.fade);
                const [fadeIn, fadeOut] = cfg.fade;

                const iconFromAttr = Object.prototype.hasOwnProperty.call(localConfig, 'icon');
                const allowHtmlIcon = HTML_ICON_ALLOWED && !iconFromAttr;

                // Acquire overlay from pool
                const poolItem = overlayPool.acquire(cfg, allowHtmlIcon);
                const localOverlay = poolItem.el;
                localOverlay.style.borderRadius = getComputedStyle(el).borderRadius;
                el.appendChild(localOverlay);

                const elState = { binding, lastVal: false, timer: null };

                const resolveVal = () => {
                    const b = elState.binding;
                    if (typeof b.value === 'string' && b.ctx && app.resolvePath) {
                        return !!app.resolvePath(b.value, b.ctx);
                    }
                    return !!b.value;
                };

                const update = () => {
                    const val = resolveVal();
                    if (val === elState.lastVal) return;
                    elState.lastVal = val;

                    if (val) {
                        if (elState.timer) { clearTimeout(elState.timer); elState.timer = null; }
                        localOverlay.style.display = 'flex';
                        void localOverlay.offsetWidth;
                        localOverlay.style.transition = `opacity ${fadeIn}ms ease`;
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            if (elState.lastVal) localOverlay.style.opacity = '1';
                        }));
                    } else {
                        if (elState.timer) { clearTimeout(elState.timer); elState.timer = null; }
                        if (fadeOut === 0) {
                            localOverlay.style.transition = 'none';
                            localOverlay.style.opacity = '0';
                            localOverlay.style.display = 'none';
                        } else {
                            localOverlay.style.transition = `opacity ${fadeOut}ms ease`;
                            localOverlay.style.opacity = '0';
                            elState.timer = setTimeout(() => {
                                elState.timer = null;
                                if (!elState.lastVal) localOverlay.style.display = 'none';
                            }, fadeOut);
                        }
                    }
                };

                const dirEffect = app.effect(() => { update(); });
                directiveEffects.add(dirEffect);

                directiveUpdaters.set(el, (b) => { elState.binding = b; update(); });

                const cleanup = () => {
                    if (elState.timer) { clearTimeout(elState.timer); elState.timer = null; }
                    if (dirEffect && dirEffect.stop) dirEffect.stop();
                    directiveEffects.delete(dirEffect);

                    // Release back to pool
                    overlayPool.release(poolItem);

                    if (patchedPosition) el.style.position = prevInlinePosition;
                    allDirectiveCleanups.delete(cleanup);
                };
                directiveCleanups.set(el, cleanup);
                allDirectiveCleanups.add(cleanup);

                update();
            },

            updated(el, binding) {
                const u = directiveUpdaters.get(el);
                if (u) u(binding);
            },

            unmounted(el) {
                const cleanup = directiveCleanups.get(el);
                if (cleanup) {
                    cleanup();
                    directiveCleanups.delete(el);
                    directiveUpdaters.delete(el);
                }
            }
        });

        // ==========================================
        // NAMESPACED API REGISTRATION
        // ==========================================
        if (app.namespace) {
            app.namespace('loader', {
                $loader,
                show: $loader.show,
                hide: $loader.hide,
                text: $loader.text,
                progress: $loader.progress,
                wrap: $loader.wrap,
                state: $loader.state
            });
        }

        app.$loader = $loader;
        app[INSTALL_MARK] = true;

        if (app.provide) {
            app.provide('$loader', $loader);
        }

        log('Plugin installed.');

        // ==========================================
        // CLEANUP LIFECYCLE
        // ==========================================
        return () => {
            if (flickerTimer) { clearTimeout(flickerTimer); flickerTimer = null; }
            if (minDurationTimer) { clearTimeout(minDurationTimer); minDurationTimer = null; }
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

            if (displayEffect && displayEffect.stop) displayEffect.stop();
            if (opacityEffect && opacityEffect.stop) opacityEffect.stop();
            if (textEffect && textEffect.stop) textEffect.stop();
            if (progressEffect && progressEffect.stop) progressEffect.stop();

            Array.from(allDirectiveCleanups).forEach(fn => fn());
            allDirectiveCleanups.clear();

            directiveEffects.forEach(e => { if (e && e.stop) e.stop(); });
            directiveEffects.clear();

            overlayPool.clear();
            overlay.remove();

            releaseStyles();

            if (app.removeDirective) app.removeDirective('loading');
            if (app.removeNamespace) app.removeNamespace('loader');
            if (app.$loader === $loader) delete app.$loader;
            delete app[INSTALL_MARK];

            state.count = 0;
            state.active = false;
            state.visible = false;
            state.progress = 0;

            log('Cleanup complete');
        };
    }
};

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixLoaderPlugin = HelixLoaderPlugin;

export default HelixLoaderPlugin;
export { themes, defaults };
