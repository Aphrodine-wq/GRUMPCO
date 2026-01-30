/**
 * Claude Service with Tool Calling
 *
 * Core service that integrates the Claude API with tool execution capabilities.
 * Enables the AI to perform actions like file operations, code execution, database
 * schema generation, and browser automation.
 */
/** Tool input schema shape for LLM gateway (default when tool has no input_schema). */
const _DEFAULT_TOOL_INPUT_SCHEMA = { type: 'object' as const, properties: undefined as Record<string, unknown> | undefined, required: undefined as string[] | undefined };

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

import Anthropic from '@anthropic-ai/sdk';
import {
  AVAILABLE_TOOLS,
  ToolExecutionResult,
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
  browserNavigateInputSchema,
  browserClickInputSchema,
  browserTypeInputSchema,
  browserGetContentInputSchema,
  browserScreenshotInputSchema,
  gitStatusInputSchema,
  gitDiffInputSchema,
  gitLogInputSchema,
  gitCommitInputSchema,
  gitBranchInputSchema,
  gitPushInputSchema,
  terminalExecuteInputSchema,
} from '../tools/definitions.js';
import { generateSchemaFromDescription } from './dbSchemaService.js';
import { generateMigrations } from './migrationService.js';
import {
  screenshotUrl,
  browserRunScript,
  browserNavigate,
  browserClick,
  browserType,
  browserGetContent,
  browserScreenshot,
  type BrowserStep,
} from './browserService.js';
import { toolExecutionService, ToolExecutionService } from './toolExecutionService.js';
import { logger } from '../utils/logger.js';
import { getPlan, startPlanExecution } from './planService.js';
import { getSpecSession } from './specService.js';
import { withRetry, isRetryableError, type ErrorWithStatus } from './resilience.js';
import { checkRateLimit, getCircuitBreaker } from './bulkheads.js';
import { skillRegistry } from '../skills/index.js';
import { getMcpTools } from '../mcp/registry.js';
import { getUserToolDefinitions, executeUserTool, isUserTool } from '../skills/userToolsRegistry.js';
import { createSkillContext } from '../skills/base/SkillContext.js';
import { getHeadSystemPrompt } from '../prompts/head.js';
import { wrapModeContext } from '../prompts/compose.js';
import { getChatModePrompt, type ChatModeName, type CodeSpecialist } from '../prompts/chat/index.js';
import { getStream, type LLMProvider } from './llmGateway.js';
import { filterOutput } from '../utils/outputFilters.js';

