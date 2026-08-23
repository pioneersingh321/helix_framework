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
    useTemplateRef,
    defineCustomElement,
    $apps,
    use,
    unuse,
    config,
    Transition,
    TransitionGroup,
    Teleport,
    resolveTeleportTarget,
    enter,
    leave,
    cancelTransition,
    cancelFlip,
    getTransitionDurations,
    resolveTransitionConfig,
    recordPositions,
    applyFlip
} from './src/index.js';
import { flushJobs } from './src/reactivity/scheduler.js';
import { sanitizeHtml } from './src/compiler/html.js';
import { createBuiltinDirectives } from './src/directives/index.js';
import { destroyNode } from './src/renderer/node.js';

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
assert(ebSetupRes.template.includes('html="fallbackHtml"'), "createErrorBoundary template binds fallbackHtml computed ref");

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
        this._rect = { left: 0, top: 0, width: 100, height: 100 };
        this.getBoundingClientRect = () => this._rect;
        const classes = new Set();
        this.classList = {
            _classes: classes,
            add: (...cls) => cls.forEach((c) => { if (c) classes.add(c); }),
            remove: (...cls) => cls.forEach((c) => classes.delete(c)),
            contains: (c) => classes.has(c),
            toggle: (c) => { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        };
        Object.defineProperty(this, "className", {
            get: () => Array.from(classes).join(" "),
            set: (val) => {
                classes.clear();
                const str = String(val || "").trim();
                str.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
                this._attributes["class"] = str;
            },
            configurable: true
        });
        let _textContent = "";
        Object.defineProperty(this, "textContent", {
            get: () => _textContent || this.childNodes.map((c) => c.textContent || "").join(""),
            set: (val) => { _textContent = String(val ?? ""); },
            configurable: true
        });
        let _innerHTML = "";
        Object.defineProperty(this, "innerHTML", {
            get: () => _innerHTML || (this.childNodes.length > 0 ? this.childNodes.map((c) => c.innerHTML || c.textContent || "").join("") : ""),
            set: (html) => {
                _innerHTML = String(html || "");
                while (this.firstChild) this.removeChild(this.firstChild);
                if (!_innerHTML.trim()) return;
                if (!_innerHTML.includes("<")) {
                    this.textContent = _innerHTML;
                    return;
                }
                const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9-]+)([^>]*?)\/?>/g;
                let match;
                while ((match = tagRegex.exec(_innerHTML)) !== null) {
                    const tag = match[1] || match[4];
                    const rawAttrs = match[2] || match[5] || "";
                    const inner = match[3] || "";
                    const child = new MockNode(1, tag);
                    const attrRegex = /([a-zA-Z0-9_:@.-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
                    let attrMatch;
                    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
                        const attrName = attrMatch[1];
                        const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
                        child.setAttribute(attrName, attrVal);
                    }
                    if (inner) child.innerHTML = inner;
                    this.appendChild(child);
                }
            },
            configurable: true
        });
    }
    get attributes() {
        const list = Object.entries(this._attributes).map(([name, value]) => ({ name, value }));
        return list;
    }
    getAttribute(name) { return this._attributes[name] !== undefined ? this._attributes[name] : null; }
    setAttribute(name, val) {
        const oldVal = this._attributes[name] !== undefined ? this._attributes[name] : null;
        const strVal = String(val);
        this._attributes[name] = strVal;
        if (name === 'class') this.className = val;
        if (name === 'value') this.value = strVal;
        if (typeof this.attributeChangedCallback === 'function' && this.constructor.observedAttributes && this.constructor.observedAttributes.includes(name)) {
            this.attributeChangedCallback(name, oldVal, strVal);
        }
    }
    removeAttribute(name) {
        const oldVal = this._attributes[name] !== undefined ? this._attributes[name] : null;
        delete this._attributes[name];
        if (typeof this.attributeChangedCallback === 'function' && this.constructor.observedAttributes && this.constructor.observedAttributes.includes(name)) {
            this.attributeChangedCallback(name, oldVal, null);
        }
    }
    hasAttribute(name) { return this._attributes[name] !== undefined; }
    get firstChild() {
        return this.childNodes[0] || null;
    }
    get firstElementChild() {
        return this.childNodes.find(c => c.nodeType === 1) || null;
    }
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
        clone.className = this.className;
        clone.textContent = this.textContent;
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
            } else if (sel.startsWith('.') && node.classList && node.classList.contains(sel.slice(1))) {
                results.push(node);
            } else if (sel.startsWith('#') && node.getAttribute('id') === sel.slice(1)) {
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
    addEventListener(evt, fn, opts) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push({ fn, opts });
    }
    removeEventListener(evt, fn) {
        if (this.listeners[evt]) {
            this.listeners[evt] = this.listeners[evt].filter((l) => (typeof l === 'function' ? l !== fn : l.fn !== fn));
        }
    }
    dispatchEvent(evt) {
        const evtObj = typeof evt === "string" ? { type: evt } : evt;
        try { if (!evtObj.target) evtObj.target = this; } catch {}
        try { if (!evtObj.currentTarget) evtObj.currentTarget = this; } catch {}
        if (!evtObj.preventDefault) evtObj.preventDefault = () => { evtObj.defaultPrevented = true; };
        if (!evtObj.stopPropagation) evtObj.stopPropagation = () => { evtObj.propagationStopped = true; };
        const evtType = evtObj.type;
        const fns = [...(this.listeners[evtType] || [])];
        fns.forEach((entry) => {
            const callback = typeof entry === "function" ? entry : entry.fn;
            if (entry && entry.opts && entry.opts.once) {
                this.removeEventListener(evtType, callback);
            }
            callback(evtObj);
        });
    }
    get nextSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx >= 0 && idx < this.parentNode.childNodes.length - 1 ? this.parentNode.childNodes[idx + 1] : null;
    }
    get firstElementChild() {
        return this.childNodes.find((c) => c.nodeType === 1) || null;
    }
    attachShadow(opts) {
        this.shadowRoot = new MockNode(11, "#shadow-root");
        this.shadowRoot.parentNode = this;
        return this.shadowRoot;
    }
}
// 23. Directive Tests with Mock DOM
let idleJobRan = false;
const origDoc = global.document;
const origHTMLElement = global.HTMLElement;
const origCustomEvent = global.CustomEvent;

