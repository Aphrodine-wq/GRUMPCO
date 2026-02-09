/**
 * Mode Handlers Module
 *
 * Contains all the mode-specific handler logic for G-Agent.
 * Each handler processes requests for a specific agent mode.
 */

import { agentRegistry } from "./registry.js";
import { supervisor } from "./supervisor.js";
import type {
  AgentMode,
  AgentType,
  AgentRequest,
  AgentResponse,
  AgentEvent,
  Plan,
  Goal,
} from "./types.js";
import type { Session } from "./sessionManager.js";

// ============================================================================
// TYPES
// ============================================================================

export interface HandlerContext {
  requestId: string;
  session: Session;
  emitEvent: (event: AgentEvent) => void;
  options: {
    enableAutonomous: boolean;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a plan into a human-readable message
 */
export function formatPlanMessage(plan: {
  id: string;
  tasks: Array<{ id: string; description: string }>;
}): string {
  const taskList = plan.tasks
    .map((t, i) => `${i + 1}. ${t.description}`)
    .join("\n");

  return (
    `I've created a plan with ${plan.tasks.length} tasks:\n\n${taskList}\n\n` +
    `Plan ID: ${plan.id}\n\n` +
    `Would you like me to execute this plan? Reply with "execute" or "approved" to proceed.`
  );
}

/**
 * Get the capabilities message describing what G-Agent can do
 */
export function getCapabilitiesMessage(): string {
  return `I'm G-Agent, your AI development assistant. Here's what I can do:

**Modes:**
- **goal** - Queue goals for execution (can be immediate or scheduled)
- **plan** - Generate an execution plan without running it
- **execute** - Run an approved plan
- **swarm** - Use multiple specialized agents in parallel
- **codegen** - Full code generation from a project description
- **autonomous** - Long-running autonomous operation
- **chat** - Simple Q&A and guidance

**Specialized Agents:**
${agentRegistry
  .getAll()
  .map((a) => `- **${a.name}**: ${a.description}`)
  .join("\n")}

Just tell me what you want to accomplish, and I'll figure out the best approach!`;
}

// ============================================================================
// MODE HANDLERS
// ============================================================================

/**
 * Handle goal mode - queue a goal for execution
 */
export async function handleGoalMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, emitEvent } = ctx;

  // Import goal queue lazily to avoid circular deps
  const { gAgentGoalQueue } = await import("../services/agents/gAgentGoalQueue.js");

  const goal = await gAgentGoalQueue.createGoal({
    userId: request.userId,
    description: request.message,
    priority: request.priority,
    workspaceRoot: request.workspaceRoot,
  });

  session.goalId = goal.id;

  emitEvent({
    type: "goal_created",
    goalId: goal.id,
    description: request.message,
  });

  const { messageBus } = await import("./messageBus.js");
  messageBus.goalCreated(goal as unknown as Goal);

  return {
    requestId,
    mode: "goal",
    sessionId: session.id,
    goalId: goal.id,
    success: true,
    message: `Goal created and queued. Goal ID: ${goal.id}. I'll start working on it and notify you of progress.`,
  };
}

/**
 * Handle plan mode - generate a plan without executing
 */
export async function handlePlanMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, emitEvent } = ctx;

  // Use planner agent to decompose
  const planner = agentRegistry.getByType("planner");
  if (!planner) {
    throw new Error("Planner agent not available");
  }

  // Generate plan using intent CLI (existing infrastructure)
  const { runPlanCli } = await import("../services/intent/intentCliRunner.js");
  const plan = await runPlanCli(request.message);

  session.planId = plan.id;
  session.context.plan = plan;

  emitEvent({
    type: "plan_generated",
    planId: plan.id,
    taskCount: plan.tasks.length,
  });

  return {
    requestId,
    mode: "plan",
    sessionId: session.id,
    planId: plan.id,
    success: true,
    message: formatPlanMessage(plan),
    output: {
      plan: plan as unknown as Plan,
    },
  };
}

/**
 * Handle execute mode - execute an approved plan
 */
