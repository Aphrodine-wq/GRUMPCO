import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCircuitBreaker,
  withRetry,
  withResilience,
  CIRCUIT_BREAKER_OPTIONS,
} from '../../src/services/resilience.ts';

describe('resilience', () => {
  describe('withRetry', () => {
    it('should retry on retryable errors', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const error: Error & { status?: number } = new Error('Temporary failure');
          error.status = 503;
          throw error;
        }
        return 'success';
      });

      const retriedFn = withRetry(fn);
      const result = await retriedFn();

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry on client errors', async () => {
      const fn = vi.fn(async () => {
        const error: Error & { status?: number } = new Error('Bad request');
        error.status = 400;
        throw error;
      });

      const retriedFn = withRetry(fn);

      await expect(retriedFn()).rejects.toThrow('Bad request');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit errors', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error: Error & { status?: number } = new Error('Rate limited');
          error.status = 429;
          throw error;
        }
        return 'success';
      });

      const retriedFn = withRetry(fn);
      const result = await retriedFn();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('createCircuitBreaker', () => {
    it('should execute function when circuit is closed', async () => {
      const fn = vi.fn(async () => 'success');
      const breaker = createCircuitBreaker(fn, 'test-circuit');

      const result = await breaker.fire();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after error threshold', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Service unavailable');
      });

      const breaker = createCircuitBreaker(fn, 'test-circuit');

      // Fire multiple requests to trip the circuit
      const promises = Array.from({ length: 10 }, () =>
        breaker.fire().catch(() => undefined)
      );
      await Promise.all(promises);

      // Circuit should be open now
      expect(breaker.opened).toBe(true);
    });

    it('should reject requests when circuit is open', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Service unavailable');
      });

      const breaker = createCircuitBreaker(fn, 'test-circuit');

      // Trip the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch {
          // Ignore errors
        }
      }

      // Wait for circuit to open
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should reject immediately when open
      await expect(breaker.fire()).rejects.toThrow();
    });
  });

  describe('withResilience', () => {
    it('should combine retry and circuit breaker', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error: Error & { status?: number } = new Error('Temporary failure');
          error.status = 503;
          throw error;
        }
        return 'success';
      });

      const resilientFn = withResilience(fn, 'test-circuit');
      const result = await resilientFn();

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw enhanced error when circuit is open', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Service unavailable');
      });

      const resilientFn = withResilience(fn, 'test-circuit');

      // Trip the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await resilientFn();
        } catch (error) {
          const err = error as Error & { code?: string; status?: number };
          if (err.code === 'CIRCUIT_OPEN') {
            expect(err.status).toBe(503);
            expect(err.code).toBe('CIRCUIT_OPEN');
            return;
          }
        }
      }
    });
  });

  describe('circuit breaker configuration', () => {
    it('should use correct timeout', () => {
      expect(CIRCUIT_BREAKER_OPTIONS.timeout).toBe(30000);
    });

    it('should use correct error threshold', () => {
      expect(CIRCUIT_BREAKER_OPTIONS.errorThresholdPercentage).toBe(50);
    });

    it('should use correct reset timeout', () => {
      expect(CIRCUIT_BREAKER_OPTIONS.resetTimeout).toBe(30000);
    });
  });
});
