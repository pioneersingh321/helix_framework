import { isEmpty, resolveMsg, mkRule, mkFactory, resolveParam } from '../shared/utils.js';
import { rules } from '../core/registry.js';

export const sameAs = mkFactory((otherRef, label) => mkRule(
    (v, ctx) => {
        let other = resolveParam(otherRef);
        if (typeof other === 'string' && ctx && ctx.parent && typeof ctx.parent.field === 'function') {
            const otherCtrl = ctx.parent.field(other);
            if (otherCtrl) other = otherCtrl.value.value;
        }
        return v !== other ? resolveMsg('sameAs', { label }, v, ctx) : null;
    },
    'sameAs', 4, { label }
));

export const oneOf = mkFactory((values) => mkRule(
    (v, ctx) => {
        const resolvedValues = resolveParam(values) || [];
        return !isEmpty(v) && !resolvedValues.includes(v) ? resolveMsg('oneOf', { values: resolvedValues }, v, ctx) : null;
    },
    'oneOf', 4, { values }
));

// Register rules
rules.add('sameAs', sameAs);
rules.add('oneOf', oneOf);
