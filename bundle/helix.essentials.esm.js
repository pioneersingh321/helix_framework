/*! Helix Unified Framework Bundle | Plugins: [directives, helpers, fetch, store, axios, scope, tooltip, notify, loader] | (c) Helix.js */


// <define:import.meta.env>
var define_import_meta_env_default = {};

// packages/core/src/shared/registry.js
var AppRegistry = class {
  constructor() {
    this._bySelector = /* @__PURE__ */ new Map();
    this._byElement = /* @__PURE__ */ new Map();
    this._byId = /* @__PURE__ */ new Map();
    this._entries = /* @__PURE__ */ new Set();
  }
  register(selector, element, instance, app) {
    const entry = {
      selector: typeof selector === "string" ? selector : null,
      element,
      rootElement: element,
      instance,
      app,
      id: instance ? instance.id : null,
      mountedAt: Date.now()
    };
    this._entries.add(entry);
    if (typeof selector === "string") {
      this._bySelector.set(selector, entry);
    }
    if (element) {
      this._byElement.set(element, entry);
    }
    if (instance && instance.id) {
      this._byId.set(instance.id, entry);
    }
    return entry;
  }
  unregister(selector, element, instance) {
    let targetEntry = null;
    if (instance && this._byId.has(instance.id)) {
      targetEntry = this._byId.get(instance.id);
    } else if (element && this._byElement.has(element)) {
      targetEntry = this._byElement.get(element);
    } else if (typeof selector === "string" && this._bySelector.has(selector)) {
      targetEntry = this._bySelector.get(selector);
    }
    if (targetEntry) {
      this._entries.delete(targetEntry);
      if (targetEntry.selector)
        this._bySelector.delete(targetEntry.selector);
      if (targetEntry.element)
        this._byElement.delete(targetEntry.element);
      if (targetEntry.id)
        this._byId.delete(targetEntry.id);
    }
  }
  get(key) {
    if (typeof key === "string") {
      return this._bySelector.get(key) || null;
    }
    if (typeof key === "number") {
      return this._byId.get(key) || null;
    }
    if (key && key.nodeType === 1) {
      return this._byElement.get(key) || null;
    }
    return null;
  }
  has(key) {
    return this.get(key) !== null;
  }
  list() {
    return Array.from(this._entries);
  }
  all() {
    return Array.from(this._entries);
  }
  values() {
    return this._entries.values();
  }
  keys() {
    return this._bySelector.keys();
  }
  entries() {
    return Array.from(this._entries).map((e) => [e.selector || e.id, e]);
  }
  forEach(callback, thisArg) {
    this._entries.forEach((entry) => {
      callback.call(thisArg, entry, entry.selector || entry.id, this);
    });
  }
  get size() {
    return this._entries.size;
  }
  clear() {
    this._bySelector.clear();
    this._byElement.clear();
    this._byId.clear();
    this._entries.clear();
  }
  [Symbol.iterator]() {
    return this._entries[Symbol.iterator]();
  }
};
var globalApps = new AppRegistry();

// packages/core/src/app/config.js
var globalConfig = {
  debug: false,
  slowThreshold: 2,
  prefix: "h-",
  allowInlineExpressions: false,
  warnInlineExpressions: false,
  removeAttributeBindings: true,
  delimiters: ["{{", "}}"],
  rethrowErrors: true,
  htmlSanitizer: null,
  htmxIntegration: false,
  autoInjectCloak: true
};
Object.seal(globalConfig);

// packages/core/src/reactivity/scheduler.js
function queueJob(job, priority = 0) {
  if (!queueSet.has(job)) {
    queueSet.add(job);
    job.priority = priority;
    const id2 = job.id || 0;
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      const existing = queue[i];
      const existingP = existing.priority || 0;
      const existingId = existing.id || 0;
      if (priority > existingP || priority === existingP && id2 < existingId) {
        queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    if (!inserted)
      queue.push(job);
    queueFlush();
  }
}
function queuePreFlushCb(cb) {
  preFlushQueue.push(cb);
  queueFlush();
}
function queuePostFlushCb(cb) {
  postFlushQueue.push(cb);
  queueFlush();
}
function queueIdleJob(job) {
  idleQueue.push(job);
  if (idleCallbackId === null) {
    const scheduleIdle = typeof requestIdleCallback !== "undefined" ? (fn) => requestIdleCallback(fn, { timeout: 2e3 }) : (fn) => setTimeout(fn, 0);
    const cbId = scheduleIdle(() => {
      setIdleCallbackId(null);
      while (idleQueue.length) {
        const idleJob = idleQueue.shift();
        try {
          idleJob();
        } catch (e) {
          handleError(e, "idle job");
        }
      }
    });
    setIdleCallbackId(cbId);
  }
}
var queueFlushPaused = false;
function pauseQueueFlush() {
  queueFlushPaused = true;
}
function resumeQueueFlush() {
  queueFlushPaused = false;
  if (queue.length || preFlushQueue.length || postFlushQueue.length) {
    flushJobs();
  }
}
function queueFlush() {
  if (!isFlushPending && !queueFlushPaused) {
    setIsFlushPending(true);
    resolvedPromise.then(flushJobs);
  }
}
function flushJobs() {
  if (isFlushing) {
    setIsFlushPending(true);
    return;
  }
  setIsFlushPending(false);
  setIsFlushing(true);
  let flushCount = 0;
  let recursionDepth = 0;
  const MAX_RECURSION = 100;
  try {
    do {
      if (++flushCount > MAX_FLUSH) {
        logger.error("Infinite update loop detected (exceeded MAX_FLUSH)", "scheduler");
        break;
      }
      if (++recursionDepth > MAX_RECURSION) {
        logger.error("Scheduler recursion depth exceeded", "scheduler");
        break;
      }
      trace("Batch Flush", "flush", () => {
        for (let i = 0; i < preFlushQueue.length; i++)
          preFlushQueue[i]();
        preFlushQueue.length = 0;
        const high = [];
        const normal = [];
        const low = [];
        for (let i = 0; i < queue.length; i++) {
          const job = queue[i];
          if (job) {
            const prio = job.priority || 0;
            if (prio >= 10)
              high.push(job);
            else if (prio >= 0)
              normal.push(job);
            else
              low.push(job);
          }
        }
        queue.length = 0;
        queueSet.clear();
        for (let i = 0; i < high.length; i++)
          high[i]();
        for (let i = 0; i < normal.length; i++)
          normal[i]();
        for (let i = 0; i < low.length; i++)
          low[i]();
        for (let i = 0; i < postFlushQueue.length; i++)
          postFlushQueue[i]();
        postFlushQueue.length = 0;
      });
    } while (queue.length || preFlushQueue.length || postFlushQueue.length);
  } finally {
    setIsFlushing(false);
    if (isFlushPending) {
      setIsFlushPending(false);
      flushJobs();
    }
  }
}

// packages/core/src/shared/memory.js
var activeEffectRegistry = /* @__PURE__ */ new Set();
function registerActiveEffect(eff) {
  if (!globalConfig.debug)
    return;
  activeEffectRegistry.add(eff);
}
function unregisterActiveEffect(eff) {
  if (!globalConfig.debug)
    return;
  activeEffectRegistry.delete(eff);
}
function checkMemoryLeaks() {
  if (!globalConfig.debug)
    return [];
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

// packages/core/src/reactivity/effect.js
var batchDepth = 0;
var batchedEffects = /* @__PURE__ */ new Set();
function batch(fn, options = {}) {
  if (batchDepth === 0)
    pauseQueueFlush();
  batchDepth++;
  const priorityOverride = options && typeof options.priority === "number" ? options.priority : null;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effectsToRun = Array.from(batchedEffects);
      batchedEffects.clear();
      effectsToRun.forEach((effectFn) => {
        if (effectFn.active && !effectFn.paused) {
          const prio = priorityOverride !== null ? priorityOverride : effectFn.priority || 0;
          if (effectFn.scheduler)
            effectFn.scheduler();
          else
            queueJob(effectFn, prio);
        }
      });
      resumeQueueFlush();
    }
  }
}
batch.high = (fn) => batch(fn, { priority: 10 });
batch.low = (fn) => batch(fn, { priority: -10 });
var trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  setShouldTrack(false);
}
function enableTracking() {
  trackStack.push(shouldTrack);
  setShouldTrack(true);
}
function resetTracking() {
  const last = trackStack.pop();
  setShouldTrack(last === void 0 ? true : last);
}
function resumeTracking() {
  trackStack.length = 0;
  setShouldTrack(true);
}
function untrack(fn) {
  pauseTracking();
  try {
    return fn();
  } finally {
    resetTracking();
  }
}
function track(target, key) {
  if (!activeEffect || !shouldTrack)
    return;
  let depsMap = targetMap.get(target);
  if (!depsMap)
    targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
  let dep = depsMap.get(key);
  if (!dep)
    depsMap.set(key, dep = /* @__PURE__ */ new Set());
  if (dep.has(activeEffect))
    return;
  dep.add(activeEffect);
  activeEffect.deps.add(dep);
  if (activeEffect.onTrack) {
    try {
      activeEffect.onTrack({ target, key, effect: activeEffect });
    } catch (e) {
    }
  }
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap)
    return;
  const dep = depsMap.get(key);
  const wildcardDep = key !== "*" ? depsMap.get("*") : void 0;
  if (!dep && !wildcardDep)
    return;
  const effectsToRun = /* @__PURE__ */ new Set();
  const collect = (effectFn) => {
    if (effectFn !== activeEffect)
      effectsToRun.add(effectFn);
  };
  if (dep)
    dep.forEach(collect);
  if (wildcardDep)
    wildcardDep.forEach(collect);
  effectsToRun.forEach((effectFn) => {
    if (!effectFn.active || effectFn.paused)
      return;
    if (effectFn.onTrigger) {
      try {
        effectFn.onTrigger({ target, key, effect: effectFn });
      } catch (e) {
      }
    }
    if (batchDepth > 0) {
      batchedEffects.add(effectFn);
    } else {
      if (effectFn.scheduler)
        effectFn.scheduler();
      else
        queueJob(effectFn, effectFn.priority || 0);
    }
  });
}
function cleanupDeps(effectFn) {
  if (effectFn.deps) {
    effectFn.deps.forEach((depSet) => depSet.delete(effectFn));
    effectFn.deps.clear();
  }
}
function cleanup(effectFn) {
  if (effectFn.onCleanupFn) {
    effectFn.onCleanupFn();
    effectFn.onCleanupFn = null;
  }
  cleanupDeps(effectFn);
}
function simpleEffect(fn, options = {}) {
  if (typeof options === "string")
    options = { name: options };
  const name = options.name || "Simple Effect";
  const area = options.area || "reactive";
  let active = true;
  let value;
  const run = () => {
    if (!active)
      return;
    const prev = activeEffect;
    setActiveEffect(null);
    try {
      value = trace(name, area, () => fn());
    } catch (err) {
      handleError(err, `simpleEffect: ${name}`);
    } finally {
      setActiveEffect(prev);
    }
  };
  run();
  return {
    stop: () => {
      active = false;
    },
    run,
    get value() {
      return value;
    }
  };
}
function parsePriority(prio) {
  if (typeof prio === "number")
    return prio;
  if (prio === "high")
    return 10;
  if (prio === "low")
    return -10;
  if (prio === "normal")
    return 0;
  return 0;
}
function effect(fn, options = {}) {
  if (typeof options === "string")
    options = { name: options };
  const name = options.name || "Anonymous Effect";
  const area = options.area || "reactive";
  const effectFunc = () => {
    if (!effectFunc.active || effectFunc.paused)
      return;
    cleanup(effectFunc);
    const prevBlock = currentBlock;
    if (currentBlock)
      currentBlock.push(effectFunc);
    const prev = activeEffect;
    setActiveEffect(effectFunc);
    const onCleanup = (cb) => {
      effectFunc.onCleanupFn = cb;
    };
    try {
      return trace(name, area, () => fn(onCleanup));
    } catch (err) {
      handleError(err, `effect: ${name}`);
    } finally {
      setActiveEffect(prev);
    }
  };
  effectFunc.id = incrementEffectUid();
  effectFunc._name = name;
  effectFunc.scheduler = options.scheduler;
  effectFunc.priority = parsePriority(options.priority);
  effectFunc.deps = /* @__PURE__ */ new Set();
  effectFunc.active = true;
  effectFunc.paused = false;
  effectFunc.onTrack = options.onTrack;
  effectFunc.onTrigger = options.onTrigger;
  effectFunc.pause = () => {
    effectFunc.paused = true;
  };
  effectFunc.resume = () => {
    if (effectFunc.paused) {
      effectFunc.paused = false;
      effectFunc();
    }
  };
  effectFunc.stop = () => {
    if (effectFunc.active) {
      effectFunc.active = false;
      cleanup(effectFunc);
      unregisterActiveEffect(effectFunc);
    }
  };
  registerActiveEffect(effectFunc);
  if (activeScope && !activeScope.effects.includes(effectFunc)) {
    activeScope.effects.push(effectFunc);
  }
  if (!options.lazy)
    effectFunc();
  if (currentInstance) {
    if (!effectFunc._registeredInstances)
      effectFunc._registeredInstances = /* @__PURE__ */ new Set();
    if (!effectFunc._registeredInstances.has(currentInstance.id)) {
      effectFunc._registeredInstances.add(currentInstance.id);
      currentInstance.cleanups.push(() => stopEffect(effectFunc));
    }
  }
  return effectFunc;
}
function stopEffect(effectFn) {
  if (effectFn && typeof effectFn.stop === "function") {
    effectFn.stop();
  } else {
    cleanup(effectFn);
  }
}

// packages/core/src/shared/shared.js
var VERSION = typeof __CORE_VERSION__ !== "undefined" ? __CORE_VERSION__ : "11.1.21";
var RAW = Symbol("__hx_raw");
var IS_REF = Symbol("__hx_is_ref");
var IS_REACTIVE = Symbol("__hx_is_reactive");
var IS_READONLY = Symbol("__hx_is_readonly");
var IS_SHALLOW = Symbol("__hx_is_shallow");
var SKIP = Symbol("__hx_skip");
var BOUND = Symbol("bound");
var PatchFlags = {
  TEXT: 1,
  CLASS: 2,
  STYLE: 4,
  PROPS: 8,
  FULL_PROPS: 16,
  HYDRATE_EVENTS: 32,
  STABLE_FRAGMENT: 64,
  KEYED_FRAGMENT: 128,
  UNKEYED_FRAGMENT: 256,
  NEED_PATCH: 512,
  DYNAMIC_SLOTS: 1024,
  DEV_ROOT_FRAGMENT: 2048
};
var globalComponents = {};
var globalDirectives = {};
var globalPlugins = [];
var activeEffect = null;
function setActiveEffect(effect2) {
  activeEffect = effect2;
}
var currentInstance = null;
function setCurrentInstance(instance) {
  currentInstance = instance;
}
var shouldTrack = true;
function setShouldTrack(val) {
  shouldTrack = val;
}
var effectUid = 0;
function incrementEffectUid() {
  return effectUid++;
}
var globalInstanceId = 0;
function incrementGlobalInstanceId() {
  return ++globalInstanceId;
}
var traceDepth = 0;
var activeScope = null;
function setActiveScope(scope) {
  activeScope = scope;
}
var currentBlock = null;
function openBlock() {
  currentBlock = [];
}
function closeBlock() {
  const block = currentBlock;
  currentBlock = null;
  return block;
}
var targetMap = /* @__PURE__ */ new WeakMap();
var reactiveMap = /* @__PURE__ */ new WeakMap();
var readonlyMap = /* @__PURE__ */ new WeakMap();
var staticNodeCache = /* @__PURE__ */ new WeakMap();
var pathCache = /* @__PURE__ */ new Map();
var MAX_PATH_CACHE_SIZE = 1e3;
var vForKeyMap = /* @__PURE__ */ new WeakMap();
var queue = [];
var queueSet = /* @__PURE__ */ new Set();
var preFlushQueue = [];
var postFlushQueue = [];
var idleQueue = [];
var idleCallbackId = null;
function setIdleCallbackId(val) {
  idleCallbackId = val;
}
var isFlushing = false;
function setIsFlushing(val) {
  isFlushing = val;
}
var isFlushPending = false;
function setIsFlushPending(val) {
  isFlushPending = val;
}
var MAX_FLUSH = 1e3;
var resolvedPromise = Promise.resolve();
var areas = {
  core: "\u{1F680}",
  component: "\u{1F9E9}",
  directive: "\u{1F6E0}\uFE0F",
  plugin: "\u{1F4E6}",
  binding: "\u{1F517}",
  scope: "\u{1F3AF}",
  reactive: "\u26A1",
  ref: "\u{1F4CD}",
  watch: "\u{1F441}\uFE0F",
  computed: "\u{1F9EE}",
  scheduler: "\u{1F504}",
  queue: "\u{1F4E5}",
  flush: "\u267B\uFE0F",
  render: "\u{1F3A8}",
  dom: "\u{1F333}",
  template: "\u{1F9F1}",
  parser: "\u{1F4DC}",
  compiler: "\u{1F3D7}\uFE0F",
  event: "\u{1F4E2}",
  network: "\u{1F310}",
  storage: "\u{1F4BE}",
  cleanup: "\u{1F9F9}",
  destroy: "\u{1F5D1}\uFE0F",
  validation: "\u2714\uFE0F",
  security: "\u{1F512}",
  perf: "\u23F1\uFE0F",
  config: "\u2699\uFE0F",
  api: "\u{1F50C}",
  trace: "\u{1F50D}"
};
function getLogPrefix(level, area) {
  const subsystemIcon = area ? areas[area] || "" : "";
  let levelIcon = "";
  if (level === "trace")
    levelIcon = "\u{1F50D}";
  else if (level === "debug")
    levelIcon = "\u{1F41E}";
  else if (level === "info")
    levelIcon = "\u2139\uFE0F";
  else if (level === "warn")
    levelIcon = "\u26A0\uFE0F";
  else if (level === "error")
    levelIcon = "\u274C";
  else if (level === "fatal")
    levelIcon = "\u{1F4A5}";
  else if (level === "perf")
    levelIcon = "\u23F1\uFE0F";
  if (subsystemIcon) {
    if (level === "perf")
      return subsystemIcon;
    return `${levelIcon} [Helix ${subsystemIcon}]`;
  }
  return `${levelIcon} [Helix]`;
}
function parseLogArgs(args) {
  let area = void 0;
  let extraArgs = [];
  if (args.length > 0) {
    const first = args[0];
    if (typeof first === "string" && first in areas) {
      area = first;
      extraArgs = args.slice(1);
    } else if (first && typeof first === "object" && "area" in first) {
      area = first.area;
      extraArgs = args.slice(1);
    } else {
      extraArgs = args;
    }
  }
  return { area, args: extraArgs };
}
var logger = {
  registerArea(name, icon) {
    areas[name] = icon;
  },
  trace(msg, ...args) {
    if (globalConfig.debug) {
      const parsed = parseLogArgs(args);
      console.debug(`${getLogPrefix("trace", parsed.area)} ${msg}`, ...parsed.args);
    }
  },
  debug(msg, ...args) {
    if (globalConfig.debug) {
      const parsed = parseLogArgs(args);
      console.debug(`${getLogPrefix("debug", parsed.area)} ${msg}`, ...parsed.args);
    }
  },
  info(msg, ...args) {
    const parsed = parseLogArgs(args);
    console.info(`${getLogPrefix("info", parsed.area)} ${msg}`, ...parsed.args);
  },
  warn(msg, ...args) {
    if (globalConfig.debug) {
      const parsed = parseLogArgs(args);
      console.warn(`${getLogPrefix("warn", parsed.area)} ${msg}`, ...parsed.args);
    }
  },
  error(msg, ...args) {
    const parsed = parseLogArgs(args);
    console.error(`${getLogPrefix("error", parsed.area)} ${msg}`, ...parsed.args);
  },
  fatal(msg, ...args) {
    const parsed = parseLogArgs(args);
    console.error(`${getLogPrefix("fatal", parsed.area)} ${msg}`, ...parsed.args);
  },
  perf(name, time, area) {
    if (globalConfig.debug) {
      const finalArea = area || "perf";
      const icon = getLogPrefix("perf", finalArea);
      console.log(`${icon} [Helix Perf] ${name} took ${time.toFixed(2)}ms`);
    }
  }
};
var warn = (msg, area, ...args) => {
  logger.warn(msg, area, ...args);
};
var globalErrorHandlers = /* @__PURE__ */ new Set();
function onErrorGlobal(handler) {
  if (typeof handler === "function") {
    globalErrorHandlers.add(handler);
    return () => globalErrorHandlers.delete(handler);
  }
}
var handleError = (err, context, instance = null) => {
  logger.fatal(`Caught in ${context}:`, err);
  if (instance && instance.name)
    warn(`Crash in component <${instance.name}>:`, "component", err);
  else if (instance && instance.root)
    warn(`Crash in component:`, "component", instance.root);
  let handled = false;
  let cur = instance;
  while (cur) {
    const hooks = cur.errorCapturedHooks;
    if (hooks && hooks.length > 0) {
      for (let i = 0; i < hooks.length; i++) {
        try {
          const result = hooks[i](err, instance, context);
          if (result === false) {
            handled = true;
          }
        } catch (hErr) {
          console.error("Error inside onErrorCaptured handler:", hErr);
        }
      }
    }
    if (handled)
      break;
    cur = cur.parent;
  }
  if (!handled && globalErrorHandlers.size > 0) {
    globalErrorHandlers.forEach((handler) => {
      try {
        const result = handler(err, instance, context);
        if (result === false)
          handled = true;
      } catch (hErr) {
        console.error("Error inside global error handler:", hErr);
      }
    });
  }
  if (!handled && globalConfig.rethrowErrors !== false)
    throw err;
};
var perfMarks = /* @__PURE__ */ new Map();
var trace = (name, ...args) => {
  let fn;
  let area = void 0;
  if (args.length === 2) {
    area = args[0];
    fn = args[1];
  } else {
    fn = args[0];
  }
  if (!globalConfig.debug)
    return fn();
  traceDepth++;
  const start = performance.now();
  let res;
  try {
    res = fn();
    return res;
  } finally {
    const time = performance.now() - start;
    traceDepth--;
    if (time > globalConfig.slowThreshold && traceDepth === 0) {
      logger.perf(name, time, area);
    }
  }
};
function markTrace(name) {
  if (!globalConfig.debug)
    return;
  perfMarks.set(name, performance.now());
}
function measureTrace(name, label) {
  if (!globalConfig.debug)
    return;
  const start = perfMarks.get(name);
  if (start) {
    const time = performance.now() - start;
    const displayName = label || name;
    let area = void 0;
    const lower = displayName.toLowerCase();
    if (lower.includes("mount"))
      area = "mount";
    else if (lower.includes("flush"))
      area = "flush";
    else if (lower.includes("scheduler"))
      area = "scheduler";
    logger.perf(displayName, time, area);
    perfMarks.delete(name);
  }
}
function getLIS(arr) {
  const result = [];
  const prev = new Array(arr.length).fill(-1);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === -1)
      continue;
    if (result.length === 0 || arr[result[result.length - 1]] < arr[i]) {
      prev[i] = result.length > 0 ? result[result.length - 1] : -1;
      result.push(i);
    } else {
      let left = 0, right = result.length - 1;
      while (left < right) {
        const mid = left + right >> 1;
        if (arr[result[mid]] < arr[i])
          left = mid + 1;
        else
          right = mid;
      }
      prev[i] = left > 0 ? result[left - 1] : -1;
      result[left] = i;
    }
  }
  const lis = new Array(result.length);
  let k = result[result.length - 1];
  for (let i = result.length - 1; i >= 0; i--) {
    lis[i] = k;
    k = prev[k];
  }
  return lis;
}
function nextTick(fn) {
  if (fn) {
    return resolvedPromise.then(fn).catch((err) => handleError(err, "nextTick"));
  }
  return resolvedPromise;
}
function lazyBind(node, ctx, instance, bindNode, options = {}) {
  const { rootMargin = "100px", threshold = 0 } = options;
  if (typeof IntersectionObserver === "undefined") {
    bindNode(node, ctx, instance);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        bindNode(node, ctx, instance);
        observer.unobserve(node);
      }
    });
  }, { rootMargin, threshold });
  observer.observe(node);
  if (!node.__hx_cleanup)
    node.__hx_cleanup = [];
  node.__hx_cleanup.push(() => observer.disconnect());
}
var EffectScope = class {
  constructor() {
    this.effects = [];
    this.scopes = [];
    this.cleanups = [];
    this._busListeners = [];
    this.active = true;
    this.dirty = false;
    this._refreshPending = false;
    this.refreshCallbacks = /* @__PURE__ */ new Set();
  }
  run(fn) {
    if (this.active) {
      const prev = activeScope;
      setActiveScope(this);
      try {
        return fn();
      } finally {
        setActiveScope(prev);
      }
    }
  }
  refresh() {
    if (!this.active || this._refreshPending)
      return;
    this.dirty = true;
    this._refreshPending = true;
    queueMicrotask(() => {
      if (!this.active)
        return;
      this._refreshPending = false;
      this.dirty = false;
      this.effects.forEach((eff) => {
        if (eff && eff.active && !eff.paused) {
          if (eff.scheduler)
            eff.scheduler();
          else
            eff();
        }
      });
      this.refreshCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          handleError(e, "EffectScope refresh callback");
        }
      });
    });
  }
  stop() {
    if (this.active) {
      for (let i = 0; i < this.scopes.length; i++) {
        try {
          this.scopes[i].stop();
        } catch (e) {
        }
      }
      this.scopes.length = 0;
      for (let i = 0; i < this.effects.length; i++) {
        stopEffect(this.effects[i]);
      }
      this.effects.length = 0;
      for (let i = 0; i < this.cleanups.length; i++) {
        try {
          this.cleanups[i]();
        } catch (e) {
          handleError(e, "EffectScope cleanup");
        }
      }
      this.cleanups.length = 0;
      for (let i = 0; i < this._busListeners.length; i++) {
        try {
          this._busListeners[i]();
        } catch (e) {
        }
      }
      this._busListeners.length = 0;
      this.refreshCallbacks.clear();
      this.active = false;
      this.dirty = false;
    }
  }
};
function compareVersion(a, b) {
  const pa = String(a).split(/[-+\.]/).filter(Boolean);
  const pb = String(b).split(/[-+\.]/).filter(Boolean);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] || "0", 10);
    const nb = parseInt(pb[i] || "0", 10);
    if (na > nb)
      return 1;
    if (na < nb)
      return -1;
  }
  return 0;
}
function satisfiesVersion(version, range) {
  if (!range)
    return true;
  const v = String(version);
  const r = String(range).trim();
  if (r.startsWith(">="))
    return compareVersion(v, r.slice(2)) >= 0;
  if (r.startsWith(">"))
    return compareVersion(v, r.slice(1)) > 0;
  if (r.startsWith("<="))
    return compareVersion(v, r.slice(2)) <= 0;
  if (r.startsWith("<"))
    return compareVersion(v, r.slice(1)) < 0;
  if (r.startsWith("^")) {
    const major = r.slice(1).split(".")[0];
    return compareVersion(v, r.slice(1)) >= 0 && String(v).split(".")[0] === major;
  }
  if (r.startsWith("~")) {
    const parts = r.slice(1).split(".");
    return compareVersion(v, r.slice(1)) >= 0 && String(v).split(".").slice(0, 2).join(".") === parts.slice(0, 2).join(".");
  }
  return compareVersion(v, r) === 0;
}

// packages/core/src/app/bus.js
function createBus() {
  const listeners = /* @__PURE__ */ new Map();
  const onceWrappers = /* @__PURE__ */ new WeakMap();
  const _emitError = (event, error, listener) => {
    const errorHandlers = listeners.get("bus:error");
    if (errorHandlers) {
      for (const fn of [...errorHandlers]) {
        try {
          fn({ event, error, listener });
        } catch (_) {
        }
      }
    }
  };
  const bus = {
    on(event, handler) {
      if (typeof handler !== "function") {
        warn(`Bus handler for "${event}" must be a function.`, "event");
        return () => {
        };
      }
      if (!listeners.has(event))
        listeners.set(event, /* @__PURE__ */ new Set());
      listeners.get(event).add(handler);
      const cleanup2 = () => {
        const set = listeners.get(event);
        if (set) {
          set.delete(handler);
          if (set.size === 0)
            listeners.delete(event);
        }
      };
      if (activeScope && activeScope.active) {
        activeScope._busListeners.push(cleanup2);
      } else if (currentInstance && currentInstance.cleanups) {
        currentInstance.cleanups.push(cleanup2);
      }
      return cleanup2;
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (!set)
        return;
      const wrapped = onceWrappers.get(handler);
      set.delete(wrapped || handler);
      if (wrapped)
        onceWrappers.delete(handler);
      if (set.size === 0)
        listeners.delete(event);
    },
    once(event, handler) {
      const wrapped = (...args) => {
        bus.off(event, wrapped);
        onceWrappers.delete(handler);
        handler(...args);
      };
      onceWrappers.set(handler, wrapped);
      return bus.on(event, wrapped);
    },
    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set)
        return;
      for (const fn of [...set]) {
        try {
          fn(...args);
        } catch (e) {
          _emitError(event, e, fn);
        }
      }
    },
    all() {
      const result = {};
      listeners.forEach((set, evt) => {
        result[evt] = set.size;
      });
      return result;
    },
    clear() {
      listeners.clear();
    }
  };
  return bus;
}

// packages/core/src/reactivity/reactive.js
var arrayInstrumentations = {};
["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].forEach((method) => {
  arrayInstrumentations[method] = function(...args) {
    pauseTracking();
    const res = Array.prototype[method].apply(this[RAW], args);
    resumeTracking();
    const depsMap = targetMap.get(this[RAW]);
    if (depsMap && depsMap.has("length")) {
      trigger(this[RAW], "length");
    }
    trigger(this[RAW], "*");
    return res;
  };
});
var mapInstrumentations = {
  get(key) {
    const target = this[RAW];
    const rawKey = toRaw(key);
    track(target, rawKey);
    const res = target.get(rawKey);
    if (this[IS_READONLY]) {
      return typeof res === "object" && res !== null && !isRaw(res) ? readonly(res) : res;
    }
    if (this[IS_SHALLOW]) {
      return res;
    }
    return typeof res === "object" && res !== null && !isRaw(res) ? reactive(res) : res;
  },
  has(key) {
    const target = this[RAW];
    const rawKey = toRaw(key);
    track(target, rawKey);
    return target.has(rawKey);
  },
  set(key, value) {
    if (this[IS_READONLY]) {
      warn(`[Helix] Set operation on readonly Map failed.`, "reactive");
      return this;
    }
    const target = this[RAW];
    const rawKey = toRaw(key);
    const rawValue = toRaw(value);
    const hadKey = target.has(rawKey);
    const oldValue = target.get(rawKey);
    target.set(rawKey, rawValue);
    if (!hadKey) {
      trigger(target, rawKey);
      trigger(target, "size");
      trigger(target, "*");
    } else if (oldValue !== rawValue) {
      trigger(target, rawKey);
      trigger(target, "*");
    }
    return this;
  },
  delete(key) {
    if (this[IS_READONLY]) {
      warn(`[Helix] Delete operation on readonly Map failed.`, "reactive");
      return false;
    }
    const target = this[RAW];
    const rawKey = toRaw(key);
    const hadKey = target.has(rawKey);
    const res = target.delete(rawKey);
    if (hadKey) {
      trigger(target, rawKey);
      trigger(target, "size");
      trigger(target, "*");
    }
    return res;
  },
  clear() {
    if (this[IS_READONLY]) {
      warn(`[Helix] Clear operation on readonly Map failed.`, "reactive");
      return;
    }
    const target = this[RAW];
    const hadEntries = target.size > 0;
    const oldKeys = Array.from(target.keys());
    target.clear();
    if (hadEntries) {
      trigger(target, "size");
      trigger(target, "*");
      oldKeys.forEach((k) => trigger(target, k));
    }
  },
  forEach(callback, thisArg) {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    target.forEach((val, key) => {
      const wrappedVal = isReadonly2 ? typeof val === "object" && val !== null && !isRaw(val) ? readonly(val) : val : isShallow2 ? val : typeof val === "object" && val !== null && !isRaw(val) ? reactive(val) : val;
      callback.call(thisArg, wrappedVal, key, this);
    });
  },
  keys() {
    const target = this[RAW];
    track(target, "*");
    return target.keys();
  },
  values() {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    const iterator = target.values();
    return {
      next() {
        const { value, done } = iterator.next();
        if (done)
          return { value: void 0, done: true };
        const wrapped = isReadonly2 ? typeof value === "object" && value !== null && !isRaw(value) ? readonly(value) : value : isShallow2 ? value : typeof value === "object" && value !== null && !isRaw(value) ? reactive(value) : value;
        return { value: wrapped, done: false };
      },
      [Symbol.iterator]() {
        return this;
      }
    };
  },
  entries() {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    const iterator = target.entries();
    return {
      next() {
        const { value, done } = iterator.next();
        if (done)
          return { value: void 0, done: true };
        const [k, v] = value;
        const wrappedV = isReadonly2 ? typeof v === "object" && v !== null && !isRaw(v) ? readonly(v) : v : isShallow2 ? v : typeof v === "object" && v !== null && !isRaw(v) ? reactive(v) : v;
        return { value: [k, wrappedV], done: false };
      },
      [Symbol.iterator]() {
        return this;
      }
    };
  },
  [Symbol.iterator]() {
    return mapInstrumentations.entries.call(this);
  }
};
var setInstrumentations = {
  has(value) {
    const target = this[RAW];
    const rawVal = toRaw(value);
    track(target, rawVal);
    return target.has(rawVal);
  },
  add(value) {
    if (this[IS_READONLY]) {
      warn(`[Helix] Add operation on readonly Set failed.`, "reactive");
      return this;
    }
    const target = this[RAW];
    const rawVal = toRaw(value);
    const hadVal = target.has(rawVal);
    if (!hadVal) {
      target.add(rawVal);
      trigger(target, rawVal);
      trigger(target, "size");
      trigger(target, "*");
    }
    return this;
  },
  delete(value) {
    if (this[IS_READONLY]) {
      warn(`[Helix] Delete operation on readonly Set failed.`, "reactive");
      return false;
    }
    const target = this[RAW];
    const rawVal = toRaw(value);
    const hadVal = target.has(rawVal);
    const res = target.delete(rawVal);
    if (hadVal) {
      trigger(target, rawVal);
      trigger(target, "size");
      trigger(target, "*");
    }
    return res;
  },
  clear() {
    if (this[IS_READONLY]) {
      warn(`[Helix] Clear operation on readonly Set failed.`, "reactive");
      return;
    }
    const target = this[RAW];
    const hadEntries = target.size > 0;
    const oldValues = Array.from(target.values());
    target.clear();
    if (hadEntries) {
      trigger(target, "size");
      trigger(target, "*");
      oldValues.forEach((v) => trigger(target, v));
    }
  },
  forEach(callback, thisArg) {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    target.forEach((val) => {
      const wrapped = isReadonly2 ? typeof val === "object" && val !== null && !isRaw(val) ? readonly(val) : val : isShallow2 ? val : typeof val === "object" && val !== null && !isRaw(val) ? reactive(val) : val;
      callback.call(thisArg, wrapped, wrapped, this);
    });
  },
  values() {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    const iterator = target.values();
    return {
      next() {
        const { value, done } = iterator.next();
        if (done)
          return { value: void 0, done: true };
        const wrapped = isReadonly2 ? typeof value === "object" && value !== null && !isRaw(value) ? readonly(value) : value : isShallow2 ? value : typeof value === "object" && value !== null && !isRaw(value) ? reactive(value) : value;
        return { value: wrapped, done: false };
      },
      [Symbol.iterator]() {
        return this;
      }
    };
  },
  keys() {
    return setInstrumentations.values.call(this);
  },
  entries() {
    const target = this[RAW];
    const isReadonly2 = this[IS_READONLY];
    const isShallow2 = this[IS_SHALLOW];
    track(target, "*");
    const iterator = target.entries();
    return {
      next() {
        const { value, done } = iterator.next();
        if (done)
          return { value: void 0, done: true };
        const [k, v] = value;
        const wrapped = isReadonly2 ? typeof v === "object" && v !== null && !isRaw(v) ? readonly(v) : v : isShallow2 ? v : typeof v === "object" && v !== null && !isRaw(v) ? reactive(v) : v;
        return { value: [wrapped, wrapped], done: false };
      },
      [Symbol.iterator]() {
        return this;
      }
    };
  },
  [Symbol.iterator]() {
    return setInstrumentations.values.call(this);
  }
};
var dateMutators = [
  "setTime",
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
  "setUTCFullYear",
  "setUTCMonth",
  "setUTCDate",
  "setUTCHours",
  "setUTCMinutes",
  "setUTCSeconds",
  "setUTCMilliseconds"
];
var dateGetters = [
  "getTime",
  "getFullYear",
  "getMonth",
  "getDate",
  "getDay",
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getTimezoneOffset",
  "getUTCFullYear",
  "getUTCMonth",
  "getUTCDate",
  "getUTCDay",
  "getUTCHours",
  "getUTCMinutes",
  "getUTCSeconds",
  "getUTCMilliseconds",
  "toISOString",
  "toUTCString",
  "toDateString",
  "toTimeString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleString",
  "toString",
  "valueOf",
  "toJSON"
];
var dateInstrumentations = {};
dateMutators.forEach((method) => {
  dateInstrumentations[method] = function(...args) {
    if (this[IS_READONLY]) {
      warn(`[Helix] Mutation operation on readonly Date failed: ${method}`, "reactive");
      return this[RAW].getTime();
    }
    const target = this[RAW];
    const res = target[method].apply(target, args);
    trigger(target, "*");
    trigger(target, "getTime");
    trigger(target, "value");
    return res;
  };
});
dateGetters.forEach((method) => {
  dateInstrumentations[method] = function(...args) {
    const target = this[RAW];
    track(target, "*");
    track(target, "getTime");
    return target[method].apply(target, args);
  };
});
var hasDOM = typeof Node !== "undefined";
function isRaw(value) {
  if (!value || typeof value !== "object")
    return false;
  if (value[SKIP])
    return true;
  if (value.nodeType !== void 0 || value.window === value || value.target !== void 0 && (value.srcElement !== void 0 || value.currentTarget !== void 0)) {
    return true;
  }
  const ctorName = value.constructor ? value.constructor.name : "";
  if (ctorName === "EffectScope" || ctorName === "WeakSet" || ctorName === "WeakMap" || ctorName === "RegExp" || ctorName === "Promise" || value instanceof WeakSet || value instanceof WeakMap || value instanceof RegExp || value instanceof Promise || value instanceof EffectScope) {
    return true;
  }
  if (!hasDOM)
    return false;
  return value instanceof Node || value instanceof Event || value instanceof NodeList || value instanceof HTMLCollection || value instanceof DOMTokenList || value instanceof Window || value instanceof Document || value instanceof CSSStyleDeclaration;
}
var boundMethodCache = /* @__PURE__ */ new WeakMap();
function getBoundMethod(fn, receiver) {
  let methodMap = boundMethodCache.get(receiver);
  if (!methodMap) {
    methodMap = /* @__PURE__ */ new WeakMap();
    boundMethodCache.set(receiver, methodMap);
  }
  let bound = methodMap.get(fn);
  if (!bound) {
    bound = fn.bind(receiver);
    methodMap.set(fn, bound);
  }
  return bound;
}
function reactive(target) {
  if (typeof target !== "object" || target === null)
    return target;
  if (isRaw(target))
    return target;
  if (target[IS_READONLY])
    return target;
  if (target[IS_REACTIVE])
    return target;
  if (target[SKIP])
    return target;
  if (reactiveMap.has(target))
    return reactiveMap.get(target);
  const isMapTarget = target instanceof Map;
  const isSetTarget = target instanceof Set;
  const isDateTarget = target instanceof Date;
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW)
        return obj;
      if (key === IS_REACTIVE)
        return true;
      if (key === IS_READONLY)
        return false;
      if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (isMapTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (mapInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(mapInstrumentations, key, receiver);
        }
      }
      if (isSetTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (setInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(setInstrumentations, key, receiver);
        }
      }
      if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(dateInstrumentations, key, receiver);
      }
      const res = Reflect.get(obj, key, receiver);
      if (typeof res === "function") {
        const isBuiltin = obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp || obj.constructor && obj.constructor.name === "EffectScope";
        const bindTarget = isBuiltin ? obj : receiver;
        return getBoundMethod(res, bindTarget);
      }
      track(obj, key);
      if (Array.isArray(obj))
        track(obj, "*");
      return typeof res === "object" && res !== null && !isRaw(res) ? reactive(res) : res;
    },
    set(obj, key, value, receiver) {
      const oldValue = obj[key];
      const res = Reflect.set(obj, key, value, receiver);
      if (oldValue !== value || Array.isArray(obj) && key === "length") {
        trigger(obj, key);
        if (Array.isArray(obj))
          trigger(obj, "*");
      }
      return res;
    }
  });
  reactiveMap.set(target, proxy);
  return proxy;
}
function shallowReactive(target) {
  if (typeof target !== "object" || target === null)
    return target;
  if (isRaw(target))
    return target;
  if (target[IS_READONLY])
    return target;
  if (target[IS_REACTIVE])
    return target;
  if (target[SKIP])
    return target;
  const isMapTarget = target instanceof Map;
  const isSetTarget = target instanceof Set;
  const isDateTarget = target instanceof Date;
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW)
        return obj;
      if (key === IS_REACTIVE)
        return true;
      if (key === IS_READONLY)
        return false;
      if (key === IS_SHALLOW)
        return true;
      if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (isMapTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (mapInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(mapInstrumentations, key, receiver);
        }
      }
      if (isSetTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (setInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(setInstrumentations, key, receiver);
        }
      }
      if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(dateInstrumentations, key, receiver);
      }
      track(obj, key);
      if (Array.isArray(obj))
        track(obj, "*");
      return Reflect.get(obj, key, receiver);
    },
    set(obj, key, value, receiver) {
      const oldValue = obj[key];
      const res = Reflect.set(obj, key, value, receiver);
      if (oldValue !== value || Array.isArray(obj) && key === "length") {
        trigger(obj, key);
        if (Array.isArray(obj))
          trigger(obj, "*");
      }
      return res;
    }
  });
}
function readonly(target) {
  if (typeof target !== "object" || target === null)
    return target;
  if (isRaw(target))
    return target;
  if (target[IS_READONLY])
    return target;
  if (target[IS_REACTIVE])
    target = target[RAW];
  if (readonlyMap.has(target))
    return readonlyMap.get(target);
  const isMapTarget = target instanceof Map;
  const isSetTarget = target instanceof Set;
  const isDateTarget = target instanceof Date;
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW)
        return obj;
      if (key === IS_REACTIVE)
        return false;
      if (key === IS_READONLY)
        return true;
      if (isMapTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (mapInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(mapInstrumentations, key, receiver);
        }
      }
      if (isSetTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (setInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(setInstrumentations, key, receiver);
        }
      }
      if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(dateInstrumentations, key, receiver);
      }
      const res = Reflect.get(obj, key, receiver);
      if (typeof res === "function") {
        const bindTarget = obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp ? obj : receiver;
        return getBoundMethod(res, bindTarget);
      }
      return typeof res === "object" && res !== null && !isRaw(res) ? readonly(res) : res;
    },
    set() {
      warn(`[Helix] Set operation on readonly target failed.`, "reactive");
      return true;
    },
    deleteProperty() {
      warn(`[Helix] Delete operation on readonly target failed.`, "reactive");
      return true;
    }
  });
  readonlyMap.set(target, proxy);
  return proxy;
}
function shallowReadonly(target) {
  if (typeof target !== "object" || target === null)
    return target;
  if (isRaw(target))
    return target;
  if (target[IS_READONLY])
    return target;
  const isMapTarget = target instanceof Map;
  const isSetTarget = target instanceof Set;
  const isDateTarget = target instanceof Date;
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW)
        return obj;
      if (key === IS_REACTIVE)
        return false;
      if (key === IS_READONLY)
        return true;
      if (key === IS_SHALLOW)
        return true;
      if (isMapTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (mapInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(mapInstrumentations, key, receiver);
        }
      }
      if (isSetTarget) {
        if (key === "size") {
          track(obj, "size");
          track(obj, "*");
          return obj.size;
        }
        if (setInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(setInstrumentations, key, receiver);
        }
      }
      if (isDateTarget && dateInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(dateInstrumentations, key, receiver);
      }
      const res = Reflect.get(obj, key, receiver);
      if (typeof res === "function") {
        const bindTarget = obj instanceof WeakSet || obj instanceof WeakMap || obj instanceof RegExp ? obj : receiver;
        return getBoundMethod(res, bindTarget);
      }
      return res;
    },
    set() {
      warn(`[Helix] Set operation on shallowReadonly target failed.`, "reactive");
      return true;
    },
    deleteProperty() {
      warn(`[Helix] Delete operation on shallowReadonly target failed.`, "reactive");
      return true;
    }
  });
}
function markRaw(value) {
  if (typeof value === "object" && value !== null) {
    Object.defineProperty(value, SKIP, { value: true, configurable: true, enumerable: false, writable: false });
  }
  return value;
}
function toRaw(observed) {
  return observed && observed[RAW] ? observed[RAW] : observed;
}
function isProxy(value) {
  return !!(value && (value[IS_REACTIVE] || value[IS_READONLY]));
}
function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value[RAW]);
  }
  return !!(value && value[IS_REACTIVE]);
}
function isReadonly(value) {
  return !!(value && value[IS_READONLY]);
}
function isShallow(value) {
  return !!(value && value[IS_SHALLOW] === true);
}

// packages/core/src/reactivity/ref.js
function toReactive(val) {
  return typeof val === "object" && val !== null ? reactive(val) : val;
}
function ref(value) {
  let _val = toReactive(value);
  const refObj = {};
  Object.defineProperty(refObj, "value", {
    get() {
      track(refObj, "value");
      return _val;
    },
    set(newVal) {
      if (value !== newVal) {
        value = newVal;
        _val = toReactive(newVal);
        trigger(refObj, "value");
      }
    }
  });
  refObj[IS_REF] = true;
  refObj[RAW] = refObj;
  return refObj;
}
function customRef(factory) {
  const refObj = {};
  const { get, set } = factory(
    () => track(refObj, "value"),
    () => trigger(refObj, "value")
  );
  Object.defineProperty(refObj, "value", {
    get() {
      return get();
    },
    set(newVal) {
      set(newVal);
    }
  });
  refObj[IS_REF] = true;
  refObj[RAW] = refObj;
  return refObj;
}
function shallowRef(value) {
  const refObj = {};
  Object.defineProperty(refObj, "value", {
    get() {
      track(refObj, "value");
      return value;
    },
    set(newVal) {
      if (value !== newVal) {
        value = newVal;
        trigger(refObj, "value");
      }
    }
  });
  refObj[IS_REF] = true;
  refObj[IS_SHALLOW] = true;
  refObj[RAW] = refObj;
  return refObj;
}
function triggerRef(refObj) {
  if (refObj && refObj[IS_REF]) {
    trigger(refObj, "value");
  } else {
    warn(`triggerRef() expects a ref object.`, "ref");
  }
}
function toValue(source) {
  return isRef(source) ? source.value : source;
}
function unref(val) {
  return isRef(val) ? val.value : val;
}
function isRef(val) {
  return !!(val && val[IS_REF] === true);
}
function toRef(object, key) {
  const refObj = {};
  Object.defineProperty(refObj, "value", {
    get() {
      track(object, key);
      return object[key];
    },
    set(newVal) {
      object[key] = newVal;
    }
  });
  refObj[IS_REF] = true;
  refObj[RAW] = refObj;
  return refObj;
}
function toRefs(object) {
  const result = {};
  for (const key of Object.keys(object))
    result[key] = toRef(object, key);
  return result;
}
function proxyRefs(objectWithRefs) {
  if (typeof objectWithRefs !== "object" || objectWithRefs === null) {
    return objectWithRefs;
  }
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      return unref(Reflect.get(target, key, receiver));
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      }
      return Reflect.set(target, key, value, receiver);
    },
    has(target, key) {
      return key in target;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
}

// packages/core/src/compiler/cache.js
var ExpressionCache = class {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = /* @__PURE__ */ new Map();
  }
  get(key) {
    if (!this.cache.has(key))
      return void 0;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  set(key, val) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, val);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
};
var TemplateMetadataCache = class {
  constructor() {
    this.metadata = /* @__PURE__ */ new WeakMap();
  }
  get(node) {
    return this.metadata.get(node);
  }
  set(node, data) {
    this.metadata.set(node, data);
  }
  has(node) {
    return this.metadata.has(node);
  }
};
var globalExpressionCache = new ExpressionCache(500);
var globalTemplateMetadataCache = new TemplateMetadataCache();

// packages/core/src/compiler/compiler.js
function compile(expression) {
  const cached = globalExpressionCache.get(expression);
  if (cached)
    return cached;
  const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
  if (Helix2 && typeof Helix2.compile === "function") {
    const fn = Helix2.compile(expression);
    globalExpressionCache.set(expression, fn);
    return fn;
  }
  const compiledFn = new Function(
    "$ctx",
    `with($ctx){ return (${expression}); }`
  );
  globalExpressionCache.set(expression, compiledFn);
  return compiledFn;
}
function getPathParts(path) {
  if (pathCache.has(path)) {
    const parts2 = pathCache.get(path);
    pathCache.delete(path);
    pathCache.set(path, parts2);
    return [...parts2];
  }
  const parts = path.replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1").split(".").filter(Boolean);
  if (pathCache.size >= MAX_PATH_CACHE_SIZE) {
    const firstKey = pathCache.keys().next().value;
    pathCache.delete(firstKey);
  }
  pathCache.set(path, parts);
  return [...parts];
}
function getMatchedKey(obj, prop) {
  if (obj == null || typeof obj !== "object" && typeof obj !== "function")
    return null;
  if (prop in obj)
    return prop;
  const lower = String(prop).toLowerCase();
  for (const k in obj) {
    if (k.toLowerCase() === lower)
      return k;
  }
  try {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === lower)
        return keys[i];
    }
  } catch {
  }
  return null;
}
function resolvePath(path, ctx) {
  try {
    const val = getPathParts(path).reduce((acc, part) => {
      const unwrapped = isRef(acc) ? acc.value : acc;
      if (unwrapped == null)
        return void 0;
      const matched = getMatchedKey(unwrapped, part);
      return matched ? unwrapped[matched] : unwrapped[part];
    }, ctx);
    return isRef(val) ? val.value : val;
  } catch (err) {
    warn(`Failed to resolve path: ${path}`, "compiler", err);
    return void 0;
  }
}
function resolveRaw(path, ctx) {
  try {
    return getPathParts(path).reduce((acc, part) => {
      const unwrapped = isRef(acc) ? acc.value : acc;
      if (unwrapped == null)
        return void 0;
      const matched = getMatchedKey(unwrapped, part);
      return matched ? unwrapped[matched] : unwrapped[part];
    }, ctx);
  } catch (err) {
    warn(`Failed to resolve raw path: ${path}`, "compiler", err);
    return void 0;
  }
}
var SIMPLE_PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
function isSimplePathSyntax(val) {
  return SIMPLE_PATH_RE.test(val.trim());
}
var warnedInlineExpressions = /* @__PURE__ */ new Set();
function resolveExpression(val, ctx, { asBoolean = false, fallback = void 0, contextName = "expression", forceExpression = false } = {}) {
  let result;
  const parts = getPathParts(val);
  let current = ctx;
  let exists = true;
  for (let i = 0; i < parts.length; i++) {
    if (current == null || typeof current !== "object" && typeof current !== "function") {
      exists = false;
      break;
    }
    const unwrapped = isRef(current) ? current.value : current;
    if (unwrapped == null || typeof unwrapped !== "object" && typeof unwrapped !== "function") {
      exists = false;
      break;
    }
    const matched = getMatchedKey(unwrapped, parts[i]);
    if (matched) {
      current = unwrapped[matched];
    } else {
      exists = false;
      break;
    }
  }
  if (exists) {
    result = isRef(current) ? current.value : current;
  } else if (isSimplePathSyntax(val)) {
    try {
      parts.reduce((acc, part) => {
        const u = isRef(acc) ? acc.value : acc;
        const m = getMatchedKey(u, part);
        return m ? u[m] : u?.[part];
      }, ctx);
    } catch (e) {
    }
    if (!globalConfig.allowInlineExpressions && !forceExpression) {
      warn(`Path not found: ${val}`, "compiler");
    }
    result = fallback;
  } else if (globalConfig.allowInlineExpressions || forceExpression) {
    if (globalConfig.debug && globalConfig.allowInlineExpressions && !warnedInlineExpressions.has(val)) {
      warnedInlineExpressions.add(val);
      if (globalConfig.warnInlineExpressions) {
        warn(`Security: inline expressions enabled. Never use with untrusted user input. (expression: "${val}")`, "security");
      } else {
        warn(`Security: inline expressions enabled. Never use with untrusted user input.`, "security");
      }
    }
    try {
      const compiledFn = compile(val);
      result = compiledFn(ctx);
    } catch (err) {
      handleError(err, `${contextName}: ${val}`);
      result = fallback;
    }
  } else {
    warn(`Path not found: ${val}`, "compiler");
    result = fallback;
  }
  if (!exists) {
    return result;
  }
  return asBoolean ? !!result : result;
}

// packages/core/src/renderer/component.js
var componentProxyCache = /* @__PURE__ */ new WeakMap();
var idCounter = 0;
function uniqueId(prefix = "hx") {
  return `${prefix}-${++idCounter}`;
}
var id = uniqueId;
function dispatchEventHelper(targetOrEvent, eventNameOrDetail, detail = null, options = {}) {
  let target = null;
  let eventName = "";
  let evtDetail = null;
  let opts = {};
  if (typeof targetOrEvent === "string") {
    eventName = targetOrEvent;
    evtDetail = eventNameOrDetail;
    target = this?.$el || this?.root || (typeof document !== "undefined" ? document : null);
    opts = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {};
  } else {
    target = targetOrEvent;
    eventName = String(eventNameOrDetail || "");
    evtDetail = detail;
    opts = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  }
  if (!target || typeof target.dispatchEvent !== "function") {
    if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
      target = document;
    } else if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      target = window;
    }
  }
  if (!target || typeof target.dispatchEvent !== "function" || !eventName)
    return false;
  const customEvent = typeof CustomEvent !== "undefined" ? new CustomEvent(eventName, {
    bubbles: opts.bubbles !== false,
    composed: opts.composed !== false,
    cancelable: opts.cancelable !== false,
    ...opts,
    detail: evtDetail
  }) : { type: eventName, detail: evtDetail };
  return target.dispatchEvent(customEvent);
}
var dispatch = dispatchEventHelper;
function getOrCreateAppCtxProxy(baseAppCtx, app) {
  let appMap = componentProxyCache.get(baseAppCtx);
  if (!appMap) {
    appMap = /* @__PURE__ */ new WeakMap();
    componentProxyCache.set(baseAppCtx, appMap);
  }
  let proxy = appMap.get(app || baseAppCtx);
  if (!proxy) {
    proxy = new Proxy(baseAppCtx, {
      get(target, prop, receiver) {
        if (prop in target) {
          const val = target[prop];
          return isRef(val) ? val.value : val;
        }
        if (prop === "$dispatch") {
          return (eventName, detail, options) => {
            const rootEl = target?.$el || target?.root || (typeof document !== "undefined" ? document : null);
            return dispatchEventHelper(rootEl, eventName, detail, options);
          };
        }
        if (prop === "$id") {
          return (p = "id") => uniqueId(p);
        }
        if (prop === "$root") {
          return target?.$el || target?.root || null;
        }
        if (app && prop in app) {
          const val = app[prop];
          return isRef(val) ? val.value : val;
        }
        const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
        if (globalHelix && prop in globalHelix) {
          const val = globalHelix[prop];
          return isRef(val) ? val.value : val;
        }
        return void 0;
      },
      set(target, prop, value, receiver) {
        target[prop] = value;
        return true;
      },
      has(target, prop) {
        if (prop in target)
          return true;
        if (prop === "$dispatch" || prop === "$id" || prop === "$root")
          return true;
        if (app && prop in app)
          return true;
        const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
        if (globalHelix && prop in globalHelix)
          return true;
        return false;
      }
    });
    appMap.set(app || baseAppCtx, proxy);
  }
  return proxy;
}
function parseSlotAttribute(attrName, prefix = "h-") {
  if (!attrName)
    return { isSlot: false, name: "" };
  if (attrName.startsWith("#")) {
    const name = attrName.slice(1) || "default";
    return { isSlot: true, name };
  }
  const slotPrefix = `${prefix}slot`;
  if (attrName === slotPrefix) {
    return { isSlot: true, name: "default" };
  }
  if (attrName.startsWith(`${slotPrefix}:`)) {
    const name = attrName.slice(slotPrefix.length + 1) || "default";
    return { isSlot: true, name };
  }
  if (attrName.startsWith(`${slotPrefix}.`)) {
    const name = attrName.slice(slotPrefix.length + 1) || "default";
    return { isSlot: true, name };
  }
  if (attrName === "v-slot") {
    return { isSlot: true, name: "default" };
  }
  if (attrName.startsWith("v-slot:")) {
    const name = attrName.slice("v-slot:".length) || "default";
    return { isSlot: true, name };
  }
  if (attrName.startsWith("v-slot.")) {
    const name = attrName.slice("v-slot.".length) || "default";
    return { isSlot: true, name };
  }
  return { isSlot: false, name: "" };
}
function createSlots(slotEls, ctx, instance, bindNode, prefix = "h-") {
  const slots = {};
  slotEls.forEach((el) => {
    if (el.nodeType !== 1)
      return;
    let slotName = "default";
    let slotProps = null;
    Array.from(el.attributes || []).forEach((attr) => {
      const parsed = parseSlotAttribute(attr.name, prefix);
      if (parsed.isSlot) {
        slotName = parsed.name || "default";
        const attrVal = attr.value.trim();
        if (attrVal)
          slotProps = attrVal;
      }
    });
    if (!slots[slotName])
      slots[slotName] = [];
    slots[slotName].push({ el, props: slotProps });
  });
  const slotOutlets = {};
  Object.keys(slots).forEach((name) => {
    const slotDefs = slots[name];
    slotOutlets[name] = (scopeProps = {}) => {
      const fragment = document.createDocumentFragment();
      slotDefs.forEach((slotDef) => {
        const clone = slotDef.el.cloneNode(true);
        if (slotDef.props) {
          const slotCtx = Object.create(ctx);
          Object.keys(scopeProps).forEach((key) => {
            slotCtx[key] = scopeProps[key];
          });
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(slotDef.props)) {
            slotCtx[slotDef.props] = scopeProps;
          }
          bindNode(clone, slotCtx, instance);
        } else {
          bindNode(clone, ctx, instance);
        }
        Array.from(clone.attributes || []).forEach((attr) => {
          const parsed = parseSlotAttribute(attr.name, prefix);
          if (parsed.isSlot) {
            clone.removeAttribute(attr.name);
          }
        });
        fragment.appendChild(clone);
      });
      return fragment;
    };
  });
  return slotOutlets;
}
function renderSlots(slotOutlets, templateEl, parentCtx, instance, bindNode) {
  const slotElements = templateEl.querySelectorAll("slot");
  slotElements.forEach((slotEl) => {
    const name = slotEl.getAttribute("name") || "default";
    const outlet = slotOutlets[name];
    if (outlet) {
      const scopeAttr = slotEl.getAttribute(":scope") || slotEl.getAttribute("v-bind:scope");
      let scopeProps = {};
      if (scopeAttr) {
        const resolved = resolvePath(scopeAttr, parentCtx);
        if (resolved && typeof resolved === "object")
          scopeProps = resolved;
      }
      const content = outlet(scopeProps);
      slotEl.innerHTML = "";
      slotEl.appendChild(content);
    } else {
      const fallback = document.createDocumentFragment();
      Array.from(slotEl.childNodes).forEach((child) => fallback.appendChild(child));
      slotEl.innerHTML = "";
      slotEl.appendChild(fallback);
      Array.from(slotEl.childNodes).forEach((child) => bindNode(child, parentCtx, instance));
    }
  });
  const nestedTemplates = templateEl.querySelectorAll("template");
  nestedTemplates.forEach((tpl) => {
    if (tpl.content) {
      renderSlots(slotOutlets, tpl.content, parentCtx, instance, bindNode);
    }
  });
}

// packages/core/src/reactivity/watch.js
function watch(source, cb, options = {}) {
  const isReactiveSource = isReactive(source);
  const { deep = isReactiveSource, immediate = false, flush = "pre", once = false } = options;
  const isArraySource = Array.isArray(source);
  let getter;
  if (isArraySource) {
    getter = () => source.map((s) => {
      if (isRef(s))
        return s.value;
      if (typeof s === "function")
        return s();
      return deep || isReactive(s) ? traverse(s) : s;
    });
  } else if (isRef(source)) {
    getter = () => deep ? traverse(source.value) : source.value;
  } else if (typeof source === "function") {
    getter = deep ? () => traverse(source()) : source;
  } else {
    getter = deep || isReactiveSource ? () => traverse(source) : () => source;
  }
  let oldVal;
  let isStopped = false;
  let watchCleanupFn = null;
  const stopWatcher = () => {
    if (isStopped)
      return;
    isStopped = true;
    if (watchCleanupFn) {
      try {
        watchCleanupFn();
      } catch (err) {
        handleError(err, "watch final cleanup");
      }
      watchCleanupFn = null;
    }
    cleanup(runner);
  };
  const job = () => {
    if (isStopped)
      return;
    if (watchCleanupFn) {
      try {
        watchCleanupFn();
      } catch (err) {
        handleError(err, "watch cleanup");
      }
      watchCleanupFn = null;
    }
    const newVal = runner();
    const onCleanup = (fn) => {
      if (typeof fn === "function")
        watchCleanupFn = fn;
    };
    cb(newVal, oldVal, onCleanup);
    oldVal = isArraySource ? [...newVal] : newVal;
    if (once)
      stopWatcher();
  };
  const runner = effect(getter, {
    lazy: true,
    area: "watch",
    scheduler: () => {
      if (flush === "sync")
        job();
      else if (flush === "post")
        queuePostFlushCb(job);
      else
        queueJob(job);
    }
  });
  oldVal = runner();
  if (isArraySource && Array.isArray(oldVal)) {
    oldVal = [...oldVal];
  }
  if (immediate)
    job();
  return stopWatcher;
}
function watchEffect(effectFn, options = {}) {
  const { flush = "pre" } = options;
  let isStopped = false;
  let watchCleanupFn = null;
  const stopWatcher = () => {
    if (isStopped)
      return;
    isStopped = true;
    if (watchCleanupFn) {
      try {
        watchCleanupFn();
      } catch (err) {
        handleError(err, "watchEffect final cleanup");
      }
      watchCleanupFn = null;
    }
    cleanup(runner);
  };
  const job = () => {
    if (isStopped)
      return;
    if (watchCleanupFn) {
      try {
        watchCleanupFn();
      } catch (err) {
        handleError(err, "watchEffect cleanup");
      }
      watchCleanupFn = null;
    }
    const onCleanup = (fn) => {
      if (typeof fn === "function")
        watchCleanupFn = fn;
    };
    try {
      runner(onCleanup);
    } catch (err) {
      handleError(err, "watchEffect");
    }
  };
  const runner = effect((onCleanup) => {
    if (watchCleanupFn) {
      try {
        watchCleanupFn();
      } catch (err) {
        handleError(err, "watchEffect cleanup");
      }
      watchCleanupFn = null;
    }
    effectFn(onCleanup);
  }, {
    lazy: true,
    area: "watch",
    scheduler: () => {
      if (flush === "sync")
        job();
      else if (flush === "post")
        queuePostFlushCb(job);
      else
        queueJob(job);
    }
  });
  job();
  return stopWatcher;
}
function traverse(value, seen = /* @__PURE__ */ new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value))
    return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++)
      traverse(value[i], seen);
  } else if (isRef(value)) {
    traverse(value.value, seen);
  } else if (value instanceof Set || value instanceof Map) {
    value.forEach((v) => traverse(v, seen));
  } else {
    for (const key in value)
      traverse(value[key], seen);
  }
  return value;
}

// packages/core/src/reactivity/computed.js
function computed(getterOrOptions) {
  let getter, setter;
  if (typeof getterOrOptions === "function") {
    getter = getterOrOptions;
    setter = () => warn(`[Helix] \u{1F4A5} Write operation failed: computed value is readonly.`, "computed");
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set || (() => warn(`[Helix] \u{1F4A5} Write operation failed: no setter provided.`, "computed"));
  }
  let value;
  let dirty = true;
  let hasError = false;
  let errorValue = null;
  const computedRef = {};
  const runner = effect(getter, {
    lazy: true,
    area: "computed",
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(computedRef, "value");
      }
    }
  });
  Object.defineProperty(computedRef, "value", {
    get() {
      if (dirty) {
        try {
          value = runner();
          hasError = false;
          errorValue = null;
        } catch (err) {
          hasError = true;
          errorValue = err;
          handleError(err, "computed getter");
        }
        dirty = false;
      }
      if (hasError)
        throw errorValue;
      track(computedRef, "value");
      return value;
    },
    set(newValue) {
      setter(newValue);
      if (!dirty) {
        dirty = true;
        trigger(computedRef, "value");
      }
    }
  });
  computedRef[IS_REF] = true;
  return computedRef;
}

// packages/core/src/app/lifecycle.js
function getCurrentInstance() {
  return currentInstance;
}
function onMounted(fn) {
  if (currentInstance)
    currentInstance.hooks.mount.push(fn);
}
function onMount(fn) {
  warn(`[Helix] onMount is deprecated. Use onMounted instead.`, "config");
  return onMounted(fn);
}
function onBeforeMount(fn) {
  if (currentInstance)
    currentInstance.hooks.beforeMount.push(fn);
}
function onUnmounted(fn) {
  if (currentInstance)
    currentInstance.hooks.destroy.push(fn);
}
function onDestroy(fn) {
  warn(`[Helix] onDestroy is deprecated. Use onUnmounted instead.`, "config");
  return onUnmounted(fn);
}
function onBeforeUnmount(fn) {
  if (currentInstance)
    currentInstance.hooks.beforeUnmount.push(fn);
}
function onUpdated(fn) {
  if (currentInstance)
    currentInstance.hooks.updated.push(fn);
}
function queueComponentUpdated(instance) {
  if (!instance || !instance.hooks || !instance.hooks.updated || instance.hooks.updated.length === 0)
    return;
  if (!instance._isUpdatedQueued) {
    instance._isUpdatedQueued = true;
    queuePostFlushCb(() => {
      instance._isUpdatedQueued = false;
      if (instance && instance.hooks && instance.hooks.updated) {
        instance.hooks.updated.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            handleError(e, "component onUpdated", instance);
          }
        });
      }
    });
  }
}
function provide(key, value) {
  if (!currentInstance)
    return;
  let provides = currentInstance.provides;
  const parentProvides = currentInstance.parent ? currentInstance.parent.provides : null;
  if (provides === parentProvides) {
    provides = currentInstance.provides = Object.create(parentProvides);
  }
  provides[key] = value;
}
function inject(key, defaultValue) {
  if (!currentInstance)
    return;
  const provides = currentInstance.provides;
  if (provides && key in provides)
    return provides[key];
  return defaultValue;
}
function validateProp(name, value, def) {
  if (!def)
    return value;
  if (def.required && (value === void 0 || value === null)) {
    warn(`Prop "${name}" is required but was not provided.`, "prop");
    return value;
  }
  if (value === void 0 && def.hasOwnProperty("default")) {
    return typeof def.default === "function" ? def.default() : def.default;
  }
  if (value !== void 0 && def.type) {
    const types = Array.isArray(def.type) ? def.type : [def.type];
    const isValid = types.some((type) => {
      if (type === String)
        return typeof value === "string";
      if (type === Number)
        return typeof value === "number";
      if (type === Boolean)
        return typeof value === "boolean";
      if (type === Array)
        return Array.isArray(value);
      if (type === Object)
        return typeof value === "object" && value !== null && !Array.isArray(value);
      return value instanceof type;
    });
    if (!isValid) {
      warn(`Type mismatch for prop "${name}". Expected ${types.map((t) => t.name).join(" or ")} but got ${typeof value}.`, "prop");
    }
  }
  return value;
}
function validateEmit(eventName, args, emitsDef) {
  if (!emitsDef)
    return true;
  const isArray = Array.isArray(emitsDef);
  const isDeclared = isArray ? emitsDef.includes(eventName) : emitsDef.hasOwnProperty(eventName);
  if (!isDeclared) {
    warn(`Component emitted event "${eventName}" but it is not declared in the emits option.`, "event");
    return false;
  }
  if (!isArray && typeof emitsDef[eventName] === "function") {
    const isValid = emitsDef[eventName](...args);
    if (!isValid) {
      warn(`Invalid payload for emitted event "${eventName}". Validator returned false.`, "event");
      return false;
    }
  }
  return true;
}

// packages/core/src/compiler/delimiter.js
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function createDelimiterPattern(delimiters) {
  const open = escapeRegex(delimiters[0]);
  const close = escapeRegex(delimiters[1]);
  return new RegExp(open + "\\s*(.*?)\\s*" + close, "g");
}
function parseTextInterpolation(text, delimiters) {
  if (!delimiters || delimiters.length !== 2)
    return null;
  const pattern = createDelimiterPattern(delimiters);
  const tokens = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "interpolation", value: match[1].trim() });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens.length > 0 ? tokens : null;
}
function bindTextInterpolation(node, ctx, instance, delimiters) {
  const text = node.textContent;
  const tokens = parseTextInterpolation(text, delimiters);
  if (!tokens)
    return false;
  const parent = node.parentNode;
  if (!parent)
    return false;
  const marker = document.createComment(" text-interpolation ");
  parent.insertBefore(marker, node);
  node.remove();
  const textNodes = [];
  tokens.forEach((token) => {
    if (token.type === "text") {
      const textNode = document.createTextNode(token.value);
      parent.insertBefore(textNode, marker);
    } else {
      const interpNode = document.createTextNode("");
      parent.insertBefore(interpNode, marker);
      textNodes.push({ node: interpNode, expr: token.value });
    }
  });
  marker.remove();
  const cleanupFns = [];
  let initialRan = false;
  textNodes.forEach(({ node: textNode, expr }) => {
    const updateFn = () => {
      const res = resolveExpression(expr, ctx, { fallback: "", contextName: "text-interpolation" });
      const newText = typeof res === "object" && res !== null ? JSON.stringify(res) : res ?? "";
      if (textNode.textContent !== newText) {
        textNode.textContent = newText;
        if (initialRan && instance) {
          queueComponentUpdated(instance);
        }
      }
    };
    const e = effect(updateFn, { name: `interpolation: ${expr}`, area: "compiler" });
    cleanupFns.push(() => cleanup(e));
  });
  initialRan = true;
  if (!parent.__hx_cleanup) {
    parent.__hx_cleanup = [];
  }
  cleanupFns.forEach((fn) => parent.__hx_cleanup.push(fn));
  if (instance && instance.cleanups) {
    cleanupFns.forEach((fn) => instance.cleanups.push(fn));
  }
  return true;
}

// packages/core/src/compiler/html.js
function sanitizeHtml(html) {
  if (typeof html !== "string")
    return "";
  let sanitized = html;
  if (typeof globalConfig.htmlSanitizer === "function") {
    try {
      sanitized = globalConfig.htmlSanitizer(html);
      if (typeof sanitized !== "string")
        sanitized = "";
    } catch (e) {
      sanitized = "";
    }
  }
  if (typeof document === "undefined") {
    return sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "").replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "").replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "").replace(/\s+on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "").replace(/(?:href|src|xlink:href)\s*=\s*['"]?\s*javascript:[^'">\s]*/gi, "");
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = sanitized.trim();
  const content = tpl.content || tpl;
  if (typeof content.querySelectorAll !== "function")
    return sanitized;
  const dangerousSelectors = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "button",
    "select",
    "link[rel='stylesheet']"
  ];
  dangerousSelectors.forEach((selector) => {
    content.querySelectorAll(selector).forEach((el) => el.remove());
  });
  content.querySelectorAll("svg script, svg *[onload]").forEach((el) => el.remove());
  const walk = (node) => {
    if (node.nodeType === 1) {
      const attrs = node.attributes ? Array.from(node.attributes) : [];
      attrs.forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.toLowerCase();
        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }
        if (/javascript:/i.test(value) || /^data:/i.test(value)) {
          node.removeAttribute(attr.name);
          return;
        }
        if (/expression\s*\(/i.test(value)) {
          node.removeAttribute(attr.name);
          return;
        }
      });
      const children = node.children || node.childNodes || [];
      Array.from(children).forEach(walk);
    }
  };
  walk(content);
  return tpl.innerHTML || sanitized;
}

// packages/core/src/renderer/node.js
function destroyNode(node) {
  if (!node || node.__hx_destroying)
    return;
  node.__hx_destroying = true;
  const runCleanups = (n) => {
    if (!n || n.__hx_cleaned)
      return;
    n.__hx_cleaned = true;
    if (n.__hx_cleanup) {
      const cleanups = n.__hx_cleanup;
      n.__hx_cleanup = null;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          handleError(e, "destroyNode cleanup");
        }
      });
    }
    if (n.__hx_binding && n.__hx_binding.cleanups) {
      const cleanups = n.__hx_binding.cleanups;
      n.__hx_binding.cleanups = [];
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          handleError(e, "destroyNode binding cleanup");
        }
      });
    }
    if (n.__hx_scope) {
      if (n.__hx_scope.stop && typeof n.__hx_scope.stop === "function") {
        try {
          n.__hx_scope.stop();
        } catch (e) {
          handleError(e, "destroyNode scope stop");
        }
      }
      n.__hx_scope = null;
    }
    if (n.__hx_key !== void 0) {
      n.__hx_key = null;
    }
    if (n.nodeType === 1)
      Array.from(n.childNodes).forEach(runCleanups);
  };
  runCleanups(node);
  if (node.parentNode)
    node.remove();
  node[BOUND] = false;
  node.__hx_destroying = false;
}

// packages/core/src/events/keyboard.js
var KEYBOARD_EVENTS = /* @__PURE__ */ new Set([
  "keydown",
  "keyup",
  "keypress"
]);
var KEY_ALIASES = {
  enter: ["Enter"],
  tab: ["Tab"],
  delete: ["Delete", "Backspace"],
  esc: ["Escape", "Esc"],
  escape: ["Escape", "Esc"],
  space: [" ", "Space", "Spacebar"],
  up: ["ArrowUp", "Up"],
  down: ["ArrowDown", "Down"],
  left: ["ArrowLeft", "Left"],
  right: ["ArrowRight", "Right"],
  home: ["Home"],
  end: ["End"],
  "page-up": ["PageUp"],
  pageup: ["PageUp"],
  "page-down": ["PageDown"],
  pagedown: ["PageDown"],
  insert: ["Insert"],
  "caps-lock": ["CapsLock"],
  capslock: ["CapsLock"],
  "num-lock": ["NumLock"],
  numlock: ["NumLock"],
  "scroll-lock": ["ScrollLock"],
  scrolllock: ["ScrollLock"],
  f1: ["F1"],
  f2: ["F2"],
  f3: ["F3"],
  f4: ["F4"],
  f5: ["F5"],
  f6: ["F6"],
  f7: ["F7"],
  f8: ["F8"],
  f9: ["F9"],
  f10: ["F10"],
  f11: ["F11"],
  f12: ["F12"]
};
var NON_KEY_MODIFIERS = /* @__PURE__ */ new Set([
  "capture",
  "once",
  "passive",
  "window",
  "document",
  "outside",
  "stop",
  "prevent",
  "self",
  "ctrl",
  "alt",
  "shift",
  "meta",
  "exact"
]);
function isValidKeyModifier(mod) {
  if (!mod || typeof mod !== "string")
    return false;
  const lower = mod.toLowerCase();
  if (KEY_ALIASES[lower])
    return true;
  if (lower.length === 1)
    return true;
  return false;
}
function matchesKey(keyMod, eventKey) {
  if (!eventKey)
    return false;
  const lowerKey = eventKey.toLowerCase();
  const lowerMod = keyMod.toLowerCase();
  if (KEY_ALIASES[lowerMod]) {
    return KEY_ALIASES[lowerMod].some((alias) => alias.toLowerCase() === lowerKey || alias === eventKey);
  }
  if (lowerKey === lowerMod)
    return true;
  const hyp = eventKey.replace(/\B([A-Z])/g, "-$1").toLowerCase();
  if (hyp === lowerMod)
    return true;
  return false;
}
function isKeyboardEvent(e, evtType) {
  return typeof evtType === "string" && KEYBOARD_EVENTS.has(evtType);
}
function filterKeyModifiers(modifiers, isKeyboard, evtType = "keydown") {
  if (!isKeyboard)
    return [];
  return modifiers.filter((m) => {
    if (NON_KEY_MODIFIERS.has(m))
      return false;
    if (isValidKeyModifier(m))
      return true;
    warn(`Unknown keyboard modifier '.${m}' on @${evtType}. Allowed modifiers are key aliases (enter, esc, etc.), single characters (a-z, 0-9), or standard event modifiers.`, "event");
    return false;
  });
}

// packages/core/src/events/mouse.js
var MOUSE_EVENTS = /* @__PURE__ */ new Set([
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "contextmenu",
  "auxclick",
  "pointerdown",
  "pointerup"
]);
var MOUSE_BUTTONS = {
  left: 0,
  middle: 1,
  right: 2
};
function isMouseEvent(e, evtType) {
  return typeof evtType === "string" && MOUSE_EVENTS.has(evtType);
}
function checkMouseModifiers(modifiers, e) {
  if (modifiers.includes("left") && e.button !== MOUSE_BUTTONS.left)
    return false;
  if (modifiers.includes("middle") && e.button !== MOUSE_BUTTONS.middle)
    return false;
  if (modifiers.includes("right") && e.button !== MOUSE_BUTTONS.right)
    return false;
  return true;
}

// packages/core/src/events/modifiers.js
function checkSystemModifiers(modifiers, e) {
  if (modifiers.includes("ctrl") && !e.ctrlKey)
    return false;
  if (modifiers.includes("alt") && !e.altKey)
    return false;
  if (modifiers.includes("shift") && !e.shiftKey)
    return false;
  if (modifiers.includes("meta") && !e.metaKey)
    return false;
  return true;
}
function checkExact(modifiers, e) {
  if (!modifiers.includes("exact"))
    return true;
  const hasCtrl = modifiers.includes("ctrl");
  const hasAlt = modifiers.includes("alt");
  const hasShift = modifiers.includes("shift");
  const hasMeta = modifiers.includes("meta");
  if (!hasCtrl && e.ctrlKey)
    return false;
  if (!hasAlt && e.altKey)
    return false;
  if (!hasShift && e.shiftKey)
    return false;
  if (!hasMeta && e.metaKey)
    return false;
  return true;
}
function getListenerOptions(modifiers) {
  const isCapture = modifiers.includes("capture");
  const isOnce = modifiers.includes("once");
  const isPassive = modifiers.includes("passive");
  const hasNativeOpts = isCapture || isOnce || isPassive;
  return hasNativeOpts ? { capture: isCapture, once: isOnce, passive: isPassive } : false;
}
function getListenerTarget(el, modifiers) {
  if (modifiers.includes("window") && typeof window !== "undefined")
    return window;
  if (modifiers.includes("document") && typeof document !== "undefined")
    return document;
  return el;
}

// packages/core/src/events/listener.js
function parseEventArgs(str) {
  const args = [];
  if (!str)
    return args;
  let depth = 0, current = "", inQuote = false, quoteChar = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (inQuote && ch === quoteChar && str[i - 1] !== "\\") {
      inQuote = false;
      current += ch;
    } else if (!inQuote && (ch === "(" || ch === "{" || ch === "[")) {
      depth++;
      current += ch;
    } else if (!inQuote && (ch === ")" || ch === "}" || ch === "]")) {
      depth--;
      current += ch;
    } else if (!inQuote && ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim())
    args.push(current.trim());
  return args;
}
function createEventListener(el, binding, appConfig = {}) {
  const { value: val, arg, modifiers = [], ctx, trackCleanup } = binding;
  const evtType = arg || "click";
  const isStop = modifiers.includes("stop");
  const isPrevent = modifiers.includes("prevent");
  const isPassive = modifiers.includes("passive");
  const isSelf = modifiers.includes("self");
  const isOutside = modifiers.includes("outside");
  const isOnce = modifiers.includes("once");
  if (isPassive && isPrevent) {
    warn(`@${evtType}.passive.prevent cannot call preventDefault() because passive listeners cannot preventDefault().`, "event");
  }
  const executeHandler = (e) => {
    const isKeyboard = isKeyboardEvent(e, evtType);
    const isMouse = isMouseEvent(e, evtType);
    const keyMods = filterKeyModifiers(modifiers, isKeyboard, evtType);
    if (keyMods.length > 0) {
      if (!e.key || !keyMods.some((mod) => matchesKey(mod, e.key))) {
        return false;
      }
    }
    if (isMouse && !isKeyboard && !checkMouseModifiers(modifiers, e)) {
      return false;
    }
    if (!checkSystemModifiers(modifiers, e)) {
      return false;
    }
    if (!checkExact(modifiers, e)) {
      return false;
    }
    if (isSelf && e.target !== el) {
      return false;
    }
    if (isStop)
      e.stopPropagation();
    if (isPrevent && !isPassive)
      e.preventDefault();
    let targetFn;
    let thisArg = ctx;
    let args = [e];
    const trimmed = val ? val.trim() : "";
    const parenIdx = trimmed.indexOf("(");
    if (parenIdx > -1 && trimmed.endsWith(")")) {
      const fnPath = trimmed.slice(0, parenIdx).trim();
      const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();
      targetFn = resolveRaw(fnPath, ctx);
      if (fnPath.includes(".")) {
        const parts = getPathParts(fnPath);
        if (parts.length > 1) {
          const rawParent = resolveRaw(parts.slice(0, -1).join("."), ctx);
          const parentObj = isRef(rawParent) ? rawParent.value : rawParent;
          if (parentObj && (typeof parentObj === "object" || typeof parentObj === "function")) {
            thisArg = parentObj;
          }
        }
      }
      if (argsStr) {
        const rawArgs = parseEventArgs(argsStr);
        args = rawArgs.map((a) => {
          if (a === "$event")
            return e;
          if (a.startsWith('"') && a.endsWith('"') || a.startsWith("'") && a.endsWith("'")) {
            return a.slice(1, -1);
          }
          const resolved = resolvePath(a, ctx);
          if (resolved !== void 0)
            return resolved;
          try {
            return JSON.parse(a);
          } catch {
          }
          try {
            const evalResult = resolveExpression(a, ctx);
            if (evalResult !== void 0)
              return evalResult;
          } catch {
          }
          return a;
        });
      } else {
        args = [];
      }
    } else {
      targetFn = resolveRaw(trimmed, ctx);
      if (trimmed.includes(".")) {
        const parts = getPathParts(trimmed);
        if (parts.length > 1) {
          const rawParent = resolveRaw(parts.slice(0, -1).join("."), ctx);
          const parentObj = isRef(rawParent) ? rawParent.value : rawParent;
          if (parentObj && (typeof parentObj === "object" || typeof parentObj === "function")) {
            thisArg = parentObj;
          }
        }
      }
    }
    if (typeof targetFn === "function") {
      try {
        targetFn.call(thisArg, ...args);
      } catch (err) {
        handleError(err, `Event @${evtType}`);
      }
    } else if (appConfig.allowInlineExpressions) {
      try {
        new Function("$ctx", "$event", `with($ctx) { ${val} }`)(ctx, e);
      } catch (err) {
        console.log("DEBUG listener error: val=", val, "ctx=", ctx);
        handleError(err, `Event @${evtType}`);
      }
    } else {
      warn(`Handler not found: ${val}. Inline expressions are disabled. Set allowInlineExpressions: true in config to enable inline JavaScript.`, "event");
    }
    return true;
  };
  const target = getListenerTarget(el, modifiers);
  const options = getListenerOptions(modifiers);
  const bind2 = () => {
    let isCleaned = false;
    if (isOutside) {
      const outsideOptions = typeof options === "object" ? { ...options, once: false } : false;
      let unbindOutside = null;
      const outsideHandler = (e) => {
        const isContained = typeof e.composedPath === "function" ? e.composedPath().includes(el) : el.contains(e.target);
        if (!isContained && el !== e.target) {
          const executed = executeHandler(e);
          if (executed && isOnce && unbindOutside) {
            unbindOutside();
          }
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener(evtType, outsideHandler, outsideOptions);
        unbindOutside = () => {
          if (isCleaned)
            return;
          isCleaned = true;
          document.removeEventListener(evtType, outsideHandler, outsideOptions);
        };
        if (trackCleanup)
          trackCleanup(unbindOutside);
        return unbindOutside;
      }
      return () => {
      };
    }
    target.addEventListener(evtType, executeHandler, options);
    const unbind = () => {
      if (isCleaned)
        return;
      isCleaned = true;
      target.removeEventListener(evtType, executeHandler, options);
    };
    if (trackCleanup)
      trackCleanup(unbind);
    return unbind;
  };
  return {
    target,
    eventName: evtType,
    handler: executeHandler,
    options,
    isOutside,
    bind: bind2
  };
}

// packages/core/src/renderer/transition.js
function nextFrame(fn) {
  if (typeof requestAnimationFrame === "function") {
    let handle2 = null;
    let cancelled = false;
    const handle1 = requestAnimationFrame(() => {
      if (cancelled)
        return;
      handle2 = requestAnimationFrame(() => {
        if (cancelled)
          return;
        fn();
      });
    });
    return () => {
      cancelled = true;
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(handle1);
        if (handle2 !== null)
          cancelAnimationFrame(handle2);
      }
    };
  } else {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled)
        fn();
    }, 16);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }
}
function parseClasses(classStr) {
  if (!classStr)
    return [];
  if (Array.isArray(classStr))
    return classStr;
  return String(classStr).trim().split(/\s+/).filter(Boolean);
}
function addClasses(el, classes) {
  if (!el || !classes)
    return;
  const list = Array.isArray(classes) ? classes : parseClasses(classes);
  if (el.classList && typeof el.classList.add === "function") {
    list.forEach((cls) => {
      if (cls)
        el.classList.add(cls);
    });
  } else if (el.className !== void 0) {
    const existing = new Set(parseClasses(el.className));
    list.forEach((cls) => {
      if (cls)
        existing.add(cls);
    });
    el.className = Array.from(existing).join(" ");
  }
}
function removeClasses(el, classes) {
  if (!el || !classes)
    return;
  const list = Array.isArray(classes) ? classes : parseClasses(classes);
  if (el.classList && typeof el.classList.remove === "function") {
    list.forEach((cls) => {
      if (cls)
        el.classList.remove(cls);
    });
  } else if (el.className !== void 0) {
    const existing = new Set(parseClasses(el.className));
    list.forEach((cls) => {
      existing.delete(cls);
    });
    el.className = Array.from(existing).join(" ");
  }
}
function getTransitionDurations(el) {
  const rawEl = el && el[RAW] ? el[RAW] : el;
  if (typeof window === "undefined" || !window.getComputedStyle || !rawEl || rawEl.nodeType !== 1) {
    return { duration: 0, delay: 0, total: 0, longestProperties: [], allProperties: [], longestAnimationNames: [] };
  }
  try {
    const styles = window.getComputedStyle(rawEl);
    const rawTransDur = styles.transitionDuration || "0s";
    const rawTransDelay = styles.transitionDelay || "0s";
    const rawTransProp = styles.transitionProperty || "all";
    const transDurParts = rawTransDur.split(",").map((s) => s.trim());
    const transDelayParts = rawTransDelay.split(",").map((s) => s.trim());
    const transPropParts = rawTransProp.split(",").map((s) => s.trim());
    const numTrans = Math.max(transDurParts.length, transDelayParts.length, transPropParts.length);
    let maxTransTotal = 0;
    let maxTransDur = 0;
    let maxTransDelay = 0;
    let longestTransProps = [];
    let allTransProps = [];
    for (let i = 0; i < numTrans; i++) {
      const durStr = transDurParts[i % transDurParts.length] || "0s";
      const delayStr = transDelayParts[i % transDelayParts.length] || "0s";
      const propName = transPropParts[i % transPropParts.length] || "all";
      const durMs = parseFloat(durStr) * (durStr.endsWith("ms") ? 1 : 1e3) || 0;
      const delayMs = parseFloat(delayStr) * (delayStr.endsWith("ms") ? 1 : 1e3) || 0;
      const total = durMs + delayMs;
      if (total > 0) {
        allTransProps.push(propName);
      }
      if (total > maxTransTotal) {
        maxTransTotal = total;
        maxTransDur = durMs;
        maxTransDelay = delayMs;
        longestTransProps = [propName];
      } else if (total === maxTransTotal && total > 0) {
        longestTransProps.push(propName);
      }
    }
    const rawAnimDur = styles.animationDuration || "0s";
    const rawAnimDelay = styles.animationDelay || "0s";
    const rawAnimName = styles.animationName || "none";
    const animDurParts = rawAnimDur.split(",").map((s) => s.trim());
    const animDelayParts = rawAnimDelay.split(",").map((s) => s.trim());
    const animNameParts = rawAnimName.split(",").map((s) => s.trim());
    const numAnim = Math.max(animDurParts.length, animDelayParts.length, animNameParts.length);
    let maxAnimTotal = 0;
    let maxAnimDur = 0;
    let maxAnimDelay = 0;
    let longestAnimNames = [];
    for (let i = 0; i < numAnim; i++) {
      const durStr = animDurParts[i % animDurParts.length] || "0s";
      const delayStr = animDelayParts[i % animDelayParts.length] || "0s";
      const name = animNameParts[i % animNameParts.length] || "none";
      const durMs = parseFloat(durStr) * (durStr.endsWith("ms") ? 1 : 1e3) || 0;
      const delayMs = parseFloat(delayStr) * (delayStr.endsWith("ms") ? 1 : 1e3) || 0;
      const total = durMs + delayMs;
      if (total > maxAnimTotal) {
        maxAnimTotal = total;
        maxAnimDur = durMs;
        maxAnimDelay = delayMs;
        longestAnimNames = [name];
      } else if (total === maxAnimTotal && total > 0) {
        longestAnimNames.push(name);
      }
    }
    if (maxTransTotal >= maxAnimTotal) {
      return {
        duration: maxTransDur,
        delay: maxTransDelay,
        total: maxTransTotal,
        longestProperties: longestTransProps,
        allProperties: allTransProps,
        longestAnimationNames: [],
        type: "transition"
      };
    } else {
      return {
        duration: maxAnimDur,
        delay: maxAnimDelay,
        total: maxAnimTotal,
        longestProperties: [],
        allProperties: [],
        longestAnimationNames: longestAnimNames,
        type: "animation"
      };
    }
  } catch {
    return { duration: 0, delay: 0, total: 0, longestProperties: [], allProperties: [], longestAnimationNames: [] };
  }
}
function resolveTransitionConfig(el, appConfig = {}) {
  if (!el || el.nodeType !== 1)
    return null;
  const prefix = appConfig.prefix || globalConfig && globalConfig.prefix || "h-";
  const cleanPrefix = prefix.endsWith("-") ? prefix.slice(0, -1) : prefix;
  const hasTransitionAttr = el.hasAttribute(`${prefix}transition`) || el.hasAttribute(`data-${prefix}transition`) || el.hasAttribute("h-transition") || el.hasAttribute("hx-transition") || el.hasAttribute("data-h-transition") || el.hasAttribute("data-hx-transition");
  const explicitName = el.getAttribute(`${prefix}transition`) || el.getAttribute(`data-${prefix}transition`) || el.getAttribute("h-transition") || el.getAttribute("hx-transition") || el.getAttribute("data-h-transition") || el.getAttribute("data-hx-transition") || el.getAttribute("name");
  if (!hasTransitionAttr && !explicitName && !el.hasAttribute("enter-active-class") && !el.hasAttribute(`${prefix}transition:enter`)) {
    return null;
  }
  const name = explicitName && explicitName.trim() && explicitName !== "true" ? explicitName.trim() : cleanPrefix;
  const getAttr = (attrList) => {
    for (const a of attrList) {
      if (el.hasAttribute(a))
        return el.getAttribute(a);
    }
    return null;
  };
  const enterFromClass = getAttr([
    `${prefix}transition:enter-start`,
    `${prefix}transition:enter-from`,
    "enter-from-class",
    "enter-start-class"
  ]) || `${name}-enter-from`;
  const enterActiveClass = getAttr([
    `${prefix}transition:enter`,
    `${prefix}transition:enter-active`,
    "enter-active-class"
  ]) || `${name}-enter-active`;
  const enterToClass = getAttr([
    `${prefix}transition:enter-end`,
    `${prefix}transition:enter-to`,
    "enter-to-class",
    "enter-end-class"
  ]) || `${name}-enter-to`;
  const leaveFromClass = getAttr([
    `${prefix}transition:leave-start`,
    `${prefix}transition:leave-from`,
    "leave-from-class",
    "leave-start-class"
  ]) || `${name}-leave-from`;
  const leaveActiveClass = getAttr([
    `${prefix}transition:leave`,
    `${prefix}transition:leave-active`,
    "leave-active-class"
  ]) || `${name}-leave-active`;
  const leaveToClass = getAttr([
    `${prefix}transition:leave-end`,
    `${prefix}transition:leave-to`,
    "leave-to-class",
    "leave-end-class"
  ]) || `${name}-leave-to`;
  const moveClass = getAttr([
    `${prefix}transition:move`,
    "move-class"
  ]) || `${name}-move`;
  return {
    name,
    enterFromClass,
    enterActiveClass,
    enterToClass,
    leaveFromClass,
    leaveActiveClass,
    leaveToClass,
    moveClass
  };
}
function fireTransitionHook(el, hookName, eventData = {}) {
  if (!el || typeof el.dispatchEvent !== "function")
    return;
  try {
    const evt = typeof CustomEvent === "function" ? new CustomEvent(hookName, { bubbles: false, cancelable: true, detail: eventData }) : { type: hookName, detail: eventData, target: el };
    el.dispatchEvent(evt);
  } catch {
  }
}
function cancelFlip(node) {
  if (!node || node.nodeType !== 1)
    return;
  if (node.__hx_flip && typeof node.__hx_flip.cancel === "function") {
    node.__hx_flip.cancel();
    node.__hx_flip = null;
  }
}
function cancelTransition(el) {
  if (!el || el.nodeType !== 1)
    return;
  if (el.__hx_current_transition && typeof el.__hx_current_transition.cancel === "function") {
    el.__hx_current_transition.cancel();
    el.__hx_current_transition = null;
  }
  cancelFlip(el);
  if (el.__hx_enter_cancel) {
    try {
      el.__hx_enter_cancel();
    } catch {
    }
    el.__hx_enter_cancel = null;
  }
  if (el.__hx_leave_cancel) {
    try {
      el.__hx_leave_cancel();
    } catch {
    }
    el.__hx_leave_cancel = null;
  }
}
function enter(el, config, onDone) {
  if (!el || el.nodeType !== 1) {
    if (onDone)
      onDone({ cancelled: false, el });
    return;
  }
  if (!config) {
    if (onDone)
      onDone({ cancelled: false, el });
    return;
  }
  cancelTransition(el);
  fireTransitionHook(el, "before-enter");
  const { enterFromClass, enterActiveClass, enterToClass } = config;
  addClasses(el, enterFromClass);
  addClasses(el, enterActiveClass);
  let isDone = false;
  let fallbackTimer = null;
  let cancelNextFrame = null;
  let durations = null;
  const cleanupClasses = () => {
    removeClasses(el, enterToClass);
    removeClasses(el, enterActiveClass);
    removeClasses(el, enterFromClass);
  };
  const finish = (cancelled = false) => {
    if (isDone)
      return;
    isDone = true;
    if (cancelNextFrame)
      cancelNextFrame();
    if (fallbackTimer)
      clearTimeout(fallbackTimer);
    el.removeEventListener("transitionend", onEnd);
    el.removeEventListener("animationend", onEnd);
    cleanupClasses();
    if (Array.isArray(el.__hx_cleanup)) {
      const idx = el.__hx_cleanup.indexOf(nodeCleanupFn);
      if (idx !== -1)
        el.__hx_cleanup.splice(idx, 1);
    }
    if (el.__hx_current_transition && el.__hx_current_transition.cancel === cancelRunner) {
      el.__hx_current_transition = null;
    }
    el.__hx_enter_cancel = null;
    fireTransitionHook(el, cancelled ? "enter-cancelled" : "after-enter");
    if (onDone)
      onDone({ cancelled, el });
  };
  const onEnd = (e) => {
    if (!e || e.target !== el)
      return;
    if (e.type === "transitionend") {
      if (durations && durations.longestProperties && durations.longestProperties.length > 0) {
        const prop = e.propertyName;
        const isAll = durations.longestProperties.includes("all");
        const isMatch = isAll || prop && durations.longestProperties.includes(prop);
        if (!isMatch)
          return;
      }
      finish(false);
    } else if (e.type === "animationend") {
      if (durations && durations.longestAnimationNames && durations.longestAnimationNames.length > 0) {
        const animName = e.animationName;
        const isMatch = animName && durations.longestAnimationNames.includes(animName);
        if (!isMatch)
          return;
      }
      finish(false);
    }
  };
  const cancelRunner = () => {
    finish(true);
  };
  const nodeCleanupFn = () => {
    if (!isDone) {
      finish(true);
    }
  };
  el.__hx_cleanup = el.__hx_cleanup || [];
  el.__hx_cleanup.push(nodeCleanupFn);
  el.__hx_current_transition = { type: "enter", cancel: cancelRunner };
  el.__hx_enter_cancel = cancelRunner;
  cancelNextFrame = nextFrame(() => {
    if (isDone)
      return;
    removeClasses(el, enterFromClass);
    addClasses(el, enterToClass);
    fireTransitionHook(el, "enter");
    el.addEventListener("transitionend", onEnd);
    el.addEventListener("animationend", onEnd);
    durations = getTransitionDurations(el);
    const timeoutMs = durations.total > 0 ? durations.total + 50 : 20;
    fallbackTimer = setTimeout(() => finish(false), timeoutMs);
  });
}
function leave(el, config, onDone) {
  if (!el || el.nodeType !== 1) {
    if (onDone)
      onDone({ cancelled: false, el });
    return;
  }
  if (!config) {
    if (onDone)
      onDone({ cancelled: false, el });
    return;
  }
  cancelTransition(el);
  fireTransitionHook(el, "before-leave");
  const { leaveFromClass, leaveActiveClass, leaveToClass } = config;
  addClasses(el, leaveFromClass);
  addClasses(el, leaveActiveClass);
  let isDone = false;
  let fallbackTimer = null;
  let cancelNextFrame = null;
  let durations = null;
  const cleanupClasses = () => {
    removeClasses(el, leaveToClass);
    removeClasses(el, leaveActiveClass);
    removeClasses(el, leaveFromClass);
  };
  const finish = (cancelled = false) => {
    if (isDone)
      return;
    isDone = true;
    if (cancelNextFrame)
      cancelNextFrame();
    if (fallbackTimer)
      clearTimeout(fallbackTimer);
    el.removeEventListener("transitionend", onEnd);
    el.removeEventListener("animationend", onEnd);
    cleanupClasses();
    if (Array.isArray(el.__hx_cleanup)) {
      const idx = el.__hx_cleanup.indexOf(nodeCleanupFn);
      if (idx !== -1)
        el.__hx_cleanup.splice(idx, 1);
    }
    if (el.__hx_current_transition && el.__hx_current_transition.cancel === cancelRunner) {
      el.__hx_current_transition = null;
    }
    el.__hx_leave_cancel = null;
    fireTransitionHook(el, cancelled ? "leave-cancelled" : "after-leave");
    if (onDone)
      onDone({ cancelled, el });
  };
  const onEnd = (e) => {
    if (!e || e.target !== el)
      return;
    if (e.type === "transitionend") {
      if (durations && durations.longestProperties && durations.longestProperties.length > 0) {
        const prop = e.propertyName;
        const isAll = durations.longestProperties.includes("all");
        const isMatch = isAll || prop && durations.longestProperties.includes(prop);
        if (!isMatch)
          return;
      }
      finish(false);
    } else if (e.type === "animationend") {
      if (durations && durations.longestAnimationNames && durations.longestAnimationNames.length > 0) {
        const animName = e.animationName;
        const isMatch = animName && durations.longestAnimationNames.includes(animName);
        if (!isMatch)
          return;
      }
      finish(false);
    }
  };
  const cancelRunner = () => {
    finish(true);
  };
  const nodeCleanupFn = () => {
    if (!isDone) {
      finish(true);
    }
  };
  el.__hx_cleanup = el.__hx_cleanup || [];
  el.__hx_cleanup.push(nodeCleanupFn);
  el.__hx_current_transition = { type: "leave", cancel: cancelRunner };
  el.__hx_leave_cancel = cancelRunner;
  cancelNextFrame = nextFrame(() => {
    if (isDone)
      return;
    removeClasses(el, leaveFromClass);
    addClasses(el, leaveToClass);
    fireTransitionHook(el, "leave");
    el.addEventListener("transitionend", onEnd);
    el.addEventListener("animationend", onEnd);
    durations = getTransitionDurations(el);
    const timeoutMs = durations.total > 0 ? durations.total + 50 : 20;
    fallbackTimer = setTimeout(() => finish(false), timeoutMs);
  });
}
function recordPositions(nodes) {
  const map = /* @__PURE__ */ new Map();
  if (!nodes)
    return map;
  nodes.forEach((node) => {
    const rawNode = node && node[RAW] ? node[RAW] : node;
    if (rawNode && rawNode.nodeType === 1 && typeof rawNode.getBoundingClientRect === "function") {
      try {
        map.set(rawNode, rawNode.getBoundingClientRect());
      } catch (_) {
      }
    }
  });
  return map;
}
function applyFlip(oldPositions, moveClass = "h-move") {
  if (!oldPositions || oldPositions.size === 0)
    return;
  const movedNodes = [];
  oldPositions.forEach((oldRect, node) => {
    const rawNode = node && node[RAW] ? node[RAW] : node;
    if (!rawNode || !rawNode.parentNode || typeof rawNode.getBoundingClientRect !== "function")
      return;
    let newRect;
    try {
      newRect = rawNode.getBoundingClientRect();
    } catch (_) {
      return;
    }
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (dx !== 0 || dy !== 0) {
      cancelFlip(rawNode);
      movedNodes.push({ node: rawNode, dx, dy });
      rawNode.style.transform = `translate(${dx}px, ${dy}px)`;
      rawNode.style.transitionDuration = "0s";
    }
  });
  if (movedNodes.length === 0)
    return;
  movedNodes.forEach(({ node }) => {
    let isDone = false;
    let fallbackTimer = null;
    let cancelNextFrame = null;
    const cleanupFlip = () => {
      if (isDone)
        return;
      isDone = true;
      if (cancelNextFrame)
        cancelNextFrame();
      if (fallbackTimer)
        clearTimeout(fallbackTimer);
      node.removeEventListener("transitionend", onEnd);
      removeClasses(node, moveClass);
      node.style.transform = "";
      node.style.transitionDuration = "";
      if (node.__hx_flip && node.__hx_flip.cancel === cancelRunner) {
        node.__hx_flip = null;
      }
      if (Array.isArray(node.__hx_cleanup)) {
        const idx = node.__hx_cleanup.indexOf(nodeCleanupFn);
        if (idx !== -1)
          node.__hx_cleanup.splice(idx, 1);
      }
    };
    const onEnd = (e) => {
      if (e && e.target !== node)
        return;
      cleanupFlip();
    };
    const cancelRunner = () => {
      cleanupFlip();
    };
    const nodeCleanupFn = () => {
      cleanupFlip();
    };
    node.__hx_cleanup = node.__hx_cleanup || [];
    node.__hx_cleanup.push(nodeCleanupFn);
    node.__hx_flip = { cancel: cancelRunner };
    cancelNextFrame = nextFrame(() => {
      if (isDone)
        return;
      addClasses(node, moveClass);
      node.style.transform = "";
      node.style.transitionDuration = "";
      node.addEventListener("transitionend", onEnd);
      const durations = getTransitionDurations(node);
      const timeoutMs = durations.total > 0 ? durations.total + 50 : 500;
      fallbackTimer = setTimeout(() => {
        cleanupFlip();
      }, timeoutMs);
    });
  });
}

// packages/core/src/renderer/teleport.js
function resolveTeleportTarget(to) {
  if (!to)
    return null;
  if (typeof to === "object" && to.nodeType === 1)
    return to;
  if (typeof to === "string") {
    if (typeof document !== "undefined") {
      if (to === "body")
        return document.body;
      if (to === "head")
        return document.head;
      return document.querySelector(to);
    }
  }
  return null;
}
var Teleport = {
  name: "Teleport",
  props: {
    to: { default: "body" },
    disabled: { default: false }
  },
  setup(ctx) {
    let placeholder = null;
    let movedNodes = [];
    let placementEffect = null;
    let isTornDown = false;
    const teardown = () => {
      if (isTornDown)
        return;
      isTornDown = true;
      if (placementEffect) {
        cleanup(placementEffect);
        placementEffect = null;
      }
      const nodesToDestroy = [...movedNodes];
      movedNodes = [];
      nodesToDestroy.forEach((node) => destroyNode(node));
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      placeholder = null;
    };
    const inst = currentInstance;
    onMounted((el) => {
      const container = el || inst?.root;
      if (!container || isTornDown)
        return;
      const doc = container.ownerDocument || (typeof document !== "undefined" ? document : null);
      placeholder = doc ? doc.createComment(" teleport-anchor ") : { nodeType: 8, textContent: " teleport-anchor " };
      const parent = container.parentNode;
      if (!parent)
        return;
      parent.insertBefore(placeholder, container);
      movedNodes = Array.from(container.childNodes || []);
      movedNodes.forEach((node) => {
        if (node.parentNode === container) {
          container.removeChild(node);
        }
      });
      parent.removeChild(container);
      const updatePlacement = () => {
        if (isTornDown)
          return;
        const props = ctx.props || ctx;
        const isDisabled = Boolean(typeof props.disabled === "function" ? props.disabled() : props.disabled);
        const targetSelector = typeof props.to === "function" ? props.to() : props.to;
        if (isDisabled) {
          if (placeholder && placeholder.parentNode) {
            movedNodes.forEach((node) => {
              placeholder.parentNode.insertBefore(node, placeholder);
            });
          }
        } else {
          const targetEl = resolveTeleportTarget(targetSelector);
          if (targetEl) {
            movedNodes.forEach((node) => {
              targetEl.appendChild(node);
            });
          } else {
            warn(`[Helix Teleport] Target container "${targetSelector}" not found in document.`, "teleport");
            if (placeholder && placeholder.parentNode) {
              movedNodes.forEach((node) => {
                placeholder.parentNode.insertBefore(node, placeholder);
              });
            }
          }
        }
      };
      placementEffect = effect(updatePlacement, { name: "teleport-placement" });
      container.__hx_cleanup = container.__hx_cleanup || [];
      container.__hx_cleanup.push(teardown);
      placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
      placeholder.__hx_cleanup.push(teardown);
    });
    onUnmounted(() => {
      teardown();
    });
    return {};
  }
};

// packages/core/src/directives/index.js
function createBuiltinDirectives(appConfig) {
  const dirs = {};
  dirs.ref = {
    selfManaged: true,
    mounted(el, { value, ctx, instance, trackCleanup }) {
      if (!value)
        return;
      if (typeof value === "function") {
        try {
          value(el);
        } catch (err) {
          handleError(err, "function ref mount", instance);
        }
        if (trackCleanup) {
          trackCleanup(() => {
            try {
              value(null);
            } catch (err) {
              handleError(err, "function ref unmount", instance);
            }
          });
        }
        return;
      }
      if (instance && instance.templateRefs && instance.templateRefs.has(value)) {
        const tRef = instance.templateRefs.get(value);
        tRef.value = el;
        if (trackCleanup) {
          trackCleanup(() => {
            if (tRef.value === el)
              tRef.value = null;
          });
        }
      }
      if (ctx && typeof ctx[value] === "function") {
        const fn = ctx[value];
        try {
          fn(el);
        } catch (err) {
          handleError(err, "context function ref mount", instance);
        }
        if (trackCleanup) {
          trackCleanup(() => {
            try {
              fn(null);
            } catch (err) {
              handleError(err, "context function ref unmount", instance);
            }
          });
        }
        return;
      }
      const parts = getPathParts(value);
      const last = parts.pop();
      const parent = parts.reduce((acc, part) => acc?.[part], ctx);
      if (parent && last !== void 0) {
        if (isRef(parent[last])) {
          parent[last].value = el;
          if (trackCleanup) {
            trackCleanup(() => {
              if (parent[last] && parent[last].value === el)
                parent[last].value = null;
            });
          }
        } else {
          parent[last] = el;
          if (trackCleanup) {
            trackCleanup(() => {
              if (parent[last] === el)
                parent[last] = null;
            });
          }
        }
      }
      if (ctx && typeof ctx === "object") {
        if (!ctx.$refs)
          ctx.$refs = {};
        ctx.$refs[value] = el;
        if (trackCleanup) {
          trackCleanup(() => {
            if (ctx.$refs && ctx.$refs[value] === el) {
              delete ctx.$refs[value];
            }
          });
        }
      }
    }
  };
  dirs.intersect = {
    selfManaged: true,
    mounted(el, { value: val, arg, modifiers = [], ctx, instance, trackCleanup }) {
      if (!val)
        return;
      const isLeave = arg === "leave" || modifiers.includes("leave");
      const isOnce = modifiers.includes("once");
      const isHalf = modifiers.includes("half");
      const isFull = modifiers.includes("full");
      let threshold = 0;
      if (isFull)
        threshold = 1;
      else if (isHalf)
        threshold = 0.5;
      else {
        const threshMod = modifiers.find((m) => m === "threshold" || m.startsWith("threshold"));
        if (threshMod) {
          let numStr = null;
          if (threshMod.includes(".") || threshMod.includes("-")) {
            numStr = threshMod.replace(/^threshold[.-]/, "");
          } else {
            const idx = modifiers.indexOf(threshMod);
            numStr = modifiers[idx + 1];
          }
          if (numStr) {
            const parsed = parseFloat(numStr);
            if (!isNaN(parsed)) {
              threshold = parsed > 1 ? parsed / 100 : parsed;
            }
          }
        }
      }
      threshold = Math.min(1, Math.max(0, threshold));
      let rootMargin = "0px";
      const marginMod = modifiers.find((m) => m === "margin" || m.startsWith("margin"));
      if (marginMod) {
        let valStr = null;
        if (marginMod.includes(".") || marginMod.includes("-")) {
          valStr = marginMod.replace(/^margin[.-]/, "");
          if (marginMod.startsWith("margin.-") || marginMod.startsWith("margin.--")) {
            valStr = "-" + marginMod.replace(/^margin\.[-]+/, "");
          }
        } else {
          const idx = modifiers.indexOf(marginMod);
          valStr = modifiers[idx + 1];
        }
        if (valStr) {
          rootMargin = valStr.replace(/_/g, " ");
        }
      }
      const runHandler = (entry) => {
        const fn = resolveRaw(val, ctx);
        if (typeof fn === "function") {
          try {
            fn.call(ctx, entry);
          } catch (err) {
            handleError(err, `${appConfig.prefix}intersect handler`, instance);
          }
        } else {
          resolveExpression(val, ctx, { contextName: `${appConfig.prefix}intersect`, forceExpression: true });
        }
      };
      if (typeof IntersectionObserver === "undefined") {
        runHandler({ target: el, isIntersecting: true, intersectionRatio: 1 });
        return;
      }
      let triggered = false;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const matchesCondition = isLeave ? !entry.isIntersecting : entry.isIntersecting;
          if (matchesCondition) {
            if (isOnce) {
              if (triggered)
                break;
              triggered = true;
              observer.unobserve(el);
              observer.disconnect();
            }
            runHandler(entry);
            if (isOnce)
              break;
          }
        }
      }, {
        threshold,
        rootMargin
      });
      observer.observe(el);
      if (trackCleanup) {
        trackCleanup(() => {
          observer.unobserve(el);
          observer.disconnect();
        });
      }
    }
  };
  dirs.text = {
    selfManaged: true,
    mounted(el, { value: val, ctx, instance, trackCleanup }) {
      el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.TEXT;
      let initialRan = false;
      const updateFn = () => {
        const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-text" });
        const newText = typeof res === "object" && res !== null ? JSON.stringify(res) : res ?? "";
        if (el.textContent !== newText) {
          el.textContent = newText;
          if (initialRan && instance)
            queueComponentUpdated(instance);
        }
      };
      const e = effect(updateFn, { name: `text: ${val}`, area: "directive" });
      initialRan = true;
      let isCleaned = false;
      trackCleanup(() => {
        if (isCleaned)
          return;
        isCleaned = true;
        cleanup(e);
      });
    }
  };
  dirs.html = {
    selfManaged: true,
    mounted(el, { value: val, ctx, instance, trackCleanup }) {
      let initialRan = false;
      const updateFn = () => {
        const res = resolveExpression(val, ctx, { fallback: "", contextName: "hx-html" });
        const newHtml = sanitizeHtml(res || "");
        if (el.innerHTML !== newHtml) {
          el.innerHTML = newHtml;
          if (initialRan && instance)
            queueComponentUpdated(instance);
        }
      };
      const e = effect(updateFn, { name: `html: ${val}`, area: "directive" });
      initialRan = true;
      let isCleaned = false;
      trackCleanup(() => {
        if (isCleaned)
          return;
        isCleaned = true;
        cleanup(e);
      });
    }
  };
  dirs.model = {
    selfManaged: true,
    mounted(el, { value: val, modifiers = [], ctx, instance, trackCleanup }) {
      const isCheck = el.type === "checkbox";
      const isRadio = el.type === "radio";
      const isSelect = el.tagName === "SELECT";
      const isSelectMultiple = isSelect && el.multiple;
      const isLazy = modifiers.includes("lazy");
      const isTrim = modifiers.includes("trim");
      const isNumber = modifiers.includes("number") || el.type === "number";
      let debounceTime = null;
      const debounceMod = modifiers.find((m) => m === "debounce" || m.startsWith("debounce"));
      if (debounceMod) {
        const idx = modifiers.indexOf(debounceMod);
        const nextMod = modifiers[idx + 1];
        let ms = 250;
        if (nextMod && /^\d+(ms)?$/.test(nextMod)) {
          ms = parseInt(nextMod, 10);
        } else if (debounceMod.includes("-") || debounceMod.includes(".")) {
          const parts = debounceMod.split(/[-.]/);
          if (parts[1] && /^\d+(ms)?$/.test(parts[1])) {
            ms = parseInt(parts[1], 10);
          }
        }
        debounceTime = ms;
      }
      const evtType = isCheck || isRadio || isSelect ? "change" : isLazy ? "change" : "input";
      let debounceTimer = null;
      const toNumber = (v) => {
        if (v === "" || v === null || v === void 0)
          return "";
        const n = parseFloat(v);
        return isNaN(n) ? v : n;
      };
      let trueVal = true;
      let falseVal = false;
      if (isCheck) {
        if (el.hasAttribute("true-value"))
          trueVal = el.getAttribute("true-value");
        else if (el.hasAttribute(":true-value"))
          trueVal = resolvePath(el.getAttribute(":true-value"), ctx);
        else if (appConfig.prefix && el.hasAttribute(`${appConfig.prefix}bind:true-value`))
          trueVal = resolvePath(el.getAttribute(`${appConfig.prefix}bind:true-value`), ctx);
        if (el.hasAttribute("false-value"))
          falseVal = el.getAttribute("false-value");
        else if (el.hasAttribute(":false-value"))
          falseVal = resolvePath(el.getAttribute(":false-value"), ctx);
        else if (appConfig.prefix && el.hasAttribute(`${appConfig.prefix}bind:false-value`))
          falseVal = resolvePath(el.getAttribute(`${appConfig.prefix}bind:false-value`), ctx);
      }
      const updateModel = (e2) => {
        const parts = getPathParts(val);
        const last = parts.pop();
        const parent = parts.reduce((acc, part) => acc?.[part], ctx);
        if (parent) {
          if (isCheck) {
            const current = parent[last];
            if (Array.isArray(current)) {
              const valToMatch = isNumber ? toNumber(el.value) : el.value;
              const idx = current.indexOf(valToMatch);
              if (e2.target.checked && idx === -1) {
                current.push(valToMatch);
              } else if (!e2.target.checked && idx > -1) {
                current.splice(idx, 1);
              }
            } else {
              parent[last] = e2.target.checked ? trueVal : falseVal;
            }
          } else if (isRadio) {
            parent[last] = isNumber ? toNumber(e2.target.value) : e2.target.value;
          } else if (isSelectMultiple) {
            const selected = Array.from(e2.target.selectedOptions || []).map((opt) => isNumber ? toNumber(opt.value) : opt.value);
            parent[last] = selected;
          } else {
            let rawValue = e2.target.value;
            if (isTrim && typeof rawValue === "string") {
              rawValue = rawValue.trim();
            }
            if (isNumber) {
              parent[last] = toNumber(rawValue);
            } else {
              parent[last] = rawValue;
            }
          }
        }
      };
      const handler = (e2) => {
        if (debounceTime !== null && evtType === "input") {
          if (debounceTimer)
            clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            updateModel(e2);
          }, debounceTime);
        } else {
          updateModel(e2);
        }
      };
      el.addEventListener(evtType, handler);
      let blurHandler = null;
      if (isTrim && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        blurHandler = () => {
          if (typeof el.value === "string") {
            const trimmed = el.value.trim();
            if (el.value !== trimmed) {
              el.value = trimmed;
            }
          }
        };
        el.addEventListener("blur", blurHandler);
      }
      let initialRan = false;
      const updateFn = () => {
        const current = resolvePath(val, ctx);
        let changed = false;
        if (isRadio) {
          const shouldCheck = String(current) === String(el.value);
          if (el.checked !== shouldCheck) {
            el.checked = shouldCheck;
            changed = true;
          }
        } else if (isCheck) {
          if (Array.isArray(current)) {
            const shouldCheck = current.includes(el.value) || current.includes(Number(el.value));
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              changed = true;
            }
          } else {
            const shouldCheck = current === trueVal || trueVal === true && Boolean(current);
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              changed = true;
            }
          }
        } else if (isSelectMultiple) {
          const selectedValues = Array.isArray(current) ? current.map(String) : [];
          Array.from(el.options || []).forEach((opt) => {
            const sel = selectedValues.includes(String(opt.value));
            if (opt.selected !== sel) {
              opt.selected = sel;
              changed = true;
            }
          });
        } else {
          const newValue = current ?? "";
          if (el.value !== newValue) {
            el.value = newValue;
            changed = true;
          }
        }
        if (changed && initialRan && instance)
          queueComponentUpdated(instance);
      };
      const e = effect(updateFn, { name: `model: ${val}`, area: "directive" });
      initialRan = true;
      let isCleaned = false;
      trackCleanup(() => {
        if (isCleaned)
          return;
        isCleaned = true;
        if (debounceTimer)
          clearTimeout(debounceTimer);
        el.removeEventListener(evtType, handler);
        if (blurHandler)
          el.removeEventListener("blur", blurHandler);
        cleanup(e);
      });
    }
  };
  dirs.bind = {
    selfManaged: true,
    mounted(el, { value: val, arg, ctx, instance, trackCleanup }) {
      if (!arg)
        return;
      const isDynamicArg = arg.startsWith("[") && arg.endsWith("]");
      const dynamicArgExp = isDynamicArg ? arg.slice(1, -1).trim() : null;
      const trimmed = val ? val.trim() : "";
      const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
      let initialRan = false;
      let lastAppliedArg = null;
      const updateFn = () => {
        const effectiveArg = isDynamicArg ? resolveExpression(dynamicArgExp, ctx, { contextName: "dynamic-arg" }) : arg;
        if (lastAppliedArg && lastAppliedArg !== effectiveArg) {
          if (lastAppliedArg === "class")
            el.className = "";
          else if (lastAppliedArg === "style")
            el.style.cssText = "";
          else
            el.removeAttribute(lastAppliedArg);
        }
        lastAppliedArg = effectiveArg;
        if (!effectiveArg || typeof effectiveArg !== "string")
          return;
        let result;
        if (isObjectLiteral && (effectiveArg === "class" || effectiveArg === "style")) {
          result = resolveExpression(val, ctx, { contextName: `v-bind:${effectiveArg}`, forceExpression: true });
        } else if (isObjectLiteral) {
          result = resolveExpression(val, ctx, { contextName: "v-bind object" });
        } else {
          result = resolveExpression(val, ctx, { contextName: `v-bind:${effectiveArg}`, fallback: void 0 });
        }
        if (effectiveArg === "class") {
          el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.CLASS;
          if (el.__hx_initial_class === void 0) {
            el.__hx_initial_class = el.className || "";
          }
          const staticClass = el.__hx_initial_class;
          if (typeof result === "object" && result !== null) {
            if (Array.isArray(result)) {
              const dynamicClasses = result.filter(Boolean).join(" ");
              const combined = [staticClass, dynamicClasses].filter(Boolean).join(" ");
              if (el.className !== combined)
                el.className = combined;
            } else {
              el.className = staticClass;
              Object.keys(result).forEach((k) => {
                k.split(/\s+/).filter(Boolean).forEach((cls) => {
                  el.classList.toggle(cls, !!result[k]);
                });
              });
            }
          } else {
            const dynamicClass = (result || "").trim();
            const combined = [staticClass, dynamicClass].filter(Boolean).join(" ");
            if (el.className !== combined)
              el.className = combined;
          }
        } else if (effectiveArg === "style") {
          el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.STYLE;
          if (typeof result === "object" && result !== null)
            Object.assign(el.style, result);
          else {
            const newStyle = result || "";
            if (el.style.cssText !== newStyle)
              el.style.cssText = newStyle;
          }
        } else if (effectiveArg === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
          const newValue = result ?? "";
          if (el.value !== newValue)
            el.value = newValue;
        } else if (typeof result === "boolean") {
          if (result) {
            if (!el.hasAttribute(effectiveArg))
              el.setAttribute(effectiveArg, "");
          } else {
            if (el.hasAttribute(effectiveArg))
              el.removeAttribute(effectiveArg);
          }
        } else {
          const newValue = result ?? "";
          if (el.getAttribute(effectiveArg) !== newValue)
            el.setAttribute(effectiveArg, newValue);
        }
        if (initialRan && instance)
          queueComponentUpdated(instance);
      };
      const e = effect(updateFn, { name: `bind: ${arg}`, area: "directive" });
      initialRan = true;
      let isCleaned = false;
      trackCleanup(() => {
        if (isCleaned)
          return;
        isCleaned = true;
        cleanup(e);
        if (lastAppliedArg && isDynamicArg) {
          el.removeAttribute(lastAppliedArg);
        }
      });
    }
  };
  dirs.on = {
    selfManaged: true,
    mounted(el, binding) {
      const { arg, ctx, trackCleanup } = binding;
      if (arg && arg.startsWith("[") && arg.endsWith("]")) {
        const dynamicExp = arg.slice(1, -1).trim();
        let currentUnbind = null;
        let lastEvtType = null;
        const updateEffect = effect(() => {
          const dynamicEvt = resolveExpression(dynamicExp, ctx, { contextName: "dynamic-event" });
          if (dynamicEvt !== lastEvtType) {
            if (currentUnbind) {
              currentUnbind();
              currentUnbind = null;
            }
            lastEvtType = dynamicEvt;
            if (dynamicEvt && typeof dynamicEvt === "string") {
              const dynBinding = { ...binding, arg: dynamicEvt };
              const listener = createEventListener(el, dynBinding, appConfig);
              currentUnbind = listener.bind();
            }
          }
        }, { name: `on:[${dynamicExp}]`, area: "directive" });
        let isCleaned = false;
        trackCleanup(() => {
          if (isCleaned)
            return;
          isCleaned = true;
          cleanup(updateEffect);
          if (currentUnbind)
            currentUnbind();
        });
      } else {
        const listener = createEventListener(el, binding, appConfig);
        listener.bind();
      }
    }
  };
  dirs.show = {
    selfManaged: true,
    mounted(el, { value: val, ctx, instance, trackCleanup }) {
      let initialRan = false;
      let currentVisible = null;
      const updateFn = () => {
        const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: `${appConfig.prefix}show` });
        if (shouldShow === currentVisible)
          return;
        currentVisible = shouldShow;
        const transConfig = el.__hx_transition_config || resolveTransitionConfig(el, appConfig);
        if (shouldShow) {
          el.style.display = "";
          if (transConfig) {
            enter(el, transConfig);
          }
          if (initialRan && instance)
            queueComponentUpdated(instance);
        } else {
          if (transConfig && initialRan) {
            leave(el, transConfig, ({ cancelled } = {}) => {
              if (!cancelled && currentVisible === false) {
                el.style.display = "none";
              }
            });
          } else {
            el.style.display = "none";
          }
          if (initialRan && instance)
            queueComponentUpdated(instance);
        }
      };
      const e = effect(updateFn, { name: `show: ${val}`, area: "directive" });
      initialRan = true;
      let isCleaned = false;
      trackCleanup(() => {
        if (isCleaned)
          return;
        isCleaned = true;
        cancelTransition(el);
        cleanup(e);
      });
    }
  };
  dirs.if = {
    selfManaged: true,
    mounted(el, { value: val, branches, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
      const branchList = branches && branches.length > 0 ? branches : [{ el, exp: val, type: "if" }];
      const placeholder = document.createComment(` ${appConfig.prefix}if-chain `);
      const anchorEl = branchList[0].el || el;
      if (anchorEl.parentNode) {
        anchorEl.parentNode.insertBefore(placeholder, anchorEl);
      }
      branchList.forEach((b) => {
        if (b.el && b.el.parentNode) {
          b.el.remove();
        }
      });
      let currentBranchIndex = -1;
      let activeNodes = [];
      let initialRan = false;
      const e = effect(() => {
        let matchedIndex = -1;
        for (let i = 0; i < branchList.length; i++) {
          const b = branchList[i];
          if (b.type === "else") {
            matchedIndex = i;
            break;
          }
          const isTrue = resolveExpression(b.exp, ctx, { asBoolean: true, fallback: false, contextName: `${appConfig.prefix}${b.type}` });
          if (isTrue) {
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex !== currentBranchIndex) {
          const exitingNodes = [...activeNodes];
          activeNodes = [];
          currentBranchIndex = matchedIndex;
          if (exitingNodes.length > 0) {
            exitingNodes.forEach((n) => {
              const transConfig = n.__hx_transition_config || resolveTransitionConfig(n, appConfig);
              if (transConfig && initialRan) {
                leave(n, transConfig, ({ cancelled } = {}) => {
                  destroyNode(n);
                });
              } else {
                destroyNode(n);
              }
            });
          }
          if (matchedIndex >= 0) {
            const template = branchList[matchedIndex].el;
            if (template.tagName === "TEMPLATE" && template.content) {
              const clone = template.content.cloneNode(true);
              activeNodes = Array.from(clone.childNodes);
              if (placeholder.parentNode)
                placeholder.parentNode.insertBefore(clone, placeholder);
              activeNodes.forEach((n) => {
                bindNode2(n, ctx, instance, []);
                const transConfig = n.__hx_transition_config || resolveTransitionConfig(n, appConfig);
                if (transConfig)
                  enter(n, transConfig);
              });
            } else {
              const node = template.cloneNode(true);
              if (placeholder.parentNode)
                placeholder.parentNode.insertBefore(node, placeholder);
              bindNode2(node, ctx, instance, []);
              activeNodes = [node];
              const transConfig = node.__hx_transition_config || resolveTransitionConfig(node, appConfig);
              if (transConfig)
                enter(node, transConfig);
            }
          }
          if (initialRan && instance)
            queueComponentUpdated(instance);
        }
      }, { name: `if: ${val}`, area: "directive" });
      initialRan = true;
      trackCleanup(() => {
        cleanup(e);
        activeNodes.forEach((n) => {
          cancelTransition(n);
          destroyNode(n);
        });
        activeNodes = [];
        if (placeholder.parentNode)
          placeholder.parentNode.removeChild(placeholder);
      });
    }
  };
  dirs.for = {
    selfManaged: true,
    mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
      const forMatch = val.match(/^\s*(?:\(([^)]+)\)|([^\s]+))\s+in\s+(.+)$/);
      if (!forMatch)
        return warn(`[for] Invalid syntax: ${val}`, "compiler");
      const args = forMatch[1] ? forMatch[1].split(",").map((s) => s.trim()).filter(Boolean) : [forMatch[2].trim()];
      const itemName = args[0];
      const keyName = args[1] || null;
      const indexName = args[2] || null;
      const listPath = forMatch[3].trim();
      const keyPath = el.getAttribute(`${appConfig.prefix}key`) || el.getAttribute(":key") || (el.tagName === "TEMPLATE" && el.content && el.content.firstElementChild ? el.content.firstElementChild.getAttribute(`${appConfig.prefix}key`) || el.content.firstElementChild.getAttribute(":key") : null);
      el.removeAttribute(`${appConfig.prefix}key`);
      el.removeAttribute(":key");
      const placeholder = document.createComment(` ${appConfig.prefix}for: ${val} `);
      el.parentNode.insertBefore(placeholder, el);
      el.remove();
      let renderedItems = [];
      const getAnchor = (items, idx) => {
        for (let k = idx; k < items.length; k++) {
          if (items[k] && items[k].nodes) {
            for (let n = 0; n < items[k].nodes.length; n++) {
              if (items[k].nodes[n].parentNode) {
                return items[k].nodes[n];
              }
            }
          }
        }
        return placeholder;
      };
      let isKeyedIteration = false;
      let iterationKeys = [];
      const createItemRecord = (item, index, key) => {
        const itemScope = reactive({ [itemName]: item });
        if (keyName) {
          itemScope[keyName] = isKeyedIteration && iterationKeys[index] !== void 0 ? iterationKeys[index] : index;
        }
        if (indexName) {
          itemScope[indexName] = index;
        }
        const childCtx = Object.setPrototypeOf(itemScope, ctx);
        let nodes;
        if (el.tagName === "TEMPLATE" && el.content) {
          const clone = el.content.cloneNode(true);
          nodes = Array.from(clone.childNodes);
          nodes.forEach((n) => bindNode2(n, childCtx, instance, []));
        } else {
          const node = el.cloneNode(true);
          bindNode2(node, childCtx, instance, []);
          nodes = [node];
        }
        return { key, scope: itemScope, nodes };
      };
      const updateItemScope = (itemRecord, item, index) => {
        itemRecord.scope[itemName] = item;
        if (keyName) {
          itemRecord.scope[keyName] = isKeyedIteration && iterationKeys[index] !== void 0 ? iterationKeys[index] : index;
        }
        if (indexName) {
          itemRecord.scope[indexName] = index;
        }
      };
      const updateFn = () => {
        let list = [];
        isKeyedIteration = false;
        iterationKeys = [];
        const processRawCollection = (raw) => {
          if (Array.isArray(raw)) {
            list = raw;
          } else if (typeof raw === "number") {
            list = Array.from({ length: raw }, (_, i) => i + 1);
          } else if (raw instanceof Map || raw && typeof raw.entries === "function" && typeof raw.get === "function") {
            isKeyedIteration = true;
            const entries = Array.from(raw.entries());
            if (keyName) {
              iterationKeys = entries.map(([k]) => k);
              list = entries.map(([, v]) => v);
            } else {
              iterationKeys = entries.map(([k]) => k);
              list = entries;
            }
          } else if (raw instanceof Set || raw && typeof raw.values === "function" && typeof raw.add === "function") {
            list = Array.from(raw.values());
          } else if (raw && typeof raw === "object") {
            isKeyedIteration = true;
            iterationKeys = Object.keys(raw);
            list = iterationKeys.map((k) => raw[k]);
          }
        };
        if (!isNaN(Number(listPath)) && listPath !== "") {
          const count = parseInt(listPath, 10);
          list = Array.from({ length: count }, (_, i) => i + 1);
        } else {
          const directList = resolvePath(listPath, ctx);
          if (directList !== void 0 && directList !== null) {
            processRawCollection(directList);
          } else if (appConfig.allowInlineExpressions) {
            try {
              const evaluated = new Function("$ctx", `with($ctx) { return ${listPath} }`)(ctx);
              if (evaluated !== void 0 && evaluated !== null) {
                processRawCollection(evaluated);
              }
            } catch (err) {
              handleError(err, `${appConfig.prefix}for expression: ${listPath}`);
            }
          } else {
            warn(`Inline expressions disabled. Use a computed property for complex lists: ${listPath}`, "compiler");
          }
        }
        const usedKeys = /* @__PURE__ */ new Set();
        const newKeys = list.map((item, index) => {
          let key;
          if (keyPath)
            key = getPathParts(keyPath).reduce((acc, part) => acc?.[part], item);
          else if (item && typeof item === "object") {
            key = vForKeyMap.get(item);
            if (!key) {
              key = Symbol("auto-key");
              vForKeyMap.set(item, key);
            }
          } else
            key = item;
          if (usedKeys.has(key)) {
            const newKey = typeof key === "symbol" ? Symbol(`dup-${index}`) : `${String(key)}_dup_${index}`;
            if (item && typeof item === "object" && keyPath) {
              vForKeyMap.set(item, newKey);
            }
            key = newKey;
          }
          usedKeys.add(key);
          return key;
        });
        let oldStart = 0;
        let newStart = 0;
        let oldEnd = renderedItems.length - 1;
        let newEnd = list.length - 1;
        while (oldStart <= oldEnd && newStart <= newEnd && renderedItems[oldStart].key === newKeys[newStart]) {
          updateItemScope(renderedItems[oldStart], list[newStart], newStart);
          oldStart++;
          newStart++;
        }
        while (oldStart <= oldEnd && newStart <= newEnd && renderedItems[oldEnd].key === newKeys[newEnd]) {
          updateItemScope(renderedItems[oldEnd], list[newEnd], newEnd);
          oldEnd--;
          newEnd--;
        }
        const newItems = new Array(list.length);
        for (let i = 0; i < newStart; i++) {
          newItems[i] = renderedItems[i];
        }
        for (let i = newEnd + 1; i < list.length; i++) {
          const oldIndex = oldEnd + 1 + (i - (newEnd + 1));
          newItems[i] = renderedItems[oldIndex];
        }
        const allOldNodes = renderedItems.flatMap((item) => item.nodes || []);
        const oldPositions = initialRan ? recordPositions(allOldNodes) : null;
        const removeRecord = (itemRecord) => {
          if (!itemRecord || !itemRecord.nodes)
            return;
          itemRecord.nodes.forEach((n) => {
            const transConfig = resolveTransitionConfig(n, appConfig);
            if (transConfig && initialRan) {
              leave(n, transConfig, () => destroyNode(n));
            } else {
              destroyNode(n);
            }
          });
        };
        if (oldStart > oldEnd) {
          const anchor = getAnchor(newItems, newEnd + 1);
          const parentNode = placeholder.parentNode;
          for (let i = newStart; i <= newEnd; i++) {
            const itemRecord = createItemRecord(list[i], i, newKeys[i]);
            newItems[i] = itemRecord;
            if (parentNode) {
              for (let k = 0; k < itemRecord.nodes.length; k++) {
                parentNode.insertBefore(itemRecord.nodes[k], anchor);
                const transConfig = resolveTransitionConfig(itemRecord.nodes[k], appConfig);
                if (transConfig && initialRan)
                  enter(itemRecord.nodes[k], transConfig);
              }
            }
          }
        } else if (newStart > newEnd) {
          for (let i = oldStart; i <= oldEnd; i++) {
            removeRecord(renderedItems[i]);
          }
        } else {
          const toBePatched = newEnd - newStart + 1;
          const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
          const keyToNewIndexMap = /* @__PURE__ */ new Map();
          for (let i = newStart; i <= newEnd; i++) {
            keyToNewIndexMap.set(newKeys[i], i);
          }
          let patched = 0;
          let moved = false;
          let maxNewIndexSoFar = 0;
          for (let i = oldStart; i <= oldEnd; i++) {
            const prevItem = renderedItems[i];
            if (patched >= toBePatched) {
              removeRecord(prevItem);
              continue;
            }
            const newIndex = keyToNewIndexMap.get(prevItem.key);
            if (newIndex === void 0) {
              removeRecord(prevItem);
            } else {
              newIndexToOldIndexMap[newIndex - newStart] = i + 1;
              updateItemScope(prevItem, list[newIndex], newIndex);
              newItems[newIndex] = prevItem;
              if (newIndex >= maxNewIndexSoFar) {
                maxNewIndexSoFar = newIndex;
              } else {
                moved = true;
              }
              patched++;
            }
          }
          const lisSequence = moved ? getLIS(newIndexToOldIndexMap) : [];
          let j = lisSequence.length - 1;
          const parentNode = placeholder.parentNode;
          for (let i = toBePatched - 1; i >= 0; i--) {
            const newIndex = newStart + i;
            const anchor = getAnchor(newItems, newIndex + 1);
            if (newIndexToOldIndexMap[i] === 0) {
              const itemRecord = createItemRecord(list[newIndex], newIndex, newKeys[newIndex]);
              newItems[newIndex] = itemRecord;
              if (parentNode) {
                for (let k = 0; k < itemRecord.nodes.length; k++) {
                  parentNode.insertBefore(itemRecord.nodes[k], anchor);
                  const transConfig = resolveTransitionConfig(itemRecord.nodes[k], appConfig);
                  if (transConfig && initialRan)
                    enter(itemRecord.nodes[k], transConfig);
                }
              }
            } else if (moved) {
              if (j < 0 || i !== lisSequence[j]) {
                if (parentNode) {
                  const itemRecord = newItems[newIndex];
                  for (let k = 0; k < itemRecord.nodes.length; k++) {
                    parentNode.insertBefore(itemRecord.nodes[k], anchor);
                  }
                }
              } else {
                j--;
              }
            }
          }
        }
        if (oldPositions && oldPositions.size > 0) {
          const cleanPrefix = appConfig.prefix ? appConfig.prefix.endsWith("-") ? appConfig.prefix.slice(0, -1) : appConfig.prefix : "h";
          applyFlip(oldPositions, `${cleanPrefix}-move`);
        }
        renderedItems = newItems;
        if (initialRan && instance)
          queueComponentUpdated(instance);
      };
      let initialRan = false;
      const e = effect(updateFn, { name: `for: ${listPath}`, area: "directive" });
      initialRan = true;
      const teardown = () => {
        cleanup(e);
        renderedItems.forEach((item) => {
          item.nodes.forEach((n) => destroyNode(n));
        });
        renderedItems = [];
      };
      trackCleanup(teardown);
      placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
      placeholder.__hx_cleanup.push(teardown);
    }
  };
  dirs.teleport = {
    selfManaged: true,
    mounted(el, { value: targetSelector, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
      const placeholder = document.createComment(` ${appConfig.prefix}teleport `);
      const parent = el.parentNode;
      if (parent) {
        parent.insertBefore(placeholder, el);
        el.remove();
      }
      let renderedNodes = [];
      const isTemplate = el.tagName === "TEMPLATE" && el.content;
      if (isTemplate) {
        const clone = el.content.cloneNode(true);
        renderedNodes = Array.from(clone.childNodes);
        renderedNodes.forEach((n) => bindNode2(n, ctx, instance, []));
      } else {
        bindNode2(el, ctx, instance, []);
        renderedNodes = [el];
      }
      const updatePlacement = () => {
        let resolvedSel = targetSelector;
        if (typeof targetSelector === "string" && targetSelector.trim()) {
          const trimmed = targetSelector.trim();
          if (trimmed.startsWith("#") || trimmed.startsWith(".") || trimmed.startsWith("[") || trimmed === "body" || trimmed === "head") {
            resolvedSel = trimmed;
          } else {
            try {
              const evalVal = resolveExpression(trimmed, ctx, { fallback: trimmed, contextName: "hx-teleport" });
              if (evalVal !== void 0 && evalVal !== null && typeof evalVal !== "function") {
                resolvedSel = evalVal;
              }
            } catch {
              resolvedSel = trimmed;
            }
          }
        }
        const target = resolveTeleportTarget(resolvedSel);
        if (target) {
          renderedNodes.forEach((n) => {
            target.appendChild(n);
          });
        } else {
          warn(`[Helix Teleport] Target container "${resolvedSel || targetSelector}" not found in document.`, "teleport");
          if (placeholder && placeholder.parentNode) {
            renderedNodes.forEach((n) => {
              placeholder.parentNode.insertBefore(n, placeholder);
            });
          }
        }
      };
      const e = effect(updatePlacement, { name: `teleport: ${targetSelector}`, area: "directive" });
      let isDestroying = false;
      const teardown = () => {
        if (isDestroying)
          return;
        isDestroying = true;
        cleanup(e);
        const nodesToDestroy = [...renderedNodes];
        renderedNodes = [];
        nodesToDestroy.forEach((n) => {
          destroyNode(n);
        });
        if (placeholder.parentNode)
          placeholder.parentNode.removeChild(placeholder);
      };
      trackCleanup(teardown);
      placeholder.__hx_cleanup = placeholder.__hx_cleanup || [];
      placeholder.__hx_cleanup.push(teardown);
    }
  };
  dirs.transition = {
    mounted(el, { value, modifiers = [] }) {
    }
  };
  dirs.ref.priority = 100;
  dirs.if.priority = 100;
  dirs.teleport.priority = 100;
  dirs.for.priority = 90;
  dirs.transition.priority = 80;
  dirs.model.priority = 50;
  dirs.bind.priority = 10;
  dirs.on.priority = 10;
  dirs.text.priority = 5;
  dirs.html.priority = 5;
  dirs.show.priority = 5;
  return dirs;
}

// packages/core/src/renderer/binder.js
function normalizeDirective(definition) {
  if (typeof definition === "function") {
    return {
      mounted: definition,
      updated: definition
    };
  }
  return definition || {};
}
function createDirectiveHook(dirName, hookName, el, binding, instance, normalized) {
  if (!normalized)
    return null;
  const hookMap = {
    "bind": "beforeMount",
    "inserted": "mounted",
    "update": "beforeUpdate",
    "componentUpdated": "updated",
    "unbind": "unmounted"
  };
  let actualHookName = hookName;
  if (normalized[hookName] === void 0 && hookMap[hookName]) {
    actualHookName = hookMap[hookName];
  }
  const hook = normalized[actualHookName];
  if (typeof hook !== "function")
    return null;
  return () => {
    try {
      hook.call(normalized, el, binding);
    } catch (err) {
      handleError(err, `directive ${dirName} ${hookName}`);
    }
  };
}
var scheduleRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
function ensureCloakStyles(appConfig) {
  if (typeof document === "undefined" || !document.getElementById || !document.createElement || appConfig.autoInjectCloak === false)
    return;
  const rule = `[${appConfig.prefix}cloak] { display: none !important; }`;
  let style = document.getElementById("helix-cloak-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "helix-cloak-style";
    style.textContent = rule;
    if (document.head) {
      document.head.appendChild(style);
    }
  } else if (!style.textContent.includes(`[${appConfig.prefix}cloak]`)) {
    style.textContent += `
${rule}`;
  }
}
function makeBindNode(appContext) {
  const appComponents = appContext.components;
  const appDirectives = appContext.directives;
  const appConfig = appContext.config;
  const builtinDirectives = createBuiltinDirectives(appConfig);
  ensureCloakStyles(appConfig);
  const resolveDirective = (name) => {
    if (appDirectives[name])
      return appDirectives[name];
    if (globalDirectives[name])
      return globalDirectives[name];
    return builtinDirectives[name];
  };
  const resolveComponent = (name) => appComponents[name] || globalComponents[name];
  const globalAPI2 = {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    ref,
    shallowRef,
    triggerRef,
    isRef,
    unref,
    toValue,
    toRef,
    toRefs,
    toRaw,
    markRaw,
    isShallow,
    isProxy,
    customRef,
    computed,
    effect,
    watch,
    watchEffect,
    nextTick,
    onMount,
    onMounted,
    onBeforeMount,
    onDestroy,
    onUnmounted,
    onBeforeUnmount,
    onUpdated,
    provide,
    inject,
    getCurrentInstance: () => currentInstance,
    resolvePath,
    rebind: (node, options) => {
      const binding = node.__hx_binding;
      const instance = options && typeof options === "object" && options.instance || binding && binding.instance;
      if (!instance) {
        logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
        return;
      }
      const ctx = options && typeof options === "object" && ("ctx" in options || "context" in options) ? options.ctx || options.context : options;
      bindNode(node, ctx, instance, [], true);
    }
  };
  function bindNode(node, ctx, instance, cleanupTarget, force = false) {
    if (cleanupTarget === void 0)
      cleanupTarget = instance && instance.cleanups || [];
    if (node.nodeType === 1) {
      if (node.hasAttribute(`${appConfig.prefix}cloak`))
        node.removeAttribute(`${appConfig.prefix}cloak`);
      if (node[BOUND]) {
        if (!force || node.__hx_binding && node.__hx_binding.ctx === ctx)
          return;
        if (node.__hx_binding && node.__hx_binding.cleanups) {
          node.__hx_binding.cleanups.forEach((fn) => {
            try {
              fn();
            } catch (e) {
            }
          });
        }
        node[BOUND] = false;
        node.__hx_static = false;
        node.__hx_patchFlag = 0;
      }
      if (node.__hx_static) {
        node[BOUND] = true;
        Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
        return;
      }
    }
    if (node.nodeType === 3) {
      const delimiters = appConfig.delimiters || ["{{", "}}"];
      if (delimiters && delimiters.length === 2) {
        bindTextInterpolation(node, ctx, instance, delimiters);
      }
      return;
    }
    if (node.nodeType !== 1 || node[BOUND])
      return;
    const tagName = node.tagName.toLowerCase();
    if (tagName === "component" || node.hasAttribute(":is") || node.hasAttribute(`${appConfig.prefix}is`) || tagName === "component" && node.hasAttribute("is")) {
      bindDynamicComponentNode(node, ctx, instance, cleanupTarget, force);
      return;
    }
    const compDef = resolveComponent(tagName);
    if (compDef) {
      bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force);
      return;
    }
    bindElementNode(node, ctx, instance, cleanupTarget, force);
  }
  function bindDynamicComponentNode(node, ctx, instance, cleanupTarget, force) {
    node[BOUND] = true;
    const isAttr = node.getAttribute(":is") || node.getAttribute(`${appConfig.prefix}is`) || node.getAttribute("is");
    node.removeAttribute(":is");
    node.removeAttribute(`${appConfig.prefix}is`);
    node.removeAttribute("is");
    const parent = node.parentNode;
    if (!parent)
      return;
    const doc = node.ownerDocument || (typeof document !== "undefined" ? document : null);
    const placeholder = doc ? doc.createComment(" component-anchor ") : { nodeType: 8, textContent: " component-anchor " };
    parent.insertBefore(placeholder, node);
    parent.removeChild(node);
    const slotChildren = Array.from(node.childNodes || []).map((c) => c.cloneNode(true));
    const originalAttrs = Array.from(node.attributes || []).map((a) => ({ name: a.name, value: a.value }));
    let currentMountedNode = null;
    let currentCleanups = [];
    const teardownCurrent = () => {
      currentCleanups.forEach((fn) => {
        try {
          fn();
        } catch (e2) {
          handleError(e2, "dynamic component cleanup", instance);
        }
      });
      currentCleanups = [];
      if (currentMountedNode) {
        const p = currentMountedNode.parentNode;
        destroyNode(currentMountedNode);
        if (p && currentMountedNode.parentNode === p) {
          p.removeChild(currentMountedNode);
        }
        currentMountedNode = null;
      }
    };
    if (cleanupTarget) {
      cleanupTarget.push(teardownCurrent);
    }
    const e = effect(() => {
      let target = resolveExpression(isAttr, ctx);
      if (isRef(target))
        target = target.value;
      teardownCurrent();
      if (!target)
        return;
      let targetDef = null;
      let targetTagName = "div";
      if (typeof target === "string") {
        const resolved = resolveComponent(target.toLowerCase());
        if (resolved) {
          targetDef = resolved;
          targetTagName = target.toLowerCase();
        } else {
          targetTagName = target.toLowerCase();
        }
      } else if (typeof target === "object" && target !== null) {
        targetDef = target;
        targetTagName = (target.name || "anonymous-component").toLowerCase();
      } else if (typeof target === "function") {
        targetDef = { setup: target };
        targetTagName = "function-component";
      }
      const instanceNode = doc ? doc.createElement(targetTagName) : { nodeType: 1, tagName: targetTagName.toUpperCase() };
      originalAttrs.forEach((attr) => {
        instanceNode.setAttribute(attr.name, attr.value);
      });
      slotChildren.forEach((child) => {
        instanceNode.appendChild(child.cloneNode(true));
      });
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(instanceNode, placeholder);
      }
      currentMountedNode = instanceNode;
      if (targetDef) {
        bindComponentNode(instanceNode, targetDef, targetTagName, ctx, instance, currentCleanups, true);
      } else {
        bindElementNode(instanceNode, ctx, instance, currentCleanups, true);
      }
    }, { name: `dynamic component: ${isAttr}`, area: "component" });
    if (cleanupTarget) {
      cleanupTarget.push(() => cleanup(e));
    }
  }
  function bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force) {
    const normalizeEventName = (name) => name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
    node[BOUND] = true;
    const compDefNormalized = typeof compDef === "function" ? { setup: compDef } : compDef;
    const propsDef = compDefNormalized.props || {};
    const emitsDef = compDefNormalized.emits;
    const propsTarget = {};
    Object.keys(propsDef).forEach((key) => {
      if (propsDef[key].hasOwnProperty("default")) {
        propsTarget[key] = typeof propsDef[key].default === "function" ? propsDef[key].default() : propsDef[key].default;
      }
    });
    const props = new Proxy(propsTarget, {
      get(t, k) {
        track(t, k);
        return Reflect.get(t, k);
      },
      set() {
        warn(`[Helix] Props are read-only.`, "prop");
        return false;
      }
    });
    const scope = new EffectScope();
    const childInst = {
      id: incrementGlobalInstanceId(),
      name: tagName,
      root: node,
      parent: instance,
      provides: instance ? instance.provides : null,
      hooks: {
        mount: [],
        beforeMount: [],
        destroy: [],
        beforeUnmount: [],
        updated: []
      },
      cleanups: [],
      scope
    };
    const childNodes = Array.from(node.childNodes);
    const slotTemplates = [];
    childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        const hasSlotAttr = Array.from(child.attributes || []).some(
          (attr) => parseSlotAttribute(attr.name, appConfig.prefix).isSlot
        );
        if (hasSlotAttr) {
          slotTemplates.push(child);
        }
      }
    });
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
    const slots = createSlots(slotTemplates, ctx, childInst, bindNode, appConfig.prefix);
    const defaultSlotEls = childNodes.filter((child) => {
      if (child.nodeType !== 1)
        return true;
      return !slotTemplates.includes(child);
    });
    if (defaultSlotEls.length > 0 && !slots.default) {
      slots.default = (scopeProps = {}) => {
        const fragment = document.createDocumentFragment();
        defaultSlotEls.forEach((el) => {
          const clone = el.cloneNode(true);
          bindNode(clone, ctx, childInst, void 0, force);
          fragment.appendChild(clone);
        });
        return fragment;
      };
    }
    let isComponentActive = true;
    let hasMounted = false;
    const listeners = /* @__PURE__ */ Object.create(null);
    Array.from(node.attributes || []).forEach((attr) => {
      if (attr.name.startsWith("@") || attr.name.startsWith(`${appConfig.prefix}on:`)) {
        const evtName = normalizeEventName(
          attr.name.replace(/^@/, "").replace(new RegExp(`^${appConfig.prefix}on:`), "")
        );
        const handler = resolvePath(attr.value, ctx);
        if (typeof handler === "function") {
          if (!listeners[evtName])
            listeners[evtName] = [];
          listeners[evtName].push(handler);
        }
      } else {
        let propName = attr.name;
        let isBind = false;
        if (propName.startsWith(":")) {
          isBind = true;
          propName = propName.slice(1);
        } else if (propName.startsWith(`${appConfig.prefix}bind:`)) {
          isBind = true;
          propName = propName.slice(`${appConfig.prefix}bind:`.length);
        }
        if (isBind) {
          const e = effect(() => {
            const rawValue = resolvePath(attr.value, ctx);
            propsTarget[propName] = validateProp(propName, rawValue, propsDef[propName]);
            trigger(propsTarget, propName);
            if (hasMounted && isComponentActive) {
              queueComponentUpdated(childInst);
            }
          }, { name: `bind: ${propName}`, area: "binding" });
          childInst.cleanups.push(() => cleanup(e));
        } else {
          propsTarget[propName] = validateProp(propName, attr.value, propsDef[propName]);
        }
      }
    });
    const emit = (evtName, ...args) => {
      const normalizedName = normalizeEventName(evtName);
      const isValid = validateEmit(normalizedName, args, emitsDef);
      if (!isValid)
        return;
      const handlers = listeners[normalizedName];
      if (handlers)
        for (let i = 0; i < handlers.length; i++)
          handlers[i](...args);
    };
    node.innerHTML = "";
    node.__hx_cleanup = node.__hx_cleanup || [];
    node.__hx_cleanup.push(() => {
      isComponentActive = false;
      hasMounted = false;
      childInst.hooks.beforeUnmount.forEach((fn) => fn());
      childInst.cleanups.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          handleError(e, "component unmount cleanup");
        }
      });
      scope.stop();
      childInst.hooks.destroy.forEach((fn) => fn());
    });
    const prevInstance = currentInstance;
    setCurrentInstance(childInst);
    let childCtx;
    try {
      const baseSetupCtx = {
        ...globalAPI2,
        props,
        emit,
        slots,
        attrs: {},
        root: node,
        app: appConfig
      };
      const setupCtx = getOrCreateAppCtxProxy(baseSetupCtx, appConfig);
      if (typeof compDefNormalized.setup === "function") {
        childCtx = scope.run(() => proxyRefs(compDefNormalized.setup(setupCtx)));
      } else {
        childCtx = baseSetupCtx;
      }
    } catch (err) {
      handleError(err, `<${tagName}> setup`, childInst);
    } finally {
      setCurrentInstance(prevInstance);
    }
    const finishMount = () => {
      childInst.hooks.beforeMount.forEach((fn) => fn(node));
      if (compDefNormalized.template) {
        node.innerHTML = compDefNormalized.template;
        renderSlots(slots, node, ctx, childInst, bindNode);
        Array.from(node.childNodes).forEach((child) => bindNode(child, childCtx, childInst, void 0, true));
      } else if (compDefNormalized.render) {
        const renderResult = compDefNormalized.render(childCtx);
        if (typeof renderResult === "string") {
          node.innerHTML = renderResult;
          renderSlots(slots, node, ctx, childInst, bindNode);
          Array.from(node.childNodes).forEach((child) => bindNode(child, childCtx, childInst, void 0, true));
        }
      } else {
        if (slots.default) {
          const defaultContent = slots.default();
          node.appendChild(defaultContent);
        }
      }
      childInst.hooks.mount.forEach((fn) => fn(node));
      hasMounted = true;
    };
    if (compDefNormalized.async) {
      compDefNormalized.async().then(() => finishMount());
    } else {
      finishMount();
    }
  }
  function bindElementNode(node, ctx, instance, cleanupTarget, force) {
    if (node[BOUND] && !force)
      return;
    const binding = node.__hx_binding ??= {
      cleanups: []
    };
    binding.ctx = ctx;
    binding.instance = instance;
    binding.bindNode = bindNode;
    binding.cleanups.length = 0;
    const trackCleanup = (fn) => {
      if (cleanupTarget) {
        cleanupTarget.push(fn);
      }
      if (node.__hx_binding) {
        node.__hx_binding.cleanups.push(fn);
      }
      (node.__hx_cleanup = node.__hx_cleanup || []).push(fn);
    };
    if (node.hasAttribute(`${appConfig.prefix}pre`)) {
      node.removeAttribute(`${appConfig.prefix}pre`);
      node[BOUND] = true;
      node.__hx_static = true;
      return;
    }
    if (node.hasAttribute(`${appConfig.prefix}ignore`) || node.hasAttribute(`${appConfig.prefix}static`)) {
      node.removeAttribute(`${appConfig.prefix}ignore`);
      node.removeAttribute(`${appConfig.prefix}static`);
      node[BOUND] = true;
      node.__hx_static = true;
      return;
    }
    if (node.hasAttribute(`${appConfig.prefix}once`)) {
      node.removeAttribute(`${appConfig.prefix}once`);
      const onceScope = new EffectScope();
      onceScope.run(() => {
        bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force);
      });
      onceScope.stop();
      node[BOUND] = true;
      node.__hx_static = true;
      return;
    }
    if (node.hasAttribute(`${appConfig.prefix}memo`)) {
      const memoExp = node.getAttribute(`${appConfig.prefix}memo`);
      node.removeAttribute(`${appConfig.prefix}memo`);
      const templateNodes = Array.from(node.childNodes).map((c) => c.cloneNode(true));
      let prevDeps = null;
      let currentScope = null;
      const updateMemo = () => {
        const currentDeps = resolveExpression(memoExp, ctx, { contextName: "hx-memo" });
        if (Array.isArray(prevDeps) && Array.isArray(currentDeps) && prevDeps.length === currentDeps.length && prevDeps.every((dep, idx) => Object.is(dep, currentDeps[idx]))) {
          return;
        }
        prevDeps = Array.isArray(currentDeps) ? [...currentDeps] : currentDeps;
        if (currentScope)
          currentScope.stop();
        currentScope = new EffectScope();
        currentScope.run(() => {
          while (node.firstChild) {
            node.removeChild(node.firstChild);
          }
          templateNodes.forEach((tplNode) => {
            const cloned = tplNode.cloneNode(true);
            node.appendChild(cloned);
            bindNode(cloned, ctx, instance, cleanupTarget, true);
          });
        });
        currentScope.stop();
      };
      const memoEffect = effect(updateMemo, { name: `memo: ${memoExp}`, area: "directive" });
      trackCleanup(() => {
        cleanup(memoEffect);
        if (currentScope)
          currentScope.stop();
      });
      return;
    }
    bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force);
  }
  function bindElementDirectivesAndChildren(node, ctx, instance, cleanupTarget, force) {
    const trackCleanup = (fn) => {
      if (cleanupTarget) {
        cleanupTarget.push(fn);
      }
      if (node.__hx_binding) {
        node.__hx_binding.cleanups.push(fn);
      }
      (node.__hx_cleanup = node.__hx_cleanup || []).push(fn);
    };
    if (node.hasAttribute(`${appConfig.prefix}teleport`)) {
      const val = node.getAttribute(`${appConfig.prefix}teleport`);
      node.removeAttribute(`${appConfig.prefix}teleport`);
      const dir = resolveDirective("teleport");
      if (dir) {
        const bindingObj = { value: val, ctx, instance, trackCleanup, bindNode };
        const hook = createDirectiveHook("teleport", "mounted", node, bindingObj, instance, normalizeDirective(dir));
        if (hook)
          hook();
      }
      return;
    }
    if (node.hasAttribute(`${appConfig.prefix}for`)) {
      const val = node.getAttribute(`${appConfig.prefix}for`);
      node.removeAttribute(`${appConfig.prefix}for`);
      const dir = resolveDirective("for");
      if (dir) {
        const bindingObj = { value: val, ctx, instance, trackCleanup, bindNode };
        const hook = createDirectiveHook("for", "mounted", node, bindingObj, instance, normalizeDirective(dir));
        if (hook)
          hook();
      }
      return;
    }
    const dynamicDirectives = node.getAttribute(`${appConfig.prefix}directive`);
    if (dynamicDirectives) {
      const dirExpressions = dynamicDirectives.split(";").map((d) => d.trim()).filter(Boolean);
      dirExpressions.forEach((expr) => {
        const [dirName, bindingValueExpr] = expr.split(":").map((s) => s.trim());
        if (dirName && bindingValueExpr) {
          const dir = resolveDirective(dirName);
          if (dir) {
            const val = resolveExpression(bindingValueExpr, ctx);
            const bindingObj = {
              name: dirName,
              value: val,
              ctx,
              instance,
              trackCleanup,
              bindNode
            };
            const hook = createDirectiveHook(dirName, "mounted", node, bindingObj, instance, normalizeDirective(dir));
            if (hook)
              hook();
          }
        }
      });
    }
    if (node.hasAttribute(`${appConfig.prefix}if`)) {
      node[BOUND] = true;
      const ifVal = node.getAttribute(`${appConfig.prefix}if`);
      node.removeAttribute(`${appConfig.prefix}if`);
      const branches = [{ el: node, exp: ifVal, type: "if" }];
      let next = node.nextSibling;
      while (next) {
        if (next.nodeType === 3 && next.textContent.trim() === "") {
          const wsNode = next;
          next = next.nextSibling;
          wsNode.remove();
          continue;
        }
        if (next.nodeType === 8) {
          next = next.nextSibling;
          continue;
        }
        if (next.nodeType === 1) {
          const elseIfVal = next.getAttribute(`${appConfig.prefix}else-if`);
          const hasElse = next.hasAttribute(`${appConfig.prefix}else`);
          if (elseIfVal !== null) {
            next.removeAttribute(`${appConfig.prefix}else-if`);
            next[BOUND] = true;
            branches.push({ el: next, exp: elseIfVal, type: "else-if" });
            next = next.nextSibling;
            continue;
          } else if (hasElse) {
            next.removeAttribute(`${appConfig.prefix}else`);
            next[BOUND] = true;
            branches.push({ el: next, exp: null, type: "else" });
            break;
          }
        }
        break;
      }
      const dir = resolveDirective("if");
      if (dir) {
        const bindingObj = { value: ifVal, branches, ctx, instance, trackCleanup, bindNode };
        const hook = createDirectiveHook("if", "mounted", node, bindingObj, instance, normalizeDirective(dir));
        if (hook)
          hook();
      }
      return;
    }
    if (node.hasAttribute(`${appConfig.prefix}else-if`) || node.hasAttribute(`${appConfig.prefix}else`)) {
      warn(`[Helix \u{1F6E0}\uFE0F] ${appConfig.prefix}else / ${appConfig.prefix}else-if used without preceding ${appConfig.prefix}if.`, "directive");
      node.removeAttribute(`${appConfig.prefix}else-if`);
      node.removeAttribute(`${appConfig.prefix}else`);
    }
    let hasDynamicAttr = false;
    const attrs = node.attributes;
    if (attrs) {
      for (let i = 0; i < attrs.length; i++) {
        const name = attrs[i].name;
        if (name.startsWith(appConfig.prefix) || name.startsWith(":") || name.startsWith("@") || name === "ref" || name.startsWith("ref:") || name.startsWith("ref.")) {
          hasDynamicAttr = true;
          break;
        }
      }
    }
    if (!hasDynamicAttr) {
      node[BOUND] = true;
      node.__hx_static = true;
      if (node.nodeType === 1 && !staticNodeCache.has(node)) {
        staticNodeCache.set(node, node.cloneNode(true));
      }
      Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
      return;
    }
    node[BOUND] = true;
    const attrsBond = Array.from(node.attributes || []);
    const toRemove = [];
    const directiveBindings = [];
    const collectedDirectives = [];
    attrsBond.forEach((attr) => {
      let isDir = false, dirName = "", arg = null, modifiers = [];
      const attrName = attr.name;
      if (attrName === "ref" || attrName.startsWith("ref:") || attrName.startsWith("ref.")) {
        isDir = true;
        dirName = "ref";
        const rest = attrName.replace(/^ref:?/, "");
        const [base, ...mods] = rest.split(".");
        arg = base || null;
        modifiers = mods.map((m) => m.toLowerCase());
      } else if (attrName.startsWith(appConfig.prefix)) {
        isDir = true;
        const rawRest = attrName.slice(appConfig.prefix.length);
        const colonIdx = rawRest.indexOf(":");
        let rest;
        if (colonIdx > -1) {
          dirName = rawRest.slice(0, colonIdx).toLowerCase();
          rest = rawRest.slice(colonIdx + 1);
          if (rest.startsWith("[")) {
            const closingIdx = rest.lastIndexOf("]");
            if (closingIdx > -1) {
              arg = rest.slice(0, closingIdx + 1);
              const modsRest = rest.slice(closingIdx + 1);
              modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map((m) => m.toLowerCase()) : [];
            } else {
              arg = rest;
              modifiers = [];
            }
          } else {
            const [base, ...mods] = rest.split(".");
            arg = base || null;
            modifiers = mods.map((m) => m.toLowerCase());
          }
        } else {
          const [base, ...mods] = rawRest.split(".");
          dirName = base.toLowerCase();
          arg = null;
          modifiers = mods.map((m) => m.toLowerCase());
        }
      } else if (attrName.startsWith(":")) {
        isDir = true;
        const rest = attrName.slice(1);
        if (rest === "ref" || rest.startsWith("ref:") || rest.startsWith("ref.")) {
          dirName = "ref";
          const [base, ...mods] = rest.replace(/^ref:?/, "").split(".");
          arg = base || null;
          modifiers = mods.map((m) => m.toLowerCase());
        } else {
          dirName = "bind";
          if (rest.startsWith("[")) {
            const closingIdx = rest.lastIndexOf("]");
            if (closingIdx > -1) {
              arg = rest.slice(0, closingIdx + 1);
              const modsRest = rest.slice(closingIdx + 1);
              modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map((m) => m.toLowerCase()) : [];
            } else {
              arg = rest;
              modifiers = [];
            }
          } else {
            const [base, ...mods] = rest.split(".");
            arg = base || null;
            modifiers = mods.map((m) => m.toLowerCase());
          }
        }
      } else if (attrName.startsWith("@")) {
        isDir = true;
        dirName = "on";
        const rest = attrName.slice(1);
        if (rest.startsWith("[")) {
          const closingIdx = rest.lastIndexOf("]");
          if (closingIdx > -1) {
            arg = rest.slice(0, closingIdx + 1);
            const modsRest = rest.slice(closingIdx + 1);
            modifiers = modsRest.startsWith(".") ? modsRest.slice(1).split(".").filter(Boolean).map((m) => m.toLowerCase()) : [];
          } else {
            arg = rest;
            modifiers = [];
          }
        } else {
          const [base, ...mods] = rest.split(".");
          arg = base || null;
          modifiers = mods.map((m) => m.toLowerCase());
        }
      }
      if (isDir) {
        const dirDef = resolveDirective(dirName);
        if (dirDef) {
          const norm = normalizeDirective(dirDef);
          const priority = norm.priority !== void 0 ? norm.priority : dirDef.priority !== void 0 ? dirDef.priority : 0;
          collectedDirectives.push({ attr, dirName, arg, modifiers, dirDef, priority });
        }
      }
    });
    collectedDirectives.sort((a, b) => b.priority - a.priority);
    collectedDirectives.forEach(({ attr, dirName, arg, modifiers, dirDef }) => {
      const dirCleanups = [];
      try {
        const bindingObj = {
          el: node,
          value: attr.value,
          exp: attr.value,
          arg,
          modifiers,
          ctx,
          instance,
          app: appContext.app,
          rebind: (options) => globalAPI2.rebind(node, options),
          trackCleanup: (fn) => {
            dirCleanups.push(fn);
            trackCleanup(fn);
          },
          cleanup: (fn) => {
            if (fn) {
              dirCleanups.push(fn);
              trackCleanup(fn);
            }
          },
          bindNode,
          dir: dirDef,
          get oldValue() {
            return this._oldValue;
          }
        };
        const mountedHook = createDirectiveHook(dirName, "mounted", node, bindingObj, instance, normalizeDirective(dirDef));
        if (mountedHook) {
          const res = mountedHook();
          if (res instanceof Promise) {
            res.catch((err) => handleError(err, `async directive mounted: ${dirName}`));
          }
        }
        const normalized = normalizeDirective(dirDef);
        if (normalized.updated || normalized.unmounted) {
          directiveBindings.push({ dirName, node, binding: bindingObj, normalized });
        }
        toRemove.push(attr.name);
      } catch (err) {
        logger.error("Directive Error:", err);
        dirCleanups.forEach((fn) => {
          try {
            fn();
          } catch (e) {
          }
        });
      }
    });
    directiveBindings.forEach(({ dirName, node: el, binding: bindingObj, normalized }) => {
      if (!normalized.selfManaged && (normalized.beforeUpdate || normalized.updated)) {
        const updateEffect = effect(() => {
          if (bindingObj.arg)
            resolvePath(bindingObj.value, bindingObj.ctx);
        }, {
          name: `directive update: ${dirName}`,
          area: "directive",
          scheduler: () => {
            bindingObj._oldValue = resolvePath(bindingObj.value, bindingObj.ctx);
            const beforeUpdateHook = createDirectiveHook(dirName, "beforeUpdate", el, bindingObj, instance, normalized);
            if (beforeUpdateHook)
              beforeUpdateHook();
            const updatedHook = createDirectiveHook(dirName, "updated", el, bindingObj, instance, normalized);
            if (updatedHook)
              updatedHook();
            if (instance)
              queueComponentUpdated(instance);
          },
          lazy: false
        });
        trackCleanup(() => cleanup(updateEffect));
      }
      if (normalized.beforeUnmount || normalized.unmounted) {
        trackCleanup(() => {
          const beforeUnmountHook = createDirectiveHook(dirName, "beforeUnmount", el, bindingObj, instance, normalized);
          if (beforeUnmountHook)
            beforeUnmountHook();
          const unmountedHook = createDirectiveHook(dirName, "unmounted", el, bindingObj, instance, normalized);
          if (unmountedHook)
            unmountedHook();
        });
      }
    });
    scheduleRaf(() => {
      if (appConfig.removeAttributeBindings) {
        toRemove.forEach((name) => {
          if (node.hasAttribute(name))
            node.removeAttribute(name);
        });
      }
    });
    Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance, cleanupTarget, force));
  }
  return bindNode;
}

// packages/core/src/app/app.js
function createApp(rootComponent = {}) {
  const appComponents = {};
  const appDirectives = {};
  const appPlugins = [];
  const appProvides = /* @__PURE__ */ Object.create(null);
  let isMounted = false;
  let rootElement = null;
  let rootInstance = null;
  let mountedRootSelector = null;
  let unmountCallbacks = [];
  const appConfig = Object.assign(Object.create(globalConfig), rootComponent.config || {}, rootComponent.prefix ? { prefix: rootComponent.prefix } : {});
  const appContext = {
    config: appConfig,
    components: appComponents,
    directives: appDirectives,
    provides: appProvides,
    app: null
  };
  const bindNode = makeBindNode(appContext);
  const globalAPI2 = {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    ref,
    isRef,
    toRef,
    toRefs,
    computed,
    effect,
    watch,
    watchEffect,
    nextTick,
    onMount,
    onMounted,
    onBeforeMount,
    onDestroy,
    onUnmounted,
    onBeforeUnmount,
    onUpdated,
    provide,
    inject,
    $bus: null,
    resolvePath
  };
  let rootCtx = null;
  const app = {
    version: VERSION,
    config: appConfig,
    $bus: createBus(),
    rebind(node, options) {
      let target = node;
      if (typeof target === "string" && typeof document !== "undefined") {
        target = rootElement && rootElement.querySelector(target) || document.querySelector(target);
      }
      if (target && !target.nodeType && (typeof target.length === "number" || typeof target[Symbol.iterator] === "function")) {
        Array.from(target).forEach((n) => this.rebind(n, options));
        return app;
      }
      if (!target || target.nodeType !== 1)
        return app;
      const binding = target.__hx_binding;
      const instance = options && typeof options === "object" && options.instance || binding && binding.instance || rootInstance;
      let ctx = options && typeof options === "object" && ("ctx" in options || "context" in options) ? options.ctx || options.context : options || binding && binding.ctx || rootCtx;
      if (!ctx)
        ctx = rootCtx;
      if (!instance || !ctx) {
        logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
        return app;
      }
      const activeBindNode = binding && binding.bindNode || bindNode;
      const allElements = [target, ...Array.from(target.querySelectorAll("*"))];
      allElements.forEach((el) => {
        if (el.__hx_binding && el.__hx_binding.cleanups) {
          el.__hx_binding.cleanups.forEach((fn) => {
            try {
              fn();
            } catch (e) {
            }
          });
          el.__hx_binding.cleanups.length = 0;
        }
        if (Array.isArray(el.__hx_cleanup)) {
          el.__hx_cleanup.forEach((fn) => {
            try {
              fn();
            } catch (e) {
            }
          });
          el.__hx_cleanup = null;
        }
        el[BOUND] = false;
        el.__hx_static = false;
        activeBindNode(el, ctx, instance, [], true);
      });
      return app;
    },
    component(name, definition) {
      if (typeof name !== "string") {
        warn(`Component name must be a string.`, "component");
        return app;
      }
      const key = name.toLowerCase();
      if (definition === void 0)
        return appComponents[key];
      appComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
      return app;
    },
    directive(name, definition) {
      if (typeof name !== "string") {
        warn(`Directive name must be a string.`, "directive");
        return app;
      }
      const key = name.toLowerCase();
      if (definition === void 0)
        return appDirectives[key];
      if (typeof definition === "function") {
        appDirectives[key] = {
          mounted: definition,
          updated: definition
        };
      } else {
        appDirectives[key] = definition;
      }
      return app;
    },
    removeDirective(name) {
      if (typeof name !== "string") {
        warn(`Directive name must be a string.`, "directive");
        return app;
      }
      const key = name.toLowerCase();
      delete appDirectives[key];
      return app;
    },
    removeNamespace(name) {
      if (typeof name !== "string") {
        warn(`Namespace name must be a string.`, "namespace");
        return app;
      }
      delete app._namespaces[name];
      return app;
    },
    unuse(plugin) {
      if (!plugin)
        return app;
      const idx = appPlugins.findIndex((p) => p.plugin === plugin || plugin.name && p.name === plugin.name);
      if (idx > -1) {
        const entry = appPlugins[idx];
        if (typeof entry.cleanup === "function") {
          try {
            entry.cleanup();
          } catch (e) {
            handleError(e, `plugin cleanup: ${entry.name || "anonymous"}`);
          }
        }
        appPlugins.splice(idx, 1);
      }
      return app;
    },
    use(plugin, options = {}) {
      if (!plugin)
        return app;
      if (appPlugins.some((p) => p.plugin === plugin))
        return app;
      if (plugin.name) {
        if (appPlugins.some((p) => p.name === plugin.name)) {
          warn(`Plugin "${plugin.name}" is already installed on this app.`, "plugin");
          return app;
        }
        if (plugin.requires && plugin.requires.helix) {
          if (!satisfiesVersion(app.version, plugin.requires.helix)) {
            warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but app version is ${app.version}.`, "plugin");
            return app;
          }
        }
      }
      const rawPluginAPI = {
        config: appConfig,
        component: app.component.bind(app),
        directive: app.directive.bind(app),
        removeDirective: app.removeDirective.bind(app),
        removeNamespace: app.removeNamespace.bind(app),
        provide: app.provide.bind(app),
        use: app.use.bind(app),
        unuse: app.unuse.bind(app),
        mount: app.mount.bind(app),
        unmount: app.unmount.bind(app),
        version: app.version,
        namespace: app.namespace.bind(app),
        registry: app.registry,
        $bus: app.$bus,
        reactive,
        shallowReactive,
        readonly,
        shallowReadonly,
        ref,
        isRef,
        toRef,
        toRefs,
        computed,
        effect,
        watch,
        watchEffect,
        nextTick,
        onMount,
        onMounted,
        onBeforeMount,
        onDestroy,
        onUnmounted,
        onBeforeUnmount,
        onUpdated,
        inject,
        resolvePath
      };
      const pluginAPI = new Proxy(rawPluginAPI, {
        get(target, prop, receiver) {
          if (prop in target)
            return target[prop];
          return app[prop];
        },
        set(target, prop, value, receiver) {
          target[prop] = value;
          app[prop] = value;
          return true;
        },
        deleteProperty(target, prop) {
          delete target[prop];
          delete app[prop];
          return true;
        }
      });
      let cleanup2 = null;
      let installPromise = null;
      const installMethod = typeof plugin.install === "function" ? plugin.install : typeof plugin.setup === "function" ? plugin.setup : typeof plugin === "function" ? plugin : null;
      if (installMethod) {
        try {
          const result = installMethod(pluginAPI, options);
          if (result && typeof result.then === "function") {
            installPromise = result;
          } else if (typeof result === "function") {
            cleanup2 = result;
          }
        } catch (err) {
          handleError(err, `plugin install: ${plugin.name || "anonymous"}`);
        }
      }
      const entry = {
        plugin,
        options,
        name: plugin.name || null,
        version: plugin.version || null,
        cleanup: typeof cleanup2 === "function" ? cleanup2 : null,
        promise: installPromise || null,
        installedAt: Date.now(),
        _executed: true
      };
      appPlugins.push(entry);
      if (installPromise) {
        installPromise.then(() => {
          entry.promise = null;
        }).catch((err) => {
          handleError(err, `async plugin install: ${plugin.name || "anonymous"}`);
          entry.promise = null;
        });
      }
      return app;
    },
    provide(key, value) {
      appProvides[key] = value;
      return app;
    },
    async mount(rootSelector) {
      if (isMounted) {
        warn(`App already mounted. Call unmount() first.`, "core");
        return rootInstance;
      }
      if (typeof document !== "undefined" && document.readyState === "loading") {
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
      }
      mountedRootSelector = typeof rootSelector === "string" ? rootSelector : rootSelector && rootSelector.id ? `#${rootSelector.id}` : "root";
      rootElement = typeof rootSelector === "string" && typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(rootSelector) : rootSelector && rootSelector.nodeType === 1 ? rootSelector : null;
      if (!rootElement) {
        console.warn(`[Helix] mount() failed: no element matches "${rootSelector}"`);
        return null;
      }
      let initialData = {};
      const hxDataAttr = rootElement.getAttribute(`${appConfig.prefix}data`) || rootElement.getAttribute(`data-${appConfig.prefix}data`);
      if (hxDataAttr) {
        try {
          initialData = JSON.parse(hxDataAttr);
        } catch (e) {
          if (appConfig.allowInlineExpressions) {
            try {
              initialData = new Function(`return (${hxDataAttr})`)();
            } catch (err) {
              logger.warn(`Failed to parse ${appConfig.prefix}data attribute: ${hxDataAttr}`, "template");
            }
          } else {
            logger.warn(`Failed to parse JSON in ${appConfig.prefix}data attribute. Inline JS evaluation is disabled (allowInlineExpressions = false).`, "security");
          }
        }
        rootElement.removeAttribute(`${appConfig.prefix}data`);
        rootElement.removeAttribute(`data-${appConfig.prefix}data`);
      }
      const pendingAsync = [...globalPlugins, ...appPlugins].filter((p) => p.promise).map((p) => p.promise);
      if (pendingAsync.length > 0) {
        await Promise.all(pendingAsync);
      }
      const scope = new EffectScope();
      const instance = {
        id: incrementGlobalInstanceId(),
        root: rootElement,
        scope,
        hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
        cleanups: [],
        provides: Object.create(appProvides)
      };
      rootInstance = instance;
      setCurrentInstance(instance);
      const pluginAPI = {
        config: appConfig,
        component: app.component.bind(app),
        directive: app.directive.bind(app),
        provide: app.provide.bind(app),
        use: app.use.bind(app),
        mount: app.mount.bind(app),
        unmount: app.unmount.bind(app),
        runWithContext: app.runWithContext.bind(app),
        version: app.version,
        namespace: app.namespace.bind(app),
        registry: app.registry,
        $bus: app.$bus,
        reactive,
        shallowReactive,
        readonly,
        shallowReadonly,
        ref,
        isRef,
        toRef,
        toRefs,
        computed,
        effect,
        watch,
        watchEffect,
        nextTick,
        onMount,
        onMounted,
        onBeforeMount,
        onDestroy,
        onUnmounted,
        onBeforeUnmount,
        onUpdated,
        inject,
        resolvePath
      };
      [...globalPlugins, ...appPlugins].forEach((p) => {
        if (p._executed)
          return;
        p._executed = true;
        if (typeof p.plugin.install === "function") {
          const result = p.plugin.install(pluginAPI, p.options);
          if (typeof result === "function" && !p.cleanup)
            p.cleanup = result;
        } else if (typeof p.plugin === "function") {
          const result = p(pluginAPI, p.options);
          if (typeof result === "function" && !p.cleanup)
            p.cleanup = result;
        }
      });
      globalAPI2.$bus = app.$bus;
      const baseAppCtx = {
        ...globalAPI2,
        ...pluginAPI,
        directive: app.directive.bind(app),
        watch,
        watchEffect,
        resolvePath,
        reactive,
        shallowReactive,
        readonly,
        shallowReadonly,
        ref,
        isRef,
        toRef,
        toRefs,
        computed,
        effect,
        nextTick,
        onMount,
        onMounted,
        onBeforeMount,
        onDestroy,
        onUnmounted,
        onBeforeUnmount,
        onUpdated,
        provide,
        inject,
        $bus: app.$bus
      };
      const appCtx = new Proxy(baseAppCtx, {
        get(target, prop, receiver) {
          if (prop in target)
            return target[prop];
          if (prop in app)
            return app[prop];
          const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
          if (globalHelix && prop in globalHelix)
            return globalHelix[prop];
          return void 0;
        },
        set(target, prop, value, receiver) {
          target[prop] = value;
          return true;
        },
        has(target, prop) {
          if (prop in target)
            return true;
          if (prop in app)
            return true;
          const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
          if (globalHelix && prop in globalHelix)
            return true;
          return false;
        },
        ownKeys(target) {
          const keys = new Set(Reflect.ownKeys(target));
          Reflect.ownKeys(app).forEach((k) => keys.add(k));
          const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
          if (globalHelix) {
            Reflect.ownKeys(globalHelix).forEach((k) => keys.add(k));
          }
          return Array.from(keys);
        },
        getOwnPropertyDescriptor(target, prop) {
          const desc = Reflect.getOwnPropertyDescriptor(target, prop);
          if (desc)
            return desc;
          const appDesc = Reflect.getOwnPropertyDescriptor(app, prop);
          if (appDesc)
            return appDesc;
          const globalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || null;
          if (globalHelix) {
            const globalDesc = Reflect.getOwnPropertyDescriptor(globalHelix, prop);
            if (globalDesc)
              return globalDesc;
          }
          return void 0;
        }
      });
      let ctx;
      try {
        ctx = scope.run(() => {
          let res;
          if (typeof rootComponent === "function") {
            res = rootComponent(appCtx);
          } else if (rootComponent.setup) {
            res = rootComponent.setup(appCtx);
          } else if (typeof rootComponent === "object" && Object.keys(rootComponent).length > 0) {
            res = reactive({ ...initialData, ...rootComponent });
          } else {
            res = reactive({ ...initialData });
          }
          if (res && typeof res === "object") {
            if (Object.keys(initialData).length > 0) {
              Object.assign(res, initialData);
            }
            if (!res.$refs)
              res.$refs = {};
          }
          return proxyRefs(res);
        });
      } catch (err) {
        handleError(err, "Root setup");
        setCurrentInstance(null);
        scope.stop();
        return null;
      }
      rootCtx = ctx;
      setCurrentInstance(null);
      globalApps.register(rootSelector, rootElement, instance, app);
      if (rootElement.hasAttribute(`${appConfig.prefix}cloak`))
        rootElement.removeAttribute(`${appConfig.prefix}cloak`);
      rootElement.querySelectorAll?.(`[${appConfig.prefix}cloak]`)?.forEach((el) => {
        el.removeAttribute(`${appConfig.prefix}cloak`);
      });
      trace("Initial Mount Binding", () => bindNode(rootElement, ctx, instance));
      instance.hooks.beforeMount.forEach((fn) => fn());
      instance.hooks.mount.forEach((fn) => fn());
      isMounted = true;
      return instance;
    },
    unmount() {
      if (!isMounted || !rootElement) {
        warn(`App is not mounted.`, "core");
        return app;
      }
      if (rootInstance) {
        rootInstance.hooks.beforeUnmount.forEach((fn) => fn());
        rootInstance.cleanups.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            handleError(e, "app unmount cleanup");
          }
        });
        if (rootInstance.scope) {
          rootInstance.scope.stop();
        }
        rootInstance.hooks.destroy.forEach((fn) => fn());
        rootInstance.hooks.unmounted.forEach((fn) => fn());
      }
      globalApps.unregister(mountedRootSelector, rootElement, rootInstance);
      [...appPlugins].reverse().forEach((p) => {
        if (typeof p.cleanup === "function") {
          try {
            p.cleanup();
          } catch (e) {
            handleError(e, `plugin cleanup: ${p.name || "anonymous"}`);
          }
        }
      });
      Array.from(rootElement.childNodes).forEach((child) => destroyNode(child));
      if (rootElement.__hx_cleanup) {
        rootElement.__hx_cleanup.forEach((fn) => fn());
        rootElement.__hx_cleanup = null;
      }
      rootElement[BOUND] = false;
      unmountCallbacks.forEach((fn) => fn());
      isMounted = false;
      rootInstance = null;
      return app;
    },
    onAppUnmount(callback) {
      if (typeof callback === "function")
        unmountCallbacks.push(callback);
      return app;
    },
    registry: {
      list() {
        return appPlugins.map((p) => ({
          name: p.name,
          version: p.version,
          installedAt: p.installedAt || null,
          async: !!p.promise,
          hasCleanup: !!p.cleanup
        }));
      },
      has(name) {
        return appPlugins.some((p) => p.name === name);
      },
      get(name) {
        const p = appPlugins.find((p2) => p2.name === name);
        if (!p)
          return null;
        return {
          name: p.name,
          version: p.version,
          options: p.options,
          installedAt: p.installedAt || null,
          async: !!p.promise,
          hasCleanup: !!p.cleanup
        };
      },
      dependsOn(pluginName, dependencyName) {
        const p = appPlugins.find((p2) => p2.name === pluginName);
        if (!p || !p.plugin || !p.plugin.requires)
          return false;
        const req = p.plugin.requires;
        if (req[dependencyName]) {
          const dep = appPlugins.find((d) => d.name === dependencyName);
          if (!dep)
            return false;
          return satisfiesVersion(dep.version || "0.0.0", req[dependencyName]);
        }
        return false;
      },
      count() {
        return appPlugins.length;
      }
    },
    _namespaces: /* @__PURE__ */ Object.create(null),
    namespace(name, apis) {
      if (typeof name !== "string") {
        warn(`Namespace name must be a string.`, "namespace");
        return app;
      }
      if (apis === void 0) {
        return app._namespaces[name] || /* @__PURE__ */ Object.create(null);
      }
      if (typeof apis === "object" && apis !== null) {
        if (!app._namespaces[name])
          app._namespaces[name] = /* @__PURE__ */ Object.create(null);
        Object.keys(apis).forEach((key) => {
          if (app._namespaces[name][key] !== void 0) {
            warn(`Namespace "${name}" already has API "${key}". Overwriting.`, "namespace");
          }
          app._namespaces[name][key] = apis[key];
        });
      }
      return app;
    },
    onUnmount(callback) {
      warn(`[Helix] app.onUnmount is deprecated. Use app.onAppUnmount instead.`, "config");
      return app.onAppUnmount(callback);
    },
    runWithContext(fn) {
      const prevInstance = currentInstance;
      const tempInstance = { provides: appProvides, parent: null };
      setCurrentInstance(tempInstance);
      try {
        return fn();
      } finally {
        setCurrentInstance(prevInstance);
      }
    }
  };
  appContext.app = app;
  return app;
}

// packages/core/src/dom/dom.js
function parseAttribute(el, attrName, defaultValue = null) {
  const val = el.getAttribute(attrName);
  if (el.hasAttribute(attrName)) {
    el.removeAttribute(attrName);
  }
  return val !== null ? val : defaultValue;
}
function cleanAttributes(el, names) {
  for (const name of names) {
    if (el.hasAttribute(name)) {
      el.removeAttribute(name);
    }
  }
}

// packages/core/src/dom/index.js
function cleanupNode(node) {
  if (!node)
    return;
  const runCleanups = (n) => {
    if (n.__hx_cleanup) {
      n.__hx_cleanup.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          handleError(e, "Helix.dom.cleanup");
        }
      });
      n.__hx_cleanup = null;
    }
    if (n.__hx_binding && n.__hx_binding.cleanups) {
      n.__hx_binding.cleanups.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          handleError(e, "Helix.dom.binding cleanup");
        }
      });
      n.__hx_binding.cleanups = [];
    }
    if (n.nodeType === 1)
      Array.from(n.childNodes).forEach(runCleanups);
  };
  runCleanups(node);
}
function destroy(node) {
  if (!node)
    return;
  destroyNode(node);
}
function bind(node, ctx, instance, options = {}) {
  if (!node)
    return;
  const binding = node.__hx_binding;
  if (binding && binding.bindNode) {
    binding.bindNode(node, ctx, instance, options.cleanups || [], options.force !== false);
  } else {
    logger.warn("Cannot locate bindNode capability on element.", "dom");
  }
}
function inspect(node) {
  if (!node)
    return null;
  let safeInstance = null;
  if (node.__hx_binding && node.__hx_binding.instance) {
    const inst = node.__hx_binding.instance;
    safeInstance = {
      id: inst.id || null,
      name: inst.name || null,
      hasProvides: !!inst.provides
    };
  }
  return {
    tagName: node.tagName ? node.tagName.toLowerCase() : null,
    id: node.id || null,
    bound: !!node[BOUND],
    patchFlag: node.__hx_patchFlag || 0,
    directives: node.__hx_directives ? Array.from(node.__hx_directives) : [],
    scopeKeys: node.__hx_scope ? Object.keys(node.__hx_scope) : [],
    key: node.__hx_key ?? null,
    hasCleanups: !!(node.__hx_cleanup && node.__hx_cleanup.length) || !!(node.__hx_binding && node.__hx_binding.cleanups && node.__hx_binding.cleanups.length),
    bindingMetadata: node.__hx_binding ? {
      hasCtx: !!node.__hx_binding.ctx,
      instance: safeInstance,
      cleanupCount: node.__hx_binding.cleanups ? node.__hx_binding.cleanups.length : 0
    } : null
  };
}
function findNode(selector, root10 = document) {
  if (typeof selector !== "string")
    return null;
  return root10.querySelector(selector);
}
var domAPI = {
  bind,
  cleanup: cleanupNode,
  destroy,
  inspect,
  findNode,
  parseAttribute,
  cleanAttributes
};

// packages/core/src/reactivity/group.js
var EffectGroup = class {
  constructor(name = "EffectGroup") {
    this.name = name;
    this.effects = /* @__PURE__ */ new Set();
    this.active = true;
    this.paused = false;
  }
  add(effectFn) {
    if (!effectFn)
      return effectFn;
    this.effects.add(effectFn);
    if (this.paused && typeof effectFn.pause === "function") {
      effectFn.pause();
    }
    return effectFn;
  }
  pause() {
    this.paused = true;
    this.effects.forEach((eff) => {
      if (typeof eff.pause === "function")
        eff.pause();
      else
        eff.paused = true;
    });
  }
  resume() {
    this.paused = false;
    this.effects.forEach((eff) => {
      if (typeof eff.resume === "function")
        eff.resume();
      else
        eff.paused = false;
    });
  }
  stop() {
    if (!this.active)
      return;
    this.effects.forEach((eff) => {
      if (typeof eff.stop === "function")
        eff.stop();
      else
        stopEffect(eff);
    });
    this.effects.clear();
    this.active = false;
  }
  clear() {
    this.stop();
    this.active = true;
  }
  get size() {
    return this.effects.size;
  }
};
function createEffectGroup(name) {
  return new EffectGroup(name);
}

// packages/core/src/reactivity/inspector.js
function inspectDeps(effectFn) {
  if (!effectFn || !effectFn.deps)
    return [];
  const results = [];
  effectFn.deps.forEach((depSet) => {
    results.push({
      subscribersCount: depSet.size,
      active: depSet.has(effectFn)
    });
  });
  return results;
}

// packages/core/src/reactivity/scopeScheduler.js
var ScopeScheduler = class {
  constructor() {
    this.controllers = /* @__PURE__ */ new Set();
    this.timer = null;
    this.running = false;
  }
  register(controller) {
    if (!controller)
      return;
    this.controllers.add(controller);
    if (!this.running && this.controllers.size > 0) {
      this.start();
    }
  }
  unregister(controller) {
    if (!controller)
      return;
    this.controllers.delete(controller);
    if (this.controllers.size === 0) {
      this.stop();
    }
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    const tick = () => {
      if (!this.running)
        return;
      this.tick();
      if (this.controllers.size > 0) {
        if (typeof requestAnimationFrame !== "undefined") {
          this.timer = requestAnimationFrame(tick);
        } else {
          this.timer = setTimeout(tick, 16);
        }
      } else {
        this.stop();
      }
    };
    if (typeof requestAnimationFrame !== "undefined") {
      this.timer = requestAnimationFrame(tick);
    } else {
      this.timer = setTimeout(tick, 16);
    }
  }
  stop() {
    this.running = false;
    if (this.timer !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.timer);
      } else {
        clearTimeout(this.timer);
      }
      this.timer = null;
    }
  }
  tick() {
    this.controllers.forEach((controller) => {
      if (controller.dirty && typeof controller.refresh === "function") {
        try {
          controller.refresh();
        } catch (err) {
          handleError(err, "ScopeScheduler tick");
        }
      }
    });
  }
};
var globalScopeScheduler = new ScopeScheduler();

// packages/core/src/reactivity/scope.js
function effectScope(detached = false) {
  const scope = new EffectScope();
  if (!detached && activeScope) {
    if (!activeScope.scopes)
      activeScope.scopes = [];
    activeScope.scopes.push(scope);
  }
  return scope;
}
function getCurrentScope() {
  return activeScope;
}
function onScopeDispose(fn) {
  if (typeof fn !== "function")
    return;
  if (activeScope) {
    if (!activeScope.cleanups)
      activeScope.cleanups = [];
    activeScope.cleanups.push(fn);
  } else if (currentInstance && currentInstance.scope) {
    if (!currentInstance.scope.cleanups)
      currentInstance.scope.cleanups = [];
    currentInstance.scope.cleanups.push(fn);
  } else if (currentInstance && currentInstance.cleanups) {
    currentInstance.cleanups.push(fn);
  } else {
    warn("onScopeDispose() called with no active EffectScope or instance lifecycle.", "scope");
  }
}

// packages/core/src/app/plugin.js
function definePlugin(definition) {
  if (typeof definition === "function") {
    return {
      name: definition.name || "anonymous-plugin",
      install: definition
    };
  }
  if (typeof definition === "object" && definition !== null) {
    if (typeof definition.install !== "function" && typeof definition.setup !== "function") {
      warn("Plugin definition missing 'install' or 'setup' method.", "plugin");
    }
    return definition;
  }
  throw new TypeError("Plugin definition must be a function or an object with an install method.");
}
function validatePluginDependencies(plugin, helixVersion = VERSION) {
  if (!plugin || typeof plugin !== "object" || !plugin.requires)
    return true;
  const req = plugin.requires;
  let valid = true;
  Object.keys(req).forEach((depName) => {
    const expectedRange = req[depName];
    if (depName === "helix" || depName === "helix-core") {
      if (!satisfiesVersion(helixVersion, expectedRange)) {
        warn(`Plugin "${plugin.name}" requires Helix ${expectedRange}, but current version is ${helixVersion}.`, "plugin");
        valid = false;
      }
    } else {
      const installed2 = globalPlugins.find((p) => p.name === depName || p.plugin && p.plugin.name === depName);
      if (!installed2) {
        warn(`Plugin "${plugin.name}" requires missing dependency "${depName}" (${expectedRange}).`, "plugin");
        valid = false;
      } else if (expectedRange && !satisfiesVersion(installed2.version || "0.0.0", expectedRange)) {
        warn(`Plugin "${plugin.name}" requires ${depName} ${expectedRange}, but found ${installed2.version}.`, "plugin");
        valid = false;
      }
    }
  });
  return valid;
}
function triggerPluginLifecycle(hookName, HelixAPI, options = {}) {
  globalPlugins.forEach((entry) => {
    const plugin = entry.plugin;
    if (!plugin || typeof plugin !== "object")
      return;
    const hook = plugin[hookName];
    if (typeof hook === "function") {
      try {
        hook.call(plugin, HelixAPI, entry.options || options);
      } catch (err) {
        handleError(err, `Plugin lifecycle ${hookName}: ${entry.name || "anonymous"}`);
      }
    }
  });
}

// packages/core/src/app/asyncComponent.js
var registeredAsyncComponents = /* @__PURE__ */ new Set();
var memoryCache = /* @__PURE__ */ new Map();
function defineAsyncComponent(source) {
  const options = typeof source === "function" ? { loader: source } : source;
  if (!options || typeof options.loader !== "function") {
    throw new TypeError("defineAsyncComponent requires a loader function.");
  }
  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout,
    retries = 0,
    retryDelay = 1e3,
    cache = true,
    onError: onErrorHandler,
    suspensible = false
  } = options;
  const useCache = cache !== false;
  const cacheKey = options.name || loader.toString();
  let pendingPromise = null;
  const getCached = () => {
    return useCache ? memoryCache.get(cacheKey) || null : null;
  };
  const setCached = (comp) => {
    if (useCache) {
      memoryCache.set(cacheKey, comp);
    }
  };
  const loadWithRetries = (attempt = 0) => {
    return loader().catch((err) => {
      if (typeof onErrorHandler === "function") {
        return new Promise((resolve, reject) => {
          const retry = () => resolve(loadWithRetries(attempt + 1));
          const fail = () => reject(err);
          try {
            onErrorHandler(err, retry, fail, attempt);
          } catch (e) {
            reject(e);
          }
        });
      }
      if (attempt < retries) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(loadWithRetries(attempt + 1)), retryDelay);
        });
      }
      throw err;
    });
  };
  const loadWithTimeout = () => {
    const primaryPromise = loadWithRetries();
    if (!timeout || timeout <= 0)
      return primaryPromise;
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Async component load timed out after ${timeout}ms.`));
      }, timeout);
    });
    return Promise.race([primaryPromise, timeoutPromise]).finally(() => {
      if (timer)
        clearTimeout(timer);
    });
  };
  const load = () => {
    const cached = getCached();
    if (cached)
      return Promise.resolve(cached);
    if (pendingPromise)
      return pendingPromise;
    pendingPromise = loadWithTimeout().then((comp) => {
      const resolved = comp && comp.__esModule ? comp.default : comp;
      setCached(resolved);
      pendingPromise = null;
      return resolved;
    }).catch((err) => {
      pendingPromise = null;
      throw err;
    });
    return pendingPromise;
  };
  const getTemplateFromComponent = (comp, setupCtx) => {
    if (!comp)
      return { template: "" };
    if (typeof comp === "function") {
      const res = comp(setupCtx);
      return typeof res === "object" && res !== null ? res : { template: "" };
    }
    if (typeof comp === "object" && comp !== null) {
      if (typeof comp.setup === "function") {
        const res = comp.setup(setupCtx);
        return typeof res === "object" && res !== null ? res : { template: "" };
      }
      if (comp.template !== void 0)
        return comp;
    }
    return { template: "" };
  };
  const asyncCompHost = {
    name: options.name || "AsyncComponentHost",
    suspensible,
    preload() {
      return load();
    },
    setup(setupCtx) {
      const cached = getCached();
      if (cached) {
        return getTemplateFromComponent(cached, setupCtx);
      }
      const suspenseRegister = suspensible ? inject("__hx_suspense__", null) : null;
      const loadPromise = load();
      if (suspenseRegister) {
        suspenseRegister(loadPromise);
        return loadPromise.then((loadedComp) => getTemplateFromComponent(loadedComp, setupCtx)).catch((err) => errorComponent ? getTemplateFromComponent(errorComponent, setupCtx) : { template: "", error: err });
      }
      if (!loadingComponent && !errorComponent) {
        return loadPromise.then((loadedComp) => getTemplateFromComponent(loadedComp, setupCtx));
      }
      const isImmediateLoading = delay === 0 && loadingComponent;
      const initialLoadingTpl = isImmediateLoading ? getTemplateFromComponent(loadingComponent, setupCtx).template || "" : "";
      const compState = reactive({
        status: isImmediateLoading ? "loading" : "pending",
        template: initialLoadingTpl
      });
      let delayTimer = null;
      if (delay > 0 && loadingComponent) {
        delayTimer = setTimeout(() => {
          if (compState.status === "pending") {
            compState.status = "loading";
            compState.template = getTemplateFromComponent(loadingComponent, setupCtx).template || "";
          }
        }, delay);
      }
      loadPromise.then((loadedComp) => {
        if (delayTimer)
          clearTimeout(delayTimer);
        compState.status = "resolved";
        compState.template = getTemplateFromComponent(loadedComp, setupCtx).template || "";
      }).catch((err) => {
        if (delayTimer)
          clearTimeout(delayTimer);
        compState.status = "error";
        compState.template = errorComponent ? getTemplateFromComponent(errorComponent, setupCtx).template || "" : "";
      });
      return compState;
    }
  };
  registeredAsyncComponents.add(asyncCompHost);
  return asyncCompHost;
}
function preload(components) {
  if (!components)
    return Promise.resolve([]);
  const list = Array.isArray(components) ? components : [components];
  const promises = list.map((comp) => {
    if (comp && typeof comp.preload === "function") {
      return comp.preload();
    }
    return Promise.resolve(comp);
  });
  return Promise.all(promises);
}
function preloadAll() {
  const promises = [];
  registeredAsyncComponents.forEach((comp) => {
    if (typeof comp.preload === "function") {
      promises.push(comp.preload());
    }
  });
  return Promise.all(promises);
}

// packages/core/src/app/errorBoundary.js
function onErrorCaptured(cb) {
  if (!currentInstance) {
    warn("onErrorCaptured() can only be called inside setup().", "component");
    return;
  }
  if (!currentInstance.errorCapturedHooks) {
    currentInstance.errorCapturedHooks = [];
  }
  currentInstance.errorCapturedHooks.push(cb);
}
function createErrorBoundary(fallbackComponent) {
  return {
    name: "ErrorBoundary",
    setup(setupCtx) {
      const hasError = ref(false);
      const capturedError = ref(null);
      onErrorCaptured((err, instance, info) => {
        hasError.value = true;
        capturedError.value = err;
        return false;
      });
      const renderFallback = () => {
        if (!fallbackComponent) {
          return { template: `<div class="hx-error-boundary">An unexpected error occurred.</div>` };
        }
        if (typeof fallbackComponent === "string") {
          return { template: fallbackComponent };
        }
        if (typeof fallbackComponent === "function") {
          const res = fallbackComponent(capturedError.value, setupCtx);
          return typeof res === "object" && res !== null ? res : { template: "" };
        }
        if (typeof fallbackComponent === "object" && fallbackComponent !== null) {
          if (typeof fallbackComponent.setup === "function") {
            const res = fallbackComponent.setup(setupCtx);
            return typeof res === "object" && res !== null ? res : { template: "" };
          }
          if (fallbackComponent.template !== void 0)
            return fallbackComponent;
        }
        return { template: "" };
      };
      const fallbackHtml = computed(() => renderFallback().template);
      const p = globalConfig.prefix || "h-";
      return {
        hasError,
        capturedError,
        fallbackHtml,
        reset() {
          hasError.value = false;
          capturedError.value = null;
        },
        template: `
                    <div class="hx-error-boundary-wrapper">
                        <template ${p}if="hasError">
                            <div ${p}html="fallbackHtml"></div>
                        </template>
                        <template ${p}if="!hasError">
                            <slot></slot>
                        </template>
                    </div>
                `,
        renderFallback
      };
    }
  };
}

// packages/core/src/app/templateRef.js
function useTemplateRef(key) {
  if (!currentInstance) {
    warn("useTemplateRef() can only be used inside setup().", "component");
    return shallowRef(null);
  }
  if (!currentInstance.templateRefs) {
    currentInstance.templateRefs = /* @__PURE__ */ new Map();
  }
  if (currentInstance.templateRefs.has(key)) {
    return currentInstance.templateRefs.get(key);
  }
  const r = shallowRef(null);
  currentInstance.templateRefs.set(key, r);
  return r;
}

// packages/core/src/app/inspector.js
function inspectComponent(instance) {
  if (!instance)
    return null;
  return {
    id: instance.id || null,
    name: instance.name || "Anonymous",
    root: instance.root || null,
    parent: instance.parent ? { id: instance.parent.id, name: instance.parent.name } : null,
    provides: instance.provides ? { ...instance.provides } : {},
    cleanupsCount: instance.cleanups ? instance.cleanups.length : 0,
    hooks: instance.hooks ? {
      beforeMount: instance.hooks.beforeMount ? instance.hooks.beforeMount.length : 0,
      mount: instance.hooks.mount ? instance.hooks.mount.length : 0,
      updated: instance.hooks.updated ? instance.hooks.updated.length : 0,
      beforeUnmount: instance.hooks.beforeUnmount ? instance.hooks.beforeUnmount.length : 0,
      unmounted: instance.hooks.unmounted ? instance.hooks.unmounted.length : 0
    } : {},
    hasScope: !!instance.scope
  };
}

// packages/core/src/renderer/suspense.js
var Suspense = {
  name: "Suspense",
  setup(ctx) {
    const state = reactive({ pending: true, error: null });
    let pendingCount = 0;
    provide("__hx_suspense__", (promise) => {
      pendingCount++;
      state.pending = true;
      Promise.resolve(promise).catch((err) => {
        state.error = err;
      }).finally(() => {
        pendingCount = Math.max(0, pendingCount - 1);
        if (pendingCount === 0)
          state.pending = false;
      });
    });
    const p = globalConfig.prefix || "h-";
    return {
      state,
      template: `
                <div class="helix-suspense">
                    <template ${p}if="state.pending">
                        <slot name="fallback"><div class="suspense-loading">Loading...</div></slot>
                    </template>
                    <template ${p}else-if="state.error">
                        <slot name="error"><div class="suspense-error">{{ state.error.message || state.error }}</div></slot>
                    </template>
                    <template ${p}else>
                        <slot></slot>
                    </template>
                </div>
            `
    };
  }
};

// packages/core/src/renderer/transitionComponent.js
var Transition = {
  name: "Transition",
  props: {
    name: { default: "" },
    enterActiveClass: { default: "" },
    enterFromClass: { default: "" },
    enterToClass: { default: "" },
    leaveActiveClass: { default: "" },
    leaveFromClass: { default: "" },
    leaveToClass: { default: "" },
    mode: { default: "default" },
    appear: { default: false }
  },
  setup(ctx) {
    const transConfig = {
      name: ctx.name || "h",
      enterActiveClass: ctx.enterActiveClass || (ctx.name ? `${ctx.name}-enter-active` : "h-enter-active"),
      enterFromClass: ctx.enterFromClass || (ctx.name ? `${ctx.name}-enter-from` : "h-enter-from"),
      enterToClass: ctx.enterToClass || (ctx.name ? `${ctx.name}-enter-to` : "h-enter-to"),
      leaveActiveClass: ctx.leaveActiveClass || (ctx.name ? `${ctx.name}-leave-active` : "h-leave-active"),
      leaveFromClass: ctx.leaveFromClass || (ctx.name ? `${ctx.name}-leave-from` : "h-leave-from"),
      leaveToClass: ctx.leaveToClass || (ctx.name ? `${ctx.name}-leave-to` : "h-leave-to"),
      mode: ctx.mode || "default"
    };
    onMounted((el) => {
      if (!el)
        return;
      const targetEl = el.nodeType === 1 ? el : el.firstElementChild;
      if (targetEl && targetEl.nodeType === 1) {
        targetEl.__hx_transition_config = transConfig;
        if (ctx.appear) {
          enter(targetEl, transConfig);
        }
      }
    });
    return {
      config: transConfig,
      template: `<slot></slot>`
    };
  }
};
var TransitionGroup = {
  name: "TransitionGroup",
  props: {
    name: { default: "" },
    tag: { default: "div" },
    moveClass: { default: "" },
    enterActiveClass: { default: "" },
    leaveActiveClass: { default: "" }
  },
  setup(ctx) {
    const tag = ctx.tag || "div";
    const name = ctx.name || "h";
    const moveClass = ctx.moveClass || `${name}-move`;
    const transConfig = {
      name,
      moveClass,
      enterActiveClass: ctx.enterActiveClass || `${name}-enter-active`,
      enterFromClass: ctx.enterFromClass || `${name}-enter-from`,
      enterToClass: ctx.enterToClass || `${name}-enter-to`,
      leaveActiveClass: ctx.leaveActiveClass || `${name}-leave-active`,
      leaveFromClass: ctx.leaveFromClass || `${name}-leave-from`,
      leaveToClass: ctx.leaveToClass || `${name}-leave-to`
    };
    let observer = null;
    let prevChildren = [];
    onMounted((container) => {
      if (!container || container.nodeType !== 1)
        return;
      container.__hx_transition_group = transConfig;
      const getValidChildren = () => Array.from(container.children || container.childNodes || []).filter((c) => c.nodeType === 1);
      prevChildren = getValidChildren();
      if (typeof MutationObserver === "function") {
        let prevPositions = recordPositions(prevChildren);
        observer = new MutationObserver((mutations) => {
          const currentChildren = getValidChildren();
          if (prevPositions && prevPositions.size > 0) {
            applyFlip(prevPositions, moveClass);
          }
          mutations.forEach((m) => {
            if (m.type === "childList") {
              m.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                  enter(node, transConfig);
                }
              });
            }
          });
          prevChildren = currentChildren;
          prevPositions = recordPositions(currentChildren);
        });
        observer.observe(container, { childList: true });
      }
    });
    onUnmounted(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    });
    return {
      config: transConfig,
      template: `<${tag} class="helix-transition-group"><slot></slot></${tag}>`
    };
  }
};

// packages/core/src/renderer/customElement.js
function defineCustomElement(ComponentDef = {}, options = {}) {
  const isHTMLElementDefined = typeof HTMLElement !== "undefined";
  const BaseClass = isHTMLElementDefined ? HTMLElement : class {
  };
  const propsDef = ComponentDef.props || {};
  const propNames = Array.isArray(propsDef) ? propsDef : Object.keys(propsDef);
  const attrToPropMap = /* @__PURE__ */ new Map();
  const observedAttrs = propNames.map((prop) => {
    const attr = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
    attrToPropMap.set(attr, prop);
    return attr;
  });
  class HelixCustomElement extends BaseClass {
    static get observedAttributes() {
      return observedAttrs;
    }
    constructor() {
      super();
      this._app = null;
      this._props = reactive({});
      this._container = null;
      this._shadowRoot = null;
      this._isMounted = false;
      this._isConnected = false;
      this._mountToken = 0;
      propNames.forEach((prop) => {
        const def = !Array.isArray(propsDef) ? propsDef[prop] : null;
        const defaultVal = def && typeof def === "object" && "default" in def ? typeof def.default === "function" ? def.default() : def.default : void 0;
        this._props[prop] = defaultVal;
        Object.defineProperty(this, prop, {
          get: () => this._props[prop],
          set: (val) => {
            this._props[prop] = val;
          },
          configurable: true,
          enumerable: true
        });
      });
    }
    connectedCallback() {
      this._isConnected = true;
      const currentToken = ++this._mountToken;
      if (this._isMounted)
        return;
      const useShadow = options.shadow !== false && ComponentDef.shadow !== false;
      if (useShadow && typeof this.attachShadow === "function") {
        if (!this._shadowRoot) {
          this._shadowRoot = this.shadowRoot || this.attachShadow({ mode: "open" });
        }
        if (!this._container) {
          this._container = document.createElement("div");
          this._container.className = "helix-ce-root";
          this._shadowRoot.appendChild(this._container);
          const styles = ComponentDef.styles || options.styles;
          if (styles) {
            const styleArray = Array.isArray(styles) ? styles : [styles];
            styleArray.forEach((css) => {
              const styleEl = document.createElement("style");
              styleEl.textContent = css;
              this._shadowRoot.insertBefore(styleEl, this._container);
            });
          }
        }
      } else {
        this._container = this;
      }
      observedAttrs.forEach((attr) => {
        if (this.hasAttribute(attr)) {
          const prop = attrToPropMap.get(attr);
          this._props[prop] = this._parseAttributeValue(this.getAttribute(attr), prop);
        }
      });
      if (ComponentDef.template && this._container) {
        this._container.innerHTML = ComponentDef.template;
      }
      const self = this;
      this._app = createApp({
        setup(setupCtx) {
          const emit = (evtName, ...args) => {
            const eventDetail = args.length === 1 ? args[0] : args.length > 1 ? args : void 0;
            const customEvt = new CustomEvent(evtName, {
              detail: eventDetail,
              bubbles: true,
              composed: true
            });
            self.dispatchEvent(customEvt);
          };
          const componentCtx = {
            ...setupCtx,
            props: self._props,
            emit
          };
          let userState = {};
          if (typeof ComponentDef.setup === "function") {
            userState = ComponentDef.setup(componentCtx) || {};
          }
          const returnTarget = {
            props: self._props,
            emit,
            ...userState
          };
          return new Proxy(returnTarget, {
            get(target, prop, receiver) {
              if (prop in target)
                return target[prop];
              if (prop in self._props)
                return self._props[prop];
              return void 0;
            },
            set(target, prop, value, receiver) {
              if (prop in self._props) {
                self._props[prop] = value;
                return true;
              }
              target[prop] = value;
              return true;
            },
            has(target, prop) {
              return prop in target || prop in self._props;
            },
            ownKeys(target) {
              const keys = /* @__PURE__ */ new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(self._props)]);
              return Array.from(keys);
            },
            getOwnPropertyDescriptor(target, prop) {
              if (prop in target) {
                return Reflect.getOwnPropertyDescriptor(target, prop);
              }
              if (prop in self._props) {
                return {
                  configurable: true,
                  enumerable: true,
                  value: self._props[prop],
                  writable: true
                };
              }
              return void 0;
            }
          });
        }
      });
      this._app.mount(this._container).then(() => {
        if (!this._isConnected || this._mountToken !== currentToken) {
          if (this._app && typeof this._app.unmount === "function") {
            this._app.unmount();
          } else if (this._container) {
            destroyNode(this._container);
          }
          this._app = null;
          this._isMounted = false;
          return;
        }
        this._isMounted = true;
      }).catch((err) => {
        warn(`[Helix CustomElement] Error mounting <${this.tagName ? this.tagName.toLowerCase() : "custom-element"}>:`, "component", err);
      });
    }
    disconnectedCallback() {
      this._isConnected = false;
      this._mountToken++;
      if (this._app) {
        if (typeof this._app.unmount === "function") {
          this._app.unmount();
        } else if (this._container) {
          destroyNode(this._container);
        }
        this._app = null;
      }
      this._isMounted = false;
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal)
        return;
      const prop = attrToPropMap.get(name);
      if (prop) {
        this._props[prop] = this._parseAttributeValue(newVal, prop);
      }
    }
    _parseAttributeValue(val, prop) {
      if (val === null || val === void 0)
        return val;
      const def = !Array.isArray(propsDef) ? propsDef[prop] : null;
      const expectedType = def && typeof def === "object" ? def.type : def;
      if (expectedType === Boolean || typeof this._props[prop] === "boolean") {
        return val !== "false" && val !== null;
      }
      if (expectedType === Number || typeof this._props[prop] === "number") {
        const parsed = Number(val);
        return isNaN(parsed) ? val : parsed;
      }
      try {
        if (val.startsWith("{") && val.endsWith("}") || val.startsWith("[") && val.endsWith("]")) {
          return JSON.parse(val);
        }
      } catch (e) {
      }
      return val;
    }
  }
  return HelixCustomElement;
}

// packages/core/src/shared/profiler.js
var isProfiling = false;
var profileStartTime = 0;
var profileData = {
  duration: 0,
  effectRuns: 0,
  mountCount: 0,
  updateCount: 0,
  customMetrics: {}
};
function profile(fn) {
  if (typeof fn !== "function")
    return null;
  isProfiling = true;
  profileStartTime = performance.now();
  profileData.effectRuns = 0;
  profileData.mountCount = 0;
  profileData.updateCount = 0;
  profileData.customMetrics = {};
  try {
    return fn();
  } finally {
    profileData.duration = performance.now() - profileStartTime;
    isProfiling = false;
  }
}
function getProfileData() {
  return { ...profileData, customMetrics: { ...profileData.customMetrics } };
}

// packages/core/src/devtools/devtools.js
function initDevtools() {
  if (typeof window === "undefined")
    return devtoolsAPI;
  if (!window.__HELIX_DEVTOOLS__) {
    const listeners = /* @__PURE__ */ new Map();
    window.__HELIX_DEVTOOLS__ = {
      version: VERSION,
      apps: /* @__PURE__ */ new Set(),
      on(event, fn) {
        if (!listeners.has(event))
          listeners.set(event, /* @__PURE__ */ new Set());
        listeners.get(event).add(fn);
      },
      emit(event, payload) {
        const set = listeners.get(event);
        if (set)
          set.forEach((fn) => {
            try {
              fn(payload);
            } catch (e) {
            }
          });
      },
      api: devtoolsAPI
    };
  }
  return window.__HELIX_DEVTOOLS__;
}
function inspectTree(instance) {
  if (!instance)
    return null;
  const treeNode = {
    id: instance.id,
    name: instance.name || "Anonymous",
    hasProvides: !!instance.provides,
    cleanupsCount: instance.cleanups ? instance.cleanups.length : 0,
    children: []
  };
  if (instance.root && instance.root.querySelectorAll) {
    const childEls = instance.root.querySelectorAll("*");
    childEls.forEach((el) => {
      if (el.__hx_binding && el.__hx_binding.instance && el.__hx_binding.instance.parent === instance) {
        const childTree = inspectTree(el.__hx_binding.instance);
        if (childTree && !treeNode.children.some((c) => c.id === childTree.id)) {
          treeNode.children.push(childTree);
        }
      }
    });
  }
  return treeNode;
}
var devtoolsAPI = {
  getScopes() {
    const scopes = [];
    activeEffectRegistry.forEach((eff) => {
      if (eff._scope) {
        scopes.push({
          id: eff._scope.id || 0,
          active: eff._scope.active,
          effectsCount: eff._scope.effects ? eff._scope.effects.length : 0,
          cleanupsCount: eff._scope.cleanups ? eff._scope.cleanups.length : 0
        });
      }
    });
    return scopes;
  },
  getEffects() {
    const list = [];
    activeEffectRegistry.forEach((eff) => {
      list.push({
        id: eff.id,
        name: eff._name || eff.name || "Anonymous Effect",
        priority: eff.priority || 0,
        active: eff.active !== false,
        depsCount: eff.deps ? eff.deps.size : 0
      });
    });
    return list;
  },
  getDependencies(target) {
    if (!target || typeof target !== "object")
      return [];
    const rawTarget = target[RAW] || target;
    const depsMap = targetMap.get(rawTarget);
    if (!depsMap)
      return [];
    const result = [];
    depsMap.forEach((subscribers, key) => {
      result.push({
        key,
        subscribersCount: subscribers ? subscribers.size : 0
      });
    });
    return result;
  },
  getTimings() {
    return getProfileData();
  }
};

// packages/core/src/reactivity/memo.js
function memo(fn, depsOrKeyFn) {
  if (typeof fn !== "function") {
    throw new TypeError("[Helix.memo] First argument must be a function.");
  }
  let value;
  let dirty = true;
  let lastKeys = null;
  const memoRef = {};
  const evaluateKeys = () => {
    if (typeof depsOrKeyFn === "function") {
      try {
        return depsOrKeyFn();
      } catch (e) {
        return null;
      }
    }
    if (Array.isArray(depsOrKeyFn)) {
      return depsOrKeyFn;
    }
    return null;
  };
  const keysChanged = (newKeys) => {
    if (!newKeys || !lastKeys)
      return true;
    if (Array.isArray(newKeys) && Array.isArray(lastKeys)) {
      if (newKeys.length !== lastKeys.length)
        return true;
      for (let i = 0; i < newKeys.length; i++) {
        if (newKeys[i] !== lastKeys[i])
          return true;
      }
      return false;
    }
    return newKeys !== lastKeys;
  };
  const runner = effect(fn, {
    lazy: true,
    area: "memo",
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(memoRef, "value");
      }
    }
  });
  Object.defineProperty(memoRef, "value", {
    get() {
      const currentKeys = evaluateKeys();
      if (dirty || keysChanged(currentKeys)) {
        try {
          value = runner();
          lastKeys = currentKeys;
        } catch (err) {
          handleError(err, "memo getter");
        }
        dirty = false;
      }
      track(memoRef, "value");
      return value;
    }
  });
  memoRef[IS_REF] = true;
  return memoRef;
}

// packages/core/src/app/htmx.js
var htmxListenerAttached = false;
function initHtmxIntegration(Helix2) {
  if (typeof document === "undefined" || typeof window === "undefined")
    return;
  if (htmxListenerAttached)
    return;
  const handleHtmxEvent = (e) => {
    if (!globalConfig.htmxIntegration)
      return;
    const target = e.detail?.target || e.detail?.elt || e.target;
    if (!target || target.nodeType !== 1)
      return;
    if (target.hasAttribute(`${globalConfig.prefix}cloak`))
      target.removeAttribute(`${globalConfig.prefix}cloak`);
    target.querySelectorAll?.(`[${globalConfig.prefix}cloak]`)?.forEach((el) => {
      el.removeAttribute(`${globalConfig.prefix}cloak`);
    });
    if (Helix2 && Helix2.$apps) {
      for (const appEntry of Helix2.$apps.values()) {
        const rootEl = appEntry.rootElement || appEntry.instance && appEntry.instance.root;
        if (rootEl && (rootEl === target || rootEl.contains(target))) {
          try {
            if (typeof appEntry.app?.rebind === "function") {
              appEntry.app.rebind(target);
              return;
            }
          } catch (err) {
            logger.error("Error auto-rebinding HTMX swapped fragment in app:", err);
          }
        }
      }
    }
    if (Helix2 && typeof Helix2.rebind === "function") {
      try {
        Helix2.rebind(target);
      } catch (err) {
      }
    }
  };
  document.addEventListener("htmx:afterSwap", handleHtmxEvent);
  document.addEventListener("htmx:load", handleHtmxEvent);
  document.addEventListener("htmx:afterProcessNode", handleHtmxEvent);
  htmxListenerAttached = true;
}
function enableHtmxIntegration(Helix2) {
  globalConfig.htmxIntegration = true;
  initHtmxIntegration(Helix2);
}

// packages/core/src/index.js
globalComponents["transition"] = Transition;
globalComponents["transitiongroup"] = TransitionGroup;
globalComponents["transition-group"] = TransitionGroup;
globalComponents["teleport"] = Teleport;
var globalNamespaces = /* @__PURE__ */ Object.create(null);
var globalProvides = /* @__PURE__ */ Object.create(null);
function useGlobal(plugin, options = {}) {
  if (!plugin)
    return globalAPI;
  if (globalPlugins.some((p) => p.plugin === plugin))
    return globalAPI;
  if (plugin.name) {
    if (globalPlugins.some((p) => p.name === plugin.name)) {
      warn(`Global plugin "${plugin.name}" is already registered.`, "plugin");
      return globalAPI;
    }
    if (plugin.requires && plugin.requires.helix) {
      if (!satisfiesVersion(globalAPI.version, plugin.requires.helix)) {
        warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but current version is ${globalAPI.version}.`, "plugin");
        return globalAPI;
      }
    }
  }
  let cleanup2 = null;
  const installMethod = typeof plugin.install === "function" ? plugin.install : typeof plugin.setup === "function" ? plugin.setup : typeof plugin === "function" ? plugin : null;
  let installPromise = null;
  if (installMethod) {
    try {
      const result = installMethod(globalAPI, options);
      if (result && typeof result.then === "function") {
        installPromise = result;
      } else if (typeof result === "function") {
        cleanup2 = result;
      }
    } catch (err) {
      handleError(err, `global plugin install: ${plugin.name || "anonymous"}`);
    }
  }
  if (typeof plugin.mounted === "function") {
    try {
      plugin.mounted(globalAPI, options);
    } catch (e) {
      handleError(e, `plugin mounted: ${plugin.name || "anonymous"}`);
    }
  }
  globalPlugins.push({
    plugin,
    options,
    name: plugin.name || null,
    version: plugin.version || null,
    promise: installPromise,
    cleanup: typeof cleanup2 === "function" ? cleanup2 : null,
    installedAt: Date.now(),
    _executed: true
  });
  return globalAPI;
}
function unuseGlobal(plugin) {
  if (!plugin)
    return globalAPI;
  const idx = globalPlugins.findIndex((p) => p.plugin === plugin || plugin.name && p.name === plugin.name);
  if (idx > -1) {
    const entry = globalPlugins[idx];
    if (entry.plugin && typeof entry.plugin.unmount === "function") {
      try {
        entry.plugin.unmount(globalAPI, entry.options);
      } catch (e) {
        handleError(e, `plugin unmount: ${entry.name || "anonymous"}`);
      }
    }
    if (typeof entry.cleanup === "function") {
      try {
        entry.cleanup();
      } catch (e) {
        handleError(e, `global plugin cleanup: ${entry.name || "anonymous"}`);
      }
    }
    if (entry.plugin && typeof entry.plugin.destroy === "function") {
      try {
        entry.plugin.destroy(globalAPI, entry.options);
      } catch (e) {
        handleError(e, `plugin destroy: ${entry.name || "anonymous"}`);
      }
    }
    globalPlugins.splice(idx, 1);
  }
  return globalAPI;
}
function removeDirectiveGlobal(name) {
  if (typeof name !== "string") {
    warn(`Directive name must be a string.`, "directive");
    return globalAPI;
  }
  const key = name.toLowerCase();
  delete globalDirectives[key];
  return globalAPI;
}
function removeNamespaceGlobal(name) {
  if (typeof name !== "string") {
    warn(`Namespace name must be a string.`, "namespace");
    return globalAPI;
  }
  delete globalNamespaces[name];
  return globalAPI;
}
function componentGlobal(name, definition) {
  if (typeof name !== "string") {
    warn(`Component name must be a string.`, "component");
    return globalAPI;
  }
  const key = name.toLowerCase();
  if (definition === void 0)
    return globalComponents[key];
  globalComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
  return globalAPI;
}
function directiveGlobal(name, definition) {
  if (typeof name !== "string") {
    warn(`Directive name must be a string.`, "directive");
    return globalAPI;
  }
  const key = name.toLowerCase();
  if (definition === void 0)
    return globalDirectives[key];
  if (typeof definition === "function") {
    globalDirectives[key] = {
      mounted: definition,
      updated: definition
    };
  } else {
    globalDirectives[key] = definition;
  }
  return globalAPI;
}
function createAndMount(rootSelector, setupFn) {
  const app = createApp({ setup: setupFn });
  return app.mount(rootSelector);
}
function namespaceGlobal(name, apis) {
  if (typeof name !== "string") {
    warn(`Namespace name must be a string.`, "namespace");
    return globalAPI;
  }
  if (apis === void 0) {
    return globalNamespaces[name] || /* @__PURE__ */ Object.create(null);
  }
  if (typeof apis === "object" && apis !== null) {
    if (!globalNamespaces[name])
      globalNamespaces[name] = /* @__PURE__ */ Object.create(null);
    Object.keys(apis).forEach((key) => {
      if (globalNamespaces[name][key] !== void 0) {
        warn(`Namespace "${name}" already has API "${key}". Overwriting.`, "namespace");
      }
      globalNamespaces[name][key] = apis[key];
    });
  }
  return globalAPI;
}
function runWithContextGlobal(fn) {
  const prevInstance = currentInstance;
  const tempInstance = { provides: globalProvides, parent: null };
  setCurrentInstance(tempInstance);
  try {
    return fn();
  } finally {
    setCurrentInstance(prevInstance);
  }
}
var globalBus = createBus();
var globalRegistry = {
  list() {
    return globalPlugins.map((p) => ({
      name: p.name,
      version: p.version,
      installedAt: p.installedAt || null,
      hasCleanup: !!p.cleanup
    }));
  },
  has(name) {
    return globalPlugins.some((p) => p.name === name);
  },
  get(name) {
    const p = globalPlugins.find((p2) => p2.name === name);
    if (!p)
      return null;
    return {
      name: p.name,
      version: p.version,
      installedAt: p.installedAt || null,
      hasCleanup: !!p.cleanup
    };
  },
  dependsOn(pluginName, dependencyName) {
    const p = globalPlugins.find((p2) => p2.name === pluginName);
    if (!p || !p.plugin || !p.plugin.requires)
      return false;
    const req = p.plugin.requires;
    if (req[dependencyName]) {
      const dep = globalPlugins.find((d) => d.name === dependencyName);
      if (!dep)
        return false;
      return satisfiesVersion(dep.version || "0.0.0", req[dependencyName]);
    }
    return false;
  },
  count() {
    return globalPlugins.length;
  }
};
var globalInternal = {
  targetMap,
  reactiveMap,
  readonlyMap,
  globalComponents,
  globalDirectives,
  globalPlugins
};
function rebindGlobal(node, options) {
  if (typeof node === "string") {
    node = document.querySelector(node);
  }
  if (node && !node.nodeType && (typeof node.length === "number" || typeof node[Symbol.iterator] === "function")) {
    Array.from(node).forEach((n) => rebindGlobal(n, options));
    return;
  }
  if (!node || node.nodeType !== 1)
    return;
  let binding = node.__hx_binding;
  let instance = options && typeof options === "object" && options.instance || binding && binding.instance;
  let ctx = options && typeof options === "object" && ("ctx" in options || "context" in options) ? options.ctx || options.context : options;
  if (!instance || !ctx) {
    let curr = node.parentNode;
    while (curr) {
      if (curr.__hx_binding && curr.__hx_binding.instance && curr.__hx_binding.ctx) {
        if (!instance)
          instance = curr.__hx_binding.instance;
        if (!ctx)
          ctx = curr.__hx_binding.ctx;
        if (!binding)
          binding = curr.__hx_binding;
        break;
      }
      curr = curr.parentNode;
    }
  }
  if (!instance || !ctx) {
    for (const appEntry of globalApps.values()) {
      const rootEl = appEntry.rootElement || appEntry.instance && appEntry.instance.root;
      if (rootEl && (rootEl === node || rootEl.contains(node))) {
        instance = appEntry.instance;
        ctx = instance && instance.root && instance.root.__hx_binding && instance.root.__hx_binding.ctx || options;
        break;
      }
    }
  }
  if (!instance || !ctx) {
    logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
    return;
  }
  const activeBindNode = binding && binding.bindNode;
  if (!activeBindNode) {
    logger.warn("Cannot locate bindNode to rebind.", "binding");
    return;
  }
  const allElements = [node, ...Array.from(node.querySelectorAll("*"))];
  allElements.forEach((el) => {
    if (el.__hx_binding && el.__hx_binding.cleanups) {
      el.__hx_binding.cleanups.forEach((fn) => {
        try {
          fn();
        } catch (e) {
        }
      });
      el.__hx_binding.cleanups.length = 0;
    }
    if (Array.isArray(el.__hx_cleanup)) {
      el.__hx_cleanup.forEach((fn) => {
        try {
          fn();
        } catch (e) {
        }
      });
      el.__hx_cleanup = null;
    }
    el[BOUND] = false;
    el.__hx_static = false;
    activeBindNode(el, ctx, instance, [], true);
  });
}
function directivesGlobal(definitions) {
  if (typeof definitions === "object" && definitions !== null) {
    Object.keys(definitions).forEach((name) => {
      directiveGlobal(name, definitions[name]);
    });
  }
  return globalAPI;
}
var globalAPI = {
  createApp,
  create: createApp,
  app: createApp,
  config: globalConfig,
  component: componentGlobal,
  directive: directiveGlobal,
  directives: directivesGlobal,
  removeDirective: removeDirectiveGlobal,
  removeNamespace: removeNamespaceGlobal,
  use: useGlobal,
  rebind: rebindGlobal,
  unuse: unuseGlobal,
  mount: createAndMount,
  version: VERSION,
  namespace: namespaceGlobal,
  runWithContext: runWithContextGlobal,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  ref,
  shallowRef,
  triggerRef,
  isRef,
  unref,
  toValue,
  toRef,
  toRefs,
  proxyRefs,
  toRaw,
  isRaw,
  markRaw,
  isShallow,
  isProxy,
  isReactive,
  isReadonly,
  customRef,
  computed,
  effect,
  watch,
  watchEffect,
  nextTick,
  onMount,
  onMounted,
  onBeforeMount,
  onDestroy,
  onUnmounted,
  onBeforeUnmount,
  onUpdated,
  provide,
  inject,
  getCurrentInstance,
  resolvePath,
  queueJob,
  queuePreFlushCb,
  queuePostFlushCb,
  queueIdleJob,
  EffectScope,
  simpleEffect,
  markTrace,
  measureTrace,
  PatchFlags,
  openBlock,
  closeBlock,
  lazyBind,
  logger,
  dom: domAPI,
  batch,
  effectGroup: createEffectGroup,
  createEffectGroup,
  inspectDeps,
  definePlugin,
  defineAsyncComponent,
  preload,
  preloadAll,
  createErrorBoundary,
  onErrorCaptured,
  useTemplateRef,
  defineCustomElement,
  inspectComponent,
  onError: onErrorGlobal,
  ScopeScheduler,
  scopeScheduler: globalScopeScheduler,
  triggerPluginLifecycle,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  Suspense,
  Transition,
  TransitionGroup,
  Teleport,
  resolveTeleportTarget,
  enter,
  leave,
  cancelTransition,
  cancelFlip,
  getTransitionDurations,
  fireTransitionHook,
  nextFrame,
  resolveTransitionConfig,
  recordPositions,
  applyFlip,
  inspectTree,
  validatePluginDependencies,
  profile,
  getProfileData,
  memo,
  pauseTracking,
  resumeTracking,
  enableTracking,
  resetTracking,
  dispatch,
  id,
  uniqueId,
  enableHtmx: () => enableHtmxIntegration(globalAPI),
  initHtmx: () => initHtmxIntegration(globalAPI),
  devtools: devtoolsAPI,
  _internal: globalInternal,
  $bus: globalBus,
  $apps: globalApps,
  registry: globalRegistry
};
if (typeof window !== "undefined") {
  window.Helix = globalAPI;
  initDevtools();
  initHtmxIntegration(globalAPI);
}

// packages/helix-directives/src/parser.js
function isEscaped(str, index) {
  let count = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (str[i] === "\\") {
      count++;
    } else {
      break;
    }
  }
  return count % 2 !== 0;
}
function splitTopLevel(str) {
  const parts = [];
  let depth = 0, current = "", inQuote = false, quoteChar = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (!inQuote && (ch === '"' || ch === "'" || ch === "`")) {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (inQuote && ch === quoteChar && !isEscaped(str, i)) {
      inQuote = false;
      current += ch;
    } else if (!inQuote && (ch === "(" || ch === "{" || ch === "[")) {
      depth++;
      current += ch;
    } else if (!inQuote && (ch === ")" || ch === "}" || ch === "]")) {
      depth--;
      current += ch;
    } else if (!inQuote && ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim())
    parts.push(current.trim());
  return parts;
}
function parseCall(str) {
  if (!str)
    return null;
  const trimmed = str.trim();
  const parenIdx = trimmed.indexOf("(");
  if (parenIdx > -1 && trimmed.endsWith(")")) {
    const fnPath = trimmed.slice(0, parenIdx).trim();
    const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();
    return { fnPath, args: argsStr ? splitTopLevel(argsStr) : [] };
  }
  return { fnPath: trimmed, args: [] };
}
function resolvePath2(app, ctx, path, fallback) {
  if (!path)
    return fallback;
  if (typeof path !== "string")
    return path;
  if (app && typeof app.resolvePath === "function") {
    try {
      const res = app.resolvePath(path, ctx);
      if (res !== void 0)
        return res;
    } catch (e) {
    }
  }
  const parts = path.replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1").split(".").filter(Boolean);
  let val = ctx;
  for (const p of parts) {
    if (val == null)
      return fallback;
    val = val[p];
    if (app && typeof app.isRef === "function" && app.isRef(val)) {
      val = val.value;
    }
  }
  return val !== void 0 ? val : fallback;
}
function resolveBool(app, ctx, path) {
  return !!resolvePath2(app, ctx, path, false);
}
function evaluateArgs(app, ctx, argList, extra = {}) {
  return argList.map((a) => {
    if (a === "$event")
      return extra.event;
    if (a.startsWith("$event.")) {
      const eventPath = a.slice(7);
      const parts = eventPath.replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1").split(".").filter(Boolean);
      let val = extra.event;
      for (const p of parts) {
        if (val == null)
          break;
        val = val[p];
      }
      if (val !== void 0)
        return val;
    }
    const resolved = resolvePath2(app, ctx, a);
    if (resolved !== void 0)
      return resolved;
    try {
      return JSON.parse(a);
    } catch {
    }
    if (a.startsWith('"') && a.endsWith('"') || a.startsWith("'") && a.endsWith("'")) {
      return a.slice(1, -1);
    }
    return a;
  });
}

// packages/helix-directives/src/constants.js
var DEBOUNCE_DEFAULT_EVENT = "input";
var DEBOUNCE_DEFAULT_DELAY = 300;

// packages/helix-directives/src/directives/debounce.js
function parseDebounceValue(raw) {
  let expression = raw;
  let delay = DEBOUNCE_DEFAULT_DELAY;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1);
    const parts = splitTopLevel(inner);
    if (parts.length === 2) {
      const secondPart = parts[1].trim();
      if (/^\d+$/.test(secondPart) || !secondPart.includes("(") && !secondPart.includes(")")) {
        expression = parts[0];
        delay = secondPart;
      } else {
        expression = inner.trim();
      }
    } else {
      expression = inner.trim();
    }
  }
  expression = expression.trim();
  if (expression.startsWith("'") && expression.endsWith("'") || expression.startsWith('"') && expression.endsWith('"') || expression.startsWith("`") && expression.endsWith("`")) {
    expression = expression.slice(1, -1);
  }
  return { expression, delay };
}
var debounceStates = /* @__PURE__ */ new WeakMap();
function createDebounceDirective(app, config = {}) {
  const debug = !!config.debug;
  const log = (...args) => {
    if (debug)
      console.log("[directives] [debounce]", ...args);
  };
  return {
    mounted(el, binding) {
      const { value, arg, ctx, trackCleanup } = binding;
      const evtType = arg || DEBOUNCE_DEFAULT_EVENT;
      const raw = (typeof value === "string" ? value : String(value ?? "")).trim();
      const { expression, delay } = parseDebounceValue(raw);
      const callData = parseCall(expression);
      log("mounted", { el, evtType, raw, expression, delay, fnPath: callData?.fnPath, args: callData?.args });
      const state = {
        evtType,
        delay,
        callData,
        expression,
        ctx,
        timeout: null,
        handler: null
      };
      debounceStates.set(el, state);
      state.handler = (e) => {
        let delayVal = DEBOUNCE_DEFAULT_DELAY;
        if (typeof state.delay === "number") {
          delayVal = state.delay;
        } else if (typeof state.delay === "string") {
          if (/^\d+$/.test(state.delay)) {
            delayVal = parseInt(state.delay, 10);
          } else {
            const resolvedDelay = resolvePath2(app, state.ctx, state.delay);
            if (typeof resolvedDelay === "number") {
              delayVal = resolvedDelay;
            } else if (resolvedDelay !== void 0) {
              delayVal = parseInt(resolvedDelay, 10) || DEBOUNCE_DEFAULT_DELAY;
            }
          }
        }
        log("event fired:", state.evtType, "\u2014 waiting", delayVal, "ms");
        clearTimeout(state.timeout);
        state.timeout = setTimeout(() => {
          state.timeout = null;
          if (!state.callData) {
            log("no callData parsed from expression \u2014 nothing to run");
            return;
          }
          const fn = resolvePath2(app, state.ctx, state.callData.fnPath);
          log("resolved", JSON.stringify(state.callData.fnPath), "->", typeof fn, fn);
          if (typeof fn === "function") {
            const argsToPass = state.callData.args.length > 0 ? evaluateArgs(app, state.ctx, state.callData.args, { event: e }) : [e];
            log("calling with args:", argsToPass);
            fn.apply(state.ctx, argsToPass);
          } else if (app && app.config && app.config.allowInlineExpressions) {
            try {
              new Function("$ctx", "$event", `with($ctx) { ${state.expression} }`)(state.ctx, e);
            } catch (err) {
              console.error(`[directives] [debounce] Error running inline expression:`, err);
            }
          } else {
            console.warn(`[directives] [debounce] Cannot resolve function "${state.callData.fnPath}" on context.`, { ctx: state.ctx });
          }
        }, delayVal);
      };
      el.addEventListener(evtType, state.handler);
      if (typeof trackCleanup === "function") {
        trackCleanup(() => {
          log("cleanup \u2014 removing listener", state.evtType);
          el.removeEventListener(state.evtType, state.handler);
          clearTimeout(state.timeout);
          debounceStates.delete(el);
        });
      }
    },
    updated(el, binding) {
      const state = debounceStates.get(el);
      if (!state)
        return;
      clearTimeout(state.timeout);
      state.timeout = null;
      const { value, arg, ctx } = binding;
      const newEvtType = arg || DEBOUNCE_DEFAULT_EVENT;
      const raw = (typeof value === "string" ? value : String(value ?? "")).trim();
      const { expression, delay } = parseDebounceValue(raw);
      const callData = parseCall(expression);
      state.delay = delay;
      state.callData = callData;
      state.expression = expression;
      state.ctx = ctx;
      if (newEvtType !== state.evtType) {
        log("event type updated from", state.evtType, "to", newEvtType);
        el.removeEventListener(state.evtType, state.handler);
        state.evtType = newEvtType;
        el.addEventListener(state.evtType, state.handler);
      }
    }
  };
}

// packages/helix-directives/src/directives/collapse.js
function parseDuration(modifiers) {
  let duration = 300;
  const durMod = modifiers.find((m) => m === "duration" || m.startsWith("duration"));
  if (durMod) {
    let valStr = null;
    if (durMod.includes(".") || durMod.includes("-")) {
      valStr = durMod.split(/[-.]/)[1];
    } else {
      const idx = modifiers.indexOf(durMod);
      valStr = modifiers[idx + 1];
    }
    if (valStr) {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed))
        duration = parsed;
    }
  } else {
    const directMs = modifiers.find((m) => /^\d+(ms)?$/.test(m));
    if (directMs) {
      const parsed = parseInt(directMs, 10);
      if (!isNaN(parsed))
        duration = parsed;
    }
  }
  return duration;
}
function parseMinHeight(modifiers) {
  let minHeight = 0;
  const minMod = modifiers.find((m) => m === "min" || m.startsWith("min"));
  if (minMod) {
    let valStr = null;
    if (minMod.includes(".") || minMod.includes("-")) {
      valStr = minMod.split(/[-.]/)[1];
    } else {
      const idx = modifiers.indexOf(minMod);
      valStr = modifiers[idx + 1];
    }
    if (valStr) {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed))
        minHeight = parsed;
    }
  }
  return minHeight;
}
var collapseStates = /* @__PURE__ */ new WeakMap();
function createCollapseDirective(app, config = {}) {
  const debug = !!config.debug;
  const log = (...args) => {
    if (debug)
      console.log("[directives] [collapse]", ...args);
  };
  return {
    mounted(el, binding) {
      const { value, modifiers = [], ctx, trackCleanup } = binding;
      const duration = parseDuration(modifiers);
      const minHeight = parseMinHeight(modifiers);
      const originalStyles = {
        transitionProperty: el.style.transitionProperty || "",
        transitionDuration: el.style.transitionDuration || "",
        transitionTimingFunction: el.style.transitionTimingFunction || "",
        height: el.style.height || "",
        overflow: el.style.overflow || "",
        display: el.style.display || ""
      };
      el.style.transitionProperty = "height";
      el.style.transitionDuration = `${duration}ms`;
      el.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.2, 1)";
      const state = {
        value,
        modifiers,
        ctx,
        duration,
        minHeight,
        isExpanded: null,
        timer: null,
        frame: null,
        originalStyles,
        trigger: null
      };
      collapseStates.set(el, state);
      const cancelPendingFrame = () => {
        if (state.frame != null) {
          if (typeof cancelAnimationFrame === "function")
            cancelAnimationFrame(state.frame);
          else
            clearTimeout(state.frame);
          state.frame = null;
        }
      };
      const scheduleNextFrame = (fn) => {
        cancelPendingFrame();
        if (typeof requestAnimationFrame === "function") {
          state.frame = requestAnimationFrame(() => {
            state.frame = null;
            fn();
          });
        } else {
          state.frame = setTimeout(() => {
            state.frame = null;
            fn();
          }, 16);
        }
      };
      const expand = () => {
        clearTimeout(state.timer);
        cancelPendingFrame();
        el.style.display = "";
        el.style.overflow = "hidden";
        el.style.height = `${state.minHeight}px`;
        const fullHeight = Math.max(el.scrollHeight, state.minHeight);
        scheduleNextFrame(() => {
          el.style.height = `${fullHeight}px`;
          state.timer = setTimeout(() => {
            el.style.height = "";
            el.style.overflow = "";
            log("expanded fully, cleared fixed height");
          }, state.duration);
        });
      };
      const collapse = () => {
        clearTimeout(state.timer);
        cancelPendingFrame();
        const currentHeight = el.scrollHeight;
        el.style.height = `${currentHeight}px`;
        el.style.overflow = "hidden";
        scheduleNextFrame(() => {
          el.style.height = `${state.minHeight}px`;
          state.timer = setTimeout(() => {
            if (state.minHeight === 0) {
              el.style.display = "none";
            }
            log("collapsed to minHeight:", state.minHeight);
          }, state.duration);
        });
      };
      const effectFn = () => {
        let shouldShow = true;
        if (state.value !== void 0 && state.value !== null && state.value !== "") {
          shouldShow = resolveBool(app, state.ctx, state.value);
        } else if (el.style.display === "none") {
          shouldShow = false;
        }
        if (shouldShow === state.isExpanded)
          return;
        const wasInitial = state.isExpanded === null;
        state.isExpanded = shouldShow;
        if (wasInitial) {
          if (!shouldShow) {
            el.style.height = `${state.minHeight}px`;
            el.style.overflow = "hidden";
            if (state.minHeight === 0)
              el.style.display = "none";
          }
        } else {
          if (shouldShow)
            expand();
          else
            collapse();
        }
      };
      state.trigger = effectFn;
      let effectCleanup = null;
      if (app && typeof app.effect === "function") {
        const eff = app.effect(effectFn, { name: "collapse", area: "directive" });
        effectCleanup = () => {
          if (app.cleanup)
            app.cleanup(eff);
          else if (eff.stop)
            eff.stop();
        };
      } else {
        effectFn();
      }
      if (typeof trackCleanup === "function") {
        trackCleanup(() => {
          clearTimeout(state.timer);
          cancelPendingFrame();
          if (effectCleanup)
            effectCleanup();
          el.style.transitionProperty = originalStyles.transitionProperty;
          el.style.transitionDuration = originalStyles.transitionDuration;
          el.style.transitionTimingFunction = originalStyles.transitionTimingFunction;
          el.style.height = originalStyles.height;
          el.style.overflow = originalStyles.overflow;
          el.style.display = originalStyles.display;
          collapseStates.delete(el);
        });
      }
    },
    updated(el, binding) {
      const state = collapseStates.get(el);
      if (!state)
        return;
      const { value, modifiers = [], ctx } = binding;
      state.value = value;
      state.modifiers = modifiers;
      state.ctx = ctx;
      state.duration = parseDuration(modifiers);
      state.minHeight = parseMinHeight(modifiers);
      el.style.transitionDuration = `${state.duration}ms`;
      if (typeof state.trigger === "function") {
        state.trigger();
      }
    }
  };
}

// packages/helix-directives/src/directives/trap.js
var FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== "function")
    return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });
}
var bodyScrollLockCount = 0;
var originalBodyOverflow = "";
function lockBodyScroll() {
  if (typeof document === "undefined" || !document.body)
    return;
  if (bodyScrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount++;
}
function unlockBodyScroll() {
  if (typeof document === "undefined" || !document.body)
    return;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}
var inertOwnersMap = /* @__PURE__ */ new Map();
var originalElementInertMap = /* @__PURE__ */ new Map();
var trapInstanceCounter = 0;
function getElementsOutside(container) {
  const outside = /* @__PURE__ */ new Set();
  if (!container || typeof document === "undefined" || !document.body)
    return outside;
  if (!document.body.contains(container)) {
    return outside;
  }
  const ancestors = /* @__PURE__ */ new Set();
  let p = container;
  while (p) {
    ancestors.add(p);
    p = p.parentNode;
  }
  let curr = container;
  while (curr && curr !== document.body && curr.parentNode) {
    const parent = curr.parentNode;
    const siblings = Array.from(parent.children || parent.childNodes || []).filter((n) => n.nodeType === 1);
    for (const sibling of siblings) {
      if (!ancestors.has(sibling) && !sibling.contains(container) && sibling.tagName !== "SCRIPT" && sibling.tagName !== "STYLE") {
        outside.add(sibling);
      }
    }
    curr = parent;
  }
  if (document.body) {
    Array.from(document.body.children || []).forEach((child) => {
      if (!ancestors.has(child) && !child.contains(container) && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") {
        outside.add(child);
      }
    });
  }
  return outside;
}
function applyInertOutside(container, trapId) {
  const outsideElements = getElementsOutside(container);
  const lockedElements = [];
  outsideElements.forEach((el) => {
    let owners = inertOwnersMap.get(el);
    if (!owners) {
      owners = /* @__PURE__ */ new Set();
      inertOwnersMap.set(el, owners);
      originalElementInertMap.set(el, {
        inert: el.inert,
        ariaHidden: el.getAttribute ? el.getAttribute("aria-hidden") : null
      });
    }
    owners.add(trapId);
    el.inert = true;
    if (typeof el.setAttribute === "function")
      el.setAttribute("aria-hidden", "true");
    lockedElements.push(el);
  });
  return () => {
    lockedElements.forEach((el) => {
      const owners = inertOwnersMap.get(el);
      if (owners) {
        owners.delete(trapId);
        if (owners.size === 0) {
          inertOwnersMap.delete(el);
          const orig = originalElementInertMap.get(el);
          originalElementInertMap.delete(el);
          if (orig) {
            if (orig.inert !== void 0)
              el.inert = orig.inert;
            else
              delete el.inert;
            if (typeof el.setAttribute === "function" && typeof el.removeAttribute === "function") {
              if (orig.ariaHidden !== null)
                el.setAttribute("aria-hidden", orig.ariaHidden);
              else
                el.removeAttribute("aria-hidden");
            }
          }
        }
      }
    });
  };
}
var trapStates = /* @__PURE__ */ new WeakMap();
function createTrapDirective(app, config = {}) {
  const debug = !!config.debug;
  const log = (...args) => {
    if (debug)
      console.log("[directives] [trap]", ...args);
  };
  return {
    mounted(el, binding) {
      const { value, modifiers = [], ctx, trackCleanup } = binding;
      const trapId = ++trapInstanceCounter;
      const state = {
        id: trapId,
        value,
        modifiers,
        ctx,
        isActive: false,
        bodyScrollLocked: false,
        lastParent: el.parentNode,
        addedTabIndex: false,
        previouslyFocused: null,
        restoreInert: null,
        frame: null,
        trigger: null
      };
      trapStates.set(el, state);
      const onKeydown = (e) => {
        if (e.key !== "Tab" || !state.isActive)
          return;
        const focusables = getFocusableElements(el);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstEl || !el.contains(document.activeElement)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl || !el.contains(document.activeElement)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      };
      const cancelFrame = () => {
        if (state.frame != null) {
          if (typeof cancelAnimationFrame === "function")
            cancelAnimationFrame(state.frame);
          else
            clearTimeout(state.frame);
          state.frame = null;
        }
      };
      const syncInert = () => {
        if (!state.isActive)
          return;
        const isInert = state.modifiers.includes("inert");
        if (!isInert)
          return;
        if (typeof document !== "undefined" && document.body && !document.body.contains(el)) {
          const nextFrame2 = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
          nextFrame2(() => {
            if (state.isActive && !state.restoreInert && document.body && document.body.contains(el)) {
              state.restoreInert = applyInertOutside(el, state.id);
              state.lastParent = el.parentNode;
            }
          });
          return;
        }
        if (!state.restoreInert) {
          state.restoreInert = applyInertOutside(el, state.id);
          state.lastParent = el.parentNode;
        }
      };
      const activate = () => {
        if (state.isActive)
          return;
        state.isActive = true;
        state.previouslyFocused = typeof document !== "undefined" ? document.activeElement : null;
        const isNoScroll = state.modifiers.includes("noscroll");
        if (isNoScroll && !state.bodyScrollLocked) {
          lockBodyScroll();
          state.bodyScrollLocked = true;
        }
        syncInert();
        if (typeof document !== "undefined") {
          document.addEventListener("keydown", onKeydown);
        }
        cancelFrame();
        const nextFrame2 = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
        state.frame = nextFrame2(() => {
          state.frame = null;
          const focusables = getFocusableElements(el);
          if (focusables.length > 0) {
            focusables[0].focus();
          } else if (typeof el.focus === "function") {
            if (!el.hasAttribute("tabindex")) {
              el.setAttribute("tabindex", "-1");
              state.addedTabIndex = true;
            }
            el.focus();
          }
          log("focus trapped inside", el);
        });
      };
      const deactivate = () => {
        if (!state.isActive)
          return;
        state.isActive = false;
        cancelFrame();
        if (typeof document !== "undefined") {
          document.removeEventListener("keydown", onKeydown);
        }
        if (state.bodyScrollLocked) {
          unlockBodyScroll();
          state.bodyScrollLocked = false;
        }
        if (typeof state.restoreInert === "function") {
          state.restoreInert();
          state.restoreInert = null;
        }
        if (state.addedTabIndex) {
          el.removeAttribute("tabindex");
          state.addedTabIndex = false;
        }
        if (state.previouslyFocused && typeof state.previouslyFocused.focus === "function") {
          const target = state.previouslyFocused;
          const isConnected = target.isConnected !== void 0 ? target.isConnected : true;
          const isNotDisabled = !target.disabled && (typeof target.getAttribute !== "function" || target.getAttribute("disabled") === null);
          const isNotInert = !target.inert;
          if (isConnected && isNotDisabled && isNotInert) {
            try {
              target.focus();
            } catch (e) {
            }
          }
        }
        state.previouslyFocused = null;
        log("focus released");
      };
      const effectFn = () => {
        let shouldTrap = true;
        if (state.value !== void 0 && state.value !== null && state.value !== "") {
          shouldTrap = resolveBool(app, state.ctx, state.value);
        }
        if (shouldTrap)
          activate();
        else
          deactivate();
      };
      state.trigger = effectFn;
      let effectCleanup = null;
      if (app && typeof app.effect === "function") {
        const eff = app.effect(effectFn, { name: "trap", area: "directive" });
        effectCleanup = () => {
          if (app.cleanup)
            app.cleanup(eff);
          else if (eff.stop)
            eff.stop();
        };
      } else {
        effectFn();
      }
      if (typeof trackCleanup === "function") {
        trackCleanup(() => {
          deactivate();
          if (effectCleanup)
            effectCleanup();
          trapStates.delete(el);
        });
      }
    },
    updated(el, binding) {
      const state = trapStates.get(el);
      if (!state)
        return;
      const { value, modifiers = [], ctx } = binding;
      state.value = value;
      state.modifiers = modifiers;
      state.ctx = ctx;
      let shouldTrap = true;
      if (value !== void 0 && value !== null && value !== "") {
        shouldTrap = resolveBool(app, ctx, value);
      }
      if (state.isActive) {
        if (!shouldTrap) {
          if (typeof state.trigger === "function")
            state.trigger();
        } else {
          const isNoScroll = modifiers.includes("noscroll");
          if (isNoScroll && !state.bodyScrollLocked) {
            lockBodyScroll();
            state.bodyScrollLocked = true;
          } else if (!isNoScroll && state.bodyScrollLocked) {
            unlockBodyScroll();
            state.bodyScrollLocked = false;
          }
          const isInert = modifiers.includes("inert");
          const parentChanged = el.parentNode !== state.lastParent;
          if (!isInert) {
            if (typeof state.restoreInert === "function") {
              state.restoreInert();
              state.restoreInert = null;
            }
          } else if (isInert) {
            if (!state.restoreInert || parentChanged) {
              if (typeof state.restoreInert === "function") {
                state.restoreInert();
                state.restoreInert = null;
              }
              if (typeof document !== "undefined" && document.body && !document.body.contains(el)) {
                const nextFrame2 = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
                nextFrame2(() => {
                  if (state.isActive && !state.restoreInert && document.body && document.body.contains(el)) {
                    state.restoreInert = applyInertOutside(el, state.id);
                    state.lastParent = el.parentNode;
                  }
                });
              } else {
                state.restoreInert = applyInertOutside(el, state.id);
                state.lastParent = el.parentNode;
              }
            }
          }
        }
      } else {
        if (shouldTrap) {
          if (typeof state.trigger === "function")
            state.trigger();
        }
      }
    }
  };
}

// packages/helix-directives/src/directives/clipboard.js
function parseFeedbackClass(modifiers) {
  const feedbackClassMod = modifiers.find((m) => m === "class" || m.startsWith("class"));
  let feedbackClass = "copied";
  if (feedbackClassMod) {
    if (feedbackClassMod.includes(".") || feedbackClassMod.includes("-")) {
      feedbackClass = feedbackClassMod.replace(/^class[.-]/, "");
    } else {
      const idx = modifiers.indexOf(feedbackClassMod);
      const nextMod = modifiers[idx + 1];
      if (nextMod && !nextMod.startsWith("duration")) {
        feedbackClass = nextMod;
      }
    }
  }
  return feedbackClass;
}
function parseFeedbackDuration(modifiers) {
  let duration = 2e3;
  const durMod = modifiers.find((m) => m === "duration" || m.startsWith("duration"));
  if (durMod) {
    if (durMod.includes(".") || durMod.includes("-")) {
      const parsed = parseInt(durMod.replace(/^duration[.-]/, ""), 10);
      if (!isNaN(parsed))
        duration = parsed;
    } else {
      const idx = modifiers.indexOf(durMod);
      const nextMod = modifiers[idx + 1];
      if (nextMod) {
        const parsed = parseInt(nextMod, 10);
        if (!isNaN(parsed))
          duration = parsed;
      }
    }
  } else {
    const directMs = modifiers.find((m) => /^\d+(ms)?$/.test(m));
    if (directMs) {
      const parsed = parseInt(directMs, 10);
      if (!isNaN(parsed))
        duration = parsed;
    }
  }
  return duration;
}
async function copyTextToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
    }
  }
  if (typeof document !== "undefined" && document.body) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      const success = document.execCommand("copy");
      document.body.removeChild(ta);
      return success;
    } catch (err) {
      try {
        document.body.removeChild(ta);
      } catch (e) {
      }
      return false;
    }
  }
  return false;
}
var clipboardStates = /* @__PURE__ */ new WeakMap();
function createClipboardDirective(app, config = {}) {
  const debug = !!config.debug;
  const log = (...args) => {
    if (debug)
      console.log("[directives] [clipboard]", ...args);
  };
  return {
    mounted(el, binding) {
      const { value, modifiers = [], ctx, trackCleanup } = binding;
      const state = {
        value,
        modifiers,
        ctx,
        feedbackClass: parseFeedbackClass(modifiers),
        feedbackDuration: parseFeedbackDuration(modifiers),
        resetTimer: null,
        onClick: null
      };
      clipboardStates.set(el, state);
      state.onClick = async (e) => {
        let textToCopy = "";
        if (state.value !== void 0 && state.value !== null && state.value !== "") {
          const resolved = resolvePath2(app, state.ctx, state.value, state.value);
          textToCopy = String(resolved ?? "");
        } else {
          textToCopy = el.value || el.textContent || "";
        }
        const success = await copyTextToClipboard(textToCopy);
        log("copied text:", textToCopy, "success:", success);
        if (success) {
          el.classList.add(state.feedbackClass);
          clearTimeout(state.resetTimer);
          state.resetTimer = setTimeout(() => {
            el.classList.remove(state.feedbackClass);
          }, state.feedbackDuration);
        }
        if (typeof el.dispatchEvent === "function") {
          const customEvent = typeof CustomEvent !== "undefined" ? new CustomEvent("copied", {
            detail: { text: textToCopy, success },
            bubbles: true,
            cancelable: true
          }) : { type: "copied", detail: { text: textToCopy, success } };
          el.dispatchEvent(customEvent);
        }
      };
      el.addEventListener("click", state.onClick);
      if (typeof trackCleanup === "function") {
        trackCleanup(() => {
          clearTimeout(state.resetTimer);
          el.removeEventListener("click", state.onClick);
          clipboardStates.delete(el);
        });
      }
    },
    updated(el, binding) {
      const state = clipboardStates.get(el);
      if (!state)
        return;
      if (state.resetTimer) {
        clearTimeout(state.resetTimer);
        state.resetTimer = null;
        if (state.feedbackClass && typeof el.classList?.remove === "function") {
          el.classList.remove(state.feedbackClass);
        }
      }
      const { value, modifiers = [], ctx } = binding;
      state.value = value;
      state.modifiers = modifiers;
      state.ctx = ctx;
      state.feedbackClass = parseFeedbackClass(modifiers);
      state.feedbackDuration = parseFeedbackDuration(modifiers);
    }
  };
}

// packages/helix-directives/src/directives/intersect.js
function parseThreshold(modifiers) {
  let threshold = 0;
  if (modifiers.includes("full"))
    threshold = 1;
  else if (modifiers.includes("half"))
    threshold = 0.5;
  else {
    const threshMod = modifiers.find((m) => m === "threshold" || m.startsWith("threshold"));
    if (threshMod) {
      let numStr = null;
      if (threshMod.includes(".") || threshMod.includes("-")) {
        numStr = threshMod.replace(/^threshold[.-]/, "");
      } else {
        const idx = modifiers.indexOf(threshMod);
        numStr = modifiers[idx + 1];
      }
      if (numStr) {
        const parsed = parseFloat(numStr);
        if (!isNaN(parsed)) {
          threshold = parsed > 1 ? parsed / 100 : parsed;
        }
      }
    }
  }
  return Math.min(1, Math.max(0, threshold));
}
function parseRootMargin(modifiers) {
  let rootMargin = "0px";
  const marginMod = modifiers.find((m) => m === "margin" || m.startsWith("margin"));
  if (marginMod) {
    let valStr = null;
    if (marginMod.includes(".") || marginMod.includes("-")) {
      valStr = marginMod.replace(/^margin[.-]/, "");
      if (marginMod.startsWith("margin.-") || marginMod.startsWith("margin.--")) {
        valStr = "-" + marginMod.replace(/^margin\.[-]+/, "");
      }
    } else {
      const idx = modifiers.indexOf(marginMod);
      valStr = modifiers[idx + 1];
    }
    if (valStr) {
      rootMargin = valStr.replace(/_/g, " ");
    }
  }
  return rootMargin;
}
var intersectStates = /* @__PURE__ */ new WeakMap();
function createIntersectDirective(app, config = {}) {
  const debug = !!config.debug;
  const log = (...args) => {
    if (debug)
      console.log("[directives] [intersect]", ...args);
  };
  function setupObserver(el, state) {
    if (!state.value)
      return;
    const isLeave = state.arg === "leave" || state.modifiers.includes("leave");
    const isOnce = state.modifiers.includes("once");
    const threshold = parseThreshold(state.modifiers);
    const rootMargin = parseRootMargin(state.modifiers);
    const raw = (typeof state.value === "string" ? state.value : String(state.value ?? "")).trim();
    const callData = parseCall(raw);
    const runHandler = (entry) => {
      log("intersection triggered:", { isIntersecting: entry.isIntersecting, isLeave });
      if (callData && callData.fnPath) {
        const fn = resolvePath2(app, state.ctx, callData.fnPath);
        if (typeof fn === "function") {
          const argsToPass = callData.args.length > 0 ? evaluateArgs(app, state.ctx, callData.args, { event: entry }) : [entry];
          try {
            fn.apply(state.ctx, argsToPass);
          } catch (err) {
            if (debug)
              console.error("[directives] [intersect] error executing handler:", err);
          }
        }
      }
    };
    if (typeof IntersectionObserver === "undefined") {
      if (debug)
        console.warn("[directives] [intersect] IntersectionObserver is not supported in this environment.");
      return;
    }
    let triggered = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const matchesCondition = isLeave ? !entry.isIntersecting : entry.isIntersecting;
        if (matchesCondition) {
          if (isOnce) {
            if (triggered)
              break;
            triggered = true;
            observer.unobserve(el);
            observer.disconnect();
          }
          runHandler(entry);
          if (isOnce)
            break;
        }
      }
    }, {
      threshold,
      rootMargin
    });
    observer.observe(el);
    state.observer = observer;
  }
  return {
    mounted(el, binding) {
      const { value, arg, modifiers = [], ctx, trackCleanup } = binding;
      const state = {
        value,
        arg,
        modifiers,
        ctx,
        observer: null
      };
      intersectStates.set(el, state);
      setupObserver(el, state);
      if (typeof trackCleanup === "function") {
        trackCleanup(() => {
          if (state.observer) {
            state.observer.unobserve(el);
            state.observer.disconnect();
            state.observer = null;
          }
          intersectStates.delete(el);
        });
      }
    },
    updated(el, binding) {
      const state = intersectStates.get(el);
      if (!state)
        return;
      if (state.observer) {
        state.observer.unobserve(el);
        state.observer.disconnect();
        state.observer = null;
      }
      const { value, arg, modifiers = [], ctx } = binding;
      state.value = value;
      state.arg = arg;
      state.modifiers = modifiers;
      state.ctx = ctx;
      setupObserver(el, state);
    }
  };
}

// packages/helix-directives/src/index.js
var directiveFactories = {
  debounce: createDebounceDirective,
  collapse: createCollapseDirective,
  trap: createTrapDirective,
  clipboard: createClipboardDirective,
  intersect: createIntersectDirective
};
var HelixDirectivesPlugin = {
  name: "directives",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "2.2.0" || "2.2.0",
  requires: {
    helix: ">=11.1.5"
  },
  install(app, options = {}) {
    const config = { ...options };
    const debug = !!config.debug;
    const registeredNames = [];
    for (const [name, factory] of Object.entries(directiveFactories)) {
      if (typeof app.directive !== "function")
        break;
      const def = factory(app, config);
      app.directive(name, def);
      registeredNames.push(name);
    }
    if (debug)
      console.log("[directives] installed:", registeredNames, "| config:", config);
    const api = {
      names: registeredNames,
      version: HelixDirectivesPlugin.version
    };
    if (typeof app.namespace === "function") {
      try {
        app.namespace("directives", api);
      } catch (e) {
      }
    }
    app.$directives = api;
    if (typeof app.provide === "function") {
      try {
        app.provide("$directives", api);
      } catch (e) {
      }
    }
    const bus = app.$bus || typeof window !== "undefined" && window.Helix && window.Helix.$bus;
    if (bus && typeof bus.emit === "function") {
      try {
        bus.emit("plugin:directives:installed", { version: HelixDirectivesPlugin.version, names: registeredNames });
      } catch (e) {
      }
    }
    return () => {
      registeredNames.forEach((name) => {
        if (typeof app.removeDirective === "function")
          app.removeDirective(name);
      });
      if (app.$directives === api)
        delete app.$directives;
      if (typeof app.removeNamespace === "function") {
        try {
          app.removeNamespace("directives");
        } catch (e) {
        }
      }
      if (bus && typeof bus.emit === "function") {
        try {
          bus.emit("plugin:directives:destroyed", { version: HelixDirectivesPlugin.version });
        } catch (e) {
        }
      }
    };
  }
};
var root = typeof window !== "undefined" ? window : globalThis;
root.HelixDirectivesPlugin = HelixDirectivesPlugin;
var src_default = HelixDirectivesPlugin;

// packages/helix-helpers/src/shared.js
var _hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
var _toStr = Object.prototype.toString;
var _unref = (v) => {
  if (v != null && typeof v === "object" && ("value" in v || v._isRef || v.__v_isRef)) {
    return v.value;
  }
  return v;
};
var _isPlainObject = (v) => {
  const val = _unref(v);
  if (val === null || typeof val !== "object")
    return false;
  if (_toStr.call(val) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
};
var _isInteger = (v) => {
  const val = _unref(v);
  return typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
};
var _toPath = (path) => {
  const p = _unref(path);
  if (Array.isArray(p))
    return p;
  return String(p || "").replace(/\[['"]?([^'"]+)['"]?\]/g, ".$1").replace(/^\./, "").split(".").filter(Boolean);
};
var _serializeParam = (key, val, encode = encodeURIComponent) => {
  const rawVal = _unref(val);
  if (rawVal === null || rawVal === void 0)
    return "";
  if (typeof rawVal === "boolean")
    return `${key}=${rawVal}`;
  if (typeof rawVal === "number" || typeof rawVal === "string")
    return `${key}=${encode(rawVal)}`;
  if (Array.isArray(rawVal)) {
    return rawVal.map((v, i) => {
      const unwrappedV = _unref(v);
      if (typeof unwrappedV === "object" && unwrappedV !== null) {
        return _serializeParam(`${key}[${i}]`, unwrappedV, encode);
      }
      return _serializeParam(`${key}[]`, unwrappedV, encode);
    }).filter(Boolean).join("&");
  }
  if (typeof rawVal === "object") {
    return Object.entries(rawVal).map(([k, v]) => _serializeParam(`${key}[${k}]`, v, encode)).filter(Boolean).join("&");
  }
  return "";
};

// packages/helix-helpers/src/types.js
function createTypeMethods(H) {
  return {
    isArray: (v) => Array.isArray(v),
    isObject: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    isPlainObject: (v) => _isPlainObject(v),
    isString: (v) => typeof v === "string",
    isNumber: (v) => typeof v === "number" && Number.isFinite(v),
    isBoolean: (v) => typeof v === "boolean",
    isFunction: (v) => typeof v === "function",
    isNull: (v) => v === null,
    isUndefined: (v) => v === void 0,
    isNil: (v) => v === null || v === void 0,
    isDate: (v) => _toStr.call(v) === "[object Date]",
    isRegExp: (v) => _toStr.call(v) === "[object RegExp]",
    isPromise: (v) => v !== null && (typeof v === "object" || typeof v === "function") && typeof v.then === "function",
    isMap: (v) => _toStr.call(v) === "[object Map]",
    isSet: (v) => _toStr.call(v) === "[object Set]",
    isWeakMap: (v) => _toStr.call(v) === "[object WeakMap]",
    isWeakSet: (v) => _toStr.call(v) === "[object WeakSet]",
    isSymbol: (v) => typeof v === "symbol",
    isEmpty(v) {
      if (v == null)
        return true;
      if (typeof v === "string" || Array.isArray(v))
        return v.length === 0;
      if (v instanceof Map || v instanceof Set || _toStr.call(v) === "[object Map]" || _toStr.call(v) === "[object Set]") {
        return v.size === 0;
      }
      if (_isPlainObject(v))
        return Object.keys(v).length === 0;
      return false;
    },
    isEqual(a, b, stack = /* @__PURE__ */ new WeakMap()) {
      if (a === b)
        return true;
      if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b))
        return true;
      if (a == null || b == null)
        return false;
      if (typeof a !== typeof b)
        return false;
      if (typeof a !== "object")
        return false;
      let aStack = stack.get(a);
      if (!aStack) {
        aStack = /* @__PURE__ */ new WeakSet();
        stack.set(a, aStack);
      }
      if (aStack.has(b))
        return true;
      aStack.add(b);
      if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
          aStack.delete(b);
          return false;
        }
        const res2 = a.every((item, i) => H.isEqual(item, b[i], stack));
        aStack.delete(b);
        return res2;
      }
      const isDateA = _toStr.call(a) === "[object Date]";
      const isDateB = _toStr.call(b) === "[object Date]";
      if (isDateA || isDateB) {
        const res2 = isDateA && isDateB && a.getTime() === b.getTime();
        aStack.delete(b);
        return res2;
      }
      const isRegA = _toStr.call(a) === "[object RegExp]";
      const isRegB = _toStr.call(b) === "[object RegExp]";
      if (isRegA || isRegB) {
        const res2 = isRegA && isRegB && a.toString() === b.toString();
        aStack.delete(b);
        return res2;
      }
      const isMapA = _toStr.call(a) === "[object Map]";
      const isMapB = _toStr.call(b) === "[object Map]";
      if (isMapA || isMapB) {
        if (!isMapA || !isMapB || a.size !== b.size) {
          aStack.delete(b);
          return false;
        }
        const entriesB = Array.from(b.entries());
        const res2 = Array.from(a.entries()).every(([kA, vA]) => {
          const matchIdx = entriesB.findIndex(([kB, vB]) => H.isEqual(kA, kB, stack) && H.isEqual(vA, vB, stack));
          if (matchIdx === -1)
            return false;
          entriesB.splice(matchIdx, 1);
          return true;
        });
        aStack.delete(b);
        return res2;
      }
      const isSetA = _toStr.call(a) === "[object Set]";
      const isSetB = _toStr.call(b) === "[object Set]";
      if (isSetA || isSetB) {
        if (!isSetA || !isSetB || a.size !== b.size) {
          aStack.delete(b);
          return false;
        }
        const itemsB = Array.from(b.values());
        const res2 = Array.from(a.values()).every((vA) => {
          const matchIdx = itemsB.findIndex((vB) => H.isEqual(vA, vB, stack));
          if (matchIdx === -1)
            return false;
          itemsB.splice(matchIdx, 1);
          return true;
        });
        aStack.delete(b);
        return res2;
      }
      const protoA = Object.getPrototypeOf(a);
      const protoB = Object.getPrototypeOf(b);
      if (protoA !== protoB && (protoA !== null && protoA !== Object.prototype) && (protoB !== null && protoB !== Object.prototype)) {
        aStack.delete(b);
        return false;
      }
      const keysA = Reflect.ownKeys(a);
      const keysB = Reflect.ownKeys(b);
      if (keysA.length !== keysB.length) {
        aStack.delete(b);
        return false;
      }
      const res = keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && H.isEqual(a[k], b[k], stack));
      aStack.delete(b);
      return res;
    }
  };
}

// packages/helix-helpers/src/string.js
function createStringMethods(H) {
  return {
    capitalize(str) {
      const s = _unref(str);
      if (!H.isString(s) || s.length === 0)
        return s;
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    titleCase(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    },
    camelCase(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      return s.trim().replace(/[_\-\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "").replace(/^(.)/, (c) => c.toLowerCase());
    },
    kebabCase(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      return s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
    },
    snakeCase(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      return H.kebabCase(s).replace(/-/g, "_");
    },
    truncate(str, len = 50, suffix = "...") {
      const s = _unref(str);
      const l = _unref(len) ?? 50;
      const suf = _unref(suffix) ?? "...";
      if (!H.isString(s) || s.length <= l)
        return s;
      const subLen = Math.max(0, l - suf.length);
      return s.slice(0, subLen) + suf;
    },
    slugify(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    },
    padStart(str, len, char = "0") {
      const s = String(_unref(str) ?? "");
      const l = _unref(len);
      const c = String(_unref(char) ?? "0");
      if (s.length >= l)
        return s;
      return c.repeat(l - s.length) + s;
    },
    padEnd(str, len, char = " ") {
      const s = String(_unref(str) ?? "");
      const l = _unref(len);
      const c = String(_unref(char) ?? " ");
      if (s.length >= l)
        return s;
      return s + c.repeat(l - s.length);
    },
    escapeHtml(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return s.replace(/[&<>"']/g, (c) => map[c]);
    },
    unescapeHtml(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return s;
      const map = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
      return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (c) => map[c]);
    }
  };
}

// packages/helix-helpers/src/array.js
function createArrayMethods(H) {
  return {
    unique(arr) {
      if (!Array.isArray(arr))
        return arr;
      return [...new Set(arr)];
    },
    flatten(arr, depth = Infinity) {
      if (!Array.isArray(arr))
        return arr;
      return arr.flat(depth);
    },
    groupBy(arr, key) {
      if (!Array.isArray(arr))
        return {};
      return arr.reduce((r, item) => {
        const k = typeof key === "function" ? key(item) : H.get(item, key);
        (r[k] = r[k] || []).push(item);
        return r;
      }, {});
    },
    keyBy(arr, key) {
      if (!Array.isArray(arr))
        return {};
      return arr.reduce((r, item) => {
        const k = typeof key === "function" ? key(item) : H.get(item, key);
        r[k] = item;
        return r;
      }, {});
    },
    sortBy(arr, key, order = "asc") {
      if (!Array.isArray(arr))
        return arr;
      const sorted = [...arr].sort((a, b) => {
        let av = key ? H.get(a, key) : a;
        let bv = key ? H.get(b, key) : b;
        if (av == null && bv == null)
          return 0;
        if (av == null)
          return 1;
        if (bv == null)
          return -1;
        if (typeof av === "string" && typeof bv === "string") {
          return av.localeCompare(bv, void 0, { sensitivity: "base" });
        }
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
      return order === "desc" ? sorted.reverse() : sorted;
    },
    chunk(arr, size) {
      if (!Array.isArray(arr) || !_isInteger(size) || size <= 0)
        return [];
      const result = [];
      for (let i = 0; i < arr.length; i += size)
        result.push(arr.slice(i, i + size));
      return result;
    },
    pluck(arr, key) {
      if (!Array.isArray(arr))
        return [];
      return arr.map((i) => H.get(i, key)).filter((v) => v !== void 0);
    },
    findBy(arr, key, val) {
      if (!Array.isArray(arr))
        return void 0;
      if (typeof key === "function")
        return arr.find(key);
      if (key == null)
        return arr.find((i) => i === val);
      return arr.find((i) => H.get(i, key) === val);
    },
    removeBy(arr, key, val) {
      if (!Array.isArray(arr))
        return arr;
      if (typeof key === "function")
        return arr.filter((item, idx) => !key(item, idx));
      if (key == null)
        return arr.filter((i) => i !== val);
      return arr.filter((i) => H.get(i, key) !== val);
    },
    partition(arr, predicate) {
      if (!Array.isArray(arr))
        return [[], []];
      return arr.reduce((acc, item) => {
        acc[predicate(item) ? 0 : 1].push(item);
        return acc;
      }, [[], []]);
    },
    difference(arr, ...others) {
      if (!Array.isArray(arr))
        return [];
      const combined = new Set(others.flat());
      return [...new Set(arr.filter((x) => !combined.has(x)))];
    },
    intersection(arr, ...others) {
      if (!Array.isArray(arr))
        return [];
      const sets = others.map((o) => new Set(o));
      return [...new Set(arr.filter((x) => sets.every((s) => s.has(x))))];
    }
  };
}

// packages/helix-helpers/src/object.js
function createObjectMethods(H, app) {
  return {
    pick(obj, keys) {
      if (!H.isObject(obj))
        return {};
      const ka = Array.isArray(keys) ? keys : [keys];
      return ka.reduce((r, k) => {
        if (k in obj)
          r[k] = obj[k];
        return r;
      }, {});
    },
    pickBy(obj, predicate) {
      if (!H.isObject(obj))
        return {};
      return Object.entries(obj).reduce((r, [k, v]) => {
        if (predicate(v, k))
          r[k] = v;
        return r;
      }, {});
    },
    omit(obj, keys) {
      if (!H.isObject(obj))
        return {};
      const r = { ...obj };
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete r[k]);
      return r;
    },
    omitBy(obj, predicate) {
      if (!H.isObject(obj))
        return {};
      return Object.entries(obj).reduce((r, [k, v]) => {
        if (!predicate(v, k))
          r[k] = v;
        return r;
      }, {});
    },
    cloneDeep(obj, _map = /* @__PURE__ */ new WeakMap()) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (_map.has(obj))
        return _map.get(obj);
      const copyDescriptors = (src, target, exclude = []) => {
        const descriptors = Object.getOwnPropertyDescriptors(src);
        for (const k of Reflect.ownKeys(descriptors)) {
          if (exclude.includes(k) || Array.isArray(src) && /^\d+$/.test(k))
            continue;
          const desc = descriptors[k];
          if ("value" in desc) {
            desc.value = H.cloneDeep(desc.value, _map);
          }
          try {
            Object.defineProperty(target, k, desc);
          } catch {
            target[k] = H.cloneDeep(src[k], _map);
          }
        }
      };
      if (obj instanceof Date) {
        const cloneDate = new Date(obj.getTime());
        _map.set(obj, cloneDate);
        copyDescriptors(obj, cloneDate);
        return cloneDate;
      }
      if (obj instanceof RegExp) {
        const cloneReg = new RegExp(obj.source, obj.flags);
        _map.set(obj, cloneReg);
        copyDescriptors(obj, cloneReg);
        return cloneReg;
      }
      if (Array.isArray(obj)) {
        const cloneArr = [];
        _map.set(obj, cloneArr);
        for (let i = 0; i < obj.length; i++) {
          cloneArr[i] = H.cloneDeep(obj[i], _map);
        }
        copyDescriptors(obj, cloneArr, ["length"]);
        return cloneArr;
      }
      if (obj instanceof Map) {
        const cloneMap = /* @__PURE__ */ new Map();
        _map.set(obj, cloneMap);
        obj.forEach((v, k) => {
          cloneMap.set(H.cloneDeep(k, _map), H.cloneDeep(v, _map));
        });
        copyDescriptors(obj, cloneMap);
        return cloneMap;
      }
      if (obj instanceof Set) {
        const cloneSet = /* @__PURE__ */ new Set();
        _map.set(obj, cloneSet);
        obj.forEach((v) => {
          cloneSet.add(H.cloneDeep(v, _map));
        });
        copyDescriptors(obj, cloneSet);
        return cloneSet;
      }
      const proto = Object.getPrototypeOf(obj);
      const clone = Object.create(proto);
      _map.set(obj, clone);
      copyDescriptors(obj, clone);
      return clone;
    },
    deepMerge(target, ...sources) {
      let result = _isPlainObject(target) ? { ...target } : {};
      for (const s of sources) {
        if (_isPlainObject(s)) {
          for (const k of Reflect.ownKeys(s)) {
            if (_hasOwn(s, k)) {
              if (_isPlainObject(s[k]) && _isPlainObject(result[k])) {
                result[k] = H.deepMerge(result[k], s[k]);
              } else {
                result[k] = H.cloneDeep(s[k]);
              }
            }
          }
        }
      }
      return result;
    },
    merge(target, ...sources) {
      if (!target || typeof target !== "object")
        target = {};
      for (const s of sources) {
        if (_isPlainObject(s)) {
          for (const k of Reflect.ownKeys(s)) {
            if (_hasOwn(s, k)) {
              if (_isPlainObject(s[k])) {
                if (!target[k] || typeof target[k] !== "object")
                  target[k] = {};
                H.merge(target[k], s[k]);
              } else {
                target[k] = s[k];
              }
            }
          }
        }
      }
      return target;
    },
    hasKey(obj, key) {
      return H.isObject(obj) && _hasOwn(obj, key);
    },
    get(obj, path, def) {
      if (obj == null || path == null)
        return def;
      if (typeof app.resolvePath === "function") {
        const appRes = app.resolvePath(String(path), obj);
        if (appRes !== void 0)
          return appRes;
      }
      let r = obj;
      for (const k of _toPath(path)) {
        if (r == null || !(k in r))
          return def;
        r = r[k];
        if (typeof app.isRef === "function" && app.isRef(r)) {
          r = r.value;
        }
      }
      return r;
    },
    set(obj, path, val) {
      if (!obj || path == null)
        return obj;
      let c = obj;
      const ks = _toPath(path);
      for (let i = 0; i < ks.length - 1; i++) {
        const k = ks[i];
        const nextKey = ks[i + 1];
        const isNextIndex = /^\d+$/.test(nextKey);
        if (!(k in c) || typeof c[k] !== "object" || c[k] === null || isNextIndex && !Array.isArray(c[k]) || !isNextIndex && Array.isArray(c[k])) {
          c[k] = isNextIndex ? [] : {};
        }
        c = c[k];
      }
      c[ks[ks.length - 1]] = val;
      return obj;
    }
  };
}

// packages/helix-helpers/src/date.js
function createDateMethods(H) {
  return {
    formatDate(date, fmt = "YYYY-MM-DD", options = {}) {
      const rawDate = _unref(date);
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (isNaN(d.getTime()))
        return "";
      const formatStr = _unref(fmt) || "YYYY-MM-DD";
      const opts = _unref(options);
      const isUtc = opts === true || typeof opts === "object" && opts !== null && opts.utc;
      const p = (n) => String(n).padStart(2, "0");
      const m = isUtc ? {
        YYYY: d.getUTCFullYear(),
        MM: p(d.getUTCMonth() + 1),
        DD: p(d.getUTCDate()),
        HH: p(d.getUTCHours()),
        mm: p(d.getUTCMinutes()),
        ss: p(d.getUTCSeconds()),
        SSS: String(d.getUTCMilliseconds()).padStart(3, "0")
      } : {
        YYYY: d.getFullYear(),
        MM: p(d.getMonth() + 1),
        DD: p(d.getDate()),
        HH: p(d.getHours()),
        mm: p(d.getMinutes()),
        ss: p(d.getSeconds()),
        SSS: String(d.getMilliseconds()).padStart(3, "0")
      };
      return formatStr.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (x) => m[x]);
    },
    timeAgo(date) {
      const rawDate = _unref(date);
      const now = /* @__PURE__ */ new Date();
      const then = new Date(rawDate);
      const diff = Math.floor((now - then) / 1e3);
      const absDiff = Math.abs(diff);
      const suffix = diff < 0 ? "from now" : "ago";
      const i = { year: 31536e3, month: 2592e3, week: 604800, day: 86400, hour: 3600, minute: 60 };
      for (const [u, sec] of Object.entries(i)) {
        const n = Math.floor(absDiff / sec);
        if (n >= 1)
          return `${n} ${u}${n > 1 ? "s" : ""} ${suffix}`;
      }
      return diff < 0 ? "in a moment" : "just now";
    },
    addDays(date, days) {
      const rawDate = _unref(date);
      const numDays = _unref(days);
      const d = new Date(rawDate);
      d.setDate(d.getDate() + numDays);
      return d;
    },
    startOfDay(date) {
      const rawDate = _unref(date);
      const d = new Date(rawDate);
      d.setHours(0, 0, 0, 0);
      return d;
    },
    endOfDay(date) {
      const rawDate = _unref(date);
      const d = new Date(rawDate);
      d.setHours(23, 59, 59, 999);
      return d;
    }
  };
}

// packages/helix-helpers/src/number.js
function createNumberMethods(H) {
  return {
    formatNumber(num, d = 0, loc = "en-US") {
      const n = _unref(num);
      const dec = _unref(d) ?? 0;
      const locale = _unref(loc) || "en-US";
      return H.isNumber(n) ? n.toLocaleString(locale, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
      }) : n;
    },
    formatCurrency(amount, curOrOptions = "USD", loc = "en-US") {
      const a = _unref(amount);
      if (!H.isNumber(a))
        return a;
      const opts = _unref(curOrOptions);
      const defaultLoc = _unref(loc) || "en-US";
      if (typeof opts === "object" && opts !== null) {
        const {
          currency = "USD",
          locale = opts.locale || opts.loc || defaultLoc,
          currencyDisplay = "symbol",
          minimumFractionDigits = 2,
          maximumFractionDigits = 2
        } = opts;
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          currencyDisplay,
          minimumFractionDigits,
          maximumFractionDigits
        }).format(a);
      }
      return new Intl.NumberFormat(defaultLoc, {
        style: "currency",
        currency: opts || "USD"
      }).format(a);
    },
    round(num, d = 0) {
      const n = _unref(num);
      const dec = _unref(d) ?? 0;
      if (!H.isNumber(n))
        return n;
      const p = Math.pow(10, dec);
      const val = n * p * (1 + Number.EPSILON);
      return Math.round(val) / p;
    },
    clamp(num, min, max) {
      const n = _unref(num);
      const mn = _unref(min);
      const mx = _unref(max);
      if (!H.isNumber(n))
        return n;
      return Math.min(Math.max(n, mn), mx);
    },
    randomInt(min, max) {
      const mn = _unref(min);
      const mx = _unref(max);
      let low = typeof mn === "number" ? Math.ceil(mn) : 0;
      let high = typeof mx === "number" ? Math.floor(mx) : 0;
      if (isNaN(low))
        low = 0;
      if (isNaN(high))
        high = 0;
      if (low > high)
        [low, high] = [high, low];
      return Math.floor(Math.random() * (high - low + 1)) + low;
    }
  };
}

// packages/helix-helpers/src/validation.js
function createValidationMethods(H) {
  return {
    isEmail(str) {
      const s = _unref(str);
      if (!H.isString(s))
        return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    },
    isUrl(str, options = {}) {
      const s = _unref(str);
      if (!H.isString(s))
        return false;
      const opts = _unref(options) || {};
      const allowed = opts.protocols || ["http:", "https:"];
      try {
        const u = new URL(s);
        return Array.isArray(allowed) ? allowed.includes(u.protocol) : true;
      } catch {
        return false;
      }
    },
    isPhone(str, c = "US") {
      const s = _unref(str);
      if (!H.isString(s))
        return false;
      const country = _unref(c) || "US";
      const p = {
        US: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
        UK: /^\+?44[-.\s]?7\d{3}[-.\s]?\d{6}$/,
        IN: /^\+?91[-.\s]?[6-9]\d{4}[-.\s]?\d{5}$|^\+?91[-.\s]?[6-9]\d{9}$|^[6-9]\d{9}$/
      };
      return (p[country] || p.US).test(s.trim());
    },
    minLength(str, len) {
      const s = _unref(str);
      const l = _unref(len);
      return H.isString(s) && s.length >= l;
    },
    maxLength(str, len) {
      const s = _unref(str);
      const l = _unref(len);
      return H.isString(s) && s.length <= l;
    },
    range(num, min, max) {
      const n = _unref(num);
      const mn = _unref(min);
      const mx = _unref(max);
      return H.isNumber(n) && n >= mn && n <= mx;
    },
    isHexColor(str) {
      const s = _unref(str);
      return H.isString(s) && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(s);
    }
  };
}

// packages/helix-helpers/src/dom.js
function createDomMethods(H) {
  return {
    scrollTo(target, behavior = "smooth", block = "start") {
      if (typeof window === "undefined")
        return;
      if (typeof target === "string") {
        if (typeof document !== "undefined" && typeof document.querySelector === "function") {
          document.querySelector(target)?.scrollIntoView({ behavior, block });
        }
      } else if (typeof Element !== "undefined" && target instanceof Element) {
        target.scrollIntoView({ behavior, block });
      } else if (typeof target === "number") {
        if (typeof window.scrollTo === "function") {
          window.scrollTo({ top: target, behavior });
        }
      } else {
        if (typeof window.scrollTo === "function") {
          window.scrollTo({ top: 0, behavior });
        }
      }
    },
    async copyToClipboard(text) {
      if (!H.isString(text))
        return false;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(text);
          return true;
        }
        throw new Error("Clipboard API unavailable");
      } catch {
        if (typeof document === "undefined" || typeof document.createElement !== "function") {
          return false;
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          return true;
        } catch {
          return false;
        } finally {
          document.body.removeChild(ta);
        }
      }
    },
    copy(text) {
      return H.copyToClipboard(text);
    },
    downloadFile(content, filename, type = "text/plain") {
      if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function" || typeof document === "undefined" || typeof document.createElement !== "function") {
        return false;
      }
      try {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (a.parentNode)
            document.body.removeChild(a);
        }, 100);
        return true;
      } catch {
        return false;
      }
    },
    trapFocus(element, options = {}) {
      if (!element)
        return () => {
        };
      const FOCUSABLE = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
      const prevActive = typeof document !== "undefined" ? document.activeElement : null;
      const getFocusables = () => {
        if (typeof element.querySelectorAll !== "function")
          return [];
        return Array.from(element.querySelectorAll(FOCUSABLE)).filter((el) => {
          return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
        });
      };
      const onKeydown = (e) => {
        if (e.key !== "Tab")
          return;
        const focusables2 = getFocusables();
        if (focusables2.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = focusables2[0];
        const lastEl = focusables2[focusables2.length - 1];
        const containsActive = typeof element.contains === "function" ? element.contains(document.activeElement) : false;
        if (e.shiftKey) {
          if (document.activeElement === firstEl || !containsActive) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl || !containsActive) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("keydown", onKeydown);
      }
      const focusables = getFocusables();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (typeof element.focus === "function") {
        if (typeof element.hasAttribute === "function" && !element.hasAttribute("tabindex")) {
          element.setAttribute("tabindex", "-1");
        }
        element.focus();
      }
      const cleanup2 = () => {
        if (typeof document !== "undefined") {
          document.removeEventListener("keydown", onKeydown);
        }
        if (prevActive && typeof prevActive.focus === "function") {
          try {
            prevActive.focus();
          } catch (err) {
          }
        }
      };
      return cleanup2;
    },
    releaseFocus(previousElement) {
      if (previousElement && typeof previousElement.focus === "function") {
        previousElement.focus();
      }
    },
    collapse(element, isOpen, options = {}) {
      if (!element || !element.style || typeof element.scrollHeight !== "number")
        return;
      const duration = options.duration || 300;
      const minHeight = options.minHeight || 0;
      const nextFrame2 = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
      element.style.transitionProperty = "height";
      element.style.transitionDuration = `${duration}ms`;
      element.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.2, 1)";
      if (isOpen) {
        element.style.display = "";
        element.style.overflow = "hidden";
        element.style.height = `${minHeight}px`;
        const fullHeight = element.scrollHeight;
        nextFrame2(() => {
          element.style.height = `${fullHeight}px`;
          setTimeout(() => {
            element.style.height = "";
            element.style.overflow = "";
          }, duration);
        });
      } else {
        element.style.height = `${element.scrollHeight}px`;
        element.style.overflow = "hidden";
        nextFrame2(() => {
          element.style.height = `${minHeight}px`;
          setTimeout(() => {
            if (minHeight === 0)
              element.style.display = "none";
          }, duration);
        });
      }
    },
    intersect(element, callback, options = {}) {
      if (!element || typeof callback !== "function")
        return () => {
        };
      if (typeof IntersectionObserver === "undefined") {
        if (options.fallback === "visible") {
          callback({ target: element, isIntersecting: true, intersectionRatio: 1 });
        }
        return () => {
        };
      }
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry);
            if (options.once) {
              observer.unobserve(element);
              observer.disconnect();
            }
          } else if (options.leave) {
            callback(entry);
          }
        });
      }, {
        threshold: options.threshold || 0,
        rootMargin: options.rootMargin || "0px"
      });
      observer.observe(element);
      return () => {
        observer.unobserve(element);
        observer.disconnect();
      };
    }
  };
}

// packages/helix-helpers/src/data.js
function createDataMethods(H) {
  return {
    stringify: (obj) => JSON.stringify(obj),
    parseJSON(str, def = null) {
      try {
        return JSON.parse(str);
      } catch {
        return def;
      }
    },
    toQueryString(obj) {
      if (!H.isObject(obj))
        return "";
      return Object.entries(obj).filter(([, v]) => v !== void 0 && v !== null).map(([k, v]) => _serializeParam(k, v)).filter(Boolean).join("&");
    },
    fromQueryString(str) {
      if (!H.isString(str) || !str.trim())
        return {};
      const cleanStr = str.startsWith("?") ? str.slice(1) : str;
      const result = {};
      const params = new URLSearchParams(cleanStr);
      const parseKeys = (key) => {
        const keys = [];
        const re = /^([^\[\]]+)|\[([^\[\]]*)\]/g;
        let match;
        while ((match = re.exec(key)) !== null) {
          keys.push(match[1] !== void 0 ? match[1] : match[2]);
        }
        return keys.length ? keys : [key];
      };
      for (const [rawKey, val] of params) {
        const path = parseKeys(rawKey);
        let curr = result;
        for (let i = 0; i < path.length - 1; i++) {
          const segment = path[i];
          const nextSegment = path[i + 1];
          const isNextIndex = nextSegment !== "" && /^\d+$/.test(nextSegment);
          if (!(segment in curr) || typeof curr[segment] !== "object" || curr[segment] === null) {
            curr[segment] = isNextIndex || nextSegment === "" ? [] : {};
          }
          curr = curr[segment];
        }
        const lastSegment = path[path.length - 1];
        if (lastSegment === "") {
          if (Array.isArray(curr)) {
            curr.push(val);
          }
        } else if (lastSegment in curr) {
          if (Array.isArray(curr[lastSegment])) {
            curr[lastSegment].push(val);
          } else {
            curr[lastSegment] = [curr[lastSegment], val];
          }
        } else {
          curr[lastSegment] = val;
        }
      }
      return result;
    }
  };
}

// packages/helix-helpers/src/async.js
function createAsyncMethods(H, timerCancels) {
  return {
    wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },
    uid(len = 8) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let id2 = "";
      for (let i = 0; i < len; i++)
        id2 += chars.charAt(Math.floor(Math.random() * chars.length));
      return id2;
    },
    uuid() {
      if (typeof crypto !== "undefined" && crypto.randomUUID)
        return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : r & 3 | 8).toString(16);
      });
    },
    debounce(fn, wait = 300, immediate = false) {
      let timer = null;
      const cancel = () => {
        if (timer != null) {
          clearTimeout(timer);
          timer = null;
        }
        if (timerCancels)
          timerCancels.delete(cancel);
      };
      const wrapped = function(...args) {
        const callNow = immediate && !timer;
        if (timer != null)
          clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          if (timerCancels)
            timerCancels.delete(cancel);
          if (!immediate)
            fn.apply(this, args);
        }, wait);
        if (timerCancels)
          timerCancels.add(cancel);
        if (callNow)
          fn.apply(this, args);
      };
      wrapped.cancel = cancel;
      return wrapped;
    },
    throttle(fn, limit = 300, trailing = true) {
      let last = void 0, timer = null;
      const cancel = () => {
        if (timer != null) {
          clearTimeout(timer);
          timer = null;
        }
        last = void 0;
        if (timerCancels)
          timerCancels.delete(cancel);
      };
      const wrapped = function(...args) {
        const now = Date.now();
        if (last === void 0 || now - last >= limit) {
          last = now;
          fn.apply(this, args);
        } else if (trailing) {
          if (timer != null)
            clearTimeout(timer);
          timer = setTimeout(() => {
            last = Date.now();
            timer = null;
            if (timerCancels)
              timerCancels.delete(cancel);
            fn.apply(this, args);
          }, limit - (now - last));
          if (timerCancels)
            timerCancels.add(cancel);
        }
      };
      wrapped.cancel = cancel;
      return wrapped;
    },
    async retry(fn, { retries = 3, delay = 300, backoff = 2, onRetry } = {}) {
      let lastErr;
      for (let i = 0; i <= retries; i++) {
        try {
          return await fn(i);
        } catch (err) {
          lastErr = err;
          if (i === retries)
            break;
          const waitTime = delay * Math.pow(backoff, i);
          if (onRetry)
            onRetry(err, i, waitTime);
          await H.wait(waitTime);
        }
      }
      throw lastErr;
    }
  };
}

// packages/helix-helpers/src/events.js
function createEventMethods(H) {
  return {
    dispatch(targetOrEvent, eventOrDetail, detailOrOptions = null, options = {}) {
      let target = null;
      let eventName = "";
      let evtDetail = null;
      let opts = {};
      if (typeof targetOrEvent === "string") {
        eventName = targetOrEvent;
        evtDetail = eventOrDetail;
        target = typeof document !== "undefined" ? document : null;
        opts = detailOrOptions && typeof detailOrOptions === "object" && !Array.isArray(detailOrOptions) ? detailOrOptions : {};
      } else {
        target = targetOrEvent;
        eventName = String(eventOrDetail || "");
        evtDetail = detailOrOptions;
        opts = options && typeof options === "object" && !Array.isArray(options) ? options : {};
      }
      if (!target || typeof target.dispatchEvent !== "function") {
        if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
          target = document;
        } else if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          target = window;
        }
      }
      if (!target || typeof target.dispatchEvent !== "function" || !eventName)
        return false;
      const customEvent = typeof CustomEvent !== "undefined" ? new CustomEvent(eventName, {
        bubbles: opts.bubbles !== false,
        composed: opts.composed !== false,
        cancelable: opts.cancelable !== false,
        ...opts,
        detail: evtDetail
      }) : { type: eventName, detail: evtDetail };
      return target.dispatchEvent(customEvent);
    }
  };
}

// packages/helix-helpers/src/id.js
var helperIdCounter = 0;
function getDefaultPrefix(app) {
  const raw = app?.config?.prefix || typeof window !== "undefined" && window.Helix?.config?.prefix || typeof globalThis !== "undefined" && globalThis.Helix?.config?.prefix || "hx";
  return String(raw).replace(/[-:]+$/, "") || "hx";
}
function createIdMethods(H, app) {
  return {
    id(prefix) {
      const p = prefix != null ? prefix : getDefaultPrefix(app);
      return `${p}-${++helperIdCounter}`;
    },
    uniqueId(prefix) {
      const p = prefix != null ? prefix : getDefaultPrefix(app);
      const randomSuffix = typeof H.uid === "function" ? H.uid(8) : Math.random().toString(36).slice(2, 10);
      return `${p}-${randomSuffix}`;
    }
  };
}

// packages/helix-helpers/src/index.js
var HelixHelpersPlugin = {
  name: "helpers",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "1.1.0" || "1.1.0",
  requires: {
    helix: ">=11.1.5"
  },
  install(app, options = {}) {
    const _timerCancels = /* @__PURE__ */ new Set();
    const logWarn = (msg, err) => {
      if (options.debug && typeof console !== "undefined" && console.warn) {
        console.warn(`[Helix Helpers] ${msg}:`, err);
      }
    };
    const H = {};
    Object.assign(
      H,
      createTypeMethods(H),
      createStringMethods(H),
      createArrayMethods(H),
      createObjectMethods(H, app),
      createDateMethods(H),
      createNumberMethods(H),
      createValidationMethods(H),
      createDomMethods(H),
      createDataMethods(H),
      createAsyncMethods(H, _timerCancels),
      createEventMethods(H),
      createIdMethods(H, app)
    );
    if (typeof app.namespace === "function") {
      try {
        app.namespace("helpers", H);
      } catch (e) {
        logWarn("Failed to register namespace", e);
      }
    }
    app.$h = H;
    if (typeof app.provide === "function") {
      try {
        app.provide("helper", H);
        app.provide("$h", H);
      } catch (e) {
        logWarn("Failed to provide $h", e);
      }
    }
    const bus = app.$bus || app.bus || typeof window !== "undefined" && window.Helix && window.Helix.$bus;
    if (bus && typeof bus.emit === "function") {
      try {
        bus.emit("plugin:helpers:installed", { version: HelixHelpersPlugin.version });
      } catch (e) {
        logWarn("Failed to emit install event", e);
      }
    }
    if (typeof window !== "undefined") {
      window.HelixHelpers = H;
    }
    const cleanup2 = () => {
      _timerCancels.forEach((cancel) => {
        try {
          cancel();
        } catch (e) {
        }
      });
      _timerCancels.clear();
      if (typeof window !== "undefined") {
        delete window.HelixHelpers;
      }
      if (app.$h === H)
        delete app.$h;
      if (app._provides) {
        if (app._provides["$h"] === H)
          delete app._provides["$h"];
        if (app._provides["helper"] === H)
          delete app._provides["helper"];
      }
      if (app.provides) {
        if (app.provides["$h"] === H)
          delete app.provides["$h"];
        if (app.provides["helper"] === H)
          delete app.provides["helper"];
      }
      if (bus && typeof bus.emit === "function") {
        try {
          bus.emit("plugin:helpers:destroyed");
        } catch (e) {
          logWarn("Failed to emit destroy event", e);
        }
      }
    };
    return cleanup2;
  }
};
var root2 = typeof window !== "undefined" ? window : globalThis;
root2.HelixHelpersPlugin = HelixHelpersPlugin;
var src_default2 = HelixHelpersPlugin;

// packages/helix-fetch/src/utils.js
var normalizeHeaders = (h = {}) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
var resolveHeaders = (method, cfg, req, override) => ({
  ...normalizeHeaders(cfg.common),
  ...normalizeHeaders(cfg[method.toLowerCase()]),
  ...normalizeHeaders(req),
  ...normalizeHeaders(override)
});
var buildSearchParams = (obj) => {
  const sp = new URLSearchParams();
  const appendRecursive = (val, prefix = "") => {
    if (val === null || val === void 0)
      return;
    if (val instanceof Date) {
      sp.append(prefix, val.toISOString());
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, index) => {
        if (typeof item === "object" && item !== null && !(item instanceof Date) && !isFile(item)) {
          appendRecursive(item, `${prefix}[${index}]`);
        } else {
          appendRecursive(item, `${prefix}[]`);
        }
      });
      return;
    }
    if (typeof val === "object" && !isFile(val)) {
      Object.keys(val).forEach((key) => {
        const fullKey = prefix ? `${prefix}[${key}]` : key;
        appendRecursive(val[key], fullKey);
      });
      return;
    }
    sp.append(prefix, val);
  };
  if (obj && typeof obj === "object") {
    Object.keys(obj).forEach((key) => {
      appendRecursive(obj[key], key);
    });
  }
  return sp;
};
var isFile = (val) => typeof File !== "undefined" && val instanceof File || typeof Blob !== "undefined" && val instanceof Blob || typeof FileList !== "undefined" && val instanceof FileList;
var containsFiles = (obj) => {
  if (!obj || typeof obj !== "object")
    return false;
  if (isFile(obj))
    return true;
  if (Array.isArray(obj))
    return obj.some(containsFiles);
  return Object.values(obj).some(containsFiles);
};
var objectToFormData = (obj, form = new FormData(), namespace = "") => {
  if (!obj || typeof obj !== "object" || obj instanceof Date || isFile(obj)) {
    form.append(namespace, obj === null ? "" : obj);
  } else {
    Object.keys(obj).forEach((prop) => {
      const formKey = namespace ? `${namespace}[${prop}]` : prop;
      objectToFormData(obj[prop], form, formKey);
    });
  }
  return form;
};
var serializeForm = (formElement, emptyAsNull = true) => {
  const result = {};
  const castValue = (val, type) => {
    if (type === "number")
      return val === "" ? null : Number(val);
    if (type === "boolean")
      return !["false", "0", "", null].includes(val);
    if (type === "null")
      return val || null;
    if (type === "array" || type === "object") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  };
  const deepAssign = (target, pathArray, value) => {
    let current = target;
    pathArray.forEach((key, index) => {
      if (index === pathArray.length - 1) {
        if (key === "") {
          if (!Array.isArray(current))
            return;
          current.push(value);
        } else if (current[key] !== void 0) {
          if (!Array.isArray(current[key]))
            current[key] = [current[key]];
          current[key].push(value);
        } else
          current[key] = value;
      } else {
        if (key === "")
          key = current.length;
        if (!current[key])
          current[key] = pathArray[index + 1] === "" ? [] : {};
        current = current[key];
      }
    });
  };
  formElement.querySelectorAll("input, select, textarea").forEach((field) => {
    if (!field.name || field.disabled || field.closest("fieldset[disabled]"))
      return;
    const type = field.type?.toLowerCase?.() || "";
    if (["submit", "button", "reset"].includes(type))
      return;
    let value;
    if (type === "checkbox") {
      if (field.checked)
        value = !field.hasAttribute("value") || field.value;
      else
        return;
    } else if (type === "radio") {
      if (!field.checked)
        return;
      value = field.value;
    } else if (type === "file") {
      if (field.files.length === 0)
        return;
      value = field.multiple ? Array.from(field.files) : field.files[0];
    } else {
      value = field.tagName === "SELECT" && field.multiple ? Array.from(field.selectedOptions).map((o) => o.value) : field.value;
    }
    if (value === "" && emptyAsNull)
      value = null;
    let rawName = field.name, castType = null;
    if (rawName.includes(":")) {
      const p = rawName.split(":");
      castType = p.pop();
      rawName = p.join(":");
    }
    if (type !== "file" && !(value instanceof File))
      value = castValue(value, castType);
    const pathArray = rawName.replace(/\]/g, "").split("[");
    deepAssign(result, pathArray, value);
  });
  return result;
};
var prepareSmartPayload = (body, headers) => {
  let activeBody = body, activeHeaders = { ...headers };
  if (typeof HTMLFormElement !== "undefined" && activeBody instanceof HTMLFormElement)
    activeBody = serializeForm(activeBody);
  if (typeof FormData !== "undefined" && activeBody instanceof FormData) {
    delete activeHeaders["content-type"];
    return { payload: activeBody, headers: activeHeaders };
  }
  if (activeBody && typeof activeBody === "object") {
    if (containsFiles(activeBody)) {
      activeBody = objectToFormData(activeBody);
      delete activeHeaders["content-type"];
    } else {
      const type = (activeHeaders["content-type"] || "").toLowerCase();
      if (type.includes("application/x-www-form-urlencoded"))
        activeBody = buildSearchParams(activeBody).toString();
      else
        activeBody = JSON.stringify(activeBody);
    }
  }
  return { payload: activeBody, headers: activeHeaders };
};
var buildUrl = (url, params) => {
  if (!params)
    return url;
  const q = buildSearchParams(params).toString();
  if (!q)
    return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${q}`;
};
var generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
};
var withEventEmitter = (obj) => {
  const successSubscribers = /* @__PURE__ */ new Set(), errorSubscribers = /* @__PURE__ */ new Set();
  obj.onSuccess = (fn) => {
    successSubscribers.add(fn);
    return obj;
  };
  obj.onError = (fn) => {
    errorSubscribers.add(fn);
    return obj;
  };
  obj.clearListeners = () => {
    successSubscribers.clear();
    errorSubscribers.clear();
  };
  obj.emitSuccess = (data, state) => successSubscribers.forEach((fn) => fn(data, state));
  obj.emitError = (err, state) => errorSubscribers.forEach((fn) => fn(err, state));
  return obj;
};
var fastStableStringify = (obj, seen = null) => {
  if (obj === null || typeof obj !== "object")
    return JSON.stringify(obj);
  if (obj instanceof Date)
    return JSON.stringify(obj.toISOString());
  if (obj instanceof RegExp)
    return JSON.stringify(obj.toString());
  if (obj instanceof URLSearchParams)
    return JSON.stringify(obj.toString());
  if (!seen)
    seen = /* @__PURE__ */ new WeakSet();
  if (seen.has(obj))
    return '"[Circular]"';
  seen.add(obj);
  let result;
  if (Array.isArray(obj)) {
    result = "[" + obj.map((v) => fastStableStringify(v, seen)).join(",") + "]";
  } else if (obj instanceof Map) {
    const entries = Array.from(obj.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    result = "Map{" + entries.map(([k, v]) => fastStableStringify(k, seen) + ":" + fastStableStringify(v, seen)).join(",") + "}";
  } else if (obj instanceof Set) {
    const items = Array.from(obj).sort((a, b) => String(a).localeCompare(String(b)));
    result = "Set[" + items.map((v) => fastStableStringify(v, seen)).join(",") + "]";
  } else {
    const keys = Object.keys(obj).sort();
    result = "{" + keys.map((k) => JSON.stringify(k) + ":" + fastStableStringify(obj[k], seen)).join(",") + "}";
  }
  seen.delete(obj);
  return result;
};
var isCacheableBody = (body) => !(typeof FormData !== "undefined" && body instanceof FormData || typeof Blob !== "undefined" && body instanceof Blob || typeof File !== "undefined" && body instanceof File || typeof HTMLFormElement !== "undefined" && body instanceof HTMLFormElement);
var UNCACHEABLE_MARKER = "__UNCACHEABLE__";
var hashLargeBody = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
};
var getCacheKey = (config, method, base, url, params, body, headers, cacheHeaders = []) => {
  let bodyStr = UNCACHEABLE_MARKER;
  if (isCacheableBody(body)) {
    const bodyJson = fastStableStringify(body);
    bodyStr = bodyJson.length > 102400 ? "__LARGE_BODY_" + bodyJson.length + "_" + hashLargeBody(bodyJson) + "__" : bodyJson;
  }
  const sanitizedHeaders = { ...normalizeHeaders(headers) };
  if (config.requestIdHeader)
    delete sanitizedHeaders[config.requestIdHeader.toLowerCase()];
  if (config.traceIdHeader)
    delete sanitizedHeaders[config.traceIdHeader.toLowerCase()];
  let headerStr;
  if (cacheHeaders.length > 0) {
    const filtered = {};
    for (const h of cacheHeaders) {
      const key = h.toLowerCase();
      if (sanitizedHeaders[key] !== void 0)
        filtered[key] = sanitizedHeaders[key];
    }
    headerStr = fastStableStringify(filtered);
  } else
    headerStr = fastStableStringify(sanitizedHeaders);
  return `${method}|${base}|${url}|${fastStableStringify(params)}|${bodyStr}|${headerStr}`;
};
var estimateObjectSize = (obj) => {
  if (obj === null || obj === void 0)
    return 0;
  if (typeof obj === "boolean")
    return 4;
  if (typeof obj === "number")
    return 8;
  if (typeof obj === "string")
    return obj.length * 2;
  if (typeof obj === "function")
    return 0;
  if (obj instanceof Date)
    return 64;
  if (obj instanceof RegExp)
    return obj.source.length * 2 + 64;
  if (obj instanceof ArrayBuffer)
    return obj.byteLength;
  if (obj instanceof Blob)
    return obj.size;
  let size = 0;
  const seen = /* @__PURE__ */ new WeakSet();
  const calc = (o) => {
    if (o === null || o === void 0)
      return;
    if (typeof o === "object") {
      if (seen.has(o))
        return;
      seen.add(o);
    }
    if (Array.isArray(o)) {
      size += o.length * 8;
      o.forEach(calc);
    } else if (o instanceof Map) {
      size += o.size * 16;
      o.forEach((v, k) => {
        calc(k);
        calc(v);
      });
    } else if (o instanceof Set) {
      size += o.size * 8;
      o.forEach(calc);
    } else if (typeof o === "object") {
      size += Object.keys(o).length * 16;
      Object.values(o).forEach(calc);
    } else
      size += estimateObjectSize(o);
  };
  calc(obj);
  return size;
};

// packages/helix-fetch/src/error.js
var classifyError = (err) => {
  if (!err)
    return "unknown";
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return "offline";
  const msg = (err.message || "").toLowerCase();
  const name = err.name || "";
  if (msg.includes("offline") || msg.includes("network"))
    return "offline";
  if (name === "AbortError")
    return msg.includes("timeout") ? "timeout" : "transport";
  if (msg.includes("dns") || msg.includes("enotfound") || msg.includes("getaddrinfo"))
    return "dns";
  if (msg.includes("fetch") || msg.includes("failed to fetch"))
    return "transport";
  const status = err.status || 0;
  if (status === 0)
    return "transport";
  if (status === 401 || status === 403)
    return "auth";
  if (status === 408)
    return "timeout";
  if (status === 409)
    return "conflict";
  if (status === 422 || status === 400)
    return "validation";
  if (status >= 500)
    return "server";
  if (status >= 400)
    return "client";
  return "unknown";
};
var FetchError = class extends Error {
  constructor(message, cfg, status, data, request, classification = null, trace2 = null) {
    super(message);
    this.name = "FetchError";
    this.config = cfg;
    this.status = status;
    this.data = data;
    this.request = request;
    this.timestamp = Date.now();
    this.classification = classification || classifyError(this);
    this.trace = trace2 || { requestId: generateId(), traceId: generateId(), spanId: generateId() };
  }
};

// packages/helix-fetch/src/engines.js
function createEngines(app, config, emit, requestInterceptors, responseInterceptors) {
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const debugLogResponse = (cfg, info) => {
    if (!cfg.debugResponse)
      return;
    if (typeof console.groupCollapsed === "function")
      console.groupCollapsed(`%c[Helix Fetch Debug]`, "color:#ff4d4f;font-weight:bold");
    console.log("URL:", info.url);
    console.log("Method:", info.method);
    console.log("Status:", info.status);
    if (info.trace)
      console.log("Trace:", info.trace);
    if (info.reason)
      console.warn("Reason:", info.reason);
    if (info.classification)
      console.warn("Classification:", info.classification);
    console.log("Raw Response:", info.raw);
    if (typeof console.groupEnd === "function")
      console.groupEnd();
  };
  const cacheStore = /* @__PURE__ */ new Map();
  const cacheEngine = config.cache === true ? {
    get(key, staleTime) {
      const entry = cacheStore.get(key);
      if (!entry || Date.now() > entry.expiry) {
        if (entry)
          cacheStore.delete(key);
        return null;
      }
      const stale = staleTime > 0 && Date.now() - entry.timestamp > staleTime;
      if (!stale)
        emit("cache:hit", { key, entry });
      else
        emit("cache:stale", { key, entry });
      return { data: entry.data, stale };
    },
    set(key, data, ttl, tags = []) {
      this._trim();
      cacheStore.set(key, {
        data,
        expiry: Date.now() + ttl,
        timestamp: Date.now(),
        tags,
        size: config.memoryCache ? estimateObjectSize(data) : 0
      });
      emit("cache:set", { key, ttl, tags });
    },
    invalidate(tagOrPart) {
      for (const [k, v] of cacheStore.entries()) {
        if (v.tags?.includes(tagOrPart) || k.includes(tagOrPart)) {
          cacheStore.delete(k);
          emit("cache:invalidate", { key: k, tag: tagOrPart });
        }
      }
    },
    invalidateExact(key) {
      cacheStore.delete(key);
      emit("cache:invalidate", { key });
    },
    clear() {
      cacheStore.clear();
      emit("cache:clear");
    },
    _trim(maxEntries = config.maxCacheEntries, maxMemory = config.maxCacheMemory) {
      if (cacheStore.size >= maxEntries) {
        const toRemove = cacheStore.size - maxEntries + Math.floor(maxEntries * 0.2);
        [...cacheStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, toRemove).forEach(([k]) => cacheStore.delete(k));
      }
      if (config.memoryCache) {
        let totalMemory = 0;
        for (const [, v] of cacheStore.entries())
          totalMemory += v.size || 0;
        if (totalMemory > maxMemory) {
          const sorted = [...cacheStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
          while (totalMemory > maxMemory * 0.8 && sorted.length > 0) {
            const [k, v] = sorted.shift();
            totalMemory -= v.size || 0;
            cacheStore.delete(k);
          }
        }
      }
    }
  } : null;
  const pendingRequests = /* @__PURE__ */ new Map();
  const dedupeEngine = {
    get(key) {
      return pendingRequests.get(key);
    },
    acquire(key, promise, controller) {
      const existing = pendingRequests.get(key);
      if (existing) {
        existing.consumers++;
        return existing.promise;
      }
      pendingRequests.set(key, { promise, controller, consumers: 1 });
      emit("dedupe:set", { key });
      return promise;
    },
    release(key) {
      const entry = pendingRequests.get(key);
      if (!entry)
        return;
      entry.consumers--;
      if (entry.consumers <= 0) {
        pendingRequests.delete(key);
        emit("dedupe:delete", { key });
      }
    },
    abort(key) {
      const entry = pendingRequests.get(key);
      if (entry) {
        entry.controller?.abort();
        pendingRequests.delete(key);
        emit("dedupe:delete", { key });
      }
    },
    clear() {
      pendingRequests.clear();
    }
  };
  let activeRequests = 0;
  let queueEngine = null;
  if (config.queue === true) {
    class PriorityHeap {
      constructor(comparator) {
        this.heap = [];
        this.comparator = comparator;
      }
      push(item) {
        item._effectivePriority = (item.priority || 0) + Math.floor((Date.now() - item.enqueuedAt) / config.priorityAgingMs);
        this.heap.push(item);
        this._siftUp(this.heap.length - 1);
      }
      pop() {
        if (this.heap.length === 0)
          return void 0;
        const top = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
          this.heap[0] = end;
          this._siftDown(0);
        }
        return top;
      }
      remove(item) {
        const idx = this.heap.indexOf(item);
        if (idx === -1)
          return false;
        const end = this.heap.pop();
        if (idx < this.heap.length) {
          this.heap[idx] = end;
          if (this.comparator(end, item) < 0)
            this._siftUp(idx);
          else
            this._siftDown(idx);
        }
        return true;
      }
      get length() {
        return this.heap.length;
      }
      _siftUp(i) {
        const item = this.heap[i];
        while (i > 0) {
          const parent = i - 1 >> 1;
          if (this.comparator(item, this.heap[parent]) >= 0)
            break;
          this.heap[i] = this.heap[parent];
          i = parent;
        }
        this.heap[i] = item;
      }
      _siftDown(i) {
        const len = this.heap.length, item = this.heap[i];
        while (true) {
          let child = (i << 1) + 1;
          if (child >= len)
            break;
          const right = child + 1;
          if (right < len && this.comparator(this.heap[right], this.heap[child]) < 0)
            child = right;
          if (this.comparator(item, this.heap[child]) <= 0)
            break;
          this.heap[i] = this.heap[child];
          i = child;
        }
        this.heap[i] = item;
      }
    }
    const requestQueue = new PriorityHeap((a, b) => b._effectivePriority - a._effectivePriority);
    queueEngine = {
      enqueue(fn, priority = 0) {
        if (activeRequests < config.maxConcurrent) {
          activeRequests++;
          const promise2 = fn().finally(() => {
            activeRequests--;
            this.process();
          });
          return { promise: promise2, item: null };
        }
        let item = null;
        const promise = new Promise((resolve, reject) => {
          item = { run: fn, priority, resolve, reject, enqueuedAt: Date.now(), aborted: false };
          if (config.queueStrategy === "fifo")
            item.priority = 0;
          requestQueue.push(item);
          emit("queue:enqueue", { priority, queueLength: requestQueue.length });
        });
        return { promise, item };
      },
      process() {
        while (activeRequests < config.maxConcurrent && requestQueue.length > 0) {
          const next = requestQueue.pop();
          if (!next || next.aborted) {
            if (next)
              try {
                next.reject(new FetchError("Request cancelled", null, 0, null, null));
              } catch {
              }
            continue;
          }
          activeRequests++;
          emit("queue:dequeue", { activeRequests, queueLength: requestQueue.length });
          next.run().then(next.resolve, next.reject).finally(() => {
            activeRequests--;
            this.process();
          });
        }
      },
      remove(item) {
        if (!item)
          return;
        const inHeap = requestQueue.remove(item);
        if (inHeap) {
          item.aborted = true;
          try {
            item.reject(new FetchError("Request cancelled", null, 0, null, null));
          } catch {
          }
          emit("queue:remove", { queueLength: requestQueue.length });
        }
      },
      clear() {
        while (requestQueue.length > 0) {
          const item = requestQueue.pop();
          if (item)
            try {
              item.reject(new FetchError("Plugin destroyed", null, 0, null, null));
            } catch {
            }
        }
        activeRequests = 0;
      }
    };
  }
  let visibilityEngine = null;
  if (config.polling === true && typeof document !== "undefined") {
    const visibilitySubscribers = /* @__PURE__ */ new Set();
    let isGloballyVisible = !document.hidden;
    let globalVisibilityAttached = false;
    visibilityEngine = {
      handler() {
        const wasHidden = !isGloballyVisible;
        isGloballyVisible = !document.hidden;
        visibilitySubscribers.forEach((sub) => {
          try {
            sub(isGloballyVisible, wasHidden);
          } catch (e) {
          }
        });
      },
      attach() {
        if (!globalVisibilityAttached) {
          document.addEventListener("visibilitychange", this.handler);
          globalVisibilityAttached = true;
        }
      },
      detach() {
        if (globalVisibilityAttached) {
          document.removeEventListener("visibilitychange", this.handler);
          globalVisibilityAttached = false;
          visibilitySubscribers.clear();
        }
      },
      subscribe(fn) {
        visibilitySubscribers.add(fn);
        this.attach();
      },
      unsubscribe(fn) {
        visibilitySubscribers.delete(fn);
        if (visibilitySubscribers.size === 0)
          this.detach();
      }
    };
  }
  const activeLoaderTokens = /* @__PURE__ */ new Set();
  const loaderEngine = {
    show(token) {
      activeLoaderTokens.add(token);
      if (activeLoaderTokens.size === 1)
        app.$loader?.show?.();
    },
    hide(token) {
      activeLoaderTokens.delete(token);
      if (activeLoaderTokens.size === 0)
        app.$loader?.hide?.();
    },
    reset() {
      activeLoaderTokens.clear();
      app.$loader?.hide?.();
    }
  };
  const retryEngine = config.retry === true ? {
    async run(fn, retries, delay, condition, traceContext = {}) {
      let attempt = 0;
      while (true) {
        try {
          return await fn();
        } catch (err) {
          const normalized = err instanceof FetchError ? err : new FetchError(err.message || "Network error", null, err.status || 0, null, null, null, traceContext);
          if (!condition(normalized) || attempt >= retries)
            throw err;
          emit("retry:attempt", { attempt: attempt + 1, delay: delay * Math.pow(2, attempt), err: normalized });
          await sleep2(delay * Math.pow(2, attempt) + Math.random() * 100);
          attempt++;
        }
      }
    }
  } : null;
  const parseEngine = {
    async run(res, type, reqConfig = {}, requestInfo = {}) {
      if (res.status === 204)
        return null;
      if (type === "blob")
        return res.blob();
      if (type === "arraybuffer")
        return res.arrayBuffer();
      if (type === "text")
        return res.text();
      if (type === "stream")
        return res.body;
      let text = await res.text();
      const raw = text.trim();
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      let parsed = null, parseError = false;
      try {
        parsed = raw === "" ? null : JSON.parse(raw);
      } catch {
        parseError = true;
      }
      if (!parseError)
        return parsed;
      if (ct.includes("text/html") || raw.startsWith("<!DOCTYPE html>") || raw.startsWith("<html")) {
        const cleaned = raw.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "").trim();
        debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw: cleaned, reason: "HTML returned instead of JSON" });
        throw new FetchError("Server returned HTML instead of JSON", null, res.status, cleaned, requestInfo, "parse");
      }
      const stripped = raw.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "").trim();
      if (stripped !== raw) {
        try {
          return stripped === "" ? null : JSON.parse(stripped);
        } catch {
        }
      }
      debugLogResponse(reqConfig, { ...requestInfo, status: res.status, raw, reason: "JSON parse failed" });
      throw new FetchError("Invalid JSON response", null, res.status, raw, requestInfo, "parse");
    }
  };
  const interceptorEngine = {
    request(req) {
      let out = req;
      for (const fn of requestInterceptors)
        out = fn(out) || out;
      return out;
    },
    response(data, res) {
      let out = data;
      for (const fn of responseInterceptors)
        out = fn(out, res) || out;
      return out;
    }
  };
  async function fetchTransport(req, options, controller, state) {
    let fetchPromise;
    if (options.onDownloadProgress) {
      fetchPromise = fetch(req.url, req).then(async (res) => {
        const contentLength = +(res.headers.get("content-length") || 0);
        if (!contentLength || !res.body)
          return res;
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          chunks.push(value);
          received += value.length;
          if ("progress" in state)
            state.progress = Math.round(received / contentLength * 100);
          options.onDownloadProgress(state.progress, received, contentLength);
        }
        const blob = new Blob(chunks);
        return new Response(blob, { status: res.status, statusText: res.statusText, headers: res.headers, ok: res.ok, redirected: res.redirected, type: res.type, url: res.url });
      });
    } else {
      fetchPromise = fetch(req.url, req);
    }
    return fetchPromise;
  }
  let xhrTransport = null;
  if (config.upload === true) {
    xhrTransport = function(req, options, controller, state) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(req.method, req.url, true);
        Object.entries(req.headers).forEach(([k, v]) => {
          if (k.toLowerCase() !== "content-type" || v)
            xhr.setRequestHeader(k, v);
        });
        if (options.onUploadProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              if ("progress" in state)
                state.progress = Math.round(e.loaded / e.total * 100);
              options.onUploadProgress(state.progress, e.loaded, e.total);
            }
          };
        }
        if (options.onDownloadProgress) {
          xhr.onprogress = (e) => {
            if (e.lengthComputable) {
              if ("progress" in state)
                state.progress = Math.round(e.loaded / e.total * 100);
              options.onDownloadProgress(state.progress, e.loaded, e.total);
            }
          };
        }
        xhr.onload = () => {
          const headers = /* @__PURE__ */ new Map();
          const rawHeaders = xhr.getAllResponseHeaders().trim();
          if (rawHeaders) {
            rawHeaders.split(/\r?\n/).forEach((line) => {
              const idx = line.indexOf(":");
              if (idx > 0)
                headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
            });
          }
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            url: req.url,
            headers: {
              get: (name) => headers.get(name.toLowerCase()) || null,
              has: (name) => headers.has(name.toLowerCase()),
              forEach: (fn) => headers.forEach((v, k) => fn(v, k)),
              entries: () => headers.entries(),
              keys: () => headers.keys(),
              values: () => headers.values()
            },
            text: () => Promise.resolve(xhr.responseText),
            json: () => {
              try {
                return Promise.resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                return Promise.reject(e);
              }
            },
            blob: () => Promise.resolve(new Blob([xhr.response])),
            arrayBuffer: () => Promise.resolve(xhr.response),
            clone: () => ({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText,
              url: req.url,
              headers: {
                get: (name) => headers.get(name.toLowerCase()) || null,
                has: (name) => headers.has(name.toLowerCase()),
                forEach: (fn) => headers.forEach((v, k) => fn(v, k)),
                entries: () => headers.entries(),
                keys: () => headers.keys(),
                values: () => headers.values()
              },
              text: () => Promise.resolve(xhr.responseText),
              json: () => {
                try {
                  return Promise.resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                  return Promise.reject(e);
                }
              },
              blob: () => Promise.resolve(new Blob([xhr.response])),
              arrayBuffer: () => Promise.resolve(xhr.response)
            })
          });
        };
        xhr.onerror = () => reject(new FetchError("Network error", req, 0, null, req, "transport"));
        xhr.onabort = () => reject(new FetchError("Request aborted", req, 0, null, req, "transport"));
        xhr.ontimeout = () => reject(new FetchError("Timeout exceeded", req, 0, null, req, "timeout"));
        const onAbort = () => {
          if (xhr.readyState !== 4)
            xhr.abort();
        };
        controller.signal.addEventListener("abort", onAbort);
        xhr.send(req.body);
      });
    };
  }
  return {
    cacheEngine,
    dedupeEngine,
    queueEngine,
    visibilityEngine,
    loaderEngine,
    retryEngine,
    parseEngine,
    interceptorEngine,
    fetchTransport,
    xhrTransport,
    debugLogResponse
  };
}

// packages/helix-fetch/src/request.js
function makeCreateRequest(app, config, emit, engines) {
  const { reactive: reactive2, getCurrentInstance: getCurrentInstance2 } = typeof Helix !== "undefined" ? Helix : app;
  const {
    cacheEngine,
    dedupeEngine,
    queueEngine,
    visibilityEngine,
    loaderEngine,
    retryEngine,
    parseEngine,
    interceptorEngine,
    fetchTransport,
    xhrTransport
  } = engines;
  let activeRequests = 0;
  return function createRequest(method, url, initialBody = null, reqOptions = {}) {
    return function useRequest() {
      const callerInstance = typeof getCurrentInstance2 === "function" ? getCurrentInstance2() : null;
      const innerState = {
        data: null,
        error: null,
        loading: false,
        isFetching: false,
        status: null,
        isIdle: true,
        isSuccess: false,
        isError: false
      };
      const mayCache = config.cache === true && reqOptions.cache !== false;
      if (mayCache)
        innerState.isStale = false;
      const mayPoll = config.polling === true && (reqOptions.pollInterval ?? config.pollInterval) > 0;
      if (mayPoll) {
        innerState.isPolling = false;
        innerState.isPaused = false;
      }
      const mayProgress = reqOptions.onDownloadProgress || reqOptions.onUploadProgress;
      if (mayProgress)
        innerState.progress = 0;
      const state = reactive2(innerState);
      const stateInstance = withEventEmitter(state);
      let activeController, timeoutId, lastPromise, pollTimer, debounceTimer, pendingDebounce, inFlightCount = 0;
      let visibilityHandler = null;
      let queueItem = null;
      const loaderToken = generateId();
      const performFetch = async (background = false, variables = null, pollTick = false) => {
        const shouldDedupe = pollTick ? false : reqOptions.dedupe !== void 0 ? reqOptions.dedupe : method === "GET" || method === "HEAD";
        state.isIdle = false;
        state.isSuccess = false;
        state.isError = false;
        inFlightCount++;
        activeController = new AbortController();
        let didTimeout = false;
        const activeBase = reqOptions.baseURL ?? config.baseURL;
        const finalUrl = buildUrl(/^(?:[a-z+]+:)?\/\//i.test(url) ? url : activeBase + url, reqOptions.params);
        let rawHeaders = resolveHeaders(method, config.headers, reqOptions.headers);
        const combinedBody = method === "GET" || method === "HEAD" ? null : variables || initialBody;
        let processedPayload = null;
        if (combinedBody && method !== "GET" && method !== "HEAD") {
          const smart = prepareSmartPayload(combinedBody, rawHeaders);
          processedPayload = smart.payload;
          rawHeaders = smart.headers;
        }
        let traceContext = null;
        if (config.debug === true && config.enableTracing) {
          traceContext = {
            requestId: generateId(),
            traceId: reqOptions.traceId || generateId(),
            spanId: generateId(),
            parentSpanId: reqOptions.parentSpanId || null
          };
          rawHeaders[config.requestIdHeader] = traceContext.requestId;
          rawHeaders[config.traceIdHeader] = traceContext.traceId;
        }
        const shouldCache = config.cache === true && reqOptions.cache !== false && isCacheableBody(combinedBody);
        let cacheKey = null;
        if (shouldCache || shouldDedupe) {
          cacheKey = getCacheKey(config, method, activeBase, finalUrl, reqOptions.params, combinedBody, rawHeaders, reqOptions.cacheHeaders ?? config.cacheHeaders);
        }
        if (!background && shouldCache && cacheKey && cacheEngine) {
          const cached = cacheEngine.get(cacheKey, reqOptions.staleTime ?? config.staleTime);
          if (cached) {
            state.data = cached.data;
            if ("isStale" in state)
              state.isStale = cached.stale;
            if (!cached.stale) {
              emit("request:cachehit", { url: finalUrl, cacheKey });
              return cached.data;
            }
          }
        }
        if (shouldDedupe && cacheKey) {
          const existing = dedupeEngine.get(cacheKey);
          if (existing) {
            dedupeEngine.acquire(cacheKey, null, null);
            try {
              const result = await existing.promise;
              dedupeEngine.release(cacheKey);
              return result;
            } catch (err) {
              dedupeEngine.release(cacheKey);
              throw err;
            }
          }
        }
        const useLoader = !background && (reqOptions.loader ?? config.loader);
        if (useLoader && inFlightCount === 1)
          loaderEngine.show(loaderToken);
        if (!background)
          state.loading = true;
        state.isFetching = true;
        state.error = null;
        if ("progress" in state)
          state.progress = 0;
        emit("request:start", { url: finalUrl, method, background, cacheKey, trace: traceContext });
        const fetchFn = async () => {
          try {
            let req = { url: finalUrl, method, headers: rawHeaders, body: processedPayload, signal: activeController.signal };
            req = interceptorEngine.request(req);
            const timeout = reqOptions.timeout ?? config.timeout;
            if (timeout > 0)
              timeoutId = setTimeout(() => {
                didTimeout = true;
                activeController.abort();
              }, timeout);
            const isXHR = reqOptions.transport === "xhr" && xhrTransport;
            const transportFn = isXHR ? xhrTransport : fetchTransport;
            const res = await (retryEngine ? retryEngine.run(async () => {
              const r = await transportFn(req, reqOptions, activeController, state);
              clearTimeout(timeoutId);
              const validate = reqOptions.validateStatus || config.validateStatus;
              if (!validate(r.status)) {
                let errData = null;
                try {
                  errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req);
                } catch {
                }
                throw new FetchError(`Request failed with status ${r.status}`, req, r.status, errData, req, null, traceContext);
              }
              return r;
            }, reqOptions.retry ?? config.retryCount, reqOptions.retryDelay ?? config.retryDelay, reqOptions.retryCondition ?? config.retryCondition, traceContext) : (async () => {
              const r = await transportFn(req, reqOptions, activeController, state);
              clearTimeout(timeoutId);
              const validate = reqOptions.validateStatus || config.validateStatus;
              if (!validate(r.status)) {
                let errData = null;
                try {
                  errData = await parseEngine.run(r.clone ? r.clone() : r, reqOptions.responseType || config.responseType, reqOptions, req);
                } catch {
                }
                throw new FetchError(`Request failed with status ${r.status}`, req, r.status, errData, req, null, traceContext);
              }
              return r;
            })());
            if (!background)
              state.status = res.status;
            let data = await parseEngine.run(res, reqOptions.responseType || config.responseType, reqOptions, req);
            data = interceptorEngine.response(data, res);
            state.data = data;
            if ("isStale" in state)
              state.isStale = false;
            state.isSuccess = true;
            emit("request:success", { url: finalUrl, method, status: res.status, data, cacheKey, trace: traceContext });
            if (shouldCache && cacheKey && cacheEngine)
              cacheEngine.set(cacheKey, data, reqOptions.ttl ?? config.ttl, reqOptions.tags || []);
            if (reqOptions.invalidateTags) {
              const tags = Array.isArray(reqOptions.invalidateTags) ? reqOptions.invalidateTags : [reqOptions.invalidateTags];
              for (const tag of tags)
                if (cacheEngine)
                  cacheEngine.invalidate(tag);
            }
            if (reqOptions.onSuccess)
              reqOptions.onSuccess(data, state);
            stateInstance.emitSuccess(data, state);
            return data;
          } catch (err) {
            clearTimeout(timeoutId);
            let finalErr = err;
            if (err.name === "AbortError") {
              finalErr = new FetchError(didTimeout ? "Timeout exceeded" : "Request aborted", { url: finalUrl, method }, null, null, { url: finalUrl, method }, didTimeout ? "timeout" : "transport", traceContext);
            } else if (!(err instanceof FetchError)) {
              finalErr = new FetchError(err.message, null, err.status || 0, null, null, null, traceContext);
            }
            state.error = finalErr;
            state.isError = true;
            emit("request:error", { url: finalUrl, method, error: finalErr, classification: finalErr.classification, trace: traceContext });
            if (reqOptions.onError)
              reqOptions.onError(finalErr, state);
            stateInstance.emitError(finalErr, state);
            engines.debugLogResponse(reqOptions, { url: finalUrl, method, status: finalErr.status, reason: finalErr.message, classification: finalErr.classification, trace: finalErr.trace });
            throw finalErr;
          } finally {
            if (shouldDedupe && cacheKey)
              dedupeEngine.release(cacheKey);
            lastPromise = null;
            inFlightCount = Math.max(0, inFlightCount - 1);
            if (inFlightCount <= 0) {
              state.isFetching = false;
              if (!background)
                state.loading = false;
              if (useLoader)
                loaderEngine.hide(loaderToken);
            }
            emit("request:end", { url: finalUrl, method, cacheKey });
          }
        };
        let wrappedFetch = fetchFn;
        if (shouldDedupe && cacheKey) {
          const dedupePromise = new Promise((resolve, reject) => {
            fetchFn().then(resolve).catch(reject);
          });
          dedupeEngine.acquire(cacheKey, dedupePromise, activeController);
          wrappedFetch = () => dedupePromise;
        }
        let promise;
        if (queueEngine) {
          const { promise: qPromise, item } = queueEngine.enqueue(wrappedFetch, reqOptions.priority);
          queueItem = item;
          if (queueItem) {
            qPromise.then(() => queueEngine.remove(queueItem)).catch(() => queueEngine.remove(queueItem));
          }
          promise = qPromise;
        } else {
          activeRequests++;
          promise = wrappedFetch().finally(() => {
            activeRequests--;
          });
        }
        lastPromise = promise;
        return promise;
      };
      const execute = async (variables = null) => lastPromise ? lastPromise : performFetch(false, variables, false);
      const refetch = async (pollTick = false) => {
        const debounceMs = reqOptions.debounce ?? config.debounce;
        if (debounceMs > 0 && !pollTick) {
          clearTimeout(debounceTimer);
          if (pendingDebounce)
            pendingDebounce.reject(new FetchError("Debounced", null, null, null, null));
          return new Promise((resolve, reject) => {
            pendingDebounce = { resolve, reject };
            debounceTimer = setTimeout(() => {
              performFetch(true, null, false).then(resolve).catch(reject).finally(() => pendingDebounce = null);
            }, debounceMs);
          });
        }
        return performFetch(true, null, pollTick);
      };
      let startPolling, stopPolling, schedulePoll;
      if (config.polling === true) {
        schedulePoll = () => {
          if (pollTimer)
            return;
          const interval = reqOptions.pollInterval ?? config.pollInterval;
          if (!interval || interval <= 0 || state.isPaused)
            return;
          pollTimer = setTimeout(() => {
            pollTimer = null;
            if (typeof document !== "undefined" && document.hidden && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground)) {
              schedulePoll();
              return;
            }
            if (state.isFetching || state.isPaused) {
              schedulePoll();
              return;
            }
            refetch(true).catch(() => {
            }).finally(() => {
              if (state.isPolling)
                schedulePoll();
            });
          }, interval);
        };
        startPolling = () => {
          if (!("isPolling" in state))
            state.isPolling = false;
          if (!("isPaused" in state))
            state.isPaused = false;
          if (state.isPolling)
            return;
          state.isPolling = true;
          state.isPaused = false;
          schedulePoll();
        };
        stopPolling = () => {
          clearTimeout(pollTimer);
          pollTimer = null;
          if ("isPolling" in state)
            state.isPolling = false;
        };
        if (visibilityEngine) {
          visibilityHandler = (isVisible, wasHidden) => {
            if (isVisible && wasHidden) {
              if (reqOptions.refetchOnWindowFocus ?? config.refetchOnWindowFocus)
                refetch().catch(() => {
                });
              if ((reqOptions.pollInterval ?? config.pollInterval) && (!("isPolling" in state) || !state.isPolling) && (!("isPaused" in state) || !state.isPaused))
                startPolling();
            }
            if (!isVisible && "isPolling" in state && state.isPolling && !(reqOptions.refetchIntervalInBackground ?? config.refetchIntervalInBackground))
              stopPolling();
          };
          visibilityEngine.subscribe(visibilityHandler);
        }
      }
      stateInstance.execute = execute;
      stateInstance.refetch = () => refetch(false);
      if (config.polling === true) {
        stateInstance.startPolling = startPolling;
        stateInstance.stopPolling = stopPolling;
        stateInstance.pausePolling = () => {
          if ("isPaused" in state)
            state.isPaused = true;
        };
        stateInstance.resumePolling = () => {
          if ("isPaused" in state)
            state.isPaused = false;
          if ("isPolling" in state && state.isPolling)
            schedulePoll();
        };
      }
      stateInstance.cancel = () => {
        activeController?.abort();
        if (queueItem && queueEngine)
          queueEngine.remove(queueItem);
        emit("request:cancel", { url });
      };
      stateInstance.then = (f, r) => (lastPromise || execute()).then(f, r);
      stateInstance.catch = (r) => (lastPromise || execute()).catch(r);
      const runCleanup = () => {
        clearTimeout(timeoutId);
        clearTimeout(debounceTimer);
        if (pendingDebounce) {
          pendingDebounce.reject(new FetchError("Cleanup", null, null, null, null));
          pendingDebounce = null;
        }
        if (config.polling === true)
          stopPolling?.();
        if (visibilityHandler && visibilityEngine) {
          visibilityEngine.unsubscribe(visibilityHandler);
          visibilityHandler = null;
        }
        activeController?.abort();
        if (queueItem && queueEngine)
          queueEngine.remove(queueItem);
        loaderEngine.hide(loaderToken);
        stateInstance.clearListeners();
        emit("instance:cleanup", { url });
      };
      stateInstance._cleanup = runCleanup;
      if (callerInstance && Array.isArray(callerInstance.cleanups)) {
        callerInstance.cleanups.push(runCleanup);
      }
      if (!reqOptions.lazy) {
        if (config.polling === true && (reqOptions.pollInterval ?? config.pollInterval)) {
          execute().then(startPolling).catch(() => {
          });
        } else {
          execute().catch(() => {
          });
        }
      }
      return stateInstance;
    };
  };
}

// packages/helix-fetch/src/index.js
var HelixFetchPlugin = {
  name: "fetch",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "2.8.7" || "2.8.7",
  install(app, options = {}) {
    const { reactive: reactive2 } = typeof Helix !== "undefined" ? Helix : app;
    if (!reactive2) {
      console.error("[Helix Fetch] Core reactivity primitives missing from compilation runtime context.");
      return () => {
      };
    }
    const config = {
      debugResponse: false,
      baseURL: "",
      headers: {
        common: { "X-Requested-With": "XMLHttpRequest" },
        get: {},
        post: { "Content-Type": "application/json" },
        put: { "Content-Type": "application/json" },
        patch: { "Content-Type": "application/json" },
        delete: {}
      },
      cache: false,
      ttl: 5e3,
      staleTime: 0,
      maxCacheEntries: 500,
      maxCacheMemory: 50 * 1024 * 1024,
      cacheHeaders: [],
      memoryCache: false,
      retry: false,
      retryCount: 2,
      retryDelay: 300,
      retryCondition: (err) => {
        const c = err.classification;
        return c === "transport" || c === "dns" || c === "timeout" || c === "server" || c === "offline" || !err.status || err.status >= 500;
      },
      queue: false,
      maxConcurrent: 10,
      queueStrategy: "fifo",
      priorityAgingMs: 5e3,
      polling: false,
      pollInterval: 0,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
      upload: false,
      debug: false,
      enableTracing: false,
      traceIdHeader: "x-trace-id",
      requestIdHeader: "x-request-id",
      loader: false,
      timeout: 0,
      responseType: "json",
      validateStatus: (s) => s >= 200 && s < 300 || s === 304,
      debounce: 0,
      ...options
    };
    const bus = app.$bus || typeof window !== "undefined" && window.Helix && window.Helix.$bus;
    const emit = (event, payload) => {
      try {
        if (bus && typeof bus.emit === "function")
          bus.emit(`fetch:${event}`, payload);
      } catch (e) {
      }
    };
    const requestInterceptors = [];
    const responseInterceptors = [];
    const engines = createEngines(app, config, emit, requestInterceptors, responseInterceptors);
    const createRequest = makeCreateRequest(app, config, emit, engines);
    function upload(url, options2 = {}) {
      const merged = {
        ...options2,
        method: options2.method || "POST",
        dedupe: false,
        cache: false
      };
      if (config.upload === true && (options2.onProgress || options2.onUploadProgress)) {
        merged.transport = "xhr";
        merged.onUploadProgress = options2.onProgress || options2.onUploadProgress;
      }
      const body = options2.formData || options2.body || options2.data;
      return createRequest(merged.method, url, body, merged)();
    }
    const $fetch = {
      request: (cfg = {}) => {
        const { method = "GET", url = "", data = null, params, headers, ...rest } = cfg;
        if (!url)
          throw new FetchError("request() requires a URL", cfg, 0, null, null);
        return createRequest(method.toUpperCase(), url, data, { ...config, ...rest, headers, params })();
      },
      create: (instanceDefaults = {}) => {
        const instCfg = { ...config, ...instanceDefaults };
        const build = (method) => (url, body, opt) => createRequest(method, url, body, { ...instCfg, ...opt })();
        return {
          request: (cfg = {}) => {
            const { method = "GET", url = "", data = null, params, headers, ...rest } = cfg;
            if (!url)
              throw new FetchError("request() requires a URL", cfg, 0, null, null);
            return createRequest(method.toUpperCase(), url, data, { ...instCfg, ...rest, headers, params })();
          },
          get: build("GET"),
          post: build("POST"),
          put: build("PUT"),
          delete: build("DELETE"),
          patch: build("PATCH"),
          head: build("HEAD"),
          options: build("OPTIONS"),
          upload: (url, opt) => upload(url, { ...instCfg, ...opt }),
          defaults: instCfg,
          addRequestInterceptor: $fetch.addRequestInterceptor,
          addResponseInterceptor: $fetch.addResponseInterceptor,
          invalidate: $fetch.invalidate,
          invalidateExact: $fetch.invalidateExact,
          clearCache: $fetch.clearCache
        };
      },
      defaults: config,
      get: (url, opt) => createRequest("GET", url, null, { ...config, ...opt })(),
      post: (url, body, opt) => createRequest("POST", url, body, { ...config, ...opt })(),
      put: (url, body, opt) => createRequest("PUT", url, body, { ...config, ...opt })(),
      delete: (url, opt) => createRequest("DELETE", url, null, { ...config, ...opt })(),
      patch: (url, body, opt) => createRequest("PATCH", url, body, { ...config, ...opt })(),
      head: (url, opt) => createRequest("HEAD", url, null, { ...config, ...opt })(),
      options: (url, opt) => createRequest("OPTIONS", url, null, { ...config, ...opt })(),
      mutate: (url, opt) => createRequest(opt?.method || "POST", url, null, { ...config, lazy: true, ...opt })(),
      upload: (url, opt) => upload(url, { ...config, ...opt }),
      addRequestInterceptor: (fn) => {
        requestInterceptors.push(fn);
        return () => {
          const i = requestInterceptors.indexOf(fn);
          if (i !== -1)
            requestInterceptors.splice(i, 1);
        };
      },
      addResponseInterceptor: (fn) => {
        responseInterceptors.push(fn);
        return () => {
          const i = responseInterceptors.indexOf(fn);
          if (i !== -1)
            responseInterceptors.splice(i, 1);
        };
      },
      invalidate: (tagOrPart = "") => engines.cacheEngine ? engines.cacheEngine.invalidate(tagOrPart) : void 0,
      invalidateExact: (key) => engines.cacheEngine ? engines.cacheEngine.invalidateExact(key) : void 0,
      clearCache: () => engines.cacheEngine ? engines.cacheEngine.clear() : void 0
    };
    app.$fetch = $fetch;
    if (typeof app.namespace === "function") {
      try {
        app.namespace("fetch", {
          $fetch,
          addRequestInterceptor: $fetch.addRequestInterceptor,
          addResponseInterceptor: $fetch.addResponseInterceptor,
          invalidate: $fetch.invalidate,
          invalidateExact: $fetch.invalidateExact,
          clearCache: $fetch.clearCache
        });
      } catch (e) {
        console.warn("[HelixFetch] app.namespace() failed:", e.message);
      }
    }
    if (typeof app.provide === "function") {
      try {
        app.provide("$fetch", $fetch);
      } catch (e) {
      }
    }
    if (typeof window !== "undefined" && window.Helix) {
      window.Helix.$fetch = $fetch;
    }
    emit("plugin:ready", {
      version: "2.8.7",
      bus: !!bus,
      engines: {
        cache: !!engines.cacheEngine,
        queue: !!engines.queueEngine,
        retry: !!engines.retryEngine,
        polling: !!engines.visibilityEngine,
        upload: !!engines.xhrTransport,
        debug: config.debug === true
      }
    });
    if (app && typeof app.onAppUnmount === "function") {
      app.onAppUnmount(() => {
        engines.dedupeEngine.clear();
        if (engines.queueEngine)
          engines.queueEngine.clear();
        if (engines.cacheEngine)
          engines.cacheEngine.clear();
        if (engines.visibilityEngine)
          engines.visibilityEngine.detach();
        app.$loader?.hide?.();
        emit("plugin:destroy");
      });
    }
    return () => {
      engines.dedupeEngine.clear();
      if (engines.queueEngine)
        engines.queueEngine.clear();
      if (engines.cacheEngine)
        engines.cacheEngine.clear();
      if (engines.visibilityEngine)
        engines.visibilityEngine.detach();
      app.$loader?.hide?.();
      emit("plugin:destroy");
    };
  }
};
var root3 = typeof window !== "undefined" ? window : globalThis;
root3.HelixFetchPlugin = HelixFetchPlugin;
var src_default3 = HelixFetchPlugin;

// packages/helix-store/src/utils.js
function isObject(val) {
  return val !== null && typeof val === "object";
}
function isFunction(val) {
  return typeof val === "function";
}
function isPromise(val) {
  return isObject(val) && isFunction(val.then);
}
function deepClone(obj) {
  if (obj === null || typeof obj !== "object")
    return obj;
  if (typeof Node !== "undefined" && obj instanceof Node)
    return obj;
  if (typeof Event !== "undefined" && obj instanceof Event)
    return obj;
  if (typeof Window !== "undefined" && obj instanceof Window)
    return obj;
  if (typeof Document !== "undefined" && obj instanceof Document)
    return obj;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(obj);
    } catch (_) {
    }
  }
  if (Array.isArray(obj))
    return obj.map(deepClone);
  if (obj instanceof Date)
    return new Date(obj.getTime());
  if (obj instanceof RegExp)
    return new RegExp(obj);
  if (obj instanceof Set)
    return new Set(Array.from(obj, deepClone));
  if (obj instanceof Map) {
    const map = /* @__PURE__ */ new Map();
    obj.forEach((v, k) => map.set(deepClone(k), deepClone(v)));
    return map;
  }
  const clone = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key]);
  }
  return clone;
}
function getPathValue(obj, path) {
  if (!obj || !path)
    return void 0;
  const parts = Array.isArray(path) ? path : path.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === void 0)
      return void 0;
    curr = curr[part];
  }
  return curr;
}
function setPathValue(obj, path, value) {
  if (!obj || !path)
    return;
  const parts = Array.isArray(path) ? path : path.split(".");
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in curr) || !isObject(curr[part])) {
      curr[part] = {};
    }
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = value;
}
function deepEqual(a, b) {
  if (a === b)
    return true;
  if (a === null || typeof a !== "object" || b === null || typeof b !== "object") {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length)
    return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}
var RESERVED_STORE_KEYS = /* @__PURE__ */ new Set([
  "$id",
  "$state",
  "$readonly",
  "$patch",
  "$reset",
  "$snapshot",
  "$restore",
  "$dispose",
  "$disposed",
  "$subscribe",
  "$watch",
  "$select",
  "$transaction",
  "$emit",
  "$on",
  "$off",
  "$undo",
  "$redo",
  "$canUndo",
  "$canRedo",
  "$loading",
  "$errors",
  "$cancel",
  "_stateKeys",
  "_getterKeys",
  "_actionKeys"
]);
function validateStoreKeys(storeId, stateKeys, getterKeys, actionKeys) {
  const allKeys = [...stateKeys, ...getterKeys, ...actionKeys];
  for (const key of allKeys) {
    if (RESERVED_STORE_KEYS.has(key)) {
      throw new Error(`[Helix:Store] Store "${storeId}" cannot define reserved key "${key}".`);
    }
  }
  for (const k of stateKeys) {
    if (actionKeys.includes(k)) {
      throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and an action in store "${storeId}".`);
    }
    if (getterKeys.includes(k)) {
      throw new Error(`[Helix:Store] Key "${k}" cannot be both a state property and a getter in store "${storeId}".`);
    }
  }
}

// packages/helix-store/src/transactions.js
function createTransactionManager(storeId, getStateFn, notifySubscribers, recordHistory) {
  let transactionDepth = 0;
  let currentTransactionTitle = null;
  let rootBeforeSnapshot = null;
  function runTransaction(fn, title = "Transaction") {
    if (transactionDepth > 0) {
      return fn();
    }
    transactionDepth = 1;
    currentTransactionTitle = title;
    rootBeforeSnapshot = deepClone(getStateFn());
    try {
      const result = fn();
      return result;
    } finally {
      const afterSnapshot = deepClone(getStateFn());
      transactionDepth = 0;
      const hasChanged = !deepEqual(rootBeforeSnapshot, afterSnapshot);
      if (hasChanged) {
        const aggregatedMutation = {
          type: "transaction",
          storeId,
          title: currentTransactionTitle,
          timestamp: Date.now(),
          before: rootBeforeSnapshot,
          after: afterSnapshot
        };
        if (recordHistory) {
          recordHistory({
            title: currentTransactionTitle,
            before: rootBeforeSnapshot,
            after: afterSnapshot
          });
        }
        if (notifySubscribers) {
          notifySubscribers(aggregatedMutation);
        }
      }
      rootBeforeSnapshot = null;
      currentTransactionTitle = null;
    }
  }
  function isInTransaction() {
    return transactionDepth > 0;
  }
  return {
    runTransaction,
    isInTransaction
  };
}

// packages/helix-store/src/events.js
function createStoreEventBus() {
  const listeners = /* @__PURE__ */ new Map();
  function on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, /* @__PURE__ */ new Set());
    }
    listeners.get(event).add(handler);
    const unsubscribe = () => off(event, handler);
    if (typeof Helix !== "undefined" && typeof Helix.onScopeDispose === "function") {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {
      }
    }
    return unsubscribe;
  }
  function off(event, handler) {
    if (!listeners.has(event))
      return;
    if (!handler) {
      listeners.delete(event);
    } else {
      listeners.get(event).delete(handler);
      if (listeners.get(event).size === 0) {
        listeners.delete(event);
      }
    }
  }
  function emit(event, ...payload) {
    if (!listeners.has(event))
      return;
    listeners.get(event).forEach((handler) => {
      try {
        handler(...payload);
      } catch (err) {
        console.error(`[Helix:Store:Event] Error in handler for "${event}":`, err);
      }
    });
  }
  function clear() {
    listeners.clear();
  }
  return { on, off, emit, clear };
}

// packages/helix-store/src/async-state.js
function createAsyncStateManager(reactiveFn) {
  const loading = reactiveFn({});
  const errors = reactiveFn({});
  const abortControllers = /* @__PURE__ */ new Map();
  const callCounters = /* @__PURE__ */ new Map();
  let currentActiveAction = null;
  function wrapAction(actionName, actionFn, storeContext) {
    return function(...args) {
      if (abortControllers.has(actionName)) {
        try {
          abortControllers.get(actionName).abort();
        } catch (_) {
        }
      }
      const controller = new AbortController();
      abortControllers.set(actionName, controller);
      const currentCallId = (callCounters.get(actionName) || 0) + 1;
      callCounters.set(actionName, currentCallId);
      const normalizedArgs = [...args];
      const lastArg = normalizedArgs[normalizedArgs.length - 1];
      if (lastArg && typeof lastArg === "object" && !Array.isArray(lastArg)) {
        if (!("signal" in lastArg)) {
          lastArg.signal = controller.signal;
        }
      } else if (actionFn.length > normalizedArgs.length) {
        normalizedArgs.push({ signal: controller.signal });
      }
      currentActiveAction = actionName;
      let result;
      try {
        result = actionFn.apply(storeContext, normalizedArgs);
      } catch (syncErr) {
        if (callCounters.get(actionName) === currentCallId) {
          abortControllers.delete(actionName);
        }
        throw syncErr;
      } finally {
        currentActiveAction = null;
      }
      if (!isPromise(result)) {
        if (callCounters.get(actionName) === currentCallId) {
          abortControllers.delete(actionName);
        }
        return result;
      }
      loading[actionName] = true;
      errors[actionName] = null;
      return result.then((value) => {
        if (callCounters.get(actionName) === currentCallId) {
          loading[actionName] = false;
          abortControllers.delete(actionName);
        }
        return value;
      }).catch((err) => {
        if (callCounters.get(actionName) === currentCallId) {
          loading[actionName] = false;
          abortControllers.delete(actionName);
          const isAbort = err?.name === "AbortError" || err?.code === 20 || err?.message?.includes("aborted");
          if (!isAbort) {
            errors[actionName] = err?.message || String(err);
            throw err;
          }
        }
        return void 0;
      });
    };
  }
  function getSignal(actionName) {
    const targetAction = actionName || currentActiveAction;
    if (targetAction && abortControllers.has(targetAction)) {
      return abortControllers.get(targetAction).signal;
    }
    return void 0;
  }
  function cancel(actionName) {
    const controller = abortControllers.get(actionName);
    if (controller) {
      try {
        controller.abort();
      } catch (_) {
      }
    }
  }
  function clear() {
    abortControllers.forEach((ctrl) => {
      try {
        ctrl.abort();
      } catch (_) {
      }
    });
    abortControllers.clear();
    callCounters.clear();
    currentActiveAction = null;
  }
  return {
    loading,
    errors,
    wrapAction,
    getSignal,
    cancel,
    clear
  };
}

// packages/helix-store/src/history.js
function createHistoryManager(historyConfig, restoreStateFn) {
  const isEnabled = historyConfig === true || typeof historyConfig === "object" && historyConfig !== null && historyConfig.enabled !== false;
  const maxHistory = typeof historyConfig === "object" && historyConfig?.max ? historyConfig.max : 50;
  const canUndoRef = typeof Helix !== "undefined" && typeof Helix.ref === "function" ? Helix.ref(false) : { value: false };
  const canRedoRef = typeof Helix !== "undefined" && typeof Helix.ref === "function" ? Helix.ref(false) : { value: false };
  let undoStack = [];
  let redoStack = [];
  let isPerformingUndoRedo = false;
  function syncFlags() {
    const nextCanUndo = Boolean(isEnabled && undoStack.length > 0);
    const nextCanRedo = Boolean(isEnabled && redoStack.length > 0);
    if (canUndoRef.value !== nextCanUndo) {
      canUndoRef.value = nextCanUndo;
    }
    if (canRedoRef.value !== nextCanRedo) {
      canRedoRef.value = nextCanRedo;
    }
  }
  let isRecording = false;
  function record({ title = "Action", before, after }) {
    if (!isEnabled || isPerformingUndoRedo || isRecording)
      return;
    isRecording = true;
    try {
      undoStack.push({
        title,
        before: deepClone(before),
        after: deepClone(after),
        timestamp: Date.now()
      });
      if (undoStack.length > maxHistory) {
        undoStack.shift();
      }
      redoStack = [];
      syncFlags();
    } finally {
      isRecording = false;
    }
  }
  function undo() {
    if (!isEnabled || undoStack.length === 0)
      return false;
    isPerformingUndoRedo = true;
    try {
      const entry = undoStack.pop();
      redoStack.push(entry);
      restoreStateFn(deepClone(entry.before));
      return true;
    } finally {
      isPerformingUndoRedo = false;
      syncFlags();
    }
  }
  function redo() {
    if (!isEnabled || redoStack.length === 0)
      return false;
    isPerformingUndoRedo = true;
    try {
      const entry = redoStack.pop();
      undoStack.push(entry);
      restoreStateFn(deepClone(entry.after));
      return true;
    } finally {
      isPerformingUndoRedo = false;
      syncFlags();
    }
  }
  function getCanUndo() {
    return canUndoRef.value;
  }
  function getCanRedo() {
    return canRedoRef.value;
  }
  function clear() {
    undoStack = [];
    redoStack = [];
    syncFlags();
  }
  return {
    record,
    undo,
    redo,
    getCanUndo,
    getCanRedo,
    clear,
    isEnabled: () => isEnabled,
    isPerformingUndoRedo: () => isPerformingUndoRedo
  };
}

// packages/helix-store/src/subscriptions.js
function createSubscriptionManager(storeId) {
  const subscribers = /* @__PURE__ */ new Set();
  const watchers = /* @__PURE__ */ new Set();
  function subscribe(callback, options = {}) {
    subscribers.add(callback);
    const unsubscribe = () => {
      subscribers.delete(callback);
    };
    if (!options.detached && typeof Helix !== "undefined" && typeof Helix.onScopeDispose === "function") {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {
      }
    }
    return unsubscribe;
  }
  function notify(mutation, state) {
    subscribers.forEach((cb) => {
      try {
        cb(mutation, state);
      } catch (err) {
        console.error(`[Helix:Store:Subscription] Error in subscriber for "${storeId}":`, err);
      }
    });
  }
  function watch2(getterOrPath, callback, options = {}, storeContext) {
    if (typeof Helix === "undefined" || !Helix.watch) {
      console.warn("[Helix:Store] Helix.watch is required for $watch.");
      return () => {
      };
    }
    const getter = typeof getterOrPath === "string" ? () => getPathValue(storeContext || {}, getterOrPath) : typeof getterOrPath === "function" ? () => getterOrPath.call(storeContext, storeContext) : getterOrPath;
    const unwatch = Helix.watch(getter, callback, options);
    watchers.add(unwatch);
    const unsubscribe = () => {
      watchers.delete(unwatch);
      try {
        unwatch();
      } catch (_) {
      }
    };
    if (!options.detached && typeof Helix.onScopeDispose === "function") {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {
      }
    }
    return unsubscribe;
  }
  function select(selectorFn, storeState) {
    if (typeof Helix === "undefined" || !Helix.computed) {
      return { value: selectorFn(storeState) };
    }
    return Helix.computed(() => selectorFn(storeState));
  }
  function clear() {
    subscribers.clear();
    watchers.forEach((unwatch) => {
      try {
        unwatch();
      } catch (_) {
      }
    });
    watchers.clear();
  }
  return {
    subscribe,
    notify,
    watch: watch2,
    select,
    clear
  };
}

// packages/helix-store/src/persistence.js
var memoryStorage = /* @__PURE__ */ new Map();
var storageDrivers = {
  localStorage: {
    get(key) {
      if (typeof window !== "undefined" && window.localStorage)
        return window.localStorage.getItem(key);
      return memoryStorage.get(key) || null;
    },
    set(key, val) {
      if (typeof window !== "undefined" && window.localStorage)
        return window.localStorage.setItem(key, val);
      memoryStorage.set(key, val);
    },
    remove(key) {
      if (typeof window !== "undefined" && window.localStorage)
        return window.localStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  },
  sessionStorage: {
    get(key) {
      if (typeof window !== "undefined" && window.sessionStorage)
        return window.sessionStorage.getItem(key);
      return memoryStorage.get(key) || null;
    },
    set(key, val) {
      if (typeof window !== "undefined" && window.sessionStorage)
        return window.sessionStorage.setItem(key, val);
      memoryStorage.set(key, val);
    },
    remove(key) {
      if (typeof window !== "undefined" && window.sessionStorage)
        return window.sessionStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  }
};
function setupPersistence(storeId, persistConfig, storeState, patchFn) {
  if (!persistConfig) {
    return {
      save: () => {
      },
      flush: () => {
      },
      remove: () => {
      },
      ready: Promise.resolve()
    };
  }
  const config = typeof persistConfig === "string" ? { driver: persistConfig } : persistConfig === true ? { driver: "localStorage" } : { ...persistConfig };
  const driverName = config.driver || "localStorage";
  const driver = (typeof driverName === "string" ? storageDrivers[driverName] : driverName) || storageDrivers.localStorage;
  const storageKey = config.key || `hx_store_${storeId}`;
  const paths = Array.isArray(config.paths) ? config.paths : null;
  const currentVersion = config.version || 1;
  const debounceTime = typeof config.debounce === "number" ? config.debounce : 0;
  let pendingSaveTimer = null;
  let latestSerializedPayload = null;
  let readyPromise = Promise.resolve();
  try {
    const raw = driver.get(storageKey);
    const handleHydratedData = (data) => {
      if (data) {
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        if (parsed && typeof parsed === "object") {
          if (parsed._expiresAt && Date.now() > parsed._expiresAt) {
            driver.remove(storageKey);
            return;
          }
          let stateData = parsed._state !== void 0 ? parsed._state : parsed;
          const savedVersion = parsed._version || 1;
          if (config.version && config.version !== savedVersion && typeof config.migrate === "function") {
            try {
              stateData = config.migrate(stateData, savedVersion);
            } catch (migErr) {
              console.error(`[Helix:Store:Persistence] Migration failed for store "${storeId}":`, migErr);
            }
          }
          patchFn(stateData);
        }
      }
    };
    if (raw instanceof Promise) {
      readyPromise = raw.then(handleHydratedData).catch((err) => {
        console.error(`[Helix:Store:Persistence] Async hydration failed for "${storeId}":`, err);
      });
    } else {
      handleHydratedData(raw);
    }
  } catch (err) {
    console.error(`[Helix:Store:Persistence] Failed to hydrate store "${storeId}":`, err);
  }
  function preparePayload(currentState) {
    let dataToSave = {};
    if (paths && paths.length > 0) {
      paths.forEach((p) => {
        const val = getPathValue(currentState, p);
        if (val !== void 0) {
          setPathValue(dataToSave, p, deepClone(val));
        }
      });
    } else {
      dataToSave = deepClone(currentState);
    }
    const payload = {
      _state: dataToSave,
      _version: currentVersion,
      _timestamp: Date.now()
    };
    if (config.expiresIn && typeof config.expiresIn === "number") {
      payload._expiresAt = Date.now() + config.expiresIn;
    }
    return JSON.stringify(payload);
  }
  async function writePayloadToDriver(serialized) {
    try {
      await Promise.resolve(driver.set(storageKey, serialized));
    } catch (err) {
      console.error(`[Helix:Store:Persistence] Failed to persist store "${storeId}":`, err);
    }
  }
  function save(currentState) {
    latestSerializedPayload = preparePayload(currentState);
    if (debounceTime > 0) {
      if (pendingSaveTimer !== null)
        clearTimeout(pendingSaveTimer);
      pendingSaveTimer = setTimeout(() => {
        pendingSaveTimer = null;
        if (latestSerializedPayload)
          writePayloadToDriver(latestSerializedPayload);
      }, debounceTime);
    } else {
      if (pendingSaveTimer === null) {
        pendingSaveTimer = Promise.resolve().then(() => {
          pendingSaveTimer = null;
          if (latestSerializedPayload)
            writePayloadToDriver(latestSerializedPayload);
        });
      }
    }
  }
  function flush() {
    if (pendingSaveTimer !== null) {
      if (typeof pendingSaveTimer === "number")
        clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    if (latestSerializedPayload) {
      writePayloadToDriver(latestSerializedPayload);
    }
  }
  function remove() {
    if (pendingSaveTimer !== null) {
      if (typeof pendingSaveTimer === "number")
        clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    try {
      driver.remove(storageKey);
    } catch (_) {
    }
  }
  return { save, flush, remove, ready: readyPromise };
}

// packages/helix-store/src/store-instance.js
function createStoreInstance(storeId, definition, appContext, onDisposeCallback) {
  let disposed = false;
  let isHydrating = false;
  const isSetupStore = isFunction(definition);
  let rawInitialState = {};
  let actions = {};
  let getters = {};
  let persistConfig = null;
  let historyConfig = null;
  if (!isSetupStore && isObject(definition)) {
    if (isFunction(definition.state)) {
      rawInitialState = definition.state();
    } else if (isObject(definition.state)) {
      rawInitialState = definition.state;
    }
    actions = definition.actions || {};
    getters = definition.getters || {};
    persistConfig = definition.persist || null;
    historyConfig = definition.history || null;
  }
  const stateKeyList = Object.keys(rawInitialState);
  const getterKeyList = Object.keys(getters);
  const actionKeyList = Object.keys(actions);
  validateStoreKeys(storeId, stateKeyList, getterKeyList, actionKeyList);
  const reactiveFn = typeof Helix !== "undefined" && Helix.reactive ? Helix.reactive : (obj) => obj;
  const state = reactiveFn(deepClone(rawInitialState));
  const effectScope2 = typeof Helix !== "undefined" && Helix.effectScope ? Helix.effectScope() : null;
  const subscriptionManager = createSubscriptionManager(storeId);
  const eventBus = createStoreEventBus();
  const asyncManager = createAsyncStateManager(reactiveFn);
  let previousSnapshot = deepClone(rawInitialState);
  let persistenceAdapter = { save: () => {
  }, flush: () => {
  }, remove: () => {
  }, ready: Promise.resolve() };
  const setupStateKeys = new Set(stateKeyList);
  const setupGetterKeys = new Set(getterKeyList);
  const setupActionKeys = new Set(actionKeyList);
  const computedGetters = /* @__PURE__ */ new Map();
  const wrappedActions = /* @__PURE__ */ new Map();
  let storeProxy;
  function replaceState(newState) {
    if (!isObject(newState))
      return;
    Object.keys(state).forEach((k) => {
      if (!(k in newState)) {
        delete state[k];
        setupStateKeys.delete(k);
      }
    });
    Object.keys(newState).forEach((k) => {
      setupStateKeys.add(k);
      state[k] = deepClone(newState[k]);
    });
  }
  const historyManager = createHistoryManager(
    historyConfig,
    (restoredState) => {
      replaceState(restoredState);
      previousSnapshot = deepClone(state);
      dispatchMutation({
        type: "history_restore",
        storeId,
        timestamp: Date.now(),
        after: previousSnapshot
      });
    }
  );
  function dispatchMutation(mutationRecord) {
    subscriptionManager.notify(mutationRecord, state);
    if (!isHydrating) {
      persistenceAdapter.save(state);
    }
  }
  const transactionManager = createTransactionManager(
    storeId,
    () => state,
    (record) => {
      previousSnapshot = deepClone(state);
      dispatchMutation(record);
    },
    (entry) => {
      if (!isHydrating) {
        historyManager.record(entry);
      }
    }
  );
  let stopMutationWatcher = null;
  function initMutationBridge() {
    if (typeof Helix !== "undefined" && Helix.watch) {
      stopMutationWatcher = Helix.watch(
        () => state,
        () => {
          if (disposed)
            return;
          if (transactionManager.isInTransaction())
            return;
          if (historyManager.isPerformingUndoRedo())
            return;
          if (isHydrating) {
            previousSnapshot = deepClone(state);
            return;
          }
          const shouldSnapshot = historyManager.isEnabled();
          const currentSnapshot = shouldSnapshot ? deepClone(state) : state;
          const mutationRecord = {
            type: "mutation",
            storeId,
            timestamp: Date.now(),
            before: shouldSnapshot ? previousSnapshot : void 0,
            after: shouldSnapshot ? currentSnapshot : void 0
          };
          if (shouldSnapshot) {
            if (!deepEqual(previousSnapshot, currentSnapshot)) {
              historyManager.record({
                title: "Mutation",
                before: previousSnapshot,
                after: currentSnapshot
              });
              previousSnapshot = currentSnapshot;
            }
          }
          dispatchMutation(mutationRecord);
        },
        { deep: true, flush: "sync" }
      );
    }
  }
  if (effectScope2) {
    effectScope2.run(() => {
      initMutationBridge();
    });
  } else {
    initMutationBridge();
  }
  function patch(patchObjOrFn) {
    transactionManager.runTransaction(() => {
      if (isFunction(patchObjOrFn)) {
        patchObjOrFn(state);
      } else if (isObject(patchObjOrFn)) {
        Object.keys(patchObjOrFn).forEach((key) => {
          setupStateKeys.add(key);
          state[key] = patchObjOrFn[key];
        });
      }
    }, "Patch State");
  }
  function reset() {
    transactionManager.runTransaction(() => {
      replaceState(deepClone(rawInitialState));
    }, "Reset State");
  }
  function replace(newState) {
    transactionManager.runTransaction(() => {
      replaceState(deepClone(newState));
    }, "Replace State");
  }
  function snapshot() {
    return deepClone(state);
  }
  function restore(snap) {
    if (!isObject(snap))
      return;
    transactionManager.runTransaction(() => {
      replaceState(deepClone(snap));
    }, "Restore Snapshot");
  }
  function dispose() {
    if (disposed)
      return;
    disposed = true;
    if (persistenceAdapter && typeof persistenceAdapter.flush === "function") {
      try {
        persistenceAdapter.flush();
      } catch (_) {
      }
    }
    if (stopMutationWatcher) {
      try {
        stopMutationWatcher();
      } catch (_) {
      }
    }
    if (effectScope2) {
      try {
        effectScope2.stop();
      } catch (_) {
      }
    }
    subscriptionManager.clear();
    eventBus.clear();
    asyncManager.clear();
    historyManager.clear();
    if (onDisposeCallback) {
      onDisposeCallback();
    }
  }
  const internalMembers = {
    $id: storeId,
    get $disposed() {
      return disposed;
    },
    get $ready() {
      return persistenceAdapter && persistenceAdapter.ready ? persistenceAdapter.ready.then(() => storeProxy) : Promise.resolve(storeProxy);
    },
    get $state() {
      if (isSetupStore) {
        const out = { ...state };
        computedGetters.forEach((refVal, key) => {
          out[key] = refVal && typeof refVal === "object" && "value" in refVal ? refVal.value : refVal;
        });
        return out;
      }
      return state;
    },
    set $state(newState) {
      replace(newState);
    },
    get $readonly() {
      if (typeof Helix !== "undefined" && Helix.readonly) {
        return Helix.readonly(state);
      }
      return deepClone(state);
    },
    $patch: patch,
    $reset: reset,
    $snapshot: snapshot,
    $restore: restore,
    $dispose: dispose,
    $subscribe: (cb, opts) => subscriptionManager.subscribe(cb, opts),
    $watch: (getter, cb, opts) => subscriptionManager.watch(getter, cb, opts, storeProxy),
    $select: (selectorFn) => subscriptionManager.select(selectorFn, state),
    $transaction: (fn, title) => transactionManager.runTransaction(fn, title),
    $emit: eventBus.emit,
    $on: eventBus.on,
    $off: eventBus.off,
    $undo: () => historyManager.undo(),
    $redo: () => historyManager.redo(),
    get $canUndo() {
      return historyManager.getCanUndo();
    },
    get $canRedo() {
      return historyManager.getCanRedo();
    },
    get $loading() {
      return asyncManager.loading;
    },
    get $errors() {
      return asyncManager.errors;
    },
    get $signal() {
      return asyncManager.getSignal();
    },
    $cancel: asyncManager.cancel,
    _stateKeys: setupStateKeys,
    _getterKeys: setupGetterKeys,
    _actionKeys: setupActionKeys
  };
  storeProxy = new Proxy(internalMembers, {
    get(target, prop) {
      if (typeof prop === "symbol")
        return target[prop];
      if (prop in target) {
        return target[prop];
      }
      if (computedGetters.has(prop)) {
        return computedGetters.get(prop).value;
      }
      if (wrappedActions.has(prop)) {
        return wrappedActions.get(prop);
      }
      return state[prop];
    },
    set(target, prop, value) {
      if (disposed) {
        console.warn(`[Helix:Store] Attempted to mutate property "${String(prop)}" on disposed store "${storeId}".`);
        return true;
      }
      if (prop === "$state") {
        replace(value);
        return true;
      }
      if (computedGetters.has(prop)) {
        console.error(`[Helix:Store] Cannot assign to computed getter "${String(prop)}" on store "${storeId}".`);
        return false;
      }
      if (typeof state[prop] === "number") {
        if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) {
          value = Number(value);
        } else if (typeof value === "number" && isNaN(value)) {
          value = 0;
        }
      }
      setupStateKeys.add(prop);
      state[prop] = value;
      return true;
    },
    has(target, prop) {
      return prop in target || computedGetters.has(prop) || wrappedActions.has(prop) || prop in state;
    },
    ownKeys() {
      const keys = /* @__PURE__ */ new Set([
        ...Object.keys(internalMembers),
        ...computedGetters.keys(),
        ...wrappedActions.keys(),
        ...Object.keys(state)
      ]);
      return Array.from(keys);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target) {
        return Object.getOwnPropertyDescriptor(target, prop);
      }
      if (computedGetters.has(prop)) {
        return {
          get: () => computedGetters.get(prop).value,
          enumerable: true,
          configurable: true
        };
      }
      if (wrappedActions.has(prop)) {
        return {
          value: wrappedActions.get(prop),
          enumerable: true,
          configurable: true,
          writable: true
        };
      }
      if (prop in state) {
        return Object.getOwnPropertyDescriptor(state, prop);
      }
      return void 0;
    }
  });
  getterKeyList.forEach((key) => {
    if (typeof Helix !== "undefined" && Helix.computed) {
      if (effectScope2) {
        effectScope2.run(() => {
          computedGetters.set(key, Helix.computed(() => getters[key].call(storeProxy, state)));
        });
      } else {
        computedGetters.set(key, Helix.computed(() => getters[key].call(storeProxy, state)));
      }
    } else {
      computedGetters.set(key, { value: getters[key].call(storeProxy, state) });
    }
  });
  actionKeyList.forEach((key) => {
    wrappedActions.set(key, asyncManager.wrapAction(key, actions[key], storeProxy));
  });
  if (isSetupStore) {
    let setupResult = {};
    if (effectScope2) {
      effectScope2.run(() => {
        setupResult = definition(appContext) || {};
      });
    } else {
      setupResult = definition(appContext) || {};
    }
    Object.keys(setupResult).forEach((key) => {
      const val = setupResult[key];
      if (isFunction(val)) {
        setupActionKeys.add(key);
        wrappedActions.set(key, asyncManager.wrapAction(key, val, storeProxy));
      } else if (typeof Helix !== "undefined" && Helix.isRef && Helix.isRef(val)) {
        setupGetterKeys.add(key);
        computedGetters.set(key, val);
      } else {
        setupStateKeys.add(key);
        state[key] = val;
      }
    });
  }
  if (persistConfig) {
    const hydrationPatcher = (hydratedData) => {
      isHydrating = true;
      try {
        patch(hydratedData);
      } finally {
        isHydrating = false;
        previousSnapshot = deepClone(state);
      }
    };
    persistenceAdapter = setupPersistence(storeId, persistConfig, state, hydrationPatcher);
  }
  return storeProxy;
}

// packages/helix-store/src/simple-store.js
function createSimpleStore(storeId, initialObj = {}, appContext, onDispose) {
  let state = {};
  let actions = {};
  let getters = {};
  if (isObject(initialObj)) {
    if (typeof initialObj.state === "function") {
      state = initialObj.state();
      actions = initialObj.actions || {};
      getters = initialObj.getters || {};
    } else if (isObject(initialObj.state)) {
      state = initialObj.state;
      actions = initialObj.actions || {};
      getters = initialObj.getters || {};
    } else {
      Object.keys(initialObj).forEach((key) => {
        const val = initialObj[key];
        if (isFunction(val)) {
          actions[key] = val;
        } else {
          state[key] = val;
        }
      });
    }
  }
  const definition = {
    state: () => state,
    actions,
    getters
  };
  return createStoreInstance(storeId, definition, appContext, onDispose);
}

// packages/helix-store/src/store-manager.js
function createStoreManager() {
  const definitions = /* @__PURE__ */ new Map();
  const globalRegistry2 = /* @__PURE__ */ new Map();
  const initLocksByAppContext = /* @__PURE__ */ new WeakMap();
  const globalInitLocks = /* @__PURE__ */ new Set();
  function getActiveAppContext(explicitContext) {
    if (explicitContext && typeof explicitContext === "object") {
      return explicitContext;
    }
    if (typeof Helix !== "undefined") {
      if (typeof Helix.getCurrentInstance === "function") {
        const inst = Helix.getCurrentInstance();
        if (inst && inst.appContext)
          return inst.appContext;
      }
      if (Helix.activeAppContext)
        return Helix.activeAppContext;
      if (Helix.activeApp)
        return Helix.activeApp;
    }
    return null;
  }
  function getRegistry(appContext) {
    const ctx = getActiveAppContext(appContext);
    if (ctx && ctx._storeRegistry instanceof Map) {
      return ctx._storeRegistry;
    }
    return globalRegistry2;
  }
  function getInitLocks(appContext) {
    const ctx = getActiveAppContext(appContext);
    if (ctx && typeof ctx === "object") {
      if (!initLocksByAppContext.has(ctx)) {
        initLocksByAppContext.set(ctx, /* @__PURE__ */ new Set());
      }
      return initLocksByAppContext.get(ctx);
    }
    return globalInitLocks;
  }
  function registerDefinition(id2, definition) {
    if (definitions.has(id2)) {
      console.warn(`[Helix:Store] Store definition "${id2}" is already registered. Duplicate definition ignored.`);
      return;
    }
    definitions.set(id2, definition);
  }
  function resolveStore(id2, initialState, appContext) {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("[Helix:Store] Store identifier must be a valid non-empty string.");
    }
    const resolvedAppContext = getActiveAppContext(appContext);
    const registry2 = getRegistry(resolvedAppContext);
    if (initialState && isObject(initialState)) {
      definitions.set(id2, {
        state: () => isFunction(initialState.state) ? initialState.state() : isObject(initialState.state) ? initialState.state : initialState,
        actions: initialState.actions || {},
        getters: initialState.getters || {},
        persist: initialState.persist || null,
        history: initialState.history || null
      });
    }
    if (registry2.has(id2)) {
      const existing = registry2.get(id2);
      if (!existing.$disposed) {
        return existing;
      }
    }
    if (registry2 !== globalRegistry2 && globalRegistry2.has(id2) && !initialState) {
      const globalExisting = globalRegistry2.get(id2);
      if (!globalExisting.$disposed) {
        return globalExisting;
      }
    }
    const initializingStores = getInitLocks(resolvedAppContext);
    if (initializingStores.has(id2)) {
      const chain = Array.from(initializingStores).concat(id2).join(" -> ");
      throw new Error(`[Helix:Store] Circular dependency detected during store initialization: ${chain}`);
    }
    initializingStores.add(id2);
    try {
      const onDispose = () => {
        registry2.delete(id2);
      };
      let storeInstance;
      if (definitions.has(id2)) {
        const definition = definitions.get(id2);
        storeInstance = createStoreInstance(id2, definition, resolvedAppContext, onDispose);
      } else {
        storeInstance = createSimpleStore(id2, initialState || {}, resolvedAppContext, onDispose);
      }
      registry2.set(id2, storeInstance);
      return storeInstance;
    } finally {
      initializingStores.delete(id2);
    }
  }
  function hasStore(id2, appContext) {
    const registry2 = getRegistry(appContext);
    return registry2.has(id2) && !registry2.get(id2).$disposed;
  }
  function disposeStore(id2, appContext) {
    const registry2 = getRegistry(appContext);
    if (registry2.has(id2)) {
      const store2 = registry2.get(id2);
      if (store2 && typeof store2.$dispose === "function") {
        store2.$dispose();
      }
      registry2.delete(id2);
    }
  }
  function clearAll(appContext) {
    const registry2 = getRegistry(appContext);
    registry2.forEach((store2) => {
      if (store2 && typeof store2.$dispose === "function") {
        store2.$dispose();
      }
    });
    registry2.clear();
  }
  function createTemplateProxy(appContext) {
    return new Proxy({}, {
      get(target, prop) {
        if (typeof prop !== "string" || prop.startsWith("__") || prop === "then")
          return void 0;
        if (!hasStore(prop, appContext) && !definitions.has(prop)) {
          return resolveStore(prop, void 0, appContext);
        }
        return resolveStore(prop, void 0, appContext);
      },
      has(target, prop) {
        return typeof prop === "string" && (hasStore(prop, appContext) || definitions.has(prop));
      }
    });
  }
  return {
    registerDefinition,
    resolveStore,
    hasStore,
    disposeStore,
    clearAll,
    createTemplateProxy,
    getRegistry
  };
}

// packages/helix-store/src/define-store.js
function createDefineStore(storeManager2) {
  const hooks = /* @__PURE__ */ new Map();
  return function defineStore2(id2, definitionOrOptions) {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("[Helix:Store] defineStore requires a string identifier as first argument.");
    }
    if (hooks.has(id2)) {
      console.warn(`[Helix:Store] Store definition "${id2}" is already registered. Returning existing store hook.`);
      return hooks.get(id2);
    }
    storeManager2.registerDefinition(id2, definitionOrOptions);
    const useStore = function useStore2(appContext) {
      return storeManager2.resolveStore(id2, void 0, appContext);
    };
    hooks.set(id2, useStore);
    return useStore;
  };
}

// packages/helix-store/src/store-to-refs.js
function storeToRefs(store2) {
  if (!store2 || typeof store2 !== "object") {
    return {};
  }
  const rawState = store2.$state || store2;
  const result = {};
  const stateKeys = store2._stateKeys || new Set(Object.keys(rawState));
  const getterKeys = store2._getterKeys || /* @__PURE__ */ new Set();
  stateKeys.forEach((key) => {
    if (typeof Helix !== "undefined" && Helix.toRef) {
      result[key] = Helix.toRef(rawState, key);
    } else if (typeof Helix !== "undefined" && Helix.computed) {
      result[key] = Helix.computed({
        get: () => rawState[key],
        set: (v) => {
          rawState[key] = v;
        }
      });
    }
  });
  getterKeys.forEach((key) => {
    if (typeof Helix !== "undefined" && Helix.computed) {
      result[key] = Helix.computed(() => store2[key]);
    }
  });
  return result;
}

// packages/helix-store/src/scope-binding.js
function bindScopeStore(scopeInstance, managerOrPlugin, storeId, definition) {
  if (!scopeInstance)
    return null;
  const resolveFn = typeof managerOrPlugin?.resolveStore === "function" ? managerOrPlugin.resolveStore.bind(managerOrPlugin) : typeof managerOrPlugin?.store === "function" ? managerOrPlugin.store : managerOrPlugin;
  const storeInstance = resolveFn(storeId, definition, scopeInstance);
  if (typeof scopeInstance.onDispose === "function") {
    scopeInstance.onDispose(() => {
      storeInstance.$dispose();
    });
  } else if (typeof scopeInstance.onUnmounted === "function") {
    scopeInstance.onUnmounted(() => {
      storeInstance.$dispose();
    });
  }
  return storeInstance;
}

// packages/helix-store/src/index.js
var storeManager = createStoreManager();
var defineStore = createDefineStore(storeManager);
function createStoreFunction(manager) {
  function storeFn(id2, state, appContext) {
    return manager.resolveStore(id2, state, appContext);
  }
  return new Proxy(storeFn, {
    get(target, prop) {
      if (typeof prop === "string" && !(prop in target) && prop !== "then") {
        return manager.resolveStore(prop, void 0);
      }
      return target[prop];
    },
    has(target, prop) {
      return typeof prop === "string" && (manager.hasStore(prop) || prop in target);
    }
  });
}
var store = createStoreFunction(storeManager);
var HelixStore = {
  name: "store",
  version: "1.0.0",
  requires: {
    helix: ">=11.0.0"
  },
  install(app, options = {}) {
    if (app && !(app._storeRegistry instanceof Map)) {
      app._storeRegistry = /* @__PURE__ */ new Map();
    }
    const templateProxy = storeManager.createTemplateProxy(app);
    if (app && typeof app.provide === "function") {
      app.provide("$store", templateProxy);
      app.provide("store", templateProxy);
    }
    if (app && typeof app.namespace === "function") {
      app.namespace("store", {
        get: (id2) => storeManager.resolveStore(id2, void 0, app),
        define: defineStore,
        dispose: (id2) => storeManager.disposeStore(id2, app)
      });
    }
    if (app) {
      app.$store = templateProxy;
      app.store = store;
      app.defineStore = defineStore;
    }
    return {
      $store: templateProxy,
      store: templateProxy
    };
  },
  store,
  defineStore,
  storeToRefs,
  bindScopeStore
};
function initGlobal() {
  const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
  root10.HelixStore = HelixStore;
  root10.HelixStorePlugin = HelixStore;
  const globalTemplateProxy = storeManager.createTemplateProxy();
  if (!root10.$store) {
    root10.$store = globalTemplateProxy;
  }
  if (!root10.store) {
    root10.store = globalTemplateProxy;
  }
  const HelixObj = root10.Helix;
  if (HelixObj) {
    HelixObj.store = store;
    HelixObj.defineStore = defineStore;
    HelixObj.storeToRefs = storeToRefs;
    if (!HelixObj.$store) {
      HelixObj.$store = globalTemplateProxy;
    }
    if (HelixObj.scope && typeof HelixObj.scope.store !== "function") {
      HelixObj.scope.store = (id2, def) => bindScopeStore(HelixObj.scope, storeManager, id2, def);
    }
    if (typeof HelixObj.use === "function") {
      try {
        HelixObj.use(HelixStore);
      } catch (_) {
      }
    }
  }
}
initGlobal();
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initGlobal, { once: true });
}
var src_default4 = HelixStore;

// packages/helix-axios/src/utils.js
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function getAxiosLib() {
  return typeof window !== "undefined" && window.axios ? window.axios : typeof globalThis !== "undefined" && globalThis.axios ? globalThis.axios : null;
}
function isCancel(err) {
  const axiosLib = getAxiosLib();
  return axiosLib && typeof axiosLib.isCancel === "function" && axiosLib.isCancel(err) || err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.name === "AbortError";
}
function normalizeError(err) {
  if (isCancel(err)) {
    return {
      name: "CanceledError",
      status: null,
      data: null,
      message: "Request canceled",
      headers: {},
      config: err?.config || null,
      canceled: true,
      originalError: err
    };
  }
  if (err?.response) {
    return {
      name: "AxiosError",
      status: err.response.status,
      data: err.response.data,
      message: err.response.data?.message || `Request failed with status ${err.response.status}`,
      headers: err.response.headers,
      config: err.config,
      canceled: false,
      originalError: err
    };
  }
  if (err?.request) {
    return {
      name: "NetworkError",
      status: 0,
      data: null,
      message: err.message || "Network error \u2014 no response received",
      headers: {},
      config: err.config,
      canceled: false,
      originalError: err
    };
  }
  return {
    name: "RequestError",
    status: null,
    data: null,
    message: err?.message || "Request setup error",
    headers: {},
    config: null,
    canceled: false,
    originalError: err
  };
}
function stableStringify(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const walk = (val) => {
    if (val === null || typeof val !== "object")
      return val;
    if (typeof FormData !== "undefined" && val instanceof FormData) {
      try {
        const parts = [];
        for (const [k, v] of val.entries()) {
          parts.push([k, typeof v === "string" ? v : "[blob]"]);
        }
        parts.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
        return { __formdata: parts };
      } catch {
        return "[formdata]";
      }
    }
    if (seen.has(val))
      return "[circular]";
    seen.add(val);
    if (Array.isArray(val))
      return val.map(walk);
    const out = {};
    for (const k of Object.keys(val).sort())
      out[k] = walk(val[k]);
    return out;
  };
  try {
    return JSON.stringify(walk(value));
  } catch {
    return "[unserializable]";
  }
}
function getDedupeKey(method, url, axiosConfig, data) {
  const fingerprint = {
    headers: axiosConfig.headers || null,
    responseType: axiosConfig.responseType || null,
    params: axiosConfig.params || null,
    data: data ?? null
  };
  return `${method}|${url}|${stableStringify(fingerprint)}`;
}
function readCookie(name) {
  const jar = typeof document !== "undefined" && document.cookie ? document.cookie.split("; ") : [];
  for (const pair of jar) {
    const eq = pair.indexOf("=");
    const key = eq > -1 ? pair.slice(0, eq) : pair;
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return pair.slice(eq + 1);
      }
    }
  }
  return null;
}

// packages/helix-axios/src/constants.js
var BODYLESS_METHODS = ["get", "head"];
var IDEMPOTENT_METHODS = ["get", "head", "options"];
var DEFAULTS = {
  baseURL: typeof import.meta !== "undefined" && define_import_meta_env_default && "/" || "/",
  timeout: 1e4,
  retries: 0,
  retryDelay: 300,
  maxRetryDelay: 3e4,
  retryCondition: (err, method) => IDEMPOTENT_METHODS.includes(String(method || "").toLowerCase()) && (!err.status || err.status >= 500),
  dedupe: false,
  csrf: false,
  headers: {}
};

// packages/helix-axios/src/factory.js
function createAxiosInstance(config = {}) {
  const axiosLib = getAxiosLib();
  if (!axiosLib) {
    throw new Error("[Helix Axios] axios library not found. Load axios before this plugin.");
  }
  const merged = { ...DEFAULTS, ...config };
  const instance = axiosLib.create({
    baseURL: merged.baseURL,
    timeout: merged.timeout,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
      ...merged.headers
    }
  });
  if (merged.csrf) {
    instance.interceptors.request.use((cfg) => {
      const token = readCookie("XSRF-TOKEN");
      if (token) {
        cfg.headers = cfg.headers || {};
        cfg.headers["X-XSRF-TOKEN"] = token;
      }
      return cfg;
    });
  }
  return instance;
}

// packages/helix-axios/src/request.js
var activeControllers = /* @__PURE__ */ new Set();
function linkSignal(userSignal, onAbort) {
  if (!userSignal)
    return () => {
    };
  if (userSignal.aborted) {
    onAbort();
    return () => {
    };
  }
  userSignal.addEventListener("abort", onAbort);
  return () => userSignal.removeEventListener("abort", onAbort);
}
function driveHooks(responsePromise, hooks, onCleanup) {
  const out = responsePromise.then(
    (res) => {
      hooks.onSuccess?.(res);
      return res.data;
    },
    (err) => {
      hooks.onError?.(err);
      throw err;
    }
  );
  const fin = () => {
    hooks.onSettle?.();
    onCleanup?.();
  };
  out.then(fin, fin);
  return out;
}
async function retryWithBackoff(fn, { retries, delay, maxDelay, condition, method }) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isCancel(err))
        throw normalizeError(err);
      const normalized = normalizeError(err);
      const shouldRetry = condition(normalized, method) && attempt < retries;
      if (!shouldRetry)
        throw normalized;
      const ceiling = Math.min(maxDelay ?? Infinity, delay * Math.pow(2, attempt));
      await sleep(Math.random() * ceiling);
      attempt++;
    }
  }
}
function executeRequest(instance, pending, method, url, data, config = {}, hooks = {}) {
  const {
    signal: userSignal,
    dedupe,
    retries,
    retryDelay,
    retryCondition,
    ...axiosConfig
  } = config;
  const useDedupe = dedupe ?? DEFAULTS.dedupe;
  const dedupeKey = useDedupe ? getDedupeKey(method, url, axiosConfig, data) : null;
  hooks.onStart?.();
  if (useDedupe && pending.has(dedupeKey)) {
    const entry2 = pending.get(dedupeKey);
    entry2.refs++;
    let released2 = false;
    let detach2 = () => {
    };
    const release2 = () => {
      if (released2)
        return;
      released2 = true;
      detach2();
      entry2.refs--;
      if (entry2.refs <= 0) {
        try {
          entry2.controller.abort();
        } catch {
        }
      }
    };
    detach2 = linkSignal(userSignal, release2);
    const out2 = driveHooks(entry2.promise, hooks, () => {
      detach2();
    });
    out2.cancel = release2;
    return out2;
  }
  const controller = new AbortController();
  if (hooks.onUploadProgress) {
    axiosConfig.onUploadProgress = (e) => {
      if (e.lengthComputable)
        hooks.onUploadProgress(Math.round(e.loaded / e.total * 100));
    };
  }
  if (hooks.onDownloadProgress) {
    axiosConfig.onDownloadProgress = (e) => {
      if (e.lengthComputable)
        hooks.onDownloadProgress(Math.round(e.loaded / e.total * 100));
    };
  }
  const exec = () => {
    const requestConfig = { method, url, ...axiosConfig, signal: controller.signal };
    if (!BODYLESS_METHODS.includes(String(method).toLowerCase())) {
      requestConfig.data = data;
    }
    return instance(requestConfig);
  };
  const responsePromise = retryWithBackoff(exec, {
    retries: retries ?? DEFAULTS.retries,
    delay: retryDelay ?? DEFAULTS.retryDelay,
    maxDelay: DEFAULTS.maxRetryDelay,
    condition: retryCondition ?? DEFAULTS.retryCondition,
    method
  });
  const entry = { promise: responsePromise, controller, refs: 1 };
  activeControllers.add(controller);
  if (useDedupe)
    pending.set(dedupeKey, entry);
  let released = false;
  let detach = () => {
  };
  const release = () => {
    if (released)
      return;
    released = true;
    detach();
    if (useDedupe) {
      entry.refs--;
      if (entry.refs <= 0) {
        try {
          controller.abort();
        } catch {
        }
      }
    } else {
      try {
        controller.abort();
      } catch {
      }
    }
  };
  detach = linkSignal(userSignal, release);
  const out = driveHooks(responsePromise, hooks, () => {
    detach();
    activeControllers.delete(controller);
    if (useDedupe && pending.get(dedupeKey) === entry)
      pending.delete(dedupeKey);
  });
  out.cancel = release;
  return out;
}

// packages/helix-axios/src/reactive.js
function createReactiveRequest(app, instance, pending, method, url, data = null, reqOptions = {}) {
  return function useRequest() {
    const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
    const reactiveFn = app && typeof app.reactive === "function" ? app.reactive.bind(app) : Helix2 && typeof Helix2.reactive === "function" ? Helix2.reactive : null;
    const getCurrentInstance2 = Helix2 && typeof Helix2.getCurrentInstance === "function" ? Helix2.getCurrentInstance : app && typeof app.getCurrentInstance === "function" ? app.getCurrentInstance : null;
    const callerInstance = getCurrentInstance2 ? getCurrentInstance2() : null;
    if (!reactiveFn) {
      throw new Error("[Helix Axios] reactive engine not found. Ensure Helix is loaded.");
    }
    const state = reactiveFn({
      data: null,
      error: null,
      loading: false,
      status: null,
      headers: null,
      progress: 0,
      uploadProgress: 0,
      downloadProgress: 0,
      completedAt: null,
      timestamp: null
    });
    const { signal: hookSignal, lazy, ...baseOpts } = reqOptions;
    let lastPromise = null;
    let runId = 0;
    const execute = (override = {}) => {
      const current = ++runId;
      const isCurrent = () => current === runId;
      const config = { ...baseOpts, ...override };
      if (hookSignal)
        config.signal = hookSignal;
      const hooks = {
        onStart: () => {
          if (!isCurrent())
            return;
          state.loading = true;
          state.error = null;
          state.progress = 0;
          state.uploadProgress = 0;
          state.downloadProgress = 0;
        },
        onUploadProgress: (pct) => {
          if (!isCurrent())
            return;
          state.uploadProgress = pct;
          state.progress = pct;
        },
        onDownloadProgress: (pct) => {
          if (!isCurrent())
            return;
          state.downloadProgress = pct;
          state.progress = pct;
        },
        onSuccess: (res) => {
          if (!isCurrent())
            return;
          state.data = res.data;
          state.status = res.status;
          state.headers = res.headers;
          state.completedAt = Date.now();
          state.timestamp = state.completedAt;
        },
        onError: (err) => {
          if (!isCurrent())
            return;
          state.error = err;
          state.status = err.status;
        },
        onSettle: () => {
          if (!isCurrent())
            return;
          state.loading = false;
        }
      };
      lastPromise = executeRequest(instance, pending, method, url, data, config, hooks);
      return lastPromise;
    };
    const inst = state;
    inst.execute = execute;
    inst.cancel = () => {
      lastPromise?.cancel?.();
    };
    inst.promise = () => lastPromise || (lastPromise = execute());
    inst.then = (f, r) => {
      if (!lastPromise)
        lastPromise = execute();
      return lastPromise.then(f, r);
    };
    inst.catch = (r) => {
      if (!lastPromise)
        lastPromise = execute();
      return lastPromise.catch(r);
    };
    if (callerInstance && Array.isArray(callerInstance.cleanups)) {
      callerInstance.cleanups.push(() => {
        inst.cancel();
      });
    }
    if (!lazy)
      execute();
    return inst;
  };
}

// packages/helix-axios/src/manager.js
function buildHttp(axiosInstance, app) {
  const pending = /* @__PURE__ */ new Map();
  const req = (method, url, data, config) => executeRequest(axiosInstance, pending, method, url, data, config || {}, {});
  const reactive2 = (method, url, data, opt) => createReactiveRequest(app, axiosInstance, pending, method, url, data, opt)();
  const makeUpload = (url, file, config = {}) => {
    const { fieldName = "file", ...rest } = config;
    const formData = new FormData();
    formData.append(fieldName, file);
    return reactive2("post", url, formData, rest);
  };
  const http = {
    get: (url, config) => req("get", url, null, config),
    post: (url, data, config) => req("post", url, data, config),
    put: (url, data, config) => req("put", url, data, config),
    patch: (url, data, config) => req("patch", url, data, config),
    delete: (url, config) => req("delete", url, null, config),
    head: (url, config) => req("head", url, null, config),
    options: (url, config) => req("options", url, null, config),
    useGet: (url, opt) => reactive2("get", url, null, opt),
    usePost: (url, body, opt) => reactive2("post", url, body, opt),
    usePut: (url, body, opt) => reactive2("put", url, body, opt),
    usePatch: (url, body, opt) => reactive2("patch", url, body, opt),
    useDelete: (url, opt) => reactive2("delete", url, null, opt),
    useUpload: makeUpload,
    upload: makeUpload,
    create: (opts) => buildHttp(createAxiosInstance(opts), app),
    setToken: (token, type = "Bearer") => {
      axiosInstance.defaults.headers.common["Authorization"] = `${type} ${token}`;
    },
    clearToken: () => {
      delete axiosInstance.defaults.headers.common["Authorization"];
    },
    raw: axiosInstance
  };
  return http;
}

// packages/helix-axios/src/index.js
var HelixAxiosPlugin = {
  name: "axios",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "2.2.0" || "2.2.0",
  requires: {
    helix: ">=11.1.5"
  },
  install(app, options = {}) {
    const axiosLib = getAxiosLib();
    if (!axiosLib) {
      console.error("[Helix Axios] axios library not found. Load axios before this plugin.");
      return () => {
      };
    }
    const baseAxios = createAxiosInstance(options);
    const $http = buildHttp(baseAxios, app);
    app.namespace("axios", {
      $http,
      create: (opts) => buildHttp(createAxiosInstance(opts), app),
      setToken: $http.setToken,
      clearToken: $http.clearToken,
      raw: $http.raw
    });
    app.$http = $http;
    if (app.provide) {
      app.provide("$http", $http);
    }
    return () => {
      activeControllers.forEach((c) => {
        try {
          c.abort();
        } catch {
        }
      });
      activeControllers.clear();
    };
  }
};
var root4 = typeof window !== "undefined" ? window : globalThis;
root4.HelixAxiosPlugin = HelixAxiosPlugin;
var src_default5 = HelixAxiosPlugin;

// packages/helix-scope/src/utils.js
function getPrefix() {
  const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
  return root10.Helix && root10.Helix.config && root10.Helix.config.prefix || "hx-";
}

// packages/helix-scope/src/compiler.js
function compile2(expression) {
  const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
  if (root10.Helix && typeof root10.Helix.compile === "function") {
    return root10.Helix.compile(expression);
  }
  return new Function("$ctx", `with($ctx){ return (${expression}); }`);
}

// packages/helix-scope/src/defaults.js
function parseDefaults(defaultsRaw) {
  if (!defaultsRaw)
    return null;
  const trimmed = defaultsRaw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { type: "static", value: parsed };
    }
  } catch (e) {
  }
  try {
    const evaluator = compile2(trimmed);
    return { type: "dynamic", evaluator };
  } catch (err) {
    console.error(`[helix-scope] Failed to compile default expression: ${trimmed}`, err);
    return null;
  }
}
function evaluateDefaults(parsedDefaults, ctx) {
  if (!parsedDefaults)
    return null;
  if (parsedDefaults.type === "static") {
    return parsedDefaults.value;
  }
  try {
    const val = parsedDefaults.evaluator(ctx);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return val;
    }
    console.warn("[helix-scope] Default expression did not evaluate to an object:", val);
  } catch (err) {
    console.error("[helix-scope] Error evaluating default expression:", err);
  }
  return null;
}

// packages/helix-scope/src/constants.js
var RESERVED_KEYS = /* @__PURE__ */ new Set([
  "$loading",
  "$error",
  "$data",
  "refresh"
]);

// packages/helix-scope/src/merge.js
function isPlainObject(val) {
  return val && typeof val === "object" && !Array.isArray(val);
}
function mergeValues(target, source, seen = /* @__PURE__ */ new WeakMap()) {
  const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
  const config = Helix2?.scope?.config || {};
  const deepMerge = config.deepMerge ?? false;
  const arrayStrategy = config.arrayStrategy ?? "replace";
  if (!deepMerge) {
    return source;
  }
  if (source && typeof source === "object") {
    if (seen.has(source)) {
      return seen.get(source);
    }
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    const result = [];
    seen.set(source, result);
    if (arrayStrategy === "replace") {
      return source;
    } else if (arrayStrategy === "append") {
      return [...target, ...source];
    } else if (arrayStrategy === "prepend") {
      return [...source, ...target];
    } else if (arrayStrategy === "merge") {
      const merged = [...target];
      seen.set(source, merged);
      for (let i = 0; i < source.length; i++) {
        if (i < merged.length) {
          if (isPlainObject(merged[i]) && isPlainObject(source[i])) {
            merged[i] = mergeValues(merged[i], source[i], seen);
          } else if (Array.isArray(merged[i]) && Array.isArray(source[i])) {
            merged[i] = mergeValues(merged[i], source[i], seen);
          } else {
            merged[i] = source[i];
          }
        } else {
          merged[i] = source[i];
        }
      }
      return merged;
    }
    return source;
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const result = { ...target };
    seen.set(source, result);
    for (const key of Object.keys(source)) {
      if (isPlainObject(result[key]) && isPlainObject(source[key])) {
        result[key] = mergeValues(result[key], source[key], seen);
      } else if (Array.isArray(result[key]) && Array.isArray(source[key])) {
        result[key] = mergeValues(result[key], source[key], seen);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  return source;
}
function mergeWithDefaults(defaults2, source) {
  const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
  const config = Helix2?.scope?.config || {};
  const deepMerge = config.deepMerge ?? false;
  if (!defaults2)
    return source;
  if (!source)
    return defaults2;
  if (!deepMerge) {
    const result = { ...source };
    for (const key of Object.keys(defaults2)) {
      if (result[key] === void 0) {
        result[key] = defaults2[key];
      }
    }
    return result;
  }
  return mergeValues(defaults2, source);
}

// packages/helix-scope/src/registry.js
var ControllerRegistry = class {
  constructor() {
    this.registry = /* @__PURE__ */ new Map();
  }
  register(name, controller) {
    this.registry.set(name, controller);
  }
  unregister(name) {
    this.registry.delete(name);
  }
};
var coreRegistry = new ControllerRegistry();
var registry = coreRegistry.registry;
function registerController(name, controller) {
  coreRegistry.register(name, controller);
}
function unregisterController(name, controller) {
  coreRegistry.unregister(name, controller);
}

// packages/helix-scope/src/events.js
var CoreEventEmitter = class {
  constructor() {
    this._events = /* @__PURE__ */ new Map();
  }
  on(event, callback) {
    if (!this._events.has(event))
      this._events.set(event, /* @__PURE__ */ new Set());
    this._events.get(event).add(callback);
    return () => this.off(event, callback);
  }
  off(event, callback) {
    if (this._events.has(event)) {
      this._events.get(event).delete(callback);
    }
  }
  emit(event, data) {
    if (this._events.has(event)) {
      this._events.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }
};
var EventEmitterInstance = new CoreEventEmitter();
var EventEmitter = {
  on(event, callback) {
    return EventEmitterInstance.on(event, callback);
  },
  off(event, callback) {
    EventEmitterInstance.off(event, callback);
  },
  emit(event, data) {
    EventEmitterInstance.emit(event, data);
  }
};

// packages/helix-scope/src/controller.js
var ScopeController = class {
  constructor({
    name,
    expression,
    parsedDefaults,
    ctx,
    childCtx,
    el,
    retryLimit = 0,
    retryDelay = 1e3,
    backoff = true,
    pollInterval = 0,
    timeoutLimit = 0,
    cacheDuration = 0,
    resetOnRefresh = false
  }) {
    this.name = name;
    this.expression = expression;
    this.parsedDefaults = parsedDefaults;
    this.ctx = ctx;
    this.childCtx = childCtx;
    this.el = el;
    this.retryLimit = retryLimit;
    this.retryDelay = retryDelay;
    this.backoff = backoff;
    this.pollInterval = pollInterval;
    this.timeoutLimit = timeoutLimit;
    this.cacheDuration = cacheDuration;
    this.resetOnRefresh = resetOnRefresh;
    this.evaluator = null;
    this.abortController = null;
    this.token = 0;
    this.destroyed = false;
    this.lastResult = void 0;
    this.lastError = null;
    this.cachedResult = void 0;
    this.lastSuccessTime = 0;
    this.pollTimer = null;
    const defaultsObj = evaluateDefaults(parsedDefaults, ctx) || {};
    this.defaults = defaultsObj;
    const initialDefaults = {};
    for (const key of Object.keys(defaultsObj)) {
      if (!RESERVED_KEYS.has(key)) {
        initialDefaults[key] = defaultsObj[key];
      } else {
        console.warn(`[hx-scope:${name}] defaults cannot override reserved key "${key}", ignoring it`);
      }
    }
    const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
    const reactive2 = Helix2 && typeof Helix2.reactive === "function" ? Helix2.reactive.bind(Helix2) : (obj) => obj;
    this.state = reactive2({
      $loading: false,
      $error: null,
      $data: void 0,
      refresh: (opts) => this.refresh(opts),
      ...initialDefaults
    });
    this.previousKeys = Object.keys(initialDefaults);
    registerController(name, this);
    if (this.pollInterval > 0) {
      this.startPolling();
    }
  }
  getEvaluator() {
    if (!this.evaluator) {
      this.evaluator = compile2(this.expression);
    }
    return this.evaluator;
  }
  startPolling() {
    this.stopPolling();
    if (this.pollInterval > 0 && !this.destroyed) {
      this.pollTimer = setInterval(() => {
        this.refresh();
      }, this.pollInterval);
    }
  }
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  getRetryDelay(attempt) {
    const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
    const config = Helix2?.scope?.config || {};
    const useBackoff = this.backoff ?? config.backoff ?? true;
    const baseDelay = this.retryDelay ?? config.retryDelay ?? 1e3;
    if (useBackoff) {
      return baseDelay * Math.pow(2, attempt - 1);
    }
    return baseDelay;
  }
  async refresh(options = {}) {
    if (this.destroyed)
      return;
    const Helix2 = (typeof window !== "undefined" ? window : globalThis).Helix;
    const config = Helix2?.scope?.config || {};
    const shouldReset = options.reset !== void 0 ? options.reset : this.resetOnRefresh || config.resetOnRefresh;
    if (shouldReset) {
      this.reset();
    }
    if (this.pollInterval > 0) {
      this.startPolling();
    }
    const force = options.force || options.reset;
    const now = Date.now();
    if (!force && this.cacheDuration > 0 && this.cachedResult !== void 0 && now - this.lastSuccessTime < this.cacheDuration * 1e3) {
      this.lastResult = this.cachedResult;
      this.applyResult(this.cachedResult);
      EventEmitter.emit("success", { name: this.name, controller: this, result: this.cachedResult, fromCache: true });
      EventEmitter.emit("afterRefresh", { name: this.name, controller: this, result: this.cachedResult, fromCache: true });
      return;
    }
    const currentToken = ++this.token;
    const maxRetries = options.retry !== void 0 ? options.retry : this.retryLimit;
    let attempt = 0;
    let timeoutTimer = null;
    const runAttempt = async () => {
      if (this.destroyed || currentToken !== this.token) {
        return;
      }
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();
      this.childCtx.$signal = this.abortController.signal;
      this.childCtx.$abortController = this.abortController;
      this.state.$loading = true;
      this.state.$error = null;
      EventEmitter.emit("beforeRefresh", { name: this.name, controller: this, attempt });
      if (this.timeoutLimit > 0) {
        timeoutTimer = setTimeout(() => {
          if (this.abortController && currentToken === this.token) {
            this.abortController.abort();
            const err = new Error(`Request timed out after ${this.timeoutLimit}ms`);
            this.lastError = err;
            this.state.$error = err;
            EventEmitter.emit("error", { name: this.name, controller: this, error: err });
            EventEmitter.emit("afterRefresh", { name: this.name, controller: this, error: err });
          }
        }, this.timeoutLimit);
      }
      try {
        const evaluator = this.getEvaluator();
        const result = await evaluator(this.childCtx);
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (this.destroyed || currentToken !== this.token) {
          return;
        }
        this.lastResult = result;
        this.cachedResult = result;
        this.lastSuccessTime = Date.now();
        this.applyResult(result);
        EventEmitter.emit("success", { name: this.name, controller: this, result });
        EventEmitter.emit("afterRefresh", { name: this.name, controller: this, result });
      } catch (err) {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (this.destroyed || currentToken !== this.token) {
          return;
        }
        if (err.name === "AbortError") {
          EventEmitter.emit("abort", { name: this.name, controller: this });
          return;
        }
        if (attempt < maxRetries) {
          attempt++;
          const delay = this.getRetryDelay(attempt);
          EventEmitter.emit("retry", { name: this.name, controller: this, attempt, delay, error: err });
          await new Promise((resolve) => {
            const waitTimer = setTimeout(resolve, delay);
            this.abortController.signal.addEventListener("abort", () => {
              clearTimeout(waitTimer);
              resolve();
            });
          });
          await runAttempt();
        } else {
          this.lastError = err;
          this.state.$error = err;
          console.error(`[hx-scope:${this.name}]`, err);
          EventEmitter.emit("error", { name: this.name, controller: this, error: err });
          EventEmitter.emit("afterRefresh", { name: this.name, controller: this, error: err });
        }
      } finally {
        if (!this.destroyed && currentToken === this.token && (attempt === maxRetries || this.lastResult !== void 0)) {
          this.state.$loading = false;
        }
      }
    };
    await runAttempt();
  }
  applyResult(result) {
    const defaultsObj = evaluateDefaults(this.parsedDefaults, this.ctx) || {};
    this.defaults = defaultsObj;
    const mergedResult = mergeWithDefaults(defaultsObj, result);
    const isPlainResult = mergedResult && typeof mergedResult === "object" && !Array.isArray(mergedResult);
    const source = isPlainResult ? mergedResult : {};
    const keys = /* @__PURE__ */ new Set([
      ...Object.keys(defaultsObj),
      ...Object.keys(source)
    ]);
    const nextKeys = [];
    for (const key of keys) {
      if (RESERVED_KEYS.has(key)) {
        continue;
      }
      this.state[key] = source[key];
      nextKeys.push(key);
    }
    for (const key of this.previousKeys) {
      if (!RESERVED_KEYS.has(key) && !keys.has(key)) {
        delete this.state[key];
      }
    }
    this.previousKeys = nextKeys;
    this.state.$data = result;
  }
  reset() {
    if (this.destroyed)
      return;
    EventEmitter.emit("beforeReset", { name: this.name, controller: this });
    this.abort();
    this.lastResult = void 0;
    this.lastError = null;
    this.cachedResult = void 0;
    this.lastSuccessTime = 0;
    const defaultsObj = evaluateDefaults(this.parsedDefaults, this.ctx) || {};
    this.defaults = defaultsObj;
    this.state.$loading = false;
    this.state.$error = null;
    this.state.$data = void 0;
    const nextKeys = [];
    for (const key of Object.keys(defaultsObj)) {
      if (!RESERVED_KEYS.has(key)) {
        this.state[key] = defaultsObj[key];
        nextKeys.push(key);
      }
    }
    for (const key of this.previousKeys) {
      if (!RESERVED_KEYS.has(key) && !defaultsObj.hasOwnProperty(key)) {
        delete this.state[key];
      }
    }
    this.previousKeys = nextKeys;
    EventEmitter.emit("afterReset", { name: this.name, controller: this });
  }
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      EventEmitter.emit("abort", { name: this.name, controller: this });
    }
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    this.token++;
    this.stopPolling();
    this.abort();
    unregisterController(this.name, this);
    EventEmitter.emit("destroy", { name: this.name, controller: this });
  }
};

// packages/helix-scope/src/directive.js
function onComponentMount(instance, callback) {
  if (instance && instance.hooks && Array.isArray(instance.hooks.mount)) {
    instance.hooks.mount.push(callback);
  } else if (typeof callback === "function") {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(callback);
    } else {
      setTimeout(callback, 0);
    }
  }
}
function parseAttribute2(el, attrName) {
  return el.getAttribute(attrName);
}
function cleanAttributes2(el, attrs) {
  if (!el || !Array.isArray(attrs))
    return;
  attrs.forEach((a) => el.removeAttribute(a));
}
function createScopeDirective(app) {
  return {
    mounted(el, binding) {
      const {
        value: expr,
        arg: name,
        ctx,
        instance,
        bindNode,
        trackCleanup
      } = binding;
      if (!name) {
        console.warn('[hx-scope] usage: hx-scope:name="expression"');
        return;
      }
      if (!expr || !expr.trim()) {
        console.warn(`[hx-scope:${name}] empty expression`);
        return;
      }
      if (el._hx_scope_initialized) {
        const existingCtrl = (el._hx_scope_controllers || {})[name];
        if (existingCtrl) {
          trackCleanup(() => {
            existingCtrl.destroy();
          });
        }
        return;
      }
      el._hx_scope_initialized = true;
      el._hx_scope_controllers = {};
      const prefix = app && app.config && app.config.prefix || getPrefix();
      const scopePrefix = `${prefix}scope:`;
      const scopeDefs = [];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith(scopePrefix)) {
          const sName = attr.name.slice(scopePrefix.length);
          const sExpr = attr.value;
          scopeDefs.push({ name: sName, expression: sExpr });
        }
      }
      const childCtx = {};
      Object.setPrototypeOf(childCtx, ctx);
      childCtx.$el = el;
      childCtx.$event = {
        type: "scope",
        target: el,
        currentTarget: el,
        preventDefault() {
        },
        stopPropagation() {
        }
      };
      const controllers = {};
      for (const def of scopeDefs) {
        const sName = def.name;
        const sExpr = def.expression;
        const defaultsAttr = `${prefix}scope-default:${sName}`;
        const defaultsRaw = parseAttribute2(el, defaultsAttr);
        const parsedDefaults = parseDefaults(defaultsRaw);
        const retryAttr = `${prefix}scope-retry:${sName}`;
        const retryFallbackAttr = `${prefix}scope-retry`;
        const retryRaw = el.getAttribute(retryAttr) || el.getAttribute(retryFallbackAttr);
        cleanAttributes2(el, [retryAttr]);
        const retryLimit = retryRaw ? parseInt(retryRaw, 10) : 0;
        const delayAttr = `${prefix}scope-retry-delay:${sName}`;
        const delayFallbackAttr = `${prefix}scope-retry-delay`;
        const delayRaw = el.getAttribute(delayAttr) || el.getAttribute(delayFallbackAttr);
        cleanAttributes2(el, [delayAttr]);
        const retryDelay = delayRaw ? parseInt(delayRaw, 10) : 1e3;
        const backoffAttr = `${prefix}scope-backoff:${sName}`;
        const backoffFallbackAttr = `${prefix}scope-backoff`;
        const backoffRaw = el.getAttribute(backoffAttr) || el.getAttribute(backoffFallbackAttr);
        cleanAttributes2(el, [backoffAttr]);
        const backoff = backoffRaw !== "false";
        const pollAttr = `${prefix}scope-poll:${sName}`;
        const pollFallbackAttr = `${prefix}scope-poll`;
        const pollRaw = el.getAttribute(pollAttr) || el.getAttribute(pollFallbackAttr);
        cleanAttributes2(el, [pollAttr]);
        const pollInterval = pollRaw ? parseInt(pollRaw, 10) : 0;
        const timeoutAttr = `${prefix}scope-timeout:${sName}`;
        const timeoutFallbackAttr = `${prefix}scope-timeout`;
        const timeoutRaw = el.getAttribute(timeoutAttr) || el.getAttribute(timeoutFallbackAttr);
        cleanAttributes2(el, [timeoutAttr]);
        const timeoutLimit = timeoutRaw ? parseInt(timeoutRaw, 10) : 0;
        const cacheAttr = `${prefix}scope-cache:${sName}`;
        const cacheFallbackAttr = `${prefix}scope-cache`;
        const cacheRaw = el.getAttribute(cacheAttr) || el.getAttribute(cacheFallbackAttr);
        cleanAttributes2(el, [cacheAttr]);
        const cacheDuration = cacheRaw ? parseInt(cacheRaw, 10) : 0;
        const resetAttr = `${prefix}scope-reset:${sName}`;
        const resetFallbackAttr = `${prefix}scope-reset`;
        const resetRaw = el.getAttribute(resetAttr) || el.getAttribute(resetFallbackAttr);
        cleanAttributes2(el, [resetAttr]);
        const resetOnRefresh = resetRaw === "true";
        const ctrl = new ScopeController({
          name: sName,
          expression: sExpr,
          parsedDefaults,
          ctx,
          childCtx,
          el,
          retryLimit,
          retryDelay,
          backoff,
          pollInterval,
          timeoutLimit,
          cacheDuration,
          resetOnRefresh
        });
        controllers[sName] = ctrl;
        childCtx[sName] = ctrl.state;
      }
      cleanAttributes2(el, [
        `${prefix}scope-retry`,
        `${prefix}scope-retry-delay`,
        `${prefix}scope-backoff`,
        `${prefix}scope-poll`,
        `${prefix}scope-timeout`,
        `${prefix}scope-cache`,
        `${prefix}scope-reset`
      ]);
      el._hx_scope_controllers = controllers;
      const thisCtrl = controllers[name];
      if (thisCtrl) {
        trackCleanup(() => {
          thisCtrl.destroy();
        });
      }
      const rebind = app && app.rebind || typeof window !== "undefined" && window.Helix && window.Helix.rebind;
      for (const child of el.childNodes) {
        if (child.__hx_binding && rebind) {
          rebind(child, { ctx: childCtx, instance });
        } else {
          bindNode(child, childCtx, instance, [], true);
        }
      }
      onComponentMount(instance, () => {
        for (const ctrl of Object.values(controllers)) {
          ctrl.refresh();
        }
      });
    }
  };
}

// packages/helix-scope/src/manager.js
function createScopeProxy(name) {
  return {
    refresh(options) {
      const controllers = registry.get(name);
      if (controllers) {
        const promises = [];
        for (const ctrl of controllers) {
          promises.push(ctrl.refresh(options));
        }
        return Promise.all(promises);
      }
      return Promise.resolve();
    },
    reset() {
      const controllers = registry.get(name);
      if (controllers) {
        for (const ctrl of controllers) {
          ctrl.reset();
        }
      }
    },
    abort() {
      const controllers = registry.get(name);
      if (controllers) {
        for (const ctrl of controllers) {
          ctrl.abort();
        }
      }
    },
    destroy() {
      const controllers = registry.get(name);
      if (controllers) {
        for (const ctrl of Array.from(controllers)) {
          ctrl.destroy();
        }
      }
    },
    get state() {
      const controllers = registry.get(name);
      if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0].state;
      }
      return void 0;
    },
    get loading() {
      const controllers = registry.get(name);
      if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0].state.$loading;
      }
      return false;
    },
    get error() {
      const controllers = registry.get(name);
      if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0].state.$error;
      }
      return null;
    },
    get data() {
      const controllers = registry.get(name);
      if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0].state.$data;
      }
      return void 0;
    },
    get defaults() {
      const controllers = registry.get(name);
      if (controllers && controllers.size > 0) {
        return Array.from(controllers)[0].defaults;
      }
      return void 0;
    },
    get controllers() {
      const controllers = registry.get(name);
      return controllers ? Array.from(controllers) : [];
    }
  };
}
var ScopeManagerBase = function(name) {
  if (typeof name === "string") {
    return createScopeProxy(name);
  }
};
ScopeManagerBase.on = function(event, callback) {
  return EventEmitter.on(event, callback);
};
ScopeManagerBase.off = function(event, callback) {
  EventEmitter.off(event, callback);
};
ScopeManagerBase.emit = function(event, data) {
  EventEmitter.emit(event, data);
};
ScopeManagerBase.refresh = async function(name, options) {
  let names = [];
  let opts = {};
  if (name === void 0) {
    names = Array.from(registry.keys());
  } else if (typeof name === "string") {
    names = [name];
    if (options && typeof options === "object") {
      opts = options;
    }
  } else if (Array.isArray(name)) {
    names = name;
    if (options && typeof options === "object") {
      opts = options;
    }
  } else if (name && typeof name === "object") {
    names = Array.from(registry.keys());
    opts = name;
  }
  const isParallel = opts.parallel !== false;
  if (isParallel) {
    const promises = [];
    for (const n of names) {
      const controllers = registry.get(n);
      if (controllers) {
        for (const ctrl of controllers) {
          promises.push(ctrl.refresh(opts));
        }
      }
    }
    await Promise.all(promises);
  } else {
    for (const n of names) {
      const controllers = registry.get(n);
      if (controllers) {
        for (const ctrl of controllers) {
          await ctrl.refresh(opts);
        }
      }
    }
  }
};
ScopeManagerBase.reset = function(name) {
  let names = [];
  if (name === void 0) {
    names = Array.from(registry.keys());
  } else if (typeof name === "string") {
    names = [name];
  } else if (Array.isArray(name)) {
    names = name;
  }
  for (const n of names) {
    const controllers = registry.get(n);
    if (controllers) {
      for (const ctrl of controllers) {
        ctrl.reset();
      }
    }
  }
};
ScopeManagerBase.abort = function(name) {
  let names = [];
  if (name === void 0) {
    names = Array.from(registry.keys());
  } else if (typeof name === "string") {
    names = [name];
  } else if (Array.isArray(name)) {
    names = name;
  }
  for (const n of names) {
    const controllers = registry.get(n);
    if (controllers) {
      for (const ctrl of controllers) {
        ctrl.abort();
      }
    }
  }
};
ScopeManagerBase.destroy = function() {
  for (const controllers of registry.values()) {
    for (const ctrl of Array.from(controllers)) {
      ctrl.destroy();
    }
  }
  registry.clear();
  const root10 = typeof window !== "undefined" ? window : globalThis;
  if (root10.Helix) {
    if (root10.Helix.scope)
      delete root10.Helix.scope;
    if (root10.Helix.$scope)
      delete root10.Helix.$scope;
  }
};
ScopeManagerBase.get = function(name) {
  const controllers = registry.get(name);
  return controllers ? Array.from(controllers) : [];
};
ScopeManagerBase.first = function(name) {
  const controllers = registry.get(name);
  if (controllers && controllers.size > 0) {
    return Array.from(controllers)[0];
  }
  return null;
};
ScopeManagerBase.has = function(name) {
  return registry.has(name) && registry.get(name).size > 0;
};
ScopeManagerBase.config = {
  deepMerge: false,
  arrayStrategy: "replace",
  backoff: true,
  retryDelay: 1e3,
  resetOnRefresh: false
};
ScopeManagerBase.list = function() {
  return Array.from(registry.keys());
};
var ScopeManager = new Proxy(ScopeManagerBase, {
  get(target, prop, receiver) {
    if (Reflect.has(target, prop)) {
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    }
    if (typeof prop === "symbol" || prop.startsWith("_") || prop === "then") {
      return Reflect.get(target, prop, receiver);
    }
    return createScopeProxy(prop);
  }
});

// packages/helix-scope/src/index.js
var HelixScopePlugin = {
  name: "scope",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "1.0.0" || "1.0.0",
  install(app, options = {}) {
    app.directive("scope", createScopeDirective(app));
    const root10 = typeof window !== "undefined" ? window : globalThis;
    if (root10.Helix) {
      if (Object.isExtensible(root10.Helix)) {
        root10.Helix.scope = ScopeManager;
        root10.Helix.$scope = ScopeManager;
      }
    }
    if (Object.isExtensible(app)) {
      app.$scope = ScopeManager;
    }
  }
};
HelixScopePlugin.ScopeManager = ScopeManager;
var root5 = typeof window !== "undefined" ? window : globalThis;
if (root5.Helix) {
  if (typeof root5.Helix.directive === "function") {
    root5.Helix.directive("scope", createScopeDirective(root5.Helix));
  }
  if (Object.isExtensible(root5.Helix)) {
    root5.Helix.scope = ScopeManager;
    root5.Helix.$scope = ScopeManager;
  }
} else if (typeof console !== "undefined") {
  console.warn("[helix-scope] Helix not found - load helix.js before this script.");
}
var src_default6 = HelixScopePlugin;

// packages/helix-tooltip/src/constants.js
var PLACEMENTS = ["top", "bottom", "left", "right"];
var FALLBACK_CHAINS = {
  top: ["top", "bottom", "right", "left"],
  bottom: ["bottom", "top", "right", "left"],
  left: ["left", "right", "top", "bottom"],
  right: ["right", "left", "top", "bottom"]
};
var DEFAULT_OPTIONS = {
  placement: "top",
  theme: "dark",
  animation: "zoom",
  showDelay: 100,
  hideDelay: 60,
  offset: 8,
  viewportPadding: 8,
  maxWidth: 240,
  arrow: true,
  zIndex: 9999,
  appendTo: "body",
  closeOnClickOutside: true,
  closeOnEscape: true,
  longPressDelay: 450,
  sanitize: null,
  liveTracking: false,
  ariaLive: false
};
var PATH_LIKE_RE = /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
var EXPRESSION_HINT_RE = /\?\.|\?\?|\|\||&&|===|!==|=>|\(\)/;
var OBJECT_LITERAL_RE = /^\{[\s\S]*\}$/;
var FUNCTION_CALL_RE = /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\(([\s\S]*)\)$/;
var TRIGGER_WORDS = ["hover", "click", "focus", "manual"];
var ANIMATION_WORDS = ["fade", "zoom", "slide", "flip"];

// packages/helix-tooltip/src/style.js
var styleId = "hx-tooltip-styles";
var styleRefs = 0;
function injectStyles(zIndex, maxWidth) {
  let existingStyle = document.getElementById(styleId);
  if (!existingStyle) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
            .hx-tooltip {
                position: fixed;
                top: 0; left: 0;
                z-index: ${zIndex};
                width: max-content;
                max-width: ${maxWidth}px;
                padding: var(--hx-tooltip-padding, 6px 10px);
                font: inherit;
                font-size: 13px;
                line-height: 1.4;
                border-radius: var(--hx-tooltip-radius, 6px);
                background: var(--hx-tooltip-bg, #1f2937);
                color: var(--hx-tooltip-fg, #f9fafb);
                box-shadow: var(--hx-tooltip-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.14s ease, transform 0.14s ease;
                will-change: transform, opacity;
            }
            .hx-tooltip.hx-tooltip-visible { opacity: 1; }
            .hx-tooltip-interactive { pointer-events: auto; }

            /* Built-in themes are just two pre-set values for the same custom
               properties a .theme-<name> class would define \u2014 no special-casing. */
            .hx-tooltip-dark { --hx-tooltip-bg: #1f2937; --hx-tooltip-fg: #f9fafb; }
            .hx-tooltip-light {
                --hx-tooltip-bg: #ffffff;
                --hx-tooltip-fg: #1f2937;
                border: 1px solid var(--hx-tooltip-border, #e5e7eb);
            }
            /* .theme-<name> modifier -> .hx-tooltip-<name>: define the vars above yourself. */

            /* ----- Built-in animation variants (transform only; position uses left/top) ----- */
            .hx-tooltip-anim-fade { transform: none; }
            .hx-tooltip-anim-zoom { transform: scale(0.94); }
            .hx-tooltip-anim-zoom.hx-tooltip-visible { transform: scale(1); }
            .hx-tooltip-anim-slide[data-placement="top"] { transform: translateY(6px); }
            .hx-tooltip-anim-slide[data-placement="bottom"] { transform: translateY(-6px); }
            .hx-tooltip-anim-slide[data-placement="left"] { transform: translateX(6px); }
            .hx-tooltip-anim-slide[data-placement="right"] { transform: translateX(-6px); }
            .hx-tooltip-anim-slide.hx-tooltip-visible { transform: translate(0, 0); }
            .hx-tooltip-anim-flip { transform: perspective(400px) rotateX(-90deg); }
            .hx-tooltip-anim-flip.hx-tooltip-visible { transform: perspective(400px) rotateX(0deg); }
            /* .anim-<name> modifier -> .hx-tooltip-anim-<name>: bring your own CSS. */

            .hx-tooltip-arrow {
                position: absolute;
                width: 8px;
                height: 8px;
                background: var(--hx-tooltip-bg, #1f2937);
                transform: rotate(45deg);
            }
            .hx-tooltip-light .hx-tooltip-arrow { border: 1px solid var(--hx-tooltip-border, #e5e7eb); }
            .hx-tooltip[data-placement="top"] .hx-tooltip-arrow { bottom: -4px; box-shadow: none; }
            .hx-tooltip[data-placement="bottom"] .hx-tooltip-arrow { top: -4px; }
            .hx-tooltip[data-placement="left"] .hx-tooltip-arrow { right: -4px; }
            .hx-tooltip[data-placement="right"] .hx-tooltip-arrow { left: -4px; }
            .hx-tooltip-no-arrow .hx-tooltip-arrow { display: none; }

            .hx-tooltip-content img { max-width: 100%; display: block; }
        `;
    document.head.appendChild(style);
  }
  styleRefs += 1;
}
function releaseStyles() {
  styleRefs = Math.max(0, styleRefs - 1);
  if (styleRefs === 0) {
    const styleEl = document.getElementById(styleId);
    if (styleEl)
      styleEl.remove();
  }
}

// packages/helix-tooltip/src/position.js
function coordsFor(rect, tipRect, placement, offset) {
  let top, left;
  if (placement === "top") {
    top = rect.top - tipRect.height - offset;
    left = rect.left + rect.width / 2 - tipRect.width / 2;
  } else if (placement === "bottom") {
    top = rect.bottom + offset;
    left = rect.left + rect.width / 2 - tipRect.width / 2;
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - tipRect.height / 2;
    left = rect.left - tipRect.width - offset;
  } else {
    top = rect.top + rect.height / 2 - tipRect.height / 2;
    left = rect.right + offset;
  }
  return { top, left };
}
function fitsViewport(top, left, tipRect, viewportPadding) {
  const pad = viewportPadding;
  return top >= pad && left >= pad && top + tipRect.height <= window.innerHeight - pad && left + tipRect.width <= window.innerWidth - pad;
}
function visibleArea(top, left, tipRect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const visW = Math.max(0, Math.min(left + tipRect.width, vw) - Math.max(left, 0));
  const visH = Math.max(0, Math.min(top + tipRect.height, vh) - Math.max(top, 0));
  return visW * visH;
}
function middlewareFlip(ctx) {
  const chain = FALLBACK_CHAINS[ctx.placement] || FALLBACK_CHAINS.top;
  for (const p of chain) {
    const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
    if (fitsViewport(top, left, ctx.tipRect, ctx.viewportPadding)) {
      ctx.placement = p;
      return ctx;
    }
  }
  let best = chain[0], bestArea = -1;
  for (const p of chain) {
    const { top, left } = coordsFor(ctx.rect, ctx.tipRect, p, ctx.offset);
    const area = visibleArea(top, left, ctx.tipRect);
    if (area > bestArea) {
      bestArea = area;
      best = p;
    }
  }
  ctx.placement = best;
  return ctx;
}
function middlewareOffset(ctx) {
  const { top, left } = coordsFor(ctx.rect, ctx.tipRect, ctx.placement, ctx.offset);
  ctx.top = top;
  ctx.left = left;
  return ctx;
}
function middlewareShift(ctx) {
  const pad = ctx.viewportPadding;
  const vw = window.innerWidth, vh = window.innerHeight;
  ctx.left = Math.min(Math.max(ctx.left, pad), vw - ctx.tipRect.width - pad);
  ctx.top = Math.min(Math.max(ctx.top, pad), vh - ctx.tipRect.height - pad);
  return ctx;
}
function middlewareArrow(ctx) {
  if (!ctx.arrowEnabled) {
    ctx.arrow = null;
    return ctx;
  }
  const ARROW_HALF = 4;
  const MIN_INSET = 6;
  if (ctx.placement === "top" || ctx.placement === "bottom") {
    const anchorCenterX = ctx.rect.left + ctx.rect.width / 2;
    let value = anchorCenterX - ctx.left - ARROW_HALF;
    value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.width - MIN_INSET - ARROW_HALF * 2);
    ctx.arrow = { axis: "x", value };
  } else {
    const anchorCenterY = ctx.rect.top + ctx.rect.height / 2;
    let value = anchorCenterY - ctx.top - ARROW_HALF;
    value = Math.min(Math.max(value, MIN_INSET), ctx.tipRect.height - MIN_INSET - ARROW_HALF * 2);
    ctx.arrow = { axis: "y", value };
  }
  return ctx;
}
var POSITION_MIDDLEWARE = [middlewareFlip, middlewareOffset, middlewareShift, middlewareArrow];
function computePosition(rect, tipRect, preferredPlacement, config) {
  let ctx = {
    rect,
    tipRect,
    placement: preferredPlacement,
    offset: config.offset,
    arrowEnabled: config.arrowEnabled,
    viewportPadding: config.viewportPadding,
    top: 0,
    left: 0,
    arrow: null
  };
  for (const fn of POSITION_MIDDLEWARE)
    ctx = fn(ctx);
  return ctx;
}
function computeFollowPosition(x, y, tipRect, viewportPadding, followOffset = 14) {
  const pad = viewportPadding;
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.min(Math.max(x + followOffset, pad), vw - tipRect.width - pad);
  const top = Math.min(Math.max(y + followOffset, pad), vh - tipRect.height - pad);
  return { top, left };
}

// packages/helix-tooltip/src/content-parser.js
function splitTopLevel2(str, delimiter) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      current += ch;
      if (ch === quote && str[i - 1] !== "\\")
        quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      current += ch;
      continue;
    }
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "")
    parts.push(current);
  return parts;
}
function findTopLevelColon(str) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === quote && str[i - 1] !== "\\")
        quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      continue;
    }
    if (ch === ":" && depth === 0)
      return i;
  }
  return -1;
}
function parseObjectLiteral(trimmed) {
  const inner = trimmed.slice(1, -1);
  const out = {};
  for (const rawPair of splitTopLevel2(inner, ",")) {
    const pair = rawPair.trim();
    if (!pair)
      continue;
    const colonIdx = findTopLevelColon(pair);
    if (colonIdx === -1)
      return null;
    let key = pair.slice(0, colonIdx).trim();
    if (key.startsWith("'") && key.endsWith("'") || key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    }
    if (!/^[a-zA-Z_$][\w$]*$/.test(key))
      return null;
    out[key] = pair.slice(colonIdx + 1).trim();
  }
  return out;
}
function resolveContent(app, rawVal, ctx, el) {
  const trimmed = (rawVal || "").trim();
  const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
  const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
  if (isSingleQuoted || isDoubleQuoted)
    return trimmed.slice(1, -1);
  if (PATH_LIKE_RE.test(trimmed)) {
    const resolved = app.resolvePath(trimmed, ctx);
    return resolved === void 0 ? "" : resolved;
  }
  if (EXPRESSION_HINT_RE.test(trimmed)) {
    console.warn(
      `[Helix.js][$tooltip] hx-tooltip does not evaluate expressions, only a quoted literal or a plain ctx path is supported. Got: "${trimmed}"` + (el && el.tagName ? ` on <${el.tagName.toLowerCase()}>` : "") + `. Rendering empty instead of the literal expression text.`
    );
    return "";
  }
  return trimmed;
}
function resolveScalarValue(app, raw, ctx, el, key) {
  const trimmed = (raw || "").trim();
  const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
  const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
  if (isSingleQuoted || isDoubleQuoted)
    return trimmed.slice(1, -1);
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed))
    return Number(trimmed);
  if (trimmed === "true")
    return true;
  if (trimmed === "false")
    return false;
  if (trimmed === "null" || trimmed === "undefined")
    return null;
  if (PATH_LIKE_RE.test(trimmed)) {
    const resolved = app.resolvePath(trimmed, ctx);
    return resolved === void 0 ? null : resolved;
  }
  console.warn(
    `[Helix.js][$tooltip] Unsupported value for "${key}" in hx-tooltip object config: "${trimmed}". Use a quoted string, number, true/false, null, or a plain ctx path.` + (el && el.tagName ? ` (on <${el.tagName.toLowerCase()}>)` : "")
  );
  return null;
}
function resolveCallArgs(app, rawArgs, ctx, el) {
  const trimmed = (rawArgs || "").trim();
  if (!trimmed)
    return [];
  return splitTopLevel2(trimmed, ",").map((rawArg) => {
    const a = rawArg.trim();
    if (a === "$event") {
      return { type: "tooltip", target: el, currentTarget: el, preventDefault() {
      }, stopPropagation() {
      } };
    }
    return resolveScalarValue(app, a, ctx, el, "argument");
  });
}
function parseNumberModifier(modifiers, prefix) {
  for (const m of modifiers) {
    if (m.startsWith(prefix)) {
      const n = parseInt(m.slice(prefix.length), 10);
      if (Number.isFinite(n))
        return n;
    }
  }
  return null;
}
function parsePrefixedModifier(modifiers, prefix) {
  const m = modifiers.find((x) => x.startsWith(prefix));
  return m ? m.slice(prefix.length) : null;
}

// packages/helix-tooltip/src/async-content.js
function applyAsyncResult(state, el, result, updateTooltip) {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    if (result.title !== void 0)
      state.content = result.title;
    else if (result.content !== void 0)
      state.content = result.content;
    else {
      console.warn('[Helix.js][$tooltip] async hx-tooltip result has no "title" or "content" key.');
      state.content = "";
    }
    if (result.html !== void 0)
      state.html = !!result.html;
    if (result.placement !== void 0)
      state.placement = result.placement;
    if (result.theme !== void 0)
      state.theme = result.theme;
    if (result.animation !== void 0)
      state.animation = result.animation;
    if (result.interactive !== void 0)
      state.interactive = !!result.interactive;
  } else {
    state.content = result == null ? "" : result;
  }
  updateTooltip(el, state.content);
}
function tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip) {
  const trimmed = (contentRaw || "").trim();
  const match = trimmed.match(FUNCTION_CALL_RE);
  if (!match)
    return false;
  const fnPath = match[1];
  const rawArgs = match[2];
  const fn = app.resolvePath(fnPath, ctx);
  if (typeof fn !== "function") {
    console.warn(`[Helix.js][$tooltip] hx-tooltip could not find a function at "${fnPath}" for the call "${trimmed}".`);
    state.content = "";
    return true;
  }
  const args = resolveCallArgs(app, rawArgs, ctx, el);
  let destroyed = false;
  trackCleanup(() => {
    destroyed = true;
  });
  Promise.resolve().then(() => fn.apply(ctx, args)).then((result) => {
    if (destroyed)
      return;
    applyAsyncResult(state, el, result, updateTooltip);
  }).catch((err) => {
    if (destroyed)
      return;
    console.error(`[Helix.js][$tooltip] async hx-tooltip call "${trimmed}" failed:`, err);
    state.content = "";
    updateTooltip(el, state.content);
  });
  return true;
}

// packages/helix-tooltip/src/index.js
var __hxTooltipInstanceSeq = 0;
var HelixTooltipPlugin = {
  name: "tooltip",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "1.0.0" || "1.0.0",
  requires: {
    helix: ">=11.1.5"
  },
  install(app, options = {}) {
    if (app.$tooltip && typeof app.$tooltip.setDefaults === "function") {
      app.$tooltip.setDefaults(options);
      return;
    }
    if (typeof document === "undefined") {
      console.error("[Helix.js][$tooltip] DOM is required. This plugin cannot run outside a browser.");
      return () => {
      };
    }
    const instanceId = ++__hxTooltipInstanceSeq;
    const dirPrefix = app.config && typeof app.config.prefix === "string" && app.config.prefix || "hx-";
    const tooltipElId = `${dirPrefix}tooltip-${instanceId}`;
    let isDestroyed = false;
    function warnDestroyed(method) {
      console.warn(`[Helix.js][$tooltip] Ignored ${method}() call after destroy().`);
    }
    const defaults2 = { ...DEFAULT_OPTIONS, ...options };
    function validateDefaults() {
      if (!PLACEMENTS.includes(defaults2.placement))
        defaults2.placement = "top";
      if (typeof defaults2.theme !== "string" || !defaults2.theme)
        defaults2.theme = "dark";
      if (typeof defaults2.animation !== "string" || !defaults2.animation)
        defaults2.animation = "zoom";
    }
    validateDefaults();
    const container = document.querySelector(defaults2.appendTo) || document.body;
    injectStyles(defaults2.zIndex, defaults2.maxWidth);
    let tooltipEl = null;
    let contentEl = null;
    let arrowEl = null;
    let lastAnimClass = null;
    let lastThemeClass = null;
    let lastCustomClassName = null;
    let tooltipResizeObserver = null;
    function ensureTooltipEl() {
      if (isDestroyed)
        return null;
      if (tooltipEl)
        return tooltipEl;
      tooltipEl = document.createElement("div");
      tooltipEl.id = tooltipElId;
      tooltipEl.className = "hx-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      tooltipEl.setAttribute("aria-hidden", "true");
      if (defaults2.ariaLive) {
        tooltipEl.setAttribute("aria-live", defaults2.ariaLive === true ? "polite" : defaults2.ariaLive);
      }
      contentEl = document.createElement("div");
      contentEl.className = "hx-tooltip-content";
      arrowEl = document.createElement("div");
      arrowEl.className = "hx-tooltip-arrow";
      tooltipEl.appendChild(contentEl);
      tooltipEl.appendChild(arrowEl);
      container.appendChild(tooltipEl);
      tooltipEl.addEventListener("mouseenter", () => {
        if (tooltipEl.classList.contains("hx-tooltip-interactive"))
          clearTimers();
      });
      tooltipEl.addEventListener("mouseleave", () => {
        if (tooltipEl.classList.contains("hx-tooltip-interactive"))
          hideTooltip();
      });
      if (typeof ResizeObserver !== "undefined") {
        tooltipResizeObserver = new ResizeObserver(() => scheduleReposition());
        tooltipResizeObserver.observe(tooltipEl);
      }
      return tooltipEl;
    }
    let activeEl = null;
    let activePlacement = defaults2.placement;
    let followMode = false;
    let activeOverrides = { offset: defaults2.offset, arrow: defaults2.arrow };
    function applyArrow(arrow) {
      if (!arrowEl)
        return;
      if (!arrow) {
        arrowEl.style.left = "";
        arrowEl.style.top = "";
        return;
      }
      if (arrow.axis === "x") {
        arrowEl.style.left = `${arrow.value}px`;
        arrowEl.style.top = "";
      } else {
        arrowEl.style.top = `${arrow.value}px`;
        arrowEl.style.left = "";
      }
    }
    function positionTooltip() {
      if (followMode)
        return;
      if (!activeEl || !tooltipEl || !document.body.contains(activeEl))
        return;
      const rect = activeEl.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();
      const { placement, top, left, arrow } = computePosition(rect, tipRect, activePlacement, {
        offset: activeOverrides.offset,
        arrowEnabled: activeOverrides.arrow,
        viewportPadding: defaults2.viewportPadding
      });
      tooltipEl.style.left = `${Math.round(left)}px`;
      tooltipEl.style.top = `${Math.round(top)}px`;
      if (tooltipEl.dataset.placement !== placement)
        tooltipEl.dataset.placement = placement;
      applyArrow(arrow);
    }
    function positionFollow(x, y) {
      if (!tooltipEl)
        return;
      const tipRect = tooltipEl.getBoundingClientRect();
      const { top, left } = computeFollowPosition(x, y, tipRect, defaults2.viewportPadding);
      tooltipEl.style.left = `${Math.round(left)}px`;
      tooltipEl.style.top = `${Math.round(top)}px`;
    }
    let repositionRaf = null;
    function scheduleReposition() {
      if (followMode)
        return;
      if (repositionRaf)
        return;
      repositionRaf = requestAnimationFrame(() => {
        repositionRaf = null;
        positionTooltip();
      });
    }
    window.addEventListener("scroll", scheduleReposition, true);
    window.addEventListener("resize", scheduleReposition);
    let anchorResizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      anchorResizeObserver = new ResizeObserver(() => scheduleReposition());
    }
    let liveTrackRaf = null;
    let liveTrackIntersectionObserver = null;
    let anchorIntersecting = true;
    function onVisibilityChange() {
      if (typeof document.hidden === "undefined")
        return;
      if (document.hidden) {
        if (liveTrackRaf) {
          cancelAnimationFrame(liveTrackRaf);
          liveTrackRaf = null;
        }
      } else if (defaults2.liveTracking && activeEl && !followMode && !liveTrackRaf) {
        runLiveTrackLoop();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    function runLiveTrackLoop() {
      const loop = () => {
        if (!activeEl) {
          liveTrackRaf = null;
          return;
        }
        if (anchorIntersecting && !document.hidden)
          positionTooltip();
        liveTrackRaf = requestAnimationFrame(loop);
      };
      liveTrackRaf = requestAnimationFrame(loop);
    }
    function startLiveTracking() {
      if (!defaults2.liveTracking || followMode || !activeEl)
        return;
      anchorIntersecting = true;
      if (typeof IntersectionObserver !== "undefined") {
        liveTrackIntersectionObserver = new IntersectionObserver((entries) => {
          anchorIntersecting = entries[0] ? entries[0].isIntersecting : true;
        });
        liveTrackIntersectionObserver.observe(activeEl);
      }
      runLiveTrackLoop();
    }
    function stopLiveTracking() {
      if (liveTrackRaf) {
        cancelAnimationFrame(liveTrackRaf);
        liveTrackRaf = null;
      }
      if (liveTrackIntersectionObserver) {
        liveTrackIntersectionObserver.disconnect();
        liveTrackIntersectionObserver = null;
      }
      anchorIntersecting = true;
    }
    function onDismissGesture(e) {
      if (!activeEl)
        return;
      if (activeEl.contains(e.target))
        return;
      if (tooltipEl && tooltipEl.contains(e.target))
        return;
      hideTooltip({ immediate: true });
    }
    if (defaults2.closeOnClickOutside) {
      document.addEventListener("click", onDismissGesture, true);
      document.addEventListener("touchstart", onDismissGesture, true);
    }
    function onKeydown(e) {
      if (e.key === "Escape" && activeEl)
        hideTooltip({ immediate: true });
    }
    if (defaults2.closeOnEscape) {
      document.addEventListener("keydown", onKeydown);
    }
    let showTimer = null;
    let hideTimer = null;
    function clearTimers() {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }
    function setContent(content, isHtml, el) {
      const text = content == null ? "" : String(content);
      if (isHtml) {
        contentEl.innerHTML = typeof defaults2.sanitize === "function" ? defaults2.sanitize(text, { el }) : text;
      } else {
        contentEl.textContent = text;
      }
    }
    function showTooltip(el, content, opts = {}) {
      if (isDestroyed) {
        warnDestroyed("show");
        return;
      }
      if (!el)
        return;
      const st = elState.get(el) || {};
      if (opts.disabled === true || opts.disabled === void 0 && st.disabled)
        return;
      const el_ = ensureTooltipEl();
      if (!el_)
        return;
      clearTimers();
      const theme = opts.theme || st.theme || defaults2.theme;
      const placement = opts.placement || st.placement || defaults2.placement;
      const animation = opts.animation || st.animation || defaults2.animation;
      const isHtml = opts.html !== void 0 ? opts.html : !!st.html;
      const isInteractive = opts.interactive !== void 0 ? opts.interactive : !!st.interactive;
      const isFollow = opts.follow !== void 0 ? opts.follow : !!st.follow;
      const offset = opts.offset ?? (typeof st.offset === "number" ? st.offset : defaults2.offset);
      const showArrow = opts.arrow ?? (typeof st.arrow === "boolean" ? st.arrow : defaults2.arrow);
      const maxWidth = opts.maxWidth ?? st.maxWidth;
      const className = opts.className ?? st.className ?? null;
      const doShow = () => {
        setContent(content, isHtml, el);
        if (lastThemeClass)
          el_.classList.remove(lastThemeClass);
        const themeClass = `hx-tooltip-${theme}`;
        el_.classList.add(themeClass);
        lastThemeClass = themeClass;
        if (lastAnimClass)
          el_.classList.remove(lastAnimClass);
        const animClass = `hx-tooltip-anim-${animation}`;
        el_.classList.add(animClass);
        lastAnimClass = animClass;
        if (lastCustomClassName)
          el_.classList.remove(lastCustomClassName);
        if (className)
          el_.classList.add(className);
        lastCustomClassName = className;
        el_.style.maxWidth = maxWidth !== void 0 ? typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth : "";
        el_.classList.toggle("hx-tooltip-interactive", isInteractive);
        el_.classList.toggle("hx-tooltip-no-arrow", !showArrow || isFollow);
        el_.setAttribute("aria-hidden", "false");
        el.setAttribute("aria-describedby", el_.id);
        if (anchorResizeObserver)
          anchorResizeObserver.disconnect();
        if (anchorResizeObserver && !isFollow)
          anchorResizeObserver.observe(el);
        activeEl = el;
        activePlacement = placement;
        followMode = isFollow;
        activeOverrides = { offset, arrow: showArrow };
        if (isFollow && opts.followPos) {
          positionFollow(opts.followPos.x, opts.followPos.y);
        } else {
          positionTooltip();
        }
        requestAnimationFrame(() => el_.classList.add("hx-tooltip-visible"));
        startLiveTracking();
      };
      const delay = opts.delay ?? st.showDelay ?? defaults2.showDelay;
      if (delay > 0)
        showTimer = setTimeout(doShow, delay);
      else
        doShow();
    }
    function hideTooltip(opts = {}) {
      clearTimers();
      const doHide = () => {
        if (tooltipEl) {
          tooltipEl.classList.remove("hx-tooltip-visible");
          tooltipEl.setAttribute("aria-hidden", "true");
        }
        if (activeEl)
          activeEl.removeAttribute("aria-describedby");
        if (anchorResizeObserver)
          anchorResizeObserver.disconnect();
        stopLiveTracking();
        activeEl = null;
        followMode = false;
      };
      const st = activeEl ? elState.get(activeEl) || {} : {};
      const delay = opts.immediate ? 0 : opts.delay ?? st.hideDelay ?? defaults2.hideDelay;
      if (delay > 0)
        hideTimer = setTimeout(doHide, delay);
      else
        doHide();
    }
    function updateTooltip(el, content) {
      if (activeEl === el && contentEl) {
        const st = elState.get(el) || {};
        setContent(content, !!st.html, el);
        scheduleReposition();
      }
    }
    const elState = /* @__PURE__ */ new WeakMap();
    function findAnchor(target) {
      let node = target;
      while (node) {
        if (elState.has(node))
          return node;
        node = node.parentNode;
      }
      return null;
    }
    app.directive("tooltip", {
      mounted(el, binding) {
        const { value: val, arg, modifiers, ctx, trackCleanup } = binding;
        const trimmedVal = (val || "").trim();
        let objectConfig = null;
        let contentRaw = val;
        if (OBJECT_LITERAL_RE.test(trimmedVal)) {
          objectConfig = parseObjectLiteral(trimmedVal);
          if (objectConfig === null) {
            console.warn(`[Helix.js][$tooltip] hx-tooltip value looks like an object but couldn't be parsed: "${trimmedVal}". Rendering empty.`);
            contentRaw = "''";
          } else if (objectConfig.title !== void 0) {
            contentRaw = objectConfig.title;
          } else if (objectConfig.content !== void 0) {
            contentRaw = objectConfig.content;
          } else {
            console.warn(`[Helix.js][$tooltip] hx-tooltip object config has no "title" or "content" key: "${trimmedVal}"`);
            contentRaw = "''";
          }
        }
        const cfg = (key) => objectConfig && objectConfig[key] !== void 0 ? resolveScalarValue(app, objectConfig[key], ctx, el, key) : void 0;
        const modifierTrigger = TRIGGER_WORDS.find((t) => modifiers.includes(t));
        const trigger2 = String(cfg("trigger") ?? (arg || modifierTrigger || "hover")).toLowerCase();
        const placement = cfg("placement") ?? (PLACEMENTS.find((p) => modifiers.includes(p)) || defaults2.placement);
        const customTheme = parsePrefixedModifier(modifiers, "theme-");
        const modifierTheme = customTheme || (modifiers.includes("light") ? "light" : modifiers.includes("dark") ? "dark" : defaults2.theme);
        const theme = cfg("theme") ?? modifierTheme;
        const customAnim = parsePrefixedModifier(modifiers, "anim-");
        const modifierAnim = customAnim || ANIMATION_WORDS.find((a) => modifiers.includes(a)) || defaults2.animation;
        const animation = cfg("animation") ?? modifierAnim;
        const html = cfg("html") ?? modifiers.includes("html");
        const interactive = cfg("interactive") ?? modifiers.includes("interactive");
        const follow = cfg("follow") ?? modifiers.includes("follow");
        const disabled = cfg("disabled") ?? false;
        const className = cfg("className") ?? null;
        const maxWidth = cfg("maxWidth");
        const offset = cfg("offset");
        const showArrow = cfg("showArrow") ?? cfg("arrow");
        const delayBoth = cfg("delay") ?? parseNumberModifier(modifiers, "delay-");
        const showDelay = cfg("showDelay") ?? parseNumberModifier(modifiers, "show-") ?? delayBoth ?? defaults2.showDelay;
        const hideDelay = cfg("hideDelay") ?? parseNumberModifier(modifiers, "hide-") ?? delayBoth ?? defaults2.hideDelay;
        const state = {
          trigger: trigger2,
          placement,
          theme,
          animation,
          html,
          interactive,
          follow,
          showDelay,
          hideDelay,
          disabled,
          className,
          maxWidth,
          offset,
          arrow: showArrow,
          content: "",
          longPressTimer: null
        };
        elState.set(el, state);
        if (!tryStartAsyncContent(app, contentRaw, ctx, el, state, trackCleanup, updateTooltip)) {
          const stopWatch = app.watchEffect(() => {
            state.content = resolveContent(app, contentRaw, ctx, el);
            updateTooltip(el, state.content);
          });
          trackCleanup(stopWatch);
        }
      },
      unmounted(el) {
        if (activeEl === el)
          hideTooltip({ immediate: true });
        const st = elState.get(el);
        if (st && st.longPressTimer)
          clearTimeout(st.longPressTimer);
        elState.delete(el);
      }
    });
    function delegatedPointerOver(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "hover")
        return;
      if (e.relatedTarget && anchor.contains(e.relatedTarget))
        return;
      showTooltip(anchor, st.content);
    }
    function delegatedPointerOut(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "hover")
        return;
      if (e.relatedTarget && anchor.contains(e.relatedTarget))
        return;
      hideTooltip();
    }
    function delegatedFocusIn(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "hover" && st.trigger !== "focus")
        return;
      showTooltip(anchor, st.content);
    }
    function delegatedFocusOut(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "hover" && st.trigger !== "focus")
        return;
      hideTooltip({ immediate: true });
    }
    function delegatedClick(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "click")
        return;
      if (activeEl === anchor)
        hideTooltip({ immediate: true });
      else
        showTooltip(anchor, st.content, { delay: 0 });
    }
    function delegatedTouchStart(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (!st || st.trigger !== "hover")
        return;
      st.longPressTimer = setTimeout(() => showTooltip(anchor, st.content, { delay: 0 }), defaults2.longPressDelay);
    }
    function delegatedTouchEndOrMove(e) {
      const anchor = findAnchor(e.target);
      if (!anchor)
        return;
      const st = elState.get(anchor);
      if (st && st.longPressTimer) {
        clearTimeout(st.longPressTimer);
        st.longPressTimer = null;
      }
    }
    function delegatedPointerMove(e) {
      if (!activeEl || !followMode)
        return;
      if (!activeEl.contains(e.target))
        return;
      positionFollow(e.clientX, e.clientY);
    }
    document.addEventListener("mouseover", delegatedPointerOver);
    document.addEventListener("mouseout", delegatedPointerOut);
    document.addEventListener("focusin", delegatedFocusIn);
    document.addEventListener("focusout", delegatedFocusOut);
    document.addEventListener("click", delegatedClick);
    document.addEventListener("touchstart", delegatedTouchStart, { passive: true });
    document.addEventListener("touchend", delegatedTouchEndOrMove);
    document.addEventListener("touchmove", delegatedTouchEndOrMove);
    document.addEventListener("pointermove", delegatedPointerMove);
    const $tooltip = {
      show(el, content, opts = {}) {
        const state = elState.get(el) || {};
        if (content !== void 0)
          state.content = content;
        elState.set(el, state);
        showTooltip(el, content !== void 0 ? content : state.content, opts);
      },
      hide(opts = {}) {
        if (isDestroyed) {
          warnDestroyed("hide");
          return;
        }
        hideTooltip(opts);
      },
      toggle(el, content, opts = {}) {
        if (isDestroyed) {
          warnDestroyed("toggle");
          return;
        }
        if (activeEl === el)
          hideTooltip({ immediate: true });
        else
          $tooltip.show(el, content, opts);
      },
      hideAll() {
        if (isDestroyed) {
          warnDestroyed("hideAll");
          return;
        }
        hideTooltip({ immediate: true });
      },
      update(el, content) {
        if (isDestroyed) {
          warnDestroyed("update");
          return;
        }
        const state = elState.get(el);
        if (state)
          state.content = content;
        updateTooltip(el, content);
      },
      isVisible(el) {
        return !isDestroyed && activeEl === el && !!tooltipEl && tooltipEl.classList.contains("hx-tooltip-visible");
      },
      setDefaults(patch = {}) {
        if (isDestroyed) {
          warnDestroyed("setDefaults");
          return;
        }
        Object.assign(defaults2, patch);
        validateDefaults();
      },
      destroy() {
        pluginCleanup();
      },
      raw: () => tooltipEl
    };
    app.namespace("tooltip", {
      $tooltip,
      show: $tooltip.show,
      hide: $tooltip.hide,
      toggle: $tooltip.toggle,
      hideAll: $tooltip.hideAll,
      update: $tooltip.update,
      isVisible: $tooltip.isVisible,
      setDefaults: $tooltip.setDefaults
    });
    app.$tooltip = $tooltip;
    if (app.provide) {
      app.provide("$tooltip", $tooltip);
    }
    function pluginCleanup() {
      if (isDestroyed)
        return;
      isDestroyed = true;
      clearTimers();
      stopLiveTracking();
      if (repositionRaf) {
        cancelAnimationFrame(repositionRaf);
        repositionRaf = null;
      }
      window.removeEventListener("scroll", scheduleReposition, true);
      window.removeEventListener("resize", scheduleReposition);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (anchorResizeObserver) {
        anchorResizeObserver.disconnect();
        anchorResizeObserver = null;
      }
      if (tooltipResizeObserver) {
        tooltipResizeObserver.disconnect();
        tooltipResizeObserver = null;
      }
      if (defaults2.closeOnClickOutside) {
        document.removeEventListener("click", onDismissGesture, true);
        document.removeEventListener("touchstart", onDismissGesture, true);
      }
      if (defaults2.closeOnEscape) {
        document.removeEventListener("keydown", onKeydown);
      }
      document.removeEventListener("mouseover", delegatedPointerOver);
      document.removeEventListener("mouseout", delegatedPointerOut);
      document.removeEventListener("focusin", delegatedFocusIn);
      document.removeEventListener("focusout", delegatedFocusOut);
      document.removeEventListener("click", delegatedClick);
      document.removeEventListener("touchstart", delegatedTouchStart, { passive: true });
      document.removeEventListener("touchend", delegatedTouchEndOrMove);
      document.removeEventListener("touchmove", delegatedTouchEndOrMove);
      document.removeEventListener("pointermove", delegatedPointerMove);
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
      releaseStyles();
      activeEl = null;
      followMode = false;
    }
    return pluginCleanup;
  }
};
var root6 = typeof window !== "undefined" ? window : globalThis;
root6.HelixTooltipPlugin = HelixTooltipPlugin;
if (root6.Helix && typeof root6.Helix.directive === "function") {
  HelixTooltipPlugin.install(root6.Helix, {});
}
var src_default7 = HelixTooltipPlugin;

// packages/helix-notify/src/index.js
var HelixNotifyPlugin = function() {
  "use strict";
  let swalLoadPromise = null;
  function createFallbackSwal() {
    return {
      fire: (opts = {}) => {
        const title = typeof opts === "string" ? opts : opts.title || "";
        const text = typeof opts === "object" ? opts.text || "" : "";
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(`${title}
${text}`.trim());
        } else {
          console.log(`[HelixNotify:Alert] ${title} ${text}`);
        }
        return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
      },
      mixin: function(mixinOpts) {
        return {
          fire: (opts = {}) => {
            const title = typeof opts === "string" ? opts : opts.title || "";
            console.log(`[HelixNotify:Toast] ${title}`);
            return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false });
          }
        };
      },
      close: () => {
      },
      showLoading: () => {
      },
      stopTimer: () => {
      },
      resumeTimer: () => {
      },
      DismissReason: {
        cancel: "cancel",
        backdrop: "backdrop",
        close: "close",
        esc: "esc",
        timer: "timer"
      }
    };
  }
  function ensureSwal(options = {}) {
    const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
    if (root10.Swal) {
      return Promise.resolve(root10.Swal);
    }
    if (swalLoadPromise) {
      return swalLoadPromise;
    }
    if (typeof document === "undefined") {
      return Promise.resolve(createFallbackSwal());
    }
    const cdnUrl = options.cdnUrl || "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    const existingScript = document.querySelector('script[src*="sweetalert2"]');
    if (existingScript) {
      swalLoadPromise = new Promise((resolve) => {
        if (root10.Swal)
          return resolve(root10.Swal);
        const onLoad = () => resolve(root10.Swal || createFallbackSwal());
        const onError = () => resolve(createFallbackSwal());
        existingScript.addEventListener("load", onLoad, { once: true });
        existingScript.addEventListener("error", onError, { once: true });
        setTimeout(() => resolve(root10.Swal || createFallbackSwal()), 5e3);
      });
      return swalLoadPromise;
    }
    swalLoadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = cdnUrl;
      script.async = true;
      script.onload = () => {
        resolve(root10.Swal || createFallbackSwal());
      };
      script.onerror = () => {
        console.warn("[HelixNotify] Failed to auto-load SweetAlert2 from CDN:", cdnUrl);
        resolve(createFallbackSwal());
      };
      (document.head || document.body || document.documentElement).appendChild(script);
    });
    return swalLoadPromise;
  }
  function install(api, options = {}) {
    if (api.$notify)
      return;
    const themes2 = {
      clinical: {
        confirmColor: "#007bff",
        cancelColor: "#6c757d",
        denyColor: "#f59e0b",
        popupClass: "hx-swal-clinical",
        toastPosition: "top-end"
      },
      glass: {
        confirmColor: "#4f46e5",
        cancelColor: "#f43f5e",
        denyColor: "#f59e0b",
        popupClass: "hx-swal-glass",
        toastPosition: "bottom-end"
      },
      dark: {
        confirmColor: "#10b981",
        cancelColor: "#ef4444",
        denyColor: "#f59e0b",
        popupClass: "hx-swal-dark",
        toastPosition: "top-end"
      },
      neon: {
        confirmColor: "#ec4899",
        cancelColor: "#3b82f6",
        denyColor: "#eab308",
        popupClass: "hx-swal-neon",
        toastPosition: "top-end"
      },
      brutal: {
        confirmColor: "#000000",
        cancelColor: "#ef4444",
        denyColor: "#eab308",
        popupClass: "hx-swal-brutal",
        toastPosition: "bottom-right"
      },
      aurora: {
        confirmColor: "#8b5cf6",
        cancelColor: "#f43f5e",
        denyColor: "#10b981",
        popupClass: "hx-swal-aurora",
        toastPosition: "top-center"
      }
    };
    const defaults2 = {
      theme: "clinical",
      toastTimer: 3e3,
      queueLimit: 3,
      showCloseButton: false,
      cdnUrl: "https://cdn.jsdelivr.net/npm/sweetalert2@11"
    };
    const baseTheme = themes2[options.theme || "clinical"] || themes2.clinical;
    const config = { ...defaults2, ...baseTheme, ...options };
    ensureSwal(config);
    const styleId3 = "hx-notify-styles";
    if (typeof document !== "undefined" && !document.getElementById(styleId3)) {
      const style = document.createElement("style");
      style.id = styleId3;
      style.textContent = `
                .swal2-popup { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }

                .hx-swal-clinical { 
                    border-radius: 8px !important; 
                    font-family: 'Inter', system-ui, sans-serif; 
                    border: 1px solid #e5e7eb !important; 
                }

                .hx-swal-glass { 
                    background: rgba(255, 255, 255, 0.65) !important; 
                    backdrop-filter: blur(16px) saturate(180%) !important; 
                    -webkit-backdrop-filter: blur(16px) saturate(180%) !important; 
                    border-radius: 16px !important; 
                    border: 1px solid rgba(255, 255, 255, 0.4) !important;
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1) !important; 
                    color: #1f2937 !important; 
                }
                .hx-swal-glass .swal2-title, .hx-swal-glass .swal2-html-container { color: #111827 !important; }

                .hx-swal-dark { 
                    background: #1f2937 !important; 
                    color: #f9fafb !important; 
                    border-radius: 12px !important; 
                }
                .hx-swal-dark .swal2-title, .hx-swal-dark .swal2-html-container { color: #f9fafb !important; }

                .hx-swal-neon { 
                    background: #0f172a !important; 
                    color: #ffffff !important; 
                    border: 1px solid #ec4899 !important; 
                    box-shadow: 0 0 15px rgba(236, 72, 153, 0.3), inset 0 0 10px rgba(59, 130, 246, 0.1) !important; 
                    border-radius: 12px !important; 
                }
                .hx-swal-neon .swal2-title, .hx-swal-neon .swal2-html-container { 
                    color: #fdf2f8 !important; 
                    text-shadow: 0 0 6px rgba(255, 255, 255, 0.2); 
                }

                .hx-swal-brutal { 
                    background: #ffffff !important; 
                    color: #000000 !important; 
                    border: 3px solid #000000 !important; 
                    box-shadow: 6px 6px 0px #000000 !important; 
                    border-radius: 0px !important; 
                    font-family: 'Courier New', ui-monospace, monospace !important; 
                }
                .hx-swal-brutal .swal2-title, .hx-swal-brutal .swal2-html-container { 
                    color: #000000 !important; 
                    font-weight: bold !important; 
                }
                .hx-swal-brutal .swal2-confirm, .hx-swal-brutal .swal2-cancel, .hx-swal-brutal .swal2-deny { 
                    border: 2px solid #000 !important; 
                    box-shadow: 3px 3px 0px #000 !important; 
                    border-radius: 0 !important; 
                    font-weight: bold !important;
                }

                .hx-swal-aurora { 
                    background: linear-gradient(135deg, #1e1b4b, #312e81, #1e1b4b) !important; 
                    color: #ffffff !important; 
                    border: 1px solid rgba(255,255,255,0.12) !important; 
                    box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; 
                    border-radius: 20px !important; 
                }
                .hx-swal-aurora .swal2-title, .hx-swal-aurora .swal2-html-container { color: #e0e7ff !important; }
            `;
      if (document.head) {
        document.head.appendChild(style);
      }
    }
    let activeToasts = 0;
    const toastQueue = [];
    const runToast = (fn) => {
      if (activeToasts < config.queueLimit) {
        activeToasts++;
        fn().finally(() => {
          activeToasts--;
          if (toastQueue.length)
            runToast(toastQueue.shift());
        });
      } else {
        toastQueue.push(fn);
      }
    };
    const getToastInstance = async () => {
      const SwalRef = await ensureSwal(config);
      return SwalRef.mixin({
        toast: true,
        position: config.toastPosition,
        showConfirmButton: false,
        showCloseButton: config.showCloseButton,
        timer: config.toastTimer,
        timerProgressBar: true,
        customClass: { popup: config.popupClass },
        didOpen: (toast) => {
          if (SwalRef.stopTimer)
            toast.addEventListener("mouseenter", SwalRef.stopTimer);
          if (SwalRef.resumeTimer)
            toast.addEventListener("mouseleave", SwalRef.resumeTimer);
        }
      });
    };
    function createQuery(promiseFactory, resultMapper = null) {
      const handlers = {
        onConfirmed: null,
        onCancelled: null,
        onDismissed: null,
        onDenied: null,
        onSuccess: null,
        onError: null,
        onFinally: null
      };
      const executePromise = Promise.resolve().then(async () => {
        try {
          const rawResult = await promiseFactory();
          const result = resultMapper ? resultMapper(rawResult) : rawResult;
          if (result.confirmed && handlers.onConfirmed)
            handlers.onConfirmed(result);
          if (result.cancelled && handlers.onCancelled)
            handlers.onCancelled(result);
          if (result.dismissed && handlers.onDismissed)
            handlers.onDismissed(result);
          if (result.denied && handlers.onDenied)
            handlers.onDenied(result);
          if (handlers.onSuccess && !result.error)
            handlers.onSuccess(result);
          return result;
        } catch (err) {
          if (handlers.onError) {
            handlers.onError(err);
            return { error: err };
          }
          throw err;
        } finally {
          if (handlers.onFinally)
            handlers.onFinally();
        }
      });
      return {
        onConfirmed(fn) {
          handlers.onConfirmed = fn;
          return this;
        },
        onCancelled(fn) {
          handlers.onCancelled = fn;
          return this;
        },
        onDismissed(fn) {
          handlers.onDismissed = fn;
          return this;
        },
        onDenied(fn) {
          handlers.onDenied = fn;
          return this;
        },
        onSuccess(fn) {
          handlers.onSuccess = fn;
          return this;
        },
        onError(fn) {
          handlers.onError = fn;
          return this;
        },
        onFinally(fn) {
          handlers.onFinally = fn;
          return this;
        },
        then: executePromise.then.bind(executePromise),
        catch: executePromise.catch.bind(executePromise),
        finally: executePromise.finally.bind(executePromise)
      };
    }
    const $notify = {
      ensureReady: () => ensureSwal(config),
      toast: {
        success: (title, ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon: "success", title, ...ext });
          res(r);
          return r;
        })),
        error: (title, ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon: "error", title, ...ext });
          res(r);
          return r;
        })),
        info: (title, ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon: "info", title, ...ext });
          res(r);
          return r;
        })),
        warning: (title, ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon: "warning", title, ...ext });
          res(r);
          return r;
        })),
        question: (title, ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon: "question", title, ...ext });
          res(r);
          return r;
        })),
        fire: (title, icon = "info", ext = {}) => new Promise((res) => runToast(async () => {
          const Toast = await getToastInstance();
          const r = await Toast.fire({ icon, title, ...ext });
          res(r);
          return r;
        }))
      },
      alert: async (title, text, icon = "info", ext = {}) => {
        const SwalRef = await ensureSwal(config);
        return SwalRef.fire({
          title,
          text,
          icon,
          confirmButtonColor: config.confirmColor,
          customClass: { popup: config.popupClass },
          ...ext
        });
      },
      confirm: async (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
        const SwalRef = await ensureSwal(config);
        const res = await SwalRef.fire({
          title,
          text,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: config.confirmColor,
          cancelButtonColor: config.cancelColor,
          confirmButtonText: confirmText,
          customClass: { popup: config.popupClass },
          ...ext
        });
        return !!res.isConfirmed;
      },
      confirmQuery: (title, text = "Action cannot be reverted.", confirmText = "Confirm", ext = {}) => {
        return createQuery(async () => {
          const SwalRef = await ensureSwal(config);
          const res = await SwalRef.fire({
            title,
            text,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: config.confirmColor,
            cancelButtonColor: config.cancelColor,
            confirmButtonText: confirmText,
            customClass: { popup: config.popupClass },
            ...ext
          });
          const cancelReason = SwalRef.DismissReason && SwalRef.DismissReason.cancel || "cancel";
          return {
            confirmed: !!res.isConfirmed,
            cancelled: !!res.isDismissed && res.dismiss === cancelReason,
            dismissed: !!res.isDismissed,
            value: res.value
          };
        });
      },
      confirm3: async (title, text, opts = {}) => {
        const SwalRef = await ensureSwal(config);
        const { confirmText = "Yes", denyText = "No", cancelText = "Cancel", ...ext } = opts;
        const res = await SwalRef.fire({
          title,
          text,
          icon: "question",
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: confirmText,
          denyButtonText: denyText,
          cancelButtonText: cancelText,
          confirmButtonColor: config.confirmColor,
          denyButtonColor: config.denyColor,
          cancelButtonColor: config.cancelColor,
          customClass: { popup: config.popupClass },
          ...ext
        });
        return { confirmed: !!res.isConfirmed, denied: !!res.isDenied, dismissed: !!res.isDismissed, value: res.value };
      },
      confirm3Query: (title, text, opts = {}) => {
        const { confirmText = "Yes", denyText = "No", cancelText = "Cancel", ...ext } = opts;
        return createQuery(async () => {
          const SwalRef = await ensureSwal(config);
          const res = await SwalRef.fire({
            title,
            text,
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: confirmText,
            denyButtonText: denyText,
            cancelButtonText: cancelText,
            confirmButtonColor: config.confirmColor,
            denyButtonColor: config.denyColor,
            cancelButtonColor: config.cancelColor,
            customClass: { popup: config.popupClass },
            ...ext
          });
          const cancelReason = SwalRef.DismissReason && SwalRef.DismissReason.cancel || "cancel";
          return {
            confirmed: !!res.isConfirmed,
            denied: !!res.isDenied,
            cancelled: !!res.isDismissed && res.dismiss === cancelReason,
            dismissed: !!res.isDismissed,
            value: res.value
          };
        });
      },
      prompt: async (title, options2 = {}) => {
        const SwalRef = await ensureSwal(config);
        const {
          input = "text",
          inputLabel = "",
          inputPlaceholder = "",
          inputValue = "",
          inputOptions = null,
          inputAttributes = {},
          validationMessage = "This field is required",
          allowEmpty = false,
          confirmText = "Submit",
          ...ext
        } = options2;
        const { value, isConfirmed, isDismissed } = await SwalRef.fire({
          title,
          input,
          inputLabel,
          inputPlaceholder,
          inputValue,
          inputOptions,
          inputAttributes,
          showCancelButton: true,
          confirmButtonText: confirmText,
          confirmButtonColor: config.confirmColor,
          cancelButtonColor: config.cancelColor,
          customClass: { popup: config.popupClass },
          inputValidator: allowEmpty ? void 0 : (val) => {
            if (!val)
              return validationMessage;
          },
          ...ext
        });
        return { value, confirmed: !!isConfirmed, dismissed: !!isDismissed };
      },
      promptQuery: (title, options2 = {}) => {
        const {
          input = "text",
          inputLabel = "",
          inputPlaceholder = "",
          inputValue = "",
          inputOptions = null,
          inputAttributes = {},
          validationMessage = "This field is required",
          allowEmpty = false,
          confirmText = "Submit",
          ...ext
        } = options2;
        return createQuery(async () => {
          const SwalRef = await ensureSwal(config);
          const res = await SwalRef.fire({
            title,
            input,
            inputLabel,
            inputPlaceholder,
            inputValue,
            inputOptions,
            inputAttributes,
            showCancelButton: true,
            confirmButtonText: confirmText,
            confirmButtonColor: config.confirmColor,
            cancelButtonColor: config.cancelColor,
            customClass: { popup: config.popupClass },
            inputValidator: allowEmpty ? void 0 : (val) => {
              if (!val)
                return validationMessage;
            },
            ...ext
          });
          const cancelReason = SwalRef.DismissReason && SwalRef.DismissReason.cancel || "cancel";
          return {
            value: res.value,
            confirmed: !!res.isConfirmed,
            cancelled: !!res.isDismissed && res.dismiss === cancelReason,
            dismissed: !!res.isDismissed
          };
        });
      },
      async: async (title, text, promiseFn, options2 = {}) => {
        const SwalRef = await ensureSwal(config);
        const {
          successTitle = "Success",
          successText = "Operation completed.",
          showSuccess = true,
          showError = true,
          errorTitle = "Error",
          allowCancel = false,
          ...ext
        } = options2;
        SwalRef.fire({
          title,
          text,
          allowOutsideClick: false,
          allowEscapeKey: allowCancel,
          showConfirmButton: false,
          showCancelButton: allowCancel,
          cancelButtonText: "Cancel",
          cancelButtonColor: config.cancelColor,
          customClass: { popup: config.popupClass },
          didOpen: () => {
            if (SwalRef.showLoading)
              SwalRef.showLoading();
          },
          ...ext
        });
        try {
          const result = await promiseFn();
          if (showSuccess) {
            SwalRef.close();
            await SwalRef.fire({
              title: successTitle,
              text: successText,
              icon: "success",
              confirmButtonColor: config.confirmColor,
              customClass: { popup: config.popupClass },
              timer: 2e3,
              timerProgressBar: true
            });
          } else {
            SwalRef.close();
          }
          return { success: true, data: result };
        } catch (err) {
          SwalRef.close();
          if (showError) {
            await SwalRef.fire({
              title: errorTitle,
              text: err?.message || err?.data?.message || "Operation failed",
              icon: "error",
              confirmButtonColor: config.confirmColor,
              customClass: { popup: config.popupClass }
            });
          }
          return { success: false, error: err };
        }
      },
      asyncQuery: (title, text, promiseFn, options2 = {}) => {
        const {
          successTitle = "Success",
          successText = "Operation completed.",
          showSuccess = true,
          showError = true,
          errorTitle = "Error",
          allowCancel = false,
          ...ext
        } = options2;
        return createQuery(async () => {
          const SwalRef = await ensureSwal(config);
          SwalRef.fire({
            title,
            text,
            allowOutsideClick: false,
            allowEscapeKey: allowCancel,
            showConfirmButton: false,
            showCancelButton: allowCancel,
            cancelButtonText: "Cancel",
            cancelButtonColor: config.cancelColor,
            customClass: { popup: config.popupClass },
            didOpen: () => {
              if (SwalRef.showLoading)
                SwalRef.showLoading();
            },
            ...ext
          });
          try {
            const result = await promiseFn();
            if (showSuccess) {
              SwalRef.close();
              await SwalRef.fire({
                title: successTitle,
                text: successText,
                icon: "success",
                confirmButtonColor: config.confirmColor,
                customClass: { popup: config.popupClass },
                timer: 2e3,
                timerProgressBar: true
              });
            } else {
              SwalRef.close();
            }
            return { success: true, data: result, confirmed: true };
          } catch (err) {
            SwalRef.close();
            if (showError) {
              await SwalRef.fire({
                title: errorTitle,
                text: err?.message || err?.data?.message || "Operation failed",
                icon: "error",
                confirmButtonColor: config.confirmColor,
                customClass: { popup: config.popupClass }
              });
            }
            throw err;
          }
        });
      },
      get raw() {
        const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
        return root10.Swal || null;
      }
    };
    api.$notify = $notify;
    if (api.namespace) {
      api.namespace("notify", {
        $notify,
        toast: $notify.toast,
        alert: $notify.alert,
        confirm: $notify.confirm,
        confirmQuery: $notify.confirmQuery,
        confirm3: $notify.confirm3,
        confirm3Query: $notify.confirm3Query,
        prompt: $notify.prompt,
        promptQuery: $notify.promptQuery,
        async: $notify.async,
        asyncQuery: $notify.asyncQuery,
        get raw() {
          return $notify.raw;
        }
      });
    }
    if (api.provide) {
      api.provide("$notify", $notify);
    }
    const GlobalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || (typeof Helix !== "undefined" ? Helix : null);
    if (GlobalHelix) {
      GlobalHelix.$notify = $notify;
    }
    const cleanup2 = () => {
      toastQueue.length = 0;
      activeToasts = 0;
      const root10 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
      if (root10.Swal && typeof root10.Swal.close === "function") {
        root10.Swal.close();
      }
    };
    if (api.onCleanup && typeof api.onCleanup === "function") {
      api.onCleanup(cleanup2);
    }
    return cleanup2;
  }
  return {
    name: "notify",
    version: typeof import.meta !== "undefined" && define_import_meta_env_default && "2.2.6" || "2.2.6",
    requires: { helix: ">=11.1.5" },
    install
  };
}();
var root7 = typeof window !== "undefined" ? window : globalThis;
root7.HelixNotifyPlugin = HelixNotifyPlugin;
var src_default8 = HelixNotifyPlugin;

// packages/helix-loader/src/theme.js
var themes = {
  glass: {
    background: "rgba(255, 255, 255, 0.75)",
    blur: true,
    blurAmount: 12,
    textColor: "#1f2937",
    iconColor: "#3b82f6"
  },
  dark: {
    background: "rgba(15, 23, 42, 0.85)",
    blur: true,
    blurAmount: 10,
    textColor: "#f9fafb",
    iconColor: "#10b981"
  },
  light: {
    background: "rgba(248, 250, 252, 0.9)",
    blur: false,
    blurAmount: 0,
    textColor: "#0f172a",
    iconColor: "#4f46e5"
  },
  clinical: {
    background: "rgba(241, 245, 249, 0.95)",
    blur: false,
    blurAmount: 0,
    textColor: "#334155",
    iconColor: "#0d9488"
  },
  ocean: {
    background: "rgba(8, 47, 73, 0.9)",
    blur: true,
    blurAmount: 8,
    textColor: "#f0f9ff",
    iconColor: "#38bdf8"
  },
  emerald: {
    background: "rgba(6, 78, 59, 0.85)",
    blur: true,
    blurAmount: 8,
    textColor: "#ecfdf5",
    iconColor: "#34d399"
  },
  sunset: {
    background: "linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(244, 63, 94, 0.9) 100%)",
    blur: true,
    blurAmount: 6,
    textColor: "#ffffff",
    iconColor: "#ffffff"
  },
  cyberpunk: {
    background: "rgba(3, 7, 18, 0.95)",
    blur: true,
    blurAmount: 12,
    textColor: "#f43f5e",
    iconColor: "#06b6d4"
  }
};
var defaults = {
  theme: "glass",
  zIndex: 2147483647,
  fade: [300, 200],
  icon: "spinner",
  iconColor: "#4285F4",
  size: 48,
  text: "",
  gap: "16px",
  direction: "column",
  allowHtmlIcon: false,
  // install-only opt-in for raw-HTML string icons
  debug: false,
  antiFlicker: 150,
  // wait delay in ms to avoid flicker on fast actions
  minDuration: 300,
  // minimum display duration in ms to avoid quick flashing
  // Progress bar customization configurations
  progressWidth: "160px",
  progressHeight: "4px",
  progressBg: "rgba(0, 0, 0, 0.1)",
  progressColor: "",
  // falls back to theme iconColor if blank
  autoHideOnComplete: true,
  autoHideDelay: 250,
  // Performance overlay pooling size limit
  poolSize: 100
};
function normalizeFade(f) {
  if (Array.isArray(f)) {
    const i = Number.isFinite(f[0]) ? f[0] : 300;
    const o = Number.isFinite(f[1]) ? f[1] : i;
    return [i, o];
  }
  if (Number.isFinite(f))
    return [f, f];
  return [300, 200];
}

// packages/helix-loader/src/style.js
var styleId2 = "hx-loader-styles";
function setupStyles() {
  if (typeof document === "undefined")
    return null;
  let styleEl = document.getElementById(styleId2);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId2;
    if (!styleEl.dataset)
      styleEl.dataset = {};
    styleEl.dataset.hxRefcount = "0";
    styleEl.innerHTML = `
            @keyframes hx-spin { to { transform: rotate(360deg); } }
            .hx-dots { display:flex; gap:6px; }
            .hx-dots span {
                border-radius:50%;
                background:var(--hx-color);
                animation: hx-bounce 1s infinite alternate;
            }
            .hx-dots span:nth-child(2) { animation-delay: 0.15s; }
            .hx-dots span:nth-child(3) { animation-delay: 0.3s; }
            @keyframes hx-bounce {
                from { opacity:.3; transform:translateY(0); }
                to { opacity:1; transform:translateY(-8px); }
            }
            .fa-spin, .ri-spin { animation: hx-spin 1.2s linear infinite !important; }
        `;
    if (document.head && typeof document.head.appendChild === "function") {
      document.head.appendChild(styleEl);
    }
  }
  if (!styleEl.dataset)
    styleEl.dataset = {};
  styleEl.dataset.hxRefcount = String((parseInt(styleEl.dataset.hxRefcount, 10) || 0) + 1);
  return styleEl;
}
function releaseStyles2() {
  const s = document.getElementById(styleId2);
  if (s) {
    const n = (parseInt(s.dataset.hxRefcount, 10) || 1) - 1;
    if (n <= 0)
      s.remove();
    else
      s.dataset.hxRefcount = String(n);
  }
}

// packages/helix-loader/src/icon.js
var warnedHtmlDowngrade = false;
function buildIcon(cfg, allowHtml = false) {
  const wrap = document.createElement("div");
  if (typeof cfg.icon === "function") {
    const el = cfg.icon(cfg);
    if (el instanceof HTMLElement)
      wrap.appendChild(el);
    return wrap;
  }
  wrap.style.color = cfg.iconColor;
  wrap.style.fontSize = cfg.size + "px";
  if (cfg.icon === "spinner") {
    const el = document.createElement("div");
    const border = Math.max(2, cfg.size / 10);
    el.style.width = cfg.size + "px";
    el.style.height = cfg.size + "px";
    el.style.border = `${border}px solid rgba(0,0,0,0.1)`;
    el.style.borderTopColor = cfg.iconColor;
    el.style.borderRadius = "50%";
    el.style.animation = "hx-spin 0.8s linear infinite";
    wrap.appendChild(el);
  } else if (cfg.icon === "dots") {
    wrap.className = "hx-dots";
    wrap.style.setProperty("--hx-color", cfg.iconColor);
    const dot = cfg.size / 4;
    wrap.innerHTML = `<span style="width:${dot}px;height:${dot}px"></span>`.repeat(3);
  } else if (typeof cfg.icon === "string" && (cfg.icon.includes("fa-") || cfg.icon.includes("ri-"))) {
    const i = document.createElement("i");
    i.className = cfg.icon;
    i.style.fontSize = cfg.size + "px";
    wrap.appendChild(i);
  } else if (typeof cfg.icon === "string") {
    if (allowHtml) {
      wrap.innerHTML = cfg.icon;
    } else {
      wrap.textContent = cfg.icon;
      if (!warnedHtmlDowngrade) {
        warnedHtmlDowngrade = true;
        console.warn("[Helix Loader] string icon rendered as text. For markup use icon: () => HTMLElement, or set the install option allowHtmlIcon:true for raw-HTML strings.");
      }
    }
  }
  return wrap;
}

// packages/helix-loader/src/overlay.js
function buildOverlay(cfg, { scoped = false, allowHtmlIcon = false } = {}) {
  const fade = normalizeFade(cfg.fade);
  const el = document.createElement("div");
  el.style.cssText = `
        position:${scoped ? "absolute" : "fixed"}; inset:0; display:none;
        align-items:center; justify-content:center;
        background:${cfg.background};
        ${cfg.blur ? `backdrop-filter: blur(${cfg.blurAmount}px); -webkit-backdrop-filter: blur(${cfg.blurAmount}px);` : ""}
        z-index:${cfg.zIndex};
        opacity:0;
        transition: opacity ${fade[0]}ms ease;
    `;
  const container = document.createElement("div");
  container.style.cssText = `
        display:flex; flex-direction:${cfg.direction};
        align-items:center; gap:${cfg.gap};
    `;
  container.appendChild(buildIcon(cfg, allowHtmlIcon));
  let textEl = null;
  if (!scoped) {
    textEl = document.createElement("div");
    textEl.style.color = cfg.textColor;
    textEl.style.fontSize = "14px";
    textEl.style.fontFamily = "system-ui, sans-serif";
    container.appendChild(textEl);
  }
  const progressContainer = document.createElement("div");
  progressContainer.style.cssText = `
        width: ${cfg.progressWidth || "160px"};
        height: ${cfg.progressHeight || "4px"};
        background: ${cfg.progressBg || "rgba(0, 0, 0, 0.1)"};
        border-radius: 2px;
        overflow: hidden;
        display: none;
    `;
  const progressBarColor = cfg.progressColor || cfg.iconColor || "#4285F4";
  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: ${progressBarColor};
        transition: width 0.15s ease;
    `;
  progressContainer.appendChild(progressBar);
  container.appendChild(progressContainer);
  el.appendChild(container);
  return { el, container, textEl, progressContainer, progressBar };
}
function appendToBody(node) {
  if (document.body) {
    document.body.appendChild(node);
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => document.body && document.body.appendChild(node),
      { once: true }
    );
  }
}

// packages/helix-loader/src/index.js
var HelixLoaderPlugin = {
  name: "loader",
  version: typeof import.meta !== "undefined" && define_import_meta_env_default && "2.2.0" || "2.2.0",
  requires: {
    helix: ">=11.1.5"
  },
  install(app, options = {}) {
    const INSTALL_MARK = Symbol.for("helix.loader.installed");
    if (app[INSTALL_MARK]) {
      console.warn("[Helix Loader] already installed on this app; skipping.");
      return () => {
      };
    }
    const themeConfig = themes[options.theme || defaults.theme] || themes.glass;
    const globalConfig2 = { ...defaults, ...themeConfig, ...options };
    globalConfig2.fade = normalizeFade(globalConfig2.fade);
    const HTML_ICON_ALLOWED = globalConfig2.allowHtmlIcon === true;
    function log(...args) {
      if (globalConfig2.debug)
        console.log("[Helix Loader]", ...args);
    }
    setupStyles();
    const { el: overlay, textEl, progressContainer, progressBar } = buildOverlay(globalConfig2, {
      scoped: false,
      allowHtmlIcon: HTML_ICON_ALLOWED
    });
    overlay.id = "hx-loader-overlay";
    appendToBody(overlay);
    log("Overlay queued for body");
    const state = app.reactive({
      count: 0,
      active: false,
      visible: false,
      text: globalConfig2.text,
      progress: 0
    });
    const displayEffect = app.effect(() => {
      const display = state.active ? "flex" : "none";
      if (overlay.style.display !== display) {
        overlay.style.display = display;
        log("display \u2192", display);
      }
    });
    const opacityEffect = app.effect(() => {
      const opacity = state.visible ? "1" : "0";
      if (overlay.style.opacity !== opacity) {
        overlay.style.opacity = opacity;
        log("opacity \u2192", opacity);
      }
    });
    const textEffect = app.effect(() => {
      textEl.textContent = state.text;
      textEl.style.display = state.text ? "block" : "none";
    });
    const progressEffect = app.effect(() => {
      const p = state.progress;
      if (p > 0) {
        progressContainer.style.display = "block";
        progressBar.style.width = `${Math.min(100, Math.max(0, p))}%`;
      } else {
        progressContainer.style.display = "none";
        progressBar.style.width = "0%";
      }
    });
    const overlayPool = {
      pool: [],
      acquire(cfg, allowHtmlIcon) {
        if (this.pool.length > 0) {
          const item = this.pool.pop();
          const fade = normalizeFade(cfg.fade);
          item.el.style.background = cfg.background;
          item.el.style.zIndex = cfg.zIndex;
          item.el.style.transition = `opacity ${fade[0]}ms ease`;
          if (cfg.blur) {
            item.el.style.backdropFilter = `blur(${cfg.blurAmount}px)`;
            item.el.style.webkitBackdropFilter = `blur(${cfg.blurAmount}px)`;
          } else {
            item.el.style.backdropFilter = "";
            item.el.style.webkitBackdropFilter = "";
          }
          item.container.innerHTML = "";
          item.container.style.flexDirection = cfg.direction;
          item.container.style.gap = cfg.gap;
          item.container.appendChild(buildIcon(cfg, allowHtmlIcon));
          return item;
        }
        return buildOverlay(cfg, { scoped: true, allowHtmlIcon });
      },
      release(item) {
        item.el.style.opacity = "0";
        item.el.style.display = "none";
        if (item.el.parentNode)
          item.el.remove();
        if (this.pool.length < (globalConfig2.poolSize || 100)) {
          this.pool.push(item);
        }
      },
      clear() {
        this.pool = [];
      }
    };
    let flickerTimer = null;
    let minDurationTimer = null;
    let hideTimer = null;
    let shownAt = 0;
    const triggerShow = () => {
      overlay.style.transition = `opacity ${globalConfig2.fade[0]}ms ease`;
      state.active = true;
      shownAt = Date.now();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (state.count > 0)
          state.visible = true;
      }));
    };
    const triggerHide = () => {
      const out = globalConfig2.fade[1];
      overlay.style.transition = `opacity ${out}ms ease`;
      state.visible = false;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (out === 0) {
        if (state.count === 0)
          state.active = false;
      } else {
        hideTimer = setTimeout(() => {
          hideTimer = null;
          if (state.count === 0) {
            state.active = false;
            log("active = false (fade complete)");
          }
        }, out);
      }
    };
    const $loader = {
      show(text) {
        if (text !== void 0)
          state.text = text;
        state.count++;
        log("show(), count =", state.count);
        if (state.count === 1) {
          if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
          if (minDurationTimer) {
            clearTimeout(minDurationTimer);
            minDurationTimer = null;
          }
          const antiFlicker = globalConfig2.antiFlicker;
          if (antiFlicker > 0) {
            flickerTimer = setTimeout(() => {
              flickerTimer = null;
              triggerShow();
            }, antiFlicker);
          } else {
            triggerShow();
          }
        }
      },
      hide(force = false) {
        state.count = force ? 0 : Math.max(0, state.count - 1);
        log("hide(), count =", state.count);
        if (state.count === 0) {
          if (flickerTimer) {
            clearTimeout(flickerTimer);
            flickerTimer = null;
            return;
          }
          const minDuration = globalConfig2.minDuration;
          const elapsed = Date.now() - shownAt;
          if (minDuration > 0 && elapsed < minDuration) {
            const remaining = minDuration - elapsed;
            if (minDurationTimer)
              clearTimeout(minDurationTimer);
            minDurationTimer = setTimeout(() => {
              minDurationTimer = null;
              triggerHide();
            }, remaining);
          } else {
            triggerHide();
          }
        }
      },
      text(val) {
        state.text = val;
      },
      progress(val) {
        state.progress = val;
        if (val >= 100 && globalConfig2.autoHideOnComplete !== false) {
          setTimeout(() => {
            if (state.progress >= 100) {
              $loader.hide();
              state.progress = 0;
            }
          }, globalConfig2.autoHideDelay || 250);
        }
      },
      async wrap(fnOrPromise, options2 = {}) {
        const loaderText = options2.text || void 0;
        $loader.show(loaderText);
        try {
          if (typeof fnOrPromise === "function") {
            return await fnOrPromise();
          }
          return await fnOrPromise;
        } finally {
          $loader.hide();
        }
      },
      state
    };
    const directiveCleanups = /* @__PURE__ */ new WeakMap();
    const directiveUpdaters = /* @__PURE__ */ new WeakMap();
    const directiveEffects = /* @__PURE__ */ new Set();
    const allDirectiveCleanups = /* @__PURE__ */ new Set();
    app.directive("loading", {
      mounted(el, binding) {
        let patchedPosition = false;
        const prevInlinePosition = el.style.position;
        if (getComputedStyle(el).position === "static") {
          el.style.position = "relative";
          patchedPosition = true;
        }
        let localConfig = {};
        try {
          const attr = el.getAttribute("hx-loading-config");
          if (attr)
            localConfig = JSON.parse(attr);
        } catch (e) {
          console.warn("[Helix Loader] Invalid hx-loading-config JSON:", e);
        }
        if ("allowHtmlIcon" in localConfig)
          delete localConfig.allowHtmlIcon;
        const localTheme = localConfig.theme ? themes[localConfig.theme] || {} : {};
        const cfg = { ...defaults, ...globalConfig2, ...localTheme, ...localConfig };
        cfg.fade = normalizeFade(cfg.fade);
        const [fadeIn, fadeOut] = cfg.fade;
        const iconFromAttr = Object.prototype.hasOwnProperty.call(localConfig, "icon");
        const allowHtmlIcon = HTML_ICON_ALLOWED && !iconFromAttr;
        const poolItem = overlayPool.acquire(cfg, allowHtmlIcon);
        const localOverlay = poolItem.el;
        localOverlay.style.borderRadius = getComputedStyle(el).borderRadius;
        el.appendChild(localOverlay);
        const elState = { binding, lastVal: false, timer: null };
        const resolveVal = () => {
          const b = elState.binding;
          if (typeof b.value === "string" && b.ctx && app.resolvePath) {
            return !!app.resolvePath(b.value, b.ctx);
          }
          return !!b.value;
        };
        const update = () => {
          const val = resolveVal();
          if (val === elState.lastVal)
            return;
          elState.lastVal = val;
          if (val) {
            if (elState.timer) {
              clearTimeout(elState.timer);
              elState.timer = null;
            }
            localOverlay.style.display = "flex";
            void localOverlay.offsetWidth;
            localOverlay.style.transition = `opacity ${fadeIn}ms ease`;
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (elState.lastVal)
                localOverlay.style.opacity = "1";
            }));
          } else {
            if (elState.timer) {
              clearTimeout(elState.timer);
              elState.timer = null;
            }
            if (fadeOut === 0) {
              localOverlay.style.transition = "none";
              localOverlay.style.opacity = "0";
              localOverlay.style.display = "none";
            } else {
              localOverlay.style.transition = `opacity ${fadeOut}ms ease`;
              localOverlay.style.opacity = "0";
              elState.timer = setTimeout(() => {
                elState.timer = null;
                if (!elState.lastVal)
                  localOverlay.style.display = "none";
              }, fadeOut);
            }
          }
        };
        const dirEffect = app.effect(() => {
          update();
        });
        directiveEffects.add(dirEffect);
        directiveUpdaters.set(el, (b) => {
          elState.binding = b;
          update();
        });
        const cleanup2 = () => {
          if (elState.timer) {
            clearTimeout(elState.timer);
            elState.timer = null;
          }
          if (dirEffect && dirEffect.stop)
            dirEffect.stop();
          directiveEffects.delete(dirEffect);
          overlayPool.release(poolItem);
          if (patchedPosition)
            el.style.position = prevInlinePosition;
          allDirectiveCleanups.delete(cleanup2);
        };
        directiveCleanups.set(el, cleanup2);
        allDirectiveCleanups.add(cleanup2);
        update();
      },
      updated(el, binding) {
        const u = directiveUpdaters.get(el);
        if (u)
          u(binding);
      },
      unmounted(el) {
        const cleanup2 = directiveCleanups.get(el);
        if (cleanup2) {
          cleanup2();
          directiveCleanups.delete(el);
          directiveUpdaters.delete(el);
        }
      }
    });
    if (app.namespace) {
      app.namespace("loader", {
        $loader,
        show: $loader.show,
        hide: $loader.hide,
        text: $loader.text,
        progress: $loader.progress,
        wrap: $loader.wrap,
        state: $loader.state
      });
    }
    app.$loader = $loader;
    app[INSTALL_MARK] = true;
    if (app.provide) {
      app.provide("$loader", $loader);
    }
    const GlobalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || (typeof Helix !== "undefined" ? Helix : null);
    if (GlobalHelix) {
      GlobalHelix.$loader = $loader;
    }
    log("Plugin installed.");
    return () => {
      if (flickerTimer) {
        clearTimeout(flickerTimer);
        flickerTimer = null;
      }
      if (minDurationTimer) {
        clearTimeout(minDurationTimer);
        minDurationTimer = null;
      }
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (displayEffect && displayEffect.stop)
        displayEffect.stop();
      if (opacityEffect && opacityEffect.stop)
        opacityEffect.stop();
      if (textEffect && textEffect.stop)
        textEffect.stop();
      if (progressEffect && progressEffect.stop)
        progressEffect.stop();
      Array.from(allDirectiveCleanups).forEach((fn) => fn());
      allDirectiveCleanups.clear();
      directiveEffects.forEach((e) => {
        if (e && e.stop)
          e.stop();
      });
      directiveEffects.clear();
      overlayPool.clear();
      overlay.remove();
      releaseStyles2();
      if (app.removeDirective)
        app.removeDirective("loading");
      if (app.removeNamespace)
        app.removeNamespace("loader");
      if (app.$loader === $loader)
        delete app.$loader;
      delete app[INSTALL_MARK];
      state.count = 0;
      state.active = false;
      state.visible = false;
      state.progress = 0;
      log("Cleanup complete");
    };
  }
};
var root8 = typeof window !== "undefined" ? window : globalThis;
root8.HelixLoaderPlugin = HelixLoaderPlugin;
var src_default9 = HelixLoaderPlugin;

// scripts/.temp-bundle-entry-1787637404671.js
var root9 = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
if (!root9.Helix) {
  root9.Helix = globalAPI;
}
var installed = [];
if (globalAPI && typeof globalAPI.use === "function") {
  if (typeof src_default !== "undefined") {
    try {
      const plug = src_default.default || src_default;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("directives");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "directives":', e);
    }
  }
  if (typeof src_default2 !== "undefined") {
    try {
      const plug = src_default2.default || src_default2;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("helpers");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "helpers":', e);
    }
  }
  if (typeof src_default3 !== "undefined") {
    try {
      const plug = src_default3.default || src_default3;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("fetch");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "fetch":', e);
    }
  }
  if (typeof src_default4 !== "undefined") {
    try {
      const plug = src_default4.default || src_default4;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("store");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "store":', e);
    }
  }
  if (typeof src_default5 !== "undefined") {
    try {
      const plug = src_default5.default || src_default5;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("axios");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "axios":', e);
    }
  }
  if (typeof src_default6 !== "undefined") {
    try {
      const plug = src_default6.default || src_default6;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("scope");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "scope":', e);
    }
  }
  if (typeof src_default7 !== "undefined") {
    try {
      const plug = src_default7.default || src_default7;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("tooltip");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "tooltip":', e);
    }
  }
  if (typeof src_default8 !== "undefined") {
    try {
      const plug = src_default8.default || src_default8;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("notify");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "notify":', e);
    }
  }
  if (typeof src_default9 !== "undefined") {
    try {
      const plug = src_default9.default || src_default9;
      if (typeof plug.install === "function" || typeof plug === "function") {
        globalAPI.use(plug);
      }
      installed.push("loader");
    } catch (e) {
      console.warn('[Helix Bundle] Error registering plugin "loader":', e);
    }
  }
}
globalAPI.__bundledPlugins = installed;
globalAPI.__isUnifiedBundle = true;
var temp_bundle_entry_1787637404671_default = globalAPI;
export {
  globalApps as $apps,
  globalBus as $bus,
  EffectScope,
  KEY_ALIASES,
  PatchFlags,
  ScopeScheduler,
  Suspense,
  Teleport,
  Transition,
  TransitionGroup,
  globalInternal as _internal,
  createApp as app,
  applyFlip,
  batch,
  cancelFlip,
  cancelTransition,
  checkMemoryLeaks,
  closeBlock,
  componentGlobal as component,
  computed,
  globalConfig as config,
  createApp as create,
  createApp,
  createEffectGroup,
  createErrorBoundary,
  createEventListener,
  customRef,
  temp_bundle_entry_1787637404671_default as default,
  defineAsyncComponent,
  defineCustomElement,
  definePlugin,
  devtoolsAPI as devtools,
  directiveGlobal as directive,
  directivesGlobal as directives,
  dispatch,
  domAPI as dom,
  effect,
  createEffectGroup as effectGroup,
  effectScope,
  enableHtmxIntegration as enableHtmx,
  enableTracking,
  enter,
  fireTransitionHook,
  getCurrentInstance,
  getCurrentScope,
  getProfileData,
  getTransitionDurations,
  id,
  initHtmxIntegration as initHtmx,
  inject,
  inspectComponent,
  inspectDeps,
  inspectTree,
  isProxy,
  isRaw,
  isReactive,
  isReadonly,
  isRef,
  isShallow,
  lazyBind,
  leave,
  logger,
  markRaw,
  markTrace,
  matchesKey,
  measureTrace,
  memo,
  createAndMount as mount,
  namespaceGlobal as namespace,
  nextFrame,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onDestroy,
  onErrorGlobal as onError,
  onErrorCaptured,
  onMount,
  onMounted,
  onScopeDispose,
  onUnmounted,
  onUpdated,
  openBlock,
  pauseTracking,
  preload,
  preloadAll,
  profile,
  provide,
  proxyRefs,
  queueIdleJob,
  queueJob,
  queuePostFlushCb,
  queuePreFlushCb,
  reactive,
  readonly,
  rebindGlobal as rebind,
  recordPositions,
  ref,
  globalRegistry as registry,
  removeDirectiveGlobal as removeDirective,
  removeNamespaceGlobal as removeNamespace,
  resetTracking,
  resolvePath,
  resolveTeleportTarget,
  resolveTransitionConfig,
  resumeTracking,
  runWithContextGlobal as runWithContext,
  globalScopeScheduler as scopeScheduler,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  simpleEffect,
  toRaw,
  toRef,
  toRefs,
  toValue,
  triggerPluginLifecycle,
  triggerRef,
  uniqueId,
  unref,
  untrack,
  unuseGlobal as unuse,
  useGlobal as use,
  useTemplateRef,
  validatePluginDependencies,
  VERSION as version,
  watch,
  watchEffect
};
