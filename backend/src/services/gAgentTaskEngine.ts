/**
 * G-Agent Task Engine
 *
 * The brain of G-Agent - powered by the Rust Intent Compiler for:
 * 1. Task decomposition: Break complex requests into atomic tasks
 * 2. Dependency analysis: Build DAG of task dependencies
 * 3. Risk assessment: Score each task for safety
 * 4. Plan generation: Create executable plans for user approval
 * 5. State management: Track execution progress
 * 6. Learning: Store patterns and improve over time
 */

import logger from '../middleware/logger.js';
import type { GAgentTask, GAgentPlan, GAgentCapabilityKey } from '../types/settings.js';
import { parseAndEnrichIntent, type EnrichedIntent } from './intentCompilerService.js';
import { verifyIntentFeasibility } from './intentFeasibilityService.js';

export interface TaskDecompositionResult {
  tasks: GAgentTask[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  confidence: number;
}

export interface PlanGenerationOptions {
  goal: string;
  context?: string;
  capabilities: GAgentCapabilityKey[];
  autoApprove?: boolean;
  maxTasks?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
}

/**
 * Task risk levels based on tool categories
 */
const TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'risky'> = {
  // Safe: read-only operations
  file_read: 'safe',
  list_directory: 'safe',
  codebase_search: 'safe',
  git_status: 'safe',
  git_diff: 'safe',
  git_log: 'safe',
  db_schema: 'safe',
  memory_recall: 'safe',
  memory_search: 'safe',
  plan_status: 'safe',

  // Moderate: reversible writes
  file_write: 'moderate',
  file_edit: 'moderate',
  git_commit: 'moderate',
  git_branch: 'moderate',
  memory_store: 'moderate',
  skill_create: 'moderate',
  skill_edit: 'moderate',
  webhook_register: 'moderate',
  heartbeat_create: 'moderate',

  // Risky: external effects or hard to reverse
  git_push: 'risky',
  bash_execute: 'risky',
  terminal_execute: 'risky',
  docker_exec: 'risky',
  docker_compose_up: 'risky',
  docker_compose_down: 'risky',
  db_migrate_dryrun: 'risky',
  http_post: 'risky',
  http_put: 'risky',
  http_delete: 'risky',
  webhook_send: 'risky',
  k8s_deploy: 'risky',
  k8s_scale: 'risky',
  k8s_rollback: 'risky',
  pipeline_trigger: 'risky',
  release_create: 'risky',
};

/**
 * G-Agent Task Engine - the brain of the autonomous agent
 */
class GAgentTaskEngine {
  private activePlans: Map<string, GAgentPlan> = new Map();
  private taskHistory: GAgentTask[] = [];
  private patternCache: Map<string, TaskDecompositionResult> = new Map();

  /**
   * Generate a plan from a natural language goal
   * Uses the Rust Intent Compiler for fast parsing, then LLM for refinement
   */
  async generatePlan(options: PlanGenerationOptions): Promise<GAgentPlan> {
    const startTime = Date.now();
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    logger.info({ planId, goal: options.goal }, 'G-Agent: Generating execution plan');

    // Step 1: Use Rust Intent Compiler for fast parsing and enrichment
    let intentResult: EnrichedIntent | null = null;
    try {
      intentResult = await parseAndEnrichIntent(options.goal, undefined, {
        mode: 'hybrid',
      });
      logger.debug(
        { planId, features: intentResult?.enriched?.features?.length ?? 0 },
        'Rust parsing complete'
      );
    } catch (err) {
      logger.warn({ planId, err }, 'Intent parsing failed, will create default task');
    }

    // Step 2: Verify intent feasibility (map features to capabilities, check constraints)
    let feasibilityFeedback: string | undefined;
    if (intentResult) {
      const feasibility = verifyIntentFeasibility(intentResult, options.capabilities, 'free');
      feasibilityFeedback = feasibility.actionableFeedback;
      if (!feasibility.feasible) {
        logger.info(
          { planId, unsupported: feasibility.unsupportedFeatures },
          'Intent has unsupported features'
        );
      }
    }

    // Step 3: Decompose into tasks
    const decomposition = await this.decomposeGoal(options.goal, intentResult, options);

    // Step 4: Build the plan
    const plan: GAgentPlan = {
      id: planId,
      goal: options.goal,
      tasks: decomposition.tasks,
      status: 'awaiting_approval',
      confidence: decomposition.confidence,
      estimatedTotalDuration: decomposition.estimatedDuration,
      createdAt: new Date().toISOString(),
      ...(feasibilityFeedback && { feasibilityFeedback }),
    };

    // Auto-approve if all tasks are safe and autoApprove is enabled
    if (options.autoApprove && decomposition.tasks.every((t) => t.riskLevel === 'safe')) {
      plan.status = 'executing';
      plan.approvedAt = new Date().toISOString();
      logger.info({ planId }, 'G-Agent: Plan auto-approved (all tasks safe)');
    }

    this.activePlans.set(planId, plan);

    const duration = Date.now() - startTime;
    logger.info({ planId, taskCount: plan.tasks.length, duration }, 'G-Agent: Plan generated');

    return plan;
  }

