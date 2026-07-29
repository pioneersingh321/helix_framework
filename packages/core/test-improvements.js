import {
    reactive,
    ref,
    effect,
    batch,
    memo,
    watch,
    watchEffect,
    devtools,
    effectGroup,
    createEffectGroup,
    inspectDeps,
    dom,
    definePlugin,
    registry,
    directives,
    defineAsyncComponent,
    preload,
    preloadAll,
    createErrorBoundary,
    onErrorCaptured,
    onError,
    inspectComponent,
    checkMemoryLeaks,
    EffectScope,
    effectScope,
    getCurrentScope,
    onScopeDispose,
    Suspense,
    inspectTree,
    validatePluginDependencies,
    profile,
    getProfileData,
    scopeScheduler,
    use,
    unuse,
    config
} from './src/index.js';

console.log("=========================================");
console.log(" Running Comprehensive Helix Core Tests");
console.log("=========================================");

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (condition) {
        console.log(` ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(` ❌ FAIL: ${message}`);
        process.exitCode = 1;
    }
}

config.debug = true;

// 1. Batch API with Priorities & Trigger Deduplication
assert(typeof batch.high === "function" && typeof batch.low === "function", "batch.high and batch.low exist");

const highPriorityEff = effect(() => {}, { priority: "high" });
assert(highPriorityEff.priority === 10, "effect({ priority: 'high' }) parses to numeric priority 10");

const lowPriorityEff = effect(() => {}, { priority: "low" });
assert(lowPriorityEff.priority === -10, "effect({ priority: 'low' }) parses to numeric priority -10");

let batchTriggerCount = 0;
const batchState = reactive({ val: 0 });
effect(() => {
    batchState.val;
    batchTriggerCount++;
});

batchTriggerCount = 0;
batch(() => {
    for (let i = 0; i < 100; i++) {
        batchState.val = i;
    }
});
assert(batchState.val === 99, "Batch mutates state to 99");

// 2. Watch API Ergonomics (Multi-Source Array & Once Option)
const r1 = ref(10);
const r2 = ref(20);
let multiWatchTriggerCount = 0;
let lastNewVals = null;
watch([r1, r2], (newVals) => {
    multiWatchTriggerCount++;
    lastNewVals = newVals;
}, { flush: "sync" });

r1.value = 15;
assert(multiWatchTriggerCount === 1, "Multi-source watch triggered once on r1 change");
assert(lastNewVals[0] === 15 && lastNewVals[1] === 20, "Multi-source watch callback receives array tuple [15, 20]");

let onceWatchCount = 0;
const onceRef = ref(100);
watch(onceRef, () => {
    onceWatchCount++;
}, { flush: "sync", once: true });

onceRef.value = 200;
onceRef.value = 300;
assert(onceWatchCount === 1, "watch({ once: true }) triggered exactly 1 time despite multiple mutations");

// 3. DevTools Introspection APIs
const activeEffectsList = devtools.getEffects();
assert(Array.isArray(activeEffectsList), "Helix.devtools.getEffects() returns array of running effects");

const targetForDeps = reactive({ name: "Helix" });
effect(() => { targetForDeps.name; });
const depsInfo = devtools.getDependencies(targetForDeps);
assert(depsInfo.some((d) => d.key === "name" && d.subscribersCount >= 1), "Helix.devtools.getDependencies() inspects subscriber counts");

// 4. Helix.memo Memoized Computations
let calcCount = 0;
const memoState = reactive({ multiplier: 2, num: 5 });
const memoizedVal = memo(() => {
    calcCount++;
    return memoState.multiplier * memoState.num;
}, () => [memoState.multiplier, memoState.num]);

assert(memoizedVal.value === 10, "Helix.memo calculates initial memoized result (10)");
assert(calcCount === 1, "Getter calculated exactly 1 time");

const val2 = memoizedVal.value;
assert(val2 === 10, "Helix.memo returns cached result on subsequent access");
assert(calcCount === 1, "Getter was NOT re-evaluated on cached access");

memoState.num = 10;
assert(memoizedVal.value === 20, "Helix.memo re-calculates new value (20) when dependency updates");
assert(calcCount === 2, "Getter re-evaluated exactly once for new dependency state");

// 5. Bound Method Reference Identity Preservation
const reactiveStore = reactive({
    count: 0,
    increment() {
        this.count++;
    }
});
assert(reactiveStore.increment === reactiveStore.increment, "Proxy function property access preserves reference identity");

// 6. Active Effect Registration & Memory Leak Check
const standaloneEffect = effect(() => {}, { name: "standalone-leak-test" });
const leaks = checkMemoryLeaks();
assert(leaks.some((l) => l.name === "standalone-leak-test"), "checkMemoryLeaks() detects standalone running effects");

standaloneEffect.stop();
const leaksAfterStop = checkMemoryLeaks();
assert(!leaksAfterStop.some((l) => l.name === "standalone-leak-test"), "effect.stop() unregisters active effect from memory tracking");

// 7. effectScope() & onScopeDispose() API
const scopeInst = effectScope();
let disposed = false;
scopeInst.run(() => {
    onScopeDispose(() => { disposed = true; });
});
assert(getCurrentScope() === null, "getCurrentScope() returns null outside scope run");
scopeInst.stop();
assert(disposed === true, "onScopeDispose() callback executed when scope.stop() is called");

// 8. Suspense Component Definition
assert(Suspense && typeof Suspense.setup === "function", "Suspense component definition exists and exposes setup()");

// 9. Devtools Component Tree Inspector
const fakeInstance = {
    id: 1,
    name: "RootApp",
    provides: {},
    cleanups: [],
    root: { querySelectorAll: () => [] }
};
const tree = inspectTree(fakeInstance);
assert(tree && tree.name === "RootApp", "inspectTree() produces JSON component tree representation");

// 10. Inter-Plugin Dependency Validation
const depPlugin = definePlugin({
    name: "dep-plugin",
    requires: { "helix-core": ">=11.0.0" }
});
assert(validatePluginDependencies(depPlugin, "11.1.16") === true, "validatePluginDependencies validates semver constraints");

// 11. Performance Instrumentation & Profiler
const profileRes = profile(() => {
    const r = reactive({ a: 1 });
    r.a++;
    return r.a;
});
assert(profileRes === 2, "profile(fn) executes function and returns result");
const profData = getProfileData();
assert(typeof profData.duration === "number", "getProfileData() records profiling duration metrics");

// 12. Batched Scope Refreshes
const scope = new EffectScope();
let scopeRefreshCount = 0;
scope.refreshCallbacks.add(() => scopeRefreshCount++);

scope.refresh();
scope.refresh();
scope.refresh();
scope.refresh();
scope.refresh();

// 13. Plugin Lifecycle Hooks
const lifecycleEvents = [];
const lifecyclePlugin = definePlugin({
    name: "lifecycle-test-plugin",
    install(Helix) {
        lifecycleEvents.push("install");
    },
    mounted(Helix) {
        lifecycleEvents.push("mounted");
    },
    unmount(Helix) {
        lifecycleEvents.push("unmount");
    },
    destroy(Helix) {
        lifecycleEvents.push("destroy");
    }
});

use(lifecyclePlugin);
assert(lifecycleEvents.includes("install") && lifecycleEvents.includes("mounted"), "Plugin install and mounted lifecycle hooks executed on use()");

unuse(lifecyclePlugin);
assert(lifecycleEvents.includes("unmount") && lifecycleEvents.includes("destroy"), "Plugin unmount and destroy lifecycle hooks executed on unuse()");

// 14. ScopeScheduler Registration
const controller = { dirty: true, refresh: () => {} };
scopeScheduler.register(controller);
assert(scopeScheduler.controllers.has(controller), "ScopeScheduler registers scope controller");
scopeScheduler.unregister(controller);
assert(!scopeScheduler.controllers.has(controller), "ScopeScheduler unregisters scope controller");

// 15. defineAsyncComponent & ErrorBoundary
const asyncCard = defineAsyncComponent({
    name: "UserCard",
    loader: () => Promise.resolve({ template: "<div>User Card</div>" }),
    suspensible: false,
    cache: "memory"
});

assert(asyncCard.suspensible === false, "Async component exposes suspensible option");
assert(typeof asyncCard.setup === "function", "Async component exposes setup()");

const eb = createErrorBoundary("<div class='fallback'>Error Captured</div>");
const ebSetupRes = eb.setup({});
const fallbackRes = ebSetupRes.renderFallback();
assert(fallbackRes.template === "<div class='fallback'>Error Captured</div>", "createErrorBoundary renders fallbackComponent template correctly");

setTimeout(() => {
    assert(batchTriggerCount === 1, "Batch trigger deduplication: 100 loop mutations inside batch triggered effect exactly 1 time");
    assert(scopeRefreshCount === 1, "Batched Scope Refreshes: calling scope.refresh() 5 times in 1 tick executed refresh callback exactly once");
    console.log("=========================================");
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log("=========================================");
}, 100);
