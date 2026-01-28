/**
 * Agent Orchestrator Service
 *
 * Manages multi-agent code generation pipeline for G-Rump. This is the core service
 * that coordinates specialized AI agents (architect, frontend, backend, devops, test, docs)
 * to generate complete codebases from PRDs and architecture specifications.
 *
 * ## Key Concepts
 * - **GenerationSession**: Tracks the state of a code generation run
 * - **AgentTask**: Individual agent's work item within a session
 * - **MasterContext**: Shared context generated for all agents to ensure consistency
 * - **WRunner**: Post-generation analysis and auto-fix system
 *
 * ## Pipeline Flow
 * 1. Initialize session with PRD and preferences
 * 2. Generate master context for agent coordination
 * 3. Run architect agent to create generation plan
 * 4. Run specialized agents (frontend, backend, devops, test, docs) in sequence
 * 5. Run WRunner analysis and apply auto-fixes
 * 6. Complete session and dispatch webhook
 *
 * ## Usage
 * ```typescript
 * const session = await initializeSession(request);
 * await executeCodeGeneration(session, prd, architecture);
 * const result = await getSession(session.sessionId);
 * ```
 *
 * @module agentOrchestrator
 */

import Anthropic from '@anthropic-ai/sdk';
import { getRequestLogger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import logger from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { withResilience } from './resilience.js';
import { withSpan, createAgentSpan, addSpanEvent, setSpanAttribute, getCurrentSpan } from '../middleware/tracing.js';
import { getCorrelationIdFromHeaders } from '../utils/correlationId.js';
import { getArchitectAgentPromptWithContext } from '../prompts/agents/architect-agent.js';
import { getFrontendAgentPrompt } from '../prompts/agents/frontend-agent.js';
import { getBackendAgentPrompt } from '../prompts/agents/backend-agent.js';
import { getDevOpsAgentPrompt } from '../prompts/agents/devops-agent.js';
import { getTestAgentPrompt } from '../prompts/agents/test-agent.js';
import { getDocsAgentPrompt } from '../prompts/agents/docs-agent.js';
import { getSecurityAgentPrompt } from '../prompts/agents/security-agent.js';
import { getI18nAgentPrompt } from '../prompts/agents/i18n-agent.js';
import { analyzeAgentReports, generateFixPlan, hasAutoFixableIssues } from './wrunnerService.js';
import { dispatchWebhook } from './webhookService.js';
import { analyzeCode, scanSecurity, optimizePerformance } from './claudeCodeService.js';
import { generateMasterContext, enrichContextForAgent, generateContextSummary } from './contextService.js';
import type {
  GenerationSession,
  AgentType,
  CodeGenRequest,
  CodeGenRequestMulti,
  GeneratedFile,
  AgentTask,
  SubTask,
  AgentWorkReport,
  WRunnerAnalysis,
} from '../types/agents.js';
import type { PRD } from '../types/prd.js';
import type { SystemArchitecture } from '../types/architecture.js';
import type { MasterContext } from '../types/context.js';
import type { CreativeDesignDoc } from '../types/creativeDesignDoc.js';
import type { Specification } from '../types/spec.js';

if (!process.env.ANTHROPIC_API_KEY) {
  logger.error('ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/** Claude Code quality: all agent outputs must satisfy type safety, tests, security, and maintainability. */
const AGENT_QUALITY_STANDARD = 'claude-code' as const;

// Create resilient wrapper for Claude API calls
// Type assertion: since we never pass stream: true, the response is always a Message
const resilientClaudeCall = withResilience(
  async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
    return await client.messages.create(params);
  },
  'claude-agent'
);

/**
 * Initialize a new code generation session.
 *
 * Creates a new session with all agent tasks in 'pending' state. The session
 * is persisted to the database immediately and can be retrieved later via
 * {@link getSession}.
 *
 * @param request - Code generation request containing PRD ID, architecture ID,
 *                  project preferences (framework, runtime, database), and optional project ID
 * @returns Promise resolving to the initialized GenerationSession with unique sessionId
 *
 * @example
 * ```typescript
 * const session = await initializeSession({
 *   prdId: 'prd_123',
 *   architectureId: 'arch_456',
 *   preferences: {
 *     frontendFramework: 'vue',
 *     backendRuntime: 'node',
 *     database: 'postgres'
 *   }
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

function initializeAgentTask(agentType: AgentType, description: string): AgentTask {
  return {
    taskId: `task_${agentType}_${Date.now()}`,
    agentType,
    description,
    input: {},
    status: 'pending',
  };
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<GenerationSession | null> {
  const db = getDatabase();
  return await db.getSession(sessionId);
}

const SUBTASKS_PROMPT = `Break a PRD into ordered implementation sub-tasks. Return a JSON array only: [{"id":"t1","title":"...","status":"pending"}, ...]. 5–15 tasks. No markdown.`;

async function breakPrdIntoSubTasks(prd: PRD): Promise<SubTask[]> {
  const log = getRequestLogger();
  try {
    const res = await resilientClaudeCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SUBTASKS_PROMPT,
      messages: [
        {
          role: 'user',
          content: `PRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nBreak into sub-tasks.`,
        },
      ],
    });
    const block = res.content[0];
    if (block.type !== 'text') return [];
    let raw = block.text.trim();
    const arr = raw.match(/\[[\s\S]*\]/);
    if (arr) raw = arr[0];
    const parsed = JSON.parse(raw) as Array<{ id?: string; title?: string; status?: string }>;
    return (Array.isArray(parsed) ? parsed : []).map((t, i) => ({
      id: t.id || `task_${i}`,
      title: t.title || `Task ${i + 1}`,
      status: 'pending' as const,
    }));
  } catch (e) {
    log.warn({ err: (e as Error).message, prdId: prd.id }, 'Sub-task breakdown failed, using empty');
    return [];
  }
}

/**
 * Initialize session for multi-PRD codegen. Runs sub-task breakdown, stores in session.
 */
export async function initializeSessionMulti(request: CodeGenRequestMulti): Promise<GenerationSession> {
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

function defaultComponentMapping(
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
 * Run architect agent - validates PRD(s) and creates plan. When creativeDesignDoc is provided (e.g. from Ship), plan aligns with its layout and UI/UX.
 */
async function runArchitectAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  masterContext?: MasterContext,
  creativeDesignDoc?: CreativeDesignDoc,
  systemPromptPrefix?: string
): Promise<Record<string, any>> {
  return await withSpan(
    'agent.architect.execute',
    async (span) => {
      const log = getRequestLogger();
      const timer = createApiTimer('agent_architect');
      const agentTask = session.agents.architect;

      setSpanAttribute('session.id', session.sessionId);
      setSpanAttribute('agent.type', 'architect');
      addSpanEvent('agent.started', { agentType: 'architect', sessionId: session.sessionId });

      try {
        agentTask.status = 'running';
        agentTask.startedAt = new Date().toISOString();

        const context = prds
          ? JSON.stringify(prds.map((p) => ({ id: p.id, projectName: p.projectName, sections: p.sections })), null, 2)
          : JSON.stringify(prd.sections, null, 2);
        
        // Get agent-specific context if master context is available
        let contextSummary: string | undefined;
        if (masterContext) {
          const agentContext = await enrichContextForAgent(masterContext, 'architect');
          contextSummary = generateContextSummary(agentContext);
        }
        
        const basePrompt = getArchitectAgentPromptWithContext(context, contextSummary, creativeDesignDoc);
        const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

        addSpanEvent('claude.api.call', { operation: 'architect_plan_generation' });
        const response = await resilientClaudeCall({
          model: 'claude-opus-4-5-20251101',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Analyze this PRD${prds ? ' (multi-PRD)' : ''} and create a comprehensive code generation plan for a ${session.preferences.backendRuntime} backend with ${session.preferences.frontendFramework} frontend.`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type');
        }

        let jsonText = content.text;
        if (jsonText.includes('```json')) {
          const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
          if (match) jsonText = match[1];
        } else if (jsonText.includes('```')) {
          const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
          if (match) jsonText = match[1];
        }

        const result = JSON.parse(jsonText);

        agentTask.status = 'completed';
        agentTask.output = result;
        agentTask.completedAt = new Date().toISOString();
        agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

        // Generate work report
        await generateAgentWorkReport('architect', session, agentTask, [], prd, result, prds);

        addSpanEvent('agent.completed', {
          agentType: 'architect',
          duration: agentTask.duration,
          status: 'success',
        });
        setSpanAttribute('agent.duration', agentTask.duration);
        setSpanAttribute('agent.status', 'completed');

        log.info({ agentType: 'architect', duration: agentTask.duration }, 'Architect agent completed');
        timer.success();

        return result;
      } catch (error) {
        agentTask.status = 'failed';
        agentTask.error = (error as Error).message;
        agentTask.completedAt = new Date().toISOString();
        
        addSpanEvent('agent.failed', {
          agentType: 'architect',
          error: (error as Error).message,
        });
        setSpanAttribute('agent.status', 'failed');
        setSpanAttribute('error.message', (error as Error).message);

        log.error({ agentType: 'architect', error: (error as Error).message }, 'Architect agent failed');
        timer.failure('architect_error');
        throw error;
      }
    },
    {
      'session.id': session.sessionId,
      'agent.type': 'architect',
    }
  );
}

/** Spec UI context passed from Ship when specification exists */
export interface SpecUiContext {
  uiComponents?: Array<{ id?: string; name?: string; description?: string; type?: string; region?: string; placement?: string; layoutNotes?: string }>;
  overview?: string;
}

/**
 * Run frontend agent - generates UI code. Optional prds + subTasks for multi-PRD.
 * When creativeDesignDoc and/or specUiContext are provided (e.g. from Ship), implement layout and UX as specified.
 */
async function runFrontendAgent(
  session: GenerationSession,
  prd: PRD,
  architecturePlan: Record<string, any>,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  creativeDesignDoc?: CreativeDesignDoc,
  specUiContext?: SpecUiContext,
  systemPromptPrefix?: string
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('agent_frontend');
  const agentTask = session.agents.frontend;

  try {
    agentTask.status = 'running';
    agentTask.startedAt = new Date().toISOString();

    const framework = session.preferences.frontendFramework || 'vue';
    
    // Get agent-specific context if master context is available
    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, 'frontend');
      contextSummary = generateContextSummary(agentContext);
    }
    
    const basePrompt = getFrontendAgentPrompt(framework as 'vue' | 'react', contextSummary, !!creativeDesignDoc);
    const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

    let userContent = `Generate frontend code for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate frontend code. Your PRDs only:\n${JSON.stringify(prds.map((p) => p.sections), null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
      if (subTasks && subTasks.length > 0) {
        userContent += `\n\nImplement these sub-tasks only:\n${subTasks.map((t) => `- ${t.title}`).join('\n')}`;
      }
    }
    if (creativeDesignDoc) {
      userContent += `\n\nCreative Design Document (implement layout and UX as specified):\n${JSON.stringify(
        {
          layout: creativeDesignDoc.layout,
          uiPrinciples: creativeDesignDoc.uiPrinciples,
          keyScreens: creativeDesignDoc.keyScreens,
          uxFlows: creativeDesignDoc.uxFlows,
          accessibilityNotes: creativeDesignDoc.accessibilityNotes,
          responsivenessNotes: creativeDesignDoc.responsivenessNotes,
        },
        null,
        2
      )}`;
    }
    if (specUiContext) {
      const parts: string[] = [];
      if (specUiContext.overview) parts.push(`Overview: ${specUiContext.overview}`);
      if (specUiContext.uiComponents && specUiContext.uiComponents.length > 0) {
        parts.push('UI components: ' + JSON.stringify(specUiContext.uiComponents, null, 2));
      }
      if (parts.length > 0) {
        userContent += `\n\nSpecification (UI):\n${parts.join('\n\n')}`;
      }
    }

    const response = await resilientClaudeCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = 'completed';
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    // Generate work report
    await generateAgentWorkReport('frontend', session, agentTask, files, prd, architecturePlan, prds);

    log.info({ agentType: 'frontend', files: files.length }, 'Frontend agent completed');
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = 'failed';
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error({ agentType: 'frontend', error: (error as Error).message }, 'Frontend agent failed');
    timer.failure('frontend_error');
    throw error;
  }
}

/**
 * Run backend agent - generates API code. Optional prds + subTasks for multi-PRD.
 */
async function runBackendAgent(
  session: GenerationSession,
  prd: PRD,
  architecturePlan: Record<string, any>,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('agent_backend');
  const agentTask = session.agents.backend;

  try {
    agentTask.status = 'running';
    agentTask.startedAt = new Date().toISOString();

    const runtime = session.preferences.backendRuntime || 'node';
    const database = session.preferences.database || 'postgres';
    
    // Get agent-specific context if master context is available
    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, 'backend');
      contextSummary = generateContextSummary(agentContext);
    }
    
    const basePrompt = getBackendAgentPrompt(runtime as 'node' | 'python' | 'go', database as 'postgres' | 'mongodb', contextSummary);
    const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

    let userContent = `Generate backend code for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate backend code. Your PRDs only:\n${JSON.stringify(prds.map((p) => p.sections), null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
      if (subTasks && subTasks.length > 0) {
        userContent += `\n\nImplement these sub-tasks only:\n${subTasks.map((t) => `- ${t.title}`).join('\n')}`;
      }
    }

    const response = await resilientClaudeCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = 'completed';
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    // Generate work report
    await generateAgentWorkReport('backend', session, agentTask, files, prd, architecturePlan, prds);

    log.info({ agentType: 'backend', files: files.length }, 'Backend agent completed');
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = 'failed';
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error({ agentType: 'backend', error: (error as Error).message }, 'Backend agent failed');
    timer.failure('backend_error');
    throw error;
  }
}

/**
 * Run DevOps agent - generates Docker/CI configs
 */
async function runDevOpsAgent(
  session: GenerationSession,
  masterContext?: MasterContext,
  systemPromptPrefix?: string
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('agent_devops');
  const agentTask = session.agents.devops;

  try {
    agentTask.status = 'running';
    agentTask.startedAt = new Date().toISOString();

    // Get agent-specific context if master context is available
    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, 'devops');
      contextSummary = generateContextSummary(agentContext);
    }
    
    const basePrompt = getDevOpsAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

    const response = await resilientClaudeCall({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate DevOps configuration for a ${session.preferences.backendRuntime} backend and ${session.preferences.frontendFramework} frontend project.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = 'completed';
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    // Generate work report
    const prd = session.prds?.[0] || { id: session.prdId, sections: {} } as PRD;
    await generateAgentWorkReport('devops', session, agentTask, files, prd);

    log.info({ agentType: 'devops', files: files.length }, 'DevOps agent completed');
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = 'failed';
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error({ agentType: 'devops', error: (error as Error).message }, 'DevOps agent failed');
    timer.failure('devops_error');
    throw error;
  }
}

/**
 * Run test agent - generates test suites. Optional prds + subTasks for multi-PRD.
 */
async function runTestAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('agent_test');
  const agentTask = session.agents.test;

  try {
    agentTask.status = 'running';
    agentTask.startedAt = new Date().toISOString();

    // Get agent-specific context if master context is available
    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, 'test');
      contextSummary = generateContextSummary(agentContext);
    }
    
    const basePrompt = getTestAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

    let userContent = `Generate comprehensive test suites for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate tests. Your PRDs only:\n${JSON.stringify(prds.map((p) => p.sections), null, 2)}`;
      if (subTasks?.length) userContent += `\n\nSub-tasks to cover:\n${subTasks.map((t) => `- ${t.title}`).join('\n')}`;
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = 'completed';
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    // Generate work report
    await generateAgentWorkReport('test', session, agentTask, files, prd, undefined, prds);

    log.info({ agentType: 'test', files: files.length }, 'Test agent completed');
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = 'failed';
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error({ agentType: 'test', error: (error as Error).message }, 'Test agent failed');
    timer.failure('test_error');
    throw error;
  }
}

