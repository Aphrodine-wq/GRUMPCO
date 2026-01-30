/**
 * LLM Gateway helper for non-streaming calls
 * Provides a simple completion interface that accumulates stream events
 */

import { getStream, type StreamParams, type LLMProvider } from './llmGateway.js';

export interface CompletionResult {
  text: string;
  error?: string;
}

/**
 * Get a non-streaming text completion from the LLM gateway.
 * Accumulates stream events into a single text response.
 */
export async function getCompletion(
  params: StreamParams,
  provider?: LLMProvider
): Promise<CompletionResult> {
  try {
    const stream = getStream(params, { provider });
    let text = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;
      } else if (event.type === 'error') {
        return { text: '', error: String(event.error) };
      }
    }

    return { text };
  } catch (error) {
    return { text: '', error: (error as Error).message };
  }
}
