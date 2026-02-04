/**
 * Correlation Middleware Tests
 * Tests for correlation ID middleware and helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  correlationMiddleware,
  getCorrelationHeaders,
  correlationErrorMiddleware,
} from '../../src/middleware/correlationMiddleware.js';

// Mock dependencies
vi.mock('../../src/utils/correlationId.js', () => ({
  generateCorrelationId: vi.fn(() => 'mock-correlation-id-12345'),
  generateRequestId: vi.fn(() => 'mock-req'),
  getCorrelationIdFromHeaders: vi.fn((headers: Record<string, string | undefined>) => {
    return headers['x-correlation-id'] || headers['X-Correlation-Id'] || undefined;
  }),
  requestContextStorage: {
    run: vi.fn((context: unknown, fn: () => void) => fn()),
    getStore: vi.fn(() => ({
      correlationId: 'stored-correlation-id',
      requestId: 'stored-req-id',
    })),
  },
  CORRELATION_ID_HEADER: 'x-correlation-id',
  REQUEST_ID_HEADER: 'x-request-id',
}));

// Import mocked functions
import {
  generateCorrelationId,
  generateRequestId,
  getCorrelationIdFromHeaders,
  requestContextStorage,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from '../../src/utils/correlationId.js';

// Helper to create mock request
function createMockRequest(
  headers: Record<string, string> = {},
  overrides: Partial<Request> = {}
): Request {
  return {
    headers,
    path: '/api/test',
    method: 'GET',
    ...overrides,
  } as Request;
}

// Helper to create mock response
function createMockResponse(): Response {
  const res = {
    setHeader: vi.fn(),
    headersSent: false,
    statusCode: 200,
  } as unknown as Response;
  return res;
}

describe('Correlation Middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('correlationMiddleware', () => {
    it('should generate correlation ID when not provided', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(generateCorrelationId).toHaveBeenCalled();
      expect(req.correlationId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should use correlation ID from headers when trustProxy is true', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('header-correlation-id');

      const middleware = correlationMiddleware({ trustProxy: true });
      const req = createMockRequest({ 'x-correlation-id': 'header-correlation-id' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('header-correlation-id');
    });

    it('should not trust headers when trustProxy is false', () => {
      const middleware = correlationMiddleware({ trustProxy: false });
      const req = createMockRequest({ 'x-correlation-id': 'header-correlation-id' });
      const res = createMockResponse();

      middleware(req, res, next);

      // Should still generate since trustProxy is false
      expect(generateCorrelationId).toHaveBeenCalled();
    });

    it('should use custom extractor function when provided', () => {
      const customExtractor = vi.fn(() => 'custom-extracted-id');
      const middleware = correlationMiddleware({ extractor: customExtractor });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(customExtractor).toHaveBeenCalledWith(req);
      expect(req.correlationId).toBe('custom-extracted-id');
    });

    it('should generate request ID for each request', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(generateRequestId).toHaveBeenCalled();
      expect(req.requestId).toBeDefined();
    });

    it('should set response headers when propagate is true', () => {
      const middleware = correlationMiddleware({ propagate: true });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    });

    it('should not set response headers when propagate is false', () => {
      const middleware = correlationMiddleware({ propagate: false });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should use custom header name when provided', () => {
      const middleware = correlationMiddleware({ headerName: 'x-custom-id', propagate: true });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('x-custom-id', expect.any(String));
    });

    it('should attach requestContext to request object', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.requestContext).toBeDefined();
      expect(req.requestContext?.correlationId).toBeDefined();
      expect(req.requestContext?.requestId).toBeDefined();
      expect(req.requestContext?.startTime).toBeDefined();
    });

    it('should run next in AsyncLocalStorage context', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(requestContextStorage.run).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
          requestId: expect.any(String),
          startTime: expect.any(Number),
        }),
        expect.any(Function)
      );
    });

    it('should use default options when none provided', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      // Should generate (default true)
      expect(generateCorrelationId).toHaveBeenCalled();
      // Should propagate (default true)
      expect(res.setHeader).toHaveBeenCalled();
    });

    it('should not generate when generate option is false and ID provided', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('existing-id');
      
      const middleware = correlationMiddleware({ generate: false });
      const req = createMockRequest({ 'x-correlation-id': 'existing-id' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('existing-id');
    });

    it('should still generate fallback when no ID found and generate is false', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue(undefined as unknown as string);
      
      const middleware = correlationMiddleware({ generate: false });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      // Falls back to generation even with generate: false for safety
      expect(generateCorrelationId).toHaveBeenCalled();
    });

    it('should handle extractor returning undefined', () => {
      const customExtractor = vi.fn(() => undefined);
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue(undefined as unknown as string);
      
      const middleware = correlationMiddleware({ extractor: customExtractor });
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, next);

      expect(generateCorrelationId).toHaveBeenCalled();
    });

    it('should prioritize custom extractor over headers', () => {
      const customExtractor = vi.fn(() => 'extractor-id');
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('header-id');
      
      const middleware = correlationMiddleware({ extractor: customExtractor });
      const req = createMockRequest({ 'x-correlation-id': 'header-id' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('extractor-id');
    });
  });

  describe('getCorrelationHeaders', () => {
    it('should return headers from current context', () => {
      const headers = getCorrelationHeaders();

      expect(headers).toHaveProperty(CORRELATION_ID_HEADER);
      expect(headers).toHaveProperty(REQUEST_ID_HEADER);
    });

    it('should return context correlation ID when available', () => {
      vi.mocked(requestContextStorage.getStore).mockReturnValue({
        correlationId: 'context-corr-id',
        requestId: 'context-req-id',
        startTime: Date.now(),
      });

      const headers = getCorrelationHeaders();

      expect(headers[CORRELATION_ID_HEADER]).toBe('context-corr-id');
      expect(headers[REQUEST_ID_HEADER]).toBe('context-req-id');
    });

    it('should generate new IDs when no context available', () => {
      vi.mocked(requestContextStorage.getStore).mockReturnValue(undefined);

      const headers = getCorrelationHeaders();

      expect(generateCorrelationId).toHaveBeenCalled();
      expect(generateRequestId).toHaveBeenCalled();
      expect(headers[CORRELATION_ID_HEADER]).toBeDefined();
      expect(headers[REQUEST_ID_HEADER]).toBeDefined();
    });
  });

  describe('correlationErrorMiddleware', () => {
    it('should add correlation ID to error response', () => {
      const error = new Error('Test error');
      const req = createMockRequest();
      req.correlationId = 'error-correlation-id';
      const res = createMockResponse();
      res.headersSent = false;

      correlationErrorMiddleware(error, req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'error-correlation-id');
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should not set header if already sent', () => {
      const error = new Error('Test error');
      const req = createMockRequest();
      req.correlationId = 'error-correlation-id';
      const res = createMockResponse();
      res.headersSent = true;

      correlationErrorMiddleware(error, req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should extract correlation ID from headers if not on request', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('fallback-id');
      
      const error = new Error('Test error');
      const req = createMockRequest({ 'x-correlation-id': 'fallback-id' });
      const res = createMockResponse();

      correlationErrorMiddleware(error, req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'fallback-id');
    });

    it('should call next with error', () => {
      const error = new Error('Test error');
      const req = createMockRequest();
      const res = createMockResponse();

      correlationErrorMiddleware(error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('default export', () => {
    it('should export correlationMiddleware as default', async () => {
      const defaultExport = (await import('../../src/middleware/correlationMiddleware.js')).default;
      expect(defaultExport).toBe(correlationMiddleware);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle W3C traceparent format in headers', () => {
      // Mock the getCorrelationIdFromHeaders to return the trace ID from W3C format
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('4bf92f3577b34da6a3ce929d0e0e4736');
      
      const middleware = correlationMiddleware();
      const req = createMockRequest({ 
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' 
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });

    it('should handle AWS X-Ray trace ID format', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('1-5e1f1234-abcd12345678');
      
      const middleware = correlationMiddleware();
      const req = createMockRequest({ 
        'x-amzn-trace-id': 'Root=1-5e1f1234-abcd12345678' 
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('1-5e1f1234-abcd12345678');
    });

    it('should set startTime close to current time', () => {
      const middleware = correlationMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const before = Date.now();

      middleware(req, res, next);

      const after = Date.now();
      expect(req.requestContext?.startTime).toBeGreaterThanOrEqual(before);
      expect(req.requestContext?.startTime).toBeLessThanOrEqual(after);
    });

    it('should work with all options disabled', () => {
      vi.mocked(getCorrelationIdFromHeaders).mockReturnValue('provided-id');
      
      const middleware = correlationMiddleware({
        generate: false,
        propagate: false,
        trustProxy: true,
      });
      const req = createMockRequest({ 'x-correlation-id': 'provided-id' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(req.correlationId).toBe('provided-id');
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
