/**
 * Session Manager
 *
 * Handles creation, retrieval, and lifecycle management of code generation sessions.
 * Sessions track the state of multi-agent code generation workflows.
 *
 * ## Session Lifecycle
 * 1. Session initialized with preferences and PRD(s)
 * 2. Each agent task created in 'pending' state
 * 3. Pipeline executes agents, updating task status
 * 4. Session marked 'completed' or 'failed'
 *
 * ## Usage
 * ```typescript
 * // Single-PRD session
 * const session = await initializeSession({
 *   prdId: 'prd_123',
 *   architectureId: 'arch_456',
 *   preferences: { frontendFramework: 'vue', backendRuntime: 'node' }
 * });
 *
 * // Multi-PRD session
 * const multiSession = await initializeSessionMulti({
 *   prds: [{ prd: prd1, componentLabel: 'frontend' }, { prd: prd2, componentLabel: 'backend' }],
 *   architecture,
 *   preferences
 * });
 * ```
 *
 * @module agentOrchestrator/sessionManager
 */

import logger from '../../middleware/logger.js';
import { getDatabase } from '../../db/database.js';
import type {
  GenerationSession,
  AgentType,
  CodeGenRequest,
  CodeGenRequestMulti,
  AgentTask,
  SubTask,
} from '../../types/agents.js';
import type { PRD } from '../../types/prd.js';
import { resilientLlmCall, DEFAULT_AGENT_MODEL } from './shared.js';

/**
 * Initialize an agent task with default pending status.
 *
 * @param agentType - The type of agent (architect, frontend, backend, etc.)
 * @param description - Human-readable description of the task
 * @returns Initialized AgentTask object
 *
 * @example
 * ```typescript
 * const task = initializeAgentTask('frontend', 'Generate Vue components');
 * // { taskId: 'task_frontend_1234567890', agentType: 'frontend', status: 'pending', ... }
 * ```
 */
export function initializeAgentTask(agentType: AgentType, description: string): AgentTask {
  return {
    taskId: `task_${agentType}_${Date.now()}`,
    agentType,
    description,
    input: {},
    status: 'pending',
  };
}

/**
 * Initialize a new code generation session for a single PRD.
 *
 * Creates a session with all agent tasks initialized to 'pending' status.
 * The session is persisted to the database for tracking and resume capability.
 *
 * @param request - Code generation request with PRD ID, architecture ID, and preferences
 * @returns Initialized GenerationSession with unique session ID
 *
 * @example
 * ```typescript
 * const session = await initializeSession({
 *   prdId: 'prd_user_auth',
 *   architectureId: 'arch_microservices',
 *   preferences: {
 *     frontendFramework: 'react',
 *     backendRuntime: 'node',
 *     database: 'postgres',
 *     includeTests: true,
 *     includeDocs: true
 *   },
 *   projectId: 'proj_123'
 * });
 * ```
 */
export async function initializeSession(request: CodeGenRequest): Promise<GenerationSession> {
  const db = getDatabase();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const session: GenerationSession = {
    sessionId,
    status: 'initializing',
    prdId: request.prdId,
    architectureId: request.architectureId,
    createdAt: new Date().toISOString(),
    userId: request.userId,
    preferences: request.preferences,
    projectId: request.projectId,
    agents: {
      architect: initializeAgentTask('architect', 'Validate PRD and create generation plan'),
      frontend: initializeAgentTask('frontend', 'Generate frontend components and pages'),
      backend: initializeAgentTask('backend', 'Generate backend APIs and services'),
      devops: initializeAgentTask('devops', 'Generate Docker and CI/CD configs'),
      test: initializeAgentTask('test', 'Generate test suites'),
      docs: initializeAgentTask('docs', 'Generate documentation'),
      security: initializeAgentTask('security', 'Review generated code for security issues'),
      i18n: initializeAgentTask('i18n', 'Suggest or add i18n structure'),
      wrunner: initializeAgentTask('wrunner', 'WRunner analysis and auto-fix'),
    },
    generatedFiles: [],
  };

  await db.saveSession(session);
  logger.info({ sessionId }, 'Code generation session initialized');

  return session;
}

