/**
 * Anticipatory Service
 * Proactively detects issues and opportunities, suggests tasks before user asks.
 *
 * Categories:
 * - Code Issues: bugs, vulnerabilities, outdated deps
 * - Project Health: test coverage, docs freshness, tech debt
 * - User Patterns: predict what user will ask
 * - Market Trends: relevant tech updates
 */

import logger from "../middleware/logger.js";
import { getDatabase as _getDatabase } from "../db/database.js";
import { writeAuditLog } from "./auditLogService.js";
import { getCompletion } from "./llmGatewayHelper.js";
import { queueAgentTask, isAgentRunning } from "./persistentAgentService.js";
import { getCompletion } from "./llmGatewayHelper.js";

// ========== Types ==========

export interface AnticipatoryInsight {
  id: string;
  userId: string;
  category: "code_issue" | "project_health" | "user_pattern" | "market_trend";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  suggestedAction?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt?: string;
  actionTakenAt?: string;
}

export interface ProjectHealthScore {
  overall: number; // 0-100
  testCoverage: number;
  docsFreshness: number;
  techDebt: number;
  securityScore: number;
  lastUpdated: string;
}

export interface CodeScanResult {
  vulnerabilities: Array<{
    severity: "low" | "medium" | "high" | "critical";
    file: string;
    line?: number;
    message: string;
    cwe?: string;
  }>;
  outdatedDeps: Array<{
    name: string;
    current: string;
    latest: string;
    breaking: boolean;
  }>;
  codeSmells: Array<{
    file: string;
    type: string;
    message: string;
  }>;
}

export interface UserPatternPrediction {
  predictedIntent: string;
  confidence: number;
  basedOn: string[];
  suggestedPrompt?: string;
}

// ========== In-Memory Storage ==========

const userInsights = new Map<string, AnticipatoryInsight[]>();
const projectHealthCache = new Map<string, ProjectHealthScore>();
const userPatternHistory = new Map<string, string[]>();


// ========== Helper Functions ==========

async function detectPackageManager(workspacePath: string): Promise<"npm" | "pnpm" | "yarn" | null> {
  try {
    const files = await fs.readdir(workspacePath);
    if (files.includes("pnpm-lock.yaml")) return "pnpm";
    if (files.includes("yarn.lock")) return "yarn";
    if (files.includes("package-lock.json")) return "npm";
    return null;
  } catch (_error) {
    return null;
  }
}

async function runCommand(cmd: string, cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error: any) {
    // npm/pnpm audit return non-zero exit code if vulns found
    if (error.stdout) return error.stdout;
    throw error;
  }
}

function parseAuditOutput(jsonOutput: string): CodeScanResult["vulnerabilities"] {
  const vulnerabilities: CodeScanResult["vulnerabilities"] = [];
  try {
    const data = JSON.parse(jsonOutput);

    // npm 7+ "vulnerabilities" object
    if (data.vulnerabilities && !data.advisories) {
      for (const [pkgName, vuln] of Object.entries(data.vulnerabilities) as [string, any][]) {
        if (Array.isArray(vuln.via)) {
          for (const via of vuln.via) {
            if (typeof via === "object") {
              vulnerabilities.push({
                severity: via.severity || vuln.severity || "low",
                file: `package.json > ${pkgName}`,
                message: via.title || "Vulnerability detected",
                cwe: Array.isArray(via.cwe) ? via.cwe.join(", ") : via.cwe,
              });
            }
          }
        }
      }
    }
    // npm 6 / pnpm "advisories" object
    else if (data.advisories) {
      for (const advisory of Object.values(data.advisories) as any[]) {
        const severity = advisory.severity || "low";
        const message = advisory.title || "Vulnerability detected";
        const cwe = Array.isArray(advisory.cwe) ? advisory.cwe.join(", ") : advisory.cwe;

        if (advisory.findings && Array.isArray(advisory.findings)) {
          for (const finding of advisory.findings) {
            const paths = finding.paths || [];
            for (const p of paths) {
              vulnerabilities.push({
                severity,
                file: `package.json > ${p}`,
                message,
                cwe,
              });
            }
            if (paths.length === 0) {
              vulnerabilities.push({
                severity,
                file: `package.json > ${advisory.module_name}`,
                message,
                cwe,
              });
            }
          }
        } else {
           vulnerabilities.push({
              severity,
              file: `package.json > ${advisory.module_name}`,
              message,
              cwe,
           });
        }
      }
    }
  } catch (e) {
    logger.error({ error: e }, "Failed to parse audit output");
  }
  return vulnerabilities;
}

