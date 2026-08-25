import { nextTick, RAW } from '../shared/shared.js';
import { globalConfig } from '../app/config.js';

export function nextFrame(fn) {
    if (typeof requestAnimationFrame === 'function') {
        let handle2 = null;
        let cancelled = false;
        const handle1 = requestAnimationFrame(() => {
            if (cancelled) return;
            handle2 = requestAnimationFrame(() => {
                if (cancelled) return;
                fn();
            });
        });
        return () => {
            cancelled = true;
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(handle1);
                if (handle2 !== null) cancelAnimationFrame(handle2);
            }
        };
    } else {
        let cancelled = false;
        const timer = setTimeout(() => {
            if (!cancelled) fn();
        }, 16);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }
}

export function parseClasses(classStr) {
    if (!classStr) return [];
    if (Array.isArray(classStr)) return classStr;
    return String(classStr).trim().split(/\s+/).filter(Boolean);
}

export function addClasses(el, classes) {
    if (!el || !classes) return;
    const list = Array.isArray(classes) ? classes : parseClasses(classes);
    if (el.classList && typeof el.classList.add === 'function') {
        list.forEach((cls) => { if (cls) el.classList.add(cls); });
    } else if (el.className !== undefined) {
        const existing = new Set(parseClasses(el.className));
        list.forEach((cls) => { if (cls) existing.add(cls); });
        el.className = Array.from(existing).join(' ');
    }
}

export function removeClasses(el, classes) {
    if (!el || !classes) return;
    const list = Array.isArray(classes) ? classes : parseClasses(classes);
    if (el.classList && typeof el.classList.remove === 'function') {
        list.forEach((cls) => { if (cls) el.classList.remove(cls); });
    } else if (el.className !== undefined) {
        const existing = new Set(parseClasses(el.className));
        list.forEach((cls) => { existing.delete(cls); });
        el.className = Array.from(existing).join(' ');
    }
}

export function getTransitionDurations(el) {
    const rawEl = el && el[RAW] ? el[RAW] : el;
    if (typeof window === 'undefined' || !window.getComputedStyle || !rawEl || rawEl.nodeType !== 1) {
        return { duration: 0, delay: 0, total: 0, longestProperties: [], allProperties: [], longestAnimationNames: [] };
    }
    try {
        const styles = window.getComputedStyle(rawEl);

        // Transitions
        const rawTransDur = styles.transitionDuration || '0s';
        const rawTransDelay = styles.transitionDelay || '0s';
        const rawTransProp = styles.transitionProperty || 'all';
        const transDurParts = rawTransDur.split(',').map((s) => s.trim());
        const transDelayParts = rawTransDelay.split(',').map((s) => s.trim());
        const transPropParts = rawTransProp.split(',').map((s) => s.trim());
        const numTrans = Math.max(transDurParts.length, transDelayParts.length, transPropParts.length);

        let maxTransTotal = 0;
        let maxTransDur = 0;
        let maxTransDelay = 0;
        let longestTransProps = [];
        let allTransProps = [];

        for (let i = 0; i < numTrans; i++) {
            const durStr = transDurParts[i % transDurParts.length] || '0s';
            const delayStr = transDelayParts[i % transDelayParts.length] || '0s';
            const propName = transPropParts[i % transPropParts.length] || 'all';
            const durMs = parseFloat(durStr) * (durStr.endsWith('ms') ? 1 : 1000) || 0;
            const delayMs = parseFloat(delayStr) * (delayStr.endsWith('ms') ? 1 : 1000) || 0;
            const total = durMs + delayMs;
            if (total > 0) {
                allTransProps.push(propName);
            }
            if (total > maxTransTotal) {
                maxTransTotal = total;
                maxTransDur = durMs;
                maxTransDelay = delayMs;
                longestTransProps = [propName];
            } else if (total === maxTransTotal && total > 0) {
                longestTransProps.push(propName);
            }
        }

        // Animations
        const rawAnimDur = styles.animationDuration || '0s';
        const rawAnimDelay = styles.animationDelay || '0s';
        const rawAnimName = styles.animationName || 'none';
        const animDurParts = rawAnimDur.split(',').map((s) => s.trim());
        const animDelayParts = rawAnimDelay.split(',').map((s) => s.trim());
        const animNameParts = rawAnimName.split(',').map((s) => s.trim());
        const numAnim = Math.max(animDurParts.length, animDelayParts.length, animNameParts.length);

        let maxAnimTotal = 0;
        let maxAnimDur = 0;
        let maxAnimDelay = 0;
        let longestAnimNames = [];

        for (let i = 0; i < numAnim; i++) {
            const durStr = animDurParts[i % animDurParts.length] || '0s';
            const delayStr = animDelayParts[i % animDelayParts.length] || '0s';
            const name = animNameParts[i % animNameParts.length] || 'none';
            const durMs = parseFloat(durStr) * (durStr.endsWith('ms') ? 1 : 1000) || 0;
            const delayMs = parseFloat(delayStr) * (delayStr.endsWith('ms') ? 1 : 1000) || 0;
            const total = durMs + delayMs;
            if (total > maxAnimTotal) {
                maxAnimTotal = total;
                maxAnimDur = durMs;
                maxAnimDelay = delayMs;
                longestAnimNames = [name];
            } else if (total === maxAnimTotal && total > 0) {
                longestAnimNames.push(name);
            }
        }

        if (maxTransTotal >= maxAnimTotal) {
            return {
                duration: maxTransDur,
                delay: maxTransDelay,
                total: maxTransTotal,
                longestProperties: longestTransProps,
                allProperties: allTransProps,
                longestAnimationNames: [],
                type: 'transition'
            };
        } else {
            return {
                duration: maxAnimDur,
                delay: maxAnimDelay,
                total: maxAnimTotal,
                longestProperties: [],
                allProperties: [],
                longestAnimationNames: longestAnimNames,
                type: 'animation'
            };
        }
    } catch {
        return { duration: 0, delay: 0, total: 0, longestProperties: [], allProperties: [], longestAnimationNames: [] };
    }
}

