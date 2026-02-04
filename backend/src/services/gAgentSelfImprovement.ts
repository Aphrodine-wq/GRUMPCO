/**
 * G-Agent Self-Improvement Service
 *
 * Enables G-Agent to learn and improve from its own execution:
 * 1. Extract skills from successful task patterns
 * 2. Learn domain terminology from task context
 * 3. Identify optimization opportunities
 * 4. Create follow-up goals for self-improvement
 */

import logger from '../middleware/logger.js';
import {
  gAgentMemoryService,
  type LearnedSkill,
  type SkillStep,
  type LexiconEntry,
} from './gAgentMemoryService.js';
import { gAgentGoalQueue } from './gAgentGoalQueue.js';
import type { Plan, Task } from './intentCliRunner.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillExtraction {
  name: string;
  description: string;
  trigger: string;
  steps: SkillStep[];
  confidence: number;
}

export interface LexiconExtraction {
  term: string;
  definition: string;
  category: string;
  aliases: string[];
}

export interface ImprovementSuggestion {
  type: 'optimize' | 'learn' | 'document' | 'test';
  description: string;
  priority: 'low' | 'normal' | 'high';
  autoSchedule: boolean;
}

// ============================================================================
// SKILL EXTRACTION
// ============================================================================

/**
 * Extract skills from a completed plan
 */
export async function extractSkillsFromPlan(plan: Plan): Promise<SkillExtraction[]> {
  const skills: SkillExtraction[] = [];

  // Group tasks by feature
  const featureGroups = new Map<string, Task[]>();
  for (const task of plan.tasks) {
    const feature = task.feature || 'general';
    const group = featureGroups.get(feature) || [];
    group.push(task);
    featureGroups.set(feature, group);
  }

  // Extract skills from each feature group
  for (const [feature, tasks] of featureGroups) {
    if (tasks.length < 2) continue; // Need at least 2 tasks for a meaningful skill

    // Check if all tasks in the group completed successfully
    const allCompleted = tasks.every((t) => t.status === 'completed');
    if (!allCompleted) continue;

    // Extract skill
    const skillSteps: SkillStep[] = tasks.map((t, i) => ({
      order: i + 1,
      action: t.description,
      tool: t.tools[0],
      conditions: t.depends_on.length > 0 ? [`After: ${t.depends_on.join(', ')}`] : undefined,
    }));

    const trigger = detectTriggerPattern(tasks);

    const skill: SkillExtraction = {
      name: generateSkillName(feature, tasks),
      description: `Skill for ${feature}: ${tasks.map((t) => t.action).join(' → ')}`,
      trigger,
      steps: skillSteps,
      confidence: 0.7, // Initial confidence
    };

    skills.push(skill);
  }

  return skills;
}

/**
 * Learn extracted skills and persist to memory
 */
export async function learnSkillsFromPlan(plan: Plan): Promise<LearnedSkill[]> {
  const extractions = await extractSkillsFromPlan(plan);
  const learnedSkills: LearnedSkill[] = [];

  for (const extraction of extractions) {
    try {
      const skill = await gAgentMemoryService.learnSkill(
        extraction.name,
        extraction.description,
        extraction.trigger,
        extraction.steps,
        true // success
      );
      learnedSkills.push(skill);

      logger.info(
        { skillId: skill.id, name: skill.name },
        'G-Agent: Skill extracted from plan execution'
      );
    } catch (e) {
      logger.warn(
        { error: (e as Error).message, skillName: extraction.name },
        'G-Agent: Failed to learn skill'
      );
    }
  }

  return learnedSkills;
}

// ============================================================================
// LEXICON EXTRACTION
// ============================================================================

/**
 * Extract domain terminology from plan context
 */
