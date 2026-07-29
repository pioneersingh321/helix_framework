import { handleError } from '../shared/shared.js';

export class ScopeScheduler {
    constructor() {
        this.controllers = new Set();
        this.timer = null;
        this.running = false;
    }

    register(controller) {
        if (!controller) return;
        this.controllers.add(controller);
        if (!this.running && this.controllers.size > 0) {
            this.start();
        }
    }

    unregister(controller) {
        if (!controller) return;
        this.controllers.delete(controller);
        if (this.controllers.size === 0) {
            this.stop();
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        const tick = () => {
            if (!this.running) return;
            this.tick();
            if (this.controllers.size > 0) {
                if (typeof requestAnimationFrame !== "undefined") {
                    this.timer = requestAnimationFrame(tick);
                } else {
                    this.timer = setTimeout(tick, 16);
                }
            } else {
                this.stop();
            }
        };
        if (typeof requestAnimationFrame !== "undefined") {
            this.timer = requestAnimationFrame(tick);
        } else {
            this.timer = setTimeout(tick, 16);
        }
    }

    stop() {
        this.running = false;
        if (this.timer !== null) {
            if (typeof cancelAnimationFrame !== "undefined") {
                cancelAnimationFrame(this.timer);
            } else {
                clearTimeout(this.timer);
            }
            this.timer = null;
        }
    }

    tick() {
        this.controllers.forEach((controller) => {
            if (controller.dirty && typeof controller.refresh === "function") {
                try {
                    controller.refresh();
                } catch (err) {
                    handleError(err, "ScopeScheduler tick");
                }
            }
        });
    }
}

export const globalScopeScheduler = new ScopeScheduler();
