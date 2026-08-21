/**
 * Store Domain Event Bus ($emit / $on / $off)
 * Supports auto-cleanup with active Helix EffectScope / component lifecycles
 */

export function createStoreEventBus() {
  const listeners = new Map();

  function on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);

    const unsubscribe = () => off(event, handler);

    // Auto-register cleanup if inside an active Helix effectScope or component
    if (typeof Helix !== 'undefined' && typeof Helix.onScopeDispose === 'function') {
      try {
        Helix.onScopeDispose(unsubscribe);
      } catch (_) {
        // Not inside active scope; ignore
      }
    }

    return unsubscribe;
  }

  function off(event, handler) {
    if (!listeners.has(event)) return;
    if (!handler) {
      listeners.delete(event);
    } else {
      listeners.get(event).delete(handler);
      if (listeners.get(event).size === 0) {
        listeners.delete(event);
      }
    }
  }

  function emit(event, ...payload) {
    if (!listeners.has(event)) return;
    listeners.get(event).forEach(handler => {
      try {
        handler(...payload);
      } catch (err) {
        console.error(`[Helix:Store:Event] Error in handler for "${event}":`, err);
      }
    });
  }

  function clear() {
    listeners.clear();
  }

  return { on, off, emit, clear };
}
