import { resolvePath } from '../parser.js';

function parseFeedbackClass(modifiers) {
    const feedbackClassMod = modifiers.find(m => m === 'class' || m.startsWith('class'));
    let feedbackClass = 'copied';
    if (feedbackClassMod) {
        if (feedbackClassMod.includes('.') || feedbackClassMod.includes('-')) {
            feedbackClass = feedbackClassMod.replace(/^class[.-]/, '');
        } else {
            const idx = modifiers.indexOf(feedbackClassMod);
            const nextMod = modifiers[idx + 1];
            if (nextMod && !nextMod.startsWith('duration')) {
                feedbackClass = nextMod;
            }
        }
    }
    return feedbackClass;
}

function parseFeedbackDuration(modifiers) {
    let duration = 2000;
    const durMod = modifiers.find(m => m === 'duration' || m.startsWith('duration'));
    if (durMod) {
        if (durMod.includes('.') || durMod.includes('-')) {
            const parsed = parseInt(durMod.replace(/^duration[.-]/, ''), 10);
            if (!isNaN(parsed)) duration = parsed;
        } else {
            const idx = modifiers.indexOf(durMod);
            const nextMod = modifiers[idx + 1];
            if (nextMod) {
                const parsed = parseInt(nextMod, 10);
                if (!isNaN(parsed)) duration = parsed;
            }
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

async function copyTextToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {}
    }
    if (typeof document !== 'undefined' && document.body) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            const success = document.execCommand('copy');
            document.body.removeChild(ta);
            return success;
        } catch (err) {
            try { document.body.removeChild(ta); } catch (e) {}
            return false;
        }
    }
    return false;
}

const clipboardStates = new WeakMap();

export function createClipboardDirective(app, config = {}) {
    const debug = !!config.debug;
    const log = (...args) => { if (debug) console.log('[directives] [clipboard]', ...args); };

    return {
        mounted(el, binding) {
            const { value, modifiers = [], ctx, trackCleanup } = binding;

            const state = {
                value,
                modifiers,
                ctx,
                feedbackClass: parseFeedbackClass(modifiers),
                feedbackDuration: parseFeedbackDuration(modifiers),
                resetTimer: null,
                onClick: null
            };
            clipboardStates.set(el, state);

            state.onClick = async (e) => {
                let textToCopy = '';
                if (state.value !== undefined && state.value !== null && state.value !== '') {
                    const resolved = resolvePath(app, state.ctx, state.value, state.value);
                    textToCopy = String(resolved ?? '');
                } else {
                    textToCopy = el.value || el.textContent || '';
                }

                const success = await copyTextToClipboard(textToCopy);
                log('copied text:', textToCopy, 'success:', success);

                if (success) {
                    el.classList.add(state.feedbackClass);
                    clearTimeout(state.resetTimer);
                    state.resetTimer = setTimeout(() => {
                        el.classList.remove(state.feedbackClass);
                    }, state.feedbackDuration);
                }

                if (typeof el.dispatchEvent === 'function') {
                    const customEvent = typeof CustomEvent !== 'undefined'
                        ? new CustomEvent('copied', {
                            detail: { text: textToCopy, success },
                            bubbles: true,
                            cancelable: true
                        })
                        : { type: 'copied', detail: { text: textToCopy, success } };
                    el.dispatchEvent(customEvent);
                }
            };

            el.addEventListener('click', state.onClick);

            if (typeof trackCleanup === 'function') {
                trackCleanup(() => {
                    clearTimeout(state.resetTimer);
                    el.removeEventListener('click', state.onClick);
                    clipboardStates.delete(el);
                });
            }
        },

        updated(el, binding) {
            const state = clipboardStates.get(el);
            if (!state) return;

            if (state.resetTimer) {
                clearTimeout(state.resetTimer);
                state.resetTimer = null;
                if (state.feedbackClass && typeof el.classList?.remove === 'function') {
                    el.classList.remove(state.feedbackClass);
                }
            }

            const { value, modifiers = [], ctx } = binding;
            state.value = value;
            state.modifiers = modifiers;
            state.ctx = ctx;
            state.feedbackClass = parseFeedbackClass(modifiers);
            state.feedbackDuration = parseFeedbackDuration(modifiers);
        }
    };
}
