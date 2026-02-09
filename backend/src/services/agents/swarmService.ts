/**
 * Agent swarm service – decompose user request with Kimi into subtasks,
 * run specialist agents with 2-at-a-time concurrency and dependency ordering.
 *
 * Key features:
 * - Dependency-aware scheduling (arch runs first, then dependent agents)
 * - 2-agent concurrency to reduce overload and improve results
 * - Real-time streaming of agent progress
 * - Persistent swarm tracking via database
 */

import logger from "../../middleware/logger.js";
import { getNimChatUrl } from "../../config/nim.js";
import { getCompletion } from "../ai-providers/llmGatewayHelper.js";
import { getDatabase } from "../../db/database.js";
import { writeAuditLog } from "../security/auditLogService.js";
import { getSwarmLimit, type TierId } from "../../config/pricing.js";
import { messageBus, CHANNELS } from "../../gAgent/messageBus.js";
import type { AgentType } from "../../gAgent/types.js";
import type {
  SwarmAgentRecord,
  SwarmStatus,
  CreateSwarmAgentInput,
} from "../../types/integrations.js";

/** Nemotron Super for swarm when USE_NEMOTRON_SWARM !== 'false'; set to 'false' to stage rollout (Kimi). */
const NIM_MODEL =
  process.env.USE_NEMOTRON_SWARM === "false"
    ? "moonshotai/kimi-k2.5"
    : "nvidia/llama-3.3-nemotron-super-49b-v1.5";

/** Default concurrency: 2 agents at a time */
const DEFAULT_CONCURRENCY = 2;

export const SWARM_AGENT_IDS = [
  "arch",
  "frontend",
  "backend",
  "devops",
  "test",
  "docs",
  "ux",
  "security",
  "perf",
  "a11y",
  "data",
  "review",
] as const;

export type SwarmAgentId = (typeof SWARM_AGENT_IDS)[number];

/**
 * Agent dependency graph
 * An agent can only start when all its dependencies have completed
 */
export const AGENT_DEPENDENCIES: Record<SwarmAgentId, SwarmAgentId[]> = {
  arch: [], // No dependencies - runs first
  frontend: ["arch"], // Needs architecture
  backend: ["arch"], // Needs architecture
  devops: ["arch"], // Needs architecture
  data: ["arch"], // Needs architecture
  ux: ["arch"], // Needs architecture
  test: ["frontend", "backend"], // Needs code to test
  docs: ["frontend", "backend"], // Needs code to document
  security: ["backend"], // Needs backend to review
  perf: ["frontend", "backend"], // Needs code to optimize
  a11y: ["frontend", "ux"], // Needs UI to check
  review: ["frontend", "backend", "test"], // Final review
};

export interface SwarmTask {
  agentId: string;
  task: string;
  priority?: number; // Lower = higher priority
}

export interface SwarmAgentResult {
  agentId: string;
  task: string;
  output: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface SwarmOptions {
  workspaceRoot?: string;
  /** Max concurrent agents (default: 2) */
  concurrency?: number;
  /** User tier for swarm limits */
  userTier?: TierId;
  /** User ID for audit logging */
  userId?: string;
  /** Goal ID for MessageBus tracking */
  goalId?: string;
  /** Whether to publish events to MessageBus (default: true) */
  publishToMessageBus?: boolean;
  /** Override default model (Kimi); use NVIDIA NIM models */
  modelPreference?: { provider: "nim"; modelId: string };
}

export type SwarmProgressEvent =
  | { type: "decompose_start" }
  | { type: "decompose_done"; tasks: SwarmTask[] }
  | {
    type: "queue_status";
    pending: number;
    running: number;
    completed: number;
  }
  | { type: "agent_start"; agentId: string; task: string; slot: number }
  | {
    type: "agent_done";
    agentId: string;
    output: string;
    error?: string;
    durationMs: number;
  }
  | { type: "agent_waiting"; agentId: string; waitingFor: string[] }
  | { type: "summary_start" }
  | { type: "summary_done"; text: string }
  | { type: "error"; message: string };

const DECOMPOSE_SYSTEM = `You are an orchestrator. Decompose the user's request into subtasks and assign each to exactly one specialist agent.
Available agents: ${SWARM_AGENT_IDS.join(", ")}.
Reply with ONLY a JSON object: { "tasks": [ { "agentId": "<agent>", "task": "<description>" } ] }.
Use 1–8 tasks. No markdown, no explanation.`;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  arch: "You are the Architecture agent. Output a concise architecture plan or diagram description.",
  frontend: "You are the Frontend agent. Output code or specs for UI/frontend.",
  backend:
    "You are the Backend agent. Output code or specs for APIs and server logic.",
  devops: "You are the DevOps agent. Output CI/CD or deployment steps.",
  test: "You are the Test agent. Output test cases or test code.",
  docs: "You are the Docs agent. Output documentation or README content.",
  ux: "You are the UX agent. Output UX notes or accessibility recommendations.",
  security:
    "You are the Security agent. Output security review or hardening steps.",
  perf: "You are the Perf agent. Output performance recommendations.",
  a11y: "You are the A11y agent. Output accessibility improvements.",
  data: "You are the Data agent. Output data model or migration notes.",
  review: "You are the Review agent. Output a short code review or checklist.",
};

