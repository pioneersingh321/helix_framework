(function(exports) {
  "use strict";
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
  function ajvAdapter(ajvValidateFn) {
    return async (values) => {
      const valid = await ajvValidateFn(values);
      if (valid)
        return { valid: true, errors: {} };
      const errors = {};
      (ajvValidateFn.errors || []).forEach((err) => {
        const path = (err.instancePath ? err.instancePath.slice(1).replace(/\//g, ".") : err.dataPath ? err.dataPath.slice(1).replace(/\//g, ".") : "") || err.params && err.params.missingProperty || "";
        if (!errors[path])
          errors[path] = [];
        errors[path].push(err.message);
      });
      return { valid: false, errors };
    };
  }
  adapters.add("zod", zodAdapter);
  adapters.add("yup", yupAdapter);
  adapters.add("ajv", ajvAdapter);
  const HelixValidationSchemaPlugin = {
    name: "validation-schema",
    version: "2.1.5",
    install(app) {
      const $validation = app.$validation || typeof window !== "undefined" && window.Helix && window.Helix.$validation;
      if ($validation) {
        $validation.adapters = adapters;
        $validation.adapter = adapter;
        $validation.zodAdapter = zodAdapter;
        $validation.yupAdapter = yupAdapter;
        $validation.ajvAdapter = ajvAdapter;
      }
      const GlobalHelix = typeof window !== "undefined" && window.Helix || typeof globalThis !== "undefined" && globalThis.Helix || (typeof Helix !== "undefined" ? Helix : null);
      if (GlobalHelix && GlobalHelix.$validation) {
        Object.assign(GlobalHelix.$validation, {
          adapters,
          adapter,
          zodAdapter,
          yupAdapter,
          ajvAdapter
        });
      }
    }
  };
  exports.adapter = adapter;
  exports.adapters = adapters;
  exports.ajvAdapter = ajvAdapter;
  exports.default = HelixValidationSchemaPlugin;
  exports.yupAdapter = yupAdapter;
  exports.zodAdapter = zodAdapter;
  Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
    const root = typeof window !== 'undefined' ? window : globalThis;
    root.HelixValidationSchemaPlugin = Object.assign(HelixValidationSchemaPlugin, exports);
})(typeof window !== 'undefined' ? window.HelixValidationSchemaPlugin = window.HelixValidationSchemaPlugin || {} : globalThis.HelixValidationSchemaPlugin = globalThis.HelixValidationSchemaPlugin || {});
