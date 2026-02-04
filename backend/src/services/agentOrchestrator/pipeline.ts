/**
 * Pipeline Orchestrator
 *
 * Coordinates the full code generation pipeline for single-PRD and multi-PRD flows.
 * Manages the execution order of specialized agents and handles error recovery.
 *
 * ## Pipeline Stages
 * 1. **Architect Agent** - Validates PRD(s) and creates generation plan
 * 2. **Frontend/Backend Agents** - Run in parallel based on preferences
 * 3. **DevOps Agent** - Generates Docker and CI/CD configs
 * 4. **Test Agent** - Generates test suites (optional)
 * 5. **Docs Agent** - Generates documentation (optional)
 * 6. **WRunner Phase** - Analyzes output and applies auto-fixes
 *
 * ## Usage
 * ```typescript
 * // Single-PRD pipeline
 * await executeCodeGeneration(session, prd, architecture, {
 *   creativeDesignDoc,
 *   specification
 * });
 *
 * // Multi-PRD pipeline
 * await executeCodeGenerationMulti(session);
 * ```
 *
 * @module agentOrchestrator/pipeline
 */

import { getRequestLogger } from '../../middleware/logger.js';
import { getDatabase } from '../../db/database.js';
import { analyzeAgentReports, hasAutoFixableIssues } from '../wrunnerService.js';
import { dispatchWebhook } from '../webhookService.js';
import { recordStorageUsage } from '../usageTracker.js';
import { generateMasterContext } from '../contextService.js';
import {
  runArchitectAgent,
  runFrontendAgent,
  runBackendAgent,
  runDevOpsAgent,
  runTestAgent,
  runDocsAgent,
} from './agentExecutors.js';
import type { SpecUiContext } from './agentExecutors.js';
import { getPrdsAndSubTasksForAgent } from './sessionManager.js';
import { applyAutoFixes, validateFixes } from './fixEngine.js';
import { messageBus } from '../../gAgent/messageBus.js';
import { supervisor } from '../../gAgent/supervisor.js';
import type { AgentType } from '../../gAgent/types.js';
import type { GenerationSession } from '../../types/agents.js';
import type { PRD } from '../../types/prd.js';
import type { SystemArchitecture } from '../../types/architecture.js';
import type { MasterContext } from '../../types/context.js';
import type { CreativeDesignDoc } from '../../types/creativeDesignDoc.js';
import type { Specification } from '../../types/spec.js';

/**
 * Options for code generation pipeline execution.
 */
export interface CodeGenerationOptions {
  /** Creative design document with UI/UX guidelines */
  creativeDesignDoc?: CreativeDesignDoc;
  /** Detailed specification document */
  specification?: Specification;
  /** Custom system prompt prefix for all agents */
  systemPromptPrefix?: string;
  /** Goal ID for unified G-Agent tracking */
  goalId?: string;
  /** Whether to publish events to MessageBus (default: true) */
  publishToMessageBus?: boolean;
}

/**
 * Wraps an agent execution with Supervisor tracking and MessageBus events.
 * This bridges the existing agent orchestration with the unified G-Agent system.
 */
