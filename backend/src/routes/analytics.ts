/**
 * Analytics routes – usage and project metrics for the dashboard.
 */

import { type Response, Router } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import {
  getUsageForUser,
  getMonthlyCallCount,
} from "../services/usageTracker.js";

const router = Router();

router.get(
  "/usage",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const calls = await getUsageForUser(userId, startOfMonth, now);
    res.json({
      tier: "unlimited",
      callsThisMonth: calls.length,
      recentCalls: calls.slice(-20).map((c) => ({
        endpoint: c.endpoint,
        method: c.method,
        success: c.success,
        latencyMs: c.latencyMs,
        createdAt: c.createdAt,
      })),
    });
  },
);

router.get(
  "/summary",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({
      apiCallsThisMonth: await getMonthlyCallCount(userId),
      limit: -1, // unlimited
      remaining: -1, // unlimited
      tier: "unlimited",
    });
  },
);

export default router;
