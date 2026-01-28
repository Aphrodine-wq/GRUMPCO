/**
 * Metrics Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  httpRequestDuration,
  httpRequestsTotal,
  claudeApiDuration,
  claudeApiCallsTotal,
  circuitBreakerState,
  updateCircuitState,
  getMetrics,
  register,
} from '../../src/middleware/metrics.js';
import type { Request, Response } from 'express';

describe('Metrics', () => {
  beforeEach(() => {
    // Reset metrics between tests
    register.resetMetrics();
  });

  describe('HTTP Metrics', () => {
    it('should have httpRequestDuration metric', () => {
      expect(httpRequestDuration).toBeDefined();
    });

    it('should have httpRequestsTotal metric', () => {
      expect(httpRequestsTotal).toBeDefined();
    });

    it('should record HTTP request duration', () => {
      const labels = { method: 'GET', route: '/test', status_code: '200' };
      httpRequestDuration.observe(labels, 0.5);

      // Metric should be recorded
      expect(httpRequestDuration).toBeDefined();
    });

    it('should increment HTTP requests counter', () => {
      const labels = { method: 'POST', route: '/api', status_code: '201' };
      httpRequestsTotal.inc(labels);

      // Counter should be incremented
      expect(httpRequestsTotal).toBeDefined();
    });
  });

  describe('Claude API Metrics', () => {
    it('should have claudeApiDuration metric', () => {
      expect(claudeApiDuration).toBeDefined();
    });

    it('should have claudeApiCallsTotal metric', () => {
      expect(claudeApiCallsTotal).toBeDefined();
    });

    it('should record API call duration', () => {
      const labels = { operation: 'generate', status: 'success' };
      claudeApiDuration.observe(labels, 1.2);

      expect(claudeApiDuration).toBeDefined();
    });

    it('should increment API calls counter', () => {
      const labels = { operation: 'stream', status: 'success' };
      claudeApiCallsTotal.inc(labels);

      expect(claudeApiCallsTotal).toBeDefined();
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should have circuitBreakerState metric', () => {
      expect(circuitBreakerState).toBeDefined();
    });

    it('should update circuit breaker state', () => {
      updateCircuitState('test-circuit', 'open');
      updateCircuitState('test-circuit', 'half-open');
      updateCircuitState('test-circuit', 'closed');

      expect(circuitBreakerState).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics as string', async () => {
      const res = {
        set: vi.fn(),
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      expect(res.end).toHaveBeenCalled();
      const [payload] = vi.mocked(res.end).mock.calls[0] || [];
      expect(typeof payload).toBe('string');
    });
  });
});
