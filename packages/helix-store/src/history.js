/**
 * Transaction-based Undo / Redo History Manager
 * Opt-in & lazy snapshot model to avoid cloning overhead on high-frequency mutations
 */
import { deepClone } from './utils.js';

export function createHistoryManager(historyConfig, restoreStateFn) {
  const isEnabled = historyConfig === true || (typeof historyConfig === 'object' && historyConfig !== null && historyConfig.enabled !== false);
  const maxHistory = (typeof historyConfig === 'object' && historyConfig?.max) ? historyConfig.max : 50;

  const canUndoRef = (typeof Helix !== 'undefined' && typeof Helix.ref === 'function') ? Helix.ref(false) : { value: false };
  const canRedoRef = (typeof Helix !== 'undefined' && typeof Helix.ref === 'function') ? Helix.ref(false) : { value: false };

  let undoStack = [];
  let redoStack = [];
  let isPerformingUndoRedo = false;

  function syncFlags() {
    const nextCanUndo = Boolean(isEnabled && undoStack.length > 0);
    const nextCanRedo = Boolean(isEnabled && redoStack.length > 0);
    if (canUndoRef.value !== nextCanUndo) {
      canUndoRef.value = nextCanUndo;
    }
    if (canRedoRef.value !== nextCanRedo) {
      canRedoRef.value = nextCanRedo;
    }
  }

  let isRecording = false;
  function record({ title = 'Action', before, after }) {
    if (!isEnabled || isPerformingUndoRedo || isRecording) return;

    isRecording = true;
    try {
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
      syncFlags();
    } finally {
      isRecording = false;
    }
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
      syncFlags();
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
      syncFlags();
    }
  }

  function getCanUndo() {
    return canUndoRef.value;
  }

  function getCanRedo() {
    return canRedoRef.value;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
    syncFlags();
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