/**
 * Get session by ID from the database.
 *
 * @param sessionId - The unique session identifier
 * @returns The session if found, or null
 *
 * @example
 * ```typescript
 * const session = await getSession('session_1234567890_abc123');
 * if (session) {
 *   console.log(`Status: ${session.status}, Files: ${session.generatedFiles?.length}`);
 * }
 * ```
 */
export async function getSession(sessionId: string): Promise<GenerationSession | null> {
  const db = getDatabase();
  return await db.getSession(sessionId);
}

const SUBTASKS_PROMPT = `Break a PRD into ordered implementation sub-tasks. Return a JSON array only: [{"id":"t1","title":"...","status":"pending"}, ...]. 5–15 tasks. No markdown.`;

/**
 * Break a PRD into ordered implementation sub-tasks using LLM.
 *
 * Uses the agent model to analyze the PRD and generate 5-15 actionable sub-tasks.
 * Each sub-task represents a discrete unit of work for the code generation pipeline.
 *
 * @param prd - The PRD to analyze
 * @returns Array of SubTask objects with id, title, and pending status
 *
 * @example
 * ```typescript
 * const tasks = await breakPrdIntoSubTasks(prd);
 * // [
 * //   { id: 't1', title: 'Set up database schema', status: 'pending' },
 * //   { id: 't2', title: 'Implement user auth API', status: 'pending' },
 * //   ...
 * // ]
 * ```
 */
export async function breakPrdIntoSubTasks(prd: PRD): Promise<SubTask[]> {
  try {
    const res = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 2048,
      system: SUBTASKS_PROMPT,
      messages: [
        {
          role: 'user',
          content: `PRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nBreak into sub-tasks.`,
        },
      ],
    });

    if (res.error) {
      throw new Error(res.error);
    }

    let raw = res.text.trim();
    const arr = raw.match(/\[[\s\S]*\]/);
    if (arr) raw = arr[0];
    const parsed = JSON.parse(raw) as Array<{ id?: string; title?: string; status?: string }>;
    return (Array.isArray(parsed) ? parsed : []).map((t, i) => ({
      id: t.id || `task_${i}`,
      title: t.title || `Task ${i + 1}`,
      status: 'pending' as const,
    }));
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'Sub-task breakdown failed, using empty');
    return [];
  }
}

/**
 * Initialize session for multi-PRD code generation.
 *
 * Creates a session that coordinates code generation across multiple PRDs.
 * Each PRD is assigned to agents based on component labels, and sub-tasks
 * are generated for granular work tracking.
 *
 * @param request - Multi-PRD request with PRDs, architecture, and preferences
 * @returns Initialized GenerationSession with component mapping
 *
 * @example
 * ```typescript
 * const session = await initializeSessionMulti({
 *   prds: [
 *     { prd: dashboardPrd, componentLabel: 'frontend' },
 *     { prd: apiPrd, componentLabel: 'backend' },
 *     { prd: authPrd, componentLabel: 'auth' }
 *   ],
 *   architecture,
 *   preferences: { frontendFramework: 'vue', backendRuntime: 'node' }
 * });
 * ```
 */
