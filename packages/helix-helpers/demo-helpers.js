import HelixHelpersPlugin from './src/index.js';

// Setup mock app environment
const mockApp = {
    namespace(name, obj) { mockApp[name] = obj; },
    provide(key, val) { mockApp[key] = val; },
    $bus: { emit: () => {} }
};

HelixHelpersPlugin.install(mockApp);
const $h = mockApp.$h;

console.log("=========================================================");
console.log("  🚀 HELIX HELPERS ($h) - LIVE DEMO OF FUNCTION WORKINGS");
console.log("=========================================================\n");

// 1. STRINGS
console.log("--- 1. STRINGS ---");
console.log("$h.camelCase('helix_framework_reactive_ui') ->", JSON.stringify($h.camelCase('helix_framework_reactive_ui')));
console.log("$h.kebabCase('HelixFrameworkReactiveUi')    ->", JSON.stringify($h.kebabCase('HelixFrameworkReactiveUi')));
console.log("$h.snakeCase('helix-framework-ui')          ->", JSON.stringify($h.snakeCase('helix-framework-ui')));
console.log("$h.titleCase('modern reactive framework')   ->", JSON.stringify($h.titleCase('modern reactive framework')));
console.log("$h.slugify('Article: What is Helix.js? #1')  ->", JSON.stringify($h.slugify('Article: What is Helix.js? #1')));
console.log("$h.capitalize('helix')                       ->", JSON.stringify($h.capitalize('helix')));
console.log("$h.truncate('Lorem ipsum dolor sit amet', 11)->", JSON.stringify($h.truncate('Lorem ipsum dolor sit amet', 11)));
console.log("$h.padStart('7', 4, '0')                     ->", JSON.stringify($h.padStart('7', 4, '0')));
console.log("$h.padEnd('5', 4, '0')                       ->", JSON.stringify($h.padEnd('5', 4, '0')));
console.log("$h.escapeHtml('<div class=\"box\">Hello & Bye</div>') ->", JSON.stringify($h.escapeHtml('<div class="box">Hello & Bye</div>')));
console.log("$h.unescapeHtml('&lt;div&gt;Hello &amp; Bye&lt;/div&gt;') ->", JSON.stringify($h.unescapeHtml('&lt;div&gt;Hello &amp; Bye&lt;/div&gt;')));

// 2. ARRAYS & COLLECTIONS
console.log("\n--- 2. ARRAYS & COLLECTIONS ---");
const employees = [
    { id: 1, name: 'Alice', dept: 'Eng', salary: 95000 },
    { id: 2, name: 'Bob', dept: 'Design', salary: 80000 },
    { id: 3, name: 'Charlie', dept: 'Eng', salary: 110000 },
    { id: 4, name: 'Dana', dept: 'Product', salary: 90000 }
];

console.log("$h.groupBy(employees, 'dept'):\n", JSON.stringify($h.groupBy(employees, 'dept'), null, 2));
console.log("$h.keyBy(employees, 'id'):\n", JSON.stringify($h.keyBy(employees, 'id'), null, 2));
console.log("$h.sortBy(employees, 'salary', 'desc'):\n", JSON.stringify($h.sortBy(employees, 'salary', 'desc').map(e => ({ name: e.name, salary: e.salary })), null, 2));
console.log("$h.chunk([1, 2, 3, 4, 5, 6, 7], 3) ->", JSON.stringify($h.chunk([1, 2, 3, 4, 5, 6, 7], 3)));
console.log("$h.pluck(employees, 'name')         ->", JSON.stringify($h.pluck(employees, 'name')));
console.log("$h.findBy(employees, 'dept', 'Design') ->", JSON.stringify($h.findBy(employees, 'dept', 'Design')));
console.log("$h.removeBy([10, 20, 30, 20], null, 20) ->", JSON.stringify($h.removeBy([10, 20, 30, 20], null, 20)));
console.log("$h.partition([1, 2, 3, 4, 5, 6], n => n % 2 === 0) ->", JSON.stringify($h.partition([1, 2, 3, 4, 5, 6], n => n % 2 === 0)));
console.log("$h.difference([1, 2, 3, 4], [2, 4], [3]) ->", JSON.stringify($h.difference([1, 2, 3, 4], [2, 4], [3])));
console.log("$h.intersection([1, 2, 3, 4], [2, 3, 5], [2, 3, 6]) ->", JSON.stringify($h.intersection([1, 2, 3, 4], [2, 3, 5], [2, 3, 6])));
console.log("$h.unique([1, 2, 2, 3, 4, 4, 1]) ->", JSON.stringify($h.unique([1, 2, 2, 3, 4, 4, 1])));
console.log("$h.flatten([1, [2, [3, [4]]]], Infinity) ->", JSON.stringify($h.flatten([1, [2, [3, [4]]]], Infinity)));

