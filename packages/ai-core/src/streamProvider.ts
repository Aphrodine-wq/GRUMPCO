/**
 * LLM stream provider interface – allows pluggable backends (Anthropic, NIM, OpenRouter, etc.)
 * Implement this interface and register by provider name to add new backends without changing gateway logic.
 */

export interface StreamMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface StreamParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: StreamMessage[];
  tools?: Array<{
    name: string;
    description: string;
    input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  }>;
}

export type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'content_block_start'; content_block: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } }
  | { type: 'message_stop' }
  | { type: 'error'; error?: unknown };

export interface LLMStreamProvider {
  name: string;
  supportsTools?: boolean;
  stream(params: StreamParams): AsyncIterable<StreamEvent>;
}

const providerRegistry = new Map<string, LLMStreamProvider>();

export function registerStreamProvider(providerId: string, provider: LLMStreamProvider): void {
  providerRegistry.set(providerId, provider);
}

export function getStreamProvider(providerId: string): LLMStreamProvider | undefined {
  return providerRegistry.get(providerId);
}
