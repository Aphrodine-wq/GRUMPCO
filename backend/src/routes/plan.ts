/**
 * Plan API Routes
 * Handles plan generation, approval, editing, and execution
 * Includes G-Agent Task Engine integration for Rust-based plan generation
 */

import { Router, type Request, type Response } from "express";
import {
  generatePlan,
  getPlan,
  approvePlan,
  rejectPlan,
  editPlan,
  startPlanExecution,
  completePlanExecution,
  updatePhaseStatus,
} from "../services/ship/planService.js";
import {
  runPlanCli,
  type Plan as RustPlan,
} from "../services/intent/intentCliRunner.js";
import { gAgentTaskExecutor } from "../services/agents/gAgentTaskExecutor.js";
import { gAgentMemoryService } from "../services/agents/gAgentMemoryService.js";
import type {
  PlanGenerationRequest,
  PlanApprovalRequest,
  PlanEditRequest,
  PlanExecutionRequest,
  PlanPhase,
} from "../types/plan.js";
import logger from "../middleware/logger.js";
import { sendServerError, writeSSEError } from "../utils/errorResponse.js";
import { MAX_USER_REQUEST_LENGTH } from "../config/limits.js";

const router = Router();

/**
 * POST /api/plan/generate
 * Generate a structured plan from user request
 */
router.post("/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const request: PlanGenerationRequest = req.body;

    if (!request.userRequest || typeof request.userRequest !== "string") {
      res.status(400).json({
        error: "Invalid request",
        message: "userRequest is required and must be a string",
      });
      return;
    }
    if (request.userRequest.length > MAX_USER_REQUEST_LENGTH) {
      res.status(413).json({
        error: "Invalid request",
        message: `userRequest exceeds maximum length of ${MAX_USER_REQUEST_LENGTH} characters`,
      });
      return;
    }

    logger.debug({ requestId: req.id }, "Plan generation request");

    const plan = await generatePlan(request);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, "Plan generation failed");
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/generate-rust
 * Generate an execution plan using the Rust Task Engine.
 * Returns a task-based plan with dependencies, parallel batches, and risk assessment.
 * This is the new G-Agent plan generation endpoint.
 */
router.post(
  "/generate-rust",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { goal } = req.body as { goal?: string };

      if (!goal || typeof goal !== "string") {
        res.status(400).json({
          error: "Invalid request",
          message: "goal is required and must be a string",
        });
        return;
      }

      if (goal.length > MAX_USER_REQUEST_LENGTH) {
        res.status(413).json({
          error: "Invalid request",
          message: `goal exceeds maximum length of ${MAX_USER_REQUEST_LENGTH} characters`,
        });
        return;
      }

      logger.debug(
        { requestId: req.id, goalLength: goal.length },
        "G-Agent plan generation request",
      );

      // Check for matching patterns in memory (reuse if high confidence)
      let matchedPattern = null;
      let plan: RustPlan;

      try {
        const patterns = await gAgentMemoryService.findPatterns(goal, 1);
        if (patterns.length > 0 && patterns[0].confidence >= 0.8) {
          matchedPattern = patterns[0];
          logger.info(
            {
              requestId: req.id,
              patternId: matchedPattern.id,
              confidence: matchedPattern.confidence,
            },
            "G-Agent: Reusing pattern from memory",
          );
        }
      } catch (patternErr) {
        logger.debug(
          { error: (patternErr as Error).message },
          "G-Agent: Pattern lookup failed, proceeding with fresh plan",
        );
      }

      if (matchedPattern) {
        // Convert pattern to plan format
        plan = {
          id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          goal,
          tasks: matchedPattern.tasks.map((pt, idx) => ({
            id: `task_${idx + 1}`,
            description: pt.description,
            feature: pt.feature,
            action: pt.action,
            tools: pt.tools,
            risk: "safe" as const,
            depends_on: idx > 0 ? [`task_${idx}`] : [],
            blocks:
              idx < matchedPattern.tasks.length - 1 ? [`task_${idx + 2}`] : [],
            estimated_seconds: Math.round(
              matchedPattern.avgDurationMs / matchedPattern.tasks.length / 1000,
            ),
            priority: matchedPattern.tasks.length - idx,
            parallelizable: false,
          })),
          execution_order: matchedPattern.tasks.map(
            (_, idx) => `task_${idx + 1}`,
          ),
          parallel_batches: matchedPattern.tasks.map((_, idx) => [
            `task_${idx + 1}`,
          ]),
          status: "awaiting_approval" as const,
          risk: {
            level: "safe" as const,
            safe_count: matchedPattern.tasks.length,
            moderate_count: 0,
            risky_count: 0,
            risk_factors: [],
            auto_approvable: true,
          },
          confidence: matchedPattern.confidence,
          estimated_duration: Math.round(matchedPattern.avgDurationMs / 1000),
          project_type: "general",
          architecture_pattern: "unknown",
          tech_stack: matchedPattern.tools,
        };
      } else {
        plan = await runPlanCli(goal);
      }

      logger.info(
        {
          requestId: req.id,
          planId: plan.id,
          taskCount: plan.tasks.length,
          batchCount: plan.parallel_batches.length,
          riskLevel: plan.risk.level,
          confidence: plan.confidence,
        },
        "G-Agent plan generated",
      );

      res.json({ plan });
    } catch (error: unknown) {
      logger.error(
        { error, requestId: req.id },
        "G-Agent plan generation failed",
      );
      sendServerError(res, error);
    }
  },
);

