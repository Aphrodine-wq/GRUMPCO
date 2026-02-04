/**
 * Timeout Middleware Tests
 * Tests for request timeout middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  createTimeoutMiddleware,
  requestTimeout,
  withTimeout,
  setRouteTimeout,
  getRouteTimeout,
  RequestTimeoutError,
} from '../../src/middleware/timeout.js';

// Mock the logger
vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked logger
import { getRequestLogger } from '../../src/middleware/logger.js';

// Helper to create mock request
function createMockRequest(
  overrides: Partial<Request> = {}
): Request & { socket: { destroyed: boolean; destroy: () => void } } {
  return {
    path: '/api/test',
    method: 'GET',
    headers: {},
    socket: {
      destroyed: false,
      destroy: vi.fn(),
    },
    ...overrides,
  } as Request & { socket: { destroyed: boolean; destroy: () => void } };
}

// Helper to create mock response
function createMockResponse(): Response & {
  _finishCallbacks: Array<() => void>;
  _closeCallbacks: Array<() => void>;
  triggerFinish: () => void;
  triggerClose: () => void;
} {
  const finishCallbacks: Array<() => void> = [];
  const closeCallbacks: Array<() => void> = [];

  const res = {
    statusCode: 200,
    headersSent: false,
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'finish') {
        finishCallbacks.push(callback);
      } else if (event === 'close') {
        closeCallbacks.push(callback);
      }
      return res;
    }),
    status: vi.fn(function (this: typeof res, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: typeof res) {
      return this;
    }),
    _finishCallbacks: finishCallbacks,
    _closeCallbacks: closeCallbacks,
    triggerFinish: () => {
      finishCallbacks.forEach((cb) => cb());
    },
    triggerClose: () => {
      closeCallbacks.forEach((cb) => cb());
    },
  } as unknown as Response & {
    _finishCallbacks: Array<() => void>;
    _closeCallbacks: Array<() => void>;
    triggerFinish: () => void;
    triggerClose: () => void;
  };

  return res;
}

describe('Timeout Middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    next = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('RequestTimeoutError', () => {
    it('should create error with correct properties', () => {
      const error = new RequestTimeoutError('/api/test', 30000);

      expect(error.message).toBe('Request timeout after 30000ms');
      expect(error.name).toBe('RequestTimeoutError');
      expect(error.statusCode).toBe(408);
      expect(error.type).toBe('request_timeout');
      expect(error.timeout).toBe(30000);
      expect(error.path).toBe('/api/test');
    });

    it('should be an instance of Error', () => {
      const error = new RequestTimeoutError('/api/test', 5000);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('createTimeoutMiddleware', () => {
    it('should call next immediately for non-streaming requests', () => {
      const middleware = createTimeoutMiddleware(30000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip timeout for SSE streaming requests', () => {
      const middleware = createTimeoutMiddleware(30000);
      const req = createMockRequest({
        headers: { accept: 'text/event-stream' },
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // No timer should be set for SSE
      expect(res.on).not.toHaveBeenCalled();
    });

    it('should register finish and close event listeners', () => {
      const middleware = createTimeoutMiddleware(30000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should send 408 response on timeout', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest({ path: '/api/slow' });
      const res = createMockResponse();

      middleware(req, res, next);

      // Advance time past timeout
      vi.advanceTimersByTime(1001);

      expect(res.status).toHaveBeenCalledWith(408);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Request timeout after 1000ms',
        type: 'request_timeout',
        path: '/api/slow',
      });
    });

    it('should destroy socket on timeout', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      expect(req.socket.destroy).toHaveBeenCalled();
    });

    it('should not send response if already sent', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true;

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should not timeout if response finishes before timeout', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      // Simulate response finishing before timeout
      vi.advanceTimersByTime(500);
      res.triggerFinish();

      // Advance past original timeout
      vi.advanceTimersByTime(600);

      expect(res.status).not.toHaveBeenCalled();
    });

    it('should not timeout if response closes before timeout', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      vi.advanceTimersByTime(500);
      res.triggerClose();
      vi.advanceTimersByTime(600);

      expect(res.status).not.toHaveBeenCalled();
    });

    it('should not destroy socket if already destroyed', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      req.socket.destroyed = true;
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      expect(req.socket.destroy).not.toHaveBeenCalled();
    });

    it('should log warning on timeout', () => {
      const mockLogger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as ReturnType<typeof getRequestLogger>;
      vi.mocked(getRequestLogger).mockReturnValue(mockLogger);

      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest({ path: '/api/slow', method: 'POST' });
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { path: '/api/slow', method: 'POST', timeout: 1000 },
        'Request timed out'
      );
    });
  });

  describe('requestTimeout', () => {
    it('should use default timeout for unknown paths', () => {
      const req = createMockRequest({ path: '/api/unknown' });
      const res = createMockResponse();

      requestTimeout(req, res, next);

      expect(next).toHaveBeenCalled();
      // Advance past default timeout (30s)
      vi.advanceTimersByTime(30001);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should use configured timeout for /health', () => {
      const req = createMockRequest({ path: '/health' });
      const res = createMockResponse();

      requestTimeout(req, res, next);
      
      // Health should timeout at 5s
      vi.advanceTimersByTime(4999);
      expect(res.status).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(2);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should use longer timeout for /api/chat', () => {
      const req = createMockRequest({ path: '/api/chat' });
      const res = createMockResponse();

      requestTimeout(req, res, next);
      
      // Chat should have 3 minute timeout (180000ms)
      // Advance just before timeout
      vi.advanceTimersByTime(179999);
      expect(res.status).not.toHaveBeenCalled();
      
      // Advance past timeout
      vi.advanceTimersByTime(2);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should match most specific route', () => {
      const req = createMockRequest({ path: '/api/chat/stream' });
      const res = createMockResponse();

      requestTimeout(req, res, next);
      
      // /api/chat/stream should have 10 minute timeout (600000ms)
      // Advance just before timeout  
      vi.advanceTimersByTime(599999);
      expect(res.status).not.toHaveBeenCalled();
      
      // Advance past timeout
      vi.advanceTimersByTime(2);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should match routes by prefix', () => {
      const req = createMockRequest({ path: '/api/codegen/some/sub/path' });
      const res = createMockResponse();

      requestTimeout(req, res, next);
      
      // Should match /api/codegen (5 minutes = 300000ms)
      // Advance just before timeout
      vi.advanceTimersByTime(299999);
      expect(res.status).not.toHaveBeenCalled();
      
      // Advance past timeout
      vi.advanceTimersByTime(2);
      expect(res.status).toHaveBeenCalledWith(408);
    });
  });

  describe('withTimeout', () => {
    it('should create middleware with specified timeout', () => {
      const middleware = withTimeout(5000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);
      
      vi.advanceTimersByTime(5001);
      
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should return a RequestHandler', () => {
      const middleware = withTimeout(10000);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('setRouteTimeout', () => {
    it('should update timeout for a route', () => {
      setRouteTimeout('/api/custom', 45000);
      
      const timeout = getRouteTimeout('/api/custom');
      expect(timeout).toBe(45000);
    });

    it('should log the update', () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as ReturnType<typeof getRequestLogger>;
      vi.mocked(getRequestLogger).mockReturnValue(mockLogger);

      setRouteTimeout('/api/new-route', 60000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { path: '/api/new-route', timeout: 60000 },
        'Route timeout updated'
      );
    });
  });

  describe('getRouteTimeout', () => {
    it('should return exact match timeout', () => {
      const timeout = getRouteTimeout('/health');
      expect(timeout).toBe(5000);
    });

    it('should return prefix match timeout', () => {
      const timeout = getRouteTimeout('/api/github/repos');
      expect(timeout).toBe(60000); // Matches /api/github
    });

    it('should return default for unmatched paths', () => {
      const timeout = getRouteTimeout('/completely/unknown/path');
      expect(timeout).toBe(30000);
    });

    it('should return correct timeout for /health/quick', () => {
      const timeout = getRouteTimeout('/health/quick');
      expect(timeout).toBe(2000);
    });

    it('should return correct timeout for /health/ready', () => {
      const timeout = getRouteTimeout('/health/ready');
      expect(timeout).toBe(10000);
    });

    it('should return correct timeout for /api/architecture', () => {
      const timeout = getRouteTimeout('/api/architecture');
      expect(timeout).toBe(180000);
    });

    it('should return correct timeout for /api/voice', () => {
      const timeout = getRouteTimeout('/api/voice');
      expect(timeout).toBe(120000);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing socket gracefully', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      (req as unknown as Record<string, unknown>).socket = undefined;
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      // Should not throw
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should handle null socket gracefully', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      (req as unknown as Record<string, unknown>).socket = null;
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(1001);

      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should clear timer on both finish and close', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      res.triggerFinish();
      res.triggerClose();

      vi.advanceTimersByTime(2000);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle rapid finish/close events', () => {
      const middleware = createTimeoutMiddleware(1000);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      // Rapid fire events
      res.triggerFinish();
      res.triggerFinish();
      res.triggerClose();
      res.triggerClose();

      vi.advanceTimersByTime(2000);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should work with very short timeout', () => {
      const middleware = createTimeoutMiddleware(1);
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);
      vi.advanceTimersByTime(2);

      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should work with very long timeout', () => {
      const middleware = createTimeoutMiddleware(86400000); // 24 hours
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      vi.advanceTimersByTime(86399999);
      expect(res.status).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2);
      expect(res.status).toHaveBeenCalledWith(408);
    });
  });

  describe('Concurrent requests', () => {
    it('should handle multiple concurrent requests independently', () => {
      const middleware1 = createTimeoutMiddleware(1000);
      const middleware2 = createTimeoutMiddleware(2000);

      const req1 = createMockRequest({ path: '/api/fast' });
      const req2 = createMockRequest({ path: '/api/slow' });
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      middleware1(req1, res1, next);
      middleware2(req2, res2, next);

      vi.advanceTimersByTime(1001);

      expect(res1.status).toHaveBeenCalledWith(408);
      expect(res2.status).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(res2.status).toHaveBeenCalledWith(408);
    });
  });
});