// ============================================================================
// CHAT STREAM EVENT TYPES
// ============================================================================

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_planning'; tools: string[] }
  | { type: 'tool_progress'; id: string; percent: number; message?: string }
  | {
    type: 'tool_call';
    id: string;
    name: string;
    input: Record<string, unknown>;
  }
  | {
    type: 'tool_result';
    id: string;
    toolName: string;
    output: string;
    success: boolean;
    executionTime: number;
    diff?: {
      filePath: string;
      beforeContent: string;
      afterContent: string;
      changeType: 'created' | 'modified' | 'deleted';
      operations?: Array<{ type: string; lineStart: number; lineEnd?: number }>;
    };
  }
  | { type: 'skill_activated'; skillId: string; skillName: string }
  | { type: 'autonomous'; value: boolean }
  | { type: 'done' }
  | {
    type: 'error';
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
  /** Anthropic SDK client instance */
  private client: Anthropic;
  /** Default model for API calls */
  private model: string = 'claude-sonnet-4-20250514';
  /** Shared tool execution service */
  private toolExecutionService: ToolExecutionService;
  /** Request-scoped tool execution service (for isolation) */
  private requestScopedTes: ToolExecutionService | null = null;

  /**
   * Create a new ClaudeServiceWithTools instance.
   * Initializes the Anthropic client with API key from environment.
   */
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.toolExecutionService = toolExecutionService;
  }

  private getTes(): ToolExecutionService {
    return this.requestScopedTes ?? this.toolExecutionService;
  }

  /**
   * Resilient stream wrapper with circuit breakers and rate limiting
   * Handles streaming API calls with bulkhead pattern isolation
   */
  private async resilientStream(
    params: Parameters<typeof this.client.messages.stream>[0]
  ): Promise<AsyncIterable<unknown>> {
    const serviceType = 'claude-chat' as const;

    // Check rate limit
    const rateLimitCheck = checkRateLimit(serviceType);
    if (!rateLimitCheck.allowed) {
      const error: ErrorWithStatus = new Error('Rate limit exceeded') as ErrorWithStatus;
      error.status = 429;
      error.retryAfter = rateLimitCheck.retryAfter;
      throw error;
    }

    // Create streaming function with retry
    const streamFn = withRetry(
      async (streamParams: Parameters<typeof this.client.messages.stream>[0]) => {
        return await this.client.messages.stream(streamParams);
      },
      {
        retries: 2, // Fewer retries for streams
        minTimeout: 500,
        maxTimeout: 2000,
      }
    );

    // Wrap with circuit breaker
    const breaker = getCircuitBreaker(serviceType, streamFn);

    try {
      const stream = await breaker.fire(params);
      return stream as unknown as AsyncIterable<unknown>;
    } catch (error) {
      const err = error as ErrorWithStatus;

      // Check if circuit is open
      if (breaker.opened) {
        const circuitError: ErrorWithStatus = new Error('Service temporarily unavailable') as ErrorWithStatus;
        circuitError.code = 'CIRCUIT_OPEN';
        circuitError.status = 503;
        circuitError.retryAfter = 30;
        throw circuitError;
      }

      // Check if it's a retryable error
      if (!isRetryableError(err)) {
        throw error;
      }

      // For retryable errors, throw to let caller handle
      throw error;
    }
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
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    abortSignal?: AbortSignal,
    workspaceRoot?: string,
    mode: 'normal' | 'plan' | 'spec' | 'execute' = 'normal',
    agentProfile?: string,
    planId?: string,
    specSessionId?: string,
    provider?: LLMProvider,
    modelId?: string,
    guardRailOptions?: { allowedDirs?: string[] },
    tierOverride?: 'free' | 'pro' | 'team' | 'enterprise',
    autonomous?: boolean
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    // Handle execute mode - load plan and execute it
    if (mode === 'execute' && planId) {
      const plan = await getPlan(planId);
      if (!plan) {
        yield { type: 'error', message: `Plan ${planId} not found` };
        return;
      }
      if (plan.status !== 'approved') {
        yield { type: 'error', message: `Plan ${planId} is not approved` };
        return;
      }

      // Start plan execution
      startPlanExecution(planId);

      // Add plan context to messages
      const planContext = `Execute this approved plan:\n\n${plan.title}\n${plan.description}\n\nSteps:\n${plan.steps.map(s => `${s.order}. ${s.title}: ${s.description}`).join('\n')}`;
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: planContext,
        },
      ];
      mode = 'normal'; // Continue in normal mode to execute
    }

    // Handle spec mode - load spec session context
    if (mode === 'spec' && specSessionId) {
      const session = await getSpecSession(specSessionId);
      if (session && session.specification) {
        const specContext = `Generate code based on this specification:\n\n${session.specification.title}\n${session.specification.description}\n\nRequirements:\n${session.specification.sections.requirements?.map(r => `- ${r.title}: ${r.description}`).join('\n') || 'None'}`;
        messages = [
          ...messages,
          {
            role: 'assistant',
            content: specContext,
          },
        ];
        mode = 'normal'; // Continue in normal mode to implement
      }
    }

    if (workspaceRoot && mode !== 'plan') {
      this.requestScopedTes = new ToolExecutionService(workspaceRoot, {
        allowedDirs: guardRailOptions?.allowedDirs,
      });
    }
    try {
      if (autonomous) {
        yield { type: 'autonomous', value: true };
      }
      logger.debug({ messageCount: messages.length, workspaceRoot, mode, agentProfile, planId, specSessionId, autonomous }, 'Starting chat stream');

      const chatMode: ChatModeName = mode === 'execute' ? 'execute' : (mode as ChatModeName);
      const specialist: CodeSpecialist | undefined =
        agentProfile && agentProfile !== 'general' && /^(router|frontend|backend|devops|test)$/.test(agentProfile)
          ? (agentProfile as CodeSpecialist)
          : undefined;
      const headPrompt = getHeadSystemPrompt({ tier: tierOverride });
      const modePrompt = getChatModePrompt(chatMode, { workspaceRoot, specialist });
      const systemPrompt = `${headPrompt}\n\n${wrapModeContext(modePrompt)}`;

      // Get tools: base + user-defined + MCP + skills
      const allTools = mode !== 'plan'
        ? [...AVAILABLE_TOOLS, ...getUserToolDefinitions(), ...getMcpTools(), ...skillRegistry.getAllTools()]
        : [];

      const requestParams: Parameters<typeof this.client.messages.stream>[0] = {
        model: modelId ?? this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };
      if (allTools.length > 0) {
        requestParams.tools = allTools;
      }

      const useGateway = provider != null || modelId != null;
      const gwProvider = provider ?? 'anthropic';
      const isNim = gwProvider === 'nim';
      const gwMessages = requestParams.messages.map((m) => {
        const role = m.role as 'user' | 'assistant';
        const c = m.content;
        if (typeof c === 'string') return { role, content: c };
        if (isNim && Array.isArray(c)) return { role, content: c };
        return { role, content: JSON.stringify(c) };
      });
      const response = useGateway
        ? getStream(
          {
            model: requestParams.model,
            max_tokens: requestParams.max_tokens,
            system: typeof requestParams.system === 'string' ? requestParams.system : JSON.stringify(requestParams.system),
            messages: gwMessages,
            tools: requestParams.tools?.map((t) => ({
              name: t.name,
              description: 'description' in t ? (t.description ?? '') : '',
              input_schema: ('input_schema' in t ? t.input_schema : _DEFAULT_TOOL_INPUT_SCHEMA) as { type: 'object'; properties?: Record<string, unknown>; required?: string[] },
            })),
          },
          { provider: gwProvider, modelId: modelId ?? this.model }
        )
        : await this.resilientStream(requestParams);

      let currentTextBlock = '';

      for await (const ev of response) {
        const event = ev as { type?: string; delta?: { type?: string; text?: string }; content_block?: { type?: string; id?: string; name?: string; input?: Record<string, unknown> } };
        if (abortSignal?.aborted) {
          logger.debug({}, 'Stream aborted');
          yield { type: 'error', message: 'Stream aborted' };
          break;
        }

        // Handle content block deltas (text)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const raw = event.delta.text ?? '';
          currentTextBlock += raw;
          yield { type: 'text', text: filterOutput(raw) };
        }

        // Handle tool use blocks
        if (event.type === 'content_block_start') {
          const contentBlock = event.content_block;
          if (contentBlock?.type === 'tool_use') {
            // Flush any accumulated text
            if (currentTextBlock.trim()) {
              currentTextBlock = '';
            }

            const toolUse = contentBlock;
            const toolId = toolUse.id ?? '';
            const toolName = toolUse.name ?? '';
            logger.debug(
              { toolName, toolId },
              'Tool use started'
            );

            // Emit tool call event
            yield {
              type: 'tool_call',
              id: toolId,
              name: toolName,
              input: (toolUse.input ?? {}) as Record<string, unknown>,
            };

            // Execute tool (uses request-scoped TES when workspaceRoot provided)
            const result = await this._executeTool(
              toolName,
              (toolUse.input ?? {}) as Record<string, unknown>,
              workspaceRoot
            );

            // Emit tool result event (filter output for secrets/PII)
            const rawOutput = result.output || result.error || '';
            yield {
              type: 'tool_result',
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

      yield { type: 'done' };
    } catch (error: unknown) {
      logger.error({ error, workspaceRoot, mode, agentProfile }, 'Chat stream error');

      // Enhanced error handling with structured error types
      const err = error as { status?: number; statusCode?: number; code?: string; name?: string; message?: string; headers?: Record<string, string> };
      const status = err.status ?? err.statusCode;
      const errorCode = err.code ?? err.name;

      let errorType = 'api_error';
      let userMessage = 'An error occurred. Please try again.';
      let retryable = false;
      let retryAfter: number | undefined;

      if (status === 401) {
        errorType = 'auth_error';
        userMessage = 'Authentication failed. Please check your API key.';
        retryable = false;
      } else if (status === 429) {
        errorType = 'rate_limit';
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        retryable = true;
        retryAfter = parseInt(err.headers?.['retry-after'] ?? '60', 10);
      } else if (status === 500 || status === 502 || status === 503) {
        errorType = 'service_error';
        userMessage = 'Service temporarily unavailable. Please try again in a moment.';
        retryable = true;
      } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET') {
        errorType = 'timeout';
        userMessage = 'Request timed out. The server may be busy. Please try again.';
        retryable = true;
      } else if (err.message?.toLowerCase().includes('network') || errorCode === 'ENOTFOUND') {
        errorType = 'network_error';
        userMessage = 'Network error. Please check your connection and try again.';
        retryable = true;
      } else if (err.message) {
        userMessage = err.message;
        retryable = status ? status >= 500 : false;
      }

      yield {
        type: 'error',
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
    }
  }

  /**
   * Execute a tool with given input
   */
  private async _executeTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceRoot?: string
  ): Promise<ToolExecutionResult> {
    try {
      logger.debug({ toolName, inputKeys: Object.keys(input) }, 'Executing tool');

      // Check if this is a skill tool (prefixed with skill_)
      if (toolName.startsWith('skill_')) {
        return await this._executeSkillTool(toolName, input, workspaceRoot);
      }
      // User-defined tools (from "add to skills" or API)
      if (isUserTool(toolName)) {
        const start = Date.now();
        try {
          const context = createSkillContext({ workspacePath: workspaceRoot, source: 'chat' });
          const { output } = await executeUserTool(toolName, input, context);
          return { success: true, output, toolName, executionTime: Date.now() - start };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message, toolName, executionTime: Date.now() - start };
        }
      }

      switch (toolName) {
        case 'bash_execute':
          return await this._executeBash(input);

        case 'file_read':
          return await this._executeFileRead(input);

        case 'file_write':
          return await this._executeFileWrite(input);

        case 'file_edit':
          return await this._executeFileEdit(input);

        case 'list_directory':
          return await this._executeListDirectory(input);

        case 'codebase_search':
          return await this._executeCodebaseSearch(input);

        case 'generate_db_schema':
          return await this._executeGenerateDbSchema(input);

        case 'generate_migrations':
          return await this._executeGenerateMigrations(input);

        case 'screenshot_url':
          return await this._executeScreenshotUrl(input);

        case 'browser_run_script':
          return await this._executeBrowserRunScript(input);

        case 'browser_navigate':
          return await this._executeBrowserNavigate(input);

        case 'browser_click':
          return await this._executeBrowserClick(input);

        case 'browser_type':
          return await this._executeBrowserType(input);

        case 'browser_get_content':
          return await this._executeBrowserGetContent(input);

        case 'browser_screenshot':
          return await this._executeBrowserScreenshot(input);

        case 'git_status':
          return await this._executeGitStatus(input);

        case 'git_diff':
          return await this._executeGitDiff(input);

        case 'git_log':
          return await this._executeGitLog(input);

        case 'git_commit':
          return await this._executeGitCommit(input);

        case 'git_branch':
          return await this._executeGitBranch(input);

        case 'git_push':
          return await this._executeGitPush(input);

        case 'terminal_execute':
          return await this._executeTerminalExecute(input);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
            toolName,
            executionTime: 0,
          };
      }
    } catch (error: unknown) {
      logger.error({ error, toolName }, 'Tool execution failed');

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
    workspaceRoot?: string
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
    logger.debug({ toolName, skillId: skill.manifest.id }, 'Executing skill tool');

    const context = createSkillContext({
      workspacePath: workspaceRoot,
      source: 'chat',
    });

    try {
      const result = await handler(input, context);
      return {
        ...result,
        toolName,
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, toolName, skillId: skill.manifest.id }, 'Skill tool execution failed');
      return {
        success: false,
        error: (error as Error).message,
        toolName,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute bash tool
   */
  private async _executeBash(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = bashExecuteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'bash_execute',
        executionTime: 0,
      };
    }

    const { command, workingDirectory, timeout } = validation.data;
    return await this.getTes().executeBash(
      command,
      workingDirectory,
      timeout
    );
  }

  /**
   * Execute file_read tool
   */
  private async _executeFileRead(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = fileReadInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'file_read',
        executionTime: 0,
      };
    }

    const { path, encoding } = validation.data;
    return await this.getTes().readFile(path, encoding);
  }

  /**
   * Execute file_write tool
   */
  private async _executeFileWrite(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = fileWriteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'file_write',
        executionTime: 0,
      };
    }

    const { path, content, createDirectories } = validation.data;
    return await this.getTes().writeFile(path, content, createDirectories);
  }

  /**
   * Execute file_edit tool
   */
  private async _executeFileEdit(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = fileEditInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'file_edit',
        executionTime: 0,
      };
    }

    const { path, operations } = validation.data;
    // Map operations to ensure required 'type' and 'lineStart' are treated as non-optional for the service
    const typedOps = operations.map(op => ({
      type: op.type as 'insert' | 'replace' | 'delete',
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
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const validation = listDirectoryInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'list_directory',
        executionTime: 0,
      };
    }

    const { path, recursive } = validation.data;
    return await this.getTes().listDirectory(path, recursive);
  }

  /**
   * Execute codebase_search tool
   */
  private async _executeCodebaseSearch(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = codebaseSearchInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'codebase_search',
        executionTime: 0,
      };
    }
    const { query, workingDirectory, maxResults } = validation.data;
    return await this.getTes().searchCodebase(query, workingDirectory, maxResults);
  }

  private async _executeGitStatus(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitStatusInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_status', executionTime: 0 };
    }
    return await this.getTes().gitStatus(validation.data.workingDirectory);
  }

  private async _executeGitDiff(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitDiffInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_diff', executionTime: 0 };
    }
    const { workingDirectory, staged, file } = validation.data;
    return await this.getTes().gitDiff(workingDirectory, staged, file);
  }

  private async _executeGitLog(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitLogInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_log', executionTime: 0 };
    }
    const { workingDirectory, maxCount, oneline } = validation.data;
    return await this.getTes().gitLog(workingDirectory, maxCount, oneline);
  }

  private async _executeGitCommit(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitCommitInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_commit', executionTime: 0 };
    }
    const { message, workingDirectory, addAll } = validation.data;
    return await this.getTes().gitCommit(message, workingDirectory, addAll);
  }

  private async _executeGitBranch(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitBranchInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_branch', executionTime: 0 };
    }
    const { workingDirectory, list, create } = validation.data;
    return await this.getTes().gitBranch(workingDirectory, list ?? true, create);
  }

  private async _executeGitPush(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = gitPushInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'git_push', executionTime: 0 };
    }
    const { workingDirectory, remote, branch } = validation.data;
    return await this.getTes().gitPush(workingDirectory, remote, branch);
  }

  private async _executeTerminalExecute(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const validation = terminalExecuteInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'terminal_execute',
        executionTime: 0,
      };
    }
    const { command, workingDirectory, timeout } = validation.data;
    return await this.getTes().executeTerminal(command, workingDirectory, timeout);
  }

  private async _executeGenerateDbSchema(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateDbSchemaInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'generate_db_schema',
        executionTime: 0,
      };
    }
    try {
      const { description, targetDb, format } = validation.data;
      const result = await generateSchemaFromDescription(description, {
        targetDb: targetDb as 'sqlite' | 'postgres' | 'mysql',
        format: format as 'sql' | 'drizzle',
      });
      let output = `DDL:\n${result.ddl}`;
      if (result.drizzle) output += `\n\nDrizzle schema:\n${result.drizzle}`;
      if (result.tables?.length) output += `\n\nTables: ${result.tables.join(', ')}`;
      return { success: true, output, toolName: 'generate_db_schema', executionTime: Date.now() - start };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        toolName: 'generate_db_schema',
        executionTime: Date.now() - start,
      };
    }
  }

  private async _executeGenerateMigrations(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateMigrationsInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid input: ${validation.error.message}`,
        toolName: 'generate_migrations',
        executionTime: 0,
      };
    }
    try {
      const { schemaDdl, targetDb } = validation.data;
      const result = await generateMigrations(schemaDdl, targetDb as 'sqlite' | 'postgres');
      const output = result.migrations.length
        ? result.migrations.map((m, i) => `-- Migration ${i + 1}\n${m}`).join('\n\n')
        : 'No migrations generated.';
      return {
        success: true,
        output: (result.summary ? `${result.summary}\n\n` : '') + output,
        toolName: 'generate_migrations',
        executionTime: Date.now() - start,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        toolName: 'generate_migrations',
        executionTime: Date.now() - start,
      };
    }
  }

  private async _executeScreenshotUrl(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = screenshotUrlInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'screenshot_url', executionTime: 0 };
    }
    const result = await screenshotUrl(validation.data.url);
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Screenshot failed', toolName: 'screenshot_url', executionTime: Date.now() - start };
    }
    const output = result.imageBase64
      ? `Screenshot captured (base64 PNG, ${result.imageBase64.length} chars). Use for visual verification.`
      : 'Screenshot captured.';
    return { success: true, output, toolName: 'screenshot_url', executionTime: Date.now() - start };
  }

  private async _executeBrowserRunScript(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserRunScriptInputSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: `Invalid input: ${validation.error.message}`, toolName: 'browser_run_script', executionTime: 0 };
    }
    const result = await browserRunScript(validation.data.steps as BrowserStep[]);
    if (!result.ok) {
      return { success: false, error: result.error ?? 'Script failed', toolName: 'browser_run_script', executionTime: Date.now() - start };
    }
    const parts = result.logs ? [`Steps: ${result.logs.join('; ')}`] : [];
    if (result.lastUrl) parts.push(`Last URL: ${result.lastUrl}`);
    if (result.screenshotBase64) parts.push(`Screenshot captured (base64, ${result.screenshotBase64.length} chars)`);
    return { success: true, output: parts.join('\n') || 'Script completed.', toolName: 'browser_run_script', executionTime: Date.now() - start };
  }

  private async _executeBrowserNavigate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserNavigateInputSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.message, toolName: 'browser_navigate', executionTime: 0 };
    const res = await browserNavigate(validation.data.url, validation.data.timeout);
    return {
      success: res.ok,
      output: res.ok ? `Navigated to ${res.result?.url}. Title: ${res.result?.title}` : res.error,
      toolName: 'browser_navigate',
      executionTime: Date.now() - start
    };
  }

  private async _executeBrowserClick(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserClickInputSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.message, toolName: 'browser_click', executionTime: 0 };
    const { selector, url } = validation.data;
    const res = await browserClick(selector, url);
    return {
      success: res.ok,
      output: res.ok ? `Clicked element: ${selector}` : res.error,
      toolName: 'browser_click',
      executionTime: Date.now() - start
    };
  }

  private async _executeBrowserType(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserTypeInputSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.message, toolName: 'browser_type', executionTime: 0 };
    const { selector, text, url } = validation.data;
    const res = await browserType(selector, text, url);
    return {
      success: res.ok,
      output: res.ok ? `Typed "${text}" into ${selector}` : res.error,
      toolName: 'browser_type',
      executionTime: Date.now() - start
    };
  }

  private async _executeBrowserGetContent(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserGetContentInputSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.message, toolName: 'browser_get_content', executionTime: 0 };
    const res = await browserGetContent(validation.data.url);
    return {
      success: res.ok,
      output: res.ok ? `HTML Length: ${res.html?.length}\nText Content:\n${res.text?.substring(0, 5000)}` : res.error,
      toolName: 'browser_get_content',
      executionTime: Date.now() - start
    };
  }

  private async _executeBrowserScreenshot(input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserScreenshotInputSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.message, toolName: 'browser_screenshot', executionTime: 0 };
    const res = await browserScreenshot(validation.data.url, validation.data.fullPage);
    return {
      success: res.ok,
      output: res.ok ? "Screenshot captured." : res.error,
      toolName: 'browser_screenshot',
      executionTime: Date.now() - start
    };
  }
}

// Export singleton instance
export const claudeServiceWithTools = new ClaudeServiceWithTools();
