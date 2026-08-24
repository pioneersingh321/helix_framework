import { parseCall, evaluateArgs, resolvePath } from '../parser.js';

function parseThreshold(modifiers) {
    let threshold = 0;
    if (modifiers.includes('full')) threshold = 1.0;
    else if (modifiers.includes('half')) threshold = 0.5;
    else {
        const threshMod = modifiers.find(m => m === 'threshold' || m.startsWith('threshold'));
        if (threshMod) {
            let numStr = null;
            if (threshMod.includes('.') || threshMod.includes('-')) {
                numStr = threshMod.replace(/^threshold[.-]/, '');
            } else {
                const idx = modifiers.indexOf(threshMod);
                numStr = modifiers[idx + 1];
            }
            if (numStr) {
                const parsed = parseFloat(numStr);
                if (!isNaN(parsed)) {
                    threshold = parsed > 1 ? parsed / 100 : parsed;
                }
            }
        }
    }
    return Math.min(1.0, Math.max(0, threshold));
}

function parseRootMargin(modifiers) {
    let rootMargin = '0px';
    const marginMod = modifiers.find(m => m === 'margin' || m.startsWith('margin'));
    if (marginMod) {
        let valStr = null;
        if (marginMod.includes('.') || marginMod.includes('-')) {
            valStr = marginMod.replace(/^margin[.-]/, '');
            if (marginMod.startsWith('margin.-') || marginMod.startsWith('margin.--')) {
                valStr = '-' + marginMod.replace(/^margin\.[-]+/, '');
            }
        } else {
            const idx = modifiers.indexOf(marginMod);
            valStr = modifiers[idx + 1];
        }
        if (valStr) {
            rootMargin = valStr.replace(/_/g, ' ');
        }
    }
    return rootMargin;
}

const intersectStates = new WeakMap();

export function createIntersectDirective(app, config = {}) {
    const debug = !!config.debug;
    const log = (...args) => { if (debug) console.log('[directives] [intersect]', ...args); };

    function setupObserver(el, state) {
        if (!state.value) return;

        const isLeave = state.arg === 'leave' || state.modifiers.includes('leave');
        const isOnce = state.modifiers.includes('once');
        const threshold = parseThreshold(state.modifiers);
        const rootMargin = parseRootMargin(state.modifiers);

        const raw = (typeof state.value === 'string' ? state.value : String(state.value ?? '')).trim();
        const callData = parseCall(raw);

        const runHandler = (entry) => {
            log('intersection triggered:', { isIntersecting: entry.isIntersecting, isLeave });
            if (callData && callData.fnPath) {
                const fn = resolvePath(app, state.ctx, callData.fnPath);
                if (typeof fn === 'function') {
                    const argsToPass = callData.args.length > 0
                        ? evaluateArgs(app, state.ctx, callData.args, { event: entry })
                        : [entry];
                    try {
                        fn.apply(state.ctx, argsToPass);
                    } catch (err) {
                        if (debug) console.error('[directives] [intersect] error executing handler:', err);
                    }
                }
            }
        };

        if (typeof IntersectionObserver === 'undefined') {
            if (debug) console.warn('[directives] [intersect] IntersectionObserver is not supported in this environment.');
            return;
        }

        let triggered = false;
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const matchesCondition = isLeave ? !entry.isIntersecting : entry.isIntersecting;
                if (matchesCondition) {
                    if (isOnce) {
                        if (triggered) break;
                        triggered = true;
                        observer.unobserve(el);
                        observer.disconnect();
                    }
                    runHandler(entry);
                    if (isOnce) break;
                }
            }
        }, {
            threshold,
            rootMargin
        });

        observer.observe(el);
        state.observer = observer;
    }

    return {
        mounted(el, binding) {
            const { value, arg, modifiers = [], ctx, trackCleanup } = binding;
            const state = {
                value,
                arg,
                modifiers,
                ctx,
                observer: null
            };
            intersectStates.set(el, state);

            setupObserver(el, state);

            if (typeof trackCleanup === 'function') {
                trackCleanup(() => {
                    if (state.observer) {
                        state.observer.unobserve(el);
                        state.observer.disconnect();
                        state.observer = null;
                    }
                    intersectStates.delete(el);
                });
            }
        },

        updated(el, binding) {
            const state = intersectStates.get(el);
            if (!state) return;

            // Disconnect old observer before creating a new one with updated options
            if (state.observer) {
                state.observer.unobserve(el);
                state.observer.disconnect();
                state.observer = null;
            }

            const { value, arg, modifiers = [], ctx } = binding;
            state.value = value;
            state.arg = arg;
            state.modifiers = modifiers;
            state.ctx = ctx;

            setupObserver(el, state);
        }
    };
}