export async function handleExecuteMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, emitEvent } = ctx;
  const planId = request.planId ?? session.planId;

  if (!planId && !session.context.plan) {
    return {
      requestId,
      mode: "execute",
      sessionId: session.id,
      success: false,
      message:
        "No plan to execute. Please generate a plan first using plan mode.",
      error: {
        code: "NO_PLAN",
        message: "No plan available for execution",
        retryable: false,
      },
    };
  }

  const plan = session.context.plan as Plan;

  emitEvent({
    type: "plan_approved",
    planId: plan.id,
  });

  // Execute via supervisor
  const events = supervisor.executePlan(plan, {
    goalId: session.goalId,
    userTier: request.userTier,
    workspaceRoot: request.workspaceRoot,
    autonomous: request.autonomous,
    onEvent: (event) => emitEvent(event),
  });

  // Collect results
  let lastTaskOutput = "";

  for await (const event of events) {
    emitEvent(event);

    if (event.type === "task_completed") {
      lastTaskOutput = event.output;
    }
  }

  return {
    requestId,
    mode: "execute",
    sessionId: session.id,
    planId: plan.id,
    success: true,
    message: `Plan execution completed. ${plan.tasks.length} tasks processed.`,
  };
}

/**
 * Handle swarm mode - multi-agent parallel execution
 */
export async function handleSwarmMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, emitEvent } = ctx;

  // Import swarm service lazily
  const { runSwarm } = await import("../services/agents/swarmService.js");

  const results: Array<{ agentId: string; output: string }> = [];
  let summaryText = "";

  const generator = runSwarm(request.message, {
    workspaceRoot: request.workspaceRoot,
    userTier: request.userTier as "free" | "pro" | "team" | "enterprise",
    userId: request.userId,
  });

  for await (const event of generator) {
    if (event.type === "agent_done") {
      results.push({
        agentId: event.agentId,
        output: event.output,
      });
      emitEvent({
        type: "agent_message",
        agentId: event.agentId,
        message: event.output,
      });
    } else if (event.type === "summary_done") {
      summaryText = event.text;
    } else if (event.type === "agent_start") {
      emitEvent({
        type: "agent_spawned",
        agentId: event.agentId,
        agentType: event.agentId as AgentType,
      });
    }
  }

  return {
    requestId,
    mode: "swarm",
    sessionId: session.id,
    success: true,
    message: summaryText || `Swarm completed with ${results.length} agents.`,
  };
}

/**
 * Handle codegen mode - full code generation pipeline via Agent Lightning
 *
 * This mode triggers the full Agent Lightning code generation system,
 * using the swarm and code generation agents to build complete projects.
 */