export function resolveTransitionConfig(el, appConfig = {}) {
    if (!el || el.nodeType !== 1) return null;
    const prefix = appConfig.prefix || (globalConfig && globalConfig.prefix) || 'h-';
    const cleanPrefix = prefix.endsWith('-') ? prefix.slice(0, -1) : prefix;

    const hasTransitionAttr = el.hasAttribute(`${prefix}transition`) ||
        el.hasAttribute(`data-${prefix}transition`) ||
        el.hasAttribute('h-transition') ||
        el.hasAttribute('hx-transition') ||
        el.hasAttribute('data-h-transition') ||
        el.hasAttribute('data-hx-transition');

    const explicitName = el.getAttribute(`${prefix}transition`) ||
        el.getAttribute(`data-${prefix}transition`) ||
        el.getAttribute('h-transition') ||
        el.getAttribute('hx-transition') ||
        el.getAttribute('data-h-transition') ||
        el.getAttribute('data-hx-transition') ||
        el.getAttribute('name');

    if (!hasTransitionAttr && !explicitName && !el.hasAttribute('enter-active-class') && !el.hasAttribute(`${prefix}transition:enter`)) {
        return null;
    }

    const name = (explicitName && explicitName.trim() && explicitName !== 'true') ? explicitName.trim() : cleanPrefix;

    const getAttr = (attrList) => {
        for (const a of attrList) {
            if (el.hasAttribute(a)) return el.getAttribute(a);
        }
        return null;
    };

    const enterFromClass = getAttr([
        `${prefix}transition:enter-start`,
        `${prefix}transition:enter-from`,
        'enter-from-class',
        'enter-start-class'
    ]) || `${name}-enter-from`;

    const enterActiveClass = getAttr([
        `${prefix}transition:enter`,
        `${prefix}transition:enter-active`,
        'enter-active-class'
    ]) || `${name}-enter-active`;

    const enterToClass = getAttr([
        `${prefix}transition:enter-end`,
        `${prefix}transition:enter-to`,
        'enter-to-class',
        'enter-end-class'
    ]) || `${name}-enter-to`;

    const leaveFromClass = getAttr([
        `${prefix}transition:leave-start`,
        `${prefix}transition:leave-from`,
        'leave-from-class',
        'leave-start-class'
    ]) || `${name}-leave-from`;

    const leaveActiveClass = getAttr([
        `${prefix}transition:leave`,
        `${prefix}transition:leave-active`,
        'leave-active-class'
    ]) || `${name}-leave-active`;

    const leaveToClass = getAttr([
        `${prefix}transition:leave-end`,
        `${prefix}transition:leave-to`,
        'leave-to-class',
        'leave-end-class'
    ]) || `${name}-leave-to`;

    const moveClass = getAttr([
        `${prefix}transition:move`,
        'move-class'
    ]) || `${name}-move`;

    return {
        name,
        enterFromClass,
        enterActiveClass,
        enterToClass,
        leaveFromClass,
        leaveActiveClass,
        leaveToClass,
        moveClass
    };
}

