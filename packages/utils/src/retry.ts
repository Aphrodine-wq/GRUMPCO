/**
 * Retry Utilities
 * 
 * Provides retry logic with exponential backoff for resilient operations.
 */

import { getErrorMessage } from './errors.js';

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Backoff multiplier */
  backoffFactor?: number;
  /** Whether to add jitter to delays */
  jitter?: boolean;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Executes a function with retry logic and exponential backoff.
 * 
 * @param fn - The function to execute
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all retries fail
 * 
 * @example
 * ```ts
 * const result = await retry(
 *   () => fetchData('/api/resource'),
 *   { maxAttempts: 5, onRetry: (n) => console.log(`Retry ${n}`) }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      if (opts.isRetryable && !opts.isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delay = opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1);
      delay = Math.min(delay, opts.maxDelayMs);

      // Add jitter
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      opts.onRetry?.(attempt, error, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration.
 * 
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a promise that rejects after a timeout.
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Message for timeout error
 * @returns The result of the promise or throws on timeout
 * 
 * @example
 * ```ts
 * const result = await withTimeout(
 *   fetchData('/api/slow'),
 *   5000,
 *   'Request timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Executes a function and logs errors without throwing.
 * 
 * @param fn - The function to execute
 * @param context - Context for error logging
 * @param logger - Logger function (default: console.warn)
 * @returns The result or undefined on error
 * 
 * @example
 * ```ts
 * const result = await safeExecute(
 *   () => parseConfig(data),
 *   'parseConfig'
 * );
 * ```
 */
export async function safeExecute<T>(
  fn: () => Promise<T> | T,
  context: string,
  logger: (message: string) => void = console.warn
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logger(`[${context}] ${getErrorMessage(error)}`);
    return undefined;
  }
}
