import { RESERVED_KEYS } from './constants.js';
import { mergeWithDefaults } from './merge.js';
import { evaluateDefaults } from './defaults.js';
import { registerController, unregisterController } from './registry.js';
import { compile } from './compiler.js';
import { EventEmitter } from './events.js';

export class ScopeController {
    constructor({
        name,
        expression,
        parsedDefaults,
        ctx,
        childCtx,
        el,
        retryLimit = 0,
        retryDelay = 1000,
        backoff = true,
        pollInterval = 0,
        timeoutLimit = 0,
        cacheDuration = 0,
        resetOnRefresh = false
    }) {
        this.name = name;
        this.expression = expression;
        this.parsedDefaults = parsedDefaults;
        this.ctx = ctx;
        this.childCtx = childCtx;
        this.el = el;

        this.retryLimit = retryLimit;
        this.retryDelay = retryDelay;
        this.backoff = backoff;
        this.pollInterval = pollInterval;
        this.timeoutLimit = timeoutLimit;
        this.cacheDuration = cacheDuration;
        this.resetOnRefresh = resetOnRefresh;

        this.evaluator = null;
        this.abortController = null;
        this.token = 0;
        this.destroyed = false;

        this.lastResult = undefined;
        this.lastError = null;

        this.cachedResult = undefined;
        this.lastSuccessTime = 0;

        this.pollTimer = null;

        const defaultsObj = evaluateDefaults(parsedDefaults, ctx) || {};
        this.defaults = defaultsObj;

        const initialDefaults = {};
        for (const key of Object.keys(defaultsObj)) {
            if (!RESERVED_KEYS.has(key)) {
                initialDefaults[key] = defaultsObj[key];
            } else {
                console.warn(`[hx-scope:${name}] defaults cannot override reserved key "${key}", ignoring it`);
            }
        }

        const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
        const reactive = Helix && typeof Helix.reactive === 'function'
            ? Helix.reactive.bind(Helix)
            : (obj) => obj; // plain object fallback if Helix not yet ready
        this.state = reactive({
            $loading: false,
            $error: null,
            $data: undefined,
            refresh: (opts) => this.refresh(opts),
            ...initialDefaults
        });

        this.previousKeys = Object.keys(initialDefaults);

        registerController(name, this);

        if (this.pollInterval > 0) {
            this.startPolling();
        }
    }

    getEvaluator() {
        if (!this.evaluator) {
            this.evaluator = compile(this.expression);
        }
        return this.evaluator;
    }