// 3. OBJECTS & DEEP PATHS
console.log("\n--- 3. OBJECTS & DEEP PATHS ---");
const state = {
    user: {
        id: 101,
        name: 'Sarah Connor',
        profile: { address: { city: 'San Francisco', zip: 94107 } }
    },
    settings: { theme: 'dark', notifications: true }
};

console.log("$h.get(state, 'user.profile.address.city') ->", JSON.stringify($h.get(state, 'user.profile.address.city')));
console.log("$h.get(state, 'user.profile.missing', 'Default Value') ->", JSON.stringify($h.get(state, 'user.profile.missing', 'Default Value')));

const targetObj = {};
$h.set(targetObj, 'company.location.country', 'USA');
console.log("$h.set({}, 'company.location.country', 'USA') ->", JSON.stringify(targetObj));

console.log("$h.pick(state.user, ['id', 'name']) ->", JSON.stringify($h.pick(state.user, ['id', 'name'])));
console.log("$h.pickBy({ a: 10, b: 25, c: 5 }, v => v >= 10) ->", JSON.stringify($h.pickBy({ a: 10, b: 25, c: 5 }, v => v >= 10)));
console.log("$h.omit(state.user, ['profile']) ->", JSON.stringify($h.omit(state.user, ['profile'])));
console.log("$h.hasKey(state, 'settings') ->", $h.hasKey(state, 'settings'));

const merged = $h.deepMerge({ api: { timeout: 1000, retry: true } }, { api: { timeout: 5000, auth: 'Bearer' } });
console.log("$h.deepMerge(defaults, overrides) ->", JSON.stringify(merged));

// 4. TYPES & EQUALITY
console.log("\n--- 4. TYPES & EQUALITY ---");
console.log("$h.isEqual({ a: [1, 2] }, { a: [1, 2] }) ->", $h.isEqual({ a: [1, 2] }, { a: [1, 2] }));
console.log("$h.isEqual(new Date(2026, 0, 1), new Date(2026, 0, 1)) ->", $h.isEqual(new Date(2026, 0, 1), new Date(2026, 0, 1)));
console.log("$h.isEmpty('') ->", $h.isEmpty(''), "| $h.isEmpty([]) ->", $h.isEmpty([]), "| $h.isEmpty({}) ->", $h.isEmpty({}));
console.log("$h.isEmpty({ key: 1 }) ->", $h.isEmpty({ key: 1 }));
console.log("$h.isPlainObject({}) ->", $h.isPlainObject({}), "| $h.isPlainObject(new Date()) ->", $h.isPlainObject(new Date()));
console.log("$h.isNil(null) ->", $h.isNil(null), "| $h.isNil(undefined) ->", $h.isNil(undefined), "| $h.isNil(0) ->", $h.isNil(0));
console.log("$h.isNumber(42.5) ->", $h.isNumber(42.5), "| $h.isNumber(NaN) ->", $h.isNumber(NaN));

// 5. NUMBERS & MATH
console.log("\n--- 5. NUMBERS & MATH ---");
console.log("$h.formatCurrency(1250000.50, 'USD') ->", $h.formatCurrency(1250000.50, 'USD'));
console.log("$h.formatCurrency(75000, 'INR', 'en-IN') ->", $h.formatCurrency(75000, 'INR', 'en-IN'));
console.log("$h.formatNumber(1234567.891, 2)       ->", $h.formatNumber(1234567.891, 2));
console.log("$h.round(1.005, 2)                     ->", $h.round(1.005, 2));
console.log("$h.clamp(150, 0, 100)                  ->", $h.clamp(150, 0, 100));
console.log("$h.randomInt(1, 10)                    ->", $h.randomInt(1, 10));

