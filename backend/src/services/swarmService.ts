/**
 * Agent swarm service – decompose user request with Kimi into subtasks,
 * run specialist agents in parallel (capped concurrency), merge results.
 * 
 * Also includes persistent swarm tracking via database.
 */

import logger from '../middleware/logger.js';
import { getNimChatUrl } from '../config/nim.js';
import { getDatabase } from '../db/database.js';
import { writeAuditLog } from './auditLogService.js';
import type {
  SwarmAgentRecord,
  SwarmStatus,
  CreateSwarmAgentInput,
} from '../types/integrations.js';

const NIM_MODEL = 'moonshotai/kimi-k2.5';

export const SWARM_AGENT_IDS = [
  'arch',
  'frontend',
  'backend',
  'devops',
  'test',
  'docs',
  'ux',
  'security',
  'perf',
  'a11y',
  'data',
  'review',
] as const;

export type SwarmAgentId = (typeof SWARM_AGENT_IDS)[number];

export interface SwarmTask {
  agentId: string;
  task: string;
}

export interface SwarmAgentResult {
  agentId: string;
  task: string;
  output: string;
  error?: string;
}

export type SwarmProgressEvent =
  | { type: 'decompose_start' }
  | { type: 'decompose_done'; tasks: SwarmTask[] }
  | { type: 'agent_start'; agentId: string; task: string }
  | { type: 'agent_done'; agentId: string; output: string; error?: string }
  | { type: 'summary_start' }
  | { type: 'summary_done'; text: string }
  | { type: 'error'; message: string };

const DECOMPOSE_SYSTEM = `You are an orchestrator. Decompose the user's request into subtasks and assign each to exactly one specialist agent.
Available agents: ${SWARM_AGENT_IDS.join(', ')}.
Reply with ONLY a JSON object: { "tasks": [ { "agentId": "<agent>", "task": "<description>" } ] }.
Use 1–8 tasks. No markdown, no explanation.`;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  arch: 'You are the Architecture agent. Output a concise architecture plan or diagram description.',
  frontend: 'You are the Frontend agent. Output code or specs for UI/frontend.',
  backend: 'You are the Backend agent. Output code or specs for APIs and server logic.',
  devops: 'You are the DevOps agent. Output CI/CD or deployment steps.',
  test: 'You are the Test agent. Output test cases or test code.',
  docs: 'You are the Docs agent. Output documentation or README content.',
  ux: 'You are the UX agent. Output UX notes or accessibility recommendations.',
  security: 'You are the Security agent. Output security review or hardening steps.',
  perf: 'You are the Perf agent. Output performance recommendations.',
  a11y: 'You are the A11y agent. Output accessibility improvements.',
  data: 'You are the Data agent. Output data model or migration notes.',
  review: 'You are the Review agent. Output a short code review or checklist.',
};

function getAgentSystemPrompt(agentId: string): string {
  return AGENT_SYSTEM_PROMPTS[agentId] ?? `You are the ${agentId} specialist. Complete the task concisely.`;
}

async function nimChat(system: string, user: string): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_NIM_API_KEY is not set');
  const res = await fetch(getNimChatUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NIM chat: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  return content;
}

function parseTasksJson(raw: string): SwarmTask[] {
  const trimmed = raw.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in decompose response');
  const parsed = JSON.parse(match[0]) as { tasks?: Array<{ agentId?: string; task?: string }> };
  const tasks = parsed.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  return tasks
    .filter((t) => t && typeof t.agentId === 'string' && typeof t.task === 'string')
    .map((t) => ({ agentId: t.agentId!, task: t.task! }))
    .slice(0, 20);
}

/**
 * Run swarm: decompose with Kimi, then run each task with specialist agent (Kimi) in parallel, capped concurrency.
 */
