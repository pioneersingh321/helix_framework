import { reactive } from '../reactivity/reactive.js';

export const Suspense = {
    name: "Suspense",
    setup(ctx) {
        const { slots } = ctx;
        const state = reactive({
            pending: true,
            error: null
        });

        return {
            state,
            renderFallback() {
                if (slots.fallback) {
                    return slots.fallback();
                }
                return { template: "<div class='suspense-loading'>Loading...</div>" };
            },
            renderDefault() {
                if (slots.default) {
                    return slots.default();
                }
                return { template: "" };
            },
            template: `
                <div class="helix-suspense">
                    <template hx-if="state.pending">
                        <div hx-html="renderFallback().template"></div>
                    </template>
                    <template hx-if="!state.pending">
                        <div hx-html="renderDefault().template"></div>
                    </template>
                </div>
            `
        };
    }
};
