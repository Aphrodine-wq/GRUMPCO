/**
 * Smart Retry Service unit tests
 * Run: npm test -- smartRetry.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for variables referenced in vi.mock() factories
const { mockLogger, mockRecordLlmStreamMetrics } = vi.hoisted(() => {
  return {
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockRecordLlmStreamMetrics: vi.fn(),
  };
});

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/middleware/metrics.js', () => ({
  recordLlmStreamMetrics: mockRecordLlmStreamMetrics,
}));

import { smartRetry, streamWithRetry, SmartRetryService } from '../../src/services/smartRetry.js';
import type { LLMProvider, StreamParams, StreamEvent } from '../../src/services/llmGateway.js';

describe('smartRetry', () => {
  beforeEach(() => {
    smartRetry.resetCircuitBreakers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const events: StreamEvent[] = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'message_stop' },
      ];

      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        for (const event of events) {
          yield event;
        }
      });

      const results: StreamEvent[] = [];
      for await (const event of smartRetry.executeWithRetry('nim', {} as StreamParams, mockStreamFn)) {
        results.push(event);
      }

      expect(results).toHaveLength(2);
      expect(mockStreamFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      let attemptCount = 0;
      const events: StreamEvent[] = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'message_stop' },
      ];

      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('ETIMEDOUT: Connection timeout');
        }
        for (const event of events) {
          yield event;
        }
      });

      const results: StreamEvent[] = [];
      for await (const event of smartRetry.executeWithRetry('nim', {} as StreamParams, mockStreamFn)) {
        results.push(event);
      }

      expect(results).toHaveLength(2);
      expect(mockStreamFn).toHaveBeenCalledTimes(2);
    });

    it('should fallback to different provider after retries', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* (provider: LLMProvider) {
        if (provider === 'nim') {
          throw new Error('Service unavailable');
        }
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Success' } };
        yield { type: 'message_stop' };
      });

      const results: StreamEvent[] = [];
      for await (const event of smartRetry.executeWithRetry(
        'nim',
        {} as StreamParams,
        mockStreamFn,
        { maxAttempts: 2 }
      )) {
        results.push(event);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return error when all providers fail', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        throw new Error('All services down');
      });

      const results: StreamEvent[] = [];
      for await (const event of smartRetry.executeWithRetry(
        'nim',
        {} as StreamParams,
        mockStreamFn,
        { maxAttempts: 1 }
      )) {
        results.push(event);
      }

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('error');
    });

    it('should track provider performance metrics', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      for await (const _ of smartRetry.executeWithRetry('nim', {} as StreamParams, mockStreamFn)) {
        // consume
      }

      // Verify the stream function was called successfully
      expect(mockStreamFn).toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        throw new Error('timeout');
      });

      // Cause 5 failures
      for (let i = 0; i < 5; i++) {
        const results: StreamEvent[] = [];
        for await (const event of smartRetry.executeWithRetry('anthropic', {} as StreamParams, mockStreamFn, { maxAttempts: 1 })) {
          results.push(event);
        }
      }

      const status = smartRetry.getCircuitBreakerStatus();
      expect(status.anthropic?.isOpen).toBe(true);
    });

    it('should reset circuit breaker', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        throw new Error('timeout');
      });

      // Create some failures first
      for (let i = 0; i < 3; i++) {
        try {
          for await (const _ of smartRetry.executeWithRetry(
            'nim',
            {} as StreamParams,
            mockStreamFn,
            { maxAttempts: 1 }
          )) { }
        } catch {
          // expected
        }
      }

      smartRetry.resetCircuitBreakers();

      const status = smartRetry.getCircuitBreakerStatus();
      expect(Object.keys(status)).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('All circuit breakers reset');
    });
  });

  describe('streamWithRetry helper', () => {
    it('should be a convenience wrapper', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      const results: StreamEvent[] = [];
      for await (const event of streamWithRetry('nim', {} as StreamParams, mockStreamFn)) {
        results.push(event);
      }

      expect(results).toHaveLength(1);
    });
  });

  describe('retryable error detection', () => {
    const retryableErrors = [
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'network error',
      'rate limit',
      '429',
      '503',
      '502',
      '504',
    ];

    it.each(retryableErrors)('should retry on %s error', async (errorMessage) => {
      let attempts = 0;
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        attempts++;
        if (attempts === 1) {
          throw new Error(errorMessage);
        }
        yield { type: 'message_stop' };
      });

      for await (const _ of smartRetry.executeWithRetry('nim', {} as StreamParams, mockStreamFn)) { }

      expect(attempts).toBe(2);
    });
  });

  describe('SmartRetryService configuration', () => {
    it('should accept custom configuration', async () => {
      const customRetry = new SmartRetryService({
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 10000,
        enableJitter: false,
      });

      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      for await (const _ of customRetry.executeWithRetry('nim', {} as StreamParams, mockStreamFn)) { }

      expect(mockStreamFn).toHaveBeenCalled();
    });
  });
});
