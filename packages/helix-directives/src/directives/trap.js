import { resolveBool } from '../parser.js';

const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

function getFocusableElements(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
        return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
}

// Shared body scroll lock counter for safe nested/overlapping trap instances
let bodyScrollLockCount = 0;
let originalBodyOverflow = '';

function lockBodyScroll() {
    if (typeof document === 'undefined' || !document.body) return;
    if (bodyScrollLockCount === 0) {
        originalBodyOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
    }
    bodyScrollLockCount++;
}

function unlockBodyScroll() {
    if (typeof document === 'undefined' || !document.body) return;
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
    }
}

// Global inert ownership tracker for robust nested and overlapping traps
const inertOwnersMap = new Map();
const originalElementInertMap = new Map();
let trapInstanceCounter = 0;

function getElementsOutside(container) {
    const outside = new Set();
    if (!container || typeof document === 'undefined' || !document.body) return outside;

    // Safety guard: If container is not attached to document.body, do NOT lock document.body elements!
    if (!document.body.contains(container)) {
        return outside;
    }

    // Track all ancestors of the container up to document.body
    const ancestors = new Set();
    let p = container;
    while (p) {
        ancestors.add(p);
        p = p.parentNode;
    }

    let curr = container;
    while (curr && curr !== document.body && curr.parentNode) {
        const parent = curr.parentNode;
        const siblings = Array.from(parent.children || parent.childNodes || []).filter(n => n.nodeType === 1);
        for (const sibling of siblings) {
            if (!ancestors.has(sibling) && !sibling.contains(container) && sibling.tagName !== 'SCRIPT' && sibling.tagName !== 'STYLE') {
                outside.add(sibling);
            }
        }
        curr = parent;
    }

    if (document.body) {
        Array.from(document.body.children || []).forEach(child => {
            if (!ancestors.has(child) && !child.contains(container) && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
                outside.add(child);
            }
        });
    }
    return outside;
}

function applyInertOutside(container, trapId) {
    const outsideElements = getElementsOutside(container);
    const lockedElements = [];

    outsideElements.forEach(el => {
        let owners = inertOwnersMap.get(el);
        if (!owners) {
            owners = new Set();
            inertOwnersMap.set(el, owners);
            originalElementInertMap.set(el, {
                inert: el.inert,
                ariaHidden: el.getAttribute ? el.getAttribute('aria-hidden') : null
            });
        }
        owners.add(trapId);
        el.inert = true;
        if (typeof el.setAttribute === 'function') el.setAttribute('aria-hidden', 'true');
        lockedElements.push(el);
    });

    return () => {
        lockedElements.forEach(el => {
            const owners = inertOwnersMap.get(el);
            if (owners) {
                owners.delete(trapId);
                if (owners.size === 0) {
                    inertOwnersMap.delete(el);
                    const orig = originalElementInertMap.get(el);
                    originalElementInertMap.delete(el);
                    if (orig) {
                        if (orig.inert !== undefined) el.inert = orig.inert;
                        else delete el.inert;

                        if (typeof el.setAttribute === 'function' && typeof el.removeAttribute === 'function') {
                            if (orig.ariaHidden !== null) el.setAttribute('aria-hidden', orig.ariaHidden);
                            else el.removeAttribute('aria-hidden');
                        }
                    }
                }
            }
        });
    };
}

const trapStates = new WeakMap();

