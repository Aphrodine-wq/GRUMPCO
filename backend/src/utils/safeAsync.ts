/**
 * Safe async utilities for handling promises without silent failures.
 * Provides logging for fire-and-forget operations and graceful error handling.
 *
 * @module safeAsync
 */

import { logger } from '../middleware/logger.js';

/**
 * Wraps a promise to log errors instead of silently swallowing them.
 * Use this for fire-and-forget operations where you don't need the result
 * but want visibility into failures.
 *
 * @param promise - The promise to wrap
 * @param context - Description of the operation for logging
 * @param metadata - Optional additional metadata for the log entry
 * @returns The original value on success, undefined on error
 *
 * @example
 * // Instead of: cache.set(key, value).catch(() => {});
 * // Use: logOnError(cache.set(key, value), 'Cache set', { key });
 */
export function logOnError<T>(
  promise: Promise<T>,
  context: string,
  metadata?: Record<string, unknown>
): Promise<T | undefined> {
  return promise.catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn({ ...metadata, error: errorMessage, context }, `${context} failed`);
    return undefined;
  });
}

/**
 * Wraps a promise with a timeout.
 * Rejects with a timeout error if the promise doesn't resolve in time.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Description of the operation for error messages
 * @returns The promise result or throws a timeout error
 *
 * @example
 * const result = await withTimeout(fetchData(), 5000, 'Data fetch');
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${context} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Retries a promise-returning function with exponential backoff.
 *
 * @param fn - Function that returns a promise
 * @param options - Retry options
 * @returns The result of the function
 *
 * @example
 * const result = await retry(
 *   () => fetchExternalApi(),
 *   { maxAttempts: 3, baseDelayMs: 1000, context: 'External API fetch' }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    context?: string;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    context = 'Operation',
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (attempt === maxAttempts || !shouldRetry(err, attempt)) {
        logger.error(
          { error: errorMessage, attempt, maxAttempts, context },
          `${context} failed after ${attempt} attempts`
        );
        throw err;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      logger.warn(
        { error: errorMessage, attempt, maxAttempts, nextRetryMs: delay, context },
        `${context} failed, retrying...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Executes multiple promises in parallel with a concurrency limit.
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum number of concurrent operations
 * @returns Array of results in the same order as inputs
 *
 * @example
 * const results = await parallelLimit(
 *   urls,
 *   (url) => fetch(url).then(r => r.json()),
 *   5
 * );
 */
export async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Safely executes an async cleanup function, logging any errors.
 * Useful for cleanup in finally blocks where you don't want to throw.
 *
 * @param fn - Cleanup function to execute
 * @param context - Description of the cleanup operation
 *
 * @example
 * try {
 *   await doWork();
 * } finally {
 *   await safeCleanup(() => connection.close(), 'Close connection');
 * }
 */
export async function safeCleanup(fn: () => Promise<void> | void, context: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn({ error: errorMessage, context }, `${context} cleanup failed`);
  }
}

/**
 * Creates a debounced version of an async function.
 * Only the last call within the delay period will be executed.
 *
 * @param fn - The async function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function
 */
export function debounceAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  delayMs: number
): (...args: TArgs) => Promise<TResult | undefined> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: TArgs): Promise<TResult | undefined> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch {
          resolve(undefined);
        }
      }, delayMs);
    });
  };
}

/**
 * Wraps a function to ensure only one instance runs at a time.
 * Subsequent calls while running will wait for the current execution.
 *
 * @param fn - The async function to wrap
 * @returns Singleton-ified function
 */
export function singleton<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  let pending: Promise<TResult> | null = null;

  return async (...args: TArgs): Promise<TResult> => {
    if (pending) {
      return pending;
    }

    pending = fn(...args);

    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}