  /**
   * Decompose a goal into atomic tasks using Rust + LLM
   */
  private async decomposeGoal(
    goal: string,
    intentResult: EnrichedIntent | null,
    options: PlanGenerationOptions
  ): Promise<TaskDecompositionResult> {
    const tasks: GAgentTask[] = [];
    const dependencies = new Map<string, string[]>();

    // Check pattern cache for similar goals
    const cacheKey = this.generateCacheKey(goal);
    const cached = this.patternCache.get(cacheKey);
    if (cached && cached.confidence > 0.8) {
      logger.debug({ cacheKey }, 'Using cached task decomposition');
      return cached;
    }

    // Extract features and actions from intent result
    // Use enriched features if available, otherwise fall back to base features
    const featureStrings = intentResult?.enriched?.features ?? intentResult?.features ?? [];
    const techStack = intentResult?.enriched?.tech_stack ?? intentResult?.tech_stack_hints ?? [];

    // Build tasks from features
    let taskIndex = 0;
    for (const featureName of featureStrings) {
      const taskId = `task_${taskIndex++}`;
      const tools = this.inferToolsForFeature(featureName, options.capabilities);

      const task: GAgentTask = {
        id: taskId,
        description: `Implement ${featureName}`,
        status: 'pending',
        priority: taskIndex, // Use index as priority for now
        dependencies: [],
        tools,
        riskLevel: this.calculateRiskLevel(tools),
        createdAt: new Date().toISOString(),
      };

      tasks.push(task);
    }

    // Build dependency graph based on task order and tech stack
    // For now, assume sequential dependencies for related tech (e.g., backend before frontend)
    const backendTasks = tasks.filter((t) =>
      techStack.some((tech) =>
        ['node', 'express', 'api', 'database', 'backend'].some(
          (kw) =>
            tech.toLowerCase().includes(kw) &&
            t.description.toLowerCase().includes(tech.toLowerCase())
        )
      )
    );
    const frontendTasks = tasks.filter((t) =>
      techStack.some((tech) =>
        ['react', 'vue', 'svelte', 'frontend', 'ui'].some(
          (kw) =>
            tech.toLowerCase().includes(kw) &&
            t.description.toLowerCase().includes(tech.toLowerCase())
        )
      )
    );

    // Frontend tasks depend on backend tasks
    for (const frontendTask of frontendTasks) {
      for (const backendTask of backendTasks) {
        if (!frontendTask.dependencies.includes(backendTask.id)) {
          frontendTask.dependencies.push(backendTask.id);
          dependencies.set(frontendTask.id, [
            ...(dependencies.get(frontendTask.id) || []),
            backendTask.id,
          ]);
        }
      }
    }

    // If no tasks from intent, create a single task
    if (tasks.length === 0) {
      tasks.push({
        id: 'task_0',
        description: goal,
        status: 'pending',
        priority: 1,
        dependencies: [],
        tools: ['file_read', 'file_write', 'bash_execute'],
        riskLevel: 'moderate',
        createdAt: new Date().toISOString(),
      });
    }

    // Calculate overall confidence based on intent analysis
    // If we have enriched data with ambiguity analysis, use that; otherwise estimate
    const ambiguityScore = intentResult?.enriched?.ambiguity_analysis?.score ?? 0;
    const confidence = intentResult ? Math.max(0.3, 1 - ambiguityScore) : 0.5;
    const estimatedDuration = tasks.length * 30; // 30 seconds per task estimate

    const result: TaskDecompositionResult = {
      tasks,
      dependencies,
      estimatedDuration,
      confidence,
    };

    // Cache the pattern
    if (confidence > 0.6) {
      this.patternCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Infer which tools are needed for a feature
   */
  private inferToolsForFeature(feature: string, capabilities: GAgentCapabilityKey[]): string[] {
    const tools: string[] = [];
    const featureLower = feature.toLowerCase();

    // Map features to tools based on capabilities
    if (capabilities.includes('file')) {
      tools.push('file_read', 'file_write', 'file_edit');
    }
    if (
      capabilities.includes('git') &&
      (featureLower.includes('commit') || featureLower.includes('version'))
    ) {
      tools.push('git_commit', 'git_push');
    }
    if (
      capabilities.includes('bash') &&
      (featureLower.includes('build') ||
        featureLower.includes('test') ||
        featureLower.includes('install'))
    ) {
      tools.push('bash_execute');
    }
    if (capabilities.includes('docker') && featureLower.includes('container')) {
      tools.push('docker_compose_up');
    }
    if (
      capabilities.includes('database') &&
      (featureLower.includes('database') || featureLower.includes('schema'))
    ) {
      tools.push('db_schema', 'db_query');
    }

    return tools.length > 0 ? tools : ['file_read', 'file_write'];
  }

  /**
   * Calculate risk level based on tools used
   */
  private calculateRiskLevel(tools: string[]): 'safe' | 'moderate' | 'risky' {
    let maxRisk: 'safe' | 'moderate' | 'risky' = 'safe';

    for (const tool of tools) {
      const risk = TOOL_RISK_LEVELS[tool] || 'moderate';
      if (risk === 'risky') return 'risky';
      if (risk === 'moderate') maxRisk = 'moderate';
    }

    return maxRisk;
  }

  /**
   * Generate a cache key for pattern matching
   */
  private generateCacheKey(goal: string): string {
    // Simple normalization for caching
    return goal
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .sort()
      .join('_')
      .slice(0, 100);
  }

  /**
   * Approve a plan for execution
   */
  approvePlan(planId: string): GAgentPlan | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    plan.status = 'executing';
    plan.approvedAt = new Date().toISOString();

    // Mark first tasks (no dependencies) as ready
    for (const task of plan.tasks) {
      if (task.dependencies.length === 0) {
        task.status = 'approved';
      }
    }

    logger.info({ planId }, 'G-Agent: Plan approved for execution');
    return plan;
  }

  /**
   * Get the next task to execute
   */
  getNextTask(planId: string): GAgentTask | null {
    const plan = this.activePlans.get(planId);
    if (!plan || plan.status !== 'executing') return null;

    // Find first approved task
    const nextTask = plan.tasks.find((t) => t.status === 'approved');
    if (nextTask) {
      nextTask.status = 'in_progress';
      nextTask.startedAt = new Date().toISOString();
      return nextTask;
    }

    // Check if any pending tasks have all dependencies completed
    for (const task of plan.tasks) {
      if (task.status === 'pending') {
        const allDepsComplete = task.dependencies.every((depId) => {
          const dep = plan.tasks.find((t) => t.id === depId);
          return dep?.status === 'completed';
        });
        if (allDepsComplete) {
          task.status = 'in_progress';
          task.startedAt = new Date().toISOString();
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Mark a task as completed
   */
  completeTask(planId: string, taskId: string, result: unknown): void {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;

    // Add to history for learning
    this.taskHistory.push({ ...task });

    // Check if plan is complete
    if (plan.tasks.every((t) => t.status === 'completed')) {
      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      logger.info({ planId }, 'G-Agent: Plan completed successfully');
    }
  }

  /**
   * Mark a task as failed
   */
  failTask(planId: string, taskId: string, error: string): void {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = 'failed';
    task.completedAt = new Date().toISOString();
    task.error = error;

    plan.status = 'failed';
    logger.error({ planId, taskId, error }, 'G-Agent: Task failed');
  }

  /**
   * Get a plan by ID
   */
  getPlan(planId: string): GAgentPlan | null {
    return this.activePlans.get(planId) || null;
  }

  /**
   * Get all active plans
   */
  getActivePlans(): GAgentPlan[] {
    return Array.from(this.activePlans.values());
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      activePlans: this.activePlans.size,
      completedTasks: this.taskHistory.filter((t) => t.status === 'completed').length,
      failedTasks: this.taskHistory.filter((t) => t.status === 'failed').length,
      cachedPatterns: this.patternCache.size,
    };
  }
}

// Singleton instance
export const gAgentTaskEngine = new GAgentTaskEngine();

export default gAgentTaskEngine;
