/**
 * Usage Tracking Middleware Tests
 * Tests for API usage tracking middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { usageTrackingMiddleware, setTokenInfo } from '../../src/middleware/usageTrackingMiddleware.js';

// Mock dependencies
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/usageTracker.js', () => ({
  recordApiCall: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked functions
import { recordApiCall } from '../../src/services/usageTracker.js';
import logger from '../../src/middleware/logger.js';

// Extended request interface for tracking
interface TrackingRequest extends Request {
  startTime?: number;
  userId?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  model?: string;
  user?: { id?: string };
}

// Helper to create mock request
function createMockRequest(
  overrides: Partial<TrackingRequest> = {}
): TrackingRequest {
  return {
    path: '/api/chat',
    method: 'POST',
    headers: {},
    body: {},
    ...overrides,
  } as TrackingRequest;
}

// Helper to create mock response with event emitter
function createMockResponse(): Response & {
  _finishCallbacks: Array<() => void>;
  triggerFinish: () => void;
} {
  const finishCallbacks: Array<() => void> = [];
  
  const res = {
    statusCode: 200,
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'finish') {
        finishCallbacks.push(callback);
      }
      return res;
    }),
    json: vi.fn(function(this: typeof res, data: unknown) {
      return this;
    }),
    send: vi.fn(function(this: typeof res, data: unknown) {
      return this;
    }),
    _finishCallbacks: finishCallbacks,
    triggerFinish: () => {
      finishCallbacks.forEach(cb => cb());
    },
  } as unknown as Response & {
    _finishCallbacks: Array<() => void>;
    triggerFinish: () => void;
  };

  return res;
}

describe('Usage Tracking Middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('usageTrackingMiddleware', () => {
    it('should skip tracking for /health endpoint', () => {
      const req = createMockRequest({ path: '/health' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });

    it('should skip tracking for /metrics endpoint', () => {
      const req = createMockRequest({ path: '/metrics' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });

    it('should skip tracking for /api/health endpoint', () => {
      const req = createMockRequest({ path: '/api/health' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });

    it('should set startTime on request', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(req.startTime).toBeDefined();
      expect(typeof req.startTime).toBe('number');
      expect(next).toHaveBeenCalled();
    });

    it('should extract userId from req.user.id', () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        user: { id: 'user-123' }
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(req.userId).toBe('user-123');
    });

    it('should extract userId from req.userId', () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'direct-user-456'
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(req.userId).toBe('direct-user-456');
    });

    it('should use anonymous when no userId available', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(req.userId).toBe('anonymous');
    });

    it('should intercept res.json and capture response body', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();
      const originalJson = res.json;

      usageTrackingMiddleware(req, res, next);

      expect(res.json).not.toBe(originalJson);
      
      // Call intercepted json
      res.json({ success: true });
      
      expect(next).toHaveBeenCalled();
    });

    it('should intercept res.send and capture response body', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();
      const originalSend = res.send;

      usageTrackingMiddleware(req, res, next);

      expect(res.send).not.toBe(originalSend);
      
      // Call intercepted send with object
      res.send({ data: 'test' });
      
      expect(next).toHaveBeenCalled();
    });

    it('should handle string response in res.send', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      // Call intercepted send with JSON string
      res.send('{"data": "test"}');
      
      expect(next).toHaveBeenCalled();
    });

    it('should handle non-JSON string response in res.send', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      // Call intercepted send with plain string
      res.send('plain text response');
      
      expect(next).toHaveBeenCalled();
    });

    it('should record API call on response finish', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        method: 'POST',
        userId: 'test-user'
      });
      const res = createMockResponse();
      res.statusCode = 200;

      usageTrackingMiddleware(req, res, next);
      
      // Trigger finish event
      res.triggerFinish();

      // Wait for async recording
      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          endpoint: '/api/chat',
          method: 'POST',
          success: true,
        })
      );
    });

    it('should mark request as failed for 4xx status codes', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();
      res.statusCode = 400;

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should mark request as failed for 5xx status codes', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();
      res.statusCode = 500;

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should extract tokens from response usage field', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      
      // Simulate response with usage data
      res.json({
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        }
      });
      
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 100,
          outputTokens: 50,
        })
      );
    });

    it('should use pre-set token information from request', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100,
        model: 'claude-3',
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 200,
          outputTokens: 100,
          model: 'claude-3',
        })
      );
    });

    it('should calculate latency correctly', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      
      // Simulate some delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      const call = vi.mocked(recordApiCall).mock.calls[0][0];
      expect(call.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle recording errors gracefully', async () => {
      vi.mocked(recordApiCall).mockRejectedValueOnce(new Error('Database error'));

      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      // Should not throw, should log warning
      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalled();
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database error',
        }),
        'Failed to record API usage'
      );
    });

    it('should register finish event handler', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should use anonymous for userId when recording fails to find one', async () => {
      const req = createMockRequest({ path: '/api/chat' });
      delete req.userId;
      delete req.user;
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        })
      );
    });

    it('should prefer response usage tokens over request tokens', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user',
        estimatedInputTokens: 50,
        estimatedOutputTokens: 25,
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      
      res.json({
        usage: {
          input_tokens: 100,
          output_tokens: 75,
        }
      });
      
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      // Should use response tokens, not request tokens
      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 100,
          outputTokens: 75,
        })
      );
    });
  });

  describe('setTokenInfo', () => {
    it('should set input and output tokens on request', () => {
      const req = createMockRequest();

      setTokenInfo(req, 100, 50);

      expect(req.estimatedInputTokens).toBe(100);
      expect(req.estimatedOutputTokens).toBe(50);
    });

    it('should set model when provided', () => {
      const req = createMockRequest();

      setTokenInfo(req, 100, 50, 'gpt-4');

      expect(req.model).toBe('gpt-4');
    });

    it('should not set model when not provided', () => {
      const req = createMockRequest();

      setTokenInfo(req, 100, 50);

      expect(req.model).toBeUndefined();
    });

    it('should overwrite existing token values', () => {
      const req = createMockRequest({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 5,
      });

      setTokenInfo(req, 200, 100);

      expect(req.estimatedInputTokens).toBe(200);
      expect(req.estimatedOutputTokens).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle response without usage object', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      
      res.json({ data: 'no usage field' });
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: undefined,
          outputTokens: undefined,
        })
      );
    });

    it('should handle missing request method', async () => {
      const req = createMockRequest({ 
        path: '/api/chat',
        userId: 'test-user'
      });
      delete (req as unknown as Record<string, unknown>).method;
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);
      res.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalled();
      });

      expect(recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET', // Default fallback
        })
      );
    });

    it('should handle paths that start with skipped endpoints', () => {
      const req = createMockRequest({ path: '/health/detailed' });
      const res = createMockResponse();

      usageTrackingMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });

    it('should handle concurrent requests', async () => {
      const req1 = createMockRequest({ 
        path: '/api/chat',
        userId: 'user-1'
      });
      const req2 = createMockRequest({ 
        path: '/api/chat',
        userId: 'user-2'
      });
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      usageTrackingMiddleware(req1, res1, next);
      usageTrackingMiddleware(req2, res2, next);

      res1.triggerFinish();
      res2.triggerFinish();

      await vi.waitFor(() => {
        expect(recordApiCall).toHaveBeenCalledTimes(2);
      });

      const calls = vi.mocked(recordApiCall).mock.calls;
      expect(calls[0][0].userId).toBe('user-1');
      expect(calls[1][0].userId).toBe('user-2');
    });
  });
});
