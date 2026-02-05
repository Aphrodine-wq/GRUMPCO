/**
 * Executes an array of items with a controlled concurrency limit.
 *
 * @param items The array of items to process
 * @param concurrency The maximum number of concurrent executions
 * @param fn The async function to execute for each item
 * @returns A promise that resolves to an array of results in the same order as items
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch (error) {
        // If one fails, we should probably let it bubble up via Promise.all
        // But wrapped in the worker, we need to handle it.
        // Standard Promise.all behavior is fail-fast.
        throw error;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}
