/**
 * Billing API – subscription, usage, payment methods, invoices.
 * Used by Settings Billing tab. Wire Stripe (or provider) for production.
 */

import { Router, type Request, type Response } from 'express';
import { TIERS, OVERAGE_RATES, type TierId } from '../config/pricing.js';
import { getMonthlyCallCount } from '../services/usageTracker.js';
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
    const tierId = (process.env.TIER_DEFAULT as TierId) || 'free';
    const tier = TIERS[tierId] ?? TIERS.free;
    let usage = 0;
    try {
      usage = await getMonthlyCallCount(userId);
    } catch (e) {
      logger.debug({ err: e }, 'Usage tracker not available for billing/me');
    }
    res.json({
      tier: tier.name,
      usage,
      limit: tier.creditsPerMonth ?? tier.apiCallsPerMonth ?? null,
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

export default router;
