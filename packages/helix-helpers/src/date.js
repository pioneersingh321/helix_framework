import { _unref } from './shared.js';

export function createDateMethods(H) {
    return {
        formatDate(date, fmt = 'YYYY-MM-DD', options = {}) {
            const rawDate = _unref(date);
            const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
            if (isNaN(d.getTime())) return '';
            const formatStr = _unref(fmt) || 'YYYY-MM-DD';
            const opts = _unref(options);
            const isUtc = opts === true || (typeof opts === 'object' && opts !== null && opts.utc);
            const p = (n) => String(n).padStart(2, '0');
            const m = isUtc ? {
                YYYY: d.getUTCFullYear(),
                MM: p(d.getUTCMonth() + 1),
                DD: p(d.getUTCDate()),
                HH: p(d.getUTCHours()),
                mm: p(d.getUTCMinutes()),
                ss: p(d.getUTCSeconds()),
                SSS: String(d.getUTCMilliseconds()).padStart(3, '0'),
            } : {
                YYYY: d.getFullYear(),
                MM: p(d.getMonth() + 1),
                DD: p(d.getDate()),
                HH: p(d.getHours()),
                mm: p(d.getMinutes()),
                ss: p(d.getSeconds()),
                SSS: String(d.getMilliseconds()).padStart(3, '0'),
            };
            return formatStr.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, x => m[x]);
        },

        timeAgo(date) {
            const rawDate = _unref(date);
            const now = new Date();
            const then = new Date(rawDate);
            const diff = Math.floor((now - then) / 1000);
            const absDiff = Math.abs(diff);
            const suffix = diff < 0 ? 'from now' : 'ago';
            const i = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
            for (const [u, sec] of Object.entries(i)) {
                const n = Math.floor(absDiff / sec);
                if (n >= 1) return `${n} ${u}${n > 1 ? 's' : ''} ${suffix}`;
            }
            return diff < 0 ? 'in a moment' : 'just now';
        },

        addDays(date, days) {
            const rawDate = _unref(date);
            const numDays = _unref(days);
            const d = new Date(rawDate);
            d.setDate(d.getDate() + numDays);
            return d;
        },

        startOfDay(date) {
            const rawDate = _unref(date);
            const d = new Date(rawDate);
            d.setHours(0, 0, 0, 0);
            return d;
        },

        endOfDay(date) {
            const rawDate = _unref(date);
            const d = new Date(rawDate);
            d.setHours(23, 59, 59, 999);
            return d;
        }
    };
}
