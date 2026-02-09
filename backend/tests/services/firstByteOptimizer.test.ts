/**
 * First Byte Optimizer unit tests
 * Run: npm test -- firstByteOptimizer.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock response object
const createMockResponse = () => ({
  setHeader: vi.fn(),
  flushHeaders: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
});

import { firstByteOptimizer } from '../../src/services/firstByteOptimizer.js';

describe('firstByteOptimizer', () => {
  let mockRes: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    mockRes = createMockResponse();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendHeadersImmediately', () => {
    it('should set correct headers', () => {
      firstByteOptimizer.sendHeadersImmediately(mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-TTFB-Optimization', 'enabled');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Response-Start', expect.any(String));
    });

    it('should flush headers immediately', () => {
      firstByteOptimizer.sendHeadersImmediately(mockRes as any);

      expect(mockRes.flushHeaders).toHaveBeenCalled();
    });

    it('should send init message with progress enabled', () => {
      const metadata = { provider: 'nim', model: 'test-model' };

      firstByteOptimizer.sendHeadersImmediately(mockRes as any, {
        sendProgress: true,
        metadata,
      });

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"init"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"provider":"nim"')
      );
    });

    it('should not send init message when progress disabled', () => {
      firstByteOptimizer.sendHeadersImmediately(mockRes as any, {
        sendProgress: false,
      });

      const initCalls = mockRes.write.mock.calls.filter((call: any[]) =>
        call[0].includes('"type":"init"')
      );
      expect(initCalls).toHaveLength(0);
    });

    it('should include timestamp in init message', () => {
      const before = Date.now();

      firstByteOptimizer.sendHeadersImmediately(mockRes as any);

      const after = Date.now();
      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('sendProgress', () => {
    it('should send progress message', () => {
      firstByteOptimizer.sendProgress(mockRes as any, 50, 'Processing');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"progress"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"progress":50')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Processing"')
      );
    });

    it('should clamp progress to 0-100 range', () => {
      firstByteOptimizer.sendProgress(mockRes as any, -10);

      const writeCall = mockRes.write.mock.calls[0][0];
      expect(writeCall).toContain('"progress":0');

      mockRes.write.mockClear();

      firstByteOptimizer.sendProgress(mockRes as any, 150);

      const writeCall2 = mockRes.write.mock.calls[0][0];
      expect(writeCall2).toContain('"progress":100');
    });

    it('should include timestamp', () => {
      const before = Date.now();

      firstByteOptimizer.sendProgress(mockRes as any, 50);

      const after = Date.now();
      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('sendChunk', () => {
    it('should send data chunk', () => {
      const data = { token: 'Hello', index: 0 };

      firstByteOptimizer.sendChunk(mockRes as any, data);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"data"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"token":"Hello"')
      );
    });

    it('should handle complex data objects', () => {
      const data = { nested: { array: [1, 2, 3], bool: true } };

      firstByteOptimizer.sendChunk(mockRes as any, data);

      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.data.nested.array).toEqual([1, 2, 3]);
      expect(parsed.data.nested.bool).toBe(true);
    });

    it('should include timestamp', () => {
      firstByteOptimizer.sendChunk(mockRes as any, { test: true });

      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.timestamp).toBeGreaterThan(0);
    });
  });

  describe('sendError', () => {
    it('should send error message', () => {
      firstByteOptimizer.sendError(mockRes as any, 'Something went wrong');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Something went wrong"')
      );
    });

    it('should include error code when provided', () => {
      firstByteOptimizer.sendError(mockRes as any, 'Rate limit exceeded', 'RATE_LIMIT');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"code":"RATE_LIMIT"')
      );
    });

    it('should handle errors without code', () => {
      firstByteOptimizer.sendError(mockRes as any, 'Generic error');

      const writeCall = mockRes.write.mock.calls[0][0];
      expect(writeCall).not.toContain('"code"');
    });

    it('should include timestamp', () => {
      firstByteOptimizer.sendError(mockRes as any, 'Error');

      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.timestamp).toBeGreaterThan(0);
    });
  });

  describe('complete', () => {
    it('should send complete message', () => {
      firstByteOptimizer.complete(mockRes as any);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"complete"')
      );
    });

    it('should include metadata when provided', () => {
      const metadata = { totalTokens: 150, provider: 'nim' };

      firstByteOptimizer.complete(mockRes as any, metadata);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"totalTokens":150')
      );
    });

    it('should end response', () => {
      firstByteOptimizer.complete(mockRes as any);

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should include timestamp', () => {
      const before = Date.now();

      firstByteOptimizer.complete(mockRes as any);

      const after = Date.now();
      const writeCall = mockRes.write.mock.calls[0][0];
      const parsed = JSON.parse(writeCall.trim());

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('integration flow', () => {
    it('should handle complete streaming flow', () => {
      // Start
      firstByteOptimizer.sendHeadersImmediately(mockRes as any);

      // Progress updates
      firstByteOptimizer.sendProgress(mockRes as any, 25, 'Connecting');
      firstByteOptimizer.sendProgress(mockRes as any, 50, 'Streaming');

      // Data chunks
      firstByteOptimizer.sendChunk(mockRes as any, { text: 'Hello' });
      firstByteOptimizer.sendChunk(mockRes as any, { text: ' World' });

      // Complete
      firstByteOptimizer.complete(mockRes as any, { totalTokens: 2 });

      // Verify all messages were sent
      // init (1) + 2 progress (2) + 2 chunks (2) + complete (1) = 6 writes
      expect(mockRes.write).toHaveBeenCalledTimes(6);
      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });

    it('should handle error flow', () => {
      firstByteOptimizer.sendHeadersImmediately(mockRes as any);
      firstByteOptimizer.sendProgress(mockRes as any, 25);
      firstByteOptimizer.sendError(mockRes as any, 'Stream failed', 'STREAM_ERROR');

      expect(mockRes.write).toHaveBeenCalledTimes(3);
    });
  });
});