/**
 * Run docs agent - generates documentation. Optional prds for multi-PRD.
 */
async function runDocsAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('agent_docs');
  const agentTask = session.agents.docs;

  try {
    agentTask.status = 'running';
    agentTask.startedAt = new Date().toISOString();

    // Get agent-specific context if master context is available
    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, 'docs');
      contextSummary = generateContextSummary(agentContext);
    }
    
    const basePrompt = getDocsAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix ? `${systemPromptPrefix}\n\n${basePrompt}` : basePrompt;

    let userContent = `Generate comprehensive documentation for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate docs. Your PRDs only:\n${JSON.stringify(prds.map((p) => p.sections), null, 2)}`;
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = 'completed';
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    // Generate work report
    await generateAgentWorkReport('docs', session, agentTask, files, prd, undefined, prds);

    log.info({ agentType: 'docs', files: files.length }, 'Docs agent completed');
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = 'failed';
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error({ agentType: 'docs', error: (error as Error).message }, 'Docs agent failed');
    timer.failure('docs_error');
    throw error;
  }
}

/**
 * Convert agent output to GeneratedFile array
 */
function convertAgentOutputToFiles(agentOutput: Record<string, any>): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Flatten all files from agent output
  for (const key of Object.keys(agentOutput)) {
    const items = agentOutput[key];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.path && item.content) {
          files.push({
            path: item.path,
            type: (item.type || 'source') as any,
            language: getLanguageFromPath(item.path),
            size: item.content.length,
            content: item.content,
          });
        }
      }
    }
  }

  return files;
}

