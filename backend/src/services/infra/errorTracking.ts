/**
 * Error Tracking Service
 *
 * Centralized error tracking with Sentry integration for production monitoring.
 * Provides structured error capture, context enrichment, and performance monitoring.
 *
 * @module services/errorTracking
 */

import type { Request } from 'express';
import logger from '../../middleware/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorContext {
  /** User ID if authenticated */
  userId?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** API endpoint */
  endpoint?: string;
  /** HTTP method */
  method?: string;
  /** Additional tags */
  tags?: Record<string, string>;
  /** Extra context data */
  extra?: Record<string, unknown>;
  /** Error severity level */
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

export interface PerformanceSpan {
  finish: () => void;
  setStatus: (status: 'ok' | 'error' | 'cancelled') => void;
  setData: (key: string, value: unknown) => void;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.npm_package_version || 'unknown';
const SENTRY_ENABLED = Boolean(SENTRY_DSN) && process.env.NODE_ENV === 'production';

// Lazy-load Sentry to avoid import issues if not installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;

/**
 * Initialize error tracking service.
 * Call this early in application startup.
 */
export async function initErrorTracking(): Promise<void> {
  if (!SENTRY_DSN) {
    logger.info('Error tracking disabled (SENTRY_DSN not configured)');
    return;
  }

  try {
    // Dynamic import - Sentry is an optional dependency
    Sentry = await import('@sentry/node').catch(() => null);

    if (!Sentry) {
      logger.info('Sentry package not installed, error tracking disabled');
      return;
    }

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,

      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Session tracking
      autoSessionTracking: true,

      // Filtering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeSend(event: any, hint: any) {
        // Don't send events in development unless explicitly enabled
        if (process.env.NODE_ENV !== 'production' && !process.env.SENTRY_DEBUG) {
          return null;
        }

        // Filter out non-actionable errors
        const error = hint.originalException;
        if (error instanceof Error) {
          // Don't report client errors (4xx)
          if (
            error.message.includes('rate_limit') ||
            error.message.includes('unauthorized') ||
            error.message.includes('not_found')
          ) {
            return null;
          }
        }

        // Scrub sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }

        return event;
      },

      // Integrations
      integrations: [Sentry.httpIntegration({ tracing: true }), Sentry.expressIntegration()],

      // Ignore common non-errors
      ignoreErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'socket hang up',
        'Request aborted',
      ],
    });

    logger.info(
      {
        environment: SENTRY_ENVIRONMENT,
        release: SENTRY_RELEASE,
      },
      'Error tracking initialized (Sentry)'
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Sentry, error tracking disabled');
  }
}

// =============================================================================
// ERROR CAPTURE
// =============================================================================

/**
 * Capture an exception with context.
 */
export function captureException(error: Error, context?: ErrorContext): string | undefined {
  // Always log locally
  logger.error(
    {
      err: error.message,
      stack: error.stack,
      ...context,
    },
    'Exception captured'
  );

  if (!Sentry || !SENTRY_ENABLED) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Sentry.withScope((scope: any) => {
    // Set user context
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Set extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    // Set request context
    if (context?.requestId) {
      scope.setTag('request_id', context.requestId);
    }
    if (context?.endpoint) {
      scope.setTag('endpoint', context.endpoint);
    }
    if (context?.method) {
      scope.setTag('method', context.method);
    }

    // Set level
    if (context?.level) {
      scope.setLevel(context.level);
    }

    return Sentry.captureException(error);
  });
}

/**
 * Capture an exception from an Express request.
 */
export function captureRequestException(
  error: Error,
  req: Request,
  extra?: Record<string, unknown>
): string | undefined {
  const requestWithContext = req as Request & {
    correlationId?: string;
    user?: { id?: string };
  };

  return captureException(error, {
    userId: requestWithContext.user?.id,
    requestId: requestWithContext.correlationId,
    endpoint: req.path,
    method: req.method,
    extra: {
      query: req.query,
      params: req.params,
      ...extra,
    },
    tags: {
      route: `${req.method} ${req.path}`,
    },
  });
}

