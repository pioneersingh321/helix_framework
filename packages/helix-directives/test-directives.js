import HelixDirectivesPlugin from './src/index.js';
import { resolvePath } from './src/parser.js';

let total = 0;
let passed = 0;

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

// Full DOM mock supporting complete FOCUSABLE_SELECTOR
class MockDOMElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.nodeType = 1;
        this.childNodes = [];
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.listeners = {};
        this.value = '';
        this.textContent = '';
        this._attributes = {};
        this.scrollHeight = 200;
        this.offsetWidth = 100;
        this.offsetHeight = 50;
        this.offsetParent = {};
        this.inert = false;
        this.disabled = false;
        this.tabIndex = 0;

        const classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => classes.add(c)),
            remove: (...cls) => cls.forEach(c => classes.delete(c)),
            contains: (c) => classes.has(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (classes.has(c)) { classes.delete(c); return false; }
                    classes.add(c); return true;
                }
                if (force) { classes.add(c); return true; }
                classes.delete(c); return false;
            }
        };
    }

    setAttribute(name, val) { this._attributes[name] = String(val); }
    getAttribute(name) { return this._attributes[name] ?? null; }
    hasAttribute(name) { return name in this._attributes; }
    removeAttribute(name) { delete this._attributes[name]; }

    appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        if (child.nodeType === 1) this.children.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx !== -1) this.childNodes.splice(idx, 1);
        const cIdx = this.children.indexOf(child);
        if (cIdx !== -1) this.children.splice(cIdx, 1);
        child.parentNode = null;
        return child;
    }

    contains(other) {
        if (other === this) return true;
        let p = other ? other.parentNode : null;
        while (p) {
            if (p === this) return true;
            p = p.parentNode;
        }
        return false;
    }

    querySelectorAll(sel) {
        const results = [];
        const match = (node) => {
            if (node.nodeType !== 1) return;
            const tag = node.tagName.toLowerCase();
            const isDisabled = node.disabled || node.getAttribute('disabled') !== null;
            const isHiddenInput = tag === 'input' && node.getAttribute('type') === 'hidden';
            const tabIdx = node.getAttribute('tabindex');

            let matches = false;
            if (tag === 'input' && !isDisabled && !isHiddenInput) matches = true;
            else if ((tag === 'button' || tag === 'select' || tag === 'textarea') && !isDisabled) matches = true;
            else if (tag === 'a' && node.hasAttribute('href')) matches = true;
            else if (tag === 'iframe' || tag === 'object' || tag === 'embed') matches = true;
            else if (tabIdx !== null && tabIdx !== '-1') matches = true;
            else if (node.getAttribute('contenteditable') === 'true' || node.getAttribute('contenteditable') === '') matches = true;

            if (matches) results.push(node);
            node.childNodes.forEach(match);
        };
        this.childNodes.forEach(match);
        return results;
    }

    getClientRects() { return [{ width: this.offsetWidth, height: this.offsetHeight }]; }

    focus() {
        if (global.document) global.document.activeElement = this;
    }

    addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
    }

    removeEventListener(evt, fn) {
        if (this.listeners[evt]) {
            this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
        }
    }

    dispatchEvent(evt) {
        const evtObj = typeof evt === 'string' ? { type: evt } : evt;
        if (!evtObj.target) evtObj.target = this;
        const fns = [...(this.listeners[evtObj.type] || [])];
        fns.forEach(fn => fn(evtObj));
        return true;
    }
}

// Set up mock global environment
const mockBody = new MockDOMElement('body');
const docListeners = {};
global.document = {
    body: mockBody,
    activeElement: null,
    createElement: (tag) => new MockDOMElement(tag),
    addEventListener: (evt, fn) => {
        if (!docListeners[evt]) docListeners[evt] = [];
        docListeners[evt].push(fn);
    },
    removeEventListener: (evt, fn) => {
        if (docListeners[evt]) {
            docListeners[evt] = docListeners[evt].filter(f => f !== fn);
        }
    },
    dispatchEvent: (evt) => {
        const fns = [...(docListeners[evt.type] || [])];
        fns.forEach(f => f(evt));
    }
};

