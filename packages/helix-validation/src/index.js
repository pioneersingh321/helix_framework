import {
    INSTALL_MARK,
    appContexts,
    setActiveContext,
    getCurrentContext
} from './core/context.js';
import { getDefaultConfig } from './shared/defaults.js';
import { _registry } from './core/registry.js';
import {
    required,
    email,
    url,
    pattern,
    trim,
    lowercase
} from './rules/string.js';
import {
    numeric,
    integer,
    minLength,
    maxLength,
    min,
    max,
    between
} from './rules/number.js';
import {
    sameAs,
    equalto,
    oneOf
} from './rules/array.js';
import {
    helpers,
    withMessage,
    withAsync,
    requiredIf,
    requiredUnless,
    or,
    and,
    not,
    each,
    i18n,
    transform,
    compose,
    composeAsync,
    composeAsyncSequential
} from './merge.js';
import { field } from './form/field.js';
import { form } from './form/form.js';
import { list } from './form/list.js';
import { check, getForm, createRuleRegistry } from './shared/utils.js';
import { scanForms, startObserver, stopObserver } from './shared/manager.js';
import { registerUI } from './shared/ui.js';
import { validateDirective } from './directives/validate.js';
import { formDirective } from './directives/form.js';
import { listDirective } from './directives/list.js';
import { STATUS, EVENTS } from './constants.js';

function registerDirectives(app, options) {
    app.directive('validate', validateDirective);
    app.directive('rule', validateDirective);
    app.directive('rules', validateDirective);
    app.directive('form', formDirective);
    app.directive('list', listDirective);
}

/* Keep for future schema capabilities
class Schema {
    constructor(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new TypeError('[Helix Validation] schema: definition must be an object.');
        }
        this.definition = definition;
    }
}

function schema(definition) {
    return new Schema(definition);
}

function create(schemaInstance, opts) {
    if (!(schemaInstance instanceof Schema)) {
        throw new TypeError('[Helix Validation] create: argument must be a Schema instance.');
    }
    return form(schemaInstance.definition, opts);
}
*/

function useForm() {
    const localContext = getCurrentContext();
    if (!localContext) return null;
    const app = localContext.app;
    if (app && app.inject) {
        try { return app.inject('$form'); } catch (_) {}
    }
    if (typeof window !== 'undefined' && window.Helix && typeof window.Helix.getCurrentInstance === 'function') {
        const inst = window.Helix.getCurrentInstance();
        if (inst && inst.provides && inst.provides['$form']) {
            return inst.provides['$form'];
        }
    }
    return null;
}

