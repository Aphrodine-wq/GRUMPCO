/**
 * SHIP Mode Service
 * Orchestrates sequential Design → Spec → Plan → Code workflow
 */

import { getRequestLogger } from '../middleware/logger.js';
import logger from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { generateArchitecture } from './architectureService.js';
import { generatePRD } from './prdGeneratorService.js';
import { generateCreativeDesignDoc } from './creativeDesignDocService.js';
import { startSpecSession, generateSpecification } from './specService.js';
import { generatePlan, approvePlan, startPlanExecution } from './planService.js';
import { initializeSession, executeCodeGeneration } from './agentOrchestrator.js';
import { dispatchWebhook } from './webhookService.js';
import { getHeadSystemPrompt } from '../prompts/head.js';
import { getChatModePrompt } from '../prompts/chat/index.js';
import type {
  ShipSession,
  ShipPhase,
  ShipStartRequest,
  ShipPreferences,
  DesignPhaseResult,
  SpecPhaseResult,
  PlanPhaseResult,
  CodePhaseResult,
  ShipPhaseResponse,
} from '../types/ship.js';
import type { SystemArchitecture } from '../types/architecture.js';
import type { PRD } from '../types/prd.js';
import type { Plan } from '../types/plan.js';

/**
 * Start a new SHIP mode session
 */
export async function startShipMode(request: ShipStartRequest): Promise<ShipSession> {
  const db = getDatabase();
  const sessionId = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session: ShipSession = {
    id: sessionId,
    projectDescription: request.projectDescription,
    phase: 'design',
    status: 'initializing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: request.preferences,
    projectId: request.projectId,
  };
  
  await db.saveShipSession(session);
  logger.info({ sessionId }, 'SHIP mode session started');
  
  return session;
}

/**
 * Get session by ID
 */
export async function getShipSession(sessionId: string): Promise<ShipSession | null> {
  const db = getDatabase();
  return await db.getShipSession(sessionId);
}

/**
 * Execute Design Phase: Generate architecture and PRD
 */
export async function executeDesignPhase(session: ShipSession): Promise<DesignPhaseResult> {
  const log = getRequestLogger();
  const db = getDatabase();
  log.info({ sessionId: session.id }, 'Starting Design phase');
  
  session.phase = 'design';
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await db.saveShipSession(session);
  
  try {
    const headPrompt = getHeadSystemPrompt();
    const designModePrompt = getChatModePrompt('design');
    const systemPromptPrefix = `${headPrompt}\n\n${designModePrompt}`;

    // Generate architecture
    log.info({ sessionId: session.id }, 'Generating architecture');
    const archResponse = await generateArchitecture({
      projectDescription: session.projectDescription,
      projectType: 'general',
      techStack: session.preferences?.backendRuntime 
        ? [session.preferences.backendRuntime, session.preferences.frontendFramework || 'vue'].filter(Boolean) as string[]
        : undefined,
      systemPromptPrefix,
    });
    
    if (archResponse.status === 'error' || !archResponse.architecture) {
      throw new Error(archResponse.error || 'Architecture generation failed');
    }
    
    const architecture = archResponse.architecture;
    
    // Generate PRD
    log.info({ sessionId: session.id }, 'Generating PRD');
    const prdResponse = await generatePRD(
      {
        architectureId: architecture.id,
        projectName: architecture.projectName,
        projectDescription: session.projectDescription,
      },
      architecture
    );
    
    if (prdResponse.status === 'error' || !prdResponse.prd) {
      throw new Error(prdResponse.error || 'PRD generation failed');
    }
    
    const prd = prdResponse.prd;

    // Generate Creative Design Document (layout, UI/UX, key screens, UX flows)
    log.info({ sessionId: session.id }, 'Generating Creative Design Document');
    const creativeDesignDoc = await generateCreativeDesignDoc(
      session.projectDescription,
      architecture,
      prd.sections?.overview
    );

    const result: DesignPhaseResult = {
      phase: 'design',
      status: 'completed',
      architecture,
      prd,
      creativeDesignDoc,
      completedAt: new Date().toISOString(),
    };

    session.designResult = result;
    session.phase = 'spec';
    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    log.info({ sessionId: session.id }, 'Design phase completed');
    return result;
  } catch (error) {
    const err = error as Error;
    log.error({ sessionId: session.id, error: err.message }, 'Design phase failed');
    
    const result: DesignPhaseResult = {
      phase: 'design',
      status: 'failed',
      architecture: {} as SystemArchitecture,
      prd: {} as PRD,
      completedAt: new Date().toISOString(),
      error: err.message,
    };
    
    session.designResult = result;
    session.status = 'failed';
    session.error = err.message;
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    return result;
  }
}

/**
 * Execute Spec Phase: Gather requirements through Q&A and generate specification
 */
