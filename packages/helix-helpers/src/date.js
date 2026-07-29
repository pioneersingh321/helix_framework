export function createDateMethods(H) {
    return {
        formatDate(date, fmt = 'YYYY-MM-DD') {
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return '';
            const p = (n) => String(n).padStart(2, '0');
            const m = {
                YYYY: d.getFullYear(),
                MM: p(d.getMonth() + 1),
                DD: p(d.getDate()),
                HH: p(d.getHours()),
                mm: p(d.getMinutes()),
                ss: p(d.getSeconds()),
                SSS: String(d.getMilliseconds()).padStart(3, '0'),
            };
            return fmt.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, x => m[x]);
        },

        timeAgo(date) {
            const now = new Date();
            const then = new Date(date);
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
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        },

        startOfDay(date) {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        },

        endOfDay(date) {
            const d = new Date(date);
            d.setHours(23, 59, 59, 999);
            return d;
        }
    };
}
