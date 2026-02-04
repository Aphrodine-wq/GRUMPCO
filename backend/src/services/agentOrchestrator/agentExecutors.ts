/**
 * Agent Executors
 *
 * Individual agent runner functions (architect, frontend, backend, devops, test, docs).
 * Each function sends a prompt to the LLM and returns structured output.
 *
 * @module agentOrchestrator/agentExecutors
 */

import { getRequestLogger } from "../../middleware/logger.js";
import { createApiTimer } from "../../middleware/metrics.js";
import {
  withSpan,
  addSpanEvent,
  setSpanAttribute,
} from "../../middleware/tracing.js";
import { getArchitectAgentPromptWithContext } from "../../prompts/agents/architect-agent.js";
import { getFrontendAgentPrompt } from "../../prompts/agents/frontend-agent.js";
import { getBackendAgentPrompt } from "../../prompts/agents/backend-agent.js";
import { getDevOpsAgentPrompt } from "../../prompts/agents/devops-agent.js";
import { getTestAgentPrompt } from "../../prompts/agents/test-agent.js";
import { getDocsAgentPrompt } from "../../prompts/agents/docs-agent.js";
import {
  enrichContextForAgent,
  generateContextSummary,
} from "../contextService.js";
import { generateAgentWorkReport } from "./workReports.js";
import {
  resilientLlmCall,
  DEFAULT_AGENT_MODEL,
  extractJsonFromResponse,
  convertAgentOutputToFiles,
} from "./shared.js";
import type {
  GenerationSession,
  GeneratedFile,
  SubTask,
} from "../../types/agents.js";
import type { PRD } from "../../types/prd.js";
import type { MasterContext } from "../../types/context.js";
import type { CreativeDesignDoc } from "../../types/creativeDesignDoc.js";

/** Spec UI context passed from Ship when specification exists */
export interface SpecUiContext {
  uiComponents?: Array<{
    id?: string;
    name?: string;
    description?: string;
    type?: string;
    region?: string;
    placement?: string;
    layoutNotes?: string;
  }>;
  overview?: string;
}

/**
 * Run architect agent - validates PRD(s) and creates plan.
 */