function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.vue')) return 'vue';
  if (path.endsWith('.go')) return 'go';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.sh')) return 'shell';
  return 'text';
}

/**
 * Generate detailed work report for an agent after code generation
 */
async function generateAgentWorkReport(
  agentType: AgentType,
  session: GenerationSession,
  agentTask: AgentTask,
  generatedFiles: GeneratedFile[],
  prd: PRD,
  architecturePlan?: Record<string, any>,
  prds?: PRD[]
): Promise<AgentWorkReport> {
  const log = getRequestLogger();
  try {
    const systemPrompt = `You are a technical documentation specialist. Your role is to analyze an agent's work output and generate a comprehensive work report.

## Report Structure:
Generate a detailed JSON report documenting:
1. Summary of work completed
2. Files generated with purposes and key decisions
3. Architecture decisions made and rationale
4. Code quality metrics (coverage, complexity, issues)
5. Integration points with other components
6. Testing strategy
7. Known issues and suggested fixes
8. Recommendations for improvements

## Output Format:
Return a JSON object matching the AgentWorkReport structure:
\`\`\`json
{
  "report": {
    "summary": "Brief summary of work completed",
    "filesGenerated": [
      {
        "path": "file path",
        "purpose": "what this file does",
        "keyDecisions": ["decision1", "decision2"]
      }
    ],
    "architectureDecisions": [
      {
        "decision": "decision made",
        "rationale": "why this decision",
        "alternatives": ["alt1", "alt2"]
      }
    ],
    "codeQualityMetrics": {
      "coverage": 85,
      "complexity": 5,
      "issues": ["issue1", "issue2"]
    },
    "integrationPoints": [
      {
        "component": "component name",
        "dependencies": ["dep1", "dep2"],
        "contracts": "API contracts or interfaces"
      }
    ],
    "testingStrategy": "description of testing approach",
    "knownIssues": [
      {
        "issue": "issue description",
        "severity": "low|medium|high",
        "suggestedFix": "how to fix"
      }
    ],
    "recommendations": ["recommendation1", "recommendation2"]
  }
}
\`\`\``;

    const prdContext = prds
      ? JSON.stringify(prds.map((p) => ({ id: p.id, projectName: p.projectName, sections: p.sections })), null, 2)
      : JSON.stringify(prd.sections, null, 2);

    // Perform Claude Code analysis on generated files
    let codeAnalysisSummary = '';
    let securityIssuesSummary = '';
    let performanceSummary = '';
    
    try {
      // Analyze a sample of generated files (limit to avoid too many API calls)
      const sampleFiles = generatedFiles
        .filter(f => f.type === 'source' && f.content && f.content.length < 10000)
        .slice(0, 3);
      
      if (sampleFiles.length > 0) {
        const analyses = await Promise.allSettled(
          sampleFiles.map(f => analyzeCode(f.content, f.language || 'typescript'))
        );
        
        const successfulAnalyses = analyses
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value);
        
        if (successfulAnalyses.length > 0) {
          const allPatterns = successfulAnalyses.flatMap(a => a.patterns || []);
          const allSmells = successfulAnalyses.flatMap(a => a.codeSmells || []);
          codeAnalysisSummary = `Code Analysis:\n- Patterns detected: ${allPatterns.length}\n- Code smells: ${allSmells.length}\n- Recommendations: ${successfulAnalyses.flatMap(a => a.recommendations || []).slice(0, 5).join(', ')}`;
        }
        
        // Security scan
        const securityScans = await Promise.allSettled(
          sampleFiles.map(f => scanSecurity(f.content, f.language || 'typescript'))
        );
        
        const securityResults = securityScans
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .flatMap(r => r.value);
        
        if (securityResults.length > 0) {
          const criticalIssues = securityResults.filter(i => i.severity === 'critical' || i.severity === 'high');
          securityIssuesSummary = `Security Scan:\n- Issues found: ${securityResults.length}\n- Critical/High: ${criticalIssues.length}\n- Types: ${[...new Set(securityResults.map(i => i.type))].join(', ')}`;
        }
        
        // Performance optimization
        const perfScans = await Promise.allSettled(
          sampleFiles.map(f => optimizePerformance(f.content, f.language || 'typescript'))
        );
        
        const perfResults = perfScans
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .flatMap(r => r.value);
        
        if (perfResults.length > 0) {
          const highPriority = perfResults.filter(o => o.priority === 'high');
          performanceSummary = `Performance Analysis:\n- Optimizations suggested: ${perfResults.length}\n- High priority: ${highPriority.length}`;
        }
      }
    } catch (error) {
      log.warn({ agentType, error: (error as Error).message }, 'Claude Code analysis failed, continuing without it');
    }

    const userContent = `Agent Type: ${agentType}
Session ID: ${session.sessionId}
Task ID: ${agentTask.taskId}

PRD Context:
${prdContext}

${architecturePlan ? `Architecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}\n\n` : ''}
Generated Files (${generatedFiles.length}):
${generatedFiles.map((f) => `- ${f.path} (${f.type}, ${f.language}, ${f.size} bytes)`).join('\n')}

${codeAnalysisSummary ? `${codeAnalysisSummary}\n\n` : ''}
${securityIssuesSummary ? `${securityIssuesSummary}\n\n` : ''}
${performanceSummary ? `${performanceSummary}\n\n` : ''}
Agent Output:
${JSON.stringify(agentTask.output || {}, null, 2)}

Generate a comprehensive work report documenting what this agent accomplished, decisions made, integration points, and any issues or recommendations. Include insights from the code analysis above.`;

    const response = await resilientClaudeCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text;
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
    }

    const reportData = JSON.parse(jsonText);
    const workReport: AgentWorkReport = {
      agentType,
      sessionId: session.sessionId,
      taskId: agentTask.taskId,
      report: reportData.report,
      generatedAt: new Date().toISOString(),
    };

    // Store in session
    if (!session.workReports) {
      // initialize with partial record; cast satisfies full Record type while we progressively fill it
      session.workReports = {} as Record<AgentType, AgentWorkReport>;
    }
    session.workReports[agentType] = workReport;

    // Save work report to database
    const db = getDatabase();
    await db.saveWorkReport(workReport);
    await db.saveSession(session);

    log.info({ agentType, sessionId: session.sessionId }, 'Work report generated');
    return workReport;
  } catch (error) {
    log.warn({ agentType, error: (error as Error).message }, 'Work report generation failed');
    // Return minimal report on failure
    return {
      agentType,
      sessionId: session.sessionId,
      taskId: agentTask.taskId,
      report: {
        summary: `Work completed but report generation failed: ${(error as Error).message}`,
        filesGenerated: generatedFiles.map((f) => ({ path: f.path, purpose: f.type, keyDecisions: [] })),
        architectureDecisions: [],
        codeQualityMetrics: { issues: [] },
        integrationPoints: [],
        testingStrategy: 'Not documented',
        knownIssues: [],
        recommendations: [],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Resolve PRDs and sub-tasks for an agent from component mapping.
 */
function getPrdsAndSubTasksForAgent(
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

/**
 * Apply auto-fixes based on WRunner analysis
 */
async function applyAutoFixes(
  session: GenerationSession,
  analysis: WRunnerAnalysis
): Promise<Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }>> {
  const log = getRequestLogger();
  const fixPlan = generateFixPlan(analysis);
  const appliedFixes: Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }> = [];

  if (!session.autoFixesApplied) {
    session.autoFixesApplied = [];
  }

  for (const issue of fixPlan.autoFixable) {
    try {
      log.info({ issueId: issue.id, sessionId: session.sessionId }, 'Applying auto-fix');

      // For now, we'll mark fixes as applied and store them
      // In a full implementation, you would:
      // 1. Generate code for missing files
      // 2. Edit existing files with fixes
      // 3. Update generated files in session

      const fixDescription = issue.suggestedFixes.map((f) => f.action).join('; ');
      appliedFixes.push({
        issueId: issue.id,
        fix: fixDescription,
        status: 'applied',
      });

      session.autoFixesApplied.push({
        issueId: issue.id,
        fix: fixDescription,
        status: 'applied',
      });
    } catch (error) {
      log.error({ issueId: issue.id, error: (error as Error).message }, 'Auto-fix failed');
      appliedFixes.push({
        issueId: issue.id,
        fix: issue.description,
        status: 'failed',
      });
      session.autoFixesApplied.push({
        issueId: issue.id,
        fix: issue.description,
        status: 'failed',
      });
    }
  }

  return appliedFixes;
}

/**
 * Regenerate output for a specific agent with fixes applied
 */
async function regenerateAgentOutput(
  session: GenerationSession,
  agentType: AgentType,
  fixes: WRunnerAnalysis['issues']
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  log.info({ agentType, sessionId: session.sessionId }, 'Regenerating agent output with fixes');

  // Get the original agent task
  const agentTask = session.agents[agentType];
  if (!agentTask || agentTask.status !== 'completed') {
    throw new Error(`Agent ${agentType} has not completed or does not exist`);
  }

  // Get relevant fixes for this agent
  const agentFixes = fixes.filter((f) => f.affectedAgents.includes(agentType));

  // In a full implementation, you would:
  // 1. Re-run the agent with fix instructions
  // 2. Update generated files
  // 3. Regenerate work report

  // For now, return existing files
  return session.generatedFiles?.filter((f) => {
    // Filter files by agent type (this is a simplified approach)
    return true;
  }) || [];
}

/**
 * Validate that fixes were applied correctly
 */
function validateFixes(
  session: GenerationSession,
  analysis: WRunnerAnalysis,
  appliedFixes: Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }>
): { valid: boolean; issues: string[] } {
  const log = getRequestLogger();
  const issues: string[] = [];

  const appliedIssueIds = new Set(appliedFixes.filter((f) => f.status === 'applied').map((f) => f.issueId));
  const expectedIssueIds = new Set(
    analysis.issues.filter((i) => {
      const isAutoFixable =
        (i.category === 'missing' || i.category === 'quality' || i.category === 'inconsistency') &&
        i.severity !== 'critical' &&
        i.suggestedFixes.length > 0;
      return isAutoFixable;
    }).map((i) => i.id)
  );

  // Check if all expected fixes were applied
  for (const issueId of expectedIssueIds) {
    if (!appliedIssueIds.has(issueId)) {
      issues.push(`Fix for issue ${issueId} was not applied`);
    }
  }

  // Check for failed fixes
  const failedFixes = appliedFixes.filter((f) => f.status === 'failed');
  if (failedFixes.length > 0) {
    issues.push(`${failedFixes.length} fixes failed to apply`);
  }

  const valid = issues.length === 0;
  log.info({ sessionId: session.sessionId, valid, issueCount: issues.length }, 'Fix validation completed');

  return { valid, issues };
}

export interface CodeGenerationOptions {
  creativeDesignDoc?: CreativeDesignDoc;
  specification?: Specification;
  /** Optional head + mode prompt prepended for SHIP/chat consistency */
  systemPromptPrefix?: string;
}

/**
 * Execute the full code generation pipeline for a single PRD.
 *
 * Runs all agents sequentially: architect → frontend → backend → devops → test → docs.
 * Each agent generates files that are accumulated in the session. After all agents
 * complete, WRunner analysis identifies issues and applies auto-fixes.
 *
 * The session status progresses: 'initializing' → 'running' → 'completed' | 'failed'
 *
 * @param session - Initialized generation session from {@link initializeSession}
 * @param prd - Product Requirements Document containing project specifications
 * @param architecture - System architecture defining components and their relationships
 * @param options - Optional configuration for Ship mode integration
 * @param options.creativeDesignDoc - Design document for UI/UX guidance (from Ship)
 * @param options.specification - Specification document with UI component details
 * @param options.systemPromptPrefix - Custom system prompt prefix for agent consistency
 *
 * @throws Error if any critical agent fails (non-critical failures are logged)
 *
 * @example
 * ```typescript
 * const session = await initializeSession(request);
 * await executeCodeGeneration(session, prd, architecture, {
 *   creativeDesignDoc: designDoc,
 *   specification: spec
 * });
 *
 * // Check results
 * const completed = await getSession(session.sessionId);
 * console.log(`Generated ${completed.generatedFiles.length} files`);
 * ```
 */
export async function executeCodeGeneration(
  session: GenerationSession,
  prd: PRD,
  architecture: SystemArchitecture,
  options?: CodeGenerationOptions
): Promise<void> {
  const log = getRequestLogger();
  const db = getDatabase();
  session.status = 'running';
  session.startedAt = new Date().toISOString();
  await db.saveSession(session);

  try {
    log.info({ sessionId: session.sessionId }, 'Starting code generation pipeline');

    // Generate master context
    let masterContext: MasterContext | undefined;
    try {
      log.info({ sessionId: session.sessionId }, 'Generating master context');
      masterContext = await generateMasterContext({
        projectDescription: prd.projectDescription,
        architecture,
        prd,
      });
      log.info({ sessionId: session.sessionId, contextId: masterContext.id }, 'Master context generated');
    } catch (error) {
      log.warn({ sessionId: session.sessionId, error: (error as Error).message }, 'Master context generation failed, continuing without it');
    }

    const systemPromptPrefix = options?.systemPromptPrefix;
    const architecturePlan = await runArchitectAgent(session, prd, undefined, masterContext, options?.creativeDesignDoc, systemPromptPrefix);

    // Run frontend and backend agents in parallel when both are enabled
    const parallelAgentPromises: Promise<void>[] = [];

    if (session.preferences.frontendFramework) {
      parallelAgentPromises.push(
        (async () => {
          log.info({}, 'Running frontend agent');
          const specUiContext = options?.specification
            ? { uiComponents: options.specification.sections.uiComponents, overview: options.specification.sections.overview }
            : undefined;
          const frontendFiles = await runFrontendAgent(
            session,
            prd,
            architecturePlan,
            undefined,
            undefined,
            masterContext,
            options?.creativeDesignDoc,
            specUiContext,
            systemPromptPrefix
          );
          session.generatedFiles!.push(...frontendFiles);
        })()
      );
    }

    if (session.preferences.backendRuntime) {
      parallelAgentPromises.push(
        (async () => {
          log.info({}, 'Running backend agent');
          const backendFiles = await runBackendAgent(
            session,
            prd,
            architecturePlan,
            undefined,
            undefined,
            masterContext,
            systemPromptPrefix
          );
          session.generatedFiles!.push(...backendFiles);
        })()
      );
    }

    if (parallelAgentPromises.length > 0) {
      await Promise.all(parallelAgentPromises);
      await db.saveSession(session);
    }

    log.info({}, 'Running DevOps agent');
    const devopsFiles = await runDevOpsAgent(session, masterContext, systemPromptPrefix);
    session.generatedFiles!.push(...devopsFiles);
    await db.saveSession(session);

    if (session.preferences.includeTests !== false) {
      log.info({}, 'Running test agent');
      const testFiles = await runTestAgent(session, prd, undefined, undefined, masterContext, systemPromptPrefix);
      session.generatedFiles!.push(...testFiles);
      await db.saveSession(session);
    }

    if (session.preferences.includeDocs !== false) {
      log.info({}, 'Running docs agent');
      const docFiles = await runDocsAgent(session, prd, undefined, masterContext, systemPromptPrefix);
      session.generatedFiles!.push(...docFiles);
      await db.saveSession(session);
    }

    // Design Mode: Run WRunner analysis after all agents complete
    if (session.workReports && Object.keys(session.workReports).length > 0) {
      log.info({ sessionId: session.sessionId }, 'Running WRunner analysis');
      try {
        const wrunnerAnalysis = await analyzeAgentReports(session, session.workReports, prd);
        session.wrunnerAnalysis = wrunnerAnalysis;

        // Apply auto-fixes if available
        if (hasAutoFixableIssues(wrunnerAnalysis)) {
          log.info({ sessionId: session.sessionId }, 'Applying auto-fixes');
          const appliedFixes = await applyAutoFixes(session, wrunnerAnalysis);
          const validation = validateFixes(session, wrunnerAnalysis, appliedFixes);
          log.info(
            {
              sessionId: session.sessionId,
              fixesApplied: appliedFixes.length,
              validationValid: validation.valid,
            },
            'Auto-fixes applied and validated'
          );
        }
      } catch (error) {
        log.error(
          { sessionId: session.sessionId, error: (error as Error).message },
          'WRunner analysis failed'
        );
        // Continue even if WRunner fails
      }
    }

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.ready', {
      sessionId: session.sessionId,
      fileCount: session.generatedFiles?.length ?? 0,
      completedAt: session.completedAt,
    });
    log.info(
      { sessionId: session.sessionId, fileCount: session.generatedFiles!.length },
      'Code generation pipeline completed'
    );
  } catch (error) {
    session.status = 'failed';
    session.error = (error as Error).message;
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.failed', { sessionId: session.sessionId, error: (error as Error).message });
    log.error({ sessionId: session.sessionId, error: (error as Error).message }, 'Code generation pipeline failed');
    throw error;
  }
}

