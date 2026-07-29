import { getPrefix } from './utils.js';
import { parseDefaults } from './defaults.js';
import { ScopeController } from './controller.js';
import { onComponentMount } from '../../core/src/lifecycle.js';
import { parseAttribute, cleanAttributes } from '../../core/src/dom.js';

export function createScopeDirective(app) {
    return {
        mounted(el, binding) {
            const {
                value: expr,
                arg: name,
                ctx,
                instance,
                bindNode,
                trackCleanup
            } = binding;

            if (!name) {
                console.warn('[hx-scope] usage: hx-scope:name="expression"');
                return;
            }

            if (!expr || !expr.trim()) {
                console.warn(`[hx-scope:${name}] empty expression`);
                return;
            }

            if (el._hx_scope_initialized) {
                const existingCtrl = (el._hx_scope_controllers || {})[name];
                if (existingCtrl) {
                    trackCleanup(() => {
                        existingCtrl.destroy();
                    });
                }
                return;
            }

            el._hx_scope_initialized = true;
            el._hx_scope_controllers = {};

            const prefix = (app && app.config && app.config.prefix) || getPrefix();
            const scopePrefix = `${prefix}scope:`;
            const scopeDefs = [];

            for (const attr of Array.from(el.attributes)) {
                if (attr.name.startsWith(scopePrefix)) {
                    const sName = attr.name.slice(scopePrefix.length);
                    const sExpr = attr.value;
                    scopeDefs.push({ name: sName, expression: sExpr });
                }
            }



            const childCtx = {};
            Object.setPrototypeOf(childCtx, ctx);

            childCtx.$el = el;
            childCtx.$event = {
                type: 'scope',
                target: el,
                currentTarget: el,
                preventDefault() {},
                stopPropagation() {}
            };

            const controllers = {};

            for (const def of scopeDefs) {
                const sName = def.name;
                const sExpr = def.expression;

                const defaultsAttr = `${prefix}scope-default:${sName}`;
                const defaultsRaw = parseAttribute(el, defaultsAttr);
                const parsedDefaults = parseDefaults(defaultsRaw);

                const retryAttr = `${prefix}scope-retry:${sName}`;
                const retryFallbackAttr = `${prefix}scope-retry`;
                const retryRaw = el.getAttribute(retryAttr) || el.getAttribute(retryFallbackAttr);
                cleanAttributes(el, [retryAttr]);
                const retryLimit = retryRaw ? parseInt(retryRaw, 10) : 0;

                const delayAttr = `${prefix}scope-retry-delay:${sName}`;
                const delayFallbackAttr = `${prefix}scope-retry-delay`;
                const delayRaw = el.getAttribute(delayAttr) || el.getAttribute(delayFallbackAttr);
                cleanAttributes(el, [delayAttr]);
                const retryDelay = delayRaw ? parseInt(delayRaw, 10) : 1000;

                const backoffAttr = `${prefix}scope-backoff:${sName}`;
                const backoffFallbackAttr = `${prefix}scope-backoff`;
                const backoffRaw = el.getAttribute(backoffAttr) || el.getAttribute(backoffFallbackAttr);
                cleanAttributes(el, [backoffAttr]);
                const backoff = backoffRaw !== 'false';

                const pollAttr = `${prefix}scope-poll:${sName}`;
                const pollFallbackAttr = `${prefix}scope-poll`;
                const pollRaw = el.getAttribute(pollAttr) || el.getAttribute(pollFallbackAttr);
                cleanAttributes(el, [pollAttr]);
                const pollInterval = pollRaw ? parseInt(pollRaw, 10) : 0;

                const timeoutAttr = `${prefix}scope-timeout:${sName}`;
                const timeoutFallbackAttr = `${prefix}scope-timeout`;
                const timeoutRaw = el.getAttribute(timeoutAttr) || el.getAttribute(timeoutFallbackAttr);
                cleanAttributes(el, [timeoutAttr]);
                const timeoutLimit = timeoutRaw ? parseInt(timeoutRaw, 10) : 0;

                const cacheAttr = `${prefix}scope-cache:${sName}`;
                const cacheFallbackAttr = `${prefix}scope-cache`;
                const cacheRaw = el.getAttribute(cacheAttr) || el.getAttribute(cacheFallbackAttr);
                cleanAttributes(el, [cacheAttr]);
                const cacheDuration = cacheRaw ? parseInt(cacheRaw, 10) : 0;

                const resetAttr = `${prefix}scope-reset:${sName}`;
                const resetFallbackAttr = `${prefix}scope-reset`;
                const resetRaw = el.getAttribute(resetAttr) || el.getAttribute(resetFallbackAttr);
                cleanAttributes(el, [resetAttr]);
                const resetOnRefresh = resetRaw === 'true';

                const ctrl = new ScopeController({
                    name: sName,
                    expression: sExpr,
                    parsedDefaults,
                    ctx,
                    childCtx,
                    el,
                    retryLimit,
                    retryDelay,
                    backoff,
                    pollInterval,
                    timeoutLimit,
                    cacheDuration,
                    resetOnRefresh
                });

                controllers[sName] = ctrl;
                childCtx[sName] = ctrl.state;
            }

            cleanAttributes(el, [
                `${prefix}scope-retry`,
                `${prefix}scope-retry-delay`,
                `${prefix}scope-backoff`,
                `${prefix}scope-poll`,
                `${prefix}scope-timeout`,
                `${prefix}scope-cache`,
                `${prefix}scope-reset`
            ]);

            el._hx_scope_controllers = controllers;

            const thisCtrl = controllers[name];
            if (thisCtrl) {
                trackCleanup(() => {
                    thisCtrl.destroy();
                });
            }

            const rebind = (app && app.rebind) || (typeof window !== 'undefined' && window.Helix && window.Helix.rebind);
            for (const child of el.childNodes) {
                if (child.__hx_binding && rebind) {
                    rebind(child, { ctx: childCtx, instance });
                } else {
                    bindNode(child, childCtx, instance, [], true);
                }
            }

            onComponentMount(instance, () => {
                for (const ctrl of Object.values(controllers)) {
                    ctrl.refresh();
                }
            });
        }
    };
}
