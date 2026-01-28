/**
 * Billing service - subscription state and usage-based limits.
 * Tiers are defined in config/pricing; Stripe integration in stripeService.
 */
import { getTier, type TierId } from '../config/pricing.js'
import { getMonthlyCallCount } from './usageTracker.js'
import { checkQuota } from './apiKeyManager.js'
import type { SubscriptionTier } from './apiKeyManager.js'

export interface BillingStatus {
  tier: TierId
  tierName: string
  apiCallsLimit: number
  apiCallsUsed: number
  remaining: number
  stripeCustomerId?: string
}

export async function getBillingStatus(userId: string, tierId?: TierId): Promise<BillingStatus> {
  const tier = getTier(tierId ?? 'free')
  const tierForQuota = (tier.id === 'free' ? 'free' : tier.id === 'pro' ? 'pro' : tier.id === 'team' ? 'team' : 'enterprise') as SubscriptionTier
  const { remaining } = checkQuota(userId, tierForQuota)
  const used = getMonthlyCallCount(userId)
  return {
    tier: tier.id,
    tierName: tier.name,
    apiCallsLimit: tier.apiCallsPerMonth,
    apiCallsUsed: used,
    remaining,
  }
}
