/**
 * Shared types for settings tab sub-components.
 * Extracted from TabbedSettingsScreen.svelte as part of Phase 2 decomposition.
 */

export interface Tier {
  id: string;
  name: string;
  priceMonthlyCents: number;
  priceYearlyCents?: number;
  apiCallsPerMonth: number;
  seats?: number;
  includedStorageGb?: number;
  includedComputeMinutes?: number;
  features: string[];
}

export interface BillingMe {
  tier: string | null;
  usage: number | null;
  limit: number | null;
  computeMinutesUsed?: number;
  computeMinutesLimit?: number;
  storageGbUsed?: number;
  storageGbLimit?: number;
  overageRates?: {
    storageGbMonthlyCents: number;
    computeMinuteCents: number;
    extraConcurrentAgentMonthlyCents: number;
  };
  message?: string;
}

export interface PaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
}

export function formatCredits(u: number | null | undefined): string {
  const n = u ?? 0;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, '');
}
