export function sanitizeHtml(html) {
    if (typeof html !== "string") return "";
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    const dangerousSelectors = [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "textarea",
        "button",
        "select",
        "link[rel='stylesheet']"
    ];
    dangerousSelectors.forEach((selector) => {
        tpl.content.querySelectorAll(selector).forEach((el) => el.remove());
    });
    tpl.content.querySelectorAll("svg script, svg *[onload]").forEach((el) => el.remove());
    const walk = (node) => {
        if (node.nodeType === 1) {
            Array.from(node.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.toLowerCase();
                if (name.startsWith("on")) {
                    node.removeAttribute(attr.name);
                    return;
                }
                if (/javascript:/i.test(value) || /^data:/i.test(value)) {
                    node.removeAttribute(attr.name);
                    return;
                }
                if (/expression\s*\(/i.test(value)) {
                    node.removeAttribute(attr.name);
                    return;
                }
            });
            Array.from(node.children).forEach(walk);
        }
    };
    Array.from(tpl.content.children).forEach(walk);
    return tpl.innerHTML;
}
