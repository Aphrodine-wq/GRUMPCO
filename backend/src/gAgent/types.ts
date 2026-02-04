/**
 * G-Agent Core Types
 *
 * Central type definitions for the unified G-Agent system.
 * This is the single source of truth for all agent-related types.
 */

// ============================================================================
// AGENT IDENTITY & REGISTRY
// ============================================================================

export type AgentType =
  // Code Generation Specialists
  | "architect"
  | "frontend"
  | "backend"
  | "devops"
  | "test"
  | "docs"
  | "security"
  | "i18n"
  // Swarm Specialists
  | "ux"
  | "perf"
  | "a11y"
  | "data"
  | "review"
  // Meta Agents
  | "supervisor"
  | "planner"
  | "executor";

export type AgentTier = "free" | "pro" | "team" | "enterprise";

export interface AgentDefinition {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  systemPrompt: string;
  tier: AgentTier;
  dependencies: AgentType[];
  maxConcurrency: number;
  timeout: number; // ms
}

export interface AgentInstance {
  id: string;
  definitionId: string;
  type: AgentType;
  status: AgentStatus;
  taskId?: string;
  goalId?: string;
  startedAt: string;
  lastHeartbeat: string;
  checkpoints: AgentCheckpoint[];
  result?: AgentResult;
}

export type AgentStatus =
  | "idle"
  | "starting"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentCheckpoint {
  id: string;
  timestamp: string;
  progress: number; // 0-100
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output: string;
  artifacts?: AgentArtifact[];
  error?: string;
  durationMs: number;
}

export interface AgentArtifact {
  type: "file" | "code" | "diagram" | "report";
  path?: string;
  content: string;
  language?: string;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

export type AgentMode =
  | "chat" // Interactive chat with agent
  | "goal" // Submit a goal to the queue
  | "plan" // Generate a plan (no execution)
  | "execute" // Execute a plan
  | "swarm" // Multi-agent decomposition
  | "codegen" // Full code generation pipeline
  | "autonomous"; // Long-running autonomous operation

export interface AgentRequest {
  /** User's message or goal description */
  message: string;

  /** Requested mode (auto-detected if not specified) */
  mode?: AgentMode;

  /** User ID for auth and personalization */
  userId: string;

  /** User's subscription tier */
  userTier: AgentTier;

  /** Workspace root for file operations */
  workspaceRoot?: string;

  /** Session ID for continuing a conversation */
  sessionId?: string;

  /** Goal ID if executing/continuing a goal */
  goalId?: string;

  /** Plan ID if executing a pre-approved plan */
  planId?: string;

  /** Enabled capabilities */
  capabilities?: string[];

  /** External domain allowlist */
  externalAllowlist?: string[];

  /** Whether to auto-approve actions */
  autonomous?: boolean;

  /** Priority for queued operations */
  priority?: "low" | "normal" | "high" | "urgent";

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Additional context */
  context?: {
    projectType?: string;
    techStack?: string[];
    previousMessages?: AgentMessage[];
    ragContext?: string;
  };
}

export interface AgentResponse {
  /** Request ID for tracking */
  requestId: string;

  /** Mode that was used */
  mode: AgentMode;

  /** Session ID (created or continued) */
  sessionId: string;

  /** Goal ID if a goal was created */
  goalId?: string;

  /** Plan ID if a plan was generated */
  planId?: string;

  /** Success status */
  success: boolean;

  /** Agent's response message */
  message: string;

  /** Structured output */
  output?: {
    plan?: Plan;
    artifacts?: AgentArtifact[];
    agents?: AgentInstance[];
    /** True if project tests passed after codegen; false if run and failed */
    testsPassed?: boolean;
    /** Test run output (stdout/stderr) when tests were run */
    testsOutput?: string;
    /** True if project lint passed after codegen; false if run and failed */
    lintPassed?: boolean;
    /** Lint run output when lint was run */
    lintOutput?: string;
    /** Security scan summary (e.g. "0 critical, 2 high") when scan was run */
    securitySummary?: string;
    /** Whether README and/or .env.example were written by post-codegen doc generator */
    docsGenerated?: { readmeWritten: boolean; envExampleWritten: boolean };
    /** Bundle size report for frontend projects (e.g. "total 420 KB") */
    bundleSize?: string;
  };

  /** Error information */
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };

  /** Usage statistics */
  usage?: {
    tokensIn: number;
    tokensOut: number;
    cost: number;
    durationMs: number;
  };
}

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

// ============================================================================
// GOALS & PLANS
// ============================================================================

export type GoalStatus =
  | "pending"
  | "scheduled"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type GoalPriority = "low" | "normal" | "high" | "urgent";

export type GoalTrigger =
  | "immediate"
  | "scheduled"
  | "cron"
  | "webhook"
  | "file_change"
  | "self_scheduled";

