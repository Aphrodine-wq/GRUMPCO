import CircuitBreaker from 'opossum';
import retry from 'async-retry';
import logger from '../middleware/logger.js';
import { updateCircuitState } from '../middleware/metrics.js';

// Circuit breaker configuration
export const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 30000, // 30s timeout for Claude API calls
  errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
  resetTimeout: 30000, // Try again after 30s
  volumeThreshold: 5, // Minimum requests before circuit can trip
};

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

// Retry configuration
const RETRY_OPTIONS: retry.Options = {
  retries: 3,
  minTimeout: isTestEnv ? 10 : 1000,
  maxTimeout: isTestEnv ? 50 : 10000,
  factor: 2,
  onRetry: (error: unknown, attempt: number) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn({ error: err.message, attempt }, 'Retrying Claude API call');
  },
};

// Errors that should trigger retry
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];

export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  retryAfter?: number;
}

export function isRetryableError(error: ErrorWithStatus): boolean {
  const status = error.status || error.statusCode;
  return (
    (status !== undefined && RETRYABLE_STATUS_CODES.includes(status)) ||
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.message?.toLowerCase().includes('overloaded')
  );
}

type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

// Create a circuit breaker for any async function
export function createCircuitBreaker<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  name = 'claude-api'
): CircuitBreaker<T, R> {
  const breaker = new CircuitBreaker(fn, {
    ...CIRCUIT_BREAKER_OPTIONS,
    errorFilter: (error: ErrorWithStatus) => {
      const status = error.status || error.statusCode;
      return status !== undefined && status >= 400 && status < 500 && status !== 429;
    },
    ...(isTestEnv
      ? {
          timeout: Math.min(CIRCUIT_BREAKER_OPTIONS.timeout, 2000),
          resetTimeout: Math.min(CIRCUIT_BREAKER_OPTIONS.resetTimeout, 2000),
          volumeThreshold: Math.min(CIRCUIT_BREAKER_OPTIONS.volumeThreshold, 2),
        }
      : {}),
    name,
  });

  let previousState: 'closed' | 'half-open' | 'open' = 'closed';

  breaker.on('open', () => {
    logger.error({ circuit: name }, 'Circuit breaker opened - API unavailable');
    updateCircuitState(name, 'open', previousState);
    previousState = 'open';
  });

  breaker.on('halfOpen', () => {
    logger.info({ circuit: name }, 'Circuit breaker half-open - testing API');
    updateCircuitState(name, 'half-open', previousState);
    previousState = 'half-open';
  });

  breaker.on('close', () => {
    logger.info({ circuit: name }, 'Circuit breaker closed - API recovered');
    updateCircuitState(name, 'closed', previousState);
    previousState = 'closed';
  });

  breaker.on('timeout', () => {
    logger.warn({ circuit: name }, 'Circuit breaker timeout');
  });

  breaker.on('reject', () => {
    logger.warn({ circuit: name }, 'Circuit breaker rejected request');
  });

  return breaker;
}

// Wrap a function with retry logic
export function withRetry<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  options: Partial<retry.Options> = {}
): AsyncFunction<T, R> {
  return async (...args: T): Promise<R> => {
    return retry(async (bail, _attempt) => {
      try {
        return await fn(...args);
      } catch (error) {
        const err = error as ErrorWithStatus;
        // Don't retry client errors (except rate limits)
        if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
          bail(err);
          return undefined as R;
        }

        // Don't retry if not a retryable error
        if (!isRetryableError(err)) {
          bail(err);
          return undefined as R;
        }

        throw error; // Triggers retry
      }
    }, { ...RETRY_OPTIONS, ...options });
  };
}

interface CircuitError extends Error {
  code?: string;
  status?: number;
  retryAfter?: number;
}

// Combined circuit breaker + retry wrapper
export function withResilience<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  name = 'claude-api'
): AsyncFunction<T, R> {
  const retriedFn = withRetry(fn);
  const breaker = createCircuitBreaker(retriedFn, name);

  return async (...args: T): Promise<R> => {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      // Enhance error with circuit state info
      if (breaker.opened) {
        const enhancedError: CircuitError = new Error('Service temporarily unavailable');
        enhancedError.code = 'CIRCUIT_OPEN';
        enhancedError.status = 503;
        enhancedError.retryAfter = Math.ceil(CIRCUIT_BREAKER_OPTIONS.resetTimeout / 1000);
        throw enhancedError;
      }
      throw error;
    }
  };
}

interface CircuitStats {
  state: 'open' | 'half-open' | 'closed';
  stats: unknown;
}

// Get circuit breaker stats for metrics
export function getCircuitStats<T extends unknown[], R>(
  breaker: CircuitBreaker<T, R>
): CircuitStats {
  return {
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    stats: breaker.stats,
  };
}