export function fireTransitionHook(el, hookName, eventData = {}) {
    if (!el || typeof el.dispatchEvent !== 'function') return;
    try {
        const evt = typeof CustomEvent === 'function'
            ? new CustomEvent(hookName, { bubbles: false, cancelable: true, detail: eventData })
            : { type: hookName, detail: eventData, target: el };
        el.dispatchEvent(evt);
    } catch {}
}

export function cancelFlip(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.__hx_flip && typeof node.__hx_flip.cancel === 'function') {
        node.__hx_flip.cancel();
        node.__hx_flip = null;
    }
}

export function cancelTransition(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.__hx_current_transition && typeof el.__hx_current_transition.cancel === 'function') {
        el.__hx_current_transition.cancel();
        el.__hx_current_transition = null;
    }
    cancelFlip(el);
    if (el.__hx_enter_cancel) {
        try { el.__hx_enter_cancel(); } catch {}
        el.__hx_enter_cancel = null;
    }
    if (el.__hx_leave_cancel) {
        try { el.__hx_leave_cancel(); } catch {}
        el.__hx_leave_cancel = null;
    }
}

export function enter(el, config, onDone) {
    if (!el || el.nodeType !== 1) {
        if (onDone) onDone({ cancelled: false, el });
        return;
    }
    if (!config) {
        if (onDone) onDone({ cancelled: false, el });
        return;
    }

    cancelTransition(el);

    fireTransitionHook(el, 'before-enter');

    const { enterFromClass, enterActiveClass, enterToClass } = config;

    addClasses(el, enterFromClass);
    addClasses(el, enterActiveClass);

    let isDone = false;
    let fallbackTimer = null;
    let cancelNextFrame = null;
    let durations = null;

    const cleanupClasses = () => {
        removeClasses(el, enterToClass);
        removeClasses(el, enterActiveClass);
        removeClasses(el, enterFromClass);
    };

    const finish = (cancelled = false) => {
        if (isDone) return;
        isDone = true;
        if (cancelNextFrame) cancelNextFrame();
        if (fallbackTimer) clearTimeout(fallbackTimer);
        el.removeEventListener('transitionend', onEnd);
        el.removeEventListener('animationend', onEnd);
        cleanupClasses();

        // Remove node cleanup
        if (Array.isArray(el.__hx_cleanup)) {
            const idx = el.__hx_cleanup.indexOf(nodeCleanupFn);
            if (idx !== -1) el.__hx_cleanup.splice(idx, 1);
        }

        if (el.__hx_current_transition && el.__hx_current_transition.cancel === cancelRunner) {
            el.__hx_current_transition = null;
        }
        el.__hx_enter_cancel = null;
        fireTransitionHook(el, cancelled ? 'enter-cancelled' : 'after-enter');
        if (onDone) onDone({ cancelled, el });
    };

    const onEnd = (e) => {
        if (!e || e.target !== el) return;
        if (e.type === 'transitionend') {
            if (durations && durations.longestProperties && durations.longestProperties.length > 0) {
                const prop = e.propertyName;
                const isAll = durations.longestProperties.includes('all');
                const isMatch = isAll || (prop && durations.longestProperties.includes(prop));
                if (!isMatch) return;
            }
            finish(false);
        } else if (e.type === 'animationend') {
            if (durations && durations.longestAnimationNames && durations.longestAnimationNames.length > 0) {
                const animName = e.animationName;
                const isMatch = animName && durations.longestAnimationNames.includes(animName);
                if (!isMatch) return;
            }
            finish(false);
        }
    };

    const cancelRunner = () => {
        finish(true);
    };

    const nodeCleanupFn = () => {
        if (!isDone) {
            finish(true);
        }
    };

    el.__hx_cleanup = el.__hx_cleanup || [];
    el.__hx_cleanup.push(nodeCleanupFn);

    el.__hx_current_transition = { type: 'enter', cancel: cancelRunner };
    el.__hx_enter_cancel = cancelRunner;

    cancelNextFrame = nextFrame(() => {
        if (isDone) return;
        removeClasses(el, enterFromClass);
        addClasses(el, enterToClass);
        fireTransitionHook(el, 'enter');

        el.addEventListener('transitionend', onEnd);
        el.addEventListener('animationend', onEnd);

        durations = getTransitionDurations(el);
        const timeoutMs = durations.total > 0 ? durations.total + 50 : 20;
        fallbackTimer = setTimeout(() => finish(false), timeoutMs);
    });
}

