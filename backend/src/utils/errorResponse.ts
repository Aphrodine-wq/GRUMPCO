/**
 * Centralized error response helpers for production-safe error handling.
 * In production, never send err.message or stack to the client.
 *
 * @module errorResponse
 */

import type { Response } from 'express';
import { env } from '../config/env.js';

const isProduction = env.NODE_ENV === 'production';

/** Generic message for 500 JSON responses in production */
const GENERIC_ERROR_MESSAGE = 'Internal server error';

/** Generic message for SSE error events in production */
const GENERIC_SSE_ERROR_MESSAGE = 'An error occurred';

/**
 * Standardized error codes for API responses.
 * Use these codes consistently across all endpoints for client error handling.
 */
export enum ErrorCode {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  ADMIN_REQUIRED = 'admin_required',

  // Validation & Request Errors (400)
  VALIDATION_ERROR = 'validation_error',
  INVALID_INPUT = 'invalid_input',
  MISSING_FIELD = 'missing_field',
  INVALID_FORMAT = 'invalid_format',

  // Resource Errors (404, 409, 410)
  NOT_FOUND = 'not_found',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  ALREADY_EXISTS = 'already_exists',
  CONFLICT = 'conflict',
  GONE = 'gone',

  // Rate Limiting & Quotas (429)
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',

  // Timeout & Availability (408, 503)
  REQUEST_TIMEOUT = 'request_timeout',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  DEPENDENCY_FAILURE = 'dependency_failure',

  // Internal Errors (500)
  INTERNAL_ERROR = 'internal_error',
  DATABASE_ERROR = 'database_error',
  AI_SERVICE_ERROR = 'ai_service_error',
  EXTERNAL_API_ERROR = 'external_api_error',

  // Business Logic Errors
  OPERATION_FAILED = 'operation_failed',
  INVALID_STATE = 'invalid_state',
  FEATURE_DISABLED = 'feature_disabled',
  SUBSCRIPTION_REQUIRED = 'subscription_required',
}

/**
 * HTTP status codes mapped to error codes.
 */
export const ErrorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.ADMIN_REQUIRED]: 403,

  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,

  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.GONE]: 410,

  [ErrorCode.RATE_LIMIT]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,

  [ErrorCode.REQUEST_TIMEOUT]: 408,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DEPENDENCY_FAILURE]: 503,

  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.AI_SERVICE_ERROR]: 500,
  [ErrorCode.EXTERNAL_API_ERROR]: 502,

  [ErrorCode.OPERATION_FAILED]: 500,
  [ErrorCode.INVALID_STATE]: 400,
  [ErrorCode.FEATURE_DISABLED]: 403,
  [ErrorCode.SUBSCRIPTION_REQUIRED]: 402,
};

/**
 * Standardized API error response structure.
 */
export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  details?: string;
  field?: string;
  retryAfter?: number;
}

/**
 * Custom error class for API errors with standardized codes.
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly field?: string;
  public readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { field?: string; retryAfter?: number }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = ErrorStatusMap[code];
    this.field = options?.field;
    this.retryAfter = options?.retryAfter;
  }

  toResponse(): ApiErrorResponse {
    const response: ApiErrorResponse = {
      error: isProduction ? this.getProductionMessage() : this.message,
      code: this.code,
    };

    if (!isProduction && this.message) {
      response.details = this.message;
    }

    if (this.field) {
      response.field = this.field;
    }

    if (this.retryAfter) {
      response.retryAfter = this.retryAfter;
    }

    return response;
  }

  private getProductionMessage(): string {
    switch (this.code) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.TOKEN_INVALID:
        return 'Authentication required';
      case ErrorCode.FORBIDDEN:
      case ErrorCode.ADMIN_REQUIRED:
        return 'Access denied';
      case ErrorCode.RATE_LIMIT:
        return 'Too many requests';
      case ErrorCode.QUOTA_EXCEEDED:
        return 'Quota exceeded';
      case ErrorCode.NOT_FOUND:
      case ErrorCode.RESOURCE_NOT_FOUND:
        return 'Resource not found';
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable';
      default:
        return GENERIC_ERROR_MESSAGE;
    }
  }
}

/**
 * Send a standardized error response.
 */
export function sendError(res: Response, error: ApiError): void {
  if (!res.headersSent) {
    res.status(error.statusCode).json(error.toResponse());
  }
}

/**
 * Create and send a quick error response.
 */
export function sendErrorResponse(
  res: Response,
  code: ErrorCode,
  message: string,
  options?: { field?: string; retryAfter?: number }
): void {
  const error = new ApiError(code, message, options);
  sendError(res, error);
}

/**
 * Get a safe error message for client responses.
 * In production returns generic text; in development returns the actual message.
 */
export function getClientErrorMessage(err: unknown): string {
  if (isProduction) return GENERIC_ERROR_MESSAGE;
  return (err instanceof Error ? err.message : String(err)) || GENERIC_ERROR_MESSAGE;
}

/**
 * Get a safe error message for SSE error events.
 * In production returns generic text; in development returns the actual message.
 */
export function getClientSSEErrorMessage(err: unknown): string {
  if (isProduction) return GENERIC_SSE_ERROR_MESSAGE;
  return (err instanceof Error ? err.message : String(err)) || GENERIC_SSE_ERROR_MESSAGE;
}

/**
 * Send a 500 JSON response. In production, does not include err.message in the body.
 */
export function sendServerError(res: Response, err: unknown, opts?: { type?: string }): void {
  const type = opts?.type ?? 'internal_error';
  const payload: Record<string, unknown> = {
    error: isProduction ? GENERIC_ERROR_MESSAGE : (err instanceof Error ? err.message : String(err)) || GENERIC_ERROR_MESSAGE,
    type,
  };
  if (!isProduction && err instanceof Error) {
    payload.details = err.message;
  }
  if (!res.headersSent) {
    res.status(500).json(payload);
  }
}

/**
 * Write an SSE error event. In production, does not include err.message in the event.
 */
export function writeSSEError(res: Response, err: unknown): void {
  const message = getClientSSEErrorMessage(err);
  res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
}
