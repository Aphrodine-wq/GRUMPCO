/**
 * Request Timeout Middleware
 *
 * Provides route-level request timeouts to prevent long-running requests from
 * hanging indefinitely. Different routes can have different timeout values
 * based on their expected execution time.
 *
 * @module timeout
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getRequestLogger } from "./logger.js";

/**
 * Timeout configuration for different route patterns.
 * Values are in milliseconds.
 */
interface TimeoutConfig {
  default: number;
  routes: Record<string, number>;
}

/**
 * Default timeout configurations (in ms).
 * Streaming endpoints get longer timeouts since they may run for extended periods.
 */
const TIMEOUT_CONFIG: TimeoutConfig = {
  default: 30_000, // 30 seconds for most routes
  routes: {
    // Health checks should be fast
    "/health": 5_000,
    "/health/quick": 2_000,
    "/health/ready": 10_000,

    // AI endpoints need longer timeouts due to LLM response times
    "/api/chat": 180_000, // 3 minutes - streaming responses
    "/api/chat/stream": 600_000, // 10 minutes - long streaming sessions
    "/api/codegen": 300_000, // 5 minutes - code generation can be slow
    "/api/codegen/start": 300_000,
    "/api/ship": 300_000, // 5 minutes - full ship mode sessions
    "/api/ship/start": 300_000,

    // Diagram generation
    "/api/diagram": 60_000, // 1 minute
    "/api/intent": 60_000,

    // Architecture and PRD (tuned for describe → Mermaid → PRD flow)
    "/api/architecture": 180_000, // 3 minutes
    "/api/architecture/generate": 180_000,
    "/api/architecture/generate-stream": 300_000, // 5 minutes for stream
    "/api/prd": 120_000,
    "/api/spec": 120_000,
    "/api/plan": 120_000,

    // Auth should be fast
    "/api/auth": 10_000,
    "/api/auth/login": 10_000,
    "/api/auth/logout": 5_000,
    "/api/auth/me": 5_000,

    // GitHub operations can be slow
    "/api/github": 60_000,

    // Voice (ASR + RAG + chat + TTS)
    "/api/voice": 120_000,
  },
};

/**
 * Get timeout value for a specific path.
 * Matches the most specific route pattern first.
 *
 * @param path - Request path
 * @returns Timeout in milliseconds
 */
function getTimeoutForPath(path: string): number {
  // Exact match first
  if (TIMEOUT_CONFIG.routes[path]) {
    return TIMEOUT_CONFIG.routes[path];
  }

  // Check for prefix matches (e.g., /api/chat matches /api/chat/stream)
  const sortedRoutes = Object.keys(TIMEOUT_CONFIG.routes).sort(
    (a, b) => b.length - a.length,
  );

  for (const route of sortedRoutes) {
    if (path.startsWith(route)) {
      return TIMEOUT_CONFIG.routes[route];
    }
  }

  return TIMEOUT_CONFIG.default;
}

/**
 * Custom error class for request timeouts.
 */
export class RequestTimeoutError extends Error {
  public readonly statusCode = 408;
  public readonly type = "request_timeout";
  public readonly timeout: number;
  public readonly path: string;

  constructor(path: string, timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = "RequestTimeoutError";
    this.timeout = timeout;
    this.path = path;
  }
}

/**
 * Create a timeout middleware for a specific timeout value.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Express middleware function
 */
export function createTimeoutMiddleware(timeoutMs: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const log = getRequestLogger();

    // Skip timeout for streaming responses (they manage their own lifecycle)
    if (req.headers.accept === "text/event-stream") {
      next();
      return;
    }

    // Track if response has been sent
    let responded = false;
    const markResponded = () => {
      responded = true;
    };

    // Listen for response events
    res.on("finish", markResponded);
    res.on("close", markResponded);

    const timer = setTimeout(() => {
      if (responded) return;

      log.warn(
        { path: req.path, method: req.method, timeout: timeoutMs },
        "Request timed out",
      );

      // Abort any ongoing operations
      if (req.socket && !req.socket.destroyed) {
        req.socket.destroy();
      }

      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(408).json({
          error: `Request timeout after ${timeoutMs}ms`,
          type: "request_timeout",
          path: req.path,
        });
      }
    }, timeoutMs);

    // Clear timer when response finishes
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}

/**
 * Dynamic timeout middleware that selects timeout based on route.
 * Apply this globally to the app for automatic per-route timeouts.
 *
 * @example
 * ```typescript
 * import { requestTimeout } from './middleware/timeout.js';
 * app.use(requestTimeout);
 * ```
 */
export function requestTimeout(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const timeout = getTimeoutForPath(req.path);
  const middleware = createTimeoutMiddleware(timeout);
  middleware(req, res, next);
}

/**
 * Create a timeout wrapper for specific routes with custom timeout.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { withTimeout } from './middleware/timeout.js';
 * router.post('/long-operation', withTimeout(60000), handler);
 * ```
 */
export function withTimeout(timeoutMs: number): RequestHandler {
  return createTimeoutMiddleware(timeoutMs);
}

/**
 * Update timeout configuration for a specific route.
 * Useful for runtime configuration changes.
 *
 * @param path - Route path pattern
 * @param timeoutMs - New timeout value in milliseconds
 */
export function setRouteTimeout(path: string, timeoutMs: number): void {
  const log = getRequestLogger();
  TIMEOUT_CONFIG.routes[path] = timeoutMs;
  log.info({ path, timeout: timeoutMs }, "Route timeout updated");
}

/**
 * Get current timeout configuration for a path.
 *
 * @param path - Route path
 * @returns Current timeout in milliseconds
 */
export function getRouteTimeout(path: string): number {
  return getTimeoutForPath(path);
}

export default requestTimeout;
