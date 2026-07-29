this.HelixTooltipPlugin = function() {
  "use strict";
  const PLACEMENTS = ["top", "bottom", "left", "right"];
  const FALLBACK_CHAINS = {
    top: ["top", "bottom", "right", "left"],
    bottom: ["bottom", "top", "right", "left"],
    left: ["left", "right", "top", "bottom"],
    right: ["right", "left", "top", "bottom"]
  };
  const DEFAULT_OPTIONS = {
    placement: "top",
    theme: "dark",
    animation: "zoom",
    showDelay: 100,
    hideDelay: 60,
    offset: 8,
    viewportPadding: 8,
    maxWidth: 240,
    arrow: true,
    zIndex: 9999,
    appendTo: "body",
    closeOnClickOutside: true,
    closeOnEscape: true,
    longPressDelay: 450,
    sanitize: null,
    liveTracking: false,
    ariaLive: false
  };
  const PATH_LIKE_RE = /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
  const EXPRESSION_HINT_RE = /\?\.|\?\?|\|\||&&|===|!==|=>|\(\)/;
  const OBJECT_LITERAL_RE = /^\{[\s\S]*\}$/;
  const FUNCTION_CALL_RE = /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\(([\s\S]*)\)$/;
  const TRIGGER_WORDS = ["hover", "click", "focus", "manual"];
  const ANIMATION_WORDS = ["fade", "zoom", "slide", "flip"];
  const styleId = "hx-tooltip-styles";
  let styleRefs = 0;
  function injectStyles(zIndex, maxWidth) {
    let existingStyle = document.getElementById(styleId);
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
            .hx-tooltip {
                position: fixed;
                top: 0; left: 0;
                z-index: ${zIndex};
                width: max-content;
                max-width: ${maxWidth}px;
                padding: var(--hx-tooltip-padding, 6px 10px);
                font: inherit;
                font-size: 13px;
                line-height: 1.4;
                border-radius: var(--hx-tooltip-radius, 6px);
                background: var(--hx-tooltip-bg, #1f2937);
                color: var(--hx-tooltip-fg, #f9fafb);
                box-shadow: var(--hx-tooltip-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.14s ease, transform 0.14s ease;
                will-change: transform, opacity;
            }
            .hx-tooltip.hx-tooltip-visible { opacity: 1; }
            .hx-tooltip-interactive { pointer-events: auto; }

            /* Built-in themes are just two pre-set values for the same custom
               properties a .theme-<name> class would define — no special-casing. */
            .hx-tooltip-dark { --hx-tooltip-bg: #1f2937; --hx-tooltip-fg: #f9fafb; }
            .hx-tooltip-light {
                --hx-tooltip-bg: #ffffff;
                --hx-tooltip-fg: #1f2937;
                border: 1px solid var(--hx-tooltip-border, #e5e7eb);
            }
            /* .theme-<name> modifier -> .hx-tooltip-<name>: define the vars above yourself. */

            /* ----- Built-in animation variants (transform only; position uses left/top) ----- */
            .hx-tooltip-anim-fade { transform: none; }
            .hx-tooltip-anim-zoom { transform: scale(0.94); }
            .hx-tooltip-anim-zoom.hx-tooltip-visible { transform: scale(1); }
            .hx-tooltip-anim-slide[data-placement="top"] { transform: translateY(6px); }
            .hx-tooltip-anim-slide[data-placement="bottom"] { transform: translateY(-6px); }
            .hx-tooltip-anim-slide[data-placement="left"] { transform: translateX(6px); }
            .hx-tooltip-anim-slide[data-placement="right"] { transform: translateX(-6px); }
            .hx-tooltip-anim-slide.hx-tooltip-visible { transform: translate(0, 0); }
            .hx-tooltip-anim-flip { transform: perspective(400px) rotateX(-90deg); }
            .hx-tooltip-anim-flip.hx-tooltip-visible { transform: perspective(400px) rotateX(0deg); }
            /* .anim-<name> modifier -> .hx-tooltip-anim-<name>: bring your own CSS. */

            .hx-tooltip-arrow {
                position: absolute;
                width: 8px;
                height: 8px;
                background: var(--hx-tooltip-bg, #1f2937);
                transform: rotate(45deg);
            }
            .hx-tooltip-light .hx-tooltip-arrow { border: 1px solid var(--hx-tooltip-border, #e5e7eb); }
            .hx-tooltip[data-placement="top"] .hx-tooltip-arrow { bottom: -4px; box-shadow: none; }
            .hx-tooltip[data-placement="bottom"] .hx-tooltip-arrow { top: -4px; }
            .hx-tooltip[data-placement="left"] .hx-tooltip-arrow { right: -4px; }
            .hx-tooltip[data-placement="right"] .hx-tooltip-arrow { left: -4px; }
            .hx-tooltip-no-arrow .hx-tooltip-arrow { display: none; }

            .hx-tooltip-content img { max-width: 100%; display: block; }
        `;
      document.head.appendChild(style);
    }
    styleRefs += 1;
  }
  function releaseStyles() {
    styleRefs = Math.max(0, styleRefs - 1);
    if (styleRefs === 0) {
      const styleEl = document.getElementById(styleId);
      if (styleEl)
        styleEl.remove();
    }
  }
  function coordsFor(rect, tipRect, placement, offset) {
    let top, left;
    if (placement === "top") {
      top = rect.top - tipRect.height - offset;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else if (placement === "bottom") {
      top = rect.bottom + offset;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - offset;
    } else {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + offset;
    }
    return { top, left };
  }
  function fitsViewport(top, left, tipRect, viewportPadding) {
    const pad = viewportPadding;
    return top >= pad && left >= pad && top + tipRect.height <= window.innerHeight - pad && left + tipRect.width <= window.innerWidth - pad;
  }
  function visibleArea(top, left, tipRect) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const visW = Math.max(0, Math.min(left + tipRect.width, vw) - Math.max(left, 0));
    const visH = Math.max(0, Math.min(top + tipRect.height, vh) - Math.max(top, 0));
    return visW * visH;
  }
  function middlewareFlip(ctx) {
    const chain = FALLBACK_CHAINS[ctx.placement] || FALLBACK_CHAINS.top;
    for (const p of chain) {
      const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
      if (fitsViewport(top, left, ctx.tipRect, ctx.viewportPadding)) {
        ctx.placement = p;
        return ctx;
      }
    }
    let best = chain[0], bestArea = -1;
    for (const p of chain) {
      const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
      const area = visibleArea(top, left, ctx.tipRect);
      if (area > bestArea) {
        bestArea = area;
        best = p;
      }
    }
    ctx.placement = best;
    return ctx;
  }
  function middlewareOffset(ctx) {
    const { top, left } = coordsFor(ctx.rect, ctx.tipRect, ctx.placement, ctx.offset);
    ctx.top = top;
    ctx.left = left;
    return ctx;
  }
  function middlewareShift(ctx) {
    const pad = ctx.viewportPadding;
    const vw = window.innerWidth, vh = window.innerHeight;
    ctx.left = Math.min(Math.max(ctx.left, pad), vw - ctx.tipRect.width - pad);
    ctx.top = Math.min(Math.max(ctx.top, pad), vh - ctx.tipRect.height - pad);
    return ctx;
  }
  function middlewareArrow(ctx) {
    if (!ctx.arrowEnabled) {
      ctx.arrow = null;
      return ctx;
    }
    const ARROW_HALF = 4;
    const MIN_INSET = 6;
    if (ctx.placement === "top" || ctx.placement === "bottom") {
      const anchorCenterX = ctx.rect.left + ctx.rect.width / 2;
      let value = anchorCenterX - ctx.left - ARROW_HALF;
      value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.width - MIN_INSET - ARROW_HALF * 2);
      ctx.arrow = { axis: "x", value };
    } else {
      const anchorCenterY = ctx.rect.top + ctx.rect.height / 2;
      let value = anchorCenterY - ctx.top - ARROW_HALF;
      value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.height - MIN_INSET - ARROW_HALF * 2);
      ctx.arrow = { axis: "y", value };
    }
    return ctx;
  }
  const POSITION_MIDDLEWARE = [middlewareFlip, middlewareOffset, middlewareShift, middlewareArrow];
  function computePosition(rect, tipRect, preferredPlacement, config) {
    let ctx = {
      rect,
      tipRect,
      placement: preferredPlacement,
      offset: config.offset,
      arrowEnabled: config.arrowEnabled,
      viewportPadding: config.viewportPadding,
      top: 0,
      left: 0,
      arrow: null
    };
    for (const fn of POSITION_MIDDLEWARE)
      ctx = fn(ctx);
    return ctx;
  }
  function computeFollowPosition(x, y, tipRect, viewportPadding, followOffset = 14) {
    const pad = viewportPadding;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(x + followOffset, pad), vw - tipRect.width - pad);
    const top = Math.min(Math.max(y + followOffset, pad), vh - tipRect.height - pad);
    return { top, left };
  }
  function splitTopLevel(str, delimiter) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = "";
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (quote) {
        current += ch;
        if (ch === quote && str[i - 1] !== "\\")
          quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === "{" || ch === "[" || ch === "(") {
        depth++;
        current += ch;
        continue;
      }
      if (ch === "}" || ch === "]" || ch === ")") {
        depth--;
        current += ch;
        continue;
      }
      if (ch === delimiter && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim() !== "")
      parts.push(current);
    return parts;
  }
  function findTopLevelColon(str) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (quote) {
        if (ch === quote && str[i - 1] !== "\\")
          quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "{" || ch === "[" || ch === "(") {
        depth++;
        continue;
      }
      if (ch === "}" || ch === "]" || ch === ")") {
        depth--;
        continue;
      }
      if (ch === ":" && depth === 0)
        return i;
    }
    return -1;
  }
  function parseObjectLiteral(trimmed) {
    const inner = trimmed.slice(1, -1);
    const out = {};
    for (const rawPair of splitTopLevel(inner, ",")) {
      const pair = rawPair.trim();
      if (!pair)
        continue;
      const colonIdx = findTopLevelColon(pair);
      if (colonIdx === -1)
        return null;
      let key = pair.slice(0, colonIdx).trim();
      if (key.startsWith("'") && key.endsWith("'") || key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
      }
      if (!/^[a-zA-Z_$][\w$]*$/.test(key))
        return null;
      out[key] = pair.slice(colonIdx + 1).trim();
    }
    return out;
  }
  function resolveContent(app, rawVal, ctx, el) {
    const trimmed = (rawVal || "").trim();
    const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
    const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
    if (isSingleQuoted || isDoubleQuoted)
      return trimmed.slice(1, -1);
    if (PATH_LIKE_RE.test(trimmed)) {
      const resolved = app.resolvePath(trimmed, ctx);
      return resolved === void 0 ? "" : resolved;
    }
    if (EXPRESSION_HINT_RE.test(trimmed)) {
      console.warn(
        `[Helix.js][$tooltip] hx-tooltip does not evaluate expressions, only a quoted literal or a plain ctx path is supported. Got: "${trimmed}"` + (el && el.tagName ? ` on <${el.tagName.toLowerCase()}>` : "") + `. Rendering empty instead of the literal expression text.`
      );
      return "";
    }
    return trimmed;
  }
  function resolveScalarValue(app, raw, ctx, el, key) {
    const trimmed = (raw || "").trim();
    const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
    const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
    if (isSingleQuoted || isDoubleQuoted)
      return trimmed.slice(1, -1);
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed))
      return Number(trimmed);
    if (trimmed === "true")
      return true;
    if (trimmed === "false")
      return false;
    if (trimmed === "null" || trimmed === "undefined")
      return null;
    if (PATH_LIKE_RE.test(trimmed)) {
      const resolved = app.resolvePath(trimmed, ctx);
      return resolved === void 0 ? null : resolved;
    }
    console.warn(
      `[Helix.js][$tooltip] Unsupported value for "${key}" in hx-tooltip object config: "${trimmed}". Use a quoted string, number, true/false, null, or a plain ctx path.` + (el && el.tagName ? ` (on <${el.tagName.toLowerCase()}>)` : "")
    );
    return null;
  }
  function resolveCallArgs(app, rawArgs, ctx, el) {
    const trimmed = (rawArgs || "").trim();
    if (!trimmed)
      return [];
    return splitTopLevel(trimmed, ",").map((rawArg) => {
      const a = rawArg.trim();
      if (a === "$event") {
        return { type: "tooltip", target: el, currentTarget: el, preventDefault() {
        }, stopPropagation() {
        } };
      }
      return resolveScalarValue(app, a, ctx, el, "argument");
    });
  }
  function parseNumberModifier(modifiers, prefix) {
    for (const m of modifiers) {
      if (m.startsWith(prefix)) {
        const n = parseInt(m.slice(prefix.length), 10);
        if (Number.isFinite(n))
          return n;
      }
    }
    return null;
  }
  function parsePrefixedModifier(modifiers, prefix) {
    const m = modifiers.find((x) => x.startsWith(prefix));
    return m ? m.slice(prefix.length) : null;
  }
  function applyAsyncResult(state, el, result, updateTooltip) {
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (result.title !== void 0)
        state.content = result.title;
      else if (result.content !== void 0)
        state.content = result.content;
      else {
        console.warn('[Helix.js][$tooltip] async hx-tooltip result has no "title" or "content" key.');
        state.content = "";
      }
      if (result.html !== void 0)
        state.html = !!result.html;
      if (result.placement !== void 0)
        state.placement = result.placement;
      if (result.theme !== void 0)
        state.theme = result.theme;
      if (result.animation !== void 0)
        state.animation = result.animation;
      if (result.interactive !== void 0)
        state.interactive = !!result.interactive;
    } else {
      state.content = result == null ? "" : result;
    }
    updateTooltip(el, state.content);
  }
  function tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip) {
    const trimmed = (contentRaw || "").trim();
    const match = trimmed.match(FUNCTION_CALL_RE);
    if (!match)
      return false;
    const fnPath = match[1];
    const rawArgs = match[2];
    const fn = app.resolvePath(fnPath, ctx);
    if (typeof fn !== "function") {
      console.warn(`[Helix.js][$tooltip] hx-tooltip could not find a function at "${fnPath}" for the call "${trimmed}".`);
      state.content = "";
      return true;
    }
    const args = resolveCallArgs(app, rawArgs, ctx, el);
    let destroyed = false;
    trackCleanup(() => {
      destroyed = true;
    });
    Promise.resolve().then(() => fn.apply(ctx, args)).then((result) => {
      if (destroyed)
        return;
      applyAsyncResult(state, el, result, updateTooltip);
    }).catch((err) => {
      if (destroyed)
        return;
      console.error(`[Helix.js][$tooltip] async hx-tooltip call "${trimmed}" failed:`, err);
      state.content = "";
      updateTooltip(el, state.content);
    });
    return true;
  }
  let __hxTooltipInstanceSeq = 0;
  const HelixTooltipPlugin = {
    name: "tooltip",
    version: "1.7.0",
    requires: {
      helix: ">=11.1.5"
    },
    install(app, options = {}) {
      if (app.$tooltip && typeof app.$tooltip.setDefaults === "function") {
        app.$tooltip.setDefaults(options);
        return;
      }
      if (typeof document === "undefined") {
        console.error("[Helix.js][$tooltip] DOM is required. This plugin cannot run outside a browser.");
        return () => {
        };
      }
      const instanceId = ++__hxTooltipInstanceSeq;
      const dirPrefix = app.config && typeof app.config.prefix === "string" && app.config.prefix || "hx-";
      const tooltipElId = `${dirPrefix}tooltip-${instanceId}`;
      let isDestroyed = false;
      function warnDestroyed(method) {
        console.warn(`[Helix.js][$tooltip] Ignored ${method}() call after destroy().`);
      }
      const defaults = { ...DEFAULT_OPTIONS, ...options };
      function validateDefaults() {
        if (!PLACEMENTS.includes(defaults.placement))
          defaults.placement = "top";
        if (typeof defaults.theme !== "string" || !defaults.theme)
          defaults.theme = "dark";
        if (typeof defaults.animation !== "string" || !defaults.animation)
          defaults.animation = "zoom";
      }
      validateDefaults();
      const container = document.querySelector(defaults.appendTo) || document.body;
      injectStyles(defaults.zIndex, defaults.maxWidth);
      let tooltipEl = null;
      let contentEl = null;
      let arrowEl = null;
      let lastAnimClass = null;
      let lastThemeClass = null;
      let lastCustomClassName = null;
      let tooltipResizeObserver = null;
      function ensureTooltipEl() {
        if (isDestroyed)
          return null;
        if (tooltipEl)
          return tooltipEl;
        tooltipEl = document.createElement("div");
        tooltipEl.id = tooltipElId;
        tooltipEl.className = "hx-tooltip";
        tooltipEl.setAttribute("role", "tooltip");
        tooltipEl.setAttribute("aria-hidden", "true");
        if (defaults.ariaLive) {
          tooltipEl.setAttribute("aria-live", defaults.ariaLive === true ? "polite" : defaults.ariaLive);
        }
        contentEl = document.createElement("div");
        contentEl.className = "hx-tooltip-content";
        arrowEl = document.createElement("div");
        arrowEl.className = "hx-tooltip-arrow";
        tooltipEl.appendChild(contentEl);
        tooltipEl.appendChild(arrowEl);
        container.appendChild(tooltipEl);
        tooltipEl.addEventListener("mouseenter", () => {
          if (tooltipEl.classList.contains("hx-tooltip-interactive"))
            clearTimers();
        });
        tooltipEl.addEventListener("mouseleave", () => {
          if (tooltipEl.classList.contains("hx-tooltip-interactive"))
            hideTooltip();
        });
        if (typeof ResizeObserver !== "undefined") {
          tooltipResizeObserver = new ResizeObserver(() => scheduleReposition());
          tooltipResizeObserver.observe(tooltipEl);
        }
        return tooltipEl;
      }
      let activeEl = null;
      let activePlacement = defaults.placement;
      let followMode = false;
      let activeOverrides = { offset: defaults.offset, arrow: defaults.arrow };
      function applyArrow(arrow) {
        if (!arrowEl)
          return;
        if (!arrow) {
          arrowEl.style.left = "";
          arrowEl.style.top = "";
          return;
        }
        if (arrow.axis === "x") {
          arrowEl.style.left = `${arrow.value}px`;
          arrowEl.style.top = "";
        } else {
          arrowEl.style.top = `${arrow.value}px`;
          arrowEl.style.left = "";
        }
      }
      function positionTooltip() {
        if (followMode)
          return;
        if (!activeEl || !tooltipEl || !document.body.contains(activeEl))
          return;
        const rect = activeEl.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();
        const { placement, top, left, arrow } = computePosition(rect, tipRect, activePlacement, {
          offset: activeOverrides.offset,
          arrowEnabled: activeOverrides.arrow,
          viewportPadding: defaults.viewportPadding
        });
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
        if (tooltipEl.dataset.placement !== placement)
          tooltipEl.dataset.placement = placement;
        applyArrow(arrow);
      }
      function positionFollow(x, y) {
        if (!tooltipEl)
          return;
        const tipRect = tooltipEl.getBoundingClientRect();
        const { top, left } = computeFollowPosition(x, y, tipRect, defaults.viewportPadding);
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
      }
      let repositionRaf = null;
      function scheduleReposition() {
        if (followMode)
          return;
        if (repositionRaf)
          return;
        repositionRaf = requestAnimationFrame(() => {
          repositionRaf = null;
          positionTooltip();
        });
      }
      window.addEventListener("scroll", scheduleReposition, true);
      window.addEventListener("resize", scheduleReposition);
      let anchorResizeObserver = null;
      if (typeof ResizeObserver !== "undefined") {
        anchorResizeObserver = new ResizeObserver(() => scheduleReposition());
      }
      let liveTrackRaf = null;
      let liveTrackIntersectionObserver = null;
      let anchorIntersecting = true;
      function onVisibilityChange() {
        if (typeof document.hidden === "undefined")
          return;
        if (document.hidden) {
          if (liveTrackRaf) {
            cancelAnimationFrame(liveTrackRaf);
            liveTrackRaf = null;
          }
        } else if (defaults.liveTracking && activeEl && !followMode && !liveTrackRaf) {
          runLiveTrackLoop();
        }
      }
      document.addEventListener("visibilitychange", onVisibilityChange);
      function runLiveTrackLoop() {
        const loop = () => {
          if (!activeEl) {
            liveTrackRaf = null;
            return;
          }
          if (anchorIntersecting && !document.hidden)
            positionTooltip();
          liveTrackRaf = requestAnimationFrame(loop);
        };
        liveTrackRaf = requestAnimationFrame(loop);
      }
      function startLiveTracking() {
        if (!defaults.liveTracking || followMode || !activeEl)
          return;
        anchorIntersecting = true;
        if (typeof IntersectionObserver !== "undefined") {
          liveTrackIntersectionObserver = new IntersectionObserver((entries) => {
            anchorIntersecting = entries[0] ? entries[0].isIntersecting : true;
          });
          liveTrackIntersectionObserver.observe(activeEl);
        }
        runLiveTrackLoop();
      }
      function stopLiveTracking() {
        if (liveTrackRaf) {
          cancelAnimationFrame(liveTrackRaf);
          liveTrackRaf = null;
        }
        if (liveTrackIntersectionObserver) {
          liveTrackIntersectionObserver.disconnect();
          liveTrackIntersectionObserver = null;
        }
        anchorIntersecting = true;
      }
      function onDismissGesture(e) {
        if (!activeEl)
          return;
        if (activeEl.contains(e.target))
          return;
        if (tooltipEl && tooltipEl.contains(e.target))
          return;
        hideTooltip({ immediate: true });
      }
      if (defaults.closeOnClickOutside) {
        document.addEventListener("click", onDismissGesture, true);
        document.addEventListener("touchstart", onDismissGesture, true);
      }
      function onKeydown(e) {
        if (e.key === "Escape" && activeEl)
          hideTooltip({ immediate: true });
      }
      if (defaults.closeOnEscape) {
        document.addEventListener("keydown", onKeydown);
      }
      let showTimer = null;
      let hideTimer = null;
      function clearTimers() {
        if (showTimer) {
          clearTimeout(showTimer);
          showTimer = null;
        }
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      }
      function setContent(content, isHtml, el) {
        const text = content == null ? "" : String(content);
        if (isHtml) {
          contentEl.innerHTML = typeof defaults.sanitize === "function" ? defaults.sanitize(text, { el }) : text;
        } else {
          contentEl.textContent = text;
        }
      }
      function showTooltip(el, content, opts = {}) {
        if (isDestroyed) {
          warnDestroyed("show");
          return;
        }
        if (!el)
          return;
        const st = elState.get(el) || {};
        if (opts.disabled === true || opts.disabled === void 0 && st.disabled)
          return;
        const el_ = ensureTooltipEl();
        if (!el_)
          return;
        clearTimers();
        const theme = opts.theme || st.theme || defaults.theme;
        const placement = opts.placement || st.placement || defaults.placement;
        const animation = opts.animation || st.animation || defaults.animation;
        const isHtml = opts.html !== void 0 ? opts.html : !!st.html;
        const isInteractive = opts.interactive !== void 0 ? opts.interactive : !!st.interactive;
        const isFollow = opts.follow !== void 0 ? opts.follow : !!st.follow;
        const offset = opts.offset ?? (typeof st.offset === "number" ? st.offset : defaults.offset);
        const showArrow = opts.arrow ?? (typeof st.arrow === "boolean" ? st.arrow : defaults.arrow);
        const maxWidth = opts.maxWidth ?? st.maxWidth;
        const className = opts.className ?? st.className ?? null;
        const doShow = () => {
          setContent(content, isHtml, el);
          if (lastThemeClass)
            el_.classList.remove(lastThemeClass);
          const themeClass = `hx-tooltip-${theme}`;
          el_.classList.add(themeClass);
          lastThemeClass = themeClass;
          if (lastAnimClass)
            el_.classList.remove(lastAnimClass);
          const animClass = `hx-tooltip-anim-${animation}`;
          el_.classList.add(animClass);
          lastAnimClass = animClass;
          if (lastCustomClassName)
            el_.classList.remove(lastCustomClassName);
          if (className)
            el_.classList.add(className);
          lastCustomClassName = className;
          el_.style.maxWidth = maxWidth !== void 0 ? typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth : "";
          el_.classList.toggle("hx-tooltip-interactive", isInteractive);
          el_.classList.toggle("hx-tooltip-no-arrow", !showArrow || isFollow);
          el_.setAttribute("aria-hidden", "false");
          el.setAttribute("aria-describedby", el_.id);
          if (anchorResizeObserver)
            anchorResizeObserver.disconnect();
          if (anchorResizeObserver && !isFollow)
            anchorResizeObserver.observe(el);
          activeEl = el;
          activePlacement = placement;
          followMode = isFollow;
          activeOverrides = { offset, arrow: showArrow };
          if (isFollow && opts.followPos) {
            positionFollow(opts.followPos.x, opts.followPos.y);
          } else {
            positionTooltip();
          }
          requestAnimationFrame(() => el_.classList.add("hx-tooltip-visible"));
          startLiveTracking();
        };
        const delay = opts.delay ?? st.showDelay ?? defaults.showDelay;
        if (delay > 0)
          showTimer = setTimeout(doShow, delay);
        else
          doShow();
      }
      function hideTooltip(opts = {}) {
        clearTimers();
        const doHide = () => {
          if (tooltipEl) {
            tooltipEl.classList.remove("hx-tooltip-visible");
            tooltipEl.setAttribute("aria-hidden", "true");
          }
          if (activeEl)
            activeEl.removeAttribute("aria-describedby");
          if (anchorResizeObserver)
            anchorResizeObserver.disconnect();
          stopLiveTracking();
          activeEl = null;
          followMode = false;
        };
        const st = activeEl ? elState.get(activeEl) || {} : {};
        const delay = opts.immediate ? 0 : opts.delay ?? st.hideDelay ?? defaults.hideDelay;
        if (delay > 0)
          hideTimer = setTimeout(doHide, delay);
        else
          doHide();
      }
      function updateTooltip(el, content) {
        if (activeEl === el && contentEl) {
          const st = elState.get(el) || {};
          setContent(content, !!st.html, el);
          scheduleReposition();
        }
      }
      const elState = /* @__PURE__ */ new WeakMap();
      function findAnchor(target) {
        let node = target;
        while (node) {
          if (elState.has(node))
            return node;
          node = node.parentNode;
        }
        return null;
      }
      app.directive("tooltip", {
        mounted(el, binding) {
          const { value: val, arg, modifiers, ctx, trackCleanup } = binding;
          const trimmedVal = (val || "").trim();
          let objectConfig = null;
          let contentRaw = val;
          if (OBJECT_LITERAL_RE.test(trimmedVal)) {
            objectConfig = parseObjectLiteral(trimmedVal);
            if (objectConfig === null) {
              console.warn(`[Helix.js][$tooltip] hx-tooltip value looks like an object but couldn't be parsed: "${trimmedVal}". Rendering empty.`);
              contentRaw = "''";
            } else if (objectConfig.title !== void 0) {
              contentRaw = objectConfig.title;
            } else if (objectConfig.content !== void 0) {
              contentRaw = objectConfig.content;
            } else {
              console.warn(`[Helix.js][$tooltip] hx-tooltip object config has no "title" or "content" key: "${trimmedVal}"`);
              contentRaw = "''";
            }
          }
          const cfg = (key) => objectConfig && objectConfig[key] !== void 0 ? resolveScalarValue(app, objectConfig[key], ctx, el, key) : void 0;
          const modifierTrigger = TRIGGER_WORDS.find((t) => modifiers.includes(t));
          const trigger = String(cfg("trigger") ?? (arg || modifierTrigger || "hover")).toLowerCase();
          const placement = cfg("placement") ?? (PLACEMENTS.find((p) => modifiers.includes(p)) || defaults.placement);
          const customTheme = parsePrefixedModifier(modifiers, "theme-");
          const modifierTheme = customTheme || (modifiers.includes("light") ? "light" : modifiers.includes("dark") ? "dark" : defaults.theme);
          const theme = cfg("theme") ?? modifierTheme;
          const customAnim = parsePrefixedModifier(modifiers, "anim-");
          const modifierAnim = customAnim || ANIMATION_WORDS.find((a) => modifiers.includes(a)) || defaults.animation;
          const animation = cfg("animation") ?? modifierAnim;
          const html = cfg("html") ?? modifiers.includes("html");
          const interactive = cfg("interactive") ?? modifiers.includes("interactive");
          const follow = cfg("follow") ?? modifiers.includes("follow");
          const disabled = cfg("disabled") ?? false;
          const className = cfg("className") ?? null;
          const maxWidth = cfg("maxWidth");
          const offset = cfg("offset");
          const showArrow = cfg("showArrow") ?? cfg("arrow");
          const delayBoth = cfg("delay") ?? parseNumberModifier(modifiers, "delay-");
          const showDelay = cfg("showDelay") ?? parseNumberModifier(modifiers, "show-") ?? delayBoth ?? defaults.showDelay;
          const hideDelay = cfg("hideDelay") ?? parseNumberModifier(modifiers, "hide-") ?? delayBoth ?? defaults.hideDelay;
          const state = {
            trigger,
            placement,
            theme,
            animation,
            html,
            interactive,
            follow,
            showDelay,
            hideDelay,
            disabled,
            className,
            maxWidth,
            offset,
            arrow: showArrow,
            content: "",
            longPressTimer: null
          };
          elState.set(el, state);
          if (!tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip)) {
            const stopWatch = app.watchEffect(() => {
              state.content = resolveContent(app, contentRaw, ctx, el);
              updateTooltip(el, state.content);
            });
            trackCleanup(stopWatch);
          }
        },
        unmounted(el) {
          if (activeEl === el)
            hideTooltip({ immediate: true });
          const st = elState.get(el);
          if (st && st.longPressTimer)
            clearTimeout(st.longPressTimer);
          elState.delete(el);
        }
      });
      function delegatedPointerOver(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "hover")
          return;
        if (e.relatedTarget && anchor.contains(e.relatedTarget))
          return;
        showTooltip(anchor, st.content);
      }
      function delegatedPointerOut(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "hover")
          return;
        if (e.relatedTarget && anchor.contains(e.relatedTarget))
          return;
        hideTooltip();
      }
      function delegatedFocusIn(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "hover" && st.trigger !== "focus")
          return;
        showTooltip(anchor, st.content);
      }
      function delegatedFocusOut(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "hover" && st.trigger !== "focus")
          return;
        hideTooltip({ immediate: true });
      }
      function delegatedClick(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "click")
          return;
        if (activeEl === anchor)
          hideTooltip({ immediate: true });
        else
          showTooltip(anchor, st.content, { delay: 0 });
      }
      function delegatedTouchStart(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (!st || st.trigger !== "hover")
          return;
        st.longPressTimer = setTimeout(() => showTooltip(anchor, st.content, { delay: 0 }), defaults.longPressDelay);
      }
      function delegatedTouchEndOrMove(e) {
        const anchor = findAnchor(e.target);
        if (!anchor)
          return;
        const st = elState.get(anchor);
        if (st && st.longPressTimer) {
          clearTimeout(st.longPressTimer);
          st.longPressTimer = null;
        }
      }
      function delegatedPointerMove(e) {
        if (!activeEl || !followMode)
          return;
        if (!activeEl.contains(e.target))
          return;
        positionFollow(e.clientX, e.clientY);
      }
      document.addEventListener("mouseover", delegatedPointerOver);
      document.addEventListener("mouseout", delegatedPointerOut);
      document.addEventListener("focusin", delegatedFocusIn);
      document.addEventListener("focusout", delegatedFocusOut);
      document.addEventListener("click", delegatedClick);
      document.addEventListener("touchstart", delegatedTouchStart, { passive: true });
      document.addEventListener("touchend", delegatedTouchEndOrMove);
      document.addEventListener("touchmove", delegatedTouchEndOrMove);
      document.addEventListener("pointermove", delegatedPointerMove);
      const $tooltip = {
        show(el, content, opts = {}) {
          const state = elState.get(el) || {};
          if (content !== void 0)
            state.content = content;
          elState.set(el, state);
          showTooltip(el, content !== void 0 ? content : state.content, opts);
        },
        hide(opts = {}) {
          if (isDestroyed) {
            warnDestroyed("hide");
            return;
          }
          hideTooltip(opts);
        },
        toggle(el, content, opts = {}) {
          if (isDestroyed) {
            warnDestroyed("toggle");
            return;
          }
          if (activeEl === el)
            hideTooltip({ immediate: true });
          else
            $tooltip.show(el, content, opts);
        },
        hideAll() {
          if (isDestroyed) {
            warnDestroyed("hideAll");
            return;
          }
          hideTooltip({ immediate: true });
        },
        update(el, content) {
          if (isDestroyed) {
            warnDestroyed("update");
            return;
          }
          const state = elState.get(el);
          if (state)
            state.content = content;
          updateTooltip(el, content);
        },
        isVisible(el) {
          return !isDestroyed && activeEl === el && !!tooltipEl && tooltipEl.classList.contains("hx-tooltip-visible");
        },
        setDefaults(patch = {}) {
          if (isDestroyed) {
            warnDestroyed("setDefaults");
            return;
          }
          Object.assign(defaults, patch);
          validateDefaults();
        },
        destroy() {
          pluginCleanup();
        },
        raw: () => tooltipEl
      };
      app.namespace("tooltip", {
        $tooltip,
        show: $tooltip.show,
        hide: $tooltip.hide,
        toggle: $tooltip.toggle,
        hideAll: $tooltip.hideAll,
        update: $tooltip.update,
        isVisible: $tooltip.isVisible,
        setDefaults: $tooltip.setDefaults
      });
      app.$tooltip = $tooltip;
      if (app.provide) {
        app.provide("$tooltip", $tooltip);
      }
      function pluginCleanup() {
        if (isDestroyed)
          return;
        isDestroyed = true;
        clearTimers();
        stopLiveTracking();
        if (repositionRaf) {
          cancelAnimationFrame(repositionRaf);
          repositionRaf = null;
        }
        window.removeEventListener("scroll", scheduleReposition, true);
        window.removeEventListener("resize", scheduleReposition);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        if (anchorResizeObserver) {
          anchorResizeObserver.disconnect();
          anchorResizeObserver = null;
        }
        if (tooltipResizeObserver) {
          tooltipResizeObserver.disconnect();
          tooltipResizeObserver = null;
        }
        if (defaults.closeOnClickOutside) {
          document.removeEventListener("click", onDismissGesture, true);
          document.removeEventListener("touchstart", onDismissGesture, true);
        }
        if (defaults.closeOnEscape) {
          document.removeEventListener("keydown", onKeydown);
        }
        document.removeEventListener("mouseover", delegatedPointerOver);
        document.removeEventListener("mouseout", delegatedPointerOut);
        document.removeEventListener("focusin", delegatedFocusIn);
        document.removeEventListener("focusout", delegatedFocusOut);
        document.removeEventListener("click", delegatedClick);
        document.removeEventListener("touchstart", delegatedTouchStart, { passive: true });
        document.removeEventListener("touchend", delegatedTouchEndOrMove);
        document.removeEventListener("touchmove", delegatedTouchEndOrMove);
        document.removeEventListener("pointermove", delegatedPointerMove);
        if (tooltipEl) {
          tooltipEl.remove();
          tooltipEl = null;
        }
        releaseStyles();
        activeEl = null;
        followMode = false;
      }
      return pluginCleanup;
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixTooltipPlugin = HelixTooltipPlugin;
  if (root.Helix && typeof root.Helix.directive === "function") {
    HelixTooltipPlugin.install(root.Helix, {});
  }
  return HelixTooltipPlugin;
}();
