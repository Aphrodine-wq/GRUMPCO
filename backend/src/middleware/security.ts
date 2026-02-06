/**
 * @fileoverview Security middleware configuration for Express application.
 * Configures Helmet, CORS, host validation, and other security layers.
 * @module middleware/security
 */

import {
  type Request,
  type Response,
  type NextFunction,
  type Express,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";
import logger from "./logger.js";

/** Whether the application is running in production mode */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Determines allowed CORS origins based on environment configuration.
 * In production, uses CORS_ORIGINS env var or minimal defaults.
 * In development, allows common localhost ports.
 * @returns Array of allowed origin strings
 */
function getAllowedOrigins(): string[] {
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(",").map((o) => o.trim());
  }

  if (isProduction) {
    // Production defaults - set CORS_ORIGINS env var for custom domains
    return [
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
      "http://127.0.0.1:3000",
      // Common deployment platforms - add your domain via CORS_ORIGINS env var
      "https://g-rump.com",
      "https://www.g-rump.com",
      "https://grump.onrender.com",
      "https://grump-frontend.onrender.com",
    ];
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5178",
    "http://127.0.0.1:5178",
    "tauri://localhost",
    "http://tauri.localhost",
  ];
}

/**
 * Parses and returns allowed hosts from environment configuration.
 * @returns Array of lowercase host strings
 */
function getAllowedHosts(): string[] {
  if (!env.ALLOWED_HOSTS) {
    return [];
  }
  return env.ALLOWED_HOSTS.split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Creates Helmet security middleware with environment-appropriate configuration.
 * Enables strict CSP and HSTS in production, relaxes for development.
 * @returns Configured Helmet middleware
 */
export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            reportUri: "/api/csp-report",
          },
          reportOnly: false,
        }
      : false, // Disable CSP in development for Electron/Vite HMR
    crossOriginEmbedderPolicy: false, // Allow embedding for diagrams
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "sameorigin" },
    hsts: isProduction
      ? {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  });
}

/**
 * Creates host header validation middleware.
 * Only active in production with ALLOWED_HOSTS configured.
 * Prevents host header injection attacks.
 * @returns Express middleware function
 */
export function createHostValidationMiddleware() {
  const allowedHosts = getAllowedHosts();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isProduction || allowedHosts.length === 0) {
      next();
      return;
    }

    const hostHeader = (req.headers.host || "").toString().toLowerCase();
    const host = hostHeader.split(":")[0];

    if (!allowedHosts.includes(host)) {
      logger.warn({ host }, "Blocked by Host allowlist");
      res
        .status(400)
        .json({ error: "Invalid Host header", type: "bad_request" });
      return;
    }

    next();
  };
}

/**
 * Creates CORS middleware with environment-appropriate configuration.
 * Validates origins against allowlist, handles development flexibility.
 * @returns Configured CORS middleware
 */
export function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin header (health checks, server-to-server, mobile apps, curl, Electron)
      // This is safe because CORS only protects browser-based requests.
      // NOTE: We intentionally reject origin === "null" (the string literal "null").
      // Browsers send this from sandboxed iframes, data: URIs, and file: origins — all of which
      // can be attacker-controlled. Only the truly absent origin header (!origin / undefined) is safe.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (origin === "null") {
        logger.warn("Rejected CORS request with origin 'null' (possible sandboxed iframe or data: URI)");
        callback(new Error("Null origin not allowed by CORS"));
        return;
      }

      // In development, allow all localhost origins
      if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          callback(null, true);
          return;
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, "Blocked by CORS");
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  });
}

/**
 * Applies all security middleware to the Express application.
 * Should be called early in the middleware chain.
 * @param app - Express application instance
 */
export function applySecurityMiddleware(app: Express): void {
  // Trust proxy in production (for correct client IP behind load balancers)
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // Hide framework signature
  app.disable("x-powered-by");

  // Apply security layers in order
  app.use(createHelmetMiddleware());
  app.use(createHostValidationMiddleware());
  app.use(createCorsMiddleware());
}
