import { accessor } from './accessor.js';

// ==========================================
// INDEX SYSTEM (Map + Sorted + Compound)
// ==========================================

export function buildMapIndex(data, field) {
  const getVal = accessor(field);
  const index = new Map();
  data.forEach(item => {
    const val = getVal(item);
    if (!index.has(val)) index.set(val, []);
    index.get(val).push(item);
  });
  return { type: 'map', field, index };
}

export function buildSortedIndex(data, field) {
  const getVal = accessor(field);
  const entries = data.map(item => ({ val: getVal(item), item }));
  entries.sort((a, b) => {
    if (a.val == null) return -1;
    if (b.val == null) return 1;
    if (a.val < b.val) return -1;
    if (a.val > b.val) return 1;
    return 0;
  });
  return { type: 'sorted', field, values: entries.map(e => e.val), items: entries.map(e => e.item) };
}

export function buildCompoundIndex(data, fields) {
  const fns = fields.map(f => accessor(f));
  const index = new Map();
  data.forEach(item => {
    const key = JSON.stringify(fns.map(fn => fn(item)));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  });
  return { type: 'compound', fields, index };
}

export function buildIndex(data, fieldOrFields, opts = {}) {
  if (Array.isArray(fieldOrFields)) return buildCompoundIndex(data, fieldOrFields);
  if (opts.type === 'sorted') return buildSortedIndex(data, fieldOrFields);
  return buildMapIndex(data, fieldOrFields);
}

// Returns null for operators a sorted index cannot serve as a contiguous range
// (e.g. notbetween). Returning null lets the planner keep the predicate instead
// of silently treating the whole dataset as a match.
export function sortedIndexRange(sortedIdx, op, value) {
  const { values, items } = sortedIdx;
  let start = 0, end = values.length;
  if (op === '>=' || op === '>') start = lowerBound(values, value, op === '>');
  else if (op === '<=' || op === '<') end = upperBound(values, value, op === '<');
  else if (op === 'between') { start = lowerBound(values, value[0], false); end = upperBound(values, value[1], false); }
  else return null;
  return items.slice(start, end);
}

export function lowerBound(arr, target, strict) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (strict ? arr[mid] <= target : arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function upperBound(arr, target, strict) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (strict ? arr[mid] < target : arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
