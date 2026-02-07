/**
 * Claude Service with Tool Calling
 *
 * Core service that integrates the Claude API with tool execution capabilities.
 * Enables the AI to perform actions like file operations, code execution, database
 * schema generation, and browser automation.
 */
/** Tool input schema shape for LLM gateway (default when tool has no input_schema). */
const _DEFAULT_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: undefined as Record<string, unknown> | undefined,
  required: undefined as string[] | undefined,
};

/**
 * ## Architecture
 * - Uses resilient patterns: circuit breakers, rate limiting, retry with backoff
 * - Supports multiple LLM providers via llmGateway (Anthropic, OpenRouter, etc.)
 * - Integrates with skill registry for extensible capabilities
 * - Streams responses for real-time UI updates
 *
 * ## Tool Execution Flow
 * 1. Claude requests tool use via tool_use content block
 * 2. Service validates tool input against schema
 * 3. Tool executes with safety checks (sandboxing, path policies)
 * 4. Result streams back as tool_result event
 * 5. Claude continues conversation with tool result context
 *
 * ## Events Emitted (ChatStreamEvent)
 * - `text`: Streaming text response from Claude
 * - `thinking`: Extended thinking content (when enabled)
 * - `tool_call`: Claude requesting tool execution
 * - `tool_result`: Result of tool execution
 * - `skill_activated`: Skill system activated
 * - `error`: Error with retry information
 * - `done`: Stream complete
 *
 * ## Usage
 * ```typescript
 * const service = new ClaudeServiceWithTools();
 * for await (const event of service.streamChat(messages, { projectPath })) {
 *   if (event.type === 'text') console.log(event.text);
 *   if (event.type === 'tool_result') console.log(`Tool: ${event.toolName}`);
 * }
 * ```
 *
 * @module claudeServiceWithTools
 */

import {
  AVAILABLE_TOOLS,
  type ToolExecutionResult,
  bashExecuteInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
  fileEditInputSchema,
  listDirectoryInputSchema,
  codebaseSearchInputSchema,
  generateDbSchemaInputSchema,
  generateMigrationsInputSchema,
  screenshotUrlInputSchema,
  browserRunScriptInputSchema,
  gitStatusInputSchema,
  gitDiffInputSchema,
  gitLogInputSchema,
  gitCommitInputSchema,
  gitBranchInputSchema,
  gitPushInputSchema,
  terminalExecuteInputSchema,
  browserNavigateInputSchema,
  browserClickInputSchema,
  browserTypeInputSchema,
  browserGetContentInputSchema,
  browserScreenshotInputSchema,
} from "../tools/index.js";
import { generateSchemaFromDescription } from "./dbSchemaService.js";
import { generateMigrations } from "./migrationService.js";
import {
  screenshotUrl,
  browserRunScript,
  browserNavigate,
  browserClick,
  browserType,
  browserGetContent,
  browserScreenshot,
  type BrowserStep,
} from "./browserService.js";
import {
  toolExecutionService,
  ToolExecutionService,
} from "./toolExecutionService.js";
import logger from "../middleware/logger.js";
import { getPlan, startPlanExecution } from "./planService.js";
import { getSpecSession } from "./specService.js";
import {
  withRetry as _withRetry,
  type ErrorWithStatus as _ErrorWithStatus,
} from "./resilience.js";
import { checkRateLimit as _checkRateLimit } from "./bulkheads.js";
import { checkInput, checkOutput } from "./guardrailsService.js";
import { skillRegistry } from "../skills/index.js";
import {
  createSkill,
  editSkill,
  runSkillTest,
  listSkills,
} from "./userSkillsService.js";
import { getMcpTools } from "../mcp/registry.js";
import {
  getUserToolDefinitions,
  executeUserTool,
  isUserTool,
} from "../skills/userToolsRegistry.js";
import { createSkillContext } from "../skills/base/SkillContext.js";
import { getHeadSystemPrompt } from "../prompts/head.js";
import { wrapModeContext } from "../prompts/compose.js";
import {
  getChatModePrompt,
  getGAgentModePrompt,
  type ChatModeName,
  type CodeSpecialist,
} from "../prompts/chat/index.js";
import {
  getStream,
  type LLMProvider,
  type MultimodalContentPart,
} from "./llmGateway.js";
import { getIntentGuidedRagContext } from "./ragService.js";
import { filterOutput } from "../utils/outputFilters.js";
import { getAllowedToolNames } from "../config/gAgentTools.js";
import { parseAndEnrichIntent } from "./intentCompilerService.js";
import { isMcpTool, executeMcpTool } from "../mcp/client.js";

// ============================================================================
// CHAT STREAM EVENT TYPES
// ============================================================================

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; content: string }
  | { type: "intent"; value: Record<string, unknown> }
  | {
    type: "context";
    value: { mode: string; capabilities?: string[]; toolCount?: number };
  }
  | { type: "tool_planning"; tools: string[] }
  | { type: "tool_progress"; id: string; percent: number; message?: string }
  | {
    type: "tool_call";
    id: string;
    name: string;
    input: Record<string, unknown>;
  }
  | {
    type: "tool_result";
    id: string;
    toolName: string;
    output: string;
    success: boolean;
    executionTime: number;
    diff?: {
      filePath: string;
      beforeContent: string;
      afterContent: string;
      changeType: "created" | "modified" | "deleted";
      operations?: Array<{
        type: string;
        lineStart: number;
        lineEnd?: number;
      }>;
    };
  }
  | { type: "skill_activated"; skillId: string; skillName: string }
  | { type: "autonomous"; value: boolean }
  | { type: "done" }
  | {
    type: "error";
    message: string;
    toolId?: string;
    errorType?: string;
    retryable?: boolean;
    retryAfter?: number;
    metadata?: Record<string, unknown>;
  };

// ============================================================================
// CLAUDE SERVICE WITH TOOLS
// ============================================================================

/**
 * Main service class for Claude AI interactions with tool execution.
 *
 * Provides streaming chat with tool calling support, resilient API handling,
 * and integration with various execution backends (file system, browser, database).
 *
 * @example
 * ```typescript
 * const claude = new ClaudeServiceWithTools();
 *
 * // Simple streaming chat
 * for await (const event of claude.streamChat(messages)) {
 *   handleEvent(event);
 * }
 *
 * // With project context and tools enabled
 * for await (const event of claude.streamChat(messages, {
 *   projectPath: '/path/to/project',
 *   enableTools: true,
 *   enableExtendedThinking: true
 * })) {
 *   handleEvent(event);
 * }
 * ```
 */
