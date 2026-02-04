/**
 * Unified G-Agent API Routes
 *
 * Single entry point for all G-Agent operations.
 * Replaces the fragmented /api/gagent/*, /api/agents/*, etc. endpoints.
 *
 * @module routes/agent
 */

import { Router, type Request, type Response } from "express";
import { gAgentCore } from "../gAgent/index.js";
import { supervisor } from "../gAgent/supervisor.js";
import { agentRegistry } from "../gAgent/registry.js";
import { messageBus } from "../gAgent/messageBus.js";
import type {
  AgentRequest,
  AgentTier,
  AgentMode,
  AgentStatus,
  AgentType,
} from "../gAgent/types.js";
import type { Channel } from "../gAgent/messageBus.js";
import { apiAuthMiddleware } from "../middleware/authMiddleware.js";
import logger from "../middleware/logger.js";
import {
  validateAgentProcessRequest,
  type ValidatedRequest,
  type AgentProcessRequest,
} from "../gAgent/security.js";

const router = Router();

// ============================================================================
// MAIN PROCESS ENDPOINT
// ============================================================================

/**
 * POST /api/agent/process
 *
 * Main entry point for all G-Agent operations.
 * Automatically routes to the appropriate subsystem based on the request.
 */
router.post(
  "/process",
  apiAuthMiddleware,
  validateAgentProcessRequest,
  async (req: Request, res: Response) => {
    try {
      // Use validated and sanitized body from middleware
      const validatedReq = req as ValidatedRequest<AgentProcessRequest>;
      const {
        message,
        mode,
        sessionId,
        goalId,
        planId,
        workspaceRoot,
        capabilities,
        autonomous,
        priority,
        context,
      } = validatedReq.validatedBody;

      const userId =
        (req as Request & { user?: { id: string } }).user?.id ?? "anonymous";
      const userTier = ((req as Request & { user?: { tier?: string } }).user
        ?.tier ?? "free") as AgentTier;

      const request: AgentRequest = {
        message,
        mode: mode as AgentMode | undefined,
        userId,
        userTier,
        sessionId,
        goalId,
        planId,
        workspaceRoot,
        capabilities,
        autonomous,
        priority,
        context,
      };

      const response = await gAgentCore.process(request);

      return res.json(response);
    } catch (err) {
      logger.error({ error: (err as Error).message }, "G-Agent process failed");
      return res.status(500).json({
        success: false,
        error: { code: "PROCESS_ERROR", message: (err as Error).message },
      });
    }
  },
);

/**
 * POST /api/agent/stream
 *
 * Streaming version of the process endpoint.
 * Returns Server-Sent Events for real-time updates.
 */
router.post(
  "/stream",
  apiAuthMiddleware,
  validateAgentProcessRequest,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Use validated and sanitized body from middleware
      const validatedReq = req as ValidatedRequest<AgentProcessRequest>;
      const {
        message,
        mode,
        sessionId,
        goalId,
        planId,
        workspaceRoot,
        capabilities,
        autonomous,
        priority,
        context,
      } = validatedReq.validatedBody;

      const userId =
        (req as Request & { user?: { id: string } }).user?.id ?? "anonymous";
      const userTier = ((req as Request & { user?: { tier?: string } }).user
        ?.tier ?? "free") as AgentTier;

      const request: AgentRequest = {
        message,
        mode: mode as AgentMode | undefined,
        userId,
        userTier,
        sessionId,
        goalId,
        planId,
        workspaceRoot,
        capabilities,
        autonomous,
        priority,
        context,
      };

      // Setup SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // Process with streaming
      const stream = gAgentCore.processStream(request);

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      logger.error({ error: (err as Error).message }, "G-Agent stream failed");
      res.write(
        `data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`,
      );
      res.end();
    }
  },
);

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * GET /api/agent/session/:sessionId
 *
 * Get session details.
 */
router.get(
  "/session/:sessionId",
  apiAuthMiddleware,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const session = gAgentCore.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
      });
    }

    return res.json({ success: true, session });
  },
);

