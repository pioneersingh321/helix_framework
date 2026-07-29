export const themes = {
    glass: {
        background: 'rgba(255, 255, 255, 0.75)',
        blur: true,
        blurAmount: 12,
        textColor: '#1f2937',
        iconColor: '#3b82f6'
    },
    dark: {
        background: 'rgba(15, 23, 42, 0.85)',
        blur: true,
        blurAmount: 10,
        textColor: '#f9fafb',
        iconColor: '#10b981'
    },
    light: {
        background: 'rgba(248, 250, 252, 0.9)',
        blur: false,
        blurAmount: 0,
        textColor: '#0f172a',
        iconColor: '#4f46e5'
    },
    clinical: {
        background: 'rgba(241, 245, 249, 0.95)',
        blur: false,
        blurAmount: 0,
        textColor: '#334155',
        iconColor: '#0d9488'
    },
    ocean: {
        background: 'rgba(8, 47, 73, 0.9)',
        blur: true,
        blurAmount: 8,
        textColor: '#f0f9ff',
        iconColor: '#38bdf8'
    },
    emerald: {
        background: 'rgba(6, 78, 59, 0.85)',
        blur: true,
        blurAmount: 8,
        textColor: '#ecfdf5',
        iconColor: '#34d399'
    },
    sunset: {
        background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(244, 63, 94, 0.9) 100%)',
        blur: true,
        blurAmount: 6,
        textColor: '#ffffff',
        iconColor: '#ffffff'
    },
    cyberpunk: {
        background: 'rgba(3, 7, 18, 0.95)',
        blur: true,
        blurAmount: 12,
        textColor: '#f43f5e',
        iconColor: '#06b6d4'
    }
};

export const defaults = {
    theme: 'glass',
    zIndex: 2147483647,
    fade: [300, 200],
    icon: 'spinner',
    iconColor: '#4285F4',
    size: 48,
    text: '',
    gap: '16px',
    direction: 'column',
    allowHtmlIcon: false,   // install-only opt-in for raw-HTML string icons
    debug: false,
    antiFlicker: 150,       // wait delay in ms to avoid flicker on fast actions
    minDuration: 300,       // minimum display duration in ms to avoid quick flashing

    // Progress bar customization configurations
    progressWidth: '160px',
    progressHeight: '4px',
    progressBg: 'rgba(0, 0, 0, 0.1)',
    progressColor: '',      // falls back to theme iconColor if blank
    autoHideOnComplete: true,
    autoHideDelay: 250,

    // Performance overlay pooling size limit
    poolSize: 100
};

export function normalizeFade(f) {
    if (Array.isArray(f)) {
        const i = Number.isFinite(f[0]) ? f[0] : 300;
        const o = Number.isFinite(f[1]) ? f[1] : i;
        return [i, o];
    }
    if (Number.isFinite(f)) return [f, f];
    return [300, 200];
}
