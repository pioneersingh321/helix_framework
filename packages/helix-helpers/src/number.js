import { _unref } from './shared.js';

export function createNumberMethods(H) {
    return {
        formatNumber(num, d = 0, loc = 'en-US') {
            const n = _unref(num);
            const dec = _unref(d) ?? 0;
            const locale = _unref(loc) || 'en-US';
            return H.isNumber(n) ? n.toLocaleString(locale, {
                minimumFractionDigits: dec,
                maximumFractionDigits: dec
            }) : n;
        },

        formatCurrency(amount, curOrOptions = 'USD', loc = 'en-US') {
            const a = _unref(amount);
            if (!H.isNumber(a)) return a;
            const opts = _unref(curOrOptions);
            const defaultLoc = _unref(loc) || 'en-US';

            if (typeof opts === 'object' && opts !== null) {
                const {
                    currency = 'USD',
                    locale = opts.locale || opts.loc || defaultLoc,
                    currencyDisplay = 'symbol',
                    minimumFractionDigits = 2,
                    maximumFractionDigits = 2
                } = opts;
                return new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency,
                    currencyDisplay,
                    minimumFractionDigits,
                    maximumFractionDigits
                }).format(a);
            }
            return new Intl.NumberFormat(defaultLoc, {
                style: 'currency',
                currency: opts || 'USD'
            }).format(a);
        },

        round(num, d = 0) {
            const n = _unref(num);
            const dec = _unref(d) ?? 0;
            if (!H.isNumber(n)) return n;
            const p = Math.pow(10, dec);
            const val = n * p * (1 + Number.EPSILON);
            return Math.round(val) / p;
        },

        clamp(num, min, max) {
            const n = _unref(num);
            const mn = _unref(min);
            const mx = _unref(max);
            if (!H.isNumber(n)) return n;
            return Math.min(Math.max(n, mn), mx);
        },

        randomInt(min, max) {
            const mn = _unref(min);
            const mx = _unref(max);
            let low = typeof mn === 'number' ? Math.ceil(mn) : 0;
            let high = typeof mx === 'number' ? Math.floor(mx) : 0;
            if (isNaN(low)) low = 0;
            if (isNaN(high)) high = 0;
            if (low > high) [low, high] = [high, low];
            return Math.floor(Math.random() * (high - low + 1)) + low;
        }
    };
}
