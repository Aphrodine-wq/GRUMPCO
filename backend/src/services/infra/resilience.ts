/**
 * @fileoverview Resilience patterns for external API calls.
 *
 * This module provides circuit breaker and retry logic to make external API
 * calls more resilient to transient failures. It uses:
 *
 * - **Circuit Breaker** (opossum): Prevents cascading failures by temporarily
 *   blocking calls to failing services
 * - **Retry with Exponential Backoff**: Automatically retries failed calls
 *   with increasing delays
 *
 * ## Circuit Breaker States
 *
 * ```
 * CLOSED → (errors exceed threshold) → OPEN
 *    ↑                                    ↓
 *    └──── (success) ← HALF-OPEN ← (timeout expires)
 * ```
 *
 * - **Closed**: Normal operation, requests pass through
 * - **Open**: Circuit tripped, requests fail immediately
 * - **Half-Open**: Testing if service recovered
 *
 * ## Usage
 *
 * ```typescript
 * import { withResilience } from './resilience.js";
 *
 * // Wrap an API call with retry + circuit breaker
 * const resilientFetch = withResilience(
 *   async (url: string) => fetch(url).then(r => r.json()),
 *   'external-api'
 * );
 *
 * // Use like a normal function - retries and circuit breaker are automatic
 * const data = await resilientFetch('https://api.example.com/data');
 * ```
 *
 * @module services/resilience
 */

import CircuitBreaker from "opossum";
import retry from "async-retry";
import logger from "../../middleware/logger.js";
import { updateCircuitState } from "../../middleware/metrics.js";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default circuit breaker configuration.
 * Tuned for LLM API calls which can be slow but should fail fast when down.
 */
export const CIRCUIT_BREAKER_OPTIONS = {
  /** Request timeout - allows for slow LLM responses */
  timeout: 30000,
  /** Percentage of failures that triggers circuit open */
  errorThresholdPercentage: 50,
  /** Time before attempting to close circuit */
  resetTimeout: 30000,
  /** Minimum requests before circuit can trip */
  volumeThreshold: 5,
};

const isTestEnv =
  process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

/**
 * Default retry configuration with exponential backoff.
 * Uses shorter timeouts in test environment.
 */
const RETRY_OPTIONS: retry.Options = {
  retries: 3,
  minTimeout: isTestEnv ? 10 : 1000,
  maxTimeout: isTestEnv ? 50 : 10000,
  factor: 2,
  onRetry: (error: unknown, attempt: number) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn({ error: err.message, attempt }, "Retrying Claude API call");
  },
};

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Error with optional HTTP status information.
 * Used to determine if an error is retryable.
 */
export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  retryAfter?: number;
}

/** Generic async function type */
type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

/**
 * Enhanced error thrown when circuit breaker is open.
 */
interface CircuitError extends Error {
  code?: string;
  status?: number;
  retryAfter?: number;
}

/**
 * Circuit breaker statistics for monitoring.
 */
