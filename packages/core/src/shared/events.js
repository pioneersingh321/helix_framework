export class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        const set = this.listeners.get(event);
        if (set) {
            set.delete(handler);
            if (set.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    emit(event, data) {
        const set = this.listeners.get(event);
        if (set) {
            for (const handler of Array.from(set)) {
                try {
                    handler(data);
                } catch (err) {
                    console.error(`❌ [Helix 📢] Error in listener for event "${event}":`, err);
                }
            }
        }
    }
}
