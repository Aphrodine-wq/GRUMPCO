/**
 * Bulkheads Service Unit Tests
 * Tests bulkhead pattern with per-service circuit breakers and rate limiting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ServiceType } from '../../src/services/bulkheads.js';

// Mock resilience module
vi.mock('../../src/services/resilience.js', () => {
  const mockBreaker = {
    opened: false,
    halfOpen: false,
    close: vi.fn(),
    stats: {
      successes: 0,
      failures: 0,
      timeouts: 0,
    },
    fire: vi.fn(),
    on: vi.fn(),
  };
  return {
    createCircuitBreaker: vi.fn(() => mockBreaker),
  };
});

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('bulkheads', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      const result = checkRateLimit('nim-chat');
      
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should track multiple requests', async () => {
      const { checkRateLimit, resetRateLimit, getServiceState } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit('nim-chat');
      }
      
      const state = getServiceState('nim-chat');
      expect(state.rateLimit.current).toBe(5);
    });

    it('should reject requests exceeding rate limit', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // nim-chat has limit of 100 requests per minute
      const limit = 100;
      for (let i = 0; i < limit; i++) {
        checkRateLimit('nim-chat');
      }

      const result = checkRateLimit('nim-chat');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle different service types with different limits', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      // Reset both services
      resetRateLimit('nim-chat');
      resetRateLimit('nim-context');
      
      // nim-chat has 100 limit, nim-context has 30 limit
      // Exceed nim-context limit (30)
      for (let i = 0; i < 30; i++) {
        checkRateLimit('nim-context');
      }
      
      // nim-context should be limited
      expect(checkRateLimit('nim-context').allowed).toBe(false);

      // nim-chat should still be allowed
      expect(checkRateLimit('nim-chat').allowed).toBe(true);
    });

    it('should reset window after time passes', async () => {
      vi.useFakeTimers();
      
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-context');
      
      // Exceed limit for nim-context (30 requests/minute)
      for (let i = 0; i < 31; i++) {
        checkRateLimit('nim-context');
      }
      
      expect(checkRateLimit('nim-context').allowed).toBe(false);
      
      // Advance time by more than the window (60 seconds)
      vi.advanceTimersByTime(61000);
      
      // Should be allowed again after window reset
      const result = checkRateLimit('nim-context');
      expect(result.allowed).toBe(true);
      
      vi.useRealTimers();
    });

    it('should calculate correct retryAfter time', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-context');
      
      // Exceed limit
      for (let i = 0; i < 31; i++) {
        checkRateLimit('nim-context');
      }
      
      const result = checkRateLimit('nim-context');
      expect(result.retryAfter).toBeDefined();
      // Should be approximately 60 seconds (window size)
      expect(result.retryAfter).toBeLessThanOrEqual(60);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should filter out old requests outside the window', async () => {
      vi.useFakeTimers();
      
      const { checkRateLimit, resetRateLimit, getServiceState } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // Make 50 requests
      for (let i = 0; i < 50; i++) {
        checkRateLimit('nim-chat');
      }
      
      expect(getServiceState('nim-chat').rateLimit.current).toBe(50);
      
      // Advance time by 30 seconds (half the window)
      vi.advanceTimersByTime(30000);
      
      // Make another request to trigger cleanup
      checkRateLimit('nim-chat');
      
      // Old requests should still be counted (within window)
      const state = getServiceState('nim-chat');
      expect(state.rateLimit.current).toBe(51);
      
      // Advance time past the window
      vi.advanceTimersByTime(31000);
      
      // Make another request to trigger cleanup
      checkRateLimit('nim-chat');
      
      // Now only new requests should be counted
      const newState = getServiceState('nim-chat');
      expect(newState.rateLimit.current).toBeLessThan(51);
      
      vi.useRealTimers();
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create circuit breaker for service type', async () => {
      const { getCircuitBreaker } = await import('../../src/services/bulkheads.js');
      const { createCircuitBreaker } = await import('../../src/services/resilience.js');

      const fn = vi.fn(async () => 'success');
      const breaker = getCircuitBreaker('nim-chat', fn);

      expect(breaker).toBeDefined();
      expect(createCircuitBreaker).toHaveBeenCalled();
    });

    it('should reuse existing circuit breaker for same service type', async () => {
      const { getCircuitBreaker } = await import('../../src/services/bulkheads.js');

      const fn1 = vi.fn(async () => 'success1');
      const fn2 = vi.fn(async () => 'success2');

      const breaker1 = getCircuitBreaker('nim-diagram', fn1);
      const breaker2 = getCircuitBreaker('nim-diagram', fn2);

      expect(breaker1).toBe(breaker2);
    });

    it('should create separate circuit breakers for different service types', async () => {
      vi.resetModules();
      
      // Re-mock with unique breakers
      let breakerCount = 0;
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          id: ++breakerCount,
          opened: false,
          halfOpen: false,
          close: vi.fn(),
          stats: {},
          on: vi.fn(),
        })),
      }));

      const { getCircuitBreaker } = await import('../../src/services/bulkheads.js');

      const fn = vi.fn(async () => 'success');
      const breaker1 = getCircuitBreaker('nim-chat', fn);
      const breaker2 = getCircuitBreaker('nim-code', fn);

      expect(breaker1).not.toBe(breaker2);
    });

    it('should log when circuit breaker is created', async () => {
      vi.resetModules();
      
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      
      vi.doMock('../../src/middleware/logger.js', () => ({
        default: mockLogger,
      }));
      
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          opened: false,
          halfOpen: false,
          close: vi.fn(),
          on: vi.fn(),
        })),
      }));

      const { getCircuitBreaker } = await import('../../src/services/bulkheads.js');

      const fn = vi.fn(async () => 'success');
      getCircuitBreaker('nim-agent', fn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { serviceType: 'nim-agent' },
        'Circuit breaker created for service'
      );
    });
  });

  describe('getServiceState', () => {
    it('should return service state structure', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      const state = getServiceState('nim-chat');

      expect(state).toBeDefined();
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('stats');
      expect(state).toHaveProperty('rateLimit');
    });

    it('should return correct circuit breaker state - closed', async () => {
      const { getServiceState, getCircuitBreaker } = await import('../../src/services/bulkheads.js');
      
      // Create a circuit breaker first
      const fn = vi.fn(async () => 'success');
      getCircuitBreaker('nim-chat', fn);
      
      const state = getServiceState('nim-chat');
      expect(state.state).toBe('closed');
    });

    it('should return rate limit info', async () => {
      const { getServiceState, resetRateLimit, checkRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // Make some requests
      for (let i = 0; i < 10; i++) {
        checkRateLimit('nim-chat');
      }
      
      const state = getServiceState('nim-chat');
      
      expect(state.rateLimit.current).toBe(10);
      expect(state.rateLimit.limit).toBe(100); // nim-chat limit
      expect(state.rateLimit.windowMs).toBe(60000); // 1 minute
    });

    it('should return closed state when no circuit breaker exists', async () => {
      vi.resetModules();
      
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          opened: false,
          halfOpen: false,
          close: vi.fn(),
          on: vi.fn(),
        })),
      }));

      const { getServiceState } = await import('../../src/services/bulkheads.js');
      
      const state = getServiceState('nim-code');
      expect(state.state).toBe('closed');
    });

    it('should return stats when available', async () => {
      const { getServiceState, getCircuitBreaker } = await import('../../src/services/bulkheads.js');
      
      const fn = vi.fn(async () => 'success');
      getCircuitBreaker('nim-chat', fn);
      
      const state = getServiceState('nim-chat');
      expect(state.stats).toBeDefined();
    });
  });

  describe('getAllServiceStates', () => {
    it('should return states for all service types', async () => {
      const { getAllServiceStates } = await import('../../src/services/bulkheads.js');
      
      const states = getAllServiceStates();

      expect(states).toBeDefined();
      expect(states['nim-chat']).toBeDefined();
      expect(states['nim-context']).toBeDefined();
      expect(states['nim-diagram']).toBeDefined();
      expect(states['nim-code']).toBeDefined();
      expect(states['nim-agent']).toBeDefined();
    });

    it('should return consistent structure for all services', async () => {
      const { getAllServiceStates } = await import('../../src/services/bulkheads.js');
      
      const states = getAllServiceStates();

      const serviceTypes: ServiceType[] = [
        'nim-chat',
        'nim-context',
        'nim-diagram',
        'nim-code',
        'nim-agent',
      ];

      for (const serviceType of serviceTypes) {
        const state = states[serviceType];
        expect(state).toHaveProperty('state');
        expect(state).toHaveProperty('stats');
        expect(state).toHaveProperty('rateLimit');
        expect(state.rateLimit).toHaveProperty('current');
        expect(state.rateLimit).toHaveProperty('limit');
        expect(state.rateLimit).toHaveProperty('windowMs');
      }
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker to closed state', async () => {
      const { resetCircuitBreaker, getCircuitBreaker, getServiceState } = await import('../../src/services/bulkheads.js');
      
      // Create a circuit breaker
      const fn = vi.fn(async () => 'success');
      getCircuitBreaker('nim-chat', fn);
      
      resetCircuitBreaker('nim-chat');
      
      const state = getServiceState('nim-chat');
      expect(state.state).toBe('closed');
    });

    it('should do nothing when circuit breaker does not exist', async () => {
      vi.resetModules();
      
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          opened: false,
          halfOpen: false,
          close: vi.fn(),
          on: vi.fn(),
        })),
      }));

      const { resetCircuitBreaker } = await import('../../src/services/bulkheads.js');
      
      // Should not throw
      expect(() => resetCircuitBreaker('nim-chat')).not.toThrow();
    });

    it('should log when resetting', async () => {
      vi.resetModules();
      
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      
      const mockClose = vi.fn();
      
      vi.doMock('../../src/middleware/logger.js', () => ({
        default: mockLogger,
      }));
      
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          opened: false,
          halfOpen: false,
          close: mockClose,
          on: vi.fn(),
        })),
      }));

      const { getCircuitBreaker, resetCircuitBreaker } = await import('../../src/services/bulkheads.js');
      
      const fn = vi.fn(async () => 'success');
      getCircuitBreaker('nim-chat', fn);
      
      mockLogger.info.mockClear();
      resetCircuitBreaker('nim-chat');

      expect(mockClose).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { serviceType: 'nim-chat' },
        'Circuit breaker reset'
      );
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit state', async () => {
      const { resetRateLimit, checkRateLimit, getServiceState } = await import('../../src/services/bulkheads.js');
      
      // Make some requests
      for (let i = 0; i < 50; i++) {
        checkRateLimit('nim-chat');
      }
      
      expect(getServiceState('nim-chat').rateLimit.current).toBe(50);
      
      resetRateLimit('nim-chat');
      
      expect(getServiceState('nim-chat').rateLimit.current).toBe(0);
    });

    it('should allow requests after reset', async () => {
      const { resetRateLimit, checkRateLimit } = await import('../../src/services/bulkheads.js');
      
      // Exceed limit
      for (let i = 0; i < 101; i++) {
        checkRateLimit('nim-chat');
      }
      
      expect(checkRateLimit('nim-chat').allowed).toBe(false);
      
      resetRateLimit('nim-chat');
      
      expect(checkRateLimit('nim-chat').allowed).toBe(true);
    });

    it('should log when resetting', async () => {
      vi.resetModules();
      
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      
      vi.doMock('../../src/middleware/logger.js', () => ({
        default: mockLogger,
      }));
      
      vi.doMock('../../src/services/resilience.js', () => ({
        createCircuitBreaker: vi.fn(() => ({
          opened: false,
          halfOpen: false,
          close: vi.fn(),
          on: vi.fn(),
        })),
      }));

      const { resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-context');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { serviceType: 'nim-context' },
        'Rate limit state reset'
      );
    });
  });

  describe('Service configurations', () => {
    it('should have correct rate limits for nim-chat', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      const state = getServiceState('nim-chat');
      
      expect(state.rateLimit.limit).toBe(100);
      expect(state.rateLimit.windowMs).toBe(60000);
    });

    it('should have correct rate limits for nim-context', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-context');
      const state = getServiceState('nim-context');
      
      expect(state.rateLimit.limit).toBe(30);
      expect(state.rateLimit.windowMs).toBe(60000);
    });

    it('should have correct rate limits for nim-diagram', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-diagram');
      const state = getServiceState('nim-diagram');
      
      expect(state.rateLimit.limit).toBe(50);
      expect(state.rateLimit.windowMs).toBe(60000);
    });

    it('should have correct rate limits for nim-code', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-code');
      const state = getServiceState('nim-code');
      
      expect(state.rateLimit.limit).toBe(40);
      expect(state.rateLimit.windowMs).toBe(60000);
    });

    it('should have correct rate limits for nim-agent', async () => {
      const { getServiceState, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-agent');
      const state = getServiceState('nim-agent');
      
      expect(state.rateLimit.limit).toBe(80);
      expect(state.rateLimit.windowMs).toBe(60000);
    });
  });

  describe('Isolation', () => {
    it('should isolate rate limits between services', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      // Reset all
      resetRateLimit('nim-chat');
      resetRateLimit('nim-context');
      
      // Exceed nim-context limit (30)
      for (let i = 0; i < 31; i++) {
        checkRateLimit('nim-context');
      }
      
      // nim-context should be limited
      expect(checkRateLimit('nim-context').allowed).toBe(false);

      // nim-chat should still be allowed
      expect(checkRateLimit('nim-chat').allowed).toBe(true);
    });

    it('should isolate circuit breaker states between services', async () => {
      const { getCircuitBreaker, getServiceState } = await import('../../src/services/bulkheads.js');
      
      const fn = vi.fn(async () => 'success');
      
      // Create circuit breakers for different services
      getCircuitBreaker('nim-chat', fn);
      getCircuitBreaker('nim-code', fn);
      
      // Both should have independent states
      const chatState = getServiceState('nim-chat');
      const codeState = getServiceState('nim-code');
      
      expect(chatState.state).toBe('closed');
      expect(codeState.state).toBe('closed');
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid concurrent requests', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // Make many concurrent requests
      const results = Array.from({ length: 50 }, () => checkRateLimit('nim-chat'));
      
      // All should be allowed (under limit)
      expect(results.every(r => r.allowed)).toBe(true);
    });

    it('should handle exact rate limit boundary', async () => {
      const { checkRateLimit, resetRateLimit } = await import('../../src/services/bulkheads.js');
      
      resetRateLimit('nim-chat');
      
      // Make exactly 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit('nim-chat');
        expect(result.allowed).toBe(true);
      }
      
      // 101st request should be rejected
      const result = checkRateLimit('nim-chat');
      expect(result.allowed).toBe(false);
    });
  });
});
