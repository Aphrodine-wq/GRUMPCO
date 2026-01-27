/**
 * Bulkheads Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCircuitBreaker,
  checkRateLimit,
  getServiceState,
  getAllServiceStates,
  resetCircuitBreaker,
  resetRateLimit,
} from '../../src/services/bulkheads.js';

describe('Bulkheads', () => {
  beforeEach(() => {
    // Reset state between tests
    resetCircuitBreaker('claude-chat');
    resetRateLimit('claude-chat');
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const result = checkRateLimit('claude-chat');
      expect(result.allowed).toBe(true);
    });

    it('should reject requests exceeding rate limit', () => {
      // Make many requests to exceed limit
      const limit = 100; // From config
      for (let i = 0; i < limit; i++) {
        checkRateLimit('claude-chat');
      }

      const result = checkRateLimit('claude-chat');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reset rate limit after window', async () => {
      // Exceed limit
      for (let i = 0; i < 101; i++) {
        checkRateLimit('claude-chat');
      }

      // Reset
      resetRateLimit('claude-chat');

      // Should be allowed again
      const result = checkRateLimit('claude-chat');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create circuit breaker for service', () => {
      const fn = vi.fn(async () => 'success');
      const breaker = getCircuitBreaker('claude-chat', fn);

      expect(breaker).toBeDefined();
    });

    it('should reuse existing circuit breaker', () => {
      const fn1 = vi.fn(async () => 'success1');
      const fn2 = vi.fn(async () => 'success2');

      const breaker1 = getCircuitBreaker('claude-chat', fn1);
      const breaker2 = getCircuitBreaker('claude-chat', fn2);

      expect(breaker1).toBe(breaker2);
    });
  });

  describe('getServiceState', () => {
    it('should return service state', () => {
      const state = getServiceState('claude-chat');

      expect(state).toBeDefined();
      expect(state.state).toBeDefined();
      expect(['open', 'half-open', 'closed']).toContain(state.state);
      expect(state.rateLimit).toBeDefined();
      expect(state.rateLimit.current).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllServiceStates', () => {
    it('should return all service states', () => {
      const states = getAllServiceStates();

      expect(states).toBeDefined();
      expect(states['claude-chat']).toBeDefined();
      expect(states['claude-context']).toBeDefined();
      expect(states['claude-diagram']).toBeDefined();
      expect(states['claude-code']).toBeDefined();
      expect(states['claude-agent']).toBeDefined();
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker state', () => {
      resetCircuitBreaker('claude-chat');
      const state = getServiceState('claude-chat');
      expect(state.state).toBe('closed');
    });
  });
});