export function createTrapDirective(app, config = {}) {
    const debug = !!config.debug;
    const log = (...args) => { if (debug) console.log('[directives] [trap]', ...args); };

    return {
        mounted(el, binding) {
            const { value, modifiers = [], ctx, trackCleanup } = binding;
            const trapId = ++trapInstanceCounter;

            const state = {
                id: trapId,
                value,
                modifiers,
                ctx,
                isActive: false,
                bodyScrollLocked: false,
                lastParent: el.parentNode,
                addedTabIndex: false,
                previouslyFocused: null,
                restoreInert: null,
                frame: null,
                trigger: null
            };
            trapStates.set(el, state);

            const onKeydown = (e) => {
                if (e.key !== 'Tab' || !state.isActive) return;

                const focusables = getFocusableElements(el);
                if (focusables.length === 0) {
                    e.preventDefault();
                    return;
                }

                const firstEl = focusables[0];
                const lastEl = focusables[focusables.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl || !el.contains(document.activeElement)) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl || !el.contains(document.activeElement)) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            };

            const cancelFrame = () => {
                if (state.frame != null) {
                    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.frame);
                    else clearTimeout(state.frame);
                    state.frame = null;
                }
            };

            const syncInert = () => {
                if (!state.isActive) return;
                const isInert = state.modifiers.includes('inert');
                if (!isInert) return;

                if (typeof document !== 'undefined' && document.body && !document.body.contains(el)) {
                    const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
                    nextFrame(() => {
                        if (state.isActive && !state.restoreInert && document.body && document.body.contains(el)) {
                            state.restoreInert = applyInertOutside(el, state.id);
                            state.lastParent = el.parentNode;
                        }
                    });
                    return;
                }

                if (!state.restoreInert) {
                    state.restoreInert = applyInertOutside(el, state.id);
                    state.lastParent = el.parentNode;
                }
            };

            const activate = () => {
                if (state.isActive) return;
                state.isActive = true;
                state.previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;

                const isNoScroll = state.modifiers.includes('noscroll');

                if (isNoScroll && !state.bodyScrollLocked) {
                    lockBodyScroll();
                    state.bodyScrollLocked = true;
                }

                syncInert();

                if (typeof document !== 'undefined') {
                    document.addEventListener('keydown', onKeydown);
                }

                cancelFrame();
                const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
                state.frame = nextFrame(() => {
                    state.frame = null;
                    const focusables = getFocusableElements(el);
                    if (focusables.length > 0) {
                        focusables[0].focus();
                    } else if (typeof el.focus === 'function') {
                        if (!el.hasAttribute('tabindex')) {
                            el.setAttribute('tabindex', '-1');
                            state.addedTabIndex = true;
                        }
                        el.focus();
                    }
                    log('focus trapped inside', el);
                });
            };

            const deactivate = () => {
                if (!state.isActive) return;
                state.isActive = false;
                cancelFrame();

                if (typeof document !== 'undefined') {
                    document.removeEventListener('keydown', onKeydown);
                }

                if (state.bodyScrollLocked) {
                    unlockBodyScroll();
                    state.bodyScrollLocked = false;
                }

                if (typeof state.restoreInert === 'function') {
                    state.restoreInert();
                    state.restoreInert = null;
                }

                if (state.addedTabIndex) {
                    el.removeAttribute('tabindex');
                    state.addedTabIndex = false;
                }

                if (state.previouslyFocused && typeof state.previouslyFocused.focus === 'function') {
                    const target = state.previouslyFocused;
                    const isConnected = target.isConnected !== undefined ? target.isConnected : true;
                    const isNotDisabled = !target.disabled && (typeof target.getAttribute !== 'function' || target.getAttribute('disabled') === null);
                    const isNotInert = !target.inert;

                    if (isConnected && isNotDisabled && isNotInert) {
                        try { target.focus(); } catch (e) {}
                    }
                }
                state.previouslyFocused = null;
                log('focus released');
            };

            const effectFn = () => {
                let shouldTrap = true;
                if (state.value !== undefined && state.value !== null && state.value !== '') {
                    shouldTrap = resolveBool(app, state.ctx, state.value);
                }

                if (shouldTrap) activate();
                else deactivate();
            };

            state.trigger = effectFn;

            let effectCleanup = null;
            if (app && typeof app.effect === 'function') {
                const eff = app.effect(effectFn, { name: 'trap', area: 'directive' });
                effectCleanup = () => {
                    if (app.cleanup) app.cleanup(eff);
                    else if (eff.stop) eff.stop();
                };
            } else {
                effectFn();
            }

            if (typeof trackCleanup === 'function') {
                trackCleanup(() => {
                    deactivate();
                    if (effectCleanup) effectCleanup();
                    trapStates.delete(el);
                });
            }
        },

        updated(el, binding) {
            const state = trapStates.get(el);
            if (!state) return;

            const { value, modifiers = [], ctx } = binding;

            state.value = value;
            state.modifiers = modifiers;
            state.ctx = ctx;

            let shouldTrap = true;
            if (value !== undefined && value !== null && value !== '') {
                shouldTrap = resolveBool(app, ctx, value);
            }

            if (state.isActive) {
                if (!shouldTrap) {
                    // Truthiness changed to false -> deactivate
                    if (typeof state.trigger === 'function') state.trigger();
                } else {
                    // Reconcile noscroll with deterministic ownership
                    const isNoScroll = modifiers.includes('noscroll');
                    if (isNoScroll && !state.bodyScrollLocked) {
                        lockBodyScroll();
                        state.bodyScrollLocked = true;
                    } else if (!isNoScroll && state.bodyScrollLocked) {
                        unlockBodyScroll();
                        state.bodyScrollLocked = false;
                    }

                    // Reconcile inert and handle dynamic reparenting/DOM movement
                    const isInert = modifiers.includes('inert');
                    const parentChanged = el.parentNode !== state.lastParent;
                    if (!isInert) {
                        if (typeof state.restoreInert === 'function') {
                            state.restoreInert();
                            state.restoreInert = null;
                        }
                    } else if (isInert) {
                        if (!state.restoreInert || parentChanged) {
                            if (typeof state.restoreInert === 'function') {
                                state.restoreInert();
                                state.restoreInert = null;
                            }
                            if (typeof document !== 'undefined' && document.body && !document.body.contains(el)) {
                                const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
                                nextFrame(() => {
                                    if (state.isActive && !state.restoreInert && document.body && document.body.contains(el)) {
                                        state.restoreInert = applyInertOutside(el, state.id);
                                        state.lastParent = el.parentNode;
                                    }
                                });
                            } else {
                                state.restoreInert = applyInertOutside(el, state.id);
                                state.lastParent = el.parentNode;
                            }
                        }
                    }
                }
            } else {
                if (shouldTrap) {
                    if (typeof state.trigger === 'function') state.trigger();
                }
            }
        }
    };
}