export async function executeSpecPhase(
  session: ShipSession,
  designResult: DesignPhaseResult
): Promise<SpecPhaseResult> {
  const log = getRequestLogger();
  const db = getDatabase();
  log.info({ sessionId: session.id }, 'Starting Spec phase');
  
  session.phase = 'spec';
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await db.saveShipSession(session);
  
  try {
    // Start spec session
    const specSession = await startSpecSession({
      userRequest: session.projectDescription,
      workspaceRoot: session.preferences?.workspaceRoot,
    });
    
    const headPrompt = getHeadSystemPrompt();
    const specModePrompt = getChatModePrompt('spec');
    const systemPromptPrefix = `${headPrompt}\n\n${specModePrompt}`;

    // For automated flow, generate spec from design context (PRD + CDD) without Q&A
    log.info({ sessionId: session.id, specSessionId: specSession.id }, 'Generating specification from design context');
    const specResponse = await generateSpecification({
      sessionId: specSession.id,
      designContext: {
        projectDescription: session.projectDescription,
        prdOverview: designResult.prd.sections?.overview,
        creativeDesignDoc: designResult.creativeDesignDoc,
      },
      systemPromptPrefix,
    });
    
    if (!specResponse.specification) {
      throw new Error('Specification generation failed');
    }
    
    const result: SpecPhaseResult = {
      phase: 'spec',
      status: 'completed',
      specification: specResponse.specification,
      completedAt: new Date().toISOString(),
    };
    
    session.specResult = result;
    session.phase = 'plan';
    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    log.info({ sessionId: session.id }, 'Spec phase completed');
    return result;
  } catch (error) {
    const err = error as Error;
    log.error({ sessionId: session.id, error: err.message }, 'Spec phase failed');
    
    const result: SpecPhaseResult = {
      phase: 'spec',
      status: 'failed',
      specification: {} as any,
      completedAt: new Date().toISOString(),
      error: err.message,
    };
    
    session.specResult = result;
    session.status = 'failed';
    session.error = err.message;
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    return result;
  }
}

/**
 * Execute Plan Phase: Create implementation plan from specification
 */
export async function executePlanPhase(
  session: ShipSession,
  specResult: SpecPhaseResult
): Promise<PlanPhaseResult> {
  const log = getRequestLogger();
  const db = getDatabase();
  log.info({ sessionId: session.id }, 'Starting Plan phase');
  
  session.phase = 'plan';
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await db.saveShipSession(session);
  
  try {
    const headPrompt = getHeadSystemPrompt();
    const planModePrompt = getChatModePrompt('plan');
    const systemPromptPrefix = `${headPrompt}\n\n${planModePrompt}`;

    // Generate plan from specification
    const plan = await generatePlan({
      userRequest: `Implement: ${specResult.specification.title}\n\n${specResult.specification.description}\n\nRequirements:\n${specResult.specification.sections.requirements?.map(r => `- ${r.title}: ${r.description}`).join('\n') || 'None'}`,
      workspaceRoot: session.preferences?.workspaceRoot,
      agentProfile: 'router',
      systemPromptPrefix,
    });
    
    // Auto-approve plan for automated flow
    await approvePlan(plan.id);
    
    const result: PlanPhaseResult = {
      phase: 'plan',
      status: 'completed',
      plan,
      completedAt: new Date().toISOString(),
    };
    
    session.planResult = result;
    session.phase = 'code';
    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    log.info({ sessionId: session.id, planId: plan.id }, 'Plan phase completed');
    return result;
  } catch (error) {
    const err = error as Error;
    log.error({ sessionId: session.id, error: err.message }, 'Plan phase failed');
    
    const result: PlanPhaseResult = {
      phase: 'plan',
      status: 'failed',
      plan: {} as Plan,
      completedAt: new Date().toISOString(),
      error: err.message,
    };
    
    session.planResult = result;
    session.status = 'failed';
    session.error = err.message;
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    return result;
  }
}

/**
 * Execute Code Phase: Execute plan using tool-enabled code generation
 */
