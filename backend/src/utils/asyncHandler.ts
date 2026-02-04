/**
 * Async Handler Utility
 *
 * Wraps async Express route handlers to automatically catch errors
 * and pass them to the error handling middleware.
 *
 * This eliminates the need for try-catch blocks in every route handler,
 * improving code maintainability and ensuring consistent error handling.
 *
 * @module utils/asyncHandler
 *
 * @example
 * // Before (verbose, error-prone):
 * router.get('/users', async (req, res, next) => {
 *   try {
 *     const users = await userService.getAll();
 *     res.json(users);
 *   } catch (error) {
 *     logger.error({ error }, 'Failed to get users');
 *     sendServerError(res, error);
 *   }
 * });
 *
 * // After (clean, consistent):
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json(users);
 * }));
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import logger from "../middleware/logger.js";
import { sendServerError, ApiError, sendError } from "./errorResponse.js";

/**
 * Async request handler function type
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

/**
 * Wraps an async route handler to automatically catch errors.
 * Errors are logged and sent as standardized error responses.
 *
 * @param fn - The async route handler function
 * @returns A wrapped handler that catches and processes errors
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      // Log the error with request context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        {
          error: errorMessage,
          method: req.method,
          path: req.path,
          correlationId: req.headers["x-correlation-id"],
        },
        "Request handler error",
      );

      // Handle ApiError specially
      if (error instanceof ApiError) {
        return sendError(res, error);
      }

      // Send generic server error for other errors
      sendServerError(res, error);
    });
  };
}

/**
 * Wraps an async route handler with custom error handling.
 * Allows specifying a custom error handler for specific routes.
 *
 * @param fn - The async route handler function
 * @param errorHandler - Custom error handling function
 * @returns A wrapped handler with custom error handling
 */
export function asyncHandlerWithCustomError(
  fn: AsyncRequestHandler,
  errorHandler: (error: unknown, req: Request, res: Response) => void,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      errorHandler(error, req, res);
    });
  };
}

/**
 * Type guard to check if a function is an async function
 */
export function isAsyncFunction(
  fn: unknown,
): fn is (...args: unknown[]) => Promise<unknown> {
  return fn instanceof Function && fn.constructor.name === "AsyncFunction";
}

export default asyncHandler;
