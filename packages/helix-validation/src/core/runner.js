export function buildValidationContext(ctrl, runOpts = {}) {
    const config = ctrl._context.config;
    let parent = ctrl._parent;
    let root = ctrl;
    let pathSegments = [];
    let cur = ctrl;
    let nearestIndex = null;

    while (cur._parent) {
        const p = cur._parent;
        if (p._type === 'form') {
            pathSegments.unshift(cur.name || '');
        } else if (p._type === 'list') {
            const idx = p.items.value.indexOf(cur);
            if (idx > -1) {
                pathSegments.unshift(String(idx));
                if (nearestIndex === null) nearestIndex = idx;
            }
        }
        cur = p;
    }
    root = cur;
    const path = pathSegments.join('.');

    // Resolve context injection dynamically
    let injectedContext = {};
    const globalContext = config.context || (ctrl._context.app && ctrl._context.app.config && ctrl._context.app.config.context);
    if (globalContext) {
        if (typeof globalContext === 'function') {
            try {
                injectedContext = globalContext(ctrl);
            } catch (err) {
                console.error('[Helix Validation] Error evaluating context function:', err);
            }
        } else if (typeof globalContext === 'object') {
            injectedContext = globalContext;
        }
    }
    if (runOpts.context) {
        injectedContext = Object.assign({}, injectedContext, runOpts.context);
    }

    return Object.assign({}, injectedContext, {
        field:  ctrl._type === 'field' ? ctrl : null,
        form:   ctrl._parent && ctrl._parent._type === 'form' ? ctrl._parent : null,
        parent,
        root,
        path,
        index:  nearestIndex,
        formValues: () => (root && root.values ? root.values() : null),
        signal: runOpts.signal || null,
        _context: ctrl._context,
    });
}

export function runRules(ctrl, ruleFns, value, runOpts = {}) {
    const config = ctrl._context.config;
    const beforeRuleHook = ctrl.beforeRule || config.beforeRule;
    const afterRuleHook = ctrl.afterRule || config.afterRule;

    if (!ruleFns || !ruleFns.length) return Promise.resolve({ errors: [], tagged: [] });

    if (ctrl._runAbort) {
        try { ctrl._runAbort.abort(); } catch (_) {}
    }
    const controller = new AbortController();
    ctrl._runAbort = controller;

    const runId = ctrl._context.uid();
    ctrl._runId = runId;

    const ctx = buildValidationContext(ctrl, Object.assign({ signal: controller.signal }, runOpts));

    // Sort rules by priority descending (highest priority run first)
    const sortedRules = [...ruleFns].sort((a, b) => {
        const pa = a.meta?.priority !== undefined ? a.meta.priority : (a._priority != null ? a._priority : 1);
        const pb = b.meta?.priority !== undefined ? b.meta.priority : (b._priority != null ? b._priority : 1);
        return pb - pa;
    });

    const tagged = [];
    const errors = [];
    let currentValue = value;
    let hasTransform = false;
    let finalTransformedValue = value;

    return sortedRules.reduce((chain, rule) => {
        return chain.then(stop => {
            if (stop && config.priorityEnabled) return true;
            if (ctrl._runId !== runId) return true; // stale

            const ruleName = rule.meta?.name || rule._ruleName || 'anonymous';
            let beforePromise = Promise.resolve();
            if (beforeRuleHook) {
                beforePromise = Promise.resolve(beforeRuleHook(ruleName, currentValue, ctx));
            }

            const globalBeforeMiddlewares = ctrl._context.beforeRuleMiddlewares || [];
            if (globalBeforeMiddlewares.length) {
                beforePromise = globalBeforeMiddlewares.reduce((chain, mw) => {
                    return chain.then(override => {
                        if (override !== undefined) return override;
                        return Promise.resolve(mw({
                            ruleName,
                            value: currentValue,
                            control: ctrl,
                            validationCtx: ctx
                        }));
                    });
                }, beforePromise);
            }

            return beforePromise.then(beforeOverride => {
                if (beforeOverride !== undefined) {
                    return beforeOverride;
                }
                return Promise.resolve(rule(currentValue, ctx));
            }).then(res => {
                let afterPromise = Promise.resolve(res);
                if (afterRuleHook) {
                    afterPromise = Promise.resolve(afterRuleHook(ruleName, currentValue, res, ctx))
                        .then(afterOverride => afterOverride !== undefined ? afterOverride : res);
                }
                const globalAfterMiddlewares = ctrl._context.afterRuleMiddlewares || [];
                if (globalAfterMiddlewares.length) {
                    afterPromise = globalAfterMiddlewares.reduce((chain, mw) => {
                        return chain.then(override => {
                            const currentRes = override !== undefined ? override : res;
                            return Promise.resolve(mw({
                                ruleName,
                                value: currentValue,
                                result: currentRes,
                                control: ctrl,
                                validationCtx: ctx
                            })).then(newOverride => newOverride !== undefined ? newOverride : currentRes);
                        });
                    }, afterPromise);
                }
                return afterPromise;
            }).then(res => {
                if (ctrl._runId !== runId) return true;

                // Value transformation pipeline support
                if (res && typeof res === 'object' && res.transform) {
                    currentValue = res.value;
                    finalTransformedValue = res.value;
                    hasTransform = true;
                    return false;
                }

                if (res !== null) {
                    const isEach = !!(rule.meta?.each || rule._isEach);
                    if (isEach && typeof res === 'object') {
                        Object.entries(res).forEach(([i, msg]) => {
                            const finalMsg = ctrl.message || msg;
                            tagged.push({ message: finalMsg, source: 'rule', rule: ruleName, index: Number(i) });
                            errors.push(finalMsg);
                        });
                    } else if (typeof res === 'string') {
                        const finalMsg = ctrl.message || res;
                        tagged.push({ message: finalMsg, source: 'rule', rule: ruleName });
                        errors.push(finalMsg);
                    }
                    return true; // Stop indicator for priority mode
                }
                return false;
            }).catch(err => {
                if (err && err.name === 'AbortError') return true;
                if (ctrl._runId !== runId) return true;
                console.error('[Helix Validation] Unexpected exception during rule validation:', err);
                const msg = ctrl.message || 'Validation error.';
                tagged.push({ message: msg, source: 'rule', rule: ruleName });
                errors.push(msg);
                return true;
            });
        });
    }, Promise.resolve(false)).then(() => {
        const stale = ctrl._runId !== runId;
        if (ctrl._runAbort === controller) ctrl._runAbort = null;
        if (!stale && hasTransform && ctrl.value) {
            if (!Object.is(ctrl.value.value, finalTransformedValue)) {
                ctrl.value.value = finalTransformedValue;
            }
        }
        return stale ? null : { errors, tagged };
    });
}
