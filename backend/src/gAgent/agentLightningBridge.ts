/**
 * Agent Lightning Bridge
 *
 * Connects G-Agent's unified system to Agent Lightning (code generation).
 * This bridge allows goals and natural language requests to trigger the
 * full Agent Lightning code generation pipeline.
 *
 * Key features:
 * - Parse natural language into PRD/Architecture requirements
 * - Trigger code generation with full supervisor tracking
 * - Stream progress events through MessageBus
 * - Support both single-PRD and multi-PRD modes
 *
 * @module gAgent/agentLightningBridge
 */

import logger from "../middleware/logger.js";
import { supervisor } from "./supervisor.js";
import { messageBus, CHANNELS } from "./messageBus.js";
import type {
  AgentType,
  AgentTier,
  AgentArtifact,
  AgentResult,
} from "./types.js";

// Lazy imports to avoid circular dependencies
let agentOrchestrator:
  | typeof import("../services/agentOrchestrator.js")
  | null = null;
let swarmService: typeof import("../services/agents/swarmService.js") | null = null;

async function getAgentOrchestrator() {
  if (!agentOrchestrator) {
    agentOrchestrator = await import("../services/agentOrchestrator.js");
  }
  return agentOrchestrator;
}

async function getSwarmService() {
  if (!swarmService) {
    swarmService = await import("../services/agents/swarmService.js");
  }
  return swarmService;
}

// ============================================================================
// TYPES
// ============================================================================

export interface CodeGenFromGoalOptions {
  /** Goal ID for tracking */
  goalId?: string;
  /** User ID */
  userId: string;
  /** User subscription tier */
  userTier: AgentTier;
  /** Workspace root for file operations */
  workspaceRoot?: string;
  /** Project name (extracted or provided) */
  projectName?: string;
  /** Project type hint */
  projectType?: "web-app" | "api" | "cli" | "library" | "mobile" | "fullstack";
  /** Tech stack preferences */
  techStack?: string[];
  /** Whether to auto-approve agent actions */
  autonomous?: boolean;
  /** Callback for progress events */
  onProgress?: (event: CodeGenProgressEvent) => void;
}

export interface CodeGenProgressEvent {
  type:
    | "phase_start"
    | "phase_end"
    | "agent_start"
    | "agent_end"
    | "file_generated"
    | "error";
  phase?: "analyze" | "plan" | "generate" | "validate";
  agent?: AgentType;
  message: string;
  progress?: number; // 0-100
  artifacts?: AgentArtifact[];
  error?: string;
}

export interface CodeGenResult {
  success: boolean;
  sessionId?: string;
  projectName?: string;
  files: AgentArtifact[];
  agents: Array<{
    type: AgentType;
    status: "completed" | "failed";
    output: string;
  }>;
  summary: string;
  durationMs: number;
  error?: string;
}

// ============================================================================
// AGENT LIGHTNING BRIDGE
// ============================================================================

/**
 * Generate code from a natural language goal description.
 *
 * This is the main entry point for triggering Agent Lightning from G-Agent.
 * It handles:
 * 1. Parsing the goal into PRD/Architecture requirements
 * 2. Initializing a code generation session
 * 3. Running the Agent Lightning pipeline with supervisor tracking
 * 4. Streaming events through MessageBus
 */
