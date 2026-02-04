/**
 * Usage Limits Middleware
 * Enforces platform credits, compute minutes, and storage caps.
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authMiddleware.js";
import { getTier } from "../config/pricing.js";
import { licenseService } from "../services/licenseService.js";
import {
  getMonthlyComputeMinutes,
  getMonthlyStorageBytes,
  isComputeEndpoint,
  isCreditMeteredEndpoint,
} from "../services/usageLimitsService.js";
import { getCreditsUsed, getCreditsLimit } from "../services/creditService.js";

const SKIP_PATH_PREFIXES = [
  "/health",
  "/metrics",
  "/api/health",
  "/api/billing",
  "/auth",
];

function shouldSkip(path: string): boolean {
  return SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function usageLimitsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (shouldSkip(req.path)) {
    return next();
  }

  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id ?? "anonymous";

    const license = await licenseService.getLicenseStatus(userId);
    const tier = getTier(license.tier);

    if (isCreditMeteredEndpoint(req.path)) {
      const [used, limit] = await Promise.all([
        getCreditsUsed(userId),
        getCreditsLimit(userId),
      ]);
      if (Number.isFinite(limit) && limit > 0 && used >= limit) {
        res.status(402).json({
          error: "Credits limit exceeded",
          type: "credits_limit_exceeded",
          creditsUsed: used,
          creditsLimit: limit,
          tier: tier.id,
        });
        return;
      }
    }

    if (isComputeEndpoint(req.path)) {
      const [computeMinutesUsed, storageBytesUsed] = await Promise.all([
        getMonthlyComputeMinutes(userId),
        getMonthlyStorageBytes(userId),
      ]);

      const computeMinutesLimit = tier.includedComputeMinutes;
      if (
        Number.isFinite(computeMinutesLimit) &&
        computeMinutesLimit > 0 &&
        computeMinutesUsed >= computeMinutesLimit
      ) {
        res.status(402).json({
          error: "Compute minutes limit exceeded",
          type: "compute_limit_exceeded",
          computeMinutesUsed,
          computeMinutesLimit,
          tier: tier.id,
        });
        return;
      }

      const storageBytesLimit = tier.includedStorageGb * 1024 * 1024 * 1024;
      if (
        Number.isFinite(storageBytesLimit) &&
        storageBytesLimit > 0 &&
        storageBytesUsed >= storageBytesLimit
      ) {
        res.status(402).json({
          error: "Storage limit exceeded",
          type: "storage_limit_exceeded",
          storageBytesUsed,
          storageBytesLimit,
          tier: tier.id,
        });
        return;
      }
    }

    next();
  } catch {
    next();
  }
}