export async function initializeSessionMulti(
  request: CodeGenRequestMulti
): Promise<GenerationSession> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const prds = request.prds.map((x) => x.prd);
  const subTasksByPrdId: Record<string, SubTask[]> = {};
  for (const { prd } of request.prds) {
    subTasksByPrdId[prd.id] = await breakPrdIntoSubTasks(prd);
  }
  const mapping = request.componentMapping ?? defaultComponentMapping(request.prds);
  const session: GenerationSession = {
    sessionId,
    status: 'initializing',
    prdId: prds[0]?.id ?? 'multi',
    architectureId: request.architecture.id,
    createdAt: new Date().toISOString(),
    userId: request.userId,
    preferences: request.preferences,
    projectId: request.projectId,
    prds,
    architecture: request.architecture,
    subTasksByPrdId,
    componentMapping: mapping,
    agents: {
      architect: initializeAgentTask('architect', 'Validate PRDs and create plan'),
      frontend: initializeAgentTask('frontend', 'Generate frontend'),
      backend: initializeAgentTask('backend', 'Generate backend'),
      devops: initializeAgentTask('devops', 'Generate DevOps configs'),
      test: initializeAgentTask('test', 'Generate tests'),
      docs: initializeAgentTask('docs', 'Generate docs'),
      security: initializeAgentTask('security', 'Review generated code for security issues'),
      i18n: initializeAgentTask('i18n', 'Suggest or add i18n structure'),
      wrunner: initializeAgentTask('wrunner', 'WRunner analysis and auto-fix'),
    },
    generatedFiles: [],
  };
  const db = getDatabase();
  await db.saveSession(session);
  logger.info({ sessionId, prdCount: prds.length }, 'Multi-PRD codegen session initialized');
  return session;
}

/**
 * Create default component-to-agent mapping from PRD component labels.
 *
 * Maps PRDs to agents based on their component labels:
 * - 'frontend', 'ui' → frontend agent
 * - 'api', 'backend', 'auth' → backend agent
 * - Others default to backend agent
 *
 * @param prds - Array of PRD entries with component labels
 * @returns Mapping of agent types to PRD IDs
 *
 * @example
 * ```typescript
 * const mapping = defaultComponentMapping([
 *   { prd: { id: 'prd1' }, componentLabel: 'frontend' },
 *   { prd: { id: 'prd2' }, componentLabel: 'api' }
 * ]);
 * // { frontend: ['prd1'], backend: ['prd2'] }
 * ```
 */
export function defaultComponentMapping(
  prds: CodeGenRequestMulti['prds']
): Partial<Record<AgentType, string[]>> {
  const map: Partial<Record<AgentType, string[]>> = {};
  for (const { prd, componentLabel } of prds) {
    const id = prd.id;
    const label = (componentLabel ?? '').toLowerCase();
    if (label.includes('frontend') || label.includes('ui')) {
      (map.frontend ??= []).push(id);
    } else if (label.includes('api') || label.includes('backend') || label.includes('auth')) {
      (map.backend ??= []).push(id);
    } else {
      (map.backend ??= []).push(id);
    }
  }
  return map;
}

/**
 * Resolve PRDs and sub-tasks for an agent from component mapping.
 *
 * Returns the subset of PRDs and their sub-tasks that are assigned to
 * a specific agent type via the session's component mapping.
 *
 * @param session - The generation session with PRDs and mapping
 * @param agentType - The agent type to get PRDs for
 * @returns Object with prds array and aggregated subTasks array
 *
 * @example
 * ```typescript
 * const { prds, subTasks } = getPrdsAndSubTasksForAgent(session, 'frontend');
 * console.log(`Frontend agent has ${prds.length} PRDs, ${subTasks.length} tasks`);
 * ```
 */
export function getPrdsAndSubTasksForAgent(
  session: GenerationSession,
  agentType: 'frontend' | 'backend' | 'test' | 'docs'
): { prds: PRD[]; subTasks: SubTask[] } {
  const prds = session.prds ?? [];
  const mapping = session.componentMapping ?? {};
  const prdIds = mapping[agentType] ?? [];
  const subTasksByPrdId = session.subTasksByPrdId ?? {};
  const agentPrds = prdIds.length ? prds.filter((p) => prdIds.includes(p.id)) : prds;
  const subTasks = agentPrds.flatMap((p) => subTasksByPrdId[p.id] ?? []);
  return { prds: agentPrds, subTasks };
}
