/**
 * Correlation ID utilities – generate, parse, context
 */

import { describe, it, expect } from 'vitest';
import {
  generateCorrelationId,
  generateRequestId,
  getCorrelationIdFromHeaders,
  setCorrelationIdHeader,
  runWithCorrelationId,
  runWithCorrelationIdAsync,
  createChildContext,
  getLoggingContext,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from '../../src/utils/correlationId.js';

describe('correlationId', () => {
  describe('generateCorrelationId', () => {
    it('returns a UUID v4 format', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 10 }, () => generateCorrelationId()));
      expect(ids.size).toBe(10);
    });
  });

  describe('generateRequestId', () => {
    it('returns 8-character string', () => {
      const id = generateRequestId();
      expect(id).toHaveLength(8);
      expect(id).toMatch(/^[0-9a-f]{8}$/i);
    });
  });

  describe('getCorrelationIdFromHeaders', () => {
    it('returns value from x-correlation-id', () => {
      const headers = { [CORRELATION_ID_HEADER]: 'abc123' };
      expect(getCorrelationIdFromHeaders(headers)).toBe('abc123');
    });

    it('returns first element from array header', () => {
      const headers = { [CORRELATION_ID_HEADER]: ['first', 'second'] };
      expect(getCorrelationIdFromHeaders(headers)).toBe('first');
    });

    it('generates new ID when header missing', () => {
      const headers = {};
      const id = getCorrelationIdFromHeaders(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('extracts from W3C traceparent format', () => {
      const headers = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
      const id = getCorrelationIdFromHeaders(headers);
      expect(id).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });

    it('handles empty array header', () => {
      const headers = { [CORRELATION_ID_HEADER]: [] };
      const id = getCorrelationIdFromHeaders(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('setCorrelationIdHeader', () => {
    it('sets header on object', () => {
      const headers: Record<string, string | string[]> = {};
      setCorrelationIdHeader(headers, 'my-id');
      expect(headers[CORRELATION_ID_HEADER]).toBe('my-id');
    });
  });

  describe('runWithCorrelationId', () => {
    it('runs sync fn with context and returns result', () => {
      const result = runWithCorrelationId('ctx-123', () => 42);
      expect(result).toBe(42);
    });
  });

  describe('runWithCorrelationIdAsync', () => {
    it('runs async fn with context and returns result', async () => {
      const result = await runWithCorrelationIdAsync('ctx-456', async () => 'done');
      expect(result).toBe('done');
    });
  });

  describe('createChildContext', () => {
    it('returns context with generated IDs when no parent', () => {
      const ctx = createChildContext();
      expect(ctx.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(ctx.requestId).toHaveLength(8);
      expect(typeof ctx.startTime).toBe('number');
    });

    it('inherits correlationId from parent when in context', () => {
      runWithCorrelationId('parent-id', () => {
        const ctx = createChildContext();
        expect(ctx.correlationId).toBe('parent-id');
      });
    });
  });

  describe('getLoggingContext', () => {
    it('returns empty object when no context', () => {
      expect(getLoggingContext()).toEqual({});
    });

    it('returns context when in runWithCorrelationId', () => {
      runWithCorrelationId('log-ctx', () => {
        const ctx = getLoggingContext();
        expect(ctx.correlationId).toBe('log-ctx');
        expect(ctx.requestId).toBeDefined();
        expect(typeof ctx.elapsedMs).toBe('number');
      });
    });
  });

  describe('constants', () => {
    it('exports header names', () => {
      expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
      expect(REQUEST_ID_HEADER).toBe('x-request-id');
    });
  });
});
