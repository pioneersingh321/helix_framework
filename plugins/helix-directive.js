// ============================================================
// Helix.js Directives Plugin v2.1.2 (Helix v11.1.6 Compliant)
// Native plugin architecture for Helix >= v11.1.5-STABLE
// Includes: if-call, show-call, focus, debounce, permission, tooltip, cloak, fetch
// ============================================================

const HelixDirectivesPlugin = (() => {
    'use strict';

    // ---------- Metadata ----------
    const META = {
        name: 'directives',
        version: '2.1.2',
        description: 'Conditional render, display, focus, debounce, permission, tooltip, cloak and fetch directives for Helix.js',
        author: 'Helix Ecosystem',
        dependencies: ['core'],
        optional: ['fetch'],
        namespace: 'directives',
        provides: ['directives', '$directives']
    };

    const DEFAULT_CONFIG = {
        tooltipClass: 'hx-tooltip',
        tooltipBaseZIndex: 9999,
        permissionPath: 'store.user.permissions',
        cloakAttr: 'cloak',
        observe: true
    };

    const directiveRegistry = new Map();
    const mountedElements = new WeakMap();

    // FIXED: Global References mapped cleanly to v11 engine primitives
    let HX_EFFECT = null;
    let HX_WATCH = null;
    let HX_SCOPE = null;

    function generateId(len = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < len; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
        return id;
    }

    // FIXED: Resolves paths against the localized template Iteration Context (ctx), not just global app state
    function resolvePath(ctx, path, fallback) {
        if (!path) return fallback;
        if (typeof path !== 'string') return path;

        if (typeof Helix !== 'undefined' && typeof Helix.resolvePath === 'function') {
            const res = Helix.resolvePath(path, ctx);
            if (res !== undefined) return res;
        }

        const parts = path.replace(/\[['"]?([^'"\]]+)['"]?\]/g, ".$1").split('.').filter(Boolean);
        let val = ctx;
        for (const p of parts) {
            if (val == null) return fallback;
            val = typeof val.unwrap === 'function' ? val.unwrap()[p] : val[p];
            if (typeof Helix !== 'undefined' && Helix.isRef && Helix.isRef(val)) {
                val = val.value;
            }
        }
        return val !== undefined ? val : fallback;
    }

    function resolveBool(ctx, path) {
        return !!resolvePath(ctx, path, false);
    }

    // FIXED: Parse calls with balanced argument extraction avoiding quote collisions
    function parseCall(str) {
        if (!str) return null;
        const parenIdx = str.indexOf('(');
        if (parenIdx === -1) return { fnPath: str.trim(), args: [] };

        const fnPath = str.slice(0, parenIdx).trim();
        const argsStr = str.slice(parenIdx + 1, -1).trim();
        const args = [];

        if (!argsStr) return { fnPath, args };

        let depth = 0, current = '', inQuote = false, quoteChar = '';
        for (let i = 0; i < argsStr.length; i++) {
            const ch = argsStr[i];
            if (!inQuote && (ch === '"' || ch === "'")) {
                inQuote = true; quoteChar = ch; current += ch;
            } else if (inQuote && ch === quoteChar && argsStr[i - 1] !== '\\') {
                inQuote = false; current += ch;
            } else if (!inQuote && (ch === '(' || ch === '{' || ch === '[')) {
                depth++; current += ch;
            } else if (!inQuote && (ch === ')' || ch === '}' || ch === ']')) {
                depth--; current += ch;
            } else if (!inQuote && ch === ',' && depth === 0) {
                args.push(current.trim()); current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) args.push(current.trim());
        return { fnPath, args };
    }

    function evaluateArgs(ctx, argList, extra = {}) {
        return argList.map(a => {
            if (a === '$event') return extra.event;
            const resolved = resolvePath(ctx, a);
            if (resolved !== undefined) return resolved;
            try { return JSON.parse(a); } catch { }
            if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
                return a.slice(1, -1);
            }
            return a;
        });
    }

    function bindNodeHelix(app, el, ctx) {
        if (typeof Helix !== 'undefined' && Helix.bindNode) return Helix.bindNode(el, ctx, app);
        if (app && app.bindNode) return app.bindNode(el, ctx);
    }

    function getEntry(el) {
        let entry = mountedElements.get(el);
        if (!entry) {
            entry = { cleanups: [], scope: null, directives: new Set() };
            mountedElements.set(el, entry);
        }
        return entry;
    }

    function trackCleanup(el, fn) {
        getEntry(el).cleanups.push(fn);
    }

    function runCleanup(el) {
        const entry = mountedElements.get(el);
        if (!entry) return;
        entry.cleanups.forEach(fn => { try { fn(); } catch (e) { console.error('[directives] cleanup error:', e); } });
        if (entry.scope && typeof entry.scope.stop === 'function') entry.scope.stop();
        mountedElements.delete(el);
    }

    function parseFetchConfig(ctx, str) {
        if (!str || typeof str !== 'string') return str;
        str = str.trim();
        if (!str.startsWith('{') && !str.startsWith('[')) {
            return { url: str, method: 'GET' };
        }
        try {
            const normalized = str
                .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
                .replace(/:\s*'([^']*)'/g, ':"$1"');
            return JSON.parse(normalized);
        } catch (e) {
            const resolved = resolvePath(ctx, str);
            if (resolved && typeof resolved === 'object') return resolved;
            console.warn('[directives] [fetch] Unable to parse config:', str);
            return null;
        }
    }

    /* ============================================================
       3. DIRECTIVE DEFINITIONS
       ============================================================ */

    directiveRegistry.set('if-call', {
        mounted(el, binding) {
            const { value, ctx, app } = binding;
            const parts = value.split('|').map(s => s.trim());
            const condPart = parts[0];
            const callPart = parts[1];

            const placeholder = document.createComment(' hx-if-call ');
            let isMounted = false;

            if (el.parentNode) {
                el.parentNode.insertBefore(placeholder, el);
                el.remove();
            }

            const call = callPart ? parseCall(callPart) : null;
            const callbackFn = call ? resolvePath(ctx, call.fnPath) : null;
            const entry = getEntry(el);

            const scope = HX_SCOPE ? new HX_SCOPE() : null;
            if (scope) entry.scope = scope;

            const runEffect = () => {
                const isTrue = resolveBool(ctx, condPart);
                if (isTrue && !isMounted) {
                    if (typeof callbackFn === 'function') callbackFn.call(ctx, ...evaluateArgs(ctx, call.args));
                    bindNodeHelix(app, el, ctx);
                    if (placeholder.parentNode) placeholder.parentNode.insertBefore(el, placeholder);
                    isMounted = true;
                } else if (!isTrue && isMounted) {
                    if (el.parentNode) el.remove();
                    isMounted = false;
                }
            };

            if (scope && HX_EFFECT) {
                scope.run(() => { HX_EFFECT(runEffect); });
            } else if (HX_EFFECT) {
                HX_EFFECT(runEffect);
            } else {
                runEffect();
            }

            trackCleanup(el, () => {
                if (scope) scope.stop();
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                isMounted = false;
            });
        }
    });

    directiveRegistry.set('show-call', {
        mounted(el, binding) {
            const { value, ctx } = binding;
            const parts = value.split('|').map(s => s.trim());
            const condPart = parts[0];
            const showCallPart = parts[1];
            const hideCallPart = parts[2];

            const showCall = showCallPart ? parseCall(showCallPart) : null;
            const hideCall = hideCallPart ? parseCall(hideCallPart) : null;
            const showFn = showCall ? resolvePath(ctx, showCall.fnPath) : null;
            const hideFn = hideCall ? resolvePath(ctx, hideCall.fnPath) : null;

            let wasVisible = false;
            const entry = getEntry(el);
            const scope = HX_SCOPE ? new HX_SCOPE() : null;
            if (scope) entry.scope = scope;

            const runEffect = () => {
                const isTrue = resolveBool(ctx, condPart);
                el.style.display = isTrue ? '' : 'none';
                if (isTrue && !wasVisible && typeof showFn === 'function') {
                    showFn.call(ctx, ...evaluateArgs(ctx, showCall.args));
                } else if (!isTrue && wasVisible && typeof hideFn === 'function') {
                    hideFn.call(ctx, ...evaluateArgs(ctx, hideCall.args));
                }
                wasVisible = isTrue;
            };

            if (scope && HX_EFFECT) {
                scope.run(() => { HX_EFFECT(runEffect); });
            } else if (HX_EFFECT) {
                HX_EFFECT(runEffect);
            } else {
                runEffect();
            }

            trackCleanup(el, () => { if (scope) scope.stop(); });
        }
    });

    directiveRegistry.set('focus', {
        mounted(el, binding) {
            const { value, ctx } = binding;
            const rafId = requestAnimationFrame(() => {
                el.focus();
                if (value) {
                    const fn = resolvePath(ctx, value);
                    if (typeof fn === 'function') fn.call(ctx, el);
                }
            });
            trackCleanup(el, () => cancelAnimationFrame(rafId));
        }
    });

    // FIXED: Debounce defers variable hydration until execution step allowing dynamic arguments
    directiveRegistry.set('debounce', {
        mounted(el, binding) {
            const { value, arg, ctx } = binding;
            const evtType = arg || 'input';

            let expression = '';
            let delay = 300;
            const raw = (typeof value === 'string' ? value : String(value)).trim();

            if (raw.startsWith('[') && raw.endsWith(']')) {
                const inner = raw.slice(1, -1);
                const lastComma = inner.lastIndexOf(',');
                if (lastComma !== -1) {
                    expression = inner.slice(0, lastComma).trim();
                    delay = parseInt(inner.slice(lastComma + 1).trim(), 10) || 300;
                } else {
                    expression = inner.trim();
                }
            } else {
                expression = raw;
            }

            if ((expression.startsWith("'") && expression.endsWith("'")) ||
                (expression.startsWith('"') && expression.endsWith('"'))) {
                expression = expression.slice(1, -1);
            }

            const callData = parseCall(expression);
            let timeout;
            const handler = (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    if (callData) {
                        const fn = resolvePath(ctx, callData.fnPath);
                        if (typeof fn === 'function') {
                            const argsToPass = callData.args.length > 0
                                ? evaluateArgs(ctx, callData.args, { event: e })
                                : [e];
                            fn.apply(ctx, argsToPass);
                        } else if (typeof Helix !== 'undefined' && typeof Helix.evaluate === 'function') {
                            Helix.evaluate(expression, ctx, { $event: e });
                        } else {
                            console.warn(`[directives] [debounce] Cannot resolve function "${callData.fnPath}" on context.`);
                        }
                    }
                }, delay);
            };

            el.addEventListener(evtType, handler);
            trackCleanup(el, () => {
                el.removeEventListener(evtType, handler);
                clearTimeout(timeout);
            });
        }
    });

    directiveRegistry.set('permission', {
        mounted(el, binding) {
            const { value, ctx, app, config } = binding;

            const placeholder = document.createComment(' hx-permission ');
            let isMounted = false;

            if (el.parentNode) {
                el.parentNode.insertBefore(placeholder, el);
                el.remove();
            }

            const required = Array.isArray(value) ? value : value.split(',').map(s => s.trim());
            const permPath = config.permissionPath || DEFAULT_CONFIG.permissionPath;

            const entry = getEntry(el);
            const scope = HX_SCOPE ? new HX_SCOPE() : null;
            if (scope) entry.scope = scope;

            const checkPermission = () => {
                const perms = resolvePath(ctx, permPath);
                if (!Array.isArray(perms)) return false;
                return required.some(p => perms.includes(p));
            };

            const runEffect = () => {
                const hasPerm = checkPermission();
                if (hasPerm && !isMounted) {
                    bindNodeHelix(app, el, ctx);
                    if (placeholder.parentNode) placeholder.parentNode.insertBefore(el, placeholder);
                    isMounted = true;
                } else if (!hasPerm && isMounted) {
                    if (el.parentNode) el.remove();
                    isMounted = false;
                }
            };

            if (scope && HX_EFFECT) {
                scope.run(() => { HX_EFFECT(runEffect); });
            } else if (HX_EFFECT) {
                HX_EFFECT(runEffect);
            } else {
                runEffect();
            }

            trackCleanup(el, () => {
                if (scope) scope.stop();
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                isMounted = false;
            });
        }
    });

    directiveRegistry.set('tooltip', {
        mounted(el, binding) {
            const { value, arg, config } = binding;
            const position = arg || 'top';

            const tip = document.createElement('div');
            const cls = config.tooltipClass || DEFAULT_CONFIG.tooltipClass;
            tip.className = `${cls} ${cls}-${position}`;
            tip.textContent = value;
            tip.style.cssText = `position:absolute;z-index:${config.tooltipBaseZIndex || DEFAULT_CONFIG.tooltipBaseZIndex};display:none;padding:5px 10px;background:#333;color:#fff;border-radius:4px;font-size:12px;white-space:nowrap;pointer-events:none;`;

            document.body.appendChild(tip);

            const show = () => {
                const rect = el.getBoundingClientRect();
                tip.style.display = 'block';
                const tipRect = tip.getBoundingClientRect();

                let top, left;
                switch (position) {
                    case 'bottom': top = rect.bottom + 5; left = rect.left + (rect.width - tipRect.width) / 2; break;
                    case 'left': top = rect.top + (rect.height - tipRect.height) / 2; left = rect.left - tipRect.width - 5; break;
                    case 'right': top = rect.top + (rect.height - tipRect.height) / 2; left = rect.right + 5; break;
                    default: top = rect.top - tipRect.height - 5; left = rect.left + (rect.width - tipRect.width) / 2;
                }

                tip.style.top = `${top + window.scrollY}px`;
                tip.style.left = `${left + window.scrollX}px`;
            };

            const hide = () => { tip.style.display = 'none'; };

            el.addEventListener('mouseenter', show);
            el.addEventListener('mouseleave', hide);

            trackCleanup(el, () => {
                tip.remove();
                el.removeEventListener('mouseenter', show);
                el.removeEventListener('mouseleave', hide);
            });
        }
    });

    directiveRegistry.set('cloak', {
        mounted(el, binding) {
            const { config } = binding;
            const prefix = config.prefix || 'h';
            const attr = `${prefix}-${config.cloakAttr || 'cloak'}`;
            el.removeAttribute('v-cloak');
            el.removeAttribute('mv-cloak');
            el.removeAttribute(attr);
            el.removeAttribute(config.cloakAttr || 'cloak');
        }
    });

    directiveRegistry.set('fetch', {
        mounted(el, binding) {
            const { value, ctx, app, config } = binding;
            const prefix = config.prefix || 'h';

            const fetchApi = app.fetch || app.$fetch || (typeof Helix !== 'undefined' && Helix.$fetch);
            if (!fetchApi) return;

            const resolveValue = (v) => {
                if (typeof v === 'function') v = v();
                if (typeof v === 'string') return parseFetchConfig(ctx, v);
                return v;
            };
            const getConfig = () => resolveValue(value);

            let currentInstance = null;
            let stopWatch = null;
            let isDestroyed = false;

            const rawPoll = el.getAttribute(`${prefix}-poll`);
            const pollMs = rawPoll ? parseInt(rawPoll, 10) : 0;
            const isPoll = !isNaN(pollMs) && pollMs > 0;

            const rawAbort = el.getAttribute(`${prefix}-abort`);
            const abortId = rawAbort || getConfig()?.abortId || generateId();

            const runFetch = (cfg) => {
                if (isDestroyed) return;
                if (currentInstance) {
                    currentInstance.cancel?.();
                    currentInstance.stopPolling?.();
                    currentInstance._cleanup?.();
                }

                el.setAttribute(`${prefix}-fetch-loading`, '');
                el.removeAttribute(`${prefix}-fetch-done`);
                el.removeAttribute(`${prefix}-fetch-error`);

                const runId = {};
                el._hxFetchRun = runId;

                const reqConfig = {
                    ...cfg,
                    abortId,
                    onSuccess: (res) => {
                        if (isDestroyed || el._hxFetchRun !== runId) return;
                        el.removeAttribute(`${prefix}-fetch-loading`);
                        el.setAttribute(`${prefix}-fetch-done`, '');

                        if (cfg.storeKey) {
                            const parts = cfg.storeKey.split('.');
                            let target = ctx;
                            for (let i = 0; i < parts.length - 1; i++) {
                                target = target?.[parts[i]];
                            }
                            if (target != null && parts.length > 0) {
                                const key = parts[parts.length - 1];
                                if (typeof target === 'object') target[key] = res.data ?? res;
                            }
                        }
                        cfg.onSuccess?.(res);
                    },
                    onError: (err) => {
                        if (isDestroyed || el._hxFetchRun !== runId) return;
                        el.setAttribute(`${prefix}-fetch-error`, err.message || 'error');
                        cfg.onError?.(err);
                    }
                };

                if (isPoll) {
                    currentInstance = fetchApi.request({ ...reqConfig, lazy: true, pollInterval: pollMs });
                    currentInstance.execute().catch(() => { }).then(() => {
                        if (!isDestroyed && el._hxFetchRun === runId) currentInstance.startPolling();
                    });
                } else {
                    currentInstance = fetchApi.request(reqConfig);
                    currentInstance.execute().catch(() => { });
                }
            };

            const entry = getEntry(el);
            const scope = HX_SCOPE ? new HX_SCOPE() : null;
            if (scope) entry.scope = scope;

            if (typeof value === 'function' && scope && HX_WATCH) {
                scope.run(() => {
                    stopWatch = HX_WATCH(value, (newVal) => {
                        const cfg = resolveValue(newVal);
                        if (cfg && cfg.url) runFetch(cfg);
                    }, { immediate: true });
                });
            } else {
                const initial = getConfig();
                if (initial && initial.url) runFetch(initial);
            }

            const cleanup = () => {
                isDestroyed = true;
                if (typeof stopWatch === 'function') stopWatch();
                if (scope && typeof scope.stop === 'function') scope.stop();
                currentInstance?.cancel?.();
                currentInstance?.stopPolling?.();
                currentInstance?._cleanup?.();
                el.removeAttribute(`${prefix}-fetch-loading`);
                el.removeAttribute(`${prefix}-fetch-done`);
                el.removeAttribute(`${prefix}-fetch-error`);
                delete el._hxFetchRun;
            };

            trackCleanup(el, cleanup);
        },

        updated(el, binding) {
            if (typeof binding.value === 'function') return;
            const newCfg = binding.value;
            const oldCfg = el._hxFetchLastConfig;
            if (oldCfg !== newCfg) {
                const entry = mountedElements.get(el);
                if (entry) {
                    entry.cleanups.forEach(fn => { try { fn(); } catch (e) { } });
                    entry.cleanups = [];
                }
                this.mounted(el, binding);
            }
            el._hxFetchLastConfig = newCfg;
        }
    });

    /* ============================================================
       4. PLUGIN COMPLIANT INSTALLER
       ============================================================ */

    function install(app, options = {}) {
        const prefix = app.config?.prefix || 'h';
        const config = { ...DEFAULT_CONFIG, ...app.config?.directives, ...options, prefix };
        const bus = app.$bus || app.bus || null;

        // Extract v11 globals cleanly
        if (typeof Helix !== 'undefined') {
            HX_EFFECT = Helix.effect;
            HX_WATCH = Helix.watch;
            HX_SCOPE = Helix.EffectScope;
        }

        if (app.namespace) app.namespace(META.namespace);

        // FIXED: Added missing `isValid` method to resolve the TypeError crashes downstream
        const api = {
            register: (name, def) => {
                directiveRegistry.set(name, def);
                if (app.directive) app.directive(name, def);
                if (observer && document.body) {
                    observer.disconnect();
                    const allDirectiveAttrs = Array.from(directiveRegistry.keys()).map(k => `${prefix}-${k}`);
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: allDirectiveAttrs
                    });
                }
            },
            get: (name) => directiveRegistry.get(name),
            resolvePath: (ctx, path, fallback) => resolvePath(ctx, path, fallback),
            isValid: (binding) => {
                // Provides core structural validation logic to satisfy internal compilation
                return binding && binding.value !== undefined && binding.value !== null;
            },
            version: META.version,
            config,
            meta: META
        };

        app.provide('directives', api);
        app.provide('$directives', api);

        if (app.config && app.config.globalProperties) {
            app.config.globalProperties.$directives = api;
        }

        directiveRegistry.forEach((def, name) => {
            if (app.directive) app.directive(name, def);
        });

        function applyDirective(el, name, binding) {
            const def = directiveRegistry.get(name);
            if (!def) return;
            const entry = getEntry(el);
            if (entry.directives.has(name)) return;

            entry.directives.add(name);
            try {
                def.mounted(el, binding);
            } catch (err) {
                entry.directives.delete(name);
                console.error(`[directives] Error mounting "${name}" on`, el, err);
            }
        }

        function scan(root = document) {
            if (!root.querySelectorAll) return;
            const candidates = root.nodeType === 1
                ? [root, ...root.querySelectorAll('*')]
                : [...root.querySelectorAll('*')];

            candidates.forEach(el => {
                const names = el.getAttributeNames();
                for (const an of names) {
                    if (!an.startsWith(`${prefix}-`)) continue;
                    const withoutPrefix = an.slice(prefix.length + 1);
                    const namePart = withoutPrefix.split(':')[0];
                    if (!directiveRegistry.has(namePart)) continue;

                    const binding = {
                        value: el.getAttribute(an),
                        arg: withoutPrefix.includes(':') ? withoutPrefix.split(':').slice(1).join(':') : null,
                        app,
                        config,
                        ctx: el.__hx_scope || app
                    };
                    applyDirective(el, namePart, binding);
                }
            });
        }

        api.scan = scan;
        app.directives = api;

        let observer = null;
        if (config.observe !== false && typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes') {
                        const el = mutation.target;
                        const attrName = mutation.attributeName;
                        if (!attrName || !attrName.startsWith(`${prefix}-`)) return;

                        const withoutPrefix = attrName.slice(prefix.length + 1);
                        const namePart = withoutPrefix.split(':')[0];
                        const def = directiveRegistry.get(namePart);

                        if (def && def.updated && mountedElements.has(el)) {
                            const binding = {
                                value: el.getAttribute(attrName),
                                arg: withoutPrefix.includes(':') ? withoutPrefix.split(':').slice(1).join(':') : null,
                                app,
                                config,
                                ctx: el.__hx_scope || app
                            };
                            try { def.updated(el, binding); } catch (err) { }
                        }
                        return;
                    }

                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) scan(node);
                    });
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            runCleanup(node);
                            node.querySelectorAll?.('*').forEach(child => runCleanup(child));
                        }
                    });
                });
            });
        }

        const bootstrap = () => {
            scan();
            if (observer && document.body) {
                const allDirectiveAttrs = Array.from(directiveRegistry.keys()).map(k => `${prefix}-${k}`);
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: allDirectiveAttrs
                });
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootstrap);
        } else {
            bootstrap();
        }

        if (bus) bus.emit('plugin:directives:installed', { version: META.version, config });

        return () => {
            if (observer) observer.disconnect();
            document.querySelectorAll('*').forEach(el => runCleanup(el));
            if (bus) bus.emit('plugin:directives:destroyed', { version: META.version });
        };
    }

    return { ...META, install };
})();

if (typeof Helix !== 'undefined') {
    Helix.use(HelixDirectivesPlugin);
} else if (typeof window !== 'undefined') {
    window.HelixDirectivesPlugin = HelixDirectivesPlugin;
}