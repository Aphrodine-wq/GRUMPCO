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
} from "../services/platform/usageTracker.js";

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

/**
 * POST /events
 * Receives analytics events from the frontend.
 * Fire-and-forget – always returns 200 so analytics never breaks the UI.
 */
router.post("/events", (req, res) => {
  // In a production setup you'd persist these; for now just acknowledge.
  if (process.env.NODE_ENV !== "production") {
    const event = req.body;
    if (event?.name) {
      // Optional: log in dev for debugging
      // console.debug('[Analytics Event]', event.name, event.properties);
    }
  }
  res.status(200).json({ ok: true });
});

export default router;
