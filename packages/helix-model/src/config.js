// ==========================================
// CONFIG & SYMBOLS
// ==========================================

export const config = {
  asyncBatchSize: 8,
  maxHeapSize: 1000,
  app: null // Set when the plugin is installed
};

export const STATE = Symbol('modelState');
