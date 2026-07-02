/**
 * Helix.js Loader Plugin v2.5
 * Aligned with Helix.js v11.1.x Plugin Architecture
 *
 * CHANGELOG (condensed)
 *  v2.1 race-safe show/hide ref-count; single cleared timer; theme merge order;
 *       directive fade-out; binding dual-path; computed position; body-null
 *       defer; fade normalization; guarded namespace.
 *  v2.2 buildOverlay() factory (no cloneNode); scoped overlays honor local cfg.
 *  v2.3 full directive teardown via cleanup Set; full transition declaration;
 *       fade-out===0 instant hide; double-install guard.
 *  v2.4 icon HTML injection gated behind install-only allowHtmlIcon (provenance
 *       is not trust); string icons render as textContent by default.
 *  v2.5 host position restored on unmount; shared stylesheet ref-counted;
 *       install guard via Symbol marker (no $loader false-positive);
 *       attribute allowHtmlIcon stripped pre-merge; reflow boundary on
 *       re-show after instant (transition:none) hide.
 *
 * SECURITY (icons): only icon:()=>HTMLElement or the install-only option
 *  allowHtmlIcon:true can produce markup; any icon STRING is textContent
 *  otherwise. The switch is read from install options exclusively, never from
 *  hx-loading-config.
 * IMMUTABILITY: global overlay built once at install; mutate-then-rebuild not
 *  supported (re-install instead).
 * BINDING: string-path (reactive via resolvePath) + pre-evaluated binding.value
 *  (refreshed via updated()). app.removeDirective/removeNamespace best-effort.
 */

