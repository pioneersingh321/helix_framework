import { handleError, warn } from '../shared/shared.js';
import { inject } from '../app/lifecycle.js';
import { reactive } from '../reactivity/reactive.js';

const registeredAsyncComponents = new Set();
const memoryCache = new Map();

export function defineAsyncComponent(source) {
    const options = typeof source === "function" ? { loader: source } : source;
    if (!options || typeof options.loader !== "function") {
        throw new TypeError("defineAsyncComponent requires a loader function.");
    }

    const {
        loader,
        loadingComponent,
        errorComponent,
        delay = 200,
        timeout,
        retries = 0,
        retryDelay = 1000,
        cache = true,
        onError: onErrorHandler,
        suspensible = false
    } = options;

    const useCache = cache !== false;
    const cacheKey = options.name || loader.toString();
    let pendingPromise = null;

    const getCached = () => {
        return useCache ? (memoryCache.get(cacheKey) || null) : null;
    };

    const setCached = (comp) => {
        if (useCache) {
            memoryCache.set(cacheKey, comp);
        }
    };

    const loadWithRetries = (attempt = 0) => {
        return loader().catch((err) => {
            if (typeof onErrorHandler === "function") {
                return new Promise((resolve, reject) => {
                    const retry = () => resolve(loadWithRetries(attempt + 1));
                    const fail = () => reject(err);
                    try {
                        onErrorHandler(err, retry, fail, attempt);
                    } catch (e) {
                        reject(e);
                    }
                });
            }
            if (attempt < retries) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve(loadWithRetries(attempt + 1)), retryDelay);
                });
            }
            throw err;
        });
    };

    const loadWithTimeout = () => {
        const primaryPromise = loadWithRetries();
        if (!timeout || timeout <= 0) return primaryPromise;

        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Async component load timed out after ${timeout}ms.`));
            }, timeout);
        });

        return Promise.race([primaryPromise, timeoutPromise]).finally(() => {
            if (timer) clearTimeout(timer);
        });
    };

    const load = () => {
        const cached = getCached();
        if (cached) return Promise.resolve(cached);
        if (pendingPromise) return pendingPromise;

        pendingPromise = loadWithTimeout()
            .then((comp) => {
                const resolved = comp && comp.__esModule ? comp.default : comp;
                setCached(resolved);
                pendingPromise = null;
                return resolved;
            })
            .catch((err) => {
                pendingPromise = null;
                throw err;
            });

        return pendingPromise;
    };

    const getTemplateFromComponent = (comp, setupCtx) => {
        if (!comp) return { template: "" };
        if (typeof comp === "function") {
            const res = comp(setupCtx);
            return typeof res === "object" && res !== null ? res : { template: "" };
        }
        if (typeof comp === "object" && comp !== null) {
            if (typeof comp.setup === "function") {
                const res = comp.setup(setupCtx);
                return typeof res === "object" && res !== null ? res : { template: "" };
            }
            if (comp.template !== undefined) return comp;
        }
        return { template: "" };
    };

    const asyncCompHost = {
        name: options.name || "AsyncComponentHost",
        suspensible,
        preload() {
            return load();
        },
        setup(setupCtx) {
            const cached = getCached();
            if (cached) {
                return getTemplateFromComponent(cached, setupCtx);
            }

            const suspenseRegister = suspensible ? inject('__hx_suspense__', null) : null;
            const loadPromise = load();

            if (suspenseRegister) {
                suspenseRegister(loadPromise);
                return loadPromise
                    .then((loadedComp) => getTemplateFromComponent(loadedComp, setupCtx))
                    .catch((err) => errorComponent
                        ? getTemplateFromComponent(errorComponent, setupCtx)
                        : { template: "", error: err });
            }

            if (!loadingComponent && !errorComponent) {
                return loadPromise.then((loadedComp) => getTemplateFromComponent(loadedComp, setupCtx));
            }

            const isImmediateLoading = delay === 0 && loadingComponent;
            const initialLoadingTpl = isImmediateLoading ? (getTemplateFromComponent(loadingComponent, setupCtx).template || "") : "";
            const compState = reactive({
                status: isImmediateLoading ? "loading" : "pending",
                template: initialLoadingTpl
            });

            let delayTimer = null;
            if (delay > 0 && loadingComponent) {
                delayTimer = setTimeout(() => {
                    if (compState.status === "pending") {
                        compState.status = "loading";
                        compState.template = getTemplateFromComponent(loadingComponent, setupCtx).template || "";
                    }
                }, delay);
            }

            loadPromise
                .then((loadedComp) => {
                    if (delayTimer) clearTimeout(delayTimer);
                    compState.status = "resolved";
                    compState.template = getTemplateFromComponent(loadedComp, setupCtx).template || "";
                })
                .catch((err) => {
                    if (delayTimer) clearTimeout(delayTimer);
                    compState.status = "error";
                    compState.template = errorComponent ? (getTemplateFromComponent(errorComponent, setupCtx).template || "") : "";
                });

            return compState;
        }
    };

    registeredAsyncComponents.add(asyncCompHost);
    return asyncCompHost;
}

export function preload(components) {
    if (!components) return Promise.resolve([]);
    const list = Array.isArray(components) ? components : [components];
    const promises = list.map((comp) => {
        if (comp && typeof comp.preload === "function") {
            return comp.preload();
        }
        return Promise.resolve(comp);
    });
    return Promise.all(promises);
}

export function preloadAll() {
    const promises = [];
    registeredAsyncComponents.forEach((comp) => {
        if (typeof comp.preload === "function") {
            promises.push(comp.preload());
        }
    });
    return Promise.all(promises);
}