export interface Goal {
  id: string;
  userId: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  trigger: GoalTrigger;

  // Scheduling
  scheduledAt?: string;
  cronExpression?: string;
  nextRunAt?: string;

  // Execution context
  workspaceRoot?: string;
  planId?: string;
  sessionId?: string;

  // Hierarchy
  parentGoalId?: string;
  childGoalIds: string[];

  // Checkpoints for resume
  checkpoints: GoalCheckpoint[];
  currentCheckpointId?: string;

  // Results
  result?: string;
  error?: string;
  artifacts?: AgentArtifact[];

  // Metadata
  tags: string[];
  retryCount: number;
  maxRetries: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GoalCheckpoint {
  id: string;
  goalId: string;
  phase: string;
  progress: number; // 0-100
  state: Record<string, unknown>;
  createdAt: string;
}

export interface Plan {
  id: string;
  goalId?: string;
  goal: string;
  tasks: Task[];
  parallelBatches: string[][];
  estimatedDurationMs: number;
  status: "draft" | "approved" | "executing" | "completed" | "failed";
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Task {
  id: string;
  planId: string;
  description: string;
  feature: string;
  action: string;
  tools: string[];
  dependsOn: string[];
  status: TaskStatus;
  output?: string;
  error?: string;
  durationMs?: number;
}

export type TaskStatus =
  | "pending"
  | "blocked"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

// ============================================================================
// TOOLS
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  output: string;
  durationMs: number;
}

// ============================================================================
// EVENTS (for SSE streaming)
// ============================================================================

export type AgentEvent =
  // Session events
  | { type: "session_start"; sessionId: string; mode: AgentMode }
  | { type: "session_end"; sessionId: string; success: boolean }

  // Goal events
  | { type: "goal_created"; goalId: string; description: string }
  | { type: "goal_started"; goalId: string }
  | { type: "goal_progress"; goalId: string; progress: number; message: string }
  | { type: "goal_checkpoint"; goalId: string; checkpoint: GoalCheckpoint }
  | { type: "goal_completed"; goalId: string; result: string }
  | { type: "goal_failed"; goalId: string; error: string }

  // Plan events
  | { type: "plan_generated"; planId: string; taskCount: number }
  | { type: "plan_approved"; planId: string }
  | { type: "plan_started"; planId: string }
  | { type: "plan_completed"; planId: string; status: "completed" | "failed" }

  // Task events
  | { type: "task_started"; taskId: string; description: string }
  | { type: "task_progress"; taskId: string; progress: number }
  | {
      type: "task_completed";
      taskId: string;
      output: string;
      durationMs: number;
    }
  | { type: "task_failed"; taskId: string; error: string }

  // Agent events
  | { type: "agent_spawned"; agentId: string; agentType: AgentType }
  | { type: "agent_started"; agentId: string }
  | { type: "agent_message"; agentId: string; message: string }
  | { type: "agent_completed"; agentId: string; result: AgentResult }

  // Agent Lightning Code Generation events
  | { type: "codegen_started"; goalId: string; projectName: string }
  | {
      type: "codegen_phase";
      goalId: string;
      phase: "analyze" | "plan" | "generate" | "validate";
      progress: number;
    }
  | {
      type: "codegen_agent";
      goalId: string;
      agentType: AgentType;
      status: "started" | "completed" | "failed";
    }
  | { type: "codegen_file"; goalId: string; path: string; language: string }
  | {
      type: "codegen_completed";
      goalId: string;
      files: number;
      agents: number;
      durationMs: number;
    }
  | { type: "codegen_failed"; goalId: string; error: string }

  // Tool events
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "tool_result"; toolResult: ToolResult }

  // Message events
  | { type: "text"; text: string }
  | { type: "thinking"; content: string }

  // Error/done
  | { type: "error"; message: string; code?: string }
  | { type: "done" };

// ============================================================================
// MEMORY & LEARNING
// ============================================================================

export interface Pattern {
  id: string;
  name: string;
  description: string;
  goal: string;
  tasks: PatternTask[];
  tools: string[];
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatternTask {
  description: string;
  feature: string;
  action: string;
  tools: string[];
  order: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: SkillStep[];
  tools: string[];
  successRate: number;
  usageCount: number;
  createdAt: string;
}

export interface SkillStep {
  order: number;
  action: string;
  tool?: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MESSAGE BUS
// ============================================================================

export type MessageBusEvent =
  | { type: "agent_spawn_request"; agentType: AgentType; taskId: string }
  | { type: "agent_status_update"; agentId: string; status: AgentStatus }
  | { type: "task_result"; taskId: string; result: AgentResult }
  | { type: "goal_update"; goalId: string; update: Partial<Goal> }
  | { type: "broadcast"; channel: string; data: unknown };

export interface MessageBusSubscription {
  id: string;
  channel: string;
  handler: (event: MessageBusEvent) => void;
}
