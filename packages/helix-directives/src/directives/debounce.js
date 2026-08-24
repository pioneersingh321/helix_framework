import { parseCall, evaluateArgs, resolvePath, splitTopLevel } from '../parser.js';
import { DEBOUNCE_DEFAULT_EVENT, DEBOUNCE_DEFAULT_DELAY } from '../constants.js';

// Parses the directive value, which is either:
//   "handleInput"                        (bare function reference, default delay)
//   "saveData($event)"                   (call syntax, default delay)
//   "[saveData($event), 500]"            (call syntax + explicit delay)
//   "[refreshData(a, b)]"                (call with its own multiple args, no delay override)
//   "[handleSearch, myDelay]"            (call/ref with dynamic delay variable)
export function parseDebounceValue(raw) {
    let expression = raw;
    let delay = DEBOUNCE_DEFAULT_DELAY;

    if (raw.startsWith('[') && raw.endsWith(']')) {
        const inner = raw.slice(1, -1);
        const parts = splitTopLevel(inner);
        if (parts.length === 2) {
            const secondPart = parts[1].trim();
            if (/^\d+$/.test(secondPart) || (!secondPart.includes('(') && !secondPart.includes(')'))) {
                expression = parts[0];
                delay = secondPart;
            } else {
                expression = inner.trim();
            }
        } else {
            expression = inner.trim();
        }
    }

    expression = expression.trim();
    if ((expression.startsWith("'") && expression.endsWith("'")) ||
        (expression.startsWith('"') && expression.endsWith('"')) ||
        (expression.startsWith('`') && expression.endsWith('`'))) {
        expression = expression.slice(1, -1);
    }

    return { expression, delay };
}

const debounceStates = new WeakMap();

export function createDebounceDirective(app, config = {}) {
    const debug = !!config.debug;
    const log = (...args) => { if (debug) console.log('[directives] [debounce]', ...args); };

    return {
        mounted(el, binding) {
            const { value, arg, ctx, trackCleanup } = binding;
            const evtType = arg || DEBOUNCE_DEFAULT_EVENT;

            const raw = (typeof value === 'string' ? value : String(value ?? '')).trim();
            const { expression, delay } = parseDebounceValue(raw);
            const callData = parseCall(expression);

            log('mounted', { el, evtType, raw, expression, delay, fnPath: callData?.fnPath, args: callData?.args });

            const state = {
                evtType,
                delay,
                callData,
                expression,
                ctx,
                timeout: null,
                handler: null
            };
            debounceStates.set(el, state);

            state.handler = (e) => {
                let delayVal = DEBOUNCE_DEFAULT_DELAY;
                if (typeof state.delay === 'number') {
                    delayVal = state.delay;
                } else if (typeof state.delay === 'string') {
                    if (/^\d+$/.test(state.delay)) {
                        delayVal = parseInt(state.delay, 10);
                    } else {
                        const resolvedDelay = resolvePath(app, state.ctx, state.delay);
                        if (typeof resolvedDelay === 'number') {
                            delayVal = resolvedDelay;
                        } else if (resolvedDelay !== undefined) {
                            delayVal = parseInt(resolvedDelay, 10) || DEBOUNCE_DEFAULT_DELAY;
                        }
                    }
                }

                log('event fired:', state.evtType, '— waiting', delayVal, 'ms');
                clearTimeout(state.timeout);
                state.timeout = setTimeout(() => {
                    state.timeout = null;
                    if (!state.callData) {
                        log('no callData parsed from expression — nothing to run');
                        return;
                    }
                    const fn = resolvePath(app, state.ctx, state.callData.fnPath);
                    log('resolved', JSON.stringify(state.callData.fnPath), '->', typeof fn, fn);
                    if (typeof fn === 'function') {
                        const argsToPass = state.callData.args.length > 0
                            ? evaluateArgs(app, state.ctx, state.callData.args, { event: e })
                            : [e];
                        log('calling with args:', argsToPass);
                        fn.apply(state.ctx, argsToPass);
                    } else if (app && app.config && app.config.allowInlineExpressions) {
                        try {
                            new Function("$ctx", "$event", `with($ctx) { ${state.expression} }`)(state.ctx, e);
                        } catch (err) {
                            console.error(`[directives] [debounce] Error running inline expression:`, err);
                        }
                    } else {
                        console.warn(`[directives] [debounce] Cannot resolve function "${state.callData.fnPath}" on context.`, { ctx: state.ctx });
                    }
                }, delayVal);
            };

            el.addEventListener(evtType, state.handler);
            if (typeof trackCleanup === 'function') {
                trackCleanup(() => {
                    log('cleanup — removing listener', state.evtType);
                    el.removeEventListener(state.evtType, state.handler);
                    clearTimeout(state.timeout);
                    debounceStates.delete(el);
                });
            }
        },

        updated(el, binding) {
            const state = debounceStates.get(el);
            if (!state) return;

            // Clear any in-flight timer so previous expression/context does not execute
            clearTimeout(state.timeout);
            state.timeout = null;

            const { value, arg, ctx } = binding;
            const newEvtType = arg || DEBOUNCE_DEFAULT_EVENT;

            const raw = (typeof value === 'string' ? value : String(value ?? '')).trim();
            const { expression, delay } = parseDebounceValue(raw);
            const callData = parseCall(expression);

            state.delay = delay;
            state.callData = callData;
            state.expression = expression;
            state.ctx = ctx;

            if (newEvtType !== state.evtType) {
                log('event type updated from', state.evtType, 'to', newEvtType);
                el.removeEventListener(state.evtType, state.handler);
                state.evtType = newEvtType;
                el.addEventListener(state.evtType, state.handler);
            }
        }
    };
}
