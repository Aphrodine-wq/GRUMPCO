/**
 * Subscription pricing tiers for G-Rump (desktop/backend).
 * Platform fees cover backend hosting + storage; BYOK for model costs by default.
 * Hosted models are optional and billed via credits.
 */

export type TierId = "free" | "pro" | "team" | "enterprise";

/** Premium feature flags for gating capabilities */
export type PremiumFeature =
  | "cloud_tools"
  | "cicd_tools"
  | "large_swarm"
  | "persistent_agent"
  | "nvidia_advanced"
  | "multi_platform_msg"
  | "priority_routing";

export interface Tier {
  id: TierId;
  name: string;
  priceMonthlyCents: number;
  priceYearlyCents?: number;
  /** Credits included per month */
  creditsPerMonth: number;
  /** For backward compatibility; maps to credits */
  apiCallsPerMonth: number;
  features: string[];
  premiumFeatures: PremiumFeature[];
  /** Seats included per month */
  seats: number;
  /** Included storage per month (GB) */
  includedStorageGb: number;
  /** Included compute minutes per month (ship/codegen queue) */
  includedComputeMinutes: number;
  maxSwarmAgents: number;
  maxConcurrentAgents: number;
  maxHeartbeats: number;
  /** Swarm add-on price (cents/month) when not included */
  swarmAddOnCents?: number;
}

/** Credits cost per operation type */
export const CREDITS_PER_OPERATION: Record<string, number> = {
  chat: 1,
  architecture: 2,
  intent: 1,
  prd: 3,
  plan: 2,
  ship: 10,
  codegen: 20,
  swarm_run: 15,
};

/** Overage rates for platform usage */
export const OVERAGE_RATES = {
  storageGbMonthlyCents: 25, // $0.25 per GB-month
  computeMinuteCents: 2, // $0.02 per minute
  extraConcurrentAgentMonthlyCents: 2000, // $20 per slot
};

/** Hosted models add-on pricing (optional) */
export const HOSTED_CREDITS = {
  paygPerCreditCents: 3, // $0.03 per credit
  minimumMonthlyCents: 2500, // $25 minimum add-on
  paygMonthlyFloorCents: 5000, // $50 monthly floor for pay-as-you-go
};

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyCents: 0,
    creditsPerMonth: 10,
    apiCallsPerMonth: 10,
    features: [
      "10 credits/month (1 credit = 1 message)",
      "BYOK for model costs",
      "1 seat",
      "1 GB storage",
      "Up to 3 agents per swarm",
      "Community support",
    ],
    premiumFeatures: [],
    seats: 1,
    includedStorageGb: 1,
    includedComputeMinutes: 30,
    maxSwarmAgents: 3,
    maxConcurrentAgents: 1,
    maxHeartbeats: 3,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyCents: 4900,
    priceYearlyCents: 49000,
    creditsPerMonth: 1_000,
    apiCallsPerMonth: 1_000,
    features: [
      "1,000 credits/month (platform usage)",
      "BYOK for model costs",
      "1 seat",
      "10 GB storage",
      "Cloud & CI/CD tools",
      "Up to 5 agents per swarm",
      "Priority support",
      "Usage analytics",
      "Overage billing (storage/compute)",
    ],
    premiumFeatures: ["cloud_tools", "cicd_tools", "priority_routing"],
    seats: 1,
    includedStorageGb: 10,
    includedComputeMinutes: 300,
    maxSwarmAgents: 5,
    maxConcurrentAgents: 3,
    maxHeartbeats: 10,
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthlyCents: 14900,
    priceYearlyCents: 149000,
    creditsPerMonth: 5_000,
    apiCallsPerMonth: 5_000,
    features: [
      "5,000 credits/month (platform usage)",
      "BYOK for model costs",
      "5 seats",
      "50 GB storage",
      "All Pro features",
      "Swarm premium included",
      "Up to 10 agents per swarm",
      "24/7 persistent agent",
      "Team collaboration",
      "Admin dashboard",
    ],
    premiumFeatures: [
      "cloud_tools",
      "cicd_tools",
      "large_swarm",
      "persistent_agent",
      "multi_platform_msg",
      "priority_routing",
    ],
    seats: 5,
    includedStorageGb: 50,
    includedComputeMinutes: 1500,
    maxSwarmAgents: 10,
    maxConcurrentAgents: 5,
    maxHeartbeats: 50,
    swarmAddOnCents: 1500,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthlyCents: 0,
    creditsPerMonth: Number.MAX_SAFE_INTEGER,
    apiCallsPerMonth: Number.MAX_SAFE_INTEGER,
    features: [
      "Unlimited credits",
      "BYOK or hosted models",
      "Unlimited seats",
      "100+ GB storage",
      "All features unlocked",
      "Swarm premium included",
      "Up to 100 agents per swarm",
      "Advanced NVIDIA features",
      "Dedicated support",
      "SLA",
      "Custom integrations",
    ],
    premiumFeatures: [
      "cloud_tools",
      "cicd_tools",
      "large_swarm",
      "persistent_agent",
      "nvidia_advanced",
      "multi_platform_msg",
      "priority_routing",
    ],
    seats: Number.MAX_SAFE_INTEGER,
    includedStorageGb: 100,
    includedComputeMinutes: Number.MAX_SAFE_INTEGER,
    maxSwarmAgents: 100,
    maxConcurrentAgents: 20,
    maxHeartbeats: 500,
  },
};

export function getTier(id: TierId): Tier {
  return TIERS[id] ?? TIERS.free;
}

/** Check if a tier has a specific premium feature */
export function hasPremiumFeature(
  tierId: TierId,
  feature: PremiumFeature,
): boolean {
  const tier = getTier(tierId);
  return tier.premiumFeatures.includes(feature);
}

/** Get swarm agent limit for a tier */
export function getSwarmLimit(tierId: TierId): number {
  return getTier(tierId).maxSwarmAgents;
}

/** Get concurrent agent limit for a tier */
export function getConcurrentAgentLimit(tierId: TierId): number {
  return getTier(tierId).maxConcurrentAgents;
}

/** Get heartbeat limit for a tier */
export function getHeartbeatLimit(tierId: TierId): number {
  return getTier(tierId).maxHeartbeats;
}
