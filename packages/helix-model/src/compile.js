import { compileCustomRule } from './operator.js';

// ==========================================
// AST COMPILATION
// ==========================================

export function compileAst(ast) {
  switch (ast.type) {
    case 'COMPARE': return compileCompareNode(ast);
    case 'IN': return compileInNode(ast);
    case 'RANGE': return compileRangeNode(ast);
    // Tolerate callback nodes that lost their fn through serialization.
    case 'CALLBACK': return typeof ast.fn === 'function' ? ast.fn : () => true;
    case 'AND': {
      const fns = ast.children.map(compileAst);
      return (item) => fns.every(fn => fn(item));
    }
    case 'OR': {
      const fns = ast.children.map(compileAst);
      return (item) => fns.some(fn => fn(item));
    }
    default: return () => true;
  }
}

export function compileCompareNode(node) {
  const { accessFn, op, value, field } = node;
  const custom = compileCustomRule({ accessFn, value, field, operator: op, rule: node });
  if (custom) return custom;
  switch (op) {
    case '=': case '==': return (item) => accessFn(item) == value;
    case '!=': case '<>': return (item) => accessFn(item) != value;
    case '>': return (item) => accessFn(item) > value;
    case '<': return (item) => accessFn(item) < value;
    case '>=': return (item) => accessFn(item) >= value;
    case '<=': return (item) => accessFn(item) <= value;
    case 'like': return (item) => String(accessFn(item)).toLowerCase().includes(String(value).toLowerCase());
    case 'not like': return (item) => !String(accessFn(item)).toLowerCase().includes(String(value).toLowerCase());
    case 'startswith': return (item) => String(accessFn(item)).toLowerCase().startsWith(String(value).toLowerCase());
    case 'endswith': return (item) => String(accessFn(item)).toLowerCase().endsWith(String(value).toLowerCase());
    case 'null': return (item) => { const v = accessFn(item); return v === null || v === undefined; };
    case 'notnull': return (item) => { const v = accessFn(item); return v !== null && v !== undefined; };
    case 'contains': return (item) => { const v = accessFn(item); return Array.isArray(v) && v.includes(value); };
    // instanceof tests the item itself, not a field lookup.
    case 'instanceof': return (item) => item instanceof value;
    default: return () => false;
  }
}

export function compileInNode(node) {
  const { accessFn, values, negated } = node;
  const set = new Set(values);
  return negated ? (item) => !set.has(accessFn(item)) : (item) => set.has(accessFn(item));
}

export function compileRangeNode(node) {
  const { accessFn, op, value } = node;
  switch (op) {
    case 'between': return (item) => { const v = accessFn(item); return v >= value[0] && v <= value[1]; };
    case 'notbetween': return (item) => { const v = accessFn(item); return v < value[0] || v > value[1]; };
    default: return () => false;
  }
}

export async function compileAstAsync(ast) {
  switch (ast.type) {
    case 'CALLBACK': {
      const fn = typeof ast.fn === 'function' ? ast.fn : () => true;
      return async (item) => { const r = fn(item); return r && typeof r.then === 'function' ? await r : r; };
    }
    case 'AND': {
      const fns = await Promise.all(ast.children.map(compileAstAsync));
      return async (item) => { for (const fn of fns) if (!await fn(item)) return false; return true; };
    }
    case 'OR': {
      const fns = await Promise.all(ast.children.map(compileAstAsync));
      return async (item) => { for (const fn of fns) if (await fn(item)) return true; return false; };
    }
    default: {
      const syncFn = compileAst(ast);
      return async (item) => syncFn(item);
    }
  }
}
