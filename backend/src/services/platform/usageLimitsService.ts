/**
 * Usage limits and overage calculations for platform billing.
 */

import { getUsageForUser } from "./usageTracker.js";
import { getCreditsUsed, getCreditsLimit } from "./creditService.js";
import type { Tier } from "../../config/pricing.js";

const COMPUTE_ENDPOINT_PREFIXES = [
  "/api/ship",
  "/api/codegen",
  "/api/agents",
  "/api/testing",
  "/api/security",
  "/api/vision",
  "/api/voice",
  "/api/advanced-ai",
];

export function isComputeEndpoint(path: string): boolean {
  return COMPUTE_ENDPOINT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isCreditMeteredEndpoint(path: string): boolean {
  return (
    path.includes("/api/chat") ||
    path.includes("/api/ship") ||
    path.includes("/api/codegen") ||
    path.includes("/api/architecture") ||
    path.includes("/api/intent") ||
    path.includes("/api/prd") ||
    path.includes("/api/plan") ||
    path.includes("/api/agents") ||
    path.includes("/api/diagram")
  );
}

export async function getMonthlyComputeMinutes(
  userId: string,
): Promise<number> {
  if (!userId) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const records = await getUsageForUser(userId, start, now);
  const totalMs = records.reduce((sum, r) => {
    if (!r.latencyMs) return sum;
    if (!isComputeEndpoint(r.endpoint)) return sum;
    return sum + r.latencyMs;
  }, 0);
  return totalMs / 60000;
}

export async function getMonthlyStorageBytes(userId: string): Promise<number> {
  if (!userId) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const records = await getUsageForUser(userId, start, now);
  return records.reduce((sum, r) => sum + (r.storageBytes ?? 0), 0);
}

export async function getUsageLimitsSummary(userId: string, tier: Tier) {
  const [creditsUsed, creditsLimit, computeMinutesUsed, storageBytesUsed] =
    await Promise.all([
      getCreditsUsed(userId),
      getCreditsLimit(userId),
      getMonthlyComputeMinutes(userId),
      getMonthlyStorageBytes(userId),
    ]);

  const storageBytesLimit = tier.includedStorageGb * 1024 * 1024 * 1024;
  const computeMinutesLimit = tier.includedComputeMinutes;

  return {
    creditsUsed,
    creditsLimit,
    computeMinutesUsed,
    computeMinutesLimit,
    storageBytesUsed,
    storageBytesLimit,
  };
}
