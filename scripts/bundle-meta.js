/**
 * Helix Framework Bundle Registry & Metadata
 * Defines all available official plugins, preset groupings, and descriptions.
 */

export const PLUGINS = {
    directives: {
        id: 'directives',
        name: 'Helix Directives',
        category: 'DOM & UI',
        path: './packages/helix-directives/src/index.js',
        globalVar: 'HelixDirectivesPlugin',
        description: 'Advanced directives: hx-clipboard, hx-collapse, hx-intersect, hx-trap, hx-debounce',
        recommended: true,
        sizeApprox: '8 KB'
    },
    helpers: {
        id: 'helpers',
        name: 'Helix Helpers ($h)',
        category: 'Utilities',
        path: './packages/helix-helpers/src/index.js',
        globalVar: 'HelixHelpersPlugin',
        exportProp: '$h',
        description: '12 utility modules: strings, numbers, dates, validation, arrays, objects, deep paths, id, events',
        recommended: true,
        sizeApprox: '14 KB'
    },
    fetch: {
        id: 'fetch',
        name: 'Helix Fetch ($fetch)',
        category: 'Network & Data',
        path: './packages/helix-fetch/src/index.js',
        globalVar: 'HelixFetchPlugin',
        exportProp: '$fetch',
        description: 'Reactive HTTP client with TTL cache, deduplication, retry, queue, and interceptors',
        recommended: true,
        sizeApprox: '12 KB'
    },
    store: {
        id: 'store',
        name: 'Helix Store ($store)',
        category: 'State Management',
        path: './packages/helix-store/src/index.js',
        globalVar: 'HelixStorePlugin',
        exportProp: '$store',
        description: 'Signal-native reactive state management with defineStore, storeToRefs, and template proxies',
        recommended: true,
        sizeApprox: '6 KB'
    },
    loader: {
        id: 'loader',
        name: 'Helix Loader ($loader)',
        category: 'UI & Feedback',
        path: './packages/helix-loader/src/index.js',
        globalVar: 'HelixLoaderPlugin',
        exportProp: '$loader',
        description: 'Global and element-level spinner overlays, progress bars, and v-loading directive',
        recommended: false,
        sizeApprox: '9 KB'
    },
    notify: {
        id: 'notify',
        name: 'Helix Notify ($notify)',
        category: 'UI & Feedback',
        path: './packages/helix-notify/src/index.js',
        globalVar: 'HelixNotifyPlugin',
        exportProp: '$notify',
        description: 'SweetAlert2 integration: toasts, alert, confirm, prompt, and async query builders',
        recommended: false,
        sizeApprox: '8 KB'
    },
    tooltip: {
        id: 'tooltip',
        name: 'Helix Tooltip ($tooltip)',
        category: 'DOM & UI',
        path: './packages/helix-tooltip/src/index.js',
        globalVar: 'HelixTooltipPlugin',
        exportProp: '$tooltip',
        description: 'Zero-config popovers and tooltips with floating positioning, animations, and themes',
        recommended: false,
        sizeApprox: '11 KB'
    },
    validation: {
        id: 'validation',
        name: 'Helix Validation ($validation)',
        category: 'Forms & Validation',
        path: './packages/helix-validation/src/index.js',
        globalVar: 'HelixValidationPlugin',
        exportProp: '$validation',
        description: 'Declarative form validation engine with built-in rules, async checks, and UI adapters',
        recommended: false,
        sizeApprox: '12 KB'
    },
    'validation-schema': {
        id: 'validation-schema',
        name: 'Helix Validation Schema',
        category: 'Forms & Validation',
        path: './packages/helix-validation-schema/src/index.js',
        globalVar: 'HelixValidationSchemaPlugin',
        description: 'Zod, Yup, and AJV schema validation adapters for Helix Validation',
        recommended: false,
        sizeApprox: '3 KB'
    },
    scope: {
        id: 'scope',
        name: 'Helix Scope ($scope)',
        category: 'State & Scope',
        path: './packages/helix-scope/src/index.js',
        globalVar: 'HelixScopePlugin',
        exportProp: '$scope',
        description: 'Isolated component scope tree and scope management (hx-scope)',
        recommended: false,
        sizeApprox: '3 KB'
    },
    model: {
        id: 'model',
        name: 'Helix Model ($model)',
        category: 'Forms & Validation',
        path: './packages/helix-model/src/index.js',
        globalVar: 'HelixModelPlugin',
        exportProp: '$model',
        description: 'Advanced two-way model binding engine with macros and custom operators',
        recommended: false,
        sizeApprox: '4 KB'
    },
    axios: {
        id: 'axios',
        name: 'Helix Axios ($axios)',
        category: 'Network & Data',
        path: './packages/helix-axios/src/index.js',
        globalVar: 'HelixAxiosPlugin',
        exportProp: '$http',
        description: 'Axios adapter for Helix with token helpers and request controller management',
        recommended: false,
        sizeApprox: '3 KB'
    }
};

export const PRESETS = {
    all: {
        name: 'All-in-One (Full Suite)',
        description: 'Helix Core + All 12 official plugins included',
        plugins: Object.keys(PLUGINS)
    },
    essentials: {
        name: 'Essentials Suite',
        description: 'Core + Directives + Helpers + Fetch + Store (Most popular web app setup)',
        plugins: ['directives', 'helpers', 'fetch', 'store','axios','scope','tooltip','notify','loader']
    },
    ui: {
        name: 'UI & Interactivity',
        description: 'Core + Directives + Helpers + Tooltip + Loader + Notify',
        plugins: ['directives', 'helpers', 'tooltip', 'loader', 'notify','scope']
    },
    forms: {
        name: 'Forms & Validation',
        description: 'Core + Helpers + Validation + Validation Schema + Model',
        plugins: ['helpers', 'validation', 'validation-schema', 'model']
    },
    minimal: {
        name: 'Minimal / Core Only',
        description: 'Helix Core only without additional plugins',
        plugins: []
    }
};
