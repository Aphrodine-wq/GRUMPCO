/**
 * Approvals API Routes
 * Human-in-the-loop approval requests for risky actions
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  assessRiskLevel,
} from "../services/approvalService.js";
import logger from "../middleware/logger.js";

const router = Router();

// Validation schemas
const createApprovalSchema = z.object({
  action: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  reason: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const resolveApprovalSchema = z.object({
  reason: z.string().optional(),
});

// ========== Approval CRUD ==========

/**
 * GET /approvals
 * List pending approvals for the current user
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const approvals = await getPendingApprovals(userId);

    const parsed = approvals.map((apr) => ({
      ...apr,
      payload: apr.payload ? JSON.parse(apr.payload) : null,
    }));

    res.json({ approvals: parsed });
  } catch (err) {
    logger.error({ error: (err as Error).message }, "Failed to list approvals");
    res.status(500).json({ error: "Failed to list approvals" });
  }
});

/**
 * GET /approvals/:id
 * Get a specific approval request
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const approval = await getApprovalRequest(id);

    if (!approval) {
      res.status(404).json({ error: "Approval request not found" });
      return;
    }

    res.json({
      ...approval,
      payload: approval.payload ? JSON.parse(approval.payload) : null,
    });
  } catch (err) {
    logger.error({ error: (err as Error).message }, "Failed to get approval");
    res.status(500).json({ error: "Failed to get approval" });
  }
});

/**
 * POST /approvals
 * Create a new approval request
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const data = createApprovalSchema.parse(req.body);

    // Auto-assess risk level if not provided
    const riskLevel =
      data.riskLevel ?? assessRiskLevel(data.action, data.payload);

    const approval = await createApprovalRequest({
      userId,
      action: data.action,
      riskLevel,
      reason: data.reason,
      payload: data.payload,
      expiresAt: data.expiresAt,
    });

    res.status(201).json({
      ...approval,
      payload: approval.payload ? JSON.parse(approval.payload) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    logger.error(
      { error: (err as Error).message },
      "Failed to create approval",
    );
    res.status(500).json({ error: "Failed to create approval" });
  }
});

/**
 * POST /approvals/:id/approve
 * Approve a request
 */
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const { id } = req.params as { id: string };

    const approval = await approveRequest(id, userId);

    if (!approval) {
      res.status(404).json({ error: "Approval request not found" });
      return;
    }

    res.json({
      ...approval,
      payload: approval.payload ? JSON.parse(approval.payload) : null,
    });
  } catch (err) {
    logger.error(
      { error: (err as Error).message },
      "Failed to approve request",
    );
    res.status(500).json({ error: "Failed to approve request" });
  }
});

/**
 * POST /approvals/:id/reject
 * Reject a request
 */
router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const { reason } = resolveApprovalSchema.parse(req.body);
    const { id } = req.params as { id: string };

    const approval = await rejectRequest(id, userId, reason);

    if (!approval) {
      res.status(404).json({ error: "Approval request not found" });
      return;
    }

    res.json({
      ...approval,
      payload: approval.payload ? JSON.parse(approval.payload) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, "Failed to reject request");
    res.status(500).json({ error: "Failed to reject request" });
  }
});

/**
 * GET /approvals/count
 * Get count of pending approvals (for notifications)
 */
router.get("/count/pending", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const approvals = await getPendingApprovals(userId);

    res.json({
      count: approvals.length,
      highRisk: approvals.filter((a) => a.risk_level === "high").length,
      mediumRisk: approvals.filter((a) => a.risk_level === "medium").length,
      lowRisk: approvals.filter((a) => a.risk_level === "low").length,
    });
  } catch (err) {
    logger.error(
      { error: (err as Error).message },
      "Failed to count approvals",
    );
    res.status(500).json({ error: "Failed to count approvals" });
  }
});

export default router;
