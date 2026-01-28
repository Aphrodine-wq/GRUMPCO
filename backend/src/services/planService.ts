/**
 * Plan Service
 * Generates structured plans with multi-phase support and approval workflow
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Plan,
  PlanStep,
  Phase,
  PlanGenerationRequest,
  PlanEditRequest,
  PlanPhase,
  FileChange,
} from '../types/plan.js';
import logger from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { withResilience } from './resilience.js';

if (!process.env.ANTHROPIC_API_KEY) {
  logger.error({}, 'ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create resilient wrapper for Claude API calls
// Type assertion: since we never pass stream: true, the response is always a Message
const resilientClaudeCall = withResilience(
  async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
    return await client.messages.create(params);
  },
  'claude-plan'
);


/**
 * Generate a structured plan from user request
 */
export async function generatePlan(
  request: PlanGenerationRequest
): Promise<Plan> {
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info({ planId, workspaceRoot: request.workspaceRoot }, 'Generating plan');

  const basePlanPrompt = `You are a planning assistant that creates detailed, structured implementation plans.

Generate a comprehensive plan with:
1. Clear, numbered steps with dependencies
2. File changes (create/modify/delete) for each step
3. Estimated time per step
4. Risk assessment (low/medium/high)
5. Organized into phases: exploration, preparation, implementation, validation

Return a JSON object with this structure:
{
  "title": "Plan title",
  "description": "Brief description",
  "steps": [
    {
      "id": "step_1",
      "title": "Step title",
      "description": "Detailed description",
      "fileChanges": [
        {
          "path": "path/to/file.ts",
          "type": "create|modify|delete",
          "description": "What changes",
          "estimatedLines": 50
        }
      ],
      "dependencies": [],
      "estimatedTime": 15,
      "risk": "low|medium|high",
      "phase": "exploration|preparation|implementation|validation",
      "order": 1
    }
  ],
  "phases": [
    {
      "id": "exploration",
      "name": "Exploration",
      "description": "Understanding the codebase",
      "steps": ["step_1"],
      "checkpoint": true,
      "status": "pending"
    }
  ],
  "totalEstimatedTime": 120
}

Be specific about file paths and changes. Include all necessary steps.`;
  const systemPrompt = request.systemPromptPrefix
    ? `${request.systemPromptPrefix}\n\n${basePlanPrompt}`
    : basePlanPrompt;

  const userPrompt = `Create a detailed implementation plan for:

${request.userRequest}

${request.workspaceRoot ? `Workspace root: ${request.workspaceRoot}` : ''}
${request.agentProfile ? `Agent profile: ${request.agentProfile}` : ''}

Generate a comprehensive plan with all necessary steps, file changes, and phases.`;

  try {
    const response = await resilientClaudeCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text.trim();
    
    // Extract JSON from markdown code blocks if present
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const planData = JSON.parse(jsonText);

    // Validate and structure the plan
    const plan: Plan = {
      id: planId,
      title: planData.title || 'Implementation Plan',
      description: planData.description || '',
      steps: (planData.steps || []).map((step: any, index: number) => ({
        id: step.id || `step_${index + 1}`,
        title: step.title || `Step ${index + 1}`,
        description: step.description || '',
        fileChanges: step.fileChanges || [],
        dependencies: step.dependencies || [],
        estimatedTime: step.estimatedTime || 15,
        risk: step.risk || 'medium',
        phase: step.phase || 'implementation',
        order: step.order || index + 1,
      })),
      phases: (planData.phases || []).map((phase: any) => ({
        id: phase.id || 'implementation',
        name: phase.name || 'Implementation',
        description: phase.description || '',
        steps: phase.steps || [],
        checkpoint: phase.checkpoint !== undefined ? phase.checkpoint : false,
        status: 'pending' as const,
      })),
      totalEstimatedTime: planData.totalEstimatedTime || 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspaceRoot: request.workspaceRoot,
      metadata: {
        originalRequest: request.userRequest,
        agentProfile: request.agentProfile,
      },
    };

    // Calculate total time if not provided
    if (plan.totalEstimatedTime === 0) {
      plan.totalEstimatedTime = plan.steps.reduce((sum, step) => sum + step.estimatedTime, 0);
    }

    // Ensure phases are properly structured
    if (plan.phases.length === 0) {
      plan.phases = createDefaultPhases(plan.steps);
    }

    const db = getDatabase();
    await db.savePlan(plan);
    logger.info({ planId, stepCount: plan.steps.length }, 'Plan generated successfully');

    return plan;
  } catch (error) {
    logger.error({ error, planId }, 'Plan generation failed');
    throw error;
  }
}

/**
 * Create default phases from steps
 */
