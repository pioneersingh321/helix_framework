/**
    * Helix.js v11.1.4 - Grandmaster Release (Zenith Edition)
    * (c) 2026
    * Released under the MIT License.
    */
window.Helix = (function() {
  /* Helix.js Reactive Framework */
  const RAW = /* @__PURE__ */ Symbol("__hx_raw");
  const IS_REF = /* @__PURE__ */ Symbol("__hx_is_ref");
  const IS_REACTIVE = /* @__PURE__ */ Symbol("__hx_is_reactive");
  const IS_READONLY = /* @__PURE__ */ Symbol("__hx_is_readonly");
  const IS_SHALLOW = /* @__PURE__ */ Symbol("__hx_is_shallow");
  const SKIP = /* @__PURE__ */ Symbol("__hx_skip");
  // Patch flags for targeted updates (Vue 3 inspired)
  const PatchFlags = {
    TEXT: 1,           // Dynamic text content
    CLASS: 2,          // Dynamic class
    STYLE: 4,          // Dynamic style
    PROPS: 8,          // Dynamic props (other than class/style)
    FULL_PROPS: 16,    // Props with dynamic keys
    HYDRATE_EVENTS: 32,// Event listeners need hydration
    STABLE_FRAGMENT: 64,   // Fragment with stable children order
    KEYED_FRAGMENT: 128,    // Fragment with keyed children
    UNKEYED_FRAGMENT: 256,  // Fragment with unkeyed children
    NEED_PATCH: 512,        // Needs full diff
    DYNAMIC_SLOTS: 1024,    // Dynamic slot content
    DEV_ROOT_FRAGMENT: 2048 // Dev root fragment
  };
  const BOUND = /* @__PURE__ */ Symbol("bound");
  let activeEffect = null;
  let currentInstance = null;
  let shouldTrack = true;
  let effectUid = 0;
  let globalInstanceId = 0;
  let traceDepth = 0;
  let activeScope = null;
  let currentBlock = null;
  const targetMap = /* @__PURE__ */ new WeakMap();
  const reactiveMap = /* @__PURE__ */ new WeakMap();
  const readonlyMap = /* @__PURE__ */ new WeakMap();
  const staticNodeCache = /* @__PURE__ */ new WeakMap();
  const effectCache = /* @__PURE__ */ new WeakMap();
  const pathCache = /* @__PURE__ */ new Map();
  const MAX_PATH_CACHE_SIZE = 1e3;
  const vForKeyMap = /* @__PURE__ */ new WeakMap();
  const nodePool = /* @__PURE__ */ new Map(); // Tag name -> array of recycled nodes
  let globalEffectVersion = 0;
  const queue = [];
  const queueSet = /* @__PURE__ */ new Set();
  const preFlushQueue = [];
  const postFlushQueue = [];
  const idleQueue = [];
  let idleCallbackId = null;
  let isFlushing = false;
  let isFlushPending = false;
  const MAX_FLUSH = 1e3;
  // Batched trigger system: collect triggers in a microtask and deduplicate
  const triggerQueue = /* @__PURE__ */ new Map();
  let isTriggerPending = false;
  const resolvedPromise = Promise.resolve();
  // isSorted removed: queue maintains order via insertion sort
  const globalConfig = {
    debug: false,
    slowThreshold: 2,
    prefix: "v-",
    allowInlineExpressions: false,
    removeAttributeBindings: true,
    delimiters: ["{{", "}}"],
    rethrowErrors: true
  };
  Object.seal(globalConfig);
  const globalComponents = {};
  const globalDirectives = {};
  const globalPlugins = [];
  const __DEV__ = globalConfig.debug;
  const warn = (msg, ...args) => {
    if (__DEV__) console.warn(`[Helix]: ${msg}`, ...args);
  };
  const handleError = (err, context, instance = null) => {
    console.error(`[Helix Error] \u{1F4A5} Caught in ${context}:`, err);
    if (instance && instance.name) warn(`Crash in component <${instance.name}>:`, err);
    else if (instance && instance.root) warn(`Crash in component:`, instance.root);
    if (globalConfig.rethrowErrors !== false) throw err;
  };
  const callWithErrorHandling = (fn, instance, type, args) => {
    try {
      return args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, type, instance);
    }
  };
  const perfMarks = /* @__PURE__ */ new Map();
  // Block tree helpers for flattening dynamic children
  function openBlock() {
    currentBlock = [];
  }
  function closeBlock() {
    const block = currentBlock;
    currentBlock = null;
    return block;
  }
  function setBlockTracking(value) {
    // Enable/disable block tracking
  }
  const trace = (name, fn) => {
    if (!globalConfig.debug) return fn();
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
        console.log(`[Helix Perf] ${name} took ${time.toFixed(2)}ms`);
      }
    }
  };
  function markTrace(name) {
    if (!globalConfig.debug) return;
    perfMarks.set(name, performance.now());
  }
  function measureTrace(name, label) {
    if (!globalConfig.debug) return;
    const start = perfMarks.get(name);
    if (start) {
      const time = performance.now() - start;
      console.log(`[Helix Perf] ${label || name} took ${time.toFixed(2)}ms`);
      perfMarks.delete(name);
    }
  }
  function recycleNode(tagName) {
    const pool = nodePool.get(tagName);
    if (pool && pool.length > 0) {
      return pool.pop();
    }
    return null;
  }
  function reclaimNode(node) {
    const tagName = node.tagName;
    if (!tagName) return;
    if (!nodePool.has(tagName)) nodePool.set(tagName, []);
    const pool = nodePool.get(tagName);
    if (pool.length < 50) { // Max pool size per tag
      node.innerHTML = "";
      pool.push(node);
    }
  }
  function getLIS(arr) {
    const result = [];
    const prev = new Array(arr.length).fill(-1);
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === -1) continue;
      if (result.length === 0 || arr[result[result.length - 1]] < arr[i]) {
        prev[i] = result.length > 0 ? result[result.length - 1] : -1;
        result.push(i);
      } else {
        let left = 0, right = result.length - 1;
        while (left < right) {
          const mid = left + right >> 1;
          if (arr[result[mid]] < arr[i]) left = mid + 1;
          else right = mid;
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
  // Lazy hydration: defer binding until element is visible
  function lazyBind(node, ctx, instance, bindNode, options = {}) {
    const { rootMargin = "100px", threshold = 0 } = options;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: bind immediately
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
    // Store observer for cleanup
    if (!node.__hx_cleanup) node.__hx_cleanup = [];
    node.__hx_cleanup.push(() => observer.disconnect());
  }
  class EffectScope {
    constructor() {
      this.effects = [];
      this.active = true;
    }
    run(fn) {
      if (this.active) {
        const prev = activeScope;
        activeScope = this;
        try {
          return fn();
        } finally {
          activeScope = prev;
        }
      }
    }
    stop() {
      if (this.active) {
        for (let i = 0; i < this.effects.length; i++) {
          stopEffect(this.effects[i]);
        }
        this.effects.length = 0;
        this.active = false;
      }
    }
  }
  function queueJob(job, priority = 0) {
    if (!queueSet.has(job)) {
      queueSet.add(job);
      job.priority = priority;
      // Insertion sort: maintain queue order at insertion time
      const id = job.id || 0;
      let inserted = false;
      for (let i = 0; i < queue.length; i++) {
        const existing = queue[i];
        const existingP = existing.priority || 0;
        const existingId = existing.id || 0;
        if (priority > existingP || (priority === existingP && id < existingId)) {
          queue.splice(i, 0, job);
          inserted = true;
          break;
        }
      }
      if (!inserted) queue.push(job);
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
    if (idleCallbackId === null && typeof requestIdleCallback !== "undefined") {
      idleCallbackId = requestIdleCallback(() => {
        idleCallbackId = null;
        while (idleQueue.length) {
          const job = idleQueue.shift();
          try { job(); } catch (e) { handleError(e, "idle job"); }
        }
      }, { timeout: 2000 });
    }
  }
  function queueFlush() {
    if (!isFlushPending) {
      isFlushPending = true;
      resolvedPromise.then(flushJobs);
    }
  }
  function flushJobs() {
    if (isFlushing) {
      isFlushPending = true;
      return;
    }
    isFlushPending = false;
    isFlushing = true;
    let flushCount = 0;
    let recursionDepth = 0;
    const MAX_RECURSION = 10;
    try {
      do {
        if (++flushCount > MAX_FLUSH) {
          console.error("\u26A0\uFE0F Helix: Infinite update loop detected (exceeded MAX_FLUSH)");
          break;
        }
        if (++recursionDepth > MAX_RECURSION) {
          console.error("\u26A0\uFE0F Helix: Scheduler recursion depth exceeded");
          break;
        }
        trace("Batch Flush", () => {
          for (let i = 0; i < preFlushQueue.length; i++) preFlushQueue[i]();
          preFlushQueue.length = 0;
          // Queue is already sorted by insertion sort in queueJob()
          for (let i = 0; i < queue.length; i++) {
            const job = queue[i];
            if (job) job();
          }
          queue.length = 0;
          queueSet.clear();
          for (let i = 0; i < postFlushQueue.length; i++) postFlushQueue[i]();
          postFlushQueue.length = 0;
        });
      } while (queue.length || preFlushQueue.length || postFlushQueue.length);
    } finally {
      isFlushing = false;
      if (isFlushPending) {
        isFlushPending = false;
        flushJobs();
      }
    }
  }
  function pauseTracking() {
    shouldTrack = false;
  }
  function resumeTracking() {
    shouldTrack = true;
  }
  function track(target, key) {
    if (!activeEffect || !shouldTrack) return;
    let depsMap = targetMap.get(target);
    if (!depsMap) targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    let dep = depsMap.get(key);
    if (!dep) depsMap.set(key, dep = /* @__PURE__ */ new Set());
    if (dep.has(activeEffect)) return;
    dep.add(activeEffect);
    activeEffect.deps.add(dep);
  }
  function trigger(target, key) {
    globalEffectVersion++;
    // Batch triggers: collect in queue, flush in next microtask
    const targetTriggers = triggerQueue.get(target);
    if (targetTriggers) {
      targetTriggers.add(key);
    } else {
      triggerQueue.set(target, new Set([key]));
    }
    if (!isTriggerPending) {
      isTriggerPending = true;
      resolvedPromise.then(flushTriggers);
    }
  }
  function flushTriggers() {
    isTriggerPending = false;
    triggerQueue.forEach((keys, target) => {
      const depsMap = targetMap.get(target);
      if (!depsMap) return;
      const effectsToRun = /* @__PURE__ */ new Set();
      keys.forEach((key) => {
        const dep = depsMap.get(key);
        if (dep) {
          dep.forEach((effectFn) => effectsToRun.add(effectFn));
        }
        const wildcardDep = depsMap.get("*");
        if (wildcardDep && key !== "*") {
          wildcardDep.forEach((effectFn) => effectsToRun.add(effectFn));
        }
      });
      effectsToRun.forEach((effectFn) => {
        if (effectFn.scheduler) effectFn.scheduler();
        else queueJob(effectFn, effectFn.priority || 0);
      });
    });
    triggerQueue.clear();
  }
  function cleanupDeps(effectFn) {
    if (effectFn.deps) {
      effectFn.deps.forEach((depSet) => depSet.delete(effectFn));
      effectFn.deps.clear();
    }
  }
  const MAX_DEPS_SIZE = 100;
  function trimDeps(effectFn) {
    if (effectFn.deps && effectFn.deps.size > MAX_DEPS_SIZE) {
      // Keep only most recently used deps (first 50) + last 50
      const depsArray = Array.from(effectFn.deps);
      effectFn.deps.clear();
      depsArray.slice(0, MAX_DEPS_SIZE / 2).concat(depsArray.slice(-MAX_DEPS_SIZE / 2))
        .forEach((dep) => effectFn.deps.add(dep));
    }
  }
  function cleanup(effectFn) {
    if (effectFn.onCleanupFn) {
      effectFn.onCleanupFn();
      effectFn.onCleanupFn = null;
    }
    cleanupDeps(effectFn);
  }
  /**
   * Lightweight effect for simple primitive reads.
   * Skips full cleanup/tracking overhead. Use only for effects that read refs/primitives.
   */
  function simpleEffect(fn, options = {}) {
    if (typeof options === "string") options = { name: options };
    const name = options.name || "Simple Effect";
    let active = true;
    let value;
    const run = () => {
      if (!active) return;
      const prev = activeEffect;
      activeEffect = null; // Don't track - just read
      try {
        value = trace(name, () => fn());
      } catch (err) {
        handleError(err, `simpleEffect: ${name}`);
      } finally {
        activeEffect = prev;
      }
    };
    run();
    return {
      stop: () => { active = false; },
      run,
      get value() { return value; }
    };
  }
  function effect(fn, options = {}) {
    if (typeof options === "string") options = { name: options };
    const name = options.name || "Anonymous Effect";
    // Note: Global effectCache removed to prevent cross-instance effect sharing.
    // Each effect is now independent. If you need effect sharing, use a custom
    // cache scoped to your component instance.
    const effectFunc = () => {
      if (!effectFunc.active) return;
      cleanup(effectFunc);
      trimDeps(effectFunc); // Prevent unbounded deps growth
      const prevBlock = currentBlock;
      if (currentBlock) currentBlock.push(effectFunc);
      const prev = activeEffect;
      activeEffect = effectFunc;
      const onCleanup = (cb) => {
        effectFunc.onCleanupFn = cb;
      };
      try {
        return trace(name, () => fn(onCleanup));
      } catch (err) {
        handleError(err, `effect: ${name}`);
      } finally {
        activeEffect = prev;
      }
    };
    effectFunc.id = effectUid++;
    effectFunc.scheduler = options.scheduler;
    effectFunc.priority = options.priority || 0;
    effectFunc.deps = /* @__PURE__ */ new Set();
    effectFunc.active = true;
    effectFunc.stop = () => {
      if (effectFunc.active) {
        effectFunc.active = false;
        cleanup(effectFunc);
      }
    };
    if (activeScope && !activeScope.effects.includes(effectFunc)) {
      activeScope.effects.push(effectFunc);
    }
    if (!options.lazy) effectFunc();
    if (currentInstance) {
      if (!effectFunc._registeredInstances) effectFunc._registeredInstances = /* @__PURE__ */ new Set();
      if (!effectFunc._registeredInstances.has(currentInstance.id)) {
        effectFunc._registeredInstances.add(currentInstance.id);
        currentInstance.cleanups.push(() => stopEffect(effectFunc));
      }
    }
    return effectFunc;
  }
  function stopEffect(effectFn) {
    cleanup(effectFn);
  }
  const arrayInstrumentations = {};
  ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].forEach((method) => {
    arrayInstrumentations[method] = function(...args) {
      pauseTracking();
      const res = Array.prototype[method].apply(this[RAW], args);
      resumeTracking();
      // Only trigger "length" if there are explicit length subscribers
      // "*" subscribers already get notified by the wildcard trigger below
      const depsMap = targetMap.get(this[RAW]);
      if (depsMap && depsMap.has("length")) {
        trigger(this[RAW], "length");
      }
      trigger(this[RAW], "*");
      return res;
    };
  });
  function reactive(target) {
    if (typeof target !== "object" || target === null) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) return target;
    if (target[SKIP]) return target;
    if (reactiveMap.has(target)) return reactiveMap.get(target);
    const proxy = new Proxy(target, {
      get(obj, key, receiver) {
        if (key === RAW) return obj;
        if (key === IS_REACTIVE) return true;
        if (key === IS_READONLY) return false;
        if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(arrayInstrumentations, key, receiver);
        }
        const res = Reflect.get(obj, key, receiver);
        if (typeof res === "function") return res.bind(receiver);
        track(obj, key);
        if (Array.isArray(obj)) track(obj, "*");
        // Note: Array index tracking removed - was never triggered by array mutations.
        // Array changes are tracked via "length" and "*" keys instead.
        return typeof res === "object" && res !== null ? reactive(res) : res;
      },
      set(obj, key, value, receiver) {
        const oldValue = obj[key];
        const res = Reflect.set(obj, key, value, receiver);
        if (oldValue !== value || Array.isArray(obj) && key === "length") {
          trigger(obj, key);
          if (Array.isArray(obj)) trigger(obj, "*");
        }
        return res;
      }
    });
    reactiveMap.set(target, proxy);
    return proxy;
  }
  function shallowReactive(target) {
    if (typeof target !== "object" || target === null) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) return target;
    if (target[SKIP]) return target;
    return new Proxy(target, {
      get(obj, key, receiver) {
        if (key === RAW) return obj;
        if (key === IS_REACTIVE) return true;
        if (key === IS_READONLY) return false;
        if (Array.isArray(obj) && arrayInstrumentations.hasOwnProperty(key)) {
          return Reflect.get(arrayInstrumentations, key, receiver);
        }
        track(obj, key);
        if (Array.isArray(obj)) track(obj, "*");
        return Reflect.get(obj, key, receiver);
      },
      set(obj, key, value, receiver) {
        const oldValue = obj[key];
        const res = Reflect.set(obj, key, value, receiver);
        if (oldValue !== value || Array.isArray(obj) && key === "length") {
          trigger(obj, key);
          if (Array.isArray(obj)) trigger(obj, "*");
        }
        return res;
      }
    });
  }
  function readonly(target) {
    if (typeof target !== "object" || target === null) return target;
    if (target[IS_READONLY]) return target;
    if (target[IS_REACTIVE]) target = target[RAW];
    if (readonlyMap.has(target)) return readonlyMap.get(target);
    const proxy = new Proxy(target, {
      get(obj, key, receiver) {
        if (key === RAW) return obj;
        if (key === IS_REACTIVE) return false;
        if (key === IS_READONLY) return true;
        const res = Reflect.get(obj, key, receiver);
        if (typeof res === "function") return res.bind(receiver);
        return typeof res === "object" && res !== null ? readonly(res) : res;
      },
      set() {
        warn(`[Helix] Set operation on readonly target failed.`);
        return true;
      },
      deleteProperty() {
        warn(`[Helix] Delete operation on readonly target failed.`);
        return true;
      }
    });
    readonlyMap.set(target, proxy);
    return proxy;
  }
  function shallowReadonly(target) {
    if (typeof target !== "object" || target === null) return target;
    if (target[IS_READONLY]) return target;
    return new Proxy(target, {
      get(obj, key, receiver) {
        if (key === RAW) return obj;
        if (key === IS_REACTIVE) return false;
        if (key === IS_READONLY) return true;
        const res = Reflect.get(obj, key, receiver);
        if (typeof res === "function") return res.bind(receiver);
        return res;
      },
      set() {
        warn(`[Helix] Set operation on shallowReadonly target failed.`);
        return true;
      },
      deleteProperty() {
        warn(`[Helix] Delete operation on shallowReadonly target failed.`);
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
  function isShallow(value) {
    return !!(value && value[IS_SHALLOW] === true);
  }
  
  function ref(value) {
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
    refObj[RAW] = refObj;
    return refObj;
  }
  function customRef(factory) {
    let value;
    let _track;
    let _trigger;
    const refObj = {};
    Object.defineProperty(refObj, "value", {
      get() {
        _track();
        return value;
      },
      set(newVal) {
        if (value !== newVal) {
          value = newVal;
          _trigger();
        }
      }
    });
    refObj[IS_REF] = true;
    refObj[RAW] = refObj;
    const { track: trackFn, trigger: triggerFn } = factory(
      () => { if (_track) _track(); },
      () => { if (_trigger) _trigger(); }
    );
    _track = trackFn;
    _trigger = triggerFn;
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
      warn(`triggerRef() expects a ref object.`);
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
    for (const key of Object.keys(object)) result[key] = toRef(object, key);
    return result;
  }
  const computedCache = /* @__PURE__ */ new WeakMap();
  function computed(getterOrOptions) {
    let getter, setter;
    if (typeof getterOrOptions === "function") {
      getter = getterOrOptions;
      setter = () => warn(`[Helix] \u{1F4A5} Write operation failed: computed value is readonly.`);
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set || (() => warn(`[Helix] \u{1F4A5} Write operation failed: no setter provided.`));
    }
    // Instance-level computed cache: share effects for same getter within instance
    let value;
    let dirty = true;
    let version = 0;
    let hasError = false;
    let errorValue = null;
    const computedRef = {};
    const runner = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!dirty) {
          dirty = true;
          version = globalEffectVersion;
          trigger(computedRef, "value");
        }
      }
    });
    Object.defineProperty(computedRef, "value", {
      get() {
        if (dirty || version !== globalEffectVersion) {
          try {
            value = runner();
            hasError = false;
            errorValue = null;
            version = globalEffectVersion;
          } catch (err) {
            hasError = true;
            errorValue = err;
            handleError(err, "computed getter");
          }
          dirty = false;
        }
        if (hasError) throw errorValue;
        track(computedRef, "value");
        return value;
      },
      set(newValue) {
        setter(newValue);
        dirty = true;
        version = globalEffectVersion;
        trigger(computedRef, "value");
      }
    });
    computedRef[IS_REF] = true;
    return computedRef;
  }
  /**
   * Watch a reactive source and invoke callback on change.
   * @returns {Function} Cleanup function to stop watching
   */
  function watch(source, cb, options = {}) {
    const { deep = false, immediate = false, flush = "pre" } = options;
    let getter;
    if (typeof source === "function") {
      getter = deep ? () => traverse(source()) : source;
    } else {
      getter = deep ? () => traverse(source) : () => source;
    }
    let oldVal;
    let isStopped = false;
    let watchCleanupFn = null;
    const job = () => {
      if (isStopped) return;
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
        if (typeof fn === "function") watchCleanupFn = fn;
      };
      cb(newVal, oldVal, onCleanup);
      oldVal = newVal;
    };
    const runner = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (flush === "sync") job();
        else if (flush === "post") queuePostFlushCb(job);
        else queueJob(job);
      }
    });
    // Initialize oldVal after runner is defined
    oldVal = runner();
    if (immediate) job();
    return () => {
      isStopped = true;
      if (watchCleanupFn) {
        try {
          watchCleanupFn();
        } catch (err) {
          handleError(err, "watch final cleanup");
        }
      }
      cleanup(runner);
    };
  }