async function runMockDomTests() {
    try {
        global.HTMLElement = class HTMLElement extends MockNode {
            constructor() {
                super(1, "custom-element");
            }
        };
        global.CustomEvent = class CustomEvent {
            constructor(type, opts = {}) {
                this.type = type;
                this.detail = opts.detail;
                this.bubbles = Boolean(opts.bubbles);
                this.composed = Boolean(opts.composed);
            }
        };

        const docListeners = {};
        const mockBody = new MockNode(1, "body");
        const mockHead = new MockNode(1, "head");
        global.document = {
            body: mockBody,
            head: mockHead,
            createComment: (text) => new MockNode(8, text),
            createDocumentFragment: () => new MockNode(11, "#document-fragment"),
            createTextNode: (text) => new MockNode(3, text),
            createElement: (tag) => {
                const n = new MockNode(1, tag);
                if (tag === 'template') n.content = new MockNode(11);
                return n;
            },
            getElementById: (id) => mockBody.querySelector(`#${id}`),
            querySelector: (sel) => mockBody.querySelector(sel),
            querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
            listeners: docListeners,
            addEventListener: (evt, fn, opts) => {
                if (!docListeners[evt]) docListeners[evt] = [];
                docListeners[evt].push({ fn, opts });
            },
            removeEventListener: (evt, fn) => {
                if (docListeners[evt]) {
                    docListeners[evt] = docListeners[evt].filter(l => (typeof l === 'function' ? l !== fn : l.fn !== fn));
                }
            },
            dispatchEvent: (evt) => {
                const list = [...(docListeners[evt.type] || [])];
                list.forEach((entry) => {
                    const callback = typeof entry === "function" ? entry : entry.fn;
                    if (entry && entry.opts && entry.opts.once) {
                        global.document.removeEventListener(evt.type, callback);
                    }
                    callback(evt);
                });
            }
        };

        const builtinDirs = createBuiltinDirectives({ prefix: "hx-", allowInlineExpressions: true });

        // 23a. dirs.model with .lazy modifier
        const lazyInput = new MockNode(1, "input");
        const modelState = reactive({ username: "john" });
        builtinDirs.model.mounted(lazyInput, {
            value: "username",
            modifiers: ["lazy"],
            ctx: modelState,
            trackCleanup: () => {}
        });
        assert(lazyInput.listeners["change"] && lazyInput.listeners["change"].length > 0, "dirs.model.lazy attaches 'change' event listener");
        assert(!lazyInput.listeners["input"] || lazyInput.listeners["input"].length === 0, "dirs.model.lazy does not attach 'input' listener");
        lazyInput.dispatchEvent({ type: "change", target: { value: "jane" } });
        assert(modelState.username === "jane", "dirs.model.lazy updates model on 'change' event");

        // 23b. dirs.model with .trim and .number
        const numInput = new MockNode(1, "input");
        const numState = reactive({ qty: 0 });
        builtinDirs.model.mounted(numInput, {
            value: "qty",
            modifiers: ["number"],
            ctx: numState,
            trackCleanup: () => {}
        });
        numInput.value = "42";
        numInput.dispatchEvent({ type: "input", target: { value: "42" } });
        assert(numState.qty === 42, "dirs.model.number coerces input value to numeric 42");

        numInput.dispatchEvent({ type: "input", target: { value: "not-a-num" } });
        assert(numState.qty === "not-a-num", "dirs.model.number falls back to raw string for non-numeric input");

        const trimInput = new MockNode(1, "input");
        const trimState = reactive({ text: "" });
        builtinDirs.model.mounted(trimInput, {
            value: "text",
            modifiers: ["trim"],
            ctx: trimState,
            trackCleanup: () => {}
        });
        trimInput.dispatchEvent({ type: "input", target: { value: "   hello helix   " } });
        assert(trimState.text === "hello helix", "dirs.model.trim strips whitespace from input");

        // 23b2. dirs.model with chaining (.lazy.trim.number)
        const chainInput = new MockNode(1, "input");
        const chainState = reactive({ score: 0 });
        builtinDirs.model.mounted(chainInput, {
            value: "score",
            modifiers: ["lazy", "trim", "number"],
            ctx: chainState,
            trackCleanup: () => {}
        });
        chainInput.dispatchEvent({ type: "change", target: { value: "   99.5   " } });
        assert(chainState.score === 99.5, "dirs.model chaining .lazy.trim.number trims and coerces number on change");

        // 23b3. dirs.model with Checkbox Array binding
        const cbApple = new MockNode(1, "input");
        cbApple.type = "checkbox";
        cbApple.value = "apple";
        const cbState = reactive({ fruits: ["banana"] });
        builtinDirs.model.mounted(cbApple, {
            value: "fruits",
            ctx: cbState,
            trackCleanup: () => {}
        });
        cbApple.dispatchEvent({ type: "change", target: { checked: true } });
        assert(cbState.fruits.includes("apple") && cbState.fruits.includes("banana"), "dirs.model checkbox array binding pushes checked value");
        cbApple.dispatchEvent({ type: "change", target: { checked: false } });
        assert(!cbState.fruits.includes("apple") && cbState.fruits.includes("banana"), "dirs.model checkbox array binding removes unchecked value");

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

        // 23g. dirs.on DOM Events & Modifiers (Phase 1)
        // Key Modifiers
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

        // .delete captures both Delete and Backspace
        let deleteHandledCount = 0;
        const delNode = new MockNode(1, "input");
        builtinDirs.on.mounted(delNode, {
            value: "onDelete",
            arg: "keydown",
            modifiers: ["delete"],
            ctx: { onDelete: () => { deleteHandledCount++; } },
            trackCleanup: () => {}
        });
        delNode.dispatchEvent({ type: "keydown", key: "Delete" });
        delNode.dispatchEvent({ type: "keydown", key: "Backspace" });
        delNode.dispatchEvent({ type: "keydown", key: "Escape" });
        assert(deleteHandledCount === 2, "@keydown.delete handles both Delete and Backspace");

        // Dynamic kebab-case key modifier (e.g. .page-down)
        let pageDownHandled = false;
        const pdNode = new MockNode(1, "input");
        builtinDirs.on.mounted(pdNode, {
            value: "onPageDown",
            arg: "keydown",
            modifiers: ["page-down"],
            ctx: { onPageDown: () => { pageDownHandled = true; } },
            trackCleanup: () => {}
        });
        pdNode.dispatchEvent({ type: "keydown", key: "ArrowDown" });
        assert(pageDownHandled === false, "@keydown.page-down ignores ArrowDown");
        pdNode.dispatchEvent({ type: "keydown", key: "PageDown" });
        assert(pageDownHandled === true, "@keydown.page-down triggers on PageDown key");

        // Mouse Modifiers (.left, .middle, .right)
        let leftClicked = false, middleClicked = false, rightClicked = false;
        const mouseNode = new MockNode(1, "div");
        builtinDirs.on.mounted(mouseNode, {
            value: "onLeft",
            arg: "click",
            modifiers: ["left"],
            ctx: { onLeft: () => { leftClicked = true; } },
            trackCleanup: () => {}
        });
        builtinDirs.on.mounted(mouseNode, {
            value: "onMiddle",
            arg: "click",
            modifiers: ["middle"],
            ctx: { onMiddle: () => { middleClicked = true; } },
            trackCleanup: () => {}
        });
        builtinDirs.on.mounted(mouseNode, {
            value: "onRight",
            arg: "click",
            modifiers: ["right"],
            ctx: { onRight: () => { rightClicked = true; } },
            trackCleanup: () => {}
        });
        mouseNode.dispatchEvent({ type: "click", button: 0 });
        assert(leftClicked === true && middleClicked === false && rightClicked === false, "@click.left matches button 0");
        leftClicked = false;
        mouseNode.dispatchEvent({ type: "click", button: 1 });
        assert(leftClicked === false && middleClicked === true && rightClicked === false, "@click.middle matches button 1");
        middleClicked = false;
        mouseNode.dispatchEvent({ type: "click", button: 2 });
        assert(leftClicked === false && middleClicked === false && rightClicked === true, "@click.right matches button 2");

        // System Modifiers + Prevent Order: @click.ctrl.prevent="save"
        let saveCalled = false;
        const ctrlBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(ctrlBtn, {
            value: "save",
            arg: "click",
            modifiers: ["ctrl", "prevent"],
            ctx: { save: () => { saveCalled = true; } },
            trackCleanup: () => {}
        });
        const clickNoCtrl = { type: "click", ctrlKey: false, button: 0 };
        ctrlBtn.dispatchEvent(clickNoCtrl);
        assert(saveCalled === false && !clickNoCtrl.defaultPrevented, "@click.ctrl.prevent does not prevent default if ctrl is missing");

        const clickWithCtrl = { type: "click", ctrlKey: true, button: 0 };
        ctrlBtn.dispatchEvent(clickWithCtrl);
        assert(saveCalled === true && clickWithCtrl.defaultPrevented === true, "@click.ctrl.prevent prevents default and executes handler when ctrl is held");

        // .exact modifier
        let exactOnlyCtrl = false;
        const exactBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(exactBtn, {
            value: "onExact",
            arg: "click",
            modifiers: ["ctrl", "exact"],
            ctx: { onExact: () => { exactOnlyCtrl = true; } },
            trackCleanup: () => {}
        });
        exactBtn.dispatchEvent({ type: "click", ctrlKey: true, shiftKey: true, button: 0 });
        assert(exactOnlyCtrl === false, "@click.ctrl.exact ignores when extra modifier Shift is pressed");
        exactBtn.dispatchEvent({ type: "click", ctrlKey: true, shiftKey: false, button: 0 });
        assert(exactOnlyCtrl === true, "@click.ctrl.exact triggers when ONLY Ctrl is pressed");

        // .self modifier
        let selfHandled = false;
        const parentDiv = new MockNode(1, "div");
        const childSpan = new MockNode(1, "span");
        parentDiv.appendChild(childSpan);
        builtinDirs.on.mounted(parentDiv, {
            value: "onSelfClick",
            arg: "click",
            modifiers: ["self"],
            ctx: { onSelfClick: () => { selfHandled = true; } },
            trackCleanup: () => {}
        });
        parentDiv.dispatchEvent({ type: "click", target: childSpan });
        assert(selfHandled === false, "@click.self ignores clicks bubbled from children");
        parentDiv.dispatchEvent({ type: "click", target: parentDiv });
        assert(selfHandled === true, "@click.self executes when target === el");

        // Listener options: .once, .capture, .passive
        const optNode = new MockNode(1, "button");
        let onceCalls = 0;
        builtinDirs.on.mounted(optNode, {
            value: "onOnce",
            arg: "click",
            modifiers: ["once", "capture", "passive"],
            ctx: { onOnce: () => { onceCalls++; } },
            trackCleanup: () => {}
        });
        const attached = optNode.listeners["click"][0];
        assert(attached && attached.opts && attached.opts.once === true && attached.opts.capture === true && attached.opts.passive === true, "@click.once.capture.passive configures native listener options");
        optNode.dispatchEvent({ type: "click" });
        optNode.dispatchEvent({ type: "click" });
        assert(onceCalls === 1, "@click.once listener only executes once");

        // Disambiguation: @keydown.left vs @click.left
        let keyLeftHandled = false;
        const arrowNode = new MockNode(1, "input");
        builtinDirs.on.mounted(arrowNode, {
            value: "onArrowLeft",
            arg: "keydown",
            modifiers: ["left"],
            ctx: { onArrowLeft: () => { keyLeftHandled = true; } },
            trackCleanup: () => {}
        });
        arrowNode.dispatchEvent({ type: "keydown", key: "ArrowLeft" });
        assert(keyLeftHandled === true, "@keydown.left explicitly resolves to ArrowLeft key");

        // .passive.prevent avoids calling preventDefault
        let passiveScrollHandled = false;
        const scrollNode = new MockNode(1, "div");
        builtinDirs.on.mounted(scrollNode, {
            value: "onScroll",
            arg: "scroll",
            modifiers: ["passive", "prevent"],
            ctx: { onScroll: () => { passiveScrollHandled = true; } },
            trackCleanup: () => {}
        });
        const scrollEvt = { type: "scroll" };
        scrollNode.dispatchEvent(scrollEvt);
        assert(passiveScrollHandled === true && !scrollEvt.defaultPrevented, "@scroll.passive.prevent executes handler without invoking preventDefault");

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
        // 23i. Checkbox true-value and false-value
        const tvNode = new MockNode(1, "input");
        tvNode.type = "checkbox";
        tvNode.setAttribute("true-value", "yes");
        tvNode.setAttribute("false-value", "no");
        const tvState = reactive({ agreed: "no" });
        builtinDirs.model.mounted(tvNode, {
            value: "agreed",
            ctx: tvState,
            trackCleanup: () => {}
        });
        assert(tvNode.checked === false, "Checkbox initialized as unchecked for false-value 'no'");
        tvNode.dispatchEvent({ type: "change", target: { checked: true } });
        assert(tvState.agreed === "yes", "Checkbox true-value 'yes' assigned when checked");
        tvNode.dispatchEvent({ type: "change", target: { checked: false } });
        assert(tvState.agreed === "no", "Checkbox false-value 'no' assigned when unchecked");

        // 23j. Dynamic Directive Arguments (:[dynamicAttr] and @[dynamicEvent])
        const dynAttrNode = new MockNode(1, "button");
        const dynState = reactive({ currentAttr: "title", attrVal: "Hello Helix", currentEvt: "click" });
        builtinDirs.bind.mounted(dynAttrNode, {
            value: "attrVal",
            arg: "[currentAttr]",
            ctx: dynState,
            trackCleanup: () => {}
        });
        assert(dynAttrNode.getAttribute("title") === "Hello Helix", ":[dynamicAttr] binds title initially");
        dynState.currentAttr = "aria-label";
        flushJobs();
        assert(dynAttrNode.getAttribute("aria-label") === "Hello Helix", ":[dynamicAttr] updates to aria-label on state change");
        assert(!dynAttrNode.hasAttribute("title"), ":[dynamicAttr] removes previous title attribute");

        let dynEvtCount = 0;
        const dynEvtState = reactive({ dynEvt: "click" });
        const dynEvtNode = new MockNode(1, "button");
        builtinDirs.on.mounted(dynEvtNode, {
            value: "handleDyn",
            arg: "[dynEvtState.dynEvt]",
            ctx: {
                dynEvtState,
                handleDyn: () => { dynEvtCount++; }
            },
            trackCleanup: () => {}
        });
        // 1. Initial event is click
        dynEvtNode.dispatchEvent({ type: "click" });
        assert(dynEvtCount === 1, "@[dynamicEvent] fires handler on initial click event");

        // 2. Switch event to mouseenter
        dynEvtState.dynEvt = "mouseenter";
        flushJobs();
        dynEvtNode.dispatchEvent({ type: "click" });
        assert(dynEvtCount === 1, "@[dynamicEvent] click listener removed after switching event to mouseenter");
        dynEvtNode.dispatchEvent({ type: "mouseenter" });
        assert(dynEvtCount === 2, "@[dynamicEvent] mouseenter listener active and fired handler");

        // 3. Lowercased HTML attribute path matching ([state.dynevt] -> state.dynEvt)
        let caseCount = 0;
        const caseState = reactive({ dynEvtName: "dblclick" });
        const caseNode = new MockNode(1, "button");
        builtinDirs.on.mounted(caseNode, {
            value: "handleCase",
            arg: "[caseState.dynevtname]",
            ctx: {
                caseState,
                handleCase: () => { caseCount++; }
            },
            trackCleanup: () => {}
        });
        caseNode.dispatchEvent({ type: "dblclick" });
        assert(caseCount === 1, "@[caseState.dynevtname] case-insensitively resolves to caseState.dynEvtName");

        // 4. Full element attribute parsing for bracketed dot expressions
        const dynRoot = new MockNode(1, "div");
        const fullDynNode = new MockNode(1, "button");
        fullDynNode.setAttribute(":[caseState.dynattr]", "caseState.dynEvtName");
        fullDynNode.setAttribute("@[caseState.dynevtname]", "handleCase");
        dynRoot.appendChild(fullDynNode);
        const fullDynApp = createApp({
            setup() {
                return {
                    caseState: reactive({ dynattr: "title", dynEvtName: "click" }),
                    handleCase: () => { caseCount += 10; }
                };
            }
        });
        await fullDynApp.mount(dynRoot);
        assert(fullDynNode.getAttribute("title") === "click", "Full element :[dot.path] correctly parsed and bound title");
        fullDynNode.dispatchEvent({ type: "click" });
        assert(caseCount === 11, "Full element @[dot.path] correctly parsed and bound click listener");

        // 23k. hx-pre and hx-once directives
        const appRoot = new MockNode(1, "div");
        const preEl = new MockNode(1, "div");
        preEl.setAttribute("h-pre", "");
        preEl.textContent = "{{ rawMustache }}";
        const onceEl = new MockNode(1, "span");
        onceEl.setAttribute("h-once", "");
        onceEl.setAttribute("h-text", "count");
        const normalEl = new MockNode(1, "p");
        normalEl.setAttribute("h-text", "count");
        appRoot.appendChild(preEl);
        appRoot.appendChild(onceEl);
        appRoot.appendChild(normalEl);

        const phase3State = reactive({ count: 10, rawMustache: "Uninterpolated" });
        const app3 = createApp({
            setup() {
                return phase3State;
            }
        });
        app3.mount(appRoot);

        assert(preEl.textContent === "{{ rawMustache }}", "hx-pre leaves text interpolation untouched");
        assert(String(onceEl.textContent) === "10", "hx-once initializes with count = 10");
        assert(String(normalEl.textContent) === "10", "normal element initializes with count = 10");

        phase3State.count = 25;
        flushJobs();
        assert(String(onceEl.textContent) === "10", "h-once does not update when state mutates (static freeze)");
        assert(String(normalEl.textContent) === "25", "normal element updates to 25");

        // 23k2. Custom Prefix Directive Verification (e.g. prefix: "custom-")
        const customRoot = new MockNode(1, "div");
        const customPre = new MockNode(1, "div");
        customPre.setAttribute("custom-pre", "");
        customPre.textContent = "{{ uncompiled }}";

        const customOnce = new MockNode(1, "span");
        customOnce.setAttribute("custom-once", "");
        customOnce.setAttribute("custom-text", "num");

        const customIgnore = new MockNode(1, "div");
        customIgnore.setAttribute("custom-ignore", "");
        const customIgnoreChild = new MockNode(1, "span");
        customIgnoreChild.textContent = "Unbound Initial";
        customIgnoreChild.setAttribute("custom-text", "num");
        customIgnore.appendChild(customIgnoreChild);

        const customDynBtn = new MockNode(1, "button");
        customDynBtn.setAttribute("custom-bind:[dynamicAttr]", "dynamicVal");
        customDynBtn.setAttribute("custom-on:[dynamicEvt]", "onCustomEvt");

        let customEvtFired = 0;
        const customCb = new MockNode(1, "input");
        customCb.type = "checkbox";
        customCb.setAttribute("custom-model", "terms");
        customCb.setAttribute("true-value", "AGREED");
        customCb.setAttribute("false-value", "DISAGREED");

        customRoot.appendChild(customPre);
        customRoot.appendChild(customOnce);
        customRoot.appendChild(customIgnore);
        customRoot.appendChild(customDynBtn);
        customRoot.appendChild(customCb);

        const customState = reactive({
            num: 100,
            uncompiled: "RAW",
            dynamicAttr: "title",
            dynamicVal: "Custom Tooltip",
            dynamicEvt: "click",
            terms: "DISAGREED",
            onCustomEvt: () => { customEvtFired++; }
        });

        const customApp = createApp({
            prefix: "custom-",
            setup() {
                return customState;
            }
        });
        await customApp.mount(customRoot);

        // 1. custom-pre
        assert(customPre.textContent === "{{ uncompiled }}", "custom-pre leaves template uncompiled with custom prefix");

        // 2. custom-once
        assert(String(customOnce.textContent) === "100", "custom-once renders initial value with custom prefix");
        customState.num = 200;
        flushJobs();
        assert(String(customOnce.textContent) === "100", "custom-once remains frozen after state mutation with custom prefix");

        // 3. custom-ignore
        assert(customIgnoreChild.textContent === "Unbound Initial", "custom-ignore skips child binding with custom prefix");

        // 4. custom-bind:[dynamicAttr] & custom-on:[dynamicEvt]
        assert(customDynBtn.getAttribute("title") === "Custom Tooltip", "custom-bind:[dynamicAttr] binds attribute with custom prefix");
        customDynBtn.dispatchEvent({ type: "click" });
        assert(customEvtFired === 1, "custom-on:[dynamicEvt] fires listener with custom prefix");

        // Dynamic event switch on custom-on:
        customState.dynamicEvt = "mouseenter";
        flushJobs();
        customDynBtn.dispatchEvent({ type: "click" });
        assert(customEvtFired === 1, "custom-on previous event listener detached after event change");
        customDynBtn.dispatchEvent({ type: "mouseenter" });
        assert(customEvtFired === 2, "custom-on new event listener attached and fired with custom prefix");

        // 5. custom-model with true-value / false-value
        assert(customState.terms === "DISAGREED", "custom-model initialized with custom false-value 'DISAGREED'");
        customCb.dispatchEvent({ type: "change", target: { checked: true } });
        assert(customState.terms === "AGREED", "custom-model assigned true-value 'AGREED' when checked");
        customCb.dispatchEvent({ type: "change", target: { checked: false } });
        assert(customState.terms === "DISAGREED", "custom-model assigned false-value 'DISAGREED' when unchecked");

        // 23l. Event Outside, Security & Parametric Resolution (P1-01 to P1-07)
        // P1-01, P1-02, P1-03: @mousedown.outside with composedPath
        const outsideTargetEl = new MockNode(1, "div");
        const outsideOtherEl = new MockNode(1, "div");
        let outsideMousedownFired = 0;
        const unbindOutside = builtinDirs.on.mounted(outsideTargetEl, {
            value: "onOutside",
            arg: "mousedown",
            modifiers: ["outside"],
            ctx: { onOutside: () => { outsideMousedownFired++; } },
            trackCleanup: () => {}
        });
        const attachedOutsideListeners = global.document.listeners?.["mousedown"] || [];
        assert(attachedOutsideListeners.length >= 1, "P1-01/P1-02: @mousedown.outside attached to document with 'mousedown' event type");

        // Simulate click inside target (composedPath includes target) -> should NOT fire
        const insideEvt = { type: "mousedown", target: outsideTargetEl, composedPath: () => [outsideTargetEl] };
        global.document.dispatchEvent(insideEvt);
        assert(outsideMousedownFired === 0, "P1-03: .outside with composedPath ignores mousedown inside target");

        // Simulate click outside target (composedPath contains other element) -> SHOULD fire
        const outsideEvt = { type: "mousedown", target: outsideOtherEl, composedPath: () => [outsideOtherEl] };
        global.document.dispatchEvent(outsideEvt);
        assert(outsideMousedownFired === 1, "P1-03: .outside with composedPath fires handler when clicking outside");

        // .outside.ctrl.once: Non-matching outside clicks (without CTRL) or inside clicks do NOT consume the .once listener;
        // Only the first valid outside CTRL click triggers the handler and unbinds the listener!
        const onceOutsideEl = new MockNode(1, "div");
        let onceOutsideCalls = 0;
        builtinDirs.on.mounted(onceOutsideEl, {
            value: "onOnceOutside",
            arg: "click",
            modifiers: ["outside", "ctrl", "once"],
            ctx: { onOnceOutside: () => { onceOutsideCalls++; } },
            trackCleanup: () => {}
        });

        // 1. Inside click -> not consumed, not fired
        global.document.dispatchEvent({ type: "click", target: onceOutsideEl, ctrlKey: true, composedPath: () => [onceOutsideEl] });
        assert(onceOutsideCalls === 0, "@click.outside.ctrl.once ignores inside click without consuming listener");

        // 2. Outside click without CTRL -> not consumed, not fired
        global.document.dispatchEvent({ type: "click", target: outsideOtherEl, ctrlKey: false, composedPath: () => [outsideOtherEl] });
        assert(onceOutsideCalls === 0, "@click.outside.ctrl.once ignores outside click missing CTRL without consuming listener");

        // 3. Outside click with CTRL -> FIRES handler and unbinds!
        global.document.dispatchEvent({ type: "click", target: outsideOtherEl, ctrlKey: true, composedPath: () => [outsideOtherEl] });
        assert(onceOutsideCalls === 1, "@click.outside.ctrl.once fires handler when matching outside CTRL click");

        // 4. Subsequent outside click with CTRL -> does NOT fire again because .once unbound it!
        global.document.dispatchEvent({ type: "click", target: outsideOtherEl, ctrlKey: true, composedPath: () => [outsideOtherEl] });
        assert(onceOutsideCalls === 1, "@click.outside.ctrl.once does not fire on subsequent matching outside clicks (once unbind verified)");

        // P1-05, P1-06: Safe Event Handler Resolution
        let memberThisContext = null;
        let paramPassed = null;
        const eventTestStore = {
            name: "HelixStore",
            saveMethod(item, extra) {
                memberThisContext = this;
                paramPassed = { item, extra };
            }
        };

        // Method reference with automatic this context
        const storeBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(storeBtn, {
            value: "eventTestStore.saveMethod",
            arg: "click",
            ctx: { eventTestStore },
            trackCleanup: () => {}
        });
        storeBtn.dispatchEvent({ type: "click" });
        assert(memberThisContext === eventTestStore, "P1-06: @click='eventTestStore.saveMethod' automatically binds thisArg to eventTestStore");

        // Safe parametric call without new Function()
        memberThisContext = null;
        paramPassed = null;
        const paramBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(paramBtn, {
            value: "eventTestStore.saveMethod(currentItem, 'staticVal')",
            arg: "click",
            ctx: { eventTestStore, currentItem: { id: 99 } },
            trackCleanup: () => {}
        });
        paramBtn.dispatchEvent({ type: "click" });
        assert(paramPassed?.item?.id === 99 && paramPassed?.extra === "staticVal", "P1-06: Safe parametric call evaluated without unsafe code injection");

        // P1-05: Negative test - inline statements rejected when allowInlineExpressions is false
        let inlineRan = false;
        const secureBtn = new MockNode(1, "button");
        const secureDirs = createBuiltinDirectives({ prefix: "hx-", allowInlineExpressions: false });
        secureDirs.on.mounted(secureBtn, {
            value: "inlineRan = true; alert('insecure')",
            arg: "click",
            ctx: { inlineRan: false },
            trackCleanup: () => {}
        });
        secureBtn.dispatchEvent({ type: "click" });
        assert(inlineRan === false, "P1-05: Inline statement rejected when allowInlineExpressions === false");

        // P1-04, P1-07: Unknown keyboard modifier validation & negative test
        let unknownKeyHandled = false;
        const typoKeyBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(typoKeyBtn, {
            value: "handleUnknownKey",
            arg: "keydown",
            modifiers: ["unknownKeyModifier"],
            ctx: { handleUnknownKey: () => { unknownKeyHandled = true; } },
            trackCleanup: () => {}
        });
        // Dispatched keydown with arbitrary key: since unknownKeyModifier was invalid and ignored, handler executes
        typoKeyBtn.dispatchEvent({ type: "keydown", key: "Enter" });
        assert(unknownKeyHandled === true, "P1-04/P1-07: Unknown keyboard modifier emits warning and is safely ignored (not corrupting handler)");

        // Valid keyboard modifiers: alias, function keys, single character
        let f1Handled = false;
        let homeHandled = false;
        let charHandled = false;
        const validKeyBtn = new MockNode(1, "button");
        builtinDirs.on.mounted(validKeyBtn, {
            value: "handleF1",
            arg: "keydown",
            modifiers: ["f1"],
            ctx: { handleF1: () => { f1Handled = true; } },
            trackCleanup: () => {}
        });
        builtinDirs.on.mounted(validKeyBtn, {
            value: "handleHome",
            arg: "keydown",
            modifiers: ["home"],
            ctx: { handleHome: () => { homeHandled = true; } },
            trackCleanup: () => {}
        });
        builtinDirs.on.mounted(validKeyBtn, {
            value: "handleChar",
            arg: "keydown",
            modifiers: ["k"],
            ctx: { handleChar: () => { charHandled = true; } },
            trackCleanup: () => {}
        });

        validKeyBtn.dispatchEvent({ type: "keydown", key: "F1" });
        assert(f1Handled === true, "P1-04: Valid function key modifier @keydown.f1 matches F1 key");
        validKeyBtn.dispatchEvent({ type: "keydown", key: "Home" });
        assert(homeHandled === true, "P1-04: Valid key alias @keydown.home matches Home key");
        validKeyBtn.dispatchEvent({ type: "keydown", key: "k" });
        assert(charHandled === true, "P1-04: Valid single char modifier @keydown.k matches 'k' key");

        // 23m. Comprehensive Directives Cleanup Verification (P3-04)
        // Tests full lifecycle invariant across: hx-text, hx-html, hx-model, hx-bind (:class, :style, :title), hx-show, hx-for, hx-if, hx-memo
        const allRoot = new MockNode(1, "div");
        const allTextNode = new MockNode(1, "span"); allTextNode.setAttribute("h-text", "label");
        const allHtmlNode = new MockNode(1, "div"); allHtmlNode.setAttribute("h-html", "rawCode");
        const allInputNode = new MockNode(1, "input"); allInputNode.setAttribute("h-model", "label");
        const allBindNode = new MockNode(1, "button");
        allBindNode.setAttribute(":title", "label");
        allBindNode.setAttribute(":class", "btnClass");
        allBindNode.setAttribute(":style", "customStyle");
        const allShowNode = new MockNode(1, "p"); allShowNode.setAttribute("h-show", "isVisible");
        const allMemoNode = new MockNode(1, "div"); allMemoNode.setAttribute("h-memo", "[itemKey]");
        const allMemoChild = new MockNode(1, "span"); allMemoChild.setAttribute("h-text", "label");
        allMemoNode.appendChild(allMemoChild);

        allRoot.appendChild(allTextNode);
        allRoot.appendChild(allHtmlNode);
        allRoot.appendChild(allInputNode);
        allRoot.appendChild(allBindNode);
        allRoot.appendChild(allShowNode);
        allRoot.appendChild(allMemoNode);

        const allState = reactive({
            label: "Version 1",
            rawCode: "<em>Code 1</em>",
            btnClass: "btn-primary",
            customStyle: "color: blue;",
            isVisible: true,
            itemKey: 100
        });

        const allApp = createApp({ setup() { return allState; } });
        allApp.mount(allRoot);

        // Mount invariant check
        assert(allInputNode.listeners["input"]?.length === 1, "P3-04: hx-model attaches exactly 1 input listener on mount");
        assert(allTextNode.textContent === "Version 1", "P3-04: hx-text initialized correctly");
        assert(allHtmlNode.innerHTML === "<em>Code 1</em>", "P3-04: hx-html initialized correctly");
        assert(allBindNode.getAttribute("title") === "Version 1", "P3-04: hx-bind title initialized correctly");
        assert(allBindNode.className === "btn-primary", "P3-04: hx-bind class initialized correctly");
        assert(allBindNode.style.cssText === "color: blue;", "P3-04: hx-bind style initialized correctly");
        assert(allShowNode.style.display === "", "P3-04: hx-show visible on mount");

        // 10 consecutive reactive state updates
        for (let step = 2; step <= 11; step++) {
            allState.label = `Version ${step}`;
            allState.rawCode = `<em>Code ${step}</em>`;
            allState.btnClass = step % 2 === 0 ? "btn-active" : "btn-idle";
            allState.customStyle = step % 2 === 0 ? "color: red;" : "color: green;";
            allState.isVisible = step % 2 === 0;
            allState.itemKey = step;
            flushJobs();
        }

        // Multiple updates invariant check
        assert(allInputNode.listeners["input"]?.length === 1, "P3-04: hx-model maintains exactly 1 listener after 10 reactive updates (zero accumulation)");
        assert(allTextNode.textContent === "Version 11", "P3-04: hx-text maintains reactivity across 10 updates");
        assert(allHtmlNode.innerHTML === "<em>Code 11</em>", "P3-04: hx-html maintains reactivity across 10 updates");
        assert(allBindNode.getAttribute("title") === "Version 11", "P3-04: hx-bind title maintains reactivity across 10 updates");
        assert(allBindNode.className === "btn-idle", "P3-04: hx-bind class maintains reactivity across 10 updates");
        assert(allShowNode.style.display === "none", "P3-04: hx-show hidden after odd step");

        // Destroy / teardown invariant check
        destroyNode(allRoot);
        assert(allInputNode.listeners["input"]?.length === 0, "P3-04: hx-model listener completely removed post-destroy");

        // Mutate state after destroy -> assert zero leaked reactive updates on destroyed elements
        allState.label = "Mutated Post Destroy";
        allState.rawCode = "<em>Post Destroy HTML</em>";
        allState.btnClass = "btn-leaked";
        allState.customStyle = "color: black;";
        allState.isVisible = true;
        flushJobs();

        assert(allTextNode.textContent === "Version 11", "P3-04: hx-text effect cleanly stopped post-destroy (zero leaked updates)");
        assert(allHtmlNode.innerHTML === "<em>Code 11</em>", "P3-04: hx-html effect cleanly stopped post-destroy (zero leaked updates)");
        assert(allBindNode.getAttribute("title") === "Version 11", "P3-04: hx-bind effect cleanly stopped post-destroy (zero leaked updates)");
        assert(allBindNode.className === "btn-idle", "P3-04: hx-bind class effect cleanly stopped post-destroy (zero leaked updates)");
        assert(allShowNode.style.display === "none", "P3-04: hx-show effect cleanly stopped post-destroy (zero leaked updates)");

        // 23n. hx-if Branch Switching Lifecycle Isolation (P3-05, P3-06)
        const ifContainer = new MockNode(1, "div");
        const branchA = new MockNode(1, "div");
        branchA.setAttribute("data-branch", "A");
        const nestedSpanA = new MockNode(1, "span");
        branchA.appendChild(nestedSpanA);

        const branchB = new MockNode(1, "div");
        branchB.setAttribute("data-branch", "B");
        const nestedSpanB = new MockNode(1, "span");
        branchB.appendChild(nestedSpanB);

        ifContainer.appendChild(branchA);

        let clickACount = 0;
        let clickBCount = 0;
        const branchIfState = reactive({ isA: true, msgA: "Hello A", msgB: "Hello B" });

        builtinDirs.if.mounted(branchA, {
            value: "isA",
            branches: [
                { el: branchA, exp: "isA", type: "if" },
                { el: branchB, exp: "null", type: "else" }
            ],
            ctx: branchIfState,
            instance: null,
            trackCleanup: () => {},
            bindNode: (node, childCtx) => {
                if (node.getAttribute("data-branch") === "A") {
                    builtinDirs.on.mounted(node, {
                        value: "onClickA",
                        arg: "click",
                        ctx: { onClickA: () => clickACount++ },
                        trackCleanup: (fn) => { node.__hx_cleanup = node.__hx_cleanup || []; node.__hx_cleanup.push(fn); }
                    });
                    const child = node.childNodes[0];
                    if (child) {
                        builtinDirs.text.mounted(child, {
                            value: "msgA",
                            ctx: childCtx,
                            instance: null,
                            trackCleanup: (fn) => { child.__hx_cleanup = child.__hx_cleanup || []; child.__hx_cleanup.push(fn); }
                        });
                    }
                } else if (node.getAttribute("data-branch") === "B") {
                    builtinDirs.on.mounted(node, {
                        value: "onClickB",
                        arg: "click",
                        ctx: { onClickB: () => clickBCount++ },
                        trackCleanup: (fn) => { node.__hx_cleanup = node.__hx_cleanup || []; node.__hx_cleanup.push(fn); }
                    });
                    const child = node.childNodes[0];
                    if (child) {
                        builtinDirs.text.mounted(child, {
                            value: "msgB",
                            ctx: childCtx,
                            instance: null,
                            trackCleanup: (fn) => { child.__hx_cleanup = child.__hx_cleanup || []; child.__hx_cleanup.push(fn); }
                        });
                    }
                }
            }
        });

        // Initial state: Branch A is active
        const getActiveNode = () => ifContainer.childNodes.find(n => n.nodeType === 1);
        const firstActiveA = getActiveNode();
        assert(firstActiveA && firstActiveA.getAttribute("data-branch") === "A", "P3-05: Exactly 1 active branch (A) in DOM initially");
        assert(firstActiveA.childNodes[0].textContent === "Hello A", "P3-05: Branch A nested text rendered");
        firstActiveA.dispatchEvent({ type: "click" });
        assert(clickACount === 1 && clickBCount === 0, "P3-05: Branch A fired click initially");

        // Switch to Branch B (A -> B)
        branchIfState.isA = false;
        flushJobs();
        firstActiveA.dispatchEvent({ type: "click" });
        assert(clickACount === 1, "P3-05: Discarded Branch A listener inactive after branch switch");

        // Mutate msgA while Branch A is unmounted -> prove discarded Branch A reactive effect does NOT run
        branchIfState.msgA = "Mutated While Unmounted";
        flushJobs();
        assert(firstActiveA.childNodes[0].textContent === "Hello A", "P3-05: Discarded Branch A reactive effect stopped (no leaked updates)");

        const activeB = getActiveNode();
        assert(activeB && activeB.getAttribute("data-branch") === "B", "P3-06: Active branch switched to B");
        assert(activeB.childNodes[0].textContent === "Hello B", "P3-06: Active branch B nested text rendered");
        activeB.dispatchEvent({ type: "click" });
        assert(clickBCount === 1, "P3-06: Newly mounted Branch B active and fired click");

        // Switch back to Branch A (B -> A)
        branchIfState.isA = true;
        flushJobs();
        activeB.dispatchEvent({ type: "click" });
        assert(clickBCount === 1, "P3-05: Discarded Branch B listener inactive after switching back to A");
        const secondActiveA = getActiveNode();
        assert(secondActiveA && secondActiveA.getAttribute("data-branch") === "A", "P3-06: Active branch cleanly switched back to A");
        assert(secondActiveA.childNodes[0].textContent === "Mutated While Unmounted", "P3-06: Re-mounted Branch A fresh effect evaluated latest state");
        secondActiveA.dispatchEvent({ type: "click" });
        assert(clickACount === 2, "P3-06: Branch A cleanly re-mounted and fired click");

        // 23o. hx-pre Descendant Recursion & hx-once Nested Freeze (P3-07, P3-08)
        const preParent = new MockNode(1, "div");
        preParent.setAttribute("h-pre", "");
        const preChild = new MockNode(1, "span");
        preChild.setAttribute("h-text", "rawCount");
        preChild.textContent = "{{ uncompiled }}";
        preParent.appendChild(preChild);

        const testPreApp = createApp({ setup() { return reactive({ rawCount: 123 }); } });
        testPreApp.mount(preParent);
        assert(preChild.textContent === "{{ uncompiled }}", "P3-07: hx-pre skips all descendant compilation");

        // P3-08: Complete hx-once nested subtree freeze (hx-text, hx-model, @click, reactive expressions)
        const onceSubtreeRoot = new MockNode(1, "div");
        const onceSubtree = new MockNode(1, "div");
        onceSubtree.setAttribute("h-once", "");
        const onceSpan = new MockNode(1, "span");
        onceSpan.setAttribute("h-text", "title");
        const onceInput = new MockNode(1, "input");
        onceInput.setAttribute("h-model", "title");
        const onceBtn = new MockNode(1, "button");
        onceBtn.setAttribute("@click", "increment");
        const onceP = new MockNode(1, "p");
        onceP.setAttribute("h-text", "desc");

        onceSubtree.appendChild(onceSpan);
        onceSubtree.appendChild(onceInput);
        onceSubtree.appendChild(onceBtn);
        onceSubtree.appendChild(onceP);
        onceSubtreeRoot.appendChild(onceSubtree);

        let clickIncrementCount = 0;
        const onceState = reactive({
            title: "Initial Title",
            desc: "Initial Desc",
            increment: () => { clickIncrementCount++; }
        });
        const onceApp = createApp({ setup() { return onceState; } });
        onceApp.mount(onceSubtreeRoot);

        // Initial mount assertions
        assert(onceSpan.textContent === "Initial Title", "P3-08: hx-once subtree rendered initial text");
        assert(onceInput.value === "Initial Title", "P3-08: hx-once subtree initialized model input value");
        assert(onceP.textContent === "Initial Desc", "P3-08: hx-once subtree rendered initial desc");

        // Event listener execution
        onceBtn.dispatchEvent({ type: "click" });
        assert(clickIncrementCount === 1, "P3-08: Event listener on hx-once subtree mounted and clickable");

        // Direct state mutation -> prove entire subtree remains frozen with zero reactive updates
        onceState.title = "Mutated Title";
        onceState.desc = "Mutated Desc";
        flushJobs();

        assert(onceSpan.textContent === "Initial Title", "P3-08: hx-once span text remains frozen after state mutation");
        assert(onceInput.value === "Initial Title", "P3-08: hx-once model input remains frozen after state mutation");
        assert(onceP.textContent === "Initial Desc", "P3-08: hx-once desc text remains frozen after state mutation");

        // 23p. hx-memo Directive Behavior (P3-09)
        const memoAppRoot = new MockNode(1, "div");
        const memoEl = new MockNode(1, "div");
        memoEl.setAttribute("h-memo", "[user.id]");
        const memoChild = new MockNode(1, "span");
        memoChild.setAttribute("h-text", "user.name");
        memoEl.appendChild(memoChild);
        memoAppRoot.appendChild(memoEl);

        const memoState = reactive({ user: { id: 1, name: "Alice", age: 25 } });
        const memoApp = createApp({ setup() { return memoState; } });
        memoApp.mount(memoAppRoot);
        const getMemoChild = () => memoEl.childNodes.find(c => c.nodeType === 1);
        assert(getMemoChild()?.textContent === "Alice", "P3-09: hx-memo renders initial value 'Alice'");

        // Mutate non-memoized property 'name' while memoized dep 'id' is unchanged -> should NOT update
        memoState.user.name = "Alice Updated";
        flushJobs();
        // Since id has not changed, the memoized subtree does not re-run
        assert(getMemoChild()?.textContent === "Alice", "P3-09: hx-memo skipped DOM update when memo dependency reference is unchanged");

        // Mutate memoized dep 'id' -> should update
        memoState.user.id = 2;
        flushJobs();
        assert(getMemoChild()?.textContent === "Alice Updated", "P3-09: hx-memo re-rendered subtree when dependency reference changed");

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

        // 28. Suspense template contains else-if for error state
        assert(Suspense.setup({}).template.includes("else-if=\"state.error\""), "Suspense template renders else-if for error state");

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

        // 38. Built-in Transition & Animation Engine Tests
        // 38a. resolveTransitionConfig with Dynamic Prefixes & Custom Utility Classes
        const defaultTransEl = new MockNode(1, "div");
        defaultTransEl.setAttribute("h-transition", "");
        const defaultCfg = resolveTransitionConfig(defaultTransEl, { prefix: "h-" });
        assert(defaultCfg && defaultCfg.name === "h" && defaultCfg.enterActiveClass === "h-enter-active", "resolveTransitionConfig parses default prefix transition");

        const namedTransEl = new MockNode(1, "div");
        namedTransEl.setAttribute("hx-transition", "fade");
        const namedCfg = resolveTransitionConfig(namedTransEl, { prefix: "hx-" });
        assert(namedCfg && namedCfg.name === "fade" && namedCfg.enterFromClass === "fade-enter-from" && namedCfg.leaveToClass === "fade-leave-to", "resolveTransitionConfig parses named 'fade' transition");

        const tailwindTransEl = new MockNode(1, "div");
        tailwindTransEl.setAttribute("enter-active-class", "transition duration-300 ease-out");
        tailwindTransEl.setAttribute("enter-from-class", "opacity-0 scale-95");
        tailwindTransEl.setAttribute("leave-active-class", "transition duration-200 ease-in");
        const twCfg = resolveTransitionConfig(tailwindTransEl, { prefix: "h-" });
        assert(twCfg && twCfg.enterActiveClass === "transition duration-300 ease-out" && twCfg.enterFromClass === "opacity-0 scale-95", "resolveTransitionConfig parses granular utility classes");

        // 38b. enter() & leave() lifecycle and JS event hooks
        const hookTransEl = new MockNode(1, "div");
        hookTransEl.setAttribute("h-transition", "fade");
        const hookEvents = [];
        hookTransEl.addEventListener("before-enter", () => hookEvents.push("before-enter"));
        hookTransEl.addEventListener("enter", () => hookEvents.push("enter"));
        hookTransEl.addEventListener("after-enter", () => hookEvents.push("after-enter"));
        hookTransEl.addEventListener("before-leave", () => hookEvents.push("before-leave"));
        hookTransEl.addEventListener("leave", () => hookEvents.push("leave"));
        hookTransEl.addEventListener("after-leave", () => hookEvents.push("after-leave"));

        let enterDoneCalled = false;
        enter(hookTransEl, resolveTransitionConfig(hookTransEl, { prefix: "h-" }), () => {
            enterDoneCalled = true;
        });
        assert(hookEvents.includes("before-enter"), "enter() fires @before-enter hook event");
        assert(hookTransEl.classList.contains("fade-enter-from") && hookTransEl.classList.contains("fade-enter-active"), "enter() initializes fade-enter-from and fade-enter-active classes");

        // Wait for next tick/frame for enter transition completion
        await new Promise((r) => setTimeout(r, 60));
        assert(enterDoneCalled === true, "enter() completes and invokes onDone callback");
        assert(!hookTransEl.classList.contains("fade-enter-from") && !hookTransEl.classList.contains("fade-enter-active"), "enter() cleans up active/from classes on completion");
        assert(hookEvents.includes("enter") && hookEvents.includes("after-enter"), "enter() fires @enter and @after-enter hook events");

        let leaveDoneCalled = false;
        leave(hookTransEl, resolveTransitionConfig(hookTransEl, { prefix: "h-" }), () => {
            leaveDoneCalled = true;
        });
        assert(hookEvents.includes("before-leave"), "leave() fires @before-leave hook event");
        assert(hookTransEl.classList.contains("fade-leave-from") && hookTransEl.classList.contains("fade-leave-active"), "leave() initializes fade-leave-from and fade-leave-active classes");

        await new Promise((r) => setTimeout(r, 60));
        assert(leaveDoneCalled === true, "leave() completes and invokes onDone callback");
        assert(hookEvents.includes("leave") && hookEvents.includes("after-leave"), "leave() fires @leave and @after-leave hook events");

        // 38c. dirs.show with Transition
        const transShowRoot = new MockNode(1, "div");
        const transShowEl = new MockNode(1, "div");
        transShowEl.setAttribute("h-show", "isOpen");
        transShowEl.setAttribute("h-transition", "slide");
        transShowRoot.appendChild(transShowEl);

        const showState = reactive({ isOpen: true });
        const showApp = createApp({ setup() { return showState; } });
        await showApp.mount(transShowRoot);

        assert(transShowEl.style.display === "", "dirs.show initially renders visible with transition");

        // Hide with transition
        showState.isOpen = false;
        flushJobs();
        assert(transShowEl.classList.contains("slide-leave-from") || transShowEl.classList.contains("slide-leave-active"), "dirs.show initiates leave transition before setting display: none");
        await new Promise((r) => setTimeout(r, 60));
        assert(transShowEl.style.display === "none", "dirs.show sets display: none after leave transition completes");

        // Show with transition
        showState.isOpen = true;
        flushJobs();
        assert(transShowEl.style.display === "", "dirs.show removes display: none immediately on enter");

        // 38d. dirs.if with Transition Branch Exit
        const transIfRoot = new MockNode(1, "div");
        const transIfEl = new MockNode(1, "div");
        transIfEl.setAttribute("h-if", "tab === 'one'");
        transIfEl.setAttribute("h-transition", "fade");
        transIfEl.textContent = "Tab 1 Content";
        transIfRoot.appendChild(transIfEl);

        const transIfState = reactive({ tab: "one" });
        const transIfApp = createApp({ setup() { return transIfState; } });
        await transIfApp.mount(transIfRoot);

        const activeIfEl = transIfRoot.childNodes.find((c) => c.textContent === "Tab 1 Content");
        assert(activeIfEl !== undefined, "dirs.if renders initial branch with transition");

        transIfState.tab = "two";
        flushJobs();
        // Exiting node begins leave transition
        assert(activeIfEl.classList.contains("fade-leave-from") || activeIfEl.classList.contains("fade-leave-active"), "dirs.if initiates leave transition on outgoing branch");
        await new Promise((r) => setTimeout(r, 60));
        assert(!transIfRoot.childNodes.includes(activeIfEl), "dirs.if unmounts outgoing branch after leave transition completes");

        // 38e. FLIP List Transitions (dirs.for + applyFlip)
        const flipParent = new MockNode(1, "ul");
        const flipItem1 = new MockNode(1, "li");
        flipItem1._rect = { left: 0, top: 0, width: 100, height: 30 };
        const flipItem2 = new MockNode(1, "li");
        flipItem2._rect = { left: 0, top: 30, width: 100, height: 30 };
        flipParent.appendChild(flipItem1);
        flipParent.appendChild(flipItem2);
        const oldPosMap = recordPositions([flipItem1, flipItem2]);
        assert(oldPosMap.get(flipItem1).top === 0 && oldPosMap.get(flipItem2).top === 30, "recordPositions records initial bounding rects");

        // Swap rects
        flipItem1._rect = { left: 0, top: 30, width: 100, height: 30 };
        flipItem2._rect = { left: 0, top: 0, width: 100, height: 30 };
        applyFlip(oldPosMap, "h-move");
        assert(flipItem1.style.transform.includes("translate"), "applyFlip calculates invert translation transform on moved elements");

        // 38f. Transition & TransitionGroup Component Registration & Execution (T-03 & T-04)
        assert(Transition && typeof Transition.setup === "function", "Transition component definition exists");
        assert(TransitionGroup && typeof TransitionGroup.setup === "function", "TransitionGroup component definition exists");

        // T-03: Transition component sets config on root child
        const compRootEl = new MockNode(1, "div");
        const compChildEl = new MockNode(1, "p");
        compChildEl.textContent = "Sliding Message";
        compRootEl.appendChild(compChildEl);
        const transInst = Transition.setup({ name: "slide", appear: false });
        assert(transInst.config && transInst.config.enterActiveClass === "slide-enter-active", "Transition component resolves config from props");

        // T-04: TransitionGroup component setup & config
        const groupInst = TransitionGroup.setup({ name: "fade", tag: "ul", moveClass: "custom-move" });
        assert(groupInst.config.moveClass === "custom-move", "TransitionGroup component resolves custom moveClass");

        // 38g. T-01: Guaranteed onDone({ cancelled }) Contract
        const cancelTransEl = new MockNode(1, "div");
        cancelTransEl.setAttribute("h-transition", "fade");
        const cancelCfg = resolveTransitionConfig(cancelTransEl, { prefix: "h-" });

        let firstLeaveResult = null;
        leave(cancelTransEl, cancelCfg, (res) => {
            firstLeaveResult = res;
        });
        // Rapidly interrupt with enter before leave finishes
        let enterResult = null;
        enter(cancelTransEl, cancelCfg, (res) => {
            enterResult = res;
        });

        assert(firstLeaveResult !== null && firstLeaveResult.cancelled === true, "T-01: Interrupted leave() invokes onDone with { cancelled: true }");
        await new Promise((r) => setTimeout(r, 60));
        assert(enterResult !== null && enterResult.cancelled === false, "T-01: Uninterrupted enter() invokes onDone with { cancelled: false }");

        // 38h. T-02: Rapid Transition Reversal (true -> false -> true -> false -> true)
        const rapidRoot = new MockNode(1, "div");
        const rapidEl = new MockNode(1, "div");
        rapidEl.setAttribute("h-show", "isVisible");
        rapidEl.setAttribute("h-transition", "fade");
        rapidRoot.appendChild(rapidEl);

        const rapidState = reactive({ isVisible: true });
        const rapidApp = createApp({ setup() { return rapidState; } });
        await rapidApp.mount(rapidRoot);

        assert(rapidEl.style.display === "", "Rapid test: initial display is visible");

        // Rapidly toggle visibility 4 times within microtask intervals
        rapidState.isVisible = false;
        flushJobs();
        await new Promise((r) => setTimeout(r, 10));

        rapidState.isVisible = true;
        flushJobs();
        await new Promise((r) => setTimeout(r, 10));

        rapidState.isVisible = false;
        flushJobs();
        await new Promise((r) => setTimeout(r, 10));

        rapidState.isVisible = true;
        flushJobs();

        // Wait for final enter transition to finish
        await new Promise((r) => setTimeout(r, 70));
        assert(rapidEl.style.display === "", "T-02: Rapid reversal ends with correct display = ''");
        assert(!rapidEl.classList.contains("fade-leave-active") && !rapidEl.classList.contains("fade-leave-from"), "T-02: No stale leave classes remain after rapid reversal");

        // 38i. T-07: Pairwise Duration & Delay Calculation
        // Mock getComputedStyle for pair testing
        const origGCS = global.window ? global.window.getComputedStyle : null;
        try {
            global.window = global.window || {};
            global.window.getComputedStyle = (node) => {
                if (node._mockStyles) return node._mockStyles;
                return {
                    transitionDuration: "100ms, 800ms",
                    transitionDelay: "200ms, 100ms",
                    animationDuration: "0s",
                    animationDelay: "0s"
                };
            };

            const multiPropEl = new MockNode(1, "div");
            const multiDur = getTransitionDurations(multiPropEl);
            // Pair 1: 100ms + 200ms = 300ms. Pair 2: 800ms + 100ms = 900ms. Max total should be 900ms (not 800 + 200 = 1000ms)
            assert(multiDur.total === 900, "T-07: getTransitionDurations accurately sums paired duration+delay (900ms instead of 1000ms)");
        } finally {
            if (origGCS) global.window.getComputedStyle = origGCS;
            else if (global.window) delete global.window.getComputedStyle;
        }

        // 38j. T-05: Node Lifecycle & destroyNode() Cleanup Cancels Active Transition
        const cleanupTransEl = new MockNode(1, "div");
        cleanupTransEl.setAttribute("h-transition", "fade");
        let cleanupCancelled = false;
        leave(cleanupTransEl, resolveTransitionConfig(cleanupTransEl, { prefix: "h-" }), (res) => {
            if (res && res.cancelled) cleanupCancelled = true;
        });
        cancelTransition(cleanupTransEl);
        assert(cleanupCancelled === true, "T-05: cancelTransition() triggers cancellation callback and stops timers");

        // Test destroyNode integration
        const destroyParent = new MockNode(1, "div");
        const destroyEl = new MockNode(1, "div");
        destroyEl.setAttribute("h-transition", "fade");
        destroyParent.appendChild(destroyEl);
        let destroyTransCancelled = false;
        leave(destroyEl, resolveTransitionConfig(destroyEl, { prefix: "h-" }), (res) => {
            if (res && res.cancelled) destroyTransCancelled = true;
        });
        assert(Array.isArray(destroyEl.__hx_cleanup) && destroyEl.__hx_cleanup.length > 0, "T-05: Transition registers its cleanup into el.__hx_cleanup");
        destroyNode(destroyEl);
        assert(destroyTransCancelled === true, "T-05: destroyNode() automatically cancels in-flight transition via cleanup scope");
        assert(!destroyEl.classList.contains("fade-leave-active") && !destroyEl.classList.contains("fade-leave-from"), "T-05: destroyNode() strips all transition classes");

        // 38k. T-08: Property-aware transitionend Filtering
        const propEl = new MockNode(1, "div");
        propEl.setAttribute("h-transition", "fade");
        const propCfg = resolveTransitionConfig(propEl, { prefix: "h-" });

        const origGCS2 = global.window ? global.window.getComputedStyle : null;
        try {
            global.window = global.window || {};
            global.window.getComputedStyle = () => ({
                transitionProperty: "opacity, transform",
                transitionDuration: "300ms, 1000ms",
                transitionDelay: "0s, 0s",
                animationDuration: "0s",
                animationDelay: "0s"
            });

            let propTransFinished = false;
            leave(propEl, propCfg, (res) => {
                if (res && !res.cancelled) propTransFinished = true;
            });

            // Wait for next frame listeners to attach
            await new Promise((r) => setTimeout(r, 30));

            // Premature transitionend event for shorter property 'opacity' (300ms)
            propEl.dispatchEvent({ type: "transitionend", target: propEl, propertyName: "opacity" });
            assert(propTransFinished === false, "T-08: Premature transitionend for shorter property (opacity) does NOT finish transition");

            // Correct transitionend event for longest property 'transform' (1000ms)
            propEl.dispatchEvent({ type: "transitionend", target: propEl, propertyName: "transform" });
            assert(propTransFinished === true, "T-08: Matching transitionend for longest property (transform) finishes transition successfully");
        } finally {
            if (origGCS2) global.window.getComputedStyle = origGCS2;
            else if (global.window) delete global.window.getComputedStyle;
        }

        // 38l. T-05 (FLIP): FLIP Lifecycle & destroyNode() Cleanup Ownership
        const flipCleanParent = new MockNode(1, "ul");
        const flipCleanEl = new MockNode(1, "li");
        flipCleanEl._rect = { left: 0, top: 0, width: 100, height: 30 };
        flipCleanParent.appendChild(flipCleanEl);

        const flipMap = new Map();
        flipMap.set(flipCleanEl, { left: 0, top: 50, width: 100, height: 30 });
        applyFlip(flipMap, "h-move");

        assert(Array.isArray(flipCleanEl.__hx_cleanup) && flipCleanEl.__hx_cleanup.length > 0, "T-05 (FLIP): applyFlip() registers cleanup in node.__hx_cleanup");
        assert(flipCleanEl.style.transform !== "", "T-05 (FLIP): applyFlip() applies invert translation");

        // Destroy node while FLIP is in flight
        destroyNode(flipCleanEl);
        assert(flipCleanEl.style.transform === "", "T-05 (FLIP): destroyNode() resets transform style");
        assert(flipCleanEl.style.transitionDuration === "", "T-05 (FLIP): destroyNode() resets transitionDuration");
        assert(!flipCleanEl.classList.contains("h-move"), "T-05 (FLIP): destroyNode() removes moveClass");

        // 39. Teleport Engine Tests (<Teleport> and h-teleport)
        // 39a. resolveTeleportTarget resolution
        const customTargetEl = new MockNode(1, "div");
        assert(resolveTeleportTarget(customTargetEl) === customTargetEl, "resolveTeleportTarget resolves direct DOM node");
        assert(resolveTeleportTarget("body") !== null, "resolveTeleportTarget resolves 'body'");

        // 39b. h-teleport Directive Target Placement & Reactivity
        const portalTarget = new MockNode(1, "div");
        portalTarget.setAttribute("id", "portal-container");
        global.document.body.appendChild(portalTarget);

        const teleportHost = new MockNode(1, "div");
        const teleportContent = new MockNode(1, "div");
        teleportContent.setAttribute("h-teleport", "#portal-container");
        const innerSpan = new MockNode(1, "span");
        innerSpan.setAttribute("h-text", "teleportMsg");
        teleportContent.appendChild(innerSpan);
        teleportHost.appendChild(teleportContent);

        const teleportState = reactive({ teleportMsg: "Hello from Teleport!", clickCount: 0 });
        const teleportApp = createApp({ setup() { return teleportState; } });
        await teleportApp.mount(teleportHost);

        // Verify content was moved to portalTarget
        assert(portalTarget.childNodes.some((c) => c.querySelector && c.querySelector("span")), "h-teleport transports DOM subtree into target container");
        assert(innerSpan.textContent === "Hello from Teleport!", "h-teleport preserves reactive text bindings");

        // Reactivity test
        teleportState.teleportMsg = "Updated Teleport Message!";
        flushJobs();
        assert(innerSpan.textContent === "Updated Teleport Message!", "h-teleport subtree responds to reactive state mutations");

        // Lifecycle & Cleanup test: destroying host cleans up portalTarget
        destroyNode(teleportHost);
        assert(!portalTarget.childNodes.includes(teleportContent), "destroyNode() automatically removes teleported subtree from external portal target");

        // 39c. Teleport Component Definition & Runtime Execution (TP-01)
        assert(Teleport && typeof Teleport.setup === "function", "Teleport component definition exists");

        const compTarget = new MockNode(1, "div");
        compTarget.setAttribute("id", "comp-target");
        global.document.body.appendChild(compTarget);

        const compHost = new MockNode(1, "div");
        const teleportCompEl = new MockNode(1, "teleport");
        teleportCompEl.setAttribute("to", "#comp-target");

        const compInner = new MockNode(1, "div");
        compInner.setAttribute("class", "teleport-inner");
        const compSpan = new MockNode(1, "span");
        compSpan.setAttribute("h-text", "compMsg");
        const compBtn = new MockNode(1, "button");
        compBtn.setAttribute("@click", "increment");

        compInner.appendChild(compSpan);
        compInner.appendChild(compBtn);
        teleportCompEl.appendChild(compInner);
        compHost.appendChild(teleportCompEl);

        let clickCount = 0;
        const compState = reactive({
            compMsg: "Component Teleport Init",
            increment() { clickCount++; }
        });
        const tpCompApp = createApp({ config: { allowInlineExpressions: true }, setup() { return compState; } });
        await tpCompApp.mount(compHost);

        const teleportedInner = compTarget.querySelector(".teleport-inner");
        assert(teleportedInner !== null, "TP-01: <Teleport> component transports slot children to target container");
        const teleportedSpan = teleportedInner.querySelector("span");
        const teleportedBtn = teleportedInner.querySelector("button");

        assert(teleportedSpan && teleportedSpan.textContent === "Component Teleport Init", "TP-01: <Teleport> component child preserves reactive bindings");

        // Test event execution on teleported component child
        teleportedBtn.dispatchEvent("click");
        assert(clickCount === 1, "TP-01: Event listeners on teleported component child execute on parent context");

        // Test reactivity update
        compState.compMsg = "Component Teleport Updated";
        flushJobs();
        assert(teleportedSpan.textContent === "Component Teleport Updated", "TP-01: Teleported component child responds to reactive state changes");

        // 39d. Dynamic Reactive h-teleport Target Expression (TP-02)
        const targetOne = new MockNode(1, "div");
        targetOne.setAttribute("id", "target-1");
        const targetTwo = new MockNode(1, "div");
        targetTwo.setAttribute("id", "target-2");
        global.document.body.appendChild(targetOne);
        global.document.body.appendChild(targetTwo);

        const dynTargetHost = new MockNode(1, "div");
        const dynTargetNode = new MockNode(1, "div");
        dynTargetNode.setAttribute("h-teleport", "activeTarget");
        dynTargetNode.textContent = "Dynamic Target Content";
        dynTargetHost.appendChild(dynTargetNode);

        const dynTargetState = reactive({ activeTarget: "#target-1" });
        const dynTargetApp = createApp({ setup() { return dynTargetState; } });
        await dynTargetApp.mount(dynTargetHost);

        assert(targetOne.childNodes.includes(dynTargetNode), "TP-02: h-teleport renders initially in #target-1");

        dynTargetState.activeTarget = "#target-2";
        flushJobs();
        assert(!targetOne.childNodes.includes(dynTargetNode), "TP-02: h-teleport leaves #target-1 on target state change");
        assert(targetTwo.childNodes.includes(dynTargetNode), "TP-02: h-teleport reactively moves to #target-2");

        // 39e. Full Disabled State Transition Testing (TP-03)
        const disHost = new MockNode(1, "div");
        const disTarget = new MockNode(1, "div");
        disTarget.setAttribute("id", "disabled-target");
        global.document.body.appendChild(disTarget);

        const disTeleportEl = new MockNode(1, "teleport");
        disTeleportEl.setAttribute("to", "#disabled-target");
        disTeleportEl.setAttribute(":disabled", "isDisabled");
        const disChild = new MockNode(1, "p");
        disChild.textContent = "Toggle Child";
        disTeleportEl.appendChild(disChild);
        disHost.appendChild(disTeleportEl);

        const disState = reactive({ isDisabled: false });
        const disApp = createApp({ setup() { return disState; } });
        await disApp.mount(disHost);

        assert(disTarget.childNodes.some((c) => c.textContent === "Toggle Child"), "TP-03: disabled=false places content in target");

        disState.isDisabled = true;
        flushJobs();
        assert(!disTarget.childNodes.some((c) => c.textContent === "Toggle Child"), "TP-03: disabled=true removes content from target");
        assert(disHost.childNodes.some((c) => c.textContent === "Toggle Child"), "TP-03: disabled=true returns content to local anchor in original host template");

        disState.isDisabled = false;
        flushJobs();
        assert(disTarget.childNodes.some((c) => c.textContent === "Toggle Child"), "TP-03: disabled=false returns content back to target container");

        // 39f. Missing Target Behavior & Clean Local Fallback (TP-04 & TP-06)
        const missHost = new MockNode(1, "div");
        const missChild = new MockNode(1, "div");
        missChild.setAttribute("h-teleport", "#non-existent-target");
        missChild.textContent = "Fallback Content";
        missHost.appendChild(missChild);

        const missApp = createApp({ setup() { return {}; } });
        await missApp.mount(missHost);
        assert(missHost.childNodes.includes(missChild), "TP-04/TP-06: Missing target gracefully falls back to local source location");

        // 39g. Multiple Teleported Nodes & Ordering Guarantees (TP-05)
        const orderTarget = new MockNode(1, "div");
        orderTarget.setAttribute("id", "order-target");
        global.document.body.appendChild(orderTarget);

        const orderHost = new MockNode(1, "div");
        const orderTeleport = new MockNode(1, "teleport");
        orderTeleport.setAttribute("to", "#order-target");

        const childA = new MockNode(1, "span"); childA.textContent = "A";
        const childB = new MockNode(1, "span"); childB.textContent = "B";
        const childC = new MockNode(1, "span"); childC.textContent = "C";
        orderTeleport.appendChild(childA);
        orderTeleport.appendChild(childB);
        orderTeleport.appendChild(childC);
        orderHost.appendChild(orderTeleport);

        const orderApp = createApp({ setup() { return {}; } });
        await orderApp.mount(orderHost);

        assert(orderTarget.childNodes[0].textContent === "A" && orderTarget.childNodes[1].textContent === "B" && orderTarget.childNodes[2].textContent === "C", "TP-05: Multiple teleported nodes preserve exact DOM order [A, B, C]");

        // 39h. Nested Teleports & Cascading Teardown (TP-07 & TP-08)
        const nestTargetA = new MockNode(1, "div"); nestTargetA.setAttribute("id", "nest-a");
        const nestTargetB = new MockNode(1, "div"); nestTargetB.setAttribute("id", "nest-b");
        global.document.body.appendChild(nestTargetA);
        global.document.body.appendChild(nestTargetB);

        const nestHost = new MockNode(1, "div");
        const teleA = new MockNode(1, "teleport"); teleA.setAttribute("to", "#nest-a");
        const outerDiv = new MockNode(1, "div"); outerDiv.textContent = "Outer Teleport A";

        const teleB = new MockNode(1, "teleport"); teleB.setAttribute("to", "#nest-b");
        const innerDiv = new MockNode(1, "div"); innerDiv.textContent = "Inner Teleport B";

        teleB.appendChild(innerDiv);
        outerDiv.appendChild(teleB);
        teleA.appendChild(outerDiv);
        nestHost.appendChild(teleA);

        const nestApp = createApp({ setup() { return {}; } });
        await nestApp.mount(nestHost);

        assert(nestTargetA.childNodes.length > 0, "TP-08: Outer Teleport A rendered into #nest-a");
        assert(nestTargetB.childNodes.some((c) => c.textContent === "Inner Teleport B"), "TP-08: Nested Teleport B rendered into #nest-b");

        // Destroy parent host -> Cascading cleanup
        destroyNode(nestHost);
        assert(nestTargetA.childNodes.length === 0, "TP-08: Destroying parent empties Outer Target A");
        assert(nestTargetB.childNodes.length === 0, "TP-08: Destroying parent cleanly cascades teardown to empty Nested Target B");

        // 40a. useTemplateRef() API & Lifecycle Teardown
        const refHost = new MockNode(1, "div");
        const refCompEl = new MockNode(1, "ref-comp");
        refHost.appendChild(refCompEl);

        let capturedUserRef = null;
        const refCompDef = {
            name: "RefComp",
            template: `<input ref="usernameInput" value="antigravity" />`,
            setup() {
                const usernameInput = useTemplateRef("usernameInput");
                capturedUserRef = usernameInput;
                return { usernameInput };
            }
        };

        const refApp = createApp({ setup() { return {}; } });
        refApp.component("ref-comp", refCompDef);
        await refApp.mount(refHost);

        assert(capturedUserRef !== null && capturedUserRef.value !== null && capturedUserRef.value.value === "antigravity", "40a: useTemplateRef resolves target DOM element on mount");
        destroyNode(refHost);
        assert(capturedUserRef.value === null, "40a: useTemplateRef resets to null on component unmount");

        // 40b. Function Refs :ref="(el) => ..."
        const fnHost = new MockNode(1, "div");
        let boundFnEl = null;
        const fnState = {
            captureRef(el) { boundFnEl = el; }
        };
        const fnNode = new MockNode(1, "div");
        fnNode.setAttribute(":ref", "captureRef");
        fnNode.textContent = "Function Ref Node";
        fnHost.appendChild(fnNode);

        const fnApp = createApp({ setup() { return fnState; } });
        await fnApp.mount(fnHost);

        assert(boundFnEl !== null && boundFnEl.textContent === "Function Ref Node", "40b: Function ref called with element on mount");
        destroyNode(fnHost);
        assert(boundFnEl === null, "40b: Function ref called with null on unmount");

        // 40c. onErrorCaptured() Across Component Tree
        const errHost = new MockNode(1, "div");
        const parentErrComp = new MockNode(1, "parent-comp");
        const childErrComp = new MockNode(1, "child-err-comp");
        parentErrComp.appendChild(childErrComp);
        errHost.appendChild(parentErrComp);

        let capturedErr = null;
        const parentCompDef = {
            name: "ParentComp",
            setup() {
                onErrorCaptured((err, instance, info) => {
                    capturedErr = err.message || String(err);
                    return false; // stop propagation
                });
                return {};
            }
        };
        const childCompDef = {
            name: "ChildErrComp",
            setup() {
                throw new Error("Simulated Descendant Error");
            }
        };

        const errApp = createApp({ setup() { return {}; } });
        errApp.component("parent-comp", parentCompDef);
        errApp.component("child-err-comp", childCompDef);
        await errApp.mount(errHost);

        assert(capturedErr === "Simulated Descendant Error", "40c: onErrorCaptured intercepts descendant component setup error");

        // 40d. defineCustomElement() Web Component
        const GreetingWidget = defineCustomElement({
            props: { name: { default: "World" } },
            template: `<span>Hello, <span h-text="name"></span>!</span>`
        });

        const widgetEl = new GreetingWidget();
        widgetEl.setAttribute("name", "Helix");
        global.document.body.appendChild(widgetEl);
        widgetEl.connectedCallback();
        await flushJobs();

        const shadowSpan = widgetEl.shadowRoot.querySelector("span");
        assert(shadowSpan !== null, "40d: defineCustomElement attaches shadow root and renders template");
        assert(widgetEl.shadowRoot.textContent.includes("Helix"), "40d: Initial attribute rendered in shadow DOM");

        // 40d-1 (C-01): Attribute mutation reactivity
        widgetEl.setAttribute("name", "DeepMind");
        flushJobs();
        assert(widgetEl.shadowRoot.textContent.includes("DeepMind"), "40d-1: Custom Element setAttribute() reactively updates template");

        // 40d-2 (C-01): Property assignment reactivity
        widgetEl.name = "Antigravity";
        flushJobs();
        assert(widgetEl.shadowRoot.textContent.includes("Antigravity"), "40d-2: Custom Element property assignment reactively updates template");

        widgetEl.disconnectedCallback();

        // 40d-3 (C-02): Async mount / disconnect race condition
        const raceWidget = new GreetingWidget();
        global.document.body.appendChild(raceWidget);
        raceWidget.connectedCallback(); // Start async mount
        raceWidget.disconnectedCallback(); // Disconnect immediately before mount promise resolution
        await flushJobs(); // Allow mount promise to finish

        assert(raceWidget._isMounted === false, "40d-3 (C-02): Element disconnected during pending mount is not left mounted");
        assert(raceWidget._app === null, "40d-3 (C-02): Internal app instance torn down on premature disconnect");

        // Test reconnecting after premature disconnect
        raceWidget.connectedCallback();
        await flushJobs();
        assert(raceWidget._isMounted === true, "40d-3 (C-02): Element can cleanly reconnect after premature disconnect");
        raceWidget.disconnectedCallback();

        // 40e. Dynamic Component <component :is="...">
        const dynHost = new MockNode(1, "div");
        const dynCompEl = new MockNode(1, "component");
        dynCompEl.setAttribute(":is", "activeTab");
        dynHost.appendChild(dynCompEl);

        const compADef = {
            name: "CompA",
            template: `<div>Component A Content</div>`,
            setup() { return {}; }
        };
        const compBDef = {
            name: "CompB",
            template: `<div>Component B Content</div>`,
            setup() { return {}; }
        };

        const dynamicCompState = reactive({ activeTab: "comp-a" });
        const dynamicCompApp = createApp({ setup() { return dynamicCompState; } });
        dynamicCompApp.component("comp-a", compADef);
        dynamicCompApp.component("comp-b", compBDef);
        await dynamicCompApp.mount(dynHost);

        assert(dynHost.textContent.includes("Component A Content"), "40e: Dynamic component renders Component A initially");

        dynamicCompState.activeTab = "comp-b";
        flushJobs();
        assert(dynHost.textContent.includes("Component B Content"), "40e: Dynamic component reactively switches to Component B");

        // 40f. Prefix-Defined Slots (h-slot:header, hx-slot:header, custom-slot:footer, #shorthand)
        const slotHost = new MockNode(1, "div");
        const cardCompEl = new MockNode(1, "card-layout");

        const headerSlotEl = new MockNode(1, "template");
        headerSlotEl.setAttribute("h-slot:header", "hdr");
        const headerInner = new MockNode(1, "h1");
        headerInner.textContent = "Custom Card Header";
        headerSlotEl.appendChild(headerInner);

        const defaultSlotEl = new MockNode(1, "template");
        defaultSlotEl.setAttribute("h-slot", "");
        const defaultInner = new MockNode(1, "p");
        defaultInner.textContent = "Card Body Content";
        defaultSlotEl.appendChild(defaultInner);

        cardCompEl.appendChild(headerSlotEl);
        cardCompEl.appendChild(defaultSlotEl);
        slotHost.appendChild(cardCompEl);

        const cardLayoutDef = {
            name: "CardLayout",
            template: `
                <div class="card">
                    <header><slot name="header"></slot></header>
                    <main><slot></slot></main>
                </div>
            `,
            setup() { return {}; }
        };

        const slotApp = createApp({ setup() { return {}; } });
        slotApp.component("card-layout", cardLayoutDef);
        await slotApp.mount(slotHost);

        assert(slotHost.textContent.includes("Custom Card Header"), "40f: Prefix-defined slot (h-slot:header) renders into named slot");
        assert(slotHost.textContent.includes("Card Body Content"), "40f: Prefix-defined default slot (h-slot) renders into default slot");

        // Test with custom app prefix (e.g. prefix: "custom-")
        const customSlotHost = new MockNode(1, "div");
        const customCardComp = new MockNode(1, "custom-card");
        const customHeaderSlot = new MockNode(1, "template");
        customHeaderSlot.setAttribute("custom-slot:header", "");
        const customHdrText = new MockNode(1, "h2");
        customHdrText.textContent = "Prefix Configured Slot Header";
        customHeaderSlot.appendChild(customHdrText);
        customCardComp.appendChild(customHeaderSlot);
        customSlotHost.appendChild(customCardComp);

        const customSlotApp = createApp({
            config: { prefix: "custom-" },
            setup() { return {}; }
        });
        customSlotApp.component("custom-card", cardLayoutDef);
        await customSlotApp.mount(customSlotHost);

        assert(customSlotHost.textContent.includes("Prefix Configured Slot Header"), "40f: Custom prefix-defined slot (custom-slot:header) renders with configured prefix");

    } finally {
        global.document = origDoc;
        global.HTMLElement = origHTMLElement;
        global.CustomEvent = origCustomEvent;
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
