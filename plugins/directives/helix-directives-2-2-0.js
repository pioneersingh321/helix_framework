this.HelixDirectivesPlugin = function() {
  "use strict";
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
  function resolvePath(app, ctx, path, fallback) {
    if (!path)
      return fallback;
    if (typeof path !== "string")
      return path;
    if (app && typeof app.resolvePath === "function") {
      const res = app.resolvePath(path, ctx);
      if (res !== void 0)
        return res;
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
  function evaluateArgs(app, ctx, argList, extra = {}) {
    return argList.map((a) => {
      if (a === "$event")
        return extra.event;
      const resolved = resolvePath(app, ctx, a);
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
  const DEBOUNCE_DEFAULT_EVENT = "input";
  const DEBOUNCE_DEFAULT_DELAY = 300;
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
  const debounceStates = /* @__PURE__ */ new WeakMap();
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
        log("mounted", { el, evtType, raw, expression, delay, fnPath: callData == null ? void 0 : callData.fnPath, args: callData == null ? void 0 : callData.args });
        const state = {
          evtType,
          delay,
          callData,
          expression,
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
              const resolvedDelay = resolvePath(app, ctx, state.delay);
              if (typeof resolvedDelay === "number") {
                delayVal = resolvedDelay;
              } else if (resolvedDelay !== void 0) {
                delayVal = parseInt(resolvedDelay, 10) || DEBOUNCE_DEFAULT_DELAY;
              }
            }
          }
          log("event fired:", state.evtType, "— waiting", delayVal, "ms");
          clearTimeout(state.timeout);
          state.timeout = setTimeout(() => {
            if (!state.callData) {
              log("no callData parsed from expression — nothing to run");
              return;
            }
            const fn = resolvePath(app, ctx, state.callData.fnPath);
            log("resolved", JSON.stringify(state.callData.fnPath), "->", typeof fn, fn);
            if (typeof fn === "function") {
              const argsToPass = state.callData.args.length > 0 ? evaluateArgs(app, ctx, state.callData.args, { event: e }) : [e];
              log("calling with args:", argsToPass);
              fn.apply(ctx, argsToPass);
            } else if (app.config && app.config.allowInlineExpressions) {
              try {
                new Function("$ctx", "$event", `with($ctx) { ${state.expression} }`)(ctx, e);
              } catch (err) {
                console.error(`[directives] [debounce] Error running inline expression:`, err);
              }
            } else if (typeof Helix !== "undefined" && typeof Helix.evaluate === "function") {
              try {
                Helix.evaluate(state.expression, ctx, { $event: e });
              } catch (err) {
                console.error(err);
              }
            } else {
              console.warn(`[directives] [debounce] Cannot resolve function "${state.callData.fnPath}" on context.`, { ctx });
            }
          }, delayVal);
        };
        el.addEventListener(evtType, state.handler);
        trackCleanup(() => {
          log("cleanup — removing listener", state.evtType);
          el.removeEventListener(state.evtType, state.handler);
          clearTimeout(state.timeout);
          debounceStates.delete(el);
        });
      },
      updated(el, binding) {
        const state = debounceStates.get(el);
        if (!state)
          return;
        const { value, arg } = binding;
        const newEvtType = arg || DEBOUNCE_DEFAULT_EVENT;
        const raw = (typeof value === "string" ? value : String(value ?? "")).trim();
        const { expression, delay } = parseDebounceValue(raw);
        const callData = parseCall(expression);
        state.delay = delay;
        state.callData = callData;
        state.expression = expression;
        if (newEvtType !== state.evtType) {
          log("event type updated from", state.evtType, "to", newEvtType);
          el.removeEventListener(state.evtType, state.handler);
          state.evtType = newEvtType;
          el.addEventListener(state.evtType, state.handler);
        }
      }
    };
  }
  const directiveFactories = {
    debounce: createDebounceDirective
  };
  const HelixDirectivesPlugin = {
    name: "directives",
    version: "2.2.0",
    requires: {
      helix: ">=11.1.5"
    },
    install(app, options = {}) {
      const config = { ...options };
      const debug = !!config.debug;
      const isReconfigure = !!app.__helixDirectivesInstalled;
      const registeredNames = [];
      for (const [name, factory] of Object.entries(directiveFactories)) {
        if (typeof app.directive !== "function")
          break;
        const def = factory(app, config);
        app.directive(name, def);
        registeredNames.push(name);
      }
      if (debug)
        console.log(`[directives] ${isReconfigure ? "re-installed (reconfigured)" : "installed"}:`, registeredNames, "| config:", config);
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
      app.__helixDirectivesInstalled = true;
      return () => {
        registeredNames.forEach((name) => {
          if (typeof app.removeDirective === "function")
            app.removeDirective(name);
        });
        if (app.$directives === api)
          delete app.$directives;
        delete app.__helixDirectivesInstalled;
        if (bus && typeof bus.emit === "function") {
          try {
            bus.emit("plugin:directives:destroyed", { version: HelixDirectivesPlugin.version });
          } catch (e) {
          }
        }
      };
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixDirectivesPlugin = HelixDirectivesPlugin;
  if (root.Helix && typeof root.Helix.directive === "function") {
    HelixDirectivesPlugin.install(root.Helix, {});
  }
  return HelixDirectivesPlugin;
}();
