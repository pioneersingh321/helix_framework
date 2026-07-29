(function(exports) {
  "use strict";
  const themes = {
    glass: {
      background: "rgba(255, 255, 255, 0.75)",
      blur: true,
      blurAmount: 12,
      textColor: "#1f2937",
      iconColor: "#3b82f6"
    },
    dark: {
      background: "rgba(15, 23, 42, 0.85)",
      blur: true,
      blurAmount: 10,
      textColor: "#f9fafb",
      iconColor: "#10b981"
    },
    light: {
      background: "rgba(248, 250, 252, 0.9)",
      blur: false,
      blurAmount: 0,
      textColor: "#0f172a",
      iconColor: "#4f46e5"
    },
    clinical: {
      background: "rgba(241, 245, 249, 0.95)",
      blur: false,
      blurAmount: 0,
      textColor: "#334155",
      iconColor: "#0d9488"
    },
    ocean: {
      background: "rgba(8, 47, 73, 0.9)",
      blur: true,
      blurAmount: 8,
      textColor: "#f0f9ff",
      iconColor: "#38bdf8"
    },
    emerald: {
      background: "rgba(6, 78, 59, 0.85)",
      blur: true,
      blurAmount: 8,
      textColor: "#ecfdf5",
      iconColor: "#34d399"
    },
    sunset: {
      background: "linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(244, 63, 94, 0.9) 100%)",
      blur: true,
      blurAmount: 6,
      textColor: "#ffffff",
      iconColor: "#ffffff"
    },
    cyberpunk: {
      background: "rgba(3, 7, 18, 0.95)",
      blur: true,
      blurAmount: 12,
      textColor: "#f43f5e",
      iconColor: "#06b6d4"
    }
  };
  const defaults = {
    theme: "glass",
    zIndex: 2147483647,
    fade: [300, 200],
    icon: "spinner",
    iconColor: "#4285F4",
    size: 48,
    text: "",
    gap: "16px",
    direction: "column",
    allowHtmlIcon: false,
    // install-only opt-in for raw-HTML string icons
    debug: false,
    antiFlicker: 150,
    // wait delay in ms to avoid flicker on fast actions
    minDuration: 300,
    // minimum display duration in ms to avoid quick flashing
    // Progress bar customization configurations
    progressWidth: "160px",
    progressHeight: "4px",
    progressBg: "rgba(0, 0, 0, 0.1)",
    progressColor: "",
    // falls back to theme iconColor if blank
    autoHideOnComplete: true,
    autoHideDelay: 250,
    // Performance overlay pooling size limit
    poolSize: 100
  };
  function normalizeFade(f) {
    if (Array.isArray(f)) {
      const i = Number.isFinite(f[0]) ? f[0] : 300;
      const o = Number.isFinite(f[1]) ? f[1] : i;
      return [i, o];
    }
    if (Number.isFinite(f))
      return [f, f];
    return [300, 200];
  }
  const styleId = "hx-loader-styles";
  function setupStyles() {
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.dataset.hxRefcount = "0";
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
    styleEl.dataset.hxRefcount = String((parseInt(styleEl.dataset.hxRefcount, 10) || 0) + 1);
    return styleEl;
  }
  function releaseStyles() {
    const s = document.getElementById(styleId);
    if (s) {
      const n = (parseInt(s.dataset.hxRefcount, 10) || 1) - 1;
      if (n <= 0)
        s.remove();
      else
        s.dataset.hxRefcount = String(n);
    }
  }
  let warnedHtmlDowngrade = false;
  function buildIcon(cfg, allowHtml = false) {
    const wrap = document.createElement("div");
    if (typeof cfg.icon === "function") {
      const el = cfg.icon(cfg);
      if (el instanceof HTMLElement)
        wrap.appendChild(el);
      return wrap;
    }
    wrap.style.color = cfg.iconColor;
    wrap.style.fontSize = cfg.size + "px";
    if (cfg.icon === "spinner") {
      const el = document.createElement("div");
      const border = Math.max(2, cfg.size / 10);
      el.style.width = cfg.size + "px";
      el.style.height = cfg.size + "px";
      el.style.border = `${border}px solid rgba(0,0,0,0.1)`;
      el.style.borderTopColor = cfg.iconColor;
      el.style.borderRadius = "50%";
      el.style.animation = "hx-spin 0.8s linear infinite";
      wrap.appendChild(el);
    } else if (cfg.icon === "dots") {
      wrap.className = "hx-dots";
      wrap.style.setProperty("--hx-color", cfg.iconColor);
      const dot = cfg.size / 4;
      wrap.innerHTML = `<span style="width:${dot}px;height:${dot}px"></span>`.repeat(3);
    } else if (typeof cfg.icon === "string" && (cfg.icon.includes("fa-") || cfg.icon.includes("ri-"))) {
      const i = document.createElement("i");
      i.className = cfg.icon;
      i.style.fontSize = cfg.size + "px";
      wrap.appendChild(i);
    } else if (typeof cfg.icon === "string") {
      if (allowHtml) {
        wrap.innerHTML = cfg.icon;
      } else {
        wrap.textContent = cfg.icon;
        if (!warnedHtmlDowngrade) {
          warnedHtmlDowngrade = true;
          console.warn("[Helix Loader] string icon rendered as text. For markup use icon: () => HTMLElement, or set the install option allowHtmlIcon:true for raw-HTML strings.");
        }
      }
    }
    return wrap;
  }
  function buildOverlay(cfg, { scoped = false, allowHtmlIcon = false } = {}) {
    const fade = normalizeFade(cfg.fade);
    const el = document.createElement("div");
    el.style.cssText = `
        position:${scoped ? "absolute" : "fixed"}; inset:0; display:none;
        align-items:center; justify-content:center;
        background:${cfg.background};
        ${cfg.blur ? `backdrop-filter: blur(${cfg.blurAmount}px); -webkit-backdrop-filter: blur(${cfg.blurAmount}px);` : ""}
        z-index:${cfg.zIndex};
        opacity:0;
        transition: opacity ${fade[0]}ms ease;
    `;
    const container = document.createElement("div");
    container.style.cssText = `
        display:flex; flex-direction:${cfg.direction};
        align-items:center; gap:${cfg.gap};
    `;
    container.appendChild(buildIcon(cfg, allowHtmlIcon));
    let textEl = null;
    if (!scoped) {
      textEl = document.createElement("div");
      textEl.style.color = cfg.textColor;
      textEl.style.fontSize = "14px";
      textEl.style.fontFamily = "system-ui, sans-serif";
      container.appendChild(textEl);
    }
    const progressContainer = document.createElement("div");
    progressContainer.style.cssText = `
        width: ${cfg.progressWidth || "160px"};
        height: ${cfg.progressHeight || "4px"};
        background: ${cfg.progressBg || "rgba(0, 0, 0, 0.1)"};
        border-radius: 2px;
        overflow: hidden;
        display: none;
    `;
    const progressBarColor = cfg.progressColor || cfg.iconColor || "#4285F4";
    const progressBar = document.createElement("div");
    progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: ${progressBarColor};
        transition: width 0.15s ease;
    `;
    progressContainer.appendChild(progressBar);
    container.appendChild(progressContainer);
    el.appendChild(container);
    return { el, container, textEl, progressContainer, progressBar };
  }
  function appendToBody(node) {
    if (document.body) {
      document.body.appendChild(node);
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => document.body && document.body.appendChild(node),
        { once: true }
      );
    }
  }
  const HelixLoaderPlugin = {
    name: "loader",
    version: "2.5.1",
    requires: {
      helix: ">=11.1.5"
    },
    install(app, options = {}) {
      const INSTALL_MARK = Symbol.for("helix.loader.installed");
      if (app[INSTALL_MARK]) {
        console.warn("[Helix Loader] already installed on this app; skipping.");
        return () => {
        };
      }
      const themeConfig = themes[options.theme || defaults.theme] || themes.glass;
      const globalConfig = { ...defaults, ...themeConfig, ...options };
      globalConfig.fade = normalizeFade(globalConfig.fade);
      const HTML_ICON_ALLOWED = globalConfig.allowHtmlIcon === true;
      function log(...args) {
        if (globalConfig.debug)
          console.log("[Helix Loader]", ...args);
      }
      setupStyles();
      const { el: overlay, textEl, progressContainer, progressBar } = buildOverlay(globalConfig, {
        scoped: false,
        allowHtmlIcon: HTML_ICON_ALLOWED
      });
      overlay.id = "hx-loader-overlay";
      appendToBody(overlay);
      log("Overlay queued for body");
      const state = app.reactive({
        count: 0,
        active: false,
        visible: false,
        text: globalConfig.text,
        progress: 0
      });
      const displayEffect = app.effect(() => {
        const display = state.active ? "flex" : "none";
        if (overlay.style.display !== display) {
          overlay.style.display = display;
          log("display →", display);
        }
      });
      const opacityEffect = app.effect(() => {
        const opacity = state.visible ? "1" : "0";
        if (overlay.style.opacity !== opacity) {
          overlay.style.opacity = opacity;
          log("opacity →", opacity);
        }
      });
      const textEffect = app.effect(() => {
        textEl.textContent = state.text;
        textEl.style.display = state.text ? "block" : "none";
      });
      const progressEffect = app.effect(() => {
        const p = state.progress;
        if (p > 0) {
          progressContainer.style.display = "block";
          progressBar.style.width = `${Math.min(100, Math.max(0, p))}%`;
        } else {
          progressContainer.style.display = "none";
          progressBar.style.width = "0%";
        }
      });
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
              item.el.style.backdropFilter = "";
              item.el.style.webkitBackdropFilter = "";
            }
            item.container.innerHTML = "";
            item.container.style.flexDirection = cfg.direction;
            item.container.style.gap = cfg.gap;
            item.container.appendChild(buildIcon(cfg, allowHtmlIcon));
            return item;
          }
          return buildOverlay(cfg, { scoped: true, allowHtmlIcon });
        },
        release(item) {
          item.el.style.opacity = "0";
          item.el.style.display = "none";
          if (item.el.parentNode)
            item.el.remove();
          if (this.pool.length < (globalConfig.poolSize || 100)) {
            this.pool.push(item);
          }
        },
        clear() {
          this.pool = [];
        }
      };
      let flickerTimer = null;
      let minDurationTimer = null;
      let hideTimer = null;
      let shownAt = 0;
      const triggerShow = () => {
        overlay.style.transition = `opacity ${globalConfig.fade[0]}ms ease`;
        state.active = true;
        shownAt = Date.now();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (state.count > 0)
            state.visible = true;
        }));
      };
      const triggerHide = () => {
        const out = globalConfig.fade[1];
        overlay.style.transition = `opacity ${out}ms ease`;
        state.visible = false;
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (out === 0) {
          if (state.count === 0)
            state.active = false;
        } else {
          hideTimer = setTimeout(() => {
            hideTimer = null;
            if (state.count === 0) {
              state.active = false;
              log("active = false (fade complete)");
            }
          }, out);
        }
      };
      const $loader = {
        show(text) {
          if (text !== void 0)
            state.text = text;
          state.count++;
          log("show(), count =", state.count);
          if (state.count === 1) {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
            if (minDurationTimer) {
              clearTimeout(minDurationTimer);
              minDurationTimer = null;
            }
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
          log("hide(), count =", state.count);
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
              if (minDurationTimer)
                clearTimeout(minDurationTimer);
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
          if (val >= 100 && globalConfig.autoHideOnComplete !== false) {
            setTimeout(() => {
              if (state.progress >= 100) {
                $loader.hide();
                state.progress = 0;
              }
            }, globalConfig.autoHideDelay || 250);
          }
        },
        async wrap(fnOrPromise, options2 = {}) {
          const loaderText = options2.text || void 0;
          $loader.show(loaderText);
          try {
            if (typeof fnOrPromise === "function") {
              return await fnOrPromise();
            }
            return await fnOrPromise;
          } finally {
            $loader.hide();
          }
        },
        state
      };
      const directiveCleanups = /* @__PURE__ */ new WeakMap();
      const directiveUpdaters = /* @__PURE__ */ new WeakMap();
      const directiveEffects = /* @__PURE__ */ new Set();
      const allDirectiveCleanups = /* @__PURE__ */ new Set();
      app.directive("loading", {
        mounted(el, binding) {
          let patchedPosition = false;
          const prevInlinePosition = el.style.position;
          if (getComputedStyle(el).position === "static") {
            el.style.position = "relative";
            patchedPosition = true;
          }
          let localConfig = {};
          try {
            const attr = el.getAttribute("hx-loading-config");
            if (attr)
              localConfig = JSON.parse(attr);
          } catch (e) {
            console.warn("[Helix Loader] Invalid hx-loading-config JSON:", e);
          }
          if ("allowHtmlIcon" in localConfig)
            delete localConfig.allowHtmlIcon;
          const localTheme = themes[localConfig.theme || globalConfig.theme] || {};
          const cfg = { ...defaults, ...globalConfig, ...localTheme, ...localConfig };
          cfg.fade = normalizeFade(cfg.fade);
          const [fadeIn, fadeOut] = cfg.fade;
          const iconFromAttr = Object.prototype.hasOwnProperty.call(localConfig, "icon");
          const allowHtmlIcon = HTML_ICON_ALLOWED && !iconFromAttr;
          const poolItem = overlayPool.acquire(cfg, allowHtmlIcon);
          const localOverlay = poolItem.el;
          localOverlay.style.borderRadius = getComputedStyle(el).borderRadius;
          el.appendChild(localOverlay);
          const elState = { binding, lastVal: false, timer: null };
          const resolveVal = () => {
            const b = elState.binding;
            if (typeof b.value === "string" && b.ctx && app.resolvePath) {
              return !!app.resolvePath(b.value, b.ctx);
            }
            return !!b.value;
          };
          const update = () => {
            const val = resolveVal();
            if (val === elState.lastVal)
              return;
            elState.lastVal = val;
            if (val) {
              if (elState.timer) {
                clearTimeout(elState.timer);
                elState.timer = null;
              }
              localOverlay.style.display = "flex";
              void localOverlay.offsetWidth;
              localOverlay.style.transition = `opacity ${fadeIn}ms ease`;
              requestAnimationFrame(() => requestAnimationFrame(() => {
                if (elState.lastVal)
                  localOverlay.style.opacity = "1";
              }));
            } else {
              if (elState.timer) {
                clearTimeout(elState.timer);
                elState.timer = null;
              }
              if (fadeOut === 0) {
                localOverlay.style.transition = "none";
                localOverlay.style.opacity = "0";
                localOverlay.style.display = "none";
              } else {
                localOverlay.style.transition = `opacity ${fadeOut}ms ease`;
                localOverlay.style.opacity = "0";
                elState.timer = setTimeout(() => {
                  elState.timer = null;
                  if (!elState.lastVal)
                    localOverlay.style.display = "none";
                }, fadeOut);
              }
            }
          };
          const dirEffect = app.effect(() => {
            update();
          });
          directiveEffects.add(dirEffect);
          directiveUpdaters.set(el, (b) => {
            elState.binding = b;
            update();
          });
          const cleanup = () => {
            if (elState.timer) {
              clearTimeout(elState.timer);
              elState.timer = null;
            }
            if (dirEffect && dirEffect.stop)
              dirEffect.stop();
            directiveEffects.delete(dirEffect);
            overlayPool.release(poolItem);
            if (patchedPosition)
              el.style.position = prevInlinePosition;
            allDirectiveCleanups.delete(cleanup);
          };
          directiveCleanups.set(el, cleanup);
          allDirectiveCleanups.add(cleanup);
          update();
        },
        updated(el, binding) {
          const u = directiveUpdaters.get(el);
          if (u)
            u(binding);
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
      if (app.namespace) {
        app.namespace("loader", {
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
        app.provide("$loader", $loader);
      }
      log("Plugin installed.");
      return () => {
        if (flickerTimer) {
          clearTimeout(flickerTimer);
          flickerTimer = null;
        }
        if (minDurationTimer) {
          clearTimeout(minDurationTimer);
          minDurationTimer = null;
        }
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (displayEffect && displayEffect.stop)
          displayEffect.stop();
        if (opacityEffect && opacityEffect.stop)
          opacityEffect.stop();
        if (textEffect && textEffect.stop)
          textEffect.stop();
        if (progressEffect && progressEffect.stop)
          progressEffect.stop();
        Array.from(allDirectiveCleanups).forEach((fn) => fn());
        allDirectiveCleanups.clear();
        directiveEffects.forEach((e) => {
          if (e && e.stop)
            e.stop();
        });
        directiveEffects.clear();
        overlayPool.clear();
        overlay.remove();
        releaseStyles();
        if (app.removeDirective)
          app.removeDirective("loading");
        if (app.removeNamespace)
          app.removeNamespace("loader");
        if (app.$loader === $loader)
          delete app.$loader;
        delete app[INSTALL_MARK];
        state.count = 0;
        state.active = false;
        state.visible = false;
        state.progress = 0;
        log("Cleanup complete");
      };
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixLoaderPlugin = HelixLoaderPlugin;
  exports.default = HelixLoaderPlugin;
  exports.defaults = defaults;
  exports.themes = themes;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixLoaderPlugin = this.HelixLoaderPlugin || {});
