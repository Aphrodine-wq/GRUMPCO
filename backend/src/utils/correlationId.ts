/**
 * Correlation ID Utilities
 * Generates and propagates correlation IDs for distributed tracing
 */

import { randomUUID } from 'crypto';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const _CORRELATION_ID_CONTEXT_KEY = 'correlationId';

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Get correlation ID from request headers or generate new one
 */
export function getCorrelationIdFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const headerValue = headers[CORRELATION_ID_HEADER] || headers[CORRELATION_ID_HEADER.toLowerCase()];
  
  if (Array.isArray(headerValue)) {
    return headerValue[0] || generateCorrelationId();
  }
  
  return (headerValue as string) || generateCorrelationId();
}

/**
 * Set correlation ID in response headers
 */
export function setCorrelationIdHeader(headers: Record<string, string | string[]>, correlationId: string): void {
  headers[CORRELATION_ID_HEADER] = correlationId;
}

/**
 * Get correlation ID from async local storage (if using AsyncLocalStorage)
 */
export function getCorrelationId(): string | undefined {
  // This would use AsyncLocalStorage in a real implementation
  // For now, return undefined - will be set by middleware
  return undefined;
}

/**
 * Correlation ID header name
 */
export { CORRELATION_ID_HEADER };
