/**
 * Helix Framework - Unified Bundle Test Suite
 * Validates All-in-One bundles, custom selective bundles, and runtime plugin auto-registration.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildBundle } from './scripts/bundle.js';
import { PLUGINS, PRESETS } from './scripts/bundle-meta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const bundleDir = path.join(rootDir, 'bundle');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(` ✅ PASS: ${message}`);
        totalPassed++;
    } else {
        console.error(` ❌ FAIL: ${message}`);
        totalFailed++;
    }
}

function assertStrictEqual(actual, expected, message) {
    if (actual === expected) {
        console.log(` ✅ PASS: ${message}`);
        totalPassed++;
    } else {
        console.error(` ❌ FAIL: ${message} (Expected: ${expected}, Actual: ${actual})`);
        totalFailed++;
    }
}

/**
 * Creates a sandboxed browser environment for testing bundle execution
 */
function createSandbox() {
    const listeners = new Map();
    const mockDocument = {
        nodeType: 9,
        addEventListener: (event, handler) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(handler);
        },
        removeEventListener: (event, handler) => {
            if (listeners.has(event)) {
                listeners.set(event, listeners.get(event).filter(h => h !== handler));
            }
        },
        createElement: (tag) => ({
            tagName: tag.toUpperCase(),
            nodeType: 1,
            id: '',
            dataset: {},
            style: {},
            classList: {
                add: () => {},
                remove: () => {},
                toggle: () => {},
                contains: () => false
            },
            setAttribute: () => {},
            getAttribute: () => null,
            removeAttribute: () => {},
            appendChild: (child) => child,
            removeChild: (child) => child,
            remove: () => {},
            contains: () => false,
            childNodes: [],
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: {
            nodeType: 1,
            style: {},
            appendChild: () => {},
            removeChild: () => {},
            contains: () => false
        },
        head: {
            nodeType: 1,
            appendChild: () => {},
            removeChild: () => {}
        }
    };

    const mockWindow = {
        document: mockDocument,
        addEventListener: (event, handler) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(handler);
        },
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        cancelAnimationFrame: (id) => clearTimeout(id),
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        console: {
            log: () => {},
            warn: () => {},
            error: () => {},
            info: () => {}
        },
        Swal: {
            mixin: () => ({ fire: () => Promise.resolve({ isConfirmed: true }) }),
            fire: () => Promise.resolve({ isConfirmed: true }),
            close: () => {},
            stopTimer: () => {},
            resumeTimer: () => {}
        },
        axios: {
            create: () => ({
                interceptors: { request: { use: () => {} }, response: { use: () => {} } },
                get: () => Promise.resolve({ data: {} }),
                post: () => Promise.resolve({ data: {} })
            })
        },
        CustomEvent: class CustomEvent {
            constructor(type, detail) {
                this.type = type;
                this.detail = detail;
            }
        }
    };

    mockWindow.window = mockWindow;
    mockWindow.globalThis = mockWindow;

    const ctx = vm.createContext(mockWindow);
    return { ctx, mockWindow };
}

