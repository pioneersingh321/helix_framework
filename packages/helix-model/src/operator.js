// ==========================================
// OPERATOR REGISTRY (extensible)
// ==========================================

export const _operatorRegistry = new Map();

export function registerOperator(name, compiler) {
  if (typeof compiler !== 'function') {
    throw new TypeError('Operator compiler must be a function');
  }
  _operatorRegistry.set(name.toLowerCase(), compiler);
}

export function compileCustomRule({ accessFn, value, field, operator, rule }) {
  const compiler = _operatorRegistry.get(operator);
  if (!compiler) return null;
  try {
    return compiler({ accessFn, value, field, rule });
  } catch (e) {
    console.error(`Custom operator "${operator}" failed:`, e);
    return () => false;
  }
}