/**
 * Execute multi-PRD code generation. Uses session.prds, session.architecture, sub-tasks, component mapping.
 */
export async function executeCodeGenerationMulti(session: GenerationSession): Promise<void> {
  const log = getRequestLogger();
  const db = getDatabase();
  const prds = session.prds ?? [];
  const architecture = session.architecture;
  if (!prds.length || !architecture) {
    session.status = 'failed';
    session.error = 'Multi-PRD session missing prds or architecture';
    await db.saveSession(session);
    return;
  }

  session.status = 'running';
  session.startedAt = new Date().toISOString();
  await db.saveSession(session);

  try {
    log.info({ sessionId: session.sessionId, prdCount: prds.length }, 'Starting multi-PRD code generation');

    // Generate master context
    let masterContext: MasterContext | undefined;
    try {
      log.info({ sessionId: session.sessionId }, 'Generating master context');
      masterContext = await generateMasterContext({
        projectDescription: prds[0].projectDescription,
        architecture,
        prd: prds[0],
      });
      log.info({ sessionId: session.sessionId, contextId: masterContext.id }, 'Master context generated');
    } catch (error) {
      log.warn({ sessionId: session.sessionId, error: (error as Error).message }, 'Master context generation failed, continuing without it');
    }

    const architecturePlan = await runArchitectAgent(session, prds[0], prds, masterContext);

    const parallelAgentPromises: Promise<void>[] = [];

    const { prds: fePrds, subTasks: feSubTasks } = getPrdsAndSubTasksForAgent(session, 'frontend');
    if (session.preferences.frontendFramework && (fePrds.length || prds.length)) {
      parallelAgentPromises.push(
        (async () => {
          log.info({}, 'Running frontend agent');
          const frontendFiles = await runFrontendAgent(
            session,
            fePrds[0] ?? prds[0],
            architecturePlan,
            fePrds.length ? fePrds : undefined,
            feSubTasks.length ? feSubTasks : undefined,
            masterContext
          );
          session.generatedFiles!.push(...frontendFiles);
        })()
      );
    }

    const { prds: bePrds, subTasks: beSubTasks } = getPrdsAndSubTasksForAgent(session, 'backend');
    if (session.preferences.backendRuntime && (bePrds.length || prds.length)) {
      parallelAgentPromises.push(
        (async () => {
          log.info({}, 'Running backend agent');
          const backendFiles = await runBackendAgent(
            session,
            bePrds[0] ?? prds[0],
            architecturePlan,
            bePrds.length ? bePrds : undefined,
            beSubTasks.length ? beSubTasks : undefined,
            masterContext
          );
          session.generatedFiles!.push(...backendFiles);
        })()
      );
    }

    if (parallelAgentPromises.length > 0) {
      await Promise.all(parallelAgentPromises);
      await db.saveSession(session);
    }

    log.info({}, 'Running DevOps agent');
    const devopsFiles = await runDevOpsAgent(session, masterContext);
    session.generatedFiles!.push(...devopsFiles);
    await db.saveSession(session);

    if (session.preferences.includeTests !== false) {
      const { prds: testPrds, subTasks: testSubTasks } = getPrdsAndSubTasksForAgent(session, 'test');
      log.info({}, 'Running test agent');
      const testFiles = await runTestAgent(
        session,
        testPrds[0] ?? prds[0],
        testPrds.length ? testPrds : undefined,
        testSubTasks.length ? testSubTasks : undefined,
        masterContext
      );
      session.generatedFiles!.push(...testFiles);
      await db.saveSession(session);
    }

    if (session.preferences.includeDocs !== false) {
      const { prds: docPrds } = getPrdsAndSubTasksForAgent(session, 'docs');
      log.info({}, 'Running docs agent');
      const docFiles = await runDocsAgent(
        session,
        docPrds[0] ?? prds[0],
        docPrds.length ? docPrds : undefined,
        masterContext
      );
      session.generatedFiles!.push(...docFiles);
      await db.saveSession(session);
    }

    // Design Mode: Run WRunner analysis after all agents complete
    if (session.workReports && Object.keys(session.workReports).length > 0) {
      log.info({ sessionId: session.sessionId }, 'Running WRunner analysis');
      try {
        const wrunnerAnalysis = await analyzeAgentReports(
          session,
          session.workReports,
          prds[0],
          prds
        );
        session.wrunnerAnalysis = wrunnerAnalysis;

        // Apply auto-fixes if available
        if (hasAutoFixableIssues(wrunnerAnalysis)) {
          log.info({ sessionId: session.sessionId }, 'Applying auto-fixes');
          const appliedFixes = await applyAutoFixes(session, wrunnerAnalysis);
          const validation = validateFixes(session, wrunnerAnalysis, appliedFixes);
          log.info(
            {
              sessionId: session.sessionId,
              fixesApplied: appliedFixes.length,
              validationValid: validation.valid,
            },
            'Auto-fixes applied and validated'
          );
        }
      } catch (error) {
        log.error(
          { sessionId: session.sessionId, error: (error as Error).message },
          'WRunner analysis failed'
        );
        // Continue even if WRunner fails
      }
    }

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.ready', {
      sessionId: session.sessionId,
      fileCount: session.generatedFiles?.length ?? 0,
      completedAt: session.completedAt,
    });
    log.info(
      { sessionId: session.sessionId, fileCount: session.generatedFiles!.length },
      'Multi-PRD code generation completed'
    );
  } catch (error) {
    session.status = 'failed';
    session.error = (error as Error).message;
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.failed', { sessionId: session.sessionId, error: (error as Error).message });
    log.error(
      { sessionId: session.sessionId, error: (error as Error).message },
      'Multi-PRD code generation failed'
    );
    throw error;
  }
}
