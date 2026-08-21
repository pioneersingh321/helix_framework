/**
 * Transaction-based Undo / Redo History Manager
 * Opt-in & lazy snapshot model to avoid cloning overhead on high-frequency mutations
 */
import { deepClone } from './utils.js';

export function createHistoryManager(historyConfig, restoreStateFn) {
  const isEnabled = historyConfig === true || (typeof historyConfig === 'object' && historyConfig !== null && historyConfig.enabled !== false);
  const maxHistory = (typeof historyConfig === 'object' && historyConfig?.max) ? historyConfig.max : 50;

  let undoStack = [];
  let redoStack = [];
  let isPerformingUndoRedo = false;

  function record({ title = 'Action', before, after }) {
    if (!isEnabled || isPerformingUndoRedo) return;

    undoStack.push({
      title,
      before: deepClone(before),
      after: deepClone(after),
      timestamp: Date.now()
    });

    if (undoStack.length > maxHistory) {
      undoStack.shift();
    }

    // Clear redo stack on any new mutation
    redoStack = [];
  }

  function undo() {
    if (!isEnabled || undoStack.length === 0) return false;

    isPerformingUndoRedo = true;
    try {
      const entry = undoStack.pop();
      redoStack.push(entry);
      restoreStateFn(deepClone(entry.before));
      return true;
    } finally {
      isPerformingUndoRedo = false;
    }
  }

  function redo() {
    if (!isEnabled || redoStack.length === 0) return false;

    isPerformingUndoRedo = true;
    try {
      const entry = redoStack.pop();
      undoStack.push(entry);
      restoreStateFn(deepClone(entry.after));
      return true;
    } finally {
      isPerformingUndoRedo = false;
    }
  }

  function getCanUndo() {
    return isEnabled && undoStack.length > 0;
  }

  function getCanRedo() {
    return isEnabled && redoStack.length > 0;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  return {
    record,
    undo,
    redo,
    getCanUndo,
    getCanRedo,
    clear,
    isEnabled: () => isEnabled,
    isPerformingUndoRedo: () => isPerformingUndoRedo
  };
}
