import HelixHelpersPlugin from './src/index.js';
import fs from 'fs';
import vm from 'vm';
import { createEventMethods } from './src/events.js';
import { createIdMethods } from './src/id.js';
import { createDomMethods } from './src/dom.js';
import { createTypeMethods } from './src/types.js';
import { createStringMethods } from './src/string.js';
import { createArrayMethods } from './src/array.js';
import { createObjectMethods } from './src/object.js';
import { createDateMethods } from './src/date.js';
import { createNumberMethods } from './src/number.js';
import { createValidationMethods } from './src/validation.js';
import { createDataMethods } from './src/data.js';
import { createAsyncMethods } from './src/async.js';

console.log("=========================================================");
console.log(" 🧪 Comprehensive Helix Helpers ($h) Test Suite");
console.log("=========================================================\n");

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (condition) {
        passed++;
        console.log(` ✅ PASS: ${message}`);
    } else {
        console.error(` ❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

// ═════════════════════════════════════════════════════════════════════
// 1. PLUGIN REGISTRATION & LIFECYCLE HOOKS
// ═════════════════════════════════════════════════════════════════════
console.log("--- 1. Plugin Registration & Lifecycle ---");
assert(HelixHelpersPlugin.name === 'helpers', "Plugin name is 'helpers'");
assert(typeof HelixHelpersPlugin.install === 'function', "Plugin exposes install function");

let providedH = null;
let providedHelper = null;
let namespaceH = null;
let eventEmitted = null;

const mockApp = {
    provide(key, val) {
        if (key === '$h') providedH = val;
        if (key === 'helper') providedHelper = val;
    },
    namespace(name, api) {
        if (name === 'helpers') namespaceH = api;
    },
    $bus: {
        emit(evt, payload) { eventEmitted = { evt, payload }; }
    }
};

const uninstall = HelixHelpersPlugin.install(mockApp, {});
assert(providedH !== null && providedHelper === providedH, "install() provides $h and helper");
assert(mockApp.$h === providedH, "install() assigns app.$h");
assert(namespaceH === providedH, "install() assigns app.namespace('helpers', H)");
assert(eventEmitted && eventEmitted.evt === 'plugin:helpers:installed', "install() emits plugin:helpers:installed event");

const $h = mockApp.$h;

// ═════════════════════════════════════════════════════════════════════
// 2. OBJECTS: CLONEDEEP & DEEP PATHS
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 2. Objects: cloneDeep & Deep Paths ---");

// Circular Array
const circularArr = [1, 2];
circularArr.push(circularArr);
const clonedArr = $h.cloneDeep(circularArr);
assert(clonedArr !== circularArr, "cloneDeep copies array instance");
assert(clonedArr[0] === 1 && clonedArr[1] === 2, "cloneDeep preserves array elements");
assert(clonedArr[2] === clonedArr, "cloneDeep correctly handles circular arrays without infinite recursion");

// Circular Map
const circularMap = new Map();
circularMap.set('key', 'value');
circularMap.set('self', circularMap);
const clonedMap = $h.cloneDeep(circularMap);
assert(clonedMap !== circularMap, "cloneDeep copies Map instance");
assert(clonedMap.get('key') === 'value', "cloneDeep preserves Map entries");
assert(clonedMap.get('self') === clonedMap, "cloneDeep correctly handles circular Map references");

// Circular Set
const circularSet = new Set();
circularSet.add(100);
circularSet.add(circularSet);
const clonedSet = $h.cloneDeep(circularSet);
assert(clonedSet !== circularSet, "cloneDeep copies Set instance");
assert(clonedSet.has(100), "cloneDeep preserves Set elements");
assert(clonedSet.has(clonedSet), "cloneDeep correctly handles circular Set references");

// Circular Object
const circularObj = { name: 'Alpha' };
circularObj.self = circularObj;
const clonedObj = $h.cloneDeep(circularObj);
assert(clonedObj !== circularObj, "cloneDeep copies Object instance");
assert(clonedObj.self === clonedObj, "cloneDeep correctly handles circular Object references");

// Property Descriptor Preservation on Objects
const objWithGetter = {
    _val: 42,
    get val() { return this._val; }
};
const clonedGetter = $h.cloneDeep(objWithGetter);
assert(clonedGetter.val === 42, "cloneDeep preserves getters/property descriptors");

// Custom Properties & Descriptors on Built-ins
const arrWithProp = [1, 2];
Object.defineProperty(arrWithProp, 'customMeta', { value: 10, enumerable: false });
const clonedArrProp = $h.cloneDeep(arrWithProp);
assert(clonedArrProp.customMeta === 10, "cloneDeep preserves non-enumerable properties on Arrays");

const mapWithProp = new Map([['a', 1]]);
mapWithProp.meta = { author: 'Helix' };
const clonedMapProp = $h.cloneDeep(mapWithProp);
assert(clonedMapProp.meta && clonedMapProp.meta.author === 'Helix', "cloneDeep preserves custom properties on Maps");

const setWithProp = new Set([1, 2]);
setWithProp.meta = { type: 'numeric' };
const clonedSetProp = $h.cloneDeep(setWithProp);
assert(clonedSetProp.meta && clonedSetProp.meta.type === 'numeric', "cloneDeep preserves custom properties on Sets");

const dateWithProp = new Date(2026, 0, 1);
dateWithProp.meta = { tracked: true };
const clonedDateProp = $h.cloneDeep(dateWithProp);
assert(clonedDateProp.meta && clonedDateProp.meta.tracked === true, "cloneDeep preserves custom properties on Dates");

const regWithProp = /helix/g;
regWithProp.meta = { tag: 'regex' };
const clonedRegProp = $h.cloneDeep(regWithProp);
assert(clonedRegProp.meta && clonedRegProp.meta.tag === 'regex', "cloneDeep preserves custom properties on RegExps");

// deepMerge
const mergeTarget = { a: 1, nested: { b: 2, arr: [1] } };
const mergeSource = { nested: { c: 3, arr: [2] }, d: 4 };
const merged = $h.deepMerge(mergeTarget, mergeSource);
assert(merged.a === 1 && merged.d === 4, "deepMerge merges top-level keys");
assert(merged.nested.b === 2 && merged.nested.c === 3, "deepMerge merges nested objects");
assert(mergeTarget.nested.c === undefined, "deepMerge does not mutate original source");

const nonObjMerge = $h.deepMerge(null, { a: 1 }, { b: 2 });
assert(nonObjMerge.a === 1 && nonObjMerge.b === 2, "deepMerge handles null/undefined root target safely");

// get & set
const sample = { user: { profile: { name: 'Neo' } } };
assert($h.get(sample, 'user.profile.name') === 'Neo', "get resolves dot-paths");
assert($h.get(sample, 'user.profile.age', 30) === 30, "get returns default fallback on missing path");
assert($h.get(null, 'foo.bar', 'fallback') === 'fallback', "get handles null root safely");

const setTarget = {};
$h.set(setTarget, 'a.b.c', 99);
assert(setTarget.a && setTarget.a.b && setTarget.a.b.c === 99, "set creates missing intermediate objects");

const testSetArray = {};
$h.set(testSetArray, 'users.0.name', 'John');
assert(Array.isArray(testSetArray.users) && testSetArray.users[0].name === 'John', "set creates Arrays for numeric path segments (users.0.name)");

const testSetBracketArray = {};
$h.set(testSetBracketArray, 'items[0]', 'apple');
assert(Array.isArray(testSetBracketArray.items) && testSetBracketArray.items[0] === 'apple', "set creates Arrays for bracket numeric path segments (items[0])");

const wrongTypeObj = { users: {} };
$h.set(wrongTypeObj, 'users.0.name', 'John');
assert(Array.isArray(wrongTypeObj.users) && wrongTypeObj.users[0].name === 'John', "set replaces existing wrong-type object with Array for numeric keys");

const wrongTypeArr = { user: [] };
$h.set(wrongTypeArr, 'user.name', 'Jane');
assert(typeof wrongTypeArr.user === 'object' && !Array.isArray(wrongTypeArr.user) && wrongTypeArr.user.name === 'Jane', "set replaces existing wrong-type array with Object for named keys");

// pick, pickBy, omit, omitBy, hasKey
assert(JSON.stringify($h.pick({ x: 1, y: 2, z: 3 }, ['x', 'z'])) === JSON.stringify({ x: 1, z: 3 }), "pick extracts specified keys");
assert(JSON.stringify($h.pickBy({ a: 10, b: 20, c: 5 }, v => v >= 10)) === JSON.stringify({ a: 10, b: 20 }), "pickBy filters by predicate");
assert(JSON.stringify($h.omit({ x: 1, y: 2, z: 3 }, ['y'])) === JSON.stringify({ x: 1, z: 3 }), "omit removes specified keys");
assert(JSON.stringify($h.omitBy({ a: 10, b: 20, c: 5 }, v => v < 10)) === JSON.stringify({ a: 10, b: 20 }), "omitBy removes by predicate");
assert($h.hasKey({ id: 1 }, 'id') === true, "hasKey returns true for own property");
assert($h.hasKey({ id: 1 }, 'toString') === false, "hasKey returns false for prototype property");

// ═════════════════════════════════════════════════════════════════════
// 3. TYPES & EQUALITY (MAP, SET, DATES, ARRAYS)
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 3. Types & Equality ---");

// Map Equality
const mapA = new Map([['a', 1], ['b', { x: 2 }]]);
const mapB = new Map([['a', 1], ['b', { x: 2 }]]);
const mapC = new Map([['a', 1], ['b', { x: 99 }]]);
assert($h.isEqual(mapA, mapB) === true, "isEqual returns true for deeply equal Maps");
assert($h.isEqual(mapA, mapC) === false, "isEqual returns false for unequal Maps");

// Circular Map Equality
const circMapA = new Map(); circMapA.set('self', circMapA);
const circMapB = new Map(); circMapB.set('self', circMapB);
assert($h.isEqual(circMapA, circMapB) === true, "isEqual handles circular Map ↔ circular Map");

// Set Equality
const setA = new Set([1, { a: 2 }]);
const setB = new Set([{ a: 2 }, 1]);
const setC = new Set([1, { a: 3 }]);
assert($h.isEqual(setA, setB) === true, "isEqual returns true for deeply equal Sets regardless of order");
assert($h.isEqual(setA, setC) === false, "isEqual returns false for unequal Sets");

// Circular Set Equality
const circSetA = new Set(); circSetA.add(circSetA);
const circSetB = new Set(); circSetB.add(circSetB);
assert($h.isEqual(circSetA, circSetB) === true, "isEqual handles circular Set ↔ circular Set");

// Complex Nested Map and Set Circular Graph
const nestedMapA = new Map(); const nestedSetA = new Set(); nestedMapA.set('set', nestedSetA); nestedSetA.add(nestedMapA);
const nestedMapB = new Map(); const nestedSetB = new Set(); nestedMapB.set('set', nestedSetB); nestedSetB.add(nestedMapB);
assert($h.isEqual(nestedMapA, nestedMapB) === true, "isEqual handles Map containing Set containing Map recursively");

// Date & RegExp Equality
assert($h.isEqual(new Date(2026, 0, 1), new Date(2026, 0, 1)) === true, "isEqual compares Date timestamps");
assert($h.isEqual(new Date(2026, 0, 1), new Date(2025, 0, 1)) === false, "isEqual rejects different Date timestamps");
assert($h.isEqual(/abc/gi, /abc/gi) === true, "isEqual compares RegExps");
assert($h.isEqual(/abc/gi, /abc/g) === false, "isEqual rejects different RegExp flags");

// Circular isEqual
const circA = { val: 1 }; circA.self = circA;
const circB = { val: 1 }; circB.self = circB;
assert($h.isEqual(circA, circB) === true, "isEqual correctly compares circular objects");

// isEmpty
assert($h.isEmpty('') === true, "isEmpty returns true for empty string");
assert($h.isEmpty([]) === true, "isEmpty returns true for empty array");
assert($h.isEmpty(new Map()) === true, "isEmpty returns true for empty Map");
assert($h.isEmpty(new Set()) === true, "isEmpty returns true for empty Set");
assert($h.isEmpty({}) === true, "isEmpty returns true for empty Object");
assert($h.isEmpty({ a: 1 }) === false, "isEmpty returns false for non-empty Object");
assert($h.isEmpty(null) === true && $h.isEmpty(undefined) === true, "isEmpty returns true for null/undefined");

// Type Guards
assert($h.isPlainObject({}) === true && $h.isPlainObject(new Date()) === false, "isPlainObject differentiates literals from class instances");
assert($h.isNumber(100) === true && $h.isNumber(NaN) === false && $h.isNumber(Infinity) === false, "isNumber validates only finite numbers");
assert($h.isNil(null) === true && $h.isNil(undefined) === true && $h.isNil(0) === false, "isNil returns true only for null/undefined");
assert($h.isDate(new Date()) === true, "isDate validates Date instances");
assert($h.isRegExp(/test/) === true, "isRegExp validates RegExp instances");
assert($h.isPromise(Promise.resolve()) === true, "isPromise validates Promise and thenables");

// ═════════════════════════════════════════════════════════════════════
// 4. STRINGS
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 4. Strings ---");
assert($h.camelCase('helix_framework-ui') === 'helixFrameworkUi', "camelCase converts underscores and hyphens");
assert($h.kebabCase('HelixFrameworkUi') === 'helix-framework-ui', "kebabCase converts PascalCase to kebab-case");
assert($h.snakeCase('helix-framework-ui') === 'helix_framework_ui', "snakeCase converts kebab-case to snake_case");
assert($h.titleCase('modern reactive framework') === 'Modern Reactive Framework', "titleCase capitalizes words");
assert($h.slugify('Article: What is Helix? #1') === 'article-what-is-helix-1', "slugify cleans punctuation and accents");
assert($h.capitalize('helix') === 'Helix', "capitalize capitalizes initial character");
assert($h.truncate('abcdefghij', 5, '...') === 'ab...', "truncate respects total output length including suffix");
assert($h.truncate('short', 10) === 'short', "truncate leaves short strings untouched");
assert($h.padStart('7', 4, '0') === '0007', "padStart pads string to target length");
assert($h.padEnd('5', 4, '0') === '5000', "padEnd pads string to target length");
assert($h.escapeHtml('<script>alert("x & y")</script>') === '&lt;script&gt;alert(&quot;x &amp; y&quot;)&lt;/script&gt;', "escapeHtml encodes XML entities");
assert($h.unescapeHtml('&lt;b&gt;bold&lt;/b&gt;') === '<b>bold</b>', "unescapeHtml decodes XML entities");

// ═════════════════════════════════════════════════════════════════════
// 5. ARRAYS & COLLECTIONS
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 5. Arrays & Collections ---");
const employees = [
    { id: 1, name: 'Alice', dept: 'Eng', salary: 95000 },
    { id: 2, name: 'Bob', dept: 'Design', salary: 80000 },
    { id: 3, name: 'Charlie', dept: 'Eng', salary: 110000 }
];

const grouped = $h.groupBy(employees, 'dept');
assert(grouped.Eng.length === 2 && grouped.Design.length === 1, "groupBy groups elements by key");

const keyed = $h.keyBy(employees, 'id');
assert(keyed['1'].name === 'Alice' && keyed['2'].name === 'Bob', "keyBy keys objects by property");

const sorted = $h.sortBy(employees, 'salary', 'desc');
assert(sorted[0].name === 'Charlie' && sorted[2].name === 'Bob', "sortBy sorts array in descending order");

assert(JSON.stringify($h.chunk([1, 2, 3, 4, 5], 2)) === JSON.stringify([[1, 2], [3, 4], [5]]), "chunk partitions array into sub-arrays");
assert(JSON.stringify($h.pluck(employees, 'name')) === JSON.stringify(['Alice', 'Bob', 'Charlie']), "pluck extracts values");
assert($h.findBy(employees, 'dept', 'Design').name === 'Bob', "findBy finds first match");
assert($h.removeBy([1, 2, 3, 2], null, 2).length === 2, "removeBy filters out matches");

const [even, odd] = $h.partition([1, 2, 3, 4], n => n % 2 === 0);
assert(JSON.stringify(even) === JSON.stringify([2, 4]) && JSON.stringify(odd) === JSON.stringify([1, 3]), "partition splits array into two groups");

assert(JSON.stringify($h.difference([1, 2, 2, 3], [2])) === JSON.stringify([1, 3]), "difference returns unique non-overlapping elements");
assert(JSON.stringify($h.intersection([1, 1, 2, 3], [1, 2])) === JSON.stringify([1, 2]), "intersection returns unique common elements");
assert(JSON.stringify($h.unique([1, 1, 2, 3, 3])) === JSON.stringify([1, 2, 3]), "unique deduplicates array");
assert(JSON.stringify($h.flatten([1, [2, [3]]], Infinity)) === JSON.stringify([1, 2, 3]), "flatten unwraps nested arrays");

// ═════════════════════════════════════════════════════════════════════
// 6. NUMBERS & MATH
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 6. Numbers & Math ---");
assert($h.formatNumber(1234567.89, 2, 'en-US') === '1,234,567.89', "formatNumber formats with thousands separator in en-US");
assert($h.formatCurrency(1250.5, 'USD', 'en-US') === '$1,250.50', "formatCurrency formats standard currency code");
assert($h.formatCurrency(1250, { currency: 'EUR', locale: 'de-DE' }).includes('1.250'), "formatCurrency accepts options object");
assert($h.round(1.005, 2) === 1.01, "round accurately rounds using epsilon precision");
assert($h.clamp(150, 0, 100) === 100 && $h.clamp(-5, 0, 100) === 0, "clamp restricts value to bounds");

const rand = $h.randomInt(10, 1); // Test min > max normalization
assert(rand >= 1 && rand <= 10, "randomInt normalizes inverted min/max arguments");

// ═════════════════════════════════════════════════════════════════════
// 7. DATES & TIME
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 7. Dates & Time ---");
const testDate = new Date(2026, 7, 24, 15, 30, 45); // August 24, 2026 15:30:45
assert($h.formatDate(testDate, 'YYYY-MM-DD HH:mm:ss') === '2026-08-24 15:30:45', "formatDate formats token masks");

const utcDate = new Date(Date.UTC(2026, 7, 24, 12, 0, 0));
assert($h.formatDate(utcDate, 'YYYY-MM-DD HH:mm:ss', { utc: true }) === '2026-08-24 12:00:00', "formatDate supports UTC mode");

assert($h.timeAgo(new Date(Date.now() - 300000)).includes('5 minutes ago'), "timeAgo returns humanized relative time");
assert($h.formatDate($h.addDays(testDate, 3), 'YYYY-MM-DD') === '2026-08-27', "addDays adds offset to Date");
assert($h.formatDate($h.startOfDay(testDate), 'HH:mm:ss') === '00:00:00', "startOfDay zeroes out time");
assert($h.formatDate($h.endOfDay(testDate), 'HH:mm:ss') === '23:59:59', "endOfDay sets end time");

// ═════════════════════════════════════════════════════════════════════
// 8. VALIDATION
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 8. Validation ---");
assert($h.isEmail('team@helixjs.org') === true && $h.isEmail('invalid-email') === false, "isEmail validates email addresses");
assert($h.isUrl('https://helixjs.org') === true && $h.isUrl('http://localhost:3000') === true, "isUrl accepts http/https");
assert($h.isUrl('javascript:alert(1)') === false, "isUrl rejects non-http protocols by default");
assert($h.isUrl('ftp://server', { protocols: ['ftp:', 'http:'] }) === true, "isUrl accepts custom protocols via options");

assert($h.isPhone('+1 (555) 234-5678', 'US') === true, "isPhone accepts US formatted phone numbers");
assert($h.isPhone('+91 98765 43210', 'IN') === true, "isPhone accepts Indian formatted phone numbers with spaces");
assert($h.isPhone('+91-98765-43210', 'IN') === true, "isPhone accepts Indian formatted phone numbers with dashes");
assert($h.isHexColor('#6366f1') === true && $h.isHexColor('blue') === false, "isHexColor validates hex color codes");
assert($h.minLength('helix', 3) === true && $h.minLength('hx', 3) === false, "minLength checks min length");
assert($h.maxLength('helix', 10) === true && $h.maxLength('helix-framework', 5) === false, "maxLength checks max length");
assert($h.range(50, 1, 100) === true && $h.range(150, 1, 100) === false, "range validates numerical boundaries");

// ═════════════════════════════════════════════════════════════════════
// 9. ASYNC, TIMERS & PROMISES
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 9. Async, Timers & Promises ---");

// debounce cancellation state reset
let debounceCount = 0;
const debouncedFn = $h.debounce(() => { debounceCount++; }, 100);
debouncedFn();
debouncedFn.cancel();
await new Promise(r => setTimeout(r, 150));
assert(debounceCount === 0, "debounce.cancel() prevents execution and resets internal timer");

// throttle cancellation state reset
let throttleCount = 0;
const throttledFn = $h.throttle(() => { throttleCount++; }, 100);
throttledFn();
throttledFn.cancel();
assert(throttleCount === 1, "throttle executes first immediate call");

// retry with exponential backoff
let retryAttempts = 0;
const retryRes = await $h.retry(async (attempt) => {
    retryAttempts++;
    if (attempt < 2) throw new Error('Temp failure');
    return 'Success';
}, { retries: 3, delay: 20, backoff: 2 });
assert(retryAttempts === 3 && retryRes === 'Success', "retry successfully handles exponential backoff and succeeds");

assert($h.uid(10).length === 10, "uid generates random ID of specified length");
assert(typeof $h.uuid() === 'string' && $h.uuid().length === 36, "uuid generates RFC4122 format string");

// ═════════════════════════════════════════════════════════════════════
// 10. DATA & QUERY STRINGS (NESTED BRACKET PATHS)
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 10. Data & Query Strings ---");

const nestedData = {
    user: {
        name: 'John',
        address: { city: 'SF' }
    },
    tags: ['admin', 'verified']
};

const serialized = $h.toQueryString(nestedData);
assert(serialized.includes('user%5Bname%5D=John') || serialized.includes('user[name]=John'), "toQueryString serializes nested object paths");
assert(serialized.includes('tags%5B%5D=admin') || serialized.includes('tags[]=admin'), "toQueryString serializes arrays using bracket notation tags[]");

const parsedQuery = $h.fromQueryString(serialized);
assert(parsedQuery.user && parsedQuery.user.name === 'John', "fromQueryString reconstructs nested object properties");
assert(parsedQuery.user && parsedQuery.user.address && parsedQuery.user.address.city === 'SF', "fromQueryString reconstructs deep nested paths");
assert(Array.isArray(parsedQuery.tags) && parsedQuery.tags[0] === 'admin' && parsedQuery.tags[1] === 'verified', "fromQueryString reconstructs array values");

const objectArrayData = {
    items: [
        { name: 'Apples', qty: 5 },
        { name: 'Oranges', qty: 10 }
    ]
};
const objArrSerialized = $h.toQueryString(objectArrayData);
assert(objArrSerialized.includes('items%5B0%5D%5Bname%5D=Apples') || objArrSerialized.includes('items[0][name]=Apples'), "toQueryString serializes array of objects with indices items[0][name]");
const parsedObjArr = $h.fromQueryString(objArrSerialized);
assert(Array.isArray(parsedObjArr.items) && parsedObjArr.items[0].name === 'Apples' && parsedObjArr.items[1].name === 'Oranges', "fromQueryString round-trips array of objects with indices");

assert(JSON.stringify($h.parseJSON('{"ok":true}')) === JSON.stringify({ ok: true }), "parseJSON parses valid JSON");
assert(JSON.stringify($h.parseJSON('invalid', { fallback: 1 })) === JSON.stringify({ fallback: 1 }), "parseJSON returns fallback on invalid JSON");

// ═════════════════════════════════════════════════════════════════════
// 11. DOM & HEADLESS SAFETY
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 11. DOM & Headless Safety ---");

// Headless scrollTo safety
let didScrollThrow = false;
try {
    $h.scrollTo('#target');
} catch (e) {
    didScrollThrow = true;
}
assert(didScrollThrow === false, "scrollTo executes safely in headless environment without throwing ReferenceError");

// Headless downloadFile safety
assert($h.downloadFile('content', 'test.txt') === false, "downloadFile returns false gracefully in headless environment");

// Collapse structural guard
let didCollapseThrow = false;
try {
    $h.collapse({}, true);
} catch (e) {
    didCollapseThrow = true;
}
assert(didCollapseThrow === false, "collapse handles non-DOM element gracefully with structural guard");

// Destructured copy
const { copy } = $h;
assert(typeof copy === 'function', "copy is accessible via destructuring");

// ═════════════════════════════════════════════════════════════════════
// 12. EVENTS & ID GENERATORS
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 12. Events & ID Generators ---");

const idSeq1 = $h.id('btn');
const idSeq2 = $h.id('btn');
const idDefault = $h.id();
const idRand = $h.uniqueId('btn');
const idRandDefault = $h.uniqueId();
assert(idSeq1 && idSeq1.startsWith('btn-'), "id() generates sequential ID with custom prefix");
assert(idSeq1 !== idSeq2, "id() increments sequential ID");
assert(idDefault && idDefault.startsWith('hx-'), "id() defaults to 'hx-' prefix");
assert(idRand && idRand.startsWith('btn-') && idRand.length >= 10, "uniqueId() generates randomized unique ID with custom prefix");
assert(idRandDefault && idRandDefault.startsWith('hx-'), "uniqueId() defaults to 'hx-' prefix");

// Dynamic Core/App config.prefix inheritance test
const customApp = { config: { prefix: 'app-' }, provide() {} };
const customIdMethods = createIdMethods($h, customApp);
assert(customIdMethods.id().startsWith('app-'), "id() inherits app.config.prefix ('app-')");
assert(customIdMethods.uniqueId().startsWith('app-'), "uniqueId() inherits app.config.prefix ('app-')");

globalThis.Helix = { config: { prefix: 'helix-' } };
const globalIdMethods = createIdMethods($h, {});
assert(globalIdMethods.id().startsWith('helix-'), "id() inherits global Helix.config.prefix ('helix-')");
assert(globalIdMethods.uniqueId().startsWith('helix-'), "uniqueId() inherits global Helix.config.prefix ('helix-')");
delete globalThis.Helix;

let capturedEvent = null;
const dummyTarget = {
    dispatchEvent(e) {
        capturedEvent = e;
        return true;
    }
};
$h.dispatch(dummyTarget, 'user:create', { id: 42, role: 'admin' });
assert(capturedEvent && capturedEvent.type === 'user:create' && capturedEvent.detail && capturedEvent.detail.id === 42, "dispatch dispatches with detail object");

// ═════════════════════════════════════════════════════════════════════
// 13. BUILT DIST BUNDLE VERIFICATION & CLEANUP
// ═════════════════════════════════════════════════════════════════════
console.log("\n--- 13. Built Dist Bundle Verification & Cleanup ---");

const distUrl = new URL('./dist/helix-helpers.js', import.meta.url);
if (fs.existsSync(distUrl)) {
    const distCode = fs.readFileSync(distUrl, 'utf8');
    const context = {
        URL,
        document: { baseURI: 'http://localhost/' },
        window: {},
        globalThis: {}
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(distCode, context);
    assert(context.HelixHelpersPlugin && context.HelixHelpersPlugin.name === 'helpers', "Built dist/helix-helpers.js executes cleanly in browser sandbox and registers HelixHelpersPlugin");
} else {
    console.log(" ℹ️ dist/helix-helpers.js not found; skipping bundle execution (run 'npm run test:build' to verify full build)");
}

mockApp.provides = { '$h': $h, 'helper': $h };
mockApp._provides = { '$h': $h, 'helper': $h };

uninstall();
assert(mockApp.$h === undefined, "Plugin uninstall cleanly removes app.$h");
assert(mockApp.provides['$h'] === undefined && mockApp.provides['helper'] === undefined, "Plugin uninstall cleanly removes app.provides entries");
assert(mockApp._provides['$h'] === undefined && mockApp._provides['helper'] === undefined, "Plugin uninstall cleanly removes app._provides entries");
assert(eventEmitted && eventEmitted.evt === 'plugin:helpers:destroyed', "Plugin uninstall emits plugin:helpers:destroyed event");

console.log("\n=========================================================");
console.log(` 🎉 ALL TESTS PASSED: ${passed}/${total} assertions`);
console.log("=========================================================\n");
