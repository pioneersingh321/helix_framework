/**
 * Helix.js Form Plugin v2.1.0
 * Aligned with Helix.js v11.1.17+ Plugin Architecture
 *
 * Features:
 * - Serialize DOM forms to structured JSON (supports nested arrays/objects via name="foo[bar][]")
 * - Type casting via colon suffix: name="age:number", name="active:boolean"
 * - File upload support (single/multiple)
 * - Checkbox/radio/select-multiple handling
 * - Convert JSON to FormData for multipart uploads
 * - v-form directive for reactive form submission
 * - UMD / IIFE / Global export support for browser, CJS, and ESM environments
 * - Plugin metadata, cleanup lifecycle, namespaced API
 */

(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        const root = typeof window !== 'undefined' ? window : globalThis;
        const plugin = factory();
        root.HelixFormPlugin = plugin;

        // Auto-register if global Helix instance is present
        if (root.Helix && typeof root.Helix.use === 'function') {
            try {
                root.Helix.use(plugin);
            } catch (e) {
                // Ignore if already installed or pending app creation
            }
        }
    }
})(this, function () {
    'use strict';

    let directiveCleanups = new WeakMap();

    const HelixFormPlugin = {
        // ==========================================
        // PLUGIN METADATA (Helix v11.1.17+)
        // ==========================================
        name: 'form',
        version: '2.1.0',
        requires: {
            helix: '>=11.1.16'
        },

        install(app, options = {}) {
            const defaults = {
                emptyAsNull: true,
                includeUnchecked: false,
                stripTypeSuffixes: true,
                ...options
            };

            // ==========================================
            // 1. UTILS
            // ==========================================
            const isArray = Array.isArray;

            const parseValue = (value, type) => {
                if (!type) return value;
                const typeLower = String(type).toLowerCase().trim();

                switch (typeLower) {
                    case 'number': {
                        if (value === '' || value === null || value === undefined) return null;
                        const num = Number(value);
                        return isNaN(num) ? value : num;
                    }
                    case 'boolean': {
                        if (typeof value === 'boolean') return value;
                        const strVal = String(value).toLowerCase().trim();
                        return !['false', '0', '', 'null', 'undefined', 'off'].includes(strVal);
                    }
                    case 'null':
                        return value ? value : null;
                    case 'array':
                    case 'object':
                    case 'json':
                        try {
                            return JSON.parse(value);
                        } catch {
                            return value;
                        }
                    case 'string':
                        return value !== null && value !== undefined ? String(value) : '';
                    default:
                        return value;
                }
            };

            const splitType = (name) => {
                if (!name || typeof name !== 'string') return [name, null];
                const lastColonIndex = name.lastIndexOf(':');
                const lastBracketIndex = name.lastIndexOf(']');
                if (lastColonIndex > lastBracketIndex && lastColonIndex > 0) {
                    const baseName = name.slice(0, lastColonIndex);
                    const type = name.slice(lastColonIndex + 1);
                    return [baseName, type];
                }
                return [name, null];
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
                                if (typeof console !== 'undefined' && console.warn) {
                                    console.warn('[Helix Form] deepSet: expected array but got', typeof current, '- wrapping in array');
                                }
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
                        if (!isArray(current)) {
                            if (typeof console !== 'undefined' && console.warn) {
                                console.warn('[Helix Form] deepSet: expected array for empty key but got', typeof current);
                            }
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

                if (!form || typeof form.querySelectorAll !== 'function') {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('[Helix Form] serializeJSON: provided target is not a valid DOM form or element container.');
                    }
                    return data;
                }

                const elements = form.querySelectorAll('input, select, textarea');

                elements.forEach(el => {
                    // Ignore unnamed, disabled, or inputs inside a disabled fieldset
                    if (!el.name || el.disabled || el.closest('fieldset[disabled]')) return;

                    const type = el.type?.toLowerCase?.() || '';
                    if (['submit', 'button', 'reset', 'image'].includes(type)) return;

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
                        if (!el.files || el.files.length === 0) return;
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
                if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File) && !(typeof Blob !== 'undefined' && data instanceof Blob)) {
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
                    const value = data === null || data === undefined ? '' : data;
                    formData.append(parentKey, value);
                }
                return formData;
            };

            // ==========================================
            // 4. DIRECTIVE: v-form
            // ==========================================
            if (typeof app.directive === 'function') {
                app.directive('form', {
                    mounted(el, binding) {
                        const expr = binding.value;
                        const ctx = binding.ctx;

                        const handler = (e) => {
                            // Support .prevent modifier (default true unless .noprevent is specified)
                            if (!binding.modifiers?.noprevent) {
                                e.preventDefault();
                            }

                            // Determine output format based on arg: v-form:formData vs v-form:json
                            const asFormData = binding.arg === 'formData' || binding.arg === 'multipart';
                            let formDataPayload = serializeJSON(el, { emptyAsNull: true });

                            if (asFormData) {
                                formDataPayload = toFormData(formDataPayload);
                            }

                            let fn = null;
                            if (typeof expr === 'function') {
                                fn = expr;
                            } else if (typeof expr === 'string') {
                                fn = app.resolvePath ? app.resolvePath(expr, ctx) : (ctx && ctx[expr]);
                            }

                            if (typeof fn === 'function') {
                                fn.call(ctx, formDataPayload, e);
                            } else if (typeof console !== 'undefined' && console.warn) {
                                console.warn(`[Helix Form] v-form handler function not found for expression: "${expr}"`);
                            }
                        };

                        el.addEventListener('submit', handler);

                        const cleanup = () => {
                            el.removeEventListener('submit', handler);
                        };

                        directiveCleanups.set(el, cleanup);

                        if (typeof binding.trackCleanup === 'function') {
                            binding.trackCleanup(cleanup);
                        }
                    },

                    unmounted(el) {
                        const cleanup = directiveCleanups.get(el);
                        if (cleanup) {
                            cleanup();
                            directiveCleanups.delete(el);
                        }
                    }
                });
            }

            // ==========================================
            // 5. PUBLIC API
            // ==========================================
            const isFile = (val) =>
                (typeof File !== 'undefined' && val instanceof File) ||
                (typeof Blob !== 'undefined' && val instanceof Blob) ||
                (typeof FileList !== 'undefined' && val instanceof FileList);

            const containsFiles = (obj) => {
                if (!obj || typeof obj !== 'object') return false;
                if (isFile(obj)) return true;
                if (isArray(obj)) return obj.some(containsFiles);
                return Object.values(obj).some(containsFiles);
            };

            const $form = {
                serializeJSON,
                toFormData,

                /**
                 * Smart payload preparation.
                 * If the JSON contains File/Blob objects, converts to FormData.
                 * Otherwise returns the JSON object as-is.
                 */
                preparePayload: (jsonPayload) => {
                    return containsFiles(jsonPayload) ? toFormData(jsonPayload) : jsonPayload;
                },

                /**
                 * Check if a value is a File, Blob, or FileList.
                 */
                isFile,

                /**
                 * Check if a payload needs multipart encoding.
                 */
                needsMultipart: (payload) => containsFiles(payload)
            };

            // ==========================================
            // NAMESPACED API REGISTRATION (Helix v11.1.17)
            // ==========================================
            if (typeof app.namespace === 'function') {
                app.namespace('form', {
                    $form,
                    serializeJSON: $form.serializeJSON,
                    toFormData: $form.toFormData,
                    preparePayload: $form.preparePayload,
                    isFile: $form.isFile,
                    needsMultipart: $form.needsMultipart
                });
            }

            // Backward compatibility & global/app level access
            app.$form = $form;

            // Provide for inject('$form')
            if (typeof app.provide === 'function') {
                app.provide('$form', $form);
            }

            // Global Helix attachment if applicable
            const root = typeof window !== 'undefined' ? window : globalThis;
            if (root.Helix && Object.isExtensible(root.Helix)) {
                root.Helix.form = $form;
                root.Helix.$form = $form;
            }

            // ==========================================
            // CLEANUP LIFECYCLE (Helix v11.1.17)
            // ==========================================
            return () => {
                // Reset WeakMap container cleanly without invalid re-assignment
                directiveCleanups = new WeakMap();
                if (typeof app.removeDirective === 'function') {
                    app.removeDirective('form');
                }
                if (typeof app.removeNamespace === 'function') {
                    app.removeNamespace('form');
                }
            };
        }
    };

    return HelixFormPlugin;
});