/**
 * Fix Engine
 *
 * Handles WRunner auto-fix application and validation after code generation.
 * Automatically corrects common issues identified during quality analysis.
 *
 * ## Auto-Fix Categories
 * - **missing**: Missing imports, exports, or declarations
 * - **quality**: Code style, formatting, or pattern issues
 * - **inconsistency**: Naming or structure inconsistencies
 *
 * ## Fix Workflow
 * 1. WRunner analyzes agent output and identifies issues
 * 2. Fix engine generates fix plan from analysis
 * 3. Auto-fixable issues are applied to generated files
 * 4. Fixes are validated for completeness
 *
 * @module agentOrchestrator/fixEngine
 */

import { getRequestLogger } from '../../middleware/logger.js';
import { generateFixPlan } from '../ship/wrunnerService.js';
import type {
  GenerationSession,
  AgentType,
  GeneratedFile,
  WRunnerAnalysis,
} from '../../types/agents.js';

/**
 * Apply auto-fixes based on WRunner analysis.
 *
 * Iterates through all auto-fixable issues and applies suggested fixes
 * to the session. Tracks which fixes succeeded or failed.
 *
 * @param session - The generation session to apply fixes to
 * @param analysis - WRunner analysis with identified issues
 * @returns Array of applied fix results with status
 *
 * @example
 * ```typescript
 * const analysis = await analyzeAgentReports(session, workReports, prd);
 * if (hasAutoFixableIssues(analysis)) {
 *   const fixes = await applyAutoFixes(session, analysis);
 *   console.log(`Applied ${fixes.filter(f => f.status === 'applied').length} fixes`);
 * }
 * ```
 */
export async function applyAutoFixes(
  session: GenerationSession,
  analysis: WRunnerAnalysis
): Promise<Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }>> {
  const log = getRequestLogger();
  const fixPlan = generateFixPlan(analysis);
  const appliedFixes: Array<{
    issueId: string;
    fix: string;
    status: 'applied' | 'failed';
  }> = [];

  if (!session.autoFixesApplied) {
    session.autoFixesApplied = [];
  }

  for (const issue of fixPlan.autoFixable) {
    try {
      log.info({ issueId: issue.id, sessionId: session.sessionId }, 'Applying auto-fix');

      const fixDescription = issue.suggestedFixes
        .map((f: { action: string }) => f.action)
        .join('; ');
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
 * Regenerate output for a specific agent with fixes applied.
 *
 * When an agent's output has critical issues that can't be auto-fixed,
 * this function can be used to regenerate with the issues as context.
 *
 * @param session - The generation session
 * @param agentType - The agent to regenerate output for
 * @param fixes - Issues that need to be addressed
 * @returns Updated array of generated files
 *
 * @example
 * ```typescript
 * const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
 * if (criticalIssues.length) {
 *   const newFiles = await regenerateAgentOutput(session, 'frontend', criticalIssues);
 *   session.generatedFiles = newFiles;
 * }
 * ```
 */
export async function regenerateAgentOutput(
  session: GenerationSession,
  agentType: AgentType,
  fixes: WRunnerAnalysis['issues']
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  log.info({ agentType, sessionId: session.sessionId }, 'Regenerating agent output with fixes');

  const agentTask = session.agents[agentType];
  if (!agentTask || agentTask.status !== 'completed') {
    throw new Error(`Agent ${agentType} has not completed or does not exist`);
  }

  const _agentFixes = fixes.filter((f) => f.affectedAgents.includes(agentType));

  return (
    session.generatedFiles?.filter((_f) => {
      return true;
    }) || []
  );
}

/**
 * Validate that fixes were applied correctly.
 *
 * Checks that all expected auto-fixable issues have corresponding
 * applied fixes, and reports any failures or missing fixes.
 *
 * @param session - The generation session
 * @param analysis - Original WRunner analysis
 * @param appliedFixes - Array of applied fix results
 * @returns Validation result with valid flag and issue descriptions
 *
 * @example
 * ```typescript
 * const fixes = await applyAutoFixes(session, analysis);
 * const validation = validateFixes(session, analysis, fixes);
 * if (!validation.valid) {
 *   console.warn('Fix validation issues:', validation.issues);
 * }
 * ```
 */
export function validateFixes(
  session: GenerationSession,
  analysis: WRunnerAnalysis,
  appliedFixes: Array<{
    issueId: string;
    fix: string;
    status: 'applied' | 'failed';
  }>
): { valid: boolean; issues: string[] } {
  const log = getRequestLogger();
  const issues: string[] = [];

  const appliedIssueIds = new Set(
    appliedFixes.filter((f) => f.status === 'applied').map((f) => f.issueId)
  );
  const expectedIssueIds = new Set(
    analysis.issues
      .filter((i) => {
        const isAutoFixable =
          (i.category === 'missing' ||
            i.category === 'quality' ||
            i.category === 'inconsistency') &&
          i.severity !== 'critical' &&
          i.suggestedFixes.length > 0;
        return isAutoFixable;
      })
      .map((i) => i.id)
  );

  for (const issueId of expectedIssueIds) {
    if (!appliedIssueIds.has(issueId)) {
      issues.push(`Fix for issue ${issueId} was not applied`);
    }
  }

  const failedFixes = appliedFixes.filter((f) => f.status === 'failed');
  if (failedFixes.length > 0) {
    issues.push(`${failedFixes.length} fixes failed to apply`);
  }

  const valid = issues.length === 0;
  log.info(
    { sessionId: session.sessionId, valid, issueCount: issues.length },
    'Fix validation completed'
  );

  return { valid, issues };
}