export async function extractTerminologyFromPlan(plan: Plan): Promise<LexiconExtraction[]> {
  const terms: LexiconExtraction[] = [];

  // Extract tech stack terms
  if (plan.tech_stack) {
    for (const tech of plan.tech_stack) {
      const existing = gAgentMemoryService.getLexiconEntry(tech);
      if (!existing) {
        terms.push({
          term: tech,
          definition: `Technology used in this project: ${tech}`,
          category: 'technology',
          aliases: [],
        });
      }
    }
  }

  // Extract architecture pattern
  if (plan.architecture_pattern && plan.architecture_pattern !== 'unknown') {
    const existing = gAgentMemoryService.getLexiconEntry(plan.architecture_pattern);
    if (!existing) {
      terms.push({
        term: plan.architecture_pattern,
        definition: `Architecture pattern: ${plan.architecture_pattern}`,
        category: 'architecture',
        aliases: [],
      });
    }
  }

  // Extract feature names
  const features = new Set(plan.tasks.map((t) => t.feature).filter(Boolean));
  for (const feature of features) {
    if (feature && feature.length > 3) {
      const existing = gAgentMemoryService.getLexiconEntry(feature);
      if (!existing) {
        terms.push({
          term: feature,
          definition: `Feature in this project: ${feature}`,
          category: 'feature',
          aliases: [],
        });
      }
    }
  }

  // Extract action verbs used
  const actions = new Set(plan.tasks.map((t) => t.action).filter(Boolean));
  for (const action of actions) {
    if (action && action.length > 3) {
      const existing = gAgentMemoryService.getLexiconEntry(action);
      if (!existing) {
        terms.push({
          term: action,
          definition: `Action type: ${action}`,
          category: 'action',
          aliases: [],
        });
      }
    }
  }

  return terms;
}

/**
 * Learn extracted terminology and persist to memory
 */
export async function learnTerminologyFromPlan(plan: Plan): Promise<LexiconEntry[]> {
  const extractions = await extractTerminologyFromPlan(plan);
  const learnedTerms: LexiconEntry[] = [];

  for (const extraction of extractions) {
    try {
      const entry = await gAgentMemoryService.addLexiconEntry({
        term: extraction.term,
        definition: extraction.definition,
        category: extraction.category,
        aliases: extraction.aliases,
        relatedTerms: [],
        examples: [plan.goal],
        source: `plan:${plan.id}`,
      });
      learnedTerms.push(entry);
    } catch (e) {
      logger.debug(
        { error: (e as Error).message, term: extraction.term },
        'G-Agent: Failed to add lexicon entry'
      );
    }
  }

  if (learnedTerms.length > 0) {
    logger.info({ count: learnedTerms.length }, 'G-Agent: Terminology learned from plan execution');
  }

  return learnedTerms;
}

// ============================================================================
// IMPROVEMENT SUGGESTIONS
// ============================================================================

/**
 * Analyze a completed plan and suggest improvements
 */
export async function analyzeForImprovements(plan: Plan): Promise<ImprovementSuggestion[]> {
  const suggestions: ImprovementSuggestion[] = [];

  // Check for failed tasks
  const failedTasks = plan.tasks.filter((t) => t.status === 'failed');
  if (failedTasks.length > 0) {
    suggestions.push({
      type: 'learn',
      description: `Investigate why ${failedTasks.length} task(s) failed and learn prevention strategies`,
      priority: 'high',
      autoSchedule: false,
    });
  }

  // Check for slow tasks (based on estimates)
  const slowTasks = plan.tasks.filter((t) => t.estimated_seconds > 300);
  if (slowTasks.length > 0) {
    suggestions.push({
      type: 'optimize',
      description: `Optimize ${slowTasks.length} slow task(s) that take >5 minutes`,
      priority: 'normal',
      autoSchedule: false,
    });
  }

  // Check for risky tasks
  const riskyTasks = plan.tasks.filter((t) => t.risk === 'risky');
  if (riskyTasks.length > 0) {
    suggestions.push({
      type: 'document',
      description: `Document safety procedures for ${riskyTasks.length} risky task(s)`,
      priority: 'normal',
      autoSchedule: false,
    });
  }

  // Suggest testing if no tests were mentioned
  const hasTests = plan.tasks.some(
    (t) =>
      t.description.toLowerCase().includes('test') || t.tools.some((tool) => tool.includes('test'))
  );
  if (!hasTests) {
    suggestions.push({
      type: 'test',
      description: 'Consider adding automated tests for this functionality',
      priority: 'low',
      autoSchedule: false,
    });
  }

  return suggestions;
}