export async function handleCodegenMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, emitEvent } = ctx;

  // Import Agent Lightning bridge lazily
  const { generateCodeFromGoal } = await import("./agentLightningBridge.js");

  // Create a goal to track this codegen request
  const { gAgentGoalQueue } = await import("../services/agents/gAgentGoalQueue.js");

  const goal = await gAgentGoalQueue.createGoal({
    userId: request.userId,
    description: `Code Generation: ${request.message.slice(0, 200)}`,
    priority: request.priority ?? "normal",
    workspaceRoot: request.workspaceRoot,
    tags: ["codegen", "agent-lightning"],
  });

  session.goalId = goal.id;

  emitEvent({
    type: "goal_created",
    goalId: goal.id,
    description: `Code Generation: ${request.message.slice(0, 100)}...`,
  });

  // Run Agent Lightning code generation
  const result = await generateCodeFromGoal(request.message, {
    goalId: goal.id,
    userId: request.userId,
    userTier: request.userTier,
    workspaceRoot: request.workspaceRoot,
    projectType: request.context?.projectType as
      | "web-app"
      | "api"
      | "cli"
      | "library"
      | "mobile"
      | "fullstack"
      | undefined,
    techStack: request.context?.techStack as string[] | undefined,
    autonomous: request.autonomous,
    onProgress: (event) => {
      // Emit progress events to the session
      if (event.type === "agent_start" && event.agent) {
        emitEvent({
          type: "agent_spawned",
          agentId: `${event.agent}_${goal.id}`,
          agentType: event.agent,
        });
      } else if (event.type === "agent_end" && event.agent) {
        emitEvent({
          type: "agent_message",
          agentId: `${event.agent}_${goal.id}`,
          message: event.message,
        });
      } else if (event.type === "file_generated" && event.artifacts) {
        emitEvent({
          type: "text",
          text: `Generated: ${event.artifacts.map((a) => a.path).join(", ")}`,
        });
      }
    },
  });

  // Build response message with generated files list
  const fileList = result.files
    .slice(0, 10)
    .map((f) => `- ${f.path}`)
    .join("\n");

  const moreFiles =
    result.files.length > 10
      ? `\n... and ${result.files.length - 10} more files`
      : "";

  const successAgents = result.agents.filter(
    (a) => a.status === "completed",
  ).length;

  if (result.success) {
    emitEvent({
      type: "goal_completed",
      goalId: goal.id,
      result: result.summary,
    });

    // Post-codegen validation: tests, lint, security (secrets) when workspace is set
    let testsPassed: boolean | undefined;
    let testsOutput: string | undefined;
    let lintPassed: boolean | undefined;
    let lintOutput: string | undefined;
    let securitySummary: string | undefined;

    let docsGenerated:
      | { readmeWritten: boolean; envExampleWritten: boolean }
      | undefined;
    let bundleSize: string | undefined;

    if (request.workspaceRoot) {
      const { generateProjectDocs } =
        await import("../services/ship/generateProjectDocs.js");
      const docResult = await generateProjectDocs(request.workspaceRoot, {
        projectName: result.projectName,
      });
      if (docResult.readmeWritten || docResult.envExampleWritten) {
        docsGenerated = {
          readmeWritten: docResult.readmeWritten,
          envExampleWritten: docResult.envExampleWritten,
        };
      }

      const { runProjectTests } =
        await import("../services/ship/runProjectTests.js");
      const { runProjectLint } = await import("../services/ship/runProjectLint.js");
      const testResult = await runProjectTests(request.workspaceRoot);
      testsPassed = testResult.passed;
      testsOutput = testResult.stdout ?? testResult.stderr ?? testResult.error;
      if (!testResult.passed && testResult.error) {
        testsOutput =
          (testsOutput ? testsOutput + "\n" : "") + testResult.error;
      }

      const lintResult = await runProjectLint(request.workspaceRoot);
      lintPassed = lintResult.passed;
      lintOutput = lintResult.output ?? lintResult.error;

      try {
        const { auditSecrets } =
          await import("../features/security-compliance/service.js");
        const { validateWorkspacePath } =
          await import("../features/security-compliance/service.js");
        const pathCheck = validateWorkspacePath(request.workspaceRoot);
        if (pathCheck.ok) {
          const audit = await auditSecrets({
            workspacePath: pathCheck.resolved!,
          });
          const critical = audit.findings.filter(
            (f) => f.severity === "critical",
          ).length;
          const high = audit.findings.filter(
            (f) => f.severity === "high",
          ).length;
          securitySummary = `${critical} critical, ${high} high`;
        }
      } catch (_err) {
        securitySummary = "Scan skipped";
      }

      const { runProjectBundleReport } =
        await import("../services/ship/runProjectBundleReport.js");
      const bundleResult = await runProjectBundleReport(request.workspaceRoot);
      if (bundleResult.success && bundleResult.summary) {
        bundleSize = bundleResult.summary;
      }
    }

    const validationLines: string[] = [];
    if (testsPassed !== undefined) {
      validationLines.push(`**Tests:** ${testsPassed ? "Passed" : "Failed"}`);
    }
    if (lintPassed !== undefined) {
      validationLines.push(`**Lint:** ${lintPassed ? "Passed" : "Failed"}`);
    }
    if (securitySummary !== undefined) {
      validationLines.push(`**Security (secrets):** ${securitySummary}`);
    }
    if (bundleSize !== undefined) {
      validationLines.push(`**Bundle:** ${bundleSize}`);
    }
    if (
      docsGenerated &&
      (docsGenerated.readmeWritten || docsGenerated.envExampleWritten)
    ) {
      const parts: string[] = [];
      if (docsGenerated.readmeWritten) parts.push("README");
      if (docsGenerated.envExampleWritten) parts.push(".env.example");
      validationLines.push(`**Docs:** ${parts.join(", ")} added`);
    }
    const validationBlock =
      validationLines.length > 0
        ? "\n" + validationLines.join(" | ") + "\n"
        : "";

    return {
      requestId,
      mode: "codegen",
      sessionId: session.id,
      goalId: goal.id,
      success: true,
      message:
        `🚀 **Agent Lightning Code Generation Complete!**\n\n` +
        `**Project:** ${result.projectName}\n` +
        `**Agents:** ${successAgents}/${result.agents.length} completed successfully\n` +
        `**Duration:** ${(result.durationMs / 1000).toFixed(1)}s\n` +
        validationBlock +
        `\n**Generated Files:**\n${fileList}${moreFiles}\n\n` +
        `${result.summary}`,
      output: {
        artifacts: result.files,
        testsPassed,
        testsOutput,
        lintPassed,
        lintOutput,
        securitySummary,
        docsGenerated,
        bundleSize,
      },
    };
  } else {
    emitEvent({
      type: "goal_failed",
      goalId: goal.id,
      error: result.error || "Unknown error",
    });

    return {
      requestId,
      mode: "codegen",
      sessionId: session.id,
      goalId: goal.id,
      success: false,
      message:
        `❌ **Code Generation Failed**\n\n${result.error || "Unknown error"}\n\n` +
        `**Partial Results:** ${result.files.length} files generated before failure.\n\n` +
        `You can try:\n` +
        `1. Breaking down the request into smaller goals\n` +
        `2. Using "swarm" mode for a simpler multi-agent approach\n` +
        `3. Using "goal" mode to queue the task for retry`,
      error: {
        code: "CODEGEN_FAILED",
        message: result.error || "Code generation failed",
        retryable: true,
      },
    };
  }
}

