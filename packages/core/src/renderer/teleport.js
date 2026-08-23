import { onMounted, onUnmounted } from '../app/lifecycle.js';
import { effect, cleanup } from '../reactivity/effect.js';
import { destroyNode } from './node.js';
import { warn, currentInstance } from '../shared/shared.js';

export function resolveTeleportTarget(to) {
    if (!to) return null;
    if (typeof to === 'object' && to.nodeType === 1) return to;
    if (typeof to === 'string') {
        if (typeof document !== 'undefined') {
            if (to === 'body') return document.body;
            if (to === 'head') return document.head;
            return document.querySelector(to);
        }
    }
    return null;
}

export const Teleport = {
    name: "Teleport",
    props: {
        to: { default: "body" },
        disabled: { default: false }
    },
    setup(ctx) {
        let placeholder = null;
        let movedNodes = [];
        let placementEffect = null;
        let isTornDown = false;

        const teardown = () => {
            if (isTornDown) return;
            isTornDown = true;
            if (placementEffect) {
                cleanup(placementEffect);
                placementEffect = null;
            }
            const nodesToDestroy = [...movedNodes];
            movedNodes = [];
            nodesToDestroy.forEach((node) => destroyNode(node));
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }
            placeholder = null;
        };

        const inst = currentInstance;
        onMounted((el) => {
            const container = el || inst?.root;
            if (!container || isTornDown) return;
            const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
            placeholder = doc ? doc.createComment(" teleport-anchor ") : { nodeType: 8, textContent: " teleport-anchor " };

            const parent = container.parentNode;
            if (!parent) return;

            parent.insertBefore(placeholder, container);
            movedNodes = Array.from(container.childNodes || []);

            // Remove container wrapper and keep child nodes
            movedNodes.forEach((node) => {
                if (node.parentNode === container) {
                    container.removeChild(node);
                }
            });
            parent.removeChild(container);

            const updatePlacement = () => {
                if (isTornDown) return;
                const props = ctx.props || ctx;
                const isDisabled = Boolean(typeof props.disabled === 'function' ? props.disabled() : props.disabled);
                const targetSelector = typeof props.to === 'function' ? props.to() : props.to;
                if (isDisabled) {
                    // Move back to anchor location in original order
                    if (placeholder && placeholder.parentNode) {
                        movedNodes.forEach((node) => {
                            placeholder.parentNode.insertBefore(node, placeholder);
                        });
                    }
                } else {
                    const targetEl = resolveTeleportTarget(targetSelector);
                    if (targetEl) {
                        movedNodes.forEach((node) => {
                            targetEl.appendChild(node);
                        });
                    } else {
                        warn(`[Helix Teleport] Target container "${targetSelector}" not found in document.`, "teleport");
                        // Retain local source location if target missing
                        if (placeholder && placeholder.parentNode) {
                            movedNodes.forEach((node) => {
                                placeholder.parentNode.insertBefore(node, placeholder);
                            });
                        }
                    }
                }
            };

            placementEffect = effect(updatePlacement, { name: "teleport-placement" });

            container.__hx_cleanup = container.__hx_cleanup || [];
            container.__hx_cleanup.push(teardown);
            placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
            placeholder.__hx_cleanup.push(teardown);
        });

        onUnmounted(() => {
            teardown();
        });

        return {};
    }
};
