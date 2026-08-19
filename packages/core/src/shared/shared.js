export const VERSION = typeof __CORE_VERSION__ !== 'undefined' ? __CORE_VERSION__ : "11.1.20";

export const RAW = Symbol("__hx_raw");
export const IS_REF = Symbol("__hx_is_ref");
export const IS_REACTIVE = Symbol("__hx_is_reactive");
export const IS_READONLY = Symbol("__hx_is_readonly");
export const IS_SHALLOW = Symbol("__hx_is_shallow");
export const SKIP = Symbol("__hx_skip");
export const BOUND = Symbol("bound");

export const PatchFlags = {
    TEXT: 1,
    CLASS: 2,
    STYLE: 4,
    PROPS: 8,
    FULL_PROPS: 16,
    HYDRATE_EVENTS: 32,
    STABLE_FRAGMENT: 64,
    KEYED_FRAGMENT: 128,
    UNKEYED_FRAGMENT: 256,
    NEED_PATCH: 512,
    DYNAMIC_SLOTS: 1024,
    DEV_ROOT_FRAGMENT: 2048
};

export const globalComponents = {};
export const globalDirectives = {};
export const globalPlugins = [];


// Global active tracking/context states
export let activeEffect = null;
export function setActiveEffect(effect) { activeEffect = effect; }

export let currentInstance = null;
export function setCurrentInstance(instance) { currentInstance = instance; }

export let shouldTrack = true;
export function setShouldTrack(val) { shouldTrack = val; }

export let effectUid = 0;
export function incrementEffectUid() { return effectUid++; }

export let globalInstanceId = 0;
export function incrementGlobalInstanceId() { return ++globalInstanceId; }

export let traceDepth = 0;
export function incrementTraceDepth() { traceDepth++; }
export function decrementTraceDepth() { traceDepth--; }

export let activeScope = null;
export function setActiveScope(scope) { activeScope = scope; }

export let currentBlock = null;
export function setCurrentBlock(block) { currentBlock = block; }
export function openBlock() { currentBlock = []; }
export function closeBlock() {
    const block = currentBlock;
    currentBlock = null;
    return block;
}

export const targetMap = new WeakMap();
export const reactiveMap = new WeakMap();
export const readonlyMap = new WeakMap();
export const staticNodeCache = new WeakMap();
export const effectCache = new WeakMap();
export const pathCache = new Map();
export const MAX_PATH_CACHE_SIZE = 1e3;
export const vForKeyMap = new WeakMap();
export const nodePool = new Map();

export const queue = [];
export const queueSet = new Set();
export const preFlushQueue = [];
export const postFlushQueue = [];
export const idleQueue = [];
export let idleCallbackId = null;
export function setIdleCallbackId(val) { idleCallbackId = val; }
export let isFlushing = false;
export function setIsFlushing(val) { isFlushing = val; }
export let isFlushPending = false;
export function setIsFlushPending(val) { isFlushPending = val; }
export const MAX_FLUSH = 1e3;
export const resolvedPromise = Promise.resolve();

export { AppRegistry, globalApps } from './registry.js';

import { globalConfig } from '../app/config.js';
import { stopEffect } from '../reactivity/effect.js';

const areas = {
    core: "🚀",
    component: "🧩",
    directive: "🛠️",
    plugin: "📦",
    binding: "🔗",
    scope: "🎯",
    reactive: "⚡",
    ref: "📍",
    watch: "👁️",
    computed: "🧮",
    scheduler: "🔄",
    queue: "📥",
    flush: "♻️",
    render: "🎨",
    dom: "🌳",
    template: "🧱",
    parser: "📜",
    compiler: "🏗️",
    event: "📢",
    network: "🌐",
    storage: "💾",
    cleanup: "🧹",
    destroy: "🗑️",
    validation: "✔️",
    security: "🔒",
    perf: "⏱️",
    config: "⚙️",
    api: "🔌",
    trace: "🔍"
};

function getLogPrefix(level, area) {
    const subsystemIcon = area ? (areas[area] || "") : "";
    let levelIcon = "";
    if (level === "trace") levelIcon = "🔍";
    else if (level === "debug") levelIcon = "🐞";
    else if (level === "info") levelIcon = "ℹ️";
    else if (level === "warn") levelIcon = "⚠️";
    else if (level === "error") levelIcon = "❌";
    else if (level === "fatal") levelIcon = "💥";
    else if (level === "perf") levelIcon = "⏱️";
    
    if (subsystemIcon) {
        if (level === "perf") return subsystemIcon;
        return `${levelIcon} [Helix ${subsystemIcon}]`;
    }
    return `${levelIcon} [Helix]`;
}

