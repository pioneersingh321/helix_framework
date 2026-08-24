import { resolveBool } from '../parser.js';

function parseDuration(modifiers) {
    let duration = 300;
    const durMod = modifiers.find(m => m === 'duration' || m.startsWith('duration'));
    if (durMod) {
        let valStr = null;
        if (durMod.includes('.') || durMod.includes('-')) {
            valStr = durMod.split(/[-.]/)[1];
        } else {
            const idx = modifiers.indexOf(durMod);
            valStr = modifiers[idx + 1];
        }
        if (valStr) {
            const parsed = parseInt(valStr, 10);
            if (!isNaN(parsed)) duration = parsed;
        }
    } else {
        const directMs = modifiers.find(m => /^\d+(ms)?$/.test(m));
        if (directMs) {
            const parsed = parseInt(directMs, 10);
            if (!isNaN(parsed)) duration = parsed;
        }
    }
    return duration;
}

function parseMinHeight(modifiers) {
    let minHeight = 0;
    const minMod = modifiers.find(m => m === 'min' || m.startsWith('min'));
    if (minMod) {
        let valStr = null;
        if (minMod.includes('.') || minMod.includes('-')) {
            valStr = minMod.split(/[-.]/)[1];
        } else {
            const idx = modifiers.indexOf(minMod);
            valStr = modifiers[idx + 1];
        }
        if (valStr) {
            const parsed = parseInt(valStr, 10);
            if (!isNaN(parsed)) minHeight = parsed;
        }
    }
    return minHeight;
}

const collapseStates = new WeakMap();

export function createCollapseDirective(app, config = {}) {
    const debug = !!config.debug;
    const log = (...args) => { if (debug) console.log('[directives] [collapse]', ...args); };

    return {
        mounted(el, binding) {
            const { value, modifiers = [], ctx, trackCleanup } = binding;

            const duration = parseDuration(modifiers);
            const minHeight = parseMinHeight(modifiers);

            // Store original inline styles for restoration on cleanup
            const originalStyles = {
                transitionProperty: el.style.transitionProperty || '',
                transitionDuration: el.style.transitionDuration || '',
                transitionTimingFunction: el.style.transitionTimingFunction || '',
                height: el.style.height || '',
                overflow: el.style.overflow || '',
                display: el.style.display || ''
            };

            el.style.transitionProperty = 'height';
            el.style.transitionDuration = `${duration}ms`;
            el.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';

            const state = {
                value,
                modifiers,
                ctx,
                duration,
                minHeight,
                isExpanded: null,
                timer: null,
                frame: null,
                originalStyles,
                trigger: null
            };
            collapseStates.set(el, state);

            const cancelPendingFrame = () => {
                if (state.frame != null) {
                    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.frame);
                    else clearTimeout(state.frame);
                    state.frame = null;
                }
            };

            const scheduleNextFrame = (fn) => {
                cancelPendingFrame();
                if (typeof requestAnimationFrame === 'function') {
                    state.frame = requestAnimationFrame(() => {
                        state.frame = null;
                        fn();
                    });
                } else {
                    state.frame = setTimeout(() => {
                        state.frame = null;
                        fn();
                    }, 16);
                }
            };

            const expand = () => {
                clearTimeout(state.timer);
                cancelPendingFrame();
                el.style.display = '';
                el.style.overflow = 'hidden';
                el.style.height = `${state.minHeight}px`;

                // Force reflow
                const fullHeight = Math.max(el.scrollHeight, state.minHeight);
                scheduleNextFrame(() => {
                    el.style.height = `${fullHeight}px`;
                    state.timer = setTimeout(() => {
                        el.style.height = '';
                        el.style.overflow = '';
                        log('expanded fully, cleared fixed height');
                    }, state.duration);
                });
            };

            const collapse = () => {
                clearTimeout(state.timer);
                cancelPendingFrame();
                const currentHeight = el.scrollHeight;
                el.style.height = `${currentHeight}px`;
                el.style.overflow = 'hidden';

                // Force reflow
                scheduleNextFrame(() => {
                    el.style.height = `${state.minHeight}px`;
                    state.timer = setTimeout(() => {
                        if (state.minHeight === 0) {
                            el.style.display = 'none';
                        }
                        log('collapsed to minHeight:', state.minHeight);
                    }, state.duration);
                });
            };

            const effectFn = () => {
                let shouldShow = true;
                if (state.value !== undefined && state.value !== null && state.value !== '') {
                    shouldShow = resolveBool(app, state.ctx, state.value);
                } else if (el.style.display === 'none') {
                    shouldShow = false;
                }

                if (shouldShow === state.isExpanded) return;
                const wasInitial = state.isExpanded === null;
                state.isExpanded = shouldShow;

                if (wasInitial) {
                    if (!shouldShow) {
                        el.style.height = `${state.minHeight}px`;
                        el.style.overflow = 'hidden';
                        if (state.minHeight === 0) el.style.display = 'none';
                    }
                } else {
                    if (shouldShow) expand();
                    else collapse();
                }
            };

            state.trigger = effectFn;

            let effectCleanup = null;
            if (app && typeof app.effect === 'function') {
                const eff = app.effect(effectFn, { name: 'collapse', area: 'directive' });
                effectCleanup = () => {
                    if (app.cleanup) app.cleanup(eff);
                    else if (eff.stop) eff.stop();
                };
            } else {
                effectFn();
            }

            if (typeof trackCleanup === 'function') {
                trackCleanup(() => {
                    clearTimeout(state.timer);
                    cancelPendingFrame();
                    if (effectCleanup) effectCleanup();

                    // Restore original inline styles
                    el.style.transitionProperty = originalStyles.transitionProperty;
                    el.style.transitionDuration = originalStyles.transitionDuration;
                    el.style.transitionTimingFunction = originalStyles.transitionTimingFunction;
                    el.style.height = originalStyles.height;
                    el.style.overflow = originalStyles.overflow;
                    el.style.display = originalStyles.display;

                    collapseStates.delete(el);
                });
            }
        },

        updated(el, binding) {
            const state = collapseStates.get(el);
            if (!state) return;

            const { value, modifiers = [], ctx } = binding;
            state.value = value;
            state.modifiers = modifiers;
            state.ctx = ctx;
            state.duration = parseDuration(modifiers);
            state.minHeight = parseMinHeight(modifiers);

            el.style.transitionDuration = `${state.duration}ms`;

            if (typeof state.trigger === 'function') {
                state.trigger();
            }
        }
    };
}
