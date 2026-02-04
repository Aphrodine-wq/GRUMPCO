/**
 * Correlation ID Utilities
 * Generates and propagates correlation IDs for distributed tracing
 *
 * Uses AsyncLocalStorage to maintain request context across async operations
 */

import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Request context stored in AsyncLocalStorage
 */
interface RequestContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AsyncLocalStorage instance for maintaining request context
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a new correlation ID (UUID v4)
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Generate a short request ID (for logging)
 */
export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Get correlation ID from request headers or generate new one
 */
export function getCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string {
  const headerValue =
    headers[CORRELATION_ID_HEADER] ||
    headers[CORRELATION_ID_HEADER.toLowerCase()] ||
    headers['x-amzn-trace-id'] || // AWS trace ID
    headers['traceparent']; // W3C trace context

  if (Array.isArray(headerValue)) {
    return headerValue[0] || generateCorrelationId();
  }

  if (typeof headerValue === 'string') {
    // Extract correlation ID from W3C traceparent format if present
    if (headerValue.includes('-')) {
      const parts = headerValue.split('-');
      if (parts.length >= 2) {
        return parts[1] || generateCorrelationId();
      }
    }
    return headerValue;
  }

  return generateCorrelationId();
}

/**
 * Set correlation ID in response headers
 */
export function setCorrelationIdHeader(
  headers: Record<string, string | string[]>,
  correlationId: string
): void {
  headers[CORRELATION_ID_HEADER] = correlationId;
}

/**
 * Get correlation ID from current async context
 */
export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}

/**
 * Get request ID from current async context
 */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

/**
 * Get the full request context from current async context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get elapsed time since request started (in ms)
 */
export function getElapsedTime(): number | undefined {
  const ctx = requestContextStorage.getStore();
  return ctx ? Date.now() - ctx.startTime : undefined;
}

/**
 * Update metadata in current request context
 */
export function setContextMetadata(key: string, value: unknown): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    ctx.metadata = ctx.metadata || {};
    ctx.metadata[key] = value;
  }
}

/**
 * Set user ID in current request context
 */
export function setContextUserId(userId: string): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    ctx.userId = userId;
  }
}

/**
 * Set session ID in current request context
 */
export function setContextSessionId(sessionId: string): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    ctx.sessionId = sessionId;
  }
}

/**
 * Run a function within a correlation context
 * Useful for background jobs and async operations
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  const context: RequestContext = {
    correlationId,
    requestId: generateRequestId(),
    startTime: Date.now(),
  };
  return requestContextStorage.run(context, fn);
}

/**
 * Run an async function within a correlation context
 */
export async function runWithCorrelationIdAsync<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const context: RequestContext = {
    correlationId,
    requestId: generateRequestId(),
    startTime: Date.now(),
  };
  return requestContextStorage.run(context, fn);
}

/**
 * Create a child context that inherits parent correlation ID
 * Useful for spawning parallel operations
 */
export function createChildContext(): RequestContext {
  const parent = requestContextStorage.getStore();
  return {
    correlationId: parent?.correlationId || generateCorrelationId(),
    requestId: generateRequestId(),
    startTime: Date.now(),
    userId: parent?.userId,
    sessionId: parent?.sessionId,
  };
}

/**
 * Format context for logging (Pino-compatible)
 */
export function getLoggingContext(): Record<string, unknown> {
  const ctx = requestContextStorage.getStore();
  if (!ctx) return {};

  return {
    correlationId: ctx.correlationId,
    requestId: ctx.requestId,
    elapsedMs: Date.now() - ctx.startTime,
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.sessionId && { sessionId: ctx.sessionId }),
  };
}

/**
 * Correlation ID header names for export
 */
export { CORRELATION_ID_HEADER, REQUEST_ID_HEADER };

/**
 * Export the storage for middleware use
 */
export { requestContextStorage };

export type { RequestContext };
