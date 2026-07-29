import { logger } from './shared.js';
import { globalConfig } from '../app/config.js';

export const activeEffectRegistry = new Set();

export function registerActiveEffect(eff) {
    if (!globalConfig.debug) return;
    activeEffectRegistry.add(eff);
}

export function unregisterActiveEffect(eff) {
    if (!globalConfig.debug) return;
    activeEffectRegistry.delete(eff);
}

export function checkMemoryLeaks() {
    if (!globalConfig.debug) return [];
    const leaks = [];
    activeEffectRegistry.forEach((eff) => {
        if (!eff._registeredInstances || eff._registeredInstances.size === 0) {
            leaks.push({
                id: eff.id,
                name: eff._name || eff.name || "Anonymous Effect",
                depsCount: eff.deps ? eff.deps.size : 0
            });
        }
    });
    if (leaks.length > 0) {
        logger.warn(`[Memory Leak Detection] ${leaks.length} effects running outside any instance lifecycle context:`, "perf", leaks);
    }
    return leaks;
}
