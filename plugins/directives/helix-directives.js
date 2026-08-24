(function(exports) {
  "use strict";
  var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
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
    return !!resolvePath(app, ctx, path, false);
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
              const resolvedDelay = resolvePath(app, state.ctx, state.delay);
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
            state.timeout = null;
            if (!state.callData) {
              log("no callData parsed from expression — nothing to run");
              return;
            }
            const fn = resolvePath(app, state.ctx, state.callData.fnPath);
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
            log("cleanup — removing listener", state.evtType);
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
  const collapseStates = /* @__PURE__ */ new WeakMap();
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
  const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
  function getFocusableElements(container) {
    if (!container || typeof container.querySelectorAll !== "function")
      return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
      return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
  }
  let bodyScrollLockCount = 0;
  let originalBodyOverflow = "";
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
  const inertOwnersMap = /* @__PURE__ */ new Map();
  const originalElementInertMap = /* @__PURE__ */ new Map();
  let trapInstanceCounter = 0;
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
  const trapStates = /* @__PURE__ */ new WeakMap();
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
            const nextFrame = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
            nextFrame(() => {
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
          const nextFrame = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
          state.frame = nextFrame(() => {
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
                  const nextFrame = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
                  nextFrame(() => {
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
  const clipboardStates = /* @__PURE__ */ new WeakMap();
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
            const resolved = resolvePath(app, state.ctx, state.value, state.value);
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
        var _a;
        const state = clipboardStates.get(el);
        if (!state)
          return;
        if (state.resetTimer) {
          clearTimeout(state.resetTimer);
          state.resetTimer = null;
          if (state.feedbackClass && typeof ((_a = el.classList) == null ? void 0 : _a.remove) === "function") {
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
  const intersectStates = /* @__PURE__ */ new WeakMap();
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
          const fn = resolvePath(app, state.ctx, callData.fnPath);
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
  const directiveFactories = {
    debounce: createDebounceDirective,
    collapse: createCollapseDirective,
    trap: createTrapDirective,
    clipboard: createClipboardDirective,
    intersect: createIntersectDirective
  };
  const HelixDirectivesPlugin = {
    name: "directives",
    version: typeof { url: _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("helix-directives.js", document.baseURI).href } !== "undefined" && { "VITE_CORE_VERSION": "11.1.21", "VITE_AXIOS_DEFAULT_URL": "/", "VITE_AXIOS_VERSION": "2.2.1", "VITE_DIRECTIVES_VERSION": "2.2.0", "VITE_FETCH_VERSION": "2.8.8", "VITE_HELPERS_VERSION": "1.1.0", "VITE_LOADER_VERSION": "2.5.1", "VITE_MODEL_VERSION": "2.2.1", "VITE_NOTIFY_VERSION": "2.2.6", "VITE_SCOPE_VERSION": "2.0.2", "VITE_TOOLTIP_VERSION": "1.7.0", "BASE_URL": "/", "MODE": "production", "DEV": false, "PROD": true, "SSR": false } && "2.2.0" || "2.2.0",
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
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixDirectivesPlugin = HelixDirectivesPlugin;
  exports.default = HelixDirectivesPlugin;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixDirectivesPlugin = this.HelixDirectivesPlugin || {});
