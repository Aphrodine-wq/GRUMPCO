/**
 * Claude Service with Tool Calling
 *
 * Core service that integrates the Claude API with tool execution capabilities.
 * Enables the AI to perform actions like file operations, code execution, database
 * schema generation, and browser automation.
 *
 * ## Architecture
 * - Uses resilient patterns: circuit breakers, rate limiting, retry with backoff
 * - Supports multiple LLM providers via llmGateway (Anthropic, OpenRouter, etc.)
 * - Integrates with skill registry for extensible capabilities
 * - Streams responses for real-time UI updates
 *
 * Tool executors are split into focused modules under `./tools/`:
 * - `toolExecutors.ts` — file, git, browser, system tool handlers
 * - `skillExecutors.ts` — skill CRUD, session management tools
 * - `toolFiltering.ts` — context-aware tool filtering to reduce token count
 *
 * Types are in `./chatStreamTypes.ts`.
 *
 * @module claudeServiceWithTools
 */

/** Tool input schema shape for LLM gateway (default when tool has no input_schema). */
const _DEFAULT_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: undefined as Record<string, unknown> | undefined,
  required: undefined as string[] | undefined,
};

import { AVAILABLE_TOOLS, type ToolExecutionResult } from "../../tools/index.js";
import {
  toolExecutionService,
  ToolExecutionService,
} from "../workspace/toolExecutionService.js";
import logger from "../../middleware/logger.js";
import { getPlan, startPlanExecution } from "../ship/planService.js";
import { getSpecSession } from "../ship/specService.js";
import {
  withRetry as _withRetry,
  type ErrorWithStatus as _ErrorWithStatus,
} from "../infra/resilience.js";
import { checkRateLimit as _checkRateLimit } from "../infra/bulkheads.js";
import { checkInput, checkOutput } from "../security/guardrailsService.js";
import { getMcpTools } from "../../mcp/registry.js";
import {
  getUserToolDefinitions,
  executeUserTool,
  isUserTool,
} from "../../skills/userToolsRegistry.js";
import { createSkillContext } from "../../skills/base/SkillContext.js";
import { skillRegistry } from "../../skills/index.js";
import { getHeadSystemPrompt } from "../../prompts/head.js";
import { wrapModeContext } from "../../prompts/compose.js";
import {
  getChatModePrompt,
  getGAgentModePrompt,
  type ChatModeName,
  type CodeSpecialist,
} from "../../prompts/chat/index.js";
import {
  getStream,
  type LLMProvider,
  type MultimodalContentPart,
} from "./llmGateway.js";
import { getIntentGuidedRagContext } from "../rag/ragService.js";
import { filterOutput } from "../../utils/outputFilters.js";
import { getAllowedToolNames } from "../../config/gAgentTools.js";
import { parseAndEnrichIntent } from "../intent/intentCompilerService.js";
import { isMcpTool, executeMcpTool } from "../../mcp/client.js";

// Re-export types so existing consumers don't break
export type { ChatStreamEvent, FileChangeRecord } from "./chatStreamTypes.js";
import type { ChatStreamEvent, FileChangeRecord } from "./chatStreamTypes.js";

// Extracted modules
import { filterToolsByContext } from "./tools/toolFiltering.js";
import {
  executeBash,
  executeFileRead,
  executeFileWrite,
  executeFileEdit,
  executeListDirectory,
  executeCodebaseSearch,
  executeTerminalExecute,
  executeGitStatus,
  executeGitDiff,
  executeGitLog,
  executeGitCommit,
  executeGitBranch,
  executeGitPush,
  executeGenerateDbSchema,
  executeGenerateMigrations,
  executeScreenshotUrl,
  executeBrowserRunScript,
  executeBrowserNavigate,
  executeBrowserClick,
  executeBrowserType,
  executeBrowserGetContent,
  executeBrowserScreenshot,
  executeBrowserSnapshot,
  executeBrowserUpload,
  executeBrowserProfilesList,
  executeBrowserProfileSwitch,
  executeCameraCapture,
  executeScreenRecord,
  executeLocationGet,
  executeSystemExec,
  executeCanvasUpdate,
} from "./tools/toolExecutors.js";
import {
  executeSkillTool,
  executeSkillCreate,
  executeSkillEdit,
  executeSkillRunTest,
  executeSkillList,
  executeSessionsList,
  executeSessionsHistory,
  executeSessionsSend,
} from "./tools/skillExecutors.js";

