import { globalConfig } from '../app/config.js';

let isProfiling = false;
let profileStartTime = 0;
const profileData = {
    duration: 0,
    effectRuns: 0,
    mountCount: 0,
    updateCount: 0,
    customMetrics: {}
};

export function recordProfileMetric(key, delta = 1) {
    if (!isProfiling) return;
    if (key === "effectRun") profileData.effectRuns += delta;
    else if (key === "mount") profileData.mountCount += delta;
    else if (key === "update") profileData.updateCount += delta;
    else {
        profileData.customMetrics[key] = (profileData.customMetrics[key] || 0) + delta;
    }
}

export function profile(fn) {
    if (typeof fn !== "function") return null;
    isProfiling = true;
    profileStartTime = performance.now();
    profileData.effectRuns = 0;
    profileData.mountCount = 0;
    profileData.updateCount = 0;
    profileData.customMetrics = {};
    try {
        return fn();
    } finally {
        profileData.duration = performance.now() - profileStartTime;
        isProfiling = false;
    }
}

export function getProfileData() {
    return { ...profileData, customMetrics: { ...profileData.customMetrics } };
}
