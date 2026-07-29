# @helix/fetch (`helix-fetch`)

The official reactive HTTP & data fetching plugin for **Helix.js**.

`helix-fetch` provides a reactive data-fetching layer with built-in caching, automatic retries, request deduplication, upload progress tracking, request queueing, and event bus tracing.

---

## Features

- ⚡ **Reactive Data Fetching**: Seamless integration with Helix reactivity (`reactive`, `ref`).
- 🔄 **Automatic Retries & Exponential Backoff**: Retries failed network calls (`5xx`, timeout, offline) with configurable backoff logic.
- 📦 **Smart Caching Engine**: In-memory caching with TTL, max memory cap, and stale-while-revalidate capability.
- 🚦 **Request Deduplication & Queueing**: Prevents duplicate in-flight requests and limits max concurrent HTTP tasks.
- 📤 **Upload Progress Tracking**: Native XHR upload progress monitoring via `onUploadProgress`.
- 🔍 **Interceptors & Tracing**: Custom request/response interceptor pipelines and trace headers (`x-trace-id`, `x-request-id`).

---

## Installation

### CDN / Browser Script
```html
<script src="path/to/helix.js"></script>
<script src="path/to/helix-fetch.js"></script>
```

### ES Module Import
```javascript
import HelixFetchPlugin from 'helix-fetch';

Helix.use(HelixFetchPlugin, {
  baseURL: 'https://api.example.com',
  timeout: 10000
});
```

---

## Usage

### 1. Simple Requests
```javascript
// GET Request
const users = await Helix.$fetch.get('/users');

// POST Request
const newUser = await Helix.$fetch.post('/users', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});
```

### 2. Creating Custom Instances
```javascript
const api = Helix.$fetch.create({
  baseURL: 'https://api.myapp.com/v1',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const profile = await api.get('/me');
```

### 3. Interceptors
```javascript
Helix.$fetch.interceptors.request.use((config) => {
  config.headers['X-Custom-Header'] = 'HelixFetch';
  return config;
});

Helix.$fetch.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message);
    return Promise.reject(error);
  }
);
```

---

## API Reference

- `Helix.$fetch.get(url, options)`: Send a GET request.
- `Helix.$fetch.post(url, data, options)`: Send a POST request.
- `Helix.$fetch.put(url, data, options)`: Send a PUT request.
- `Helix.$fetch.delete(url, options)`: Send a DELETE request.
- `Helix.$fetch.upload(url, options)`: Upload files with progress tracking.
- `Helix.$fetch.create(options)`: Create an isolated instance with preset defaults.
- `Helix.$fetch.interceptors`: Manage `request` and `response` interceptor stacks.

---

## License

MIT © Helix Framework Team