function createDefaultPhases(steps: PlanStep[]): Phase[] {
  const phases: Phase[] = [
    {
      id: 'exploration',
      name: 'Exploration',
      description: 'Understanding the codebase and requirements',
      steps: steps.filter(s => s.phase === 'exploration').map(s => s.id),
      checkpoint: true,
      status: 'pending',
    },
    {
      id: 'preparation',
      name: 'Preparation',
      description: 'Setting up scaffolding and dependencies',
      steps: steps.filter(s => s.phase === 'preparation').map(s => s.id),
      checkpoint: true,
      status: 'pending',
    },
    {
      id: 'implementation',
      name: 'Implementation',
      description: 'Making code changes',
      steps: steps.filter(s => s.phase === 'implementation').map(s => s.id),
      checkpoint: false,
      status: 'pending',
    },
    {
      id: 'validation',
      name: 'Validation',
      description: 'Testing and verification',
      steps: steps.filter(s => s.phase === 'validation').map(s => s.id),
      checkpoint: true,
      status: 'pending',
    },
  ];

  // If no steps match phases, put all in implementation
  if (phases.every(p => p.steps.length === 0)) {
    phases[2].steps = steps.map(s => s.id);
  }

  return phases.filter(p => p.steps.length > 0);
}

/**
 * Get plan by ID
 */
export async function getPlan(planId: string): Promise<Plan | null> {
  const db = getDatabase();
  return await db.getPlan(planId);
}

/**
 * Approve plan
 */
export async function approvePlan(planId: string, approvedBy?: string): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (plan.status !== 'draft' && plan.status !== 'pending_approval') {
    throw new Error(`Plan ${planId} cannot be approved in status ${plan.status}`);
  }

  plan.status = 'approved';
  plan.approvedAt = new Date().toISOString();
  plan.approvedBy = approvedBy;
  plan.updatedAt = new Date().toISOString();

  await db.savePlan(plan);
  logger.info({ planId }, 'Plan approved');

  return plan;
}

/**
 * Reject plan
 */
export async function rejectPlan(planId: string, comments?: string): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  plan.status = 'rejected';
  plan.updatedAt = new Date().toISOString();
  if (comments) {
    plan.metadata = plan.metadata || {};
    plan.metadata.rejectionComments = comments;
  }

  await db.savePlan(plan);
  logger.info({ planId }, 'Plan rejected');

  return plan;
}

/**
 * Edit plan
 */
export async function editPlan(planId: string, edits: PlanEditRequest): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (plan.status === 'executing' || plan.status === 'completed') {
    throw new Error(`Cannot edit plan ${planId} in status ${plan.status}`);
  }

  // Update title/description
  if (edits.title) plan.title = edits.title;
  if (edits.description) plan.description = edits.description;

  // Update steps
  if (edits.steps) {
    for (const stepEdit of edits.steps) {
      const step = plan.steps.find(s => s.id === stepEdit.id);
      if (step) {
        Object.assign(step, stepEdit);
      }
    }
  }

  // Update phases
  if (edits.phases) {
    for (const phaseEdit of edits.phases) {
      const phase = plan.phases.find(p => p.id === phaseEdit.id);
      if (phase) {
        Object.assign(phase, phaseEdit);
      }
    }
  }

  // Recalculate total time
  plan.totalEstimatedTime = plan.steps.reduce((sum, step) => sum + step.estimatedTime, 0);

  plan.status = 'draft'; // Reset to draft after editing
  plan.updatedAt = new Date().toISOString();

  await db.savePlan(plan);
  logger.info({ planId }, 'Plan edited');

  return plan;
}

/**
 * Start plan execution
 */
export async function startPlanExecution(planId: string): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (plan.status !== 'approved') {
    throw new Error(`Plan ${planId} must be approved before execution`);
  }

  plan.status = 'executing';
  plan.startedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();

  // Mark first phase as in_progress
  if (plan.phases.length > 0) {
    plan.phases[0].status = 'in_progress';
  }

  await db.savePlan(plan);
  logger.info({ planId }, 'Plan execution started');

  return plan;
}

/**
 * Complete plan execution
 */
export async function completePlanExecution(planId: string): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  plan.status = 'completed';
  plan.completedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();

  // Mark all phases as completed
  plan.phases.forEach(phase => {
    if (phase.status !== 'skipped') {
      phase.status = 'completed';
    }
  });

  await db.savePlan(plan);
  logger.info({ planId }, 'Plan execution completed');

  return plan;
}

/**
 * Update phase status
 */
export async function updatePhaseStatus(
  planId: string,
  phaseId: PlanPhase,
  status: Phase['status']
): Promise<Plan> {
  const db = getDatabase();
  const plan = await db.getPlan(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const phase = plan.phases.find(p => p.id === phaseId);
  if (!phase) {
    throw new Error(`Phase ${phaseId} not found in plan ${planId}`);
  }

  phase.status = status;
  plan.updatedAt = new Date().toISOString();

  await db.savePlan(plan);
  logger.info({ planId, phaseId, status }, 'Phase status updated');

  return plan;
}
