# helix-axios

Axios HTTP Plugin for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

## Installation

```html
<script src="axios.js"></script>
<script src="helix.js"></script>
<script src="helix-axios.js"></script>
```

## Features

- **Standard HTTP Clients**: Promises-based `get`, `post`, `put`, `patch`, `delete`, `head`, and `options` methods.
- **Fine-Grained Reactivity**: Hook-based APIs `useGet`, `usePost`, `usePut`, `usePatch`, `useDelete`, and `useUpload` that map directly to reactive states.
- **Request Deduplication**: Hashing and sharing in-flight requests to save network traffic.
- **Auto-retry with Jitter**: Exponential backoff and full-jitter retries for failing requests.
- **CSRF Token Reader**: Anchored cookie reader to seamlessly attach CSRF headers on requests.

## Usage

```javascript
// Register plugin
Helix.use(HelixAxiosPlugin, {
  baseURL: '/api'
});

// Imperative request
Helix.$http.get('/users').then(users => {
  console.log(users);
});

// Reactive request inside component
const request = Helix.$http.useGet('/profile');
// returns reactive state: request.data, request.loading, request.error
```

## Development

Install dependencies:
```bash
npm install
```

Build the package:
```bash
npm run build
```
