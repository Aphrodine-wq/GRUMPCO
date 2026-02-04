/**
 * @fileoverview CSRF protection middleware
 * Protects against Cross-Site Request Forgery attacks on state-changing operations
 * @module middleware/csrf
 */

import { type Request, type Response, type NextFunction } from "express";
import csrf from "csurf";
import logger from "./logger.js";

const isProduction = process.env.NODE_ENV === "production";
const CSRF_ENABLED = isProduction
  ? process.env.CSRF_PROTECTION !== "false"
  : process.env.CSRF_PROTECTION === "true";

/**
 * Creates CSRF protection middleware
 * Uses cookie-based tokens for SPAs (Single Page Applications)
 *
 * Behavior:
 * - In production: CSRF protection is enabled by default
 * - In development: CSRF protection is disabled by default (can be enabled with CSRF_PROTECTION=true)
 *
 * Frontend must:
 * 1. Read CSRF token from cookie: `XSRF-TOKEN`
 * 2. Send token in header: `X-XSRF-TOKEN` on POST/PUT/DELETE/PATCH requests
 *
 * Example:
 * ```typescript
 * // Frontend code
 * const csrfToken = document.cookie
 *   .split('; ')
 *   .find(row => row.startsWith('XSRF-TOKEN='))
 *   ?.split('=')[1];
 *
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'X-XSRF-TOKEN': csrfToken,
 *     'Content-Type': 'application/json',
 *   },
 *   credentials: 'include',
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function createCsrfMiddleware() {
  // Only enable in production by default, or when explicitly enabled in development
  if (!isProduction && !CSRF_ENABLED) {
    logger.info("CSRF protection disabled (development mode)");
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const csrfProtection = csrf({
    cookie: {
      httpOnly: false, // Cookie must be readable by frontend JavaScript
      secure: isProduction, // HTTPS only in production
      sameSite: "strict", // Strict same-site policy
      key: "XSRF-TOKEN",
    },
    value: (req: Request) => {
      // Check header (preferred) or body (fallback)
      return (req.headers["x-xsrf-token"] as string) || req.body?._csrf;
    },
  });

  logger.info("CSRF protection enabled");

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
    // But still generate token for them
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      csrfProtection(req, res, (err) => {
        if (err) {
          logger.debug({ err: err.message }, "CSRF token generation failed");
        }
        next();
      });
      return;
    }

    // Validate CSRF token for state-changing methods (POST, PUT, DELETE, PATCH)
    csrfProtection(req, res, (err) => {
      if (err) {
        if (err.code === "EBADCSRFTOKEN") {
          logger.warn(
            {
              method: req.method,
              path: req.path,
              ip: req.ip,
            },
            "CSRF token validation failed",
          );

          res.status(403).json({
            error: "Invalid CSRF token",
            type: "csrf_error",
            message:
              "CSRF token missing or invalid. Include X-XSRF-TOKEN header in your request.",
          });
          return;
        }
        next(err);
        return;
      }
      next();
    });
  };
}

/**
 * Endpoint to get a CSRF token explicitly
 * Useful for non-browser clients or debugging
 */
export function getCsrfToken(req: Request, res: Response): void {
  const csrfTokenFn = (req as Request & { csrfToken?: () => string }).csrfToken;
  res.json({
    csrfToken: csrfTokenFn?.(),
  });
}
