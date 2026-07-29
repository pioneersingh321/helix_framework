export function createNumberMethods(H) {
    return {
        formatNumber(num, d = 0) {
            return H.isNumber(num) ? num.toLocaleString('en-US', {
                minimumFractionDigits: d,
                maximumFractionDigits: d
            }) : num;
        },

        formatCurrency(amount, cur = 'USD', loc = 'en-US') {
            return H.isNumber(amount) ? new Intl.NumberFormat(loc, {
                style: 'currency',
                currency: cur
            }).format(amount) : amount;
        },

        round(num, d = 0) {
            if (!H.isNumber(num)) return num;
            const p = Math.pow(10, d);
            const n = num * p * (1 + Number.EPSILON);
            return Math.round(n) / p;
        },

        clamp(num, min, max) {
            return Math.min(Math.max(num, min), max);
        },

        randomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    };
}
