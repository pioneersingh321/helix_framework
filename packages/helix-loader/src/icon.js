let warnedHtmlDowngrade = false;

export function buildIcon(cfg, allowHtml = false) {
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
