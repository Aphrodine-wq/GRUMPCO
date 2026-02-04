/**
 * G-Agent Core
 *
 * The unified entry point for all G-Agent operations.
 * Routes requests to the appropriate mode handler.
 *
 * This is a thin facade that delegates to specialized modules:
 * - intentDetector.ts - Detects user intent from messages
 * - sessionManager.ts - Manages user sessions
 * - modeHandlers.ts - Contains mode-specific logic
 */

import { EventEmitter } from "events";
import { supervisor } from "./supervisor.js";
import { detectIntent } from "./intentDetector.js";
import { sessionManager, type Session } from "./sessionManager.js";
import {
  handleGoalMode,
  handlePlanMode,
  handleExecuteMode,
  handleSwarmMode,
  handleCodegenMode,
  handleAutonomousMode,
  handleChatMode,
  type HandlerContext,
} from "./modeHandlers.js";
import type {
  AgentMode,
  AgentRequest,
  AgentResponse,
  AgentEvent,
  AgentTier,
  Plan,
} from "./types.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CoreOptions {
  defaultTier: AgentTier;
  maxConcurrentGoals: number;
  sessionTimeoutMs: number;
  enableAutonomous: boolean;
}

// Re-export Session type for backwards compatibility
export type { Session } from "./sessionManager.js";

// ============================================================================
// G-AGENT CORE CLASS
// ============================================================================

export class GAgentCore {
  private options: CoreOptions;
  private eventEmitter: EventEmitter;
  private static instance: GAgentCore;

  private constructor(options?: Partial<CoreOptions>) {
    this.options = {
      defaultTier: "free",
      maxConcurrentGoals: 10,
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
      enableAutonomous: true,
      ...options,
    };
    this.eventEmitter = new EventEmitter();

    // Start session cleanup
    sessionManager.startCleanup(60_000);
  }

  static getInstance(options?: Partial<CoreOptions>): GAgentCore {
    if (!GAgentCore.instance) {
      GAgentCore.instance = new GAgentCore(options);
    }
    return GAgentCore.instance;
  }

  // ============================================================================
  // MAIN ENTRY POINT
  // ============================================================================

  /**
   * Process an agent request
   * This is the single entry point for all G-Agent operations
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Get or create session
    const session = sessionManager.getOrCreate({
      sessionId: request.sessionId,
      userId: request.userId,
    });

    // Detect mode if not specified
    const detectedIntent = detectIntent(request.message);
    const mode = request.mode ?? detectedIntent.mode;

    // Add user message to session
    sessionManager.addMessage(session.id, "user", request.message);
    sessionManager.setMode(session.id, mode);

    // Emit session start event
    this.emitEvent({
      type: "session_start",
      sessionId: session.id,
      mode,
    });

    // Create handler context
    const ctx: HandlerContext = {
      requestId,
      session,
      emitEvent: (event) => this.emitEvent(event),
      options: {
        enableAutonomous: this.options.enableAutonomous,
      },
    };

    try {
      let response: AgentResponse;

      switch (mode) {
        case "goal":
          response = await handleGoalMode(request, ctx);
          break;

        case "plan":
          response = await handlePlanMode(request, ctx);
          break;

        case "execute":
          response = await handleExecuteMode(request, ctx);
          break;

        case "swarm":
          response = await handleSwarmMode(request, ctx);
          break;

        case "codegen":
          response = await handleCodegenMode(request, ctx);
          break;

        case "autonomous":
          response = await handleAutonomousMode(request, ctx);
          break;

        case "chat":
        default:
          response = await handleChatMode(request, ctx);
          break;
      }

      // Add assistant response to session
      sessionManager.addMessage(session.id, "assistant", response.message);

      // Add usage stats
      response.usage = {
        ...response.usage,
        durationMs: Date.now() - startTime,
        tokensIn: response.usage?.tokensIn ?? 0,
        tokensOut: response.usage?.tokensOut ?? 0,
        cost: response.usage?.cost ?? 0,
      };

      this.emitEvent({
        type: "session_end",
        sessionId: session.id,
        success: response.success,
      });

      return response;
    } catch (err) {
      const error = err as Error;

      this.emitEvent({
        type: "error",
        message: error.message,
        code: "PROCESS_ERROR",
      });

      return {
        requestId,
        mode,
        sessionId: session.id,
        success: false,
        message: `Error processing request: ${error.message}`,
        error: {
          code: "PROCESS_ERROR",
          message: error.message,
          retryable: true,
        },
        usage: {
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  // ============================================================================
  // STREAMING SUPPORT
  // ============================================================================

  /**
   * Process request with streaming events
   */
  async *processStream(
    request: AgentRequest,
  ): AsyncGenerator<AgentEvent, AgentResponse> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session = sessionManager.getOrCreate({
      sessionId: request.sessionId,
      userId: request.userId,
    });

    const detectedIntent = detectIntent(request.message);
    const mode = request.mode ?? detectedIntent.mode;

    yield {
      type: "session_start",
      sessionId: session.id,
      mode,
    };

    sessionManager.addMessage(session.id, "user", request.message);

    try {
      // For modes that support streaming, yield events as they come
      if (mode === "execute" && session.context.plan) {
        const plan = session.context.plan as Plan;

        const events = supervisor.executePlan(plan, {
          goalId: session.goalId,
          userTier: request.userTier,
          workspaceRoot: request.workspaceRoot,
          autonomous: request.autonomous,
        });

        for await (const event of events) {
          yield event;
        }
      }

      yield {
        type: "session_end",
        sessionId: session.id,
        success: true,
      };

      return {
        requestId,
        mode,
        sessionId: session.id,
        success: true,
        message: "Stream completed",
        usage: {
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (err) {
      yield {
        type: "error",
        message: (err as Error).message,
        code: "STREAM_ERROR",
      };

      return {
        requestId,
        mode,
        sessionId: session.id,
        success: false,
        message: (err as Error).message,
        error: {
          code: "STREAM_ERROR",
          message: (err as Error).message,
          retryable: true,
        },
      };
    }
  }

  // ============================================================================
  // SESSION ACCESS
  // ============================================================================

  getSession(sessionId: string): Session | undefined {
    return sessionManager.get(sessionId);
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  private emitEvent(event: AgentEvent): void {
    this.eventEmitter.emit("event", event);
  }

  onEvent(handler: (event: AgentEvent) => void): () => void {
    this.eventEmitter.on("event", handler);
    return () => this.eventEmitter.off("event", handler);
  }

  // ============================================================================
  // STATUS & STATS
  // ============================================================================

  getStatus(): {
    activeSessions: number;
    supervisorStats: ReturnType<typeof supervisor.getStats>;
    agentConcurrency: ReturnType<typeof supervisor.getConcurrencyStatus>;
  } {
    return {
      activeSessions: sessionManager.size,
      supervisorStats: supervisor.getStats(),
      agentConcurrency: supervisor.getConcurrencyStatus(),
    };
  }
}

// Export singleton instance
export const gAgentCore = GAgentCore.getInstance();
