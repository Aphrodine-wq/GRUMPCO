/**
 * API Key Manager - provides keys to Claude service with pooling and quotas.
 * Uses keyVault for storage; enforces per-user quotas based on subscription tier.
 */
import { getKey, hasKeys } from './keyVault.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise'

const DEFAULT_QUOTAS: Record<SubscriptionTier, number> = {
  free: 50,
  pro: 1_000,
  team: 5_000,
  enterprise: Number.MAX_SAFE_INTEGER,
}

/** In-memory usage this month per userId (reset via cron or on first request of new month). */
const usageThisMonth = new Map<string, number>()

function getMonthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

let currentMonth = getMonthKey()

function getUsageKey(userId: string): string {
  const month = getMonthKey()
  if (month !== currentMonth) {
    currentMonth = month
    usageThisMonth.clear()
  }
  return `${month}:${userId}`
}

/**
 * Get a valid API key for Claude calls. Returns null if none configured.
 */
export function acquireKey(): string | null {
  if (!hasKeys()) {
    logger.warn('No API keys available')
    return null
  }
  return getKey()
}

/**
 * Check if user is within their monthly API call quota.
 */
export function checkQuota(userId: string, tier: SubscriptionTier): { allowed: boolean; remaining: number } {
  const limit = DEFAULT_QUOTAS[tier] ?? DEFAULT_QUOTAS.free
  const key = getUsageKey(userId)
  const used = usageThisMonth.get(key) ?? 0
  const remaining = Math.max(0, limit - used)
  return { allowed: used < limit, remaining }
}

/**
 * Record one API call for quota accounting. Call after successful request.
 */
export function recordUsage(userId: string): void {
  const key = getUsageKey(userId)
  const prev = usageThisMonth.get(key) ?? 0
  usageThisMonth.set(key, prev + 1)
}

/**
 * Get quota config for a tier (for API responses).
 */
export function getQuotaForTier(tier: SubscriptionTier): number {
  return DEFAULT_QUOTAS[tier] ?? DEFAULT_QUOTAS.free
}
