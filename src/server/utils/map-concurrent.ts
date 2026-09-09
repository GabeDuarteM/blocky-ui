export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];

      if (item !== undefined) {
        results[index] = await run(item);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
}
