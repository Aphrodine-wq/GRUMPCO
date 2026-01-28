/**
 * Subscription pricing tiers for G-Rump.
 */
export type TierId = 'free' | 'pro' | 'team' | 'enterprise'

export interface Tier {
  id: TierId
  name: string
  priceMonthlyCents: number
  priceYearlyCents?: number
  apiCallsPerMonth: number
  features: string[]
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
}

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    apiCallsPerMonth: 50,
    features: ['50 API calls/month', 'Basic features', 'Community support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyCents: 2900, // $29
    priceYearlyCents: 29000, // $290/year
    apiCallsPerMonth: 1_000,
    features: ['1,000 API calls/month', 'All features', 'Priority support', 'Usage analytics'],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthlyCents: 9900, // $99
    priceYearlyCents: 99000,
    apiCallsPerMonth: 5_000,
    features: ['5,000 API calls/month', 'Team collaboration', 'Shared projects', 'Admin dashboard'],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_TEAM_YEARLY,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthlyCents: 0,
    apiCallsPerMonth: Number.MAX_SAFE_INTEGER,
    features: ['Unlimited calls', 'Dedicated support', 'SLA', 'Custom integrations'],
  },
}

export function getTier(id: TierId): Tier {
  return TIERS[id] ?? TIERS.free
}