interface CircuitStats {
  state: "open" | "half-open" | "closed";
  stats: unknown;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines if an error should trigger a retry.
 *
 * Retryable conditions:
 * - Rate limited (429)
 * - Bad gateway (502)
 * - Service unavailable (503)
 * - Gateway timeout (504)
 * - Connection reset (ECONNRESET)
 * - Request timeout (ETIMEDOUT)
 * - Overload message in error text
 *
 * @param error - The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: ErrorWithStatus): boolean {
  const status = error.status || error.statusCode;
  return (
    (status !== undefined && RETRYABLE_STATUS_CODES.includes(status)) ||
    error.code === "ECONNRESET" ||
    error.code === "ETIMEDOUT" ||
    error.message?.toLowerCase().includes("overloaded")
  );
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Creates a circuit breaker for an async function.
 *
 * The circuit breaker monitors call success/failure rates and:
 * - Opens the circuit (blocks calls) when failure rate exceeds threshold
 * - Half-opens after reset timeout to test if service recovered
 * - Closes (resumes normal operation) after successful test call
 *
 * @param fn - Async function to wrap with circuit breaker
 * @param name - Circuit name for logging and metrics
 * @returns Circuit breaker instance
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker(fetchData, 'data-api');
 *
 * try {
 *   const result = await breaker.fire();
 * } catch (error) {
 *   if (breaker.opened) {
 *     console.log('Service is down, circuit is open');
 *   }
 * }
 * ```
 */
export function createCircuitBreaker<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  name = "claude-api",
): CircuitBreaker<T, R> {
  const breaker = new CircuitBreaker(fn, {
    ...CIRCUIT_BREAKER_OPTIONS,
    errorFilter: (error: ErrorWithStatus) => {
      const status = error.status || error.statusCode;
      return (
        status !== undefined && status >= 400 && status < 500 && status !== 429
      );
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

  let previousState: "closed" | "half-open" | "open" = "closed";

  breaker.on("open", () => {
    logger.error({ circuit: name }, "Circuit breaker opened - API unavailable");
    updateCircuitState(name, "open", previousState);
    previousState = "open";
  });

  breaker.on("halfOpen", () => {
    logger.info({ circuit: name }, "Circuit breaker half-open - testing API");
    updateCircuitState(name, "half-open", previousState);
    previousState = "half-open";
  });

  breaker.on("close", () => {
    logger.info({ circuit: name }, "Circuit breaker closed - API recovered");
    updateCircuitState(name, "closed", previousState);
    previousState = "closed";
  });

  breaker.on("timeout", () => {
    logger.warn({ circuit: name }, "Circuit breaker timeout");
  });

  breaker.on("reject", () => {
    logger.warn({ circuit: name }, "Circuit breaker rejected request");
  });

  return breaker;
}

// =============================================================================
// Retry Logic
// =============================================================================

/**
 * Wraps a function with retry logic using exponential backoff.
 *
 * Automatically retries on:
 * - Rate limiting (429)
 * - Server errors (502, 503, 504)
 * - Network errors (ECONNRESET, ETIMEDOUT)
 *
 * Does NOT retry on:
 * - Client errors (400-499 except 429)
 * - Validation errors
 * - Authentication errors
 *
 * @param fn - Async function to wrap
 * @param options - Override default retry options
 * @returns Wrapped function with retry logic
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(
 *   async (url: string) => fetch(url),
 *   { retries: 5 }
 * );
 *
 * // Will retry up to 5 times on transient failures
 * const response = await fetchWithRetry('https://api.example.com');
 * ```
 */
export function withRetry<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  options: Partial<retry.Options> = {},
): AsyncFunction<T, R> {
  return async (...args: T): Promise<R> => {
    return retry(
      async (bail, _attempt) => {
        try {
          return await fn(...args);
        } catch (error) {
          const err = error as ErrorWithStatus;
          // Don't retry client errors (except rate limits)
          if (
            err.status &&
            err.status >= 400 &&
            err.status < 500 &&
            err.status !== 429
          ) {
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
      },
      { ...RETRY_OPTIONS, ...options },
    );
  };
}

// =============================================================================
// Combined Resilience Wrapper
// =============================================================================

/**
 * Wraps a function with both retry logic AND circuit breaker.
 *
 * This is the recommended way to make external API calls resilient.
 * It combines:
 * - **Retry with backoff**: Handles transient failures
 * - **Circuit breaker**: Prevents cascading failures during outages
 *
 * The retry logic runs INSIDE the circuit breaker, so:
 * - Retries happen before the circuit trips
 * - When circuit is open, calls fail immediately without retry
 *
 * @param fn - Async function to wrap
 * @param name - Circuit name for logging/metrics
 * @returns Resilient wrapped function
 *
 * @example
 * ```typescript
 * // Wrap the LLM API call
 * const resilientGenerate = withResilience(
 *   generateDiagram,
 *   'claude-diagram'
 * );
 *
 * try {
 *   const diagram = await resilientGenerate(userMessage);
 * } catch (error) {
 *   if (error.code === 'CIRCUIT_OPEN') {
 *     // Service is down, show user a friendly message
 *     console.log('Service temporarily unavailable, try again in', error.retryAfter, 'seconds');
 *   }
 * }
 * ```
 */
export function withResilience<T extends unknown[], R>(
  fn: AsyncFunction<T, R>,
  name = "claude-api",
): AsyncFunction<T, R> {
  const retriedFn = withRetry(fn);
  const breaker = createCircuitBreaker(retriedFn, name);

  return async (...args: T): Promise<R> => {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      // Enhance error with circuit state info
      if (breaker.opened) {
        const enhancedError: CircuitError = new Error(
          "Service temporarily unavailable",
        );
        enhancedError.code = "CIRCUIT_OPEN";
        enhancedError.status = 503;
        enhancedError.retryAfter = Math.ceil(
          CIRCUIT_BREAKER_OPTIONS.resetTimeout / 1000,
        );
        throw enhancedError;
      }
      throw error;
    }
  };
}

// =============================================================================
// Monitoring
// =============================================================================

/**
 * Gets current statistics from a circuit breaker.
 *
 * Useful for monitoring dashboards and health checks.
 *
 * @param breaker - Circuit breaker instance to query
 * @returns Current state and statistics
 *
 * @example
 * ```typescript
 * const stats = getCircuitStats(myBreaker);
 * console.log('Circuit state:', stats.state);
 * // => 'closed' | 'half-open' | 'open'
 * ```
 */
export function getCircuitStats<T extends unknown[], R>(
  breaker: CircuitBreaker<T, R>,
): CircuitStats {
  return {
    state: breaker.opened ? "open" : breaker.halfOpen ? "half-open" : "closed",
    stats: breaker.stats,
  };
}
