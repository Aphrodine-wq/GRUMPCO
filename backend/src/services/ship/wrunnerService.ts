/**
 * WRunner Service
 * Analyzes agent work reports, identifies issues, and generates fix plans
 */

import logger, { getRequestLogger } from '../../middleware/logger.js';
import { createApiTimer } from '../../middleware/metrics.js';
import { getWRunnerAgentPrompt } from '../../prompts/agents/wrunner-agent.js';
import type {
  AgentWorkReport,
  WRunnerAnalysis,
  GenerationSession,
  AgentType,
} from '../../types/agents.js';
import type { PRD } from '../../types/prd.js';
import {
  scanSecurity,
  optimizePerformance,
  analyzeCode,
} from '../ai-providers/claudeCodeService.js';
import type {
  CodeAnalysis,
  SecurityIssue,
  PerformanceOptimization,
} from '../../types/claudeCode.js';
import { withResilience as _withResilience } from '../infra/resilience.js';
import { getCompletion } from '../ai-providers/llmGatewayHelper.js';

/**
 * Analyze all agent work reports and identify issues
 */
export async function analyzeAgentReports(
  session: GenerationSession,
  workReports: Record<AgentType, AgentWorkReport>,
  prd?: PRD,
  prds?: PRD[]
): Promise<WRunnerAnalysis> {
  const log = getRequestLogger();
  const timer = createApiTimer('wrunner_analysis');

  try {
    const systemPrompt = getWRunnerAgentPrompt();

    const prdContext = prds
      ? JSON.stringify(
          prds.map((p) => ({
            id: p.id,
            projectName: p.projectName,
            sections: p.sections,
          })),
          null,
          2
        )
      : prd
        ? JSON.stringify(prd.sections, null, 2)
        : '{}';

    const reportsSummary = Object.entries(workReports).map(([agentType, report]) => ({
      agentType,
      summary: report.report.summary,
      filesGenerated: report.report.filesGenerated.length,
      architectureDecisions: report.report.architectureDecisions.length,
      knownIssues: report.report.knownIssues.length,
      recommendations: report.report.recommendations.length,
    }));

    // Perform Claude Code analysis on generated files if available
    let claudeCodeInsights = '';
    if (session.generatedFiles && session.generatedFiles.length > 0) {
      try {
        const sampleFiles = session.generatedFiles
          .filter((f) => f.type === 'source' && f.content && f.content.length < 5000)
          .slice(0, 5);

        if (sampleFiles.length > 0) {
          const [analyses, securityScans, perfScans] = await Promise.all([
            Promise.allSettled(
              sampleFiles.map((f) => analyzeCode(f.content, f.language || 'typescript'))
            ),
            Promise.allSettled(
              sampleFiles.map((f) => scanSecurity(f.content, f.language || 'typescript'))
            ),
            Promise.allSettled(
              sampleFiles.map((f) => optimizePerformance(f.content, f.language || 'typescript'))
            ),
          ]);

          const analysisResults = analyses
            .filter((r): r is PromiseFulfilledResult<CodeAnalysis> => r.status === 'fulfilled')
            .flatMap((r) => r.value);

          const securityResults = securityScans
            .filter((r): r is PromiseFulfilledResult<SecurityIssue[]> => r.status === 'fulfilled')
            .flatMap((r) => r.value);

          const perfResults = perfScans
            .filter(
              (r): r is PromiseFulfilledResult<PerformanceOptimization[]> =>
                r.status === 'fulfilled'
            )
            .flatMap((r) => r.value);

          if (analysisResults.length > 0 || securityResults.length > 0 || perfResults.length > 0) {
            claudeCodeInsights = `\n\nClaude Code Analysis Insights:\n`;
            if (analysisResults.length > 0) {
              const allSmells = analysisResults.flatMap((a) => a.codeSmells || []);
              const criticalSmells = allSmells.filter(
                (s) => s.severity === 'critical' || s.severity === 'high'
              );
              claudeCodeInsights += `- Code Quality: ${allSmells.length} code smells detected (${criticalSmells.length} critical/high)\n`;
            }
            if (securityResults.length > 0) {
              const criticalSecurity = securityResults.filter(
                (s) => s.severity === 'critical' || s.severity === 'high'
              );
              claudeCodeInsights += `- Security: ${securityResults.length} issues found (${criticalSecurity.length} critical/high)\n`;
            }
            if (perfResults.length > 0) {
              const highPriorityPerf = perfResults.filter((p) => p.priority === 'high');
              claudeCodeInsights += `- Performance: ${perfResults.length} optimization opportunities (${highPriorityPerf.length} high priority)\n`;
            }
          }
        }
      } catch (error) {
        log.warn(
          { error: (error as Error).message },
          'Claude Code analysis in WRunner failed, continuing without it'
        );
      }
    }

    const userContent = `Session ID: ${session.sessionId}

PRD Context:
${prdContext}

Agent Work Reports Summary:
${JSON.stringify(reportsSummary, null, 2)}

Full Agent Work Reports:
${JSON.stringify(workReports, null, 2)}
${claudeCodeInsights}

Analyze all agent work reports and identify:
1. Missing components or features
2. Inconsistencies between agents
3. Integration gaps
4. Code quality concerns (use Claude Code insights above)
5. Security issues (use Claude Code security scan above)
6. Performance issues (use Claude Code performance analysis above)
7. Recommendations for fixes

Generate a comprehensive analysis with actionable fixes.`;

    const result = await getCompletion({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    if (result.error) {
      throw new Error(`LLM API error: ${result.error}`);
    }

    let jsonText = result.text;
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

    const analysis = JSON.parse(jsonText) as WRunnerAnalysis;
    analysis.sessionId = session.sessionId;

    log.info(
      {
        sessionId: session.sessionId,
        issueCount: analysis.issues.length,
        autoFixable: analysis.autoFixable,
      },
      'WRunner analysis completed'
    );
    timer.success();

    return analysis;
  } catch (error) {
    log.error(
      { sessionId: session.sessionId, error: (error as Error).message },
      'WRunner analysis failed'
    );
    timer.failure('wrunner_error');
    throw error;
  }
}

/**
 * Generate a fix plan from WRunner analysis
 */
export function generateFixPlan(analysis: WRunnerAnalysis): {
  autoFixable: Array<WRunnerAnalysis['issues'][0]>;
  manualFix: Array<WRunnerAnalysis['issues'][0]>;
  priority: Array<WRunnerAnalysis['issues'][0]>;
} {
  const autoFixable: WRunnerAnalysis['issues'][0][] = [];
  const manualFix: WRunnerAnalysis['issues'][0][] = [];
  const priority: WRunnerAnalysis['issues'][0][] = [];

  for (const issue of analysis.issues) {
    // Determine if auto-fixable based on category and severity
    const isAutoFixable =
      (issue.category === 'missing' ||
        issue.category === 'quality' ||
        issue.category === 'inconsistency') &&
      issue.severity !== 'critical' &&
      issue.suggestedFixes.length > 0 &&
      issue.suggestedFixes.some((fix) => fix.code || fix.files.length > 0);

    if (isAutoFixable) {
      autoFixable.push(issue);
    } else {
      manualFix.push(issue);
    }

    // Prioritize by severity
    if (issue.severity === 'critical' || issue.severity === 'high') {
      priority.push(issue);
    }
  }

  // Sort priority by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  priority.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { autoFixable, manualFix, priority };
}

/**
 * Check if analysis indicates auto-fixable issues
 */
export function hasAutoFixableIssues(analysis: WRunnerAnalysis): boolean {
  return (
    analysis.autoFixable &&
    analysis.issues.some((issue) => {
      const isAutoFixable =
        (issue.category === 'missing' ||
          issue.category === 'quality' ||
          issue.category === 'inconsistency') &&
        issue.severity !== 'critical' &&
        issue.suggestedFixes.length > 0;
      return isAutoFixable;
    })
  );
}
