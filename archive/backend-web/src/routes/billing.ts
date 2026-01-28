/**
 * Billing routes - subscription status and Stripe checkout.
 */
import express, { Response, Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { getBillingStatus } from '../services/billingService.js'
import { TIERS } from '../config/pricing.js'
import { createCheckoutSession } from '../services/stripeService.js'

const router: Router = express.Router()

/** GET /api/billing/status - current user's billing status */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const tierId = (req.user?.user_metadata?.subscription_tier as 'free' | 'pro' | 'team' | 'enterprise') ?? 'free'
  const status = await getBillingStatus(userId, tierId)
  res.json(status)
})

/** GET /api/billing/plans - list plans (public) */
router.get('/plans', (_req, res: Response) => {
  res.json({
    plans: Object.values(TIERS).map((t) => ({
      id: t.id,
      name: t.name,
      priceMonthlyCents: t.priceMonthlyCents,
      apiCallsPerMonth: t.apiCallsPerMonth,
      features: t.features,
    })),
  })
})

/** POST /api/billing/checkout - create Stripe checkout session */
router.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const email = req.user?.email
  const { priceId, successUrl, cancelUrl } = req.body as { priceId?: string; successUrl?: string; cancelUrl?: string }
  if (!userId || !priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: 'priceId, successUrl, cancelUrl required' })
    return
  }
  const result = await createCheckoutSession({
    userId,
    priceId,
    successUrl,
    cancelUrl,
    customerEmail: email ?? undefined,
    metadata: { userId },
  })
  if (result.error) {
    res.status(502).json({ error: result.error })
    return
  }
  res.json({ url: result.url, sessionId: result.sessionId })
})

export default router
