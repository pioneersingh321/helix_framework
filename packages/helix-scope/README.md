# helix-scope

Helix Scope Plugin v2.0 for the [Helix.js Framework](https://github.com/pioneersingh321/helix_framework).

## Installation

```html
<script src="helix.js"></script>
<script src="helix-scope.js"></script>
```

## Features

- **Scope Manager**: `Helix.scope` API to refresh, reset, abort, and get controllers.
- **Controller Architecture**: Every scope has a controller that tracks states (`$loading`, `$error`, `$data`), handles defaults and can be programmatically controlled.
- **Expression-based Defaults**: Support `<div h-scope:user="loadUser()" h-scope-default:user="store.defaultUser"></div>` for dynamic default values.
- **AbortController Support**: Native cancellation via `$signal` in your expressions.
- **Deep Merge & Array Strategies**: Deep-merge results with defaults and customize array operations.
- **Multiple Scopes**: Bind multiple scopes on the same element (`h-scope:user="..." h-scope:posts="..."`).

## Development

Install dependencies:
```bash
npm install
```

Build the package:
```bash
npm run build
```
