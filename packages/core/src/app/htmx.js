import { globalConfig } from './config.js';
import { logger } from '../shared/shared.js';

let htmxListenerAttached = false;

export function initHtmxIntegration(Helix) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (htmxListenerAttached) return;

    const handleHtmxEvent = (e) => {
        if (!globalConfig.htmxIntegration) return;
        const target = e.detail?.target || e.detail?.elt || e.target;
        if (!target || target.nodeType !== 1) return;

        // Remove any cloak attributes on swapped fragment
        if (target.hasAttribute(`${globalConfig.prefix}cloak`)) target.removeAttribute(`${globalConfig.prefix}cloak`);
        target.querySelectorAll?.(`[${globalConfig.prefix}cloak]`)?.forEach((el) => {
            el.removeAttribute(`${globalConfig.prefix}cloak`);
        });

        // 1. Check if target is inside an existing mounted app
        if (Helix && Helix.$apps) {
            for (const appEntry of Helix.$apps.values()) {
                const rootEl = appEntry.rootElement || (appEntry.instance && appEntry.instance.root);
                if (rootEl && (rootEl === target || rootEl.contains(target))) {
                    try {
                        if (typeof appEntry.app?.rebind === 'function') {
                            appEntry.app.rebind(target);
                            return;
                        }
                    } catch (err) {
                        logger.error('Error auto-rebinding HTMX swapped fragment in app:', err);
                    }
                }
            }
        }

        // 2. Global rebind fallback
        if (Helix && typeof Helix.rebind === 'function') {
            try {
                Helix.rebind(target);
            } catch (err) {
                // Silently ignore if no binding context was found
            }
        }
    };

    document.addEventListener('htmx:afterSwap', handleHtmxEvent);
    document.addEventListener('htmx:load', handleHtmxEvent);
    document.addEventListener('htmx:afterProcessNode', handleHtmxEvent);

    htmxListenerAttached = true;
}

export function enableHtmxIntegration(Helix) {
    globalConfig.htmxIntegration = true;
    initHtmxIntegration(Helix);
}
