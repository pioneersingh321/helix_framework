import { currentInstance, warn } from '../shared/shared.js';
import { ref } from '../reactivity/ref.js';

export function onErrorCaptured(cb) {
    if (!currentInstance) {
        warn("onErrorCaptured() can only be called inside setup().", "component");
        return;
    }
    if (!currentInstance.errorCapturedHooks) {
        currentInstance.errorCapturedHooks = [];
    }
    currentInstance.errorCapturedHooks.push(cb);
}

export function createErrorBoundary(fallbackComponent) {
    return {
        name: "ErrorBoundary",
        setup(setupCtx) {
            const hasError = ref(false);
            const capturedError = ref(null);

            onErrorCaptured((err, instance, info) => {
                hasError.value = true;
                capturedError.value = err;
                return false; // stop propagation
            });

            const renderFallback = () => {
                if (!fallbackComponent) {
                    return { template: `<div class="hx-error-boundary">An unexpected error occurred.</div>` };
                }
                if (typeof fallbackComponent === "string") {
                    return { template: fallbackComponent };
                }
                if (typeof fallbackComponent === "function") {
                    const res = fallbackComponent(capturedError.value, setupCtx);
                    return typeof res === "object" && res !== null ? res : { template: "" };
                }
                if (typeof fallbackComponent === "object" && fallbackComponent !== null) {
                    if (typeof fallbackComponent.setup === "function") {
                        const res = fallbackComponent.setup(setupCtx);
                        return typeof res === "object" && res !== null ? res : { template: "" };
                    }
                    if (fallbackComponent.template !== undefined) return fallbackComponent;
                }
                return { template: "" };
            };

            return {
                hasError,
                capturedError,
                renderFallback,
                reset() {
                    hasError.value = false;
                    capturedError.value = null;
                }
            };
        }
    };
}