/**
 * Create follow-up goals from improvement suggestions
 */
export async function scheduleImprovementGoals(
  userId: string,
  planId: string,
  suggestions: ImprovementSuggestion[]
): Promise<void> {
  for (const suggestion of suggestions) {
    if (!suggestion.autoSchedule) continue;

    try {
      // Schedule for 1 hour from now
      const scheduledAt = new Date();
      scheduledAt.setHours(scheduledAt.getHours() + 1);

      await gAgentGoalQueue.createGoal({
        userId,
        description: `[Self-improvement] ${suggestion.description}`,
        priority: suggestion.priority,
        triggerType: 'self_scheduled',
        scheduledAt: scheduledAt.toISOString(),
        tags: ['self-improvement', suggestion.type, `plan:${planId}`],
      });

      logger.info(
        { type: suggestion.type, description: suggestion.description.slice(0, 50) },
        'G-Agent: Self-improvement goal scheduled'
      );
    } catch (e) {
      logger.warn({ error: (e as Error).message }, 'G-Agent: Failed to schedule improvement goal');
    }
  }
}

// ============================================================================
// COMPLETE SELF-IMPROVEMENT CYCLE
// ============================================================================

/**
 * Run the complete self-improvement cycle after plan execution
 */
export async function runSelfImprovementCycle(
  userId: string,
  plan: Plan
): Promise<{
  skillsLearned: LearnedSkill[];
  termsLearned: LexiconEntry[];
  suggestions: ImprovementSuggestion[];
}> {
  logger.info({ planId: plan.id, userId }, 'G-Agent: Starting self-improvement cycle');

  // 1. Extract and learn skills
  const skillsLearned = await learnSkillsFromPlan(plan);

  // 2. Extract and learn terminology
  const termsLearned = await learnTerminologyFromPlan(plan);

  // 3. Analyze for improvements
  const suggestions = await analyzeForImprovements(plan);

  // 4. Schedule auto-improvement goals
  await scheduleImprovementGoals(userId, plan.id, suggestions);

  logger.info(
    {
      planId: plan.id,
      skillsLearned: skillsLearned.length,
      termsLearned: termsLearned.length,
      suggestions: suggestions.length,
    },
    'G-Agent: Self-improvement cycle completed'
  );

  return { skillsLearned, termsLearned, suggestions };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectTriggerPattern(tasks: Task[]): string {
  // Simple trigger detection based on first task
  const firstTask = tasks[0];
  if (!firstTask) return '*';

  const action = firstTask.action.toLowerCase();
  const feature = firstTask.feature.toLowerCase();

  if (action.includes('create')) return `create ${feature}`;
  if (action.includes('update')) return `update ${feature}`;
  if (action.includes('delete')) return `delete ${feature}`;
  if (action.includes('add')) return `add ${feature}`;
  if (action.includes('implement')) return `implement ${feature}`;

  return `${action} ${feature}`.trim();
}

function generateSkillName(feature: string, tasks: Task[]): string {
  const action = tasks[0]?.action || 'Handle';
  const words = `${action} ${feature}`.split(/\s+/);
  return words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export const gAgentSelfImprovement = {
  extractSkillsFromPlan,
  learnSkillsFromPlan,
  extractTerminologyFromPlan,
  learnTerminologyFromPlan,
  analyzeForImprovements,
  scheduleImprovementGoals,
  runSelfImprovementCycle,
};

export default gAgentSelfImprovement;