function parseOutdatedOutput(jsonOutput: string): CodeScanResult["outdatedDeps"] {
  const outdated: CodeScanResult["outdatedDeps"] = [];
  try {
    const data = JSON.parse(jsonOutput);
    for (const [name, info] of Object.entries(data) as [string, any][]) {
      const current = info.current || info.wanted || "unknown";
      const latest = info.latest || "unknown";

      let breaking = false;
      if (current !== "unknown" && latest !== "unknown") {
          const currentMajor = parseInt(current.split('.')[0]);
          const latestMajor = parseInt(latest.split('.')[0]);
          if (!isNaN(currentMajor) && !isNaN(latestMajor) && latestMajor > currentMajor) {
              breaking = true;
          }
      }

      outdated.push({
        name,
        current,
        latest,
        breaking,
      });
    }
  } catch (e) {
    logger.error({ error: e }, "Failed to parse outdated output");
  }
  return outdated;
}

// ========== Code Issues Detection ==========


/**
 * Scan for code issues in a workspace
 */
export async function scanForCodeIssues(
  userId: string,
  workspacePath: string,
): Promise<CodeScanResult> {
  logger.info({ userId, workspacePath }, "Starting code issue scan");

  const result: CodeScanResult = {
    vulnerabilities: [],
    outdatedDeps: [],
    codeSmells: [],
  };

  try {
    const pm = await detectPackageManager(workspacePath);
    if (!pm) {
      logger.warn({ userId, workspacePath }, "No supported package manager found (npm/pnpm/yarn)");
      result.codeSmells.push({
          file: 'package.json',
          type: 'setup',
          message: 'No lockfile found. Run npm/pnpm install to generate one for accurate scanning.'
      });
      return result;
    }

    logger.info({ userId, pm }, `Detected package manager: ${pm}`);

    let auditCmd = '';
    let outdatedCmd = '';

    if (pm === 'npm') {
        auditCmd = 'npm audit --json';
        outdatedCmd = 'npm outdated --json';
    } else if (pm === 'pnpm') {
        auditCmd = 'pnpm audit --json';
        outdatedCmd = 'pnpm outdated --json';
    } else if (pm === 'yarn') {
        auditCmd = 'yarn audit --json';
        outdatedCmd = 'yarn outdated --json';
    }

    // Run in parallel
    const [auditRes, outdatedRes] = await Promise.allSettled([
        runCommand(auditCmd, workspacePath),
        runCommand(outdatedCmd, workspacePath)
    ]);

    if (auditRes.status === 'fulfilled') {
        result.vulnerabilities = parseAuditOutput(auditRes.value);
    } else {
        logger.warn({ error: auditRes.reason }, "Audit command failed");
    }

    if (outdatedRes.status === 'fulfilled') {
        result.outdatedDeps = parseOutdatedOutput(outdatedRes.value);
    } else {
        logger.warn({ error: outdatedRes.reason }, "Outdated command failed");
    }

    // Generate insights from scan results
    if (result.vulnerabilities.length > 0) {
      const highSeverity = result.vulnerabilities.filter(v => ['high', 'critical'].includes(v.severity)).length;
      await createInsight({
        userId,
        category: "code_issue",
        severity: highSeverity > 0 ? "critical" : "warning",
        title: `${result.vulnerabilities.length} security vulnerabilities detected`,
        description:
          `Security scan found ${result.vulnerabilities.length} potential vulnerabilities (${highSeverity} high/critical).`,
        suggestedAction:
          `Run \`${pm} audit fix\` to resolve automatically fixable issues.`,
        metadata: { vulnerabilities: result.vulnerabilities.slice(0, 50) },
      });
    }

    if (result.outdatedDeps.length > 0) {
      const breaking = result.outdatedDeps.filter(d => d.breaking).length;
      if (breaking > 0 || result.outdatedDeps.length > 5) {
          await createInsight({
            userId,
            category: "code_issue",
            severity: breaking > 0 ? "warning" : "info",
            title: `${result.outdatedDeps.length} outdated dependencies`,
            description: `${result.outdatedDeps.length} dependencies can be updated (${breaking} breaking changes).`,
            suggestedAction: `Review and update dependencies with \`${pm} update\`.`,
            metadata: { outdatedDeps: result.outdatedDeps.slice(0, 50) },
          });
      }
    }

    logger.info(
      {
        userId,
        vulnerabilities: result.vulnerabilities.length,
        outdatedDeps: result.outdatedDeps.length,
      },
      "Code issue scan complete",
    );
  } catch (err) {
    logger.error({ userId, err }, "Code issue scan failed");
  }

  return result;
}

