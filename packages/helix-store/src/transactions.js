/**
 * Transaction Dispatch Gate for Helix Store
 * Supports nested transactions and suppresses empty/no-op transactions
 */
import { deepClone, deepEqual } from './utils.js';

export function createTransactionManager(storeId, getStateFn, notifySubscribers, recordHistory) {
  let transactionDepth = 0;
  let currentTransactionTitle = null;
  let rootBeforeSnapshot = null;

  function runTransaction(fn, title = 'Transaction') {
    if (transactionDepth > 0) {
      // Nested transaction: execute within the outer transaction boundary
      return fn();
    }

    transactionDepth = 1;
    currentTransactionTitle = title;
    rootBeforeSnapshot = deepClone(getStateFn());

    try {
      const result = fn();
      return result;
    } finally {
      const afterSnapshot = deepClone(getStateFn());
      transactionDepth = 0;

      // Empty Transaction Guard: if no state changed, skip redundant history & notification
      const hasChanged = !deepEqual(rootBeforeSnapshot, afterSnapshot);

      if (hasChanged) {
        const aggregatedMutation = {
          type: 'transaction',
          storeId,
          title: currentTransactionTitle,
          timestamp: Date.now(),
          before: rootBeforeSnapshot,
          after: afterSnapshot
        };

        if (recordHistory) {
          recordHistory({
            title: currentTransactionTitle,
            before: rootBeforeSnapshot,
            after: afterSnapshot
          });
        }

        if (notifySubscribers) {
          notifySubscribers(aggregatedMutation);
        }
      }

      rootBeforeSnapshot = null;
      currentTransactionTitle = null;
    }
  }

  function isInTransaction() {
    return transactionDepth > 0;
  }

  return {
    runTransaction,
    isInTransaction
  };
}
