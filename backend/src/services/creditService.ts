/**
 * Credit-based billing – meter usage by operation type and enforce limits.
 * Maps usage_records to credits via CREDITS_PER_OPERATION.
 */

import {
  CREDITS_PER_OPERATION,
  getTier,
  type TierId,
} from "../config/pricing.js";
import { getUsageForUser } from "./usageTracker.js";
import { licenseService } from "./licenseService.js";

function getOperationFromEndpoint(endpoint: string): string {
  const path = endpoint || "";
  if (path.includes("/ship/") || path === "/api/ship/start") return "ship";
  if (path.includes("/codegen/")) return "codegen";
  if (path.includes("/architecture/")) return "architecture";
  if (path.includes("/intent/")) return "intent";
  if (path.includes("/prd/")) return "prd";
  if (path.includes("/plan/")) return "plan";
  if (path.includes("/agents/swarm") || path.includes("swarm"))
    return "swarm_run";
  if (path.includes("/chat/stream")) return "chat";
  return "chat"; // Default
}

function getCreditsForOperation(operation: string): number {
  return CREDITS_PER_OPERATION[operation] ?? 1;
}

/**
 * Get credits used by a user for the current month.
 * Sums credits from usage_records by mapping endpoint to operation type.
 */
export async function getCreditsUsed(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await getUsageForUser(userId, start, now);

    let total = 0;
    for (const r of records) {
      const op = getOperationFromEndpoint(r.endpoint);
      total += getCreditsForOperation(op);
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Get credits limit for a user based on tier.
 */
export async function getCreditsLimit(userId: string): Promise<number> {
  const license = await licenseService.getLicenseStatus(userId);
  const tier = getTier(license.tier);
  return tier.creditsPerMonth ?? tier.apiCallsPerMonth;
}

/**
 * Get usage summary for billing display.
 */
export async function getCreditUsageSummary(userId: string): Promise<{
  creditsUsed: number;
  creditsLimit: number;
  tier: TierId;
  percentageUsed: number;
}> {
  const [creditsUsed, creditsLimit, license] = await Promise.all([
    getCreditsUsed(userId),
    getCreditsLimit(userId),
    licenseService.getLicenseStatus(userId),
  ]);

  const percentageUsed =
    creditsLimit > 0 ? Math.min(100, (creditsUsed / creditsLimit) * 100) : 0;

  return {
    creditsUsed,
    creditsLimit,
    tier: license.tier,
    percentageUsed,
  };
}

/**
 * Check if user has credits remaining.
 */
export async function hasCreditsRemaining(userId: string): Promise<boolean> {
  const [used, limit] = await Promise.all([
    getCreditsUsed(userId),
    getCreditsLimit(userId),
  ]);
  return used < limit;
}
