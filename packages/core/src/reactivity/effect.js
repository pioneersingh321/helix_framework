import {
    activeEffect,
    setActiveEffect,
    shouldTrack,
    setShouldTrack,
    incrementEffectUid,
    currentBlock,
    targetMap,
    activeScope,
    currentInstance,
    handleError,
    trace,
    warn
} from '../shared/shared.js';
import { queueJob, flushJobs, pauseQueueFlush, resumeQueueFlush } from './scheduler.js';

let batchDepth = 0;
const batchedEffects = new Set();

export function batch(fn, options = {}) {
    if (batchDepth === 0) pauseQueueFlush();
    batchDepth++;
    const priorityOverride = options && typeof options.priority === "number" ? options.priority : null;
    try {
        return fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            const effectsToRun = Array.from(batchedEffects);
            batchedEffects.clear();
            effectsToRun.forEach((effectFn) => {
                if (effectFn.active && !effectFn.paused) {
                    const prio = priorityOverride !== null ? priorityOverride : (effectFn.priority || 0);
                    if (effectFn.scheduler) effectFn.scheduler();
                    else queueJob(effectFn, prio);
                }
            });
            resumeQueueFlush();
        }
    }
}

batch.high = (fn) => batch(fn, { priority: 10 });
batch.low = (fn) => batch(fn, { priority: -10 });

const trackStack = [];

export function pauseTracking() {
    trackStack.push(shouldTrack);
    setShouldTrack(false);
}

export function enableTracking() {
    trackStack.push(shouldTrack);
    setShouldTrack(true);
}

export function resetTracking() {
    const last = trackStack.pop();
    setShouldTrack(last === undefined ? true : last);
}

export function resumeTracking() {
    trackStack.length = 0;
    setShouldTrack(true);
}

export function untrack(fn) {
    pauseTracking();
    try {
        return fn();
    } finally {
        resetTracking();
    }
}

export function track(target, key) {
    if (!activeEffect || !shouldTrack) return;
    let depsMap = targetMap.get(target);
    if (!depsMap) targetMap.set(target, depsMap = new Map());
    let dep = depsMap.get(key);
    if (!dep) depsMap.set(key, dep = new Set());
    if (dep.has(activeEffect)) return;
    dep.add(activeEffect);
    activeEffect.deps.add(dep);
    if (activeEffect.onTrack) {
        try { activeEffect.onTrack({ target, key, effect: activeEffect }); } catch (e) {}
    }
}

export function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap) return;
    const dep = depsMap.get(key);
    const wildcardDep = key !== "*" ? depsMap.get("*") : void 0;
    if (!dep && !wildcardDep) return;
    const effectsToRun = new Set();
    const collect = (effectFn) => {
        if (effectFn !== activeEffect) effectsToRun.add(effectFn);
    };
    if (dep) dep.forEach(collect);
    if (wildcardDep) wildcardDep.forEach(collect);
    effectsToRun.forEach((effectFn) => {
        if (!effectFn.active || effectFn.paused) return;
        if (effectFn.onTrigger) {
            try { effectFn.onTrigger({ target, key, effect: effectFn }); } catch (e) {}
        }
        if (batchDepth > 0) {
            batchedEffects.add(effectFn);
        } else {
            if (effectFn.scheduler) effectFn.scheduler();
            else queueJob(effectFn, effectFn.priority || 0);
        }
    });
}

export function cleanupDeps(effectFn) {
    if (effectFn.deps) {
        effectFn.deps.forEach((depSet) => depSet.delete(effectFn));
        effectFn.deps.clear();
    }
}

import {
    registerActiveEffect,
    unregisterActiveEffect
} from '../shared/memory.js';

export function cleanup(effectFn) {
    if (effectFn.onCleanupFn) {
        effectFn.onCleanupFn();
        effectFn.onCleanupFn = null;
    }
    cleanupDeps(effectFn);
}

export function simpleEffect(fn, options = {}) {
    if (typeof options === "string") options = { name: options };
    const name = options.name || "Simple Effect";
    const area = options.area || "reactive";
    let active = true;
    let value;
    const run = () => {
        if (!active) return;
        const prev = activeEffect;
        setActiveEffect(null);
        try {
            value = trace(name, area, () => fn());
        } catch (err) {
            handleError(err, `simpleEffect: ${name}`);
        } finally {
            setActiveEffect(prev);
        }
    };
    run();
    return {
        stop: () => { active = false; },
        run,
        get value() { return value; }
    };
}

export function parsePriority(prio) {
    if (typeof prio === "number") return prio;
    if (prio === "high") return 10;
    if (prio === "low") return -10;
    if (prio === "normal") return 0;
    return 0;
}

export function effect(fn, options = {}) {
    if (typeof options === "string") options = { name: options };
    const name = options.name || "Anonymous Effect";
    const area = options.area || "reactive";
    const effectFunc = () => {
        if (!effectFunc.active || effectFunc.paused) return;
        cleanup(effectFunc);
        const prevBlock = currentBlock;
        if (currentBlock) currentBlock.push(effectFunc);
        const prev = activeEffect;
        setActiveEffect(effectFunc);
        const onCleanup = (cb) => {
            effectFunc.onCleanupFn = cb;
        };
        try {
            return trace(name, area, () => fn(onCleanup));
        } catch (err) {
            handleError(err, `effect: ${name}`);
        } finally {
            setActiveEffect(prev);
        }
    };
    effectFunc.id = incrementEffectUid();
    effectFunc._name = name;
    effectFunc.scheduler = options.scheduler;
    effectFunc.priority = parsePriority(options.priority);
    effectFunc.deps = new Set();
    effectFunc.active = true;
    effectFunc.paused = false;
    effectFunc.onTrack = options.onTrack;
    effectFunc.onTrigger = options.onTrigger;
    effectFunc.pause = () => { effectFunc.paused = true; };
    effectFunc.resume = () => {
        if (effectFunc.paused) {
            effectFunc.paused = false;
            effectFunc();
        }
    };
    effectFunc.stop = () => {
        if (effectFunc.active) {
            effectFunc.active = false;
            cleanup(effectFunc);
            unregisterActiveEffect(effectFunc);
        }
    };
    registerActiveEffect(effectFunc);
    if (activeScope && !activeScope.effects.includes(effectFunc)) {
        activeScope.effects.push(effectFunc);
    }
    if (!options.lazy) effectFunc();
    if (currentInstance) {
        if (!effectFunc._registeredInstances) effectFunc._registeredInstances = new Set();
        if (!effectFunc._registeredInstances.has(currentInstance.id)) {
            effectFunc._registeredInstances.add(currentInstance.id);
            currentInstance.cleanups.push(() => stopEffect(effectFunc));
        }
    }
    return effectFunc;
}

export function stopEffect(effectFn) {
    if (effectFn && typeof effectFn.stop === "function") {
        effectFn.stop();
    } else {
        cleanup(effectFn);
    }
}

