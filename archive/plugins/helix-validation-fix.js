(function (exports) {
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
    const getDefaultConfig = (options = {}) => ({
        trigger: options.trigger ?? "blur",
        debounce: options.debounce ?? 300,
        priorityEnabled: options.priorityEnabled ?? true,
        validateOnMount: options.validateOnMount ?? false,
        showAllErrors: options.showAllErrors ?? false,
        minChars: options.minChars ?? 0,
        classes: Object.assign(
            { valid: "hx-valid", invalid: "hx-invalid", pending: "hx-validating" },
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
        oneOf: ({ p }) => `Must be one of: ${(p.values || []).join(", ")}.`
    };
    function parseRuleStr(str, registry2) {
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
        const reg = registry2 || _registry;
        return rules2.reduce((acc, ruleStr) => {
            const colonIdx = ruleStr.indexOf(":");
            if (colonIdx === -1) {
                const name2 = ruleStr.trim();
                if (!name2)
                    return acc;
                const meta2 = reg.get(name2);
                if (!meta2) {
                    console.warn(`[Helix Validation] Unknown rule: "${name2}"`);
                    return acc;
                }
                const isFactory2 = !!meta2.fn._isRuleFactory;
                if (isFactory2) {
                    console.warn(`[Helix Validation] Rule "${name2}" requires arguments (e.g. "${name2}:1") and was skipped.`);
                    return acc;
                }
                const fn2 = meta2.fn;
                if (!fn2._priority)
                    fn2._priority = meta2.priority;
                return acc.concat(fn2);
            }
            const name = ruleStr.slice(0, colonIdx).trim();
            const argPart = ruleStr.slice(colonIdx + 1);
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
            const meta = reg.get(name);
            if (!meta) {
                console.warn(`[Helix Validation] Unknown rule: "${name}"`);
                return acc;
            }
            const isFactory = !!meta.fn._isRuleFactory;
            let fn;
            if (isFactory) {
                if (parsedArgs.length === 0 || parsedArgs.length === 1 && parsedArgs[0] === "") {
                    console.warn(`[Helix Validation] Rule "${name}" expects parameters, but none were provided.`);
                }
                const produced = meta.fn(...parsedArgs);
                if (typeof produced === "function") {
                    fn = produced;
                } else {
                    console.warn(`[Helix Validation] Rule "${name}" did not return a validator; ignoring args.`);
                    fn = meta.fn;
                }
            } else {
                console.warn(`[Helix Validation] Rule "${name}" takes no arguments; ignoring them.`);
                fn = meta.fn;
            }
            if (!fn._priority)
                fn._priority = meta.priority;
            return acc.concat(fn);
        }, []);
    }
    function warnUnconfiguredFactory(fn) {
        console.warn("[Helix Validation] A parameterized rule was passed without being called (e.g. use minLength(3) instead of minLength). It was skipped.");
        return [];
    }
    function normalizeRules(r, registry2) {
        let resolved = [];
        if (!r)
            resolved = [];
        else if (typeof r === "string")
            resolved = parseRuleStr(r, registry2);
        else if (typeof r === "function")
            resolved = r._isRuleFactory ? warnUnconfiguredFactory() : [r];
        else if (Array.isArray(r)) {
            resolved = r.reduce((acc, item) => {
                if (typeof item === "string")
                    return acc.concat(parseRuleStr(item, registry2));
                if (typeof item === "function")
                    return item._isRuleFactory ? acc.concat(warnUnconfiguredFactory()) : acc.concat(item);
                return acc;
            }, []);
        }
        const seen = /* @__PURE__ */ new Set();
        return resolved.filter((fn) => {
            if (!fn)
                return false;
            if (fn._ruleName && fn._ruleName !== "transform") {
                if (seen.has(fn._ruleName))
                    return false;
                seen.add(fn._ruleName);
            }
            return true;
        });
    }
    function runRules(ctrl, ruleFns, value) {
        const config = ctrl._context.config;
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
        const ctx = {
            field: ctrl._type === "field" ? ctrl : null,
            form: ctrl._parent && ctrl._parent._type === "form" ? ctrl._parent : null,
            parent,
            root: root2,
            path,
            index: nearestIndex,
            formValues: () => root2 && root2.values ? root2.values() : null,
            signal: controller.signal,
            _context: ctrl._context
        };
        const sortedRules = [...ruleFns].sort((a, b) => {
            const pa = a._priority != null ? a._priority : 1;
            const pb = b._priority != null ? b._priority : 1;
            return pb - pa;
        });
        const tagged = [];
        const errors = [];
        let currentValue = value;
        let hasTransform = false;
        let finalTransformedValue = value;
        return sortedRules.reduce((chain, rule) => {
            return chain.then((stop) => {
                if (stop && config.priorityEnabled)
                    return true;
                if (ctrl._runId !== runId)
                    return true;
                return Promise.resolve(rule(currentValue, ctx)).then((res) => {
                    if (ctrl._runId !== runId)
                        return true;
                    if (res && typeof res === "object" && res.transform) {
                        currentValue = res.value;
                        finalTransformedValue = res.value;
                        hasTransform = true;
                        return false;
                    }
                    if (res !== null) {
                        if (rule._isEach && typeof res === "object") {
                            Object.entries(res).forEach(([i, msg]) => {
                                tagged.push({ message: msg, source: "rule", rule: rule._ruleName || null, index: Number(i) });
                                errors.push(msg);
                            });
                        } else if (typeof res === "string") {
                            tagged.push({ message: res, source: "rule", rule: rule._ruleName || null });
                            errors.push(res);
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
                    const msg = "Validation error.";
                    tagged.push({ message: msg, source: "rule", rule: rule._ruleName || null });
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
        return ctx.formContextMap.get(el) || ctx.autoForms.get(el) || null;
    }
    const _registry = /* @__PURE__ */ new Map();
    const rules = {
        add(name, fn, meta) {
            if (typeof name !== "string" || typeof fn !== "function")
                return;
            _registry.set(name, { fn, priority: meta && meta.priority || 1 });
        },
        remove(name) {
            _registry.delete(name);
        },
        get(name) {
            return _registry.get(name) || null;
        },
        has(name) {
            return _registry.has(name);
        },
        list() {
            return Array.from(_registry.keys());
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
    rules.add("required", required);
    rules.add("email", email);
    rules.add("url", url);
    rules.add("pattern", pattern);
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
    rules.add("oneOf", oneOf);
    function withMessage(message, ruleFn) {
        const fn = (value, ctx) => {
            const result = ruleFn(value, ctx);
            const transform2 = (r) => {
                if (r === null)
                    return null;
                return typeof message === "function" ? message({ value, params: ruleFn._params || {}, rule: ruleFn._ruleName }) : message;
            };
            return result && typeof result.then === "function" ? result.then(transform2) : transform2(result);
        };
        fn._ruleName = ruleFn._ruleName;
        fn._priority = ruleFn._priority || 1;
        fn._params = ruleFn._params;
        return fn;
    }
    function withAsync(asyncFn, optionsOrDeps) {
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
                    return result;
                });
            }
            const signal = ctx && ctx.signal ? ctx.signal : void 0;
            return asyncFn(value, signal, ctx);
        };
        fn._priority = asyncFn._priority || 0;
        fn._deps = deps;
        fn._isAsync = true;
        return fn;
    }
    function requiredIf(condition) {
        const fn = (v, ctx) => {
            const on = typeof condition === "function" ? condition() : condition && condition.value !== void 0 ? condition.value : !!condition;
            return on && isEmpty(v) ? resolveMsg("required", {}, v, ctx) : null;
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
        fn._ruleName = "requiredUnless";
        fn._priority = 32;
        return fn;
    }
    function or(...ruleFns) {
        const fn = (v, ctx) => Promise.all(ruleFns.map((r) => Promise.resolve(r(v, ctx)))).then((results) => {
            return results.some((r) => r === null) ? null : results.find((r) => r !== null) || "Invalid value.";
        });
        fn._priority = ruleFns.length ? Math.min(...ruleFns.map((r) => r._priority || 1)) : 1;
        return fn;
    }
    function and(...ruleFns) {
        const fn = (v, ctx) => ruleFns.reduce(
            (chain, r) => chain.then((acc) => acc !== null ? acc : Promise.resolve(r(v, ctx))),
            Promise.resolve(null)
        );
        fn._priority = ruleFns.length ? Math.min(...ruleFns.map((r) => r._priority || 1)) : 1;
        return fn;
    }
    function not(ruleFn, message = "Invalid value.") {
        const fn = (v, ctx) => Promise.resolve(ruleFn(v, ctx)).then((r) => r === null ? message : null);
        fn._priority = ruleFn._priority || 1;
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
        fn._priority = 1;
        fn._isEach = true;
        return fn;
    }
    function i18n({ t, path }) {
        const resolvePath = path || (({ rule }) => `validation.${rule}`);
        return (ruleFn) => withMessage(
            ({ value: v, params, rule }) => t(resolvePath({ rule: ruleFn._ruleName || rule, value: v, params }), params || {}),
            ruleFn
        );
    }
    function transform(transformFn) {
        const fn = (v, ctx) => {
            return { transform: true, value: transformFn(v, ctx) };
        };
        fn._ruleName = "transform";
        fn._priority = 100;
        return fn;
    }
    const helpers = { withMessage, withAsync, requiredIf, requiredUnless, or, and, not, each, i18n, transform };
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
    function field(initialValue, ruleDefs, opts, localContext) {
        const ctx = localContext || getCurrentContext();
        const app = ctx.app;
        const config = ctx.config;
        opts = opts || {};
        const _id = ctx.uid();
        const value = app.ref(initialValue !== void 0 ? initialValue : "");
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
        const errors = app.computed(() => _tagged.value.map((t) => t.message));
        const valid = app.computed(() => errors.value.length === 0 && !pending.value);
        const invalid = app.computed(() => !valid.value);
        const pristine = app.computed(() => !dirty.value);
        const enabled = app.computed(() => !disabled.value);
        const status = app.computed(() => {
            if (disabled.value)
                return "DISABLED";
            if (pending.value)
                return "PENDING";
            if (errors.value.length > 0)
                return "INVALID";
            return "VALID";
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
        const stopDirty = app.watch(value, () => {
            if (!dirty.value) {
                dirty.value = true;
                emitter.emit({ type: "dirty" });
            }
            emitter.emit({ type: "change", value: value.value });
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
            emitter.emit({ type: "change", value: val });
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
        const enable = () => {
            disabled.value = false;
            emitter.emit({ type: "status", status: "VALID" });
        };
        const disable = () => {
            disabled.value = true;
            emitter.emit({ type: "status", status: "DISABLED" });
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
        let _ruleFns = normalizeRules(ruleDefs, ctx._registry);
        const setRules = (r) => {
            _ruleFns = normalizeRules(r, ctx._registry);
        };
        const addRule = (r) => {
            _ruleFns = _ruleFns.concat(normalizeRules(r, ctx._registry));
        };
        const removeRule = (r) => {
            if (typeof r === "string")
                _ruleFns = _ruleFns.filter((fn) => fn._ruleName !== r);
            else
                _ruleFns = _ruleFns.filter((fn) => fn !== r);
        };
        const hasRule = (r) => _ruleFns.some((fn) => typeof r === "string" ? fn._ruleName === r : fn === r);
        const validate = () => {
            if (disabled.value)
                return Promise.resolve(true);
            if (opts.lazy && !touched.value && !dirty.value)
                return Promise.resolve(true);
            emitter.emit("beforeValidate");
            pending.value = true;
            return runRules(_f, _ruleFns, value.value).then((result) => {
                if (result === null) {
                    return !invalid.value;
                }
                _ruleErrors.value = result.tagged;
                const isValid = errors.value.length === 0;
                emitter.emit({ type: "validated", valid: isValid });
                emitter.emit("afterValidate", { valid: isValid, errors: errors.value });
                return isValid;
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
        const _f = {
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
                return _ruleFns;
            },
            name: opts.name || null,
            updateOn: opts.updateOn || opts.trigger || config.trigger,
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
            validate,
            _destroy
        };
        return _f;
    }
    function form(fieldDefs, opts, localContext) {
        let _f;
        const ctx = localContext || getCurrentContext();
        const app = ctx.app;
        const config = ctx.config;
        opts = opts || {};
        const _id = ctx.uid();
        const submitting = app.ref(false);
        const submitted = app.ref(false);
        const submitAttempted = app.ref(false);
        const error = app.ref(null);
        const hasError = app.computed(() => !!error.value);
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
        const status = app.computed(() => {
            if (pending.value)
                return "PENDING";
            if (invalid.value)
                return "INVALID";
            return "VALID";
        });
        const $valid = app.computed(() => {
            void _fieldsVersion.value;
            return Object.values(_fields).every((c) => c.$valid.value);
        });
        let _crossValidators = normalizeRules(opts.validators || [], ctx._registry);
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
            } else if (def && typeof def === "object") {
                ctrl = form(def, {}, ctx);
            } else {
                ctrl = field(def, [], {}, ctx);
            }
            _registerField(name, ctrl);
        });
        function getField(path) {
            if (path == null)
                return null;
            const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
            let cur = _f;
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
        const values = () => {
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
            const out = {};
            Object.keys(_fields).forEach((k) => {
                const c = _fields[k];
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
            const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
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
            emitter.emit({ type: "reset" });
        };
        const touch = (opts2) => {
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
            const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
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
            opts2 = opts2 || {};
            const group = opts2.group;
            const fieldsToValidate = Array.isArray(opts2) ? opts2 : opts2.fields;
            let ctrls = Object.values(_fields);
            emitter.emit("beforeValidate");
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
            if (!group && !fieldsToValidate) {
                Object.values(_fields).forEach((c) => {
                    if (c._crossErrors)
                        c._crossErrors.value = [];
                });
            }
            const fieldPromises = ctrls.map((c) => c.validate ? c.validate() : Promise.resolve(true));
            return Promise.all(fieldPromises).then((results) => {
                const allValid = results.every(Boolean);
                let checkCross;
                if (group || !_crossValidators.length) {
                    checkCross = Promise.resolve(allValid);
                } else {
                    const vals = values();
                    checkCross = _crossValidators.reduce(
                        (chain, xv) => chain.then((passing) => {
                            if (!passing)
                                return false;
                            return Promise.resolve(xv(vals, _f)).then((errs) => {
                                if (!errs)
                                    return true;
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
                                Object.keys(schemaRes.errors).forEach((path) => {
                                    const c = getField(path);
                                    if (c)
                                        c.setErrors(schemaRes.errors[path]);
                                });
                                emitter.emit("afterValidate", { valid: false });
                                return false;
                            }
                            emitter.emit("afterValidate", { valid: finalValid });
                            return finalValid;
                        });
                    }
                    emitter.emit("afterValidate", { valid: finalValid });
                    return finalValid;
                });
            });
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
        const submit = () => {
            submitAttempted.value = true;
            touchAll();
            emitter.emit("beforeSubmit");
            emitter.emit({ type: "submit" });
            return validate().then((ok) => {
                if (!ok) {
                    if (opts.onInvalid)
                        opts.onInvalid(values(), _f);
                    emitter.emit({ type: "invalid" });
                    return;
                }
                submitting.value = true;
                emitter.emit({ type: "submitting" });
                const afterSubmit = opts.onSubmit ? Promise.resolve(opts.onSubmit(values(), _f)) : Promise.resolve();
                return afterSubmit.then(() => {
                    submitted.value = true;
                    emitter.emit({ type: "submitted" });
                    emitter.emit("afterSubmit", { valid: true });
                    if (opts.resetOnSubmit)
                        reset();
                }).catch((err) => {
                    emitter.emit({ type: "error", error: err });
                    emitter.emit("afterSubmit", { valid: false, error: err });
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
            field: getField,
            get,
            exists,
            values,
            rawValues,
            set,
            patch,
            reset,
            touch,
            touchAll,
            add,
            remove: removeAtPath,
            has,
            setErrors,
            setError,
            clearError,
            validate,
            submit,
            bind,
            on: emitter.on,
            _destroy
        };
        Object.values(_fields).forEach((c) => {
            if (c) {
                c._parent = _f;
                _setupDependencyWatcher(c);
            }
        });
        return _f;
    }
    function list(initialItems, validators, localContext) {
        let _l;
        const ctx = localContext || getCurrentContext();
        const app = ctx.app;
        const _id = ctx.uid();
        const initial = Array.isArray(initialItems) ? initialItems.slice() : [];
        const items = app.ref(initial);
        const length = app.computed(() => items.value.length);
        const errors = app.ref([]);
        const _tagged = app.ref([]);
        const valid = app.computed(
            () => items.value.every((c) => c.valid.value) && errors.value.length === 0
        );
        const invalid = app.computed(() => !valid.value);
        const pending = app.computed(() => items.value.some((c) => c.pending.value));
        const $valid = app.computed(
            () => items.value.every((c) => c.$valid.value) && errors.value.length === 0
        );
        let _validators = normalizeRules(validators || [], ctx._registry);
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
        const clear = () => {
            items.value.forEach((c) => {
                if (c && c._destroy)
                    c._destroy();
            });
            items.value = [];
        };
        const set = (i, c) => {
            c._parent = _l;
            const a = items.value.slice();
            a[i] = c;
            items.value = a;
        };
        const values = () => items.value.map((c) => c._type === "form" ? c.values() : c.value.value);
        const rawValues = () => items.value.map((c) => c._type === "form" ? c.rawValues() : c.value.value);
        const touchAll = () => {
            items.value.forEach((c) => {
                if (c.touchAll)
                    c.touchAll();
                else if (c.touch)
                    c.touch({ self: true });
            });
        };
        const validate = () => {
            return Promise.all(items.value.map((c) => c.validate ? c.validate() : Promise.resolve(true))).then((itemsOK) => {
                const allItemsValid = itemsOK.every(Boolean);
                if (!_validators.length) {
                    errors.value = [];
                    _tagged.value = [];
                    return allItemsValid;
                }
                return runRules(_l, _validators, values()).then((result) => {
                    if (!result)
                        return allItemsValid;
                    const listTagged = result.tagged.map((t) => ({ ...t, source: "list" }));
                    _tagged.value = listTagged;
                    errors.value = listTagged.map((t) => t.message);
                    return allItemsValid && errors.value.length === 0;
                });
            });
        };
        const setValidators = (v) => {
            _validators = normalizeRules(v, ctx._registry);
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
            $valid,
            at,
            push,
            insert,
            remove,
            clear,
            set,
            values,
            rawValues,
            touchAll,
            validate,
            reset,
            setValidators,
            clearErrors,
            _destroy
        };
        initial.forEach((c) => {
            if (c)
                c._parent = _l;
        });
        return _l;
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
    function ensureErrSpan(el, fid) {
        const id = `hx-err-${fid}`;
        const next = el.nextElementSibling;
        if (next && next.id === id)
            return next;
        const span = document.createElement("span");
        span.id = id;
        span.className = "hx-error-msg";
        span.setAttribute("role", "alert");
        span.setAttribute("aria-live", "polite");
        el.insertAdjacentElement("afterend", span);
        return span;
    }
    function setContainerHtml(container, html) {
        if (container.__hxLastContent === html)
            return;
        container.innerHTML = html;
        container.__hxLastContent = html;
    }
    function renderField(el, ctrl, fid, dOpts, localContext) {
        const ctx = localContext || getCurrentContext();
        const config = ctx.config;
        dOpts = dOpts || {};
        const target = getClassTarget(el, dOpts.classHandler);
        const container = dOpts.errTarget && document.querySelector(dOpts.errTarget) || ensureErrSpan(el, fid);
        const cls = config.classes;
        target.classList.remove(cls.valid, cls.invalid, cls.pending);
        const prefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
        if (ctrl.pending.value) {
            target.classList.add(cls.pending);
            el.setAttribute(`data-${prefix}-pending`, "");
            el.setAttribute("aria-invalid", "false");
            el.removeAttribute("aria-describedby");
            setContainerHtml(container, dOpts.pendingText ? `<span class="hx-err hx-err--pending">${escapeHtml(dOpts.pendingText)}</span>` : "");
            return;
        }
        el.removeAttribute(`data-${prefix}-pending`);
        const showErrs = (ctrl.dirty.value || ctrl.touched.value) && ctrl.errors.value.length > 0;
        const isClean = ctrl.errors.value.length === 0;
        if (showErrs) {
            target.classList.add(cls.invalid);
            el.setAttribute("aria-invalid", "true");
            el.setAttribute("aria-describedby", `hx-err-${fid}`);
            const tagged = ctrl._tagged.value.filter((t) => t && t.message);
            const toShow = config.showAllErrors ? tagged : [tagged[0]].filter(Boolean);
            setContainerHtml(container, toShow.map((t) => `<span class="hx-err hx-err--${escapeHtml(t.source)}">${escapeHtml(t.message)}</span>`).join(""));
        } else if (isClean && ctrl.touched.value) {
            target.classList.add(cls.valid);
            el.setAttribute("aria-invalid", "false");
            el.removeAttribute("aria-describedby");
            setContainerHtml(container, "");
        } else {
            el.setAttribute("aria-invalid", "false");
            el.removeAttribute("aria-describedby");
            setContainerHtml(container, "");
        }
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
    function parseDataHx(el, localContext) {
        const ctx = localContext || getCurrentContext();
        ctx.config;
        const prefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
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
            dependsOn: []
        };
        const boolMap = {
            [`data-${prefix}-required`]: () => required,
            [`data-${prefix}-email`]: () => email,
            [`data-${prefix}-url`]: () => url,
            [`data-${prefix}-numeric`]: () => numeric,
            [`data-${prefix}-integer`]: () => integer
        };
        const paramMap = {
            [`data-${prefix}-minlength`]: (v) => minLength(Number(v)),
            [`data-${prefix}-maxlength`]: (v) => maxLength(Number(v)),
            [`data-${prefix}-min`]: (v) => min(Number(v)),
            [`data-${prefix}-max`]: (v) => max(Number(v)),
            [`data-${prefix}-between`]: (v) => {
                const [a, b] = v.split(",");
                return between(Number(a), Number(b));
            },
            [`data-${prefix}-pattern`]: (v) => pattern(v),
            [`data-${prefix}-one-of`]: (v) => oneOf(v.split(",")),
            [`data-${prefix}-same-as`]: (v) => {
                let t = null;
                try {
                    t = document.querySelector(v);
                } catch (e) {
                }
                if (!t) {
                    try {
                        t = document.querySelector(`[name="${v}"]`);
                    } catch (e) {
                    }
                }
                return t ? sameAs(() => t.value, v) : null;
            }
        };
        Array.from(el.attributes).forEach(({ name: a, value: v }) => {
            if (boolMap[a]) {
                const fn = boolMap[a]();
                if (fn)
                    ruleFns.push(fn);
                return;
            }
            if (paramMap[a]) {
                const fn = paramMap[a](v);
                if (fn)
                    ruleFns.push(fn);
                return;
            }
            const msgMatch = a.match(new RegExp(`^data-${prefix}-(.+)-message$`));
            if (msgMatch && msgMatch[1] !== "remote") {
                msgOverrides[msgMatch[1]] = v;
                return;
            }
            if (a === `data-${prefix}-required-if`) {
                const parentForm = getFormFromEl(el, ctx);
                if (parentForm)
                    ruleFns.push(requiredIf(() => {
                        const c = parentForm.field(v);
                        return c ? !!c.value.value : false;
                    }));
                return;
            }
            if (a === `data-${prefix}-required-unless`) {
                const parentForm = getFormFromEl(el, ctx);
                if (parentForm)
                    ruleFns.push(requiredUnless(() => {
                        const c = parentForm.field(v);
                        return c ? !!c.value.value : false;
                    }));
                return;
            }
            if (a === `data-${prefix}-remote`) {
                opts.remoteUrl = v;
                return;
            }
            if (a === `data-${prefix}-remote-message`) {
                opts.remoteOpts.fallback = v;
                return;
            }
            if (a === `data-${prefix}-remote-options`) {
                try {
                    Object.assign(opts.remoteOpts, JSON.parse(v));
                } catch {
                }
                return;
            }
            if (a === `data-${prefix}-debounce`) {
                opts.debounce = Number(v);
                return;
            }
            if (a === `data-${prefix}-trigger`) {
                opts.trigger = v;
                return;
            }
            if (a === `data-${prefix}-group`) {
                opts.group = v.includes(",") ? v.split(",").map((s) => s.trim()) : v;
                return;
            }
            if (a === `data-${prefix}-excluded`) {
                opts.excluded = true;
                return;
            }
            if (a === `data-${prefix}-auto-dirty`) {
                opts.autoDirty = true;
                return;
            }
            if (a === `data-${prefix}-lazy`) {
                opts.lazy = true;
                return;
            }
            if (a === `data-${prefix}-pending-text`) {
                opts.pendingText = v;
                return;
            }
            if (a === `data-${prefix}-class-handler`) {
                opts.classHandler = v;
                return;
            }
            if (a === `data-${prefix}-error-target`) {
                opts.errTarget = v;
                return;
            }
            if (a === `data-${prefix}-errors-container`) {
                opts.errTarget = v;
                return;
            }
            if (a === `data-${prefix}-depends-on`) {
                opts.dependsOn = v.split(",").map((s) => s.trim());
                return;
            }
        });
        const finalFns = Object.keys(msgOverrides).length ? ruleFns.map((fn) => fn._ruleName && msgOverrides[fn._ruleName] ? withMessage(msgOverrides[fn._ruleName], fn) : fn) : ruleFns;
        return { ruleFns: finalFns, opts };
    }
    function scanForms(localContext, targetNode) {
        const ctx = localContext || getCurrentContext();
        const prefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
        const formsToScan = [];
        if (targetNode) {
            if (targetNode.nodeType === 1) {
                if (targetNode.matches && targetNode.matches(`[data-${prefix}-form]`)) {
                    formsToScan.push(targetNode);
                }
                if (targetNode.querySelectorAll) {
                    formsToScan.push(...targetNode.querySelectorAll(`[data-${prefix}-form]`));
                }
            }
        } else {
            formsToScan.push(...document.querySelectorAll(`[data-${prefix}-form]`));
        }
        formsToScan.forEach((formEl) => {
            if (ctx.formContextMap.has(formEl) || formEl.__hxAutoBound)
                return;
            const fieldDefs = {};
            formEl.querySelectorAll("[name]").forEach((input) => {
                const { ruleFns, opts: fOpts } = parseDataHx(input, ctx);
                if (!ruleFns.length && !fOpts.remoteUrl)
                    return;
                const name = input.getAttribute("name");
                let initial;
                if (input.type === "checkbox") {
                    initial = !!input.checked;
                } else if (input.type === "radio") {
                    const scope = input.form || input.closest("form") || formEl;
                    const checked = scope.querySelector(
                        `input[type=radio][name="${name}"]:checked`
                    );
                    initial = checked ? checked.value : "";
                } else {
                    initial = input.value || "";
                }
                fieldDefs[name] = field(initial, ruleFns, {
                    name,
                    trigger: fOpts.trigger,
                    autoDirty: fOpts.autoDirty,
                    lazy: fOpts.lazy,
                    group: fOpts.group
                }, ctx);
            });
            const f = form(fieldDefs, {}, ctx);
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
        const prefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
        if (ctx.autoFormCleanups.has(node))
            ctx.autoFormCleanups.get(node)();
        if (node.querySelectorAll) {
            node.querySelectorAll(`[data-${prefix}-form]`).forEach((f) => {
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
            const prefix = ctx.app && ctx.app.config && ctx.app.config.prefix || "hx";
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
                        if (node.matches && node.matches(`[data-${prefix}-form]`)) {
                            hasForm = true;
                        } else if (node.querySelector && node.querySelector(`[data-${prefix}-form]`)) {
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
    const registry = /* @__PURE__ */ new Map();
    const adapters = {
        add(name, fn) {
            if (typeof name !== "string" || typeof fn !== "function")
                return;
            registry.set(name, fn);
        },
        get(name) {
            return registry.get(name) || null;
        },
        has(name) {
            return registry.has(name);
        },
        remove(name) {
            registry.delete(name);
        },
        list() {
            return Array.from(registry.keys());
        }
    };
    function adapter(name, fn) {
        adapters.add(name, fn);
    }
    function zodAdapter(zodSchema) {
        return async (values) => {
            const result = await zodSchema.safeParseAsync(values);
            if (result.success)
                return { valid: true, errors: {} };
            const errors = {};
            result.error.errors.forEach((issue) => {
                const path = issue.path.join(".");
                if (!errors[path])
                    errors[path] = [];
                errors[path].push(issue.message);
            });
            return { valid: false, errors };
        };
    }
    adapters.add("zod", zodAdapter);
    function yupAdapter(yupSchema) {
        return async (values) => {
            try {
                await yupSchema.validate(values, { abortEarly: false });
                return { valid: true, errors: {} };
            } catch (err) {
                if (err.name === "ValidationError") {
                    const errors = {};
                    err.inner.forEach((issue) => {
                        const path = issue.path;
                        if (!errors[path])
                            errors[path] = [];
                        errors[path].push(issue.message);
                    });
                    return { valid: false, errors };
                }
                throw err;
            }
        };
    }
    adapters.add("yup", yupAdapter);
    function ajvAdapter(ajvValidator) {
        return async (values) => {
            const valid = await ajvValidator(values);
            if (valid)
                return { valid: true, errors: {} };
            const errors = {};
            (ajvValidator.errors || []).forEach((err) => {
                const path = err.instancePath ? err.instancePath.slice(1).replace(/\//g, ".") : err.dataPath ? err.dataPath.slice(1).replace(/\//g, ".") : "";
                const targetPath = path || err.params && err.params.missingProperty || "";
                if (!errors[targetPath])
                    errors[targetPath] = [];
                errors[targetPath].push(err.message);
            });
            return { valid: false, errors };
        };
    }
    adapters.add("ajv", ajvAdapter);
    function getContextFromBinding$2(binding) {
        if (binding && binding.instance && binding.instance.provides && binding.instance.provides["$validation"]) {
            return binding.instance.provides["$validation"]._context;
        }
        return getCurrentContext();
    }
    const validateDirective = {
        mounted(el, binding) {
            const localContext = getContextFromBinding$2(binding);
            const app = localContext.app;
            const config = localContext.config;
            const prefix = app && app.config && app.config.prefix || "hx";
            const bindVal = binding.value;
            let ctrl, fid, dOpts = {};
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
                fid = ctrl.name || ctrl._id;
            } else if (resolvedField) {
                ctrl = resolvedField;
                fid = ctrl.name || ctrl._id;
                const parsed = parseDataHx(el, localContext);
                dOpts = parsed.opts;
            } else {
                const parsed = parseDataHx(el, localContext);
                let rFns = parsed.ruleFns.slice();
                if (typeof bindVal === "string" && !bindVal.includes(".fields.")) {
                    rFns = normalizeRules(bindVal, localContext._registry).concat(rFns);
                }
                const fieldName = name || `hxv${localContext.seq + 1}`;
                fid = fieldName;
                dOpts = parsed.opts;
                let initial;
                if (el.type === "checkbox") {
                    initial = !!el.checked;
                } else if (el.type === "radio") {
                    const scope = el.form || el.closest("form") || document;
                    const checked = scope.querySelector(
                        `input[type=radio][name="${fieldName}"]:checked`
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
                    group: dOpts.group
                }, localContext);
                if (parentForm && !parentForm.fields[fieldName] && !dOpts.excluded) {
                    parentForm.add(fieldName, ctrl);
                }
            }
            el.__hxField = ctrl;
            if (!el.id)
                el.id = `hx-field-${fid}`;
            el.setAttribute("aria-invalid", "false");
            const trigger = dOpts.trigger || ctrl.updateOn || config.trigger;
            const debounceMs = dOpts.debounce != null ? dOpts.debounce : dOpts.remoteUrl ? config.debounce : 0;
            const remoteUrl = dOpts.remoteUrl || null;
            const remoteOpts = dOpts.remoteOpts || {};
            const dispOpts = { classHandler: dOpts.classHandler, errTarget: dOpts.errTarget, pendingText: dOpts.pendingText || "" };
            let _remoteTimer = null;
            let _eagerOn = false;
            let _hasValidated = false;
            function doValidate() {
                if (trigger === "manual" || trigger === "submit")
                    return Promise.resolve(true);
                if (trigger === "once" && _hasValidated)
                    return Promise.resolve(true);
                if (trigger === "dirty" && !ctrl.dirty.value)
                    return Promise.resolve(true);
                if (trigger === "touched" && !ctrl.touched.value)
                    return Promise.resolve(true);
                return ctrl.validate().then(() => {
                    _hasValidated = true;
                    renderField(el, ctrl, fid, dispOpts, localContext);
                    if (remoteUrl && ctrl.errors.value.length === 0 && !ctrl.disabled.value) {
                        if (config.minChars && String(ctrl.value.value).length < config.minChars)
                            return;
                        if (_remoteTimer)
                            clearTimeout(_remoteTimer);
                        _remoteTimer = setTimeout(() => {
                            _remoteTimer = null;
                            ctrl.pending.value = true;
                            renderField(el, ctrl, fid, dispOpts, localContext);
                            runRemote(el, remoteUrl, ctrl.value.value, remoteOpts, localContext).then((result) => {
                                ctrl.pending.value = false;
                                if (!result || result.aborted)
                                    return;
                                if (!result.valid) {
                                    const msg = result.message || "Invalid value.";
                                    ctrl._remoteErrors.value = [{ message: msg, source: "remote", rule: null }];
                                } else {
                                    ctrl._remoteErrors.value = [];
                                }
                                renderField(el, ctrl, fid, dispOpts, localContext);
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
                    const checked = rname ? scope.querySelector(`input[type=radio][name="${rname}"]:checked`) : t.checked ? t : null;
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
                if (trigger === "input" || trigger === "change" || trigger === "always")
                    doValidate();
                if (trigger === "eager" && (_eagerOn || ctrl.touched.value)) {
                    doValidate();
                    _eagerOn = true;
                }
                if (trigger === "dirty" || trigger === "touched")
                    doValidate();
            }
            function onBlur() {
                ctrl.touch();
                if (!_eagerOn && ctrl.errors.value.length > 0)
                    _eagerOn = true;
                if (trigger === "blur" || trigger === "eager" || trigger === "always" || trigger === "once")
                    doValidate();
                if (trigger === "dirty" || trigger === "touched")
                    doValidate();
            }
            function onChange(e) {
                if (e.target.type === "radio" && !e.target.checked)
                    return;
                ctrl.value.value = readInputValue(e);
                if (trigger === "change" || trigger === "always" || trigger === "once")
                    doValidate();
                if (trigger === "dirty" || trigger === "touched")
                    doValidate();
            }
            el.addEventListener("input", onInput);
            el.addEventListener("blur", onBlur);
            el.addEventListener("change", onChange);
            const effect = app.effect(() => {
                void ctrl._tagged.value;
                void ctrl.pending.value;
                void ctrl.touched.value;
                void ctrl.dirty.value;
                renderField(el, ctrl, fid, dispOpts, localContext);
            });
            localContext.allEffects.add(effect);
            if (config.validateOnMount && !ctrl._lazy)
                doValidate();
            localContext.dirUpdaters.set(el, (newB) => {
                const nv = newB.value;
                if (nv && nv._type === "field" && nv !== ctrl) {
                    ctrl = nv;
                    el.__hxField = ctrl;
                    fid = ctrl.name || ctrl._id;
                }
            });
            const cleanup = () => {
                el.removeEventListener("input", onInput);
                el.removeEventListener("blur", onBlur);
                el.removeEventListener("change", onChange);
                if (effect && effect.stop)
                    effect.stop();
                localContext.allEffects.delete(effect);
                if (_remoteTimer)
                    clearTimeout(_remoteTimer);
                if (localContext.remoteAborts.has(el)) {
                    localContext.remoteAborts.get(el).abort();
                    localContext.remoteAborts.delete(el);
                }
                if (!dOpts.errTarget) {
                    const span = document.getElementById(`hx-err-${fid}`);
                    if (span && span === el.nextElementSibling)
                        span.remove();
                }
                el.classList.remove(config.classes.valid, config.classes.invalid, config.classes.pending);
                el.removeAttribute("aria-invalid");
                el.removeAttribute("aria-describedby");
                el.removeAttribute(`data-${prefix}-pending`);
                delete el.__hxField;
                localContext.boundFieldEls.delete(el);
                localContext.allCleanups.delete(cleanup);
            };
            localContext.dirCleanups.set(el, cleanup);
            localContext.allCleanups.add(cleanup);
            if (config.observe)
                localContext.boundFieldEls.add(el);
        },
        updated(el, binding) {
            const localContext = getContextFromBinding$2(binding);
            const u = localContext.dirUpdaters.get(el);
            if (u)
                u(binding);
        },
        unmounted(el, binding) {
            const localContext = getContextFromBinding$2(binding);
            const cleanup = localContext.dirCleanups.get(el);
            if (cleanup) {
                cleanup();
                localContext.dirCleanups.delete(el);
                localContext.dirUpdaters.delete(el);
            }
        }
    };
    function getContextFromBinding$1(binding) {
        if (binding && binding.instance && binding.instance.provides && binding.instance.provides["$validation"]) {
            return binding.instance.provides["$validation"]._context;
        }
        return getCurrentContext();
    }
    const formDirective = {
        mounted(el, binding) {
            const localContext = getContextFromBinding$1(binding);
            const app = localContext.app;
            const f = binding.value;
            if (!f || f._type !== "form") {
                console.warn("[Helix Validation] hx-form: binding must be a Form.");
                return;
            }
            localContext.formContextMap.set(el, f);
            if (app.provide)
                app.provide("$validate.context", f);
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
            const prefix = app && app.config && app.config.prefix || "hx";
            const effect = app.effect(() => {
                if (f.submitting.value) {
                    el.setAttribute(`data-${prefix}-submitting`, "");
                    el.querySelectorAll(`[type=submit]:not([data-${prefix}-no-disable])`).forEach((btn) => {
                        btn.disabled = true;
                    });
                } else {
                    el.removeAttribute(`data-${prefix}-submitting`);
                    el.querySelectorAll(`[type=submit]:not([data-${prefix}-no-disable])`).forEach((btn) => {
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
            };
            localContext.dirCleanups.set(el, cleanup);
            localContext.allCleanups.add(cleanup);
        },
        unmounted(el, binding) {
            const localContext = getContextFromBinding$1(binding);
            const cleanup = localContext.dirCleanups.get(el);
            if (cleanup) {
                cleanup();
                localContext.dirCleanups.delete(el);
            }
        }
    };
    function getContextFromBinding(binding) {
        if (binding && binding.instance && binding.instance.provides && binding.instance.provides["$validation"]) {
            return binding.instance.provides["$validation"]._context;
        }
        return getCurrentContext();
    }
    const listDirective = {
        mounted(el, binding) {
            const localContext = getContextFromBinding(binding);
            const app = localContext.app;
            const l = binding.value;
            if (!l || l._type !== "list") {
                console.warn("[Helix Validation] hx-list: binding must be a FieldList.");
                return;
            }
            const prefix = app && app.config && app.config.prefix || "hx";
            const tmpl = el.querySelector(`[data-${prefix}-list-item-template]`);
            if (!tmpl) {
                console.warn(`[Helix Validation] hx-list: no [data-${prefix}-list-item-template] template found.`);
                return;
            }
            tmpl.style.display = "none";
            function render() {
                el.querySelectorAll(`[data-${prefix}-list-item]`).forEach((n) => n.remove());
                l.items.value.forEach((itemCtrl, index) => {
                    const clone = tmpl.cloneNode(true);
                    clone.removeAttribute(`data-${prefix}-list-item-template`);
                    clone.style.display = "";
                    clone.setAttribute(`data-${prefix}-list-item`, String(index));
                    clone.__hxListItem = itemCtrl;
                    clone.__hxListIndex = index;
                    clone.querySelectorAll(`[data-${prefix}-remove]`).forEach((btn) => {
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
            };
            localContext.dirCleanups.set(el, cleanup);
            localContext.allCleanups.add(cleanup);
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
            const localRegistry = new Map(_registry);
            const localRules = {
                add(name, fn, meta) {
                    if (typeof name !== "string" || typeof fn !== "function")
                        return;
                    localRegistry.set(name, { fn, priority: meta && meta.priority || 1 });
                },
                remove(name) {
                    localRegistry.delete(name);
                },
                get(name) {
                    return localRegistry.get(name) || null;
                },
                has(name) {
                    return localRegistry.has(name);
                },
                list() {
                    return Array.from(localRegistry.keys());
                }
            };
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
                _autoFormObserver: null
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
                zodAdapter,
                yupAdapter,
                ajvAdapter,
                adapters,
                adapter,
                rules: localRules,
                required,
                email,
                url,
                numeric,
                integer,
                minLength,
                maxLength,
                min,
                max,
                between,
                pattern,
                sameAs,
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
                check,
                getForm: (sel) => getForm(sel, localContext),
                config,
                version: "2.1.5"
            };
            app.namespace("validation", {
                $validation,
                field,
                form,
                list,
                // schema,
                // create,
                useForm,
                zodAdapter,
                yupAdapter,
                ajvAdapter,
                adapters,
                adapter,
                rules: localRules,
                required,
                email,
                url,
                numeric,
                integer,
                minLength,
                maxLength,
                min,
                max,
                between,
                pattern,
                sameAs,
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
                check,
                getForm: (sel) => getForm(sel, localContext),
                config,
                version: "2.1.5"
            });
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
                if (app.removeDirective) {
                    app.removeDirective("validate");
                    app.removeDirective("form");
                    app.removeDirective("list");
                } else {
                    console.warn("[Helix Validation] This Helix core build has no app.removeDirective(); the 'validate', 'form', and 'list' directives remain registered after teardown. Re-installing this plugin on the same app instance is not supported.");
                }
                if (app.removeNamespace) {
                    app.removeNamespace("validation");
                } else {
                    console.warn("[Helix Validation] This Helix core build has no app.removeNamespace(); the 'validation' namespace remains registered after teardown.");
                }
                if (app.$validation === $validation)
                    delete app.$validation;
                delete app[INSTALL_MARK];
                appContexts.delete(app);
            };
        }
    };
    exports.adapter = adapter;
    exports.adapters = adapters;
    exports.ajvAdapter = ajvAdapter;
    exports.and = and;
    exports.between = between;
    exports.check = check;
    exports.default = HelixValidationPlugin;
    exports.each = each;
    exports.email = email;
    exports.field = field;
    exports.form = form;
    exports.helpers = helpers;
    exports.i18n = i18n;
    exports.integer = integer;
    exports.list = list;
    exports.max = max;
    exports.maxLength = maxLength;
    exports.min = min;
    exports.minLength = minLength;
    exports.not = not;
    exports.numeric = numeric;
    exports.oneOf = oneOf;
    exports.or = or;
    exports.pattern = pattern;
    exports.required = required;
    exports.requiredIf = requiredIf;
    exports.requiredUnless = requiredUnless;
    exports.sameAs = sameAs;
    exports.transform = transform;
    exports.url = url;
    exports.useForm = useForm;
    exports.withAsync = withAsync;
    exports.withMessage = withMessage;
    exports.yupAdapter = yupAdapter;
    exports.zodAdapter = zodAdapter;
    Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
    const root = typeof window !== "undefined" ? window : globalThis;
    root.HelixValidationPlugin = Object.assign(HelixValidationPlugin, exports);
})(typeof window !== "undefined" ? window.HelixValidationPlugin = window.HelixValidationPlugin || {} : globalThis.HelixValidationPlugin = globalThis.HelixValidationPlugin || {});