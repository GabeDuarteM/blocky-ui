import type { LogEntry } from "~/server/logs/types";

interface Candidate {
  entry: LogEntry;
  time: number;
  order: number;
}

function compare(a: Candidate, b: Candidate) {
  return b.time - a.time || a.order - b.order;
}

function pushCandidate(heap: Candidate[], candidate: Candidate) {
  heap.push(candidate);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    const previous = heap[parent];
    if (!previous || compare(candidate, previous) <= 0) {
      break;
    }
    heap[index] = previous;
    index = parent;
  }
  heap[index] = candidate;
}

export function createLogPage(limit: number) {
  const heap: Candidate[] = [];
  let totalCount = 0;
  return {
    add(entry: LogEntry) {
      const candidate = {
        entry,
        time: Date.parse(entry.requestTs ?? "") || 0,
        order: totalCount,
      };
      totalCount += 1;
      if (limit === 0) {
        return;
      }
      if (heap.length < limit) {
        pushCandidate(heap, candidate);
        return;
      }
      const [worst] = heap;
      if (!worst || compare(candidate, worst) >= 0) {
        return;
      }
      let index = 0;
      for (;;) {
        let childIndex = index * 2 + 1;
        let child = heap[childIndex];
        const right = heap[childIndex + 1];
        if (right && child && compare(right, child) > 0) {
          child = right;
          childIndex += 1;
        }
        if (!child || compare(candidate, child) >= 0) {
          break;
        }
        heap[index] = child;
        index = childIndex;
      }
      heap[index] = candidate;
    },
    canSkipBefore(time: number) {
      return (
        heap.length === limit &&
        (heap[0]?.time ?? Number.NEGATIVE_INFINITY) >= time
      );
    },
    result() {
      return {
        items: heap.sort(compare).map(({ entry }) => entry),
        totalCount,
      };
    },
  };
}