export function leave(el, config, onDone) {
    if (!el || el.nodeType !== 1) {
        if (onDone) onDone({ cancelled: false, el });
        return;
    }
    if (!config) {
        if (onDone) onDone({ cancelled: false, el });
        return;
    }

    cancelTransition(el);

    fireTransitionHook(el, 'before-leave');

    const { leaveFromClass, leaveActiveClass, leaveToClass } = config;

    addClasses(el, leaveFromClass);
    addClasses(el, leaveActiveClass);

    let isDone = false;
    let fallbackTimer = null;
    let cancelNextFrame = null;
    let durations = null;

    const cleanupClasses = () => {
        removeClasses(el, leaveToClass);
        removeClasses(el, leaveActiveClass);
        removeClasses(el, leaveFromClass);
    };

    const finish = (cancelled = false) => {
        if (isDone) return;
        isDone = true;
        if (cancelNextFrame) cancelNextFrame();
        if (fallbackTimer) clearTimeout(fallbackTimer);
        el.removeEventListener('transitionend', onEnd);
        el.removeEventListener('animationend', onEnd);
        cleanupClasses();

        // Remove node cleanup
        if (Array.isArray(el.__hx_cleanup)) {
            const idx = el.__hx_cleanup.indexOf(nodeCleanupFn);
            if (idx !== -1) el.__hx_cleanup.splice(idx, 1);
        }

        if (el.__hx_current_transition && el.__hx_current_transition.cancel === cancelRunner) {
            el.__hx_current_transition = null;
        }
        el.__hx_leave_cancel = null;
        fireTransitionHook(el, cancelled ? 'leave-cancelled' : 'after-leave');
        if (onDone) onDone({ cancelled, el });
    };

    const onEnd = (e) => {
        if (!e || e.target !== el) return;
        if (e.type === 'transitionend') {
            if (durations && durations.longestProperties && durations.longestProperties.length > 0) {
                const prop = e.propertyName;
                const isAll = durations.longestProperties.includes('all');
                const isMatch = isAll || (prop && durations.longestProperties.includes(prop));
                if (!isMatch) return;
            }
            finish(false);
        } else if (e.type === 'animationend') {
            if (durations && durations.longestAnimationNames && durations.longestAnimationNames.length > 0) {
                const animName = e.animationName;
                const isMatch = animName && durations.longestAnimationNames.includes(animName);
                if (!isMatch) return;
            }
            finish(false);
        }
    };

    const cancelRunner = () => {
        finish(true);
    };

    const nodeCleanupFn = () => {
        if (!isDone) {
            finish(true);
        }
    };

    el.__hx_cleanup = el.__hx_cleanup || [];
    el.__hx_cleanup.push(nodeCleanupFn);

    el.__hx_current_transition = { type: 'leave', cancel: cancelRunner };
    el.__hx_leave_cancel = cancelRunner;

    cancelNextFrame = nextFrame(() => {
        if (isDone) return;
        removeClasses(el, leaveFromClass);
        addClasses(el, leaveToClass);
        fireTransitionHook(el, 'leave');

        el.addEventListener('transitionend', onEnd);
        el.addEventListener('animationend', onEnd);

        durations = getTransitionDurations(el);
        const timeoutMs = durations.total > 0 ? durations.total + 50 : 20;
        fallbackTimer = setTimeout(() => finish(false), timeoutMs);
    });
}


