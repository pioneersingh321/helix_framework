/*! Helix Unified Framework Bundle | Plugins: [] | (c) Helix.js */

var HelixBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/.temp-bundle-entry-1787547138345.js
  var temp_bundle_entry_1787547138345_exports = {};
  __export(temp_bundle_entry_1787547138345_exports, {
    $apps: () => globalApps,
    $bus: () => globalBus,
    EffectScope: () => EffectScope,
    KEY_ALIASES: () => KEY_ALIASES,
    PatchFlags: () => PatchFlags,
    ScopeScheduler: () => ScopeScheduler,
    Suspense: () => Suspense,
    Teleport: () => Teleport,
    Transition: () => Transition,
    TransitionGroup: () => TransitionGroup,
    _internal: () => globalInternal,
    app: () => createApp,
    applyFlip: () => applyFlip,
    batch: () => batch,
    cancelFlip: () => cancelFlip,
    cancelTransition: () => cancelTransition,
    checkMemoryLeaks: () => checkMemoryLeaks,
    closeBlock: () => closeBlock,
    component: () => componentGlobal,
    computed: () => computed,
    config: () => globalConfig,
    create: () => createApp,
    createApp: () => createApp,
    createEffectGroup: () => createEffectGroup,
    createErrorBoundary: () => createErrorBoundary,
    createEventListener: () => createEventListener,
    customRef: () => customRef,
    default: () => temp_bundle_entry_1787547138345_default,
    defineAsyncComponent: () => defineAsyncComponent,
    defineCustomElement: () => defineCustomElement,
    definePlugin: () => definePlugin,
    devtools: () => devtoolsAPI,
    directive: () => directiveGlobal,
    directives: () => directivesGlobal,
    dispatch: () => dispatch,
    dom: () => domAPI,
    effect: () => effect,
    effectGroup: () => createEffectGroup,
    effectScope: () => effectScope,
    enableHtmx: () => enableHtmxIntegration,
    enableTracking: () => enableTracking,
    enter: () => enter,
    fireTransitionHook: () => fireTransitionHook,
    getCurrentInstance: () => getCurrentInstance,
    getCurrentScope: () => getCurrentScope,
    getProfileData: () => getProfileData,
    getTransitionDurations: () => getTransitionDurations,
    id: () => id,
    initHtmx: () => initHtmxIntegration,
    inject: () => inject,
    inspectComponent: () => inspectComponent,
    inspectDeps: () => inspectDeps,
    inspectTree: () => inspectTree,
    isProxy: () => isProxy,
    isRaw: () => isRaw,
    isReactive: () => isReactive,
    isReadonly: () => isReadonly,
    isRef: () => isRef,
    isShallow: () => isShallow,
    lazyBind: () => lazyBind,
    leave: () => leave,
    logger: () => logger,
    markRaw: () => markRaw,
    markTrace: () => markTrace,
    matchesKey: () => matchesKey,
    measureTrace: () => measureTrace,
    memo: () => memo,
    mount: () => createAndMount,
    namespace: () => namespaceGlobal,
    nextFrame: () => nextFrame,
    nextTick: () => nextTick,
    onBeforeMount: () => onBeforeMount,
    onBeforeUnmount: () => onBeforeUnmount,
    onDestroy: () => onDestroy,
    onError: () => onErrorGlobal,
    onErrorCaptured: () => onErrorCaptured,
    onMount: () => onMount,
    onMounted: () => onMounted,
    onScopeDispose: () => onScopeDispose,
    onUnmounted: () => onUnmounted,
    onUpdated: () => onUpdated,
    openBlock: () => openBlock,
    pauseTracking: () => pauseTracking,
    preload: () => preload,
    preloadAll: () => preloadAll,
    profile: () => profile,
    provide: () => provide,
    proxyRefs: () => proxyRefs,
    queueIdleJob: () => queueIdleJob,
    queueJob: () => queueJob,
    queuePostFlushCb: () => queuePostFlushCb,
    queuePreFlushCb: () => queuePreFlushCb,
    reactive: () => reactive,
    readonly: () => readonly,
    rebind: () => rebindGlobal,
    recordPositions: () => recordPositions,
    ref: () => ref,
    registry: () => globalRegistry,
    removeDirective: () => removeDirectiveGlobal,
    removeNamespace: () => removeNamespaceGlobal,
    resetTracking: () => resetTracking,
    resolvePath: () => resolvePath,
    resolveTeleportTarget: () => resolveTeleportTarget,
    resolveTransitionConfig: () => resolveTransitionConfig,
    resumeTracking: () => resumeTracking,
    runWithContext: () => runWithContextGlobal,
    scopeScheduler: () => globalScopeScheduler,
    shallowReactive: () => shallowReactive,
    shallowReadonly: () => shallowReadonly,
    shallowRef: () => shallowRef,
    simpleEffect: () => simpleEffect,
    toRaw: () => toRaw,
    toRef: () => toRef,
    toRefs: () => toRefs,
    toValue: () => toValue,
    triggerPluginLifecycle: () => triggerPluginLifecycle,
    triggerRef: () => triggerRef,
    uniqueId: () => uniqueId,
    unref: () => unref,
    untrack: () => untrack,
    unuse: () => unuseGlobal,
    use: () => useGlobal,
    useTemplateRef: () => useTemplateRef,
    validatePluginDependencies: () => validatePluginDependencies,
    version: () => VERSION,
    watch: () => watch,
    watchEffect: () => watchEffect
  });

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
    if (typeof window === "undefined" || !window.getComputedStyle || !el || el.nodeType !== 1) {
      return { duration: 0, delay: 0, total: 0, longestProperties: [], allProperties: [], longestAnimationNames: [] };
    }
    try {
      const styles = window.getComputedStyle(el);
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
      if (node && node.nodeType === 1 && typeof node.getBoundingClientRect === "function") {
        map.set(node, node.getBoundingClientRect());
      }
    });
    return map;
  }
  function applyFlip(oldPositions, moveClass = "h-move") {
    if (!oldPositions || oldPositions.size === 0)
      return;
    const movedNodes = [];
    oldPositions.forEach((oldRect, node) => {
      if (!node.parentNode || typeof node.getBoundingClientRect !== "function")
        return;
      const newRect = node.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx !== 0 || dy !== 0) {
        cancelFlip(node);
        movedNodes.push({ node, dx, dy });
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        node.style.transitionDuration = "0s";
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
  function findNode(selector, root2 = document) {
    if (typeof selector !== "string")
      return null;
    return root2.querySelector(selector);
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
  function initHtmxIntegration(Helix) {
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
      if (Helix && Helix.$apps) {
        for (const appEntry of Helix.$apps.values()) {
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

  // scripts/.temp-bundle-entry-1787547138345.js
  var root = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : {};
  if (!root.Helix) {
    root.Helix = globalAPI;
  }
  var installed = [];
  if (globalAPI && typeof globalAPI.use === "function") {
  }
  globalAPI.__bundledPlugins = installed;
  globalAPI.__isUnifiedBundle = true;
  var temp_bundle_entry_1787547138345_default = globalAPI;
  return __toCommonJS(temp_bundle_entry_1787547138345_exports);
})();
if (typeof window !== "undefined" && window.HelixBundle && window.HelixBundle.default) { window.Helix = window.HelixBundle.default; }
