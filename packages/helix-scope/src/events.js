export class CoreEventEmitter {
    constructor() {
        this._events = new Map();
    }
    on(event, callback) {
        if (!this._events.has(event)) this._events.set(event, new Set());
        this._events.get(event).add(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        if (this._events.has(event)) {
            this._events.get(event).delete(callback);
        }
    }
    emit(event, data) {
        if (this._events.has(event)) {
            this._events.get(event).forEach(cb => {
                try { cb(data); } catch (e) { console.error(e); }
            });
        }
    }
}

export const EventEmitterInstance = new CoreEventEmitter();

// Wrap with identical name to keep compatibility with controller.js
export const EventEmitter = {
    on(event, callback) {
        return EventEmitterInstance.on(event, callback);
    },
    off(event, callback) {
        EventEmitterInstance.off(event, callback);
    },
    emit(event, data) {
        EventEmitterInstance.emit(event, data);
    }
};
