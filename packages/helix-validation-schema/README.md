# @helix/validation-schema (`helix-validation-schema`)

Schema validation adapter plugin for **Helix.js** (v2.1.5).

`helix-validation-schema` extends `helix-validation` to support external schema validation libraries like **Zod**, **Yup**, and **Ajv** seamlessly with reactive forms and validation directives.

---

## Supported Schema Engines

- 🔷 **Zod**: `zodAdapter(schema)`
- 🟡 **Yup**: `yupAdapter(schema)`
- 🔴 **Ajv** (JSON Schema): `ajvAdapter(validateFn)`

---

## Installation & Setup

### CDN / Browser Script
```html
<script src="path/to/helix.js"></script>
<script src="path/to/helix-validation.js"></script>
<script src="path/to/helix-validation-schema.js"></script>
```

### ES Module Import
```javascript
import HelixValidationPlugin from 'helix-validation';
import HelixValidationSchemaPlugin, { zodAdapter, yupAdapter } from 'helix-validation-schema';

Helix.use(HelixValidationPlugin);
Helix.use(HelixValidationSchemaPlugin);
```

---

## Usage Examples

### 1. Zod Integration
```javascript
import { z } from 'zod';
import { zodAdapter } from 'helix-validation-schema';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address')
});

const validateUser = zodAdapter(userSchema);

const result = await validateUser({
  username: 'jo',
  email: 'invalid-email'
});

console.log(result);
// Output: { valid: false, errors: { username: [...], email: [...] } }
```

### 2. Yup Integration
```javascript
import * as yup from 'yup';
import { yupAdapter } from 'helix-validation-schema';

const schema = yup.object().shape({
  age: yup.number().required().min(18)
});

const validateAge = yupAdapter(schema);
```

### 3. Direct Integration with Reactive Forms
```javascript
Helix.mount('#app', ({ $validation, reactive }) => {
  const form = reactive({ username: '', email: '' });

  const validate = $validation.zodAdapter(userSchema);

  const submit = async () => {
    const res = await validate(form);
    if (!res.valid) {
      console.log('Form Validation Errors:', res.errors);
    }
  };

  return { form, submit };
});
```

---

## API Reference

- `adapters.add(name, adapterFn)`: Register a custom schema adapter.
- `zodAdapter(zodSchema)`: Adapter for Zod schemas.
- `yupAdapter(yupSchema)`: Adapter for Yup schemas.
- `ajvAdapter(ajvValidateFn)`: Adapter for Ajv JSON schema validators.

---

## License

MIT © Helix Framework Team
