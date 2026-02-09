/**
 * Credit-based billing – cost-based tracking.
 * Uses estimatedCostUsd from usage_records; limits from tier.monthlyBudgetUsd.
 */

import { getTier, type TierId } from "../../config/pricing.js";
import { getMonthlyCostForUser } from "./usageTracker.js";
import { licenseService } from "../security/licenseService.js";

/**
 * Get cost used (USD) by a user for the current month.
 * Sums estimatedCostUsd from usage_records.
 */
export async function getCreditsUsed(userId: string): Promise<number> {
  if (!userId) return 0;
  return getMonthlyCostForUser(userId);
}

/**
 * Get budget limit (USD) for a user based on tier.
 */
export async function getCreditsLimit(userId: string): Promise<number> {
  const license = await licenseService.getLicenseStatus(userId);
  const tier = getTier(license.tier);
  return tier.monthlyBudgetUsd ?? tier.creditsPerMonth ?? tier.apiCallsPerMonth;
}

/**
 * Get usage summary for billing display (cost-based: USD used vs budget).
 */
export async function getCreditUsageSummary(userId: string): Promise<{
  creditsUsed: number;
  creditsLimit: number;
  tier: TierId;
  percentageUsed: number;
  costUsedUsd: number;
  costLimitUsd: number;
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
    costUsedUsd: creditsUsed,
    costLimitUsd: creditsLimit,
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
