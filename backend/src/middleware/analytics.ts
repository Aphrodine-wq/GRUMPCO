/**
 * Analytics Middleware for Express
 *
 * Tracks API requests and user behavior automatically
 *
 * Usage:
 * ```typescript
 * import { analyticsMiddleware } from './middleware/analytics';
 *
 * app.use(analyticsMiddleware());
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import { analytics } from '../services/analytics.js';

interface AnalyticsMiddlewareOptions {
  /** Track all requests or only specific paths */
  trackPaths?: string[] | ((path: string) => boolean);
  /** Exclude paths from tracking */
  excludePaths?: string[];
  /** Include request body in analytics (be careful with PII) */
  includeBody?: boolean;
  /** Custom properties extractor */
  getProperties?: (req: Request, res: Response) => Record<string, unknown>;
}

// Track request timing
const requestTimings = new Map<string, number>();

export function analyticsMiddleware(options: AnalyticsMiddlewareOptions = {}) {
  const {
    excludePaths = ['/health', '/metrics', '/_next', '/favicon.ico'],
    includeBody = false,
    getProperties,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const requestId = `${req.method}:${req.path}:${Date.now()}`;
    const startTime = Date.now();
    requestTimings.set(requestId, startTime);

    // Get user ID from request (assuming auth middleware sets this)
    const userId = (req as Request & { user?: { id: string } }).user?.id;

    // Track request start
    analytics.track(
      'api_request_started',
      {
        method: req.method,
        path: req.path,
        route: req.route?.path,
        user_agent: req.get('user-agent'),
        ip: req.ip,
        ...(includeBody && req.body ? { body_size: JSON.stringify(req.body).length } : {}),
      },
      userId
    );

    // Override res.end to track completion
    const originalEnd = res.end.bind(res);
    res.end = function (this: Response, chunk?: unknown, encoding?: unknown, callback?: unknown) {
      const endTime = Date.now();
      const duration = endTime - (requestTimings.get(requestId) || endTime);
      requestTimings.delete(requestId);

      const success = res.statusCode < 400;
      const eventName = success ? 'api_request_completed' : 'api_request_failed';

      const properties: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: duration,
        duration_seconds: Math.round(duration / 1000),
      };

      // Add custom properties if provided
      if (getProperties) {
        Object.assign(properties, getProperties(req, res));
      }

      analytics.track(eventName, properties, userId);

      // Track specific events based on path
      trackSpecificEvents(req, res, duration, userId);

      return originalEnd(chunk as never, encoding as never, callback as never);
    };

    next();
  };
}

function trackSpecificEvents(req: Request, res: Response, duration: number, userId?: string) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Track intent submissions
  if (path.includes('/intent') && method === 'POST' && res.statusCode < 400) {
    analytics.track(
      'intent_submitted',
      {
        source: 'api',
        duration_ms: duration,
      },
      userId
    );
  }

  // Track architecture generation
  if (path.includes('/architecture') && method === 'POST' && res.statusCode < 400) {
    analytics.track(
      'architecture_viewed',
      {
        source: 'api',
        duration_ms: duration,
      },
      userId
    );
  }

  // Track code generation
  if (path.includes('/code') && method === 'POST' && res.statusCode < 400) {
    analytics.track(
      'code_generated',
      {
        source: 'api',
        duration_ms: duration,
      },
      userId
    );
  }

  // Track project downloads
  if (path.includes('/download') && method === 'GET' && res.statusCode < 400) {
    analytics.track(
      'project_downloaded',
      {
        source: 'api',
        path: req.path,
      },
      userId
    );
  }

  // Track chat messages
  if (path.includes('/chat') && method === 'POST' && res.statusCode < 400) {
    analytics.track(
      'chat_message_sent',
      {
        source: 'api',
        message_type: 'user',
      },
      userId
    );
  }

  // Track errors
  if (res.statusCode >= 500) {
    analytics.track(
      'error_occurred',
      {
        source: 'api',
        path: req.path,
        method: req.method,
        status_code: res.statusCode,
      },
      userId
    );
  }
}

/**
 * Middleware to track user identification
 */
export function identifyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (
      req as Request & { user?: { id: string; email?: string; traits?: Record<string, unknown> } }
    ).user;

    if (user?.id) {
      analytics.identify(user.id, {
        email: user.email,
        ...user.traits,
      });
    }

    next();
  };
}

export default analyticsMiddleware;