Object.defineProperty(global, 'navigator', {
    value: {
        clipboard: {
            writeText: async (text) => true
        }
    },
    configurable: true,
    writable: true
});

global.CustomEvent = class CustomEvent {
    constructor(type, opts = {}) {
        this.type = type;
        this.detail = opts.detail;
        this.bubbles = Boolean(opts.bubbles);
        this.cancelable = Boolean(opts.cancelable);
    }
};

// Create a mock reactive app
function createMockApp() {
    const directives = {};
    const effects = [];

    const app = {
        directive(name, def) {
            directives[name] = def;
        },
        removeDirective(name) {
            delete directives[name];
        },
        getDirective(name) {
            return directives[name];
        },
        effect(fn) {
            let running = true;
            const runner = () => { if (running) fn(); };
            effects.push(runner);
            runner();
            return {
                stop: () => { running = false; }
            };
        },
        config: {
            allowInlineExpressions: true
        }
    };
    return { app, directives, effects };
}

console.log("=========================================");
console.log(" Running Comprehensive Helix Directives Tests");
console.log("=========================================");

async function runTests() {
    // 1. Plugin installation and cleanup
    const { app, directives } = createMockApp();
    const uninstall = HelixDirectivesPlugin.install(app, { debug: false });
    assert(HelixDirectivesPlugin.name === 'directives', "Plugin name is 'directives'");
    assert(typeof directives.debounce === 'object', "Debounce directive installed");
    assert(typeof directives.collapse === 'object', "Collapse directive installed");
    assert(typeof directives.trap === 'object', "Trap directive installed");
    assert(typeof directives.clipboard === 'object', "Clipboard directive installed");
    assert(typeof directives.intersect === 'object', "Intersect directive installed");
    assert(app.$directives && app.$directives.names.includes('collapse'), "app.$directives exposed on install");

    uninstall();
    assert(Object.keys(directives).length === 0, "Uninstall cleanly removes all registered directives");
    assert(app.$directives === undefined, "Uninstall deletes app.$directives");

    // Re-install for feature testing
    HelixDirectivesPlugin.install(app, { debug: false });

    // 2. Debounce Directive
    console.log("\n--- Testing Debounce Directive ---");
    const debounceDir = directives.debounce;
    const debounceEl = new MockDOMElement('input');
    let debounceCallCount = 0;
    let debounceLastVal = null;
    const debounceCtxA = {
        handleSearch(val) {
            debounceCallCount++;
            debounceLastVal = val;
        }
    };
    let cleanupsDebounce = [];
    debounceDir.mounted(debounceEl, {
        value: "handleSearch($event.target.value)",
        arg: "input",
        ctx: debounceCtxA,
        trackCleanup: (fn) => cleanupsDebounce.push(fn)
    });

    debounceEl.dispatchEvent({ type: "input", target: { value: "h" } });
    debounceEl.dispatchEvent({ type: "input", target: { value: "he" } });
    debounceEl.dispatchEvent({ type: "input", target: { value: "helix" } });
    assert(debounceCallCount === 0, "Debounce prevents immediate execution on rapid events");

    await new Promise(r => setTimeout(r, 300));
    assert(debounceCallCount === 1, "Debounce executes callback once after timeout");
    assert(debounceLastVal === "helix", "Debounce resolves $event.target.value path");

    // Debounce updated: timer cancellation and fresh context
    let ctxBCalled = false;
    let ctxACalledAfterUpdate = false;
    debounceCtxA.saveData = () => { ctxACalledAfterUpdate = true; };
    const debounceCtxB = {
        saveData() { ctxBCalled = true; }
    };

    debounceDir.updated(debounceEl, {
        value: "saveData",
        arg: "input",
        ctx: debounceCtxA
    });
    debounceEl.dispatchEvent({ type: "input" });

    debounceDir.updated(debounceEl, {
        value: "saveData",
        arg: "input",
        ctx: debounceCtxB
    });

    await new Promise(r => setTimeout(r, 300));
    assert(ctxACalledAfterUpdate === false, "Debounce updated() cleanly cancels pending in-flight timer");
    assert(ctxBCalled === false, "Cancelled timer did not fire stale callback on new context");

    debounceEl.dispatchEvent({ type: "input" });
    await new Promise(r => setTimeout(r, 300));
    assert(ctxBCalled === true, "Fresh event executes handler resolved against new state.ctx");

    cleanupsDebounce.forEach(fn => fn());

    // 3. Collapse Directive
    console.log("\n--- Testing Collapse Directive ---");
    const collapseDir = directives.collapse;
    const collapseEl = new MockDOMElement('div');
    collapseEl.style.height = 'auto';
    collapseEl.style.overflow = 'visible';

    const collapseCtx = { isOpen: false };
    let cleanupsCollapse = [];
    collapseDir.mounted(collapseEl, {
        value: "isOpen",
        modifiers: ["duration.200ms", "min.20px"],
        ctx: collapseCtx,
        trackCleanup: (fn) => cleanupsCollapse.push(fn)
    });

    assert(collapseEl.style.height === '20px', "Collapse initially closed sets minHeight (20px)");
    assert(collapseEl.style.overflow === 'hidden', "Collapse initially closed sets overflow: hidden");
    assert(collapseEl.style.transitionDuration === '200ms', "Collapse parses duration modifier to 200ms");

    // Expand
    collapseCtx.isOpen = true;
    collapseDir.updated(collapseEl, {
        value: "isOpen",
        modifiers: ["duration.200ms", "min.20px"],
        ctx: collapseCtx
    });

    await new Promise(r => setTimeout(r, 50));
    assert(collapseEl.style.height === '200px', "Collapse expanding sets height to scrollHeight (200px)");

    await new Promise(r => setTimeout(r, 220));
    assert(collapseEl.style.height === '', "Collapse fully expanded clears fixed height style");
    assert(collapseEl.style.overflow === '', "Collapse fully expanded clears overflow style");

    // Collapse
    collapseCtx.isOpen = false;
    collapseDir.updated(collapseEl, {
        value: "isOpen",
        modifiers: ["duration.200ms", "min.20px"],
        ctx: collapseCtx
    });
    await new Promise(r => setTimeout(r, 50));
    assert(collapseEl.style.height === '20px', "Collapse closing animates to minHeight (20px)");

    // Test expression update in updated()
    collapseCtx.showAccordion = true;
    collapseDir.updated(collapseEl, {
        value: "showAccordion",
        modifiers: ["duration.100ms"],
        ctx: collapseCtx
    });
    await new Promise(r => setTimeout(r, 50));
    assert(collapseEl.style.transitionDuration === '100ms', "Collapse updated() modifies transition duration");

    // Cleanup restores original inline styles
    cleanupsCollapse.forEach(fn => fn());
    assert(collapseEl.style.height === 'auto', "Collapse cleanup restores original height style");
    assert(collapseEl.style.overflow === 'visible', "Collapse cleanup restores original overflow style");

    // 4. Trap Directive
    console.log("\n--- Testing Trap Directive ---");
    const trapDir = directives.trap;

    const appContainer = new MockDOMElement('div');
    const sidebarEl = new MockDOMElement('div');
    const modalA = new MockDOMElement('div');
    const inputA1 = new MockDOMElement('input');
    const selectA2 = new MockDOMElement('select'); // Full FOCUSABLE_SELECTOR support
    const modalB = new MockDOMElement('div');
    const textareaB1 = new MockDOMElement('textarea'); // Full FOCUSABLE_SELECTOR support
    const footerEl = new MockDOMElement('div');

    modalB.appendChild(textareaB1);
    modalA.appendChild(inputA1);
    modalA.appendChild(selectA2);
    modalA.appendChild(modalB);
    appContainer.appendChild(sidebarEl);
    appContainer.appendChild(modalA);
    mockBody.appendChild(appContainer);
    mockBody.appendChild(footerEl);

    const trapState = { showModalA: false, showModalB: false };
    let cleanupsTrapA = [];
    let cleanupsTrapB = [];

    trapDir.mounted(modalA, {
        value: "showModalA",
        modifiers: [], // initially mounted without noscroll/inert
        ctx: trapState,
        trackCleanup: (fn) => cleanupsTrapA.push(fn)
    });

    trapDir.mounted(modalB, {
        value: "showModalB",
        modifiers: ["noscroll", "inert"],
        ctx: trapState,
        trackCleanup: (fn) => cleanupsTrapB.push(fn)
    });

    // Open Trap A initially without inert/noscroll
    const prevFocused = new MockDOMElement('button');
    global.document.activeElement = prevFocused;

    trapState.showModalA = true;
    trapDir.updated(modalA, { value: "showModalA", modifiers: [], ctx: trapState });
    await new Promise(r => setTimeout(r, 30));

    assert(mockBody.style.overflow === '' || mockBody.style.overflow === undefined, "Trap A active without noscroll does not lock body scroll");
    assert(sidebarEl.inert === false, "Trap A active without inert does not mark background inert");

    // Dynamic modifier reconciliation: Add .noscroll and .inert while Trap A is ALREADY active!
    trapDir.updated(modalA, { value: "showModalA", modifiers: ["noscroll", "inert"], ctx: trapState });
    assert(mockBody.style.overflow === 'hidden', "Trap updated() dynamically applies noscroll modifier to active trap");
    assert(sidebarEl.inert === true, "Trap updated() dynamically applies inert modifier to active trap (isolates #sidebar)");
    assert(footerEl.inert === true, "Trap updated() dynamically applies inert modifier to active trap (isolates #footer)");

    // Open Nested Trap B
    trapState.showModalB = true;
    trapDir.updated(modalB, { value: "showModalB", modifiers: ["noscroll", "inert"], ctx: trapState });
    await new Promise(r => setTimeout(r, 30));

    assert(global.document.activeElement === textareaB1, "Trap B focuses its own focusable textarea child");
    assert(mockBody.style.overflow === 'hidden', "Trap B nested active keeps body scroll locked");

    // Close Nested Trap B
    trapState.showModalB = false;
    trapDir.updated(modalB, { value: "showModalB", modifiers: ["noscroll", "inert"], ctx: trapState });
    await new Promise(r => setTimeout(r, 30));

    assert(mockBody.style.overflow === 'hidden', "Closing nested Trap B keeps body scroll locked for Trap A");
    assert(sidebarEl.inert === true, "Closing nested Trap B keeps #sidebar inert owned by Trap A");
    assert(footerEl.inert === true, "Closing nested Trap B keeps #footer inert owned by Trap A");

    // Close Trap A
    trapState.showModalA = false;
    trapDir.updated(modalA, { value: "showModalA", modifiers: ["noscroll", "inert"], ctx: trapState });
    await new Promise(r => setTimeout(r, 30));

    assert(mockBody.style.overflow === '', "Closing all traps releases body scroll lock");
    assert(sidebarEl.inert === false, "Closing Trap A restores #sidebar inert to false");
    assert(footerEl.inert === false, "Closing Trap A restores #footer inert to false");
    assert(global.document.activeElement === prevFocused, "Closing Trap A restores focus to opener element");

    // Detached mount test (simulating hx-if dynamic rendering)
    const overlayDetached = new MockDOMElement('div');
    const modalDetached = new MockDOMElement('div');
    const closeBtnDetached = new MockDOMElement('button');
    modalDetached.appendChild(closeBtnDetached);
    overlayDetached.appendChild(modalDetached);
    // Note: overlayDetached is NOT yet in appContainer or mockBody when mounted() is called
    const detachedTrapState = { isOpen: true };
    let detachedCleanups = [];
    trapDir.mounted(modalDetached, {
        value: "isOpen",
        modifiers: ["noscroll", "inert"],
        ctx: detachedTrapState,
        trackCleanup: (fn) => detachedCleanups.push(fn)
    });
    // While detached, appContainer MUST NOT be made inert
    assert(appContainer.inert === false, "Trap mounted while detached from DOM does not erroneously mark parent container inert");
    // Now simulate DOM insertion (as hx-if does)
    appContainer.appendChild(overlayDetached);
    await new Promise(r => setTimeout(r, 40));
    assert(appContainer.inert === false, "Parent container remains accessible and not inert");
    assert(sidebarEl.inert === true, "Background elements outside modal are safely made inert once attached");
    assert(modalDetached.inert === false, "Modal itself is NOT inert and buttons are clickable");
    assert(closeBtnDetached.inert === false, "Close button inside modal is NOT inert");

    // Close detached trap
    detachedTrapState.isOpen = false;
    trapDir.updated(modalDetached, { value: "isOpen", modifiers: ["noscroll", "inert"], ctx: detachedTrapState });
    await new Promise(r => setTimeout(r, 30));
    assert(sidebarEl.inert === false, "Closing modal restores background elements");
    detachedCleanups.forEach(fn => fn());
    appContainer.removeChild(overlayDetached);

    // Tabindex restoration test when container has no focusable elements
    const emptyModal = new MockDOMElement('div');
    mockBody.appendChild(emptyModal);
    const emptyState = { active: true };
    let emptyCleanups = [];
    trapDir.mounted(emptyModal, {
        value: "active",
        ctx: emptyState,
        trackCleanup: (fn) => emptyCleanups.push(fn)
    });
    await new Promise(r => setTimeout(r, 30));
    assert(emptyModal.getAttribute('tabindex') === '-1', "Trap added tabindex='-1' to empty container");

    emptyState.active = false;
    trapDir.updated(emptyModal, { value: "active", ctx: emptyState });
    await new Promise(r => setTimeout(r, 30));
    assert(emptyModal.hasAttribute('tabindex') === false, "Trap deactivation cleanly removed added tabindex");

    cleanupsTrapA.forEach(fn => fn());
    cleanupsTrapB.forEach(fn => fn());
    emptyCleanups.forEach(fn => fn());

    // 5. Clipboard Directive
    console.log("\n--- Testing Clipboard Directive ---");
    const clipDir = directives.clipboard;
    const clipBtn = new MockDOMElement('button');
    let clipWritten = null;
    global.navigator.clipboard.writeText = async (text) => {
        clipWritten = text;
        return true;
    };

    let copiedEventFired = null;
    clipBtn.addEventListener('copied', (e) => {
        copiedEventFired = e;
    });

    let cleanupsClip = [];
    const clipCtxA = { shareUrl: "https://helixjs.org/docs" };
    clipDir.mounted(clipBtn, {
        value: "shareUrl",
        modifiers: ["class.copied-active", "duration.50ms"],
        ctx: clipCtxA,
        trackCleanup: (fn) => cleanupsClip.push(fn)
    });

    clipBtn.dispatchEvent({ type: "click" });
    await new Promise(r => setTimeout(r, 20));

    assert(clipWritten === "https://helixjs.org/docs", "Clipboard directive copies resolved context value");
    assert(clipBtn.classList.contains("copied-active"), "Clipboard directive adds configured feedback class");
    assert(copiedEventFired && copiedEventFired.detail && copiedEventFired.detail.text === "https://helixjs.org/docs", "Clipboard dispatches @copied CustomEvent");

    // While feedback class is active, update directive with new class and duration
    const clipCtxB = { newUrl: "https://github.com/helix-framework" };
    clipDir.updated(clipBtn, {
        value: "newUrl",
        modifiers: ["class.copied-new", "duration.200ms"],
        ctx: clipCtxB
    });

    assert(clipBtn.classList.contains("copied-active") === false, "Clipboard updated() clears in-flight reset timer and removes previous class");

    clipBtn.dispatchEvent({ type: "click" });
    await new Promise(r => setTimeout(r, 20));

    assert(clipWritten === "https://github.com/helix-framework", "Clipboard updated() hook dynamically updates bound expression & context");
    assert(clipBtn.classList.contains("copied-new"), "Clipboard updated() hook dynamically updates feedback class");

    cleanupsClip.forEach(fn => fn());

    // 6. Intersect Directive
    console.log("\n--- Testing Intersect Directive ---");
    const intersectDir = directives.intersect;
    let observerInstance = null;

    class MockIntersectionObserver {
        constructor(callback, options = {}) {
            this.callback = callback;
            this.options = options;
            this.observedElements = [];
            this.disconnected = false;
            observerInstance = this;
        }
        observe(el) { this.observedElements.push(el); }
        unobserve(el) { this.observedElements = this.observedElements.filter(e => e !== el); }
        disconnect() {
            this.disconnected = true;
            this.observedElements = [];
        }
        trigger(entries) {
            if (this.disconnected) return;
            const valid = entries.filter(e => this.observedElements.includes(e.target));
            if (valid.length > 0) this.callback(valid);
        }
    }

    global.IntersectionObserver = MockIntersectionObserver;

    // Test threshold percentage: .threshold.50 (0.50), .threshold.75 (0.75), .threshold.100 (1.0)
    const intersectEl = new MockDOMElement('div');
    let intersectCountA = 0;
    const intersectCtxA = {
        onVisibleA() { intersectCountA++; }
    };

    let cleanupsIntersect = [];
    intersectDir.mounted(intersectEl, {
        value: "onVisibleA",
        modifiers: ["threshold.50", "margin.-10px", "once"],
        ctx: intersectCtxA,
        trackCleanup: (fn) => cleanupsIntersect.push(fn)
    });

    assert(observerInstance !== null, "Intersect creates IntersectionObserver instance");
    assert(observerInstance.options.threshold === 0.5, "Threshold percentage: threshold.50 parses to 0.5");
    assert(observerInstance.options.rootMargin === '-10px', "Margin normalization: margin.-10px parses to '-10px'");

    // Trigger intersection #1
    observerInstance.trigger([{ target: intersectEl, isIntersecting: true, intersectionRatio: 0.8 }]);
    assert(intersectCountA === 1, "Intersect executes callback on visibility");
    assert(observerInstance.disconnected === true, "Intersect with .once modifier immediately disconnects observer");

    // Test intersect.updated() hook with multi-value margin and threshold.75
    let intersectCountB = 0;
    const intersectCtxB = {
        onLoadMore() { intersectCountB++; }
    };

    intersectDir.updated(intersectEl, {
        value: "onLoadMore",
        modifiers: ["threshold.75", "margin.10px_20px"],
        ctx: intersectCtxB
    });

    assert(observerInstance.disconnected === false, "Intersect updated() creates fresh observer");
    assert(observerInstance.options.threshold === 0.75, "Intersect updated() parses new threshold (0.75)");
    assert(observerInstance.options.rootMargin === '10px 20px', "Intersect updated() parses multi-value margin ('10px 20px')");

    observerInstance.trigger([{ target: intersectEl, isIntersecting: true, intersectionRatio: 0.8 }]);
    assert(intersectCountB === 1, "Intersect updated() executes new callback (onLoadMore)");

    // Test :leave modifier
    const leaveEl = new MockDOMElement('div');
    let leaveCount = 0;
    const leaveCtx = { onLeave() { leaveCount++; } };

    intersectDir.mounted(leaveEl, {
        value: "onLeave",
        arg: "leave",
        modifiers: [],
        ctx: leaveCtx,
        trackCleanup: (fn) => {}
    });

    observerInstance.trigger([{ target: leaveEl, isIntersecting: true, intersectionRatio: 1.0 }]);
    assert(leaveCount === 0, "Intersect :leave does not trigger when element is intersecting");

    observerInstance.trigger([{ target: leaveEl, isIntersecting: false, intersectionRatio: 0 }]);
    assert(leaveCount === 1, "Intersect :leave triggers when element leaves viewport");

    // Headless fallback test (IntersectionObserver undefined)
    delete global.IntersectionObserver;
    let fallbackCount = 0;
    const fallbackEl = new MockDOMElement('div');
    intersectDir.mounted(fallbackEl, {
        value: "onFallback",
        ctx: { onFallback() { fallbackCount++; } }
    });
    assert(fallbackCount === 0, "Intersect gracefully does nothing when IntersectionObserver is unsupported (does not falsely fake visibility)");

    // 7. Parser Defensive ResolvePath Test
    console.log("\n--- Testing Parser Defensive Fallbacks ---");
    const throwingApp = {
        resolvePath() { throw new Error("Simulated app.resolvePath syntax error"); }
    };
    const safeResolved = resolvePath(throwingApp, { user: { name: "Antigravity" } }, "user.name");
    assert(safeResolved === "Antigravity", "resolvePath catches app.resolvePath exceptions and safely falls back to manual resolution");

    console.log("\n=========================================");
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log("=========================================");
}

runTests();