function parseLogArgs(args) {
    let area = undefined;
    let extraArgs = [];
    if (args.length > 0) {
        const first = args[0];
        if (typeof first === "string" && (first in areas)) {
            area = first;
            extraArgs = args.slice(1);
        } else if (first && typeof first === "object" && "area" in first) {
            area = first.area;
            extraArgs = args.slice(1);
        } else {
            extraArgs = args;
        }
    }
    return { area, args: extraArgs };
}

export const logger = {
    registerArea(name, icon) {
        areas[name] = icon;
    },
    trace(msg, ...args) {
        if (globalConfig.debug) {
            const parsed = parseLogArgs(args);
            console.debug(`${getLogPrefix("trace", parsed.area)} ${msg}`, ...parsed.args);
        }
    },
    debug(msg, ...args) {
        if (globalConfig.debug) {
            const parsed = parseLogArgs(args);
            console.debug(`${getLogPrefix("debug", parsed.area)} ${msg}`, ...parsed.args);
        }
    },
    info(msg, ...args) {
        const parsed = parseLogArgs(args);
        console.info(`${getLogPrefix("info", parsed.area)} ${msg}`, ...parsed.args);
    },
    warn(msg, ...args) {
        if (globalConfig.debug) {
            const parsed = parseLogArgs(args);
            console.warn(`${getLogPrefix("warn", parsed.area)} ${msg}`, ...parsed.args);
        }
    },
    error(msg, ...args) {
        const parsed = parseLogArgs(args);
        console.error(`${getLogPrefix("error", parsed.area)} ${msg}`, ...parsed.args);
    },
    fatal(msg, ...args) {
        const parsed = parseLogArgs(args);
        console.error(`${getLogPrefix("fatal", parsed.area)} ${msg}`, ...parsed.args);
    },
    perf(name, time, area) {
        if (globalConfig.debug) {
            const finalArea = area || "perf";
            const icon = getLogPrefix("perf", finalArea);
            console.log(`${icon} [Helix Perf] ${name} took ${time.toFixed(2)}ms`);
        }
    }
};

export const warn = (msg, area, ...args) => {
    logger.warn(msg, area, ...args);
};

export const globalErrorHandlers = new Set();

export function onErrorGlobal(handler) {
    if (typeof handler === "function") {
        globalErrorHandlers.add(handler);
        return () => globalErrorHandlers.delete(handler);
    }
}

export const handleError = (err, context, instance = null) => {
    logger.fatal(`Caught in ${context}:`, err);
    if (instance && instance.name) warn(`Crash in component <${instance.name}>:`, "component", err);
    else if (instance && instance.root) warn(`Crash in component:`, "component", instance.root);

    let handled = false;

    let cur = instance;
    while (cur) {
        const hooks = cur.errorCapturedHooks;
        if (hooks && hooks.length > 0) {
            for (let i = 0; i < hooks.length; i++) {
                try {
                    const result = hooks[i](err, instance, context);
                    if (result === false) {
                        handled = true;
                    }
                } catch (hErr) {
                    console.error("Error inside onErrorCaptured handler:", hErr);
                }
            }
        }
        if (handled) break;
        cur = cur.parent;
    }

    if (!handled && globalErrorHandlers.size > 0) {
        globalErrorHandlers.forEach((handler) => {
            try {
                const result = handler(err, instance, context);
                if (result === false) handled = true;
            } catch (hErr) {
                console.error("Error inside global error handler:", hErr);
            }
        });
    }

    if (!handled && globalConfig.rethrowErrors !== false) throw err;
};

export const callWithErrorHandling = (fn, instance, type, args) => {
    try {
        return args ? fn(...args) : fn();
    } catch (err) {
        handleError(err, type, instance);
    }
};

export const perfMarks = new Map();

export const trace = (name, ...args) => {
    let fn;
    let area = undefined;
    if (args.length === 2) {
        area = args[0];
        fn = args[1];
    } else {
        fn = args[0];
    }
    if (!globalConfig.debug) return fn();
    traceDepth++;
    const start = performance.now();
    let res;
    try {
        res = fn();
        return res;
    } finally {
        const time = performance.now() - start;
        traceDepth--;
        if (time > globalConfig.slowThreshold && traceDepth === 0) {
            logger.perf(name, time, area);
        }
    }
};

export function markTrace(name) {
    if (!globalConfig.debug) return;
    perfMarks.set(name, performance.now());
}

export function measureTrace(name, label) {
    if (!globalConfig.debug) return;
    const start = perfMarks.get(name);
    if (start) {
        const time = performance.now() - start;
        const displayName = label || name;
        let area = undefined;
        const lower = displayName.toLowerCase();
        if (lower.includes("mount")) area = "mount";
        else if (lower.includes("flush")) area = "flush";
        else if (lower.includes("scheduler")) area = "scheduler";
        logger.perf(displayName, time, area);
        perfMarks.delete(name);
    }
}