    startPolling() {
        this.stopPolling();
        if (this.pollInterval > 0 && !this.destroyed) {
            this.pollTimer = setInterval(() => {
                this.refresh();
            }, this.pollInterval);
        }
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    getRetryDelay(attempt) {
        const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
        const config = Helix?.scope?.config || {};
        const useBackoff = this.backoff ?? config.backoff ?? true;
        const baseDelay = this.retryDelay ?? config.retryDelay ?? 1000;

        if (useBackoff) {
            return baseDelay * Math.pow(2, attempt - 1);
        }
        return baseDelay;
    }

    async refresh(options = {}) {
        if (this.destroyed) return;

        const Helix = (typeof window !== 'undefined' ? window : globalThis).Helix;
        const config = Helix?.scope?.config || {};
        const shouldReset = options.reset !== undefined ? options.reset : (this.resetOnRefresh || config.resetOnRefresh);

        if (shouldReset) {
            this.reset();
        }

        if (this.pollInterval > 0) {
            this.startPolling();
        }

        const force = options.force || options.reset;
        const now = Date.now();
        if (!force && this.cacheDuration > 0 && this.cachedResult !== undefined && (now - this.lastSuccessTime) < (this.cacheDuration * 1000)) {
            this.lastResult = this.cachedResult;
            this.applyResult(this.cachedResult);
            EventEmitter.emit('success', { name: this.name, controller: this, result: this.cachedResult, fromCache: true });
            EventEmitter.emit('afterRefresh', { name: this.name, controller: this, result: this.cachedResult, fromCache: true });
            return;
        }

        const currentToken = ++this.token;
        const maxRetries = options.retry !== undefined ? options.retry : this.retryLimit;
        let attempt = 0;
        let timeoutTimer = null;

        const runAttempt = async () => {
            if (this.destroyed || currentToken !== this.token) {
                return;
            }

            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();

            this.childCtx.$signal = this.abortController.signal;
            this.childCtx.$abortController = this.abortController;

            this.state.$loading = true;
            this.state.$error = null;

            EventEmitter.emit('beforeRefresh', { name: this.name, controller: this, attempt });

            if (this.timeoutLimit > 0) {
                timeoutTimer = setTimeout(() => {
                    if (this.abortController && currentToken === this.token) {
                        this.abortController.abort();
                        const err = new Error(`Request timed out after ${this.timeoutLimit}ms`);
                        this.lastError = err;
                        this.state.$error = err;
                        EventEmitter.emit('error', { name: this.name, controller: this, error: err });
                        EventEmitter.emit('afterRefresh', { name: this.name, controller: this, error: err });
                    }
                }, this.timeoutLimit);
            }

            try {
                const evaluator = this.getEvaluator();
                const result = await evaluator(this.childCtx);

                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                if (this.destroyed || currentToken !== this.token) {
                    return;
                }

                this.lastResult = result;
                this.cachedResult = result;
                this.lastSuccessTime = Date.now();
                this.applyResult(result);

                EventEmitter.emit('success', { name: this.name, controller: this, result });
                EventEmitter.emit('afterRefresh', { name: this.name, controller: this, result });
            } catch (err) {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                if (this.destroyed || currentToken !== this.token) {
                    return;
                }

                if (err.name === 'AbortError') {
                    EventEmitter.emit('abort', { name: this.name, controller: this });
                    return;
                }

                if (attempt < maxRetries) {
                    attempt++;
                    const delay = this.getRetryDelay(attempt);

                    EventEmitter.emit('retry', { name: this.name, controller: this, attempt, delay, error: err });

                    await new Promise(resolve => {
                        const waitTimer = setTimeout(resolve, delay);
                        this.abortController.signal.addEventListener('abort', () => {
                            clearTimeout(waitTimer);
                            resolve();
                        });
                    });

                    await runAttempt();
                } else {
                    this.lastError = err;
                    this.state.$error = err;
                    console.error(`[hx-scope:${this.name}]`, err);

                    EventEmitter.emit('error', { name: this.name, controller: this, error: err });
                    EventEmitter.emit('afterRefresh', { name: this.name, controller: this, error: err });
                }
            } finally {
                if (!this.destroyed && currentToken === this.token && (attempt === maxRetries || this.lastResult !== undefined)) {
                    this.state.$loading = false;
                }
            }
        };

        await runAttempt();
    }

    applyResult(result) {
        const defaultsObj = evaluateDefaults(this.parsedDefaults, this.ctx) || {};
        this.defaults = defaultsObj;

        const mergedResult = mergeWithDefaults(defaultsObj, result);

        const isPlainResult =
            mergedResult &&
            typeof mergedResult === 'object' &&
            !Array.isArray(mergedResult);

        const source = isPlainResult ? mergedResult : {};
        const keys = new Set([
            ...Object.keys(defaultsObj),
            ...Object.keys(source)
        ]);

        const nextKeys = [];

        for (const key of keys) {
            if (RESERVED_KEYS.has(key)) {
                continue;
            }

            this.state[key] = source[key];
            nextKeys.push(key);
        }

        for (const key of this.previousKeys) {
            if (!RESERVED_KEYS.has(key) && !keys.has(key)) {
                delete this.state[key];
            }
        }

        this.previousKeys = nextKeys;
        this.state.$data = result;
    }

    reset() {
        if (this.destroyed) return;

        EventEmitter.emit('beforeReset', { name: this.name, controller: this });

        this.abort();

        this.lastResult = undefined;
        this.lastError = null;
        this.cachedResult = undefined;
        this.lastSuccessTime = 0;

        const defaultsObj = evaluateDefaults(this.parsedDefaults, this.ctx) || {};
        this.defaults = defaultsObj;

        this.state.$loading = false;
        this.state.$error = null;
        this.state.$data = undefined;

        const nextKeys = [];
        for (const key of Object.keys(defaultsObj)) {
            if (!RESERVED_KEYS.has(key)) {
                this.state[key] = defaultsObj[key];
                nextKeys.push(key);
            }
        }

        for (const key of this.previousKeys) {
            if (!RESERVED_KEYS.has(key) && !defaultsObj.hasOwnProperty(key)) {
                delete this.state[key];
            }
        }

        this.previousKeys = nextKeys;

        EventEmitter.emit('afterReset', { name: this.name, controller: this });
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            EventEmitter.emit('abort', { name: this.name, controller: this });
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.token++;
        this.stopPolling();
        this.abort();
        unregisterController(this.name, this);
        EventEmitter.emit('destroy', { name: this.name, controller: this });
    }
}