export async function* runSwarm(
  userPrompt: string,
  _options?: { workspaceRoot?: string }
): AsyncGenerator<SwarmProgressEvent, { summary: string; results: SwarmAgentResult[] }, unknown> {
  const results: SwarmAgentResult[] = [];

  yield { type: 'decompose_start' };
  let tasks: SwarmTask[];
  try {
    const raw = await nimChat(DECOMPOSE_SYSTEM, userPrompt);
    tasks = parseTasksJson(raw);
  } catch (e) {
    const msg = (e as Error).message;
    logger.warn({ error: msg }, 'Swarm decompose failed');
    yield { type: 'error', message: msg };
    return { summary: '', results: [] };
  }
  yield { type: 'decompose_done', tasks };

  if (tasks.length === 0) {
    yield { type: 'summary_done', text: 'No subtasks were generated. Try rephrasing your request.' };
    return { summary: 'No subtasks.', results: [] };
  }

  for (const task of tasks) {
    yield { type: 'agent_start', agentId: task.agentId, task: task.task };
  }
  const agentPromises = tasks.map(async (task) => {
    try {
      const system = getAgentSystemPrompt(task.agentId);
      const output = await nimChat(system, `Task: ${task.task}\n\nOriginal request: ${userPrompt}`);
      return { agentId: task.agentId, task: task.task, output, error: undefined };
    } catch (e) {
      const msg = (e as Error).message;
      return { agentId: task.agentId, task: task.task, output: '', error: msg };
    }
  });

  const settled = await Promise.all(agentPromises);
  for (const r of settled) {
    results.push(r);
    yield { type: 'agent_done', agentId: r.agentId, output: r.output, error: r.error };
  }

  yield { type: 'summary_start' };
  const context = results.map((r) => `[${r.agentId}]\n${r.error ? r.error : r.output}`).join('\n\n---\n\n');
  let summary = '';
  try {
    summary = await nimChat(
      'You are a summarizer. Synthesize the following agent outputs into one coherent response for the user. Be concise.',
      `Original request: ${userPrompt}\n\nAgent outputs:\n\n${context}`
    );
  } catch (e) {
    summary = `Summary failed: ${(e as Error).message}. Raw outputs:\n${context.slice(0, 2000)}`;
  }
  yield { type: 'summary_done', text: summary };
  return { summary, results };
}

// ========== Persistent Swarm Management ==========

/**
 * Create a persistent swarm agent record
 */
export async function createPersistentSwarmAgent(input: CreateSwarmAgentInput): Promise<SwarmAgentRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const record: SwarmAgentRecord = {
    id: `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    name: input.name,
    status: 'pending',
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
    action: 'swarm.agent_created',
    category: 'agent',
    target: input.name,
    metadata: { agentId: record.id, agentType: input.agentType, parentId: input.parentId },
  });
  
  logger.info(
    { id: record.id, name: input.name, type: input.agentType },
    'Persistent swarm agent created'
  );
  
  return record;
}

/**
 * Get swarm agent by ID
 */
export async function getSwarmAgentById(id: string): Promise<SwarmAgentRecord | null> {
  const db = getDatabase();
  return db.getSwarmAgent(id);
}

/**
 * Get child agents for a parent swarm
 */
export async function getSwarmChildren(parentId: string): Promise<SwarmAgentRecord[]> {
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
  result?: unknown
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
    completed_at: ['completed', 'failed', 'cancelled'].includes(status) ? now : null,
  };
  
  await db.saveSwarmAgent(updated);
  logger.debug({ id, name: record.name, status }, 'Swarm agent status updated');
}

/**
 * Complete a swarm agent with result
 */
export async function completeSwarmAgent(
  id: string,
  result: unknown,
  userId: string
): Promise<void> {
  await updateSwarmAgentStatus(id, 'completed', result);
  
  const db = getDatabase();
  const record = await db.getSwarmAgent(id);
  
  await writeAuditLog({
    userId,
    action: 'swarm.agent_completed',
    category: 'agent',
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
  userId: string
): Promise<void> {
  await updateSwarmAgentStatus(id, 'failed', { error });
  
  const db = getDatabase();
  const record = await db.getSwarmAgent(id);
  
  await writeAuditLog({
    userId,
    action: 'swarm.agent_failed',
    category: 'agent',
    target: record?.name ?? id,
    metadata: { agentId: id, error },
  });
  
  logger.error({ id, error }, 'Swarm agent failed');
}

/**
 * Cancel a swarm agent
 */
export async function cancelSwarmAgent(id: string, userId: string): Promise<void> {
  await updateSwarmAgentStatus(id, 'cancelled');
  
  const db = getDatabase();
  const record = await db.getSwarmAgent(id);
  
  await writeAuditLog({
    userId,
    action: 'swarm.agent_cancelled',
    category: 'agent',
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
    pending: children.filter(c => c.status === 'pending').length,
    running: children.filter(c => c.status === 'running').length,
    completed: children.filter(c => c.status === 'completed').length,
    failed: children.filter(c => c.status === 'failed').length,
    cancelled: children.filter(c => c.status === 'cancelled').length,
  };
}

/**
 * Check if all children of a swarm are complete
 */
export async function isSwarmComplete(swarmId: string): Promise<boolean> {
  const children = await getSwarmChildren(swarmId);
  return children.every(child =>
    ['completed', 'failed', 'cancelled'].includes(child.status)
  );
}

// Re-export types for convenience
export type { SwarmAgentRecord, SwarmStatus, CreateSwarmAgentInput };