const HelixLoaderPlugin = {
    name: 'loader',
    version: '2.5.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        // Install marker keyed by a global Symbol — independent of app.$loader,
        // so re-assigning app.$loader elsewhere can't false-trip the guard.
        const INSTALL_MARK = Symbol.for('helix.loader.installed');
        if (app[INSTALL_MARK]) {
            console.warn('[Helix Loader] already installed on this app; skipping.');
            return () => {};
        }

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
            allowHtmlIcon: false,   // install-only opt-in for raw-HTML string icons
            debug: false
        };

        function normalizeFade(f) {
            if (Array.isArray(f)) {
                const i = Number.isFinite(f[0]) ? f[0] : 300;
                const o = Number.isFinite(f[1]) ? f[1] : i;
                return [i, o];
            }
            if (Number.isFinite(f)) return [f, f];
            return [300, 200];
        }

        const themeConfig = themes[options.theme || defaults.theme] || themes.glass;
        const globalConfig = { ...defaults, ...themeConfig, ...options };
        globalConfig.fade = normalizeFade(globalConfig.fade);

        // HTML-injection switch: install options ONLY, never cfg/attribute.
        const HTML_ICON_ALLOWED = globalConfig.allowHtmlIcon === true;

        function log(...args) {
            if (globalConfig.debug) console.log('[Helix Loader]', ...args);
        }

        let warnedHtmlDowngrade = false;

        // ==========================================
        // CSS  (shared across installs → ref-counted)
        // ==========================================
        const styleId = 'hx-loader-styles';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.dataset.hxRefcount = '0';
            styleEl.innerHTML = `
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
            document.head.appendChild(styleEl);
        }
        // claim a reference for this install
        styleEl.dataset.hxRefcount =
            String((parseInt(styleEl.dataset.hxRefcount, 10) || 0) + 1);

        // ==========================================
        // ICON BUILDER
        // ==========================================
        function buildIcon(cfg, allowHtml = false) {
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
            else if (typeof cfg.icon === 'string') {
                if (allowHtml) {
                    wrap.innerHTML = cfg.icon;   // dev opted in via allowHtmlIcon
                } else {
                    wrap.textContent = cfg.icon;
                    if (!warnedHtmlDowngrade) {
                        warnedHtmlDowngrade = true;
                        console.warn('[Helix Loader] string icon rendered as text. ' +
                            'For markup use icon: () => HTMLElement, or set the ' +
                            'install option allowHtmlIcon:true for raw-HTML strings.');
                    }
                }
            }
            return wrap;
        }

        // ==========================================
        // OVERLAY FACTORY
        // ==========================================
        function buildOverlay(cfg, { scoped = false, allowHtmlIcon = false } = {}) {
            const fade = normalizeFade(cfg.fade);

            const el = document.createElement('div');
            el.style.cssText = `
                position:${scoped ? 'absolute' : 'fixed'}; inset:0; display:none;
                align-items:center; justify-content:center;
                background:${cfg.background};
                ${cfg.blur ? `backdrop-filter: blur(${cfg.blurAmount}px); -webkit-backdrop-filter: blur(${cfg.blurAmount}px);` : ''}
                z-index:${cfg.zIndex};
                opacity:0;
                transition: opacity ${fade[0]}ms ease;
            `;

            const container = document.createElement('div');
            container.style.cssText = `
                display:flex; flex-direction:${cfg.direction};
                align-items:center; gap:${cfg.gap};
            `;
            container.appendChild(buildIcon(cfg, allowHtmlIcon));

            let textEl = null;
            if (!scoped) {
                textEl = document.createElement('div');
                textEl.style.color = cfg.textColor;
                textEl.style.fontSize = '14px';
                textEl.style.fontFamily = 'system-ui, sans-serif';
                container.appendChild(textEl);
            }

            el.appendChild(container);
            return { el, container, textEl };
        }

        function appendToBody(node) {
            if (document.body) {
                document.body.appendChild(node);
            } else {
                document.addEventListener('DOMContentLoaded',
                    () => document.body && document.body.appendChild(node),
                    { once: true });
            }
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
        const { el: overlay, textEl } = buildOverlay(globalConfig, {
            scoped: false,
            allowHtmlIcon: HTML_ICON_ALLOWED
        });
        overlay.id = 'hx-loader-overlay';
        appendToBody(overlay);
        log('Overlay queued for body');

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
        // PUBLIC API  (reference-counted, race-safe)
        // ==========================================
        let hideTimer = null;

        const $loader = {
            show(text) {
                if (text !== undefined) state.text = text;
                state.count++;
                log('show(), count =', state.count);
                if (state.count === 1) {
                    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                    overlay.style.transition = `opacity ${globalConfig.fade[0]}ms ease`;
                    state.active = true;
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        if (state.count > 0) state.visible = true;
                    }));
                }
            },

            hide(force = false) {
                state.count = force ? 0 : Math.max(0, state.count - 1);
                log('hide(), count =', state.count);
                if (state.count === 0) {
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
        const directiveCleanups   = new WeakMap();
        const directiveUpdaters    = new WeakMap();
        const directiveEffects     = new Set();
        const allDirectiveCleanups = new Set();

        app.directive('loading', {
            mounted(el, binding) {
                // Restore-aware host positioning: only patch when needed, and
                // remember the prior INLINE value so unmount can revert exactly.
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

                // Never let a per-element attribute carry the HTML switch into cfg.
                if ('allowHtmlIcon' in localConfig) delete localConfig.allowHtmlIcon;

                const localTheme = themes[localConfig.theme || globalConfig.theme] || {};
                const cfg = { ...defaults, ...globalConfig, ...localTheme, ...localConfig };
                cfg.fade = normalizeFade(cfg.fade);
                const [fadeIn, fadeOut] = cfg.fade;

                // HTML allowed only if dev opted in AND icon wasn't attr-overridden.
                const iconFromAttr = Object.prototype.hasOwnProperty.call(localConfig, 'icon');
                const allowHtmlIcon = HTML_ICON_ALLOWED && !iconFromAttr;

                const { el: localOverlay } = buildOverlay(cfg, { scoped: true, allowHtmlIcon });
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
                        // reflow boundary: commits opacity:0 (and any prior
                        // transition:none from an instant hide) before we
                        // re-enable the transition, so the fade-in animates.
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
                    localOverlay.remove();
                    // revert the host position exactly to its prior inline value
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
                state: $loader.state
            });
        }

        app.$loader = $loader;          // public API (separate from install marker)
        app[INSTALL_MARK] = true;       // guard marker

        if (app.provide) {
            app.provide('$loader', $loader);
        }

        log('Plugin installed.');

        // ==========================================
        // CLEANUP LIFECYCLE
        // ==========================================
        return () => {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

            if (displayEffect && displayEffect.stop) displayEffect.stop();
            if (opacityEffect && opacityEffect.stop) opacityEffect.stop();
            if (textEffect && textEffect.stop) textEffect.stop();

            // run remaining directive cleanups (timers, effects, overlays,
            // host-position restore)
            Array.from(allDirectiveCleanups).forEach(fn => fn());
            allDirectiveCleanups.clear();

            directiveEffects.forEach(e => { if (e && e.stop) e.stop(); });
            directiveEffects.clear();

            overlay.remove();

            // release our stylesheet reference; remove only when last out
            const s = document.getElementById(styleId);
            if (s) {
                const n = (parseInt(s.dataset.hxRefcount, 10) || 1) - 1;
                if (n <= 0) s.remove();
                else s.dataset.hxRefcount = String(n);
            }

            if (app.removeDirective) app.removeDirective('loading');
            if (app.removeNamespace) app.removeNamespace('loader');
            if (app.$loader === $loader) delete app.$loader;
            delete app[INSTALL_MARK];

            state.count = 0;
            state.active = false;
            state.visible = false;

            log('Cleanup complete');
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelixLoaderPlugin;
}