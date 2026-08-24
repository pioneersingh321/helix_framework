(function(exports) {
  "use strict";
  var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
  const _hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
  const _toStr = Object.prototype.toString;
  const _unref = (v) => {
    if (v != null && typeof v === "object" && ("value" in v || v._isRef || v.__v_isRef)) {
      return v.value;
    }
    return v;
  };
  const _isPlainObject = (v) => {
    const val = _unref(v);
    if (val === null || typeof val !== "object")
      return false;
    if (_toStr.call(val) !== "[object Object]")
      return false;
    const proto = Object.getPrototypeOf(val);
    return proto === null || proto === Object.prototype;
  };
  const _isInteger = (v) => {
    const val = _unref(v);
    return typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  };
  const _toPath = (path) => {
    const p = _unref(path);
    if (Array.isArray(p))
      return p;
    return String(p || "").replace(/\[['"]?([^'"]+)['"]?\]/g, ".$1").replace(/^\./, "").split(".").filter(Boolean);
  };
  const _serializeParam = (key, val, encode = encodeURIComponent) => {
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
  function createDomMethods(H) {
    return {
      scrollTo(target, behavior = "smooth", block = "start") {
        var _a;
        if (typeof window === "undefined")
          return;
        if (typeof target === "string") {
          if (typeof document !== "undefined" && typeof document.querySelector === "function") {
            (_a = document.querySelector(target)) == null ? void 0 : _a.scrollIntoView({ behavior, block });
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
        const cleanup = () => {
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
        return cleanup;
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
        const nextFrame = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
        element.style.transitionProperty = "height";
        element.style.transitionDuration = `${duration}ms`;
        element.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.2, 1)";
        if (isOpen) {
          element.style.display = "";
          element.style.overflow = "hidden";
          element.style.height = `${minHeight}px`;
          const fullHeight = element.scrollHeight;
          nextFrame(() => {
            element.style.height = `${fullHeight}px`;
            setTimeout(() => {
              element.style.height = "";
              element.style.overflow = "";
            }, duration);
          });
        } else {
          element.style.height = `${element.scrollHeight}px`;
          element.style.overflow = "hidden";
          nextFrame(() => {
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
  let helperIdCounter = 0;
  function getDefaultPrefix(app) {
    var _a, _b, _c, _d, _e;
    const raw = ((_a = app == null ? void 0 : app.config) == null ? void 0 : _a.prefix) || typeof window !== "undefined" && ((_c = (_b = window.Helix) == null ? void 0 : _b.config) == null ? void 0 : _c.prefix) || typeof globalThis !== "undefined" && ((_e = (_d = globalThis.Helix) == null ? void 0 : _d.config) == null ? void 0 : _e.prefix) || "hx";
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
  const HelixHelpersPlugin = {
    name: "helpers",
    version: typeof { url: _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("helix-helpers.js", document.baseURI).href } !== "undefined" && { "VITE_CORE_VERSION": "11.1.21", "VITE_AXIOS_DEFAULT_URL": "/", "VITE_AXIOS_VERSION": "2.2.1", "VITE_DIRECTIVES_VERSION": "2.2.0", "VITE_FETCH_VERSION": "2.8.8", "VITE_HELPERS_VERSION": "1.1.0", "VITE_LOADER_VERSION": "2.5.1", "VITE_MODEL_VERSION": "2.2.1", "VITE_NOTIFY_VERSION": "2.2.6", "VITE_SCOPE_VERSION": "2.0.2", "VITE_TOOLTIP_VERSION": "1.7.0", "BASE_URL": "/", "MODE": "production", "DEV": false, "PROD": true, "SSR": false } && "1.1.0" || "1.1.0",
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
        createDateMethods(),
        createNumberMethods(H),
        createValidationMethods(H),
        createDomMethods(H),
        createDataMethods(H),
        createAsyncMethods(H, _timerCancels),
        createEventMethods(),
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
      return cleanup;
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixHelpersPlugin = HelixHelpersPlugin;
  exports.default = HelixHelpersPlugin;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
})(this.HelixHelpersPlugin = this.HelixHelpersPlugin || {});
