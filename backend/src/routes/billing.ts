/**
 * Billing API – subscription, usage, payment methods, invoices.
 * Used by Settings Billing tab. Wire Stripe (or provider) for production.
 */

import { Router, type Request, type Response } from 'express';
import { TIERS, OVERAGE_RATES, type TierId } from '../config/pricing.js';
import {
  getMonthlyCallCount,
  getMonthlyCostForUser,
  getUsageByOperation,
} from '../services/platform/usageTracker.js';
import { getCreditUsageSummary } from '../services/platform/creditService.js';
import logger from '../middleware/logger.js';

const router = Router();
const DEFAULT_USER = 'default';

/**
 * GET /api/billing/me
 * Current user's billing: tier, usage, limits. Frontend expects BillingMe shape.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER;
    let summary: Awaited<ReturnType<typeof getCreditUsageSummary>> | null = null;
    let usageCalls = 0;
    try {
      summary = await getCreditUsageSummary(userId);
      usageCalls = await getMonthlyCallCount(userId);
    } catch (e) {
      logger.debug({ err: e }, 'Usage tracker not available for billing/me');
    }
    const tierId = (process.env.TIER_DEFAULT as TierId) || summary?.tier || 'free';
    const tier = TIERS[tierId] ?? TIERS.free;
    const costUsedUsd = summary?.costUsedUsd ?? 0;
    const costLimitUsd =
      summary?.costLimitUsd ?? tier.monthlyBudgetUsd ?? tier.creditsPerMonth ?? null;
    res.json({
      tier: tier.name,
      usage: costUsedUsd,
      usageCalls,
      tokenCredits: costUsedUsd,
      limit: costLimitUsd,
      costUsedUsd,
      costLimitUsd: costLimitUsd != null ? costLimitUsd : null,
      computeMinutesUsed: 0,
      computeMinutesLimit: tier.includedComputeMinutes ?? null,
      storageGbUsed: 0,
      storageGbLimit: tier.includedStorageGb ?? null,
      overageRates: OVERAGE_RATES,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/me'
    );
    res.status(500).json({
      tier: null,
      usage: null,
      limit: null,
      message: 'Failed to load billing',
    });
  }
});

/**
 * GET /api/billing/usage
 * Usage breakdown by operation type (chat, architecture, ship, etc.)
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER;
    const byOperation = await getUsageByOperation(userId);
    res.json({ byOperation });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/usage'
    );
    res.status(500).json({ byOperation: {} });
  }
});

/**
 * GET /api/billing/tiers
 * Available plans. Frontend expects { tiers: Tier[] }.
 */
router.get('/tiers', (_req: Request, res: Response) => {
  try {
    const tiers = Object.values(TIERS);
    res.json({ tiers });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/tiers'
    );
    res.status(500).json({ tiers: [] });
  }
});

/**
 * GET /api/billing/subscription
 * Current subscription (plan, status, renewal). Stub until Stripe wired.
 */
router.get('/subscription', (_req: Request, res: Response) => {
  try {
    const tierId = (process.env.TIER_DEFAULT as TierId) || 'free';
    const tier = TIERS[tierId] ?? TIERS.free;
    res.json({
      plan: tier.id,
      planName: tier.name,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/subscription'
    );
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

/**
 * GET /api/billing/payment-methods
 * Saved payment methods. Stub until Stripe wired.
 */
router.get('/payment-methods', (_req: Request, res: Response) => {
  try {
    res.json({ paymentMethods: [] });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/payment-methods'
    );
    res.status(500).json({ paymentMethods: [] });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add or update payment method. Stub until Stripe wired.
 */
router.post('/payment-methods', (req: Request, res: Response) => {
  try {
    // When Stripe is wired: create SetupIntent or attach payment method to customer
    res.status(201).json({ success: true, message: 'Payment method support coming soon' });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to add billing/payment-method'
    );
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

/**
 * GET /api/billing/invoices
 * List invoices. Stub until Stripe wired.
 */
router.get('/invoices', (_req: Request, res: Response) => {
  try {
    res.json({ invoices: [] });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get billing/invoices'
    );
    res.status(500).json({ invoices: [] });
  }
});

/**
 * POST /api/billing/portal-session
 * Create Stripe Customer Portal session. Returns { url } to redirect user.
 * Requires STRIPE_SECRET_KEY and customer ID (from auth/user_metadata).
 * Most secure: no card data in-app; Stripe handles everything on their domain.
 */
router.post('/portal-session', async (req: Request, res: Response) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_')) {
      res.status(501).json({
        error: 'Billing portal not configured. Set STRIPE_SECRET_KEY.',
      });
      return;
    }

    const customerId =
      (
        req as Request & {
          user?: { user_metadata?: { stripe_customer_id?: string } };
        }
      ).user?.user_metadata?.stripe_customer_id ??
      (req.body as { customerId?: string })?.customerId;

    if (!customerId) {
      res.status(400).json({
        error: 'No billing account found. Subscribe first to manage your subscription.',
      });
      return;
    }

    const returnUrl =
      (req.body as { returnUrl?: string })?.returnUrl ??
      process.env.FRONTEND_URL ??
      process.env.PUBLIC_BASE_URL ??
      'http://localhost:5173';

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secretKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      res.status(500).json({ error: 'Stripe did not return a portal URL' });
      return;
    }

    res.json({ url: session.url });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to create billing portal session'
    );
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to open billing portal',
    });
  }
});

export default router;