async function withAgentTracking<T>(
  agentType: AgentType,
  sessionId: string,
  goalId: string | undefined,
  publishEvents: boolean,
  executeFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const taskId = `codegen_${agentType}_${Date.now()}`;

  // Register with Supervisor for tracking
  let instanceId: string | undefined;
  if (publishEvents) {
    try {
      const instance = await supervisor.spawn(agentType, {
        taskId,
        goalId,
        priority: 'normal',
        context: { sessionId },
      });
      instanceId = instance.id;

      // Mark as running
      supervisor.updateInstanceStatus(instanceId, 'running');
      messageBus.updateTaskProgress(taskId, instanceId, 0, `Starting ${agentType} agent`);
    } catch (err) {
      // Non-fatal - continue without tracking
      getRequestLogger().debug(
        { agentType, error: (err as Error).message },
        'Agent tracking setup failed, continuing without'
      );
    }
  }

  try {
    const result = await executeFn();
    const durationMs = Date.now() - startTime;

    // Report success
    if (publishEvents && instanceId) {
      supervisor.updateInstanceStatus(instanceId, 'completed', {
        progress: 100,
        message: `${agentType} completed successfully`,
        result: {
          success: true,
          output: `Generated files for ${agentType}`,
          durationMs,
        },
      });
      messageBus.completeTask(taskId, instanceId, `${agentType} completed`, durationMs);
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Report failure
    if (publishEvents && instanceId) {
      supervisor.updateInstanceStatus(instanceId, 'failed', {
        message: (error as Error).message,
        result: {
          success: false,
          output: '',
          error: (error as Error).message,
          durationMs,
        },
      });
      messageBus.failTask(taskId, instanceId, (error as Error).message, true);
    }

    throw error;
  }
}

/**
 * Execute the full code generation pipeline for a single PRD.
 *
 * Orchestrates all agents in the correct order, managing parallelization
 * where possible and handling errors gracefully. Dispatches webhooks
 * for pipeline events (codegen.ready, codegen.failed).
 *
 * @param session - Initialized generation session
 * @param prd - The Product Requirements Document
 * @param architecture - System architecture specification
 * @param options - Optional creative design doc, spec, and prompt prefix
 * @throws Error if any critical agent fails
 *
 * @example
 * ```typescript
 * const session = await initializeSession(request);
 * try {
 *   await executeCodeGeneration(session, prd, architecture, {
 *     creativeDesignDoc: designDoc,
 *     systemPromptPrefix: 'Follow strict TypeScript conventions.'
 *   });
 *   console.log(`Generated ${session.generatedFiles?.length} files`);
 * } catch (error) {
 *   console.error(`Pipeline failed: ${error.message}`);
 * }
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
  const publishEvents = options?.publishToMessageBus !== false;
  const goalId = options?.goalId;

  session.status = 'running';
  session.startedAt = new Date().toISOString();
  await db.saveSession(session);

  // Publish goal start to MessageBus
  if (publishEvents && goalId) {
    messageBus.goalUpdated(goalId, { status: 'executing' });
  }

  try {
    log.info({ sessionId: session.sessionId }, 'Starting code generation pipeline');

    let masterContext: MasterContext | undefined;
    try {
      log.info({ sessionId: session.sessionId }, 'Generating master context');
      masterContext = await generateMasterContext({
        projectDescription: prd.projectDescription,
        architecture,
        prd,
      });
      log.info(
        { sessionId: session.sessionId, contextId: masterContext.id },
        'Master context generated'
      );
    } catch (error) {
      log.warn(
        { sessionId: session.sessionId, error: (error as Error).message },
        'Master context generation failed, continuing without it'
      );
    }

    const systemPromptPrefix = options?.systemPromptPrefix;

    // Run architect agent with tracking
    const architecturePlan = await withAgentTracking(
      'planner',
      session.sessionId,
      goalId,
      publishEvents,
      () =>
        runArchitectAgent(
          session,
          prd,
          undefined,
          masterContext,
          options?.creativeDesignDoc,
          systemPromptPrefix
        )
    );

    const parallelAgentPromises: Promise<void>[] = [];

    if (session.preferences.frontendFramework) {
      parallelAgentPromises.push(
        withAgentTracking('frontend', session.sessionId, goalId, publishEvents, async () => {
          log.info({}, 'Running frontend agent');
          const specUiContext: SpecUiContext | undefined = options?.specification
            ? {
                uiComponents: options.specification.sections.uiComponents,
                overview: options.specification.sections.overview,
              }
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
          (session.generatedFiles ??= []).push(...frontendFiles);
        })
      );
    }

    if (session.preferences.backendRuntime) {
      parallelAgentPromises.push(
        withAgentTracking('backend', session.sessionId, goalId, publishEvents, async () => {
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
          (session.generatedFiles ??= []).push(...backendFiles);
        })
      );
    }

    if (parallelAgentPromises.length > 0) {
      await Promise.all(parallelAgentPromises);
      await db.saveSession(session);
    }

    // Run DevOps agent with tracking
    await withAgentTracking('devops', session.sessionId, goalId, publishEvents, async () => {
      log.info({}, 'Running DevOps agent');
      const devopsFiles = await runDevOpsAgent(session, masterContext, systemPromptPrefix);
      (session.generatedFiles ??= []).push(...devopsFiles);
    });
    await db.saveSession(session);

    if (session.preferences.includeTests !== false) {
      await withAgentTracking('test', session.sessionId, goalId, publishEvents, async () => {
        log.info({}, 'Running test agent');
        const testFiles = await runTestAgent(
          session,
          prd,
          undefined,
          undefined,
          masterContext,
          systemPromptPrefix
        );
        (session.generatedFiles ??= []).push(...testFiles);
      });
      await db.saveSession(session);
    }

    if (session.preferences.includeDocs !== false) {
      await withAgentTracking('docs', session.sessionId, goalId, publishEvents, async () => {
        log.info({}, 'Running docs agent');
        const docFiles = await runDocsAgent(
          session,
          prd,
          undefined,
          masterContext,
          systemPromptPrefix
        );
        (session.generatedFiles ??= []).push(...docFiles);
      });
      await db.saveSession(session);
    }

    // Run WRunner analysis
    await runWRunnerPhase(session, prd);

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);

    if (session.userId && session.generatedFiles?.length) {
      const totalBytes = session.generatedFiles.reduce(
        (sum, f) => sum + (f.size ?? f.content?.length ?? 0),
        0
      );
      await recordStorageUsage(session.userId, totalBytes, 'codegen');
    }

    // Publish goal completion to MessageBus
    if (publishEvents && goalId) {
      messageBus.goalCompleted(goalId, `Generated ${session.generatedFiles?.length ?? 0} files`);
    }

    dispatchWebhook('codegen.ready', {
      sessionId: session.sessionId,
      fileCount: session.generatedFiles?.length ?? 0,
      completedAt: session.completedAt,
    });
    log.info(
      { sessionId: session.sessionId, fileCount: (session.generatedFiles ?? []).length },
      'Code generation pipeline completed'
    );
  } catch (error) {
    session.status = 'failed';
    session.error = (error as Error).message;
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);

    // Publish goal failure to MessageBus
    if (publishEvents && goalId) {
      messageBus.goalUpdated(goalId, {
        status: 'failed',
        error: (error as Error).message,
      });
    }

    dispatchWebhook('codegen.failed', {
      sessionId: session.sessionId,
      error: (error as Error).message,
    });
    log.error(
      { sessionId: session.sessionId, error: (error as Error).message },
      'Code generation pipeline failed'
    );
    throw error;
  }
}

/**
 * Execute multi-PRD code generation.
 *
 * Similar to single-PRD pipeline but handles multiple PRDs with component mapping.
 * Each agent receives only the PRDs relevant to its domain (frontend, backend, etc.).
 *
 * @param session - Initialized multi-PRD generation session
 * @throws Error if any critical agent fails
 *
 * @example
 * ```typescript
 * const session = await initializeSessionMulti({
 *   prds: [frontendPrd, backendPrd],
 *   architecture,
 *   preferences
 * });
 * await executeCodeGenerationMulti(session);
 * ```
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
    log.info(
      { sessionId: session.sessionId, prdCount: prds.length },
      'Starting multi-PRD code generation'
    );

    let masterContext: MasterContext | undefined;
    try {
      log.info({ sessionId: session.sessionId }, 'Generating master context');
      masterContext = await generateMasterContext({
        projectDescription: prds[0].projectDescription,
        architecture,
        prd: prds[0],
      });
      log.info(
        { sessionId: session.sessionId, contextId: masterContext.id },
        'Master context generated'
      );
    } catch (error) {
      log.warn(
        { sessionId: session.sessionId, error: (error as Error).message },
        'Master context generation failed, continuing without it'
      );
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
          (session.generatedFiles ??= []).push(...frontendFiles);
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
          (session.generatedFiles ??= []).push(...backendFiles);
        })()
      );
    }

    if (parallelAgentPromises.length > 0) {
      await Promise.all(parallelAgentPromises);
      await db.saveSession(session);
    }

    log.info({}, 'Running DevOps agent');
    const devopsFiles = await runDevOpsAgent(session, masterContext);
    (session.generatedFiles ??= []).push(...devopsFiles);
    await db.saveSession(session);

    if (session.preferences.includeTests !== false) {
      const { prds: testPrds, subTasks: testSubTasks } = getPrdsAndSubTasksForAgent(
        session,
        'test'
      );
      log.info({}, 'Running test agent');
      const testFiles = await runTestAgent(
        session,
        testPrds[0] ?? prds[0],
        testPrds.length ? testPrds : undefined,
        testSubTasks.length ? testSubTasks : undefined,
        masterContext
      );
      (session.generatedFiles ??= []).push(...testFiles);
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
      (session.generatedFiles ??= []).push(...docFiles);
      await db.saveSession(session);
    }

    // Run WRunner analysis
    await runWRunnerPhase(session, prds[0], prds);

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.ready', {
      sessionId: session.sessionId,
      fileCount: session.generatedFiles?.length ?? 0,
      completedAt: session.completedAt,
    });
    log.info(
      { sessionId: session.sessionId, fileCount: (session.generatedFiles ?? []).length },
      'Multi-PRD code generation completed'
    );
  } catch (error) {
    session.status = 'failed';
    session.error = (error as Error).message;
    session.completedAt = new Date().toISOString();
    await db.saveSession(session);
    dispatchWebhook('codegen.failed', {
      sessionId: session.sessionId,
      error: (error as Error).message,
    });
    log.error(
      { sessionId: session.sessionId, error: (error as Error).message },
      'Multi-PRD code generation failed'
    );
    throw error;
  }
}

/**
 * Run the WRunner analysis phase (shared between single and multi-PRD pipelines).
 *
 * Analyzes all agent work reports for issues and applies auto-fixes where possible.
 * This is the quality assurance phase of the pipeline.
 *
 * @param session - The generation session with work reports
 * @param primaryPrd - The primary PRD for context
 * @param prds - All PRDs (for multi-PRD sessions)
 * @internal
 */
async function runWRunnerPhase(
  session: GenerationSession,
  primaryPrd: PRD,
  prds?: PRD[]
): Promise<void> {
  const log = getRequestLogger();

  if (session.workReports && Object.keys(session.workReports).length > 0) {
    log.info({ sessionId: session.sessionId }, 'Running WRunner analysis');
    try {
      const wrunnerAnalysis = await analyzeAgentReports(
        session,
        session.workReports,
        primaryPrd,
        prds
      );
      session.wrunnerAnalysis = wrunnerAnalysis;

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
    }
  }
}
