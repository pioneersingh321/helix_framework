import { config } from './config.js';
import { createHeap } from './heap.js';
import { compileAstAsync } from './compile.js';

// ==========================================
// ASYNC MATERIALIZATION
// ==========================================
export async function materializeAsync(asyncIterable) {
  const items = [];
  for await (const item of asyncIterable) items.push(item);
  return items;
}

// ==========================================
// DRIVERS
// ==========================================
export function sliceResult(result, offset, limit) {
  if (!offset && limit === null) return result;
  return result.slice(offset, limit !== null ? offset + limit : undefined);
}

export function executeSync(plan) {
  const source = plan.source.type === 'index' ? plan.source.candidates : plan.source.data;
  let result = [];
  for (const item of source) {
    if (plan.predicate(item)) result.push(item);
  }
  if (plan.comparator) result.sort(plan.comparator);
  return sliceResult(result, plan.slice.offset, plan.slice.limit);
}

export function* executeLazy(plan) {
  const source = plan.source.type === 'index' ? plan.source.candidates : plan.source.data;
  const { offset, limit } = plan.slice;
  const hasLimit = limit !== null;

  if (plan.useHeap) {
    const heap = createHeap(limit, plan.comparator);
    for (const item of source) {
      if (plan.predicate(item)) heap.push(item);
    }
    for (const item of heap.sorted()) {
      yield plan.project(item);
    }
    return;
  }

  if (plan.needsSort) {
    const filtered = [];
    for (const item of source) {
      if (plan.predicate(item)) filtered.push(item);
    }
    filtered.sort(plan.comparator);
    for (let i = offset; i < filtered.length; i++) {
      if (hasLimit && i >= offset + limit) break;
      yield plan.project(filtered[i]);
    }
    return;
  }

  let skipped = 0;
  let yielded = 0;
  for (const item of source) {
    if (!plan.predicate(item)) continue;
    if (skipped < offset) { skipped++; continue; }
    if (hasLimit && yielded >= limit) break;
    yielded++;
    yield plan.project(item);
  }
}

export async function executeAsync(plan) {
  const source = plan.source.type === 'index' ? plan.source.candidates : [...plan.source.data];
  const result = [];
  const needsSort = plan.needsSort;
  const { offset, limit } = plan.slice;
  const targetCount = (limit !== null && !needsSort) ? offset + limit : Infinity;
  const predicateAsync = await compileAstAsync(plan.ast);

  for (let i = 0; i < source.length; i += config.asyncBatchSize) {
    if (!needsSort && result.length >= targetCount) break;
    const batch = source.slice(i, i + config.asyncBatchSize);
    const passes = await Promise.all(batch.map(item => predicateAsync(item)));
    for (let j = 0; j < batch.length; j++) {
      if (passes[j]) result.push(batch[j]);
    }
  }

  if (needsSort) result.sort(plan.comparator);
  return sliceResult(result, offset, limit);
}

export async function* executeAsyncLazy(plan) {
  const source = plan.source.type === 'index' ? plan.source.candidates : [...plan.source.data];
  const { offset, limit } = plan.slice;
  const hasLimit = limit !== null;
  const needsSort = plan.needsSort;
  const predicateAsync = await compileAstAsync(plan.ast);

  if (plan.useHeap) {
    const heap = createHeap(limit, plan.comparator);
    for (let i = 0; i < source.length; i += config.asyncBatchSize) {
      const batch = source.slice(i, i + config.asyncBatchSize);
      const passes = await Promise.all(batch.map(item => predicateAsync(item)));
      for (let j = 0; j < batch.length; j++) {
        if (passes[j]) heap.push(batch[j]);
      }
    }
    for (const item of heap.sorted()) {
      yield plan.project(item);
    }
    return;
  }

  if (needsSort) {
    const filtered = [];
    for (let i = 0; i < source.length; i += config.asyncBatchSize) {
      const batch = source.slice(i, i + config.asyncBatchSize);
      const passes = await Promise.all(batch.map(item => predicateAsync(item)));
      for (let j = 0; j < batch.length; j++) {
        if (passes[j]) filtered.push(batch[j]);
      }
    }
    filtered.sort(plan.comparator);
    for (let i = offset; i < filtered.length; i++) {
      if (hasLimit && i >= offset + limit) break;
      yield plan.project(filtered[i]);
    }
    return;
  }

  let skipped = 0;
  let yielded = 0;
  for (let i = 0; i < source.length; i += config.asyncBatchSize) {
    if (hasLimit && yielded >= limit) break;
    const batch = source.slice(i, i + config.asyncBatchSize);
    const passes = await Promise.all(batch.map(item => predicateAsync(item)));
    for (let j = 0; j < batch.length; j++) {
      if (!passes[j]) continue;
      if (skipped < offset) { skipped++; continue; }
      if (hasLimit && yielded >= limit) break;
      yielded++;
      yield plan.project(batch[j]);
    }
  }
}
