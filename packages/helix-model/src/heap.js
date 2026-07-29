// ==========================================
// HEAP (Top-K)
// ==========================================
// Max-heap keyed by `comparator`: the root is the "largest" (worst) of the kept
// set, so the heap retains the K smallest items per comparator. sorted() then
// yields them in comparator (ascending) order — i.e. the first K of a full sort.

export function createHeap(capacity, comparator) {
  const heap = [];

  function push(item) {
    if (heap.length < capacity) {
      heap.push(item);
      siftUp(heap.length - 1);
    } else if (comparator(item, heap[0]) < 0) {
      heap[0] = item;
      siftDown(0);
    }
  }

  function siftUp(i) {
    while (i > 0) {
      const p = (i - 1) >>> 1;
      if (comparator(heap[i], heap[p]) <= 0) break; // parent already >= child
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  }

  function siftDown(i) {
    const n = heap.length;
    while (true) {
      let largest = i;
      const l = i * 2 + 1, r = i * 2 + 2;
      if (l < n && comparator(heap[l], heap[largest]) > 0) largest = l;
      if (r < n && comparator(heap[r], heap[largest]) > 0) largest = r;
      if (largest === i) break;
      [heap[i], heap[largest]] = [heap[largest], heap[i]];
      i = largest;
    }
  }

  function sorted() {
    const result = [...heap];
    result.sort((a, b) => comparator(a, b));
    return result;
  }

  return { push, sorted, size: () => heap.length };
}
