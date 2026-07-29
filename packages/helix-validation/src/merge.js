import { isEmpty, resolveMsg } from './shared/utils.js';

export function withMessage(message, ruleFn) {
    const fn = (value, ctx) => {
        const result = ruleFn(value, ctx);
        const transform = (r) => {
            if (r === null) return null;
            const params = ruleFn.meta?.params || ruleFn._params || {};
            const ruleName = ruleFn.meta?.name || ruleFn._ruleName;
            return typeof message === 'function'
                ? message({ value, params, rule: ruleName })
                : message;
        };
        return result && typeof result.then === 'function' ? result.then(transform) : transform(result);
    };
    fn.meta = {
        name: ruleFn.meta?.name || ruleFn._ruleName,
        priority: ruleFn.meta?.priority !== undefined ? ruleFn.meta.priority : (ruleFn._priority || 1),
        params: ruleFn.meta?.params || ruleFn._params || {},
        each: !!(ruleFn.meta?.each || ruleFn._isEach),
        async: !!(ruleFn.meta?.async || ruleFn._isAsync),
        deps: ruleFn.meta?.deps || ruleFn._deps
    };
    fn._ruleName = fn.meta.name;
    fn._priority = fn.meta.priority;
    fn._params   = fn.meta.params;
    fn._isEach   = fn.meta.each;
    fn._isAsync  = fn.meta.async;
    if (fn.meta.deps) fn._deps = fn.meta.deps;
    return fn;
}

export function withAsync(asyncFn, optionsOrDeps) {
    const opts = (optionsOrDeps && !Array.isArray(optionsOrDeps)) ? optionsOrDeps : {};
    const deps = Array.isArray(optionsOrDeps) ? optionsOrDeps : (opts.deps || []);
    const cacheMap = new Map();

    const fn = (value, ctx) => {
        const cacheEnabled = opts.cache;
        if (cacheEnabled) {
            const ttl = opts.ttl || 5000;
            const cacheKey = opts.key ? opts.key(value, ctx) : String(value);
            const cached = cacheMap.get(cacheKey);
            if (cached && (cached.timestamp + ttl > Date.now())) {
                return Promise.resolve(cached.result);
            }

            const signal = ctx && ctx.signal ? ctx.signal : undefined;
            return Promise.resolve(asyncFn(value, signal, ctx)).then(result => {
                cacheMap.set(cacheKey, { result, timestamp: Date.now() });
                if (cacheMap.size > 200) {
                    const oldestKey = cacheMap.keys().next().value;
                    cacheMap.delete(oldestKey);
                }
                return result;
            });
        }

        const signal = ctx && ctx.signal ? ctx.signal : undefined;
        return asyncFn(value, signal, ctx);
    };
    fn.meta = {
        priority: asyncFn.meta?.priority !== undefined ? asyncFn.meta.priority : (asyncFn._priority || 0),
        async: true,
        each: !!(asyncFn.meta?.each || asyncFn._isEach),
        deps
    };
    fn._priority = fn.meta.priority;
    fn._deps     = deps;
    fn._isAsync  = true;
    fn._isEach   = fn.meta.each;
    return fn;
}

export function requiredIf(condition) {
    const fn = (v, ctx) => {
        const on = typeof condition === 'function' ? condition()
            : (condition && condition.value !== undefined ? condition.value : !!condition);
        return on && isEmpty(v) ? resolveMsg('required', {}, v, ctx) : null;
    };
    fn.meta = {
        name: 'requiredIf',
        priority: 32
    };
    fn._ruleName = 'requiredIf';
    fn._priority = 32;
    return fn;
}

export function requiredUnless(condition) {
    const fn = (v, ctx) => {
        const off = typeof condition === 'function' ? !condition()
            : (condition && condition.value !== undefined ? !condition.value : !condition);
        return off && isEmpty(v) ? resolveMsg('required', {}, v, ctx) : null;
    };
    fn.meta = {
        name: 'requiredUnless',
        priority: 32
    };
    fn._ruleName = 'requiredUnless';
    fn._priority = 32;
    return fn;
}