async function runTests() {
    console.log('\n=========================================================');
    console.log(' 🚀 HELIX UNIFIED BUNDLE TEST SUITE');
    console.log('=========================================================\n');

    // ── Test 1: Build Full All-in-One Bundle ──
    console.log('--- 1. All-in-One Full Bundle (Core + 12 Plugins) ---');
    const allResult = await buildBundle({
        plugins: Object.keys(PLUGINS),
        outName: 'helix.all',
        outDir: bundleDir
    });

    assert(fs.existsSync(allResult.iife.path), 'helix.all.js file generated');
    assert(fs.existsSync(allResult.min.path), 'helix.all.min.js file generated');
    assert(fs.existsSync(allResult.esm.path), 'helix.all.esm.js file generated');
    assert(allResult.min.size < allResult.iife.size, 'Minified bundle is smaller than unminified');
    assert(allResult.min.gzip > 0, 'Gzip size computed accurately');

    // Execute in sandbox
    const { ctx, mockWindow } = createSandbox();
    const allCode = fs.readFileSync(allResult.iife.path, 'utf8');
    vm.runInContext(allCode, ctx);

    const Helix = mockWindow.Helix;
    assert(Helix !== undefined, 'Helix global object is defined');
    assert(typeof Helix.createApp === 'function', 'Helix.createApp is available');
    assert(typeof Helix.reactive === 'function', 'Helix.reactive is available');
    assert(typeof Helix.ref === 'function', 'Helix.ref is available');
    assert(typeof Helix.computed === 'function', 'Helix.computed is available');
    assert(typeof Helix.watch === 'function', 'Helix.watch is available');
    assert(typeof Helix.nextTick === 'function', 'Helix.nextTick is available');

    // Verify bundled plugins list
    assert(Array.isArray(Helix.__bundledPlugins), 'Helix.__bundledPlugins list exists');
    assertStrictEqual(Helix.__bundledPlugins.length, 12, 'All 12 plugins registered in bundle');
    assert(Helix.__isUnifiedBundle === true, 'Helix.__isUnifiedBundle flag is true');

    // Verify Plugin APIs on Core
    assert(Helix.$h !== undefined || Helix.helpers !== undefined, 'Helix Helpers ($h) attached');
    if (Helix.$h) {
        assertStrictEqual(Helix.$h.camelCase('hello_world'), 'helloWorld', '$h.camelCase works in bundle');
        assertStrictEqual(Helix.$h.formatNumber(12500), '12,500', '$h.formatNumber works in bundle');
        assert(Helix.$h.isEmail('admin@helix.dev'), '$h.isEmail works in bundle');
    }

    assert(Helix.$fetch !== undefined, 'Helix Fetch ($fetch) attached to bundle');
    assert(Helix.store !== undefined || Helix.defineStore !== undefined, 'Helix Store attached to bundle');
    assert(Helix.scope !== undefined, 'Helix Scope attached to bundle');
    assert(Helix.$notify !== undefined, 'Helix Notify attached to bundle');
    assert(Helix.$loader !== undefined, 'Helix Loader attached to bundle');
    assert(Helix.$tooltip !== undefined, 'Helix Tooltip attached to bundle');
    assert(Helix.$validation !== undefined, 'Helix Validation attached to bundle');
    assert(Helix.$model !== undefined, 'Helix Model attached to bundle');
    assert(Helix.$http !== undefined || Helix.axios !== undefined, 'Helix Axios attached to bundle');

    // ── Test 2: Build Selective Essentials Bundle ──
    console.log('\n--- 2. Selective Bundle (Essentials: Directives, Helpers, Fetch, Store) ---');
    const essResult = await buildBundle({
        plugins: PRESETS.essentials.plugins,
        outName: 'helix.essentials',
        outDir: bundleDir
    });

    assert(fs.existsSync(essResult.iife.path), 'helix.essentials.js file generated');
    assert(fs.existsSync(essResult.min.path), 'helix.essentials.min.js file generated');
    assert(essResult.min.size < allResult.min.size, 'Essentials bundle is significantly smaller than All-in-One');

    const { ctx: essCtx, mockWindow: essWin } = createSandbox();
    const essCode = fs.readFileSync(essResult.iife.path, 'utf8');
    vm.runInContext(essCode, essCtx);

    const EssHelix = essWin.Helix;
    assertStrictEqual(EssHelix.__bundledPlugins.length, 4, 'Exactly 4 plugins registered in essentials bundle');
    assert(EssHelix.__bundledPlugins.includes('directives'), 'Directives included in essentials');
    assert(EssHelix.__bundledPlugins.includes('helpers'), 'Helpers included in essentials');
    assert(EssHelix.__bundledPlugins.includes('fetch'), 'Fetch included in essentials');
    assert(EssHelix.__bundledPlugins.includes('store'), 'Store included in essentials');
    assert(!EssHelix.__bundledPlugins.includes('loader'), 'Loader excluded from essentials');
    assert(!EssHelix.__bundledPlugins.includes('tooltip'), 'Tooltip excluded from essentials');

    // ── Test 3: Build Custom Selective Bundle ──
    console.log('\n--- 3. Custom Selective Bundle (Helpers + Validation Only) ---');
    const customResult = await buildBundle({
        plugins: ['helpers', 'validation'],
        outName: 'helix.custom-test',
        outDir: bundleDir
    });

    const { ctx: custCtx, mockWindow: custWin } = createSandbox();
    const custCode = fs.readFileSync(customResult.iife.path, 'utf8');
    vm.runInContext(custCode, custCtx);

    const CustHelix = custWin.Helix;
    assertStrictEqual(CustHelix.__bundledPlugins.length, 2, 'Exactly 2 plugins registered in custom bundle');
    assert(CustHelix.__bundledPlugins.includes('helpers'), 'Helpers present in custom bundle');
    assert(CustHelix.__bundledPlugins.includes('validation'), 'Validation present in custom bundle');
    assert(!CustHelix.__bundledPlugins.includes('fetch'), 'Fetch absent in custom bundle');

    // Clean up test file
    fs.unlinkSync(customResult.iife.path);
    fs.unlinkSync(customResult.min.path);
    fs.unlinkSync(customResult.esm.path);

    // Summary
    console.log('\n=========================================================');
    if (totalFailed === 0) {
        console.log(` 🎉 ALL BUNDLE TESTS PASSED: ${totalPassed}/${totalPassed} assertions`);
    } else {
        console.error(` ❌ TESTS FAILED: ${totalFailed} failure(s), ${totalPassed} passed`);
        process.exit(1);
    }
    console.log('=========================================================\n');
}

runTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