export class ClaudeServiceWithTools {
  /** Default model for API calls */
  private model: string = "moonshotai/kimi-k2.5";

  /**
   * Core tools that are always included. Other tools are only sent
   * when the conversation suggests they might be needed, reducing
   * input token count and improving time-to-first-token.
   */
  private static CORE_TOOL_NAMES = new Set([
    "bash_execute",
    "file_read",
    "file_write",
    "file_edit",
    "list_directory",
    "codebase_search",
  ]);

  /**
   * Optional tools only sent when conversation context suggests need.
   * Maps keyword patterns → tool names.
   */
  private static CONTEXTUAL_TOOL_KEYWORDS: Record<string, string[]> = {
    "database|schema|migration|sql|db": ["generate_db_schema", "generate_migrations"],
    "screenshot|browser|navigate|click|page": [
      "screenshot_url", "browser_run_script", "browser_navigate",
      "browser_click", "browser_type", "browser_get_content", "browser_screenshot",
    ],
    "git|commit|push|branch|diff|merge": [
      "git_status", "git_diff", "git_log", "git_commit", "git_branch", "git_push",
    ],
    "terminal|npm|yarn|pip|cargo": ["terminal_execute"],
  };

  /**
   * Filter tools based on conversation context to reduce token count.
   * Core tools are always included; others only when conversation mentions relevant keywords.
   * OPTIMIZED: Fast string check instead of regex for most cases.
   */
  private static filterToolsByContext(
    allTools: Array<{ name: string;[key: string]: unknown }>,
    messages: Array<{ role: string; content: string | unknown }>,
  ): Array<{ name: string;[key: string]: unknown }> {
    // Build lowercase conversation text for keyword matching (only last message + previous for speed)
    const textParts = messages.slice(-3).map(m => typeof m.content === "string" ? m.content : "");
    const conversationText = textParts.join(" ").toLowerCase();

    // Determine which contextual tools to include
    const includedNames = new Set(ClaudeServiceWithTools.CORE_TOOL_NAMES);

    // Fast string checks instead of regex for common patterns
    const fastChecks: Record<string, string[]> = {
      "database": ["generate_db_schema", "generate_migrations"],
      "screenshot": ["screenshot_url", "browser_run_script", "browser_navigate", "browser_click", "browser_type", "browser_get_content", "browser_screenshot"],
      "git": ["git_status", "git_diff", "git_log", "git_commit", "git_branch", "git_push"],
      "npm": ["terminal_execute"],
    };

    for (const [keyword, toolNames] of Object.entries(fastChecks)) {
      if (conversationText.includes(keyword)) {
        for (const name of toolNames) includedNames.add(name);
      }
    }

    // Always include user-defined tools, MCP tools, and skill tools
    return allTools.filter(t =>
      includedNames.has(t.name) ||
      t.name.startsWith("skill_") ||
      t.name.startsWith("mcp_") ||
      t.name.startsWith("user_")
    );
  }
  /** Shared tool execution service */
  private toolExecutionService: ToolExecutionService;
  /** Request-scoped tool execution service (for isolation) */
  private requestScopedTes: ToolExecutionService | null = null;
  /** Free Agent external URL allowlist (hosts only); set for FA requests, cleared after stream */
  private freeAgentExternalAllowlist: string[] | null = null;
  /** Free Agent session flag for guardrails */
  private freeAgentSession = false;

  /**
   * Create a new ClaudeServiceWithTools instance.
   */
  constructor() {
    this.toolExecutionService = toolExecutionService;
  }

  private getTes(): ToolExecutionService {
    return this.requestScopedTes ?? this.toolExecutionService;
  }

