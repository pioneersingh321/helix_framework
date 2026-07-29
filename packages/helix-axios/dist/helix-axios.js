this.HelixAxiosPlugin = function() {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function getAxiosLib() {
    return typeof window !== "undefined" && window.axios ? window.axios : typeof globalThis !== "undefined" && globalThis.axios ? globalThis.axios : null;
  }
  function isCancel(err) {
    const axiosLib = getAxiosLib();
    return axiosLib && typeof axiosLib.isCancel === "function" && axiosLib.isCancel(err) || (err == null ? void 0 : err.code) === "ERR_CANCELED" || (err == null ? void 0 : err.name) === "CanceledError" || (err == null ? void 0 : err.name) === "AbortError";
  }
  function normalizeError(err) {
    var _a;
    if (isCancel(err)) {
      return {
        name: "CanceledError",
        status: null,
        data: null,
        message: "Request canceled",
        headers: {},
        config: (err == null ? void 0 : err.config) || null,
        canceled: true,
        originalError: err
      };
    }
    if (err == null ? void 0 : err.response) {
      return {
        name: "AxiosError",
        status: err.response.status,
        data: err.response.data,
        message: ((_a = err.response.data) == null ? void 0 : _a.message) || `Request failed with status ${err.response.status}`,
        headers: err.response.headers,
        config: err.config,
        canceled: false,
        originalError: err
      };
    }
    if (err == null ? void 0 : err.request) {
      return {
        name: "NetworkError",
        status: 0,
        data: null,
        message: err.message || "Network error — no response received",
        headers: {},
        config: err.config,
        canceled: false,
        originalError: err
      };
    }
    return {
      name: "RequestError",
      status: null,
      data: null,
      message: (err == null ? void 0 : err.message) || "Request setup error",
      headers: {},
      config: null,
      canceled: false,
      originalError: err
    };
  }
  function stableStringify(value) {
    const seen = /* @__PURE__ */ new WeakSet();
    const walk = (val) => {
      if (val === null || typeof val !== "object")
        return val;
      if (typeof FormData !== "undefined" && val instanceof FormData) {
        try {
          const parts = [];
          for (const [k, v] of val.entries()) {
            parts.push([k, typeof v === "string" ? v : "[blob]"]);
          }
          parts.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
          return { __formdata: parts };
        } catch {
          return "[formdata]";
        }
      }
      if (seen.has(val))
        return "[circular]";
      seen.add(val);
      if (Array.isArray(val))
        return val.map(walk);
      const out = {};
      for (const k of Object.keys(val).sort())
        out[k] = walk(val[k]);
      return out;
    };
    try {
      return JSON.stringify(walk(value));
    } catch {
      return "[unserializable]";
    }
  }
  function getDedupeKey(method, url, axiosConfig, data) {
    const fingerprint = {
      headers: axiosConfig.headers || null,
      responseType: axiosConfig.responseType || null,
      params: axiosConfig.params || null,
      data: data ?? null
    };
    return `${method}|${url}|${stableStringify(fingerprint)}`;
  }
  function readCookie(name) {
    const jar = typeof document !== "undefined" && document.cookie ? document.cookie.split("; ") : [];
    for (const pair of jar) {
      const eq = pair.indexOf("=");
      const key = eq > -1 ? pair.slice(0, eq) : pair;
      if (key === name) {
        try {
          return decodeURIComponent(pair.slice(eq + 1));
        } catch {
          return pair.slice(eq + 1);
        }
      }
    }
    return null;
  }
  const BODYLESS_METHODS = ["get", "head"];
  const IDEMPOTENT_METHODS = ["get", "head", "options"];
  const DEFAULTS = {
    baseURL: "/",
    timeout: 1e4,
    retries: 0,
    retryDelay: 300,
    maxRetryDelay: 3e4,
    retryCondition: (err, method) => IDEMPOTENT_METHODS.includes(String(method || "").toLowerCase()) && (!err.status || err.status >= 500),
    dedupe: false,
    csrf: false,
    headers: {}
  };
  function createAxiosInstance(config = {}) {
    const axiosLib = getAxiosLib();
    if (!axiosLib) {
      throw new Error("[Helix Axios] axios library not found. Load axios before this plugin.");
    }
    const merged = { ...DEFAULTS, ...config };
    const instance = axiosLib.create({
      baseURL: merged.baseURL,
      timeout: merged.timeout,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        ...merged.headers
      }
    });
    if (merged.csrf) {
      instance.interceptors.request.use((cfg) => {
        const token = readCookie("XSRF-TOKEN");
        if (token) {
          cfg.headers = cfg.headers || {};
          cfg.headers["X-XSRF-TOKEN"] = token;
        }
        return cfg;
      });
    }
    return instance;
  }
  const activeControllers = /* @__PURE__ */ new Set();
  function linkSignal(userSignal, onAbort) {
    if (!userSignal)
      return () => {
      };
    if (userSignal.aborted) {
      onAbort();
      return () => {
      };
    }
    userSignal.addEventListener("abort", onAbort);
    return () => userSignal.removeEventListener("abort", onAbort);
  }
  function driveHooks(responsePromise, hooks, onCleanup) {
    const out = responsePromise.then(
      (res) => {
        var _a;
        (_a = hooks.onSuccess) == null ? void 0 : _a.call(hooks, res);
        return res.data;
      },
      (err) => {
        var _a;
        (_a = hooks.onError) == null ? void 0 : _a.call(hooks, err);
        throw err;
      }
    );
    const fin = () => {
      var _a;
      (_a = hooks.onSettle) == null ? void 0 : _a.call(hooks);
      onCleanup == null ? void 0 : onCleanup();
    };
    out.then(fin, fin);
    return out;
  }
  async function retryWithBackoff(fn, { retries, delay, maxDelay, condition, method }) {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        if (isCancel(err))
          throw normalizeError(err);
        const normalized = normalizeError(err);
        const shouldRetry = condition(normalized, method) && attempt < retries;
        if (!shouldRetry)
          throw normalized;
        const ceiling = Math.min(maxDelay ?? Infinity, delay * Math.pow(2, attempt));
        await sleep(Math.random() * ceiling);
        attempt++;
      }
    }
  }
  function executeRequest(instance, pending, method, url, data, config = {}, hooks = {}) {
    var _a;
    const {
      signal: userSignal,
      dedupe,
      retries,
      retryDelay,
      retryCondition,
      ...axiosConfig
    } = config;
    const useDedupe = dedupe ?? DEFAULTS.dedupe;
    const dedupeKey = useDedupe ? getDedupeKey(method, url, axiosConfig, data) : null;
    (_a = hooks.onStart) == null ? void 0 : _a.call(hooks);
    if (useDedupe && pending.has(dedupeKey)) {
      const entry2 = pending.get(dedupeKey);
      entry2.refs++;
      let released2 = false;
      let detach2 = () => {
      };
      const release2 = () => {
        if (released2)
          return;
        released2 = true;
        detach2();
        entry2.refs--;
        if (entry2.refs <= 0) {
          try {
            entry2.controller.abort();
          } catch {
          }
        }
      };
      detach2 = linkSignal(userSignal, release2);
      const out2 = driveHooks(entry2.promise, hooks, () => {
        detach2();
      });
      out2.cancel = release2;
      return out2;
    }
    const controller = new AbortController();
    if (hooks.onUploadProgress) {
      axiosConfig.onUploadProgress = (e) => {
        if (e.lengthComputable)
          hooks.onUploadProgress(Math.round(e.loaded / e.total * 100));
      };
    }
    if (hooks.onDownloadProgress) {
      axiosConfig.onDownloadProgress = (e) => {
        if (e.lengthComputable)
          hooks.onDownloadProgress(Math.round(e.loaded / e.total * 100));
      };
    }
    const exec = () => {
      const requestConfig = { method, url, ...axiosConfig, signal: controller.signal };
      if (!BODYLESS_METHODS.includes(String(method).toLowerCase())) {
        requestConfig.data = data;
      }
      return instance(requestConfig);
    };
    const responsePromise = retryWithBackoff(exec, {
      retries: retries ?? DEFAULTS.retries,
      delay: retryDelay ?? DEFAULTS.retryDelay,
      maxDelay: DEFAULTS.maxRetryDelay,
      condition: retryCondition ?? DEFAULTS.retryCondition,
      method
    });
    const entry = { promise: responsePromise, controller, refs: 1 };
    activeControllers.add(controller);
    if (useDedupe)
      pending.set(dedupeKey, entry);
    let released = false;
    let detach = () => {
    };
    const release = () => {
      if (released)
        return;
      released = true;
      detach();
      if (useDedupe) {
        entry.refs--;
        if (entry.refs <= 0) {
          try {
            controller.abort();
          } catch {
          }
        }
      } else {
        try {
          controller.abort();
        } catch {
        }
      }
    };
    detach = linkSignal(userSignal, release);
    const out = driveHooks(responsePromise, hooks, () => {
      detach();
      activeControllers.delete(controller);
      if (useDedupe && pending.get(dedupeKey) === entry)
        pending.delete(dedupeKey);
    });
    out.cancel = release;
    return out;
  }
  function createReactiveRequest(app, instance, pending, method, url, data = null, reqOptions = {}) {
    return function useRequest() {
      const Helix = (typeof window !== "undefined" ? window : globalThis).Helix;
      const reactiveFn = app && typeof app.reactive === "function" ? app.reactive.bind(app) : Helix && typeof Helix.reactive === "function" ? Helix.reactive : null;
      const getCurrentInstance = Helix && typeof Helix.getCurrentInstance === "function" ? Helix.getCurrentInstance : app && typeof app.getCurrentInstance === "function" ? app.getCurrentInstance : null;
      const callerInstance = getCurrentInstance ? getCurrentInstance() : null;
      if (!reactiveFn) {
        throw new Error("[Helix Axios] reactive engine not found. Ensure Helix is loaded.");
      }
      const state = reactiveFn({
        data: null,
        error: null,
        loading: false,
        status: null,
        headers: null,
        progress: 0,
        uploadProgress: 0,
        downloadProgress: 0,
        completedAt: null,
        timestamp: null
      });
      const { signal: hookSignal, lazy, ...baseOpts } = reqOptions;
      let lastPromise = null;
      let runId = 0;
      const execute = (override = {}) => {
        const current = ++runId;
        const isCurrent = () => current === runId;
        const config = { ...baseOpts, ...override };
        if (hookSignal)
          config.signal = hookSignal;
        const hooks = {
          onStart: () => {
            if (!isCurrent())
              return;
            state.loading = true;
            state.error = null;
            state.progress = 0;
            state.uploadProgress = 0;
            state.downloadProgress = 0;
          },
          onUploadProgress: (pct) => {
            if (!isCurrent())
              return;
            state.uploadProgress = pct;
            state.progress = pct;
          },
          onDownloadProgress: (pct) => {
            if (!isCurrent())
              return;
            state.downloadProgress = pct;
            state.progress = pct;
          },
          onSuccess: (res) => {
            if (!isCurrent())
              return;
            state.data = res.data;
            state.status = res.status;
            state.headers = res.headers;
            state.completedAt = Date.now();
            state.timestamp = state.completedAt;
          },
          onError: (err) => {
            if (!isCurrent())
              return;
            state.error = err;
            state.status = err.status;
          },
          onSettle: () => {
            if (!isCurrent())
              return;
            state.loading = false;
          }
        };
        lastPromise = executeRequest(instance, pending, method, url, data, config, hooks);
        return lastPromise;
      };
      const inst = state;
      inst.execute = execute;
      inst.cancel = () => {
        var _a;
        (_a = lastPromise == null ? void 0 : lastPromise.cancel) == null ? void 0 : _a.call(lastPromise);
      };
      inst.promise = () => lastPromise || (lastPromise = execute());
      inst.then = (f, r) => {
        if (!lastPromise)
          lastPromise = execute();
        return lastPromise.then(f, r);
      };
      inst.catch = (r) => {
        if (!lastPromise)
          lastPromise = execute();
        return lastPromise.catch(r);
      };
      if (callerInstance && Array.isArray(callerInstance.cleanups)) {
        callerInstance.cleanups.push(() => {
          inst.cancel();
        });
      }
      if (!lazy)
        execute();
      return inst;
    };
  }
  function buildHttp(axiosInstance, app) {
    const pending = /* @__PURE__ */ new Map();
    const req = (method, url, data, config) => executeRequest(axiosInstance, pending, method, url, data, config || {}, {});
    const reactive = (method, url, data, opt) => createReactiveRequest(app, axiosInstance, pending, method, url, data, opt)();
    const makeUpload = (url, file, config = {}) => {
      const { fieldName = "file", ...rest } = config;
      const formData = new FormData();
      formData.append(fieldName, file);
      return reactive("post", url, formData, rest);
    };
    const http = {
      get: (url, config) => req("get", url, null, config),
      post: (url, data, config) => req("post", url, data, config),
      put: (url, data, config) => req("put", url, data, config),
      patch: (url, data, config) => req("patch", url, data, config),
      delete: (url, config) => req("delete", url, null, config),
      head: (url, config) => req("head", url, null, config),
      options: (url, config) => req("options", url, null, config),
      useGet: (url, opt) => reactive("get", url, null, opt),
      usePost: (url, body, opt) => reactive("post", url, body, opt),
      usePut: (url, body, opt) => reactive("put", url, body, opt),
      usePatch: (url, body, opt) => reactive("patch", url, body, opt),
      useDelete: (url, opt) => reactive("delete", url, null, opt),
      useUpload: makeUpload,
      upload: makeUpload,
      create: (opts) => buildHttp(createAxiosInstance(opts), app),
      setToken: (token, type = "Bearer") => {
        axiosInstance.defaults.headers.common["Authorization"] = `${type} ${token}`;
      },
      clearToken: () => {
        delete axiosInstance.defaults.headers.common["Authorization"];
      },
      raw: axiosInstance
    };
    return http;
  }
  const HelixAxiosPlugin = {
    name: "axios",
    version: "2.2.1",
    requires: {
      helix: ">=11.1.5"
    },
    install(app, options = {}) {
      const axiosLib = getAxiosLib();
      if (!axiosLib) {
        console.error("[Helix Axios] axios library not found. Load axios before this plugin.");
        return () => {
        };
      }
      const baseAxios = createAxiosInstance(options);
      const $http = buildHttp(baseAxios, app);
      app.namespace("axios", {
        $http,
        create: (opts) => buildHttp(createAxiosInstance(opts), app),
        setToken: $http.setToken,
        clearToken: $http.clearToken,
        raw: $http.raw
      });
      app.$http = $http;
      if (app.provide) {
        app.provide("$http", $http);
      }
      return () => {
        activeControllers.forEach((c) => {
          try {
            c.abort();
          } catch {
          }
        });
        activeControllers.clear();
      };
    }
  };
  const root = typeof window !== "undefined" ? window : globalThis;
  root.HelixAxiosPlugin = HelixAxiosPlugin;
  return HelixAxiosPlugin;
}();