/**
 * Schedule periodic code scans
 */
export async function scheduleCodeScan(
  userId: string,
  workspacePath: string,
  intervalHours: number = 24,
): Promise<void> {
  if (!isAgentRunning(userId)) {
    logger.warn(
      { userId },
      "Cannot schedule code scan - persistent agent not running",
    );
    return;
  }

  await queueAgentTask(userId, "anticipatory", {
    type: "code_scan",
    workspacePath,
    scheduledFor: new Date(
      Date.now() + intervalHours * 60 * 60 * 1000,
    ).toISOString(),
  });
}

// ========== Project Health Monitoring ==========

/**
 * Calculate project health score
 */
export async function calculateProjectHealth(
  userId: string,
  workspacePath: string,
): Promise<ProjectHealthScore> {
  logger.info({ userId, workspacePath }, "Calculating project health");

  // Execute checks in parallel
  const [testCoverage, docsFreshness, techDebt, securityScore] = await Promise.all([
    getTestCoverage(workspacePath),
    getDocsFreshness(workspacePath),
    getTechDebt(workspacePath),
    getSecurityScore(workspacePath),
  ]);

  const overall = Math.round(
    (testCoverage * 0.3) +
    (docsFreshness * 0.2) +
    (techDebt * 0.25) +
    (securityScore * 0.25)
  );

  const score: ProjectHealthScore = {
    overall,
    testCoverage,
    docsFreshness,
    techDebt,
    securityScore,
    lastUpdated: new Date().toISOString(),
  };

  projectHealthCache.set(userId, score);

  // Generate insights based on health score
  if (score.testCoverage < 50) {
    await createInsight({
      userId,
      category: "project_health",
      severity: "warning",
      title: "Low test coverage detected",
      description: `Test coverage is at ${score.testCoverage}%. Consider adding more tests.`,
      suggestedAction: "Focus on testing critical paths and edge cases.",
    });
  }

  if (score.docsFreshness < 50) {
    await createInsight({
      userId,
      category: "project_health",
      severity: "info",
      title: "Documentation may be outdated",
      description: "Some documentation files haven't been updated recently.",
      suggestedAction: "Review and update README and API documentation.",
    });
  }

  if (score.securityScore < 60) {
    await createInsight({
      userId,
      category: "project_health",
      severity: "critical",
      title: "Security score needs attention",
      description: "Security analysis indicates potential issues.",
      suggestedAction: "Run security audit and address findings.",
    });
  }

  return score;
}

/**
 * Get cached project health score
 */
export function getProjectHealth(userId: string): ProjectHealthScore | null {
  return projectHealthCache.get(userId) || null;
}

// ========== User Pattern Analysis ==========

/**
 * Record user interaction for pattern learning
 */
export async function recordUserInteraction(
  userId: string,
  interaction: {
    type: "chat" | "ship" | "codegen" | "plan";
    prompt: string;
    result?: "success" | "failure";
    context?: Record<string, unknown>;
  },
): Promise<void> {
  const history = userPatternHistory.get(userId) || [];

  // Keep last 100 interactions
  history.push(
    JSON.stringify({
      ...interaction,
      timestamp: new Date().toISOString(),
    }),
  );

  if (history.length > 100) {
    history.shift();
  }

  userPatternHistory.set(userId, history);
}

/**
 * Predict next user intent based on patterns
 */
export async function predictUserIntent(
  userId: string,
  _currentContext: Record<string, unknown>,
): Promise<UserPatternPrediction | null> {
  const history = userPatternHistory.get(userId);
  if (!history || history.length < 5) {
    return null; // Need more data for prediction
  }

  // In a real implementation, this would use ML to analyze patterns
  // For now, use simple heuristics

  const recentInteractions = history.slice(-10).map((h) => JSON.parse(h));
  const interactionTypes = recentInteractions.map((i) => i.type);

  // Simple pattern: if last 3 were 'chat', predict 'ship'
  const lastThreeTypes = interactionTypes.slice(-3);
  if (lastThreeTypes.every((t) => t === "chat")) {
    return {
      predictedIntent: "ship",
      confidence: 0.6,
      basedOn: ["frequent_chat_pattern"],
      suggestedPrompt:
        "Ready to build something? Try SHIP mode to generate code.",
    };
  }

  // Pattern: after 'plan', usually 'codegen'
  if (lastThreeTypes[lastThreeTypes.length - 1] === "plan") {
    return {
      predictedIntent: "codegen",
      confidence: 0.7,
      basedOn: ["plan_to_code_pattern"],
      suggestedPrompt: "Your plan is ready. Generate code to implement it?",
    };
  }

  return null;
}

