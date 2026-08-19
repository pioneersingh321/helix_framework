export const globalConfig = {
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