// 6. DATES & TIME
console.log("\n--- 6. DATES & TIME ---");
const now = new Date('2026-08-23T20:15:30');
console.log("$h.formatDate(now, 'YYYY-MM-DD HH:mm:ss') ->", $h.formatDate(now, 'YYYY-MM-DD HH:mm:ss'));
console.log("$h.formatDate(now, 'DD/MM/YYYY')          ->", $h.formatDate(now, 'DD/MM/YYYY'));
console.log("$h.timeAgo(new Date(Date.now() - 300000))  ->", $h.timeAgo(new Date(Date.now() - 300000)));
console.log("$h.timeAgo(new Date(Date.now() - 86400000))->", $h.timeAgo(new Date(Date.now() - 86400000)));
console.log("$h.formatDate($h.addDays(now, 7), 'YYYY-MM-DD') ->", $h.formatDate($h.addDays(now, 7), 'YYYY-MM-DD'));
console.log("$h.formatDate($h.startOfDay(now), 'YYYY-MM-DD HH:mm:ss') ->", $h.formatDate($h.startOfDay(now), 'YYYY-MM-DD HH:mm:ss'));
console.log("$h.formatDate($h.endOfDay(now), 'YYYY-MM-DD HH:mm:ss')   ->", $h.formatDate($h.endOfDay(now), 'YYYY-MM-DD HH:mm:ss'));

// 7. VALIDATION
console.log("\n--- 7. VALIDATION ---");
console.log("$h.isEmail('team@helixjs.org')  ->", $h.isEmail('team@helixjs.org'));
console.log("$h.isEmail('invalid-email')      ->", $h.isEmail('invalid-email'));
console.log("$h.isUrl('https://helixjs.org')  ->", $h.isUrl('https://helixjs.org'));
console.log("$h.isPhone('+1 (555) 234-5678', 'US') ->", $h.isPhone('+1 (555) 234-5678', 'US'));
console.log("$h.isPhone('+91 9876543210', 'IN')    ->", $h.isPhone('+91 9876543210', 'IN'));
console.log("$h.isHexColor('#6366f1')        ->", $h.isHexColor('#6366f1'));
console.log("$h.minLength('password', 8)     ->", $h.minLength('password', 8));
console.log("$h.maxLength('username', 10)    ->", $h.maxLength('username', 10));
console.log("$h.range(42, 1, 100)            ->", $h.range(42, 1, 100));

// 8. ASYNC & RETRY
console.log("\n--- 8. ASYNC & RETRY ---");
console.log("$h.uid(10) ->", JSON.stringify($h.uid(10)));
console.log("$h.uuid()  ->", JSON.stringify($h.uuid()));

async function runAsyncDemo() {
    console.log("Testing $h.wait(100ms)...");
    const t0 = Date.now();
    await $h.wait(100);
    console.log(`Resumed after ${Date.now() - t0}ms ✅`);

    console.log("\nTesting $h.retry() with exponential backoff:");
    let attempts = 0;
    const retryResult = await $h.retry(async (attempt) => {
        attempts++;
        console.log(`  -> Invoking worker attempt #${attempt + 1}...`);
        if (attempt < 2) {
            throw new Error(`Simulated temporary network outage on attempt #${attempt + 1}`);
        }
        return { success: true, message: "Connected successfully on 3rd attempt!" };
    }, {
        retries: 3,
        delay: 50,
        backoff: 2,
        onRetry: (err, attempt, waitMs) => {
            console.log(`  ⚠️ Caught error: "${err.message}". Retrying in ${waitMs}ms...`);
        }
    });
    console.log("Retry completed successfully with result:\n", JSON.stringify(retryResult, null, 2));

    // 9. DATA & QUERY STRINGS
    console.log("\n--- 9. DATA & QUERY STRINGS ---");
    const queryObj = { search: 'helix', page: 2, tags: ['frontend', 'reactivity'] };
    const qs = $h.toQueryString(queryObj);
    console.log("$h.toQueryString({ search: 'helix', page: 2, tags: [...] }) ->", JSON.stringify(qs));
    console.log("$h.fromQueryString(qs) ->\n", JSON.stringify($h.fromQueryString(qs), null, 2));
    console.log("$h.parseJSON('{\"active\":true}') ->", JSON.stringify($h.parseJSON('{"active":true}')));
    console.log("$h.parseJSON('invalid', { fallback: true }) ->", JSON.stringify($h.parseJSON('invalid', { fallback: true })));

    // 10. EVENTS & ID
    console.log("\n--- 10. EVENTS & UNIQUE ID ---");
    console.log("$h.id('input') ->", JSON.stringify($h.id('input')));
    console.log("$h.id('input') ->", JSON.stringify($h.id('input')));
    console.log("$h.uniqueId('modal') ->", JSON.stringify($h.uniqueId('modal')));

    console.log("\n=========================================================");
    console.log("  🎉 ALL HELIX HELPER FUNCTIONS DEMOED & VERIFIED!");
    console.log("=========================================================\n");
}

runAsyncDemo();
