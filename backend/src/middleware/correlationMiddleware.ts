/**
 * Correlation ID Express Middleware
 *
 * Provides request context propagation via AsyncLocalStorage
 * for distributed tracing and logging correlation
 */

import { type Request, type Response, type NextFunction } from 'express';
import {
  generateCorrelationId,
  generateRequestId,
  getCorrelationIdFromHeaders,
  requestContextStorage,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  type RequestContext,
} from '../utils/correlationId.js';

/**
 * Extend Express Request type to include correlation context
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
      requestId?: string;
      requestContext?: RequestContext;
    }
  }
}

/**
 * Options for the correlation ID middleware
 */
interface CorrelationMiddlewareOptions {
  /**
   * Whether to generate a correlation ID if not present in headers
   * @default true
   */
  generate?: boolean;

  /**
   * Whether to add correlation ID to response headers
   * @default true
   */
  propagate?: boolean;

  /**
   * Header name for correlation ID
   * @default 'x-correlation-id'
   */
  headerName?: string;

  /**
   * Custom function to extract correlation ID from request
   */
  extractor?: (req: Request) => string | undefined;

  /**
   * Whether to trust forwarded headers
   * @default true
   */
  trustProxy?: boolean;
}

/**
 * Create correlation ID middleware
 *
 * This middleware:
 * 1. Extracts or generates a correlation ID for each request
 * 2. Stores it in AsyncLocalStorage for access anywhere in the request chain
 * 3. Adds it to request object and response headers
 *
 * @example
 * ```ts
 * import { correlationMiddleware } from './middleware/correlationMiddleware';
 *
 * app.use(correlationMiddleware());
 *
 * // Then in any handler or service:
 * import { getCorrelationId } from './utils/correlationId';
 *
 * function myHandler() {
 *   const correlationId = getCorrelationId();
 *   logger.info({ correlationId }, 'Processing request');
 * }
 * ```
 */
export function correlationMiddleware(
  options: CorrelationMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    generate = true,
    propagate = true,
    headerName = CORRELATION_ID_HEADER,
    extractor,
    trustProxy = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract correlation ID from headers or custom extractor
    let correlationId: string | undefined;

    if (extractor) {
      correlationId = extractor(req);
    }

    if (!correlationId && trustProxy) {
      correlationId = getCorrelationIdFromHeaders(
        req.headers as Record<string, string | string[] | undefined>
      );
    }

    // Generate if not found and generation is enabled
    if (!correlationId && generate) {
      correlationId = generateCorrelationId();
    }

    // If still no correlation ID, use a fallback
    if (!correlationId) {
      correlationId = generateCorrelationId();
    }

    // Generate a unique request ID for this specific request
    const requestId = generateRequestId();

    // Create the request context
    const context: RequestContext = {
      correlationId,
      requestId,
      startTime: Date.now(),
    };

    // Attach to request object for easy access
    req.correlationId = correlationId;
    req.requestId = requestId;
    req.requestContext = context;

    // Add to response headers for client-side correlation
    if (propagate) {
      res.setHeader(headerName, correlationId);
      res.setHeader(REQUEST_ID_HEADER, requestId);
    }

    // Run the rest of the request chain within the AsyncLocalStorage context
    requestContextStorage.run(context, () => {
      next();
    });
  };
}

/**
 * Get correlation headers for outgoing HTTP requests
 * Useful when making requests to downstream services
 */
export function getCorrelationHeaders(): Record<string, string> {
  const context = requestContextStorage.getStore();
  if (!context) {
    return {
      [CORRELATION_ID_HEADER]: generateCorrelationId(),
      [REQUEST_ID_HEADER]: generateRequestId(),
    };
  }

  return {
    [CORRELATION_ID_HEADER]: context.correlationId,
    [REQUEST_ID_HEADER]: context.requestId,
  };
}

/**
 * Error handler middleware that includes correlation context
 */
export function correlationErrorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Ensure correlation ID is in the error response
  const correlationId =
    req.correlationId ||
    getCorrelationIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

  // Add to response if not already set
  if (!res.headersSent) {
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
  }

  next(err);
}

export default correlationMiddleware;
