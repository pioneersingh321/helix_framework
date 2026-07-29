// ==========================================
// ACCESSOR REGISTRY
// ==========================================

const _accessorRegistry = new Map();

export function accessor(path) {
  if (_accessorRegistry.has(path)) return _accessorRegistry.get(path);
  const parts = path.split('.');
  let fn;
  if (parts.length === 1) {
    const key = parts[0];
    fn = (obj) => obj?.[key];
  } else {
    fn = (obj) => parts.reduce((o, k) => o?.[k], obj);
  }
  _accessorRegistry.set(path, fn);
  return fn;
}
