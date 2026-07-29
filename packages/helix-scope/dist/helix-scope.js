(function(exports) {
  "use strict";
  function getPrefix() {
    if (typeof window !== "undefined" && window.Helix && window.Helix.config && window.Helix.config.prefix) {
      return window.Helix.config.prefix;
    }
    if (typeof globalThis !== "undefined" && globalThis.Helix && globalThis.Helix.config && globalThis.Helix.config.prefix) {
      return globalThis.Helix.config.prefix;
    }
    return "hx-";
  }
  function compile(expression) {
    const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
    if (Helix && typeof Helix.compile === "function") {
      return Helix.compile(expression);
    }
    return new Function(
      "$ctx",
      `with($ctx){ return (${expression}); }`
    );
  }
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
      const evaluator = compile(trimmed);
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
  const RESERVED_KEYS = /* @__PURE__ */ new Set([
    "$loading",
    "$error",
    "$data",
    "refresh"
  ]);
  function isPlainObject(val) {
    return val && typeof val === "object" && !Array.isArray(val);
  }
  function mergeValues(target, source, seen = /* @__PURE__ */ new WeakMap()) {
    var _a;
    const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
    const config = ((_a = Helix == null ? void 0 : Helix.scope) == null ? void 0 : _a.config) || {};
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
  function mergeWithDefaults(defaults, source) {
    var _a;
    const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
    const config = ((_a = Helix == null ? void 0 : Helix.scope) == null ? void 0 : _a.config) || {};
    const deepMerge = config.deepMerge ?? false;
    if (!defaults)
      return source;
    if (!source)
      return defaults;
    if (!deepMerge) {
      const result = { ...source };
      for (const key of Object.keys(defaults)) {
        if (result[key] === void 0) {
          result[key] = defaults[key];
        }
      }
      return result;
    }
    return mergeValues(defaults, source);
  }
  class ControllerRegistry {
    constructor() {
      this.registry = /* @__PURE__ */ new Map();
    }
    register(name, controller) {
      if (!this.registry.has(name)) {
        this.registry.set(name, /* @__PURE__ */ new Set());
      }
      this.registry.get(name).add(controller);
    }
    unregister(name, controller) {
      const controllers = this.registry.get(name);
      if (controllers) {
        controllers.delete(controller);
        if (controllers.size === 0) {
          this.registry.delete(name);
        }
      }
    }
    get(name) {
      return this.registry.get(name);
    }
    has(name) {
      return this.registry.has(name);
    }
    keys() {
      return this.registry.keys();
    }
    values() {
      return this.registry.values();
    }
    clear() {
      this.registry.clear();
    }
  }
  const coreRegistry = new ControllerRegistry();
  const registry = coreRegistry.registry;
  function registerController(name, controller) {
    coreRegistry.register(name, controller);
  }
  function unregisterController(name, controller) {
    coreRegistry.unregister(name, controller);
  }
  let EventEmitter$1 = class EventEmitter {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
    }
    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
      }
      this.listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }
    off(event, handler) {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    }
    emit(event, data) {
      const set = this.listeners.get(event);
      if (set) {
        for (const handler of Array.from(set)) {
          try {
            handler(data);
          } catch (err) {
            console.error(`❌ [Helix 📢] Error in listener for event "${event}":`, err);
          }
        }
      }
    }
  };
  const EventEmitterInstance = new EventEmitter$1();
  const EventEmitter = {
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
  class ScopeController {
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
      const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
      const reactive = Helix && typeof Helix.reactive === "function" ? Helix.reactive.bind(Helix) : (obj) => obj;
      this.state = reactive({
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
        this.evaluator = compile(this.expression);
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
      var _a;
      const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
      const config = ((_a = Helix == null ? void 0 : Helix.scope) == null ? void 0 : _a.config) || {};
      const useBackoff = this.backoff ?? config.backoff ?? true;
      const baseDelay = this.retryDelay ?? config.retryDelay ?? 1e3;
      if (useBackoff) {
        return baseDelay * Math.pow(2, attempt - 1);
      }
      return baseDelay;
    }
    async refresh(options = {}) {
      var _a;
      if (this.destroyed)
        return;
      const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
      const config = ((_a = Helix == null ? void 0 : Helix.scope) == null ? void 0 : _a.config) || {};
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
  }
  function onComponentMount(instance, callback) {
    let root2 = instance;
    while (root2 && root2.parent) {
      root2 = root2.parent;
    }
    if (root2 && root2.hooks && Array.isArray(root2.hooks.mount)) {
      root2.hooks.mount.push(callback);
    } else {
      callback();
    }
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
          const defaultsRaw = parseAttribute(el, defaultsAttr);
          const parsedDefaults = parseDefaults(defaultsRaw);
          const retryAttr = `${prefix}scope-retry:${sName}`;
          const retryFallbackAttr = `${prefix}scope-retry`;
          const retryRaw = el.getAttribute(retryAttr) || el.getAttribute(retryFallbackAttr);
          cleanAttributes(el, [retryAttr]);
          const retryLimit = retryRaw ? parseInt(retryRaw, 10) : 0;
          const delayAttr = `${prefix}scope-retry-delay:${sName}`;
          const delayFallbackAttr = `${prefix}scope-retry-delay`;
          const delayRaw = el.getAttribute(delayAttr) || el.getAttribute(delayFallbackAttr);
          cleanAttributes(el, [delayAttr]);
          const retryDelay = delayRaw ? parseInt(delayRaw, 10) : 1e3;
          const backoffAttr = `${prefix}scope-backoff:${sName}`;
          const backoffFallbackAttr = `${prefix}scope-backoff`;
          const backoffRaw = el.getAttribute(backoffAttr) || el.getAttribute(backoffFallbackAttr);
          cleanAttributes(el, [backoffAttr]);
          const backoff = backoffRaw !== "false";
          const pollAttr = `${prefix}scope-poll:${sName}`;
          const pollFallbackAttr = `${prefix}scope-poll`;
          const pollRaw = el.getAttribute(pollAttr) || el.getAttribute(pollFallbackAttr);
          cleanAttributes(el, [pollAttr]);
          const pollInterval = pollRaw ? parseInt(pollRaw, 10) : 0;
          const timeoutAttr = `${prefix}scope-timeout:${sName}`;
          const timeoutFallbackAttr = `${prefix}scope-timeout`;
          const timeoutRaw = el.getAttribute(timeoutAttr) || el.getAttribute(timeoutFallbackAttr);
          cleanAttributes(el, [timeoutAttr]);
          const timeoutLimit = timeoutRaw ? parseInt(timeoutRaw, 10) : 0;
          const cacheAttr = `${prefix}scope-cache:${sName}`;
          const cacheFallbackAttr = `${prefix}scope-cache`;
          const cacheRaw = el.getAttribute(cacheAttr) || el.getAttribute(cacheFallbackAttr);
          cleanAttributes(el, [cacheAttr]);
          const cacheDuration = cacheRaw ? parseInt(cacheRaw, 10) : 0;
          const resetAttr = `${prefix}scope-reset:${sName}`;
          const resetFallbackAttr = `${prefix}scope-reset`;
          const resetRaw = el.getAttribute(resetAttr) || el.getAttribute(resetFallbackAttr);
          cleanAttributes(el, [resetAttr]);
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
        cleanAttributes(el, [
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
  const ScopeManagerBase = function(name) {
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
    const root2 = typeof window !== "undefined" ? window : globalThis;
    if (root2.Helix) {
      if (root2.Helix.scope)
        delete root2.Helix.scope;
      if (root2.Helix.$scope)
        delete root2.Helix.$scope;
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
  const ScopeManager = new Proxy(ScopeManagerBase, {
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
  const HelixScopePlugin = {
    name: "scope",
    version: "2.0.2",
    install(app, options = {}) {
      app.directive("scope", createScopeDirective(app));
      const root2 = typeof window !== "undefined" ? window : globalThis;
      if (root2.Helix) {
        if (Object.isExtensible(root2.Helix)) {
          root2.Helix.scope = ScopeManager;
          root2.Helix.$scope = ScopeManager;
        }
      }
      if (Object.isExtensible(app)) {
        app.$scope = ScopeManager;
      }
    }
  };
  HelixScopePlugin.ScopeManager = ScopeManager;
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.Helix) {
    if (typeof root.Helix.directive === "function") {
      root.Helix.directive("scope", createScopeDirective(root.Helix));
    }
    if (Object.isExtensible(root.Helix)) {
      root.Helix.scope = ScopeManager;
      root.Helix.$scope = ScopeManager;
    }
  } else if (typeof console !== "undefined") {
    console.warn("[helix-scope] Helix not found - load helix.js before this script.");
  }
  exports.default = HelixScopePlugin;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixScopePlugin = this.HelixScopePlugin || {});