export async function executeCodePhase(
  session: ShipSession,
  planResult: PlanPhaseResult,
  designResult: DesignPhaseResult
): Promise<CodePhaseResult> {
  const log = getRequestLogger();
  const db = getDatabase();
  log.info({ sessionId: session.id }, 'Starting Code phase');
  
  session.phase = 'code';
  session.status = 'running';
  session.updatedAt = new Date().toISOString();
  await db.saveShipSession(session);
  
  try {
    // Initialize code generation session
    const genSession = await initializeSession({
      prdId: designResult.prd.id,
      architectureId: designResult.architecture.id,
      preferences: {
        frontendFramework: session.preferences?.frontendFramework,
        backendRuntime: session.preferences?.backendRuntime,
        database: session.preferences?.database,
        includeTests: session.preferences?.includeTests !== false,
        includeDocs: session.preferences?.includeDocs !== false,
      },
    });
    
    const headPrompt = getHeadSystemPrompt();
    const codeModePrompt = getChatModePrompt('normal');
    const systemPromptPrefix = `${headPrompt}\n\n${codeModePrompt}`;

    // Execute code generation with CDD and spec for layout/UI guidance
    await executeCodeGeneration(genSession, designResult.prd, designResult.architecture, {
      creativeDesignDoc: designResult.creativeDesignDoc,
      specification: session.specResult?.specification,
      systemPromptPrefix,
    });
    
    const result: CodePhaseResult = {
      phase: 'code',
      status: 'completed',
      session: genSession,
      completedAt: new Date().toISOString(),
    };
    
    session.codeResult = result;
    session.phase = 'completed';
    session.status = 'completed';
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    log.info({ sessionId: session.id, genSessionId: genSession.sessionId }, 'Code phase completed');
    return result;
  } catch (error) {
    const err = error as Error;
    log.error({ sessionId: session.id, error: err.message }, 'Code phase failed');
    
    const result: CodePhaseResult = {
      phase: 'code',
      status: 'failed',
      session: {} as any,
      completedAt: new Date().toISOString(),
      error: err.message,
    };
    
    session.codeResult = result;
    session.status = 'failed';
    session.error = err.message;
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    
    return result;
  }
}

/**
 * Execute full SHIP mode workflow sequentially
 */
export async function executeShipMode(sessionId: string): Promise<ShipPhaseResponse> {
  const log = getRequestLogger();
  const db = getDatabase();
  const session = await getShipSession(sessionId);
  
  if (!session) {
    throw new Error(`SHIP session ${sessionId} not found`);
  }
  
  try {
    // Phase 1: Design
    if (!session.designResult) {
      log.info({ sessionId }, 'Executing Design phase');
      const designResult = await executeDesignPhase(session);
      if (designResult.status === 'failed') {
        return {
          sessionId,
          phase: 'design',
          status: 'failed',
          result: designResult,
          error: designResult.error,
        };
      }
    }
    
    // Phase 2: Spec
    if (!session.specResult && session.designResult?.status === 'completed') {
      log.info({ sessionId }, 'Executing Spec phase');
      const specResult = await executeSpecPhase(session, session.designResult);
      if (specResult.status === 'failed') {
        return {
          sessionId,
          phase: 'spec',
          status: 'failed',
          result: specResult,
          error: specResult.error,
        };
      }
    }
    
    // Phase 3: Plan
    if (!session.planResult && session.specResult?.status === 'completed') {
      log.info({ sessionId }, 'Executing Plan phase');
      const planResult = await executePlanPhase(session, session.specResult);
      if (planResult.status === 'failed') {
        return {
          sessionId,
          phase: 'plan',
          status: 'failed',
          result: planResult,
          error: planResult.error,
        };
      }
    }
    
    // Phase 4: Code
    if (!session.codeResult && session.planResult?.status === 'completed' && session.designResult?.status === 'completed') {
      log.info({ sessionId }, 'Executing Code phase');
      const codeResult = await executeCodePhase(session, session.planResult, session.designResult);
      if (codeResult.status === 'failed') {
        return {
          sessionId,
          phase: 'code',
          status: 'failed',
          result: codeResult,
          error: codeResult.error,
        };
      }
      
      dispatchWebhook('ship.completed', { sessionId, phase: 'code', result: codeResult });
      return {
        sessionId,
        phase: 'completed',
        status: 'completed',
        result: codeResult,
      };
    }
    
    // Return current phase status
    const currentPhase = session.phase;
    let result: DesignPhaseResult | SpecPhaseResult | PlanPhaseResult | CodePhaseResult | undefined;
    if (currentPhase === 'design' && session.designResult) result = session.designResult;
    else if (currentPhase === 'spec' && session.specResult) result = session.specResult;
    else if (currentPhase === 'plan' && session.planResult) result = session.planResult;
    else if (currentPhase === 'code' && session.codeResult) result = session.codeResult;
    
    return {
      sessionId,
      phase: currentPhase,
      status: session.status === 'completed' ? 'completed' : 'running',
      result,
      nextPhase: getNextPhase(currentPhase),
    };
  } catch (error) {
    const err = error as Error;
    log.error({ sessionId, error: err.message }, 'SHIP mode execution failed');
    dispatchWebhook('ship.failed', { sessionId, phase: session.phase, error: err.message });
    session.status = 'failed';
    session.error = err.message;
    session.updatedAt = new Date().toISOString();
    await db.saveShipSession(session);
    return {
      sessionId,
      phase: session.phase,
      status: 'failed',
      error: err.message,
    };
  }
}

/**
 * Get next phase in sequence
 */
function getNextPhase(currentPhase: ShipPhase): ShipPhase | undefined {
  const phaseOrder: ShipPhase[] = ['design', 'spec', 'plan', 'code', 'completed'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  if (currentIndex < phaseOrder.length - 1) {
    return phaseOrder[currentIndex + 1];
  }
  return undefined;
}
