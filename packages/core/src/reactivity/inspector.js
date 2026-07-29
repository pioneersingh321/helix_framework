import { targetMap } from '../shared/shared.js';

export function inspectDeps(effectFn) {
    if (!effectFn || !effectFn.deps) return [];
    const results = [];
    effectFn.deps.forEach((depSet) => {
        results.push({
            subscribersCount: depSet.size,
            active: depSet.has(effectFn)
        });
    });
    return results;
}
