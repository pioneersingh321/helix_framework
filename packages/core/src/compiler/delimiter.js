import {
    handleError
} from '../shared/shared.js';
import { resolveExpression } from './compiler.js';
import { effect, cleanup } from '../reactivity/effect.js';
import { queueComponentUpdated } from '../app/lifecycle.js';

export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createDelimiterPattern(delimiters) {
    const open = escapeRegex(delimiters[0]);
    const close = escapeRegex(delimiters[1]);
    return new RegExp(open + '\\s*(.*?)\\s*' + close, 'g');
}

export function parseTextInterpolation(text, delimiters) {
    if (!delimiters || delimiters.length !== 2) return null;
    const pattern = createDelimiterPattern(delimiters);
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        tokens.push({ type: 'interpolation', value: match[1].trim() });
        lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return tokens.length > 0 ? tokens : null;
}

export function bindTextInterpolation(node, ctx, instance, delimiters) {
    const text = node.textContent;
    const tokens = parseTextInterpolation(text, delimiters);
    if (!tokens) return false;

    const parent = node.parentNode;
    if (!parent) return false;

    const marker = document.createComment(' text-interpolation ');
    parent.insertBefore(marker, node);
    node.remove();

    const textNodes = [];

    tokens.forEach((token) => {
        if (token.type === 'text') {
            const textNode = document.createTextNode(token.value);
            parent.insertBefore(textNode, marker);
        } else {
            const interpNode = document.createTextNode('');
            parent.insertBefore(interpNode, marker);
            textNodes.push({ node: interpNode, expr: token.value });
        }
    });

    marker.remove();

    const cleanupFns = [];
    let initialRan = false;
    textNodes.forEach(({ node: textNode, expr }) => {
        const updateFn = () => {
            const res = resolveExpression(expr, ctx, { fallback: '', contextName: 'text-interpolation' });
            const newText = typeof res === 'object' && res !== null ? JSON.stringify(res) : res ?? '';
            if (textNode.textContent !== newText) {
                textNode.textContent = newText;
                if (initialRan && instance) {
                    queueComponentUpdated(instance);
                }
            }
        };
        const e = effect(updateFn, { name: `interpolation: ${expr}`, area: 'compiler' });
        cleanupFns.push(() => cleanup(e));
    });
    initialRan = true;

    if (!parent.__hx_cleanup) {
        parent.__hx_cleanup = [];
    }
    cleanupFns.forEach(fn => parent.__hx_cleanup.push(fn));
    if (instance && instance.cleanups) {
        cleanupFns.forEach(fn => instance.cleanups.push(fn));
    }

    return true;
}
