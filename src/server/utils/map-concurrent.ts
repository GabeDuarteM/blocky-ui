export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];

      if (item !== undefined) {
        // biome-ignore lint/performance/noAwaitInLoops: A worker must finish its current item before taking another concurrency slot.
        results[index] = await run(item);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
}
