# helix-model

Helix Model Plugin v2.2 for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

`helix-model` is an AST-driven in-memory query builder, collection manipulator, and reactive data store for JavaScript arrays and datasets.

---

## Installation & Setup

```html
<script src="helix.js"></script>
<script src="helix-model.js"></script>
```

```javascript
// Manual registration (optional: autoloads automatically if Helix is present)
Helix.use(HelixModelPlugin, {
  asyncBatchSize: 8, // Batch size for async/lazy processing
  maxHeapSize: 1000  // Maximum entries in the internal heap cache
});
```

---

## Complete Feature & API Reference

### 1. Model Instantiation & Query Clones

| Method / Property | Description |
| :--- | :--- |
| `model(source)` | Create a model query instance around an array dataset |
| `$model(source)` | Namespace access via `Helix.$model` or `app.$model` |
| `.clone()` | Create a fresh clone of the query state (AST, order, limit, offset) |
| `.fresh()` / `.newQuery()` | Create a brand-new, un-filtered model instance sharing the same reactive dataset |
| `.lazy()` | Switch query pipeline to generator mode (evaluates rows 1-by-1 on-demand) |
| `.async()` | Switch query pipeline to async mode (non-blocking chunked evaluation) |

---

### 2. Filtering & Predicates (AST Engine)

| Method | Example & Description |
| :--- | :--- |
| `.where(field, op, val)` | `.where('age', '>=', 18)` – Standard comparison (`=`, `!=`, `<`, `<=`, `>`, `>=`, `like`) |
| `.where(object)` | `.where({ role: 'admin', active: true })` – Key-value equality filter |
| `.where(callback)` | `.where(item => item.age > 20)` – Custom callback filter predicate |
| `.orWhere(field, op, val)` | `.orWhere('role', '=', 'editor')` – Append condition with `OR` logic |
| `.whereIn(field, array)` | `.whereIn('status', ['active', 'pending'])` – Match items in array |
| `.orWhereIn(field, array)` | Append `whereIn` with `OR` logic |
| `.whereNotIn(field, array)` | `.whereNotIn('status', ['archived', 'deleted'])` |
| `.orWhereNotIn(field, array)`| Append `whereNotIn` with `OR` logic |
| `.whereBetween(field, [min, max])` | `.whereBetween('score', [50, 100])` – Inclusive range check |
| `.whereNotBetween(field, [min, max])` | `.whereNotBetween('score', [0, 49])` |
| `.whereNull(field)` | Filter items where field is `null` or `undefined` |
| `.whereNotNull(field)` | Filter items where field is defined and non-null |
| `.whereInstanceOf(Ctor)` | Filter items matching `instanceof Ctor` |
| `.search(fields, query)` | `.search(['name', 'email'], 'john')` – Multi-field string search |

---

### 3. Sorting & Ordering

| Method | Description |
| :--- | :--- |
| `.orderBy(field, dir)` | `.orderBy('age', 'desc')` or `.orderBy([{ field: 'name', dir: 'asc' }])` |
| `.sortBy(field)` | Shortcut for `.orderBy(field, 'asc')` |
| `.sortByDesc(field)` | Shortcut for `.orderBy(field, 'desc')` |
| `.reverse()` | Reverse current result order |
| `.sort(compareFn?)` | Sort array using standard comparator |
| `.sortDesc(compareFn?)` | Sort array descending using standard comparator |
| `.sortKeys(desc?)` / `.sortKeysDesc()` | Sort collection entries by dictionary keys |

---

### 4. Pagination, Slicing & Chunking

| Method | Description |
| :--- | :--- |
| `.limit(n, offset?)` | Set limit and optional offset |
| `.skip(count)` | Skip initial `count` items |
| `.take(limit)` | Restrict result count |
| `.slice(start, end)` | Extract a sub-slice of results |
| `.forPage(page, perPage)` | Calculate offset & limit for page number |
| `.paginate(perPage, page)` | Returns `{ data, total, perPage, currentPage, lastPage, from, to }` |
| `.nth(step, offset?)` | Create a collection consisting of every `n`-th element |
| `.chunk(size, callback?)` | Break collection into smaller array chunks |
| `.split(numberOfGroups)` | Divide dataset into specified number of equal groups |

---

### 5. Field Projections & Selection

| Method | Description |
| :--- | :--- |
| `.select(fields)` | `.select('id, name')` or `.select(['id', 'name'])` – Keep only specified keys |
| `.except(fields)` | `.except('password, ssn')` – Omit specified keys |
| `.only(fields)` | Construct new models containing only specified properties |
| `.pluck(field)` | Extract a single field value array: `['Alice', 'Bob']` |

---

### 6. Aggregations & Statistics

| Method | Description |
| :--- | :--- |
| `.count()` | Get number of items matching query |
| `.sum(field)` | Total sum of values for a field |
| `.avg(field)` | Calculate average value for a field |
| `.min(field)` | Find minimum value |
| `.max(field)` | Find maximum value |
| `.median(field?)` | Calculate median value |
| `.mode(field?)` | Calculate mode (most frequent value) |
| `.reduce(callback, initial)` | Reduce collection to a single value |

---

### 7. Collection Transformations