/**
 * Handle autonomous mode - long-running autonomous operation
 */
export async function handleAutonomousMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session, options } = ctx;

  if (!options.enableAutonomous) {
    return {
      requestId,
      mode: "autonomous",
      sessionId: session.id,
      success: false,
      message: "Autonomous mode is not enabled.",
      error: {
        code: "AUTONOMOUS_DISABLED",
        message: "Autonomous mode is disabled in configuration",
        retryable: false,
      },
    };
  }

  // Create goal with autonomous flag
  const { gAgentGoalQueue } = await import("../services/agents/gAgentGoalQueue.js");

  const goal = await gAgentGoalQueue.createGoal({
    userId: request.userId,
    description: request.message,
    priority: "high",
    workspaceRoot: request.workspaceRoot,
  });

  session.goalId = goal.id;

  // Start goal queue processing
  gAgentGoalQueue.startGoalQueue(request.userId);

  return {
    requestId,
    mode: "autonomous",
    sessionId: session.id,
    goalId: goal.id,
    success: true,
    message: `Autonomous mode activated. Goal ID: ${goal.id}. I'll work continuously and provide updates.`,
  };
}

/**
 * Handle chat mode - simple conversational interaction
 */
export async function handleChatMode(
  request: AgentRequest,
  ctx: HandlerContext,
): Promise<AgentResponse> {
  const { requestId, session } = ctx;

  // For chat mode, we can use the existing chat infrastructure
  // or provide direct responses for simple queries

  // Check if this is asking about capabilities
  const message = request.message.toLowerCase();

  if (message.includes("what can you do") || message.includes("help")) {
    return {
      requestId,
      mode: "chat",
      sessionId: session.id,
      success: true,
      message: getCapabilitiesMessage(),
    };
  }

  if (message.includes("status") && session.goalId) {
    const { gAgentGoalQueue } = await import("../services/agents/gAgentGoalQueue.js");
    const goal = await gAgentGoalQueue.getGoal(session.goalId);

    if (goal) {
      return {
        requestId,
        mode: "chat",
        sessionId: session.id,
        success: true,
        message: `Goal "${goal.description.slice(0, 50)}..." is currently ${goal.status}.`,
      };
    }
  }

  // Default: suggest appropriate mode
  const { detectIntent } = await import("./intentDetector.js");
  const intent = detectIntent(request.message);

  return {
    requestId,
    mode: "chat",
    sessionId: session.id,
    success: true,
    message:
      `I understand you want to: "${request.message.slice(0, 100)}..."\n\n` +
      `Based on your request, I recommend using **${intent.mode}** mode.\n\n` +
      `Would you like me to proceed with that approach?`,
  };
}
