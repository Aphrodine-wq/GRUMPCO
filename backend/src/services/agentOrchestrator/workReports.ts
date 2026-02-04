/**
 * Work Report Generation
 *
 * Generates detailed post-execution reports for each agent, including code analysis,
 * security scanning, and performance suggestions.
 *
 * @module agentOrchestrator/workReports
 */

import { getRequestLogger } from "../../middleware/logger.js";
import { getDatabase } from "../../db/database.js";
import {
  analyzeCode,
  scanSecurity,
  optimizePerformance,
} from "../claudeCodeService.js";
import type {
  CodeAnalysis,
  SecurityIssue,
  PerformanceOptimization,
} from "../../types/claudeCode.js";
import {
  resilientLlmCall,
  DEFAULT_AGENT_MODEL,
  extractJsonFromResponse,
} from "./shared.js";
import type {
  GenerationSession,
  AgentType,
  AgentTask,
  GeneratedFile,
  AgentWorkReport,
} from "../../types/agents.js";
import type { PRD } from "../../types/prd.js";

/**
 * Generate detailed work report for an agent after code generation
 */
export async function generateAgentWorkReport(
  agentType: AgentType,
  session: GenerationSession,
  agentTask: AgentTask,
  generatedFiles: GeneratedFile[],
  prd: PRD,
  architecturePlan?: Record<string, unknown>,
  prds?: PRD[],
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
      ? JSON.stringify(
          prds.map((p) => ({
            id: p.id,
            projectName: p.projectName,
            sections: p.sections,
          })),
          null,
          2,
        )
      : JSON.stringify(prd.sections, null, 2);

    // Perform code analysis on generated files
    let codeAnalysisSummary = "";
    let securityIssuesSummary = "";
    let performanceSummary = "";

    try {
      const sampleFiles = generatedFiles
        .filter(
          (f) => f.type === "source" && f.content && f.content.length < 10000,
        )
        .slice(0, 3);

      if (sampleFiles.length > 0) {
        const analyses = await Promise.allSettled(
          sampleFiles.map((f) =>
            analyzeCode(f.content, f.language || "typescript"),
          ),
        );

        const successfulAnalyses = analyses
          .filter(
            (r): r is PromiseFulfilledResult<CodeAnalysis> =>
              r.status === "fulfilled",
          )
          .map((r) => r.value);

        if (successfulAnalyses.length > 0) {
          const allPatterns = successfulAnalyses.flatMap(
            (a) => a.patterns || [],
          );
          const allSmells = successfulAnalyses.flatMap(
            (a) => a.codeSmells || [],
          );
          codeAnalysisSummary = `Code Analysis:\n- Patterns detected: ${allPatterns.length}\n- Code smells: ${allSmells.length}\n- Recommendations: ${successfulAnalyses
            .flatMap((a) => a.recommendations || [])
            .slice(0, 5)
            .join(", ")}`;
        }

        const securityScans = await Promise.allSettled(
          sampleFiles.map((f) =>
            scanSecurity(f.content, f.language || "typescript"),
          ),
        );

        const securityResults = securityScans
          .filter(
            (r): r is PromiseFulfilledResult<SecurityIssue[]> =>
              r.status === "fulfilled",
          )
          .flatMap((r) => r.value);

        if (securityResults.length > 0) {
          const criticalIssues = securityResults.filter(
            (i) => i.severity === "critical" || i.severity === "high",
          );
          securityIssuesSummary = `Security Scan:\n- Issues found: ${securityResults.length}\n- Critical/High: ${criticalIssues.length}\n- Types: ${[...new Set(securityResults.map((i) => i.type))].join(", ")}`;
        }

        const perfScans = await Promise.allSettled(
          sampleFiles.map((f) =>
            optimizePerformance(f.content, f.language || "typescript"),
          ),
        );

        const perfResults = perfScans
          .filter(
            (r): r is PromiseFulfilledResult<PerformanceOptimization[]> =>
              r.status === "fulfilled",
          )
          .flatMap((r) => r.value);

        if (perfResults.length > 0) {
          const highPriority = perfResults.filter((o) => o.priority === "high");
          performanceSummary = `Performance Analysis:\n- Optimizations suggested: ${perfResults.length}\n- High priority: ${highPriority.length}`;
        }
      }
    } catch (error) {
      log.warn(
        { agentType, error: (error as Error).message },
        "Code analysis failed, continuing without it",
      );
    }

    const userContent = `Agent Type: ${agentType}
Session ID: ${session.sessionId}
Task ID: ${agentTask.taskId}

PRD Context:
${prdContext}

${architecturePlan ? `Architecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}\n\n` : ""}
Generated Files (${generatedFiles.length}):
${generatedFiles.map((f) => `- ${f.path} (${f.type}, ${f.language}, ${f.size} bytes)`).join("\n")}

${codeAnalysisSummary ? `${codeAnalysisSummary}\n\n` : ""}
${securityIssuesSummary ? `${securityIssuesSummary}\n\n` : ""}
${performanceSummary ? `${performanceSummary}\n\n` : ""}
Agent Output:
${JSON.stringify(agentTask.output || {}, null, 2)}

Generate a comprehensive work report documenting what this agent accomplished, decisions made, integration points, and any issues or recommendations. Include insights from the code analysis above.`;

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    let jsonText = extractJsonFromResponse(response.text);
    // Fallback: extract bare JSON object
    if (!jsonText.startsWith("{")) {
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

    if (!session.workReports) {
      session.workReports = {} as Record<AgentType, AgentWorkReport>;
    }
    session.workReports[agentType] = workReport;

    const db = getDatabase();
    await db.saveWorkReport(workReport);
    await db.saveSession(session);

    log.info(
      { agentType, sessionId: session.sessionId },
      "Work report generated",
    );
    return workReport;
  } catch (error) {
    log.warn(
      { agentType, error: (error as Error).message },
      "Work report generation failed",
    );
    return {
      agentType,
      sessionId: session.sessionId,
      taskId: agentTask.taskId,
      report: {
        summary: `Work completed but report generation failed: ${(error as Error).message}`,
        filesGenerated: generatedFiles.map((f) => ({
          path: f.path,
          purpose: f.type,
          keyDecisions: [],
        })),
        architectureDecisions: [],
        codeQualityMetrics: { issues: [] },
        integrationPoints: [],
        testingStrategy: "Not documented",
        knownIssues: [],
        recommendations: [],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
