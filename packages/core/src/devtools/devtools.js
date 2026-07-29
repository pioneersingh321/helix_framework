import { globalPlugins, targetMap, RAW, VERSION } from '../shared/shared.js';
import { activeEffectRegistry } from '../shared/memory.js';
import { getProfileData } from '../shared/profiler.js';

export function initDevtools() {
    if (typeof window === "undefined") return devtoolsAPI;
    if (!window.__HELIX_DEVTOOLS__) {
        const listeners = new Map();
        window.__HELIX_DEVTOOLS__ = {
            version: VERSION,
            apps: new Set(),
            on(event, fn) {
                if (!listeners.has(event)) listeners.set(event, new Set());
                listeners.get(event).add(fn);
            },
            emit(event, payload) {
                const set = listeners.get(event);
                if (set) set.forEach((fn) => { try { fn(payload); } catch (e) {} });
            },
            api: devtoolsAPI
        };
    }
    return window.__HELIX_DEVTOOLS__;
}

export function inspectTree(instance) {
    if (!instance) return null;
    const treeNode = {
        id: instance.id,
        name: instance.name || "Anonymous",
        hasProvides: !!instance.provides,
        cleanupsCount: instance.cleanups ? instance.cleanups.length : 0,
        children: []
    };
    if (instance.root && instance.root.querySelectorAll) {
        const childEls = instance.root.querySelectorAll("*");
        childEls.forEach((el) => {
            if (el.__hx_binding && el.__hx_binding.instance && el.__hx_binding.instance.parent === instance) {
                const childTree = inspectTree(el.__hx_binding.instance);
                if (childTree && !treeNode.children.some((c) => c.id === childTree.id)) {
                    treeNode.children.push(childTree);
                }
            }
        });
    }
    return treeNode;
}

export const devtoolsAPI = {
    getScopes() {
        const scopes = [];
        activeEffectRegistry.forEach((eff) => {
            if (eff._scope) {
                scopes.push({
                    id: eff._scope.id || 0,
                    active: eff._scope.active,
                    effectsCount: eff._scope.effects ? eff._scope.effects.length : 0,
                    cleanupsCount: eff._scope.cleanups ? eff._scope.cleanups.length : 0
                });
            }
        });
        return scopes;
    },
    getEffects() {
        const list = [];
        activeEffectRegistry.forEach((eff) => {
            list.push({
                id: eff.id,
                name: eff._name || eff.name || "Anonymous Effect",
                priority: eff.priority || 0,
                active: eff.active !== false,
                depsCount: eff.deps ? eff.deps.size : 0
            });
        });
        return list;
    },
    getDependencies(target) {
        if (!target || typeof target !== "object") return [];
        const rawTarget = target[RAW] || target;
        const depsMap = targetMap.get(rawTarget);
        if (!depsMap) return [];
        const result = [];
        depsMap.forEach((subscribers, key) => {
            result.push({
                key,
                subscribersCount: subscribers ? subscribers.size : 0
            });
        });
        return result;
    },
    getTimings() {
        return getProfileData();
    }
};
