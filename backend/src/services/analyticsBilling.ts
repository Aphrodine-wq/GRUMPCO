/**
 * Billing status for analytics – tier, limits, usage.
 * Uses featureFlagsService.getTierForUser and config/pricing.getTier.
 */

import { getTier } from '../config/pricing.js';
import { getTierForUser } from './featureFlagsService.js';
import { getMonthlyCallCount } from './usageTracker.js';
import type { TierId } from '../config/pricing.js';

export interface BillingStatus {
  tier: TierId;
  tierName: string;
  apiCallsLimit: number;
  apiCallsUsed: number;
  remaining: number;
  stripeCustomerId?: string;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const tierId = getTierForUser(userId);
  const tier = getTier(tierId);
  const used = getMonthlyCallCount(userId);
  const limit = tier.apiCallsPerMonth;
  return {
    tier: tierId,
    tierName: tier.name,
    apiCallsLimit: limit,
    apiCallsUsed: used,
    remaining: Math.max(0, limit - used),
  };
}
