import { isEmpty, resolveMsg, mkRule, mkFactory, resolveParam } from '../shared/utils.js';
import { rules } from '../core/registry.js';

export const numeric = mkRule(
    (v, ctx) => !isEmpty(v) && !isFinite(Number(v)) ? resolveMsg('numeric', {}, v, ctx) : null,
    'numeric', 16
);

export const integer = mkRule(
    (v, ctx) => !isEmpty(v) && !Number.isInteger(Number(v)) ? resolveMsg('integer', {}, v, ctx) : null,
    'integer', 16
);

export const minLength = mkFactory((minVal) => mkRule(
    (v, ctx) => {
        const resolved = resolveParam(minVal);
        return !isEmpty(v) && String(v).length < resolved ? resolveMsg('minLength', { min: resolved }, v, ctx) : null;
    },
    'minLength', 8, { min: minVal }
));

export const maxLength = mkFactory((maxVal) => mkRule(
    (v, ctx) => {
        const resolved = resolveParam(maxVal);
        return !isEmpty(v) && String(v).length > resolved ? resolveMsg('maxLength', { max: resolved }, v, ctx) : null;
    },
    'maxLength', 8, { max: maxVal }
));

export const min = mkFactory((mn) => mkRule(
    (v, ctx) => {
        const resolved = resolveParam(mn);
        return !isEmpty(v) && Number(v) < resolved ? resolveMsg('min', { min: resolved }, v, ctx) : null;
    },
    'min', 8, { min: mn }
));

export const max = mkFactory((mx) => mkRule(
    (v, ctx) => {
        const resolved = resolveParam(mx);
        return !isEmpty(v) && Number(v) > resolved ? resolveMsg('max', { max: resolved }, v, ctx) : null;
    },
    'max', 8, { max: mx }
));

export const between = mkFactory((mn, mx) => mkRule(
    (v, ctx) => {
        if (isEmpty(v)) return null;
        const resolvedMn = resolveParam(mn);
        const resolvedMx = resolveParam(mx);
        const n = Number(v);
        return (n < resolvedMn || n > resolvedMx) ? resolveMsg('between', { min: resolvedMn, max: resolvedMx }, v, ctx) : null;
    },
    'between', 8, { min: mn, max: mx }
));

// Register rules
rules.add('numeric', numeric);
rules.add('integer', integer);
rules.add('minLength', minLength);
rules.add('maxLength', maxLength);
rules.add('min', min);
rules.add('max', max);
rules.add('between', between);
