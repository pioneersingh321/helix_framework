/**
 * Helix.js Loader Plugin v2.0
 * Aligned with Helix.js v11.1.5 Plugin Architecture
 *
 * Features:
 * - Global loading overlay with reactive state
 * - Per-element v-loading directive
 * - Themes: glass, dark
 * - Icons: spinner, dots, FontAwesome, RemixIcon, custom function/HTML
 * - Plugin metadata, cleanup lifecycle, namespaced API
 */

const HelixLoaderPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.5)
    // ==========================================
    name: 'loader',
    version: '2.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        const themes = {
            glass: {
                background: 'rgba(255,255,255,0.7)',
                blur: true,
                blurAmount: 10,
                textColor: '#374151',
                iconColor: '#4285F4'
            },
            dark: {
                background: 'rgba(15,23,42,0.8)',
                blur: true,
                blurAmount: 8,
                textColor: '#f9fafb',
                iconColor: '#10b981'
            }
        };

        const defaults = {
            theme: 'glass',
            zIndex: 2147483647,
            fade: [300, 200],
            icon: 'spinner',
            iconColor: '#4285F4',
            size: 48,
            text: '',
            gap: '16px',
            direction: 'column',
            debug: false
        };

        const themeConfig = themes[options.theme || defaults.theme] || themes.glass;
        const globalConfig = { ...defaults, ...themeConfig, ...options };

        function log(...args) {
            if (globalConfig.debug) console.log('[Helix Loader]', ...args);
        }

        // ==========================================
        // CSS
        // ==========================================
        const styleId = 'hx-loader-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @keyframes hx-spin { to { transform: rotate(360deg); } }
                .hx-dots { display:flex; gap:6px; }
                .hx-dots span {
                    border-radius:50%;
                    background:var(--hx-color);
                    animation: hx-bounce 1s infinite alternate;
                }
                .hx-dots span:nth-child(2) { animation-delay: 0.15s; }
                .hx-dots span:nth-child(3) { animation-delay: 0.3s; }
                @keyframes hx-bounce {
                    from { opacity:.3; transform:translateY(0); }
                    to { opacity:1; transform:translateY(-8px); }
                }
                .fa-spin, .ri-spin { animation: hx-spin 1.2s linear infinite !important; }
            `;
            document.head.appendChild(style);
        }

        // ==========================================
        // ICON BUILDER
        // ==========================================
        function buildIcon(cfg) {
            const wrap = document.createElement('div');
            if (typeof cfg.icon === 'function') {
                const el = cfg.icon(cfg);
                if (el instanceof HTMLElement) wrap.appendChild(el);
                return wrap;
            }

            wrap.style.color = cfg.iconColor;
            wrap.style.fontSize = cfg.size + 'px';

            if (cfg.icon === 'spinner') {
                const el = document.createElement('div');
                const border = Math.max(2, cfg.size / 10);
                el.style.width = cfg.size + 'px';
                el.style.height = cfg.size + 'px';
                el.style.border = `${border}px solid rgba(0,0,0,0.1)`;
                el.style.borderTopColor = cfg.iconColor;
                el.style.borderRadius = '50%';
                el.style.animation = 'hx-spin 0.8s linear infinite';
                wrap.appendChild(el);
            }
            else if (cfg.icon === 'dots') {
                wrap.className = 'hx-dots';
                wrap.style.setProperty('--hx-color', cfg.iconColor);
                const dot = cfg.size / 4;
                wrap.innerHTML = `<span style="width:${dot}px;height:${dot}px"></span>`.repeat(3);
            }
            else if (typeof cfg.icon === 'string' && (cfg.icon.includes('fa-') || cfg.icon.includes('ri-'))) {
                const i = document.createElement('i');
                i.className = cfg.icon;
                i.style.fontSize = cfg.size + 'px';
                wrap.appendChild(i);
            }
            else {
                wrap.innerHTML = cfg.icon;
            }
            return wrap;
        }

        // ==========================================
        // STATE (reactive)
        // ==========================================
        const state = app.reactive({
            count: 0,
            active: false,
            visible: false,
            text: globalConfig.text
        });

        // ==========================================
        // GLOBAL OVERLAY
        // ==========================================
        const overlay = document.createElement('div');
        overlay.id = 'hx-loader-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0; display:none;
            align-items:center; justify-content:center;
            background:${globalConfig.background};
            ${globalConfig.blur ? `backdrop-filter: blur(${globalConfig.blurAmount}px); -webkit-backdrop-filter: blur(${globalConfig.blurAmount}px);` : ''}
            z-index:${globalConfig.zIndex};
            opacity:0;
            transition: opacity ${globalConfig.fade[0]}ms ease;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            display:flex; flex-direction:${globalConfig.direction};
            align-items:center; gap:${globalConfig.gap};
        `;
        container.appendChild(buildIcon(globalConfig));

        const textEl = document.createElement('div');
        textEl.style.color = globalConfig.textColor;
        textEl.style.fontSize = '14px';
        textEl.style.fontFamily = 'system-ui, sans-serif';
        container.appendChild(textEl);

        overlay.appendChild(container);
        document.body.appendChild(overlay);
        log('Overlay appended to body');

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

        // ==========================================
        // PUBLIC API
        // ==========================================
        const $loader = {
            show(text) {
                if (text !== undefined) state.text = text;
                state.count++;
                log('show() called, count =', state.count);
                if (state.count === 1) {
                    state.active = true;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            state.visible = true;
                            log('visible = true');
                        });
                    });
                }
            },

            hide(force = false) {
                state.count = force ? 0 : Math.max(0, state.count - 1);
                log('hide() called, count =', state.count);
                if (state.count === 0) {
                    state.visible = false;
                    setTimeout(() => {
                        if (!state.visible) {
                            state.active = false;
                            log('active = false (fade complete)');
                        }
                    }, globalConfig.fade[1]);
                }
            },

            text(val) {
                state.text = val;
            },

            state
        };

        // ==========================================
        // DIRECTIVE: v-loading
        // ==========================================
        // Store per-element cleanup functions
        const directiveCleanups = new WeakMap();

        app.directive('loading', {
            mounted(el, binding) {
                const expr = binding.value;

                el.style.position ||= 'relative';

                let localConfig = {};
                try {
                    const attr = el.getAttribute('hx-loading-config');
                    if (attr) localConfig = JSON.parse(attr);
                } catch (e) {
                    console.warn('[Helix Loader] Invalid hx-loading-config JSON:', e);
                }

                const localTheme = themes[localConfig.theme || globalConfig.theme] || {};
                const cfg = { ...defaults, ...localTheme, ...globalConfig, ...localConfig };

                const localOverlay = overlay.cloneNode(true);
                localOverlay.id = null;
                localOverlay.style.position = 'absolute';
                localOverlay.style.borderRadius = getComputedStyle(el).borderRadius;

                const localContainer = localOverlay.querySelector('div');
                localContainer.innerHTML = '';
                localContainer.appendChild(buildIcon(cfg));

                el.appendChild(localOverlay);

                let lastVal = false;

                const update = () => {
                    const val = binding.ctx && app.resolvePath
                        ? !!app.resolvePath(expr, binding.ctx)
                        : false;
                    if (val === lastVal) return;
                    lastVal = val;
                    localOverlay.style.display = val ? 'flex' : 'none';
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            localOverlay.style.opacity = val ? '1' : '0';
                        });
                    });
                };

                // Create effect to watch the expression
                const dirEffect = app.effect(() => {
                    update();
                });

                // Store cleanup for this element
                directiveCleanups.set(el, () => {
                    localOverlay.remove();
                    if (dirEffect && dirEffect.stop) dirEffect.stop();
                });

                // Run once immediately
                update();
            },

            updated(el, binding) {
                // The effect already re-runs automatically via Helix reactivity
                // No manual update needed
            },

            unmounted(el) {
                const cleanup = directiveCleanups.get(el);
                if (cleanup) {
                    cleanup();
                    directiveCleanups.delete(el);
                }
            }
        });

        // ==========================================
        // NAMESPACED API REGISTRATION (Helix v11.1.5)
        // ==========================================
        app.namespace('loader', {
            $loader,
            show: $loader.show,
            hide: $loader.hide,
            text: $loader.text,
            state: $loader.state
        });

        // Backward compatibility: flat access
        app.$loader = $loader;

        // Provide for inject()
        if (app.provide) {
            app.provide('$loader', $loader);
        }

        log('Plugin installed. Access via app.$loader or app.namespace("loader").$loader');

        // ==========================================
        // CLEANUP LIFECYCLE (Helix v11.1.5)
        // ==========================================
        return () => {
            // Stop all effects
            if (displayEffect && displayEffect.stop) displayEffect.stop();
            if (opacityEffect && opacityEffect.stop) opacityEffect.stop();
            if (textEffect && textEffect.stop) textEffect.stop();

            // Remove global overlay
            overlay.remove();

            // Remove styles
            const style = document.getElementById(styleId);
            if (style) style.remove();

            // Reset state
            state.count = 0;
            state.active = false;
            state.visible = false;

            log('Cleanup complete');
        };
    }
};