function getAgentSystemPrompt(agentId: string): string {
  return (
    AGENT_SYSTEM_PROMPTS[agentId] ??
    `You are the ${agentId} specialist. Complete the task concisely.`
  );
}

async function nimChat(system: string, user: string): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY is not set");
  const res = await fetch(getNimChatUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NIM chat: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  return content;
}

async function llmCompletion(
  system: string,
  user: string,
  modelPreference?: { provider: "nim"; modelId: string },
): Promise<string> {
  // All completions go through NVIDIA NIM
  const model = modelPreference?.modelId || NIM_MODEL;
  return nimChat(system, user);
}

function parseTasksJson(raw: string): SwarmTask[] {
  const trimmed = raw
    .replace(/^```\w*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in decompose response");
  const parsed = JSON.parse(match[0]) as {
    tasks?: Array<{ agentId?: string; task?: string }>;
  };
  const tasks = parsed.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  return tasks
    .filter(
      (t) => t && typeof t.agentId === "string" && typeof t.task === "string",
    )
    .map((t) => ({ agentId: t.agentId as string, task: t.task as string }))
    .slice(0, 20);
}

/**
 * Calculate task priority based on dependency depth
 * Lower priority number = runs earlier
 */
function calculatePriority(agentId: string): number {
  const deps = AGENT_DEPENDENCIES[agentId as SwarmAgentId] || [];
  if (deps.length === 0) return 0; // No deps = highest priority

  // Recursive depth calculation
  let maxDepth = 0;
  for (const dep of deps) {
    const depPriority = calculatePriority(dep);
    maxDepth = Math.max(maxDepth, depPriority + 1);
  }
  return maxDepth;
}

/**
 * Sort tasks by dependency order
 */
function sortTasksByDependency(tasks: SwarmTask[]): SwarmTask[] {
  return tasks
    .map((t) => ({ ...t, priority: calculatePriority(t.agentId) }))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

/**
 * Check if all dependencies for an agent are satisfied
 */
function areDependenciesSatisfied(
  agentId: string,
  completedAgents: Set<string>,
  activeAgents: Set<string>,
): { satisfied: boolean; waiting: string[] } {
  const deps = AGENT_DEPENDENCIES[agentId as SwarmAgentId] || [];
  const _waiting = deps.filter(
    (dep) => !completedAgents.has(dep) && activeAgents.has(dep),
  );
  const unsatisfied = deps.filter((dep) => !completedAgents.has(dep));

  return {
    satisfied: unsatisfied.length === 0,
    waiting: unsatisfied,
  };
}

/**
 * Run a single agent task
 */
async function runAgentTask(
  task: SwarmTask,
  userPrompt: string,
  completedResults: Map<string, SwarmAgentResult>,
  modelPreference?: { provider: "nim"; modelId: string },
): Promise<SwarmAgentResult> {
  const startedAt = Date.now();

  try {
    const deps = AGENT_DEPENDENCIES[task.agentId as SwarmAgentId] || [];
    let context = "";
    for (const dep of deps) {
      const depResult = completedResults.get(dep);
      if (depResult && depResult.output) {
        context += `\n\n[${dep} output]\n${depResult.output.slice(0, 2000)}`;
      }
    }

    const system = getAgentSystemPrompt(task.agentId);
    const prompt = `Task: ${task.task}\n\nOriginal request: ${userPrompt}${context ? "\n\nContext from previous agents:" + context : ""}`;

    const output = await llmCompletion(system, prompt, modelPreference);
    const completedAt = Date.now();

    return {
      agentId: task.agentId,
      task: task.task,
      output,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    };
  } catch (e) {
    const completedAt = Date.now();
    return {
      agentId: task.agentId,
      task: task.task,
      output: "",
      error: (e as Error).message,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    };
  }
}

/**
 * Run swarm with 2-at-a-time concurrency and dependency ordering
 * Publishes events to MessageBus for unified agent tracking
 */
export async function* runSwarm(
  userPrompt: string,
  options?: SwarmOptions,
): AsyncGenerator<
  SwarmProgressEvent,
  { summary: string; results: SwarmAgentResult[] },
  unknown
> {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const userTier = options?.userTier ?? "free";
  const maxAgents = getSwarmLimit(userTier);
  const publishEvents = options?.publishToMessageBus !== false;
  const goalId = options?.goalId;

  const completedResults = new Map<string, SwarmAgentResult>();
  const completedAgents = new Set<string>();
  const activeAgents = new Map<string, Promise<SwarmAgentResult>>();
  const agentInstanceIds = new Map<string, string>(); // agentId -> instanceId for tracking
  const results: SwarmAgentResult[] = [];

  const modelPreference = options?.modelPreference;

  // Phase 1: Decompose
  yield { type: "decompose_start" };
  let tasks: SwarmTask[];
  try {
    const raw = await llmCompletion(
      DECOMPOSE_SYSTEM,
      userPrompt,
      modelPreference,
    );
    tasks = parseTasksJson(raw);
  } catch (e) {
    const msg = (e as Error).message;
    logger.warn({ error: msg }, "Swarm decompose failed");
    yield { type: "error", message: msg };
    return { summary: "", results: [] };
  }

  // Apply tier limit
  if (tasks.length > maxAgents) {
    tasks = tasks.slice(0, maxAgents);
    logger.info(
      { tier: userTier, limit: maxAgents },
      "Swarm tasks limited by tier",
    );
  }

  // Sort by dependency order
  tasks = sortTasksByDependency(tasks);

  yield { type: "decompose_done", tasks };

  if (tasks.length === 0) {
    yield {
      type: "summary_done",
      text: "No subtasks were generated. Try rephrasing your request.",
    };
    return { summary: "No subtasks.", results: [] };
  }

  // Phase 2: Execute with dependency-aware scheduling
  const pendingTasks = [...tasks];
  let slot = 0;

  while (pendingTasks.length > 0 || activeAgents.size > 0) {
    // Fill available slots with ready tasks
    while (activeAgents.size < concurrency && pendingTasks.length > 0) {
      // Find next task whose dependencies are satisfied
      const readyIndex = pendingTasks.findIndex((task) => {
        const { satisfied } = areDependenciesSatisfied(
          task.agentId,
          completedAgents,
          new Set(activeAgents.keys()),
        );
        return satisfied;
      });

      if (readyIndex === -1) {
        // No ready tasks, but some are pending - must wait for active ones
        break;
      }

      const task = pendingTasks.splice(readyIndex, 1)[0];
      slot++;

      // Generate instance ID for tracking
      const instanceId = `swarm_${task.agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      agentInstanceIds.set(task.agentId, instanceId);

      yield {
        type: "agent_start",
        agentId: task.agentId,
        task: task.task,
        slot,
      };

      // Publish to MessageBus for unified agent tracking
      if (publishEvents) {
        messageBus.updateAgentStatus(
          instanceId,
          task.agentId as AgentType,
          "running",
          {
            taskId: instanceId,
            message: task.task,
          },
        );

        // Publish task progress
        messageBus.updateTaskProgress(
          instanceId,
          instanceId,
          0,
          `Starting ${task.agentId} agent`,
        );
      }

      const promise = runAgentTask(
        task,
        userPrompt,
        completedResults,
        modelPreference,
      );
      activeAgents.set(task.agentId, promise);
    }

    // Emit queue status
    yield {
      type: "queue_status",
      pending: pendingTasks.length,
      running: activeAgents.size,
      completed: completedAgents.size,
    };

    // Wait for any active agent to complete
    if (activeAgents.size > 0) {
      const entries = Array.from(activeAgents.entries());
      const raceResult = await Promise.race(
        entries.map(async ([agentId, promise]) => {
          const result = await promise;
          return { agentId, result };
        }),
      );

      // Process completed agent
      const { agentId, result } = raceResult;
      activeAgents.delete(agentId);
      completedAgents.add(agentId);
      completedResults.set(agentId, result);
      results.push(result);

      // Get the instance ID for this agent
      const instanceId = agentInstanceIds.get(agentId) || agentId;

      yield {
        type: "agent_done",
        agentId: result.agentId,
        output: result.output,
        error: result.error,
        durationMs: result.durationMs || 0,
      };

      // Publish to MessageBus for unified agent tracking
      if (publishEvents) {
        if (result.error) {
          messageBus.failTask(instanceId, instanceId, result.error, false);
          messageBus.updateAgentStatus(
            instanceId,
            agentId as AgentType,
            "failed",
            {
              taskId: instanceId,
              message: result.error,
            },
          );
        } else {
          messageBus.completeTask(
            instanceId,
            instanceId,
            result.output,
            result.durationMs || 0,
          );
          messageBus.updateAgentStatus(
            instanceId,
            agentId as AgentType,
            "completed",
            {
              taskId: instanceId,
              progress: 100,
            },
          );
        }
      }

      // Check for waiting agents
      for (const task of pendingTasks) {
        const { satisfied, waiting } = areDependenciesSatisfied(
          task.agentId,
          completedAgents,
          new Set(activeAgents.keys()),
        );
        if (!satisfied && waiting.length > 0) {
          yield {
            type: "agent_waiting",
            agentId: task.agentId,
            waitingFor: waiting,
          };
        }
      }
    }
  }

  // Phase 3: Summarize
  yield { type: "summary_start" };
  const context = results
    .map((r) => `[${r.agentId}]\n${r.error ? r.error : r.output}`)
    .join("\n\n---\n\n");
  let summary = "";
  try {
    summary = await llmCompletion(
      "You are a summarizer. Synthesize the following agent outputs into one coherent response for the user. Be concise.",
      `Original request: ${userPrompt}\n\nAgent outputs:\n\n${context}`,
      modelPreference,
    );
  } catch (e) {
    summary = `Summary failed: ${(e as Error).message}. Raw outputs:\n${context.slice(0, 2000)}`;
  }

  // Audit log
  if (options?.userId) {
    await writeAuditLog({
      userId: options.userId,
      action: "swarm.completed",
      category: "agent",
      target: "swarm",
      metadata: {
        taskCount: tasks.length,
        successCount: results.filter((r) => !r.error).length,
        totalDurationMs: results.reduce(
          (sum, r) => sum + (r.durationMs || 0),
          0,
        ),
      },
    });
  }

  // Publish goal completion to MessageBus if goalId was provided
  if (publishEvents && goalId) {
    const failedCount = results.filter((r) => r.error).length;
    if (failedCount === 0) {
      messageBus.goalCompleted(goalId, summary);
    } else {
      messageBus.goalUpdated(goalId, {
        status: "completed",
        result: summary,
        error: `${failedCount} of ${results.length} agents failed`,
      });
    }
  }

  yield { type: "summary_done", text: summary };
  return { summary, results };
}

