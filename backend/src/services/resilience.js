import CircuitBreaker from 'opossum';
import retry from 'async-retry';
import { logger } from '../middleware/logger.js';
// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
    timeout: 30000, // 30s timeout for Claude API calls
    errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
    resetTimeout: 30000, // Try again after 30s
    volumeThreshold: 5, // Minimum requests before circuit can trip
};
// Retry configuration
const RETRY_OPTIONS = {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
    onRetry: (error, attempt) => {
        logger.warn({ error: error.message, attempt }, 'Retrying Claude API call');
    },
};
// Errors that should trigger retry
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];
function isRetryableError(error) {
    const status = error.status || error.statusCode;
    return RETRYABLE_STATUS_CODES.includes(status) ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.toLowerCase().includes('overloaded');
}
// Create a circuit breaker for any async function
export function createCircuitBreaker(fn, name = 'claude-api') {
    const breaker = new CircuitBreaker(fn, {
        ...CIRCUIT_BREAKER_OPTIONS,
        name,
    });
    breaker.on('open', () => {
        logger.error({ circuit: name }, 'Circuit breaker opened - API unavailable');
    });
    breaker.on('halfOpen', () => {
        logger.info({ circuit: name }, 'Circuit breaker half-open - testing API');
    });
    breaker.on('close', () => {
        logger.info({ circuit: name }, 'Circuit breaker closed - API recovered');
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
export function withRetry(fn, options = {}) {
    return async (...args) => {
        return retry(async (bail, _attempt) => {
            try {
                return await fn(...args);
            }
            catch (error) {
                // Don't retry client errors (except rate limits)
                if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                    bail(error);
                    return;
                }
                // Don't retry if not a retryable error
                if (!isRetryableError(error)) {
                    bail(error);
                    return;
                }
                throw error; // Triggers retry
            }
        }, { ...RETRY_OPTIONS, ...options });
    };
}
// Combined circuit breaker + retry wrapper
export function withResilience(fn, name = 'claude-api') {
    const retriedFn = withRetry(fn);
    const breaker = createCircuitBreaker(retriedFn, name);
    return async (...args) => {
        try {
            return await breaker.fire(...args);
        }
        catch (error) {
            // Enhance error with circuit state info
            if (breaker.opened) {
                const enhancedError = new Error('Service temporarily unavailable');
                enhancedError.code = 'CIRCUIT_OPEN';
                enhancedError.status = 503;
                enhancedError.retryAfter = Math.ceil(CIRCUIT_BREAKER_OPTIONS.resetTimeout / 1000);
                throw enhancedError;
            }
            throw error;
        }
    };
}
// Get circuit breaker stats for metrics
export function getCircuitStats(breaker) {
    return {
        state: breaker.opened ? 'open' : (breaker.halfOpen ? 'half-open' : 'closed'),
        stats: breaker.stats,
    };
}
// Export for metrics collection
export { CIRCUIT_BREAKER_OPTIONS };
//# sourceMappingURL=resilience.js.map