/**
 * Get proactive suggestions based on user patterns
 */
export async function getProactiveSuggestions(
  userId: string,
): Promise<Array<{ type: string; message: string; action?: string }>> {
  const suggestions: Array<{ type: string; message: string; action?: string }> =
    [];

  // Check for pending insights
  const insights = getUserInsights(userId);
  const unacknowledged = insights.filter((i) => !i.acknowledgedAt);

  if (unacknowledged.length > 0) {
    const critical = unacknowledged.filter((i) => i.severity === "critical");
    if (critical.length > 0) {
      suggestions.push({
        type: "insight",
        message: `${critical.length} critical issues need attention`,
        action: "View insights",
      });
    }
  }

  // Check project health
  const health = getProjectHealth(userId);
  if (health && health.overall < 60) {
    suggestions.push({
      type: "health",
      message: `Project health score is ${health.overall}%`,
      action: "View health report",
    });
  }

  // Predict next action
  const prediction = await predictUserIntent(userId, {});
  if (prediction && prediction.confidence > 0.5) {
    suggestions.push({
      type: "prediction",
      message:
        prediction.suggestedPrompt || `Try ${prediction.predictedIntent}`,
      action: prediction.predictedIntent,
    });
  }

  return suggestions;
}


// ========== Market Trends ==========

interface RawTrendItem {
  title: string;
  url: string;
  source: "dev.to" | "hacker-news";
  summary?: string;
  score?: number;
  publishedAt: string;
}

async function fetchFromDevTo(tag: string): Promise<RawTrendItem[]> {
  try {
    const res = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=5`);
    if (!res.ok) return [];
    const json = await res.json() as any[];
    return json.map(item => ({
      title: item.title,
      url: item.url,
      source: "dev.to",
      summary: item.description,
      score: item.positive_reactions_count,
      publishedAt: item.published_at
    }));
  } catch (e) {
    logger.error({ error: e, tag }, "Failed to fetch from Dev.to");
    return [];
  }
}

async function fetchFromHN(query: string): Promise<RawTrendItem[]> {
  try {
    const res = await fetch(`http://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`);
    if (!res.ok) return [];
    const json = await res.json() as any;
    return json.hits.map((item: any) => ({
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      source: "hacker-news",
      score: item.points,
      publishedAt: item.created_at
    }));
  } catch (e) {
    logger.error({ error: e, query }, "Failed to fetch from HN");
    return [];
  }
}

/**
 * Fetch relevant tech trends
 */
export async function fetchTechTrends(
  _userId: string,
  techStack: string[],
): Promise<
  Array<{ title: string; summary: string; url?: string; relevance: number }>
> {
  logger.info({ techStack }, "Fetching tech trends");

  if (!techStack || techStack.length === 0) {
    return [];
  }

  // Parallel fetch for all technologies
  const allPromises = techStack.flatMap(tech => [
    fetchFromDevTo(tech),
    fetchFromHN(tech)
  ]);

  const results = await Promise.allSettled(allPromises);
  const rawItems: RawTrendItem[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled') {
      rawItems.push(...res.value);
    }
  }

  // Deduplicate by URL
  const uniqueItems = Array.from(new Map(rawItems.map(item => [item.url, item])).values());

  if (uniqueItems.length === 0) {
    return [];
  }

  // Limit input to LLM to top 20 items to save context
  const topItems = uniqueItems
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 20);

  // Construct Prompt
  const prompt = `
    You are a tech trend analyst. I have a list of recent articles/stories for a developer interested in: ${techStack.join(', ')}.

    Here are the top stories:
    ${JSON.stringify(topItems.map(i => ({ title: i.title, source: i.source, desc: i.summary })), null, 2)}

    Please select the top 5 most relevant and interesting items.
    For each item, provide:
    1. The exact title (must match the input exactly so I can link it back)
    2. A concise summary (1-2 sentences) explaining why it matters.
    3. A relevance score (0.0 to 1.0) based on how significant this is for the tech stack.

    Return ONLY a valid JSON array of objects with keys: "title", "summary", "relevance".
    Do not include markdown formatting or code blocks. Just the raw JSON.
  `;

  // Call LLM
  const { text, error } = await getCompletion({
    messages: [{ role: 'user', content: prompt }],
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    max_tokens: 1000,
  }, { provider: 'nim' });

  if (error || !text) {
    logger.error({ error }, "Failed to generate trend summary with LLM");
    // Fallback: return raw items without summary if LLM fails
    return topItems.slice(0, 5).map(i => ({
      title: i.title,
      summary: i.summary || "No summary available",
      url: i.url,
      relevance: 0.5
    }));
  }

  try {
    // Clean potential markdown blocks
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const suggestions = JSON.parse(cleanText) as Array<{ title: string; summary: string; relevance: number }>;

    // Merge back URLs
    return suggestions.map(s => {
      // Find original item by title (fuzzy match might be safer but trying exact first)
      const original = topItems.find(i => i.title.includes(s.title) || s.title.includes(i.title));
      return {
        ...s,
        url: original?.url
      };
    }).filter(s => s.url);
  } catch (e) {
    logger.error({ error: e, text }, "Failed to parse LLM response for trends");
    return topItems.slice(0, 5).map(i => ({
        title: i.title,
        summary: i.summary || "No summary available",
        url: i.url,
        relevance: 0.5
    }));
  }
}


