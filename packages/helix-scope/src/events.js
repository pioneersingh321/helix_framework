import { EventEmitter as CoreEventEmitter } from '../../core/src/events.js';

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
