(function(exports) {
  "use strict";
  const INSTALL_MARK = Symbol.for("helix.validate.installed");
  const emailRx = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  let activeContext = null;
  function setActiveContext(ctx) {
    activeContext = ctx;
  }
  const appContexts = /* @__PURE__ */ new WeakMap();
  function getCurrentContext() {
    if (typeof window !== "undefined" && window.Helix && typeof window.Helix.getCurrentInstance === "function") {
      const inst = window.Helix.getCurrentInstance();
      if (inst && inst.provides && inst.provides["$validation"]) {
        return inst.provides["$validation"]._context;
      }
    }
    return activeContext;
  }
  function getContextFromBinding(binding) {
    if (binding && binding.instance && binding.instance.provides && binding.instance.provides["$validation"]) {
      return binding.instance.provides["$validation"]._context;
    }
    return getCurrentContext();
  }
  const getDefaultConfig = (options = {}) => ({
    trigger: options.trigger ?? "blur",
    mode: options.mode ?? null,
    beforeRule: options.beforeRule ?? null,
    afterRule: options.afterRule ?? null,
    debounce: options.debounce ?? 300,
    priorityEnabled: options.priorityEnabled ?? true,
    validateOnMount: options.validateOnMount ?? false,
    showAllErrors: options.showAllErrors ?? false,
    minChars: options.minChars ?? 0,
    focusFirstInvalid: options.focusFirstInvalid ?? false,
    ui: options.ui ?? "custom",
    classes: Object.assign(
      {},
      options.classes || {}
    ),
    messages: Object.assign({}, options.messages || {}),
    remote: Object.assign(
      { method: "GET", param: "value", headers: {}, cache: false, ttl: 5e3 },
      options.remote || {}
    )
  });
  const MSGS = {
    required: () => "This field is required.",
    email: () => "Enter a valid email address.",
    url: () => "Enter a valid URL.",
    numeric: () => "Must be a number.",
    integer: () => "Must be a whole number.",
    minLength: ({ p }) => `Must be at least ${p.min} characters.`,
    maxLength: ({ p }) => `Must be at most ${p.max} characters.`,
    min: ({ p }) => `Must be at least ${p.min}.`,
    max: ({ p }) => `Must be at most ${p.max}.`,
    between: ({ p }) => `Must be between ${p.min} and ${p.max}.`,
    pattern: () => "Invalid format.",
    sameAs: ({ p }) => `Must match ${p.label || "the other field"}.`,
    equalto: ({ p }) => `Must match ${p.label || "the other field"}.`,
    equalTo: ({ p }) => `Must match ${p.label || "the other field"}.`,
    oneOf: ({ p }) => `Must be one of: ${(p.values || []).join(", ")}.`
  };
  const parseCache = /* @__PURE__ */ new Map();
  function parseStringToStruct(str) {
    if (parseCache.has(str)) {
      const val = parseCache.get(str);
      parseCache.delete(str);
      parseCache.set(str, val);
      return val;
    }
    const rules2 = [];
    let currentRule = "";
    let depth = 0;
    let inQuote = null;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === "\\") {
        currentRule += str[++i] || "";
        continue;
      }
      if (inQuote) {
        if (char === inQuote)
          inQuote = null;
        currentRule += char;
        continue;
      }
      if (char === "'" || char === '"') {
        inQuote = char;
        currentRule += char;
        continue;
      }
      if (char === "(" || char === "[" || char === "{")
        depth++;
      if (char === ")" || char === "]" || char === "}")
        depth--;
      if (char === "|" && depth === 0) {
        rules2.push(currentRule.trim());
        currentRule = "";
      } else {
        currentRule += char;
      }
    }
    if (currentRule)
      rules2.push(currentRule.trim());
    const struct = rules2.reduce((acc, ruleStr) => {
      let name = ruleStr.trim();
      if (!name)
        return acc;
      const parenIdx = name.indexOf("(");
      const colonIdx = name.indexOf(":");
      let argPart = "";
      if (parenIdx !== -1 && name.endsWith(")")) {
        argPart = name.slice(parenIdx + 1, -1);
        name = name.slice(0, parenIdx).trim();
      } else if (colonIdx !== -1) {
        argPart = name.slice(colonIdx + 1);
        name = name.slice(0, colonIdx).trim();
      } else {
        return acc.concat({ name, args: [] });
      }
      const args = [];
      let currentArg = "";
      let argDepth = 0;
      let argQuote = null;
      for (let j = 0; j < argPart.length; j++) {
        const c = argPart[j];
        if (c === "\\") {
          currentArg += argPart[++j] || "";
          continue;
        }
        if (argQuote) {
          if (c === argQuote)
            argQuote = null;
          currentArg += c;
          continue;
        }
        if (c === "'" || c === '"') {
          argQuote = c;
          currentArg += c;
          continue;
        }
        if (c === "(" || c === "[" || c === "{")
          argDepth++;
        if (c === ")" || c === "]" || c === "}")
          argDepth--;
        if (c === "," && argDepth === 0) {
          args.push(currentArg.trim());
          currentArg = "";
        } else {
          currentArg += c;
        }
      }
      if (currentArg)
        args.push(currentArg.trim());
      const parsedArgs = args.map((a) => {
        if (a.startsWith("'") && a.endsWith("'") || a.startsWith('"') && a.endsWith('"')) {
          return a.slice(1, -1);
        }
        return /^-?\d+(\.\d+)?$/.test(a) ? Number(a) : a;
      });
      return acc.concat({ name, args: parsedArgs });
    }, []);
    parseCache.set(str, struct);
    if (parseCache.size > 500) {
      const firstKey = parseCache.keys().next().value;
      parseCache.delete(firstKey);
    }
    return struct;
  }
  function parseRuleStr(str, registry) {
    const struct = parseStringToStruct(str);
    const reg = registry || _registry;
    return struct.reduce((acc, item) => {
      const meta = reg.get(item.name);
      if (!meta) {
        console.warn(`[Helix Validation] Unknown rule: "${item.name}"`);
        return acc;
      }
      const isFactory = !!meta.fn._isRuleFactory;
      let fn;
      if (isFactory) {
        if (item.args.length === 0 || item.args.length === 1 && item.args[0] === "") {
          console.warn(`[Helix Validation] Rule "${item.name}" expects parameters, but none were provided.`);
        }
        const produced = meta.fn(...item.args);
        if (typeof produced === "function") {
          fn = produced;
        } else {
          console.warn(`[Helix Validation] Rule "${item.name}" did not return a validator; ignoring args.`);
          fn = meta.fn;
        }
      } else {
        if (item.args.length > 0) {
          console.warn(`[Helix Validation] Rule "${item.name}" takes no arguments; ignoring them.`);
        }
        fn = meta.fn;
      }
      if (!fn.meta)
        fn.meta = {};
      if (fn.meta.priority === void 0)
        fn.meta.priority = meta.priority;
      if (!fn._priority)
        fn._priority = meta.priority;
      return acc.concat(fn);
    }, []);
  }
  function warnUnconfiguredFactory(fn) {
    var _a;
    const name = ((_a = fn.meta) == null ? void 0 : _a.name) || fn._ruleName;
    const ruleName = name ? ` "${name}"` : "";
    console.warn(`[Helix Validation] A parameterized rule${ruleName} was passed without being called (e.g. use ${name || "rule"}(3) instead of ${name || "rule"}). It was skipped.`);
    return [];
  }
  function normalizeRules(r, registry) {
    let resolved = [];
    if (!r)
      resolved = [];
    else if (typeof r === "string")
      resolved = parseRuleStr(r, registry);
    else if (typeof r === "function")
      resolved = r._isRuleFactory ? warnUnconfiguredFactory(r) : [r];
    else if (Array.isArray(r)) {
      resolved = r.reduce((acc, item) => {
        if (typeof item === "string")
          return acc.concat(parseRuleStr(item, registry));
        if (typeof item === "function")
          return item._isRuleFactory ? acc.concat(warnUnconfiguredFactory(item)) : acc.concat(item);
        return acc;
      }, []);
    }
    const seen = /* @__PURE__ */ new Set();
    return resolved.filter((fn) => {
      var _a;
      if (!fn)
        return false;
      const name = ((_a = fn.meta) == null ? void 0 : _a.name) || fn._ruleName;
      if (name && name !== "transform") {
        if (seen.has(name))
          return false;
        seen.add(name);
      }
      return true;
    });
  }
  function buildValidationContext(ctrl, runOpts = {}) {
    const config = ctrl._context.config;
    let parent = ctrl._parent;
    let root2 = ctrl;
    let pathSegments = [];
    let cur = ctrl;
    let nearestIndex = null;
    while (cur._parent) {
      const p = cur._parent;
      if (p._type === "form") {
        pathSegments.unshift(cur.name || "");
      } else if (p._type === "list") {
        const idx = p.items.value.indexOf(cur);
        if (idx > -1) {
          pathSegments.unshift(String(idx));
          if (nearestIndex === null)
            nearestIndex = idx;
        }
      }
      cur = p;
    }
    root2 = cur;
    const path = pathSegments.join(".");
    let injectedContext = {};
    const globalContext = config.context || ctrl._context.app && ctrl._context.app.config && ctrl._context.app.config.context;
    if (globalContext) {
      if (typeof globalContext === "function") {
        try {
          injectedContext = globalContext(ctrl);
        } catch (err) {
          console.error("[Helix Validation] Error evaluating context function:", err);
        }
      } else if (typeof globalContext === "object") {
        injectedContext = globalContext;
      }
    }
    if (runOpts.context) {
      injectedContext = Object.assign({}, injectedContext, runOpts.context);
    }
    return Object.assign({}, injectedContext, {
      field: ctrl._type === "field" ? ctrl : null,
      form: ctrl._parent && ctrl._parent._type === "form" ? ctrl._parent : null,
      parent,
      root: root2,
      path,
      index: nearestIndex,
      formValues: () => root2 && root2.values ? root2.values() : null,
      signal: runOpts.signal || null,
      _context: ctrl._context
    });
  }
  function runRules(ctrl, ruleFns, value, runOpts = {}) {
    const config = ctrl._context.config;
    const beforeRuleHook = ctrl.beforeRule || config.beforeRule;
    const afterRuleHook = ctrl.afterRule || config.afterRule;
    if (!ruleFns || !ruleFns.length)
      return Promise.resolve({ errors: [], tagged: [] });
    if (ctrl._runAbort) {
      try {
        ctrl._runAbort.abort();
      } catch (_) {
      }
    }
    const controller = new AbortController();
    ctrl._runAbort = controller;
    const runId = ctrl._context.uid();
    ctrl._runId = runId;
    const ctx = buildValidationContext(ctrl, Object.assign({ signal: controller.signal }, runOpts));
    const sortedRules = [...ruleFns].sort((a, b) => {
      var _a, _b;
      const pa = ((_a = a.meta) == null ? void 0 : _a.priority) !== void 0 ? a.meta.priority : a._priority != null ? a._priority : 1;
      const pb = ((_b = b.meta) == null ? void 0 : _b.priority) !== void 0 ? b.meta.priority : b._priority != null ? b._priority : 1;
      return pb - pa;
    });
    const tagged = [];
    const errors = [];
    let currentValue = value;
    let hasTransform = false;
    let finalTransformedValue = value;
    return sortedRules.reduce((chain, rule) => {
      return chain.then((stop) => {
        var _a;
        if (stop && config.priorityEnabled)
          return true;
        if (ctrl._runId !== runId)
          return true;
        const ruleName = ((_a = rule.meta) == null ? void 0 : _a.name) || rule._ruleName || "anonymous";
        let beforePromise = Promise.resolve();
        if (beforeRuleHook) {
          beforePromise = Promise.resolve(beforeRuleHook(ruleName, currentValue, ctx));
        }
        const globalBeforeMiddlewares = ctrl._context.beforeRuleMiddlewares || [];
        if (globalBeforeMiddlewares.length) {
          beforePromise = globalBeforeMiddlewares.reduce((chain2, mw) => {
            return chain2.then((override) => {
              if (override !== void 0)
                return override;
              return Promise.resolve(mw({
                ruleName,
                value: currentValue,
                control: ctrl,
                validationCtx: ctx
              }));
            });
          }, beforePromise);
        }
        return beforePromise.then((beforeOverride) => {
          if (beforeOverride !== void 0) {
            return beforeOverride;
          }
          return Promise.resolve(rule(currentValue, ctx));
        }).then((res) => {
          let afterPromise = Promise.resolve(res);
          if (afterRuleHook) {
            afterPromise = Promise.resolve(afterRuleHook(ruleName, currentValue, res, ctx)).then((afterOverride) => afterOverride !== void 0 ? afterOverride : res);
          }
          const globalAfterMiddlewares = ctrl._context.afterRuleMiddlewares || [];
          if (globalAfterMiddlewares.length) {
            afterPromise = globalAfterMiddlewares.reduce((chain2, mw) => {
              return chain2.then((override) => {
                const currentRes = override !== void 0 ? override : res;
                return Promise.resolve(mw({
                  ruleName,
                  value: currentValue,
                  result: currentRes,
                  control: ctrl,
                  validationCtx: ctx
                })).then((newOverride) => newOverride !== void 0 ? newOverride : currentRes);
              });
            }, afterPromise);
          }
          return afterPromise;
        }).then((res) => {
          var _a2;
          if (ctrl._runId !== runId)
            return true;
          if (res && typeof res === "object" && res.transform) {
            currentValue = res.value;
            finalTransformedValue = res.value;
            hasTransform = true;
            return false;
          }
          if (res !== null) {
            const isEach = !!(((_a2 = rule.meta) == null ? void 0 : _a2.each) || rule._isEach);
            if (isEach && typeof res === "object") {
              Object.entries(res).forEach(([i, msg]) => {
                const finalMsg = ctrl.message || msg;
                tagged.push({ message: finalMsg, source: "rule", rule: ruleName, index: Number(i) });
                errors.push(finalMsg);
              });
            } else if (typeof res === "string") {
              const finalMsg = ctrl.message || res;
              tagged.push({ message: finalMsg, source: "rule", rule: ruleName });
              errors.push(finalMsg);
            }
            return true;
          }
          return false;
        }).catch((err) => {
          if (err && err.name === "AbortError")
            return true;
          if (ctrl._runId !== runId)
            return true;
          console.error("[Helix Validation] Unexpected exception during rule validation:", err);
          const msg = ctrl.message || "Validation error.";
          tagged.push({ message: msg, source: "rule", rule: ruleName });
          errors.push(msg);
          return true;
        });
      });
    }, Promise.resolve(false)).then(() => {
      const stale = ctrl._runId !== runId;
      if (ctrl._runAbort === controller)
        ctrl._runAbort = null;
      if (!stale && hasTransform && ctrl.value) {
        if (!Object.is(ctrl.value.value, finalTransformedValue)) {
          ctrl.value.value = finalTransformedValue;
        }
      }
      return stale ? null : { errors, tagged };
    });
  }
  function isEmpty(v) {
    if (v === null || v === void 0)
      return true;
    if (typeof v === "string")
      return v.trim() === "";
    if (Array.isArray(v))
      return v.length === 0;
    return false;
  }
  function resolveParam(val) {
    if (typeof val === "function")
      return val();
    if (val && typeof val === "object" && "value" in val)
      return val.value;
    return val;
  }
  function mkRule(fn, name, priority, params) {
    fn.meta = {
      name,
      priority,
      params: params || {}
    };
    fn._ruleName = name;
    fn._priority = priority;
    if (params)
      fn._params = params;
    return fn;
  }
  function mkFactory(fn) {
    fn._isRuleFactory = true;
    return fn;
  }
  function resolveMsg(name, params, value, ctxOrLocalContext) {
    let localContext;
    if (ctxOrLocalContext) {
      localContext = ctxOrLocalContext._context || ctxOrLocalContext;
    } else {
      localContext = getCurrentContext();
    }
    const config = localContext.config;
    const custom = config.messages[name];
    if (custom) {
      return typeof custom === "function" ? custom({ value, params, rule: name }) : custom;
    }
    const def = MSGS[name];
    if (def)
      return typeof def === "function" ? def({ value, p: params, rule: name }) : def;
    return "Invalid value.";
  }
  const remoteCaches = /* @__PURE__ */ new WeakMap();
  function runRemote(el, url2, value, opts, localContext) {
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};
    const cacheEnabled = opts.cache ?? config.remote.cache ?? false;
    const ttl = opts.ttl ?? config.remote.ttl ?? 5e3;
    const cacheKey = opts.key ? opts.key(value) : String(value);
    if (cacheEnabled) {
      let elCache = remoteCaches.get(el);
      if (!elCache) {
        elCache = /* @__PURE__ */ new Map();
        remoteCaches.set(el, elCache);
      }
      const cached = elCache.get(cacheKey);
      if (cached && cached.timestamp + ttl > Date.now()) {
        return Promise.resolve(cached.result);
      }
    }
    if (ctx.remoteAborts.has(el))
      ctx.remoteAborts.get(el).abort();
    const ctrl = new AbortController();
    ctx.remoteAborts.set(el, ctrl);
    const method = (opts.method || config.remote.method).toUpperCase();
    const param = opts.param || config.remote.param;
    const headers = Object.assign({}, config.remote.headers, opts.headers || {});
    let fetchUrl = url2;
    let body;
    if (method === "GET") {
      fetchUrl = url2 + (url2.includes("?") ? "&" : "?") + param + "=" + encodeURIComponent(value);
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ [param]: value });
    }
    const $http = app.namespace && typeof app.namespace === "function" ? app.namespace("axios") && app.namespace("axios").$http : null;
    const req = $http && method === "GET" ? $http.get(fetchUrl, { signal: ctrl.signal, headers }) : fetch(fetchUrl, { method, headers, body, signal: ctrl.signal }).then((res) => {
      if (!res.ok)
        return { valid: false, message: opts.fallback || "Validation failed." };
      return res.json();
    });
    return req.then((json) => {
      let result;
      if (json.errors && Array.isArray(json.errors)) {
        result = { valid: false, message: json.errors[0] };
      } else {
        result = { valid: json.valid !== false, message: json.message || null };
      }
      if (cacheEnabled && result) {
        let elCache = remoteCaches.get(el);
        if (elCache) {
          elCache.set(cacheKey, { result, timestamp: Date.now() });
        }
      }
      return result;
    }).catch((err) => {
      if (err && err.name === "AbortError")
        return { aborted: true };
      return { valid: false, message: "Connection error. Please try again." };
    }).finally(() => {
      if (ctx.remoteAborts.get(el) === ctrl) {
        ctx.remoteAborts.delete(el);
      }
    });
  }
  function check(value, ruleDefs, opts2) {
    const localContext = getCurrentContext();
    const wantTagged = !!(opts2 && opts2.tagged);
    const dummy = { _runId: null, _runAbort: null, _type: "field", _parent: null, _context: localContext };
    return runRules(dummy, normalizeRules(ruleDefs, localContext._registry), value).then((r) => {
      if (dummy._runAbort) {
        try {
          dummy._runAbort.abort();
        } catch (_) {
        }
        dummy._runAbort = null;
      }
      if (!r)
        return [];
      return wantTagged ? r.tagged : r.errors;
    });
  }
  function getForm(selectorOrEl, localContext) {
    const ctx = localContext || getCurrentContext();
    const el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el)
      return null;
    let f = ctx.formContextMap.get(el) || ctx.autoForms.get(el);
    if (!f && ctx.scanForms) {
      ctx.scanForms(ctx, el, true);
      f = ctx.formContextMap.get(el) || ctx.autoForms.get(el);
    }
    return f || null;
  }
  function resolvePrefix(appOrCtx) {
    const app = appOrCtx && appOrCtx.app ? appOrCtx.app : appOrCtx;
    const rawPrefix = app && app.config && app.config.prefix || "hx-";
    return rawPrefix.replace(/-+$/, "");
  }
  function createRuleRegistry(initialMapOrParent) {
    const registry = initialMapOrParent instanceof Map ? initialMapOrParent : /* @__PURE__ */ new Map();
    const onAddListeners2 = /* @__PURE__ */ new Set();
    const onRemoveListeners2 = /* @__PURE__ */ new Set();
    return {
      _registry: registry,
      add(name, fn, meta) {
        if (fn && typeof fn === "object" && typeof fn.validate === "function") {
          const validateFn = fn.validate;
          const messageTemplate = fn.message;
          const priority = fn.priority || 1;
          const factory = (...args) => {
            const innerRule = (v, ctx) => {
              const res = validateFn(v, ...args);
              if (res === true || res === null || res === void 0)
                return null;
              if (res === false) {
                let msg = messageTemplate || "Invalid value.";
                if (args.length > 1 && !msg.includes("{1}")) {
                  msg = msg.replace(/\{0\}/g, args.join(", "));
                } else {
                  args.forEach((arg, idx) => {
                    msg = msg.replace(new RegExp(`\\{${idx}\\}`, "g"), arg);
                  });
                }
                return msg;
              }
              return res;
            };
            innerRule.meta = { name, priority, params: {} };
            innerRule._ruleName = name;
            innerRule._priority = priority;
            return innerRule;
          };
          factory._isRuleFactory = true;
          fn = factory;
        }
        if (typeof name !== "string" || typeof fn !== "function")
          return;
        if (!fn.meta)
          fn.meta = {};
        if (!fn.meta.name)
          fn.meta.name = name;
        if (!fn._ruleName)
          fn._ruleName = name;
        registry.set(name, { fn, priority: meta && meta.priority || fn.meta.priority || 1 });
        onAddListeners2.forEach((cb) => {
          try {
            cb(name, fn, meta);
          } catch (_) {
          }
        });
      },
      remove(name) {
        registry.delete(name);
        onRemoveListeners2.forEach((cb) => {
          try {
            cb(name);
          } catch (_) {
          }
        });
      },
      get(name) {
        return registry.get(name) || null;
      },
      has(name) {
        return registry.has(name);
      },
      list() {
        return Array.from(registry.keys());
      },
      onAdd(cb) {
        if (typeof cb === "function")
          onAddListeners2.add(cb);
        return () => onAddListeners2.delete(cb);
      },
      onRemove(cb) {
        if (typeof cb === "function")
          onRemoveListeners2.add(cb);
        return () => onRemoveListeners2.delete(cb);
      }
    };
  }
  function walkLeafFields(fields, cb) {
    const collect = (path, ctrl) => {
      if (ctrl.disabled && ctrl.disabled.value)
        return true;
      if (ctrl._type === "form") {
        const keys2 = Object.keys(ctrl.fields);
        for (let i = 0; i < keys2.length; i++) {
          if (!collect(path ? `${path}.${keys2[i]}` : keys2[i], ctrl.fields[keys2[i]])) {
            return false;
          }
        }
      } else if (ctrl._type === "list") {
        const items = ctrl.items.value;
        for (let i = 0; i < items.length; i++) {
          if (!collect(path ? `${path}.${i}` : String(i), items[i])) {
            return false;
          }
        }
      } else {
        return cb(path, ctrl) !== false;
      }
      return true;
    };
    const keys = Object.keys(fields);
    for (let i = 0; i < keys.length; i++) {
      if (!collect(keys[i], fields[keys[i]])) {
        break;
      }
    }
  }
  function createLookupRegistry(control, ctx) {
    return {
      get(name) {
        let cur = control;
        while (cur) {
          if (cur._localRules && cur._localRules.has(name)) {
            return cur._localRules.get(name);
          }
          cur = cur._parent;
        }
        return ctx && ctx._registry && ctx._registry.get(name) || null;
      }
    };
  }
  function parsePath(path) {
    if (path == null)
      return [];
    return String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
  }
  function resolvePath(rootControl, path) {
    const parts = parsePath(path);
    let cur = rootControl;
    for (let i = 0; i < parts.length; i++) {
      if (!cur)
        return null;
      if (cur._type === "form")
        cur = cur.fields[parts[i]];
      else if (cur._type === "list")
        cur = cur.items.value[Number(parts[i])];
      else
        return null;
    }
    return cur || null;
  }
  function runMiddleware(hooks, ...args) {
    if (!hooks || !hooks.length)
      return Promise.resolve();
    return hooks.reduce((chain, fn) => {
      return chain.then(() => Promise.resolve(fn(...args)));
    }, Promise.resolve());
  }
  const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
  }
  function getClassTarget(el, handler) {
    if (!handler)
      return el;
    if (handler === "parent")
      return el.parentElement || el;
    try {
      return document.querySelector(handler) || el;
    } catch {
      return el;
    }
  }
  const _registry = /* @__PURE__ */ new Map();
  const onAddListeners = /* @__PURE__ */ new Set();
  const onRemoveListeners = /* @__PURE__ */ new Set();
  const rules = {
    add(name, fn, meta) {
      if (fn && typeof fn === "object" && typeof fn.validate === "function") {
        const validateFn = fn.validate;
        const messageTemplate = fn.message;
        const priority = fn.priority || 1;
        const factory = (...args) => {
          const innerRule = (v, ctx) => {
            const res = validateFn(v, ...args);
            if (res === true || res === null || res === void 0)
              return null;
            if (res === false) {
              let msg = messageTemplate || "Invalid value.";
              if (args.length > 1 && !msg.includes("{1}")) {
                msg = msg.replace(/\{0\}/g, args.join(", "));
              } else {
                args.forEach((arg, idx) => {
                  msg = msg.replace(new RegExp(`\\{${idx}\\}`, "g"), arg);
                });
              }
              return msg;
            }
            return res;
          };
          innerRule.meta = { name, priority, params: {} };
          innerRule._ruleName = name;
          innerRule._priority = priority;
          return innerRule;
        };
        factory._isRuleFactory = true;
        fn = factory;
      }
      if (typeof name !== "string" || typeof fn !== "function")
        return;
      if (!fn.meta)
        fn.meta = {};
      if (!fn.meta.name)
        fn.meta.name = name;
      if (!fn._ruleName)
        fn._ruleName = name;
      _registry.set(name, { fn, priority: meta && meta.priority || fn.meta.priority || 1 });
      onAddListeners.forEach((cb) => {
        try {
          cb(name, fn, meta);
        } catch (_) {
        }
      });
    },
    remove(name) {
      _registry.delete(name);
      onRemoveListeners.forEach((cb) => {
        try {
          cb(name);
        } catch (_) {
        }
      });
    },
    get(name) {
      return _registry.get(name) || null;
    },
    has(name) {
      return _registry.has(name);
    },
    list() {
      return Array.from(_registry.keys());
    },
    onAdd(cb) {
      if (typeof cb === "function")
        onAddListeners.add(cb);
      return () => onAddListeners.delete(cb);
    },
    onRemove(cb) {
      if (typeof cb === "function")
        onRemoveListeners.add(cb);
      return () => onRemoveListeners.delete(cb);
    }
  };
  const required = mkRule(
    (v, ctx) => isEmpty(v) ? resolveMsg("required", {}, v, ctx) : null,
    "required",
    32
  );
  const email = mkRule(
    (v, ctx) => !isEmpty(v) && !emailRx.test(v) ? resolveMsg("email", {}, v, ctx) : null,
    "email",
    16
  );
  const url = mkRule(
    (v, ctx) => {
      if (isEmpty(v))
        return null;
      let str = String(v);
      if (!/^[a-zA-Z]+:\/\//.test(str)) {
        str = "http://" + str;
      }
      try {
        const parsed = new URL(str);
        const hostname = parsed.hostname;
        const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
        const hasTld = hostname.includes(".") && hostname.split(".").pop().length >= 2;
        if (!isLocal && !hasTld)
          return resolveMsg("url", {}, v, ctx);
        return null;
      } catch {
        return resolveMsg("url", {}, v, ctx);
      }
    },
    "url",
    16
  );
  const pattern = mkFactory((regex, msg) => {
    return mkRule(
      (v, ctx) => {
        if (isEmpty(v))
          return null;
        const resolvedRegex = resolveParam(regex);
        let rx;
        try {
          rx = typeof resolvedRegex === "string" ? new RegExp(resolvedRegex) : resolvedRegex;
        } catch (e) {
          console.error("[Helix Validation] pattern: Invalid regex pattern:", resolvedRegex, e);
          return "Invalid pattern configuration.";
        }
        return !rx.test(v) ? msg || resolveMsg("pattern", { pattern: resolvedRegex }, v, ctx) : null;
      },
      "pattern",
      16,
      { pattern: regex }
    );
  });
  const trim = mkRule(
    (v, ctx) => {
      const val = typeof v === "string" ? v.trim() : v;
      return { transform: true, value: val };
    },
    "trim",
    100
  );
  const lowercase = mkRule(
    (v, ctx) => {
      const val = typeof v === "string" ? v.toLowerCase() : v;
      return { transform: true, value: val };
    },
    "lowercase",
    100
  );
  rules.add("required", required);
  rules.add("email", email);
  rules.add("url", url);
  rules.add("pattern", pattern);
  rules.add("trim", trim);
  rules.add("lowercase", lowercase);
  const numeric = mkRule(
    (v, ctx) => !isEmpty(v) && !isFinite(Number(v)) ? resolveMsg("numeric", {}, v, ctx) : null,
    "numeric",
    16
  );
  const integer = mkRule(
    (v, ctx) => !isEmpty(v) && !Number.isInteger(Number(v)) ? resolveMsg("integer", {}, v, ctx) : null,
    "integer",
    16
  );
  const minLength = mkFactory((minVal) => mkRule(
    (v, ctx) => {
      const resolved = resolveParam(minVal);
      return !isEmpty(v) && String(v).length < resolved ? resolveMsg("minLength", { min: resolved }, v, ctx) : null;
    },
    "minLength",
    8,
    { min: minVal }
  ));
  const maxLength = mkFactory((maxVal) => mkRule(
    (v, ctx) => {
      const resolved = resolveParam(maxVal);
      return !isEmpty(v) && String(v).length > resolved ? resolveMsg("maxLength", { max: resolved }, v, ctx) : null;
    },
    "maxLength",
    8,
    { max: maxVal }
  ));
  const min = mkFactory((mn) => mkRule(
    (v, ctx) => {
      const resolved = resolveParam(mn);
      return !isEmpty(v) && Number(v) < resolved ? resolveMsg("min", { min: resolved }, v, ctx) : null;
    },
    "min",
    8,
    { min: mn }
  ));
  const max = mkFactory((mx) => mkRule(
    (v, ctx) => {
      const resolved = resolveParam(mx);
      return !isEmpty(v) && Number(v) > resolved ? resolveMsg("max", { max: resolved }, v, ctx) : null;
    },
    "max",
    8,
    { max: mx }
  ));
  const between = mkFactory((mn, mx) => mkRule(
    (v, ctx) => {
      if (isEmpty(v))
        return null;
      const resolvedMn = resolveParam(mn);
      const resolvedMx = resolveParam(mx);
      const n = Number(v);
      return n < resolvedMn || n > resolvedMx ? resolveMsg("between", { min: resolvedMn, max: resolvedMx }, v, ctx) : null;
    },
    "between",
    8,
    { min: mn, max: mx }
  ));
  rules.add("numeric", numeric);
  rules.add("integer", integer);
  rules.add("minLength", minLength);
  rules.add("maxLength", maxLength);
  rules.add("min", min);
  rules.add("max", max);
  rules.add("between", between);
  const sameAs = mkFactory((otherRef, label) => mkRule(
    (v, ctx) => {
      let other = resolveParam(otherRef);
      if (typeof other === "string" && ctx && ctx.parent && typeof ctx.parent.field === "function") {
        const otherCtrl = ctx.parent.field(other);
        if (otherCtrl)
          other = otherCtrl.value.value;
      }
      return v !== other ? resolveMsg("sameAs", { label }, v, ctx) : null;
    },
    "sameAs",
    4,
    { label }
  ));
  const equalto = mkFactory((targetSelectorOrFn, label) => mkRule(
    (v, ctx) => {
      let otherVal = void 0;
      if (typeof targetSelectorOrFn === "function") {
        otherVal = targetSelectorOrFn();
      } else if (typeof targetSelectorOrFn === "string") {
        if (ctx && ctx.parent && typeof ctx.parent.field === "function") {
          const otherCtrl = ctx.parent.field(targetSelectorOrFn);
          if (otherCtrl) {
            otherVal = otherCtrl.value && otherCtrl.value.value !== void 0 ? otherCtrl.value.value : otherCtrl.value;
          }
        }
        if (otherVal === void 0 && typeof document !== "undefined") {
          let el = null;
          try {
            el = document.querySelector(targetSelectorOrFn);
          } catch (e) {
          }
          if (!el) {
            try {
              el = document.querySelector(`[name="${targetSelectorOrFn}"]`);
            } catch (e) {
            }
          }
          if (!el && !targetSelectorOrFn.startsWith("#") && !targetSelectorOrFn.startsWith(".")) {
            try {
              el = document.getElementById(targetSelectorOrFn);
            } catch (e) {
            }
          }
          if (el) {
            otherVal = el.value !== void 0 ? el.value : el.textContent;
          }
        }
      }
      return v !== otherVal ? resolveMsg("equalto", { label: label || targetSelectorOrFn }, v, ctx) : null;
    },
    "equalto",
    4,
    { target: targetSelectorOrFn, label }
  ));
  const oneOf = mkFactory((values) => mkRule(
    (v, ctx) => {
      const resolvedValues = resolveParam(values) || [];
      return !isEmpty(v) && !resolvedValues.includes(v) ? resolveMsg("oneOf", { values: resolvedValues }, v, ctx) : null;
    },
    "oneOf",
    4,
    { values }
  ));
  rules.add("sameAs", sameAs);
  rules.add("equalto", equalto);
  rules.add("equalTo", equalto);
  rules.add("oneOf", oneOf);
  function withMessage(message, ruleFn) {
    var _a, _b, _c, _d, _e, _f;
    const fn = (value, ctx) => {
      const result = ruleFn(value, ctx);
      const transform2 = (r) => {
        var _a2, _b2;
        if (r === null)
          return null;
        const params = ((_a2 = ruleFn.meta) == null ? void 0 : _a2.params) || ruleFn._params || {};
        const ruleName = ((_b2 = ruleFn.meta) == null ? void 0 : _b2.name) || ruleFn._ruleName;
        return typeof message === "function" ? message({ value, params, rule: ruleName }) : message;
      };
      return result && typeof result.then === "function" ? result.then(transform2) : transform2(result);
    };
    fn.meta = {
      name: ((_a = ruleFn.meta) == null ? void 0 : _a.name) || ruleFn._ruleName,
      priority: ((_b = ruleFn.meta) == null ? void 0 : _b.priority) !== void 0 ? ruleFn.meta.priority : ruleFn._priority || 1,
      params: ((_c = ruleFn.meta) == null ? void 0 : _c.params) || ruleFn._params || {},
      each: !!(((_d = ruleFn.meta) == null ? void 0 : _d.each) || ruleFn._isEach),
      async: !!(((_e = ruleFn.meta) == null ? void 0 : _e.async) || ruleFn._isAsync),
      deps: ((_f = ruleFn.meta) == null ? void 0 : _f.deps) || ruleFn._deps
    };
    fn._ruleName = fn.meta.name;
    fn._priority = fn.meta.priority;
    fn._params = fn.meta.params;
    fn._isEach = fn.meta.each;
    fn._isAsync = fn.meta.async;
    if (fn.meta.deps)
      fn._deps = fn.meta.deps;
    return fn;
  }
  function withAsync(asyncFn, optionsOrDeps) {
    var _a, _b;
    const opts = optionsOrDeps && !Array.isArray(optionsOrDeps) ? optionsOrDeps : {};
    const deps = Array.isArray(optionsOrDeps) ? optionsOrDeps : opts.deps || [];
    const cacheMap = /* @__PURE__ */ new Map();
    const fn = (value, ctx) => {
      const cacheEnabled = opts.cache;
      if (cacheEnabled) {
        const ttl = opts.ttl || 5e3;
        const cacheKey = opts.key ? opts.key(value, ctx) : String(value);
        const cached = cacheMap.get(cacheKey);
        if (cached && cached.timestamp + ttl > Date.now()) {
          return Promise.resolve(cached.result);
        }
        const signal2 = ctx && ctx.signal ? ctx.signal : void 0;
        return Promise.resolve(asyncFn(value, signal2, ctx)).then((result) => {
          cacheMap.set(cacheKey, { result, timestamp: Date.now() });
          if (cacheMap.size > 200) {
            const oldestKey = cacheMap.keys().next().value;
            cacheMap.delete(oldestKey);
          }
          return result;
        });
      }
      const signal = ctx && ctx.signal ? ctx.signal : void 0;
      return asyncFn(value, signal, ctx);
    };
    fn.meta = {
      priority: ((_a = asyncFn.meta) == null ? void 0 : _a.priority) !== void 0 ? asyncFn.meta.priority : asyncFn._priority || 0,
      async: true,
      each: !!(((_b = asyncFn.meta) == null ? void 0 : _b.each) || asyncFn._isEach),
      deps
    };
    fn._priority = fn.meta.priority;
    fn._deps = deps;
    fn._isAsync = true;
    fn._isEach = fn.meta.each;
    return fn;
  }
  function requiredIf(condition) {
    const fn = (v, ctx) => {
      const on = typeof condition === "function" ? condition() : condition && condition.value !== void 0 ? condition.value : !!condition;
      return on && isEmpty(v) ? resolveMsg("required", {}, v, ctx) : null;
    };
    fn.meta = {
      name: "requiredIf",
      priority: 32
    };
    fn._ruleName = "requiredIf";
    fn._priority = 32;
    return fn;
  }
  function requiredUnless(condition) {
    const fn = (v, ctx) => {
      const off = typeof condition === "function" ? !condition() : condition && condition.value !== void 0 ? !condition.value : !condition;
      return off && isEmpty(v) ? resolveMsg("required", {}, v, ctx) : null;
    };
    fn.meta = {
      name: "requiredUnless",
      priority: 32
    };
    fn._ruleName = "requiredUnless";
    fn._priority = 32;
    return fn;
  }
  function or(...ruleFns) {
    const fn = (v, ctx) => Promise.all(ruleFns.map((r) => Promise.resolve(r(v, ctx)))).then((results) => {
      return results.some((r) => r === null) ? null : results.find((r) => r !== null) || "Invalid value.";
    });
    const priority = ruleFns.length ? Math.min(...ruleFns.map((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.priority) !== void 0 ? r.meta.priority : r._priority || 1;
    })) : 1;
    const isAsync = ruleFns.some((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.async) || r._isAsync;
    });
    const isEach = ruleFns.some((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.each) || r._isEach;
    });
    fn.meta = {
      priority,
      async: isAsync,
      each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
  }
  function and(...ruleFns) {
    const fn = (v, ctx) => ruleFns.reduce(
      (chain, r) => chain.then((acc) => acc !== null ? acc : Promise.resolve(r(v, ctx))),
      Promise.resolve(null)
    );
    const priority = ruleFns.length ? Math.min(...ruleFns.map((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.priority) !== void 0 ? r.meta.priority : r._priority || 1;
    })) : 1;
    const isAsync = ruleFns.some((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.async) || r._isAsync;
    });
    const isEach = ruleFns.some((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.each) || r._isEach;
    });
    fn.meta = {
      priority,
      async: isAsync,
      each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
  }
  function not(ruleFn, message = "Invalid value.") {
    var _a, _b, _c;
    const fn = (v, ctx) => Promise.resolve(ruleFn(v, ctx)).then((r) => r === null ? message : null);
    const priority = ((_a = ruleFn.meta) == null ? void 0 : _a.priority) !== void 0 ? ruleFn.meta.priority : ruleFn._priority || 1;
    const isAsync = !!(((_b = ruleFn.meta) == null ? void 0 : _b.async) || ruleFn._isAsync);
    const isEach = !!(((_c = ruleFn.meta) == null ? void 0 : _c.each) || ruleFn._isEach);
    fn.meta = {
      priority,
      async: isAsync,
      each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
  }
  function each(...ruleFns) {
    const fn = (value, ctx) => {
      if (!Array.isArray(value))
        return null;
      return Promise.all(
        value.map(
          (item) => ruleFns.reduce(
            (chain, r) => chain.then((found) => found || Promise.resolve(r(item, ctx)).then((res) => res || null)),
            Promise.resolve(null)
          )
        )
      ).then((results) => {
        const errs = {};
        results.forEach((r, i) => {
          if (r !== null)
            errs[i] = r;
        });
        return Object.keys(errs).length ? errs : null;
      });
    };
    fn.meta = {
      priority: 1,
      each: true
    };
    fn._priority = 1;
    fn._isEach = true;
    return fn;
  }
  function i18n({ t, path }) {
    const resolvePath2 = path || (({ rule }) => `validation.${rule}`);
    return (ruleFn) => {
      const fn = withMessage(
        ({ value: v, params, rule }) => {
          var _a;
          return t(resolvePath2({ rule: ((_a = ruleFn.meta) == null ? void 0 : _a.name) || ruleFn._ruleName || rule, value: v, params }), params || {});
        },
        ruleFn
      );
      return fn;
    };
  }
  function transform(transformFn) {
    const fn = (v, ctx) => {
      return { transform: true, value: transformFn(v, ctx) };
    };
    fn.meta = {
      name: "transform",
      priority: 100
    };
    fn._ruleName = "transform";
    fn._priority = 100;
    return fn;
  }
  const compose = and;
  function composeAsync(...ruleFns) {
    const fn = (v, ctx) => Promise.all(
      ruleFns.map((r) => Promise.resolve(r(v, ctx)))
    ).then((results) => results.find((r) => r !== null) || null);
    const priority = ruleFns.length ? Math.min(...ruleFns.map((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.priority) !== void 0 ? r.meta.priority : r._priority || 1;
    })) : 1;
    const isEach = ruleFns.some((r) => {
      var _a;
      return ((_a = r.meta) == null ? void 0 : _a.each) || r._isEach;
    });
    fn.meta = {
      priority,
      async: true,
      each: isEach
    };
    fn._priority = priority;
    fn._isAsync = true;
    fn._isEach = isEach;
    return fn;
  }
  function composeAsyncSequential(...ruleFns) {
    var _a, _b;
    const fn = and(...ruleFns);
    fn.meta = {
      priority: ((_a = fn.meta) == null ? void 0 : _a.priority) || 1,
      async: true,
      each: ((_b = fn.meta) == null ? void 0 : _b.each) || false
    };
    fn._isAsync = true;
    fn._isEach = fn.meta.each;
    return fn;
  }
  const helpers = { withMessage, withAsync, requiredIf, requiredUnless, or, and, not, each, i18n, transform, compose, composeAsync, composeAsyncSequential };
  function createEventEmitter() {
    const listeners = [];
    const emit = (event, payload) => {
      const e = typeof event === "string" ? Object.assign({ type: event }, payload) : event;
      listeners.slice().forEach((item) => {
        if (item && item.event === e.type) {
          try {
            item.cb(e);
          } catch (err) {
            console.error("[Helix Validation] Error in event listener:", err);
          }
        }
      });
    };
    const on = (event, cb) => {
      const exists = listeners.some((item2) => item2 && item2.event === event && item2.cb === cb);
      if (exists) {
        return () => {
          const i = listeners.findIndex((item2) => item2 && item2.event === event && item2.cb === cb);
          if (i > -1)
            listeners.splice(i, 1);
        };
      }
      const item = { event, cb };
      listeners.push(item);
      return () => {
        const i = listeners.indexOf(item);
        if (i > -1)
          listeners.splice(i, 1);
      };
    };
    return { listeners, emit, on };
  }
  const STATUS = {
    VALID: "VALID",
    INVALID: "INVALID",
    PENDING: "PENDING",
    DISABLED: "DISABLED"
  };
  const EVENTS = {
    VALIDATED: "validated",
    STATUS: "status",
    SUBMIT: "submit",
    SUBMITTED: "submitted",
    SUBMITTING: "submitting",
    INVALID: "invalid",
    ERROR: "error",
    RESET: "reset",
    CHANGE: "change",
    DIRTY: "dirty",
    TOUCH: "touch",
    BEFORE_VALIDATE: "beforeValidate",
    AFTER_VALIDATE: "afterValidate",
    BEFORE_SUBMIT: "beforeSubmit",
    AFTER_SUBMIT: "afterSubmit"
  };
  function field(initialValue, ruleDefs, opts, localContext) {
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};
    let _f = null;
    const _id = ctx.uid();
    const value = app.isRef(initialValue) ? initialValue : app.ref(initialValue !== void 0 ? initialValue : "");
    const dirty = app.ref(false);
    const touched = app.ref(false);
    const pending = app.ref(false);
    const disabled = app.ref(false);
    const _ruleErrors = app.ref([]);
    const _remoteErrors = app.ref([]);
    const _serverErrors = app.ref([]);
    const _crossErrors = app.ref([]);
    const _tagged = app.computed(() => [
      ..._ruleErrors.value,
      ..._remoteErrors.value,
      ..._serverErrors.value,
      ..._crossErrors.value
    ]);
    const errors = app.computed(() => {
      const msgs = _tagged.value.map((t) => t.message);
      const currentMode = _f && _f.mode || opts.mode || config.mode;
      if (currentMode === "firstError") {
        return msgs.slice(0, 1);
      }
      if (currentMode === "allErrors") {
        return msgs;
      }
      return config.showAllErrors ? msgs : msgs.slice(0, 1);
    });
    const valid = app.computed(() => errors.value.length === 0 && !pending.value);
    const invalid = app.computed(() => !valid.value);
    const pristine = app.computed(() => !dirty.value);
    const error = app.computed(() => errors.value[0] || null);
    const firstError = error;
    const hasError = invalid;
    const errorCount = app.computed(() => errors.value.length);
    const isValidating = pending;
    const enabled = app.computed(() => !disabled.value);
    const status = app.computed(() => {
      if (disabled.value)
        return STATUS.DISABLED;
      if (pending.value)
        return STATUS.PENDING;
      if (errors.value.length > 0)
        return STATUS.INVALID;
      return STATUS.VALID;
    });
    const $errors = app.computed(() => dirty.value || touched.value ? errors.value : []);
    const $valid = app.computed(() => errors.value.length === 0);
    const emitter = createEventEmitter();
    const _stoppers = [];
    if (opts.onBeforeValidate)
      emitter.on("beforeValidate", opts.onBeforeValidate);
    if (opts.onAfterValidate)
      emitter.on("afterValidate", opts.onAfterValidate);
    if (opts.onBeforeRemote)
      emitter.on("beforeRemote", opts.onBeforeRemote);
    if (opts.onAfterRemote)
      emitter.on("afterRemote", opts.onAfterRemote);
    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];
    if (opts.beforeValidation)
      _beforeValidation.push(opts.beforeValidation);
    if (opts.afterValidation)
      _afterValidation.push(opts.afterValidation);
    if (opts.onSuccess)
      _onSuccess.push(opts.onSuccess);
    if (opts.onFailure)
      _onFailure.push(opts.onFailure);
    const stopDirty = app.watch(value, () => {
      if (!dirty.value) {
        dirty.value = true;
        emitter.emit({ type: EVENTS.DIRTY });
      }
      emitter.emit({ type: EVENTS.CHANGE, value: value.value });
    }, { immediate: false });
    _stoppers.push(stopDirty);
    if (opts.autoDirty) {
      const stopAuto = app.watch(value, () => {
        dirty.value = true;
      }, { immediate: false });
      _stoppers.push(stopAuto);
    }
    const set = (val, opts2) => {
      value.value = val;
      if (!(opts2 && opts2.silent) && _f._parent && _f._parent._childChanged) {
        _f._parent._childChanged();
      }
    };
    const reset = (val) => {
      value.value = val !== void 0 ? val : initialValue;
      _ruleErrors.value = [];
      _remoteErrors.value = [];
      _serverErrors.value = [];
      _crossErrors.value = [];
      dirty.value = false;
      touched.value = false;
      pending.value = false;
      if (_f._serverWatcherStop) {
        _f._serverWatcherStop();
        _f._serverWatcherStop = null;
      }
      emitter.emit({ type: "reset" });
    };
    const touch = (opts2) => {
      touched.value = true;
      emitter.emit({ type: "touch" });
      if (!(opts2 && opts2.self) && _f._parent && _f._parent.touch)
        _f._parent.touch({ self: true });
    };
    const untouch = () => {
      touched.value = false;
    };
    const markDirty = () => {
      dirty.value = true;
      emitter.emit({ type: "dirty" });
    };
    const markPristine = () => {
      dirty.value = false;
    };
    const enable = () => {
      disabled.value = false;
    };
    const disable = () => {
      disabled.value = true;
    };
    const setErrors = (msgs) => {
      const arr = Array.isArray(msgs) ? msgs : msgs ? [msgs] : [];
      _serverErrors.value = arr.map((m) => ({ message: m, source: "server", rule: null }));
      emitter.emit({ type: "error" });
    };
    const clearErrors = () => {
      _ruleErrors.value = [];
      _remoteErrors.value = [];
      _serverErrors.value = [];
      _crossErrors.value = [];
    };
    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;
    let _ruleDefs = Array.isArray(ruleDefs) ? ruleDefs.slice() : ruleDefs ? [ruleDefs] : [];
    let _resolvedRulesCached = null;
    const getResolvedRules = () => {
      if (!_resolvedRulesCached) {
        _resolvedRulesCached = normalizeRules(_ruleDefs, createLookupRegistry(_f, ctx));
      }
      return _resolvedRulesCached;
    };
    const setRules = (r) => {
      _ruleDefs = Array.isArray(r) ? r.slice() : r ? [r] : [];
      _resolvedRulesCached = null;
    };
    const addRule = (r) => {
      if (Array.isArray(r)) {
        _ruleDefs = _ruleDefs.concat(r);
      } else if (r) {
        _ruleDefs.push(r);
      }
      _resolvedRulesCached = null;
    };
    const removeRule = (r) => {
      _ruleDefs = _ruleDefs.filter((item) => {
        var _a;
        if (typeof r === "string") {
          if (typeof item === "string") {
            const itemClean = item.split("|").map((s) => s.split(":")[0].trim()).join("");
            return itemClean !== r;
          }
          const name = ((_a = item.meta) == null ? void 0 : _a.name) || item._ruleName;
          return name !== r;
        }
        return item !== r;
      });
      _resolvedRulesCached = null;
    };
    const hasRule = (r) => getResolvedRules().some((fn) => {
      var _a;
      return typeof r === "string" ? ((_a = fn.meta) == null ? void 0 : _a.name) === r || fn._ruleName === r : fn === r;
    });
    const setValidators = setRules;
    const clearValidators = () => setRules([]);
    const getRules = () => {
      return getResolvedRules().map((fn) => {
        var _a, _b, _c;
        return {
          name: ((_a = fn.meta) == null ? void 0 : _a.name) || fn._ruleName || "anonymous",
          priority: ((_b = fn.meta) == null ? void 0 : _b.priority) !== void 0 ? fn.meta.priority : fn._priority || 1,
          params: ((_c = fn.meta) == null ? void 0 : _c.params) || fn._params || {}
        };
      });
    };
    const validate = (opts2) => {
      opts2 = opts2 || {};
      const isSilent = opts2.silent;
      if (disabled.value)
        return Promise.resolve(true);
      if (opts.lazy && !touched.value && !dirty.value && !isSilent)
        return Promise.resolve(true);
      if (!isSilent)
        emitter.emit(EVENTS.BEFORE_VALIDATE);
      pending.value = true;
      const validationCtx = buildValidationContext(_f, Object.assign({ signal: _f._runAbort ? _f._runAbort.signal : void 0 }, opts2));
      const initialVal = value.value;
      return runMiddleware(_beforeValidation, initialVal, validationCtx).then(() => {
        return runRules(_f, getResolvedRules(), value.value, opts2);
      }).then((result) => {
        if (result === null) {
          return !invalid.value;
        }
        const isValid = result.tagged.length === 0;
        if (!isSilent) {
          _ruleErrors.value = result.tagged;
          emitter.emit({ type: EVENTS.VALIDATED, valid: isValid });
          emitter.emit(EVENTS.AFTER_VALIDATE, { valid: isValid, errors: errors.value });
        }
        const finalErrors = isSilent ? [] : errors.value;
        return runMiddleware(_afterValidation, isValid, finalErrors, validationCtx).then(() => {
          if (isValid) {
            return runMiddleware(_onSuccess, value.value, validationCtx).then(() => true);
          } else {
            return runMiddleware(_onFailure, finalErrors, validationCtx).then(() => false);
          }
        });
      }).finally(() => {
        pending.value = false;
      });
    };
    const _destroy = () => {
      if (_f._serverWatcherStop) {
        _f._serverWatcherStop();
        _f._serverWatcherStop = null;
      }
      if (_f._depWatcherStop) {
        _f._depWatcherStop();
        _f._depWatcherStop = null;
      }
      if (_f._runAbort) {
        try {
          _f._runAbort.abort();
        } catch (_) {
        }
        _f._runAbort = null;
      }
      _stoppers.forEach((s) => s && s());
      _stoppers.length = 0;
      emitter.listeners.length = 0;
    };
    const addGroup = (groupName) => {
      if (!_f._group) {
        _f._group = [groupName];
      } else if (Array.isArray(_f._group)) {
        if (!_f._group.includes(groupName))
          _f._group.push(groupName);
      } else {
        if (_f._group !== groupName)
          _f._group = [_f._group, groupName];
      }
    };
    const removeGroup = (groupName) => {
      if (!_f._group)
        return;
      if (Array.isArray(_f._group)) {
        _f._group = _f._group.filter((g) => g !== groupName);
        if (_f._group.length === 0)
          _f._group = null;
      } else {
        if (_f._group === groupName)
          _f._group = null;
      }
    };
    const hasGroup = (groupName) => {
      if (!_f._group)
        return false;
      if (Array.isArray(_f._group))
        return _f._group.includes(groupName);
      return _f._group === groupName;
    };
    const stopStatusWatch = app.watch(status, (newStatus) => {
      emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });
    _stoppers.push(stopStatusWatch);
    _f = {
      _id,
      _type: "field",
      _parent: null,
      _context: ctx,
      _runId: null,
      _runAbort: null,
      _serverWatcherStop: null,
      _depWatcherStop: null,
      _emit: emitter.emit,
      _ruleErrors,
      _remoteErrors,
      _serverErrors,
      _crossErrors,
      _tagged,
      _autoDirty: opts.autoDirty || false,
      _lazy: opts.lazy || false,
      _group: opts.group || null,
      _dependsOn: Array.isArray(opts.dependsOn) ? opts.dependsOn : opts.dependsOn ? [opts.dependsOn] : [],
      get _rules() {
        return getResolvedRules();
      },
      rules: localRules,
      _localRules,
      name: opts.name || null,
      updateOn: opts.updateOn || opts.trigger || config.trigger,
      mode: opts.mode || null,
      beforeRule: opts.beforeRule || null,
      afterRule: opts.afterRule || null,
      message: opts.message || null,
      value,
      errors,
      dirty,
      touched,
      pending,
      disabled,
      valid,
      invalid,
      pristine,
      enabled,
      status,
      $errors,
      $valid,
      error,
      firstError,
      hasError,
      errorCount,
      isValidating,
      on: emitter.on,
      set,
      reset,
      touch,
      untouch,
      enable,
      disable,
      setErrors,
      clearErrors,
      setRules,
      addRule,
      removeRule,
      hasRule,
      setValidators,
      clearValidators,
      markDirty,
      markPristine,
      addGroup,
      removeGroup,
      hasGroup,
      getRules,
      validate,
      _destroy,
      pipe(rule) {
        addRule(rule);
        return _f;
      },
      beforeValidation(fn) {
        if (typeof fn === "function" && !_beforeValidation.includes(fn))
          _beforeValidation.push(fn);
        return _f;
      },
      afterValidation(fn) {
        if (typeof fn === "function" && !_afterValidation.includes(fn))
          _afterValidation.push(fn);
        return _f;
      },
      onSuccess(fn) {
        if (typeof fn === "function" && !_onSuccess.includes(fn))
          _onSuccess.push(fn);
        return _f;
      },
      onFailure(fn) {
        if (typeof fn === "function" && !_onFailure.includes(fn))
          _onFailure.push(fn);
        return _f;
      }
    };
    return _f;
  }
  const uiDrivers = /* @__PURE__ */ new Map();
  function registerUI(name, driver) {
    uiDrivers.set(name, driver);
  }
  function resolveClasses(driverOrName, config) {
    const driver = typeof driverOrName === "string" ? uiDrivers.get(driverOrName) || uiDrivers.get("custom") : driverOrName || uiDrivers.get("custom");
    const driverClasses = driver.classes || {};
    const globalClasses = config.classes || {};
    const uiClasses = config.ui && config.ui.classes || {};
    return Object.assign({}, driverClasses, globalClasses, uiClasses);
  }
  function getActiveUIDriver(ctx) {
    const config = ctx.config;
    const ui = config.ui || "custom";
    const driverName = typeof ui === "string" ? ui : ui.driver || "custom";
    return uiDrivers.get(driverName) || uiDrivers.get("custom");
  }
  function setContainerHtml(container, html) {
    if (container.__hxLastContent === html)
      return;
    container.innerHTML = html;
    container.__hxLastContent = html;
  }
  function ensureErrSpan(el, fid, className) {
    const id = `hx-err-${fid}`;
    const next = el.nextElementSibling;
    if (next && next.id === id) {
      if (className)
        next.className = className;
      return next;
    }
    const span = document.createElement("span");
    span.id = id;
    span.className = className || "hx-error-msg";
    span.setAttribute("role", "alert");
    span.setAttribute("aria-live", "polite");
    el.insertAdjacentElement("afterend", span);
    return span;
  }
  function getOrCreateBootstrapFeedback(el, fid, feedbackType, clsName) {
    const id = `hx-err-${fid}`;
    let sibling = el.nextElementSibling;
    while (sibling) {
      if (sibling.id === id || sibling.classList.contains(clsName)) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
    }
    const div = document.createElement("div");
    div.id = id;
    div.className = clsName;
    el.insertAdjacentElement("afterend", div);
    return div;
  }
  const customDriver = {
    classes: {
      valid: "hx-valid",
      invalid: "hx-invalid",
      pending: "hx-validating",
      feedback: "hx-error-msg",
      form: "hx-form-validated"
    },
    renderField(el, ctrl, fid, dOpts, ctx) {
      const config = ctx.config;
      const target = getClassTarget(el, dOpts.classHandler);
      const cls = resolveClasses(this, config);
      const container = dOpts.errTarget && document.querySelector(dOpts.errTarget) || ensureErrSpan(el, fid, cls.feedback);
      const renderCtx = { el, control: ctrl, fieldId: fid, displayOptions: dOpts, localContext: ctx };
      const globalBeforeRender = ctx.beforeRenderMiddlewares || [];
      globalBeforeRender.forEach((mw) => {
        try {
          mw(renderCtx);
        } catch (err) {
          console.error("[Helix Validation] beforeRender middleware error:", err);
        }
      });
      const triggerAfterRender = () => {
        const globalAfterRender = ctx.afterRenderMiddlewares || [];
        globalAfterRender.forEach((mw) => {
          try {
            mw(renderCtx);
          } catch (err) {
            console.error("[Helix Validation] afterRender middleware error:", err);
          }
        });
      };
      const currentMode = ctrl.mode || config.mode;
      if (currentMode === "silent") {
        target.classList.remove(cls.valid, cls.invalid, cls.pending);
        setContainerHtml(container, "");
        triggerAfterRender();
        return;
      }
      const prefix = resolvePrefix(ctx);
      if (ctrl.pending.value) {
        target.classList.remove(cls.valid, cls.invalid);
        target.classList.add(cls.pending);
        el.setAttribute("aria-invalid", "false");
        el.removeAttribute("aria-describedby");
        el.setAttribute(`data-${prefix}-pending`, "");
        setContainerHtml(container, dOpts.pendingText ? `<span class="hx-err hx-err--pending">${escapeHtml(dOpts.pendingText)}</span>` : "");
        triggerAfterRender();
        return;
      }
      el.removeAttribute(`data-${prefix}-pending`);
      const showErrs = ctrl.$errors.value.length > 0;
      const isClean = ctrl.errors.value.length === 0;
      target.classList.remove(cls.valid, cls.invalid, cls.pending);
      if (showErrs) {
        target.classList.add(cls.invalid);
        el.setAttribute("aria-invalid", "true");
        el.setAttribute("aria-describedby", `hx-err-${fid}`);
        const tagged = ctrl._tagged.value.filter((t) => t && t.message);
        const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
        setContainerHtml(container, toShow.map((t) => `<span class="hx-err hx-err--${escapeHtml(t.source)}">${escapeHtml(t.message)}</span>`).join(""));
      } else {
        el.setAttribute("aria-invalid", "false");
        el.removeAttribute("aria-describedby");
        setContainerHtml(container, "");
        if (isClean && ctrl.touched.value) {
          target.classList.add(cls.valid);
        }
      }
      triggerAfterRender();
    },
    onFormValidate(formEl, valid, ctx) {
      const cls = resolveClasses(this, ctx.config);
      if (cls.form) {
        formEl.classList.add(cls.form);
      }
      if (valid) {
        if (cls.invalid)
          formEl.classList.remove(cls.invalid);
        if (cls.valid)
          formEl.classList.add(cls.valid);
      } else {
        if (cls.valid)
          formEl.classList.remove(cls.valid);
        if (cls.invalid)
          formEl.classList.add(cls.invalid);
      }
    },
    onFormReset(formEl, ctx) {
      const cls = resolveClasses(this, ctx.config);
      if (cls.form) {
        formEl.classList.remove(cls.form);
      }
      if (cls.valid)
        formEl.classList.remove(cls.valid);
      if (cls.invalid)
        formEl.classList.remove(cls.invalid);
    }
  };
  const bootstrap5Driver = {
    classes: {
      valid: "is-valid",
      invalid: "is-invalid",
      pending: "is-pending",
      feedback: "invalid-feedback",
      success: "valid-feedback",
      form: "was-validated"
    },
    renderField(el, ctrl, fid, dOpts, ctx) {
      const config = ctx.config;
      const target = getClassTarget(el, dOpts.classHandler);
      const cls = resolveClasses(this, config);
      const renderCtx = { el, control: ctrl, fieldId: fid, displayOptions: dOpts, localContext: ctx };
      const globalBeforeRender = ctx.beforeRenderMiddlewares || [];
      globalBeforeRender.forEach((mw) => {
        try {
          mw(renderCtx);
        } catch (err) {
          console.error("[Helix Validation] beforeRender middleware error:", err);
        }
      });
      const triggerAfterRender = () => {
        const globalAfterRender = ctx.afterRenderMiddlewares || [];
        globalAfterRender.forEach((mw) => {
          try {
            mw(renderCtx);
          } catch (err) {
            console.error("[Helix Validation] afterRender middleware error:", err);
          }
        });
      };
      const currentMode = ctrl.mode || config.mode;
      if (currentMode === "silent") {
        target.classList.remove(cls.valid, cls.invalid, cls.pending);
        triggerAfterRender();
        return;
      }
      const prefix = resolvePrefix(ctx);
      const isTooltip = config.ui && config.ui.feedback === "tooltip" || dOpts.feedback === "tooltip";
      const feedbackClass = isTooltip ? "invalid-tooltip" : cls.feedback;
      const successClass = isTooltip ? "valid-tooltip" : cls.success;
      if (ctrl.pending.value) {
        target.classList.remove(cls.valid, cls.invalid);
        target.classList.add(cls.pending);
        el.setAttribute("aria-invalid", "false");
        el.removeAttribute("aria-describedby");
        el.setAttribute(`data-${prefix}-pending`, "");
        const prevErr2 = document.getElementById(`hx-err-${fid}`);
        if (prevErr2)
          prevErr2.remove();
        triggerAfterRender();
        return;
      }
      el.removeAttribute(`data-${prefix}-pending`);
      const showErrs = ctrl.$errors.value.length > 0;
      const isClean = ctrl.errors.value.length === 0;
      target.classList.remove(cls.valid, cls.invalid, cls.pending);
      const prevErr = document.getElementById(`hx-err-${fid}`);
      if (prevErr)
        prevErr.remove();
      if (showErrs) {
        target.classList.add(cls.invalid);
        el.setAttribute("aria-invalid", "true");
        el.setAttribute("aria-describedby", `hx-err-${fid}`);
        const tagged = ctrl._tagged.value.filter((t) => t && t.message);
        const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
        const errorMsg = toShow.map((t) => t.message).join(", ");
        const container = dOpts.errTarget && document.querySelector(dOpts.errTarget) || getOrCreateBootstrapFeedback(el, fid, "invalid", feedbackClass);
        setContainerHtml(container, escapeHtml(errorMsg));
      } else {
        el.setAttribute("aria-invalid", "false");
        el.removeAttribute("aria-describedby");
        if (isClean && ctrl.touched.value) {
          target.classList.add(cls.valid);
          const successMsg = dOpts.successMessage || config.ui && config.ui.successMessage;
          if (successMsg) {
            const container = getOrCreateBootstrapFeedback(el, fid, "valid", successClass);
            setContainerHtml(container, escapeHtml(successMsg));
          }
        }
      }
      triggerAfterRender();
    },
    onFormValidate(formEl, valid, ctx) {
      const cls = resolveClasses(this, ctx.config);
      if (cls.form) {
        formEl.classList.add(cls.form);
      }
      if (valid) {
        if (cls.invalid)
          formEl.classList.remove(cls.invalid);
        if (cls.valid)
          formEl.classList.add(cls.valid);
      } else {
        if (cls.valid)
          formEl.classList.remove(cls.valid);
        if (cls.invalid)
          formEl.classList.add(cls.invalid);
      }
    },
    onFormReset(formEl, ctx) {
      const cls = resolveClasses(this, ctx.config);
      if (cls.form) {
        formEl.classList.remove(cls.form);
      }
      if (cls.valid)
        formEl.classList.remove(cls.valid);
      if (cls.invalid)
        formEl.classList.remove(cls.invalid);
    }
  };
  const tailwindDriver = Object.assign({}, customDriver, {
    classes: {
      valid: "border-green-500 text-green-900 placeholder-green-700 focus:border-green-500 focus:ring-green-500",
      invalid: "border-red-500 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500",
      pending: "border-blue-500 focus:border-blue-500 focus:ring-blue-500",
      feedback: "text-sm text-red-600 mt-2",
      success: "text-sm text-green-600 mt-2",
      form: "space-y-4"
    }
  });
  uiDrivers.set("custom", customDriver);
  uiDrivers.set("bootstrap5", bootstrap5Driver);
  uiDrivers.set("bootstrap4", bootstrap5Driver);
  uiDrivers.set("tailwind", tailwindDriver);
  function form(fieldDefs, opts, localContext) {
    let _f;
    let _el = null;
    const ctx = localContext || getCurrentContext();
    const app = ctx.app;
    const config = ctx.config;
    opts = opts || {};
    const isPlainObject = (val) => {
      if (!val || typeof val !== "object")
        return false;
      if (app && typeof app.isRef === "function" && app.isRef(val))
        return false;
      const proto = Object.getPrototypeOf(val);
      return proto === Object.prototype || proto === null;
    };
    const _id = ctx.uid();
    const submitting = app.ref(false);
    const submitted = app.ref(false);
    const submitAttempted = app.ref(false);
    const error = app.ref(null);
    const hasError = app.computed(() => !!error.value);
    const disabled = app.ref(false);
    const enabled = app.computed(() => !disabled.value);
    const _fieldsVersion = app.ref(0);
    const valid = app.computed(() => {
      void _fieldsVersion.value;
      return Object.values(_fields).every((c) => c.valid.value);
    });
    const invalid = app.computed(() => !valid.value);
    const dirty = app.computed(() => {
      void _fieldsVersion.value;
      return Object.values(_fields).some((c) => c.dirty.value);
    });
    const touched = app.computed(() => {
      void _fieldsVersion.value;
      return Object.values(_fields).some((c) => c.touched.value);
    });
    const pending = app.computed(() => {
      void _fieldsVersion.value;
      return Object.values(_fields).some((c) => c.pending.value);
    });
    const isValidating = pending;
    const status = app.computed(() => {
      if (disabled.value)
        return STATUS.DISABLED;
      if (pending.value)
        return STATUS.PENDING;
      if (invalid.value)
        return STATUS.INVALID;
      return STATUS.VALID;
    });
    const $valid = app.computed(() => {
      void _fieldsVersion.value;
      return Object.values(_fields).every((c) => c.$valid.value);
    });
    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;
    let _crossValidatorDefs = Array.isArray(opts.validators) ? opts.validators.slice() : opts.validators ? [opts.validators] : [];
    let _resolvedCrossValidatorsCached = null;
    const getResolvedCrossValidators = () => {
      if (!_resolvedCrossValidatorsCached) {
        _resolvedCrossValidatorsCached = normalizeRules(_crossValidatorDefs, createLookupRegistry(_f, ctx));
      }
      return _resolvedCrossValidatorsCached;
    };
    const _fields = {};
    const _stoppers = [];
    function _registerField(name, ctrl) {
      if (_fields[name] && _fields[name] !== ctrl) {
        console.warn(`[Helix Validation] form: field "${name}" already exists — overwriting.`);
        const prev = _fields[name];
        if (prev._crossWatcherStop) {
          prev._crossWatcherStop();
          prev._crossWatcherStop = null;
        }
        if (prev._depWatcherStop) {
          prev._depWatcherStop();
          prev._depWatcherStop = null;
        }
        if (typeof prev._destroy === "function")
          prev._destroy();
        prev._parent = null;
      }
      ctrl.name = name;
      ctrl._parent = _f;
      _fields[name] = ctrl;
      _fieldsVersion.value++;
      if (ctrl._crossErrors && ctrl.value && app.watch) {
        if (ctrl._crossWatcherStop)
          ctrl._crossWatcherStop();
        const stop = app.watch(ctrl.value, () => {
          if (ctrl._crossErrors.value.length)
            ctrl._crossErrors.value = [];
        }, { immediate: false });
        ctrl._crossWatcherStop = stop;
      }
      if (_f)
        _setupDependencyWatcher(ctrl);
    }
    function _setupDependencyWatcher(ctrl) {
      if (ctrl._dependsOn && ctrl._dependsOn.length && app.watch) {
        if (ctrl._depWatcherStop) {
          ctrl._depWatcherStop();
          ctrl._depWatcherStop = null;
        }
        const stopDep = app.watch(
          () => ctrl._dependsOn.map((dep) => {
            const depCtrl = typeof dep === "string" ? getField(dep) : dep;
            return depCtrl ? depCtrl.value.value : void 0;
          }),
          () => {
            if (ctrl.validate)
              ctrl.validate();
          },
          { deep: true, immediate: false }
        );
        ctrl._depWatcherStop = stopDep;
      }
    }
    Object.keys(fieldDefs || {}).forEach((name) => {
      const def = fieldDefs[name];
      if (def === void 0)
        return;
      let ctrl;
      if (def && (def._type === "field" || def._type === "form" || def._type === "list")) {
        ctrl = def;
      } else if (Array.isArray(def)) {
        const [val, r, o] = def;
        ctrl = field(val, r, Object.assign({ name }, o || {}), ctx);
      } else if (isPlainObject(def)) {
        ctrl = form(def, {}, ctx);
      } else {
        ctrl = field(def, [], {}, ctx);
      }
      _registerField(name, ctrl);
    });
    const getField = (path) => resolvePath(_f, path);
    const syncDOMValues = () => {
      if (!_el)
        return;
      _el.querySelectorAll("[name]").forEach((input) => {
        const name = input.getAttribute("name");
        const c = _fields[name];
        if (c) {
          let domVal;
          if (input.type === "checkbox") {
            domVal = input.checked;
          } else if (input.type === "radio") {
            if (input.checked) {
              domVal = input.value;
            } else {
              return;
            }
          } else if (input.isContentEditable) {
            domVal = input.textContent || "";
          } else {
            domVal = input.value || "";
          }
          if (c.value.value !== domVal) {
            c.value.value = domVal;
          }
        }
      });
    };
    const values = () => {
      syncDOMValues();
      const out = {};
      Object.keys(_fields).forEach((k) => {
        const c = _fields[k];
        if (c.disabled && c.disabled.value)
          return;
        out[k] = c._type === "form" ? c.values() : c._type === "list" ? c.values() : c.value.value;
      });
      return out;
    };
    const rawValues = () => {
      syncDOMValues();
      const out = {};
      Object.keys(_fields).forEach((k) => {
        const c = _fields[k];
        if (c.disabled && c.disabled.value)
          return;
        out[k] = c._type === "form" ? c.rawValues() : c._type === "list" ? c.rawValues() : c.value.value;
      });
      return out;
    };
    const set = (path, val) => {
      const c = getField(path);
      if (c) {
        c.set(val, { silent: true });
        return;
      }
      if (!config.autoCreatePath && !opts.autoCreatePath) {
        console.warn(`[Helix Validation] form.set: path "${path}" not found.`);
        return;
      }
      const parts = parsePath(path);
      let cur = _f;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (cur._type !== "form") {
          console.warn(`[Helix Validation] form.set: can't auto-create through non-form at "${seg}".`);
          return;
        }
        if (!cur.fields[seg])
          cur.add(seg, form({}, {}, ctx));
        cur = cur.fields[seg];
      }
      if (cur._type === "form") {
        const leaf = parts[parts.length - 1];
        cur.add(leaf, field(val, [], {}, ctx));
      }
    };
    const patch = (obj) => {
      const deepPatch = (targetForm, data) => {
        Object.keys(data).forEach((k) => {
          const val = data[k];
          let c = targetForm.fields[k];
          if (!c) {
            if (config.autoCreatePath || opts.autoCreatePath) {
              if (val && typeof val === "object" && !Array.isArray(val)) {
                c = form({}, {}, ctx);
                targetForm.add(k, c);
              } else {
                c = field(void 0, [], {}, ctx);
                targetForm.add(k, c);
              }
            } else {
              return;
            }
          }
          if (c._type === "form" && val && typeof val === "object" && !Array.isArray(val)) {
            deepPatch(c, val);
          } else if (c.set) {
            c.set(val, { silent: true });
          }
        });
      };
      deepPatch(_f, obj);
    };
    const reset = (obj) => {
      obj = obj || {};
      Object.keys(_fields).forEach((k) => {
        if (_fields[k].reset)
          _fields[k].reset(obj[k]);
      });
      submitted.value = false;
      submitAttempted.value = false;
      error.value = null;
      if (opts.serverErrors)
        opts.serverErrors.value = {};
      const uiDriver = getActiveUIDriver(ctx);
      if (uiDriver && uiDriver.onFormReset && _el) {
        uiDriver.onFormReset(_el, ctx);
      }
      emitter.emit({ type: EVENTS.RESET });
    };
    const touch = (opts2) => {
      if (!(opts2 && opts2.self))
        touchAll();
    };
    const touchAll = () => {
      Object.values(_fields).forEach((c) => {
        if (c.touchAll)
          c.touchAll();
        else if (c.touch)
          c.touch({ self: true });
      });
    };
    const add = (name, ctrl) => {
      _registerField(name, ctrl);
    };
    const remove = (name) => {
      if (!_fields[name])
        return;
      const c = _fields[name];
      if (c._crossWatcherStop) {
        c._crossWatcherStop();
        c._crossWatcherStop = null;
      }
      if (c._depWatcherStop) {
        c._depWatcherStop();
        c._depWatcherStop = null;
      }
      if (typeof c._destroy === "function")
        c._destroy();
      c._parent = null;
      delete _fields[name];
      _fieldsVersion.value++;
    };
    const has = (name) => !!_fields[name];
    const setErrors = (errMap) => {
      Object.keys(errMap || {}).forEach((k) => {
        const c = getField(k);
        if (c)
          c.setErrors(Array.isArray(errMap[k]) ? errMap[k] : [errMap[k]]);
      });
    };
    const setError = (msg) => {
      error.value = msg;
    };
    const clearError = () => {
      error.value = null;
    };
    const get = (path) => {
      const c = getField(path);
      return c ? c._type === "form" || c._type === "list" ? c.values() : c.value.value : void 0;
    };
    const exists = (path) => {
      return getField(path) !== null;
    };
    const removeAtPath = (path) => {
      const parts = parsePath(path);
      if (parts.length === 1) {
        remove(parts[0]);
        return;
      }
      let cur = _f;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur)
          return;
        if (cur._type === "form")
          cur = cur.fields[parts[i]];
        else if (cur._type === "list")
          cur = cur.items.value[Number(parts[i])];
        else
          return;
      }
      const leaf = parts[parts.length - 1];
      if (cur && cur.remove)
        cur.remove(leaf);
    };
    const validate = (opts2) => {
      syncDOMValues();
      opts2 = opts2 || {};
      const group = opts2.group;
      const fieldsToValidate = Array.isArray(opts2) ? opts2 : opts2.fields;
      let ctrls = Object.values(_fields);
      const isSilent = opts2.silent;
      if (!isSilent)
        emitter.emit(EVENTS.BEFORE_VALIDATE);
      const validationCtx = buildValidationContext(_f, opts2);
      const currentVals = values();
      return runMiddleware(_beforeValidation, currentVals, validationCtx).then(() => {
        if (fieldsToValidate) {
          ctrls = ctrls.filter((c) => fieldsToValidate.includes(c.name) || fieldsToValidate.some((p) => c.name && (c.name === p || c.name.startsWith(p + "."))));
        } else if (group) {
          const groups = Array.isArray(group) ? group : [group];
          ctrls = ctrls.filter((c) => {
            if (!c._group)
              return false;
            const fieldGroups = Array.isArray(c._group) ? c._group : [c._group];
            return fieldGroups.some((g) => groups.includes(g));
          });
        }
        if (opts2.touch) {
          ctrls.forEach((c) => {
            if (c.touch)
              c.touch({ self: true });
          });
        }
        if (!group && !fieldsToValidate && !isSilent) {
          Object.values(_fields).forEach((c) => {
            if (c._crossErrors)
              c._crossErrors.value = [];
          });
        }
        let checkFields;
        if (opts2.stopOnFirst) {
          let chain = Promise.resolve(true);
          ctrls.forEach((c) => {
            chain = chain.then((passing) => {
              if (!passing)
                return false;
              return c.validate ? c.validate(opts2) : Promise.resolve(true);
            });
          });
          checkFields = chain;
        } else {
          checkFields = Promise.all(ctrls.map((c) => c.validate ? c.validate(opts2) : Promise.resolve(true))).then((results) => results.every(Boolean));
        }
        return checkFields;
      }).then((allValid) => {
        if (opts2.stopOnFirst && !allValid) {
          if (!isSilent)
            emitter.emit(EVENTS.AFTER_VALIDATE, { valid: false });
          return false;
        }
        let checkCross;
        const resolvedCross = getResolvedCrossValidators();
        if (group || !resolvedCross.length) {
          checkCross = Promise.resolve(allValid);
        } else {
          const vals = values();
          checkCross = resolvedCross.reduce(
            (chain, xv) => chain.then((passing) => {
              if (!passing)
                return false;
              return Promise.resolve(xv(vals, _f, validationCtx)).then((errs) => {
                if (!errs)
                  return true;
                if (isSilent)
                  return false;
                Object.keys(errs).forEach((k) => {
                  const c = getField(k);
                  if (!c || !c._crossErrors)
                    return;
                  const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];
                  const newErrs = arr.map((m) => ({ message: m, source: "cross", rule: null }));
                  const existing = c._crossErrors.value || [];
                  const combined = existing.concat(newErrs);
                  const unique = [];
                  const seenMsgs = /* @__PURE__ */ new Set();
                  combined.forEach((err) => {
                    if (err && err.message && !seenMsgs.has(err.message)) {
                      seenMsgs.add(err.message);
                      unique.push(err);
                    }
                  });
                  c._crossErrors.value = unique;
                });
                return false;
              });
            }),
            Promise.resolve(allValid)
          );
        }
        return checkCross.then((finalValid) => {
          if (opts.schema && !group && !fieldsToValidate) {
            return Promise.resolve(opts.schema(values())).then((schemaRes) => {
              if (!schemaRes.valid) {
                if (!isSilent) {
                  Object.keys(schemaRes.errors).forEach((path) => {
                    const c = getField(path);
                    if (c)
                      c.setErrors(schemaRes.errors[path]);
                  });
                }
                emitter.emit(EVENTS.AFTER_VALIDATE, { valid: false });
                return false;
              }
              if (!isSilent)
                emitter.emit(EVENTS.AFTER_VALIDATE, { valid: finalValid });
              return finalValid;
            });
          }
          if (!isSilent)
            emitter.emit(EVENTS.AFTER_VALIDATE, { valid: finalValid });
          return finalValid;
        });
      }).then((finalValid) => {
        const uiDriver = getActiveUIDriver(ctx);
        if (uiDriver && uiDriver.onFormValidate && _el) {
          uiDriver.onFormValidate(_el, finalValid, ctx);
        }
        if (!finalValid) {
          focusFirstInvalid(opts2);
        }
        const finalErrors = getErrors();
        return runMiddleware(_afterValidation, finalValid, finalErrors, validationCtx).then(() => {
          if (finalValid) {
            return runMiddleware(_onSuccess, values(), validationCtx).then(() => true);
          } else {
            return runMiddleware(_onFailure, finalErrors, validationCtx).then(() => false);
          }
        });
      });
    };
    const getFocusOptions = (opts2) => {
      const localVal = opts2.focusFirstInvalid;
      const formVal = opts.focusFirstInvalid;
      const globalVal = config.focusFirstInvalid;
      let val = localVal !== void 0 ? localVal : formVal !== void 0 ? formVal : globalVal;
      if (!val)
        return { enabled: false };
      if (typeof val === "boolean") {
        return {
          enabled: val,
          scroll: true,
          behavior: "smooth",
          block: "center",
          select: true
        };
      }
      return Object.assign({
        enabled: true,
        scroll: true,
        behavior: "smooth",
        block: "center",
        select: true
      }, val);
    };
    const focusFirstInvalid = (runOpts) => {
      runOpts = runOpts || {};
      const fOpts = getFocusOptions(runOpts);
      if (!fOpts.enabled || !_el)
        return false;
      const invalidCtrls = Object.values(_fields).filter((c) => c.invalid && c.invalid.value);
      if (!invalidCtrls.length)
        return false;
      const boundPairs = [];
      for (const el2 of ctx.boundFieldEls) {
        if (el2.__hxField && invalidCtrls.includes(el2.__hxField)) {
          if (_el.contains(el2)) {
            boundPairs.push({ el: el2, ctrl: el2.__hxField });
          }
        }
      }
      if (!boundPairs.length)
        return false;
      boundPairs.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & 4)
          return -1;
        if (pos & 2)
          return 1;
        return 0;
      });
      const canFocus = (el2) => {
        return el2 && !el2.disabled && el2.offsetParent !== null && typeof el2.focus === "function";
      };
      const targetPair = boundPairs.find((p) => canFocus(p.el));
      if (!targetPair)
        return false;
      const { el, ctrl } = targetPair;
      emitter.emit("beforeFocusInvalid", { el, control: ctrl });
      const uiDriver = getActiveUIDriver(ctx);
      if (uiDriver && typeof uiDriver.focusField === "function") {
        uiDriver.focusField(el, ctrl, fOpts, ctx);
      } else {
        if (fOpts.scroll) {
          el.scrollIntoView({
            behavior: fOpts.behavior,
            block: fOpts.block
          });
        }
        el.focus();
        if (fOpts.select && typeof el.select === "function") {
          try {
            el.select();
          } catch (e) {
          }
        }
      }
      emitter.emit("afterFocusInvalid", { el, control: ctrl });
      return true;
    };
    const bind = (name, bindOpts) => {
      bindOpts = bindOpts || {};
      const c = getField(name);
      if (!c) {
        console.warn(`[Helix Validation] form.bind: field "${name}" not found.`);
        return [app.ref(""), {}];
      }
      const trigger = bindOpts.trigger || c.updateOn || config.trigger;
      const fieldId = `hx-field-${_id}-${name}`;
      return [c.value, {
        id: fieldId,
        name,
        "aria-invalid": app.computed(() => c.invalid.value),
        "aria-describedby": `hx-err-${_id}-${name}`,
        onBlur: () => {
          c.touch();
          if (trigger === "blur" || trigger === "eager")
            c.validate();
        },
        onInput: (e) => {
          c.set(e.target.value);
          if (trigger === "input")
            c.validate();
        }
      }];
    };
    const _childChanged = () => {
      if (_f._parent && _f._parent._childChanged)
        _f._parent._childChanged();
    };
    const emitter = createEventEmitter();
    if (opts.onBeforeSubmit)
      emitter.on("beforeSubmit", opts.onBeforeSubmit);
    if (opts.onAfterSubmit)
      emitter.on("afterSubmit", opts.onAfterSubmit);
    if (opts.onBeforeValidate)
      emitter.on("beforeValidate", opts.onBeforeValidate);
    if (opts.onAfterValidate)
      emitter.on("afterValidate", opts.onAfterValidate);
    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];
    if (opts.beforeValidation)
      _beforeValidation.push(opts.beforeValidation);
    if (opts.afterValidation)
      _afterValidation.push(opts.afterValidation);
    if (opts.onSuccess)
      _onSuccess.push(opts.onSuccess);
    if (opts.onFailure)
      _onFailure.push(opts.onFailure);
    const submit = () => {
      submitAttempted.value = true;
      touchAll();
      emitter.emit(EVENTS.BEFORE_SUBMIT);
      emitter.emit({ type: EVENTS.SUBMIT });
      return validate().then((ok) => {
        if (!ok) {
          if (opts.onInvalid)
            opts.onInvalid(values(), _f);
          emitter.emit({ type: EVENTS.INVALID });
          return;
        }
        submitting.value = true;
        emitter.emit({ type: EVENTS.SUBMITTING });
        const afterSubmit = opts.onSubmit ? Promise.resolve(opts.onSubmit(values(), _f)) : Promise.resolve();
        return afterSubmit.then(() => {
          submitted.value = true;
          emitter.emit({ type: EVENTS.SUBMITTED });
          emitter.emit(EVENTS.AFTER_SUBMIT, { valid: true });
          if (opts.resetOnSubmit)
            reset();
        }).catch((err) => {
          emitter.emit({ type: EVENTS.ERROR, error: err });
          emitter.emit(EVENTS.AFTER_SUBMIT, { valid: false, error: err });
          throw err;
        }).finally(() => {
          submitting.value = false;
        });
      });
    };
    if (opts.serverErrors) {
      const stopExt = app.watch(opts.serverErrors, (errs) => {
        if (!errs)
          return;
        Object.keys(errs).forEach((k) => {
          const c = getField(k);
          if (!c)
            return;
          const arr = Array.isArray(errs[k]) ? errs[k] : [errs[k]];
          c._serverErrors.value = arr.map((m) => ({ message: m, source: "server", rule: null }));
          if (c._serverWatcherStop)
            c._serverWatcherStop();
          const stopOnce = app.watch(c.value, () => {
            c._serverErrors.value = [];
            const updated = Object.assign({}, opts.serverErrors.value);
            delete updated[k];
            opts.serverErrors.value = updated;
            if (c._serverWatcherStop) {
              c._serverWatcherStop();
              c._serverWatcherStop = null;
            }
          }, { immediate: false });
          c._serverWatcherStop = stopOnce;
        });
      }, { deep: true, immediate: false });
      _stoppers.push(stopExt);
    }
    const disable = () => {
      disabled.value = true;
      Object.values(_fields).forEach((c) => {
        if (c.disable)
          c.disable();
      });
    };
    const enable = () => {
      disabled.value = false;
      Object.values(_fields).forEach((c) => {
        if (c.enable)
          c.enable();
      });
    };
    const setValidators = (v) => {
      _crossValidatorDefs = Array.isArray(v) ? v.slice() : v ? [v] : [];
      _resolvedCrossValidatorsCached = null;
    };
    const clearValidators = () => {
      _crossValidatorDefs = [];
      _resolvedCrossValidatorsCached = null;
    };
    const markDirty = () => {
      Object.values(_fields).forEach((c) => {
        if (c.markDirty)
          c.markDirty();
      });
    };
    const markPristine = () => {
      Object.values(_fields).forEach((c) => {
        if (c.markPristine)
          c.markPristine();
      });
    };
    const getErrors = () => {
      const out = {};
      walkLeafFields(_fields, (path, ctrl) => {
        if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
          out[path] = ctrl.errors.value.slice();
        }
      });
      return out;
    };
    const getErrorDetails = () => {
      const out = {};
      walkLeafFields(_fields, (path, ctrl) => {
        if (ctrl._tagged && ctrl._tagged.value && ctrl._tagged.value.length) {
          out[path] = ctrl._tagged.value.map((t) => ({
            message: t.message,
            source: t.source,
            rule: t.rule,
            index: t.index
          }));
        }
      });
      return out;
    };
    const getFirstErrors = () => {
      const out = {};
      walkLeafFields(_fields, (path, ctrl) => {
        if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
          out[path] = ctrl.errors.value[0];
        }
      });
      return out;
    };
    const errorCount = () => {
      let count = 0;
      walkLeafFields(_fields, (path, ctrl) => {
        if (ctrl.errors && ctrl.errors.value) {
          count += ctrl.errors.value.length;
        }
      });
      return count;
    };
    const hasErrors = () => {
      let has2 = false;
      walkLeafFields(_fields, (path, ctrl) => {
        if (ctrl.errors && ctrl.errors.value && ctrl.errors.value.length) {
          has2 = true;
          return false;
        }
      });
      return has2;
    };
    const stopStatusWatch = app.watch(status, (newStatus) => {
      emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });
    _stoppers.push(stopStatusWatch);
    const _destroy = () => {
      _stoppers.forEach((s) => s && s());
      _stoppers.length = 0;
      Object.values(_fields).forEach((c) => {
        if (c._crossWatcherStop) {
          c._crossWatcherStop();
          c._crossWatcherStop = null;
        }
        if (c._depWatcherStop) {
          c._depWatcherStop();
          c._depWatcherStop = null;
        }
        if (c._destroy)
          c._destroy();
      });
      emitter.listeners.length = 0;
    };
    _f = {
      _id,
      _type: "form",
      _parent: null,
      _context: ctx,
      _stoppers,
      _emit: emitter.emit,
      _childChanged,
      get fields() {
        return _fields;
      },
      get _el() {
        return _el;
      },
      set _el(val) {
        _el = val;
      },
      valid,
      invalid,
      dirty,
      touched,
      pending,
      status,
      $valid,
      submitting,
      submitted,
      submitAttempted,
      error,
      hasError,
      disabled,
      enabled,
      isValidating,
      field: getField,
      get,
      exists,
      values,
      rawValues,
      toJSON: values,
      serialize: values,
      set,
      patch,
      reset,
      touch,
      touchAll,
      disable,
      enable,
      add,
      remove: removeAtPath,
      has,
      setErrors,
      setError,
      clearError,
      setValidators,
      clearValidators,
      markDirty,
      markPristine,
      getErrors,
      getErrorDetails,
      getFirstErrors,
      errorCount,
      hasErrors,
      validate,
      validateGroup(groupName, groupOpts) {
        return validate(Object.assign({}, groupOpts, { group: groupName }));
      },
      submit,
      focusFirstInvalid,
      bind,
      on: emitter.on,
      rules: localRules,
      _localRules,
      _destroy,
      beforeValidation(fn) {
        if (typeof fn === "function" && !_beforeValidation.includes(fn))
          _beforeValidation.push(fn);
        return _f;
      },
      afterValidation(fn) {
        if (typeof fn === "function" && !_afterValidation.includes(fn))
          _afterValidation.push(fn);
        return _f;
      },
      onSuccess(fn) {
        if (typeof fn === "function" && !_onSuccess.includes(fn))
          _onSuccess.push(fn);
        return _f;
      },
      onFailure(fn) {
        if (typeof fn === "function" && !_onFailure.includes(fn))
          _onFailure.push(fn);
        return _f;
      }
    };
    Object.values(_fields).forEach((c) => {
      if (c) {
        c._parent = _f;
        _setupDependencyWatcher(c);
      }
    });
    return _f;
  }
  function list(initialItems, validators, opts, localContext) {
    let _l;
    let options = opts || {};
    let ctx;
    if (localContext) {
      ctx = localContext;
    } else if (options && options._context) {
      ctx = options;
      options = {};
    } else {
      ctx = getCurrentContext();
    }
    const app = ctx.app;
    ctx.config;
    const _id = ctx.uid();
    const initial = Array.isArray(initialItems) ? initialItems.slice() : [];
    const items = app.ref(initial);
    const length = app.computed(() => items.value.length);
    const _beforeValidation = [];
    const _afterValidation = [];
    const _onSuccess = [];
    const _onFailure = [];
    if (options.beforeValidation)
      _beforeValidation.push(options.beforeValidation);
    if (options.afterValidation)
      _afterValidation.push(options.afterValidation);
    if (options.onSuccess)
      _onSuccess.push(options.onSuccess);
    if (options.onFailure)
      _onFailure.push(options.onFailure);
    const errors = app.ref([]);
    const _tagged = app.ref([]);
    const disabled = app.ref(false);
    const enabled = app.computed(() => !disabled.value);
    const valid = app.computed(
      () => items.value.every((c) => c.valid.value) && errors.value.length === 0
    );
    const invalid = app.computed(() => !valid.value);
    const pending = app.computed(() => items.value.some((c) => c.pending.value));
    const $valid = app.computed(
      () => items.value.every((c) => c.$valid.value) && errors.value.length === 0
    );
    const status = app.computed(() => {
      if (disabled.value)
        return STATUS.DISABLED;
      if (pending.value)
        return STATUS.PENDING;
      if (invalid.value)
        return STATUS.INVALID;
      return STATUS.VALID;
    });
    const localRules = createRuleRegistry();
    const _localRules = localRules._registry;
    let _validatorDefs = Array.isArray(validators) ? validators.slice() : validators ? [validators] : [];
    let _resolvedValidatorsCached = null;
    const getResolvedValidators = () => {
      if (!_resolvedValidatorsCached) {
        _resolvedValidatorsCached = normalizeRules(_validatorDefs, createLookupRegistry(_l, ctx));
      }
      return _resolvedValidatorsCached;
    };
    const at = (i) => items.value[i] || null;
    const push = (c) => {
      c._parent = _l;
      items.value = items.value.concat(c);
    };
    const insert = (i, c) => {
      c._parent = _l;
      const a = items.value.slice();
      a.splice(i, 0, c);
      items.value = a;
    };
    const remove = (i) => {
      const removed = items.value[i];
      if (removed && removed._destroy)
        removed._destroy();
      const a = items.value.slice();
      a.splice(i, 1);
      items.value = a;
    };
    const removeAt = remove;
    const clear = () => {
      items.value.forEach((c) => {
        if (c && c._destroy)
          c._destroy();
      });
      items.value = [];
    };
    const setControl = (i, c) => {
      c._parent = _l;
      const a = items.value.slice();
      a[i] = c;
      items.value = a;
    };
    const setValue = (arr) => {
      if (!Array.isArray(arr))
        return;
      arr.forEach((val, i) => {
        const c = items.value[i];
        if (c && c.set)
          c.set(val, { silent: true });
      });
    };
    const set = (first, second) => {
      if (typeof first === "number") {
        setControl(first, second);
      } else {
        setValue(first);
      }
    };
    const patchValue = (arr) => {
      if (!Array.isArray(arr))
        return;
      arr.forEach((val, i) => {
        const c = items.value[i];
        if (c && c.patch)
          c.patch(val);
        else if (c && c.set)
          c.set(val, { silent: true });
      });
    };
    const patch = patchValue;
    const disable = () => {
      disabled.value = true;
      items.value.forEach((c) => {
        if (c.disable)
          c.disable();
      });
    };
    const enable = () => {
      disabled.value = false;
      items.value.forEach((c) => {
        if (c.enable)
          c.enable();
      });
    };
    const markDirty = () => {
      items.value.forEach((c) => {
        if (c.markDirty)
          c.markDirty();
      });
    };
    const markPristine = () => {
      items.value.forEach((c) => {
        if (c.markPristine)
          c.markPristine();
      });
    };
    const untouch = () => {
      items.value.forEach((c) => {
        if (c.untouch)
          c.untouch();
      });
    };
    const values = () => items.value.filter((c) => !(c.disabled && c.disabled.value)).map((c) => c._type === "form" || c._type === "list" ? c.values() : c.value.value);
    const rawValues = () => items.value.filter((c) => !(c.disabled && c.disabled.value)).map((c) => c._type === "form" || c._type === "list" ? c.rawValues() : c.value.value);
    const touchAll = () => {
      items.value.forEach((c) => {
        if (c.touchAll)
          c.touchAll();
        else if (c.touch)
          c.touch({ self: true });
      });
    };
    const validate = (opts2) => {
      opts2 = opts2 || {};
      const isSilent = opts2.silent;
      const validationCtx = buildValidationContext(_l, opts2);
      const currentVals = values();
      return runMiddleware(_beforeValidation, currentVals, validationCtx).then(() => {
        return Promise.all(items.value.map((c) => c.validate ? c.validate(opts2) : Promise.resolve(true)));
      }).then((itemsOK) => {
        const allItemsValid = itemsOK.every(Boolean);
        const resolvedVals = getResolvedValidators();
        if (!resolvedVals.length) {
          if (!isSilent) {
            errors.value = [];
            _tagged.value = [];
          }
          return allItemsValid;
        }
        return runRules(_l, resolvedVals, values(), opts2).then((result) => {
          if (!result)
            return allItemsValid;
          const listTagged = result.tagged.map((t) => ({ ...t, source: "list" }));
          if (!isSilent) {
            _tagged.value = listTagged;
            errors.value = listTagged.map((t) => t.message);
          }
          return allItemsValid && (isSilent ? listTagged.length === 0 : errors.value.length === 0);
        });
      }).then((finalValid) => {
        const finalErrors = errors.value;
        return runMiddleware(_afterValidation, finalValid, finalErrors, validationCtx).then(() => {
          if (finalValid) {
            return runMiddleware(_onSuccess, values(), validationCtx).then(() => true);
          } else {
            return runMiddleware(_onFailure, finalErrors, validationCtx).then(() => false);
          }
        });
      });
    };
    const setValidators = (v) => {
      _validatorDefs = Array.isArray(v) ? v.slice() : v ? [v] : [];
      _resolvedValidatorsCached = null;
    };
    const clearErrors = () => {
      errors.value = [];
      _tagged.value = [];
    };
    const reset = (vals) => {
      vals = vals || [];
      items.value.forEach((c, i) => {
        if (c.reset)
          c.reset(vals[i]);
      });
      errors.value = [];
      _tagged.value = [];
    };
    const emitter = createEventEmitter();
    const stopStatusWatch = app.watch(status, (newStatus) => {
      emitter.emit({ type: EVENTS.STATUS, status: newStatus });
    }, { immediate: false });
    const _destroy = () => {
      if (_l._runAbort) {
        try {
          _l._runAbort.abort();
        } catch (_) {
        }
        _l._runAbort = null;
      }
      items.value.forEach((c) => {
        if (c && c._destroy)
          c._destroy();
      });
      stopStatusWatch();
      emitter.listeners.length = 0;
    };
    _l = {
      _id,
      _type: "list",
      _parent: null,
      _context: ctx,
      _runId: null,
      _runAbort: null,
      _tagged,
      items,
      length,
      errors,
      valid,
      invalid,
      pending,
      status,
      $valid,
      disabled,
      enabled,
      at,
      push,
      insert,
      remove,
      removeAt,
      clear,
      set,
      setControl,
      setValue,
      patch,
      patchValue,
      disable,
      enable,
      markDirty,
      markPristine,
      untouch,
      values,
      rawValues,
      touchAll,
      validate,
      reset,
      setValidators,
      clearErrors,
      on: emitter.on,
      rules: localRules,
      _localRules,
      _destroy,
      beforeValidation(fn) {
        if (typeof fn === "function" && !_beforeValidation.includes(fn))
          _beforeValidation.push(fn);
        return _l;
      },
      afterValidation(fn) {
        if (typeof fn === "function" && !_afterValidation.includes(fn))
          _afterValidation.push(fn);
        return _l;
      },
      onSuccess(fn) {
        if (typeof fn === "function" && !_onSuccess.includes(fn))
          _onSuccess.push(fn);
        return _l;
      },
      onFailure(fn) {
        if (typeof fn === "function" && !_onFailure.includes(fn))
          _onFailure.push(fn);
        return _l;
      }
    };
    initial.forEach((c) => {
      if (c)
        c._parent = _l;
    });
    return _l;
  }
  function renderField(el, ctrl, fid, dOpts, localContext) {
    const ctx = localContext || getCurrentContext();
    const uiDriver = getActiveUIDriver(ctx);
    uiDriver.renderField(el, ctrl, fid, dOpts, ctx);
  }
  function getFormFromEl(el, localContext) {
    const ctx = localContext || getCurrentContext();
    let node = el ? el.parentElement : null;
    while (node) {
      if (ctx.formContextMap.has(node))
        return ctx.formContextMap.get(node);
      node = node.parentElement;
    }
    return null;
  }
  function parseRules(lowerName, v, prefix, ruleFns, boolMap, paramMap, ctx, registry) {
    const reg = registry || ctx._registry;
    if (boolMap[lowerName]) {
      const fn = boolMap[lowerName]();
      if (fn)
        ruleFns.push(fn);
      return true;
    }
    if (paramMap[lowerName]) {
      const fn = paramMap[lowerName](v);
      if (fn)
        ruleFns.push(fn);
      return true;
    }
    if (lowerName === "type" || lowerName === "data-parsley-type") {
      const lowerVal = v.toLowerCase();
      if (lowerVal === "email")
        ruleFns.push(email);
      if (lowerVal === "url")
        ruleFns.push(url);
      if (lowerVal === "number" || lowerVal === "digits")
        ruleFns.push(numeric);
      if (lowerVal === "integer")
        ruleFns.push(integer);
      return true;
    }
    if (lowerName === `${prefix}-rule` || lowerName === `${prefix}-rules` || lowerName === "hx-rule" || lowerName === "hx-rules" || lowerName === "rule" || lowerName === "rules" || lowerName === "data-parsley-rule") {
      const parsedRules = normalizeRules(v, reg);
      ruleFns.push(...parsedRules);
      return true;
    }
    return false;
  }
  function parseMessages(lowerName, v, prefix, msgOverrides) {
    let msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-(.+)-message$`));
    if (msgMatch && msgMatch[1] !== "remote") {
      msgOverrides[msgMatch[1]] = v;
      return true;
    }
    msgMatch = lowerName.match(/^data-parsley-(.+)-message$/);
    if (msgMatch && msgMatch[1] !== "error" && msgMatch[1] !== "remote") {
      msgOverrides[msgMatch[1]] = v;
      return true;
    }
    msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-msg-(.+)$`));
    if (msgMatch) {
      msgOverrides[msgMatch[1]] = v;
      return true;
    }
    msgMatch = lowerName.match(new RegExp(`^(?:${prefix}|hx|data-${prefix}|data-hx)-error-(.+)$`));
    if (msgMatch && msgMatch[1] !== "container" && msgMatch[1] !== "target" && msgMatch[1] !== "message") {
      msgOverrides[msgMatch[1]] = v;
      return true;
    }
    return false;
  }
  function parseBehavior(lowerName, v, prefix, opts, el, ruleFns, ctx) {
    if (lowerName === `${prefix}-required-if` || lowerName === "hx-required-if") {
      const parentForm = getFormFromEl(el, ctx);
      if (parentForm) {
        ruleFns.push(requiredIf(() => {
          const c = parentForm.field(v);
          return c ? !!c.value.value : false;
        }));
      }
      return true;
    }
    if (lowerName === `${prefix}-required-unless` || lowerName === "hx-required-unless") {
      const parentForm = getFormFromEl(el, ctx);
      if (parentForm) {
        ruleFns.push(requiredUnless(() => {
          const c = parentForm.field(v);
          return c ? !!c.value.value : false;
        }));
      }
      return true;
    }
    if (lowerName === `${prefix}-debounce` || lowerName === "hx-debounce" || lowerName === "data-parsley-debounce") {
      opts.debounce = Number(v);
      return true;
    }
    if (lowerName === `${prefix}-trigger` || lowerName === "hx-trigger" || lowerName === "data-parsley-trigger") {
      opts.trigger = v;
      return true;
    }
    if (lowerName === `${prefix}-group` || lowerName === "hx-group" || lowerName === "data-parsley-group") {
      opts.group = v.includes(",") ? v.split(",").map((s) => s.trim()) : v;
      return true;
    }
    if (lowerName === `${prefix}-excluded` || lowerName === "hx-excluded" || lowerName === "data-parsley-excluded") {
      opts.excluded = true;
      return true;
    }
    if (lowerName === `${prefix}-auto-dirty` || lowerName === "hx-auto-dirty") {
      opts.autoDirty = true;
      return true;
    }
    if (lowerName === `${prefix}-lazy` || lowerName === "hx-lazy") {
      opts.lazy = true;
      return true;
    }
    if (lowerName === `${prefix}-depends-on` || lowerName === "hx-depends-on") {
      opts.dependsOn = v.split(",").map((s) => s.trim());
      return true;
    }
    if (lowerName === `${prefix}-mode` || lowerName === "hx-mode") {
      opts.mode = v;
      return true;
    }
    return false;
  }
  function parseDisplay(lowerName, v, prefix, opts) {
    if (lowerName === `${prefix}-pending-text` || lowerName === "hx-pending-text" || lowerName === "data-hx-pending-text") {
      opts.pendingText = v;
      return true;
    }
    if (lowerName === `${prefix}-class-handler` || lowerName === `${prefix}-class-target` || lowerName === "hx-class-target" || lowerName === "hx-class-handler" || lowerName === "data-parsley-class-handler") {
      opts.classHandler = v;
      return true;
    }
    if (lowerName === `${prefix}-error-target` || lowerName === `${prefix}-error-container` || lowerName === `${prefix}-errors-container` || lowerName === "hx-error-container" || lowerName === "hx-errors-container" || lowerName === "data-parsley-errors-container") {
      opts.errTarget = v;
      return true;
    }
    if (lowerName === `${prefix}-message` || lowerName === `${prefix}-msg` || lowerName === `${prefix}-error-message` || lowerName === "hx-msg" || lowerName === "hx-message" || lowerName === "hx-error-message" || lowerName === "data-parsley-error-message" || lowerName === "message") {
      opts.message = v;
      return true;
    }
    return false;
  }
  function parseRemote(lowerName, v, prefix, opts) {
    if (lowerName === `${prefix}-remote` || lowerName === "hx-remote" || lowerName === "data-parsley-remote") {
      opts.remoteUrl = v;
      return true;
    }
    if (lowerName === `${prefix}-remote-message` || lowerName === "hx-remote-message" || lowerName === "data-parsley-remote-message") {
      opts.remoteOpts.fallback = v;
      return true;
    }
    if (lowerName === `${prefix}-remote-options` || lowerName === "hx-remote-options" || lowerName === "data-parsley-remote-options") {
      try {
        Object.assign(opts.remoteOpts, JSON.parse(v));
      } catch {
      }
      return true;
    }
    return false;
  }
  function parseDataHx(el, localContext, customRegistry) {
    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    const registry = customRegistry || ctx._registry;
    const ruleFns = [];
    const msgOverrides = {};
    const opts = {
      remoteUrl: null,
      remoteOpts: {},
      debounce: null,
      trigger: null,
      group: null,
      excluded: false,
      autoDirty: false,
      lazy: false,
      pendingText: "",
      classHandler: null,
      errTarget: null,
      dependsOn: [],
      message: null
    };
    const boolMap = {
      [`${prefix}-required`]: () => required,
      "hx-required": () => required,
      "required": () => required,
      [`${prefix}-require`]: () => required,
      "hx-require": () => required,
      "require": () => required,
      "data-parsley-required": () => required,
      [`${prefix}-email`]: () => email,
      "hx-email": () => email,
      [`${prefix}-url`]: () => url,
      "hx-url": () => url,
      [`${prefix}-numeric`]: () => numeric,
      "hx-numeric": () => numeric,
      [`${prefix}-integer`]: () => integer,
      "hx-integer": () => integer
    };
    const paramMap = {
      [`${prefix}-minlength`]: (v) => minLength(Number(v)),
      "hx-minlength": (v) => minLength(Number(v)),
      "minlength": (v) => minLength(Number(v)),
      "data-parsley-minlength": (v) => minLength(Number(v)),
      [`${prefix}-maxlength`]: (v) => maxLength(Number(v)),
      "hx-maxlength": (v) => maxLength(Number(v)),
      "maxlength": (v) => maxLength(Number(v)),
      "data-parsley-maxlength": (v) => maxLength(Number(v)),
      [`${prefix}-min`]: (v) => min(Number(v)),
      "hx-min": (v) => min(Number(v)),
      "min": (v) => min(Number(v)),
      "data-parsley-min": (v) => min(Number(v)),
      [`${prefix}-max`]: (v) => max(Number(v)),
      "hx-max": (v) => max(Number(v)),
      "max": (v) => max(Number(v)),
      "data-parsley-max": (v) => max(Number(v)),
      [`${prefix}-between`]: (v) => {
        const [a, b] = v.split(",");
        return between(Number(a), Number(b));
      },
      "hx-between": (v) => {
        const [a, b] = v.split(",");
        return between(Number(a), Number(b));
      },
      "data-parsley-range": (v) => {
        const parts = v.replace(/[\[\]]/g, "").split(",");
        return between(Number(parts[0]), Number(parts[1]));
      },
      "data-parsley-length": (v) => {
        const parts = v.replace(/[\[\]]/g, "").split(",");
        return between(Number(parts[0]), Number(parts[1]));
      },
      [`${prefix}-pattern`]: (v) => pattern(v),
      "hx-pattern": (v) => pattern(v),
      "pattern": (v) => pattern(v),
      "data-parsley-pattern": (v) => pattern(v),
      [`${prefix}-one-of`]: (v) => oneOf(v.split(",")),
      "hx-one-of": (v) => oneOf(v.split(",")),
      [`${prefix}-equalto`]: (v) => equalto(v),
      "hx-equalto": (v) => equalto(v),
      "data-parsley-equalto": (v) => equalto(v),
      "equalto": (v) => equalto(v),
      [`${prefix}-same-as`]: (v) => equalto(v),
      "hx-same-as": (v) => equalto(v)
    };
    Array.from(el.attributes).forEach(({ name: a, value: v }) => {
      const lowerName = a.toLowerCase();
      if (parseRules(lowerName, v, prefix, ruleFns, boolMap, paramMap, ctx, registry))
        return;
      if (parseMessages(lowerName, v, prefix, msgOverrides))
        return;
      if (parseBehavior(lowerName, v, prefix, opts, el, ruleFns, ctx))
        return;
      if (parseDisplay(lowerName, v, prefix, opts))
        return;
      if (parseRemote(lowerName, v, prefix, opts))
        return;
    });
    if (!opts.group && el && el.closest) {
      const groupAncestor = el.closest(`[${prefix}-group], [data-parsley-group], [hx-group]`);
      if (groupAncestor && groupAncestor !== el) {
        const gVal = groupAncestor.getAttribute(`${prefix}-group`) || groupAncestor.getAttribute("data-parsley-group") || groupAncestor.getAttribute("hx-group");
        if (gVal) {
          opts.group = gVal.includes(",") ? gVal.split(",").map((s) => s.trim()) : gVal;
        }
      }
    }
    const seenRules = /* @__PURE__ */ new Set();
    const uniqueRuleFns = [];
    ruleFns.forEach((fn) => {
      var _a;
      const name = ((_a = fn.meta) == null ? void 0 : _a.name) || fn._ruleName;
      if (name) {
        if (seenRules.has(name))
          return;
        seenRules.add(name);
      }
      uniqueRuleFns.push(fn);
    });
    const finalFns = Object.keys(msgOverrides).length ? uniqueRuleFns.map((fn) => {
      var _a;
      const name = ((_a = fn.meta) == null ? void 0 : _a.name) || fn._ruleName;
      const lowerName = name ? name.toLowerCase() : "";
      const customMsg = name && (msgOverrides[name] || msgOverrides[lowerName]);
      return customMsg ? withMessage(customMsg, fn) : fn;
    }) : uniqueRuleFns;
    return { ruleFns: finalFns, opts };
  }
  function bindFieldEl(el, ctrl, fOpts, ctx) {
    if (el.__hxBound)
      return;
    const app = ctx.app;
    const config = ctx.config;
    const prefix = resolvePrefix(ctx);
    const fid = ctrl.name || ctrl._id;
    el.__hxField = ctrl;
    if (!el.id)
      el.id = `hx-field-${fid}`;
    el.setAttribute("aria-invalid", "false");
    const trigger = fOpts.trigger || ctrl.updateOn || config.trigger;
    const mode = fOpts.mode || ctrl.mode || config.mode || null;
    let actualTrigger = trigger;
    if (mode) {
      if (mode === "submitOnly" || mode === "passive")
        actualTrigger = "submit";
      else if (mode === "aggressive")
        actualTrigger = "input";
      else if (mode === "lazy")
        actualTrigger = "blur";
      else if (mode === "eager" || mode === "hybrid")
        actualTrigger = "eager";
    }
    const debounceMs = fOpts.debounce != null ? fOpts.debounce : fOpts.remoteUrl ? config.debounce : 0;
    const remoteUrl = fOpts.remoteUrl || null;
    const remoteOpts = fOpts.remoteOpts || {};
    const dispOpts = {
      classHandler: fOpts.classHandler,
      errTarget: fOpts.errTarget,
      pendingText: fOpts.pendingText || "",
      silent: mode === "silent" || fOpts.silent || ctrl.silent || config.silent,
      showAllErrors: mode === "allErrors" ? true : mode === "firstError" ? false : fOpts.showAllErrors ?? ctrl.showAllErrors ?? config.showAllErrors
    };
    let _remoteTimer = null;
    let _eagerOn = false;
    let _hasValidated = false;
    function doValidate() {
      if (actualTrigger === "manual" || actualTrigger === "submit")
        return Promise.resolve(true);
      if (actualTrigger === "once" && _hasValidated)
        return Promise.resolve(true);
      if (actualTrigger === "dirty" && !ctrl.dirty.value)
        return Promise.resolve(true);
      if (actualTrigger === "touched" && !ctrl.touched.value)
        return Promise.resolve(true);
      return ctrl.validate().then(() => {
        _hasValidated = true;
        renderField(el, ctrl, fid, dispOpts, ctx);
        if (remoteUrl && ctrl.errors.value.length === 0 && !ctrl.disabled.value) {
          if (config.minChars && String(ctrl.value.value).length < config.minChars)
            return;
          if (_remoteTimer)
            clearTimeout(_remoteTimer);
          _remoteTimer = setTimeout(() => {
            _remoteTimer = null;
            const checkedValue = ctrl.value.value;
            ctrl.pending.value = true;
            renderField(el, ctrl, fid, dispOpts, ctx);
            runRemote(el, remoteUrl, checkedValue, remoteOpts, ctx).then((result) => {
              ctrl.pending.value = false;
              if (!result || result.aborted)
                return;
              if (ctrl.value.value !== checkedValue)
                return;
              if (!result.valid) {
                const msg = result.message || "Invalid value.";
                ctrl._remoteErrors.value = [{ message: msg, source: "remote", rule: null }];
              } else {
                ctrl._remoteErrors.value = [];
              }
              renderField(el, ctrl, fid, dispOpts, ctx);
            });
          }, debounceMs || config.debounce);
        }
      });
    }
    function readInputValue(e) {
      const t = e.target;
      if (t.type === "checkbox")
        return t.checked;
      if (t.type === "radio") {
        const rname = ctrl.name || el.getAttribute("name");
        const scope = el.form || el.closest("form") || document;
        const escapedRname = rname && typeof CSS !== "undefined" && CSS.escape ? CSS.escape(rname) : rname;
        const checked = escapedRname ? scope.querySelector(`input[type=radio][name="${escapedRname}"]:checked`) : t.checked ? t : null;
        return checked ? checked.value : "";
      }
      if (t.isContentEditable || t.value === void 0)
        return t.textContent;
      return t.value;
    }
    function onInput(e) {
      ctrl.value.value = readInputValue(e);
      if (ctrl._autoDirty)
        ctrl.dirty.value = true;
      if (actualTrigger === "input" || actualTrigger === "change" || actualTrigger === "always")
        doValidate();
      if (actualTrigger === "eager" && (_eagerOn || ctrl.touched.value)) {
        doValidate();
        _eagerOn = true;
      }
      if (actualTrigger === "dirty" || actualTrigger === "touched")
        doValidate();
    }
    function onBlur() {
      ctrl.touch();
      if (!_eagerOn && ctrl.errors.value.length > 0)
        _eagerOn = true;
      if (actualTrigger === "blur" || actualTrigger === "eager" || actualTrigger === "always" || actualTrigger === "once")
        doValidate();
      if (actualTrigger === "dirty" || actualTrigger === "touched")
        doValidate();
    }
    function onChange(e) {
      if (e.target.type === "radio" && !e.target.checked)
        return;
      ctrl.value.value = readInputValue(e);
      if (actualTrigger === "change" || actualTrigger === "always" || actualTrigger === "once")
        doValidate();
      if (actualTrigger === "dirty" || actualTrigger === "touched")
        doValidate();
    }
    el.addEventListener("input", onInput);
    el.addEventListener("blur", onBlur);
    el.addEventListener("change", onChange);
    const effect = app.effect(() => {
      el.disabled = ctrl.disabled.value;
      void ctrl._tagged.value;
      void ctrl.pending.value;
      void ctrl.touched.value;
      void ctrl.dirty.value;
      renderField(el, ctrl, fid, dispOpts, ctx);
    });
    ctx.allEffects.add(effect);
    ctx.boundFieldEls.add(el);
    if (config.validateOnMount && !ctrl._lazy)
      doValidate();
    const cleanup = () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("change", onChange);
      if (effect && effect.stop)
        effect.stop();
      ctx.allEffects.delete(effect);
      if (_remoteTimer)
        clearTimeout(_remoteTimer);
      if (ctx.remoteAborts.has(el)) {
        ctx.remoteAborts.get(el).abort();
        ctx.remoteAborts.delete(el);
      }
      if (!dispOpts.errTarget) {
        const span = document.getElementById(`hx-err-${fid}`);
        if (span && span === el.nextElementSibling)
          span.remove();
      }
      el.classList.remove(config.classes.valid, config.classes.invalid, config.classes.pending);
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
      el.removeAttribute(`data-${prefix}-pending`);
      delete el.__hxField;
      ctx.boundFieldEls.delete(el);
      el.__hxBound = false;
    };
    ctx.dirCleanups.set(el, cleanup);
    ctx.allCleanups.add(cleanup);
    el.__hxBound = true;
  }
  function scanForms(localContext, targetNode, force) {
    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    const formSelector = `[${prefix}-form], [data-parsley-validate], [hx-form]`;
    const formsToScan = [];
    if (targetNode) {
      if (targetNode.nodeType === 1) {
        if (force || targetNode.matches && targetNode.matches(formSelector)) {
          formsToScan.push(targetNode);
        }
        if (targetNode.querySelectorAll) {
          formsToScan.push(...targetNode.querySelectorAll(formSelector));
        }
      }
    } else {
      formsToScan.push(...document.querySelectorAll(formSelector));
    }
    formsToScan.forEach((formEl) => {
      if (ctx.formContextMap.has(formEl) || formEl.__hxAutoBound)
        return;
      const fieldDefs = {};
      formEl.querySelectorAll("[name]").forEach((input) => {
        const { ruleFns, opts: fOpts } = parseDataHx(input, ctx);
        if (!ruleFns.length && !fOpts.remoteUrl && !input.__hxField)
          return;
        const name = input.getAttribute("name");
        let initial;
        if (input.type === "checkbox") {
          initial = !!input.checked;
        } else if (input.type === "radio") {
          const scope = input.form || input.closest("form") || formEl;
          const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
          const checked = scope.querySelector(
            `input[type=radio][name="${escapedName}"]:checked`
          );
          initial = checked ? checked.value : "";
        } else {
          initial = input.value || "";
        }
        let ctrl;
        if (input.__hxField) {
          ctrl = input.__hxField;
          fieldDefs[name] = ctrl;
        } else {
          ctrl = field(initial, ruleFns, {
            name,
            trigger: fOpts.trigger,
            autoDirty: fOpts.autoDirty,
            lazy: fOpts.lazy,
            group: fOpts.group,
            message: fOpts.message
          }, ctx);
          fieldDefs[name] = ctrl;
        }
        bindFieldEl(input, ctrl, fOpts, ctx);
      });
      const f = form(fieldDefs, {}, ctx);
      f._el = formEl;
      ctx.formContextMap.set(formEl, f);
      ctx.autoForms.set(formEl, f);
      formEl.__hxAutoBound = true;
      const onFormSubmit = (e) => {
        e.preventDefault();
        f.submit();
      };
      formEl.addEventListener("submit", onFormSubmit);
      const cleanup = () => {
        formEl.removeEventListener("submit", onFormSubmit);
        ctx.autoForms.delete(formEl);
        ctx.autoFormCleanups.delete(formEl);
        ctx.formContextMap.delete(formEl);
        delete formEl.__hxAutoBound;
        if (typeof f._destroy === "function")
          f._destroy();
        ctx.allCleanups.delete(cleanup);
      };
      ctx.autoFormCleanups.set(formEl, cleanup);
      ctx.allCleanups.add(cleanup);
    });
  }
  function disposeFieldEl(fieldEl, localContext) {
    const fc = localContext.dirCleanups.get(fieldEl);
    if (fc) {
      fc();
      localContext.dirCleanups.delete(fieldEl);
      localContext.dirUpdaters.delete(fieldEl);
    }
  }
  function cleanupRemovedNode(node, localContext) {
    if (!node || node.nodeType !== 1)
      return;
    if (node.isConnected)
      return;
    const ctx = localContext || getCurrentContext();
    const prefix = resolvePrefix(ctx);
    if (ctx.autoFormCleanups.has(node))
      ctx.autoFormCleanups.get(node)();
    if (node.querySelectorAll) {
      node.querySelectorAll(`[${prefix}-form]`).forEach((f) => {
        if (ctx.autoFormCleanups.has(f))
          ctx.autoFormCleanups.get(f)();
      });
    }
    if (ctx.boundFieldEls.has(node)) {
      disposeFieldEl(node, ctx);
    }
    if (node.querySelectorAll) {
      node.querySelectorAll("*").forEach((child) => {
        if (ctx.boundFieldEls.has(child))
          disposeFieldEl(child, ctx);
      });
    }
  }
  const _raf = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
  const _caf = typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : clearTimeout;
  function scheduleScan(localContext, targetNode) {
    const ctx = localContext || getCurrentContext();
    if (targetNode)
      ctx._scanTargets.add(targetNode);
    if (ctx._scanScheduled)
      return;
    ctx._scanScheduled = true;
    ctx._scanHandle = _raf(() => {
      ctx._scanScheduled = false;
      ctx._scanHandle = null;
      const targets = Array.from(ctx._scanTargets);
      ctx._scanTargets.clear();
      if (targets.length) {
        targets.forEach((t) => scanForms(ctx, t));
      } else {
        scanForms(ctx);
      }
    });
  }
  function startObserver(options, localContext) {
    const ctx = localContext || getCurrentContext();
    if (options.observe && typeof MutationObserver !== "undefined") {
      const prefix = resolvePrefix(ctx);
      ctx._autoFormObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.removedNodes)
            cleanupRemovedNode(node, ctx);
        }
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1)
              continue;
            let hasForm = false;
            if (node.matches && node.matches(`[${prefix}-form]`)) {
              hasForm = true;
            } else if (node.querySelector && node.querySelector(`[${prefix}-form]`)) {
              hasForm = true;
            }
            if (hasForm) {
              scheduleScan(ctx, node);
            }
          }
        }
      });
      ctx._autoFormObserver.observe(document.body, { childList: true, subtree: true });
    }
  }
  function stopObserver(localContext) {
    const ctx = localContext || getCurrentContext();
    if (!ctx)
      return;
    if (ctx._autoFormObserver) {
      ctx._autoFormObserver.disconnect();
      ctx._autoFormObserver = null;
    }
    if (ctx._scanScheduled && ctx._scanHandle != null) {
      _caf(ctx._scanHandle);
      ctx._scanScheduled = false;
      ctx._scanHandle = null;
    }
    ctx._scanTargets.clear();
  }
  const validateDirective = {
    mounted(el, binding) {
      const localContext = getContextFromBinding(binding);
      const app = localContext.app;
      localContext.config;
      resolvePrefix(app);
      let bindVal = binding.value;
      if (bindVal && typeof bindVal === "object") {
        if (typeof app.isRef === "function" && app.isRef(bindVal)) {
          bindVal = bindVal.value;
        } else if (bindVal.__isRef || bindVal.__v_isRef) {
          bindVal = bindVal.value;
        }
      }
      let ctrl, dOpts = {};
      let parentForm = null;
      if (binding.instance) {
        let inst = binding.instance;
        while (inst) {
          if (inst.provides && inst.provides["$form"]) {
            parentForm = inst.provides["$form"];
            break;
          }
          inst = inst.parent;
        }
      }
      if (!parentForm) {
        parentForm = getFormFromEl(el, localContext);
      }
      const name = el.getAttribute("name") || el.getAttribute("id");
      let resolvedField = null;
      if (typeof bindVal === "string") {
        if (bindVal.includes(".fields.")) {
          const parts = bindVal.split(".fields.");
          const formName = parts[0];
          const fieldPath = parts[1];
          const targetForm = parentForm && parentForm.name === formName ? parentForm : null;
          if (targetForm) {
            resolvedField = targetForm.field(fieldPath);
          }
        } else if (parentForm) {
          resolvedField = parentForm.field(bindVal);
        }
      } else if (!bindVal && name && parentForm) {
        resolvedField = parentForm.field(name);
      }
      if (bindVal && bindVal._type === "field") {
        ctrl = bindVal;
        ctrl.name || ctrl._id;
        const parsed = parseDataHx(el, localContext, createLookupRegistry(ctrl, localContext));
        if (parsed.ruleFns.length)
          ctrl.addRule(parsed.ruleFns);
        dOpts = parsed.opts;
        if (dOpts.message && !ctrl.message)
          ctrl.message = dOpts.message;
      } else if (resolvedField) {
        ctrl = resolvedField;
        ctrl.name || ctrl._id;
        const parsed = parseDataHx(el, localContext, createLookupRegistry(ctrl, localContext));
        if (parsed.ruleFns.length)
          ctrl.addRule(parsed.ruleFns);
        dOpts = parsed.opts;
        if (dOpts.message && !ctrl.message)
          ctrl.message = dOpts.message;
      } else {
        const parsed = parseDataHx(el, localContext, parentForm ? createLookupRegistry(parentForm, localContext) : null);
        let rFns = parsed.ruleFns.slice();
        if (typeof bindVal === "string" && !bindVal.includes(".fields.")) {
          rFns = normalizeRules(bindVal, parentForm ? createLookupRegistry(parentForm, localContext) : localContext._registry).concat(rFns);
        }
        const fieldName = name || `hxv${localContext.seq + 1}`;
        dOpts = parsed.opts;
        let initial;
        if (el.type === "checkbox") {
          initial = !!el.checked;
        } else if (el.type === "radio") {
          const scope = el.form || el.closest("form") || document;
          const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(fieldName) : fieldName;
          const checked = scope.querySelector(
            `input[type=radio][name="${escapedName}"]:checked`
          );
          initial = checked ? checked.value : "";
        } else if (el.isContentEditable) {
          initial = el.textContent || "";
        } else {
          initial = el.value || "";
        }
        ctrl = field(initial, rFns, {
          name: fieldName,
          trigger: dOpts.trigger,
          autoDirty: dOpts.autoDirty,
          lazy: dOpts.lazy,
          group: dOpts.group,
          message: dOpts.message
        }, localContext);
        if (parentForm && !parentForm.fields[fieldName] && !dOpts.excluded) {
          parentForm.add(fieldName, ctrl);
        }
      }
      bindFieldEl(el, ctrl, dOpts, localContext);
      localContext.dirUpdaters.set(el, (newB) => {
        const nv = newB.value;
        if (nv && nv._type === "field" && nv !== ctrl) {
          ctrl = nv;
          el.__hxField = ctrl;
          ctrl.name || ctrl._id;
        }
      });
    },
    updated(el, binding) {
      const localContext = getContextFromBinding(binding);
      const u = localContext.dirUpdaters.get(el);
      if (u)
        u(binding);
    },
    unmounted(el, binding) {
      const localContext = getContextFromBinding(binding);
      const cleanup = localContext.dirCleanups.get(el);
      if (cleanup) {
        cleanup();
        localContext.dirCleanups.delete(el);
        localContext.dirUpdaters.delete(el);
      }
    }
  };
  function tryBindForm(el, binding) {
    if (el.__hxFormBound)
      return;
    const localContext = getContextFromBinding(binding);
    const app = localContext.app;
    const raw = binding.value;
    const f = typeof raw === "string" && app && typeof app.resolvePath === "function" ? app.resolvePath(raw, binding.ctx) : raw;
    if (!f)
      return;
    if (f._type !== "form") {
      console.warn("[Helix Validation] hx-form: binding must be a Form.");
      return;
    }
    localContext.formContextMap.set(el, f);
    if (app.provide)
      app.provide("$validate.context", f);
    f._el = el;
    if (binding.instance) {
      let inst = binding.instance;
      if (!inst.provides || inst.provides === (inst.parent ? inst.parent.provides : null)) {
        inst.provides = Object.create(inst.parent ? inst.parent.provides : null);
      }
      inst.provides["$form"] = f;
    }
    function onSubmit(e) {
      e.preventDefault();
      f.submit();
    }
    el.addEventListener("submit", onSubmit);
    const prefix = resolvePrefix(app);
    const effect = app.effect(() => {
      if (f.submitting.value) {
        el.setAttribute(`${prefix}-submitting`, "");
        el.querySelectorAll(`[type=submit]:not([${prefix}-no-disable])`).forEach((btn) => {
          btn.disabled = true;
        });
      } else {
        el.removeAttribute(`${prefix}-submitting`);
        el.querySelectorAll(`[type=submit]:not([${prefix}-no-disable])`).forEach((btn) => {
          btn.disabled = false;
        });
      }
    });
    localContext.allEffects.add(effect);
    const cleanup = () => {
      el.removeEventListener("submit", onSubmit);
      if (effect && effect.stop)
        effect.stop();
      localContext.allEffects.delete(effect);
      localContext.formContextMap.delete(el);
      localContext.allCleanups.delete(cleanup);
      el.__hxFormBound = false;
    };
    localContext.dirCleanups.set(el, cleanup);
    localContext.allCleanups.add(cleanup);
    el.__hxFormBound = true;
  }
  const formDirective = {
    mounted(el, binding) {
      tryBindForm(el, binding);
    },
    updated(el, binding) {
      tryBindForm(el, binding);
    },
    unmounted(el, binding) {
      const localContext = getContextFromBinding(binding);
      const cleanup = localContext.dirCleanups.get(el);
      if (cleanup) {
        cleanup();
        localContext.dirCleanups.delete(el);
      }
    }
  };
  function tryBindList(el, binding) {
    if (el.__hxListBound)
      return;
    const localContext = getContextFromBinding(binding);
    const app = localContext.app;
    const raw = binding.value;
    const l = typeof raw === "string" && app && typeof app.resolvePath === "function" ? app.resolvePath(raw, binding.ctx) : raw;
    if (!l)
      return;
    if (l._type !== "list") {
      console.warn("[Helix Validation] hx-list: binding must be a FieldList.");
      return;
    }
    const prefix = resolvePrefix(app);
    const tmpl = el.querySelector(`[${prefix}-list-item-template]`);
    if (!tmpl) {
      console.warn(`[Helix Validation] hx-list: no [${prefix}-list-item-template] template found.`);
      return;
    }
    tmpl.style.display = "none";
    function render() {
      el.querySelectorAll(`[${prefix}-list-item]`).forEach((n) => n.remove());
      l.items.value.forEach((itemCtrl, index) => {
        const clone = tmpl.cloneNode(true);
        clone.removeAttribute(`${prefix}-list-item-template`);
        clone.style.display = "";
        clone.setAttribute(`${prefix}-list-item`, String(index));
        clone.__hxListItem = itemCtrl;
        clone.__hxListIndex = index;
        clone.querySelectorAll(`[${prefix}-remove]`).forEach((btn) => {
          btn.addEventListener("click", () => l.remove(index));
        });
        el.insertBefore(clone, tmpl);
      });
    }
    render();
    const effect = app.effect(() => {
      void l.items.value.length;
      render();
    });
    localContext.allEffects.add(effect);
    const cleanup = () => {
      if (effect && effect.stop)
        effect.stop();
      localContext.allEffects.delete(effect);
      localContext.allCleanups.delete(cleanup);
      el.__hxListBound = false;
    };
    localContext.dirCleanups.set(el, cleanup);
    localContext.allCleanups.add(cleanup);
    el.__hxListBound = true;
  }
  const listDirective = {
    mounted(el, binding) {
      tryBindList(el, binding);
    },
    updated(el, binding) {
      tryBindList(el, binding);
    },
    unmounted(el, binding) {
      const localContext = getContextFromBinding(binding);
      const cleanup = localContext.dirCleanups.get(el);
      if (cleanup) {
        cleanup();
        localContext.dirCleanups.delete(el);
      }
    }
  };
  function registerDirectives(app, options) {
    app.directive("validate", validateDirective);
    app.directive("rule", validateDirective);
    app.directive("rules", validateDirective);
    app.directive("form", formDirective);
    app.directive("list", listDirective);
  }
  function useForm() {
    const localContext = getCurrentContext();
    if (!localContext)
      return null;
    const app = localContext.app;
    if (app && app.inject) {
      try {
        return app.inject("$form");
      } catch (_) {
      }
    }
    if (typeof window !== "undefined" && window.Helix && typeof window.Helix.getCurrentInstance === "function") {
      const inst = window.Helix.getCurrentInstance();
      if (inst && inst.provides && inst.provides["$form"]) {
        return inst.provides["$form"];
      }
    }
    return null;
  }
  const HelixValidationPlugin = {
    name: "validation",
    version: "2.1.5",
    requires: { helix: ">=11.1.5" },
    install(app, options = {}) {
      if (app[INSTALL_MARK]) {
        console.warn("[Helix Validation] already installed; skipping.");
        return () => {
        };
      }
      const config = getDefaultConfig(options);
      const localRules = createRuleRegistry(new Map(_registry));
      const localRegistry = localRules._registry;
      const localContext = {
        app,
        config,
        uid: () => {
          localContext.seq = (localContext.seq || 0) + 1;
          return `hxv${localContext.seq}`;
        },
        seq: 0,
        _registry: localRegistry,
        allCleanups: /* @__PURE__ */ new Set(),
        allEffects: /* @__PURE__ */ new Set(),
        formContextMap: /* @__PURE__ */ new WeakMap(),
        autoForms: /* @__PURE__ */ new Map(),
        autoFormCleanups: /* @__PURE__ */ new Map(),
        boundFieldEls: /* @__PURE__ */ new Set(),
        remoteAborts: /* @__PURE__ */ new WeakMap(),
        dirCleanups: /* @__PURE__ */ new WeakMap(),
        dirUpdaters: /* @__PURE__ */ new WeakMap(),
        _scanScheduled: false,
        _scanHandle: null,
        _scanTargets: /* @__PURE__ */ new Set(),
        _autoFormObserver: null,
        scanForms,
        beforeRuleMiddlewares: [],
        afterRuleMiddlewares: [],
        beforeRenderMiddlewares: [],
        afterRenderMiddlewares: []
      };
      setActiveContext(localContext);
      appContexts.set(app, localContext);
      registerDirectives(app);
      startObserver(options, localContext);
      const boundScan = () => scanForms(localContext);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boundScan);
      } else {
        boundScan();
      }
      const $validation = {
        _context: localContext,
        field,
        form,
        list,
        // schema,
        // create,
        useForm,
        registerUI,
        rules: localRules,
        required,
        email,
        url,
        trim,
        lowercase,
        numeric,
        integer,
        minLength,
        maxLength,
        min,
        max,
        between,
        pattern,
        sameAs,
        equalto,
        equalTo: equalto,
        oneOf,
        helpers,
        withMessage,
        withAsync,
        requiredIf,
        requiredUnless,
        or,
        and,
        not,
        each,
        i18n,
        transform,
        compose,
        composeAsync,
        composeAsyncSequential,
        check,
        getForm: (sel) => getForm(sel, localContext),
        config,
        version: "2.1.5",
        STATUS,
        EVENTS,
        use(plugin) {
          if (plugin) {
            if (plugin.beforeRule && !localContext.beforeRuleMiddlewares.includes(plugin.beforeRule)) {
              localContext.beforeRuleMiddlewares.push(plugin.beforeRule);
            }
            if (plugin.afterRule && !localContext.afterRuleMiddlewares.includes(plugin.afterRule)) {
              localContext.afterRuleMiddlewares.push(plugin.afterRule);
            }
            if (plugin.beforeRender && !localContext.beforeRenderMiddlewares.includes(plugin.beforeRender)) {
              localContext.beforeRenderMiddlewares.push(plugin.beforeRender);
            }
            if (plugin.afterRender && !localContext.afterRenderMiddlewares.includes(plugin.afterRender)) {
              localContext.afterRenderMiddlewares.push(plugin.afterRender);
            }
          }
          return this;
        },
        unuse(plugin) {
          if (plugin) {
            if (plugin.beforeRule) {
              localContext.beforeRuleMiddlewares = localContext.beforeRuleMiddlewares.filter((mw) => mw !== plugin.beforeRule);
            }
            if (plugin.afterRule) {
              localContext.afterRuleMiddlewares = localContext.afterRuleMiddlewares.filter((mw) => mw !== plugin.afterRule);
            }
            if (plugin.beforeRender) {
              localContext.beforeRenderMiddlewares = localContext.beforeRenderMiddlewares.filter((mw) => mw !== plugin.beforeRender);
            }
            if (plugin.afterRender) {
              localContext.afterRenderMiddlewares = localContext.afterRenderMiddlewares.filter((mw) => mw !== plugin.afterRender);
            }
          }
          return this;
        }
      };
      const GlobalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || (typeof Helix !== "undefined" ? Helix : null);
      if (GlobalHelix) {
        GlobalHelix.$validation = $validation;
        GlobalHelix.validation = $validation;
      }
      app.$validation = $validation;
      app[INSTALL_MARK] = true;
      if (app.provide)
        app.provide("$validation", $validation);
      return () => {
        stopObserver(localContext);
        document.removeEventListener("DOMContentLoaded", boundScan);
        Array.from(localContext.allCleanups).forEach((fn) => fn());
        localContext.allCleanups.clear();
        localContext.allEffects.forEach((e) => {
          if (e && e.stop)
            e.stop();
        });
        localContext.allEffects.clear();
        localContext.autoForms.clear();
        localContext.autoFormCleanups.clear();
        localContext.boundFieldEls.clear();
        if (GlobalHelix) {
          if (GlobalHelix.$validation === $validation)
            delete GlobalHelix.$validation;
          if (GlobalHelix.validation === $validation)
            delete GlobalHelix.validation;
        }
        if (app.removeDirective) {
          app.removeDirective("validate");
          app.removeDirective("rule");
          app.removeDirective("rules");
          app.removeDirective("form");
          app.removeDirective("list");
        } else {
          console.warn("[Helix Validation] This Helix core build has no app.removeDirective(); the validation directives remain registered after teardown.");
        }
        if (app.$validation === $validation)
          delete app.$validation;
        delete app[INSTALL_MARK];
        appContexts.delete(app);
      };
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixValidationPlugin = HelixValidationPlugin;
  exports.EVENTS = EVENTS;
  exports.STATUS = STATUS;
  exports.and = and;
  exports.between = between;
  exports.check = check;
  exports.compose = compose;
  exports.composeAsync = composeAsync;
  exports.composeAsyncSequential = composeAsyncSequential;
  exports.default = HelixValidationPlugin;
  exports.each = each;
  exports.email = email;
  exports.equalto = equalto;
  exports.field = field;
  exports.form = form;
  exports.helpers = helpers;
  exports.i18n = i18n;
  exports.integer = integer;
  exports.list = list;
  exports.lowercase = lowercase;
  exports.max = max;
  exports.maxLength = maxLength;
  exports.min = min;
  exports.minLength = minLength;
  exports.not = not;
  exports.numeric = numeric;
  exports.oneOf = oneOf;
  exports.or = or;
  exports.pattern = pattern;
  exports.registerUI = registerUI;
  exports.required = required;
  exports.requiredIf = requiredIf;
  exports.requiredUnless = requiredUnless;
  exports.sameAs = sameAs;
  exports.transform = transform;
  exports.trim = trim;
  exports.url = url;
  exports.useForm = useForm;
  exports.withAsync = withAsync;
  exports.withMessage = withMessage;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixValidationPlugin = this.HelixValidationPlugin || {});