/**
 * Schedule trend check
 */
export async function scheduleTrendCheck(
  userId: string,
  techStack: string[],
): Promise<void> {
  if (!isAgentRunning(userId)) {
    return;
  }

  await queueAgentTask(userId, "anticipatory", {
    type: "trend_check",
    techStack,
  });
}

// ========== Insight Management ==========

/**
 * Create a new insight
 */
async function createInsight(
  input: Omit<AnticipatoryInsight, "id" | "createdAt">,
): Promise<AnticipatoryInsight> {
  const insight: AnticipatoryInsight = {
    id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };

  const insights = userInsights.get(input.userId) || [];
  insights.push(insight);

  // Keep last 50 insights
  if (insights.length > 50) {
    insights.shift();
  }

  userInsights.set(input.userId, insights);

  await writeAuditLog({
    userId: input.userId,
    action: "anticipatory.insight_created",
    category: "ai",
    target: input.title,
    metadata: { category: input.category, severity: input.severity },
  });

  logger.info(
    { userId: input.userId, insightId: insight.id, category: input.category },
    "Anticipatory insight created",
  );

  return insight;
}

/**
 * Get insights for a user
 */
export function getUserInsights(userId: string): AnticipatoryInsight[] {
  return userInsights.get(userId) || [];
}

/**
 * Acknowledge an insight
 */
export async function acknowledgeInsight(
  userId: string,
  insightId: string,
): Promise<void> {
  const insights = userInsights.get(userId);
  if (!insights) return;

  const insight = insights.find((i) => i.id === insightId);
  if (insight) {
    insight.acknowledgedAt = new Date().toISOString();
  }
}

/**
 * Mark insight as actioned
 */
export async function markInsightActioned(
  userId: string,
  insightId: string,
): Promise<void> {
  const insights = userInsights.get(userId);
  if (!insights) return;

  const insight = insights.find((i) => i.id === insightId);
  if (insight) {
    insight.actionTakenAt = new Date().toISOString();
  }
}

/**
 * Clear old insights
 */
export function clearOldInsights(userId: string, maxAgeDays: number = 7): void {
  const insights = userInsights.get(userId);
  if (!insights) return;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const filtered = insights.filter(
    (i) => new Date(i.createdAt).getTime() > cutoff,
  );
  userInsights.set(userId, filtered);
}

// ========== Scheduled Processing ==========

/**
 * Run all anticipatory checks for a user
 */
export async function runAnticipatoryChecks(
  userId: string,
  workspacePath?: string,
  techStack?: string[],
): Promise<{
  codeIssues: CodeScanResult | null;
  projectHealth: ProjectHealthScore | null;
  predictions: UserPatternPrediction | null;
  suggestions: Array<{ type: string; message: string; action?: string }>;
}> {
  logger.info({ userId }, "Running anticipatory checks");

  let codeIssues: CodeScanResult | null = null;
  let projectHealth: ProjectHealthScore | null = null;

  if (workspacePath) {
    codeIssues = await scanForCodeIssues(userId, workspacePath);
    projectHealth = await calculateProjectHealth(userId, workspacePath);
  }

  const predictions = await predictUserIntent(userId, {});
  const suggestions = await getProactiveSuggestions(userId);

  if (techStack && techStack.length > 0) {
    await fetchTechTrends(userId, techStack);
  }

  return {
    codeIssues,
    projectHealth,
    predictions,
    suggestions,
  };
}

