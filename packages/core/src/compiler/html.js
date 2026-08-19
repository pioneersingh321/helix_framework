import { globalConfig } from '../app/config.js';

export function sanitizeHtml(html) {
    if (typeof html !== "string") return "";
    let sanitized = html;
    if (typeof globalConfig.htmlSanitizer === "function") {
        try {
            sanitized = globalConfig.htmlSanitizer(html);
            if (typeof sanitized !== "string") sanitized = "";
        } catch (e) {
            sanitized = "";
        }
    }
    if (typeof document === "undefined") {
        return sanitized
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
            .replace(/\s+on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
            .replace(/(?:href|src|xlink:href)\s*=\s*['"]?\s*javascript:[^'">\s]*/gi, "");
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = sanitized.trim();
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