// ========== Persistent Swarm Management ==========

/**
 * Create a persistent swarm agent record
 */
export async function createPersistentSwarmAgent(
  input: CreateSwarmAgentInput,
): Promise<SwarmAgentRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const record: SwarmAgentRecord = {
    id: `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    name: input.name,
    status: "pending",
    agent_type: input.agentType,
    task_description: input.taskDescription ?? null,
    result: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await db.saveSwarmAgent(record);

  await writeAuditLog({
    userId: input.userId,
    action: "swarm.agent_created",
    category: "agent",
    target: input.name,
    metadata: {
      agentId: record.id,
      agentType: input.agentType,
      parentId: input.parentId,
    },
  });

  logger.info(
    { id: record.id, name: input.name, type: input.agentType },
    "Persistent swarm agent created",
  );

  return record;
}

/**
 * Get swarm agent by ID
 */
export async function getSwarmAgentById(
  id: string,
): Promise<SwarmAgentRecord | null> {
  const db = getDatabase();
  return db.getSwarmAgent(id);
}

/**
 * Get child agents for a parent swarm
 */
export async function getSwarmChildren(
  parentId: string,
): Promise<SwarmAgentRecord[]> {
  const db = getDatabase();
  return db.getSwarmChildren(parentId);
}

/**
 * Get all running swarm agents
 */
export async function getRunningSwarmAgents(): Promise<SwarmAgentRecord[]> {
  const db = getDatabase();
  return db.getRunningSwarmAgents();
}

/**
 * Update swarm agent status
 */
export async function updateSwarmAgentStatus(
  id: string,
  status: SwarmStatus,
  result?: unknown,
): Promise<void> {
  const db = getDatabase();
  const record = await db.getSwarmAgent(id);
  if (!record) {
    throw new Error(`Swarm agent not found: ${id}`);
  }

  const now = new Date().toISOString();
  const updated: SwarmAgentRecord = {
    ...record,
    status,
    result: result !== undefined ? JSON.stringify(result) : record.result,
    updated_at: now,
    completed_at: ["completed", "failed", "cancelled"].includes(status)
      ? now
      : null,
  };

  await db.saveSwarmAgent(updated);
  logger.debug({ id, name: record.name, status }, "Swarm agent status updated");
}

/**
 * Complete a swarm agent with result
 */
export async function completeSwarmAgent(
  id: string,
  result: unknown,
  userId: string,
): Promise<void> {
  await updateSwarmAgentStatus(id, "completed", result);

  const db = getDatabase();
  const record = await db.getSwarmAgent(id);

  await writeAuditLog({
    userId,
    action: "swarm.agent_completed",
    category: "agent",
    target: record?.name ?? id,
    metadata: { agentId: id },
  });
}

/**
 * Fail a swarm agent with error
 */
export async function failSwarmAgent(
  id: string,
  error: string,
  userId: string,
): Promise<void> {
  await updateSwarmAgentStatus(id, "failed", { error });

  const db = getDatabase();
  const record = await db.getSwarmAgent(id);

  await writeAuditLog({
    userId,
    action: "swarm.agent_failed",
    category: "agent",
    target: record?.name ?? id,
    metadata: { agentId: id, error },
  });

  logger.error({ id, error }, "Swarm agent failed");
}

/**
 * Cancel a swarm agent
 */
export async function cancelSwarmAgent(
  id: string,
  userId: string,
): Promise<void> {
  await updateSwarmAgentStatus(id, "cancelled");

  const db = getDatabase();
  const record = await db.getSwarmAgent(id);

  await writeAuditLog({
    userId,
    action: "swarm.agent_cancelled",
    category: "agent",
    target: record?.name ?? id,
    metadata: { agentId: id },
  });
}

/**
 * Get swarm progress
 */
export async function getSwarmProgress(swarmId: string): Promise<{
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}> {
  const children = await getSwarmChildren(swarmId);

  return {
    total: children.length,
    pending: children.filter((c) => c.status === "pending").length,
    running: children.filter((c) => c.status === "running").length,
    completed: children.filter((c) => c.status === "completed").length,
    failed: children.filter((c) => c.status === "failed").length,
    cancelled: children.filter((c) => c.status === "cancelled").length,
  };
}

/**
 * Check if all children of a swarm are complete
 */
export async function isSwarmComplete(swarmId: string): Promise<boolean> {
  const children = await getSwarmChildren(swarmId);
  return children.every((child) =>
    ["completed", "failed", "cancelled"].includes(child.status),
  );
}

// Re-export types for convenience
export type { SwarmAgentRecord, SwarmStatus, CreateSwarmAgentInput };
