import {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
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
    pauseTracking,
    resumeTracking,
    enableTracking,
    resetTracking,
    untrack,
    isReactive,
    isReadonly,
    shallowRef,
    onUpdated,
    rebind,
    customRef,
    queueIdleJob,
    createApp,
    $apps,
    use,
    unuse,
    config
} from './src/index.js';
import { flushJobs } from './src/reactivity/scheduler.js';
import { sanitizeHtml } from './src/compiler/html.js';
import { createBuiltinDirectives } from './src/directives/index.js';

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
config.allowInlineExpressions = true;

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
assert(ebSetupRes.fallbackHtml && ebSetupRes.fallbackHtml.value === "<div class='fallback'>Error Captured</div>", "createErrorBoundary exposes fallbackHtml computed ref with template string");
assert(ebSetupRes.template.includes('hx-html="fallbackHtml"'), "createErrorBoundary template binds fallbackHtml computed ref");

// 16. Reactive Map Support
const reactiveMapInstance = reactive(new Map());
let mapGetCount = 0;
let mapSizeCount = 0;
let lastGetVal = null;
let lastSize = 0;

effect(() => {
    lastGetVal = reactiveMapInstance.get("user");
    mapGetCount++;
});

effect(() => {
    lastSize = reactiveMapInstance.size;
    mapSizeCount++;
});

assert(mapGetCount === 1 && lastGetVal === undefined, "Initial reactive Map.get tracked");
assert(mapSizeCount === 1 && lastSize === 0, "Initial reactive Map.size tracked");

reactiveMapInstance.set("user", "Alice");
flushJobs();
assert(mapGetCount === 2 && lastGetVal === "Alice", "reactive Map.set triggers get effect with new value");
assert(mapSizeCount === 2 && lastSize === 1, "reactive Map.set triggers size effect");

reactiveMapInstance.set("user", "Alice"); // No-op value change
flushJobs();
assert(mapGetCount === 2, "reactive Map.set with identical value does not re-trigger");

reactiveMapInstance.set("role", "Admin");
flushJobs();
assert(mapSizeCount === 3 && lastSize === 2, "reactive Map.set new key triggers size effect");

reactiveMapInstance.delete("role");
flushJobs();
assert(mapSizeCount === 4 && lastSize === 1, "reactive Map.delete triggers size effect");

reactiveMapInstance.clear();
flushJobs();
assert(mapSizeCount === 5 && lastSize === 0, "reactive Map.clear triggers size effect");
assert(lastGetVal === undefined, "reactive Map.clear triggers get effect");

// Readonly Map
const roMap = readonly(new Map([["a", 1]]));
roMap.set("a", 2); // Should warn and not mutate
assert(roMap.get("a") === 1, "readonly Map prevents mutations");

// 17. Reactive Set Support
const reactiveSetInstance = reactive(new Set());
let setHasCount = 0;
let setSizeCount = 0;
let hasItem = false;
let setSize = 0;

effect(() => {
    hasItem = reactiveSetInstance.has("premium");
    setHasCount++;
});

effect(() => {
    setSize = reactiveSetInstance.size;
    setSizeCount++;
});

assert(setHasCount === 1 && hasItem === false, "Initial reactive Set.has tracked");
assert(setSizeCount === 1 && setSize === 0, "Initial reactive Set.size tracked");

reactiveSetInstance.add("premium");
flushJobs();
assert(setHasCount === 2 && hasItem === true, "reactive Set.add triggers has effect");
assert(setSizeCount === 2 && setSize === 1, "reactive Set.add triggers size effect");

reactiveSetInstance.add("premium"); // Duplicate add
flushJobs();
assert(setSizeCount === 2, "reactive Set.add duplicate does not re-trigger");

reactiveSetInstance.delete("premium");
flushJobs();
assert(setHasCount === 3 && hasItem === false, "reactive Set.delete triggers has effect");
assert(setSizeCount === 3 && setSize === 0, "reactive Set.delete triggers size effect");

