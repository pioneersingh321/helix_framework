/**
 * Async Action State Tracking ($loading, $errors, $cancel, $signal)
 * Supports synchronous returns, clean AbortSignal access, and Call-ID token ownership
 * to prevent stale concurrent async resolutions from corrupting $loading and $errors.
 */
import { isPromise } from './utils.js';

export function createAsyncStateManager(reactiveFn) {
  const loading = reactiveFn({});
  const errors = reactiveFn({});
  const abortControllers = new Map();
  const callCounters = new Map();
  let currentActiveAction = null;

  function wrapAction(actionName, actionFn, storeContext) {
    return function (...args) {
      // 1. Abort previous controller if still active
      if (abortControllers.has(actionName)) {
        try {
          abortControllers.get(actionName).abort();
        } catch (_) {}
      }
      const controller = new AbortController();
      abortControllers.set(actionName, controller);

      // 2. Increment Call-ID token to track the latest invocation
      const currentCallId = (callCounters.get(actionName) || 0) + 1;
      callCounters.set(actionName, currentCallId);

      // 3. Clean argument handling:
      // - If caller passed an options object as the last argument, attach signal if not already present
      // - If function explicitly declares more parameters than passed (e.g. (q, { signal })), provide options object
      // - Do NOT pollute actions that only take specific positional arguments
      const normalizedArgs = [...args];
      const lastArg = normalizedArgs[normalizedArgs.length - 1];

      if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
        if (!('signal' in lastArg)) {
          lastArg.signal = controller.signal;
        }
      } else if (actionFn.length > normalizedArgs.length) {
        normalizedArgs.push({ signal: controller.signal });
      }

      currentActiveAction = actionName;

      let result;
      try {
        result = actionFn.apply(storeContext, normalizedArgs);
      } catch (syncErr) {
        if (callCounters.get(actionName) === currentCallId) {
          abortControllers.delete(actionName);
        }
        throw syncErr;
      } finally {
        currentActiveAction = null;
      }

      // 4. Synchronous action returns immediately without entering async state tracking
      if (!isPromise(result)) {
        if (callCounters.get(actionName) === currentCallId) {
          abortControllers.delete(actionName);
        }
        return result;
      }

      // 5. Async tracking
      loading[actionName] = true;
      errors[actionName] = null;

      return result
        .then(value => {
          // Only the latest in-flight invocation may clear loading and abort controller
          if (callCounters.get(actionName) === currentCallId) {
            loading[actionName] = false;
            abortControllers.delete(actionName);
          }
          return value;
        })
        .catch(err => {
          // Only the latest in-flight invocation may update errors and clear loading
          if (callCounters.get(actionName) === currentCallId) {
            loading[actionName] = false;
            abortControllers.delete(actionName);

            // Filter AbortError
            const isAbort = err?.name === 'AbortError' || err?.code === 20 || err?.message?.includes('aborted');
            if (!isAbort) {
              errors[actionName] = err?.message || String(err);
              throw err;
            }
          }
          return undefined;
        });
    };
  }

  function getSignal(actionName) {
    const targetAction = actionName || currentActiveAction;
    if (targetAction && abortControllers.has(targetAction)) {
      return abortControllers.get(targetAction).signal;
    }
    return undefined;
  }

  function cancel(actionName) {
    const controller = abortControllers.get(actionName);
    if (controller) {
      try {
        controller.abort();
      } catch (_) {}
    }
  }

  function clear() {
    abortControllers.forEach(ctrl => {
      try { ctrl.abort(); } catch (_) {}
    });
    abortControllers.clear();
    callCounters.clear();
    currentActiveAction = null;
  }

  return {
    loading,
    errors,
    wrapAction,
    getSignal,
    cancel,
    clear
  };
}
