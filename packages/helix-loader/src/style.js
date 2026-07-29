export const styleId = 'hx-loader-styles';

export function setupStyles() {
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
    styleEl.dataset.hxRefcount =
        String((parseInt(styleEl.dataset.hxRefcount, 10) || 0) + 1);
    return styleEl;
}

export function releaseStyles() {
    const s = document.getElementById(styleId);
    if (s) {
        const n = (parseInt(s.dataset.hxRefcount, 10) || 1) - 1;
        if (n <= 0) s.remove();
        else s.dataset.hxRefcount = String(n);
    }
}