// ============================================================================
// CLAUDE SERVICE WITH TOOLS
// ============================================================================

/**
 * Main service class for Claude AI interactions with tool execution.
 *
 * Provides streaming chat with tool calling support, resilient API handling,
 * and integration with various execution backends (file system, browser, database).
 */
export class ClaudeServiceWithTools {
  /** Default model for API calls */
  private model: string = "moonshotai/kimi-k2.5";
  /** Shared tool execution service */
  private toolExecutionService: ToolExecutionService;
  /** Request-scoped tool execution service (for isolation) */
  private requestScopedTes: ToolExecutionService | null = null;
  /** G-Agent external URL allowlist (hosts only); set per-request, cleared after stream */
  private gAgentExternalAllowlist: string[] | null = null;
  /** G-Agent session flag for guardrails */
  private gAgentSession = false;

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
    mode: "normal" | "plan" | "spec" | "execute" | "design" | "code" = "normal",
    agentProfile?: string,
    planId?: string,
    specSessionId?: string,
    provider?: LLMProvider,
    modelId?: string,
    guardRailOptions?: { allowedDirs?: string[] },
    tierOverride?: "free" | "pro" | "team" | "enterprise",
    autonomous?: boolean,
    sessionType?: "chat" | "gAgent",
    gAgentCapabilities?: import("../../types/settings.js").GAgentCapabilityKey[],
    gAgentExternalAllowlist?: string[],
    includeRagContext?: boolean,
    toolAllowlist?: string[],
    toolDenylist?: string[],
    userId?: string,
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
    if (sessionType === "gAgent") {
      this.gAgentSession = true;
      if (gAgentExternalAllowlist?.length) {
        this.gAgentExternalAllowlist = gAgentExternalAllowlist;
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
        sessionType === "gAgent"
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

      // Get tools: base + user-defined + MCP + skills; filter by G-Agent capabilities when applicable
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
        (sessionType === "gAgent") &&
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
            sessionType === "gAgent"
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

      // SPEED OPTIMIZATION: Truncate conversation history to limit context window.
      // More input tokens = slower TTFT. Keep only the most recent messages.
      const MAX_CONTEXT_MESSAGES = Number(process.env.CHAT_MAX_CONTEXT_MESSAGES ?? 20);
      const truncatedMessages = messages.length > MAX_CONTEXT_MESSAGES
        ? messages.slice(-MAX_CONTEXT_MESSAGES)
        : messages;

      // SPEED OPTIMIZATION: Truncate very long individual messages (e.g. pasted code blocks)
      const MAX_MSG_CHARS = Number(process.env.CHAT_MAX_MSG_CHARS ?? 12000);
      const trimmedMessages = truncatedMessages.map((msg) => {
        if (typeof msg.content === "string" && msg.content.length > MAX_MSG_CHARS) {
          return {
            ...msg,
            content: msg.content.slice(0, MAX_MSG_CHARS) + "\n\n[...truncated for speed]",
          };
        }
        return msg;
      });

      logger.debug(
        {
          messageCount: messages.length,
          truncatedTo: trimmedMessages.length,
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

      const gwMessages = trimmedMessages.map((msg) => {
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
      // In 'code' mode ALWAYS send all tools so file_write/bash_execute are guaranteed available
      const filteredTools = mappedTools
        ? (mode === 'code'
          ? mappedTools
          : filterToolsByContext(
            mappedTools as Array<{ name: string;[key: string]: unknown }>,
            messages,
          ) as typeof mappedTools)
        : undefined;

      // Use higher max_tokens for code generation to allow tool call arguments (file contents)
      const defaultMaxTokens = (mode === "code" || mode === "normal") ? 32768 : 16384;
      const maxTokens = Number(process.env.CHAT_MAX_TOKENS ?? defaultMaxTokens);

      // Agentic loop: execute tools and feed results back to the model
      // until it gives a text-only response (no tool calls) or we hit the limit
      const MAX_TOOL_TURNS = Number(process.env.CHAT_MAX_TOOL_TURNS ?? 25);
      let turnCount = 0;
      let totalToolCallCount = 0;
      let loopMessages: Array<{
        role: "user" | "assistant" | "tool";
        content: string | MultimodalContentPart[];
        tool_call_id?: string;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      }> = [...gwMessages]; // Mutable copy for the agentic loop

      // ── Files-changed accumulator ────────────────────────────────────
      const FILE_WRITE_TOOLS = new Set(["file_write", "write_file", "write_to_file"]);
      const FILE_EDIT_TOOLS = new Set(["file_edit", "edit_file", "replace_file_content", "multi_replace_file_content"]);
      const EXEC_TOOLS = new Set(["bash_execute", "terminal_execute", "run_command"]);
      const fileChanges: FileChangeRecord[] = [];
      let commandsRun = 0;
      let commandsPassed = 0;
      let totalTextEmitted = 0; // Track total text chars emitted across all turns

      agenticLoop:
      while (turnCount < MAX_TOOL_TURNS) {
        turnCount++;

        // Emit agentic progress so frontend can show iteration
        yield {
          type: "agentic_progress",
          currentTurn: turnCount,
          maxTurns: MAX_TOOL_TURNS,
          toolCallCount: totalToolCallCount,
        };

        const response = getStream(
          {
            model: finalModelId,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: loopMessages,
            tools: filteredTools,
            temperature: 0.4,
            userId,
          },
          { provider: finalProvider, modelId: finalModelId },
        );

        logger.info(
          {
            turn: turnCount,
            provider: finalProvider,
            modelId: finalModelId,
            maxTokens,
            messageCount: loopMessages.length,
            toolCount: filteredTools?.length ?? 0,
            mode,
          },
          "Agentic loop: starting stream request",
        );

        let currentTextBlock = "";
        // Collect tool calls from this turn for the agentic loop
        const turnToolCalls: Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
          resultOutput: string;
          resultSuccess: boolean;
        }> = [];

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
            break agenticLoop;
          }

          // Handle content block deltas (text)
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta"
          ) {
            const raw = event.delta.text ?? "";
            currentTextBlock += raw;
            totalTextEmitted += raw.length;
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
              logger.debug({ toolName, toolId, turn: turnCount }, "Tool use started");

              // Emit tool call event
              yield {
                type: "tool_call",
                id: toolId,
                name: toolName,
                input: (toolUse.input ?? {}) as Record<string, unknown>,
              };

              // Execute tool (uses request-scoped TES when workspaceRoot provided)
              // HANG-PROOF: Wrap with timeout so a stuck tool doesn't block the agentic loop
              const TOOL_TIMEOUT_MS = Number(process.env.TOOL_EXECUTION_TIMEOUT_MS ?? 120_000);
              const result = await Promise.race([
                this._executeTool(
                  toolName,
                  (toolUse.input ?? {}) as Record<string, unknown>,
                  workspaceRoot,
                ),
                new Promise<ToolExecutionResult>((resolve) =>
                  setTimeout(() => resolve({
                    success: false,
                    output: "",
                    error: `Tool '${toolName}' timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
                    executionTime: TOOL_TIMEOUT_MS,
                  } as ToolExecutionResult), TOOL_TIMEOUT_MS),
                ),
              ]);

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

              // Collect for agentic loop continuation
              turnToolCalls.push({
                id: toolId,
                name: toolName,
                input: (toolUse.input ?? {}) as Record<string, unknown>,
                resultOutput: rawOutput.slice(0, 4000), // Cap to avoid huge context
                resultSuccess: result.success,
              });
              totalToolCallCount++;

              // ── Track file changes for summary ───────────────────────────
              if (FILE_WRITE_TOOLS.has(toolName) || FILE_EDIT_TOOLS.has(toolName)) {
                const filePath = result.diff?.filePath
                  || (toolUse.input as Record<string, unknown>)?.path as string
                  || (toolUse.input as Record<string, unknown>)?.file_path as string
                  || "unknown";
                const changeType = FILE_WRITE_TOOLS.has(toolName) ? "created" as const : "modified" as const;
                const beforeLines = result.diff?.beforeContent?.split("\n").length ?? 0;
                const afterLines = result.diff?.afterContent?.split("\n").length ?? 0;
                fileChanges.push({
                  path: filePath,
                  changeType: result.diff?.changeType ?? changeType,
                  linesAdded: Math.max(0, afterLines - beforeLines) || afterLines,
                  linesRemoved: Math.max(0, beforeLines - afterLines),
                  toolName,
                });
              }
              if (EXEC_TOOLS.has(toolName)) {
                commandsRun++;
                if (result.success) commandsPassed++;
              }
            }
          }
        }

        // If no tool calls were made this turn, the model is done — exit loop
        if (turnToolCalls.length === 0) {
          logger.info(
            { turn: turnCount, textChars: currentTextBlock.length, toolCalls: 0 },
            "Agentic loop: turn complete (no tool calls — exiting)",
          );
          break;
        }

        logger.info(
          { turn: turnCount, textChars: currentTextBlock.length, toolCalls: turnToolCalls.length, toolNames: turnToolCalls.map(tc => tc.name) },
          "Agentic loop: turn complete (continuing with tool results)",
        );

        // Agentic continuation: feed tool results back to the model
        // 1) Add an assistant message with the tool_calls it made
        loopMessages.push({
          role: "assistant" as const,
          content: currentTextBlock || "",
          tool_calls: turnToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        });

        // 2) Add tool result messages for each tool call
        for (const tc of turnToolCalls) {
          loopMessages.push({
            role: "tool" as const,
            content: tc.resultSuccess
              ? (tc.resultOutput || "Success")
              : `Error: ${tc.resultOutput}`,
            tool_call_id: tc.id,
          });
        }

        logger.debug(
          { turn: turnCount, toolCallCount: turnToolCalls.length },
          "Agentic loop: continuing with tool results",
        );
      }

      if (turnCount >= MAX_TOOL_TURNS) {
        logger.warn(
          { turnCount, MAX_TOOL_TURNS },
          "Agentic loop: hit max tool turns limit",
        );
        yield {
          type: "text",
          text: "\n\n*(Reached maximum tool execution limit. You can continue asking for more changes.)*",
        };
      }

      // Warn if the agentic loop produced no content at all (empty LLM response)
      if (totalTextEmitted === 0 && totalToolCallCount === 0) {
        logger.warn(
          { mode, provider: finalProvider, modelId: finalModelId, turnCount },
          "Agentic loop: LLM produced no text and no tool calls — empty response",
        );
        yield {
          type: "text",
          text: "*(The model returned an empty response. This may indicate a provider issue, tool format mismatch, or timeout. Please try again or switch to a different model.)*",
        };
      }

      // ── Emit files-changed summary if any file operations occurred ───
      if (fileChanges.length > 0 || commandsRun > 0) {
        yield {
          type: "files_summary",
          files: fileChanges,
          commandsRun,
          commandsPassed,
          totalTurns: turnCount,
        };
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
      this.gAgentExternalAllowlist = null;
      this.gAgentSession = false;
    }
  }

  /**
   * Execute a tool with given input.
   * Delegates to extracted tool executor modules for the actual execution.
   */
  private async _executeTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceRoot?: string,
  ): Promise<ToolExecutionResult> {
    try {
      // G-Agent: run guardrails before tool execution
      if (this.gAgentSession) {
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
      const tes = this.getTes();

      // Check if this is a skill tool (prefixed with skill_)
      if (toolName.startsWith("skill_")) {
        result = await executeSkillTool(toolName, input, workspaceRoot);
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
        // Delegate to extracted tool executor functions
        switch (toolName) {
          case "bash_execute":
            result = await executeBash(input, tes);
            break;
          case "file_read":
            result = await executeFileRead(input, tes);
            break;
          case "file_write":
            result = await executeFileWrite(input, tes);
            break;
          case "file_edit":
            result = await executeFileEdit(input, tes);
            break;
          case "list_directory":
            result = await executeListDirectory(input, tes);
            break;
          case "codebase_search":
            result = await executeCodebaseSearch(input, tes);
            break;
          case "generate_db_schema":
            result = await executeGenerateDbSchema(input);
            break;
          case "generate_migrations":
            result = await executeGenerateMigrations(input);
            break;
          case "screenshot_url":
            result = await executeScreenshotUrl(input, this.gAgentExternalAllowlist);
            break;
          case "browser_run_script":
            result = await executeBrowserRunScript(input);
            break;
          case "browser_navigate":
            result = await executeBrowserNavigate(input);
            break;
          case "browser_click":
            result = await executeBrowserClick(input);
            break;
          case "browser_type":
            result = await executeBrowserType(input);
            break;
          case "browser_get_content":
            result = await executeBrowserGetContent(input);
            break;
          case "browser_screenshot":
            result = await executeBrowserScreenshot(input);
            break;
          case "browser_snapshot":
            result = await executeBrowserSnapshot(input);
            break;
          case "browser_upload":
            result = await executeBrowserUpload(input);
            break;
          case "browser_profiles_list":
            result = await executeBrowserProfilesList();
            break;
          case "browser_profile_switch":
            result = await executeBrowserProfileSwitch(input);
            break;
          case "git_status":
            result = await executeGitStatus(input, tes);
            break;
          case "git_diff":
            result = await executeGitDiff(input, tes);
            break;
          case "git_log":
            result = await executeGitLog(input, tes);
            break;
          case "git_commit":
            result = await executeGitCommit(input, tes);
            break;
          case "git_branch":
            result = await executeGitBranch(input, tes);
            break;
          case "git_push":
            result = await executeGitPush(input, tes);
            break;
          case "terminal_execute":
            result = await executeTerminalExecute(input, tes);
            break;
          case "skill_create":
            result = await executeSkillCreate(input);
            break;
          case "skill_edit":
            result = await executeSkillEdit(input);
            break;
          case "skill_run_test":
            result = await executeSkillRunTest(input, workspaceRoot);
            break;
          case "skill_list":
            result = await executeSkillList();
            break;
          case "sessions_list":
            result = await executeSessionsList(input);
            break;
          case "sessions_history":
            result = await executeSessionsHistory(input);
            break;
          case "sessions_send":
            result = await executeSessionsSend(input);
            break;
          case "camera_capture":
            result = await executeCameraCapture();
            break;
          case "screen_record":
            result = await executeScreenRecord(input);
            break;
          case "location_get":
            result = await executeLocationGet();
            break;
          case "system_exec":
            result = await executeSystemExec(input);
            break;
          case "canvas_update":
            result = await executeCanvasUpdate(input);
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

      // G-Agent: run guardrails on output after execution
      if (
        this.gAgentSession &&
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
}

// Export singleton instance
export const claudeServiceWithTools = new ClaudeServiceWithTools();