export function or(...ruleFns) {
    const fn = (v, ctx) => Promise.all(ruleFns.map(r => Promise.resolve(r(v, ctx)))).then(results => {
        return results.some(r => r === null) ? null : (results.find(r => r !== null) || 'Invalid value.');
    });
    const priority = ruleFns.length ? Math.min(...ruleFns.map(r => r.meta?.priority !== undefined ? r.meta.priority : (r._priority || 1))) : 1;
    const isAsync = ruleFns.some(r => r.meta?.async || r._isAsync);
    const isEach = ruleFns.some(r => r.meta?.each || r._isEach);
    fn.meta = {
        priority,
        async: isAsync,
        each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
}

export function and(...ruleFns) {
    const fn = (v, ctx) => ruleFns.reduce(
        (chain, r) => chain.then(acc => acc !== null ? acc : Promise.resolve(r(v, ctx))),
        Promise.resolve(null)
    );
    const priority = ruleFns.length ? Math.min(...ruleFns.map(r => r.meta?.priority !== undefined ? r.meta.priority : (r._priority || 1))) : 1;
    const isAsync = ruleFns.some(r => r.meta?.async || r._isAsync);
    const isEach = ruleFns.some(r => r.meta?.each || r._isEach);
    fn.meta = {
        priority,
        async: isAsync,
        each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
}

export function not(ruleFn, message = 'Invalid value.') {
    const fn = (v, ctx) => Promise.resolve(ruleFn(v, ctx)).then(r => r === null ? message : null);
    const priority = ruleFn.meta?.priority !== undefined ? ruleFn.meta.priority : (ruleFn._priority || 1);
    const isAsync = !!(ruleFn.meta?.async || ruleFn._isAsync);
    const isEach = !!(ruleFn.meta?.each || ruleFn._isEach);
    fn.meta = {
        priority,
        async: isAsync,
        each: isEach
    };
    fn._priority = priority;
    fn._isAsync = isAsync;
    fn._isEach = isEach;
    return fn;
}

export function each(...ruleFns) {
    const fn = (value, ctx) => {
        if (!Array.isArray(value)) return null;
        return Promise.all(
            value.map((item) =>
                ruleFns.reduce(
                    (chain, r) => chain.then(found => found || Promise.resolve(r(item, ctx)).then(res => res || null)),
                    Promise.resolve(null)
                )
            )
        ).then(results => {
            const errs = {};
            results.forEach((r, i) => { if (r !== null) errs[i] = r; });
            return Object.keys(errs).length ? errs : null;
        });
    };
    fn.meta = {
        priority: 1,
        each: true
    };
    fn._priority  = 1;
    fn._isEach    = true;
    return fn;
}

export function i18n({ t, path }) {
    const resolvePath = path || (({ rule }) => `validation.${rule}`);
    return (ruleFn) => {
        const fn = withMessage(
            ({ value: v, params, rule }) =>
                t(resolvePath({ rule: ruleFn.meta?.name || ruleFn._ruleName || rule, value: v, params }), params || {}),
            ruleFn
        );
        return fn;
    };
}

export function transform(transformFn) {
    const fn = (v, ctx) => {
        return { transform: true, value: transformFn(v, ctx) };
    };
    fn.meta = {
        name: 'transform',
        priority: 100
    };
    fn._ruleName = 'transform';
    fn._priority = 100; // run extremely early
    return fn;
}

export const compose = and;

export function composeAsync(...ruleFns) {
    const fn = (v, ctx) => Promise.all(
        ruleFns.map(r => Promise.resolve(r(v, ctx)))
    ).then(results => results.find(r => r !== null) || null);
    const priority = ruleFns.length ? Math.min(...ruleFns.map(r => r.meta?.priority !== undefined ? r.meta.priority : (r._priority || 1))) : 1;
    const isEach = ruleFns.some(r => r.meta?.each || r._isEach);
    fn.meta = {
        priority,
        async: true,
        each: isEach
    };
    fn._priority = priority;
    fn._isAsync = true;
    fn._isEach = isEach;
    return fn;
}

export function composeAsyncSequential(...ruleFns) {
    const fn = and(...ruleFns);
    fn.meta = {
        priority: fn.meta?.priority || 1,
        async: true,
        each: fn.meta?.each || false
    };
    fn._isAsync = true;
    fn._isEach = fn.meta.each;
    return fn;
}

export const helpers = { withMessage, withAsync, requiredIf, requiredUnless, or, and, not, each, i18n, transform, compose, composeAsync, composeAsyncSequential };
