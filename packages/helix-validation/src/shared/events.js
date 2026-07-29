export function createEventEmitter() {
    const listeners = [];
    
    const emit = (event, payload) => {
        const e = typeof event === 'string' ? Object.assign({ type: event }, payload) : event;
        listeners.slice().forEach(item => {
            if (item && item.event === e.type) {
                try {
                    item.cb(e);
                } catch (err) {
                    console.error('[Helix Validation] Error in event listener:', err);
                }
            }
        });
    };
    
    const on = (event, cb) => {
        // Prevent duplicate registration of the exact same callback for the same event
        const exists = listeners.some(item => item && item.event === event && item.cb === cb);
        if (exists) {
            return () => {
                const i = listeners.findIndex(item => item && item.event === event && item.cb === cb);
                if (i > -1) listeners.splice(i, 1);
            };
        }
        
        const item = { event, cb };
        listeners.push(item);
        return () => {
            const i = listeners.indexOf(item);
            if (i > -1) listeners.splice(i, 1);
        };
    };
    
    return { listeners, emit, on };
}
