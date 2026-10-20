import assert from 'node:assert';
import { model } from './src/model.js';

console.log('=========================================');
console.log(' Running helix-model Unit Tests');
console.log('=========================================');

const testData = [
  { id: 1, name: 'Alpha', price: 100, active: true, category: 'A' },
  { id: 2, name: 'Beta', price: 200, active: false, category: 'B' },
  { id: 3, name: 'Gamma', price: 300, active: true, category: 'A' },
  { id: 4, name: 'Delta', price: 400, active: true, category: 'B' },
  { id: 5, name: 'Epsilon', price: 500, active: false, category: 'A' },
  { id: 6, name: 'Zeta', price: 600, active: true, category: 'C' }
];

// Test 1: findAll() with no arguments returns all items
const allItems = model(testData).findAll();
assert.strictEqual(Array.isArray(allItems), true, 'findAll() returns an array');
assert.strictEqual(allItems.length, 6, 'findAll() returns all 6 items');
console.log(' ✅ PASS: findAll() returns all items without arguments');

// Test 2: where().findAll() returns filtered subset
const activeItems = model(testData).where('active', true).findAll();
assert.strictEqual(activeItems.length, 4, 'where().findAll() returns 4 active items');
assert.strictEqual(activeItems.every(i => i.active === true), true);
console.log(' ✅ PASS: where().findAll() returns filtered records');

// Test 3: findAll(limit) limits results
const limited = model(testData).findAll(3);
assert.strictEqual(limited.length, 3, 'findAll(3) limits to 3 items');
assert.strictEqual(limited[0].id, 1);
assert.strictEqual(limited[2].id, 3);
console.log(' ✅ PASS: findAll(limit) slices to limit');

// Test 4: findAll(limit, offset) applies offset and limit
const paged = model(testData).findAll(2, 2);
assert.strictEqual(paged.length, 2, 'findAll(2, 2) returns 2 items');
assert.strictEqual(paged[0].id, 3, 'First item after offset 2 is Gamma (id 3)');
assert.strictEqual(paged[1].id, 4, 'Second item after offset 2 is Delta (id 4)');
console.log(' ✅ PASS: findAll(limit, offset) offsets and limits records correctly');

// Test 5: Pipeline chaining: where + orderBy + findAll(limit, offset)
const pipeline = model(testData)
  .where('active', true)
  .orderBy('price', 'desc')
  .findAll(2, 1);
assert.strictEqual(pipeline.length, 2);
assert.strictEqual(pipeline[0].name, 'Delta', 'Delta is 2nd highest active (400)');
assert.strictEqual(pipeline[1].name, 'Gamma', 'Gamma is 3rd highest active (300)');
console.log(' ✅ PASS: Chained where().orderBy().findAll(limit, offset) works as expected');

// Test 6: Async pipeline with findAll()
async function runAsyncTests() {
  const asyncAll = await model(testData).async().findAll();
  assert.strictEqual(asyncAll.length, 6, 'async().findAll() returns all items in Promise');
  
  const asyncLimited = await model(testData).async().where('active', true).findAll(2);
  assert.strictEqual(asyncLimited.length, 2, 'async().where().findAll(2) limits to 2 in Promise');
  console.log(' ✅ PASS: async().findAll() resolves asynchronous Promise correctly');
}

runAsyncTests().then(() => {
  console.log('=========================================');
  console.log(' Summary: All 6/6 tests passed!');
  console.log('=========================================');
}).catch(err => {
  console.error(' ❌ FAIL:', err);
  process.exit(1);
});
