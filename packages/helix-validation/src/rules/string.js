import { isEmpty, resolveMsg, mkRule, mkFactory, resolveParam } from '../shared/utils.js';
import { emailRx } from '../core/context.js';
import { rules } from '../core/registry.js';

export const required = mkRule(
    (v, ctx) => isEmpty(v) ? resolveMsg('required', {}, v, ctx) : null,
    'required', 32
);

export const email = mkRule(
    (v, ctx) => !isEmpty(v) && !emailRx.test(v) ? resolveMsg('email', {}, v, ctx) : null,
    'email', 16
);

export const url = mkRule(
    (v, ctx) => {
        if (isEmpty(v)) return null;
        let str = String(v);
        if (!/^[a-zA-Z]+:\/\//.test(str)) {
            str = 'http://' + str;
        }
        try {
            const parsed = new URL(str);
            const hostname = parsed.hostname;
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
            const hasTld = hostname.includes('.') && hostname.split('.').pop().length >= 2;
            if (!isLocal && !hasTld) return resolveMsg('url', {}, v, ctx);
            return null;
        } catch {
            return resolveMsg('url', {}, v, ctx);
        }
    },
    'url', 16
);

export const pattern = mkFactory((regex, msg) => {
    return mkRule(
        (v, ctx) => {
            if (isEmpty(v)) return null;
            const resolvedRegex = resolveParam(regex);
            let rx;
            try {
                rx = typeof resolvedRegex === 'string' ? new RegExp(resolvedRegex) : resolvedRegex;
            } catch (e) {
                console.error('[Helix Validation] pattern: Invalid regex pattern:', resolvedRegex, e);
                return 'Invalid pattern configuration.';
            }
            return !rx.test(v) ? (msg || resolveMsg('pattern', { pattern: resolvedRegex }, v, ctx)) : null;
        },
        'pattern', 16, { pattern: regex }
    );
});

export const trim = mkRule(
    (v, ctx) => {
        const val = typeof v === 'string' ? v.trim() : v;
        return { transform: true, value: val };
    },
    'trim', 100
);

export const lowercase = mkRule(
    (v, ctx) => {
        const val = typeof v === 'string' ? v.toLowerCase() : v;
        return { transform: true, value: val };
    },
    'lowercase', 100
);

// Register rules
rules.add('required', required);
rules.add('email', email);
rules.add('url', url);
rules.add('pattern', pattern);
rules.add('trim', trim);
rules.add('lowercase', lowercase);
