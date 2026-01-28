import Anthropic from '@anthropic-ai/sdk';
import { withResilience } from './resilience.js';
import { getRequestLogger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import logger from '../middleware/logger.js';
import { extractMermaidCode, validateMermaidCode } from './mermaidUtils.js';
import { getSystemPrompt, type UserPreferences } from '../prompts/index.js';
import { analyzeIntent, getIntentAugmentation } from './intentParser.js';
import type { ServiceError, ConversationMessage, RefinementContext } from '../types/index.js';

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const apiKey = process.env.ANTHROPIC_API_KEY;

// Validate API key on startup
if (!apiKey) {
  logger.error('ANTHROPIC_API_KEY is not set. Please copy .env.example to .env and add your API key.');
  logger.error('Get your key at: https://console.anthropic.com/');
  if (!isTestEnv) {
    process.exit(1);
  }
}

const client = new Anthropic({
  apiKey: apiKey || 'test-key',
});

// Create resilient wrapper for streaming
const resilientClaudeStream = withResilience(
  async (params: Parameters<typeof client.messages.stream>[0]) => {
    return await client.messages.stream(params);
  },
  'claude-diagram-stream'
);

// Re-export UserPreferences type for external use
export type { UserPreferences } from '../prompts/index.js';
export type { ConversationMessage, RefinementContext } from '../types/index.js';

// Context window configuration
const CONTEXT_WINDOW_SIZE = 5; // Number of previous messages to include

// Build conversation history for Claude API
function buildConversationMessages(
  userMessage: string,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

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
    currentMessage = `Based on this existing diagram:\n\`\`\`mermaid\n${refinementContext.baseDiagram}\n\`\`\`\n\n${refinementContext.instruction || 'Please modify this diagram according to my request:'}\n\n${userMessage}`;
  }

  messages.push({
    role: 'user',
    content: currentMessage,
  });

  return messages;
}

// Base diagram generation function with intent analysis and conversation context
async function _generateDiagram(
  userMessage: string,
  preferences?: UserPreferences,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext
): Promise<string> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_diagram');

  try {
    // Analyze user intent
    const intent = analyzeIntent(userMessage);
    log.info({
      messageLength: userMessage.length,
      intentConfidence: intent.confidence,
      suggestedType: intent.suggestedType,
      c4Level: intent.c4Level,
      requiresClarification: intent.requiresClarification,
      hasConversationHistory: !!conversationHistory?.length,
      hasRefinementContext: !!refinementContext?.baseDiagram,
    }, 'Generating diagram with intent analysis');

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
      log.info('Added intent augmentation for clarification guidance');
    }

    // Build conversation messages with history
    const messages = buildConversationMessages(
      messageContent,
      conversationHistory,
      refinementContext
    );

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: getSystemPrompt(enrichedPreferences),
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = extractMermaidCode(content.text);

    // If extraction failed but we have text, it might be a clarification question
    // In that case, return the raw text so it can be shown to the user
    if (!result.extracted || !result.code) {
      // Check if this looks like a clarification question from Claude
      const lowerText = content.text.toLowerCase();
      const isClarification = lowerText.includes('would you') ||
        lowerText.includes('could you') ||
        lowerText.includes('which') ||
        lowerText.includes('prefer') ||
        lowerText.includes('clarify');

      if (isClarification && intent.requiresClarification) {
        // Return the clarification text as-is (not diagram code)
        log.info('Claude asked for clarification');
        timer.success();
        return content.text;
      }

      const error: ServiceError = new Error('Could not extract diagram code from response');
      error.code = 'EXTRACTION_FAILED';
      error.rawText = content.text;
      timer.failure('extraction_failed');
      throw error;
    }

    timer.success();
    log.info({ method: result.method }, 'Diagram generated successfully');
    return result.code;
  } catch (error) {
    const err = error as ServiceError;
    timer.failure(err.status?.toString() || 'error');
    throw error;
  }
}

// Create resilient version with circuit breaker + retry
const resilientGenerateDiagram = withResilience(_generateDiagram, 'claude-diagram');

// Export wrapped function with conversation context support
export async function generateDiagram(
  userMessage: string,
  preferences?: UserPreferences,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext
): Promise<string> {
  return resilientGenerateDiagram(userMessage, preferences, conversationHistory, refinementContext);
}

// Streaming generator with abort signal support, intent analysis, and conversation context
export async function* generateDiagramStream(
  userMessage: string,
  preferences?: UserPreferences,
  abortSignal?: AbortSignal,
  conversationHistory?: ConversationMessage[],
  refinementContext?: RefinementContext
): AsyncGenerator<string, void, unknown> {
  const log = getRequestLogger();
  const timer = createApiTimer('generate_diagram_stream');

  try {
    // Analyze user intent
    const intent = analyzeIntent(userMessage);
    log.info({
      messageLength: userMessage.length,
      intentConfidence: intent.confidence,
      suggestedType: intent.suggestedType,
      c4Level: intent.c4Level,
      hasConversationHistory: !!conversationHistory?.length,
      hasRefinementContext: !!refinementContext?.baseDiagram,
    }, 'Starting diagram stream with intent analysis');

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
      refinementContext
    );

    const stream = await resilientClaudeStream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: getSystemPrompt(enrichedPreferences),
      messages,
    });

    // Handle abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        log.info('Stream aborted by client');
        stream.controller?.abort();
      });
    }

    for await (const event of stream) {
      // Check abort between chunks
      if (abortSignal?.aborted) {
        log.info('Stream cancelled');
        timer.failure('aborted');
        return;
      }

      if (event.type === 'content_block_delta' &&
        event.delta &&
        'text' in event.delta) {
        yield event.delta.text;
      }
    }

    timer.success();
    log.info('Stream completed successfully');
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.name === 'AbortError' || abortSignal?.aborted) {
      timer.failure('aborted');
      log.info('Stream aborted');
      return;
    }
    timer.failure(err.status?.toString() || 'error');
    throw error;
  }
}

// Re-export utilities for backwards compatibility
export { extractMermaidCode, validateMermaidCode };

// Export intent analysis for external use
export { analyzeIntent } from './intentParser.js';
export type { IntentAnalysis } from './intentParser.js';