// ============================================================================
// AGENT MANAGEMENT
// ============================================================================

/**
 * GET /api/agent/registry
 *
 * List all available agent definitions.
 */
router.get("/registry", async (_req: Request, res: Response) => {
  const agents = agentRegistry.getAll();
  return res.json({ success: true, agents });
});

/**
 * GET /api/agent/registry/:agentId
 *
 * Get a specific agent definition.
 */
router.get("/registry/:agentId", async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const agent = agentRegistry.get(agentId);

  if (!agent) {
    return res.status(404).json({
      success: false,
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    });
  }

  return res.json({ success: true, agent });
});

/**
 * GET /api/agent/instances
 *
 * List all running agent instances.
 */
router.get(
  "/instances",
  apiAuthMiddleware,
  async (req: Request, res: Response) => {
    const { status, type, goalId } = req.query;

    const instances = supervisor.getAllInstances({
      status: status ? ((status as string).split(",") as any) : undefined,
      type: type as any,
      goalId: goalId as string,
    });

    return res.json({ success: true, instances });
  },
);

/**
 * GET /api/agent/instances/:instanceId
 *
 * Get a specific agent instance.
 */
router.get(
  "/instances/:instanceId",
  apiAuthMiddleware,
  async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string;
    const instance = supervisor.getInstance(instanceId);

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INSTANCE_NOT_FOUND",
          message: "Agent instance not found",
        },
      });
    }

    return res.json({ success: true, instance });
  },
);

/**
 * POST /api/agent/instances/:instanceId/cancel
 *
 * Cancel a running agent instance.
 */
router.post(
  "/instances/:instanceId/cancel",
  apiAuthMiddleware,
  async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string;
    const cancelled = supervisor.cancel(instanceId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CANCEL_FAILED",
          message: "Failed to cancel agent instance",
        },
      });
    }

    return res.json({ success: true, message: "Agent instance cancelled" });
  },
);

// ============================================================================
// STATUS & HEALTH
// ============================================================================

/**
 * GET /api/agent/status
 *
 * Get overall G-Agent system status.
 */
router.get("/status", async (_req: Request, res: Response) => {
  const status = gAgentCore.getStatus();
  return res.json({ success: true, ...status });
});

/**
 * GET /api/agent/health
 *
 * Health check for the G-Agent system.
 */
router.get("/health", async (_req: Request, res: Response) => {
  const stats = supervisor.getStats();
  const staleAgents = supervisor.checkHealth();

  return res.json({
    success: true,
    healthy: staleAgents.length === 0,
    stats,
    staleAgents: staleAgents.map((a) => ({
      id: a.id,
      type: a.type,
      lastHeartbeat: a.lastHeartbeat,
    })),
  });
});

/**
 * GET /api/agent/concurrency
 *
 * Get agent concurrency status.
 */
router.get("/concurrency", async (_req: Request, res: Response) => {
  const concurrency = supervisor.getConcurrencyStatus();
  return res.json({ success: true, concurrency });
});

// ============================================================================
// MESSAGE BUS (for debugging/monitoring)
// ============================================================================

/**
 * GET /api/agent/bus/history
 *
 * Get message bus history (for debugging).
 */
router.get(
  "/bus/history",
  apiAuthMiddleware,
  async (req: Request, res: Response) => {
    const { channel, limit, since } = req.query;

    const history = messageBus.getHistory({
      channel: channel as any,
      limit: limit ? parseInt(limit as string, 10) : 100,
      since: since as string,
    });

    return res.json({ success: true, history });
  },
);

/**
 * GET /api/agent/bus/subscriptions
 *
 * Get message bus subscription count.
 */
router.get(
  "/bus/subscriptions",
  apiAuthMiddleware,
  async (_req: Request, res: Response) => {
    const count = messageBus.getSubscriptionCount();
    return res.json({ success: true, subscriptionCount: count });
  },
);

export default router;
