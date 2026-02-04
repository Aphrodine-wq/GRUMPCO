/**
 * G-Agent API Routes
 *
 * Comprehensive API for the G-Agent system including:
 * - Goal queue management (CRUD, recurring, follow-ups)
 * - Budget management (cost tracking, limits, prophecy)
 * - Kill switch (emergency stop, per-goal/agent stops)
 * - Power expansion (confidence analysis, decomposition)
 * - Configuration management
 * - Real-time event streaming (SSE)
 *
 * @module routes/gagent
 */

import { Router, type Request, type Response } from "express";
import {
  gAgentGoalQueue,
  type GoalStatus,
} from "../services/gAgentGoalQueue.js";
import { goalRepository } from "../gAgent/goalRepository.js";
import logger from "../middleware/logger.js";
import {
  validateGoalCreateRequest,
  validateRecurringGoalRequest,
  validateFollowUpGoalRequest,
  type ValidatedRequest,
  type GoalCreateRequest,
  type RecurringGoalRequest,
  type FollowUpGoalRequest,
} from "../gAgent/security.js";

// Import G-Agent modules for Phase 5 capabilities
import {
  // Budget Manager
  budgetManager,
  type BudgetConfig,

  // Kill Switch
  killSwitch,
  STOP_REASONS,
  type StopReason,

  // Power Expansion
  ConfidenceRouter,
  TaskDecomposer,
  SelfHealingEngine,
  StrategySelector,

  // Configuration
  configManager,
  FEATURES,
  CONFIG_PRESETS,
  type Feature,
  type ConfigPreset,

  // Message bus for SSE
  messageBus,
  CHANNELS,

  // Semantic Compiler (100x Solution)
  getSemanticCompiler,
  destroySemanticCompiler,
  type CompilationRequest,

  // Semantic Deduplication
  getSemanticDedup,
  type PatternType,
} from "../gAgent/index.js";

const router = Router();

// ============================================================================
// GOAL CRUD
// ============================================================================

/**
 * POST /api/gagent/goals
 * Create a new goal
 */
