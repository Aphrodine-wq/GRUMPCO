/**
 * Error response helpers – ApiError, sendError, getClientErrorMessage, etc.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import {
  ApiError,
  ErrorCode,
  ErrorStatusMap,
  sendError,
  sendErrorResponse,
  getClientErrorMessage,
  getClientSSEErrorMessage,
  sendServerError,
  writeSSEError,
} from '../../src/utils/errorResponse.js';

const origNodeEnv = process.env.NODE_ENV;

function createMockRes(): Response {
  const res = {
    headersSent: false,
    statusCode: 200,
    _json: null as unknown,
    _write: null as string | null,
  } as unknown as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockImplementation((body) => {
    res._json = body;
    return res;
  });
  res.write = vi.fn().mockImplementation((chunk: string) => {
    res._write = (res._write || '') + chunk;
    return true;
  });
  return res;
}

describe('errorResponse', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  describe('ErrorCode and ErrorStatusMap', () => {
    it('maps UNAUTHORIZED to 401', () => {
      expect(ErrorStatusMap[ErrorCode.UNAUTHORIZED]).toBe(401);
    });

    it('maps NOT_FOUND to 404', () => {
      expect(ErrorStatusMap[ErrorCode.NOT_FOUND]).toBe(404);
    });

    it('maps RATE_LIMIT to 429', () => {
      expect(ErrorStatusMap[ErrorCode.RATE_LIMIT]).toBe(429);
    });

    it('maps INTERNAL_ERROR to 500', () => {
      expect(ErrorStatusMap[ErrorCode.INTERNAL_ERROR]).toBe(500);
    });
  });

  describe('ApiError', () => {
    it('creates error with code and message', () => {
      const err = new ApiError(ErrorCode.NOT_FOUND, 'Resource not found');
      expect(err.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toBe('Resource not found');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('ApiError');
    });

    it('accepts optional field and retryAfter', () => {
      const err = new ApiError(ErrorCode.RATE_LIMIT, 'Too many', {
        field: 'api_key',
        retryAfter: 60,
      });
      expect(err.field).toBe('api_key');
      expect(err.retryAfter).toBe(60);
    });

    it('toResponse includes error and code', () => {
      const err = new ApiError(ErrorCode.VALIDATION_ERROR, 'Invalid input');
      const resp = err.toResponse();
      expect(resp.error).toBe('Invalid input');
      expect(resp.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(resp.details).toBe('Invalid input');
    });

    it('toResponse includes field when set', () => {
      const err = new ApiError(ErrorCode.MISSING_FIELD, 'Missing', { field: 'email' });
      const resp = err.toResponse();
      expect(resp.field).toBe('email');
    });

    it('toResponse includes retryAfter when set', () => {
      const err = new ApiError(ErrorCode.RATE_LIMIT, 'Limit', { retryAfter: 30 });
      const resp = err.toResponse();
      expect(resp.retryAfter).toBe(30);
    });
  });

  describe('sendError', () => {
    it('sends JSON with status when headers not sent', () => {
      const res = createMockRes();
      const err = new ApiError(ErrorCode.NOT_FOUND, 'Not found');
      sendError(res, err);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      expect((res as unknown as { _json: unknown })._json).toMatchObject({
        error: expect.any(String),
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('does not send when headers already sent', () => {
      const res = createMockRes();
      res.headersSent = true;
      const err = new ApiError(ErrorCode.INTERNAL_ERROR, 'Oops');
      sendError(res, err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('sendErrorResponse', () => {
    it('creates and sends error', () => {
      const res = createMockRes();
      sendErrorResponse(res, ErrorCode.FORBIDDEN, 'Access denied');
      expect(res.status).toHaveBeenCalledWith(403);
      expect((res as unknown as { _json: { error: string } })._json.error).toBe('Access denied');
    });
  });

  describe('getClientErrorMessage', () => {
    it('returns message for Error in dev', () => {
      expect(getClientErrorMessage(new Error('Something broke'))).toBe('Something broke');
    });

    it('returns string for non-Error in dev', () => {
      expect(getClientErrorMessage('oops')).toBe('oops');
    });
  });

  describe('getClientSSEErrorMessage', () => {
    it('returns message for Error in dev', () => {
      expect(getClientSSEErrorMessage(new Error('SSE error'))).toBe('SSE error');
    });
  });

  describe('sendServerError', () => {
    it('sends 500 with error payload', () => {
      const res = createMockRes();
      sendServerError(res, new Error('Internal'));
      expect(res.status).toHaveBeenCalledWith(500);
      const json = (res as unknown as { _json: Record<string, unknown> })._json;
      expect(json.error).toBeDefined();
      expect(json.type).toBeDefined();
    });

    it('accepts opts.type', () => {
      const res = createMockRes();
      sendServerError(res, new Error('DB error'), { type: 'database_error' });
      const json = (res as unknown as { _json: { type: string } })._json;
      expect(json.type).toBe('database_error');
    });
  });

  describe('writeSSEError', () => {
    it('writes SSE error event', () => {
      const res = createMockRes();
      writeSSEError(res, new Error('Stream error'));
      expect(res.write).toHaveBeenCalled();
      const written = (res as unknown as { _write: string })._write;
      expect(written).toContain('data:');
      expect(written).toContain('error');
      expect(written).toContain('Stream error');
    });
  });
});
