import { config } from './config.js';
import { accessor } from './accessor.js';
import { normalizeAst, createAndNode } from './ast.js';
import { compileAst } from './compile.js';
import { sortedIndexRange } from './index-system.js';

// ==========================================
// PLANNER
// ==========================================

export function createPlan(state, data) {
  const ast = normalizeAst(state._ast);
  let source = { type: 'scan', data };
  let remainingAst = ast;

  if (ast.type === 'AND') {
    let bestIndex = null;
    let bestSelectivity = Infinity;
    let bestNodeIndex = -1;

    for (let i = 0; i < ast.children.length; i++) {
      const child = ast.children[i];
      const candidate = tryIndex(child, state._indexes, state._indexesDirty);
      if (candidate && candidate.count < bestSelectivity) {
        bestSelectivity = candidate.count;
        bestIndex = candidate;
        bestNodeIndex = i;
      }
    }

    if (bestIndex) {
      source = bestIndex.source;
      const remaining = ast.children.filter((_, i) => i !== bestNodeIndex);
      remainingAst = remaining.length === 1 ? remaining[0] : createAndNode(remaining);
    }
  } else {
    const candidate = tryIndex(ast, state._indexes, state._indexesDirty);
    if (candidate) {
      source = candidate.source;
      remainingAst = { type: 'AND', children: [] };
    }
  }

  const predicate = compileAst(remainingAst);
  const comparator = state.orders.length ? compileComparator(state.orders) : null;
  const project = compileProjection(state);
  const slice = { offset: state.offset, limit: state.limit };
  const needsSort = !!comparator;
  const hasLimit = slice.limit !== null;
  const useHeap = needsSort && hasLimit && !slice.offset && slice.limit <= config.maxHeapSize;

  return { source, ast, predicate, comparator, project, slice, needsSort, hasLimit, useHeap };
}

export function tryIndex(node, indexes, indexesDirty) {
  // Map index for equality
  if (node.type === 'COMPARE' && node.op === '=') {
    const idx = indexes.get(node.field);
    if (idx && !indexesDirty.has(node.field) && idx.type === 'map') {
      const candidates = idx.index.get(node.value) || [];
      return { source: { type: 'index', index: idx, candidates }, count: candidates.length };
    }
  }
  // Sorted index for ranges
  if ((node.type === 'RANGE' || (node.type === 'COMPARE' && ['>', '>=', '<', '<='].includes(node.op)))) {
    const field = node.field;
    const op = node.op;
    const value = node.value;
    const idx = indexes.get(field);
    if (idx && !indexesDirty.has(field) && idx.type === 'sorted') {
      const candidates = sortedIndexRange(idx, op, value);
      // null => op not serviceable as a contiguous range; keep the predicate.
      if (candidates) {
        return { source: { type: 'index', index: idx, candidates }, count: candidates.length };
      }
    }
  }
  // Compound index
  if (node.type === 'AND') {
    const compares = node.children.filter(c => c.type === 'COMPARE' && c.op === '=');
    if (compares.length >= 2) {
      for (const [key, idx] of indexes) {
        if (idx.type === 'compound' && !indexesDirty.has(key)) {
          const fields = idx.fields;
          const match = compares.filter(c => fields.includes(c.field));
          if (match.length === fields.length) {
            const compoundKey = JSON.stringify(fields.map(f => match.find(c => c.field === f).value));
            const candidates = idx.index.get(compoundKey) || [];
            return { source: { type: 'index', index: idx, candidates }, count: candidates.length };
          }
        }
      }
    }
  }
  return null;
}

export function compileComparator(orders) {
  const compiled = orders.map(o => ({ accessFn: accessor(o.field), dir: o.dir }));
  return (a, b) => {
    for (const o of compiled) {
      const av = o.accessFn(a);
      const bv = o.accessFn(b);
      if (av == null && bv == null) continue;
      if (av == null) return o.dir === 'asc' ? -1 : 1;
      if (bv == null) return o.dir === 'asc' ? 1 : -1;
      if (av < bv) return o.dir === 'asc' ? -1 : 1;
      if (av > bv) return o.dir === 'asc' ? 1 : -1;
    }
    return 0;
  };
}

export function compileProjection(state) {
  if (state.select) {
    const fields = state.select.map(f => ({ field: f, accessFn: accessor(f) }));
    return (item) => {
      const obj = {};
      fields.forEach(f => obj[f.field] = f.accessFn(item));
      return obj;
    };
  }
  if (state.except) {
    const fields = state.except;
    return (item) => {
      const obj = { ...item };
      fields.forEach(f => delete obj[f]);
      return obj;
    };
  }
  return (item) => item;
}