/**
 * GET /api/plan/:id
 * Get plan details
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const plan = await getPlan(id);

    if (!plan) {
      res.status(404).json({
        error: "Plan not found",
        message: `Plan ${id} does not exist`,
      });
      return;
    }

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, "Get plan failed");
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/approve
 * Approve plan for execution
 */
router.post(
  "/:id/approve",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { approved, comments }: PlanApprovalRequest = req.body;

      if (approved === false) {
        const plan = await rejectPlan(id, comments);
        res.json({ plan });
        return;
      }

      const plan = await approvePlan(id, req.headers["x-user-id"] as string);

      res.json({ plan });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Plan approval failed");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/plan/:id/reject
 * Reject plan
 */
router.post(
  "/:id/reject",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { comments }: { comments?: string } = req.body;

      const plan = await rejectPlan(id, comments);

      res.json({ plan });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Plan rejection failed");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/plan/:id/edit
 * Edit plan before approval
 */
router.post("/:id/edit", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const edits: PlanEditRequest = req.body;

    const plan = await editPlan(id, edits);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, "Plan edit failed");
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/execute
 * Start plan execution
 */
router.post(
  "/:id/execute",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const executionRequest: PlanExecutionRequest = req.body;

      if (executionRequest.planId !== id) {
        res.status(400).json({
          error: "Invalid request",
          message: "planId in body must match URL parameter",
        });
        return;
      }

      const plan = await startPlanExecution(id);

      // If starting from a specific phase, update phase statuses
      if (executionRequest.startFromPhase) {
        const phaseIndex = plan.phases.findIndex(
          (p: { id: string }) => p.id === executionRequest.startFromPhase,
        );
        if (phaseIndex > 0) {
          // Mark previous phases as completed
          for (let i = 0; i < phaseIndex; i++) {
            if (!executionRequest.skipPhases?.includes(plan.phases[i].id)) {
              await updatePhaseStatus(id, plan.phases[i].id, "completed");
            }
          }
        }
      }

      // Skip specified phases
      if (executionRequest.skipPhases) {
        for (const phaseId of executionRequest.skipPhases) {
          await updatePhaseStatus(id, phaseId as PlanPhase, "skipped");
        }
      }

      const updatedPlan = await getPlan(id);
      res.json({ plan: updatedPlan });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Plan execution start failed");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/plan/:id/complete
 * Complete plan execution
 */
router.post(
  "/:id/complete",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const plan = await completePlanExecution(id);

      res.json({ plan });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Plan completion failed");
      sendServerError(res, error);
    }
  },
);

/**
 * POST /api/plan/:id/phase/:phaseId/status
 * Update phase status
 */
router.post(
  "/:id/phase/:phaseId/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, phaseId } = req.params as { id: string; phaseId: string };
      const {
        status,
      }: { status: "pending" | "in_progress" | "completed" | "skipped" } =
        req.body;

      if (
        !["pending", "in_progress", "completed", "skipped"].includes(status)
      ) {
        res.status(400).json({
          error: "Invalid status",
          message:
            "Status must be one of: pending, in_progress, completed, skipped",
        });
        return;
      }

      const plan = await updatePhaseStatus(id, phaseId as PlanPhase, status);

      res.json({ plan });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Phase status update failed");
      sendServerError(res, error);
    }
  },
);

