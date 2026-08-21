import { createApp, ref, reactive, effect, computed, isRef } from '../core/src/index.js';
import HelixValidationPlugin, { field, form, equalto, required, email, minLength } from './src/index.js';
import { parseDataHx, bindFieldEl, scanForms } from './src/shared/manager.js';
import { getCurrentContext } from './src/core/context.js';

let passed = 0;
let total = 0;

function assert(condition, msg) {
    total++;
    if (!condition) {
        console.error(` ❌ FAIL: ${msg}`);
        throw new Error(msg);
    }
    passed++;
    console.log(` ✅ PASS: ${msg}`);
}

console.log("=========================================");
console.log(" Running Parsley-Style Helix Validation Tests");
console.log("=========================================\n");

// Setup Mock DOM
class MockElement {
    constructor(tagName = 'DIV') {
        this.nodeType = 1;
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.parentNode = null;
        this._attributes = {};
        this.classList = new Set();
        this.classList.add = (c) => Set.prototype.add.call(this.classList, c);
        this.classList.remove = (c) => Set.prototype.delete.call(this.classList, c);
        this.classList.contains = (c) => Set.prototype.has.call(this.classList, c);
        this.classList.toggle = (c, force) => {
            if (force === undefined) {
                if (this.classList.contains(c)) { this.classList.remove(c); return false; }
                else { this.classList.add(c); return true; }
            }
            if (force) { this.classList.add(c); return true; }
            else { this.classList.remove(c); return false; }
        };
        this.style = {};
        this.listeners = {};
        this.value = '';
        this.type = 'text';
        this.checked = false;
        this.innerHTML = '';
        this.id = '';
    }

    get attributes() {
        return Object.entries(this._attributes).map(([name, value]) => ({ name, value }));
    }
    getAttribute(name) { return this._attributes[name] !== undefined ? this._attributes[name] : null; }
    setAttribute(name, val) { this._attributes[name] = String(val); if (name === 'id') this.id = String(val); if (name === 'type') this.type = String(val); }
    removeAttribute(name) { delete this._attributes[name]; }
    hasAttribute(name) { return this._attributes[name] !== undefined; }
    appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }
    removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx !== -1) this.childNodes.splice(idx, 1);
        child.parentNode = null;
        return child;
    }
    insertAdjacentElement(position, el) {
        if (position === 'afterend' && this.parentNode) {
            const idx = this.parentNode.childNodes.indexOf(this);
            if (idx !== -1) {
                this.parentNode.childNodes.splice(idx + 1, 0, el);
                el.parentNode = this.parentNode;
            }
        }
        return el;
    }
    get nextElementSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        for (let i = idx + 1; i < this.parentNode.childNodes.length; i++) {
            if (this.parentNode.childNodes[i].nodeType === 1) return this.parentNode.childNodes[i];
        }
        return null;
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
        const fns = this.listeners[evt.type] || [];
        fns.forEach(fn => fn({ target: this, ...evt }));
    }
    closest(selector) {
        let cur = this;
        while (cur) {
            if (cur.matches && cur.matches(selector)) return cur;
            cur = cur.parentNode;
        }
        return null;
    }
    matches(selector) {
        const sel = selector.trim();
        if (sel.includes(',')) {
            return sel.split(',').map(s => s.trim()).some(s => this.matches(s));
        }
        if (sel.startsWith('#')) return this.id === sel.slice(1);
        if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
        if (sel.startsWith('[') && sel.endsWith(']')) {
            const attr = sel.slice(1, -1);
            if (attr.includes('=')) {
                const [k, v] = attr.split('=').map(s => s.replace(/['"]/g, '').trim());
                return this.getAttribute(k) === v;
            }
            return this.hasAttribute(attr);
        }
        return this.tagName === sel.toUpperCase();
    }
    querySelectorAll(selector) {
        const res = [];
        const walk = (node) => {
            node.childNodes.forEach(child => {
                if (child.nodeType === 1) {
                    if (child.matches(selector)) res.push(child);
                    walk(child);
                }
            });
        };
        walk(this);
        return res;
    }
    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all.length ? all[0] : null;
    }
}

const mockDoc = new MockElement('HTML');
const mockBody = new MockElement('BODY');
mockDoc.appendChild(mockBody);
global.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        const found = mockDoc.querySelectorAll('#' + id);
        return found.length ? found[0] : null;
    },
    querySelector: (sel) => mockDoc.querySelector(sel),
    querySelectorAll: (sel) => mockDoc.querySelectorAll(sel),
    body: mockBody,
    readyState: 'complete',
    addEventListener: () => {}
};

// Initialize Helix App with Validation Plugin
const app = createApp({});
app.use(HelixValidationPlugin, { trigger: 'blur' });
const validationCtx = getCurrentContext();

// 1. HTML5 Native Constraint Auto-Inference
const inputHtml5 = new MockElement('INPUT');
inputHtml5.setAttribute('name', 'emailField');
inputHtml5.setAttribute('type', 'email');
inputHtml5.setAttribute('required', '');
inputHtml5.setAttribute('minlength', '6');

const parsedHtml5 = parseDataHx(inputHtml5, validationCtx);
assert(parsedHtml5.ruleFns.length === 3, "Inferred 3 rules from HTML5 attributes (required, email, minlength)");
const ruleNames = parsedHtml5.ruleFns.map(fn => fn.meta?.name || fn._ruleName);
assert(ruleNames.includes('required'), "HTML5 required attribute auto-mapped to required rule");
assert(ruleNames.includes('email'), "HTML5 type='email' auto-mapped to email rule");
assert(ruleNames.includes('minLength'), "HTML5 minlength='6' auto-mapped to minLength rule");