export function getLIS(arr) {
    const result = [];
    const prev = new Array(arr.length).fill(-1);
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === -1) continue;
        if (result.length === 0 || arr[result[result.length - 1]] < arr[i]) {
            prev[i] = result.length > 0 ? result[result.length - 1] : -1;
            result.push(i);
        } else {
            let left = 0, right = result.length - 1;
            while (left < right) {
                const mid = left + right >> 1;
                if (arr[result[mid]] < arr[i]) left = mid + 1;
                else right = mid;
            }
            prev[i] = left > 0 ? result[left - 1] : -1;
            result[left] = i;
        }
    }
    const lis = new Array(result.length);
    let k = result[result.length - 1];
    for (let i = result.length - 1; i >= 0; i--) {
        lis[i] = k;
        k = prev[k];
    }
    return lis;
}

export function nextTick(fn) {
    if (fn) {
        return resolvedPromise.then(fn).catch((err) => handleError(err, "nextTick"));
    }
    return resolvedPromise;
}

export function lazyBind(node, ctx, instance, bindNode, options = {}) {
    const { rootMargin = "100px", threshold = 0 } = options;
    if (typeof IntersectionObserver === "undefined") {
        bindNode(node, ctx, instance);
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                bindNode(node, ctx, instance);
                observer.unobserve(node);
            }
        });
    }, { rootMargin, threshold });
    observer.observe(node);
    if (!node.__hx_cleanup) node.__hx_cleanup = [];
    node.__hx_cleanup.push(() => observer.disconnect());
}

export class EffectScope {
    constructor() {
        this.effects = [];
        this.scopes = [];
        this.cleanups = [];
        this._busListeners = [];
        this.active = true;
        this.dirty = false;
        this._refreshPending = false;
        this.refreshCallbacks = new Set();
    }
    run(fn) {
        if (this.active) {
            const prev = activeScope;
            setActiveScope(this);
            try {
                return fn();
            } finally {
                setActiveScope(prev);
            }
        }
    }
    refresh() {
        if (!this.active || this._refreshPending) return;
        this.dirty = true;
        this._refreshPending = true;
        queueMicrotask(() => {
            if (!this.active) return;
            this._refreshPending = false;
            this.dirty = false;
            this.effects.forEach((eff) => {
                if (eff && eff.active && !eff.paused) {
                    if (eff.scheduler) eff.scheduler();
                    else eff();
                }
            });
            this.refreshCallbacks.forEach((cb) => {
                try { cb(); } catch (e) { handleError(e, "EffectScope refresh callback"); }
            });
        });
    }
    stop() {
        if (this.active) {
            for (let i = 0; i < this.scopes.length; i++) {
                try { this.scopes[i].stop(); } catch (e) {}
            }
            this.scopes.length = 0;
            for (let i = 0; i < this.effects.length; i++) {
                stopEffect(this.effects[i]);
            }
            this.effects.length = 0;
            for (let i = 0; i < this.cleanups.length; i++) {
                try { this.cleanups[i](); } catch (e) { handleError(e, "EffectScope cleanup"); }
            }
            this.cleanups.length = 0;
            for (let i = 0; i < this._busListeners.length; i++) {
                try { this._busListeners[i](); } catch (e) { }
            }
            this._busListeners.length = 0;
            this.refreshCallbacks.clear();
            this.active = false;
            this.dirty = false;
        }
    }
}

export function compareVersion(a, b) {
    const pa = String(a).split(/[-+\.]/).filter(Boolean);
    const pb = String(b).split(/[-+\.]/).filter(Boolean);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = parseInt(pa[i] || '0', 10);
        const nb = parseInt(pb[i] || '0', 10);
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

export function satisfiesVersion(version, range) {
    if (!range) return true;
    const v = String(version);
    const r = String(range).trim();
    if (r.startsWith('>=')) return compareVersion(v, r.slice(2)) >= 0;
    if (r.startsWith('>')) return compareVersion(v, r.slice(1)) > 0;
    if (r.startsWith('<=')) return compareVersion(v, r.slice(2)) <= 0;
    if (r.startsWith('<')) return compareVersion(v, r.slice(1)) < 0;
    if (r.startsWith('^')) {
        const major = r.slice(1).split('.')[0];
        return compareVersion(v, r.slice(1)) >= 0 && String(v).split('.')[0] === major;
    }
    if (r.startsWith('~')) {
        const parts = r.slice(1).split('.');
        return compareVersion(v, r.slice(1)) >= 0 && String(v).split('.').slice(0, 2).join('.') === parts.slice(0, 2).join('.');
    }
    return compareVersion(v, r) === 0;
}

