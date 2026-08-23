import { globalConfig } from '../app/config.js';
import { onMounted, onUnmounted } from '../app/lifecycle.js';
import {
    resolveTransitionConfig,
    enter,
    leave,
    recordPositions,
    applyFlip
} from './transition.js';

export const Transition = {
    name: "Transition",
    props: {
        name: { default: "" },
        enterActiveClass: { default: "" },
        enterFromClass: { default: "" },
        enterToClass: { default: "" },
        leaveActiveClass: { default: "" },
        leaveFromClass: { default: "" },
        leaveToClass: { default: "" },
        mode: { default: "default" },
        appear: { default: false }
    },
    setup(ctx) {
        const transConfig = {
            name: ctx.name || "h",
            enterActiveClass: ctx.enterActiveClass || (ctx.name ? `${ctx.name}-enter-active` : "h-enter-active"),
            enterFromClass: ctx.enterFromClass || (ctx.name ? `${ctx.name}-enter-from` : "h-enter-from"),
            enterToClass: ctx.enterToClass || (ctx.name ? `${ctx.name}-enter-to` : "h-enter-to"),
            leaveActiveClass: ctx.leaveActiveClass || (ctx.name ? `${ctx.name}-leave-active` : "h-leave-active"),
            leaveFromClass: ctx.leaveFromClass || (ctx.name ? `${ctx.name}-leave-from` : "h-leave-from"),
            leaveToClass: ctx.leaveToClass || (ctx.name ? `${ctx.name}-leave-to` : "h-leave-to"),
            mode: ctx.mode || "default"
        };

        onMounted((el) => {
            if (!el) return;
            const targetEl = el.nodeType === 1 ? el : el.firstElementChild;
            if (targetEl && targetEl.nodeType === 1) {
                targetEl.__hx_transition_config = transConfig;
                if (ctx.appear) {
                    enter(targetEl, transConfig);
                }
            }
        });

        return {
            config: transConfig,
            template: `<slot></slot>`
        };
    }
};

export const TransitionGroup = {
    name: "TransitionGroup",
    props: {
        name: { default: "" },
        tag: { default: "div" },
        moveClass: { default: "" },
        enterActiveClass: { default: "" },
        leaveActiveClass: { default: "" }
    },
    setup(ctx) {
        const tag = ctx.tag || "div";
        const name = ctx.name || "h";
        const moveClass = ctx.moveClass || `${name}-move`;

        const transConfig = {
            name,
            moveClass,
            enterActiveClass: ctx.enterActiveClass || `${name}-enter-active`,
            enterFromClass: ctx.enterFromClass || `${name}-enter-from`,
            enterToClass: ctx.enterToClass || `${name}-enter-to`,
            leaveActiveClass: ctx.leaveActiveClass || `${name}-leave-active`,
            leaveFromClass: ctx.leaveFromClass || `${name}-leave-from`,
            leaveToClass: ctx.leaveToClass || `${name}-leave-to`
        };

        let observer = null;
        let prevChildren = [];

        onMounted((container) => {
            if (!container || container.nodeType !== 1) return;
            container.__hx_transition_group = transConfig;

            const getValidChildren = () => Array.from(container.children || container.childNodes || []).filter(c => c.nodeType === 1);
            prevChildren = getValidChildren();

            if (typeof MutationObserver === 'function') {
                let prevPositions = recordPositions(prevChildren);

                observer = new MutationObserver((mutations) => {
                    const currentChildren = getValidChildren();
                    if (prevPositions && prevPositions.size > 0) {
                        applyFlip(prevPositions, moveClass);
                    }

                    mutations.forEach((m) => {
                        if (m.type === 'childList') {
                            m.addedNodes.forEach((node) => {
                                if (node.nodeType === 1) {
                                    enter(node, transConfig);
                                }
                            });
                        }
                    });

                    prevChildren = currentChildren;
                    prevPositions = recordPositions(currentChildren);
                });

                observer.observe(container, { childList: true });
            }
        });

        onUnmounted(() => {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        });

        return {
            config: transConfig,
            template: `<${tag} class="helix-transition-group"><slot></slot></${tag}>`
        };
    }
};
