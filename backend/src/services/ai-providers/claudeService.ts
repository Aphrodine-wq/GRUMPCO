/**
 * @fileoverview LLM-powered diagram generation service.
 *
 * Provides functions for generating Mermaid diagrams from natural language
 * descriptions using LLM providers. Supports:
 * - Intent analysis for better diagram type detection
 * - Conversation context for multi-turn interactions
 * - Diagram refinement based on existing diagrams
 * - Both streaming and non-streaming generation
 * - Resilient operation with circuit breaker and retry logic
 *
 * @module services/claudeService
 */

import { withResilience } from "../infra/resilience.js";
import { getRequestLogger } from "../../middleware/logger.js";
import { createApiTimer } from "../../middleware/metrics.js";
import { extractMermaidCode, validateMermaidCode } from "../workspace/mermaidUtils.js";
import { getSystemPrompt, type UserPreferences } from "../../prompts/index.js";
import { analyzeIntent, getIntentAugmentation } from "../intent/intentParser.js";
import type {
  ServiceError,
  ConversationMessage,
  RefinementContext,
} from "../../types/index.js";
import {
  getStream,
  type StreamParams,
  type StreamEvent,
} from "./llmGateway.js";
import { createHash } from "crypto";
import { requestDeduper } from "../caching/requestDeduper.js";

/** Default LLM model for diagram generation (Kimi K2.5 via NVIDIA NIM) */
const DEFAULT_MODEL = "moonshotai/kimi-k2.5";

/**
 * Collects all text chunks from a streaming LLM response into a single string.
 *
 * @param stream - Async iterable of stream events from the LLM
 * @returns Complete response text
 *
 * @example
 * ```typescript
 * const stream = getStream(params, config);
 * const fullResponse = await collectStreamResponse(stream);
 * ```
 */
async function collectStreamResponse(
  stream: AsyncIterable<StreamEvent>,
): Promise<string> {
  let fullText = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
    }
  }
  return fullText;
}