// 2. Parsley Message Attributes & Overrides
const inputMsg = new MockElement('INPUT');
inputMsg.setAttribute('name', 'customMsgField');
inputMsg.setAttribute('required', '');
inputMsg.setAttribute('minlength', '5');
inputMsg.setAttribute('hx-msg-required', 'Please fill this mandatory field!');
inputMsg.setAttribute('data-parsley-minlength-message', 'Length is too short (min 5)');

const parsedMsg = parseDataHx(inputMsg, validationCtx);
const reqRule = parsedMsg.ruleFns.find(f => (f.meta?.name || f._ruleName) === 'required');
const minRule = parsedMsg.ruleFns.find(f => (f.meta?.name || f._ruleName) === 'minLength');

assert(reqRule('', null) === 'Please fill this mandatory field!', "hx-msg-required overrides default required message");
assert(minRule('abc', null) === 'Length is too short (min 5)', "data-parsley-minlength-message overrides default minLength message");

// 3. Parsley-style Custom Error Container & Class Target
const inputCustomTarget = new MockElement('INPUT');
inputCustomTarget.setAttribute('name', 'phone');
inputCustomTarget.setAttribute('required', '');
inputCustomTarget.setAttribute('hx-error-container', '#custom-errors');
inputCustomTarget.setAttribute('hx-class-target', '#input-wrapper');

const parsedTarget = parseDataHx(inputCustomTarget, validationCtx);
assert(parsedTarget.opts.errTarget === '#custom-errors', "hx-error-container parses custom error target");
assert(parsedTarget.opts.classHandler === '#input-wrapper', "hx-class-target parses class handler wrapper");

// 4. Equal-To Password Confirmation Rule (equalto:#pw)
const pwInput = new MockElement('INPUT');
pwInput.id = 'reg-password';
pwInput.value = 'Secret123';
mockBody.appendChild(pwInput);

const confirmRule = equalto('#reg-password');
assert(confirmRule('Secret123', null) === null, "equalto passes when values match");
assert(confirmRule('WrongSecret', null) !== null, "equalto fails when values do not match");

// Also test Parsley data-parsley-equalto attribute parsing
const confirmInput = new MockElement('INPUT');
confirmInput.setAttribute('data-parsley-equalto', '#reg-password');
const parsedConfirm = parseDataHx(confirmInput, validationCtx);
assert(parsedConfirm.ruleFns.length === 1, "data-parsley-equalto parsed into equalto rule function");

// 5. Multi-Step Form Groups & validateGroup()
const stepForm = form({
    step1_field: field('', [required], { group: 'step-1' }),
    step2_field: field('', [required], { group: 'step-2' })
});

assert(typeof stepForm.validateGroup === 'function', "form exposes validateGroup() API");

// Step 1 only
let step1Valid = await stepForm.validateGroup('step-1', { silent: true });
assert(step1Valid === false, "validateGroup('step-1') fails when step-1 field is empty");

stepForm.field('step1_field').set('Completed Step 1');
step1Valid = await stepForm.validateGroup('step-1', { silent: true });
assert(step1Valid === true, "validateGroup('step-1') passes when step-1 fields are valid (ignoring step-2)");

// 6. Inherited Group from Ancestor Element (<fieldset hx-group="step-1">)
const fieldset = new MockElement('FIELDSET');
fieldset.setAttribute('hx-group', 'step-wizard-1');
mockBody.appendChild(fieldset);

const groupChildInput = new MockElement('INPUT');
groupChildInput.setAttribute('name', 'wizardField');
groupChildInput.setAttribute('required', '');
fieldset.appendChild(groupChildInput);

const parsedGroupChild = parseDataHx(groupChildInput, validationCtx);
assert(parsedGroupChild.opts.group === 'step-wizard-1', "Input automatically inherits hx-group from parent fieldset");

// 7. Eager Validation Lifecycle
const eagerInput = new MockElement('INPUT');
eagerInput.setAttribute('name', 'eagerField');
eagerInput.setAttribute('hx-rule', 'required|email');
eagerInput.setAttribute('hx-trigger', 'eager');
mockBody.appendChild(eagerInput);

const eagerCtrl = field('', [required, email]);
bindFieldEl(eagerInput, eagerCtrl, { trigger: 'eager' }, validationCtx);

// Initial state: not touched, no errors displayed
assert(eagerCtrl.touched.value === false, "Eager field starts untouched");

// Trigger blur -> should validate and become invalid
eagerInput.value = 'invalid-email';
eagerInput.dispatchEvent({ type: 'blur' });
await new Promise(r => setTimeout(r, 10));

assert(eagerCtrl.touched.value === true, "Blur touches eager field");
assert(eagerCtrl.invalid.value === true, "Blur marks eager field invalid");

// 8. Custom prefix v-validate Directive
const dirInput = new MockElement('INPUT');
dirInput.setAttribute('name', 'directiveField');
dirInput.setAttribute('type', 'text');
mockBody.appendChild(dirInput);

// Test directive execution with binding
const validateDir = app.directive('validate') || app.directive('rule');
assert(!!validateDir, "validate directive registered on app");

validateDir.mounted(dirInput, {
    value: 'required|minLength:5',
    instance: null,
    app
});

assert(!!dirInput.__hxField, "v-validate directive binds __hxField onto DOM element");
const fieldRuleNames = dirInput.__hxField._rules.map(r => r.meta?.name || r._ruleName);
assert(fieldRuleNames.includes('required'), "__hxField has required rule from v-validate string");
assert(fieldRuleNames.includes('minLength'), "__hxField has minLength rule from v-validate string");

console.log("\n=========================================");
console.log(` Summary: ${passed}/${total} assertions passed`);
console.log("=========================================");
