import {
    PLACEMENTS, DEFAULT_OPTIONS, OBJECT_LITERAL_RE, TRIGGER_WORDS, ANIMATION_WORDS
} from './constants.js';
import { injectStyles, releaseStyles } from './style.js';
import { computePosition, computeFollowPosition } from './position.js';
import {
    resolveContent, resolveScalarValue, parseObjectLiteral,
    parseNumberModifier, parsePrefixedModifier
} from './content-parser.js';
import { tryStartAsyncContent } from './async-content.js';

let __hxTooltipInstanceSeq = 0;

const HelixTooltipPlugin = {
    name: 'tooltip',
    version: import.meta.env.VITE_TOOLTIP_VERSION || '0.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        if (app.$tooltip && typeof app.$tooltip.setDefaults === 'function') {
            app.$tooltip.setDefaults(options);
            return;
        }

        if (typeof document === 'undefined') {
            console.error('[Helix.js][$tooltip] DOM is required. This plugin cannot run outside a browser.');
            return () => { };
        }

        const instanceId = ++__hxTooltipInstanceSeq;
        // Uses the app's actual configured directive prefix (app.config.prefix,
        // default "h-") instead of a hardcoded "hx-", falling back to "hx-" only
        // if app.config isn't present at all. This is purely cosmetic (part of a
        // generated DOM element id), not used for directive attribute matching —
        // that goes through Core's own native app.directive() prefix handling.
        const dirPrefix = (app.config && typeof app.config.prefix === 'string' && app.config.prefix) || 'hx-';
        const tooltipElId = `${dirPrefix}tooltip-${instanceId}`;

        let isDestroyed = false;
        function warnDestroyed(method) {
            console.warn(`[Helix.js][$tooltip] Ignored ${method}() call after destroy().`);
        }

        // ==========================================
        // 1. CONFIG
        // ==========================================
        const defaults = { ...DEFAULT_OPTIONS, ...options };

        function validateDefaults() {
            if (!PLACEMENTS.includes(defaults.placement)) defaults.placement = 'top';
            if (typeof defaults.theme !== 'string' || !defaults.theme) defaults.theme = 'dark';
            if (typeof defaults.animation !== 'string' || !defaults.animation) defaults.animation = 'zoom';
        }
        validateDefaults();

        const container = document.querySelector(defaults.appendTo) || document.body;

        // ==========================================
        // 2. CSS AUTO-INJECTION (reference-counted, CSS-variable-driven theming)
        // ==========================================
        injectStyles(defaults.zIndex, defaults.maxWidth);

        // ==========================================
        // 3. SINGLETON TOOLTIP ELEMENT (per app instance)
        // ==========================================
        let tooltipEl = null;
        let contentEl = null;
        let arrowEl = null;
        let lastAnimClass = null;
        let lastThemeClass = null;
        let lastCustomClassName = null;
        let tooltipResizeObserver = null;

        function ensureTooltipEl() {
            if (isDestroyed) return null;
            if (tooltipEl) return tooltipEl;
            tooltipEl = document.createElement('div');
            tooltipEl.id = tooltipElId;
            tooltipEl.className = 'hx-tooltip';
            tooltipEl.setAttribute('role', 'tooltip');
            tooltipEl.setAttribute('aria-hidden', 'true');
            if (defaults.ariaLive) {
                tooltipEl.setAttribute('aria-live', defaults.ariaLive === true ? 'polite' : defaults.ariaLive);
            }
            contentEl = document.createElement('div');
            contentEl.className = 'hx-tooltip-content';
            arrowEl = document.createElement('div');
            arrowEl.className = 'hx-tooltip-arrow';
            tooltipEl.appendChild(contentEl);
            tooltipEl.appendChild(arrowEl);
            container.appendChild(tooltipEl);

            // Singleton element (one per app instance) — direct listeners here
            // are not part of the "thousands of anchors" scaling concern.
            tooltipEl.addEventListener('mouseenter', () => {
                if (tooltipEl.classList.contains('hx-tooltip-interactive')) clearTimers();
            });
            tooltipEl.addEventListener('mouseleave', () => {
                if (tooltipEl.classList.contains('hx-tooltip-interactive')) hideTooltip();
            });

            if (typeof ResizeObserver !== 'undefined') {
                tooltipResizeObserver = new ResizeObserver(() => scheduleReposition());
                tooltipResizeObserver.observe(tooltipEl);
            }
            return tooltipEl;
        }

        // ==========================================
        // 4. POSITIONING
        // ==========================================
        let activeEl = null;
        let activePlacement = defaults.placement;
        let followMode = false;
        // Per-instance overrides for offset/arrow, set fresh on each showTooltip()
        // call. Defaults to the global config so every call site that doesn't
        // override anything is unaffected.
        let activeOverrides = { offset: defaults.offset, arrow: defaults.arrow };

        function applyArrow(arrow) {
            if (!arrowEl) return;
            if (!arrow) { arrowEl.style.left = ''; arrowEl.style.top = ''; return; }
            if (arrow.axis === 'x') { arrowEl.style.left = `${arrow.value}px`; arrowEl.style.top = ''; }
            else { arrowEl.style.top = `${arrow.value}px`; arrowEl.style.left = ''; }
        }

        function positionTooltip() {
            if (followMode) return;
            if (!activeEl || !tooltipEl || !document.body.contains(activeEl)) return;
            const rect = activeEl.getBoundingClientRect();
            const tipRect = tooltipEl.getBoundingClientRect();
            const { placement, top, left, arrow } = computePosition(rect, tipRect, activePlacement, {
                offset: activeOverrides.offset,
                arrowEnabled: activeOverrides.arrow,
                viewportPadding: defaults.viewportPadding
            });

            tooltipEl.style.left = `${Math.round(left)}px`;
            tooltipEl.style.top = `${Math.round(top)}px`;
            if (tooltipEl.dataset.placement !== placement) tooltipEl.dataset.placement = placement;
            applyArrow(arrow);
        }

        function positionFollow(x, y) {
            if (!tooltipEl) return;
            const tipRect = tooltipEl.getBoundingClientRect();
            const { top, left } = computeFollowPosition(x, y, tipRect, defaults.viewportPadding);
            tooltipEl.style.left = `${Math.round(left)}px`;
            tooltipEl.style.top = `${Math.round(top)}px`;
        }

        let repositionRaf = null;
        function scheduleReposition() {
            if (followMode) return;
            if (repositionRaf) return;
            repositionRaf = requestAnimationFrame(() => {
                repositionRaf = null;
                positionTooltip();
            });
        }

        window.addEventListener('scroll', scheduleReposition, true);
        window.addEventListener('resize', scheduleReposition);

        let anchorResizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            anchorResizeObserver = new ResizeObserver(() => scheduleReposition());
        }

        let liveTrackRaf = null;
        let liveTrackIntersectionObserver = null;
        let anchorIntersecting = true;

        function onVisibilityChange() {
            if (typeof document.hidden === 'undefined') return;
            if (document.hidden) {
                if (liveTrackRaf) { cancelAnimationFrame(liveTrackRaf); liveTrackRaf = null; }
            } else if (defaults.liveTracking && activeEl && !followMode && !liveTrackRaf) {
                runLiveTrackLoop();
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange);

        function runLiveTrackLoop() {
            const loop = () => {
                if (!activeEl) { liveTrackRaf = null; return; }
                if (anchorIntersecting && !document.hidden) positionTooltip();
                liveTrackRaf = requestAnimationFrame(loop);
            };
            liveTrackRaf = requestAnimationFrame(loop);
        }

        function startLiveTracking() {
            if (!defaults.liveTracking || followMode || !activeEl) return;
            anchorIntersecting = true;
            if (typeof IntersectionObserver !== 'undefined') {
                liveTrackIntersectionObserver = new IntersectionObserver((entries) => {
                    anchorIntersecting = entries[0] ? entries[0].isIntersecting : true;
                });
                liveTrackIntersectionObserver.observe(activeEl);
            }
            runLiveTrackLoop();
        }

        function stopLiveTracking() {
            if (liveTrackRaf) { cancelAnimationFrame(liveTrackRaf); liveTrackRaf = null; }
            if (liveTrackIntersectionObserver) { liveTrackIntersectionObserver.disconnect(); liveTrackIntersectionObserver = null; }
            anchorIntersecting = true;
        }

        function onDismissGesture(e) {
            if (!activeEl) return;
            if (activeEl.contains(e.target)) return;
            if (tooltipEl && tooltipEl.contains(e.target)) return;
            hideTooltip({ immediate: true });
        }
        if (defaults.closeOnClickOutside) {
            document.addEventListener('click', onDismissGesture, true);
            document.addEventListener('touchstart', onDismissGesture, true);
        }

        function onKeydown(e) {
            if (e.key === 'Escape' && activeEl) hideTooltip({ immediate: true });
        }
        if (defaults.closeOnEscape) {
            document.addEventListener('keydown', onKeydown);
        }

        // ==========================================
        // 5. SHOW / HIDE
        // ==========================================
        let showTimer = null;
        let hideTimer = null;

        function clearTimers() {
            if (showTimer) { clearTimeout(showTimer); showTimer = null; }
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        }

        function setContent(content, isHtml, el) {
            const text = content == null ? '' : String(content);
            if (isHtml) {
                contentEl.innerHTML = typeof defaults.sanitize === 'function' ? defaults.sanitize(text, { el }) : text;
            } else {
                contentEl.textContent = text;
            }
        }

        function showTooltip(el, content, opts = {}) {
            if (isDestroyed) { warnDestroyed('show'); return; }
            if (!el) return;
            const st = elState.get(el) || {};
            if (opts.disabled === true || (opts.disabled === undefined && st.disabled)) return;
            const el_ = ensureTooltipEl();
            if (!el_) return;
            clearTimers();

            const theme = opts.theme || st.theme || defaults.theme;
            const placement = opts.placement || st.placement || defaults.placement;
            const animation = opts.animation || st.animation || defaults.animation;
            const isHtml = opts.html !== undefined ? opts.html : !!st.html;
            const isInteractive = opts.interactive !== undefined ? opts.interactive : !!st.interactive;
            const isFollow = opts.follow !== undefined ? opts.follow : !!st.follow;
            const offset = opts.offset ?? (typeof st.offset === 'number' ? st.offset : defaults.offset);
            const showArrow = opts.arrow ?? (typeof st.arrow === 'boolean' ? st.arrow : defaults.arrow);
            const maxWidth = opts.maxWidth ?? st.maxWidth;
            const className = opts.className ?? st.className ?? null;

            const doShow = () => {
                setContent(content, isHtml, el);

                if (lastThemeClass) el_.classList.remove(lastThemeClass);
                const themeClass = `hx-tooltip-${theme}`;
                el_.classList.add(themeClass);
                lastThemeClass = themeClass;

                if (lastAnimClass) el_.classList.remove(lastAnimClass);
                const animClass = `hx-tooltip-anim-${animation}`;
                el_.classList.add(animClass);
                lastAnimClass = animClass;

                if (lastCustomClassName) el_.classList.remove(lastCustomClassName);
                if (className) el_.classList.add(className);
                lastCustomClassName = className;

                el_.style.maxWidth = maxWidth !== undefined
                    ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth)
                    : '';

                el_.classList.toggle('hx-tooltip-interactive', isInteractive);
                el_.classList.toggle('hx-tooltip-no-arrow', !showArrow || isFollow);
                el_.setAttribute('aria-hidden', 'false');
                el.setAttribute('aria-describedby', el_.id);

                if (anchorResizeObserver) anchorResizeObserver.disconnect();
                if (anchorResizeObserver && !isFollow) anchorResizeObserver.observe(el);

                activeEl = el;
                activePlacement = placement;
                followMode = isFollow;
                activeOverrides = { offset, arrow: showArrow };

                if (isFollow && opts.followPos) {
                    positionFollow(opts.followPos.x, opts.followPos.y);
                } else {
                    positionTooltip();
                }
                requestAnimationFrame(() => el_.classList.add('hx-tooltip-visible'));
                startLiveTracking();
            };

            const delay = opts.delay ?? st.showDelay ?? defaults.showDelay;
            if (delay > 0) showTimer = setTimeout(doShow, delay);
            else doShow();
        }

        function hideTooltip(opts = {}) {
            clearTimers();
            const doHide = () => {
                if (tooltipEl) {
                    tooltipEl.classList.remove('hx-tooltip-visible');
                    tooltipEl.setAttribute('aria-hidden', 'true');
                }
                if (activeEl) activeEl.removeAttribute('aria-describedby');
                if (anchorResizeObserver) anchorResizeObserver.disconnect();
                stopLiveTracking();
                activeEl = null;
                followMode = false;
            };
            const st = activeEl ? (elState.get(activeEl) || {}) : {};
            const delay = opts.immediate ? 0 : (opts.delay ?? st.hideDelay ?? defaults.hideDelay);
            if (delay > 0) hideTimer = setTimeout(doHide, delay);
            else doHide();
        }

        function updateTooltip(el, content) {
            if (activeEl === el && contentEl) {
                const st = elState.get(el) || {};
                setContent(content, !!st.html, el);
                scheduleReposition();
            }
        }

        // ==========================================
        // 6. DIRECTIVE (event-delegated)
        // ==========================================
        // Per-anchor bookkeeping only; NO per-anchor DOM listeners are attached
        // here. A fixed set of document-level delegated listeners (below) does
        // the actual event handling for every anchor sharing this app instance.
        const elState = new WeakMap();

        function findAnchor(target) {
            let node = target;
            while (node) {
                if (elState.has(node)) return node;
                node = node.parentNode;
            }
            return null;
        }

        app.directive('tooltip', {
            mounted(el, binding) {
                const { value: val, arg, modifiers, ctx, trackCleanup } = binding;
                const trimmedVal = (val || '').trim();

                let objectConfig = null;
                let contentRaw = val;

                if (OBJECT_LITERAL_RE.test(trimmedVal)) {
                    objectConfig = parseObjectLiteral(trimmedVal);
                    if (objectConfig === null) {
                        console.warn(`[Helix.js][$tooltip] hx-tooltip value looks like an object but couldn't be parsed: "${trimmedVal}". Rendering empty.`);
                        contentRaw = "''";
                    } else if (objectConfig.title !== undefined) {
                        contentRaw = objectConfig.title;
                    } else if (objectConfig.content !== undefined) {
                        contentRaw = objectConfig.content;
                    } else {
                        console.warn(`[Helix.js][$tooltip] hx-tooltip object config has no "title" or "content" key: "${trimmedVal}"`);
                        contentRaw = "''";
                    }
                }

                const cfg = (key) => (objectConfig && objectConfig[key] !== undefined)
                    ? resolveScalarValue(app, objectConfig[key], ctx, el, key)
                    : undefined;

                // .hover/.click/.focus/.manual modifiers are shorthand for the
                // directive arg (hx-tooltip:click="..."). Precedence: object-config
                // trigger > explicit arg > modifier shorthand > default 'hover'.
                const modifierTrigger = TRIGGER_WORDS.find((t) => modifiers.includes(t));
                const trigger = String(cfg('trigger') ?? (arg || modifierTrigger || 'hover')).toLowerCase();
                const placement = cfg('placement') ?? (PLACEMENTS.find((p) => modifiers.includes(p)) || defaults.placement);
                const customTheme = parsePrefixedModifier(modifiers, 'theme-');
                const modifierTheme = customTheme || (modifiers.includes('light') ? 'light' : (modifiers.includes('dark') ? 'dark' : defaults.theme));
                const theme = cfg('theme') ?? modifierTheme;
                const customAnim = parsePrefixedModifier(modifiers, 'anim-');
                const modifierAnim = customAnim || ANIMATION_WORDS.find((a) => modifiers.includes(a)) || defaults.animation;
                const animation = cfg('animation') ?? modifierAnim;
                const html = cfg('html') ?? modifiers.includes('html');
                const interactive = cfg('interactive') ?? modifiers.includes('interactive');
                const follow = cfg('follow') ?? modifiers.includes('follow');
                // Object-config only for now — no modifier shorthand yet (a .disabled
                // modifier would be ambiguous with a plain boolean attribute
                // convention elsewhere, so it's opt-in via the object form only
                // until there's a clearer precedent to follow).
                const disabled = cfg('disabled') ?? false;
                const className = cfg('className') ?? null;
                const maxWidth = cfg('maxWidth'); // undefined -> CSS default, untouched
                const offset = cfg('offset'); // undefined -> defaults.offset
                const showArrow = cfg('showArrow') ?? cfg('arrow'); // undefined -> defaults.arrow

                const delayBoth = cfg('delay') ?? parseNumberModifier(modifiers, 'delay-');
                const showDelay = cfg('showDelay') ?? parseNumberModifier(modifiers, 'show-') ?? delayBoth ?? defaults.showDelay;
                const hideDelay = cfg('hideDelay') ?? parseNumberModifier(modifiers, 'hide-') ?? delayBoth ?? defaults.hideDelay;

                const state = {
                    trigger, placement, theme, animation, html, interactive, follow,
                    showDelay, hideDelay, disabled, className, maxWidth, offset, arrow: showArrow,
                    content: '', longPressTimer: null
                };
                elState.set(el, state);

                // Async function-call content (e.g. hx-tooltip="asyncTooltip()") is
                // resolved once, outside the reactive watcher.
                if (!tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip)) {
                    const stopWatch = app.watchEffect(() => {
                        state.content = resolveContent(app, contentRaw, ctx, el);
                        updateTooltip(el, state.content);
                    });
                    trackCleanup(stopWatch);
                }
            },

            unmounted(el) {
                if (activeEl === el) hideTooltip({ immediate: true });
                const st = elState.get(el);
                if (st && st.longPressTimer) clearTimeout(st.longPressTimer);
                elState.delete(el);
            }
        });

        // ----- Delegated document-level listeners (registered once per install) -----
        function delegatedPointerOver(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || st.trigger !== 'hover') return;
            if (e.relatedTarget && anchor.contains(e.relatedTarget)) return; // still inside
            showTooltip(anchor, st.content);
        }
        function delegatedPointerOut(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || st.trigger !== 'hover') return;
            if (e.relatedTarget && anchor.contains(e.relatedTarget)) return; // moved within
            hideTooltip();
        }
        function delegatedFocusIn(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || (st.trigger !== 'hover' && st.trigger !== 'focus')) return;
            showTooltip(anchor, st.content);
        }
        function delegatedFocusOut(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || (st.trigger !== 'hover' && st.trigger !== 'focus')) return;
            hideTooltip({ immediate: true });
        }
        function delegatedClick(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || st.trigger !== 'click') return;
            if (activeEl === anchor) hideTooltip({ immediate: true });
            else showTooltip(anchor, st.content, { delay: 0 });
        }
        function delegatedTouchStart(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (!st || st.trigger !== 'hover') return;
            st.longPressTimer = setTimeout(() => showTooltip(anchor, st.content, { delay: 0 }), defaults.longPressDelay);
        }
        function delegatedTouchEndOrMove(e) {
            const anchor = findAnchor(e.target);
            if (!anchor) return;
            const st = elState.get(anchor);
            if (st && st.longPressTimer) { clearTimeout(st.longPressTimer); st.longPressTimer = null; }
        }
        function delegatedPointerMove(e) {
            if (!activeEl || !followMode) return;
            if (!activeEl.contains(e.target)) return;
            positionFollow(e.clientX, e.clientY);
        }

        document.addEventListener('mouseover', delegatedPointerOver);
        document.addEventListener('mouseout', delegatedPointerOut);
        document.addEventListener('focusin', delegatedFocusIn);
        document.addEventListener('focusout', delegatedFocusOut);
        document.addEventListener('click', delegatedClick);
        document.addEventListener('touchstart', delegatedTouchStart, { passive: true });
        document.addEventListener('touchend', delegatedTouchEndOrMove);
        document.addEventListener('touchmove', delegatedTouchEndOrMove);
        document.addEventListener('pointermove', delegatedPointerMove);

        // ==========================================
        // 7. PUBLIC API (all mutating methods guard against post-destroy use)
        // ==========================================
        const $tooltip = {
            show(el, content, opts = {}) {
                const state = elState.get(el) || {};
                if (content !== undefined) state.content = content;
                elState.set(el, state);
                showTooltip(el, content !== undefined ? content : state.content, opts);
            },
            hide(opts = {}) {
                if (isDestroyed) { warnDestroyed('hide'); return; }
                hideTooltip(opts);
            },
            toggle(el, content, opts = {}) {
                if (isDestroyed) { warnDestroyed('toggle'); return; }
                if (activeEl === el) hideTooltip({ immediate: true });
                else $tooltip.show(el, content, opts);
            },
            hideAll() {
                if (isDestroyed) { warnDestroyed('hideAll'); return; }
                hideTooltip({ immediate: true });
            },
            update(el, content) {
                if (isDestroyed) { warnDestroyed('update'); return; }
                const state = elState.get(el);
                if (state) state.content = content;
                updateTooltip(el, content);
            },
            isVisible(el) {
                return !isDestroyed && activeEl === el && !!tooltipEl && tooltipEl.classList.contains('hx-tooltip-visible');
            },
            setDefaults(patch = {}) {
                if (isDestroyed) { warnDestroyed('setDefaults'); return; }
                Object.assign(defaults, patch);
                validateDefaults();
            },
            destroy() {
                pluginCleanup();
            },
            raw: () => tooltipEl
        };

        // ==========================================
        // 8. NAMESPACED API REGISTRATION
        // ==========================================
        app.namespace('tooltip', {
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
            app.provide('$tooltip', $tooltip);
        }

        // ==========================================
        // 9. CLEANUP LIFECYCLE
        // ==========================================
        function pluginCleanup() {
            if (isDestroyed) return;
            isDestroyed = true;

            clearTimers();
            stopLiveTracking();
            if (repositionRaf) { cancelAnimationFrame(repositionRaf); repositionRaf = null; }
            window.removeEventListener('scroll', scheduleReposition, true);
            window.removeEventListener('resize', scheduleReposition);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (anchorResizeObserver) { anchorResizeObserver.disconnect(); anchorResizeObserver = null; }
            if (tooltipResizeObserver) { tooltipResizeObserver.disconnect(); tooltipResizeObserver = null; }
            if (defaults.closeOnClickOutside) {
                document.removeEventListener('click', onDismissGesture, true);
                document.removeEventListener('touchstart', onDismissGesture, true);
            }
            if (defaults.closeOnEscape) {
                document.removeEventListener('keydown', onKeydown);
            }

            document.removeEventListener('mouseover', delegatedPointerOver);
            document.removeEventListener('mouseout', delegatedPointerOut);
            document.removeEventListener('focusin', delegatedFocusIn);
            document.removeEventListener('focusout', delegatedFocusOut);
            document.removeEventListener('click', delegatedClick);
            document.removeEventListener('touchstart', delegatedTouchStart, { passive: true });
            document.removeEventListener('touchend', delegatedTouchEndOrMove);
            document.removeEventListener('touchmove', delegatedTouchEndOrMove);
            document.removeEventListener('pointermove', delegatedPointerMove);

            if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }

            releaseStyles();
            activeEl = null;
            followMode = false;
        }

        return pluginCleanup;
    }
};

// Expose globally AND autoload with zero required setup — same pattern as
// helix-directives / helix-helpers / helix-model. Calls install() DIRECTLY
// (not Helix.use()), so the autoload never occupies a slot in Core's plugin
// registry, and a later explicit Helix.use(HelixTooltipPlugin, options) still
// works normally to reconfigure (each install() call is independent — it
// creates a fresh singleton tooltip element/state for that call, correctly
// reference-counting the shared <style> tag either way).
const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixTooltipPlugin = HelixTooltipPlugin;

if (root.Helix && typeof root.Helix.directive === 'function') {
    HelixTooltipPlugin.install(root.Helix, {});
}

export default HelixTooltipPlugin;