/**
 * Capture a message (non-error event).
 */
export function captureMessage(
  message: string,
  level: ErrorContext['level'] = 'info',
  context?: Omit<ErrorContext, 'level'>
): string | undefined {
  // Map level to logger method (logger uses 'warn' not 'warning', 'fatal' maps to 'error')
  const logLevel = level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : level;
  logger[logLevel]({ ...context }, message);

  if (!Sentry || !SENTRY_ENABLED) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Sentry.withScope((scope: any) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    scope.setLevel(level || 'info');

    return Sentry.captureMessage(message);
  });
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * Start a performance transaction.
 */
export function startTransaction(
  name: string,
  op: string
): {
  finish: () => void;
  startSpan: (name: string, op: string) => PerformanceSpan;
} {
  if (!Sentry || !SENTRY_ENABLED) {
    // Return no-op if Sentry not available
    return {
      finish: () => {},
      startSpan: () => ({
        finish: () => {},
        setStatus: () => {},
        setData: () => {},
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Sentry.startSpan({ name, op }, (span: any) => {
    return {
      finish: () => span?.end(),
      startSpan: (childName: string, childOp: string) => {
        const childSpan = Sentry!.startInactiveSpan({
          name: childName,
          op: childOp,
        });
        return {
          finish: () => childSpan?.end(),
          setStatus: (status: 'ok' | 'error' | 'cancelled') => {
            childSpan?.setStatus({
              code: status === 'ok' ? 1 : 2,
              message: status,
            });
          },
          setData: (key: string, value: unknown) => {
            childSpan?.setAttribute(key, value as string);
          },
        };
      },
    };
  });
}

// =============================================================================
// USER CONTEXT
// =============================================================================

/**
 * Set user context for all subsequent error reports.
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  if (!Sentry || !SENTRY_ENABLED) return;
  Sentry.setUser(user);
}

/**
 * Clear user context.
 */
export function clearUser(): void {
  if (!Sentry || !SENTRY_ENABLED) return;
  Sentry.setUser(null);
}

// =============================================================================
// BREADCRUMBS
// =============================================================================

/**
 * Add a breadcrumb for debugging error context.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  if (!Sentry || !SENTRY_ENABLED) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express error handler middleware for Sentry.
 * Use this as the last error handler.
 */
export function errorTrackingMiddleware() {
  return (err: Error, req: Request, res: unknown, next: (err?: Error) => void): void => {
    captureRequestException(err, req);
    next(err);
  };
}

/**
 * Express request handler to add Sentry context.
 */
export function requestContextMiddleware() {
  return (req: Request, res: unknown, next: () => void): void => {
    const requestWithContext = req as Request & {
      correlationId?: string;
      user?: { id?: string };
    };

    if (Sentry && SENTRY_ENABLED) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Sentry.withScope((scope: any) => {
        if (requestWithContext.correlationId) {
          scope.setTag('request_id', requestWithContext.correlationId);
        }
        if (requestWithContext.user?.id) {
          scope.setUser({ id: requestWithContext.user.id });
        }
        scope.setTag('route', `${req.method} ${req.path}`);
      });
    }

    next();
  };
}

// =============================================================================
// SHUTDOWN
// =============================================================================

/**
 * Flush pending events before shutdown.
 */
export async function flushErrorTracking(timeout = 2000): Promise<void> {
  if (!Sentry || !SENTRY_ENABLED) return;

  try {
    await Sentry.close(timeout);
    logger.info('Error tracking flushed');
  } catch (err) {
    logger.warn({ err }, 'Error flushing error tracking');
  }
}

export default {
  init: initErrorTracking,
  captureException,
  captureRequestException,
  captureMessage,
  startTransaction,
  setUser,
  clearUser,
  addBreadcrumb,
  errorTrackingMiddleware,
  requestContextMiddleware,
  flush: flushErrorTracking,
};
