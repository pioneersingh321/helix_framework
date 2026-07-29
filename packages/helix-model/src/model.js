import { config, STATE } from './config.js';
import { accessor } from './accessor.js';
import { registerOperator } from './operator.js';
import { buildIndex } from './index-system.js';
import { createPlan, compileProjection } from './planner.js';
import {
  executeSync,
  executeLazy,
  executeAsync,
  executeAsyncLazy,
  materializeAsync,
  sliceResult
} from './execute.js';
import {
  createCompareNode,
  createInNode,
  createRangeNode,
  createCallbackNode,
  createAndNode,
  createOrNode,
  astToJson,
  astHasCallback
} from './ast.js';

// ==========================================
// AST HELPERS
// ==========================================
function mergeAstCondition(ast, node, type) {
  if (ast.type === 'AND' && type === 'and') {
    ast.children.push(node);
    return ast;
  }
  if (ast.type === 'OR' && type === 'or') {
    ast.children.push(node);
    return ast;
  }
  if (type === 'and') {
    if (ast.type === 'AND') {
      ast.children.push(node);
      return ast;
    }
    return createAndNode([ast, node]);
  }
  if (type === 'or') {
    if (ast.type === 'OR') {
      ast.children.push(node);
      return ast;
    }
    return createOrNode([ast, node]);
  }
  return ast;
}

function parseWhereToAst(field, operator, value) {
  if (typeof field === 'function') return createCallbackNode(field);
  if (typeof field === 'object' && field !== null) {
    return createAndNode(
      Object.entries(field).map(([k, v]) => createCompareNode(k, '=', v))
    );
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    const match = trimmed.match(/^(.+?)\s+(=|!=|<>|>|>=|<|<=|like)\s*$/i);
    if (match) return createCompareNode(match[1].trim(), match[2].toLowerCase(), value);
    return createCompareNode(trimmed, '=', value);
  }
  return { type: 'AND', children: [] };
}