const HelixValidationPlugin = {
    name: 'validation',
    version: '2.1.5',
    requires: { helix: '>=11.1.5' },

    install(app, options = {}) {
        if (app[INSTALL_MARK]) {
            console.warn('[Helix Validation] already installed; skipping.');
            return () => { };
        }

        const config = getDefaultConfig(options);

        // Initialize scoped registry and context
        const localRules = createRuleRegistry(new Map(_registry));
        const localRegistry = localRules._registry;

        const localContext = {
            app,
            config,
            uid: () => {
                localContext.seq = (localContext.seq || 0) + 1;
                return `hxv${localContext.seq}`;
            },
            seq: 0,
            _registry: localRegistry,
            allCleanups: new Set(),
            allEffects: new Set(),
            formContextMap: new WeakMap(),
            autoForms: new Map(),
            autoFormCleanups: new Map(),
            boundFieldEls: new Set(),
            remoteAborts: new WeakMap(),
            dirCleanups: new WeakMap(),
            dirUpdaters: new WeakMap(),
            _scanScheduled: false,
            _scanHandle: null,
            _scanTargets: new Set(),
            _autoFormObserver: null,
            scanForms,
            beforeRuleMiddlewares: [],
            afterRuleMiddlewares: [],
            beforeRenderMiddlewares: [],
            afterRenderMiddlewares: [],
        };

        setActiveContext(localContext);
        appContexts.set(app, localContext);

        // Register custom directives
        registerDirectives(app, options);

        // Start DOM observer if configured
        startObserver(options, localContext);

        // Scan auto-bound forms
        const boundScan = () => scanForms(localContext);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boundScan);
        } else {
            boundScan();
        }

        // Public API
        const $validation = {
            _context: localContext,
            field,
            form,
            list,
            // schema,
            // create,
            useForm,
            registerUI,
            rules: localRules,
            required,
            email,
            url,
            trim,
            lowercase,
            numeric,
            integer,
            minLength,
            maxLength,
            min,
            max,
            between,
            pattern,
            sameAs,
            equalto,
            equalTo: equalto,
            oneOf,
            helpers,
            withMessage,
            withAsync,
            requiredIf,
            requiredUnless,
            or,
            and,
            not,
            each,
            i18n,
            transform,
            compose,
            composeAsync,
            composeAsyncSequential,
            check,
            getForm: (sel) => getForm(sel, localContext),
            config,
            version: '2.1.5',
            STATUS,
            EVENTS,
            use(plugin) {
                if (plugin) {
                    if (plugin.beforeRule && !localContext.beforeRuleMiddlewares.includes(plugin.beforeRule)) {
                        localContext.beforeRuleMiddlewares.push(plugin.beforeRule);
                    }
                    if (plugin.afterRule && !localContext.afterRuleMiddlewares.includes(plugin.afterRule)) {
                        localContext.afterRuleMiddlewares.push(plugin.afterRule);
                    }
                    if (plugin.beforeRender && !localContext.beforeRenderMiddlewares.includes(plugin.beforeRender)) {
                        localContext.beforeRenderMiddlewares.push(plugin.beforeRender);
                    }
                    if (plugin.afterRender && !localContext.afterRenderMiddlewares.includes(plugin.afterRender)) {
                        localContext.afterRenderMiddlewares.push(plugin.afterRender);
                    }
                }
                return this;
            },
            unuse(plugin) {
                if (plugin) {
                    if (plugin.beforeRule) {
                        localContext.beforeRuleMiddlewares = localContext.beforeRuleMiddlewares.filter(mw => mw !== plugin.beforeRule);
                    }
                    if (plugin.afterRule) {
                        localContext.afterRuleMiddlewares = localContext.afterRuleMiddlewares.filter(mw => mw !== plugin.afterRule);
                    }
                    if (plugin.beforeRender) {
                        localContext.beforeRenderMiddlewares = localContext.beforeRenderMiddlewares.filter(mw => mw !== plugin.beforeRender);
                    }
                    if (plugin.afterRender) {
                        localContext.afterRenderMiddlewares = localContext.afterRenderMiddlewares.filter(mw => mw !== plugin.afterRender);
                    }
                }
                return this;
            },
        };

        const GlobalHelix = (typeof window !== 'undefined' && window.Helix) ||
            (typeof globalThis !== 'undefined' && globalThis.Helix) ||
            (typeof Helix !== 'undefined' ? Helix : null);

        if (GlobalHelix) {
            GlobalHelix.$validation = $validation;
            GlobalHelix.validation = $validation;
        }

        app.$validation = $validation;
        app[INSTALL_MARK] = true;

        if (app.provide) app.provide('$validation', $validation);

        // Cleanup function returned for teardown
        return () => {
            stopObserver(localContext);
            document.removeEventListener('DOMContentLoaded', boundScan);

            Array.from(localContext.allCleanups).forEach(fn => fn());
            localContext.allCleanups.clear();

            localContext.allEffects.forEach(e => { if (e && e.stop) e.stop(); });
            localContext.allEffects.clear();

            localContext.autoForms.clear();
            localContext.autoFormCleanups.clear();
            localContext.boundFieldEls.clear();

            if (GlobalHelix) {
                if (GlobalHelix.$validation === $validation) delete GlobalHelix.$validation;
                if (GlobalHelix.validation === $validation) delete GlobalHelix.validation;
            }

            if (app.removeDirective) {
                app.removeDirective('validate');
                app.removeDirective('rule');
                app.removeDirective('rules');
                app.removeDirective('form');
                app.removeDirective('list');
            } else {
                console.warn("[Helix Validation] This Helix core build has no app.removeDirective(); the validation directives remain registered after teardown.");
            }
            if (app.$validation === $validation) delete app.$validation;
            delete app[INSTALL_MARK];
            appContexts.delete(app);
        };
    }
};

const root = (typeof window !== 'undefined' ? window : globalThis);
root.HelixValidationPlugin = HelixValidationPlugin;

export default HelixValidationPlugin;

export {
    field,
    form,
    list,
    // schema,
    // create,
    useForm,
    registerUI,
    required,
    email,
    url,
    trim,
    lowercase,
    numeric,
    integer,
    minLength,
    maxLength,
    min,
    max,
    between,
    pattern,
    sameAs,
    equalto,
    oneOf,
    helpers,
    withMessage,
    withAsync,
    requiredIf,
    requiredUnless,
    or,
    and,
    not,
    each,
    i18n,
    transform,
    compose,
    composeAsync,
    composeAsyncSequential,
    check,
    STATUS,
    EVENTS
};