// 18. Reactive Date Support
const reactiveDate = reactive(new Date("2026-01-01T00:00:00Z"));
let dateEffectCount = 0;
let dateYear = 0;

effect(() => {
    dateYear = reactiveDate.getFullYear();
    dateEffectCount++;
});

assert(dateEffectCount === 1 && dateYear === 2026, "Initial reactive Date getter tracked");

reactiveDate.setFullYear(2027);
flushJobs();
assert(dateEffectCount === 2 && dateYear === 2027, "reactive Date.setFullYear triggers effect");

// 19. pauseTracking, resumeTracking, untrack API
const trackState = reactive({ score: 10 });
let untrackedEffectRuns = 0;

effect(() => {
    untrack(() => trackState.score);
    untrackedEffectRuns++;
});

assert(untrackedEffectRuns === 1, "untrack runs once initially");
trackState.score = 50;
flushJobs();
assert(untrackedEffectRuns === 1, "untrack() prevented reactive subscription on trackState.score");

pauseTracking();
trackState.score = 100;
resumeTracking();
assert(trackState.score === 100, "Mutations during pauseTracking applied correctly");

// 20. Helix.$apps App Registry
const mockAppInstance = { id: 99, root: {} };
const mockApp = { version: "11.1.19", rebind: () => {} };

$apps.register("#widget-root", mockAppInstance.root, mockAppInstance, mockApp);
assert($apps.has("#widget-root") === true, "$apps.has('#widget-root') returns true");
assert($apps.get("#widget-root").id === 99, "$apps.get('#widget-root') returns registered entry");
assert($apps.size >= 1, "$apps.size reports registered apps count");
assert($apps.list().some((e) => e.selector === "#widget-root"), "$apps.list() includes registered entry");

$apps.unregister("#widget-root", mockAppInstance.root, mockAppInstance);
assert($apps.has("#widget-root") === false, "$apps.unregister removes entry");

// 21. HTML Sanitizer Security Augmentation Test
config.htmlSanitizer = (html) => html.replace(/placeholder/g, "safe_content");
const sanitizedOutput = sanitizeHtml("placeholder <script>alert(1)</script><iframe src='evil.com'></iframe>");
assert(!sanitizedOutput.includes("<script>") && !sanitizedOutput.includes("<iframe"), "sanitizeHtml with custom htmlSanitizer still enforces built-in script/iframe stripping");
assert(sanitizedOutput.includes("safe_content"), "sanitizeHtml custom sanitizer transformation applied");
config.htmlSanitizer = null;

