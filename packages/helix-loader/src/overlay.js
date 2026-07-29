import { normalizeFade } from './theme.js';
import { buildIcon } from './icon.js';

export function buildOverlay(cfg, { scoped = false, allowHtmlIcon = false } = {}) {
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

    // Customizable built-in progress bar
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
        width: ${cfg.progressWidth || '160px'};
        height: ${cfg.progressHeight || '4px'};
        background: ${cfg.progressBg || 'rgba(0, 0, 0, 0.1)'};
        border-radius: 2px;
        overflow: hidden;
        display: none;
    `;
    const progressBarColor = cfg.progressColor || cfg.iconColor || '#4285F4';
    const progressBar = document.createElement('div');
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

export function appendToBody(node) {
    if (document.body) {
        document.body.appendChild(node);
    } else {
        document.addEventListener('DOMContentLoaded',
            () => document.body && document.body.appendChild(node),
            { once: true });
    }
}
