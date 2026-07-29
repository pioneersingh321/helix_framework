import { accessor } from './accessor.js';

// ==========================================
// AST SYSTEM
// ==========================================

export function createCompareNode(field, op, value) {
  return { type: 'COMPARE', field, op: op.toLowerCase(), value, accessFn: accessor(field) };
}

export function createInNode(field, values, negated = false) {
  return { type: 'IN', field, values, negated, accessFn: accessor(field) };
}

export function createRangeNode(field, op, value) {
  return { type: 'RANGE', field, op, value, accessFn: accessor(field) };
}

export function createCallbackNode(fn) {
  return { type: 'CALLBACK', fn };
}

export function createAndNode(children) {
  const flat = [];
  for (const n of children) {
    if (n.type === 'AND') flat.push(...n.children);
    else flat.push(n);
  }
  const seen = new Set();
  const deduped = flat.filter(n => {
    if (n.type !== 'COMPARE') return true;
    // M2: instanceof carries a constructor (function) as its value; it serialises
    // to `undefined`, so every instanceof node would share one dedup key and all
    // but the first would be dropped. Never dedup these.
    if (n.op === 'instanceof') return true;
    const valKey = JSON.stringify(n.value);
    if (valKey === undefined) return true; // non-serialisable value => don't risk a false collision
    const key = `${n.field}|${n.op}|${valKey}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return { type: 'AND', children: deduped };
}

export function createOrNode(children) {
  return { type: 'OR', children };
}

export function normalizeAst(ast) {
  if (ast.type === 'AND') {
    if (ast.children.length === 0) return { type: 'AND', children: [] };
    if (ast.children.length === 1) return ast.children[0];
  }
  if (ast.type === 'OR' && ast.children.length === 1) return ast.children[0];
  return ast;
}

export function astToJson(ast) {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === 'accessFn' || k === 'fn') ? undefined : v));
}

export function astHasCallback(ast) {
  if (!ast) return false;
  if (ast.type === 'CALLBACK') return true;
  if (ast.children) return ast.children.some(astHasCallback);
  if (ast.child) return astHasCallback(ast.child);
  return false;
}
