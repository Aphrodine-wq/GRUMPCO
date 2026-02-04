/**
 * Tests for Error Tracking Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request } from 'express';

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('errorTracking', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Ensure Sentry is not initialized for tests
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initErrorTracking', () => {
    it('should log info when SENTRY_DSN is not configured', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { initErrorTracking } = await import('../../src/services/errorTracking.js');
      
      await initErrorTracking();
      
      expect(logger.default.info).toHaveBeenCalledWith(
        'Error tracking disabled (SENTRY_DSN not configured)'
      );
    });
  });

  describe('captureException', () => {
    it('should log error locally', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { captureException } = await import('../../src/services/errorTracking.js');
      
      const error = new Error('Test error');
      const result = captureException(error, { userId: 'user123' });
      
      expect(result).toBeUndefined(); // No Sentry, returns undefined
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: 'Test error',
          userId: 'user123',
        }),
        'Exception captured'
      );
    });

    it('should include context in log', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { captureException } = await import('../../src/services/errorTracking.js');
      
      const error = new Error('Context test');
      captureException(error, {
        userId: 'user456',
        requestId: 'req-789',
        endpoint: '/api/test',
        method: 'POST',
        tags: { feature: 'test' },
        extra: { data: 'extra' },
      });
      
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user456',
          requestId: 'req-789',
          endpoint: '/api/test',
          method: 'POST',
        }),
        'Exception captured'
      );
    });
  });

  describe('captureRequestException', () => {
    it('should extract context from Express request', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { captureRequestException } = await import('../../src/services/errorTracking.js');
      
      const mockReq = {
        path: '/api/users',
        method: 'GET',
        query: { id: '123' },
        params: {},
        correlationId: 'corr-123',
        user: { id: 'user-456' },
      } as unknown as Request;
      
      const error = new Error('Request error');
      captureRequestException(error, mockReq, { custom: 'data' });
      
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          requestId: 'corr-123',
          endpoint: '/api/users',
          method: 'GET',
        }),
        'Exception captured'
      );
    });
  });

  describe('captureMessage', () => {
    it('should log message at specified level', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { captureMessage } = await import('../../src/services/errorTracking.js');
      
      captureMessage('Warning message', 'warning', { userId: 'user123' });
      
      expect(logger.default.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user123' }),
        'Warning message'
      );
    });

    it('should log fatal as error', async () => {
      const logger = await import('../../src/middleware/logger.js');
      const { captureMessage } = await import('../../src/services/errorTracking.js');
      
      captureMessage('Fatal message', 'fatal');
      
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.any(Object),
        'Fatal message'
      );
    });
  });

  describe('startTransaction', () => {
    it('should return no-op when Sentry is not configured', async () => {
      const { startTransaction } = await import('../../src/services/errorTracking.js');
      
      const transaction = startTransaction('test-tx', 'test');
      
      expect(transaction.finish).toBeDefined();
      expect(transaction.startSpan).toBeDefined();
      
      // Should not throw
      transaction.finish();
      
      const span = transaction.startSpan('child', 'child-op');
      span.finish();
      span.setStatus('ok');
      span.setData('key', 'value');
    });
  });

  describe('setUser / clearUser', () => {
    it('should not throw when Sentry is not configured', async () => {
      const { setUser, clearUser } = await import('../../src/services/errorTracking.js');
      
      // Should not throw
      setUser({ id: 'user123', email: 'test@example.com' });
      clearUser();
    });
  });

  describe('addBreadcrumb', () => {
    it('should not throw when Sentry is not configured', async () => {
      const { addBreadcrumb } = await import('../../src/services/errorTracking.js');
      
      // Should not throw
      addBreadcrumb('User clicked button', 'ui', { button: 'submit' }, 'info');
    });
  });

  describe('middleware', () => {
    it('errorTrackingMiddleware should call next with error', async () => {
      const { errorTrackingMiddleware } = await import('../../src/services/errorTracking.js');
      
      const middleware = errorTrackingMiddleware();
      const error = new Error('Middleware error');
      const mockReq = { path: '/test', method: 'GET' } as Request;
      const mockRes = {};
      const next = vi.fn();
      
      middleware(error, mockReq, mockRes, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });

    it('requestContextMiddleware should call next', async () => {
      const { requestContextMiddleware } = await import('../../src/services/errorTracking.js');
      
      const middleware = requestContextMiddleware();
      const mockReq = { 
        path: '/test', 
        method: 'GET',
        correlationId: 'corr-123',
      } as unknown as Request;
      const mockRes = {};
      const next = vi.fn();
      
      middleware(mockReq, mockRes, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('flushErrorTracking', () => {
    it('should complete without error when Sentry not configured', async () => {
      const { flushErrorTracking } = await import('../../src/services/errorTracking.js');
      
      // Should not throw
      await flushErrorTracking();
    });
  });
});
