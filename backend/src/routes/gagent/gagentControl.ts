/**
 * G-Agent Control Sub-Router
 *
 * Kill switch / emergency stop for goals, agents, and global operations.
 *
 * @module routes/gagent/gagentControl
 */

import { Router, type Request, type Response } from "express";
import {
    killSwitch,
    STOP_REASONS,
    type StopReason,
} from "../../gAgent/index.js";
import logger from "../../middleware/logger.js";

const router = Router();

/** POST /control/stop — Emergency stop ALL operations */
router.post("/control/stop", async (req: Request, res: Response) => {
    try {
        const userId = (req as Request & { userId?: string }).userId || "user";
        const { reason } = req.body;

        const stopReason: StopReason = reason || STOP_REASONS.USER_REQUESTED;
        const result = await killSwitch.emergencyStopAll(stopReason, userId);

        logger.warn(
            { userId, reason: stopReason },
            "Emergency stop triggered via API",
        );

        return res.json({ result });
    } catch (e) {
        logger.error(
            { error: (e as Error).message },
            "Failed to execute emergency stop",
        );
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /control/stop/goal/:id — Stop a specific goal */
router.post("/control/stop/goal/:id", async (req: Request, res: Response) => {
    try {
        const goalId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const userId = (req as Request & { userId?: string }).userId || "user";
        const { reason } = req.body;

        const stopReason: StopReason = reason || STOP_REASONS.USER_REQUESTED;
        const result = await killSwitch.stopGoal(goalId, stopReason, userId);

        logger.info({ goalId, reason: stopReason }, "Goal stopped via API");

        return res.json({ result });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Failed to stop goal");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /control/stop/agent/:id — Stop a specific agent */
router.post("/control/stop/agent/:id", async (req: Request, res: Response) => {
    try {
        const agentId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const userId = (req as Request & { userId?: string }).userId || "user";
        const { reason } = req.body;

        const stopReason: StopReason = reason || STOP_REASONS.USER_REQUESTED;
        const result = await killSwitch.stopAgent(agentId, stopReason, userId);

        logger.info({ agentId, reason: stopReason }, "Agent stopped via API");

        return res.json({ result });
    } catch (e) {
        logger.error({ error: (e as Error).message }, "Failed to stop agent");
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** POST /control/resume — Resume operations after a stop */
router.post("/control/resume", async (req: Request, res: Response) => {
    try {
        const userId = (req as Request & { userId?: string }).userId || "user";

        killSwitch.resumeAll(userId);

        logger.info({ userId }, "Operations resumed via API");

        return res.json({
            success: true,
            message: "Operations resumed",
            globalStopActive: killSwitch.isGlobalStopActive(),
        });
    } catch (e) {
        logger.error(
            { error: (e as Error).message },
            "Failed to resume operations",
        );
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** GET /control/status — Get kill switch status */
router.get("/control/status", async (_req: Request, res: Response) => {
    try {
        const globalStopInfo = killSwitch.getGlobalStopInfo();
        const auditLog = killSwitch.getAuditLog({ limit: 10 });

        return res.json({
            globalStop: globalStopInfo,
            recentEvents: auditLog,
            canOperate: !globalStopInfo.active,
        });
    } catch (e) {
        logger.error(
            { error: (e as Error).message },
            "Failed to get control status",
        );
        return res.status(500).json({ error: (e as Error).message });
    }
});

export default router;