function watchEffect(effectFn, options = {}) {
    const { flush = "pre" } = options;
    let isStopped = false;
    let watchCleanupFn = null;
    const job = () => {
      if (isStopped) return;
      if (watchCleanupFn) {
        try {
          watchCleanupFn();
        } catch (err) {
          handleError(err, "watchEffect cleanup");
        }
        watchCleanupFn = null;
      }
      const onCleanup = (fn) => {
        if (typeof fn === "function") watchCleanupFn = fn;
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
      scheduler: () => {
        if (flush === "sync") job();
        else if (flush === "post") queuePostFlushCb(job);
        else queueJob(job);
      }
    });
    job();
    return () => {
      isStopped = true;
      if (watchCleanupFn) {
        try {
          watchCleanupFn();
        } catch (err) {
          handleError(err, "watchEffect final cleanup");
        }
      }
      cleanup(runner);
    };
  }
  function traverse(value, seen = /* @__PURE__ */ new Set()) {
    if (typeof value !== "object" || value === null || seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) traverse(value[i], seen);
    } else if (isRef(value)) {
      traverse(value.value, seen);
    } else {
      for (const key in value) traverse(value[key], seen);
    }
    return value;
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
      const val = getPathParts(path).reduce((acc, part) => acc?.[part], ctx);
      return isRef(val) ? val.value : val;
    } catch (err) {
      warn(`Failed to resolve path: ${path}`, err);
      return void 0;
    }
  }
  function resolveRaw(path, ctx) {
    try {
      return getPathParts(path).reduce((acc, part) => acc?.[part], ctx);
    } catch (err) {
      warn(`Failed to resolve raw path: ${path}`, err);
      return void 0;
    }
  }
  function resolveExpression(val, ctx, { asBoolean = false, fallback = void 0, contextName = "expression", forceExpression = false } = {}) {
    if (globalConfig.allowInlineExpressions && __DEV__) {
      warn(`Security: inline expressions enabled. Never use with untrusted user input.`);
    }
    let result;
    const parts = getPathParts(val);
    let current = ctx;
    let exists = true;
    for (let i = 0; i < parts.length; i++) {
      if (current == null || !(parts[i] in current)) {
        exists = false;
        break;
      }
      current = current[parts[i]];
    }
    if (exists) {
      result = isRef(current) ? current.value : current;
    } else if (globalConfig.allowInlineExpressions || forceExpression) {
      try {
        result = new Function("$ctx", `with($ctx) { return ${val} }`)(ctx);
      } catch (err) {
        handleError(err, `${contextName}: ${val}`);
        result = fallback;
      }
    } else {
      warn(`Path not found: ${val}`);
      result = fallback;
    }
    // Only coerce resolved values to boolean, not fallback values
    if (!exists) {
      return result;  // return fallback as-is
    }
    return asBoolean ? !!result : result;
  }
  function sanitizeHtml(html) {
    if (typeof html !== "string") return "";
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
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
  /**
   * Fast update path: apply only the changes indicated by patch flags
   * instead of full re-binding.
   */
  function fastUpdateNode(node, ctx, instance) {
    const flag = node.__hx_patchFlag || 0;
    if (!flag || flag === 0) return false; // No fast path available

    // TEXT flag: only update text content
    if (flag & PatchFlags.TEXT) {
      // Text updates are handled by the text directive's effect
      // which re-runs automatically via the reactive system
    }
    // CLASS flag: class is handled by effect, already reactive
    // STYLE flag: style is handled by effect, already reactive
    // PROPS flag: handled by bind directive effects

    return true; // Fast path taken
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
      if (n.__hx_key !== undefined) {
        n.__hx_key = null;
      }
      if (n.nodeType === 1) Array.from(n.childNodes).forEach(runCleanups);
    };
    runCleanups(node);
    if (node.parentNode) node.remove();
    node[BOUND] = false;
  }
  function getCurrentInstance() {
    return currentInstance;
  }
  function onMounted(fn) {
    if (currentInstance) currentInstance.hooks.mount.push(fn);
  }
  function onMount(fn) {
    warn(`[Helix] onMount is deprecated. Use onMounted instead.`);
    return onMounted(fn);
  }
  function onBeforeMount(fn) {
    if (currentInstance) currentInstance.hooks.beforeMount.push(fn);
  }
  function onUnmounted(fn) {
    if (currentInstance) currentInstance.hooks.destroy.push(fn);
  }
  function onDestroy(fn) {
    warn(`[Helix] onDestroy is deprecated. Use onUnmounted instead.`);
    return onUnmounted(fn);
  }
  function onBeforeUnmount(fn) {
    if (currentInstance) currentInstance.hooks.beforeUnmount.push(fn);
  }
  function onUpdated(fn) {
    if (currentInstance) currentInstance.hooks.updated.push(fn);
  }
  function provide(key, value) {
    if (!currentInstance) return;
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent ? currentInstance.parent.provides : null;
    if (provides === parentProvides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
  }
  function inject(key, defaultValue) {
    if (!currentInstance) return;
    const provides = currentInstance.provides;
    if (provides && key in provides) return provides[key];
    return defaultValue;
  }
  function validateProp(name, value, def) {
    if (!def) return value;
    if (def.required && (value === void 0 || value === null)) {
      warn(`Prop "${name}" is required but was not provided.`);
      return value;
    }
    if (value === void 0 && def.hasOwnProperty("default")) {
      return typeof def.default === "function" ? def.default() : def.default;
    }
    if (value !== void 0 && def.type) {
      const types = Array.isArray(def.type) ? def.type : [def.type];
      const isValid = types.some((type) => {
        if (type === String) return typeof value === "string";
        if (type === Number) return typeof value === "number";
        if (type === Boolean) return typeof value === "boolean";
        if (type === Array) return Array.isArray(value);
        if (type === Object) return typeof value === "object" && value !== null && !Array.isArray(value);
        return value instanceof type;
      });
      if (!isValid) {
        warn(`Type mismatch for prop "${name}". Expected ${types.map((t) => t.name).join(" or ")} but got ${typeof value}.`);
      }
    }
    return value;
  }
  function validateEmit(eventName, args, emitsDef) {
    if (!emitsDef) return true;
    const isArray = Array.isArray(emitsDef);
    const isDeclared = isArray ? emitsDef.includes(eventName) : emitsDef.hasOwnProperty(eventName);
    if (!isDeclared) {
      warn(`Component emitted event "${eventName}" but it is not declared in the emits option.`);
      return false;
    }
    if (!isArray && typeof emitsDef[eventName] === "function") {
      const isValid = emitsDef[eventName](...args);
      if (!isValid) {
        warn(`Invalid payload for emitted event "${eventName}". Validator returned false.`);
        return false;
      }
    }
    return true;
  }
  function createSlots(slotEls, ctx, instance, bindNode) {
    const slots = {};
    slotEls.forEach((el) => {
      if (el.nodeType !== 1) return;
      let slotName = "default";
      let slotProps = null;
      Array.from(el.attributes || []).forEach((attr) => {
        if (attr.name.startsWith("v-slot:") || attr.name.startsWith("#")) {
          slotName = attr.name.replace(/^(v-slot:|#)/, "") || "default";
          const attrVal = attr.value.trim();
          if (attrVal) slotProps = attrVal;
        }
      });
      if (!slots[slotName]) slots[slotName] = [];
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
          if (resolved && typeof resolved === "object") scopeProps = resolved;
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
    if (!normalized) return null;
    // Map Vue 2 hook names to Vue 3 equivalents for compatibility
    const hookMap = {
      'bind': 'beforeMount',
      'inserted': 'mounted',
      'update': 'beforeUpdate',
      'componentUpdated': 'updated',
      'unbind': 'unmounted'
    };
    let actualHookName = hookName;
    if (normalized[hookName] === undefined && hookMap[hookName]) {
      actualHookName = hookMap[hookName];
    }
    const hook = normalized[actualHookName];
    if (typeof hook !== "function") return null;
    return () => {
      try {
        hook.call(normalized, el, binding);
      } catch (err) {
        handleError(err, `directive ${dirName} ${hookName}`);
      }
    };
  }
  // ============ DELIMITER INTERPOLATION UTILITIES ============
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createDelimiterPattern(delimiters) {
    const open = escapeRegex(delimiters[0]);
    const close = escapeRegex(delimiters[1]);
    return new RegExp(open + '\\s*(.*?)\\s*' + close, 'g');
  }

  function parseTextInterpolation(text, delimiters) {
    if (!delimiters || delimiters.length !== 2) return null;
    const pattern = createDelimiterPattern(delimiters);
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      tokens.push({ type: 'interpolation', value: match[1].trim() });
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return tokens.length > 0 ? tokens : null;
  }

  function bindTextInterpolation(node, ctx, instance, delimiters) {
    const text = node.textContent;
    const tokens = parseTextInterpolation(text, delimiters);
    if (!tokens) return false;

    const parent = node.parentNode;
    if (!parent) return false;

    // Create a comment node to mark the interpolation zone
    const marker = document.createComment(' text-interpolation ');
    parent.insertBefore(marker, node);

    // Remove original text node
    node.remove();

    // Create effect to update all interpolated text nodes
    const textNodes = [];

    tokens.forEach((token, index) => {
      if (token.type === 'text') {
        const textNode = document.createTextNode(token.value);
        parent.insertBefore(textNode, marker);
      } else {
        const interpNode = document.createTextNode('');
        parent.insertBefore(interpNode, marker);
        textNodes.push({ node: interpNode, expr: token.value });
      }
    });

    // Remove marker after setup
    marker.remove();

    // Create reactive effects for each interpolation
    const cleanupFns = [];
    textNodes.forEach(({ node: textNode, expr }) => {
      const updateFn = () => {
        // Use resolveExpression which handles both simple paths and complex expressions
        // For simple paths, it resolves directly. For expressions, it requires allowInlineExpressions.
        const res = resolveExpression(expr, ctx, { fallback: '', contextName: 'text-interpolation' });
        const newText = typeof res === 'object' && res !== null ? JSON.stringify(res) : res ?? '';
        if (textNode.textContent !== newText) {
          textNode.textContent = newText;
        }
      };
      const e = effect(updateFn, { name: `interpolation: ${expr}` });
      cleanupFns.push(() => cleanup(e));
    });

    // Store cleanup on the parent element (DOM-level lifecycle)
    if (!parent.__hx_cleanup) {
      parent.__hx_cleanup = [];
    }
    cleanupFns.forEach(fn => parent.__hx_cleanup.push(fn));
    // Also register on instance for component-level teardown safety
    cleanupFns.forEach(fn => instance.cleanups.push(fn));

    return true;
  }
  // ============ END DELIMITER UTILITIES ============

  function createBuiltinDirectives(appConfig) {
    const dirs = {};
    dirs.ref = {
      mounted(el, { value, ctx }) {
        const parts = getPathParts(value);
        const last = parts.pop();
        const parent = parts.reduce((acc, part) => acc?.[part], ctx);
        if (parent) parent[last] = el;
      }
    };
    dirs.text = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, trackCleanup }) {
        el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.TEXT;
        const updateFn = () => {
          const res = resolvePath(val, ctx);
          const newText = typeof res === "object" && res !== null ? JSON.stringify(res) : res ?? "";
          if (el.textContent !== newText) el.textContent = newText;
        };
        const e = effect(updateFn, { name: `text: ${val}` });
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.html = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, trackCleanup }) {
        const updateFn = () => {
          const res = resolvePath(val, ctx);
          const newHtml = sanitizeHtml(res || "");
          if (el.innerHTML !== newHtml) el.innerHTML = newHtml;
        };
        const e = effect(updateFn, { name: `html: ${val}` });
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.model = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, trackCleanup }) {
        const isCheck = el.type === "checkbox";
        const isRadio = el.type === "radio";
        const isSelect = el.tagName === "SELECT";
        const isSelectMultiple = isSelect && el.multiple;
        const evtType = isCheck || isRadio || isSelect ? "change" : "input";
        const handler = (e2) => {
          const parts = getPathParts(val);
          const last = parts.pop();
          const parent = parts.reduce((acc, part) => acc?.[part], ctx);
          if (parent) {
            if (isCheck) parent[last] = e2.target.checked;
            else if (isRadio) parent[last] = e2.target.value;
            else if (isSelectMultiple) {
              const selected = Array.from(e2.target.selectedOptions).map(opt => opt.value);
              parent[last] = selected;
            }
            else {
              const rawValue = e2.target.value;
              if (el.type === "number") {
                const num = rawValue === "" ? "" : Number(rawValue);
                parent[last] = Number.isNaN(num) ? rawValue : num;
              } else parent[last] = rawValue;
            }
          }
        };
        el.addEventListener(evtType, handler);
        const updateFn = () => {
          const current = resolvePath(val, ctx);
          if (isRadio) {
            const shouldCheck = current === el.value;
            if (el.checked !== shouldCheck) el.checked = shouldCheck;
          } else if (isCheck) {
            const shouldCheck = !!current;
            if (el.checked !== shouldCheck) el.checked = shouldCheck;
          } else if (isSelectMultiple) {
            const selectedValues = Array.isArray(current) ? current : [];
            Array.from(el.options).forEach(opt => {
              opt.selected = selectedValues.includes(opt.value);
            });
          } else {
            const newValue = current ?? "";
            if (el.value !== newValue) el.value = newValue;
          }
        };
        const e = effect(updateFn, { name: `model: ${val}` });
        trackCleanup(() => {
          el.removeEventListener(evtType, handler);
          cleanup(e);
        });
      }
    };
    dirs.bind = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, arg, ctx, trackCleanup }) {
        if (!arg) return;
        const trimmed = val.trim();
        // Object literal detection for :class and :style
        // These are safe, declarative contexts where expressions are always allowed
        const isObjectLiteral = trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.includes(":");
        const updateFn = () => {
          let result;
          // For :class and :style, force expression evaluation (safe declarative contexts)
          // For other bindings, use normal path resolution unless it's an object literal
          if (isObjectLiteral && (arg === "class" || arg === "style")) {
            result = resolveExpression(val, ctx, { contextName: `v-bind:${arg}`, forceExpression: true });
          } else if (isObjectLiteral) {
            result = resolveExpression(val, ctx, { contextName: "v-bind object" });
          } else {
            result = resolvePath(val, ctx);
          }
          if (arg === "class") {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.CLASS;
            if (typeof result === "object" && result !== null) {
              Object.keys(result).forEach((k) => el.classList.toggle(k, !!result[k]));
            } else {
              const newClass = result || "";
              if (el.className !== newClass) el.className = newClass;
            }
          } else if (arg === "style") {
            el.__hx_patchFlag = (el.__hx_patchFlag || 0) | PatchFlags.STYLE;
            if (typeof result === "object" && result !== null) Object.assign(el.style, result);
            else {
              const newStyle = result || "";
              if (el.style.cssText !== newStyle) el.style.cssText = newStyle;
            }
          } else if (arg === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
            const newValue = result ?? "";
            if (el.value !== newValue) el.value = newValue;
          } else if (typeof result === "boolean") {
            if (result) {
              if (!el.hasAttribute(arg)) el.setAttribute(arg, "");
            } else {
              if (el.hasAttribute(arg)) el.removeAttribute(arg);
            }
          } else {
            const newValue = result ?? "";
            if (el.getAttribute(arg) !== newValue) el.setAttribute(arg, newValue);
          }
        };
        const e = effect(updateFn, { name: `bind: ${arg}` });
        trackCleanup(() => cleanup(e));
      }
    };
       dirs.on = {
      mounted(el, { value: val, arg, modifiers, ctx, trackCleanup }) {
        const evtType = arg || "click";

        // Lightweight arg parser: respects quotes, brackets, parens
        const parseArgs = (str) => {
          const args = [];
          if (!str) return args;
          let depth = 0, current = '', inQuote = false, quoteChar = '';
          for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (!inQuote && (ch === '"' || ch === "'")) {
              inQuote = true; quoteChar = ch; current += ch;
            } else if (inQuote && ch === quoteChar && str[i - 1] !== '\\') {
              inQuote = false; current += ch;
            } else if (!inQuote && (ch === '(' || ch === '{' || ch === '[')) {
              depth++; current += ch;
            } else if (!inQuote && (ch === ')' || ch === '}' || ch === ']')) {
              depth--; current += ch;
            } else if (!inQuote && ch === ',' && depth === 0) {
              args.push(current.trim()); current = '';
            } else {
              current += ch;
            }
          }
          if (current.trim()) args.push(current.trim());
          return args;
        };

        const handler = (e) => {
          if (modifiers.includes("prevent")) e.preventDefault();
          if (modifiers.includes("stop")) e.stopPropagation();

          let targetFn;
          let args = [e]; // default: just the event

          const trimmed = val.trim();
          const parenIdx = trimmed.indexOf('(');

          // Detect inline call syntax:  fnName(arg1, arg2, $event)
          if (parenIdx > -1 && trimmed.endsWith(')')) {
            const fnPath = trimmed.slice(0, parenIdx).trim();
            const argsStr = trimmed.slice(parenIdx + 1, trimmed.length - 1).trim();

            targetFn = resolveRaw(fnPath, ctx);

            if (argsStr) {
              const rawArgs = parseArgs(argsStr);
              args = rawArgs.map(a => {
                if (a === '$event') return e;

                // 1. Resolve from reactive context (loop vars, store, etc.)
                const resolved = resolvePath(a, ctx);
                if (resolved !== undefined) return resolved;

                // 2. JSON literal: numbers, booleans, arrays, objects
                try { return JSON.parse(a); } catch {}

                // 3. Quoted string literal
                if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
                  return a.slice(1, -1);
                }

                // 4. Fallback: return as-is (unlikely to reach here in normal use)
                return a;
              });
            } else {
              args = [];
            }
          } else {
            // Plain path: e.g. store.tabs.handleSelect
            targetFn = resolveRaw(val, ctx);
          }

          if (typeof targetFn === "function") {
            try {
              targetFn.call(ctx, ...args);
            } catch (err) {
              handleError(err, `Event @${evtType}`);
            }
          } else if (appConfig.allowInlineExpressions) {
            // Full expression fallback (complex math, ternaries, etc.)
            try {
              new Function("$ctx", "$event", `with($ctx) { ${val} }`)(ctx, e);
            } catch (err) {
              handleError(err, `Event @${evtType}`);
            }
          } else {
            warn(`Handler not found: ${val}`);
          }
        };

        el.addEventListener(evtType, handler);
        trackCleanup(() => el.removeEventListener(evtType, handler));
      }
    };
    dirs.show = {
      mounted(el, binding) {
        this.updated(el, binding);
      },
      updated(el, { value: val, ctx, trackCleanup }) {
        const updateFn = () => {
          const shouldShow = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-show" });
          const newDisplay = shouldShow ? "" : "none";
          if (el.style.display !== newDisplay) el.style.display = newDisplay;
        };
        const e = effect(updateFn, { name: `show: ${val}` });
        trackCleanup(() => cleanup(e));
      }
    };
    dirs.if = {
      mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
        const placeholder = document.createComment(` ${appConfig.prefix}if: ${val} `);
        let isMounted = false;
        if (el.parentNode) {
          el.parentNode.insertBefore(placeholder, el);
          el.remove();
        }
        const e = effect(() => {
          const isTrue = resolveExpression(val, ctx, { asBoolean: true, fallback: false, contextName: "v-if" });
          if (isTrue && !isMounted) {
            if (!el[BOUND]) bindNode2(el, ctx, instance);
            if (placeholder.parentNode) placeholder.parentNode.insertBefore(el, placeholder);
            isMounted = true;
          } else if (!isTrue && isMounted) {
            if (el.parentNode) el.remove();
            el[BOUND] = false;
            isMounted = false;
          }
        }, { name: `if: ${val}` });
        trackCleanup(() => {
          cleanup(e);
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        });
      }
    };
    dirs.for = {
      mounted(el, { value: val, ctx, instance, trackCleanup, bindNode: bindNode2 }) {
        const match = val.match(/^(?:(?:\(([^,]+),\s*([^)]+)\)|([^\s]+))\s+in\s+(.+))$/);
        if (!match) return warn(`[for] Invalid syntax: ${val}`);
        const itemName = match[1] || match[3];
        const indexName = match[2];
        const listPath = match[4];
        const keyPath = el.getAttribute(`${appConfig.prefix}key`) || el.getAttribute(":key");
        el.removeAttribute(`${appConfig.prefix}key`);
        el.removeAttribute(":key");
        const placeholder = document.createComment(` ${appConfig.prefix}for: ${val} `);
        el.parentNode.insertBefore(placeholder, el);
        el.remove();
        let renderedNodes = [];
        const updateFn = () => {
          let list = [];
          const directList = resolvePath(listPath, ctx);
          if (Array.isArray(directList)) list = directList;
          else if (appConfig.allowInlineExpressions) {
            try {
              list = new Function("$ctx", `with($ctx) { return ${listPath} }`)(ctx) || [];
            } catch (err) {
              handleError(err, `v-for expression: ${listPath}`);
            }
          } else {
            warn(`Inline expressions disabled. Use a computed property for complex lists: ${listPath}`);
          }
          const newNodes = [];
          const currentMap = /* @__PURE__ */ new Map();
          const usedKeys = /* @__PURE__ */ new Set();
          renderedNodes.forEach((n) => currentMap.set(n.__hx_key, n));
          list.forEach((item, index) => {
            let key;
            if (keyPath) key = getPathParts(keyPath).reduce((acc, part) => acc?.[part], item);
            else if (item && typeof item === "object") {
              key = vForKeyMap.get(item);
              if (!key) {
                key = /* @__PURE__ */ Symbol("auto-key");
                vForKeyMap.set(item, key);
              }
            } else key = item;
            if (usedKeys.has(key)) {
              const newKey = typeof key === "symbol" ? /* @__PURE__ */ Symbol(`dup-${index}`) : `${String(key)}_dup_${index}`;
              // Update vForKeyMap so next reconciliation finds the correct key
              if (item && typeof item === "object" && keyPath) {
                vForKeyMap.set(item, newKey);
              }
              key = newKey;
            }
            usedKeys.add(key);
            let node = currentMap.get(key);
            if (node) {
              currentMap.delete(key);
              node.__hx_scope[itemName] = item;
              if (indexName) node.__hx_scope[indexName] = index;
            } else {
              node = el.cloneNode(true);
              node.__hx_key = key;
              node.__hx_scope = reactive({ [itemName]: item });
              if (indexName) node.__hx_scope[indexName] = index;
              const childCtx = Object.setPrototypeOf(node.__hx_scope, ctx);
              bindNode2(node, childCtx, instance);
            }
            newNodes.push(node);
          });
          currentMap.forEach((node) => destroyNode(node));
          const oldKeyToIndex = /* @__PURE__ */ new Map();
          renderedNodes.forEach((n, i) => oldKeyToIndex.set(n.__hx_key, i));
          const newIndexToOldIndex = new Array(newNodes.length).fill(-1);
          newNodes.forEach((node, i) => {
            const oldIndex = oldKeyToIndex.get(node.__hx_key);
            if (oldIndex !== void 0) newIndexToOldIndex[i] = oldIndex;
          });
          const increasingNewIndexSequence = getLIS(newIndexToOldIndex);
          let j = increasingNewIndexSequence.length - 1;
          for (let i = newNodes.length - 1; i >= 0; i--) {
            const node = newNodes[i];
            const anchor = i + 1 < newNodes.length ? newNodes[i + 1] : placeholder;
            if (newIndexToOldIndex[i] === -1) {
              placeholder.parentNode.insertBefore(node, anchor);
            } else if (j < 0 || i !== increasingNewIndexSequence[j]) {
              placeholder.parentNode.insertBefore(node, anchor);
            } else {
              j--;
            }
          }
          renderedNodes = newNodes;
        };
        const e = effect(updateFn, { name: `for: ${listPath}` });
        trackCleanup(() => cleanup(e));
      }
    };
    return dirs;
  }
  function makeBindNode(appContext) {
    const appComponents = appContext.components;
    const appDirectives = appContext.directives;
    const appConfig = appContext.config;
    const builtinDirectives = createBuiltinDirectives(appConfig);
    const resolveDirective = (name) => {
      if (appDirectives[name]) return appDirectives[name];
      if (globalDirectives[name]) return globalDirectives[name];
      return builtinDirectives[name];
    };
    const resolveComponent = (name) => appComponents[name] || globalComponents[name];
    function bindNode(node, ctx, instance) {
      // Skip static nodes (no dynamic bindings) - fast path
      if (node.nodeType === 1 && node.__hx_static) {
        node[BOUND] = true;
        Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance));
        return;
      }
      // Handle text nodes with delimiter interpolation
      if (node.nodeType === 3) {
        const delimiters = appConfig.delimiters || globalConfig.delimiters;
        if (delimiters && delimiters.length === 2) {
          bindTextInterpolation(node, ctx, instance, delimiters);
        }
        return;
      }

      if (node.nodeType !== 1 || node[BOUND]) return;
      const tagName = node.tagName.toLowerCase();
      const compDef = resolveComponent(tagName);
      if (compDef) {
        const normalizeEventName = (name) => name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
        node[BOUND] = true;
        const compDefNormalized = typeof compDef === "function" ? { setup: compDef } : compDef;
        const propsDef = compDefNormalized.props || {};
        const emitsDef = compDefNormalized.emits;
        const propsTarget = {};
        const listeners = /* @__PURE__ */ Object.create(null);
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
            warn(`[Helix] Props are read-only.`);
            return false;
          }
        });
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
        const slots = createSlots(slotTemplates, ctx, instance, bindNode);
        const defaultSlotEls = childNodes.filter((child) => {
          if (child.nodeType !== 1) return true;
          return !slotTemplates.includes(child);
        });
        if (defaultSlotEls.length > 0 && !slots.default) {
          slots.default = (scopeProps = {}) => {
            const fragment = document.createDocumentFragment();
            defaultSlotEls.forEach((el) => {
              const clone = el.cloneNode(true);
              bindNode(clone, ctx, instance);
              fragment.appendChild(clone);
            });
            return fragment;
          };
        }
        Array.from(node.attributes || []).forEach((attr) => {
          if (attr.name.startsWith("@") || attr.name.startsWith(`${appConfig.prefix}on:`)) {
            const evtName = normalizeEventName(attr.name.replace(/^(@|v-on:)/, ""));
            if (!listeners[evtName]) listeners[evtName] = [];
            listeners[evtName].push((...args) => {
              const targetFn = resolveRaw(attr.value, ctx);
              if (typeof targetFn === "function") targetFn.call(ctx, ...args);
              else if (appConfig.allowInlineExpressions) {
                try {
                  new Function("$ctx", "$event", `with($ctx) { ${attr.value} }`)(ctx, args[0]);
                } catch (err) {
                  handleError(err, `emit handler: ${evtName}`);
                }
              } else warn(`Inline expressions disabled. Cannot execute handler: ${attr.value}`);
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
              });
              instance.cleanups.push(() => cleanup(e));
            } else {
              propsTarget[propName] = validateProp(propName, attr.value, propsDef[propName]);
            }
          }
        });
        const emit = (evtName, ...args) => {
          const normalizedName = normalizeEventName(evtName);
          const isValid = validateEmit(normalizedName, args, emitsDef);
          if (!isValid) return;
          const handlers = listeners[normalizedName];
          if (handlers) for (let i = 0; i < handlers.length; i++) handlers[i](...args);
        };
        const scope = new EffectScope();
        node.innerHTML = "";
        const childInst = {
          id: ++globalInstanceId,
          name: compDefNormalized.name || tagName,
          root: node,
          scope,
          hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
          cleanups: [],
          parent: instance,
          provides: instance ? Object.create(instance.provides || null) : /* @__PURE__ */ Object.create(null)
        };
        node.__hx_cleanup = node.__hx_cleanup || [];
        let isComponentActive = true;
        node.__hx_cleanup.push(() => {
          isComponentActive = false;
          childInst.hooks.beforeUnmount.forEach((fn) => fn());
          childInst.cleanups.forEach((fn) => {
            try { fn(); } catch (e) { handleError(e, "component unmount cleanup"); }
          });
          scope.stop();
          childInst.hooks.destroy.forEach((fn) => fn());
          childInst.hooks.unmounted.forEach((fn) => fn());
        });
        const prevInstance = currentInstance;
        currentInstance = childInst;
        let childCtx;
        try {
          childCtx = scope.run(() => compDefNormalized.setup({
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
            onBeforeMount,
            onDestroy,
            onBeforeUnmount,
            onUpdated,
            props,
            emit,
            provide,
            inject,
            slots
          }));
        } catch (err) {
          handleError(err, `<${tagName}> setup`, childInst);
          currentInstance = prevInstance;
          scope.stop();
          return;
        }
        const finishMount = (resolvedCtx) => {
          currentInstance = prevInstance;
          if (resolvedCtx && resolvedCtx.template) {
            node.innerHTML = resolvedCtx.template;
            renderSlots(slots, node, resolvedCtx, childInst, bindNode);
            node.childNodes.forEach((child) => {
              if (child.nodeType === 1 && child.tagName.toLowerCase() !== "slot") {
                bindNode(child, resolvedCtx, childInst);
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
        };
        if (childCtx instanceof Promise) {
          childCtx.then((resolvedCtx) => {
            if (isComponentActive) finishMount(resolvedCtx);
          }).catch((err) => {
            handleError(err, `<${tagName}> async setup`, childInst);
            currentInstance = prevInstance;
          });
        } else finishMount(childCtx);
        return;
      }
      node.__hx_cleanup = node.__hx_cleanup || [];
      const trackCleanup = (fn) => {
        node.__hx_cleanup.push(fn);
        instance.cleanups.push(fn);
      };
      if (node.hasAttribute(`${appConfig.prefix}for`)) {
        const val = node.getAttribute(`${appConfig.prefix}for`);
        node.removeAttribute(`${appConfig.prefix}for`);
        const dir = resolveDirective("for");
        if (dir) {
          const binding = { value: val, ctx, instance, trackCleanup, bindNode };
          const hook = createDirectiveHook("for", "mounted", node, binding, instance, normalizeDirective(dir));
          if (hook) hook();
        }
        return;
      }
      if (node.hasAttribute(`${appConfig.prefix}if`)) {
        const val = node.getAttribute(`${appConfig.prefix}if`);
        node.removeAttribute(`${appConfig.prefix}if`);
        const dir = resolveDirective("if");
        if (dir) {
          const binding = { value: val, ctx, instance, trackCleanup, bindNode };
          const hook = createDirectiveHook("if", "mounted", node, binding, instance, normalizeDirective(dir));
          if (hook) hook();
        }
        return;
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
        // Cache static subtree for reuse across renders
        if (node.nodeType === 1 && !staticNodeCache.has(node)) {
          staticNodeCache.set(node, node.cloneNode(true));
        }
        Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance));
        return;
      }
      node[BOUND] = true;
      let patchFlag = 0;
      const attrsBond = Array.from(node.attributes || []);
      const toRemove = [];
      const directiveBindings = [];
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
            const dirCleanups = [];
            try {
              const binding = {
                value: attr.value,
                arg,
                modifiers,
                ctx,
                instance,
                trackCleanup: (fn) => {
                  dirCleanups.push(fn);
                  trackCleanup(fn);
                },
                bindNode,
                dir: dirDef,
                get oldValue() {
                  return this._oldValue;
                }
              };
              const mountedHook = createDirectiveHook(dirName, "mounted", node, binding, instance, normalizeDirective(dirDef));
              if (mountedHook) mountedHook();
              const normalized = normalizeDirective(dirDef);
              if (normalized.updated || normalized.unmounted) {
                directiveBindings.push({ dirName, node, binding, normalized });
              }
              toRemove.push(attr.name);
            } catch (err) {
              console.error(`[Helix] \u{1F4A5} Directive Error:`, err);
              // Cleanup any partial setup on error
              dirCleanups.forEach((fn) => {
                try { fn(); } catch (e) { /* ignore cleanup errors */ }
              });
            }
          }
        }
      });
      directiveBindings.forEach(({ dirName, node: el, binding, normalized }) => {
        if (normalized.beforeUpdate || normalized.updated) {
          const updateEffect = effect(() => {
            if (binding.arg) resolvePath(binding.value, binding.ctx);
          }, {
            scheduler: () => {
              // Store old value before update
              binding._oldValue = resolvePath(binding.value, binding.ctx);
              const beforeUpdateHook = createDirectiveHook(dirName, "beforeUpdate", el, binding, instance, normalized);
              if (beforeUpdateHook) beforeUpdateHook();
              const updatedHook = createDirectiveHook(dirName, "updated", el, binding, instance, normalized);
              if (updatedHook) updatedHook();
            },
            lazy: false
          });
          trackCleanup(() => cleanup(updateEffect));
        }
        if (normalized.beforeUnmount || normalized.unmounted) {
          trackCleanup(() => {
            const beforeUnmountHook = createDirectiveHook(dirName, "beforeUnmount", el, binding, instance, normalized);
            if (beforeUnmountHook) beforeUnmountHook();
            const unmountedHook = createDirectiveHook(dirName, "unmounted", el, binding, instance, normalized);
            if (unmountedHook) unmountedHook();
          });
        }
      });
      requestAnimationFrame(() => {
        if (appConfig.removeAttributeBindings) {
          toRemove.forEach((name) => {
            if (node.hasAttribute(name)) node.removeAttribute(name);
          });
        }
      });
      Array.from(node.childNodes).forEach((child) => bindNode(child, ctx, instance));
    }
    return bindNode;
  }
    function compareVersion(a, b) {
    const pa = String(a).split(/[-+\.]/).filter(Boolean);
    const pb = String(b).split(/[-+\.]/).filter(Boolean);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = parseInt(pa[i] || '0', 10);
      const nb = parseInt(pb[i] || '0', 10);
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
  function satisfiesVersion(version, range) {
    if (!range) return true;
    const v = String(version);
    const r = String(range).trim();
    if (r.startsWith('>=')) return compareVersion(v, r.slice(2)) >= 0;
    if (r.startsWith('>')) return compareVersion(v, r.slice(1)) > 0;
    if (r.startsWith('<=')) return compareVersion(v, r.slice(2)) <= 0;
    if (r.startsWith('<')) return compareVersion(v, r.slice(1)) < 0;
    if (r.startsWith('^')) {
      const major = r.slice(1).split('.')[0];
      return compareVersion(v, r.slice(1)) >= 0 && String(v).split('.')[0] === major;
    }
    if (r.startsWith('~')) {
      const parts = r.slice(1).split('.');
      return compareVersion(v, r.slice(1)) >= 0 && String(v).split('.').slice(0, 2).join('.') === parts.slice(0, 2).join('.');
    }
    return compareVersion(v, r) === 0;
  }

function createApp(rootComponent = {}) {
    const appComponents = {};
    const appDirectives = {};
    const appPlugins = [];
    const appProvides = /* @__PURE__ */ Object.create(null);
    let isMounted = false;
    let rootElement = null;
    let rootInstance = null;
    let unmountCallbacks = [];
    const appConfig = /* @__PURE__ */ Object.create(globalConfig);
    Object.freeze(appConfig);
    const appContext = {
      config: appConfig,
      components: appComponents,
      directives: appDirectives,
      provides: appProvides
    };
    const bindNode = makeBindNode(appContext);
    const app = {
      version: "11.1.4",
      config: appConfig,
      component(name, definition) {
        if (typeof name !== "string") {
          warn(`Component name must be a string.`);
          return app;
        }
        const key = name.toLowerCase();
        if (definition === void 0) return appComponents[key];
        appComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
        return app;
      },
      directive(name, definition) {
        if (typeof name !== "string") {
          warn(`Directive name must be a string.`);
          return app;
        }
        const key = name.toLowerCase();
        if (definition === void 0) return appDirectives[key];
        // Normalize directive definition
        if (typeof definition === "function") {
          // If a function is passed, treat it as the 'mounted' and 'updated' hook
          appDirectives[key] = {
            mounted: definition,
            updated: definition
          };
        } else {
          appDirectives[key] = definition;
        }
        return app;
      },
      use(plugin, options = {}) {
        if (!plugin) return app;
        if (appPlugins.some((p) => p.plugin === plugin)) return app;

        // Validate metadata
        if (plugin.name) {
          if (appPlugins.some((p) => p.name === plugin.name)) {
            warn(`Plugin "${plugin.name}" is already installed on this app.`);
            return app;
          }
          if (plugin.requires && plugin.requires.helix) {
            if (!satisfiesVersion(app.version, plugin.requires.helix)) {
              warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but app version is ${app.version}.`);
              return app;
            }
          }
        }

        const pluginAPI = {
          config: appConfig,
          component: app.component.bind(app),
          directive: app.directive.bind(app),
          provide: app.provide.bind(app),
          mount: app.mount.bind(app),
          unmount: app.unmount.bind(app),
          version: app.version,
          namespace: app.namespace.bind(app)
        };

        let cleanup = null;
        let installPromise = null;
        if (typeof plugin.install === "function") {
          const result = plugin.install(pluginAPI, options);
          if (result && typeof result.then === "function") {
            installPromise = result;
          } else {
            cleanup = result;
          }
        } else if (typeof plugin === "function") {
          const result = plugin(pluginAPI, options);
          if (result && typeof result.then === "function") {
            installPromise = result;
          } else {
            cleanup = result;
          }
        }

        const entry = {
          plugin,
          options,
          name: plugin.name || null,
          version: plugin.version || null,
          cleanup: typeof cleanup === "function" ? cleanup : null,
          promise: installPromise || null,
          installedAt: Date.now()
        };
        appPlugins.push(entry);
        if (installPromise) {
          installPromise.then(() => { entry.promise = null; }).catch((err) => {
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
        warn(`App already mounted. Call unmount() first.`);
        return rootInstance;
    }
    rootElement = document.querySelector(rootSelector);
    if (!rootElement) {
        warn(`[mount] Cannot find element: ${rootSelector}`);
        return null;
    }

    // Wait for all async app plugins to resolve
    const pendingAsync = appPlugins.filter((p) => p.promise).map((p) => p.promise);
    if (pendingAsync.length > 0) {
      await Promise.all(pendingAsync);
    }

    const instance = {
        id: ++globalInstanceId,
        root: rootElement,
        hooks: { beforeMount: [], mount: [], updated: [], beforeUnmount: [], destroy: [], unmounted: [] },
        cleanups: [],
        provides: Object.create(appProvides)
    };
    rootInstance = instance;
    currentInstance = instance;

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
        onBeforeMount,
        onDestroy,
        onBeforeUnmount,
        onUpdated,
        inject,
        resolvePath
    };

    // Execute plugins that haven't been executed yet (lazy execution pattern)
    // Global plugins are already executed; app plugins may need post-mount hook
    [...globalPlugins, ...appPlugins].forEach((p) => {
      if (p._executed) return;
      p._executed = true;
      if (typeof p.plugin.install === "function") {
        const result = p.plugin.install(pluginAPI, p.options);
        if (typeof result === "function" && !p.cleanup) p.cleanup = result;
      } else if (typeof p.plugin === "function") {
        const result = p(pluginAPI, p.options);
        if (typeof result === "function" && !p.cleanup) p.cleanup = result;
      }
    });

    const appCtx = {
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
        onBeforeMount,
        onDestroy,
        onBeforeUnmount,
        onUpdated,
        provide,
        inject
    };

    let ctx;
    try {
        if (typeof rootComponent === "function") {
            ctx = rootComponent(appCtx);
        } else if (rootComponent.setup) {
            ctx = rootComponent.setup(appCtx);
        } else {
            ctx = reactive({});
        }
    } catch (err) {
        handleError(err, "Root setup");
        currentInstance = null;
        return null;
    }
    currentInstance = null;
    trace("Initial Mount Binding", () => bindNode(rootElement, ctx, instance));
    instance.hooks.beforeMount.forEach((fn) => fn());
    instance.hooks.mount.forEach((fn) => fn());
    isMounted = true;

    return instance;
},
      unmount() {
        if (!isMounted || !rootElement) {
          warn(`App is not mounted.`);
          return app;
        }
        if (rootInstance) {
          rootInstance.hooks.beforeUnmount.forEach((fn) => fn());
          rootInstance.cleanups.forEach((fn) => {
            try { fn(); } catch (e) { handleError(e, "app unmount cleanup"); }
          });
          rootInstance.hooks.destroy.forEach((fn) => fn());
          rootInstance.hooks.unmounted.forEach((fn) => fn());
        }

        // Run plugin cleanups in reverse install order (LIFO)
        [...appPlugins].reverse().forEach((p) => {
          if (typeof p.cleanup === "function") {
            try { p.cleanup(); } catch (e) { handleError(e, `plugin cleanup: ${p.name || "anonymous"}`); }
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
        if (typeof callback === "function") unmountCallbacks.push(callback);
        return app;
      },
      // ==========================================
      // PLUGIN REGISTRY API
      // ==========================================
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
          const p = appPlugins.find((p) => p.name === name);
          if (!p) return null;
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
          const p = appPlugins.find((p) => p.name === pluginName);
          if (!p || !p.plugin || !p.plugin.requires) return false;
          const req = p.plugin.requires;
          if (req[dependencyName]) {
            const dep = appPlugins.find((d) => d.name === dependencyName);
            if (!dep) return false;
            return satisfiesVersion(dep.version || "0.0.0", req[dependencyName]);
          }
          return false;
        },
        count() {
          return appPlugins.length;
        }
      },
      // ==========================================
      // NAMESPACED API REGISTRY
      // ==========================================
      _namespaces: /* @__PURE__ */ Object.create(null),
      namespace(name, apis) {
        if (typeof name !== "string") {
          warn(`Namespace name must be a string.`);
          return app;
        }
        if (apis === void 0) {
          // Getter: return all APIs registered under this namespace
          return app._namespaces[name] || /* @__PURE__ */ Object.create(null);
        }
        if (typeof apis === "object" && apis !== null) {
          if (!app._namespaces[name]) app._namespaces[name] = /* @__PURE__ */ Object.create(null);
          Object.keys(apis).forEach((key) => {
            if (app._namespaces[name][key] !== undefined) {
              warn(`Namespace "${name}" already has API "${key}". Overwriting.`);
            }
            app._namespaces[name][key] = apis[key];
          });
        }
        return app;
      },
      onUnmount(callback) {
        warn(`[Helix] app.onUnmount is deprecated. Use app.onAppUnmount instead.`);
        return app.onAppUnmount(callback);
      },
      runWithContext(fn) {
        const prevInstance = currentInstance;
        const tempInstance = { provides: appProvides, parent: null };
        currentInstance = tempInstance;
        try {
          return fn();
        } finally {
          currentInstance = prevInstance;
        }
      }
    };
    return app;
  }
  function useGlobal(plugin, options = {}) {
    if (!plugin) return globalAPI;
    if (globalPlugins.some((p) => p.plugin === plugin)) return globalAPI;

    // Validate metadata
    if (plugin.name) {
      if (globalPlugins.some((p) => p.name === plugin.name)) {
        warn(`Global plugin "${plugin.name}" is already registered.`);
        return globalAPI;
      }
      if (plugin.requires && plugin.requires.helix) {
        if (!satisfiesVersion(globalAPI.version, plugin.requires.helix)) {
          warn(`Plugin "${plugin.name}" requires Helix ${plugin.requires.helix}, but current version is ${globalAPI.version}.`);
          return globalAPI;
        }
      }
    }

    let cleanup = null;
    if (typeof plugin.install === "function") {
      cleanup = plugin.install(globalAPI, options);
    } else if (typeof plugin === "function") {
      cleanup = plugin(globalAPI, options);
    }

    globalPlugins.push({
      plugin,
      options,
      name: plugin.name || null,
      version: plugin.version || null,
      cleanup: typeof cleanup === "function" ? cleanup : null,
      installedAt: Date.now(),
      _executed: true  // global plugins execute immediately in useGlobal
    });
    return globalAPI;
  }
  function componentGlobal(name, definition) {
    if (typeof name !== "string") {
      warn(`Component name must be a string.`);
      return globalAPI;
    }
    const key = name.toLowerCase();
    if (definition === void 0) return globalComponents[key];
    globalComponents[key] = typeof definition === "function" ? { setup: definition } : definition;
    return globalAPI;
  }
  function directiveGlobal(name, definition) {
    if (typeof name !== "string") {
      warn(`Directive name must be a string.`);
      return globalAPI;
    }
    const key = name.toLowerCase();
    if (definition === void 0) return globalDirectives[key];
    // Normalize directive definition
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
    globalPlugins.forEach((p) => app.use(p.plugin, p.options));
    return app.mount(rootSelector);
  }
  const globalAPI = {
    createApp,
    create: createApp,
    app: createApp,
    config: globalConfig,
    component: componentGlobal,
    directive: directiveGlobal,
    use: useGlobal,
    mount: createAndMount,
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
    _internal: {
      targetMap,
      reactiveMap,
      readonlyMap,
      globalComponents,
      globalDirectives,
      globalPlugins
    },
    registry: {
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
        const p = globalPlugins.find((p) => p.name === name);
        if (!p) return null;
        return {
          name: p.name,
          version: p.version,
          installedAt: p.installedAt || null,
          hasCleanup: !!p.cleanup
        };
      },
      count() {
        return globalPlugins.length;
      }
    }
  };
  return globalAPI;
})();