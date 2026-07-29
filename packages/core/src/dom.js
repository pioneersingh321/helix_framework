export function parseAttribute(el, attrName, defaultValue = null) {
    const val = el.getAttribute(attrName);
    if (el.hasAttribute(attrName)) {
        el.removeAttribute(attrName);
    }
    return val !== null ? val : defaultValue;
}

export function cleanAttributes(el, names) {
    for (const name of names) {
        if (el.hasAttribute(name)) {
            el.removeAttribute(name);
        }
    }
}