function hashStreamParams(params: StreamParams): string {
  const payload = JSON.stringify({
    model: params.model,
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages,
    tools: params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Makes a non-streaming LLM call and returns the complete response.
 * Internally uses streaming but collects all chunks before returning.
 *
 * @param params - Stream parameters including model, messages, and settings
 * @returns Complete LLM response text
 */
async function callLLMNonStreaming(params: StreamParams): Promise<string> {
  const dedupeKey = `diagram:${hashStreamParams(params)}`;
  return requestDeduper.dedupe(dedupeKey, async () => {
    const stream = getStream(params, {
      provider: "nim",
      modelId: params.model,
    });
    return collectStreamResponse(stream);
  });
}

// Re-export UserPreferences type for external use
export type { UserPreferences } from "../../prompts/index.js";
export type { ConversationMessage, RefinementContext } from "../../types/index.js";

/** Maximum number of message pairs to include from conversation history */
const CONTEXT_WINDOW_SIZE = 5;

/**
 * Builds an array of messages for the LLM API from conversation history.
 *
 * Handles three scenarios:
 * 1. Fresh conversation - just the user message
 * 2. Continued conversation - includes recent history + current message
 * 3. Diagram refinement - wraps message with existing diagram context
 *
 * @param userMessage - The current user message to process
 * @param conversationHistory - Optional array of previous messages in the conversation
 * @param refinementContext - Optional context containing a base diagram to refine
 * @returns Array of messages formatted for the LLM API
 *
 * @example
 * ```typescript
 * // Simple message
 * const messages = buildConversationMessages("Create a flowchart");
 * // => [{ role: 'user', content: 'Create a flowchart' }]
 *
 * // With refinement context
 * const messages = buildConversationMessages("Add error handling", undefined, {
 *   baseDiagram: 'flowchart TD...',
 *   instruction: 'Modify the existing diagram'
 * });
 * ```
 */
function buildConversationMessages(
  userMessage: string,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext,
): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add recent conversation history (limited to context window)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-CONTEXT_WINDOW_SIZE * 2); // user+assistant pairs
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Build current message with refinement context if present
  let currentMessage = userMessage;
  if (refinementContext?.baseDiagram) {
    currentMessage = `Based on this existing diagram:\n\`\`\`mermaid\n${refinementContext.baseDiagram}\n\`\`\`\n\n${refinementContext.instruction || "Please modify this diagram according to my request:"}\n\n${userMessage}`;
  }

  messages.push({
    role: "user",
    content: currentMessage,
  });

  return messages;
}

/**
 * Core diagram generation function with intent analysis and conversation context.
 *
 * This is the internal implementation that:
 * 1. Analyzes user intent to detect diagram type and requirements
 * 2. Enriches preferences with detected constraints
 * 3. Optionally adds clarification guidance for ambiguous requests
 * 4. Makes the LLM call and extracts/validates the Mermaid code
 *
 * @param userMessage - Natural language description of the desired diagram
 * @param preferences - Optional user preferences (complexity, C4 level, etc.)
 * @param conversationHistory - Optional conversation context for multi-turn interactions
 * @param refinementContext - Optional existing diagram to refine
 * @returns Generated Mermaid diagram code, or clarification text if needed
 * @throws {ServiceError} When diagram extraction fails (code: 'EXTRACTION_FAILED')
 *
 * @internal Use the exported `generateDiagram` function which wraps this with resilience
 */
async function _generateDiagram(
  userMessage: string,
  preferences?: UserPreferences,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext,
): Promise<string> {
  const log = getRequestLogger();
  const timer = createApiTimer("generate_diagram");

  try {
    // Analyze user intent
    const intent = analyzeIntent(userMessage);
    log.info(
      {
        messageLength: userMessage.length,
        intentConfidence: intent.confidence,
        suggestedType: intent.suggestedType,
        c4Level: intent.c4Level,
        requiresClarification: intent.requiresClarification,
        hasConversationHistory: !!conversationHistory?.length,
        hasRefinementContext: !!refinementContext?.baseDiagram,
      },
      "Generating diagram with intent analysis",
    );

    // Enrich preferences with intent analysis
    const enrichedPreferences: UserPreferences = {
      ...preferences,
      // Use detected C4 level if not already specified
      c4Level: preferences?.c4Level ?? intent.c4Level,
      // Apply detected constraints
      complexity: preferences?.complexity ?? intent.constraints.complexity,
      focusAreas: preferences?.focusAreas ?? intent.constraints.focusAreas,
    };

    // Build message content, potentially with intent augmentation
    let messageContent = userMessage;
    const intentAugmentation = getIntentAugmentation(intent);
    if (intentAugmentation && !refinementContext?.baseDiagram) {
      messageContent = `${userMessage}\n\n${intentAugmentation}`;
      log.info("Added intent augmentation for clarification guidance");
    }

    // Build conversation messages with history
    const messages = buildConversationMessages(
      messageContent,
      conversationHistory,
      refinementContext,
    );

    const response = await callLLMNonStreaming({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: getSystemPrompt(enrichedPreferences),
      messages,
    });

    const result = extractMermaidCode(response);

    // If extraction failed but we have text, it might be a clarification question
    // In that case, return the raw text so it can be shown to the user
    if (!result.extracted || !result.code) {
      // Check if this looks like a clarification question
      const lowerText = response.toLowerCase();
      const isClarification =
        lowerText.includes("would you") ||
        lowerText.includes("could you") ||
        lowerText.includes("which") ||
        lowerText.includes("prefer") ||
        lowerText.includes("clarify");

      if (isClarification && intent.requiresClarification) {
        // Return the clarification text as-is (not diagram code)
        log.info("LLM asked for clarification");
        timer.success();
        return response;
      }

      const error: ServiceError = new Error(
        "Could not extract diagram code from response",
      );
      error.code = "EXTRACTION_FAILED";
      error.rawText = response;
      timer.failure("extraction_failed");
      throw error;
    }

    timer.success();
    log.info({ method: result.method }, "Diagram generated successfully");
    return result.code;
  } catch (error) {
    const err = error as ServiceError;
    timer.failure(err.status?.toString() || "error");
    throw error;
  }
}

/**
 * Resilient version of _generateDiagram with circuit breaker and retry logic.
 * Uses exponential backoff for transient failures and circuit breaker for persistent failures.
 */
const resilientGenerateDiagram = withResilience(
  _generateDiagram,
  "claude-diagram",
);

/**
 * Generates a Mermaid diagram from a natural language description.
 *
 * This is the main entry point for diagram generation. It wraps the core
 * generation logic with resilience features (circuit breaker, retries).
 *
 * @param userMessage - Natural language description of the desired diagram
 * @param preferences - Optional user preferences for diagram generation
 * @param preferences.c4Level - C4 abstraction level ('context' | 'container' | 'component' | 'code')
 * @param preferences.complexity - Diagram complexity ('simple' | 'detailed' | 'mvp' | 'enterprise')
 * @param preferences.focusAreas - Specific areas to emphasize
 * @param conversationHistory - Optional previous messages for context
 * @param refinementContext - Optional existing diagram to modify
 * @returns Generated Mermaid diagram code
 *
 * @example
 * ```typescript
 * // Simple generation
 * const diagram = await generateDiagram("Create a login flow");
 *
 * // With preferences
 * const diagram = await generateDiagram("Design a microservices system", {
 *   c4Level: 'container',
 *   complexity: 'detailed'
 * });
 *
 * // Refining an existing diagram
 * const refined = await generateDiagram("Add caching layer", undefined, history, {
 *   baseDiagram: existingDiagram,
 *   instruction: "Enhance the architecture"
 * });
 * ```
 */
export async function generateDiagram(
  userMessage: string,
  preferences?: UserPreferences,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext,
): Promise<string> {
  return resilientGenerateDiagram(
    userMessage,
    preferences,
    conversationHistory,
    refinementContext,
  );
}

/**
 * Generates a Mermaid diagram with real-time streaming output.
 *
 * Unlike `generateDiagram`, this function yields text chunks as they arrive,
 * enabling progressive rendering in the UI. Supports abort signals for cancellation.
 *
 * @param userMessage - Natural language description of the desired diagram
 * @param preferences - Optional user preferences for diagram generation
 * @param abortSignal - Optional AbortSignal to cancel the stream
 * @param conversationHistory - Optional previous messages for context
 * @param refinementContext - Optional existing diagram to modify
 * @yields Text chunks of the response as they arrive from the LLM
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * const stream = generateDiagramStream(
 *   "Create a state machine for order processing",
 *   { complexity: 'detailed' },
 *   controller.signal
 * );
 *
 * let fullResponse = '';
 * for await (const chunk of stream) {
 *   fullResponse += chunk;
 *   updateUI(fullResponse); // Progressive rendering
 * }
 *
 * // Cancel if needed
 * controller.abort();
 * ```
 */
export async function* generateDiagramStream(
  userMessage: string,
  preferences?: UserPreferences,
  abortSignal?: AbortSignal,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext,
): AsyncGenerator<string, void, unknown> {
  const log = getRequestLogger();
  const timer = createApiTimer("generate_diagram_stream");

  try {
    // Analyze user intent
    const intent = analyzeIntent(userMessage);
    log.info(
      {
        messageLength: userMessage.length,
        intentConfidence: intent.confidence,
        suggestedType: intent.suggestedType,
        c4Level: intent.c4Level,
        hasConversationHistory: !!conversationHistory?.length,
        hasRefinementContext: !!refinementContext?.baseDiagram,
      },
      "Starting diagram stream with intent analysis",
    );

    // Enrich preferences with intent analysis
    const enrichedPreferences: UserPreferences = {
      ...preferences,
      c4Level: preferences?.c4Level ?? intent.c4Level,
      complexity: preferences?.complexity ?? intent.constraints.complexity,
      focusAreas: preferences?.focusAreas ?? intent.constraints.focusAreas,
    };

    // Build message content
    let messageContent = userMessage;
    const intentAugmentation = getIntentAugmentation(intent);
    if (intentAugmentation && !refinementContext?.baseDiagram) {
      messageContent = `${userMessage}\n\n${intentAugmentation}`;
    }

    // Build conversation messages with history
    const messages = buildConversationMessages(
      messageContent,
      conversationHistory,
      refinementContext,
    );

    const stream = getStream(
      {
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        system: getSystemPrompt(enrichedPreferences),
        messages,
      },
      { provider: "nim", modelId: DEFAULT_MODEL },
    );

    for await (const event of stream) {
      // Check abort between chunks
      if (abortSignal?.aborted) {
        log.info("Stream cancelled");
        timer.failure("aborted");
        return;
      }

      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }

    timer.success();
    log.info("Stream completed successfully");
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.name === "AbortError" || abortSignal?.aborted) {
      timer.failure("aborted");
      log.info("Stream aborted");
      return;
    }
    timer.failure(err.status?.toString() || "error");
    throw error;
  }
}

// Re-export utilities for backwards compatibility
export { extractMermaidCode, validateMermaidCode };

// Export intent analysis for external use
export { analyzeIntent } from "../intent/intentParser.js";
export type { IntentAnalysis } from "../intent/intentParser.js";
