# @helix/notify (`helix-notify`)

Premium alert, toast, and modal notification plugin for **Helix.js** (v2.2.6).

`helix-notify` provides flexible notifications (`$notify.success`, `$notify.error`, `$notify.toast`, `$notify.confirm`) with 6 built-in premium themes (`clinical`, `glass`, `dark`, `neon`, `brutal`, `aurora`).

---

## Features

- 🎨 **6 Premium Visual Themes**: `clinical`, `glass` (glassmorphism), `dark`, `neon`, `brutal`, and `aurora`.
- 🔔 **Toast & Modal Alerts**: Success, error, warning, info toasts, confirm dialogs, and prompt prompts.
- ⚡ **Seamless Integration**: Access via `Helix.$notify` globally or destructure `{ $notify }` in component setups.
- 🗂️ **Toast Queueing**: Manages toast stack limits and auto-dismiss timers gracefully.

---

## Prerequisites

`helix-notify` requires **SweetAlert2**. Make sure to load SweetAlert2 before initializing `helix-notify`.

```html
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
```

---

## Installation & Setup

### CDN / Browser Script
```html
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="path/to/helix.js"></script>
<script src="path/to/helix-notify.js"></script>
```

### JS Initialization
```javascript
import HelixNotifyPlugin from 'helix-notify';

Helix.use(HelixNotifyPlugin, {
  theme: 'glass', // 'clinical' | 'glass' | 'dark' | 'neon' | 'brutal' | 'aurora'
  toastTimer: 3000
});
```

---

## Usage Examples

### 1. Simple Toasts
```javascript
Helix.$notify.toast('Data saved successfully!', 'success');
Helix.$notify.toast('Connection lost', 'error');
```

### 2. Alert Modals
```javascript
// Success Alert
Helix.$notify.success('User Created', 'New account has been provisioned.');

// Error Alert
Helix.$notify.error('Payment Failed', 'Card was declined by bank.');

// Warning Alert
Helix.$notify.warning('Storage Low', 'Disk usage is above 90%.');
```

### 3. Confirm Dialog
```javascript
const confirmed = await Helix.$notify.confirm({
  title: 'Delete Item?',
  text: 'This action cannot be undone.',
  confirmButtonText: 'Yes, delete it!'
});

if (confirmed) {
  console.log('Item deleted');
}
```

### 4. Component Setup Context
```javascript
Helix.mount('#app', ({ $notify, reactive }) => {
  const state = reactive({ name: '' });

  const save = () => {
    $notify.toast('Saved settings', 'success');
  };

  return { state, save };
});
```

---

## Themes Overview

- **`clinical`**: Clean, modern enterprise UI theme.
- **`glass`**: Vibrant glassmorphism with dynamic backdrop blur.
- **`dark`**: Sleek dark mode theme.
- **`neon`**: Glowing futuristic dark UI theme.
- **`brutal`**: Bold neo-brutalist design aesthetic.
- **`aurora`**: Vibrant gradient theme.

---

## License

MIT © Helix Framework Team