export async function runArchitectAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  masterContext?: MasterContext,
  creativeDesignDoc?: CreativeDesignDoc,
  systemPromptPrefix?: string,
): Promise<Record<string, unknown>> {
  return await withSpan(
    "agent.architect.execute",
    async (_span) => {
      const log = getRequestLogger();
      const timer = createApiTimer("agent_architect");
      const agentTask = session.agents.architect;

      setSpanAttribute("session.id", session.sessionId);
      setSpanAttribute("agent.type", "architect");
      addSpanEvent("agent.started", {
        agentType: "architect",
        sessionId: session.sessionId,
      });

      try {
        agentTask.status = "running";
        agentTask.startedAt = new Date().toISOString();

        const context = prds
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

        let contextSummary: string | undefined;
        if (masterContext) {
          const agentContext = await enrichContextForAgent(
            masterContext,
            "architect",
          );
          contextSummary = generateContextSummary(agentContext);
        }

        const basePrompt = getArchitectAgentPromptWithContext(
          context,
          contextSummary,
          creativeDesignDoc,
        );
        const systemPrompt = systemPromptPrefix
          ? `${systemPromptPrefix}\n\n${basePrompt}`
          : basePrompt;

        addSpanEvent("llm.api.call", {
          operation: "architect_plan_generation",
        });
        const response = await resilientLlmCall({
          model: DEFAULT_AGENT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Analyze this PRD${prds ? " (multi-PRD)" : ""} and create a comprehensive code generation plan for a ${session.preferences.backendRuntime} backend with ${session.preferences.frontendFramework} frontend.`,
            },
          ],
        });

        if (response.error) {
          throw new Error(response.error);
        }

        const jsonText = extractJsonFromResponse(response.text);
        const result = JSON.parse(jsonText);

        agentTask.status = "completed";
        agentTask.output = result;
        agentTask.completedAt = new Date().toISOString();
        agentTask.duration =
          Date.now() - new Date(agentTask.startedAt).getTime();

        await generateAgentWorkReport(
          "architect",
          session,
          agentTask,
          [],
          prd,
          result,
          prds,
        );

        addSpanEvent("agent.completed", {
          agentType: "architect",
          duration: agentTask.duration,
          status: "success",
        });
        setSpanAttribute("agent.duration", agentTask.duration);
        setSpanAttribute("agent.status", "completed");

        log.info(
          { agentType: "architect", duration: agentTask.duration },
          "Architect agent completed",
        );
        timer.success();

        return result;
      } catch (error) {
        agentTask.status = "failed";
        agentTask.error = (error as Error).message;
        agentTask.completedAt = new Date().toISOString();

        addSpanEvent("agent.failed", {
          agentType: "architect",
          error: (error as Error).message,
        });
        setSpanAttribute("agent.status", "failed");
        setSpanAttribute("error.message", (error as Error).message);

        log.error(
          { agentType: "architect", error: (error as Error).message },
          "Architect agent failed",
        );
        timer.failure("architect_error");
        throw error;
      }
    },
    {
      "session.id": session.sessionId,
      "agent.type": "architect",
    },
  );
}

/**
 * Run frontend agent - generates UI code.
 */
export async function runFrontendAgent(
  session: GenerationSession,
  prd: PRD,
  architecturePlan: Record<string, unknown>,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  creativeDesignDoc?: CreativeDesignDoc,
  specUiContext?: SpecUiContext,
  systemPromptPrefix?: string,
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer("agent_frontend");
  const agentTask = session.agents.frontend;

  try {
    agentTask.status = "running";
    agentTask.startedAt = new Date().toISOString();

    const framework = session.preferences.frontendFramework || "vue";

    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(
        masterContext,
        "frontend",
      );
      contextSummary = generateContextSummary(agentContext);
    }

    const basePrompt = getFrontendAgentPrompt(
      framework as "vue" | "react",
      contextSummary,
      !!creativeDesignDoc,
    );
    const systemPrompt = systemPromptPrefix
      ? `${systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    let userContent = `Generate frontend code for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate frontend code. Your PRDs only:\n${JSON.stringify(
        prds.map((p) => p.sections),
        null,
        2,
      )}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
      if (subTasks && subTasks.length > 0) {
        userContent += `\n\nImplement these sub-tasks only:\n${subTasks.map((t) => `- ${t.title}`).join("\n")}`;
      }
    }
    if (creativeDesignDoc) {
      userContent += `\n\nCreative Design Document (implement layout and UX as specified):\n${JSON.stringify(
        {
          layout: creativeDesignDoc.layout,
          uiPrinciples: creativeDesignDoc.uiPrinciples,
          keyScreens: creativeDesignDoc.keyScreens,
          uxFlows: creativeDesignDoc.uxFlows,
          accessibilityNotes: creativeDesignDoc.accessibilityNotes,
          responsivenessNotes: creativeDesignDoc.responsivenessNotes,
        },
        null,
        2,
      )}`;
    }
    if (specUiContext) {
      const parts: string[] = [];
      if (specUiContext.overview)
        parts.push(`Overview: ${specUiContext.overview}`);
      if (specUiContext.uiComponents && specUiContext.uiComponents.length > 0) {
        parts.push(
          "UI components: " +
            JSON.stringify(specUiContext.uiComponents, null, 2),
        );
      }
      if (parts.length > 0) {
        userContent += `\n\nSpecification (UI):\n${parts.join("\n\n")}`;
      }
    }

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const jsonText = extractJsonFromResponse(response.text);
    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = "completed";
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    await generateAgentWorkReport(
      "frontend",
      session,
      agentTask,
      files,
      prd,
      architecturePlan,
      prds,
    );

    log.info(
      { agentType: "frontend", files: files.length },
      "Frontend agent completed",
    );
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = "failed";
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error(
      { agentType: "frontend", error: (error as Error).message },
      "Frontend agent failed",
    );
    timer.failure("frontend_error");
    throw error;
  }
}

/**
 * Run backend agent - generates API code.
 */
export async function runBackendAgent(
  session: GenerationSession,
  prd: PRD,
  architecturePlan: Record<string, unknown>,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string,
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer("agent_backend");
  const agentTask = session.agents.backend;

  try {
    agentTask.status = "running";
    agentTask.startedAt = new Date().toISOString();

    const runtime = session.preferences.backendRuntime || "node";
    const database = session.preferences.database || "postgres";

    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(
        masterContext,
        "backend",
      );
      contextSummary = generateContextSummary(agentContext);
    }

    const basePrompt = getBackendAgentPrompt(
      runtime as "node" | "python" | "go",
      database as "postgres" | "mongodb",
      contextSummary,
    );
    const systemPrompt = systemPromptPrefix
      ? `${systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    let userContent = `Generate backend code for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate backend code. Your PRDs only:\n${JSON.stringify(
        prds.map((p) => p.sections),
        null,
        2,
      )}\n\nArchitecture Plan:\n${JSON.stringify(architecturePlan, null, 2)}`;
      if (subTasks && subTasks.length > 0) {
        userContent += `\n\nImplement these sub-tasks only:\n${subTasks.map((t) => `- ${t.title}`).join("\n")}`;
      }
    }

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const jsonText = extractJsonFromResponse(response.text);
    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = "completed";
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    await generateAgentWorkReport(
      "backend",
      session,
      agentTask,
      files,
      prd,
      architecturePlan,
      prds,
    );

    log.info(
      { agentType: "backend", files: files.length },
      "Backend agent completed",
    );
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = "failed";
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error(
      { agentType: "backend", error: (error as Error).message },
      "Backend agent failed",
    );
    timer.failure("backend_error");
    throw error;
  }
}

/**
 * Run DevOps agent - generates Docker/CI configs
 */
export async function runDevOpsAgent(
  session: GenerationSession,
  masterContext?: MasterContext,
  systemPromptPrefix?: string,
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer("agent_devops");
  const agentTask = session.agents.devops;

  try {
    agentTask.status = "running";
    agentTask.startedAt = new Date().toISOString();

    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, "devops");
      contextSummary = generateContextSummary(agentContext);
    }

    const basePrompt = getDevOpsAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix
      ? `${systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate DevOps configuration for a ${session.preferences.backendRuntime} backend and ${session.preferences.frontendFramework} frontend project.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const jsonText = extractJsonFromResponse(response.text);
    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = "completed";
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    const prd =
      session.prds?.[0] || ({ id: session.prdId, sections: {} } as PRD);
    await generateAgentWorkReport("devops", session, agentTask, files, prd);

    log.info(
      { agentType: "devops", files: files.length },
      "DevOps agent completed",
    );
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = "failed";
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error(
      { agentType: "devops", error: (error as Error).message },
      "DevOps agent failed",
    );
    timer.failure("devops_error");
    throw error;
  }
}

/**
 * Run test agent - generates test suites.
 */
export async function runTestAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  subTasks?: SubTask[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string,
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer("agent_test");
  const agentTask = session.agents.test;

  try {
    agentTask.status = "running";
    agentTask.startedAt = new Date().toISOString();

    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, "test");
      contextSummary = generateContextSummary(agentContext);
    }

    const basePrompt = getTestAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix
      ? `${systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    let userContent = `Generate comprehensive test suites for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate tests. Your PRDs only:\n${JSON.stringify(
        prds.map((p) => p.sections),
        null,
        2,
      )}`;
      if (subTasks?.length)
        userContent += `\n\nSub-tasks to cover:\n${subTasks.map((t) => `- ${t.title}`).join("\n")}`;
    }

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const jsonText = extractJsonFromResponse(response.text);
    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = "completed";
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    await generateAgentWorkReport(
      "test",
      session,
      agentTask,
      files,
      prd,
      undefined,
      prds,
    );

    log.info(
      { agentType: "test", files: files.length },
      "Test agent completed",
    );
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = "failed";
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error(
      { agentType: "test", error: (error as Error).message },
      "Test agent failed",
    );
    timer.failure("test_error");
    throw error;
  }
}

/**
 * Run docs agent - generates documentation.
 */
export async function runDocsAgent(
  session: GenerationSession,
  prd: PRD,
  prds?: PRD[],
  masterContext?: MasterContext,
  systemPromptPrefix?: string,
): Promise<GeneratedFile[]> {
  const log = getRequestLogger();
  const timer = createApiTimer("agent_docs");
  const agentTask = session.agents.docs;

  try {
    agentTask.status = "running";
    agentTask.startedAt = new Date().toISOString();

    let contextSummary: string | undefined;
    if (masterContext) {
      const agentContext = await enrichContextForAgent(masterContext, "docs");
      contextSummary = generateContextSummary(agentContext);
    }

    const basePrompt = getDocsAgentPrompt(contextSummary);
    const systemPrompt = systemPromptPrefix
      ? `${systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    let userContent = `Generate comprehensive documentation for this project:\n\nPRD:\n${JSON.stringify(prd.sections, null, 2)}`;
    if (prds && prds.length > 0) {
      userContent = `Generate docs. Your PRDs only:\n${JSON.stringify(
        prds.map((p) => p.sections),
        null,
        2,
      )}`;
    }

    const response = await resilientLlmCall({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const jsonText = extractJsonFromResponse(response.text);
    const result = JSON.parse(jsonText);
    const files = convertAgentOutputToFiles(result);

    agentTask.status = "completed";
    agentTask.output = { fileCount: files.length };
    agentTask.completedAt = new Date().toISOString();
    agentTask.duration = Date.now() - new Date(agentTask.startedAt).getTime();

    await generateAgentWorkReport(
      "docs",
      session,
      agentTask,
      files,
      prd,
      undefined,
      prds,
    );

    log.info(
      { agentType: "docs", files: files.length },
      "Docs agent completed",
    );
    timer.success();

    return files;
  } catch (error) {
    agentTask.status = "failed";
    agentTask.error = (error as Error).message;
    agentTask.completedAt = new Date().toISOString();
    log.error(
      { agentType: "docs", error: (error as Error).message },
      "Docs agent failed",
    );
    timer.failure("docs_error");
    throw error;
  }
}
