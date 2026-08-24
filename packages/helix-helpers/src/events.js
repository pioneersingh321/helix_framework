export function createEventMethods(H) {
    return {
        dispatch(targetOrEvent, eventOrDetail, detailOrOptions = null, options = {}) {
            let target = null;
            let eventName = '';
            let evtDetail = null;
            let opts = {};

            if (typeof targetOrEvent === 'string') {
                // Form 1: dispatch(eventName, detail, options)
                eventName = targetOrEvent;
                evtDetail = eventOrDetail;
                target = typeof document !== 'undefined' ? document : null;
                opts = (detailOrOptions && typeof detailOrOptions === 'object' && !Array.isArray(detailOrOptions)) ? detailOrOptions : {};
            } else {
                // Form 2: dispatch(element, eventName, detail, options)
                target = targetOrEvent;
                eventName = String(eventOrDetail || '');
                evtDetail = detailOrOptions;
                opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
            }

            if (!target || typeof target.dispatchEvent !== 'function') {
                if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
                    target = document;
                } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                    target = window;
                }
            }

            if (!target || typeof target.dispatchEvent !== 'function' || !eventName) return false;

            const customEvent = typeof CustomEvent !== 'undefined'
                ? new CustomEvent(eventName, {
                    bubbles: opts.bubbles !== false,
                    composed: opts.composed !== false,
                    cancelable: opts.cancelable !== false,
                    ...opts,
                    detail: evtDetail
                })
                : { type: eventName, detail: evtDetail };

            return target.dispatchEvent(customEvent);
        }
    };
}