| Method | Description |
| :--- | :--- |
| `.map(callback)` | Map items through callback function |
| `.flatMap(callback)` | Map items and flatten one level |
| `.mapWithKeys(callback)` | Map items to key-value pair object |
| `.mapToDictionary(callback)` | Map items into grouped dictionary object |
| `.filter(callback)` | Filter items using JS callback |
| `.reject(callback)` | Inverse filter (reject items returning true) |
| `.partition(callback)` | Split collection into `[passModel, failModel]` |
| `.each(callback)` | Iterate over items (supports async iteration) |
| `.transform(callback)` | Mutate items in-place using mapping callback |
| `.unique(field?)` | De-duplicate items by field or value |
| `.duplicates(field?)` | Retrieve duplicate items |
| `.groupBy(field)` | Group items by key into an object dictionary |
| `.keyBy(field)` | Key collection items by field value into an object |
| `.flatten(depthOrField?)` | Flatten nested arrays or nested field arrays |
| `.collapse()` | Collapse array of arrays into a flat model |
| `.shuffle()` | Randomize item order |
| `.random(count?)` | Get random item(s) from collection |
| `.merge(items)` | Concatenate with another array/collection |
| `.mergeRecursive(items)` | Recursively merge structures |
| `.replace(items)` / `.replaceRecursive(items)` | Replace elements with items |
| `.diff(items)` / `.diffAssoc()` / `.diffKeys()` | Difference operations against another array |
| `.intersect(items)` / `.intersectByKeys()` | Intersection operations |
| `.union(items)` | Union collection with items without duplicating keys |
| `.pad(size, value)` | Pad array to specified size with filler value |
| `.times(n, callback)` | Generate a new model by invoking callback `n` times |
| `.implode(field, glue)` / `.join(glue, finalGlue)` | Join fields/strings into delimited string |
| `.zip(...arrays)` | Combine array elements index-by-index |
| `.crossJoin(...arrays)` | Cartesian product of collection and arrays |
| `.values()` / `.keys()` / `.flip()` | Array utility transformations |

---

### 8. Relational Joins

| Method | Description |
| :--- | :--- |
| `.innerJoin(other, leftKey, rightKey)` | Eager inner join against array/model |
| `.leftJoin(other, leftKey, rightKey)` | Eager left join against array/model |
| `.joinLive(other, leftKey, rightKey, type)` | Returns a reactive `computed` view re-deriving whenever EITHER dataset mutates |

---

### 9. Fast Indexing & Lookups

| Method | Description |
| :--- | :--- |
| `.index(fieldOrFields, options?)` | Build an in-memory Map index for instant lookups |
| `.find(value, key='id')` | $O(1)$ fast lookup when indexed (falls back to linear search) |
| `.findBy(field, value)` | $O(1)$ fast lookup on indexed field |
| `.findOrFail(value, key='id')` | Find item or throw descriptive `Error` |
| `.firstWhere(field, value)` | Find first item matching condition |
| `.first()` / `.firstOrFail()` | Get first item in query result |
| `.last()` | Get last item in query result |
| `.sole(field, value)` | Ensure EXACTLY ONE item matches (throws Error if 0 or >1) |
| `.exists()` / `.isEmpty()` / `.isNotEmpty()` | Check presence of matching rows |
| `.contains(val, key?, value?)` / `.doesntContain(...)` | Check if item exists in collection |
| `.has(...keys)` | Verify if first item contains keys |

---

### 10. Signal Reactivity & Subscriptions

| Method | Description |
| :--- | :--- |
| `.computed(selector?)` | Return a signal-native Helix computed view (re-evaluates on dataset mutation) |
| `.live(selector?)` | Alias for `.computed(selector)` |
| `.watch(callback, options?)` | Watch dataset/query changes and trigger callback |
| `.subscribe(callback)` | Subscribe to dataset mutation events |
| `.effect(callback)` | Run an effect whenever query data updates |

---

### 11. In-Place & Immutable Mutations

| Method | Description |
| :--- | :--- |
| `.insert(...items)` / `.push(...items)` | Append items to dataset and notify reactive graph |
| `.prepend(item, key?)` | Prepend item to dataset |
| `.pop(count?)` / `.shift(count?)` | Remove item(s) from end/start |
| `.pull(key)` / `.put(key, value)` | Remove or insert single key |
| `.forget(...keys)` | Delete specific keys/indices |
| `.splice(index, count, ...items)` | Splice items into dataset |
| `.update(attributes)` | Update matching query rows in-place (`model.where(...).update({ status: 'done' })`) |
| `.delete()` | Remove matching query rows from underlying dataset (`model.where(...).delete()`) |
| `.with(relation)` | Ensure relation array exists on items |

---

### 12. Conditional Logic & Debugging

| Method | Description |
| :--- | :--- |
| `.when(cond, callback, otherwise?)` | Execute `callback` if `cond` is truthy |
| `.unless(cond, callback, otherwise?)` | Execute `callback` if `cond` is falsy |
| `.whenEmpty()` / `.whenNotEmpty()` | Conditional execution based on query results |
| `.unlessEmpty()` / `.unlessNotEmpty()` | Inverse empty state conditionals |
| `.tap(callback)` | Inspect model instance in chain without modifying it |
| `.pipe(callback)` | Pass model into transform function and return result |
| `.dump(label?)` | Log current query result to console |
| `.dd(label?)` | **Dump & Die**: Log current result and throw Error to stop execution for debugging |

---

### 13. AST Serialization & Extensibility

| Method | Description |
| :--- | :--- |
| `.toAst()` | Export query AST structure as JSON |
| `.fromAst(json)` | Re-hydrate query model from AST JSON |
| `Helix.$model.macro(name, fn)` | Register reusable custom query macros |
| `Helix.$model.registerOperator(op, fn)` | Register custom comparison operators |

---

### 14. Serialization & Result Export

| Method | Description |
| :--- | :--- |
| `.get(key?, defaultValue?)` | Execute query and return final array result |
| `.all()` / `.toArray()` | Alias for `.get()` |
| `.toJSON()` / `.toJson()` | Export result as JSON string or parsed object |

---

## Development & Build

```bash
# Install dependencies
npm install

# Build package
npm run build
```
