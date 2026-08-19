import { reactive } from '../reactivity/reactive.js';
import { provide } from '../app/lifecycle.js';

export const Suspense = {
    name: "Suspense",
    setup(ctx) {
        const state = reactive({ pending: true, error: null });
        let pendingCount = 0;

        provide('__hx_suspense__', (promise) => {
            pendingCount++;
            state.pending = true;
            Promise.resolve(promise)
                .catch((err) => { state.error = err; })
                .finally(() => {
                    pendingCount = Math.max(0, pendingCount - 1);
                    if (pendingCount === 0) state.pending = false;
                });
        });

        return {
            state,
            template: `
                <div class="helix-suspense">
                    <template hx-if="state.pending">
                        <slot name="fallback"><div class="suspense-loading">Loading...</div></slot>
                    </template>
                    <template hx-else-if="state.error">
                        <slot name="error"><div class="suspense-error">{{ state.error.message || state.error }}</div></slot>
                    </template>
                    <template hx-else>
                        <slot></slot>
                    </template>
                </div>
            `
        };
    }
};