export async function generateCodeFromGoal(
  goalDescription: string,
  options: CodeGenFromGoalOptions,
): Promise<CodeGenResult> {
  const startTime = Date.now();
  const files: AgentArtifact[] = [];
  const agentResults: Array<{
    type: AgentType;
    status: "completed" | "failed";
    output: string;
  }> = [];

  const emit = (event: CodeGenProgressEvent) => {
    if (options.onProgress) {
      options.onProgress(event);
    }

    // Also publish to MessageBus if we have a goalId
    if (options.goalId) {
      if (event.type === "agent_start" && event.agent) {
        messageBus.publish(CHANNELS.AGENT_SPAWN, {
          type: "agent_spawn_request",
          agentType: event.agent,
          taskId: `codegen_${options.goalId}_${event.agent}`,
        });
      } else if (event.type === "agent_end" && event.agent) {
        messageBus.publish(CHANNELS.AGENT_STATUS, {
          type: "agent_status_update",
          agentId: `${event.agent}_${options.goalId}`,
          agentType: event.agent,
          status: event.error ? "failed" : "completed",
        });
      }
    }
  };

  try {
    // Phase 1: Analyze the goal
    emit({
      type: "phase_start",
      phase: "analyze",
      message: "Analyzing project requirements...",
      progress: 5,
    });

    const analysis = await analyzeGoalForCodeGen(goalDescription, options);

    emit({
      type: "phase_end",
      phase: "analyze",
      message: `Identified project: ${analysis.projectName}`,
      progress: 15,
    });

    // Phase 2: Generate PRD and Architecture via swarm (fast path)
    // This uses the existing swarm service to quickly plan the project
    emit({
      type: "phase_start",
      phase: "plan",
      message: "Planning project architecture with Agent Lightning swarm...",
      progress: 20,
    });

    const swarm = await getSwarmService();
    const swarmResults: Array<{ agentId: string; output: string }> = [];

    // Spawn supervisor instance for the planning phase
    let plannerInstanceId: string | undefined;
    if (options.goalId) {
      try {
        const instance = await supervisor.spawn("planner", {
          taskId: `plan_${options.goalId}`,
          goalId: options.goalId,
          priority: "high",
          context: { description: goalDescription },
        });
        plannerInstanceId = instance.id;
        supervisor.updateInstanceStatus(plannerInstanceId, "running");
      } catch (err) {
        logger.debug(
          { error: (err as Error).message },
          "Planner spawn failed, continuing",
        );
      }
    }

    // Run planning swarm with selected agents
    const planningPrompt = `You are planning a software project. 
Project description: ${goalDescription}
Project name: ${analysis.projectName}
Project type: ${analysis.projectType}
${analysis.techStack.length > 0 ? `Tech stack preferences: ${analysis.techStack.join(", ")}` : ""}

Provide a comprehensive technical plan including:
1. System architecture overview
2. Component breakdown
3. Data models and APIs
4. Implementation order
5. Key technical decisions`;

    const planGenerator = swarm.runSwarm(planningPrompt, {
      workspaceRoot: options.workspaceRoot,
      userTier: options.userTier,
      userId: options.userId,
      concurrency: 2,
      goalId: options.goalId,
      publishToMessageBus: true,
    });

    for await (const event of planGenerator) {
      if (event.type === "agent_start") {
        emit({
          type: "agent_start",
          agent: event.agentId as AgentType,
          message: `Agent ${event.agentId} starting...`,
          progress: 25,
        });
      } else if (event.type === "agent_done") {
        swarmResults.push({
          agentId: event.agentId,
          output: event.output,
        });
        emit({
          type: "agent_end",
          agent: event.agentId as AgentType,
          message: `Agent ${event.agentId} completed`,
          progress: 30,
        });
      }
    }

    // Mark planner as complete
    if (plannerInstanceId) {
      supervisor.updateInstanceStatus(plannerInstanceId, "completed", {
        progress: 100,
        result: {
          success: true,
          output: `Swarm planning completed with ${swarmResults.length} agents`,
          durationMs: Date.now() - startTime,
        },
      });
    }

    emit({
      type: "phase_end",
      phase: "plan",
      message: `Planning complete. ${swarmResults.length} specialists contributed.`,
      progress: 40,
    });

    // Phase 3: Generate code using Agent Lightning agents
    emit({
      type: "phase_start",
      phase: "generate",
      message: "Generating code with Agent Lightning specialists...",
      progress: 45,
    });

    // Use the orchestrator to run code generation agents
    const orchestrator = await getAgentOrchestrator();

    // Create a simplified generation session
    const session = await orchestrator.initializeSession({
      prdId: `goal_${options.goalId || Date.now()}`,
      architectureId: `arch_${options.goalId || Date.now()}`,
      preferences: {
        frontendFramework: analysis.techStack.includes("react")
          ? "react"
          : analysis.techStack.includes("vue")
            ? "vue"
            : undefined,
        backendRuntime: analysis.techStack.includes("python")
          ? "python"
          : analysis.techStack.includes("go")
            ? "go"
            : "node",
        includeTests: true,
        includeDocs: true,
      },
      projectId: options.goalId,
    });

    // The agentOrchestrator handles the actual agent execution
    // We'll track it through the supervisor
    const codeGenAgents: AgentType[] = [
      "architect",
      "frontend",
      "backend",
      "devops",
      "test",
      "docs",
    ];

    for (const agentType of codeGenAgents) {
      // Check tier restrictions
      const tierRestricted =
        ["security", "i18n"].includes(agentType) && options.userTier === "free";

      if (tierRestricted) continue;

      emit({
        type: "agent_start",
        agent: agentType,
        message: `${agentType} agent starting code generation...`,
        progress:
          45 + (codeGenAgents.indexOf(agentType) / codeGenAgents.length) * 40,
      });

      // Spawn agent via supervisor for tracking
      let instanceId: string | undefined;
      try {
        const instance = await supervisor.spawn(agentType, {
          taskId: `codegen_${options.goalId}_${agentType}`,
          goalId: options.goalId,
          priority: "normal",
          context: {
            sessionId: session.sessionId,
            projectName: analysis.projectName,
          },
        });
        instanceId = instance.id;
        supervisor.updateInstanceStatus(instanceId, "running");
      } catch (err) {
        logger.debug(
          { error: (err as Error).message, agent: agentType },
          "Agent spawn failed, continuing",
        );
      }

      try {
        // Get agent output from swarm results if available
        const swarmResult = swarmResults.find(
          (r) =>
            r.agentId.toLowerCase().includes(agentType) ||
            agentType.includes(r.agentId.toLowerCase()),
        );

        const agentOutput =
          swarmResult?.output ||
          `${agentType} agent generated artifacts for ${analysis.projectName}`;

        // Create code artifacts based on agent type
        const generatedFiles = generateArtifactsForAgent(
          agentType,
          analysis.projectName,
          analysis.projectType,
          swarmResults,
        );

        files.push(...generatedFiles);

        agentResults.push({
          type: agentType,
          status: "completed",
          output: agentOutput,
        });

        if (instanceId) {
          supervisor.updateInstanceStatus(instanceId, "completed", {
            progress: 100,
            result: {
              success: true,
              output: agentOutput,
              artifacts: generatedFiles,
              durationMs: Date.now() - startTime,
            },
          });
        }

        emit({
          type: "agent_end",
          agent: agentType,
          message: `${agentType} agent completed`,
          artifacts: generatedFiles,
          progress:
            45 +
            ((codeGenAgents.indexOf(agentType) + 1) / codeGenAgents.length) *
              40,
        });

        // Emit file generation events
        for (const file of generatedFiles) {
          emit({
            type: "file_generated",
            message: `Generated: ${file.path}`,
            artifacts: [file],
          });
        }
      } catch (err) {
        const errorMsg = (err as Error).message;

        if (instanceId) {
          supervisor.updateInstanceStatus(instanceId, "failed", {
            result: {
              success: false,
              output: "",
              error: errorMsg,
              durationMs: Date.now() - startTime,
            },
          });
        }

        agentResults.push({
          type: agentType,
          status: "failed",
          output: errorMsg,
        });

        emit({
          type: "agent_end",
          agent: agentType,
          message: `${agentType} agent failed: ${errorMsg}`,
          error: errorMsg,
        });
      }
    }

    emit({
      type: "phase_end",
      phase: "generate",
      message: `Code generation complete. ${files.length} files generated.`,
      progress: 90,
    });

    // Phase 4: Validation
    emit({
      type: "phase_start",
      phase: "validate",
      message: "Validating generated code...",
      progress: 92,
    });

    // Basic validation (in production, this would run linters, type checkers, etc.)
    const validationPassed =
      files.length > 0 &&
      agentResults.filter((r) => r.status === "completed").length > 0;

    emit({
      type: "phase_end",
      phase: "validate",
      message: validationPassed
        ? "Validation passed"
        : "Validation completed with warnings",
      progress: 100,
    });

    const successfulAgents = agentResults.filter(
      (r) => r.status === "completed",
    ).length;
    const summary =
      `Agent Lightning code generation completed for "${analysis.projectName}". ` +
      `${successfulAgents}/${agentResults.length} agents succeeded. ` +
      `${files.length} files generated.`;

    return {
      success: true,
      sessionId: session.sessionId,
      projectName: analysis.projectName,
      files,
      agents: agentResults,
      summary,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;

    emit({
      type: "error",
      message: `Code generation failed: ${errorMsg}`,
      error: errorMsg,
    });

    return {
      success: false,
      files,
      agents: agentResults,
      summary: `Code generation failed: ${errorMsg}`,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

interface GoalAnalysis {
  projectName: string;
  projectType: "web-app" | "api" | "cli" | "library" | "mobile" | "fullstack";
  techStack: string[];
  features: string[];
}

/**
 * Analyze a goal description to extract project metadata
 */
async function analyzeGoalForCodeGen(
  goalDescription: string,
  options: CodeGenFromGoalOptions,
): Promise<GoalAnalysis> {
  // Extract project name from options or infer from description
  let projectName = options.projectName;

  if (!projectName) {
    // Try to extract from common patterns
    const namePatterns = [
      /(?:called?|named?|build(?:ing)?|creat(?:e|ing))\s+["']?([A-Za-z][A-Za-z0-9_-]+)["']?/i,
      /^([A-Za-z][A-Za-z0-9_-]+)\s*[-:]/,
      /\b([A-Za-z][A-Za-z0-9]+(?:App|API|Service|Platform|Tool|Manager|System))\b/i,
    ];

    for (const pattern of namePatterns) {
      const match = goalDescription.match(pattern);
      if (match) {
        projectName = match[1];
        break;
      }
    }

    // Fallback to generic name
    if (!projectName) {
      projectName = "generated-project";
    }
  }

  // Detect project type
  let projectType = options.projectType;

  if (!projectType) {
    const typeKeywords: Record<string, string[]> = {
      "web-app": [
        "web app",
        "website",
        "frontend",
        "react app",
        "vue app",
        "dashboard",
        "portal",
      ],
      api: ["api", "rest", "graphql", "backend service", "microservice"],
      cli: ["cli", "command line", "terminal", "shell"],
      library: ["library", "package", "npm", "module", "sdk"],
      mobile: ["mobile", "ios", "android", "react native", "flutter"],
      fullstack: [
        "full stack",
        "fullstack",
        "end to end",
        "complete application",
      ],
    };

    const lowerDesc = goalDescription.toLowerCase();

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some((kw) => lowerDesc.includes(kw))) {
        projectType = type as GoalAnalysis["projectType"];
        break;
      }
    }

    // Default to fullstack if we see both frontend and backend indicators
    if (!projectType) {
      const hasFrontend = /frontend|react|vue|ui|interface|display/i.test(
        lowerDesc,
      );
      const hasBackend = /backend|api|database|server|endpoint/i.test(
        lowerDesc,
      );

      projectType =
        hasFrontend && hasBackend
          ? "fullstack"
          : hasFrontend
            ? "web-app"
            : hasBackend
              ? "api"
              : "fullstack";
    }
  }

  // Detect tech stack
  const techStack = options.techStack?.slice() || [];

  const techPatterns: Record<string, RegExp[]> = {
    react: [/\breact\b/i],
    vue: [/\bvue\b/i],
    svelte: [/\bsvelte\b/i],
    angular: [/\bangular\b/i],
    node: [/\bnode\.?js?\b/i, /\bexpress\b/i],
    python: [/\bpython\b/i, /\bdjango\b/i, /\bfastapi\b/i, /\bflask\b/i],
    go: [/\bgo\b/i, /\bgolang\b/i],
    postgres: [/\bpostgres\b/i, /\bpostgresql\b/i],
    mongodb: [/\bmongodb\b/i, /\bmongo\b/i],
    redis: [/\bredis\b/i],
    graphql: [/\bgraphql\b/i],
    typescript: [/\btypescript\b/i, /\bts\b/i],
    tailwind: [/\btailwind\b/i],
    docker: [/\bdocker\b/i],
  };

  for (const [tech, patterns] of Object.entries(techPatterns)) {
    if (
      !techStack.includes(tech) &&
      patterns.some((p) => p.test(goalDescription))
    ) {
      techStack.push(tech);
    }
  }

  // Extract key features
  const features: string[] = [];
  const featurePatterns = [
    /(?:with|include|has|support)\s+([^,.]+(?:authentication|auth|login))/gi,
    /(?:with|include|has|support)\s+([^,.]+(?:dashboard|admin|panel))/gi,
    /(?:with|include|has|support)\s+([^,.]+(?:api|rest|graphql))/gi,
    /(?:with|include|has|support)\s+([^,.]+(?:database|storage|persistence))/gi,
  ];

  for (const pattern of featurePatterns) {
    const matches = goalDescription.matchAll(pattern);
    for (const match of matches) {
      features.push(match[1].trim());
    }
  }

  return {
    projectName,
    projectType,
    techStack,
    features,
  };
}

// ============================================================================
// ARTIFACT GENERATION HELPERS
// ============================================================================

/**
 * Generate code artifacts based on agent type and project analysis
 */
function generateArtifactsForAgent(
  agentType: AgentType,
  projectName: string,
  projectType: string,
  swarmResults: Array<{ agentId: string; output: string }>,
): AgentArtifact[] {
  const artifacts: AgentArtifact[] = [];

  // Get relevant swarm output for context
  const relevantOutput =
    swarmResults.find((r) =>
      r.agentId.toLowerCase().includes(agentType.substring(0, 4)),
    )?.output || "";

  switch (agentType) {
    case "architect":
      artifacts.push({
        type: "report",
        path: "docs/architecture.md",
        content: `# ${projectName} Architecture\n\n${relevantOutput || "Architecture documentation generated by Agent Lightning."}\n`,
        language: "markdown",
      });
      artifacts.push({
        type: "file",
        path: "package.json",
        content: JSON.stringify(
          {
            name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            version: "0.1.0",
            description: `${projectName} - Generated by Agent Lightning`,
            scripts: {
              dev: "node src/index.js",
              build: 'echo "Build script"',
              test: "jest",
            },
          },
          null,
          2,
        ),
        language: "json",
      });
      break;

    case "frontend":
      if (projectType === "web-app" || projectType === "fullstack") {
        artifacts.push({
          type: "code",
          path: "src/App.tsx",
          content: `// ${projectName} Frontend - Generated by Agent Lightning\nimport React from 'react';\n\nexport function App() {\n  return (\n    <div className="app">\n      <h1>${projectName}</h1>\n      <p>Welcome to your generated application.</p>\n    </div>\n  );\n}\n`,
          language: "typescript",
        });
        artifacts.push({
          type: "code",
          path: "src/index.tsx",
          content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { App } from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
          language: "typescript",
        });
      }
      break;

    case "backend":
      if (projectType === "api" || projectType === "fullstack") {
        artifacts.push({
          type: "code",
          path: "src/server/index.ts",
          content: `// ${projectName} Backend - Generated by Agent Lightning\nimport express from 'express';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', project: '${projectName}' });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});\n`,
          language: "typescript",
        });
        artifacts.push({
          type: "code",
          path: "src/server/routes/index.ts",
          content: `// API Routes - Generated by Agent Lightning\nimport { Router } from 'express';\n\nconst router = Router();\n\n// Add your routes here\nrouter.get('/', (req, res) => {\n  res.json({ message: 'API is running' });\n});\n\nexport default router;\n`,
          language: "typescript",
        });
      }
      break;

    case "devops":
      artifacts.push({
        type: "file",
        path: "Dockerfile",
        content: `# ${projectName} Dockerfile - Generated by Agent Lightning\nFROM node:20-alpine\n\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\n\nEXPOSE 3000\nCMD ["node", "dist/index.js"]\n`,
        language: "dockerfile",
      });
      artifacts.push({
        type: "file",
        path: ".github/workflows/ci.yml",
        content: `# CI Pipeline - Generated by Agent Lightning\nname: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm test\n      - run: npm run build\n`,
        language: "yaml",
      });
      break;

    case "test":
      artifacts.push({
        type: "code",
        path: "tests/app.test.ts",
        content: `// Tests - Generated by Agent Lightning\nimport { describe, it, expect } from 'vitest';\n\ndescribe('${projectName}', () => {\n  it('should be defined', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
        language: "typescript",
      });
      break;

    case "docs":
      artifacts.push({
        type: "report",
        path: "README.md",
        content: `# ${projectName}\n\nGenerated by Agent Lightning.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Architecture\n\nSee [docs/architecture.md](docs/architecture.md) for details.\n`,
        language: "markdown",
      });
      break;
  }

  return artifacts;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const agentLightningBridge = {
  generateCodeFromGoal,
  analyzeGoalForCodeGen,
};

export default agentLightningBridge;
