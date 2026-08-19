(function(exports) {
  "use strict";
  class AppRegistry {
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
  }
  const globalApps = new AppRegistry();
  const globalConfig = {
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
  function queueJob(job, priority = 0) {
    if (!queueSet.has(job)) {
      queueSet.add(job);
      job.priority = priority;
      const id = job.id || 0;
      let inserted = false;
      for (let i = 0; i < queue.length; i++) {
        const existing = queue[i];
        const existingP = existing.priority || 0;
        const existingId = existing.id || 0;
        if (priority > existingP || priority === existingP && id < existingId) {
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
  let queueFlushPaused = false;
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
  const activeEffectRegistry = /* @__PURE__ */ new Set();
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
  let batchDepth = 0;
  const batchedEffects = /* @__PURE__ */ new Set();
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
  const trackStack = [];
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
  const VERSION = "11.1.19";
  const RAW = Symbol("__hx_raw");
  const IS_REF = Symbol("__hx_is_ref");
  const IS_REACTIVE = Symbol("__hx_is_reactive");
  const IS_READONLY = Symbol("__hx_is_readonly");
  const IS_SHALLOW = Symbol("__hx_is_shallow");
  const SKIP = Symbol("__hx_skip");
  const BOUND = Symbol("bound");
  const PatchFlags = {
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
  const globalComponents = {};
  const globalDirectives = {};
  const globalPlugins = [];
  let activeEffect = null;
  function setActiveEffect(effect2) {
    activeEffect = effect2;
  }
  let currentInstance = null;
  function setCurrentInstance(instance) {
    currentInstance = instance;
  }
  let shouldTrack = true;
  function setShouldTrack(val) {
    shouldTrack = val;
  }
  let effectUid = 0;
  function incrementEffectUid() {
    return effectUid++;
  }
  let globalInstanceId = 0;
  function incrementGlobalInstanceId() {
    return ++globalInstanceId;
  }
  let traceDepth = 0;
  let activeScope = null;
  function setActiveScope(scope) {
    activeScope = scope;
  }
  let currentBlock = null;
  function openBlock() {
    currentBlock = [];
  }
  function closeBlock() {
    const block = currentBlock;
    currentBlock = null;
    return block;
  }
  const targetMap = /* @__PURE__ */ new WeakMap();
  const reactiveMap = /* @__PURE__ */ new WeakMap();
  const readonlyMap = /* @__PURE__ */ new WeakMap();
  const staticNodeCache = /* @__PURE__ */ new WeakMap();
  const pathCache = /* @__PURE__ */ new Map();
  const MAX_PATH_CACHE_SIZE = 1e3;
  const vForKeyMap = /* @__PURE__ */ new WeakMap();
  const queue = [];
  const queueSet = /* @__PURE__ */ new Set();
  const preFlushQueue = [];
  const postFlushQueue = [];
  const idleQueue = [];
  let idleCallbackId = null;
  function setIdleCallbackId(val) {
    idleCallbackId = val;
  }
  let isFlushing = false;
  function setIsFlushing(val) {
    isFlushing = val;
  }
  let isFlushPending = false;
  function setIsFlushPending(val) {
    isFlushPending = val;
  }
  const MAX_FLUSH = 1e3;
  const resolvedPromise = Promise.resolve();
  const areas = {
    core: "🚀",
    component: "🧩",
    directive: "🛠️",
    plugin: "📦",
    binding: "🔗",
    scope: "🎯",
    reactive: "⚡",
    ref: "📍",
    watch: "👁️",
    computed: "🧮",
    scheduler: "🔄",
    queue: "📥",
    flush: "♻️",
    render: "🎨",
    dom: "🌳",
    template: "🧱",
    parser: "📜",
    compiler: "🏗️",
    event: "📢",
    network: "🌐",
    storage: "💾",
    cleanup: "🧹",
    destroy: "🗑️",
    validation: "✔️",
    security: "🔒",
    perf: "⏱️",
    config: "⚙️",
    api: "🔌",
    trace: "🔍"
  };
  function getLogPrefix(level, area) {
    const subsystemIcon = area ? areas[area] || "" : "";
    let levelIcon = "";
    if (level === "trace")
      levelIcon = "🔍";
    else if (level === "debug")
      levelIcon = "🐞";
    else if (level === "info")
      levelIcon = "ℹ️";
    else if (level === "warn")
      levelIcon = "⚠️";
    else if (level === "error")
      levelIcon = "❌";
    else if (level === "fatal")
      levelIcon = "💥";
    else if (level === "perf")
      levelIcon = "⏱️";
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
  const logger = {
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
  const warn = (msg, area, ...args) => {
    logger.warn(msg, area, ...args);
  };
  const globalErrorHandlers = /* @__PURE__ */ new Set();
  function onErrorGlobal(handler) {
    if (typeof handler === "function") {
      globalErrorHandlers.add(handler);
      return () => globalErrorHandlers.delete(handler);
    }
  }
  const handleError = (err, context, instance = null) => {
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
  const perfMarks = /* @__PURE__ */ new Map();
  const trace = (name, ...args) => {
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
  class EffectScope {
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
  }
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
  const arrayInstrumentations = {};
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
  const mapInstrumentations = {
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
  const setInstrumentations = {
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
  const dateMutators = [
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
  const dateGetters = [
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
  const dateInstrumentations = {};
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
  const hasDOM = typeof Node !== "undefined";
  function isRaw(value) {
    if (!value || typeof value !== "object")
      return false;
    if (value[SKIP])
      return true;
    const ctorName = value.constructor ? value.constructor.name : "";
    if (ctorName === "EffectScope" || ctorName === "WeakSet" || ctorName === "WeakMap" || ctorName === "RegExp" || ctorName === "Promise" || value instanceof WeakSet || value instanceof WeakMap || value instanceof RegExp || value instanceof Promise || value instanceof EffectScope) {
      return true;
    }
    if (!hasDOM)
      return false;
    return value instanceof Node || value instanceof Event || value instanceof NodeList || value instanceof HTMLCollection || value instanceof DOMTokenList || value instanceof Window || value instanceof Document || value instanceof CSSStyleDeclaration;
  }
  const boundMethodCache = /* @__PURE__ */ new WeakMap();
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
  class ExpressionCache {
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
  }
  const globalExpressionCache = new ExpressionCache(500);
  function compile(expression) {
    const cached = globalExpressionCache.get(expression);
    if (cached)
      return cached;
    const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
    if (Helix && typeof Helix.compile === "function") {
      const fn = Helix.compile(expression);
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
  function resolvePath(path, ctx) {
    try {
      const val = getPathParts(path).reduce((acc, part) => acc == null ? void 0 : acc[part], ctx);
      return isRef(val) ? val.value : val;
    } catch (err) {
      warn(`Failed to resolve path: ${path}`, "compiler", err);
      return void 0;
    }
  }
  function resolveRaw(path, ctx) {
    try {
      return getPathParts(path).reduce((acc, part) => acc == null ? void 0 : acc[part], ctx);
    } catch (err) {
      warn(`Failed to resolve raw path: ${path}`, "compiler", err);
      return void 0;
    }
  }
  const SIMPLE_PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\['[^']*'\]|\["[^"]*"\])*$/;
  function isSimplePathSyntax(val) {
    return SIMPLE_PATH_RE.test(val.trim());
  }
  const warnedInlineExpressions = /* @__PURE__ */ new Set();
  function resolveExpression(val, ctx, { asBoolean = false, fallback = void 0, contextName = "expression", forceExpression = false } = {}) {
    let result;
    const parts = getPathParts(val);
    let current = ctx;
    let exists = true;
    for (let i = 0; i < parts.length; i++) {
      if (current == null || typeof current !== "object" && typeof current !== "function" || !(parts[i] in current)) {
        exists = false;
        break;
      }
      current = current[parts[i]];
    }
    if (exists) {
      result = isRef(current) ? current.value : current;
    } else if (isSimplePathSyntax(val)) {
      try {
        parts.reduce((acc, part) => acc == null ? void 0 : acc[part], ctx);
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
  const componentProxyCache = /* @__PURE__ */ new WeakMap();
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
          if (prop in target)
            return target[prop];
          if (app && prop in app)
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
  function createSlots(slotEls, ctx, instance, bindNode) {
    const slots = {};
    slotEls.forEach((el) => {
      if (el.nodeType !== 1)
        return;
      let slotName = "default";
      let slotProps = null;
      Array.from(el.attributes || []).forEach((attr) => {
        if (attr.name.startsWith("v-slot:") || attr.name.startsWith("#")) {
          slotName = attr.name.replace(/^(v-slot:|#)/, "") || "default";
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
            if (attr.name.startsWith("v-slot:") || attr.name.startsWith("#")) {
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
  function computed(getterOrOptions) {
    let getter, setter;
    if (typeof getterOrOptions === "function") {
      getter = getterOrOptions;
      setter = () => warn(`[Helix] 💥 Write operation failed: computed value is readonly.`, "computed");
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set || (() => warn(`[Helix] 💥 Write operation failed: no setter provided.`, "computed"));
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
      tpl.content.querySelectorAll(selector).forEach((el) => el.remove());
    });
    tpl.content.querySelectorAll("svg script, svg *[onload]").forEach((el) => el.remove());
    const walk = (node) => {
      if (node.nodeType === 1) {
        Array.from(node.attributes).forEach((attr) => {
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
        Array.from(node.children).forEach(walk);
      }
    };
    Array.from(tpl.content.children).forEach(walk);
    return tpl.innerHTML;
  }
  function destroyNode(node) {
    const runCleanups = (n) => {
      if (n.__hx_cleanup) {
        n.__hx_cleanup.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            handleError(e, "destroyNode cleanup");
          }
        });
        n.__hx_cleanup = null;
      }
      if (n.__hx_binding && n.__hx_binding.cleanups) {
        n.__hx_binding.cleanups.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            handleError(e, "destroyNode binding cleanup");
          }
        });
        n.__hx_binding.cleanups = [];
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
  }
  function createBuiltinDirectives(appConfig) {
    const dirs = {};
    dirs.ref = {
      mounted(el, { value, ctx }) {
        const parts = getPathParts(value);
        const last = parts.pop();
        const parent = parts.reduce((acc, part) => acc == null ? void 0 : acc[part], ctx);
        if (parent)
          parent[last] = el;
        if (ctx && typeof ctx === "object") {
          if (!ctx.$refs)
            ctx.$refs = {};
          ctx.$refs[value] = el;
        }
      }
    };
    dirs.text = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, instance, trackCleanup }) {
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
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.html = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, instance, trackCleanup }) {
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
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.model = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, modifiers = [], ctx, instance, trackCleanup }) {
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
        const updateModel = (e2) => {
          const parts = getPathParts(val);
          const last = parts.pop();
          const parent = parts.reduce((acc, part) => acc == null ? void 0 : acc[part], ctx);
          if (parent) {
            if (isCheck) {
              parent[last] = e2.target.checked;
            } else if (isRadio) {
              parent[last] = e2.target.value;
            } else if (isSelectMultiple) {
              const selected = Array.from(e2.target.selectedOptions).map((opt) => opt.value);
              parent[last] = selected;
            } else {
              let rawValue = e2.target.value;
              if (isTrim && typeof rawValue === "string") {
                rawValue = rawValue.trim();
              }
              if (isNumber) {
                const num = rawValue === "" ? "" : Number(rawValue);
                parent[last] = Number.isNaN(num) ? rawValue : num;
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
        let initialRan = false;
        const updateFn = () => {
          const current = resolvePath(val, ctx);
          let changed = false;
          if (isRadio) {
            const shouldCheck = current === el.value;
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              changed = true;
            }
          } else if (isCheck) {
            const shouldCheck = !!current;
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              changed = true;
            }
          } else if (isSelectMultiple) {
            const selectedValues = Array.isArray(current) ? current : [];
            Array.from(el.options).forEach((opt) => {
              const sel = selectedValues.includes(opt.value);
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
        trackCleanup(() => {
          if (debounceTimer)
            clearTimeout(debounceTimer);
          el.removeEventListener(evtType, handler);
          cleanup(e);
        });
      }
    };
    dirs.bind = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, arg, ctx, instance, trackCleanup }) {
        if (!arg)
          return;
        const trimmed = val.trim();
        const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
        let initialRan = false;
        const updateFn = () => {
          let result;
          if (isObjectLiteral && (arg === "class" || arg === "style")) {
            result = resolveExpression(val, ctx, { contextName: `v-bind:${arg}`, forceExpression: true });
          } else if (isObjectLiteral) {
            result = resolveExpression(val, ctx, { contextName: "v-bind object" });
          } else {
            result = resolveExpression(val, ctx, { contextName: `v-bind:${arg}`, fallback: void 0 });
          }
          if (arg === "class") {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.CLASS;
            if (typeof result === "object" && result !== null) {
              Object.keys(result).forEach((k) => {
                k.split(/\s+/).filter(Boolean).forEach((cls) => {
                  el.classList.toggle(cls, !!result[k]);
                });
              });
            } else {
              const newClass = result || "";
              if (el.className !== newClass)
                el.className = newClass;
            }
          } else if (arg === "style") {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.STYLE;
            if (typeof result === "object" && result !== null)
              Object.assign(el.style, result);
            else {
              const newStyle = result || "";
              if (el.style.cssText !== newStyle)
                el.style.cssText = newStyle;
            }
          } else if (arg === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
            const newValue = result ?? "";
            if (el.value !== newValue)
              el.value = newValue;
          } else if (typeof result === "boolean") {
            if (result) {
              if (!el.hasAttribute(arg))
                el.setAttribute(arg, "");
            } else {
              if (el.hasAttribute(arg))
                el.removeAttribute(arg);
            }
          } else {
            const newValue = result ?? "";
            if (el.getAttribute(arg) !== newValue)
              el.setAttribute(arg, newValue);
          }
          if (initialRan && instance)
            queueComponentUpdated(instance);
        };
        const e = effect(updateFn, { name: `bind: ${arg}`, area: "directive" });
        initialRan = true;
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.on = {
      mounted(el, { value: val, arg, modifiers = [], ctx, trackCleanup }) {
        const evtType = arg || "click";
        const isWindow = modifiers.includes("window");
        const isDocument = modifiers.includes("document");
        const isOutside = modifiers.includes("outside");
        const isPrevent = modifiers.includes("prevent");
        const isStop = modifiers.includes("stop");
        const isSelf = modifiers.includes("self");
        const isOnce = modifiers.includes("once");
        const isPassive = modifiers.includes("passive");
        const isCapture = modifiers.includes("capture");
        const keyModifiers = {
          enter: ["Enter"],
          escape: ["Escape", "Esc"],
          esc: ["Escape", "Esc"],
          tab: ["Tab"],
          space: [" ", "Spacebar"],
          up: ["ArrowUp", "Up"],
          down: ["ArrowDown", "Down"],
          left: ["ArrowLeft", "Left"],
          right: ["ArrowRight", "Right"],
          delete: ["Delete", "Backspace"]
        };
        const parseArgs = (str) => {
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
        };
        const executeHandler = (e) => {
          if (isPrevent)
            e.preventDefault();
          if (isStop)
            e.stopPropagation();
          if (isSelf && e.target !== el)
            return;
          if (modifiers.includes("ctrl") && !e.ctrlKey)
            return;
          if (modifiers.includes("alt") && !e.altKey)
            return;
          if (modifiers.includes("shift") && !e.shiftKey)
            return;
          if (modifiers.includes("meta") && !e.metaKey)
            return;
          for (const keyMod in keyModifiers) {
            if (modifiers.includes(keyMod)) {
              if (!e.key || !keyModifiers[keyMod].includes(e.key)) {
                return;
              }
            }
          }
          let targetFn;
          let args = [e];
          const trimmed = val.trim();
          const parenIdx = trimmed.indexOf("(");
          if (parenIdx > -1 && trimmed.endsWith(")")) {
            const fnPath = trimmed.slice(0, parenIdx).trim();
            const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();
            targetFn = resolveRaw(fnPath, ctx);
            if (argsStr) {
              const rawArgs = parseArgs(argsStr);
              args = rawArgs.map((a) => {
                if (a === "$event")
                  return e;
                const resolved = resolvePath(a, ctx);
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
            } else {
              args = [];
            }
          } else {
            targetFn = resolveRaw(val, ctx);
          }
          if (typeof targetFn === "function") {
            try {
              targetFn.call(ctx, ...args);
            } catch (err) {
              handleError(err, `Event @${evtType}`);
            }
          } else if (appConfig.allowInlineExpressions) {
            try {
              new Function("$ctx", "$event", `with($ctx) { ${val} }`)(ctx, e);
            } catch (err) {
              handleError(err, `Event @${evtType}`);
            }
          } else {
            warn(`Handler not found: ${val}`, "event");
          }
        };
        if (isOutside) {
          const outsideHandler = (e) => {
            if (!el.contains(e.target) && el !== e.target) {
              executeHandler(e);
            }
          };
          if (typeof document !== "undefined") {
            document.addEventListener("click", outsideHandler);
            trackCleanup(() => document.removeEventListener("click", outsideHandler));
          }
          return;
        }
        const listenerTarget = isWindow && typeof window !== "undefined" ? window : isDocument && typeof document !== "undefined" ? document : el;
        const listenerOpts = {
          once: isOnce,
          passive: isPassive,
          capture: isCapture
        };
        listenerTarget.addEventListener(evtType, executeHandler, listenerOpts);
        trackCleanup(() => listenerTarget.removeEventListener(evtType, executeHandler, listenerOpts));
      }
    };
    dirs.show = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, instance, trackCleanup }) {
        let initialRan = false;
        const updateFn = () => {
          const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-show" });
          const newDisplay = shouldShow ? "" : "none";
          if (el.style.display !== newDisplay) {
            el.style.display = newDisplay;
            if (initialRan && instance)
              queueComponentUpdated(instance);
          }
        };
        const e = effect(updateFn, { name: `show: ${val}`, area: "directive" });
        initialRan = true;
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.if = {
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
            if (activeNodes.length > 0) {
              activeNodes.forEach((n) => destroyNode(n));
              activeNodes = [];
            }
            currentBranchIndex = matchedIndex;
            if (matchedIndex >= 0) {
              const template = branchList[matchedIndex].el;
              if (template.tagName === "TEMPLATE" && template.content) {
                const clone = template.content.cloneNode(true);
                activeNodes = Array.from(clone.childNodes);
                activeNodes.forEach((n) => bindNode2(n, ctx, instance, []));
                if (placeholder.parentNode)
                  placeholder.parentNode.insertBefore(clone, placeholder);
              } else {
                const node = template.cloneNode(true);
                bindNode2(node, ctx, instance, []);
                if (placeholder.parentNode)
                  placeholder.parentNode.insertBefore(node, placeholder);
                activeNodes = [node];
              }
            }
            if (initialRan && instance)
              queueComponentUpdated(instance);
          }
        }, { name: `if: ${val}`, area: "directive" });
        initialRan = true;
        trackCleanup(() => {
          cleanup(e);
          activeNodes.forEach((n) => destroyNode(n));
          activeNodes = [];
          if (placeholder.parentNode)
            placeholder.parentNode.removeChild(placeholder);
        });
      }
    };
    dirs.for = {
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
              key = getPathParts(keyPath).reduce((acc, part) => acc == null ? void 0 : acc[part], item);
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
          if (oldStart > oldEnd) {
            const anchor = getAnchor(newItems, newEnd + 1);
            const parentNode = placeholder.parentNode;
            for (let i = newStart; i <= newEnd; i++) {
              const itemRecord = createItemRecord(list[i], i, newKeys[i]);
              newItems[i] = itemRecord;
              if (parentNode) {
                for (let k = 0; k < itemRecord.nodes.length; k++) {
                  parentNode.insertBefore(itemRecord.nodes[k], anchor);
                }
              }
            }
          } else if (newStart > newEnd) {
            for (let i = oldStart; i <= oldEnd; i++) {
              renderedItems[i].nodes.forEach((n) => destroyNode(n));
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
                prevItem.nodes.forEach((n) => destroyNode(n));
                continue;
              }
              const newIndex = keyToNewIndexMap.get(prevItem.key);
              if (newIndex === void 0) {
                prevItem.nodes.forEach((n) => destroyNode(n));
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
    dirs.ref.priority = 100;
    dirs.if.priority = 100;
    dirs.for.priority = 90;
    dirs.model.priority = 50;
    dirs.bind.priority = 10;
    dirs.on.priority = 10;
    dirs.text.priority = 5;
    dirs.html.priority = 5;
    dirs.show.priority = 5;
    return dirs;
  }
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
  const scheduleRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
  function ensureCloakStyles(appConfig) {
    if (typeof document === "undefined" || appConfig.autoInjectCloak === false)
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
      const compDef = resolveComponent(tagName);
      if (compDef) {
        bindComponentNode(node, compDef, tagName, ctx, instance, cleanupTarget, force);
        return;
      }
      bindElementNode(node, ctx, instance, cleanupTarget, force);
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
        name: compDefNormalized.name || tagName,
        root: node,
        scope,
        hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
        cleanups: [],
        parent: instance,
        provides: instance ? Object.create(instance.provides || null) : /* @__PURE__ */ Object.create(null)
      };
      const childNodes = Array.from(node.childNodes);
      const slotTemplates = [];
      childNodes.forEach((child) => {
        if (child.nodeType === 1) {
          const hasSlotDirective = Array.from(child.attributes || []).some(
            (attr) => attr.name.startsWith("v-slot:") || attr.name.startsWith("#")
          );
          if (hasSlotDirective || child.tagName.toLowerCase() === "template") {
            slotTemplates.push(child);
          }
        }
      });
      const slots = createSlots(slotTemplates, ctx, childInst, bindNode);
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
          if (!listeners[evtName])
            listeners[evtName] = [];
          listeners[evtName].push((...args) => {
            const targetFn = resolveRaw(attr.value, ctx);
            if (typeof targetFn === "function")
              targetFn.call(ctx, ...args);
            else if (appConfig.allowInlineExpressions) {
              try {
                new Function("$ctx", "$event", `with($ctx) { ${attr.value} }`)(ctx, args[0]);
              } catch (err) {
                handleError(err, `emit handler: ${evtName}`);
              }
            } else
              warn(`Inline expressions disabled. Cannot execute handler: ${attr.value}`, "compiler");
          });
        } else {
          const isBind = attr.name.startsWith(appConfig.prefix + "bind:") || attr.name.startsWith(":");
          let rawPropName = isBind ? attr.name.split(":")[1] || attr.name.slice(1) : attr.name;
          const propName = rawPropName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
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
        childInst.hooks.unmounted.forEach((fn) => fn());
      });
      const prevInstance = currentInstance;
      setCurrentInstance(childInst);
      let childCtx;
      try {
        const baseSetupCtx = {
          ...globalAPI2,
          props,
          emit,
          slots
        };
        const setupCtx = getOrCreateAppCtxProxy(baseSetupCtx, appContext.app);
        childCtx = scope.run(() => compDefNormalized.setup(setupCtx));
      } catch (err) {
        handleError(err, `<${tagName}> setup`, childInst);
        setCurrentInstance(prevInstance);
        scope.stop();
        return;
      }
      const finishMount = (resolvedCtx) => {
        if (!isComponentActive || hasMounted)
          return;
        setCurrentInstance(prevInstance);
        if (resolvedCtx && resolvedCtx.template) {
          node.innerHTML = resolvedCtx.template;
          renderSlots(slots, node, resolvedCtx, childInst, bindNode);
          node.childNodes.forEach((child) => {
            if (child.nodeType === 1 && child.tagName.toLowerCase() !== "slot") {
              bindNode(child, resolvedCtx, childInst, void 0, force);
            }
          });
        } else {
          if (slots.default) {
            const defaultContent = slots.default();
            node.appendChild(defaultContent);
          }
        }
        childInst.hooks.beforeMount.forEach((fn) => fn());
        childInst.hooks.mount.forEach((fn) => fn());
        hasMounted = true;
      };
      if (childCtx instanceof Promise) {
        childCtx.then((resolvedCtx) => {
          if (isComponentActive)
            finishMount(resolvedCtx);
        }).catch((err) => {
          handleError(err, `<${tagName}> async setup`, childInst);
          setCurrentInstance(prevInstance);
        });
      } else
        finishMount(childCtx);
    }
    function bindElementNode(node, ctx, instance, cleanupTarget, force) {
      const binding = node.__hx_binding ?? (node.__hx_binding = {
        cleanups: []
      });
      binding.ctx = ctx;
      binding.instance = instance;
      binding.bindNode = bindNode;
      binding.cleanups.length = 0;
      const trackCleanup = (fn) => {
        if (node.__hx_binding) {
          node.__hx_binding.cleanups.push(fn);
        }
      };
      if (node.hasAttribute(`${appConfig.prefix}ignore`) || node.hasAttribute(`${appConfig.prefix}static`)) {
        node.removeAttribute(`${appConfig.prefix}ignore`);
        node.removeAttribute(`${appConfig.prefix}static`);
        node[BOUND] = true;
        node.__hx_static = true;
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
      if (node.hasAttribute(`${appConfig.prefix}if`)) {
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
        warn(`[Helix 🛠️] ${appConfig.prefix}else / ${appConfig.prefix}else-if used without preceding ${appConfig.prefix}if.`, "directive");
        node.removeAttribute(`${appConfig.prefix}else-if`);
        node.removeAttribute(`${appConfig.prefix}else`);
      }
      let hasDynamicAttr = false;
      const attrs = node.attributes;
      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          const name = attrs[i].name;
          if (name.startsWith(appConfig.prefix) || name.startsWith(":") || name.startsWith("@")) {
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
        if (attr.name.startsWith(appConfig.prefix)) {
          isDir = true;
          const [base, ...mods] = attr.name.slice(appConfig.prefix.length).toLowerCase().split(".");
          [dirName, arg] = base.split(":");
          modifiers = mods;
        } else if (attr.name.startsWith(":")) {
          isDir = true;
          dirName = "bind";
          arg = attr.name.slice(1);
        } else if (attr.name.startsWith("@")) {
          isDir = true;
          dirName = "on";
          const [evt, ...mods] = attr.name.slice(1).split(".");
          arg = evt;
          modifiers = mods;
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
        if (normalized.beforeUpdate || normalized.updated) {
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
    const appConfig = Object.create(globalConfig);
    Object.freeze(appConfig);
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
        if (typeof node === "string") {
          node = document.querySelector(node);
        }
        if (node && !node.nodeType && (typeof node.length === "number" || typeof node[Symbol.iterator] === "function")) {
          Array.from(node).forEach((n) => this.rebind(n, options));
          return;
        }
        if (!node || node.nodeType !== 1)
          return;
        const binding = node.__hx_binding;
        const instance = options && typeof options === "object" && options.instance || binding && binding.instance || rootInstance;
        let ctx = options && typeof options === "object" && ("ctx" in options || "context" in options) ? options.ctx || options.context : options || binding && binding.ctx || rootCtx;
        if (!ctx)
          ctx = rootCtx;
        if (!instance || !ctx) {
          logger.warn("Cannot rebind node without binding metadata or explicit instance.", "binding");
          return;
        }
        const activeBindNode = binding && binding.bindNode || bindNode;
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
          el[BOUND] = false;
          el.__hx_static = false;
          activeBindNode(el, ctx, instance, [], true);
        });
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
        var _a, _b;
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
            return res;
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
        (_b = (_a = rootElement.querySelectorAll) == null ? void 0 : _a.call(rootElement, `[${appConfig.prefix}cloak]`)) == null ? void 0 : _b.forEach((el) => {
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
      rebind(targetNode) {
        if (!isMounted || !rootElement) {
          warn("Cannot rebind: app is not mounted.", "core");
          return app;
        }
        let target = targetNode;
        if (typeof target === "string") {
          target = rootElement.querySelector(target);
        }
        if (target && !target.nodeType && (typeof target.length === "number" || typeof target[Symbol.iterator] === "function")) {
          Array.from(target).forEach((n) => app.rebind(n));
          return app;
        }
        if (!target || target.nodeType !== 1)
          return app;
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
          bindNode(el, rootCtx, rootInstance, [], true);
        });
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
  function findNode(selector, root = document) {
    if (typeof selector !== "string")
      return null;
    return root.querySelector(selector);
  }
  const domAPI = {
    bind,
    cleanup: cleanupNode,
    destroy,
    inspect,
    findNode,
    parseAttribute,
    cleanAttributes
  };
  class EffectGroup {
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
  }
  function createEffectGroup(name) {
    return new EffectGroup(name);
  }
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
  class ScopeScheduler {
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
  }
  const globalScopeScheduler = new ScopeScheduler();
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
        const installed = globalPlugins.find((p) => p.name === depName || p.plugin && p.plugin.name === depName);
        if (!installed) {
          warn(`Plugin "${plugin.name}" requires missing dependency "${depName}" (${expectedRange}).`, "plugin");
          valid = false;
        } else if (expectedRange && !satisfiesVersion(installed.version || "0.0.0", expectedRange)) {
          warn(`Plugin "${plugin.name}" requires ${depName} ${expectedRange}, but found ${installed.version}.`, "plugin");
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
  const registeredAsyncComponents = /* @__PURE__ */ new Set();
  const memoryCache = /* @__PURE__ */ new Map();
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
                        <template hx-if="hasError">
                            <div hx-html="fallbackHtml"></div>
                        </template>
                        <template hx-if="!hasError">
                            <slot></slot>
                        </template>
                    </div>
                `,
          renderFallback
        };
      }
    };
  }
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
  const Suspense = {
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
      return {
        state,
        template: `
                <div class="helix-suspense">
                    <template hx-if="state.pending">
                        <slot name="fallback"><div class="suspense-loading">Loading...</div></slot>
                    </template>
                    <template hx-else-if="state.error">
                        <slot name="error"><div class="suspense-error">{{ state.error.message || state.error }}</div></slot>
                    </template>
                    <template hx-else>
                        <slot></slot>
                    </template>
                </div>
            `
      };
    }
  };
  let profileStartTime = 0;
  const profileData = {
    duration: 0,
    effectRuns: 0,
    mountCount: 0,
    updateCount: 0,
    customMetrics: {}
  };
  function profile(fn) {
    if (typeof fn !== "function")
      return null;
    profileStartTime = performance.now();
    profileData.effectRuns = 0;
    profileData.mountCount = 0;
    profileData.updateCount = 0;
    profileData.customMetrics = {};
    try {
      return fn();
    } finally {
      profileData.duration = performance.now() - profileStartTime;
    }
  }
  function getProfileData() {
    return { ...profileData, customMetrics: { ...profileData.customMetrics } };
  }
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
  const devtoolsAPI = {
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
  let htmxListenerAttached = false;
  function initHtmxIntegration(Helix) {
    if (typeof document === "undefined" || typeof window === "undefined")
      return;
    if (htmxListenerAttached)
      return;
    const handleHtmxEvent = (e) => {
      var _a, _b, _c, _d, _e;
      if (!globalConfig.htmxIntegration)
        return;
      const target = ((_a = e.detail) == null ? void 0 : _a.target) || ((_b = e.detail) == null ? void 0 : _b.elt) || e.target;
      if (!target || target.nodeType !== 1)
        return;
      if (target.hasAttribute(`${globalConfig.prefix}cloak`))
        target.removeAttribute(`${globalConfig.prefix}cloak`);
      (_d = (_c = target.querySelectorAll) == null ? void 0 : _c.call(target, `[${globalConfig.prefix}cloak]`)) == null ? void 0 : _d.forEach((el) => {
        el.removeAttribute(`${globalConfig.prefix}cloak`);
      });
      if (Helix && Helix.$apps) {
        for (const appEntry of Helix.$apps.values()) {
          const rootEl = appEntry.rootElement || appEntry.instance && appEntry.instance.root;
          if (rootEl && (rootEl === target || rootEl.contains(target))) {
            try {
              if (typeof ((_e = appEntry.app) == null ? void 0 : _e.rebind) === "function") {
                appEntry.app.rebind(target);
                return;
              }
            } catch (err) {
              logger.error("Error auto-rebinding HTMX swapped fragment in app:", err);
            }
          }
        }
      }
      if (Helix && typeof Helix.rebind === "function") {
        try {
          Helix.rebind(target);
        } catch (err) {
        }
      }
    };
    document.addEventListener("htmx:afterSwap", handleHtmxEvent);
    document.addEventListener("htmx:load", handleHtmxEvent);
    document.addEventListener("htmx:afterProcessNode", handleHtmxEvent);
    htmxListenerAttached = true;
  }
  function enableHtmxIntegration(Helix) {
    globalConfig.htmxIntegration = true;
    initHtmxIntegration(Helix);
  }
  const globalNamespaces = /* @__PURE__ */ Object.create(null);
  const globalProvides = /* @__PURE__ */ Object.create(null);
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
  const globalBus = createBus();
  const globalRegistry = {
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
  const globalInternal = {
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
  const globalAPI = {
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
    inspectComponent,
    onError: onErrorGlobal,
    ScopeScheduler,
    scopeScheduler: globalScopeScheduler,
    triggerPluginLifecycle,
    effectScope,
    getCurrentScope,
    onScopeDispose,
    Suspense,
    inspectTree,
    validatePluginDependencies,
    profile,
    getProfileData,
    memo,
    pauseTracking,
    resumeTracking,
    enableTracking,
    resetTracking,
    untrack,
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
  exports.$apps = globalApps;
  exports.$bus = globalBus;
  exports.EffectScope = EffectScope;
  exports.PatchFlags = PatchFlags;
  exports.ScopeScheduler = ScopeScheduler;
  exports.Suspense = Suspense;
  exports._internal = globalInternal;
  exports.app = createApp;
  exports.batch = batch;
  exports.checkMemoryLeaks = checkMemoryLeaks;
  exports.closeBlock = closeBlock;
  exports.component = componentGlobal;
  exports.computed = computed;
  exports.config = globalConfig;
  exports.create = createApp;
  exports.createApp = createApp;
  exports.createEffectGroup = createEffectGroup;
  exports.createErrorBoundary = createErrorBoundary;
  exports.customRef = customRef;
  exports.default = globalAPI;
  exports.defineAsyncComponent = defineAsyncComponent;
  exports.definePlugin = definePlugin;
  exports.devtools = devtoolsAPI;
  exports.directive = directiveGlobal;
  exports.directives = directivesGlobal;
  exports.dom = domAPI;
  exports.effect = effect;
  exports.effectGroup = createEffectGroup;
  exports.effectScope = effectScope;
  exports.enableHtmx = enableHtmxIntegration;
  exports.enableTracking = enableTracking;
  exports.getCurrentInstance = getCurrentInstance;
  exports.getCurrentScope = getCurrentScope;
  exports.getProfileData = getProfileData;
  exports.initHtmx = initHtmxIntegration;
  exports.inject = inject;
  exports.inspectComponent = inspectComponent;
  exports.inspectDeps = inspectDeps;
  exports.inspectTree = inspectTree;
  exports.isProxy = isProxy;
  exports.isRaw = isRaw;
  exports.isReactive = isReactive;
  exports.isReadonly = isReadonly;
  exports.isRef = isRef;
  exports.isShallow = isShallow;
  exports.lazyBind = lazyBind;
  exports.logger = logger;
  exports.markRaw = markRaw;
  exports.markTrace = markTrace;
  exports.measureTrace = measureTrace;
  exports.memo = memo;
  exports.mount = createAndMount;
  exports.namespace = namespaceGlobal;
  exports.nextTick = nextTick;
  exports.onBeforeMount = onBeforeMount;
  exports.onBeforeUnmount = onBeforeUnmount;
  exports.onDestroy = onDestroy;
  exports.onError = onErrorGlobal;
  exports.onErrorCaptured = onErrorCaptured;
  exports.onMount = onMount;
  exports.onMounted = onMounted;
  exports.onScopeDispose = onScopeDispose;
  exports.onUnmounted = onUnmounted;
  exports.onUpdated = onUpdated;
  exports.openBlock = openBlock;
  exports.pauseTracking = pauseTracking;
  exports.preload = preload;
  exports.preloadAll = preloadAll;
  exports.profile = profile;
  exports.provide = provide;
  exports.queueIdleJob = queueIdleJob;
  exports.queueJob = queueJob;
  exports.queuePostFlushCb = queuePostFlushCb;
  exports.queuePreFlushCb = queuePreFlushCb;
  exports.reactive = reactive;
  exports.readonly = readonly;
  exports.rebind = rebindGlobal;
  exports.ref = ref;
  exports.registry = globalRegistry;
  exports.removeDirective = removeDirectiveGlobal;
  exports.removeNamespace = removeNamespaceGlobal;
  exports.resetTracking = resetTracking;
  exports.resolvePath = resolvePath;
  exports.resumeTracking = resumeTracking;
  exports.runWithContext = runWithContextGlobal;
  exports.scopeScheduler = globalScopeScheduler;
  exports.shallowReactive = shallowReactive;
  exports.shallowReadonly = shallowReadonly;
  exports.shallowRef = shallowRef;
  exports.simpleEffect = simpleEffect;
  exports.toRaw = toRaw;
  exports.toRef = toRef;
  exports.toRefs = toRefs;
  exports.toValue = toValue;
  exports.triggerPluginLifecycle = triggerPluginLifecycle;
  exports.triggerRef = triggerRef;
  exports.unref = unref;
  exports.untrack = untrack;
  exports.unuse = unuseGlobal;
  exports.use = useGlobal;
  exports.validatePluginDependencies = validatePluginDependencies;
  exports.version = VERSION;
  exports.watch = watch;
  exports.watchEffect = watchEffect;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.Helix = this.Helix || {});