// ============================================================================
// G-AGENT TASK EXECUTION (SSE STREAMING)
// ============================================================================

// In-memory cache for plans pending execution (cleared after execution starts)
// Reserved for future use when plan caching is implemented
const _pendingPlans = new Map<string, RustPlan>();

/**
 * POST /api/plan/execute-rust
 * Execute a Rust-generated plan with SSE streaming for real-time progress.
 *
 * Body: { plan: Plan, workspaceRoot?: string }
 *
 * SSE Events:
 * - plan_started: Plan execution begins
 * - batch_started: A batch of parallel tasks begins
 * - task_started: A single task begins execution
 * - task_tool_call: Task invokes a tool
 * - task_tool_result: Tool execution result
 * - task_completed: Task finished successfully
 * - task_failed: Task failed with error
 * - batch_completed: Batch finished
 * - plan_completed: Plan execution finished (completed/failed/cancelled)
 * - error: Error occurred
 * - done: Stream complete
 */
router.post(
  "/execute-rust",
  async (req: Request, res: Response): Promise<void> => {
    const { plan, workspaceRoot } = req.body as {
      plan?: RustPlan;
      workspaceRoot?: string;
    };

    if (!plan || !plan.id || !Array.isArray(plan.tasks)) {
      res.status(400).json({
        error: "Invalid request",
        message: "plan object with id and tasks array is required",
      });
      return;
    }

    logger.info(
      {
        requestId: req.id,
        planId: plan.id,
        taskCount: plan.tasks.length,
        batchCount: plan.parallel_batches?.length ?? 0,
      },
      "G-Agent plan execution starting",
    );

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Handle client disconnect
    let isClientConnected = true;
    const abortController = new AbortController();

    req.on("close", () => {
      isClientConnected = false;
      abortController.abort();
      logger.debug(
        { requestId: req.id, planId: plan.id },
        "Client disconnected during plan execution",
      );
    });

    req.on("error", (error) => {
      isClientConnected = false;
      abortController.abort();
      logger.error(
        { error, requestId: req.id, planId: plan.id },
        "Client error during plan execution",
      );
    });

    try {
      // Execute the plan and stream events
      for await (const event of gAgentTaskExecutor.executePlan(
        plan,
        workspaceRoot,
        abortController.signal,
      )) {
        if (!isClientConnected) break;

        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // Flush for real-time delivery
        if (
          typeof (res as unknown as { flush?: () => void }).flush === "function"
        ) {
          (res as unknown as { flush: () => void }).flush();
        }

        // Stop if done
        if (event.type === "done") break;
      }

      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message, requestId: req.id, planId: plan.id },
        "Plan execution error",
      );

      if (isClientConnected) {
        writeSSEError(res, error);
      }
    }
  },
);

/**
 * POST /api/plan/:id/cancel-execution
 * Cancel an active plan execution
 */
router.post(
  "/:id/cancel-execution",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };

      const cancelled = gAgentTaskExecutor.cancelExecution(id);

      if (!cancelled) {
        res.status(404).json({
          error: "Execution not found",
          message: `No active execution for plan ${id}`,
        });
        return;
      }

      logger.info(
        { requestId: req.id, planId: id },
        "Plan execution cancelled",
      );
      res.json({ cancelled: true, planId: id });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Cancel execution failed");
      sendServerError(res, error);
    }
  },
);

/**
 * GET /api/plan/:id/execution-status
 * Get the status of an active plan execution
 */
router.get(
  "/:id/execution-status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };

      const status = gAgentTaskExecutor.getExecutionStatus(id);

      if (!status) {
        res.status(404).json({
          error: "Execution not found",
          message: `No active execution for plan ${id}`,
        });
        return;
      }

      res.json({ planId: id, ...status });
    } catch (error: unknown) {
      logger.error({ error, requestId: req.id }, "Get execution status failed");
      sendServerError(res, error);
    }
  },
);

export default router;
