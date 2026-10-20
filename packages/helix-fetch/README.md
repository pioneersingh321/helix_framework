# 🌐 Helix Fetch (`@helix/fetch` / `helix-fetch`)

[![Version](https://img.shields.io/badge/version-2.8.7-indigo.svg?style=flat-square)](#)
[![Reactivity](https://img.shields.io/badge/reactivity-helix--signal--native-blue.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

The official high-performance reactive HTTP and data-fetching plugin for **Helix.js**.

`helix-fetch` bridges standard HTTP networking with Helix's fine-grained reactivity system (`reactive`, `ref`). It features built-in in-memory caching with Stale-While-Revalidate (SWR), exponential backoff retries, in-flight request deduplication, priority queueing, background polling with window-focus detection, smart payload auto-serialization, file upload progress tracking, distributed tracing, and event-bus observability.

---

## ⚡ Key Highlights

- ⚡ **Dual Consumption Modes**: Direct Promise resolution with `await` or instant reactive state binding (`data`, `loading`, `error`, `status`, `isSuccess`) for UI templates.
- 📦 **Smart In-Memory Caching & SWR**: TTL-based cache, tag-based invalidation, stale-while-revalidate, and optional memory-cap LRU trimming.
- 🔄 **Resilient Exponential Backoff**: Automatic retries on network failures, timeouts, and 5xx server errors with randomized jitter.
- 🚦 **Request Deduplication & Queue Engine**: Eliminates concurrent duplicate in-flight requests and regulates network traffic with concurrency-limited priority queues.
- ⏱️ **Intelligent Polling & Focus Detection**: Native interval polling that pauses when the document is hidden and re-validates on window focus.
- 📁 **Smart Payload & Multi-part Uploads**: Automatically serializes JSON, form-url-encoded, or converts objects containing `File` / `Blob` / `FileList` into `FormData` with native XHR upload progress.
- 🛡️ **Error Taxonomy & Distributed Tracing**: Structured `FetchError` classification (`offline`, `transport`, `timeout`, `auth`, `validation`, `server`, `parse`) and automated trace header injection (`x-trace-id`, `x-request-id`).
- 🧹 **Automatic Lifecycle Cleanup**: Automatically cancels in-flight requests, aborts timers, and cleans up event listeners when Helix components unmount.

---

## 📦 Installation

### 1. Browser Direct Script (No Build Step)
```html
<!-- Load Helix Core and Helix Fetch Plugin -->
<script src="path/to/helix.js"></script>
<script src="path/to/helix-fetch.min.js"></script>
```

### 2. NPM / ES Module
```bash
npm install helix-fetch
```
```javascript
import Helix from 'helix';
import HelixFetchPlugin from 'helix-fetch';

Helix.use(HelixFetchPlugin, {
  baseURL: 'https://api.example.com',
  timeout: 10000,
  cache: true
});
```

---

## ⚙️ Complete Configuration Reference

You can configure `helix-fetch` globally during plugin installation via `Helix.use(HelixFetchPlugin, options)`, per instance using `Helix.$fetch.create(options)`, or override options per individual request call (e.g. `$fetch.get(url, options)`).

### Master Options Table

| Option | Type | Default | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `baseURL` | `string` | `''` | Global / Instance / Request | Prepend base URL to relative request paths. |
| `timeout` | `number` | `0` | Global / Instance / Request | Request timeout in milliseconds (`0` means no timeout). |
| `headers` | `object` | `{ common: {...}, get: {}, post: {...}, ... }` | Global / Instance / Request | Default request headers partitioned by method (`common`, `get`, `post`, `put`, `patch`, `delete`). |
| `responseType` | `string` | `'json'` | Global / Instance / Request | Parser type: `'json'`, `'text'`, `'blob'`, `'arraybuffer'`, or `'stream'`. |
| `validateStatus` | `Function` | `(s) => (s >= 200 && s < 300) \|\| s === 304` | Global / Instance / Request | Status validation predicate. Throw `FetchError` if false. |
| `cache` | `boolean` | `false` | Global / Instance / Request | Enable in-memory caching engine. |
| `ttl` | `number` | `5000` | Global / Instance / Request | Cache time-to-live in milliseconds (default: 5 seconds). |
| `staleTime` | `number` | `0` | Global / Instance / Request | Stale-While-Revalidate window in ms. If > 0, returns cached data immediately while re-fetching fresh data in the background. |
| `tags` | `string[]` | `[]` | Request | Cache tags attached to the cached entry for targeted invalidation. |
| `invalidateTags` | `string \| string[]` | `undefined` | Request | Tags to invalidate from cache automatically upon request completion. |
| `maxCacheEntries` | `number` | `500` | Global / Instance | Maximum cache entries stored before LRU trimming triggers. |
| `maxCacheMemory` | `number` | `52428800` (50MB) | Global / Instance | Maximum memory consumption threshold for cache in bytes. |
| `memoryCache` | `boolean` | `false` | Global / Instance | Calculate runtime memory size of cache entries and enforce `maxCacheMemory`. |
| `cacheHeaders` | `string[]` | `[]` | Global / Instance / Request | Explicit list of header names to include in cache key generation. Defaults to all headers if empty. |
| `dedupe` | `boolean` | `true` (GET/HEAD) | Request | Coalesce concurrent identical in-flight requests into a single network call. |
| `retry` | `boolean \| number` | `false` | Global / Instance / Request | Enable retry engine or specify retry count. |
| `retryCount` | `number` | `2` | Global / Instance / Request | Max retry attempts before failing. |
| `retryDelay` | `number` | `300` | Global / Instance / Request | Base retry delay in ms. Backoff multiplies exponentially: `retryDelay * 2^attempt + jitter`. |
| `retryCondition` | `Function` | Default network/5xx check | Global / Instance / Request | Predicate `(err) => boolean` returning whether an error should trigger a retry. |
| `queue` | `boolean` | `false` | Global / Instance | Enable request queueing engine to limit concurrent calls. |
| `maxConcurrent` | `number` | `10` | Global / Instance | Max concurrent requests processed simultaneously by the queue. |
| `queueStrategy` | `string` | `'fifo'` | Global / Instance | Queue ordering strategy: `'fifo'` or `'priority'` (Heap). |
| `priority` | `number` | `0` | Request | Task priority for priority queues (higher executes sooner). |
| `priorityAgingMs` | `number` | `5000` | Global / Instance | Aging factor in ms to prevent low-priority task starvation. |
| `polling` | `boolean` | `false` | Global / Instance | Enable background polling engine. |
| `pollInterval` | `number` | `0` | Global / Instance / Request | Polling interval in milliseconds (`0` disables polling). |
| `refetchOnWindowFocus` | `boolean` | `false` | Global / Instance / Request | Re-trigger request when browser tab / window regains focus. |
| `refetchIntervalInBackground`| `boolean` | `false` | Global / Instance / Request | Allow polling to continue when browser tab is inactive/hidden. |
| `upload` | `boolean` | `false` | Global / Instance | Enable native XHR upload transport for file progress tracking. |
| `onUploadProgress` | `Function` | `undefined` | Request | Progress hook for uploads: `(percentage, loaded, total) => void`. |
| `onDownloadProgress` | `Function` | `undefined` | Request | Progress hook for downloads: `(percentage, loaded, total) => void`. |
| `params` | `object` | `undefined` | Request | Query parameters. Supports nested objects, arrays, and dates. |
| `lazy` | `boolean` | `false` | Request | If `true`, avoids executing request immediately; execute manually with `.execute()`. |
| `debounce` | `number` | `0` | Global / Instance / Request | Debounce timer in ms applied to `.refetch()` calls. |
| `loader` | `boolean` | `false` | Global / Instance / Request | Automatically invoke `app.$loader.show()` / `app.$loader.hide()` during requests. |
| `debug` | `boolean` | `false` | Global / Instance | Enable debug tracing and console instrumentation. |
| `debugResponse` | `boolean` | `false` | Global / Instance / Request | Log detailed diagnosis to console when requests fail or return unexpected HTML instead of JSON. |
| `enableTracing` | `boolean` | `false` | Global / Instance | Inject distributed trace headers (`x-trace-id`, `x-request-id`, span IDs). |
| `traceIdHeader` | `string` | `'x-trace-id'` | Global / Instance | Header key for distributed trace ID. |
| `requestIdHeader` | `string` | `'x-request-id'` | Global / Instance | Header key for unique request ID. |
| `onSuccess` | `Function` | `undefined` | Request | Success callback: `(data, state) => void`. |
| `onError` | `Function` | `undefined` | Request | Error callback: `(error, state) => void`. |

---

## 🚀 How to Use Each Configuration

### 1. Basic Requests & Dual Consumption (Promise vs Reactive State)

Every request method (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `request`) returns a **Reactive State Instance** that is also **thenable**.

#### Pattern A: Direct Async/Await
```javascript
// Resolves the parsed data directly
try {
  const users = await Helix.$fetch.get('/api/users');
  console.log('Users list:', users);
} catch (err) {
  console.error('Fetch failed:', err.message, err.classification);
}
```

#### Pattern B: Reactive State for Templates & Components
```javascript
// Creates a reactive state bound directly into your Helix component or store
const req = Helix.$fetch.get('/api/products', {
  params: { category: 'electronics', inStock: true }
});

// Access reactive properties anywhere in templates:
// req.data       -> Response payload (initially null)
// req.loading    -> true during foreground request
// req.isFetching -> true whenever request is in-flight
// req.error      -> FetchError instance or null
// req.status     -> HTTP status code (200, 404, etc.)
// req.isSuccess  -> Boolean flag
// req.isError    -> Boolean flag
// req.isIdle     -> Boolean flag before first request
```

---

### 2. Custom Instances (`$fetch.create`)

Create isolated API clients with tailored base URLs, auth headers, and timeouts:

```javascript
const apiClient = Helix.$fetch.create({
  baseURL: 'https://api.myapp.com/v1',
  timeout: 8000,
  headers: {
    common: {
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
  }
});

// All requests use the instance defaults
const profile = await apiClient.get('/auth/me');
await apiClient.post('/orders', { items: [1, 2] });
```

---

### 3. HTTP Status Validation (`validateStatus`)

`validateStatus` defines whether an HTTP response status code should be resolved as a success or rejected with a `FetchError`.

#### Default Validation
By default, `helix-fetch` considers any status code in the `2xx` range or `304 Not Modified` as successful:
```javascript
// Default validator
validateStatus: (status) => (status >= 200 && status < 300) || status === 304
```

Whenever `validateStatus(status)` returns `false`:
1. `helix-fetch` attempts to parse the error body according to `responseType` (accessible via `err.data`).
2. An error taxonomy classification is assigned (`'auth'`, `'validation'`, `'server'`, `'client'`, etc.).
3. The promise rejects (or sets `state.error` and `state.isError = true`).

#### Understanding `await` vs Reactive `state.status`
When you `await` a request, it resolves directly to the parsed response body (`data`). To inspect the HTTP status code (such as checking whether it was `200`, `404`, or `422`), keep a reference to the reactive request instance (`req.status`):

```javascript
const req = Helix.$fetch.post('/api/register', formData, {
  validateStatus: (status) => status < 500
});
const data = await req; // 'data' is the parsed response body

console.log(req.status); // 422
```

#### Handling `422 (Unprocessable Entity)`

There are two primary ways to handle `422 Unprocessable Entity` in `helix-fetch`:

##### Approach A: Default Behavior (Catching `FetchError`)
Under default configuration (`validateStatus: 2xx | 304`), a `422` status automatically throws a `FetchError` with `err.classification === 'validation'`. The server's validation error payload is accessible in `err.data`:

```javascript
try {
  const user = await Helix.$fetch.post('/api/register', formData);
  console.log('Registered successfully:', user);
} catch (err) {
  if (err.status === 422) {
    console.warn('Validation error:', err.classification); // "validation"
    console.warn('Server error details:', err.data);       // e.g. { errors: { email: ['Already in use'] } }
  } else {
    console.error('Network or server failure:', err.message);
  }
}
```

##### Approach B: Bypassing Error Throwing with Custom `validateStatus`
If you prefer handling `422` inline without `try...catch`, configure `validateStatus` to accept `422` as a valid response:

```javascript
const req = Helix.$fetch.post('/api/register', formData, {
  // Allow 2xx and 422 to resolve successfully without throwing
  validateStatus: (status) => (status >= 200 && status < 300) || status === 422
});

const data = await req;

if (req.status === 422) {
  // 422 Unprocessable Entity: inspect validation messages from the response payload
  displayValidationFeedback(data.errors);
} else {
  // 200/201 Success
  navigateToDashboard(data.user);
}
```

##### Approach C: Reactive Template Binding (No `await` required)
In Helix components, bind directly to the reactive request state:

```javascript
export default {
  setup() {
    const register = Helix.$fetch.post('/api/register', null, { lazy: true });

    const submit = async (formData) => {
      try {
        await register.execute(formData);
      } catch (err) {
        // Handled reactively in template via register.error.data
      }
    };

    return { register, submit };
  }
};
```
```html
<!-- In Template: automatically updates when 422 occurs -->
<div v-if="register.isError && register.error?.status === 422" class="alert-danger">
  <p v-for="msg in register.error.data.errors">{{ msg }}</p>
</div>
```

#### Global Plugin or Instance Configuration
```javascript
// Global configuration: resolve all status codes below 500 across your entire app
Helix.use(HelixFetchPlugin, {
  baseURL: 'https://api.example.com',
  validateStatus: (status) => status < 500
});

// Custom instance configuration
const api = Helix.$fetch.create({
  baseURL: 'https://api.example.com',
  validateStatus: (status) => (status >= 200 && status < 300) || status === 404 || status === 422
});
```

---

### 4. Caching & Stale-While-Revalidate (SWR)

`helix-fetch` includes an in-memory cache engine with Stale-While-Revalidate (SWR) support and tag-based invalidation.

```javascript
Helix.use(HelixFetchPlugin, {
  cache: true,              // Enable cache engine
  ttl: 60000,               // 60 seconds TTL
  staleTime: 15000,         // Serve stale data instantly if under 15s old, revalidate in background
  maxCacheEntries: 200,     // Evict oldest entries once limit is reached
  memoryCache: true,        // Track memory footprint
  maxCacheMemory: 20 * 1024 * 1024 // 20 MB cap
});
```

#### Per-Request Cache Tags & Invalidation
```javascript
// Cache request with tags
const usersReq = Helix.$fetch.get('/users', {
  cache: true,
  ttl: 30000,
  tags: ['users', 'user-directory']
});

// Invalidate on mutation
await Helix.$fetch.post('/users', { name: 'Alice' }, {
  invalidateTags: ['users'] // Automatically invalidates matching cached entries
});

// Manual Cache Invalidation
Helix.$fetch.invalidate('user-directory'); // Substring / Tag match
Helix.$fetch.invalidateExact('GET||https://api.com/users|{}|null|{}'); // Exact cache key
Helix.$fetch.clearCache(); // Purge entire cache
```

---

### 5. Automatic Retries & Exponential Backoff

Handle intermittent network drops and transient server issues automatically.

```javascript
const data = await Helix.$fetch.get('/analytics/metrics', {
  retry: true,              // Enable retry
  retryCount: 3,            // Retry up to 3 times
  retryDelay: 500,          // Base delay in ms
  retryCondition: (err) => {
    // Only retry network errors, timeouts, or 502/503/504 gateway failures
    return err.classification === 'transport' || 
           err.classification === 'timeout' || 
           [502, 503, 504].includes(err.status);
  }
});
```

> [!NOTE]
> Exponential backoff delays each attempt using: `retryDelay * (2 ^ attempt) + randomizedJitter` to avoid thundering herd issues on backend servers.

---

### 6. In-Flight Request Deduplication

Prevents duplicate simultaneous network calls for the same resource (defaults to `true` for `GET` and `HEAD` methods):

```javascript
// If called concurrently from three different components:
const req1 = Helix.$fetch.get('/settings');
const req2 = Helix.$fetch.get('/settings');
const req3 = Helix.$fetch.get('/settings');

// Only 1 real HTTP request is sent over the wire; all callers share the identical response.

// Disable deduplication if explicitly needed:
const freshData = await Helix.$fetch.get('/random-token', { dedupe: false });
```

---

### 7. Concurrency Limiting & Priority Queue

Queue outgoing HTTP requests to prevent browser socket exhaustion and prioritize critical requests over background calls.

```javascript
Helix.use(HelixFetchPlugin, {
  queue: true,
  maxConcurrent: 4,          // Process maximum 4 requests at the same time
  queueStrategy: 'priority', // Use binary heap priority queue
  priorityAgingMs: 3000      // Low priority tasks age upwards over time to prevent starvation
});

// Low-priority background sync
Helix.$fetch.get('/logs/sync', { priority: 1 });

// High-priority user-facing action
Helix.$fetch.get('/checkout/summary', { priority: 100 });
```

---

### 8. Background Polling & Window Focus Revalidation

Keep views fresh with auto-polling and revalidation when the user returns to the tab.

```javascript
const liveData = Helix.$fetch.get('/dashboard/live-feed', {
  polling: true,
  pollInterval: 5000,                  // Poll every 5 seconds
  refetchOnWindowFocus: true,          // Immediately re-fetch when tab gains focus
  refetchIntervalInBackground: false   // Pause timer when browser tab is inactive/hidden
});

// Control polling programmatically on the reactive instance:
liveData.stopPolling();
liveData.startPolling();
liveData.pausePolling();
liveData.resumePolling();
```

---

### 9. Smart Payloads & File Uploads

`helix-fetch` inspects request bodies and formats them intelligently:

1. **HTML Form Elements**: Automatically serialized using recursive bracket notation (`user[name]`, `tags[]`).
2. **File / Blob / FileList**: Automatically converted into `FormData` with multi-part headers handled by the browser.
3. **Url Encoded**: If `Content-Type: application/x-www-form-urlencoded` is passed, plain objects are converted to `URLSearchParams`.
4. **JSON**: Default serialization via `JSON.stringify`.

#### Upload with Native Progress Tracking
```javascript
// Upload files with real-time percentage
await Helix.$fetch.upload('/api/avatar/upload', {
  formData: {
    avatar: fileInput.files[0],
    userId: 42
  },
  onUploadProgress: (percent, loaded, total) => {
    console.log(`Upload progress: ${percent}% (${loaded}/${total} bytes)`);
  }
});
```

#### Download Progress Tracking
```javascript
const report = await Helix.$fetch.get('/reports/annual.pdf', {
  responseType: 'blob',
  onDownloadProgress: (percent, loaded, total) => {
    console.log(`Download progress: ${percent}%`);
  }
});
```

---

### 10. Lazy Requests & Mutations (`$fetch.mutate`)

For user actions like form submissions, avoid immediate auto-fetching by using `lazy: true` or the `$fetch.mutate()` helper:

```javascript
// Define a mutation (lazy POST by default)
const saveUser = Helix.$fetch.mutate('/api/users');

// Or using .post with lazy option:
const updateProfile = Helix.$fetch.put('/api/profile', null, { lazy: true });

// Trigger manually when user clicks button:
async function onSubmit(formData) {
  try {
    const result = await saveUser.execute(formData);
    console.log('Saved:', result);
  } catch (err) {
    console.error('Failed to save:', saveUser.error);
  }
}
```

#### Fluent Event Hooks
```javascript
const deleteItem = Helix.$fetch.delete('/items/12', { lazy: true })
  .onSuccess((data, state) => {
    Helix.$toast.success('Item deleted successfully');
  })
  .onError((err, state) => {
    Helix.$toast.error('Could not delete item: ' + err.message);
  });

deleteItem.execute();
```

---

### 11. Interceptors Pipeline

Add authentication tokens, format request payloads, or transform responses globally:

```javascript
// Request Interceptor
const unregisterReq = Helix.$fetch.addRequestInterceptor((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor
const unregisterRes = Helix.$fetch.addResponseInterceptor((data, response) => {
  // Example: unwrap nested API envelope { code: 200, result: { ... } }
  if (data && data.result) {
    return data.result;
  }
  return data;
});

// Call unregisterReq() or unregisterRes() to remove interceptors when done.
```

---

### 12. Distributed Tracing & Debug Diagnostics

Trace requests end-to-end across microservices and catch server misconfigurations.

```javascript
Helix.use(HelixFetchPlugin, {
  debug: true,
  enableTracing: true,
  traceIdHeader: 'x-trace-id',
  requestIdHeader: 'x-request-id',
  debugResponse: true // Inspect unexpected HTML responses when JSON was expected
});
```

When enabled:
- Generates and attaches unique trace IDs (`x-trace-id`, `x-request-id`) to outgoing headers.
- If a backend returns an HTML 500 error page instead of JSON, `debugResponse` formats a detailed collapsed console group showing URL, Method, Status, Trace IDs, and sanitized HTML snippets.

---

### 13. Global Loader Integration

Automatically bind UI loading spinners to network activity:

```javascript
Helix.use(HelixFetchPlugin, {
  loader: true // Automatically calls app.$loader.show() and app.$loader.hide()
});

// Per-request override:
Helix.$fetch.get('/silent-heartbeat', { loader: false });
```

---

### 14. Error Handling & `FetchError` Taxonomy

All request failures (including those failing `validateStatus`) throw or populate `state.error` with a structured `FetchError`:

```javascript
try {
  await Helix.$fetch.get('/protected-resource');
} catch (err) {
  console.log(err.name);           // "FetchError"
  console.log(err.message);        // Error description (e.g. "Request failed with status 401")
  console.log(err.status);         // HTTP status code (e.g. 401, 500, 0)
  console.log(err.classification); // Categorized error type
  console.log(err.data);           // Parsed error payload returned by server
  console.log(err.trace);          // { traceId, requestId, spanId }
}
```

#### Error Classifications (`err.classification`)

| Classification | Condition / Source |
| :--- | :--- |
| `'offline'` | Device is offline (`navigator.onLine === false`) or network interface down. |
| `'transport'` | Network fetch failed, connection refused, or socket reset. |
| `'timeout'` | Request exceeded configured `timeout` limit or returned `408`. |
| `'dns'` | DNS lookup failed (`ENOTFOUND`, `getaddrinfo`). |
| `'auth'` | Status code `401 Unauthorized` or `403 Forbidden`. |
| `'validation'` | Status code `400 Bad Request` or `422 Unprocessable Entity`. |
| `'conflict'` | Status code `409 Conflict`. |
| `'server'` | Status code `5xx` (Internal Server Error, Bad Gateway, etc.). |
| `'client'` | Any other client error with status `4xx`. |
| `'parse'` | Response failed JSON parsing (e.g., server returned HTML error page). |
| `'unknown'` | Unclassified failure. |

---

### 15. Event Bus Observability (`fetch:*`)

`helix-fetch` broadcasts lifecycle events to `Helix.$bus`:

```javascript
Helix.$bus.on('fetch:request:start', ({ url, method, trace }) => {
  console.log(`[HTTP START] ${method} ${url}`, trace);
});

Helix.$bus.on('fetch:request:success', ({ url, status, data }) => {
  console.log(`[HTTP SUCCESS] ${status} ${url}`);
});

Helix.$bus.on('fetch:request:error', ({ url, error, classification }) => {
  console.warn(`[HTTP ERROR] ${classification} on ${url}:`, error.message);
});

Helix.$bus.on('fetch:cache:hit', ({ key }) => {
  console.log(`[CACHE HIT] ${key}`);
});

Helix.$bus.on('fetch:retry:attempt', ({ attempt, delay, err }) => {
  console.log(`[RETRY] Attempt #${attempt} after ${delay}ms`);
});
```

---

### 16. Lifecycle & Component Auto-Cleanup

When a Helix component unmounts, any pending requests, active polling timers, visibility watchers, and queued tasks initiated within that component are automatically aborted and cleaned up:

```javascript
export default {
  setup() {
    // Inside a component:
    const data = Helix.$fetch.get('/live-data', {
      polling: true,
      pollInterval: 3000
    });

    // When this component unmounts:
    // 1. In-flight HTTP request is aborted (AbortController)
    // 2. Polling interval timer is cleared
    // 3. Document visibility listeners are detached
    // 4. Any queued items are cancelled
    return { data };
  }
};
```

You can also trigger manual cleanup on any request instance by calling `stateInstance.cancel()` or `stateInstance._cleanup()`.

---

## 📄 License

MIT © Helix Framework Team
