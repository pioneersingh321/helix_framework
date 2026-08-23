import { createApp } from '../app/app.js';
import { reactive } from '../reactivity/reactive.js';
import { destroyNode } from './node.js';
import { warn } from '../shared/shared.js';

/**
 * defineCustomElement - Defines a standard W3C Web Component (Custom Element) from a Helix component.
 *
 * @param {Object} ComponentDef - The Helix component definition object.
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.shadow=true] - Whether to attach an open Shadow DOM root.
 * @param {string|string[]} [options.styles] - Component styles to inject into the Shadow DOM.
 * @returns {CustomElementConstructor} A class extending HTMLElement.
 */
export function defineCustomElement(ComponentDef = {}, options = {}) {
    const isHTMLElementDefined = typeof HTMLElement !== 'undefined';
    const BaseClass = isHTMLElementDefined ? HTMLElement : class {};

    // Derive observed attributes from component props
    const propsDef = ComponentDef.props || {};
    const propNames = Array.isArray(propsDef) ? propsDef : Object.keys(propsDef);
    const attrToPropMap = new Map();
    const observedAttrs = propNames.map((prop) => {
        const attr = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        attrToPropMap.set(attr, prop);
        return attr;
    });

    class HelixCustomElement extends BaseClass {
        static get observedAttributes() {
            return observedAttrs;
        }

        constructor() {
            super();
            this._app = null;
            this._props = reactive({});
            this._container = null;
            this._shadowRoot = null;
            this._isMounted = false;
            this._isConnected = false;
            this._mountToken = 0;

            // Initialize default props
            propNames.forEach((prop) => {
                const def = !Array.isArray(propsDef) ? propsDef[prop] : null;
                const defaultVal = def && typeof def === 'object' && 'default' in def
                    ? (typeof def.default === 'function' ? def.default() : def.default)
                    : undefined;
                this._props[prop] = defaultVal;

                // Define property getters/setters on custom element instance
                Object.defineProperty(this, prop, {
                    get: () => this._props[prop],
                    set: (val) => {
                        this._props[prop] = val;
                    },
                    configurable: true,
                    enumerable: true
                });
            });
        }

        connectedCallback() {
            this._isConnected = true;
            const currentToken = ++this._mountToken;
            if (this._isMounted) return;

            // Determine rendering target (Shadow DOM vs Light DOM)
            const useShadow = options.shadow !== false && ComponentDef.shadow !== false;
            if (useShadow && typeof this.attachShadow === 'function') {
                if (!this._shadowRoot) {
                    this._shadowRoot = this.shadowRoot || this.attachShadow({ mode: 'open' });
                }
                if (!this._container) {
                    this._container = document.createElement('div');
                    this._container.className = 'helix-ce-root';
                    this._shadowRoot.appendChild(this._container);

                    // Inject component styles
                    const styles = ComponentDef.styles || options.styles;
                    if (styles) {
                        const styleArray = Array.isArray(styles) ? styles : [styles];
                        styleArray.forEach((css) => {
                            const styleEl = document.createElement('style');
                            styleEl.textContent = css;
                            this._shadowRoot.insertBefore(styleEl, this._container);
                        });
                    }
                }
            } else {
                this._container = this;
            }

            // Sync initial HTML attributes into reactive props
            observedAttrs.forEach((attr) => {
                if (this.hasAttribute(attr)) {
                    const prop = attrToPropMap.get(attr);
                    this._props[prop] = this._parseAttributeValue(this.getAttribute(attr), prop);
                }
            });

            // Set up inner component template
            if (ComponentDef.template && this._container) {
                this._container.innerHTML = ComponentDef.template;
            }

            // Create and mount internal Helix app
            const self = this;
            this._app = createApp({
                setup(setupCtx) {
                    const emit = (evtName, ...args) => {
                        // Forward component emits as native DOM CustomEvents
                        const eventDetail = args.length === 1 ? args[0] : (args.length > 1 ? args : undefined);
                        const customEvt = new CustomEvent(evtName, {
                            detail: eventDetail,
                            bubbles: true,
                            composed: true
                        });
                        self.dispatchEvent(customEvt);
                    };

                    const componentCtx = {
                        ...setupCtx,
                        props: self._props,
                        emit
                    };

                    let userState = {};
                    if (typeof ComponentDef.setup === 'function') {
                        userState = ComponentDef.setup(componentCtx) || {};
                    }

                    const returnTarget = {
                        props: self._props,
                        emit,
                        ...userState
                    };

                    return new Proxy(returnTarget, {
                        get(target, prop, receiver) {
                            if (prop in target) return target[prop];
                            if (prop in self._props) return self._props[prop];
                            return undefined;
                        },
                        set(target, prop, value, receiver) {
                            if (prop in self._props) {
                                self._props[prop] = value;
                                return true;
                            }
                            target[prop] = value;
                            return true;
                        },
                        has(target, prop) {
                            return prop in target || prop in self._props;
                        },
                        ownKeys(target) {
                            const keys = new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(self._props)]);
                            return Array.from(keys);
                        },
                        getOwnPropertyDescriptor(target, prop) {
                            if (prop in target) {
                                return Reflect.getOwnPropertyDescriptor(target, prop);
                            }
                            if (prop in self._props) {
                                return {
                                    configurable: true,
                                    enumerable: true,
                                    value: self._props[prop],
                                    writable: true
                                };
                            }
                            return undefined;
                        }
                    });
                }
            });

            this._app.mount(this._container).then(() => {
                // If disconnected before mount finished or invalidated, immediately clean up
                if (!this._isConnected || this._mountToken !== currentToken) {
                    if (this._app && typeof this._app.unmount === 'function') {
                        this._app.unmount();
                    } else if (this._container) {
                        destroyNode(this._container);
                    }
                    this._app = null;
                    this._isMounted = false;
                    return;
                }
                this._isMounted = true;
            }).catch((err) => {
                warn(`[Helix CustomElement] Error mounting <${this.tagName ? this.tagName.toLowerCase() : 'custom-element'}>:`, "component", err);
            });
        }

        disconnectedCallback() {
            this._isConnected = false;
            this._mountToken++; // Invalidate pending mount promise

            if (this._app) {
                if (typeof this._app.unmount === 'function') {
                    this._app.unmount();
                } else if (this._container) {
                    destroyNode(this._container);
                }
                this._app = null;
            }
            this._isMounted = false;
        }

        attributeChangedCallback(name, oldVal, newVal) {
            if (oldVal === newVal) return;
            const prop = attrToPropMap.get(name);
            if (prop) {
                this._props[prop] = this._parseAttributeValue(newVal, prop);
            }
        }

        _parseAttributeValue(val, prop) {
            if (val === null || val === undefined) return val;
            const def = !Array.isArray(propsDef) ? propsDef[prop] : null;
            const expectedType = def && typeof def === 'object' ? def.type : def;

            if (expectedType === Boolean || typeof this._props[prop] === 'boolean') {
                return val !== 'false' && val !== null;
            }
            if (expectedType === Number || typeof this._props[prop] === 'number') {
                const parsed = Number(val);
                return isNaN(parsed) ? val : parsed;
            }
            try {
                if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                    return JSON.parse(val);
                }
            } catch (e) {}
            return val;
        }
    }

    return HelixCustomElement;
}