  /**
   * Helper to collect stream events into a complete response
   */
  private async collectStreamResponse(
    stream: AsyncIterable<unknown>,
  ): Promise<string> {
    let fullText = "";
    for await (const event of stream) {
      const ev = event as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        ev.type === "content_block_delta" &&
        ev.delta?.type === "text_delta"
      ) {
        fullText += ev.delta.text ?? "";
      }
    }
    return fullText;
  }

  /**
   * Generate chat response with tool calling using streaming.
   * When workspaceRoot is provided, tools run in that directory; otherwise default workspace.
   * mode: 'normal' | 'plan' | 'spec' | 'execute' - determines behavior
   * agentProfile selects a specialist (router, frontend, backend, devops, test) or general.
   * planId: For execute mode, the plan ID to execute
   * specSessionId: For spec mode, the spec session ID
   * guardRailOptions: allowedDirs for path policy; confirmEveryWrite drives UX (backend uses path policy only).
   * tierOverride: used for feature-flags and capability list in head prompt.
   * autonomous: when true (Yolo mode), emit { type: 'autonomous', value: true } so client can skip tool confirmations.
   */
  async *generateChatStream(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    abortSignal?: AbortSignal,
    workspaceRoot?: string,
    mode: "normal" | "plan" | "spec" | "execute" | "design" = "normal",
    agentProfile?: string,
    planId?: string,
    specSessionId?: string,
    provider?: LLMProvider,
    modelId?: string,
    guardRailOptions?: { allowedDirs?: string[] },
    tierOverride?: "free" | "pro" | "team" | "enterprise",
    autonomous?: boolean,
    sessionType?: "chat" | "gAgent" | "freeAgent",
    gAgentCapabilities?: import("../types/settings.js").GAgentCapabilityKey[],
    gAgentExternalAllowlist?: string[],
    includeRagContext?: boolean,
    toolAllowlist?: string[],
    toolDenylist?: string[],
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    // Handle execute mode - load plan and execute it
    if (mode === "execute" && planId) {
      const plan = await getPlan(planId);
      if (!plan) {
        yield { type: "error", message: `Plan ${planId} not found` };
        return;
      }
      if (plan.status !== "approved") {
        yield { type: "error", message: `Plan ${planId} is not approved` };
        return;
      }

      // Start plan execution
      startPlanExecution(planId);

      // Add plan context to messages
      const planContext = `Execute this approved plan:\n\n${plan.title}\n${plan.description}\n\nSteps:\n${plan.steps.map((s) => `${s.order}. ${s.title}: ${s.description}`).join("\n")}`;
      messages = [
        ...messages,
        {
          role: "assistant",
          content: planContext,
        },
      ];
      mode = "normal"; // Continue in normal mode to execute
    }

    // Handle spec mode - load spec session context
    if (mode === "spec" && specSessionId) {
      const session = await getSpecSession(specSessionId);
      if (session && session.specification) {
        const specContext = `Generate code based on this specification:\n\n${session.specification.title}\n${session.specification.description}\n\nRequirements:\n${session.specification.sections.requirements?.map((r) => `- ${r.title}: ${r.description}`).join("\n") || "None"}`;
        messages = [
          ...messages,
          {
            role: "assistant",
            content: specContext,
          },
        ];
        mode = "normal"; // Continue in normal mode to implement
      }
    }

    if (workspaceRoot && mode !== "plan") {
      this.requestScopedTes = new ToolExecutionService(workspaceRoot, {
        allowedDirs: guardRailOptions?.allowedDirs,
      });
    }
    if (sessionType === "gAgent" || sessionType === "freeAgent") {
      this.freeAgentSession = true;
      if (gAgentExternalAllowlist?.length) {
        this.freeAgentExternalAllowlist = gAgentExternalAllowlist;
      }
    }
    try {
      if (autonomous) {
        yield { type: "autonomous", value: true };
      }

      const chatMode: ChatModeName =
        mode === "execute" ? "execute" : (mode as ChatModeName);
      const specialist: CodeSpecialist | undefined =
        agentProfile &&
          agentProfile !== "general" &&
          /^(router|frontend|backend|devops|test)$/.test(agentProfile)
          ? (agentProfile as CodeSpecialist)
          : undefined;
      const headPrompt = getHeadSystemPrompt({ tier: tierOverride });
      const modePrompt =
        sessionType === "gAgent" || sessionType === "freeAgent"
          ? getGAgentModePrompt({
            workspaceRoot,
            specialist,
            enabledCapabilities: gAgentCapabilities,
            allowlistDomains: gAgentExternalAllowlist,
            runInDocker: undefined,
          })
          : getChatModePrompt(chatMode, { workspaceRoot, specialist });
      let systemPrompt = `${headPrompt}\n\n${wrapModeContext(modePrompt)}`;

      // RAG context: DISABLED by default for instant response; use 200ms ultra-aggressive timeout
      const ragContextEnabled =
        process.env.RAG_CONTEXT_ENABLED === "true" &&
        includeRagContext === true; // Require BOTH conditions, not OR
      if (ragContextEnabled && messages.length > 0) {
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const lastUserText =
          typeof lastUser?.content === "string" ? lastUser.content : undefined;
        if (lastUserText?.trim().length) {
          try {
            // Ultra-aggressive: 200ms timeout, minimal chunks for speed
            const RAG_TIMEOUT_MS = 200;
            const ragPromise = getIntentGuidedRagContext(
              lastUserText.trim(),
              {
                namespace: workspaceRoot ?? undefined,
                maxChunks: 2, // Minimal context for maximum speed
              },
            );
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), RAG_TIMEOUT_MS),
            );
            const ragResult = await Promise.race([ragPromise, timeoutPromise]);
            if (ragResult?.context) {
              systemPrompt += `\n\n<context>\n${ragResult.context}\n</context>`;
            }
          } catch (e) {
            logger.debug(
              { error: (e as Error).message },
              "RAG context for prompt failed (non-blocking)",
            );
          }
        }
      }

      // Get tools: base + user-defined + MCP + skills; filter by Free Agent capabilities when applicable
      let allTools =
        mode !== "plan"
          ? [
            ...AVAILABLE_TOOLS,
            ...getUserToolDefinitions(),
            ...getMcpTools(),
            ...skillRegistry.getAllTools(),
          ]
          : [];
      if (
        (sessionType === "gAgent" || sessionType === "freeAgent") &&
        gAgentCapabilities?.length
      ) {
        const allowedNames = getAllowedToolNames(gAgentCapabilities);
        if (allowedNames) {
          allTools = allTools.filter((t: { name: string }) =>
            allowedNames.has(t.name),
          );
          logger.debug(
            { allowedCount: allTools.length, allowedNames: [...allowedNames] },
            "G-Agent tools filtered by capabilities",
          );
        }
      }
      // Per-session tool allowlist/denylist
      if (toolAllowlist?.length) {
        const allowSet = new Set(
          toolAllowlist.map((n) => String(n).trim()).filter(Boolean),
        );
        allTools = allTools.filter((t: { name: string }) =>
          allowSet.has(t.name),
        );
      }
      if (toolDenylist?.length) {
        const denySet = new Set(
          toolDenylist.map((n) => String(n).trim()).filter(Boolean),
        );
        allTools = allTools.filter(
          (t: { name: string }) => !denySet.has(t.name),
        );
      }

      // Emit context at start (mode, capabilities, tool count)
      const toolCount = mode !== "plan" ? allTools.length : 0;
      yield {
        type: "context",
        value: {
          mode: chatMode,
          capabilities:
            sessionType === "gAgent" || sessionType === "freeAgent"
              ? gAgentCapabilities
              : undefined,
          toolCount,
        },
      };

      // When mode is design, parse intent from last user message and emit (non-blocking)
      if (mode === "design") {
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const raw =
          typeof lastUser?.content === "string" ? lastUser.content : undefined;
        if (raw && raw.trim().length > 10) {
          // Fire-and-forget: don't await intent parsing — let stream start immediately
          parseAndEnrichIntent(raw.trim(), undefined)
            .then((enriched) => {
              // Intent will be emitted separately if needed
              logger.debug({ enriched }, "Intent parsed (async)");
            })
            .catch((err) => {
              logger.warn(
                { err },
                "Intent parse failed; continuing without intent",
              );
            });
        }
      }

      logger.debug(
        {
          messageCount: messages.length,
          workspaceRoot,
          mode,
          agentProfile,
          planId,
          specSessionId,
          autonomous,
          sessionType,
        },
        "Starting chat stream",
      );

      const gwMessages = messages.map((msg) => {
        const role = msg.role as "user" | "assistant";
        const content: string | unknown = msg.content as string | unknown;
        // Handle string content
        if (typeof content === "string") {
          return { role, content };
        }
        // Handle array content (multimodal)
        if (Array.isArray(content)) {
          const transformedContent: MultimodalContentPart[] = content
            .map((block: unknown) => {
              const b = block as {
                type: string;
                text?: string;
                source?: { type: string; url?: string };
              };
              if (b.type === "text") {
                return { type: "text" as const, text: b.text ?? "" };
              } else if (
                b.type === "image" &&
                b.source?.type === "url" &&
                b.source?.url
              ) {
                return {
                  type: "image_url" as const,
                  image_url: { url: b.source.url },
                };
              }
              logger.warn(
                { block },
                "Unsupported content block type for LLM Gateway, skipping.",
              );
              return null;
            })
            .filter(
              (p: MultimodalContentPart | null): p is MultimodalContentPart =>
                p !== null,
            );
          return { role, content: transformedContent };
        }
        // Fallback for other types
        return { role, content: JSON.stringify(content) };
      });

      const finalProvider = (provider ?? "nim") as LLMProvider;
      const finalModelId = modelId ?? this.model;

      // Map tools to gateway format
      const mappedTools =
        allTools.length > 0
          ? allTools.map((t: unknown) => {
            const tool = t as {
              name: string;
              description?: string;
              input_schema?: {
                type: "object";
                properties?: Record<string, unknown>;
                required?: string[];
              };
            };
            return {
              name: tool.name,
              description: tool.description ?? "",
              input_schema: tool.input_schema ?? _DEFAULT_TOOL_INPUT_SCHEMA,
            };
          })
          : undefined;

      // Smart tool filtering: reduce input tokens by only sending relevant tools
      const filteredTools = mappedTools
        ? ClaudeServiceWithTools.filterToolsByContext(
          mappedTools as Array<{ name: string;[key: string]: unknown }>,
          messages,
        ) as typeof mappedTools
        : undefined;

      const response = getStream(
        {
          model: finalModelId,
          max_tokens: 4096, // OPTIMIZED: Reduced from 8192 for faster response time; can be overridden via env
          system: systemPrompt,
          messages: gwMessages,
          tools: filteredTools,
        },
        { provider: finalProvider, modelId: finalModelId },
      );

      let currentTextBlock = "";

      for await (const ev of response) {
        const event = ev as {
          type?: string;
          delta?: { type?: string; text?: string };
          content_block?: {
            type?: string;
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
          };
        };
        if (abortSignal?.aborted) {
          logger.debug({}, "Stream aborted");
          yield { type: "error", message: "Stream aborted" };
          break;
        }

        // Handle content block deltas (text)
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          const raw = event.delta.text ?? "";
          currentTextBlock += raw;
          yield { type: "text", text: filterOutput(raw) };
        }

        // Handle tool use blocks
        if (event.type === "content_block_start") {
          const contentBlock = event.content_block;
          if (contentBlock?.type === "tool_use") {
            // Flush any accumulated text
            if (currentTextBlock.trim()) {
              currentTextBlock = "";
            }

            const toolUse = contentBlock;
            const toolId = toolUse.id ?? "";
            const toolName = toolUse.name ?? "";
            logger.debug({ toolName, toolId }, "Tool use started");

            // Emit tool call event
            yield {
              type: "tool_call",
              id: toolId,
              name: toolName,
              input: (toolUse.input ?? {}) as Record<string, unknown>,
            };

            // Execute tool (uses request-scoped TES when workspaceRoot provided)
            const result = await this._executeTool(
              toolName,
              (toolUse.input ?? {}) as Record<string, unknown>,
              workspaceRoot,
            );

            // Emit tool result event (filter output for secrets/PII)
            const rawOutput = result.output || result.error || "";
            yield {
              type: "tool_result",
              id: toolId,
              toolName,
              output: filterOutput(rawOutput),
              success: result.success,
              executionTime: result.executionTime,
              diff: result.diff,
            };
          }
        }
      }

      yield { type: "done" };
    } catch (error: unknown) {
      const errObj = error as Error;
      logger.error(
        {
          error,
          errorMessage: errObj?.message,
          errorStack: errObj?.stack,
          workspaceRoot,
          mode,
          agentProfile
        },
        "Chat stream error",
      );

      // Enhanced error handling with structured error types
      const err = error as {
        status?: number;
        statusCode?: number;
        code?: string;
        name?: string;
        message?: string;
        headers?: Record<string, string>;
      };
      const status = err.status ?? err.statusCode;
      const errorCode = err.code ?? err.name;

      let errorType = "api_error";
      let userMessage = "An error occurred. Please try again.";
      let retryable = false;
      let retryAfter: number | undefined;

      if (status === 401) {
        errorType = "auth_error";
        userMessage = "Authentication failed. Please check your API key.";
        retryable = false;
      } else if (status === 429) {
        errorType = "rate_limit";
        userMessage =
          "Rate limit exceeded. Please wait a moment and try again.";
        retryable = true;
        retryAfter = parseInt(err.headers?.["retry-after"] ?? "60", 10);
      } else if (status === 500 || status === 502 || status === 503) {
        errorType = "service_error";
        userMessage =
          "Service temporarily unavailable. Please try again in a moment.";
        retryable = true;
      } else if (errorCode === "ETIMEDOUT" || errorCode === "ECONNRESET") {
        errorType = "timeout";
        userMessage =
          "Request timed out. The server may be busy. Please try again.";
        retryable = true;
      } else if (
        err.message?.toLowerCase().includes("network") ||
        errorCode === "ENOTFOUND"
      ) {
        errorType = "network_error";
        userMessage =
          "Network error. Please check your connection and try again.";
        retryable = true;
      } else if (err.message) {
        userMessage = err.message;
        retryable = status ? status >= 500 : false;
      }

      yield {
        type: "error",
        message: userMessage,
        errorType,
        retryable,
        retryAfter,
        metadata: {
          status,
          code: errorCode,
          workspaceRoot,
          mode,
        },
      };
    } finally {
      this.requestScopedTes = null;
      this.freeAgentExternalAllowlist = null;
      this.freeAgentSession = false;
    }
  }

  /**
   * Execute a tool with given input
   */
  private async _executeTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceRoot?: string,
  ): Promise<ToolExecutionResult> {
    try {
      // Free Agent: run guardrails before tool execution
      if (this.freeAgentSession) {
        const inputStr = JSON.stringify(input);
        const inputCheck = await checkInput(inputStr, "default");
        if (!inputCheck.passed) {
          return {
            success: false,
            error: `Guardrails blocked: ${inputCheck.triggeredPolicies.map((p) => p.reason).join("; ")}`,
            toolName,
            executionTime: 0,
          };
        }
      }

      logger.debug(
        { toolName, inputKeys: Object.keys(input) },
        "Executing tool",
      );

      let result: ToolExecutionResult;

      // Check if this is a skill tool (prefixed with skill_)
      if (toolName.startsWith("skill_")) {
        result = await this._executeSkillTool(toolName, input, workspaceRoot);
      } else if (isUserTool(toolName)) {
        // User-defined tools (from "add to skills" or API)
        const start = Date.now();
        try {
          const context = createSkillContext({
            workspacePath: workspaceRoot,
            source: "chat",
          });
          const { output } = await executeUserTool(toolName, input, context);
          result = {
            success: true,
            output,
            toolName,
            executionTime: Date.now() - start,
          };
        } catch (err: unknown) {
          result = {
            success: false,
            error: (err as Error).message,
            toolName,
            executionTime: Date.now() - start,
          };
        }
      } else if (isMcpTool(toolName)) {
        // MCP tools (from user-configured MCP servers)
        const start = Date.now();
        const mcpResult = await executeMcpTool(toolName, input);
        result = {
          success: mcpResult.success,
          output: mcpResult.output ?? mcpResult.error,
          error: mcpResult.success ? undefined : mcpResult.error,
          toolName,
          executionTime: Date.now() - start,
        };
      } else {
        switch (toolName) {
          case "bash_execute":
            result = await this._executeBash(input);
            break;

          case "file_read":
            result = await this._executeFileRead(input);
            break;

          case "file_write":
            result = await this._executeFileWrite(input);
            break;

          case "file_edit":
            result = await this._executeFileEdit(input);
            break;

          case "list_directory":
            result = await this._executeListDirectory(input);
            break;

          case "codebase_search":
            result = await this._executeCodebaseSearch(input);
            break;

          case "generate_db_schema":
            result = await this._executeGenerateDbSchema(input);
            break;

          case "generate_migrations":
            result = await this._executeGenerateMigrations(input);
            break;

          case "screenshot_url":
            result = await this._executeScreenshotUrl(input);
            break;

          case "browser_run_script":
            result = await this._executeBrowserRunScript(input);
            break;

          case "browser_navigate":
            result = await this._executeBrowserNavigate(input);
            break;

          case "browser_click":
            result = await this._executeBrowserClick(input);
            break;

          case "browser_type":
            result = await this._executeBrowserType(input);
            break;

          case "browser_get_content":
            result = await this._executeBrowserGetContent(input);
            break;

          case "browser_screenshot":
            result = await this._executeBrowserScreenshot(input);
            break;

          case "browser_snapshot":
            result = await this._executeBrowserSnapshot(input);
            break;

          case "browser_upload":
            result = await this._executeBrowserUpload(input);
            break;

          case "browser_profiles_list":
            result = await this._executeBrowserProfilesList();
            break;

          case "browser_profile_switch":
            result = await this._executeBrowserProfileSwitch(input);
            break;

          case "git_status":
            result = await this._executeGitStatus(input);
            break;

          case "git_diff":
            result = await this._executeGitDiff(input);
            break;

          case "git_log":
            result = await this._executeGitLog(input);
            break;

          case "git_commit":
            result = await this._executeGitCommit(input);
            break;

          case "git_branch":
            result = await this._executeGitBranch(input);
            break;

          case "git_push":
            result = await this._executeGitPush(input);
            break;

          case "terminal_execute":
            result = await this._executeTerminalExecute(input);
            break;

          case "skill_create":
            result = await this._executeSkillCreate(input);
            break;

          case "skill_edit":
            result = await this._executeSkillEdit(input);
            break;

          case "skill_run_test":
            result = await this._executeSkillRunTest(input, workspaceRoot);
            break;

          case "skill_list":
            result = await this._executeSkillList();
            break;

          case "sessions_list":
            result = await this._executeSessionsList(input);
            break;

          case "sessions_history":
            result = await this._executeSessionsHistory(input);
            break;

          case "sessions_send":
            result = await this._executeSessionsSend(input);
            break;

          case "camera_capture":
            result = await this._executeCameraCapture();
            break;

          case "screen_record":
            result = await this._executeScreenRecord(input);
            break;

          case "location_get":
            result = await this._executeLocationGet();
            break;

          case "system_exec":
            result = await this._executeSystemExec(input);
            break;

          case "canvas_update":
            result = await this._executeCanvasUpdate(input);
            break;

          default:
            result = {
              success: false,
              error: `Unknown tool: ${toolName}`,
              toolName,
              executionTime: 0,
            };
        }
      }

      // Free Agent: run guardrails on output after execution
      if (
        this.freeAgentSession &&
        result.success &&
        typeof result.output === "string"
      ) {
        const outputCheck = await checkOutput(result.output, "default");
        if (!outputCheck.passed && outputCheck.action === "block") {
          return {
            ...result,
            output: "[Output filtered by guardrails]",
            success: true,
          };
        }
      }
      return result;
    } catch (error: unknown) {
      logger.error({ error, toolName }, "Tool execution failed");

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName,
        executionTime: 0,
      };
    }
  }

  /**
   * Execute a skill tool
   */
  private async _executeSkillTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceRoot?: string,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const toolHandler = skillRegistry.getToolHandler(toolName);
    if (!toolHandler) {
      return {
        success: false,
        error: `Unknown skill tool: ${toolName}`,
        toolName,
        executionTime: 0,
      };
    }

    const { skill, handler } = toolHandler;
    logger.debug(
      { toolName, skillId: skill.manifest.id },
      "Executing skill tool",
    );

    const context = createSkillContext({
      workspacePath: workspaceRoot,
      source: "chat",
    });

    try {
      const result = await handler(input, context);
      return {
        ...result,
        toolName,
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error(
        { error, toolName, skillId: skill.manifest.id },
        "Skill tool execution failed",
      );
      return {
        success: false,
        error: (error as Error).message,
        toolName,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async _executeSkillCreate(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const name = input.name as string;
    const description = input.description as string;
    const tools =
      (input.tools as Array<{ name: string; description: string }>) ?? [];
    const prompts = (input.prompts as Record<string, string>) ?? {};
    if (!name || !description) {
      return {
        success: false,
        error: "name and description required",
        toolName: "skill_create",
        executionTime: Date.now() - start,
      };
    }
    const result = await createSkill(name, description, tools, prompts);
    if (result.success) {
      return {
        success: true,
        output: `Skill created: ${result.skillId}`,
        toolName: "skill_create",
        executionTime: Date.now() - start,
      };
    }
    return {
      success: false,
      error: result.error,
      toolName: "skill_create",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSkillEdit(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skillId = input.skillId as string;
    const updates = input.updates as Record<string, unknown>;
    if (!skillId || !updates) {
      return {
        success: false,
        error: "skillId and updates required",
        toolName: "skill_edit",
        executionTime: Date.now() - start,
      };
    }
    const result = await editSkill(
      skillId,
      updates as Parameters<typeof editSkill>[1],
    );
    if (result.success) {
      return {
        success: true,
        output: `Skill ${skillId} updated`,
        toolName: "skill_edit",
        executionTime: Date.now() - start,
      };
    }
    return {
      success: false,
      error: result.error,
      toolName: "skill_edit",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSkillRunTest(
    input: Record<string, unknown>,
    workspaceRoot?: string,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skillId = input.skillId as string;
    const testInput = (input.input as Record<string, unknown>) ?? {};
    if (!skillId) {
      return {
        success: false,
        error: "skillId required",
        toolName: "skill_run_test",
        executionTime: Date.now() - start,
      };
    }
    const result = await runSkillTest(skillId, testInput, workspaceRoot);
    const output = result.success
      ? `Test passed. Output: ${result.output}\nDuration: ${result.duration}ms`
      : `Test failed: ${result.error}`;
    return {
      success: result.success,
      output,
      error: result.error,
      toolName: "skill_run_test",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSkillList(): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skills = await listSkills();
    const lines = skills.map(
      (s) => `- ${s.id}: ${s.name} (${s.version})${s.isUser ? " [user]" : ""}`,
    );
    return {
      success: true,
      output: `Available skills:\n${lines.join("\n")}`,
      toolName: "skill_list",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSessionsList(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { sessionsList } = await import("./sessionCoordinatorService.js");
    const limit =
      typeof input.limit === "number" ? Math.min(100, input.limit) : 50;
    const sessions = await sessionsList({ limit });
    const lines = sessions.map(
      (s) =>
        `- ${s.id}: type=${s.type} model=${s.model ?? "N/A"} status=${s.status} started=${s.startedAt}`,
    );
    return {
      success: true,
      output: lines.length
        ? `Sessions:\n${lines.join("\n")}`
        : "No sessions found.",
      toolName: "sessions_list",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSessionsHistory(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return {
        success: false,
        error: "sessionId is required",
        toolName: "sessions_history",
        executionTime: Date.now() - start,
      };
    }
    const { sessionsHistory } = await import("./sessionCoordinatorService.js");
    const hist = await sessionsHistory(sessionId.trim());
    if (!hist) {
      return {
        success: false,
        error: `Session ${sessionId} not found`,
        toolName: "sessions_history",
        executionTime: Date.now() - start,
      };
    }
    const lines = hist.messages.map((m) => `[${m.role}]: ${m.content}`);
    return {
      success: true,
      output: lines.length
        ? `Transcript:\n${lines.join("\n")}`
        : "No messages in session.",
      toolName: "sessions_history",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSessionsSend(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    const message = input.message;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return {
        success: false,
        error: "sessionId is required",
        toolName: "sessions_send",
        executionTime: Date.now() - start,
      };
    }
    if (typeof message !== "string" || !message.trim()) {
      return {
        success: false,
        error: "message is required",
        toolName: "sessions_send",
        executionTime: Date.now() - start,
      };
    }
    const { sessionsSend } = await import("./sessionCoordinatorService.js");
    const result = await sessionsSend(sessionId.trim(), message.trim());
    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? "Send failed",
        toolName: "sessions_send",
        executionTime: Date.now() - start,
      };
    }
    const output = result.reply
      ? `Reply from session:\n${result.reply}`
      : result.queued
        ? "Message queued for session."
        : "Message sent.";
    return {
      success: true,
      output,
      toolName: "sessions_send",
      executionTime: Date.now() - start,
    };
  }

  /**
   * Execute bash tool
   */
  private async _executeBash(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = bashExecuteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "bash_execute",
        executionTime: 0,
      };
    }

    const { command, workingDirectory, timeout } = validation.data;
    return await this.getTes().executeBash(command, workingDirectory, timeout);
  }

  /**
   * Execute file_read tool
   */
  private async _executeFileRead(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = fileReadInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "file_read",
        executionTime: 0,
      };
    }

    const { path, encoding } = validation.data;
    return await this.getTes().readFile(path, encoding);
  }

  /**
   * Execute file_write tool
   */
  private async _executeFileWrite(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = fileWriteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "file_write",
        executionTime: 0,
      };
    }

    const { path, content, createDirectories } = validation.data;
    return await this.getTes().writeFile(path, content, createDirectories);
  }

  /**
   * Execute file_edit tool
   */
  private async _executeFileEdit(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = fileEditInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "file_edit",
        executionTime: 0,
      };
    }

    const { path, operations } = validation.data;
    // Map operations to ensure required 'type' and 'lineStart' are treated as non-optional for the service
    const typedOps = operations.map((op) => ({
      type: op.type as "insert" | "replace" | "delete",
      lineStart: op.lineStart,
      lineEnd: op.lineEnd,
      content: op.content,
    }));
    return await this.getTes().editFile(path, typedOps);
  }

  /**
   * Execute list_directory tool
   */
  private async _executeListDirectory(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = listDirectoryInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "list_directory",
        executionTime: 0,
      };
    }

    const { path, recursive } = validation.data;
    return await this.getTes().listDirectory(path, recursive);
  }

  /**
   * Execute codebase_search tool
   */
  private async _executeCodebaseSearch(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = codebaseSearchInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "codebase_search",
        executionTime: 0,
      };
    }
    const { query, workingDirectory, maxResults } = validation.data;
    return await this.getTes().searchCodebase(
      query,
      workingDirectory,
      maxResults,
    );
  }

  private async _executeGitStatus(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitStatusInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_status",
        executionTime: 0,
      };
    }
    return await this.getTes().gitStatus(validation.data.workingDirectory);
  }

  private async _executeGitDiff(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitDiffInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_diff",
        executionTime: 0,
      };
    }
    const { workingDirectory, staged, file } = validation.data;
    return await this.getTes().gitDiff(workingDirectory, staged, file);
  }

  private async _executeGitLog(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitLogInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_log",
        executionTime: 0,
      };
    }
    const { workingDirectory, maxCount, oneline } = validation.data;
    return await this.getTes().gitLog(workingDirectory, maxCount, oneline);
  }

  private async _executeGitCommit(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitCommitInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_commit",
        executionTime: 0,
      };
    }
    const { message, workingDirectory, addAll } = validation.data;
    return await this.getTes().gitCommit(message, workingDirectory, addAll);
  }

  private async _executeGitBranch(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitBranchInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_branch",
        executionTime: 0,
      };
    }
    const { workingDirectory, list, create } = validation.data;
    return await this.getTes().gitBranch(
      workingDirectory,
      list ?? true,
      create,
    );
  }

  private async _executeGitPush(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = gitPushInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "git_push",
        executionTime: 0,
      };
    }
    const { workingDirectory, remote, branch } = validation.data;
    return await this.getTes().gitPush(workingDirectory, remote, branch);
  }

  private async _executeTerminalExecute(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const validation = terminalExecuteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "terminal_execute",
        executionTime: 0,
      };
    }
    const { command, workingDirectory, timeout } = validation.data;
    return await this.getTes().executeTerminal(
      command,
      workingDirectory,
      timeout,
    );
  }

  private async _executeGenerateDbSchema(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateDbSchemaInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "generate_db_schema",
        executionTime: 0,
      };
    }
    try {
      const { description, targetDb, format } = validation.data;
      const result = await generateSchemaFromDescription(description, {
        targetDb: targetDb as "sqlite" | "postgres" | "mysql",
        format: format as "sql" | "drizzle",
      });
      let output = `DDL:\n${result.ddl}`;
      if (result.drizzle) output += `\n\nDrizzle schema:\n${result.drizzle}`;
      if (result.tables?.length)
        output += `\n\nTables: ${result.tables.join(", ")}`;
      return {
        success: true,
        output,
        toolName: "generate_db_schema",
        executionTime: Date.now() - start,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        toolName: "generate_db_schema",
        executionTime: Date.now() - start,
      };
    }
  }

  private async _executeGenerateMigrations(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateMigrationsInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "generate_migrations",
        executionTime: 0,
      };
    }
    try {
      const { schemaDdl, targetDb } = validation.data;
      const result = await generateMigrations(
        schemaDdl,
        targetDb as "sqlite" | "postgres",
      );
      const output = result.migrations.length
        ? result.migrations
          .map((m, i) => `-- Migration ${i + 1}\n${m}`)
          .join("\n\n")
        : "No migrations generated.";
      return {
        success: true,
        output: (result.summary ? `${result.summary}\n\n` : "") + output,
        toolName: "generate_migrations",
        executionTime: Date.now() - start,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        toolName: "generate_migrations",
        executionTime: Date.now() - start,
      };
    }
  }

  private async _executeScreenshotUrl(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = screenshotUrlInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "screenshot_url",
        executionTime: 0,
      };
    }
    const url = validation.data.url;
    if (this.freeAgentExternalAllowlist?.length) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        const allowed = this.freeAgentExternalAllowlist.map((h) =>
          h.toLowerCase().trim(),
        );
        if (!allowed.includes(host)) {
          return {
            success: false,
            error: `URL host "${host}" is not in Free Agent external allowlist. Add the domain in Free Agent settings.`,
            toolName: "screenshot_url",
            executionTime: Date.now() - start,
          };
        }
      } catch {
        return {
          success: false,
          error: "Invalid URL",
          toolName: "screenshot_url",
          executionTime: Date.now() - start,
        };
      }
    }
    const result = await screenshotUrl(url);
    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? "Screenshot failed",
        toolName: "screenshot_url",
        executionTime: Date.now() - start,
      };
    }
    const output = result.imageBase64
      ? `Screenshot captured (base64 PNG, ${result.imageBase64.length} chars). Use for visual verification.`
      : "Screenshot captured.";
    return {
      success: true,
      output,
      toolName: "screenshot_url",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserRunScript(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserRunScriptInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: "browser_run_script",
        executionTime: 0,
      };
    }
    const result = await browserRunScript(
      validation.data.steps as BrowserStep[],
    );
    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? "Script failed",
        toolName: "browser_run_script",
        executionTime: Date.now() - start,
      };
    }
    const parts = result.logs ? [`Steps: ${result.logs.join("; ")}`] : [];
    if (result.lastUrl) parts.push(`Last URL: ${result.lastUrl}`);
    if (result.screenshotBase64)
      parts.push(
        `Screenshot captured (base64, ${result.screenshotBase64.length} chars)`,
      );
    return {
      success: true,
      output: parts.join("\n") || "Script completed.",
      toolName: "browser_run_script",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserNavigate(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserNavigateInputSchema.safeParse(input);
    if (!validation.success)
      return {
        success: false,
        error: validation.error.message,
        toolName: "browser_navigate",
        executionTime: 0,
      };
    const res = await browserNavigate(
      validation.data.url,
      validation.data.timeout,
    );
    return {
      success: res.ok,
      output: res.ok
        ? `Navigated to ${res.result?.url}. Title: ${res.result?.title}`
        : res.error,
      toolName: "browser_navigate",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserClick(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserClickInputSchema.safeParse(input);
    if (!validation.success)
      return {
        success: false,
        error: validation.error.message,
        toolName: "browser_click",
        executionTime: 0,
      };
    const { selector, url } = validation.data;
    const res = await browserClick(selector, url);
    return {
      success: res.ok,
      output: res.ok ? `Clicked element: ${selector}` : res.error,
      toolName: "browser_click",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserType(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserTypeInputSchema.safeParse(input);
    if (!validation.success)
      return {
        success: false,
        error: validation.error.message,
        toolName: "browser_type",
        executionTime: 0,
      };
    const { selector, text, url } = validation.data;
    const res = await browserType(selector, text, url);
    return {
      success: res.ok,
      output: res.ok ? `Typed "${text}" into ${selector}` : res.error,
      toolName: "browser_type",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserGetContent(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserGetContentInputSchema.safeParse(input);
    if (!validation.success)
      return {
        success: false,
        error: validation.error.message,
        toolName: "browser_get_content",
        executionTime: 0,
      };
    const res = await browserGetContent(validation.data.url);
    return {
      success: res.ok,
      output: res.ok
        ? `HTML Length: ${res.html?.length}\nText Content:\n${res.text?.substring(0, 5000)}`
        : res.error,
      toolName: "browser_get_content",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserScreenshot(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserScreenshotInputSchema.safeParse(input);
    if (!validation.success)
      return {
        success: false,
        error: validation.error.message,
        toolName: "browser_screenshot",
        executionTime: 0,
      };
    const res = await browserScreenshot(
      validation.data.url,
      validation.data.fullPage,
    );
    return {
      success: res.ok,
      output: res.ok ? "Screenshot captured." : res.error,
      toolName: "browser_screenshot",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserSnapshot(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { browserSnapshot } = await import("./chromeCdpservice.js");
    const url = typeof input.url === "string" ? input.url : undefined;
    const profile =
      typeof input.profile === "string" ? input.profile : undefined;
    const res = await browserSnapshot(url, profile);
    return {
      success: res.ok,
      output: res.ok ? res.snapshot : res.error,
      toolName: "browser_snapshot",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserUpload(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const selector = input.selector;
    const filePath = input.filePath;
    if (typeof selector !== "string" || typeof filePath !== "string") {
      return {
        success: false,
        error: "selector and filePath required",
        toolName: "browser_upload",
        executionTime: 0,
      };
    }
    const { browserUpload } = await import("./chromeCdpservice.js");
    const res = await browserUpload(selector, filePath, {
      url: typeof input.url === "string" ? input.url : undefined,
      profile: typeof input.profile === "string" ? input.profile : undefined,
    });
    return {
      success: res.ok,
      output: res.ok ? "File uploaded." : res.error,
      toolName: "browser_upload",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserProfilesList(): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { listProfiles } = await import("./chromeCdpservice.js");
    const profiles = await listProfiles();
    return {
      success: true,
      output: `Profiles: ${profiles.join(", ")}`,
      toolName: "browser_profiles_list",
      executionTime: Date.now() - start,
    };
  }

  private async _executeBrowserProfileSwitch(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const profile = input.profile;
    if (typeof profile !== "string") {
      return {
        success: false,
        error: "profile required",
        toolName: "browser_profile_switch",
        executionTime: 0,
      };
    }
    const { switchProfile } = await import("./chromeCdpservice.js");
    switchProfile(profile);
    return {
      success: true,
      output: `Switched to profile: ${profile}`,
      toolName: "browser_profile_switch",
      executionTime: Date.now() - start,
    };
  }

  private async _executeCameraCapture(): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
      success: false,
      output:
        "camera_capture requires Electron desktop app with camera permission. Use the desktop app and grant camera access.",
      toolName: "camera_capture",
      executionTime: Date.now() - start,
    };
  }

  private async _executeScreenRecord(
    _input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
      success: false,
      output:
        "screen_record requires Electron desktop app with screen capture permission.",
      toolName: "screen_record",
      executionTime: Date.now() - start,
    };
  }

  private async _executeLocationGet(): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
      success: false,
      output:
        "location_get requires Electron desktop app with location permission.",
      toolName: "location_get",
      executionTime: Date.now() - start,
    };
  }

  private async _executeSystemExec(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const command = input.command;
    if (typeof command !== "string" || !command.trim()) {
      return {
        success: false,
        error: "command required",
        toolName: "system_exec",
        executionTime: 0,
      };
    }
    // Reuse bash execution validation; system_exec runs on host (not Docker)
    const { execSync } = await import("child_process");
    const STRICT = process.env.STRICT_COMMAND_ALLOWLIST === "true";
    const ALLOWED = new Set([
      "npm",
      "npx",
      "node",
      "git",
      "pnpm",
      "yarn",
      "tsx",
      "ts-node",
      "ls",
      "pwd",
    ]);
    if (STRICT) {
      const first =
        command
          .trim()
          .split(/\s+/)[0]
          ?.replace(/^[\s"']+|["']$/g, "") ?? "";
      const base = first.split("/").pop() ?? first;
      if (!ALLOWED.has(base.toLowerCase())) {
        return {
          success: false,
          error: `Command not in allowlist: ${base}. Set STRICT_COMMAND_ALLOWLIST=false or add to allowlist.`,
          toolName: "system_exec",
          executionTime: Date.now() - start,
        };
      }
    }
    try {
      const out = execSync(command.trim(), {
        encoding: "utf8",
        timeout: 30000,
      });
      return {
        success: true,
        output: out || "(no output)",
        toolName: "system_exec",
        executionTime: Date.now() - start,
      };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      return {
        success: false,
        output: err.stderr || err.stdout || err.message,
        toolName: "system_exec",
        executionTime: Date.now() - start,
      };
    }
  }

  private async _executeCanvasUpdate(
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    const action = input.action;
    if (typeof sessionId !== "string" || typeof action !== "string") {
      return {
        success: false,
        error: "sessionId and action required",
        toolName: "canvas_update",
        executionTime: 0,
      };
    }
    try {
      const { applyCanvasAction } = await import("./canvasService.js");
      const result = await applyCanvasAction({
        sessionId,
        action: action as "create" | "update" | "delete",
        elementId:
          typeof input.elementId === "string" ? input.elementId : undefined,
        element:
          typeof input.element === "object" && input.element
            ? (input.element as Record<string, unknown>)
            : undefined,
      });
      return {
        success: true,
        output: `Canvas updated. Elements: ${JSON.stringify(result.elements ?? []).slice(0, 500)}`,
        toolName: "canvas_update",
        executionTime: Date.now() - start,
      };
    } catch (e) {
      return {
        success: false,
        output: (e as Error).message,
        toolName: "canvas_update",
        executionTime: Date.now() - start,
      };
    }
  }
}

// Export singleton instance
export const claudeServiceWithTools = new ClaudeServiceWithTools();
