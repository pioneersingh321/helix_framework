export const getDefaultConfig = (options = {}) => ({
    trigger:            options.trigger             ?? 'blur',
    mode:               options.mode                ?? null,
    beforeRule:         options.beforeRule          ?? null,
    afterRule:          options.afterRule           ?? null,
    debounce:           options.debounce            ?? 300,
    priorityEnabled:    options.priorityEnabled     ?? true,
    validateOnMount:    options.validateOnMount     ?? false,
    showAllErrors:      options.showAllErrors       ?? false,
    minChars:           options.minChars            ?? 0,
    focusFirstInvalid:  options.focusFirstInvalid   ?? false,
    ui:                 options.ui                  ?? 'custom',
    classes: Object.assign(
        {},
        options.classes || {}
    ),
    messages:  Object.assign({}, options.messages || {}),
    remote: Object.assign(
        { method: 'GET', param: 'value', headers: {}, cache: false, ttl: 5000 },
        options.remote || {}
    ),
});

export const MSGS = {
    required:  ()       => 'This field is required.',
    email:     ()       => 'Enter a valid email address.',
    url:       ()       => 'Enter a valid URL.',
    numeric:   ()       => 'Must be a number.',
    integer:   ()       => 'Must be a whole number.',
    minLength: ({ p })  => `Must be at least ${p.min} characters.`,
    maxLength: ({ p })  => `Must be at most ${p.max} characters.`,
    min:       ({ p })  => `Must be at least ${p.min}.`,
    max:       ({ p })  => `Must be at most ${p.max}.`,
    between:   ({ p })  => `Must be between ${p.min} and ${p.max}.`,
    pattern:   ()       => 'Invalid format.',
    sameAs:    ({ p })  => `Must match ${p.label || 'the other field'}.`,
    oneOf:     ({ p })  => `Must be one of: ${(p.values || []).join(', ')}.`,
};