// 22. Mock DOM Node Implementation for Directives Testing
class MockNode {
    constructor(nodeType, tagName = "") {
        this.nodeType = nodeType;
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.parentNode = null;
        this._attributes = {};
        this.style = {};
        this.listeners = {};
        this.value = "";
        this.type = "text";
        this.checked = false;
    }
    get attributes() {
        const list = Object.entries(this._attributes).map(([name, value]) => ({ name, value }));
        return list;
    }
    getAttribute(name) { return this._attributes[name] !== undefined ? this._attributes[name] : null; }
    setAttribute(name, val) { this._attributes[name] = String(val); }
    removeAttribute(name) { delete this._attributes[name]; }
    hasAttribute(name) { return this._attributes[name] !== undefined; }
    appendChild(child) {
        if (child.nodeType === 11) {
            const children = [...child.childNodes];
            children.forEach(c => this.appendChild(c));
            return child;
        }
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }
    insertBefore(newChild, refChild) {
        if (newChild.nodeType === 11) {
            const children = [...newChild.childNodes];
            children.forEach(c => this.insertBefore(c, refChild));
            return newChild;
        }
        if (newChild.parentNode) {
            newChild.parentNode.removeChild(newChild);
        }
        newChild.parentNode = this;
        const idx = this.childNodes.indexOf(refChild);
        if (idx === -1) this.childNodes.push(newChild);
        else this.childNodes.splice(idx, 0, newChild);
        return newChild;
    }
    removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx !== -1) this.childNodes.splice(idx, 1);
        child.parentNode = null;
        return child;
    }
    remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
    }
    cloneNode(deep = true) {
        const clone = new MockNode(this.nodeType, this.tagName);
        clone._attributes = { ...this._attributes };
        clone.type = this.type;
        clone.value = this.value;
        clone.checked = this.checked;
        if (this.content) clone.content = this.content.cloneNode(true);
        if (deep) this.childNodes.forEach((c) => clone.appendChild(c.cloneNode(true)));
        return clone;
    }
    querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
    }
    querySelectorAll(sel) {
        const results = [];
        const match = (node) => {
            if (sel === '*' || (node.tagName && node.tagName.toLowerCase() === sel.toLowerCase())) {
                results.push(node);
            } else if (sel.startsWith('[') && sel.endsWith(']')) {
                const attr = sel.slice(1, -1);
                if (node.hasAttribute && node.hasAttribute(attr)) results.push(node);
            }
            node.childNodes.forEach(match);
        };
        this.childNodes.forEach(match);
        return results;
    }
    addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
    }
    removeEventListener(evt, fn) {
        if (this.listeners[evt]) {
            this.listeners[evt] = this.listeners[evt].filter((l) => l !== fn);
        }
    }
    dispatchEvent(evt) {
        const fns = this.listeners[evt.type] || [];
        fns.forEach((fn) => fn(evt));
    }
    get nextSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx >= 0 && idx < this.parentNode.childNodes.length - 1 ? this.parentNode.childNodes[idx + 1] : null;
    }
    get firstElementChild() {
        return this.childNodes.find((c) => c.nodeType === 1) || null;
    }
}
// 23. Directive Tests with Mock DOM
let idleJobRan = false;
const origDoc = global.document;