router.post(
  "/goals",
  validateGoalCreateRequest,
  async (req: Request, res: Response) => {
    try {
      // Use validated and sanitized body from middleware
      const validatedReq = req as ValidatedRequest<GoalCreateRequest>;
      const {
        description,
        priority,
        triggerType,
        scheduledAt,
        cronExpression,
        workspaceRoot,
        tags,
        maxRetries,
      } = validatedReq.validatedBody;

      // Get userId from auth or default
      const userId = (req as Request & { userId?: string }).userId || "default";

      const goal = await gAgentGoalQueue.createGoal({
        userId,
        description,
        priority: priority ?? "normal",
        triggerType,
        scheduledAt,
        cronExpression,
        workspaceRoot,
        tags,
        maxRetries,
      });

      return res.status(201).json({ goal });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Failed to create goal");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/goals
 * List all goals for the user
 * Query: status (comma-separated), limit
 */
router.get("/goals", async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query as { status?: string; limit?: string };
    const userId = (req as Request & { userId?: string }).userId || "default";

    const statusFilter = status
      ? (status.split(",") as GoalStatus[])
      : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    const goals = await gAgentGoalQueue.getUserGoals(userId, {
      status: statusFilter,
      limit: limitNum,
    });

    return res.json({ goals });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to list goals");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/history
 * Generation history / audit log: who, when, what was requested, which artifacts.
 * Returns recent completed goals (description, result, artifacts count, completedAt).
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    const { limit } = req.query as { limit?: string };
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;

    const goals = await goalRepository.list({
      status: ["completed"],
      userId: userId,
      orderBy: "createdAt",
      orderDir: "desc",
      limit: limitNum,
    });

    const history = goals.map((g) => ({
      id: g.id,
      userId: g.userId,
      description: g.description?.slice(0, 500),
      result: g.result?.slice(0, 1000),
      artifactsCount: g.artifacts?.length ?? 0,
      completedAt: g.completedAt,
      createdAt: g.createdAt,
    }));

    return res.json({ history });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get generation history",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/goals/:id
 * Get a specific goal
 */
router.get("/goals/:id", async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.getGoal(goalId);

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get goal");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/goals/:id/cancel
 * Cancel a goal
 */
router.post("/goals/:id/cancel", async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.cancelGoal(goalId);

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to cancel goal");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/goals/:id/retry
 * Retry a failed goal
 */
router.post("/goals/:id/retry", async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.retryGoal(goalId);

    if (!goal) {
      return res
        .status(404)
        .json({ error: "Goal not found or not in failed state" });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to retry goal");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// RECURRING GOALS
// ============================================================================

/**
 * POST /api/gagent/recurring
 * Create a recurring goal
 */
router.post(
  "/recurring",
  validateRecurringGoalRequest,
  async (req: Request, res: Response) => {
    try {
      // Use validated and sanitized body from middleware
      const validatedReq = req as ValidatedRequest<RecurringGoalRequest>;
      const { description, cronExpression, workspaceRoot, priority, tags } =
        validatedReq.validatedBody;

      const userId = (req as Request & { userId?: string }).userId || "default";

      const goal = await gAgentGoalQueue.scheduleRecurringGoal(
        userId,
        description,
        cronExpression,
        {
          workspaceRoot,
          priority,
          tags,
        },
      );

      return res.status(201).json({ goal });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to create recurring goal",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * POST /api/gagent/queue/start
 * Start the goal queue processor
 */
router.post("/queue/start", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    gAgentGoalQueue.startGoalQueue(userId);
    return res.json({ started: true, userId });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to start queue");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/queue/stop
 * Stop the goal queue processor
 */
router.post("/queue/stop", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    gAgentGoalQueue.stopGoalQueue(userId);
    return res.json({ stopped: true, userId });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to stop queue");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/queue/stats
 * Get queue statistics
 */
router.get("/queue/stats", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const stats = gAgentGoalQueue.getQueueStats(userId);
    return res.json(stats);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get queue stats");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// SELF-SCHEDULING (for agent to create follow-up goals)
// ============================================================================

/**
 * POST /api/gagent/follow-up
 * Create a follow-up goal (typically called by the agent itself)
 */
router.post(
  "/follow-up",
  validateFollowUpGoalRequest,
  async (req: Request, res: Response) => {
    try {
      // Use validated and sanitized body from middleware
      const validatedReq = req as ValidatedRequest<FollowUpGoalRequest>;
      const { parentGoalId, description, scheduledAt, priority, tags } =
        validatedReq.validatedBody;

      const goal = await gAgentGoalQueue.createFollowUpGoal(
        parentGoalId,
        description,
        {
          scheduledAt,
          priority,
          tags,
        },
      );

      if (!goal) {
        return res.status(404).json({ error: "Parent goal not found" });
      }

      return res.status(201).json({ goal });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to create follow-up goal",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

// ============================================================================
// BUDGET MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/gagent/budget/status
 * Get current budget status for the session
 */
router.get("/budget/status", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";

    const tracker = budgetManager.getTracker(sessionId);
    const status = tracker ? budgetManager.getBudgetStatus(sessionId) : null;

    // Format message based on status
    let message = "No active session";
    if (status) {
      if (status.status === "ok") {
        message = `Budget OK - ${Math.round(status.sessionPercent * 100)}% used`;
      } else if (status.status === "warning") {
        message = status.message || "Budget warning";
      } else if (status.status === "critical") {
        message = status.message || "Budget critical";
      } else if (status.status === "exceeded") {
        message = status.message || "Budget exceeded";
      }
    }

    return res.json({
      tracker: tracker || null,
      status,
      message,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get budget status",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/budget/config
 * Update budget configuration for the user
 */
router.post("/budget/config", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const config: Partial<BudgetConfig> = req.body;

    // Validate limits are positive
    if (config.sessionLimit !== undefined && config.sessionLimit < 0) {
      return res.status(400).json({ error: "Session limit must be positive" });
    }
    if (config.dailyLimit !== undefined && config.dailyLimit < 0) {
      return res.status(400).json({ error: "Daily limit must be positive" });
    }
    if (config.monthlyLimit !== undefined && config.monthlyLimit < 0) {
      return res.status(400).json({ error: "Monthly limit must be positive" });
    }

    const updatedConfig = budgetManager.setConfig(userId, config);

    return res.json({ config: updatedConfig });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to update budget config",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/budget/estimate
 * Estimate cost for planned operations (Cost Prophecy)
 */
router.post("/budget/estimate", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const operations = req.body.operations || [];

    const estimate = budgetManager.estimateCost(operations, sessionId);

    return res.json({
      estimate,
      formatted: `Estimated cost: $${(estimate.estimatedCost / 100).toFixed(2)}`,
      requiresApproval: estimate.requiresApproval,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to estimate cost");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/budget/session/start
 * Start cost tracking for a session
 */
router.post("/budget/session/start", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = (req as Request & { userId?: string }).userId || "default";

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const tracker = budgetManager.startSession(sessionId, userId);

    return res.status(201).json({ tracker });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to start budget session",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/budget/session/end
 * End cost tracking for a session
 */
router.post("/budget/session/end", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const tracker = budgetManager.endSession(sessionId);

    if (!tracker) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({ tracker });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to end budget session",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/budget/check
 * Check if an operation can proceed based on budget
 */
router.post("/budget/check", async (req: Request, res: Response) => {
  try {
    const { sessionId, estimatedCost } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const result = budgetManager.canProceed(sessionId, estimatedCost || 0);

    return res.json(result);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to check budget");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// KILL SWITCH / CONTROL ROUTES
// ============================================================================

/**
 * POST /api/gagent/control/stop
 * Emergency stop ALL operations
 */
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

/**
 * POST /api/gagent/control/stop/goal/:id
 * Stop a specific goal
 */
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

/**
 * POST /api/gagent/control/stop/agent/:id
 * Stop a specific agent
 */
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

/**
 * POST /api/gagent/control/resume
 * Resume operations after a stop
 */
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

/**
 * GET /api/gagent/control/status
 * Get kill switch status
 */
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

// ============================================================================
// POWER EXPANSION / ANALYSIS ROUTES
// ============================================================================

// Singleton instances for analysis
const confidenceRouter = new ConfidenceRouter();
const taskDecomposer = new TaskDecomposer();
const selfHealingEngine = new SelfHealingEngine();
const strategySelector = new StrategySelector();

/**
 * POST /api/gagent/analyze/confidence
 * Analyze confidence for an operation
 */
router.post("/analyze/confidence", async (req: Request, res: Response) => {
  try {
    const {
      taskDescription,
      previousSuccess,
      similarPatternFound,
      estimatedCost,
      riskFactors,
      contextQuality,
      historyAvailable,
    } = req.body;

    if (!taskDescription) {
      return res.status(400).json({ error: "taskDescription is required" });
    }

    const analysis = confidenceRouter.analyze({
      taskDescription,
      previousSuccess: previousSuccess ?? false,
      similarPatternFound: similarPatternFound ?? false,
      estimatedCost: estimatedCost ?? 10,
      riskFactors: riskFactors ?? [],
      contextQuality: contextQuality ?? 0.7,
      historyAvailable: historyAvailable ?? false,
    });

    return res.json({ analysis });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to analyze confidence",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/analyze/decompose
 * Decompose a complex task into subtasks
 */
router.post("/analyze/decompose", async (req: Request, res: Response) => {
  try {
    const { taskDescription, context } = req.body;

    if (!taskDescription) {
      return res.status(400).json({ error: "taskDescription is required" });
    }

    const decomposition = taskDecomposer.decompose(taskDescription, context);

    // Convert Map to object for JSON serialization
    const result = {
      ...decomposition,
      dependencies: Object.fromEntries(decomposition.dependencies),
    };

    return res.json({ decomposition: result });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to decompose task");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/analyze/strategy
 * Get recommended strategy for a task
 */
router.post("/analyze/strategy", async (req: Request, res: Response) => {
  try {
    const {
      taskDescription,
      complexity,
      estimatedCost,
      riskLevel,
      hasPattern,
      timeConstraint,
      userPreference,
    } = req.body;

    if (!taskDescription) {
      return res.status(400).json({ error: "taskDescription is required" });
    }

    // Calculate complexity if not provided
    const taskComplexity =
      complexity ?? taskDecomposer.analyzeComplexity(taskDescription);

    const selection = strategySelector.select({
      taskDescription,
      complexity: taskComplexity,
      estimatedCost: estimatedCost ?? 10,
      riskLevel: riskLevel ?? "low",
      hasPattern: hasPattern ?? false,
      timeConstraint,
      userPreference,
    });

    return res.json({ selection });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to select strategy");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/analyze/healing/start
 * Start a self-healing session for a failed task
 */
router.post("/analyze/healing/start", async (req: Request, res: Response) => {
  try {
    const { taskId, goalId, error, originalRequest } = req.body;

    if (!taskId || !error || !originalRequest) {
      return res.status(400).json({
        error: "taskId, error, and originalRequest are required",
      });
    }

    const context = selfHealingEngine.startHealing(
      taskId,
      originalRequest,
      error,
      goalId,
    );

    return res.json({ context });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to start healing");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/analyze/healing/:taskId
 * Get healing context for a task
 */
router.get("/analyze/healing/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = Array.isArray(req.params.taskId)
      ? req.params.taskId[0]
      : req.params.taskId;
    const context = selfHealingEngine.getContext(taskId);

    if (!context) {
      return res.status(404).json({ error: "Healing context not found" });
    }

    return res.json({ context });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get healing context",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/analyze/complexity
 * Analyze task complexity
 */
router.post("/analyze/complexity", async (req: Request, res: Response) => {
  try {
    const { taskDescription } = req.body;

    if (!taskDescription) {
      return res.status(400).json({ error: "taskDescription is required" });
    }

    const complexity = taskDecomposer.analyzeComplexity(taskDescription);

    return res.json({
      complexity,
      level:
        complexity < 0.3 ? "simple" : complexity < 0.6 ? "moderate" : "complex",
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to analyze complexity",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/gagent/config
 * Get current G-Agent configuration
 */
router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();

    return res.json({ config });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get config");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * PUT /api/gagent/config/budget
 * Update budget configuration
 */
router.put("/config/budget", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const updates: Partial<BudgetConfig> = req.body;

    configManager.updateBudget(updates, userId);
    const config = configManager.getConfig();

    logger.info({ userId }, "Budget config updated via API");

    return res.json({ config: config.budget });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to update budget config",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * PUT /api/gagent/config/autonomy
 * Update autonomy level
 */
router.put("/config/autonomy", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const { level } = req.body;

    const validLevels = [
      "supervised",
      "semi-autonomous",
      "autonomous",
      "fully-autonomous",
    ];
    if (!level || !validLevels.includes(level)) {
      return res.status(400).json({
        error: "Invalid autonomy level. Available: " + validLevels.join(", "),
      });
    }

    configManager.setAutonomyLevel(level, userId);
    const config = configManager.getConfig();

    logger.info({ userId, level }, "Autonomy level updated via API");

    return res.json({
      autonomyLevel: config.autonomyLevel,
      autonomyConfig: config.autonomyConfig,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to update autonomy level",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/config/preset
 * Apply a configuration preset
 */
router.post("/config/preset", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const { preset } = req.body;

    const validPresets = Object.keys(CONFIG_PRESETS);
    if (!preset || !validPresets.includes(preset)) {
      return res.status(400).json({
        error: "Invalid preset. Available: " + validPresets.join(", "),
      });
    }

    configManager.applyPreset(preset as ConfigPreset, userId);
    const config = configManager.getConfig();

    logger.info({ userId, preset }, "Config preset applied via API");

    return res.json({ config, preset });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to apply preset");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/config/presets
 * Get available configuration presets
 */
router.get("/config/presets", async (_req: Request, res: Response) => {
  try {
    const presets = Object.entries(CONFIG_PRESETS).map(([key, value]) => ({
      id: key,
      autonomyLevel: value.autonomyLevel,
    }));

    return res.json({ presets });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get presets");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/config/features
 * Get feature flags status
 */
router.get("/config/features", async (_req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();

    const features = Object.entries(FEATURES).map(([key, featureId]) => ({
      id: featureId,
      name: key,
      enabled: config.features[featureId as Feature] ?? false,
    }));

    return res.json({ features });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get features");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * PUT /api/gagent/config/feature/:id
 * Toggle a feature flag
 */
router.put("/config/feature/:id", async (req: Request, res: Response) => {
  try {
    const featureId = req.params.id as Feature;
    const { enabled } = req.body;
    const userId = (req as Request & { userId?: string }).userId || "default";

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    // Validate feature exists
    const validFeatures = Object.values(FEATURES);
    if (!validFeatures.includes(featureId)) {
      return res.status(400).json({
        error: "Invalid feature. Available: " + validFeatures.join(", "),
      });
    }

    configManager.setFeature(featureId, enabled, userId);
    const config = configManager.getConfig();

    logger.info({ userId, featureId, enabled }, "Feature flag toggled via API");

    return res.json({
      feature: featureId,
      enabled: config.features[featureId],
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to toggle feature");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// SSE (SERVER-SENT EVENTS) STREAMING
// ============================================================================

/**
 * GET /api/gagent/stream
 * Real-time event streaming via SSE
 */
router.get("/stream", (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || "default";
  const userId = (req as Request & { userId?: string }).userId || "default";

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Send initial connection event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    })}\n\n`,
  );

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    res.write(`:ping ${Date.now()}\n\n`);
  }, 30000);

  // Track subscription IDs for cleanup
  const subscriptionIds: string[] = [];

  // Event handlers that write to SSE
  const writeEvent = (eventName: string) => (data: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to message bus channels
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.AGENT_SPAWN, writeEvent("agent_spawned")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.AGENT_STATUS, writeEvent("agent_status")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.AGENT_RESULT, writeEvent("agent_result")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.TASK_PROGRESS, writeEvent("task_progress")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.TASK_COMPLETE, writeEvent("task_complete")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.TASK_FAILED, writeEvent("task_failed")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.GOAL_CREATED, writeEvent("goal_created")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.GOAL_UPDATED, writeEvent("goal_updated")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.GOAL_COMPLETED, writeEvent("goal_completed")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.BROADCAST, writeEvent("broadcast")),
  );
  subscriptionIds.push(
    messageBus.subscribe(CHANNELS.SYSTEM_ERROR, writeEvent("system_error")),
  );

  // Subscribe to budget events (EventEmitter style)
  const budgetWarningHandler = writeEvent("budget_warning");
  const budgetCriticalHandler = writeEvent("budget_critical");
  const approvalRequiredHandler = writeEvent("approval_required");
  budgetManager.on("budget_warning", budgetWarningHandler);
  budgetManager.on("budget_critical", budgetCriticalHandler);
  budgetManager.on("approval_required", approvalRequiredHandler);

  // Subscribe to kill switch events
  const emergencyStopHandler = writeEvent("emergency_stop");
  const operationsResumedHandler = writeEvent("operations_resumed");
  killSwitch.on("stop", emergencyStopHandler);
  killSwitch.on("resume", operationsResumedHandler);

  // Cleanup on connection close
  req.on("close", () => {
    clearInterval(pingInterval);

    // Unsubscribe from message bus using subscription IDs
    for (const subId of subscriptionIds) {
      messageBus.unsubscribe(subId);
    }

    // Unsubscribe from budget events
    budgetManager.off("budget_warning", budgetWarningHandler);
    budgetManager.off("budget_critical", budgetCriticalHandler);
    budgetManager.off("approval_required", approvalRequiredHandler);

    // Unsubscribe from kill switch events
    killSwitch.off("stop", emergencyStopHandler);
    killSwitch.off("resume", operationsResumedHandler);

    logger.debug({ sessionId, userId }, "SSE connection closed");
  });

  logger.debug({ sessionId, userId }, "SSE connection established");
});

// ============================================================================
// COMPREHENSIVE STATUS ENDPOINT
// ============================================================================

/**
 * GET /api/gagent/status
 * Get comprehensive G-Agent system status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || "default";
    const sessionId = (req.query.sessionId as string) || "default";

    // Gather all status information
    const queueStats = gAgentGoalQueue.getQueueStats(userId);
    const budgetStatus = budgetManager.getBudgetStatus(sessionId);
    const killSwitchStatus = killSwitch.getGlobalStopInfo();
    const config = configManager.getConfig();

    // Get semantic compiler stats if available
    let compilerStats = null;
    try {
      const compiler = getSemanticCompiler(sessionId);
      compilerStats = compiler.getStats();
    } catch {
      // Compiler not initialized for this session
    }

    return res.json({
      status: "operational",
      timestamp: new Date().toISOString(),
      queue: queueStats,
      budget: budgetStatus,
      control: {
        globalStopActive: killSwitchStatus.active,
        ...killSwitchStatus,
      },
      config: {
        autonomyLevel: config.autonomyLevel,
        environment: config.environment,
      },
      capabilities: {
        goalQueue: configManager.isFeatureEnabled(FEATURES.GOAL_QUEUE),
        agentLightning: configManager.isFeatureEnabled(
          FEATURES.AGENT_LIGHTNING,
        ),
        selfHealing: configManager.isFeatureEnabled(FEATURES.SELF_HEALING),
        patternLearning: configManager.isFeatureEnabled(
          FEATURES.PATTERN_LEARNING,
        ),
        confidenceRouting: configManager.isFeatureEnabled(
          FEATURES.CONFIDENCE_ROUTING,
        ),
        multiAgentSwarm: configManager.isFeatureEnabled(
          FEATURES.MULTI_AGENT_SWARM,
        ),
      },
      compiler: compilerStats,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get G-Agent status",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// SEMANTIC COMPILER API (100x Solution to Data Wall Problem)
// ============================================================================

/**
 * POST /api/gagent/compiler/compile
 * Compile context for a query - the 100x magic
 *
 * This is the core of the semantic compiler: it takes a query and returns
 * an optimized context that's 10-100x smaller than naive RAG retrieval.
 */
router.post("/compiler/compile", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { query, context, constraints, options } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const compiler = getSemanticCompiler(sessionId);

    const request: CompilationRequest = {
      query,
      context: context || {},
      constraints: {
        maxTokens: constraints?.maxTokens || 8000,
        maxCost: constraints?.maxCost || 100, // 1 dollar default
        maxLatency: constraints?.maxLatency || 5000,
        qualityThreshold: constraints?.qualityThreshold || 0.3,
      },
      options: {
        speculative: options?.speculative !== false,
        streaming: options?.streaming || false,
        cacheResults: options?.cacheResults !== false,
      },
    };

    const result = await compiler.compile(request);

    logger.info(
      {
        sessionId,
        queryLength: query.length,
        originalTokens: result.stats.originalTokens,
        compiledTokens: result.stats.compiledTokens,
        compressionRatio: result.stats.compressionRatio.toFixed(2),
        unitsIncluded: result.stats.unitsIncluded,
      },
      "Context compiled via 100x compiler",
    );

    return res.json({
      success: true,
      result: {
        id: result.id,
        compiledContext: result.compiledContext,
        stats: result.stats,
        includedUnits: result.includedUnits,
        excludedUnits: result.excludedUnits,
        delta: result.delta,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Compilation failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/compile/stream
 * Progressive streaming compilation - start abstract, drill down
 *
 * Returns SSE stream of progressive context levels:
 * 1. Abstract (fast, ~10% tokens)
 * 2. Summary (~30% tokens)
 * 3. Detailed (~50% tokens)
 * 4. Source (if needed, ~10% tokens)
 */
router.post(
  "/compiler/compile/stream",
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = (req.query.sessionId as string) || "default";
    const { query, context, constraints } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query is required" });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      const compiler = getSemanticCompiler(sessionId);

      const request: CompilationRequest = {
        query,
        context: context || {},
        constraints: {
          maxTokens: constraints?.maxTokens || 8000,
          maxCost: constraints?.maxCost || 100,
          maxLatency: constraints?.maxLatency || 10000,
          qualityThreshold: constraints?.qualityThreshold || 0.3,
        },
        options: {
          speculative: false,
          streaming: true,
          cacheResults: true,
        },
      };

      // Stream progressive levels
      for await (const state of compiler.compileStream(request)) {
        res.write(`event: level_${state.currentLevel}\n`);
        res.write(
          `data: ${JSON.stringify({
            level: state.currentLevel,
            loadedUnits: state.loadedUnits.size,
            tokenBudgetUsed: state.tokenBudgetUsed,
            tokenBudgetRemaining: state.tokenBudgetRemaining,
            // Include unit summaries at abstract/summary levels
            units: Array.from(state.loadedUnits.entries()).map(
              ([id, unit]) => ({
                id,
                type: unit.type,
                preview:
                  unit.levels.abstract || unit.levels.summary?.slice(0, 100),
              }),
            ),
          })}\n\n`,
        );
      }

      res.write("event: done\n");
      res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    } catch (e) {
      res.write("event: error\n");
      res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
      res.end();
    }
  },
);

/**
 * POST /api/gagent/compiler/index/file
 * Index a file into the semantic compiler
 */
router.post("/compiler/index/file", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { filePath, content, type, forceReindex } = req.body;

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath is required" });
    }
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    const units = await compiler.indexFile(filePath, content, {
      type,
      forceReindex: forceReindex || false,
    });

    logger.info(
      {
        sessionId,
        filePath,
        unitCount: units.length,
      },
      "File indexed into semantic compiler",
    );

    return res.json({
      success: true,
      filePath,
      unitsCreated: units.length,
      units: units.map((u) => ({
        id: u.id,
        type: u.type,
        abstract: u.levels.abstract,
        importance: u.meta.importance,
      })),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "File indexing failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/index/conversation
 * Index a conversation history
 */
router.post(
  "/compiler/index/conversation",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { conversationId, messages } = req.body;

      if (!conversationId || typeof conversationId !== "string") {
        return res.status(400).json({ error: "conversationId is required" });
      }
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "messages must be an array" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const units = await compiler.indexConversation(conversationId, messages);

      logger.info(
        {
          sessionId,
          conversationId,
          messageCount: messages.length,
          unitCount: units.length,
        },
        "Conversation indexed into semantic compiler",
      );

      return res.json({
        success: true,
        conversationId,
        messagesProcessed: messages.length,
        unitsCreated: units.length,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Conversation indexing failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/stats
 * Get semantic compiler statistics
 */
router.get("/compiler/stats", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";

    const compiler = getSemanticCompiler(sessionId);
    const stats = compiler.getStats();

    return res.json({
      success: true,
      sessionId,
      stats: {
        ...stats,
        // Add computed metrics
        compressionEfficiencyPercent:
          (stats.compressionEfficiency * 100).toFixed(1) + "%",
        tokensSavedFormatted: stats.tokensSaved.toLocaleString(),
        costSavedFormatted:
          stats.totalCostSaved < 100
            ? `${stats.totalCostSaved}¢`
            : `$${(stats.totalCostSaved / 100).toFixed(2)}`,
      },
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get compiler stats",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/clear
 * Clear compiler caches (useful for memory management)
 */
router.post("/compiler/clear", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { caches, index, destroy } = req.body;

    if (destroy) {
      // Completely destroy the compiler instance
      destroySemanticCompiler(sessionId);
      logger.info({ sessionId }, "Semantic compiler destroyed");
      return res.json({ success: true, action: "destroyed" });
    }

    const compiler = getSemanticCompiler(sessionId);

    if (caches !== false) {
      compiler.clearCaches();
    }

    if (index) {
      compiler.clearIndex();
    }

    logger.info({ sessionId, caches, index }, "Compiler cleared");

    return res.json({
      success: true,
      cleared: {
        caches: caches !== false,
        index: !!index,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to clear compiler");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/delta
 * Compute delta between two compilation results
 *
 * Useful for efficient updates - only send what changed
 */
router.post("/compiler/delta", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { previousResult, currentQuery, context, constraints } = req.body;

    if (!currentQuery) {
      return res.status(400).json({ error: "currentQuery is required" });
    }

    const compiler = getSemanticCompiler(sessionId);

    // Compile current query
    const currentResult = await compiler.compile({
      query: currentQuery,
      context: context || {},
      constraints: constraints || {
        maxTokens: 8000,
        maxCost: 100,
        maxLatency: 5000,
        qualityThreshold: 0.3,
      },
      options: {
        speculative: false,
        streaming: false,
        cacheResults: true,
      },
    });

    // Compute delta from previous
    const delta = compiler.computeDelta(previousResult || null, currentResult);
    const deltaUpdate = compiler.generateDeltaUpdate(delta);

    return res.json({
      success: true,
      currentResult: {
        id: currentResult.id,
        stats: currentResult.stats,
      },
      delta,
      deltaUpdate,
      // Include full context only if there's no previous result
      fullContext: previousResult ? undefined : currentResult.compiledContext,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Delta computation failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// PREDICTIVE PREFETCH API (ML-Based Query and File Prediction)
// ============================================================================

/**
 * GET /api/gagent/compiler/prefetch/metrics
 * Get predictive prefetch service metrics
 */
router.get(
  "/compiler/prefetch/metrics",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const metrics = compiler.getPrefetchMetrics();

      return res.json({
        success: true,
        sessionId,
        metrics,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get prefetch metrics",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/prefetch/predict
 * Predict follow-up queries based on current query
 */
router.post(
  "/compiler/prefetch/predict",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "query is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const predictions = await compiler.predictNextQueries(query);

      return res.json({
        success: true,
        query,
        predictions,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to predict follow-ups",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/prefetch/files
 * Predict files likely to be accessed next
 */
router.post("/compiler/prefetch/files", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { currentFile } = req.body;

    const compiler = getSemanticCompiler(sessionId);
    const predictions = compiler.predictFilesToAccess(currentFile);

    return res.json({
      success: true,
      currentFile: currentFile || null,
      predictions,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to predict files");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/prefetch/queue
 * Queue a file for background indexing
 */
router.post("/compiler/prefetch/queue", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { filePath } = req.body;

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    compiler.queueBackgroundIndex(filePath);

    return res.json({
      success: true,
      message: `Queued ${filePath} for background indexing`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to queue file");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/compiler/prefetch/patterns
 * Get learned query patterns (for debugging/analytics)
 */
router.get(
  "/compiler/prefetch/patterns",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const patterns = compiler.getQueryPatterns();

      return res.json({
        success: true,
        sessionId,
        patternCount: patterns.length,
        patterns: patterns.slice(0, 50), // Limit to 50 for API response size
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Failed to get patterns");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/prefetch/export
 * Export prefetch patterns for persistence
 */
router.post(
  "/compiler/prefetch/export",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const exported = compiler.exportPrefetchPatterns();

      return res.json({
        success: true,
        sessionId,
        data: exported,
        summary: {
          queryPatterns: exported.queryPatterns.length,
          filePatterns: exported.filePatterns.length,
          topicClusters: exported.topicClusters.length,
        },
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to export patterns",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/prefetch/import
 * Import prefetch patterns from persistence
 */
router.post(
  "/compiler/prefetch/import",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ error: "data is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      compiler.importPrefetchPatterns(data);

      const metrics = compiler.getPrefetchMetrics();

      return res.json({
        success: true,
        sessionId,
        imported: {
          queryPatterns: data.queryPatterns?.length || 0,
          filePatterns: data.filePatterns?.length || 0,
          topicClusters: data.topicClusters?.length || 0,
        },
        totalPatterns: metrics.totalPatterns,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to import patterns",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

// ============================================================================
// MULTI-MODAL COMPILATION API (Code + Docs + Tests Unified Context)
// ============================================================================

/**
 * POST /api/gagent/compiler/multimodal/index
 * Index a file with multi-modal awareness
 * Automatically detects content type and tracks cross-references
 */
router.post(
  "/compiler/multimodal/index",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { filePath, content, modality, importance } = req.body;

      if (!filePath || typeof filePath !== "string") {
        return res.status(400).json({ error: "filePath is required" });
      }
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "content is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const result = compiler.indexMultiModal(filePath, content, {
        modality,
        importance,
      });

      logger.info(
        {
          sessionId,
          filePath,
          modality: result.modality,
          crossRefs: result.crossRefs,
        },
        "File indexed with multi-modal awareness",
      );

      return res.json({
        success: true,
        ...result,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Multi-modal indexing failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/multimodal/compile
 * Compile multi-modal context - combines code, docs, tests with weighted relevance
 */
router.post(
  "/compiler/multimodal/compile",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const {
        query,
        intent,
        modalities,
        maxTokens,
        includeCrossRefs,
        balanceModalities,
      } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "query is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const result = compiler.compileMultiModal({
        query,
        intent,
        modalities,
        maxTokens: maxTokens || 8000,
        includeCrossRefs: includeCrossRefs !== false,
        balanceModalities: balanceModalities !== false,
      });

      logger.info(
        {
          sessionId,
          queryLength: query.length,
          intent: intent || "inferred",
          totalUnits: result.stats.totalUnits,
          totalTokens: result.stats.totalTokens,
          modalitiesIncluded: result.stats.modalitiesIncluded,
          crossRefsFound: result.stats.crossRefsFound,
        },
        "Multi-modal context compiled",
      );

      return res.json({
        success: true,
        result,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Multi-modal compilation failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/multimodal/units
 * Get indexed units, optionally filtered by modality
 */
router.get(
  "/compiler/multimodal/units",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const modality = req.query.modality as string | undefined;

      const compiler = getSemanticCompiler(sessionId);

      let units;
      if (modality) {
        units = compiler.getUnitsByModality(
          modality as Parameters<typeof compiler.getUnitsByModality>[0],
        );
      } else {
        // Get all units by querying each modality
        const allModalities = [
          "code",
          "test",
          "docs",
          "config",
          "types",
          "api",
          "data",
          "style",
          "unknown",
        ];
        units = allModalities.flatMap((m) =>
          compiler.getUnitsByModality(
            m as Parameters<typeof compiler.getUnitsByModality>[0],
          ),
        );
      }

      return res.json({
        success: true,
        sessionId,
        modality: modality || "all",
        unitCount: units.length,
        units: units.map((u) => ({
          id: u.id,
          filePath: u.filePath,
          modality: u.modality,
          abstract: u.content.abstract,
          tokenCount: u.meta.tokenCount,
          importance: u.meta.importance,
          crossRefCount: u.crossRefs.length,
        })),
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Failed to get units");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/multimodal/crossrefs/:unitId
 * Get cross-references for a specific unit
 */
router.get(
  "/compiler/multimodal/crossrefs/:unitId",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const unitId = req.params.unitId as string;

      const compiler = getSemanticCompiler(sessionId);
      const crossRefs = compiler.getCrossReferences(unitId);

      return res.json({
        success: true,
        unitId,
        crossRefs,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get cross-references",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/multimodal/detect
 * Detect content modality from file path and optional content
 */
router.post(
  "/compiler/multimodal/detect",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { filePath, content } = req.body;

      if (!filePath || typeof filePath !== "string") {
        return res.status(400).json({ error: "filePath is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const modality = compiler.detectModality(filePath, content);

      return res.json({
        success: true,
        filePath,
        modality,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to detect modality",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/multimodal/metrics
 * Get multi-modal compiler metrics
 */
router.get(
  "/compiler/multimodal/metrics",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const metrics = compiler.getMultiModalMetrics();

      return res.json({
        success: true,
        sessionId,
        metrics,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get multi-modal metrics",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

// ============================================================================
// SEMANTIC DEDUPLICATION API (Cross-Session Pattern Sharing)
// ============================================================================

/**
 * POST /api/gagent/dedup/deduplicate
 * Deduplicate content - find matching pattern or create new one
 */
router.post("/dedup/deduplicate", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { content, hints } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    const dedup = getSemanticDedup();
    const result = dedup.deduplicate(content, sessionId, hints);

    logger.info(
      {
        sessionId,
        isNew: result.isNew,
        savedTokens: result.savedTokens,
        patternId: result.patternRef?.patternId,
      },
      "Content deduplicated",
    );

    return res.json({
      success: true,
      result: {
        isNew: result.isNew,
        savedTokens: result.savedTokens,
        patternRef: result.patternRef,
        newPatternId: result.newPattern?.id,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Deduplication failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/batch
 * Batch deduplicate multiple content items
 */
router.post("/dedup/batch", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    const dedup = getSemanticDedup();
    const results = dedup.deduplicateBatch(items, sessionId);

    const totalSaved = results.reduce((sum, r) => sum + r.savedTokens, 0);
    const newPatterns = results.filter((r) => r.isNew).length;

    logger.info(
      {
        sessionId,
        itemCount: items.length,
        totalSaved,
        newPatterns,
      },
      "Batch deduplication complete",
    );

    return res.json({
      success: true,
      results: results.map((r) => ({
        isNew: r.isNew,
        savedTokens: r.savedTokens,
        patternId: r.patternRef?.patternId || r.newPattern?.id,
      })),
      summary: {
        totalItems: items.length,
        totalSaved,
        newPatterns,
        existingPatterns: items.length - newPatterns,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Batch deduplication failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/expand
 * Expand a pattern reference back to full content
 */
router.post("/dedup/expand", async (req: Request, res: Response) => {
  try {
    const { patternRef } = req.body;

    if (!patternRef || !patternRef.patternId) {
      return res
        .status(400)
        .json({ error: "patternRef with patternId is required" });
    }

    const dedup = getSemanticDedup();
    const expanded = dedup.expand(patternRef);

    return res.json({
      success: true,
      expanded,
      patternId: patternRef.patternId,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Pattern expansion failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/dedup/pattern/:id
 * Get a specific pattern
 */
router.get("/dedup/pattern/:id", async (req: Request, res: Response) => {
  try {
    const patternId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const dedup = getSemanticDedup();
    const pattern = dedup.getPattern(patternId);

    if (!pattern) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    return res.json({
      success: true,
      pattern: {
        id: pattern.id,
        content: pattern.content,
        meta: pattern.meta,
        stats: {
          useCount: pattern.stats.useCount,
          lastUsed: pattern.stats.lastUsed,
          createdAt: pattern.stats.createdAt,
          sessionCount: pattern.stats.sessions.size,
        },
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get pattern");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/dedup/patterns
 * List patterns by type or tags
 */
router.get("/dedup/patterns", async (req: Request, res: Response) => {
  try {
    const { type, tags, limit } = req.query;

    const dedup = getSemanticDedup();
    let patterns;

    if (type) {
      patterns = dedup.findByType(type as PatternType);
    } else if (tags) {
      const tagList = (tags as string).split(",");
      patterns = dedup.findByTags(tagList);
    } else {
      // Get stats to list all patterns
      const stats = dedup.getStats();
      return res.json({
        success: true,
        stats,
        message: "Use type or tags query param to filter patterns",
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    patterns = patterns.slice(0, limitNum);

    return res.json({
      success: true,
      patterns: patterns.map((p) => ({
        id: p.id,
        abstract: p.content.abstract,
        type: p.meta.type,
        language: p.meta.language,
        useCount: p.stats.useCount,
      })),
      count: patterns.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to list patterns");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/learn
 * Learn a new pattern from user-provided example
 */
router.post("/dedup/learn", async (req: Request, res: Response) => {
  try {
    const { example, patternName, meta } = req.body;

    if (!example || typeof example !== "string") {
      return res.status(400).json({ error: "example is required" });
    }
    if (!patternName || typeof patternName !== "string") {
      return res.status(400).json({ error: "patternName is required" });
    }
    if (!meta?.type) {
      return res.status(400).json({ error: "meta.type is required" });
    }

    const dedup = getSemanticDedup();
    const pattern = dedup.learnPattern(example, patternName, {
      type: meta.type,
      language: meta.language,
      framework: meta.framework,
      category: meta.category || "user-defined",
      tags: meta.tags || [],
    });

    logger.info(
      {
        patternId: pattern.id,
        patternName,
        type: meta.type,
      },
      "New pattern learned",
    );

    return res.json({
      success: true,
      pattern: {
        id: pattern.id,
        content: pattern.content,
        meta: pattern.meta,
        parameters: pattern.content.parameters,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Pattern learning failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/dedup/stats
 * Get deduplication library statistics
 */
router.get("/dedup/stats", async (_req: Request, res: Response) => {
  try {
    const dedup = getSemanticDedup();
    const stats = dedup.getStats();

    return res.json({
      success: true,
      stats: {
        ...stats,
        estimatedSavingsFormatted:
          stats.estimatedSavings < 1000
            ? `${stats.estimatedSavings} tokens`
            : `${(stats.estimatedSavings / 1000).toFixed(1)}K tokens`,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to get dedup stats");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/dedup/session/:sessionId
 * Get patterns used in a specific session
 */
router.get("/dedup/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const dedup = getSemanticDedup();
    const patterns = dedup.getSessionPatterns(sessionId);

    return res.json({
      success: true,
      sessionId,
      patterns: patterns.map((p) => ({
        id: p.id,
        abstract: p.content.abstract,
        type: p.meta.type,
        useCount: p.stats.useCount,
      })),
      count: patterns.length,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get session patterns",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/cleanup
 * Cleanup old/unused patterns
 */
router.post("/dedup/cleanup", async (req: Request, res: Response) => {
  try {
    const { maxAge, minUseCount, keepBuiltin } = req.body;

    const dedup = getSemanticDedup();
    const removed = dedup.cleanup({
      maxAge: maxAge || 30,
      minUseCount: minUseCount || 2,
      keepBuiltin: keepBuiltin !== false,
    });

    logger.info({ removed }, "Pattern cleanup completed");

    return res.json({
      success: true,
      removed,
      message: `Removed ${removed} unused patterns`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Pattern cleanup failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/export
 * Export patterns for persistence
 */
router.post("/dedup/export", async (_req: Request, res: Response) => {
  try {
    const dedup = getSemanticDedup();
    const data = dedup.export();

    return res.json({
      success: true,
      data,
      size: data.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Pattern export failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/dedup/import
 * Import patterns from persistence
 */
router.post("/dedup/import", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== "string") {
      return res.status(400).json({ error: "data is required" });
    }

    const dedup = getSemanticDedup();
    const imported = dedup.import(data);

    logger.info({ imported }, "Patterns imported");

    return res.json({
      success: true,
      imported,
      message: `Imported ${imported} patterns`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Pattern import failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// HIERARCHICAL CACHE API (3-Tier: L1 Hot → L2 Warm → L3 Persistent)
// ============================================================================

/**
 * GET /api/gagent/compiler/cache/metrics
 * Get hierarchical cache metrics for all tiers
 */
router.get("/compiler/cache/metrics", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";

    const compiler = getSemanticCompiler(sessionId);
    const metrics = compiler.getHierarchicalCacheMetrics();

    return res.json({
      success: true,
      sessionId,
      metrics,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get cache metrics",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/cache/get
 * Get cached value by key (checks L1 → L2 → L3)
 */
router.post("/compiler/cache/get", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { key, namespace } = req.body;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    const value = await compiler.getCached(key, namespace || "compilation");

    return res.json({
      success: true,
      key,
      namespace: namespace || "compilation",
      found: value !== undefined,
      value,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache get failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/cache/set
 * Set cached value with tier preference
 */
router.post("/compiler/cache/set", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { key, value, namespace, ttl, importance, tier } = req.body;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    if (value === undefined) {
      return res.status(400).json({ error: "value is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    await compiler.setCached(key, value, {
      namespace: namespace || "compilation",
      ttl,
      importance,
      tier: tier || "l2",
    });

    logger.debug(
      {
        sessionId,
        key,
        namespace: namespace || "compilation",
        tier: tier || "l2",
      },
      "Cache value set",
    );

    return res.json({
      success: true,
      key,
      namespace: namespace || "compilation",
      tier: tier || "l2",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache set failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * DELETE /api/gagent/compiler/cache/delete
 * Delete cached value from all tiers
 */
router.delete("/compiler/cache/delete", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const key = req.query.key as string;
    const namespace = (req.query.namespace as string) || "compilation";

    if (!key) {
      return res.status(400).json({ error: "key query parameter is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    const deleted = await compiler.deleteCached(key, namespace);

    return res.json({
      success: true,
      key,
      namespace,
      deleted,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache delete failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/cache/clear
 * Clear cache by tier or namespace
 */
router.post("/compiler/cache/clear", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { l1, l2, l3, namespace } = req.body;

    const compiler = getSemanticCompiler(sessionId);

    if (namespace) {
      const cleared = await compiler.clearCacheNamespace(namespace);
      logger.info({ sessionId, namespace, cleared }, "Cache namespace cleared");
      return res.json({
        success: true,
        namespace,
        cleared,
      });
    }

    await compiler.clearHierarchicalCache({ l1, l2, l3 });

    logger.info({ sessionId, l1, l2, l3 }, "Cache tiers cleared");

    return res.json({
      success: true,
      cleared: { l1: !!l1, l2: !!l2, l3: !!l3 },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache clear failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/cache/warm
 * Warm L2 cache from persistent L3
 */
router.post("/compiler/cache/warm", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { limit } = req.body;

    const compiler = getSemanticCompiler(sessionId);
    const warmed = await compiler.warmCacheFromPersistent(limit || 100);

    logger.info({ sessionId, warmed }, "Cache warmed from persistent");

    return res.json({
      success: true,
      warmed,
      message: `Warmed ${warmed} entries from L3 to L2`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache warm failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/cache/preload
 * Preload entries into cache
 */
router.post("/compiler/cache/preload", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: "entries array is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    await compiler.preloadCache(entries);

    logger.info({ sessionId, count: entries.length }, "Cache preloaded");

    return res.json({
      success: true,
      preloaded: entries.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache preload failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/gagent/compiler/cache/namespace/:namespace
 * Get all cached entries by namespace
 */
router.get(
  "/compiler/cache/namespace/:namespace",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const namespace = req.params.namespace as string;

      const compiler = getSemanticCompiler(sessionId);
      const entries = await compiler.getCacheEntriesByNamespace(namespace);

      return res.json({
        success: true,
        namespace,
        entries: entries.map((e) => ({
          key: e.key,
          size: e.size,
          accessCount: e.accessCount,
          lastAccessedAt: new Date(e.lastAccessedAt).toISOString(),
          importance: e.importance,
        })),
        count: entries.length,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get cache namespace",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/cache/shutdown
 * Shutdown hierarchical cache (persist all data before server stop)
 */
router.post("/compiler/cache/shutdown", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";

    const compiler = getSemanticCompiler(sessionId);
    await compiler.shutdownHierarchicalCache();

    logger.info({ sessionId }, "Hierarchical cache shutdown complete");

    return res.json({
      success: true,
      message: "Cache shutdown complete, all data persisted",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cache shutdown failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// GENERATION FEEDBACK (Thumbs up/down on generation results)
// ============================================================================

/**
 * POST /api/gagent/feedback
 * Store thumbs up/down (or "good / needs work") on a generation result.
 * Used for prompt tuning and model selection; stored in backend/data/generation-feedback.json.
 */
router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const { goalId, requestId, messageId, rating, comment } = req.body as {
      goalId?: string;
      requestId?: string;
      messageId?: string;
      rating?: "up" | "down";
      comment?: string;
    };
    if (!rating || (rating !== "up" && rating !== "down")) {
      return res
        .status(400)
        .json({ error: 'rating is required and must be "up" or "down"' });
    }
    const fs = await import("fs");
    const path = await import("path");
    const dataDir = path.join(process.cwd(), "data");
    const feedbackPath = path.join(dataDir, "generation-feedback.json");
    const entry = {
      timestamp: new Date().toISOString(),
      goalId: goalId ?? null,
      requestId: requestId ?? null,
      messageId: messageId ?? null,
      rating,
      comment: comment ?? null,
    };
    try {
      await fs.promises.mkdir(dataDir, { recursive: true });
      let list: unknown[] = [];
      if (fs.existsSync(feedbackPath)) {
        const raw = await fs.promises.readFile(feedbackPath, "utf-8");
        try {
          list = JSON.parse(raw) as unknown[];
        } catch {
          list = [];
        }
      }
      list.push(entry);
      await fs.promises.writeFile(
        feedbackPath,
        JSON.stringify(list, null, 2),
        "utf-8",
      );
    } catch (fileErr) {
      logger.warn(
        { err: (fileErr as Error).message },
        "Could not persist generation feedback",
      );
    }
    logger.info(
      { messageId: messageId ?? goalId ?? requestId, rating },
      "Generation feedback recorded",
    );
    return res.json({ success: true, message: "Feedback recorded" });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Generation feedback failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// REAL-TIME LEARNING API (Feedback-Based Model Refinement)
// ============================================================================

/**
 * POST /api/gagent/compiler/learning/feedback
 * Process user feedback and learn from it
 */
router.post(
  "/compiler/learning/feedback",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const {
        query,
        compiledContext,
        includedUnits,
        type,
        rating,
        correction,
        missingFiles,
        unwantedFiles,
        userComment,
      } = req.body;

      if (!query || !type) {
        return res.status(400).json({ error: "query and type are required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const signals = compiler.processFeedback({
        query,
        compiledContext: compiledContext || "",
        includedUnits: includedUnits || [],
        type,
        rating,
        correction,
        missingFiles,
        unwantedFiles,
        userComment,
      });

      logger.info(
        {
          sessionId,
          feedbackType: type,
          signalsGenerated: signals.length,
        },
        "User feedback processed",
      );

      return res.json({
        success: true,
        signals,
        message: `Generated ${signals.length} learning signals`,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Feedback processing failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/learning/implicit
 * Record implicit positive feedback (user continued without complaint)
 */
router.post(
  "/compiler/learning/implicit",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { query, includedUnits } = req.body;

      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      compiler.recordImplicitPositive(query, includedUnits || []);

      return res.json({
        success: true,
        message: "Implicit positive feedback recorded",
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Implicit feedback recording failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/learning/metrics
 * Get learning metrics
 */
router.get(
  "/compiler/learning/metrics",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const metrics = compiler.getLearningMetrics();

      return res.json({
        success: true,
        sessionId,
        metrics,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get learning metrics",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/learning/preferences
 * Get learned user preferences
 */
router.get(
  "/compiler/learning/preferences",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const preferences = compiler.getLearningPreferences();

      // Convert Maps and Sets to arrays for JSON serialization
      const serializedPrefs = {
        preferredDetailLevel: preferences.preferredDetailLevel,
        detailLevelConfidence: preferences.detailLevelConfidence,
        modalityWeights: preferences.modalityWeights,
        fileImportance: Object.fromEntries(preferences.fileImportance),
        intentVocabulary: Object.fromEntries(preferences.intentVocabulary),
        antiPatterns: Array.from(preferences.antiPatterns),
        preferredPatterns: Array.from(preferences.preferredPatterns),
      };

      return res.json({
        success: true,
        sessionId,
        preferences: serializedPrefs,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Failed to get learning preferences",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/learning/file-boost
 * Get learned boost for a specific file
 */
router.get(
  "/compiler/learning/file-boost",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const filePath = req.query.filePath as string;

      if (!filePath) {
        return res
          .status(400)
          .json({ error: "filePath query parameter is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const boost = compiler.getLearnedFileBoost(filePath);
      const isAntiPattern = compiler.isAntiPattern(filePath);

      return res.json({
        success: true,
        filePath,
        boost,
        isAntiPattern,
      });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Failed to get file boost");
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * GET /api/gagent/compiler/learning/intent
 * Get corrected intent based on past corrections
 */
router.get("/compiler/learning/intent", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({ error: "query parameter is required" });
    }

    const compiler = getSemanticCompiler(sessionId);
    const correctedIntent = compiler.getLearnedIntent(query);
    const preferredLevel = compiler.getPreferredDetailLevel();

    return res.json({
      success: true,
      query,
      correctedIntent,
      preferredDetailLevel: preferredLevel,
    });
  } catch (e) {
    logger.error(
      { error: (e as Error).message },
      "Failed to get learned intent",
    );
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/learning/decay
 * Apply decay to learned values (maintenance endpoint)
 */
router.post("/compiler/learning/decay", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";

    const compiler = getSemanticCompiler(sessionId);
    compiler.applyLearningDecay();

    logger.info({ sessionId }, "Learning decay applied");

    return res.json({
      success: true,
      message: "Decay applied to learning model",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Learning decay failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/gagent/compiler/learning/export
 * Export learning model for persistence
 */
router.post(
  "/compiler/learning/export",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";

      const compiler = getSemanticCompiler(sessionId);
      const modelData = compiler.exportLearningModel();

      return res.json({
        success: true,
        sessionId,
        data: modelData,
        size: modelData.length,
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Learning model export failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/learning/import
 * Import learning model from persistence
 */
router.post(
  "/compiler/learning/import",
  async (req: Request, res: Response) => {
    try {
      const sessionId = (req.query.sessionId as string) || "default";
      const { data } = req.body;

      if (!data || typeof data !== "string") {
        return res.status(400).json({ error: "data is required" });
      }

      const compiler = getSemanticCompiler(sessionId);
      const success = compiler.importLearningModel(data);

      if (success) {
        logger.info({ sessionId }, "Learning model imported");
      }

      return res.json({
        success,
        message: success ? "Learning model imported" : "Import failed",
      });
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Learning model import failed",
      );
      return res.status(500).json({ error: (e as Error).message });
    }
  },
);

/**
 * POST /api/gagent/compiler/learning/reset
 * Reset all learning (use with caution!)
 */
router.post("/compiler/learning/reset", async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        error: "Must confirm reset by passing { confirm: true }",
      });
    }

    const compiler = getSemanticCompiler(sessionId);
    compiler.resetLearning();

    logger.warn({ sessionId }, "Learning model reset");

    return res.json({
      success: true,
      message: "All learning has been reset",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Learning reset failed");
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
