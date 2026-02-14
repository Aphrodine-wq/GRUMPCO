/**
 * LLM Gateway helper for non-streaming calls
 * Provides a simple completion interface that accumulates stream events
 */

import { getStream, type StreamParams, type LLMProvider } from './llmGateway.js';

export interface CompletionResult {
  text: string;
  error?: string;
}

export interface GetCompletionOptions {
  provider?: LLMProvider;
  modelId?: string;
}

/**
 * Get a non-streaming text completion from the LLM gateway.
 * Accumulates stream events into a single text response.
 * Pass options.provider and options.modelId to use router-selected model.
 */
export async function getCompletion(
  params: StreamParams,
  options?: LLMProvider | GetCompletionOptions
): Promise<CompletionResult> {
  const opts: GetCompletionOptions =
    options === undefined ? {} : typeof options === 'string' ? { provider: options } : options;
  try {
    const stream = getStream(params, {
      provider: opts.provider,
      modelId: opts.modelId,
    });
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
