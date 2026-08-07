export const globalConfig = {
    debug: false,
    slowThreshold: 2,
    prefix: "hx-",
    allowInlineExpressions: false,
    warnInlineExpressions: false,
    removeAttributeBindings: true,
    delimiters: ["{{", "}}"],
    rethrowErrors: true,
    htmlSanitizer: null
};

Object.seal(globalConfig);
