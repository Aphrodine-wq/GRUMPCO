/**
 * Usage tracking middleware - records requests to API calls and enforces quotas.
 * Attach after auth; requires AuthenticatedRequest with user.id.
 */
import type { Response, NextFunction } from 'express'
import { recordApiCall } from '../services/usageTracker.js'
import { checkQuota, recordUsage, type SubscriptionTier } from '../services/apiKeyManager.js'
import type { AuthenticatedRequest } from './auth.js'

const DEFAULT_TIER: SubscriptionTier = 'free'

/**
 * Middleware that records the request as usage and enforces quota.
 * Use only on routes that consume API (e.g. chat, codegen).
 */
export function usageTracking(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id
  if (!userId) {
    next()
    return
  }
  const tier = (req.user?.user_metadata?.subscription_tier as SubscriptionTier) ?? DEFAULT_TIER
  const { allowed, remaining } = checkQuota(userId, tier)
  if (!allowed) {
    res.status(429).json({
      error: 'Monthly API quota exceeded',
      type: 'quota_exceeded',
      remaining: 0,
    })
    return
  }
  res.setHeader('X-Usage-Remaining', String(remaining))

  const start = Date.now()
  res.on('finish', () => {
    const latencyMs = Date.now() - start
    recordApiCall({
      userId,
      endpoint: req.path,
      method: req.method,
      success: res.statusCode < 400,
      latencyMs,
    })
    if (res.statusCode < 400) {
      recordUsage(userId)
    }
  })
  next()
}
