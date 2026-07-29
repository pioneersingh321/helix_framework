/**
 * Helix.js Form Plugin v2.0
 * Aligned with Helix.js v11.1.5 Plugin Architecture
 *
 * Features:
 * - Serialize DOM forms to structured JSON (supports nested arrays/objects via name="foo[bar][]")
 * - Type casting via colon suffix: name="age:number", name="active:boolean"
 * - File upload support (single/multiple)
 * - Checkbox/radio/select-multiple handling
 * - Convert JSON to FormData for multipart uploads
 * - v-form directive for reactive form submission
 * - Plugin metadata, cleanup lifecycle, namespaced API
 */

const HelixFormPlugin = {
    // ==========================================
    // PLUGIN METADATA (Helix v11.1.5)
    // ==========================================
    name: 'form',
    version: '2.0.0',
    requires: {
        helix: '>=11.1.5'
    },

    install(app, options = {}) {

        const defaults = {
            emptyAsNull: true,
            includeUnchecked: false,
            ...options
        };

        // ==========================================
        // 1. UTILS
        // ==========================================
        const isArray = Array.isArray;

        const parseValue = (value, type) => {
            switch (type) {
                case 'number':
                    return value === '' ? null : Number(value);
                case 'boolean':
                    return !['false', '0', '', null, false, undefined].includes(value);
                case 'null':
                    return value ? value : null;
                case 'array':
                case 'object':
                    try { return JSON.parse(value); } catch { return value; }
                default:
                    return value;
            }
        };

        const splitType = (name) => {
            const parts = name.split(':');
            return parts.length > 1
                ? [parts.slice(0, -1).join(':'), parts.at(-1)]
                : [name, null];
        };

        const getKeys = (name) => name.replace(/\]/g, '').split('[');

        /**
         * Deep set a value into an object using key path.
         * Keys like 'foo[bar][]' become ['foo', 'bar', ''].
         * Empty string '' as key means append to array.
         */
        const deepSet = (obj, keys, value) => {
            let current = obj;

            keys.forEach((key, i) => {
                const isLast = i === keys.length - 1;

                if (isLast) {
                    if (key === '') {
                        // Append to array
                        if (!isArray(current)) {
                            console.warn('[Helix Form] deepSet: expected array but got', typeof current, '- wrapping in array');
                            // Cannot safely recover here; skip
                            return;
                        }
                        current.push(value);
                    } else {
                        // Implicit array coercion if multiple inputs share the same key without []
                        if (current[key] !== undefined) {
                            if (!isArray(current[key])) {
                                current[key] = [current[key]];
                            }
                            current[key].push(value);
                        } else {
                            current[key] = value;
                        }
                    }
                    return;
                }

                // Intermediate key
                let nextKey = key;
                if (nextKey === '') {
                    // Next segment is array index
                    if (!isArray(current)) {
                        console.warn('[Helix Form] deepSet: expected array for empty key but got', typeof current);
                        return;
                    }
                    nextKey = current.length;
                }

                if (!current[nextKey]) {
                    // Peek ahead: if next key is '', create array, else object
                    current[nextKey] = keys[i + 1] === '' ? [] : {};
                }

                current = current[nextKey];
            });
        };

        // ==========================================
        // 2. SERIALIZER
        // ==========================================
        const serializeJSON = (form, opts = {}) => {
            const config = { ...defaults, ...opts };
            const data = {};
            const elements = form.querySelectorAll('input, select, textarea');

            elements.forEach(el => {
                // Ignore unnamed, disabled, or inputs inside a disabled fieldset
                if (!el.name || el.disabled || el.closest('fieldset[disabled]')) return;

                const type = el.type?.toLowerCase?.() || '';
                if (['submit', 'button', 'reset'].includes(type)) return;

                let value;
                let skipNormalPath = false;

                if (type === 'checkbox') {
                    if (!el.checked) {
                        if (config.includeUnchecked) {
                            value = false;
                        } else {
                            return; // Skip unchecked
                        }
                    } else {
                        value = el.hasAttribute('value') ? el.value : true;
                    }

                    // Handle checkbox arrays: name="tags[]" or name="tags[]:number"
                    if (el.name.includes('[]')) {
                        const [name, valueType] = splitType(el.name);
                        const keys = getKeys(name);
                        const parsed = parseValue(value, valueType);
                        deepSet(data, keys, parsed);
                        skipNormalPath = true;
                    }
                }
                else if (type === 'radio') {
                    if (!el.checked) return;
                    value = el.value;
                }
                else if (type === 'file') {
                    if (el.files.length === 0) return;
                    value = el.multiple ? Array.from(el.files) : el.files[0];
                }
                else if (el.tagName === 'SELECT' && el.multiple) {
                    value = Array.from(el.selectedOptions).map(opt => opt.value);
                }
                else {
                    value = el.value;
                }

                if (skipNormalPath) return;

                // Convert empty strings to null (database-friendly)
                if (value === '' && config.emptyAsNull) {
                    value = null;
                }

                let [name, valueType] = splitType(el.name);

                // Do not attempt to string-parse binary File objects
                if (type !== 'file' && !(value instanceof File) && !isArray(value)) {
                    value = parseValue(value, valueType);
                }

                const keys = getKeys(name);
                deepSet(data, keys, value);
            });

            return data;
        };

        // ==========================================
        // 3. MULTIPART CONVERTER
        // ==========================================
        const toFormData = (data, formData = new FormData(), parentKey = '') => {
            if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
                if (isArray(data)) {
                    data.forEach((item, index) => {
                        const formKey = parentKey ? `${parentKey}[${index}]` : `[${index}]`;
                        toFormData(item, formData, formKey);
                    });
                } else {
                    Object.keys(data).forEach(key => {
                        const formKey = parentKey ? `${parentKey}[${key}]` : key;
                        toFormData(data[key], formData, formKey);
                    });
                }
            } else {
                const value = data === null ? '' : data;
                formData.append(parentKey, value);
            }
            return formData;
        };

        // ==========================================
        // 4. DIRECTIVE: v-form
        // ==========================================
        // Store per-element cleanup functions
        const directiveCleanups = new WeakMap();

        app.directive('form', {
            mounted(el, binding) {
                const expr = binding.value;
                const ctx = binding.ctx;

                const handler = (e) => {
                    e.preventDefault();

                    const formData = serializeJSON(el, { emptyAsNull: true });
                    const fn = app.resolvePath ? app.resolvePath(expr, ctx) : null;

                    if (typeof fn === 'function') {
                        fn.call(ctx, formData, e);
                    } else {
                        console.warn(`[Helix Form] v-form handler not found: ${expr}`);
                    }
                };

                el.addEventListener('submit', handler);

                directiveCleanups.set(el, () => {
                    el.removeEventListener('submit', handler);
                });
            },

            unmounted(el) {
                const cleanup = directiveCleanups.get(el);
                if (cleanup) {
                    cleanup();
                    directiveCleanups.delete(el);
                }
            }
        });

        // ==========================================
        // 5. PUBLIC API
        // ==========================================
        const $form = {
            serializeJSON,
            toFormData,

            /**
             * Smart payload preparation.
             * If the JSON contains File objects, converts to FormData.
             * Otherwise returns the JSON object as-is.
             */
            preparePayload: (jsonPayload) => {
                const containsFiles = (obj) => {
                    if (!obj || typeof obj !== 'object') return false;
                    if (obj instanceof File) return true;
                    if (isArray(obj)) return obj.some(containsFiles);
                    return Object.values(obj).some(containsFiles);
                };

                return containsFiles(jsonPayload) ? toFormData(jsonPayload) : jsonPayload;
            },

            /**
             * Check if a value is a File or Blob.
             */
            isFile: (val) => val instanceof File || val instanceof Blob,

            /**
             * Check if a payload needs multipart encoding.
             */
            needsMultipart: (payload) => {
                const containsFiles = (obj) => {
                    if (!obj || typeof obj !== 'object') return false;
                    if (obj instanceof File || obj instanceof Blob) return true;
                    if (isArray(obj)) return obj.some(containsFiles);
                    return Object.values(obj).some(containsFiles);
                };
                return containsFiles(payload);
            }
        };

        // ==========================================
        // NAMESPACED API REGISTRATION (Helix v11.1.5)
        // ==========================================
        app.namespace('form', {
            $form,
            serializeJSON: $form.serializeJSON,
            toFormData: $form.toFormData,
            preparePayload: $form.preparePayload
        });

        // Backward compatibility: flat access
        app.$form = $form;

        // Provide for inject()
        if (app.provide) {
            app.provide('$form', $form);
        }

        // ==========================================
        // CLEANUP LIFECYCLE (Helix v11.1.5)
        // ==========================================
        return () => {
            // Remove any remaining directive listeners
            // WeakMap auto-cleans when elements are GC'd
            directiveCleanups = new WeakMap();
        };
    }
};