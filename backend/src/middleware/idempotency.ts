/**
 * Idempotency Middleware
 *
 * Ensures duplicate requests with the same idempotency key
 * return the same response without re-executing the operation.
 * Critical for payment processing, webhook handling, and mutations.
 */

import { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { getRedisClient } from "../services/redis.js";
import { logger } from "../utils/logger.js";

export interface IdempotencyOptions {
  ttl: number; // Time to live in seconds (default: 86400 = 24 hours)
  keyHeader: string; // Header name for idempotency key (default: Idempotency-Key)
  responseHeader: string; // Header name for response (default: Idempotency-Status)
  hashBody: boolean; // Whether to hash request body for additional validation
}

const DEFAULT_OPTIONS: IdempotencyOptions = {
  ttl: 86400, // 24 hours
  keyHeader: "idempotency-key",
  responseHeader: "idempotency-status",
  hashBody: true,
};

interface IdempotencyRecord {
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  createdAt: Date;
  locked: boolean;
  lockExpiresAt: Date | null;
}

export function idempotencyMiddleware(
  options: Partial<IdempotencyOptions> = {},
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Only apply to mutating methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[opts.keyHeader.toLowerCase()] as string;

    if (!idempotencyKey) {
      // If key is required but missing, return error
      // For now, allow requests without keys (optional idempotency)
      return next();
    }

    // Validate key format (UUID v4 recommended)
    if (!isValidIdempotencyKey(idempotencyKey)) {
      res.status(400).json({
        error: "Invalid idempotency key format",
        message: "Idempotency key must be a valid UUID",
      });
      return;
    }

    const redis = getRedisClient();
    const requestHash = opts.hashBody ? hashRequest(req) : "";
    const cacheKey = `idempotency:${idempotencyKey}`;

    try {
      // Check for existing record
      const existing = await redis.get(cacheKey);

      if (existing) {
        const record: IdempotencyRecord = JSON.parse(existing);

        // Check if request is locked (concurrent processing)
        if (
          record.locked &&
          record.lockExpiresAt &&
          new Date() < new Date(record.lockExpiresAt)
        ) {
          res.status(409).json({
            error: "Conflict",
            message:
              "Request with this idempotency key is already being processed",
            retryAfter: Math.ceil(
              (new Date(record.lockExpiresAt).getTime() - Date.now()) / 1000,
            ),
          });
          return;
        }

        // Check if request body matches (if hashing enabled)
        if (opts.hashBody && record.requestHash !== requestHash) {
          res.status(422).json({
            error: "Idempotency key mismatch",
            message:
              "This idempotency key was used with different request parameters",
          });
          return;
        }

        // Return cached response
        logger.info(
          {
            idempotencyKey,
            originalStatus: record.responseStatus,
            age: Math.floor(
              (Date.now() - new Date(record.createdAt).getTime()) / 1000,
            ),
          },
          "Returning idempotent cached response",
        );

        res.set(opts.responseHeader, "replay");
        res.set(
          "X-Idempotency-Age",
          String(
            Math.floor(
              (Date.now() - new Date(record.createdAt).getTime()) / 1000,
            ),
          ),
        );

        // Restore original headers
        Object.entries(record.responseHeaders).forEach(([key, value]) => {
          if (
            !["transfer-encoding", "content-length"].includes(key.toLowerCase())
          ) {
            res.set(key, value);
          }
        });

        res.status(record.responseStatus).send(record.responseBody);
        return;
      }

      // No existing record - lock and process
      const lockRecord: IdempotencyRecord = {
        key: idempotencyKey,
        requestHash,
        responseStatus: 0,
        responseBody: "",
        responseHeaders: {},
        createdAt: new Date(),
        locked: true,
        lockExpiresAt: new Date(Date.now() + 30000), // 30 second lock
      };

      await redis.setex(cacheKey, opts.ttl, JSON.stringify(lockRecord));

      // Capture response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalStatus = res.status.bind(res);
      let capturedStatus = 200;
      let responseBody: string | null = null;

      res.status = (code: number) => {
        capturedStatus = code;
        return originalStatus(code);
      };

      res.json = (body: unknown) => {
        responseBody = JSON.stringify(body);
        return originalJson(body);
      };

      res.send = (body: unknown) => {
        if (typeof body === "string") {
          responseBody = body;
        } else {
          responseBody = JSON.stringify(body);
        }
        return originalSend(body);
      };

      // Store response after request completes
      res.on("finish", async () => {
        try {
          if (responseBody) {
            const finalRecord: IdempotencyRecord = {
              key: idempotencyKey,
              requestHash,
              responseStatus: capturedStatus,
              responseBody,
              responseHeaders: res.getHeaders() as Record<string, string>,
              createdAt: lockRecord.createdAt,
              locked: false,
              lockExpiresAt: null,
            };

            await redis.setex(cacheKey, opts.ttl, JSON.stringify(finalRecord));

            logger.info(
              {
                idempotencyKey,
                status: capturedStatus,
                ttl: opts.ttl,
              },
              "Idempotency response cached",
            );
          }
        } catch (error) {
          logger.error(
            { error, idempotencyKey },
            "Failed to cache idempotency response",
          );
        }
      });

      res.set(opts.responseHeader, "new");
      next();
    } catch (error) {
      logger.error({ error, idempotencyKey }, "Idempotency middleware error");
      // Continue without idempotency on error
      next();
    }
  };
}

function isValidIdempotencyKey(key: string): boolean {
  // UUID v4 format validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(key);
}

function hashRequest(req: Request): string {
  const body = JSON.stringify(req.body || {});
  const path = req.path;
  const method = req.method;
  const data = `${method}:${path}:${body}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function clearIdempotencyKey(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`idempotency:${key}`);
}

export async function getIdempotencyStatus(
  key: string,
): Promise<IdempotencyRecord | null> {
  const redis = getRedisClient();
  const data = await redis.get(`idempotency:${key}`);
  return data ? JSON.parse(data) : null;
}
