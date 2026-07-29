export const styleId = 'hx-tooltip-styles';

// Module-level (not per-install) — an ES module is only ever evaluated once
// and cached by URL, so this is a true page-wide singleton counter, more
// robust than the original script-tag version (which would have re-declared
// a fresh counter if the same <script src="helix-tooltip.js"> were ever
// accidentally included twice on one page).
let styleRefs = 0;

export function injectStyles(zIndex, maxWidth) {
    let existingStyle = document.getElementById(styleId);
    if (!existingStyle) {
        const style = document.createElement('style');
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

export function releaseStyles() {
    styleRefs = Math.max(0, styleRefs - 1);
    if (styleRefs === 0) {
        const styleEl = document.getElementById(styleId);
        if (styleEl) styleEl.remove();
    }
}