// Export for API routes
export { createInsight };

// ========== Metrics Helpers ==========

/**
 * Get test coverage from lcov.info
 */
async function getTestCoverage(workspacePath: string): Promise<number> {
  try {
    const lcovPath = path.join(workspacePath, "coverage", "lcov.info");
    const content = await fs.readFile(lcovPath, "utf-8");

    let totalLines = 0;
    let coveredLines = 0;

    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("LF:")) {
        totalLines += parseInt(line.substring(3), 10);
      } else if (line.startsWith("LH:")) {
        coveredLines += parseInt(line.substring(3), 10);
      }
    }

    if (totalLines === 0) return 0;
    return Math.round((coveredLines / totalLines) * 100);
  } catch (_error) {
    // If coverage file missing, return 0
    return 0;
  }
}

/**
 * Get documentation freshness score (0-100)
 */
async function getDocsFreshness(workspacePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `git log -1 --format=%ct -- docs/ README.md`,
      { cwd: workspacePath }
    );

    if (!stdout || !stdout.trim()) {
      return 0; // No commits found or not a git repo for docs
    }

    const lastCommitTimestamp = parseInt(stdout.trim(), 10);
    const now = Math.floor(Date.now() / 1000);
    const daysDiff = (now - lastCommitTimestamp) / (24 * 60 * 60);

    if (daysDiff < 7) return 100;
    if (daysDiff < 30) return 90;
    if (daysDiff < 90) return 70;
    if (daysDiff < 180) return 40;
    return 20;
  } catch (_error) {
    return 0;
  }
}

/**
 * Calculate tech debt score (0-100)
 */
async function getTechDebt(workspacePath: string): Promise<number> {
  let score = 100;

  try {
    // 1. Count TODOs
    // grep returns 1 if no matches found, causing exec to fail unless we catch it
    // But pipe to wc -l usually masks grep exit code unless pipefail is set
    const { stdout: todoCount } = await execAsync(
      `grep -r "TODO" src --exclude-dir=node_modules --exclude-dir=dist | wc -l`,
      { cwd: workspacePath }
    ).catch(() => ({ stdout: "0" }));

    const todos = parseInt(todoCount.trim(), 10) || 0;

    // Deduct 1 point per 5 TODOs, capped at 20 points deduction
    score -= Math.min(20, Math.floor(todos / 5));

    // 2. Check lint output if available
    const lintPath = path.join(workspacePath, "lint_output.txt");
    try {
      const lintContent = await fs.readFile(lintPath, "utf-8");
      const errors = (lintContent.match(/error/gi) || []).length;
      const warnings = (lintContent.match(/warning/gi) || []).length;

      // Deduct 5 points per error, 1 per warning, capped at 40 points
      const lintPenalty = Math.min(40, (errors * 5) + warnings);
      score -= lintPenalty;
    } catch (e) {
      // lint output not found, ignore
    }

    return Math.max(0, score);
  } catch (_error) {
    return 70; // Default if check fails
  }
}

/**
 * Calculate security score (0-100)
 */
async function getSecurityScore(workspacePath: string): Promise<number> {
  const calculateScore = (audit: any) => {
    const vulnCounts = audit.metadata?.vulnerabilities || {};
    const critical = vulnCounts.critical || 0;
    const high = vulnCounts.high || 0;
    const moderate = vulnCounts.moderate || 0;
    const low = vulnCounts.low || 0;

    let score = 100;
    score -= (critical * 50);
    score -= (high * 20);
    score -= (moderate * 5);
    score -= (low * 1);

    return Math.max(0, score);
  };

  try {
    // pnpm audit --json --prod
    // Increase maxBuffer for large audit outputs
    const { stdout } = await execAsync("pnpm audit --json --prod", {
      cwd: workspacePath,
      maxBuffer: 1024 * 1024 * 10
    });
    return calculateScore(JSON.parse(stdout));
  } catch (error: any) {
    // pnpm audit returns exit code 1 if vulnerabilities are found
    if (error.stdout) {
      try {
        return calculateScore(JSON.parse(error.stdout));
      } catch (parseError) {
        // failed to parse
      }
    }
    return 80; // Default fallback
  }
}
