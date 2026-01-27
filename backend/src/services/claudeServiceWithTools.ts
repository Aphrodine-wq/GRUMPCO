/**
 * Claude Service with Tool Calling
 * Integrates Claude API with tool execution
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
} from '../tools/definitions.js';
import { toolExecutionService, ToolExecutionService } from './toolExecutionService.js';
import { logger } from '../utils/logger.js';
import { getPlan, startPlanExecution } from './planService.js';
import { getSpecSession } from './specService.js';
import { withResilience, withRetry, isRetryableError, type ErrorWithStatus } from './resilience.js';
import { checkRateLimit, getCircuitBreaker } from './bulkheads.js';

// ============================================================================
// CHAT STREAM EVENT TYPES
// ============================================================================

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | {
    type: 'tool_call';
    id: string;
    name: string;
    input: Record<string, any>;
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

export class ClaudeServiceWithTools {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-20250514';
  private toolExecutionService: ToolExecutionService;
  private requestScopedTes: ToolExecutionService | null = null;

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
  ): Promise<AsyncIterable<any>> {
    const serviceType: 'claude-chat' = 'claude-chat';

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
      return stream;
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
   */
  async *generateChatStream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    abortSignal?: AbortSignal,
    workspaceRoot?: string,
    mode: 'normal' | 'plan' | 'spec' | 'execute' = 'normal',
    agentProfile?: string,
    planId?: string,
    specSessionId?: string
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    // Handle execute mode - load plan and execute it
    if (mode === 'execute' && planId) {
      const plan = getPlan(planId);
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
      const session = getSpecSession(specSessionId);
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
      this.requestScopedTes = new ToolExecutionService(workspaceRoot);
    }
    try {
      logger.debug({ messageCount: messages.length, workspaceRoot, mode, agentProfile, planId, specSessionId }, 'Starting chat stream');

      const base = `Paths are relative to the workspace root. Use tools to explore the codebase, run commands, and implement changes. Prefer small, focused edits. Explain briefly what you did.`;
      const specialistPrompts: Record<string, string> = {
        router: `You are a router coordinating specialists. Decide which domain (frontend, backend, devops, test) each request needs. Use tools to implement; prefer small, focused changes. ${base}`,
        frontend: `You are the frontend specialist. Focus on UI, components, styling, client-side logic. Use tools to edit frontend code. Prefer modern frameworks (React, Vue, Svelte). ${base}`,
        backend: `You are the backend specialist. Focus on APIs, services, data, auth. Use tools to edit backend code. ${base}`,
        devops: `You are the DevOps specialist. Focus on Docker, CI/CD, config, deployment. Use tools to edit config files. ${base}`,
        test: `You are the test specialist. Focus on unit, integration, E2E tests. Use tools to add or update tests. ${base}`,
      };
      const defaultPrompt = `You are a helpful coding assistant with access to tools. You can run bash commands, read/write/edit files, and list directories. ${base}`;

      let systemPrompt: string;
      if (mode === 'plan') {
        systemPrompt = `You are a helpful coding assistant. The user has enabled Plan mode. Output a clear, step-by-step plan only. Do not use any tools. Number the steps. Keep it concise.`;
      } else if (mode === 'spec') {
        systemPrompt = `You are a helpful coding assistant. The user is in Spec mode. Ask clarifying questions to understand their requirements. Be conversational and ask one question at a time.`;
      } else if (mode === 'argument') {
        systemPrompt = `You are in Argument mode. Your job is to disagree by default and only implement after explicit confirmation.

For each user request:
1. Restate what they want clearly.
2. Push back: name risks, costs, tradeoffs, or simpler alternatives. Be specific and constructive.
3. Offer a counter-plan or modification you'd prefer, with a one-line rationale.
4. End with: "If you still want [their idea], say 'do it' or 'use [X]'. If you prefer my approach, say 'go with yours'."
5. Do NOT use file_write, file_edit, or bash_execute until the user says something like "do it", "go with yours", "use Auth0", "use my approach", or "implement it". You may use file_read and list_directory to inform your pushback.
6. If the user says "just do it" or "no debate", skip pushback and implement immediately.

You have the same tools as in Code mode; use them only after the user has confirmed. Be concise. One short paragraph of pushback is enough.`;
      } else {
        systemPrompt = (agentProfile && specialistPrompts[agentProfile]) ? specialistPrompts[agentProfile] : defaultPrompt;
      }

      const requestParams: Parameters<typeof this.client.messages.stream>[0] = {
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };
      if (mode !== 'plan') {
        requestParams.tools = AVAILABLE_TOOLS;
      }

      const response = await this.resilientStream(requestParams);

      let currentTextBlock = '';

      for await (const event of response) {
        if (abortSignal?.aborted) {
          logger.debug({}, 'Stream aborted');
          yield { type: 'error', message: 'Stream aborted' };
          break;
        }

        // Handle content block deltas (text)
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentTextBlock += event.delta.text;
            yield { type: 'text', text: event.delta.text };
          }
        }

        // Handle tool use blocks
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            // Flush any accumulated text
            if (currentTextBlock.trim()) {
              currentTextBlock = '';
            }

            const toolUse = event.content_block;
            logger.debug(
              { toolName: toolUse.name, toolId: toolUse.id },
              'Tool use started'
            );

            // Emit tool call event
            yield {
              type: 'tool_call',
              id: toolUse.id,
              name: toolUse.name,
              input: toolUse.input as Record<string, any>,
            };

            // Execute tool (uses request-scoped TES when workspaceRoot provided)
            const result = await this._executeTool(
              toolUse.name,
              toolUse.input as Record<string, any>
            );

            // Emit tool result event
            yield {
              type: 'tool_result',
              id: toolUse.id,
              toolName: toolUse.name,
              output: result.output || result.error || '',
              success: result.success,
              executionTime: result.executionTime,
              diff: result.diff,
            };
          }
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      logger.error({ error, workspaceRoot, mode, agentProfile }, 'Chat stream error');

      // Enhanced error handling with structured error types
      const status = error.status || error.statusCode;
      const errorCode = error.code || error.name;
      
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
        retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
      } else if (status === 500 || status === 502 || status === 503) {
        errorType = 'service_error';
        userMessage = 'Service temporarily unavailable. Please try again in a moment.';
        retryable = true;
      } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET') {
        errorType = 'timeout';
        userMessage = 'Request timed out. The server may be busy. Please try again.';
        retryable = true;
      } else if (error.message?.toLowerCase().includes('network') || errorCode === 'ENOTFOUND') {
        errorType = 'network_error';
        userMessage = 'Network error. Please check your connection and try again.';
        retryable = true;
      } else if (error.message) {
        userMessage = error.message;
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
    input: Record<string, any>
  ): Promise<ToolExecutionResult> {
    try {
      logger.debug({ toolName, inputKeys: Object.keys(input) }, 'Executing tool');

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

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
            toolName,
            executionTime: 0,
          };
      }
    } catch (error: any) {
      logger.error({ error, toolName }, 'Tool execution failed');

      return {
        success: false,
        error: error.message,
        toolName,
        executionTime: 0,
      };
    }
  }

  /**
   * Execute bash tool
   */
  private async _executeBash(input: Record<string, any>): Promise<ToolExecutionResult> {
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
  private async _executeFileRead(input: Record<string, any>): Promise<ToolExecutionResult> {
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
  private async _executeFileWrite(input: Record<string, any>): Promise<ToolExecutionResult> {
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
  private async _executeFileEdit(input: Record<string, any>): Promise<ToolExecutionResult> {
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
    return await this.getTes().editFile(path, operations);
  }

  /**
   * Execute list_directory tool
   */
  private async _executeListDirectory(
    input: Record<string, any>
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
}

// Export singleton instance
export const claudeServiceWithTools = new ClaudeServiceWithTools();
