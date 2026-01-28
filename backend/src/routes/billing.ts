/**
 * Billing / pricing routes for desktop and parity with backend-web.
 * GET /api/billing/tiers – tier definitions
 * GET /api/billing/me – current user tier/usage (user from auth when available)
 */

import { Router, Request, Response } from 'express';
import { TIERS, getTier } from '../config/pricing.js';
import { getTierForUser } from '../services/featureFlagsService.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/billing/tiers
 * Returns tier definitions for pricing display in settings.
 */
router.get('/tiers', (_req: Request, res: Response) => {
  res.json({ tiers: Object.values(TIERS) });
});

/**
 * GET /api/billing/me
 * Returns current user tier and usage. Uses optionalAuth (via /api); when no user, returns null.
 * Desktop can show "Sign in to see usage" when tier/usage are null.
 */
router.get('/me', (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user?.id) {
    res.json({
      tier: null as string | null,
      usage: null as number | null,
      limit: null as number | null,
      message: 'Sign in to see usage and manage billing.',
    });
    return;
  }
  const tier = getTierForUser(authReq.user.id);
  const tierDef = getTier(tier);
  res.json({
    tier,
    usage: null as number | null,
    limit: tierDef.apiCallsPerMonth,
    message: null as string | null,
  });
});

export default router;