export function recordPositions(nodes) {
    const map = new Map();
    if (!nodes) return map;
    nodes.forEach((node) => {
        const rawNode = node && node[RAW] ? node[RAW] : node;
        if (rawNode && rawNode.nodeType === 1 && typeof rawNode.getBoundingClientRect === 'function') {
            try {
                map.set(rawNode, rawNode.getBoundingClientRect());
            } catch (_) {}
        }
    });
    return map;
}

export function applyFlip(oldPositions, moveClass = 'h-move') {
    if (!oldPositions || oldPositions.size === 0) return;
    const movedNodes = [];
    oldPositions.forEach((oldRect, node) => {
        const rawNode = node && node[RAW] ? node[RAW] : node;
        if (!rawNode || !rawNode.parentNode || typeof rawNode.getBoundingClientRect !== 'function') return;
        let newRect;
        try {
            newRect = rawNode.getBoundingClientRect();
        } catch (_) {
            return;
        }
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (dx !== 0 || dy !== 0) {
            cancelFlip(rawNode);
            movedNodes.push({ node: rawNode, dx, dy });
            rawNode.style.transform = `translate(${dx}px, ${dy}px)`;
            rawNode.style.transitionDuration = '0s';
        }
    });

    if (movedNodes.length === 0) return;

    movedNodes.forEach(({ node }) => {
        let isDone = false;
        let fallbackTimer = null;
        let cancelNextFrame = null;

        const cleanupFlip = () => {
            if (isDone) return;
            isDone = true;
            if (cancelNextFrame) cancelNextFrame();
            if (fallbackTimer) clearTimeout(fallbackTimer);
            node.removeEventListener('transitionend', onEnd);
            removeClasses(node, moveClass);
            node.style.transform = '';
            node.style.transitionDuration = '';
            if (node.__hx_flip && node.__hx_flip.cancel === cancelRunner) {
                node.__hx_flip = null;
            }
            if (Array.isArray(node.__hx_cleanup)) {
                const idx = node.__hx_cleanup.indexOf(nodeCleanupFn);
                if (idx !== -1) node.__hx_cleanup.splice(idx, 1);
            }
        };

        const onEnd = (e) => {
            if (e && e.target !== node) return;
            cleanupFlip();
        };

        const cancelRunner = () => {
            cleanupFlip();
        };

        const nodeCleanupFn = () => {
            cleanupFlip();
        };

        node.__hx_cleanup = node.__hx_cleanup || [];
        node.__hx_cleanup.push(nodeCleanupFn);

        node.__hx_flip = { cancel: cancelRunner };

        cancelNextFrame = nextFrame(() => {
            if (isDone) return;
            addClasses(node, moveClass);
            node.style.transform = '';
            node.style.transitionDuration = '';
            node.addEventListener('transitionend', onEnd);

            const durations = getTransitionDurations(node);
            const timeoutMs = durations.total > 0 ? durations.total + 50 : 500;
            fallbackTimer = setTimeout(() => {
                cleanupFlip();
            }, timeoutMs);
        });
    });
}
