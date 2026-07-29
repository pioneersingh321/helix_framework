this.HelixHelpersPlugin = function() {
  "use strict";
  const _hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
  const _toStr = Object.prototype.toString;
  const _isPlainObject = (v) => {
    if (v === null || typeof v !== "object")
      return false;
    if (_toStr.call(v) !== "[object Object]")
      return false;
    const proto = Object.getPrototypeOf(v);
    return proto === null || proto === Object.prototype;
  };
  const _isInteger = (v) => typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v;
  const _toPath = (path) => {
    if (Array.isArray(path))
      return path;
    return String(path).replace(/\[['"]?([^'"]+)['"]?\]/g, ".$1").replace(/^\./, "").split(".").filter(Boolean);
  };
  const _serializeParam = (key, val, encode = encodeURIComponent) => {
    if (val === null || val === void 0)
      return "";
    if (typeof val === "boolean")
      return `${key}=${val}`;
    if (typeof val === "number" || typeof val === "string")
      return `${key}=${encode(val)}`;
    if (Array.isArray(val)) {
      return val.map((v) => _serializeParam(key, v, encode)).filter(Boolean).join("&");
    }
    if (typeof val === "object") {
      return Object.entries(val).map(([k, v]) => _serializeParam(`${key}[${k}]`, v, encode)).filter(Boolean).join("&");
    }
    return "";
  };
  const _equalMap = /* @__PURE__ */ new WeakMap();
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
      isDate: (v) => v instanceof Date,
      isRegExp: (v) => v instanceof RegExp,
      isPromise: (v) => v instanceof Promise || v !== null && typeof v === "object" && typeof v.then === "function",
      isMap: (v) => v instanceof Map,
      isSet: (v) => v instanceof Set,
      isWeakMap: (v) => v instanceof WeakMap,
      isWeakSet: (v) => v instanceof WeakSet,
      isSymbol: (v) => typeof v === "symbol",
      isEmpty(v) {
        if (v == null)
          return true;
        if (typeof v === "string" || Array.isArray(v))
          return v.length === 0;
        if (v instanceof Map || v instanceof Set)
          return v.size === 0;
        if (_isPlainObject(v))
          return Object.keys(v).length === 0;
        return false;
      },
      isEqual(a, b) {
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
        let stack = _equalMap.get(a);
        if (!stack) {
          stack = /* @__PURE__ */ new WeakSet();
          _equalMap.set(a, stack);
        }
        if (stack.has(b))
          return true;
        stack.add(b);
        if (Array.isArray(a) !== Array.isArray(b)) {
          stack.delete(b);
          return false;
        }
        if (a instanceof Date && b instanceof Date) {
          const r = a.getTime() === b.getTime();
          stack.delete(b);
          return r;
        }
        if (a instanceof RegExp && b instanceof RegExp) {
          const r = a.toString() === b.toString();
          stack.delete(b);
          return r;
        }
        const keysA = Reflect.ownKeys(a);
        const keysB = Reflect.ownKeys(b);
        if (keysA.length !== keysB.length) {
          stack.delete(b);
          return false;
        }
        const result = keysA.every((k) => keysB.includes(k) && H.isEqual(a[k], b[k]));
        stack.delete(b);
        return result;
      }
    };
  }
  function createStringMethods(H) {
    return {
      capitalize(str) {
        if (!H.isString(str) || str.length === 0)
          return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
      },
      titleCase(str) {
        if (!H.isString(str))
          return str;
        return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      },
      camelCase(str) {
        if (!H.isString(str))
          return str;
        return str.trim().replace(/[_\-\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "").replace(/^(.)/, (c) => c.toLowerCase());
      },
      kebabCase(str) {
        if (!H.isString(str))
          return str;
        return str.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
      },
      snakeCase(str) {
        if (!H.isString(str))
          return str;
        return H.kebabCase(str).replace(/-/g, "_");
      },
      truncate(str, len = 50, suffix = "...") {
        if (!H.isString(str) || str.length <= len)
          return str;
        return str.slice(0, len) + suffix;
      },
      slugify(str) {
        if (!H.isString(str))
          return str;
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
      },
      padStart(str, len, char = "0") {
        str = String(str);
        if (str.length >= len)
          return str;
        return String(char).repeat(len - str.length) + str;
      },
      padEnd(str, len, char = " ") {
        str = String(str);
        if (str.length >= len)
          return str;
        return str + String(char).repeat(len - str.length);
      },
      escapeHtml(str) {
        if (!H.isString(str))
          return str;
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return str.replace(/[&<>"']/g, (c) => map[c]);
      },
      unescapeHtml(str) {
        if (!H.isString(str))
          return str;
        const map = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
        return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (c) => map[c]);
      }
    };
  }
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
        return arr.find((i) => H.get(i, key) === val);
      },
      removeBy(arr, key, val) {
        if (!Array.isArray(arr))
          return arr;
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
        return arr.filter((x) => !combined.has(x));
      },
      intersection(arr, ...others) {
        if (!Array.isArray(arr))
          return [];
        const sets = others.map((o) => new Set(o));
        return arr.filter((x) => sets.every((s) => s.has(x)));
      }
    };
  }
  const _cloneMap = /* @__PURE__ */ new WeakMap();
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
      cloneDeep(obj) {
        if (obj === null || typeof obj !== "object")
          return obj;
        if (obj instanceof Date)
          return new Date(obj.getTime());
        if (obj instanceof RegExp)
          return new RegExp(obj.source, obj.flags);
        if (obj instanceof Map)
          return new Map(Array.from(obj, ([k, v]) => [H.cloneDeep(k), H.cloneDeep(v)]));
        if (obj instanceof Set)
          return new Set(Array.from(obj, (v) => H.cloneDeep(v)));
        if (Array.isArray(obj))
          return obj.map((i) => H.cloneDeep(i));
        if (_cloneMap.has(obj))
          return _cloneMap.get(obj);
        const clone = {};
        _cloneMap.set(obj, clone);
        for (const k of Reflect.ownKeys(obj)) {
          if (_hasOwn(obj, k) || Object.getOwnPropertyDescriptor(obj, k)) {
            clone[k] = H.cloneDeep(obj[k]);
          }
        }
        _cloneMap.delete(obj);
        return clone;
      },
      deepMerge(target, ...sources) {
        if (!sources.length)
          return target;
        const s = sources.shift();
        if (!_isPlainObject(target) || !_isPlainObject(s))
          return H.deepMerge(target, ...sources);
        const result = { ...target };
        for (const k of Reflect.ownKeys(s)) {
          if (_hasOwn(s, k)) {
            if (_isPlainObject(s[k]) && _isPlainObject(result[k])) {
              result[k] = H.deepMerge(result[k], s[k]);
            } else {
              result[k] = H.cloneDeep(s[k]);
            }
          }
        }
        return H.deepMerge(result, ...sources);
      },
      merge(target, ...sources) {
        if (!sources.length)
          return target;
        const s = sources.shift();
        if (_isPlainObject(target) && _isPlainObject(s)) {
          for (const k of Reflect.ownKeys(s)) {
            if (_hasOwn(s, k)) {
              if (_isPlainObject(s[k])) {
                if (!target[k])
                  target[k] = {};
                H.merge(target[k], s[k]);
              } else {
                target[k] = s[k];
              }
            }
          }
        }
        return H.merge(target, ...sources);
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
          if (!(k in c) || typeof c[k] !== "object" || c[k] === null)
            c[k] = {};
          c = c[k];
        }
        c[ks[ks.length - 1]] = val;
        return obj;
      }
    };
  }
  function createDateMethods(H) {
    return {
      formatDate(date, fmt = "YYYY-MM-DD") {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime()))
          return "";
        const p = (n) => String(n).padStart(2, "0");
        const m = {
          YYYY: d.getFullYear(),
          MM: p(d.getMonth() + 1),
          DD: p(d.getDate()),
          HH: p(d.getHours()),
          mm: p(d.getMinutes()),
          ss: p(d.getSeconds()),
          SSS: String(d.getMilliseconds()).padStart(3, "0")
        };
        return fmt.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (x) => m[x]);
      },
      timeAgo(date) {
        const now = /* @__PURE__ */ new Date();
        const then = new Date(date);
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
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      },
      startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      endOfDay(date) {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
      }
    };
  }
  function createNumberMethods(H) {
    return {
      formatNumber(num, d = 0) {
        return H.isNumber(num) ? num.toLocaleString("en-US", {
          minimumFractionDigits: d,
          maximumFractionDigits: d
        }) : num;
      },
      formatCurrency(amount, cur = "USD", loc = "en-US") {
        return H.isNumber(amount) ? new Intl.NumberFormat(loc, {
          style: "currency",
          currency: cur
        }).format(amount) : amount;
      },
      round(num, d = 0) {
        if (!H.isNumber(num))
          return num;
        const p = Math.pow(10, d);
        const n = num * p * (1 + Number.EPSILON);
        return Math.round(n) / p;
      },
      clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
      },
      randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    };
  }
  function createValidationMethods(H) {
    return {
      isEmail(str) {
        if (!H.isString(str))
          return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
      },
      isUrl(str) {
        if (!H.isString(str))
          return false;
        try {
          new URL(str);
          return true;
        } catch {
          return false;
        }
      },
      isPhone(str, c = "US") {
        if (!H.isString(str))
          return false;
        const p = {
          US: /^\+?1?\s?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
          UK: /^\+?44\s?7\d{3}\s?\d{6}$/,
          IN: /^\+?91\s?[6-9]\d{9}$/
        };
        return (p[c] || p.US).test(str);
      },
      minLength(str, len) {
        return H.isString(str) && str.length >= len;
      },
      maxLength(str, len) {
        return H.isString(str) && str.length <= len;
      },
      range(num, min, max) {
        return H.isNumber(num) && num >= min && num <= max;
      },
      isHexColor(str) {
        return H.isString(str) && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(str);
      }
    };
  }
  function createDomMethods(H) {
    return {
      scrollTo(target, behavior = "smooth", block = "start") {
        var _a;
        if (typeof target === "string") {
          (_a = document.querySelector(target)) == null ? void 0 : _a.scrollIntoView({ behavior, block });
        } else if (target instanceof Element) {
          target.scrollIntoView({ behavior, block });
        } else if (typeof target === "number") {
          window.scrollTo({ top: target, behavior });
        } else {
          window.scrollTo({ top: 0, behavior });
        }
      },
      async copyToClipboard(text) {
        if (!H.isString(text))
          return false;
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
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
      downloadFile(content, filename, type = "text/plain") {
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
          document.body.removeChild(a);
        }, 100);
      }
    };
  }
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
        if (!H.isString(str))
          return {};
        const result = {};
        for (const [k, v] of new URLSearchParams(str)) {
          if (result[k] !== void 0) {
            result[k] = [].concat(result[k], v);
          } else {
            result[k] = v;
          }
        }
        return result;
      }
    };
  }
  function createAsyncMethods(H, timerCancels) {
    return {
      wait(ms) {
        return new Promise((r) => setTimeout(r, ms));
      },
      uid(len = 8) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let id = "";
        for (let i = 0; i < len; i++)
          id += chars.charAt(Math.floor(Math.random() * chars.length));
        return id;
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
        let timer;
        const wrapped = function(...args) {
          const callNow = immediate && !timer;
          clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            if (!immediate)
              fn.apply(this, args);
          }, wait);
          if (callNow)
            fn.apply(this, args);
        };
        wrapped.cancel = () => clearTimeout(timer);
        timerCancels.add(wrapped.cancel);
        return wrapped;
      },
      throttle(fn, limit = 300, trailing = true) {
        let last, timer;
        const wrapped = function(...args) {
          const now = Date.now();
          if (!last || now - last >= limit) {
            last = now;
            fn.apply(this, args);
          } else if (trailing) {
            clearTimeout(timer);
            timer = setTimeout(() => {
              last = Date.now();
              fn.apply(this, args);
            }, limit - (now - last));
          }
        };
        wrapped.cancel = () => clearTimeout(timer);
        timerCancels.add(wrapped.cancel);
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
  const HelixHelpersPlugin = {
    name: "helpers",
    version: "1.1.0",
    requires: {
      helix: ">=11.1.5"
    },
    install(app, options = {}) {
      const _timerCancels = /* @__PURE__ */ new Set();
      const H = {};
      Object.assign(
        H,
        createTypeMethods(H),
        createStringMethods(H),
        createArrayMethods(H),
        createObjectMethods(H, app),
        createDateMethods(),
        createNumberMethods(H),
        createValidationMethods(H),
        createDomMethods(H),
        createDataMethods(H),
        createAsyncMethods(H, _timerCancels)
      );
      if (typeof app.namespace === "function") {
        try {
          app.namespace("helpers", H);
        } catch (e) {
        }
      }
      app.$h = H;
      if (typeof app.provide === "function") {
        try {
          app.provide("helper", H);
          app.provide("$h", H);
        } catch (e) {
        }
      }
      const bus = app.$bus || app.bus || typeof window !== "undefined" && window.Helix && window.Helix.$bus;
      if (bus && typeof bus.emit === "function") {
        try {
          bus.emit("plugin:helpers:installed", { version: HelixHelpersPlugin.version });
        } catch (e) {
        }
      }
      if (typeof window !== "undefined") {
        window.HelixHelpers = H;
        window.__HELIX_HELPERS__ = H;
      }
      const cleanup = () => {
        _timerCancels.forEach((cancel) => {
          try {
            cancel();
          } catch (e) {
          }
        });
        _timerCancels.clear();
        if (typeof window !== "undefined") {
          delete window.HelixHelpers;
          delete window.__HELIX_HELPERS__;
        }
        if (app.$h === H)
          delete app.$h;
        if (bus && typeof bus.emit === "function") {
          try {
            bus.emit("plugin:helpers:destroyed");
          } catch (e) {
          }
        }
      };
      return cleanup;
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixHelpersPlugin = HelixHelpersPlugin;
  if (root.Helix && typeof root.Helix.reactive === "function") {
    HelixHelpersPlugin.install(root.Helix, {});
  }
  return HelixHelpersPlugin;
}();
