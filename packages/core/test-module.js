import Helix, {
    createApp,
    module,
    hasModule,
    modules,
    config,
    nextTick
} from './src/index.js';

console.log("=========================================");
console.log(" Running Helix.module Comprehensive Tests");
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

// Mock DOM Node Implementation
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
            remove: (...cls) => classes.delete(c),
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
        let _textContent = (nodeType === 3 || nodeType === 8) ? tagName : "";
        Object.defineProperty(this, "textContent", {
            get: () => (this.childNodes.length > 0 ? this.childNodes.map((c) => c.textContent || "").join("") : _textContent),
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
        return Object.entries(this._attributes).map(([name, value]) => ({ name, value }));
    }
    getAttribute(name) { return this._attributes[name] !== undefined ? this._attributes[name] : null; }
    setAttribute(name, val) {
        this._attributes[name] = String(val);
        if (name === 'class') this.className = val;
    }
    removeAttribute(name) { delete this._attributes[name]; }
    hasAttribute(name) { return this._attributes[name] !== undefined; }
    get firstChild() { return this.childNodes[0] || null; }
    appendChild(child) {
        if (child.nodeType === 11) {
            [...child.childNodes].forEach(c => this.appendChild(c));
            return child;
        }
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }
    insertBefore(newChild, refChild) {
        if (newChild.nodeType === 11) {
            [...newChild.childNodes].forEach(c => this.insertBefore(c, refChild));
            return newChild;
        }
        if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
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
    remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
        const results = [];
        const match = (node) => {
            if (sel === '*' || (node.tagName && node.tagName.toLowerCase() === sel.toLowerCase())) {
                results.push(node);
            } else if (sel.startsWith('#') && node.getAttribute('id') === sel.slice(1)) {
                results.push(node);
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
            this.listeners[evt] = this.listeners[evt].filter(l => (typeof l === 'function' ? l !== fn : l.fn !== fn));
        }
    }
    dispatchEvent(evt) {
        const evtObj = typeof evt === "string" ? { type: evt } : evt;
        const fns = [...(this.listeners[evtObj.type] || [])];
        fns.forEach(entry => (typeof entry === 'function' ? entry : entry.fn)(evtObj));
    }
}

// Setup mock document
const mockBody = new MockNode(1, "body");
global.document = {
    body: mockBody,
    createComment: (text) => new MockNode(8, text),
    createDocumentFragment: () => new MockNode(11, "#document-fragment"),
    createTextNode: (text) => new MockNode(3, text),
    createElement: (tag) => new MockNode(1, tag),
    getElementById: (id) => mockBody.querySelector(`#${id}`),
    querySelector: (sel) => mockBody.querySelector(sel),
    querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
    addEventListener: () => {},
    removeEventListener: () => {}
};

async function runTests() {
    // ----------------------------------------------------
    // Test 1: Register and retrieve modules from other modules
    // ----------------------------------------------------
    Helix.module('cart', {
        price: 1000,
        total() {
            const tax = this.$app.module('tax');
            return this.price + tax.calculate(this.price);
        }
    });

    Helix.module('tax', {
        rate: 18,
        calculate(amount) {
            return amount * this.rate / 100;
        }
    });

    assert(Helix.hasModule('cart') === true, "Helix.hasModule('cart') returns true");
    assert(Helix.hasModule('tax') === true, "Helix.hasModule('tax') returns true");

    const cart = Helix.module('cart');
    const tax = Helix.module('tax');

    assert(tax.rate === 18, "tax.rate is initialized to 18");
    assert(tax.calculate(1000) === 180, "tax.calculate(1000) returns 180");
    assert(cart.total() === 1180, "cart.total() calculates 1000 + 180 = 1180 via this.$app.module('tax')");

    // Test mutating tax rate
    Helix.module('tax').rate = 12;
    assert(tax.rate === 12, "Helix.module('tax').rate updated to 12");
    assert(cart.total() === 1120, "cart.total() reactively updates to 1000 + 120 = 1120");

    // ----------------------------------------------------
    // Test 2: In-Template Direct Usage
    // ----------------------------------------------------
    const rootEl = new MockNode(1, "div");
    rootEl.setAttribute("id", "app");

    const pRate = new MockNode(1, "p");
    pRate.setAttribute("id", "tax-rate");
    const pRateText = new MockNode(3, "Tax rate: [[ tax.rate ]]%");
    pRate.appendChild(pRateText);

    const pAmount = new MockNode(1, "p");
    pAmount.setAttribute("id", "tax-amount");
    const pAmountText = new MockNode(3, "Tax amount: [[ tax.calculate(1000) ]]");
    pAmount.appendChild(pAmountText);

    rootEl.appendChild(pRate);
    rootEl.appendChild(pAmount);
    mockBody.appendChild(rootEl);

    const app = createApp({
        config: {
            delimiters: ['[[', ']]']
        }
    });
    await app.mount("#app");

    // Verify initial render
    assert(pRate.textContent.includes("Tax rate: 12%"), `Template resolved [[ tax.rate ]] directly: got "${pRate.textContent}"`);
    assert(pAmount.textContent.includes("Tax amount: 120"), `Template resolved [[ tax.calculate(1000) ]] directly: got "${pAmount.textContent}"`);

    // Mutate module rate
    Helix.module('tax').rate = 15;
    await nextTick();

    assert(pRate.textContent.includes("Tax rate: 15%"), `Template reactively updated [[ tax.rate ]] to 15%: got "${pRate.textContent}"`);
    assert(pAmount.textContent.includes("Tax amount: 150"), `Template reactively updated [[ tax.calculate(1000) ]] to 150: got "${pAmount.textContent}"`);

    // ----------------------------------------------------
    // Test 3: Component State Priority Over Module
    // ----------------------------------------------------
    const compRootEl = new MockNode(1, "div");
    compRootEl.setAttribute("id", "comp-app");

    const compP = new MockNode(1, "p");
    const compPText = new MockNode(3, "Rate: [[ tax.rate ]], ModuleRate: [[ $modules.tax.rate ]]");
    compP.appendChild(compPText);
    compRootEl.appendChild(compP);
    mockBody.appendChild(compRootEl);

    const compApp = createApp({
        tax: { rate: 7 }, // Local component state shadowing 'tax'
        config: {
            delimiters: ['[[', ']]']
        }
    });
    await compApp.mount("#comp-app");

    assert(compP.textContent.includes("Rate: 7"), `Component local state takes priority over module: got "${compP.textContent}"`);
    assert(compP.textContent.includes("ModuleRate: 15"), `$modules.tax explicitly resolves module: got "${compP.textContent}"`);

    // ----------------------------------------------------
    // Test 4: Factory Function Definition
    // ----------------------------------------------------
    Helix.module('factoryMod', (appCtx) => ({
        count: 5,
        double() {
            return this.count * 2;
        }
    }));

    const factoryMod = Helix.module('factoryMod');
    assert(factoryMod.count === 5, "Factory module initialized state");
    assert(factoryMod.double() === 10, "Factory module method works");
    factoryMod.count = 20;
    assert(factoryMod.double() === 40, "Factory module responds to mutations");

    // ----------------------------------------------------
    // Test 5: $reset() method
    // ----------------------------------------------------
    factoryMod.$reset();
    assert(factoryMod.count === 5, "factoryMod.$reset() restored count to initial definition value (5)");
    assert(factoryMod.double() === 10, "factoryMod.double() returns 10 after reset");

    // ----------------------------------------------------
    // Test 6: Module Lifecycle Hooks (mounted & destroy)
    // ----------------------------------------------------
    let hookMountedCalled = false;
    let hookDestroyCalled = false;

    Helix.module('lifecycleMod', {
        mounted() {
            hookMountedCalled = true;
        },
        destroy() {
            hookDestroyCalled = true;
        }
    });

    const lifecycleRoot = new MockNode(1, "div");
    lifecycleRoot.setAttribute("id", "lifecycle-app");
    mockBody.appendChild(lifecycleRoot);

    const lcApp = createApp();
    lcApp.module('lifecycleMod'); // resolve/attach module
    await lcApp.mount("#lifecycle-app");

    assert(hookMountedCalled === true, "Module mounted() hook executed on app.mount()");

    lcApp.unmount();
    assert(hookDestroyCalled === true, "Module destroy() hook executed on app.unmount()");

    // ----------------------------------------------------
    // Test 7: App-Scoped Module Isolation
    // ----------------------------------------------------
    const isoRoot = new MockNode(1, "div");
    isoRoot.setAttribute("id", "iso-app");
    mockBody.appendChild(isoRoot);

    const isoApp = createApp();
    isoApp.module('tax', {
        rate: 50,
        calculate(amount) {
            return amount * 0.5;
        }
    });

    assert(isoApp.module('tax').rate === 50, "App-scoped tax module rate is 50");
    assert(Helix.module('tax').rate === 15, "Global tax module rate remains 15");

    // ----------------------------------------------------
    // Test 8: Factory Parameter Destructuring ({ $fetch, $notify })
    // ----------------------------------------------------
    const mockFetchLog = [];
    const mockNotifyLog = [];
    const mockFetch = {
        post: (url) => { mockFetchLog.push(url); return Promise.resolve({ ok: true }); }
    };
    const mockNotify = {
        toast: (msg) => { mockNotifyLog.push(msg); }
    };
    Helix.$fetch = mockFetch;
    Helix.$notify = mockNotify;

    Helix.module('discounts', ({ $fetch, $notify }) => ({
        async apply() {
            await $fetch.post('/apply');
            $notify.toast('Applied!');
            return true;
        }
    }));

    const discounts = Helix.module('discounts');
    const discountRes = await discounts.apply();
    assert(discountRes === true, "discounts.apply() via factory destructuring returned true");
    assert(mockFetchLog.includes('/apply'), "$fetch.post('/apply') was executed");
    assert(mockNotifyLog.includes('Applied!'), "$notify.toast('Applied!') was executed");

    // ----------------------------------------------------
    // Test 9: Instance Prototype Delegation (this.$fetch, this.$notify)
    // ----------------------------------------------------
    Helix.module('promos', {
        async redeem() {
            await this.$fetch.post('/redeem');
            this.$notify.toast('Redeemed!');
            return 100;
        }
    });

    const promos = Helix.module('promos');
    const promoRes = await promos.redeem();
    assert(promoRes === 100, "promos.redeem() returned 100");
    assert(mockFetchLog.includes('/redeem'), "this.$fetch.post('/redeem') was executed");
    assert(mockNotifyLog.includes('Redeemed!'), "this.$notify.toast('Redeemed!') was executed");

    // ----------------------------------------------------
    // Test 10: Explicit Inter-Module Communication (this.$app.module('tax'))
    // ----------------------------------------------------
    Helix.module('cart2', {
        calc() {
            const taxMod = this.$app.module('tax');
            return taxMod.calculate(100);
        }
    });
    const cart2 = Helix.module('cart2');
    assert(cart2.calc() === 15, "Explicit inter-module this.$app.module('tax') works (100 * 0.15 = 15)");

    // ----------------------------------------------------
    // Test 11: Global Shortcut Mirroring (globalThis.$fetch, globalThis.$notify)
    // ----------------------------------------------------
    Helix.syncPluginShortcuts();
    assert(globalThis.$fetch === mockFetch, "globalThis.$fetch correctly mirrored Helix.$fetch");
    assert(globalThis.$notify === mockNotify, "globalThis.$notify correctly mirrored Helix.$notify");

    Helix.module('bareDemo', {
        async run() {
            await $fetch.post('/bare');
            $notify.toast('Bare!');
            return 'done';
        }
    });
    const bareRes = await Helix.module('bareDemo').run();
    assert(bareRes === 'done', "bareDemo.run() returned 'done'");
    assert(mockFetchLog.includes('/bare'), "Bare $fetch.post('/bare') executed via global shortcut");
    assert(mockNotifyLog.includes('Bare!'), "Bare $notify.toast('Bare!') executed via global shortcut");

    console.log("=========================================");
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log("=========================================");
}

runTests();