// ==========================================
// MODEL FACTORY
// ==========================================
export function model(source = [], _sharedReactive = null) {
  const data = Array.isArray(source) ? source : [];

  // Reactivity registry shared across clones of the same dataset so that a
  // mutation on any clone notifies effects/subscribers registered on siblings.
  const reactive = _sharedReactive || { effects: new Set(), subscribers: new Set() };
  // monotonic version of the shared dataset, bumped by ANY clone's mutation.
  if (reactive.dataVersion === undefined) reactive.dataVersion = 0;
  // bridge mutations into Helix's reactive graph. A single shared version
  // ref lets computed()/watch()/live() (and any framework effect/component) track
  // this dataset through the SAME reactive system as the rest of Helix.
  if (reactive.signal === undefined) {
    reactive.signal = (config.app && typeof config.app.ref === 'function') ? config.app.ref(0) : null;
  }

  const state = {
    _ast: { type: 'AND', children: [] },
    orders: [],
    limit: null,
    offset: 0,
    select: null,
    except: null,
    _lazy: false,
    _async: false,
    _cache: null,
    _dirty: true,
    _cacheVersion: 0,
    _lastBuiltVersion: 0,
    _asyncCache: null,
    _asyncCacheVersion: 0,
    _lastAsyncBuiltVersion: 0,
    _compiledPlan: null,
    _compiledPlanVersion: 0,
    _indexes: new Map(),
    _indexesDirty: new Set(),
    _reactive: reactive,
    _seenDataVersion: reactive.dataVersion, // dataset version this state's caches reflect
    _queryId: Math.random().toString(36).slice(2),
  };

  function _cloneState() {
    const m = model(data, reactive);
    const ns = m[STATE];
    ns._ast = JSON.parse(
      JSON.stringify(state._ast, (k, v) => (k === 'accessFn' || k === 'fn') ? undefined : v)
    );
    // Re-attach lost callbacks where possible (callbacks can't survive JSON).
    const sourceCallbacks = [];
    const sourceCtors = [];
    (function collect(n) {
      if (!n) return;
      if (n.type === 'CALLBACK') sourceCallbacks.push(n.fn);
      if (n.type === 'COMPARE' && n.op === 'instanceof') sourceCtors.push(n.value);
      if (n.children) n.children.forEach(collect);
      if (n.child) collect(n.child);
    })(state._ast);
    let cbIndex = 0, ctorIndex = 0;
    function reattach(node) {
      if (node.type === 'CALLBACK') node.fn = sourceCallbacks[cbIndex++];
      if (node.type === 'COMPARE' && node.op === 'instanceof') node.value = sourceCtors[ctorIndex++];
      if (node.field) node.accessFn = accessor(node.field);
      if (node.children) node.children.forEach(reattach);
      if (node.child) reattach(node.child);
    }
    reattach(ns._ast);
    ns.orders = state.orders.map(o => ({ ...o }));
    ns.limit = state.limit;
    ns.offset = state.offset;
    ns.select = state.select ? [...state.select] : null;
    ns.except = state.except ? [...state.except] : null;
    ns._cache = null;
    ns._dirty = true;
    ns._cacheVersion = state._cacheVersion;
    ns._lastBuiltVersion = 0;
    ns._asyncCache = null;
    ns._asyncCacheVersion = state._asyncCacheVersion;
    ns._lastAsyncBuiltVersion = 0;
    ns._compiledPlan = null;
    ns._compiledPlanVersion = 0;
    ns._lazy = state._lazy;
    ns._async = state._async;
    ns._indexes = new Map(state._indexes);
    ns._indexesDirty = new Set(state._indexesDirty);
    ns._seenDataVersion = reactive.dataVersion; // clone reflects current dataset
    ns._queryId = Math.random().toString(36).slice(2);
    return m;
  }

  const _markDirty = () => {
    state._dirty = true;
    state._cacheVersion++;
    state._asyncCacheVersion++;
    // advance the shared dataset version so sibling clones invalidate too.
    reactive.dataVersion++;
    state._seenDataVersion = reactive.dataVersion; // this clone is already current
    // pulse the reactive-graph signal so Helix computeds/watches re-run.
    if (reactive.signal) reactive.signal.value++;
    state._indexesDirty = new Set(state._indexes.keys());
    reactive.subscribers.forEach(cb => {
      try { cb(); } catch (e) { console.error('Subscriber error:', e); }
    });
    reactive.effects.forEach(effect => {
      try { effect(); } catch (e) { console.error('Effect error:', e); }
    });
  };

  // if a sibling clone mutated the shared data since this state last built,
  // drop everything derived from the old snapshot (cache, async cache, compiled
  // plan, and index validity). Cheap no-op when already current.
  function _syncDataVersion() {
    if (state._seenDataVersion === reactive.dataVersion) return;
    state._seenDataVersion = reactive.dataVersion;
    state._dirty = true;
    state._cache = null;
    state._asyncCache = null;
    state._compiledPlan = null;
    state._indexesDirty = new Set(state._indexes.keys());
  }

  // true when no query pipeline is active (bare dataset). Used by
  // find()/findBy() to decide whether the raw index fast-path is still valid.
  function _isPassThrough() {
    return (
      state._ast.children.length === 0 &&
      state.orders.length === 0 &&
      state.limit == null &&
      (state.offset === 0 || state.offset == null) &&
      !state.select &&
      !state.except
    );
  }

  // materialise a join's right-hand side from an array, another Helix
  // model (respecting its pending query), or any iterable.
  function _resolveRows(src) {
    if (Array.isArray(src)) return src;
    if (src && src[STATE]) {
      const g = src.get();
      return Array.isArray(g) ? g : [...g];
    }
    if (src && typeof src[Symbol.iterator] === 'function') return [...src];
    return [];
  }

  function _getOrCompilePlan() {
    _syncDataVersion();
    if (state._compiledPlan && state._compiledPlanVersion === state._cacheVersion) {
      return state._compiledPlan;
    }
    const plan = createPlan(state, data);
    state._compiledPlan = plan;
    state._compiledPlanVersion = state._cacheVersion;
    return plan;
  }

  function _buildSync() {
    _syncDataVersion();
    // signal-native — reading a model inside any Helix reactive context
    // (computed/watch/effect) registers a dependency on this dataset, so nested
    // reads such as a join's right-hand side re-derive when their source mutates.
    if (reactive.signal) {
      void reactive.signal.value;
    }
    if (!state._dirty && state._cache && state._lastBuiltVersion === state._cacheVersion) {
      return state._cache;
    }
    const plan = _getOrCompilePlan();
    const result = executeSync(plan);
    state._cache = result;
    state._dirty = false;
    state._lastBuiltVersion = state._cacheVersion;
    return result;
  }

  function* _buildLazy() {
    const plan = _getOrCompilePlan();
    yield* executeLazy(plan);
  }

  async function _buildAsync() {
    _syncDataVersion();
    if (!state._dirty && state._asyncCache && state._lastAsyncBuiltVersion === state._asyncCacheVersion) {
      return state._asyncCache;
    }
    const plan = _getOrCompilePlan();
    const result = await executeAsync(plan);
    state._asyncCache = result;
    state._dirty = false;
    state._lastAsyncBuiltVersion = state._asyncCacheVersion;
    return result;
  }

  async function* _buildAsyncLazy() {
    const plan = _getOrCompilePlan();
    yield* executeAsyncLazy(plan);
  }

  function buildProjection() {
    if (state.select) return { type: 'select', fields: state.select };
    if (state.except) return { type: 'except', fields: state.except };
    return { type: 'none' };
  }

  // Slice is applied during build now; this applies projection only.
  function _applyProjection(result) {
    const projection = buildProjection();
    if (projection.type !== 'none') {
      const projectFn = compileProjection(state);
      result = result.map(item => projectFn(item));
    }
    return result;
  }

  function _dispatch() {
    if (state._async && state._lazy) return { type: 'async-lazy', exec: _buildAsyncLazy, isAsync: true };
    if (state._async) return { type: 'async', exec: _buildAsync, isAsync: true };
    if (state._lazy) return { type: 'lazy', exec: _buildLazy, isAsync: false };
    return { type: 'sync', exec: _buildSync, isAsync: false };
  }

  async function _materialize(type, exec) {
    if (type === 'async') return await exec();
    if (type === 'async-lazy') return await materializeAsync(exec());
    if (type === 'lazy') return [...exec()];
    return exec();
  }

  const api = {
    [STATE]: state,

    lazy() { const m = _cloneState(); m[STATE]._lazy = true; return m; },
    async() { const m = _cloneState(); m[STATE]._async = true; return m; },

    fresh() { return model(data, reactive); },
    newQuery() { return model(data, reactive); },
    clone() { return _cloneState(); },

    // --- AST Serialization ---
    toAst() {
      if (astHasCallback(state._ast)) {
        console.warn(
          '[model] toAst(): CALLBACK predicates (from where(fn)/search) cannot be serialized and will be dropped from the JSON output.'
        );
      }
      return astToJson(state._ast);
    },
    fromAst(json) {
      const m = model(data, reactive);
      const ns = m[STATE];
      ns._ast = JSON.parse(JSON.stringify(json));
      function reattach(node) {
        if (node.field) node.accessFn = accessor(node.field);
        if (node.children) node.children.forEach(reattach);
        if (node.child) reattach(node.child);
      }
      reattach(ns._ast);
      ns._dirty = true;
      ns._cacheVersion++;
      return m;
    },

    // --- Indexing (enhanced) ---
    index(fieldOrFields, opts = {}) {
      const idx = buildIndex(data, fieldOrFields, opts);
      const key = Array.isArray(fieldOrFields) ? fieldOrFields.join(',') : fieldOrFields;
      state._indexes.set(key, idx);
      state._indexesDirty.delete(key);
      // Invalidate the cached plan (and sync cache) so the next query re-plans.
      state._cacheVersion++;
      state._dirty = true;
      state._compiledPlan = null;
      return this;
    },

    // --- Reactive ---
    effect(callback) {
      const wrapped = () => callback(this);
      reactive.effects.add(wrapped);
      const result = wrapped();
      return { result, unsubscribe: () => reactive.effects.delete(wrapped) };
    },
    subscribe(callback) {
      reactive.subscribers.add(callback);
      return () => reactive.subscribers.delete(callback);
    },
    // signal-native reactive views. These plug into Helix's own reactive
    // graph via the shared version signal, so a model query can be consumed by any
    // framework computed/effect/component and re-derives when the data mutates.
    // Falls back to a pull-based view / model subscribers when core reactivity
    // helpers aren't wired into this app.
    computed(selector) {
      const build = () => {
        const rows = _buildSync();
        return selector ? selector(rows) : rows;
      };
      if (config.app && typeof config.app.computed === 'function') {
        return config.app.computed(() => {
          if (reactive.signal) {
            void reactive.signal.value;
          }
          return build();
        });
      }
      return { get value() { return build(); } }; // always fresh: _buildSync self-invalidates
    },
    live(selector) { return this.computed(selector); },
    watch(callback, opts = {}) {
      const build = () => {
        const rows = _buildSync();
        return opts.selector ? opts.selector(rows) : rows;
      };
      if (config.app && typeof config.app.watch === 'function') {
        return config.app.watch(
          () => {
            if (reactive.signal) {
              void reactive.signal.value;
            }
            return build();
          },
          callback,
          opts
        );
      }
      // Fallback: fire on each mutation via the model's own subscriber registry.
      let oldVal = build();
      if (opts.immediate) callback(oldVal, undefined);
      return this.subscribe(() => {
        const n = build();
        const o = oldVal;
        oldVal = n;
        callback(n, o);
      });
    },

    // --- Conditional ---
    when(condition, callback, otherwise) {
      if (condition) return callback(_cloneState());
      if (otherwise) return otherwise(_cloneState());
      return _cloneState();
    },
    unless(condition, callback, otherwise) {
      return this.when(!condition, callback, otherwise);
    },
    tap(callback) { callback(this); return this; },

    // --- Filtering (AST-based) ---
    where(field, operator, value) {
      const m = _cloneState();
      const s = m[STATE];
      let node;
      if (arguments.length === 3) node = createCompareNode(field, operator, value);
      else node = parseWhereToAst(field, operator, value);
      s._ast = mergeAstCondition(s._ast, node, 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    orWhere(field, operator, value) {
      const m = _cloneState();
      const s = m[STATE];
      let node;
      if (arguments.length === 3) node = createCompareNode(field, operator, value);
      else node = parseWhereToAst(field, operator, value);
      s._ast = mergeAstCondition(s._ast, node, 'or');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereIn(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createInNode(field, values, false), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    orWhereIn(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createInNode(field, values, false), 'or');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereNotIn(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createInNode(field, values, true), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    orWhereNotIn(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createInNode(field, values, true), 'or');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereNull(field) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createCompareNode(field, 'null', null), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereNotNull(field) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createCompareNode(field, 'notnull', null), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereBetween(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createRangeNode(field, 'between', values), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereNotBetween(field, values) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createRangeNode(field, 'notbetween', values), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    whereInstanceOf(type) {
      const m = _cloneState();
      const s = m[STATE];
      s._ast = mergeAstCondition(s._ast, createCompareNode('__instanceof__', 'instanceof', type), 'and');
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    search(arg1, arg2) {
      if (Array.isArray(arg1) || (typeof arg1 === 'string' && typeof arg2 === 'string')) {
        if (!arg2 || !arg2.trim()) return _cloneState();
        const m = _cloneState();
        const s = m[STATE];
        const words = arg2.trim().toLowerCase().split(/\s+/);
        const fields = Array.isArray(arg1) ? arg1 : [arg1];
        s._ast = mergeAstCondition(
          s._ast,
          {
            type: 'CALLBACK',
            fn: (item) => fields.some(f => words.every(w => String(accessor(f)(item)).toLowerCase().includes(w)))
          },
          'and'
        );
        s._dirty = true;
        s._cacheVersion++;
        return m;
      }
      const items = _buildSync();
      if (typeof arg1 === 'function') {
        const idx = items.findIndex(arg1);
        return idx === -1 ? false : idx;
      }
      return items.findIndex(item => arg2 ? item === arg1 : item == arg1);
    },

    // --- Sorting ---
    orderBy(field, dir = 'asc') {
      const m = _cloneState();
      const s = m[STATE];
      if (Array.isArray(field)) {
        s.orders = field.map(o => ({ field: o.field, dir: (o.dir || 'asc').toLowerCase() }));
      } else {
        s.orders.push({ field, dir: dir.toLowerCase() });
      }
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    sortBy(field) { return this.orderBy(field, 'asc'); },
    sortByDesc(field) { return this.orderBy(field, 'desc'); },

    // --- Pagination ---
    limit(n, offset = 0) {
      const m = _cloneState();
      const s = m[STATE];
      s.limit = n;
      s.offset = offset;
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    forPage(page, perPage) { return this.limit(perPage, (page - 1) * perPage); },
    paginate(perPage = 15, page = 1) {
      const plan = _getOrCompilePlan();
      const fullPlan = { ...plan, slice: { offset: 0, limit: null }, useHeap: false };
      const built = executeSync(fullPlan);
      const total = built.length;
      const offset = (page - 1) * perPage;
      let result = built.slice(offset, offset + perPage);
      const projection = buildProjection();
      if (projection.type !== 'none') {
        const projectFn = compileProjection(state);
        result = result.map(item => projectFn(item));
      }
      return {
        data: result,
        total,
        perPage,
        currentPage: page,
        lastPage: Math.ceil(total / perPage),
        from: total ? offset + 1 : 0,
        to: Math.min(offset + perPage, total)
      };
    },

    // --- Projection ---
    select(fields) {
      const m = _cloneState();
      const s = m[STATE];
      s.select = Array.isArray(fields) ? fields : fields.split(',').map(f => f.trim());
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    except(fields) {
      const m = _cloneState();
      const s = m[STATE];
      s.except = Array.isArray(fields) ? fields : fields.split(',').map(f => f.trim());
      s._dirty = true;
      s._cacheVersion++;
      return m;
    },
    only(fields) {
      const items = _buildSync();
      const keyArray = Array.isArray(fields) ? fields : fields.split(',').map(f => f.trim());
      return config.app.$model(
        items.map(item => {
          const obj = {};
          keyArray.forEach(k => { obj[k] = accessor(k)(item); });
          return obj;
        })
      );
    },

    // --- Collection Transforms ---
    pluck(field) {
      const { type, exec, isAsync } = _dispatch();
      const getVal = accessor(field);
      if (isAsync || type === 'async-lazy') {
        return (async () => config.app.$model((await _materialize(type, exec)).map(item => getVal(item))))();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return config.app.$model(items.map(item => getVal(item)));
    },
    unique(field) {
      const { type, exec, isAsync } = _dispatch();
      const getVal = field ? accessor(field) : (x) => x;
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const seen = new Set();
          return config.app.$model(
            items.filter(item => {
              const val = getVal(item);
              if (seen.has(val)) return false;
              seen.add(val);
              return true;
            })
          );
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      const seen = new Set();
      return config.app.$model(
        items.filter(item => {
          const val = getVal(item);
          if (seen.has(val)) return false;
          seen.add(val);
          return true;
        })
      );
    },
    groupBy(field) {
      const { type, exec, isAsync } = _dispatch();
      const getVal = accessor(field);
      if (isAsync || type === 'async-lazy') {
        return (async () =>
          (await _materialize(type, exec)).reduce((groups, item) => {
            const val = getVal(item);
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
          }, {}))();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return items.reduce((groups, item) => {
        const val = getVal(item);
        groups[val] = groups[val] || [];
        groups[val].push(item);
        return groups;
      }, {});
    },
    keyBy(field) {
      const items = _buildSync();
      const result = {};
      const getVal = accessor(field);
      items.forEach(item => { result[getVal(item)] = item; });
      return result;
    },
    flatten(fieldOrDepth) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          if (typeof fieldOrDepth === 'number' || fieldOrDepth === undefined) {
            const depth = fieldOrDepth === undefined ? Infinity : fieldOrDepth;
            const flatten = (arr, d) =>
              arr.reduce((acc, val) => (Array.isArray(val) && d > 0) ? acc.concat(flatten(val, d - 1)) : acc.concat(val), []);
            return config.app.$model(flatten(items, depth));
          }
          return config.app.$model(items.flatMap(item => item[fieldOrDepth] || []));
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      if (typeof fieldOrDepth === 'number' || fieldOrDepth === undefined) {
        const depth = fieldOrDepth === undefined ? Infinity : fieldOrDepth;
        const flatten = (arr, d) =>
          arr.reduce((acc, val) => (Array.isArray(val) && d > 0) ? acc.concat(flatten(val, d - 1)) : acc.concat(val), []);
        return config.app.$model(flatten(items, depth));
      }
      return config.app.$model(items.flatMap(item => item[fieldOrDepth] || []));
    },
    collapse() { return config.app.$model(_buildSync().flat()); },
    shuffle() {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
          }
          return config.app.$model(items);
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return config.app.$model(items);
    },
    random(count = 1) {
      const items = _buildSync();
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const res = shuffled.slice(0, count);
      return count === 1 ? (res[0] || null) : config.app.$model(res);
    },
    chunk(size, callback) {
      const items = _buildSync();
      if (!callback) {
        const result = [];
        for (let i = 0; i < items.length; i += size) {
          result.push(config.app.$model(items.slice(i, i + size)));
        }
        return result;
      }
      for (let i = 0; i < items.length; i += size) {
        callback(items.slice(i, i + size), Math.floor(i / size) + 1);
      }
    },
    split(numberOfGroups) {
      const items = _buildSync();
      const groupSize = Math.ceil(items.length / numberOfGroups);
      const result = [];
      for (let i = 0; i < items.length; i += groupSize) {
        result.push(config.app.$model(items.slice(i, i + groupSize)));
      }
      return result;
    },

    // --- Iteration & Transformation ---
    each(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          let index = 0;
          for await (const item of exec()) {
            await callback(item, index++);
          }
          return this;
        })();
      }
      if (type === 'lazy') {
        let index = 0;
        for (const item of exec()) {
          callback(item, index++);
        }
        return this;
      }
      exec().forEach((item, index) => callback(item, index));
      return this;
    },
    transform(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const matched = new Set(items);
          for (let i = 0; i < data.length; i++) {
            if (matched.has(data[i])) {
              const result = callback(data[i], i);
              data[i] = (result && typeof result.then === 'function') ? await result : result;
            }
          }
          _markDirty();
          return this;
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      const matched = new Set(items);
      data.forEach((item, index) => {
        if (matched.has(item)) {
          const result = callback(item, index);
          if (result && typeof result.then === 'function') {
            throw new Error(
              'Async callback returned in sync transform. Use .async().transform() or await the result.'
            );
          }
          data[index] = result;
        }
      });
      _markDirty();
      return this;
    },
    map(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const mapped = await Promise.all(items.map((item, index) => callback(item, index)));
          return config.app.$model(mapped);
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return config.app.$model(items.map((item, index) => callback(item, index)));
    },
    flatMap(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const mapped = await Promise.all(items.map(callback));
          return config.app.$model(mapped.flat());
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return config.app.$model(items.flatMap(callback));
    },
    mapWithKeys(callback) {
      const items = _buildSync();
      const result = {};
      items.forEach((item, index) => {
        const [k, v] = callback(item, index);
        result[k] = v;
      });
      return result;
    },
    mapToDictionary(callback) {
      const items = _buildSync();
      const result = {};
      items.forEach((item, index) => {
        const [k, v] = callback(item, index);
        if (!result[k]) result[k] = [];
        result[k].push(v);
      });
      return result;
    },
    mapToGroups(callback) { return this.mapToDictionary(callback); },

    // --- Mutation ---
    push(...items) { data.push(...items); _markDirty(); return this; },
    prepend(item, key) {
      if (key !== undefined) data[key] = item;
      else data.unshift(item);
      _markDirty();
      return this;
    },
    pop(count = 1) {
      if (count === 1) {
        const item = data.pop();
        _markDirty();
        return item || null;
      }
      const items = data.splice(-count);
      _markDirty();
      return config.app.$model(items);
    },
    shift(count = 1) {
      if (count === 1) {
        const item = data.shift();
        _markDirty();
        return item || null;
      }
      const items = data.splice(0, count);
      _markDirty();
      return config.app.$model(items);
    },
    pull(key) {
      if (Array.isArray(data)) {
        const index = Number(key);
        if (!isNaN(index) && index >= 0 && index < data.length) {
          const val = data.splice(index, 1)[0];
          _markDirty();
          return val;
        }
      }
      const val = data[key];
      delete data[key];
      _markDirty();
      return val;
    },
    put(key, value) { data[key] = value; _markDirty(); return this; },
    forget(...keys) {
      keys.forEach(key => {
        if (Array.isArray(data)) {
          const index = Number(key);
          if (!isNaN(index) && index >= 0 && index < data.length) data.splice(index, 1);
          else data.forEach(item => delete item[key]);
        } else {
          delete data[key];
        }
      });
      _markDirty();
      return this;
    },
    splice(index, count, ...items) {
      const removed = data.splice(index, count, ...items);
      _markDirty();
      return config.app.$model(removed);
    },

    // --- Filtering ---
    filter(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const filtered = [];
          for (let i = 0; i < items.length; i++) {
            const result = callback(items[i], i);
            if ((result && typeof result.then === 'function') ? await result : result) {
              filtered.push(items[i]);
            }
          }
          return config.app.$model(filtered);
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return config.app.$model(items.filter(callback));
    },
    reject(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const filtered = [];
          for (let i = 0; i < items.length; i++) {
            const result = callback(items[i], i);
            if (!((result && typeof result.then === 'function') ? await result : result)) {
              filtered.push(items[i]);
            }
          }
          return config.app.$model(filtered);
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      return config.app.$model(items.filter((item, index) => !callback(item, index)));
    },

    // --- Aggregates ---
    sum(field) {
      const { type, exec } = _dispatch();
      const getVal = accessor(field);
      if (type === 'lazy') {
        let total = 0;
        for (const item of exec()) total += Number(getVal(item)) || 0;
        return total;
      }
      if (type === 'async-lazy') {
        return (async () => {
          let total = 0;
          for await (const item of exec()) total += Number(getVal(item)) || 0;
          return total;
        })();
      }
      if (type === 'async') {
        return (async () =>
          (await exec()).reduce((acc, item) => acc + (Number(getVal(item)) || 0), 0))();
      }
      return exec().reduce((acc, item) => acc + (Number(getVal(item)) || 0), 0);
    },
    avg(field) {
      const { type, exec } = _dispatch();
      const getVal = accessor(field);
      if (type === 'lazy') {
        let total = 0, count = 0;
        for (const item of exec()) {
          total += Number(getVal(item)) || 0;
          count++;
        }
        return count ? total / count : 0;
      }
      if (type === 'async-lazy') {
        return (async () => {
          let total = 0, count = 0;
          for await (const item of exec()) {
            total += Number(getVal(item)) || 0;
            count++;
          }
          return count ? total / count : 0;
        })();
      }
      if (type === 'async') {
        return (async () => {
          const items = await exec();
          return items.length
            ? items.reduce((acc, item) => acc + (Number(getVal(item)) || 0), 0) / items.length
            : 0;
        })();
      }
      const items = exec();
      return items.length
        ? items.reduce((acc, item) => acc + (Number(getVal(item)) || 0), 0) / items.length
        : 0;
    },
    min(field) {
      const { type, exec } = _dispatch();
      const getVal = accessor(field);
      if (type === 'lazy') {
        let min = Infinity;
        for (const item of exec()) {
          const v = Number(getVal(item));
          if (v < min) min = v;
        }
        return min === Infinity ? null : min;
      }
      if (type === 'async-lazy') {
        return (async () => {
          let min = Infinity;
          for await (const item of exec()) {
            const v = Number(getVal(item));
            if (v < min) min = v;
          }
          return min === Infinity ? null : min;
        })();
      }
      if (type === 'async') {
        return (async () => {
          const m = (await exec()).reduce((min, item) => {
            const v = Number(getVal(item));
            return v < min ? v : min;
          }, Infinity);
          return m === Infinity ? null : m;
        })();
      }
      const m = exec().reduce((min, item) => {
        const v = Number(getVal(item));
        return v < min ? v : min;
      }, Infinity);
      return m === Infinity ? null : m;
    },
    max(field) {
      const { type, exec } = _dispatch();
      const getVal = accessor(field);
      if (type === 'lazy') {
        let max = -Infinity;
        for (const item of exec()) {
          const v = Number(getVal(item));
          if (v > max) max = v;
        }
        return max === -Infinity ? null : max;
      }
      if (type === 'async-lazy') {
        return (async () => {
          let max = -Infinity;
          for await (const item of exec()) {
            const v = Number(getVal(item));
            if (v > max) max = v;
          }
          return max === -Infinity ? null : max;
        })();
      }
      if (type === 'async') {
        return (async () => {
          const m = (await exec()).reduce((max, item) => {
            const v = Number(getVal(item));
            return v > max ? v : max;
          }, -Infinity);
          return m === -Infinity ? null : m;
        })();
      }
      const m = exec().reduce((max, item) => {
        const v = Number(getVal(item));
        return v > max ? v : max;
      }, -Infinity);
      return m === -Infinity ? null : m;
    },
    median(field) {
      const { type, exec, isAsync } = _dispatch();
      const getVal = field ? accessor(field) : (x) => x;
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const values = items.map(item => Number(getVal(item))).filter(v => !isNaN(v));
          values.sort((a, b) => a - b);
          const mid = Math.floor(values.length / 2);
          return values.length
            ? values.length % 2
              ? values[mid]
              : (values[mid - 1] + values[mid]) / 2
            : 0;
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      const values = items.map(item => Number(getVal(item))).filter(v => !isNaN(v));
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      return values.length
        ? values.length % 2
          ? values[mid]
          : (values[mid - 1] + values[mid]) / 2
        : 0;
    },
    mode(field) {
      const { type, exec, isAsync } = _dispatch();
      const getVal = field ? accessor(field) : (x) => x;
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const values = items.map(getVal);
          const counts = {};
          let maxCount = 0;
          let modes = [];
          values.forEach(v => {
            counts[v] = (counts[v] || 0) + 1;
            if (counts[v] > maxCount) {
              maxCount = counts[v];
              modes = [v];
            } else if (counts[v] === maxCount && !modes.includes(v)) {
              modes.push(v);
            }
          });
          return modes;
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      const values = items.map(getVal);
      const counts = {};
      let maxCount = 0;
      let modes = [];
      values.forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
        if (counts[v] > maxCount) {
          maxCount = counts[v];
          modes = [v];
        } else if (counts[v] === maxCount && !modes.includes(v)) {
          modes.push(v);
        }
      });
      return modes;
    },
    reduce(callback, initial) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          let acc = initial;
          for (let i = 0; i < items.length; i++) acc = await callback(acc, items[i], i);
          return acc;
        })();
      }
      if (type === 'lazy') {
        let acc = initial,
          index = 0;
        for (const item of exec()) acc = callback(acc, item, index++);
        return acc;
      }
      return exec().reduce(callback, initial);
    },

    reverse() { return config.app.$model([..._buildSync()].reverse()); },
    sort(callback) {
      const items = _buildSync();
      return config.app.$model(
        callback
          ? [...items].sort(callback)
          : [...items].sort((a, b) => {
              if (a == null) return -1;
              if (b == null) return 1;
              if (a < b) return -1;
              if (a > b) return 1;
              return 0;
            })
      );
    },
    sortDesc(callback) {
      const items = _buildSync();
      return config.app.$model(
        callback
          ? [...items].sort((a, b) => callback(b, a))
          : [...items].sort((a, b) => {
              if (a == null) return 1;
              if (b == null) return -1;
              if (a < b) return 1;
              if (a > b) return -1;
              return 0;
            })
      );
    },
    sortKeys(desc = false) {
      const items = _buildSync();
      return config.app.$model(
        Object.entries(items)
          .sort((a, b) => {
            if (a[0] < b[0]) return desc ? 1 : -1;
            if (a[0] > b[0]) return desc ? -1 : 1;
            return 0;
          })
          .map(([_, v]) => v)
      );
    },
    sortKeysDesc() { return this.sortKeys(true); },
    merge(items) { return config.app.$model(_buildSync().concat(items)); },
    mergeRecursive(items) {
      const current = _buildSync();
      const merge = (a, b) => {
        if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
        if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
          const result = { ...a };
          Object.keys(b).forEach(k => {
            result[k] = merge(a[k], b[k]);
          });
          return result;
        }
        return b;
      };
      return config.app.$model(
        current
          .map((item, i) => (items[i] !== undefined ? merge(item, items[i]) : item))
          .concat(items.slice(current.length))
      );
    },
    replace(items) {
      const current = _buildSync();
      const result = [...current];
      if (Array.isArray(items)) items.forEach((item, index) => { result[index] = item; });
      else Object.assign(result, items);
      return config.app.$model(result);
    },
    replaceRecursive(items) {
      const current = _buildSync();
      const replace = (target, source) => {
        const result = Array.isArray(target) ? [...target] : { ...target };
        Object.keys(source).forEach(k => {
          if (Array.isArray(result[k]) && Array.isArray(source[k])) {
            result[k] = replace(result[k], source[k]);
          } else if (
            typeof result[k] === 'object' &&
            result[k] !== null &&
            typeof source[k] === 'object' &&
            source[k] !== null
          ) {
            result[k] = replace(result[k], source[k]);
          } else {
            result[k] = source[k];
          }
        });
        return result;
      };
      return config.app.$model(replace(current, items));
    },
    slice(start, end) { return config.app.$model(_buildSync().slice(start, end)); },
    take(limit) { return config.app.$model(_buildSync().slice(0, limit)); },
    skip(count) { return config.app.$model(_buildSync().slice(count)); },
    partition(callback) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          const items = await _materialize(type, exec);
          const pass = [],
            fail = [];
          items.forEach(item => {
            if (callback(item)) pass.push(item);
            else fail.push(item);
          });
          return [config.app.$model(pass), config.app.$model(fail)];
        })();
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      const pass = [],
        fail = [];
      items.forEach(item => {
        if (callback(item)) pass.push(item);
        else fail.push(item);
      });
      return [config.app.$model(pass), config.app.$model(fail)];
    },
    values() { return config.app.$model(Object.values(_buildSync())); },
    keys() { return config.app.$model(Object.keys(_buildSync())); },
    flip() {
      const items = _buildSync();
      const result = {};
      items.forEach((item, index) => {
        result[item] = index;
      });
      return result;
    },
    diff(items) {
      const current = _buildSync();
      const other = new Set(items);
      return config.app.$model(current.filter(item => !other.has(item)));
    },
    diffAssoc(items) {
      return config.app.$model(_buildSync().filter((item, index) => items[index] !== item));
    },
    diffKeys(items) {
      const current = _buildSync();
      const otherKeys = new Set(Object.keys(items));
      return config.app.$model(current.filter((_, index) => !otherKeys.has(String(index))));
    },
    intersect(items) {
      const current = _buildSync();
      const other = new Set(items);
      return config.app.$model(current.filter(item => other.has(item)));
    },
    intersectByKeys(items) {
      const current = _buildSync();
      const otherKeys = new Set(Object.keys(items));
      return config.app.$model(current.filter((_, index) => otherKeys.has(String(index))));
    },
    union(items) {
      const current = _buildSync();
      const result = [...current];
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          if (!(index in result)) result[index] = item;
        });
      } else {
        Object.keys(items).forEach(key => {
          if (!(key in result)) result[key] = items[key];
        });
      }
      return config.app.$model(result);
    },
    nth(step, offset = 0) {
      const items = _buildSync();
      const res = [];
      for (let i = offset; i < items.length; i += step) res.push(items[i]);
      return config.app.$model(res);
    },
    pad(size, value) {
      const items = _buildSync();
      const result = [...items];
      if (size > 0) {
        while (result.length < size) result.push(value);
      } else {
        while (result.length < Math.abs(size)) result.unshift(value);
      }
      return config.app.$model(result);
    },
    times(n, callback) {
      const result = [];
      for (let i = 1; i <= n; i++) result.push(callback(i));
      return config.app.$model(result);
    },
    implode(field, glue = ',') {
      const items = _buildSync();
      if (arguments.length === 1 && typeof field === 'string' && !field.includes(',')) {
        return items.join(field);
      }
      const getVal = accessor(field);
      return items.map(item => getVal(item)).join(glue);
    },
    join(glue, finalGlue) {
      const items = _buildSync();
      if (finalGlue === undefined) return items.join(glue);
      if (items.length === 0) return '';
      if (items.length === 1) return String(items[0]);
      return items.slice(0, -1).join(glue) + finalGlue + items[items.length - 1];
    },
    zip(...arrays) {
      return config.app.$model(
        _buildSync().map((item, index) => [item, ...arrays.map(arr => arr[index])])
      );
    },
    crossJoin(...arrays) {
      const items = _buildSync();
      return config.app.$model(
        items.reduce((acc, item) => {
          const res = [item];
          arrays.forEach(arr => {
            const next = [];
            res.forEach(r =>
              arr.forEach(a => next.push([...(Array.isArray(r) ? r : [r]), a]))
            );
            res.length = 0;
            res.push(...next);
          });
          return acc.concat(res);
        }, [])
      );
    },
    // relational joins. Named innerJoin/leftJoin to avoid colliding with the
    // existing string join(glue, finalGlue). They join the CURRENT query result
    // (post where/orderBy/limit) against an array, model, or iterable, keying
    // leftKey == rightKey and producing shallow-merged { ...left, ...right } rows.
    // Eager snapshots — wrap in .computed()/.watch() for reactivity over both sides.
    innerJoin(other, leftKey, rightKey) {
      const lAcc = accessor(leftKey),
        rAcc = accessor(rightKey || leftKey);
      const idx = new Map();
      for (const r of _resolveRows(other)) {
        const k = rAcc(r);
        let b = idx.get(k);
        if (!b) idx.set(k, (b = []));
        b.push(r);
      }
      const out = [];
      for (const l of _buildSync()) {
        const matches = idx.get(lAcc(l));
        if (matches) for (const r of matches) out.push({ ...l, ...r });
      }
      return config.app.$model(out);
    },
    leftJoin(other, leftKey, rightKey) {
      const lAcc = accessor(leftKey),
        rAcc = accessor(rightKey || leftKey);
      const idx = new Map();
      for (const r of _resolveRows(other)) {
        const k = rAcc(r);
        let b = idx.get(k);
        if (!b) idx.set(k, (b = []));
        b.push(r);
      }
      const out = [];
      for (const l of _buildSync()) {
        const matches = idx.get(lAcc(l));
        if (matches) for (const r of matches) out.push({ ...l, ...r });
        else out.push({ ...l });
      }
      return config.app.$model(out);
    },
    // reactive join. Returns a Helix computed whose .value is the joined
    // rows, re-deriving when EITHER side mutates (both _buildSync reads register a
    // dependency). Sugar for: m.computed(() => m.innerJoin(other, ...).get()).
    joinLive(other, leftKey, rightKey, type = 'inner') {
      const self = this;
      return this.computed(() =>
        (type === 'left'
          ? self.leftJoin(other, leftKey, rightKey)
          : self.innerJoin(other, leftKey, rightKey)
        ).get()
      );
    },
    contains(valueOrCallback, key, value) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          if (typeof valueOrCallback === 'function') {
            let index = 0;
            for await (const item of exec()) {
              const result = valueOrCallback(item, index);
              if ((result && typeof result.then === 'function') ? await result : result) return true;
              index++;
            }
            return false;
          }
          if (arguments.length === 3) {
            const getVal = accessor(key);
            for await (const item of exec()) {
              if (getVal(item) == value) return true;
            }
            return false;
          }
          if (arguments.length === 2 && typeof key === 'string') {
            const getVal = accessor(valueOrCallback);
            for await (const item of exec()) {
              if (getVal(item) == key) return true;
            }
            return false;
          }
          for await (const item of exec()) {
            if (item == valueOrCallback) return true;
          }
          return false;
        })();
      }
      if (type === 'lazy') {
        let index = 0;
        for (const item of exec()) {
          if (typeof valueOrCallback === 'function') {
            if (valueOrCallback(item, index)) return true;
          } else if (arguments.length === 3) {
            if (accessor(key)(item) == value) return true;
          } else if (arguments.length === 2 && typeof key === 'string') {
            if (accessor(valueOrCallback)(item) == key) return true;
          } else {
            if (item == valueOrCallback) return true;
          }
          index++;
        }
        return false;
      }
      const items = exec();
      if (typeof valueOrCallback === 'function') return items.some(valueOrCallback);
      if (arguments.length === 3) return items.some(item => accessor(key)(item) == value);
      if (arguments.length === 2 && typeof key === 'string') {
        return items.some(item => accessor(valueOrCallback)(item) == key);
      }
      return items.some(item => item == valueOrCallback);
    },
    doesntContain(valueOrCallback, key, value) {
      const r = this.contains(valueOrCallback, key, value);
      if (r && typeof r.then === 'function') return r.then(v => !v);
      return !r;
    },
    has(...keys) {
      const items = _buildSync();
      if (!items.length) return false;
      return keys.every(key => items[0].hasOwnProperty(key));
    },
    duplicates(field) {
      const items = _buildSync();
      const getVal = field ? accessor(field) : (x) => x;
      const seen = new Map();
      const dupIndices = [];
      items.forEach((item, index) => {
        const val = getVal(item);
        if (seen.has(val)) dupIndices.push(index);
        else seen.set(val, index);
      });
      return config.app.$model(dupIndices.map(i => items[i]));
    },
    dump(label) {
      const items = _buildSync();
      if (label) console.log(label, items);
      else console.log(items);
      return this;
    },
    dd(label) {
      this.dump(label);
      throw new Error('Collection dd() called - execution halted for debugging');
    },
    whenEmpty(callback, otherwise) {
      const items = _buildSync();
      if (!items.length) callback(this);
      else if (otherwise) otherwise(this);
      return this;
    },
    whenNotEmpty(callback, otherwise) {
      const items = _buildSync();
      if (items.length) callback(this);
      else if (otherwise) otherwise(this);
      return this;
    },
    unlessEmpty(callback, otherwise) { return this.whenNotEmpty(callback, otherwise); },
    unlessNotEmpty(callback, otherwise) { return this.whenEmpty(callback, otherwise); },
    pipe(callback) { return callback(config.app.$model(_buildSync())); },
    find(value, key = 'id') {
      _syncDataVersion();
      if (_isPassThrough()) {
        if (state._indexes.has(key) && !state._indexesDirty.has(key)) {
          const idx = state._indexes.get(key);
          if (idx.type === 'map') {
            const res = idx.index.get(value);
            return res && res.length ? res[0] : null;
          }
        }
        return data.find(item => accessor(key)(item) == value) || null;
      }
      const getVal = accessor(key);
      return _buildSync().find(item => getVal(item) == value) || null;
    },
    findBy(field, value) {
      _syncDataVersion();
      if (_isPassThrough()) {
        if (state._indexes.has(field) && !state._indexesDirty.has(field)) {
          const idx = state._indexes.get(field);
          if (idx.type === 'map') {
            const res = idx.index.get(value);
            return res && res.length ? res[0] : null;
          }
        }
        return data.find(item => accessor(field)(item) == value) || null;
      }
      const getVal = accessor(field);
      return _buildSync().find(item => getVal(item) == value) || null;
    },
    findOrFail(value, key = 'id') {
      const res = this.find(value, key);
      if (!res) throw new Error(`Model not found for [${key} = ${value}]`);
      return res;
    },
    firstWhere(field, value) {
      const items = _buildSync();
      if (arguments.length === 1) {
        if (typeof field === 'function') return items.find(field) || null;
        if (typeof field === 'object' && field !== null) {
          const entries = Object.entries(field);
          return items.find(item => entries.every(([k, v]) => accessor(k)(item) == v)) || null;
        }
      }
      return items.find(item => accessor(field)(item) == value) || null;
    },
    firstOrFail() {
      const res = this.first();
      if (!res) throw new Error('No items found in collection');
      return res;
    },
    sole(field, value) {
      const items = _buildSync();
      let result;
      if (arguments.length === 0) result = items;
      else if (arguments.length === 1 && typeof field === 'function') result = items.filter(field);
      else result = items.filter(item => accessor(field)(item) == value);
      if (result.length !== 1) {
        throw new Error(`Expected exactly one result, found ${result.length}`);
      }
      return result[0];
    },
    get(key, defaultValue) {
      const { type, exec, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => {
          if (key === undefined) {
            let result = await _materialize(type, exec);
            if (type === 'async') result = _applyProjection(result);
            return result;
          }
          const items = await _materialize(type, exec);
          return items[key] !== undefined ? items[key] : defaultValue;
        })();
      }
      if (key === undefined) {
        let result = type === 'lazy' ? [...exec()] : exec();
        if (type !== 'lazy') result = _applyProjection(result);
        return result;
      }
      const items = type === 'lazy' ? [...exec()] : exec();
      if (Array.isArray(items) && !isNaN(Number(key))) {
        return items[key] !== undefined ? items[key] : defaultValue;
      }
      return items[key] !== undefined ? items[key] : defaultValue;
    },
    first() {
      const { type, exec } = _dispatch();
      if (type === 'async') {
        return (async () => {
          const res = await exec();
          const projected = _applyProjection(res);
          return projected[0] || null;
        })();
      }
      if (type === 'async-lazy') {
        return (async () => {
          const gen = exec();
          const first = await gen.next();
          return first.value || null;
        })();
      }
      if (type === 'lazy') {
        const gen = exec();
        return gen.next().value || null;
      }
      return _applyProjection(exec())[0] || null;
    },
    last() {
      const { type, exec } = _dispatch();
      if (type === 'async') {
        return (async () => {
          const res = await exec();
          const projected = _applyProjection(res);
          return projected[projected.length - 1] || null;
        })();
      }
      if (type === 'async-lazy') {
        return (async () => {
          const items = await materializeAsync(exec());
          return items[items.length - 1] || null;
        })();
      }
      if (type === 'lazy') {
        const res = [...exec()];
        return res[res.length - 1] || null;
      }
      const res = _applyProjection(exec());
      return res[res.length - 1] || null;
    },
    count() {
      const { type, exec } = _dispatch();
      if (type === 'lazy') {
        let count = 0;
        for (const _ of exec()) count++;
        return count;
      }
      if (type === 'async-lazy') {
        return (async () => {
          let count = 0;
          for await (const _ of exec()) count++;
          return count;
        })();
      }
      if (type === 'async') {
        return (async () => (await exec()).length)();
      }
      return exec().length;
    },
    exists() {
      const { type, exec } = _dispatch();
      if (type === 'lazy') {
        const gen = exec();
        return !gen.next().done;
      }
      if (type === 'async-lazy') {
        return (async () => {
          const gen = exec();
          const first = await gen.next();
          return !first.done;
        })();
      }
      if (type === 'async') {
        return (async () => (await exec()).length > 0)();
      }
      return exec().length > 0;
    },
    isEmpty() {
      const e = this.exists();
      if (e && typeof e.then === 'function') return e.then(v => !v);
      return !e;
    },
    isNotEmpty() {
      const e = this.exists();
      if (e && typeof e.then === 'function') return e.then(v => !!v);
      return !!e;
    },
    toJSON() {
      const { type, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => JSON.parse(JSON.stringify(await this.get())))();
      }
      return JSON.parse(JSON.stringify(this.get()));
    },
    toArray() { return this.get(); },
    all() { return this.get(); },
    toJson() {
      const { type, isAsync } = _dispatch();
      if (isAsync || type === 'async-lazy') {
        return (async () => JSON.stringify(await this.get()))();
      }
      return JSON.stringify(this.get());
    },
    update(attrs) {
      const items = _buildSync();
      items.forEach(item => Object.assign(item, attrs));
      _markDirty();
      return items.length;
    },
    delete() {
      const itemsToRemove = new Set(_buildSync());
      const originalLength = data.length;
      for (let i = data.length - 1; i >= 0; i--) {
        if (itemsToRemove.has(data[i])) data.splice(i, 1);
      }
      _markDirty();
      return originalLength - data.length;
    },
    with(relation) {
      data.forEach(item => {
        if (!Array.isArray(item[relation])) item[relation] = [];
      });
      _markDirty();
      return this;
    }
  };

  const macros = model._macros || {};
  Object.keys(macros).forEach(key => {
    if (!api[key]) {
      api[key] = function(...args) { return macros[key](api, ...args); };
    }
  });

  return api;
}

model._macros = {};
model.macro = (name, fn) => { model._macros[name] = fn; };
model.registerOperator = registerOperator;