async function runMockDomTests() {
    try {
        global.document = {
            createComment: (text) => new MockNode(8, text),
            createElement: (tag) => new MockNode(1, tag),
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            removeEventListener: () => {}
        };

        const builtinDirs = createBuiltinDirectives({ prefix: "hx-", allowInlineExpressions: true });

        // 23a. dirs.model with .lazy modifier
        const lazyInput = new MockNode(1, "input");
        const modelState = reactive({ username: "john" });
        builtinDirs.model.updated(lazyInput, {
            value: "username",
            modifiers: ["lazy"],
            ctx: modelState,
            trackCleanup: () => {}
        });
        assert(lazyInput.listeners["change"] && lazyInput.listeners["change"].length > 0, "dirs.model.lazy attaches 'change' event listener");
        assert(!lazyInput.listeners["input"] || lazyInput.listeners["input"].length === 0, "dirs.model.lazy does not attach 'input' listener");

        // 23b. dirs.model with .trim and .number
        const numInput = new MockNode(1, "input");
        const numState = reactive({ qty: 0 });
        builtinDirs.model.updated(numInput, {
            value: "qty",
            modifiers: ["number"],
            ctx: numState,
            trackCleanup: () => {}
        });
        numInput.value = "42";
        numInput.dispatchEvent({ type: "input", target: { value: "42" } });
        assert(numState.qty === 42, "dirs.model.number coerces input value to numeric 42");

        // 23c. dirs.if / dirs.else-if / dirs.else chain
        const ifBranch1 = new MockNode(1, "div");
        ifBranch1.setAttribute("id", "branch1");
        const ifBranch2 = new MockNode(1, "div");
        ifBranch2.setAttribute("id", "branch2");
        const ifBranch3 = new MockNode(1, "div");
        ifBranch3.setAttribute("id", "branch3");

        const ifParent = new MockNode(1, "div");
        ifParent.appendChild(ifBranch1);

        const branches = [
            { el: ifBranch1, exp: "status === 'loading'", type: "if" },
            { el: ifBranch2, exp: "status === 'error'", type: "else-if" },
            { el: ifBranch3, exp: "", type: "else" }
        ];

        const ifState = reactive({ status: "loading" });
        builtinDirs.if.mounted(ifBranch1, {
            value: "status === 'loading'",
            branches,
            ctx: ifState,
            instance: null,
            trackCleanup: () => {},
            bindNode: () => {}
        });

        assert(ifParent.childNodes.some((n) => n.getAttribute && n.getAttribute("id") === "branch1"), "hx-if renders branch1 when status === 'loading'");

        ifState.status = "error";
        flushJobs();
        assert(ifParent.childNodes.some((n) => n.getAttribute && n.getAttribute("id") === "branch2"), "hx-else-if switches to branch2 when status === 'error'");

        ifState.status = "success";
        flushJobs();
        assert(ifParent.childNodes.some((n) => n.getAttribute && n.getAttribute("id") === "branch3"), "hx-else switches to branch3 on fallback");

        // 23d. dirs.for range syntax ('n in 5')
        const forRangeParent = new MockNode(1, "ul");
        const forRangeTpl = new MockNode(1, "template");
        forRangeTpl.content = new MockNode(11);
        const forRangeLi = new MockNode(1, "li");
        forRangeTpl.content.appendChild(forRangeLi);
        forRangeParent.appendChild(forRangeTpl);

        builtinDirs.for.mounted(forRangeTpl, {
            value: "n in 5",
            ctx: {},
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                node.setAttribute("data-val", childCtx.n);
            }
        });

        const rangeChildren = forRangeParent.childNodes.filter((n) => n.nodeType === 1);
        assert(rangeChildren.length === 5, "dirs.for ('n in 5') renders 5 range elements");

        // 23e. dirs.for 3-argument object syntax: (val, key, index) in obj
        const forObjParent = new MockNode(1, "ul");
        const forObjTpl = new MockNode(1, "template");
        forObjTpl.content = new MockNode(11);
        const forObjLi = new MockNode(1, "li");
        forObjTpl.content.appendChild(forObjLi);
        forObjParent.appendChild(forObjTpl);

        const objState = reactive({ user: { name: "Alice", role: "Admin" } });
        builtinDirs.for.mounted(forObjTpl, {
            value: "(val, key, idx) in user",
            ctx: objState,
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                node.setAttribute("data-val", childCtx.val);
                node.setAttribute("data-key", childCtx.key);
                node.setAttribute("data-idx", childCtx.idx);
            }
        });

        const objChildren = forObjParent.childNodes.filter((n) => n.nodeType === 1);
        assert(objChildren.length === 2, "dirs.for ('(val, key, idx) in user') renders 2 object entry elements");
        assert(objChildren[0].getAttribute("data-val") === "Alice" && objChildren[0].getAttribute("data-key") === "name" && objChildren[0].getAttribute("data-idx") === "0", "Object 3-arg: val -> 'Alice', key -> 'name', idx -> 0");
        assert(objChildren[1].getAttribute("data-val") === "Admin" && objChildren[1].getAttribute("data-key") === "role" && objChildren[1].getAttribute("data-idx") === "1", "Object 3-arg: val -> 'Admin', key -> 'role', idx -> 1");

        // 23f. dirs.for 3-argument Map syntax: (val, key, index) in map
        const forMapParent = new MockNode(1, "ul");
        const forMapTpl = new MockNode(1, "template");
        forMapTpl.content = new MockNode(11);
        const forMapLi = new MockNode(1, "li");
        forMapTpl.content.appendChild(forMapLi);
        forMapParent.appendChild(forMapTpl);

        const mapSource = reactive(new Map([["k1", { title: "T1" }], ["k2", { title: "T2" }]]));
        builtinDirs.for.mounted(forMapTpl, {
            value: "(val, key, idx) in mapData",
            ctx: reactive({ mapData: mapSource }),
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                node.setAttribute("data-title", childCtx.val.title);
                node.setAttribute("data-key", childCtx.key);
                node.setAttribute("data-idx", childCtx.idx);
            }
        });

        const mapChildren = forMapParent.childNodes.filter((n) => n.nodeType === 1);
        assert(mapChildren.length === 2, "dirs.for ('(val, key, idx) in mapData') renders 2 Map items");
        assert(mapChildren[0].getAttribute("data-title") === "T1" && mapChildren[0].getAttribute("data-key") === "k1" && mapChildren[0].getAttribute("data-idx") === "0", "Map 3-arg: val -> {title: 'T1'}, key -> 'k1', idx -> 0");
        assert(mapChildren[1].getAttribute("data-title") === "T2" && mapChildren[1].getAttribute("data-key") === "k2" && mapChildren[1].getAttribute("data-idx") === "1", "Map 3-arg: val -> {title: 'T2'}, key -> 'k2', idx -> 1");

        // 23g. dirs.on keydown.enter modifier
        const btnNode = new MockNode(1, "button");
        let enterHandled = false;
        builtinDirs.on.mounted(btnNode, {
            value: "handleEnter",
            arg: "keydown",
            modifiers: ["enter"],
            ctx: { handleEnter: () => { enterHandled = true; } },
            trackCleanup: () => {}
        });

        btnNode.dispatchEvent({ type: "keydown", key: "Escape" });
        assert(enterHandled === false, "@keydown.enter ignores non-Enter key");

        btnNode.dispatchEvent({ type: "keydown", key: "Enter" });
        assert(enterHandled === true, "@keydown.enter triggers handler on Enter key");

        // 23h. Multi-root <template hx-for> with LIS Move Verification
        const parent = new MockNode(1, "div");
        const tpl = new MockNode(1, "template");
        tpl.content = new MockNode(11);
        const root1 = new MockNode(1, "div"); root1.setAttribute("class", "r1");
        const root2 = new MockNode(1, "span"); root2.setAttribute("class", "r2");
        tpl.content.appendChild(root1);
        tpl.content.appendChild(root2);
        parent.appendChild(tpl);

        const item1 = { id: 1, name: "First" };
        const item2 = { id: 2, name: "Second" };
        const itemsState = reactive({ items: [item1, item2] });

        builtinDirs.for.mounted(tpl, {
            value: "item in items",
            ctx: itemsState,
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                node.setAttribute("data-id", childCtx.item.id);
                node.setAttribute("data-name", childCtx.item.name);
            }
        });

        const elemNodes = parent.childNodes.filter((n) => n.nodeType === 1);
        assert(elemNodes.length === 4, "<template hx-for> multi-root rendered all sibling elements for list items (4 total elements for 2 items)");
        assert(elemNodes[0].getAttribute("data-id") === "1" && elemNodes[1].getAttribute("data-id") === "1", "First pair belongs to item 1");
        assert(elemNodes[2].getAttribute("data-id") === "2" && elemNodes[3].getAttribute("data-id") === "2", "Second pair belongs to item 2");

        // Re-order items using STABLE object references
        itemsState.items = [item2, item1];
        flushJobs();
        const elemNodesReordered = parent.childNodes.filter((n) => n.nodeType === 1);
        assert(elemNodesReordered.length === 4, "Reordered list retains all 4 multi-root element nodes");
        assert(elemNodesReordered[0].getAttribute("data-id") === "2" && elemNodesReordered[1].getAttribute("data-id") === "2", "Post-reorder: First pair moved to item 2 (LIS move verified)");
        assert(elemNodesReordered[2].getAttribute("data-id") === "1" && elemNodesReordered[3].getAttribute("data-id") === "1", "Post-reorder: Second pair moved to item 1 (LIS move verified)");

        // 24. customRef standard API
        let customTrackCalls = 0;
        let customTriggerCalls = 0;
        let rawCustomVal = "initial";
        const myCustomRef = customRef((track, trigger) => ({
            get() {
                customTrackCalls++;
                track();
                return rawCustomVal;
            },
            set(newVal) {
                customTriggerCalls++;
                rawCustomVal = newVal;
                trigger();
            }
        }));

        let customEffectVal = null;
        effect(() => {
            customEffectVal = myCustomRef.value;
        });

        assert(customEffectVal === "initial", "customRef getter returns initial value");
        assert(customTrackCalls >= 1, "customRef track() executed inside effect");

        myCustomRef.value = "updated";
        flushJobs();
        assert(customEffectVal === "updated", "customRef setter triggers effect re-evaluation");
        assert(customTriggerCalls === 1, "customRef trigger() executed");

        // 25. watch(reactiveObject) defaults to deep: true
        const reactiveObj = reactive({ nested: { count: 1 } });
        let deepWatchFired = false;
        let observedVal = null;
        watch(reactiveObj, (newVal) => {
            deepWatchFired = true;
            observedVal = newVal.nested.count;
        }, { flush: "sync" });

        reactiveObj.nested.count = 2;
        assert(deepWatchFired === true && observedVal === 2, "watch(reactiveObject) deep-tracks property mutations automatically");

        // 26. queueIdleJob fallback execution
        queueIdleJob(() => { idleJobRan = true; });

        // 27. definePlugin setup() execution
        let setupPluginRan = false;
        const setupPlugin = definePlugin({
            name: "setup-test-plugin",
            setup(api) {
                setupPluginRan = true;
            }
        });
        use(setupPlugin);
        assert(setupPluginRan === true, "Plugin setup() method executed during use()");
        unuse(setupPlugin);

        // 28. Suspense template contains hx-else-if for error state
        assert(Suspense.setup({}).template.includes("hx-else-if=\"state.error\""), "Suspense template renders hx-else-if for error state");

        // 29. isReactive & isReadonly inspection
        const baseReactive = reactive({ x: 1 });
        const baseReadonly = readonly({ x: 1 });
        const baseRaw = { x: 1 };
        assert(isReactive(baseReactive) === true, "isReactive(reactive({})) returns true");
        assert(isReactive(baseRaw) === false, "isReactive(rawObject) returns false");
        assert(isReadonly(baseReadonly) === true, "isReadonly(readonly({})) returns true");
        assert(isReadonly(baseRaw) === false, "isReadonly(rawObject) returns false");

        // 30. ref(object) deep vs shallowRef(object) shallow
        const deepUserRef = ref({ profile: { name: "Alice" } });
        let deepRefEffectCount = 0;
        effect(() => {
            deepUserRef.value.profile.name;
            deepRefEffectCount++;
        });
        assert(deepRefEffectCount === 1, "Initial deep ref effect ran");
        deepUserRef.value.profile.name = "Bob";
        flushJobs();
        assert(deepRefEffectCount === 2, "Mutating nested property on ref(object) triggers dependent effect");

        const shallowUserRef = shallowRef({ profile: { name: "Alice" } });
        let shallowRefEffectCount = 0;
        effect(() => {
            shallowUserRef.value.profile.name;
            shallowRefEffectCount++;
        });
        assert(shallowRefEffectCount === 1, "Initial shallow ref effect ran");
        shallowUserRef.value.profile.name = "Bob";
        flushJobs();
        assert(shallowRefEffectCount === 1, "Mutating nested property on shallowRef(object) does NOT trigger effect");

        // 31. onUpdated() Lifecycle Execution
        let updatedHookCount = 0;
        const countState = ref(0);
        const testUpdatedApp = createApp({
            setup() {
                onUpdated(() => {
                    updatedHookCount++;
                });
                return { count: countState };
            }
        });
        const updateContainer = new MockNode(1, "div");
        const countSpan = new MockNode(1, "span");
        countSpan.setAttribute("h-text", "count");
        updateContainer.appendChild(countSpan);
        await testUpdatedApp.mount(updateContainer);
        assert(updatedHookCount === 0, "onUpdated does not run during initial mount");

        // Mutate state & flush
        countState.value = 1;
        flushJobs();
        assert(updatedHookCount === 1, "onUpdated fired exactly once after reactive DOM mutation");

        // 32. Rebind Lifecycle Teardown
        const rebindRoot = new MockNode(1, "div");
        let rebindCleanupRan = false;
        rebindRoot.__hx_cleanup = [() => { rebindCleanupRan = true; }];
        const rebindTextNode = new MockNode(1, "span");
        rebindTextNode.setAttribute("h-text", "val");
        rebindRoot.appendChild(rebindTextNode);

        const oldRebindState = reactive({ val: "initial" });
        const rebindApp = createApp({
            setup() {
                return oldRebindState;
            }
        });
        await rebindApp.mount(rebindRoot);

        // Old effect tracks oldRebindState.val
        oldRebindState.val = "second";
        flushJobs();
        assert(rebindTextNode.textContent === "second", "Pre-rebind: text content updated");

        // Rebind element: clears old cleanups and re-attaches bindings
        rebindApp.rebind(rebindRoot);
        assert(rebindCleanupRan === true, "rebind() cleanly executes pre-existing cleanup hooks");

        // 33. Async Component Loading Progression
        let asyncLoaderResolve;
        const slowCompPromise = new Promise((resolve) => { asyncLoaderResolve = resolve; });
        const asyncCompWithLoading = defineAsyncComponent({
            loader: () => slowCompPromise,
            loadingComponent: { template: "<div>Loading UI...</div>" },
            errorComponent: { template: "<div>Error UI!</div>" },
            delay: 0
        });

        const asyncCompState = asyncCompWithLoading.setup({});
        assert(asyncCompState.status === "loading", "Async component initial status is 'loading' (delay=0)");
        assert(asyncCompState.template.includes("Loading UI..."), "Async component initial template renders loadingComponent");

        asyncLoaderResolve({ template: "<div>Loaded Content!</div>" });
        await slowCompPromise;
        await new Promise(r => setTimeout(r, 20));
        assert(asyncCompState.status === "resolved", "Async component status transitions to 'resolved'");
        assert(asyncCompState.template.includes("Loaded Content!"), "Async component template transitions to resolved template");

        // 34. hx-for Complete Keyed Mutation Lifecycle (Append, Remove, Reorder)
        const mutationForParent = new MockNode(1, "div");
        const mutationForTpl = new MockNode(1, "template");
        mutationForTpl.content = new MockNode(11);
        const forItemEl = new MockNode(1, "span");
        mutationForTpl.content.appendChild(forItemEl);
        mutationForParent.appendChild(mutationForTpl);

        const a1 = { id: 1, text: "A" };
        const a2 = { id: 2, text: "B" };
        const a3 = { id: 3, text: "C" };
        const listState = reactive({ list: [a1, a2] });

        builtinDirs.for.mounted(mutationForTpl, {
            value: "item in list",
            ctx: listState,
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                node.setAttribute("data-id", childCtx.item.id);
                node.setAttribute("data-text", childCtx.item.text);
            }
        });

        let renderedChildren = mutationForParent.childNodes.filter(n => n.nodeType === 1);
        assert(renderedChildren.length === 2, "Initial for-render has 2 items");

        // Append a3
        listState.list.push(a3);
        flushJobs();
        renderedChildren = mutationForParent.childNodes.filter(n => n.nodeType === 1);
        assert(renderedChildren.length === 3, "After append: for-render has 3 items");
        assert(renderedChildren[2].getAttribute("data-id") === "3", "Appended item rendered with id 3");

        // Remove a2
        listState.list = [a1, a3];
        flushJobs();
        renderedChildren = mutationForParent.childNodes.filter(n => n.nodeType === 1);
        assert(renderedChildren.length === 2, "After removal: for-render has 2 items");
        assert(renderedChildren[0].getAttribute("data-id") === "1" && renderedChildren[1].getAttribute("data-id") === "3", "Remaining items are A (1) and C (3)");

        // Reorder [a3, a1]
        listState.list = [a3, a1];
        flushJobs();
        renderedChildren = mutationForParent.childNodes.filter(n => n.nodeType === 1);
        assert(renderedChildren.length === 2, "After reorder: for-render has 2 items");
        assert(renderedChildren[0].getAttribute("data-id") === "3" && renderedChildren[1].getAttribute("data-id") === "1", "Reordered: First item is C (3) and second is A (1)");

        // 35. MockNode inter-parent detach parity
        const parentA = new MockNode(1, "div");
        const parentB = new MockNode(1, "div");
        const movableChild = new MockNode(1, "span");
        parentA.appendChild(movableChild);
        assert(parentA.childNodes.length === 1 && movableChild.parentNode === parentA, "movableChild attached to parentA");

        // Move to parentB via appendChild
        parentB.appendChild(movableChild);
        assert(parentA.childNodes.length === 0, "parentA childNodes empty after movableChild moved to parentB");
        assert(parentB.childNodes.length === 1 && movableChild.parentNode === parentB, "movableChild attached to parentB");

        // Move back to parentA via insertBefore
        const siblingNode = new MockNode(1, "p");
        parentA.appendChild(siblingNode);
        parentA.insertBefore(movableChild, siblingNode);
        assert(parentB.childNodes.length === 0, "parentB childNodes empty after movableChild moved via insertBefore");
        assert(parentA.childNodes.length === 2 && parentA.childNodes[0] === movableChild && parentA.childNodes[1] === siblingNode, "parentA has movableChild inserted before siblingNode");

        // 36. Component with bound prop (:title) mounts cleanly without TDZ / hasMounted errors
        const compApp = createApp({
            setup() {
                const headerTitle = ref("Welcome Helix");
                return { headerTitle };
            }
        });
        compApp.component("my-header", {
            props: { title: String },
            setup(ctx) {
                return {
                    template: `<h1 h-text="title"></h1>`
                };
            }
        });
        const compRoot = new MockNode(1, "div");
        const headerEl = new MockNode(1, "my-header");
        headerEl.setAttribute(":title", "headerTitle");
        compRoot.appendChild(headerEl);

        let compMountError = null;
        try {
            await compApp.mount(compRoot);
        } catch (e) {
            compMountError = e;
        }
        // 37. Nested Event Handler Path & this binding (@submit.prevent="store.employeeForm.submit")
        let submitPrevented = false;
        let submitCallContext = null;
        const testStore = {
            employeeForm: {
                name: "EmployeeFormInstance",
                submit(e) {
                    submitCallContext = this;
                    if (e && e.defaultPrevented) submitPrevented = true;
                }
            }
        };

        const formApp = createApp({
            setup() {
                return { store: testStore };
            }
        });

        const formEl = new MockNode(1, "form");
        formEl.setAttribute("@submit.prevent", "store.employeeForm.submit");
        const formAppRoot = new MockNode(1, "div");
        formAppRoot.appendChild(formEl);

        await formApp.mount(formAppRoot);

        let defaultPrevented = false;
        const mockSubmitEvent = {
            type: "submit",
            target: formEl,
            preventDefault() { defaultPrevented = true; this.defaultPrevented = true; },
            stopPropagation() {}
        };
        formEl.dispatchEvent(mockSubmitEvent);

        assert(defaultPrevented === true, "@submit.prevent prevented default event");
        assert(submitCallContext === testStore.employeeForm, "Nested handler store.employeeForm.submit executed with correct parent this context");

    } finally {
        global.document = origDoc;
    }
}

await runMockDomTests();

setTimeout(() => {
    assert(batchTriggerCount === 1, "Batch trigger deduplication: 100 loop mutations inside batch triggered effect exactly 1 time");
    assert(scopeRefreshCount === 1, "Batched Scope Refreshes: calling scope.refresh() 5 times in 1 tick executed refresh callback exactly once");
    assert(idleJobRan === true, "queueIdleJob executed fallback callback in headless/Node environment");
    console.log("=========================================");
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log("=========================================");
}, 100);
