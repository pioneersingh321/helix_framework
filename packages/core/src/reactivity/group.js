import { stopEffect } from './effect.js';

export class EffectGroup {
    constructor(name = "EffectGroup") {
        this.name = name;
        this.effects = new Set();
        this.active = true;
        this.paused = false;
    }

    add(effectFn) {
        if (!effectFn) return effectFn;
        this.effects.add(effectFn);
        if (this.paused && typeof effectFn.pause === "function") {
            effectFn.pause();
        }
        return effectFn;
    }

    pause() {
        this.paused = true;
        this.effects.forEach((eff) => {
            if (typeof eff.pause === "function") eff.pause();
            else eff.paused = true;
        });
    }

    resume() {
        this.paused = false;
        this.effects.forEach((eff) => {
            if (typeof eff.resume === "function") eff.resume();
            else eff.paused = false;
        });
    }

    stop() {
        if (!this.active) return;
        this.effects.forEach((eff) => {
            if (typeof eff.stop === "function") eff.stop();
            else stopEffect(eff);
        });
        this.effects.clear();
        this.active = false;
    }

    clear() {
        this.stop();
        this.active = true;
    }

    get size() {
        return this.effects.size;
    }
}

export function createEffectGroup(name) {
    return new EffectGroup(name);
}

export function effectGroup(name) {
    return createEffectGroup(name);
}
