/**
 * Chat Streaming Service
 *
 * Reusable service for streaming chat responses from the API.
 * Handles SSE parsing, content block accumulation, and error recovery.
 *
 * @module lib/chatStreaming
 */
/* global AbortSignal */

import { fetchApi } from './api';
import type { ContentBlock, Message } from '../types';

/**
 * Stream event types emitted during chat streaming
 */
export type ChatStreamEventType =
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'thinking'
  | 'error'
  | 'done';

/**
 * Events emitted during streaming
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  /** Optional suggestion for chat mode (e.g. backend detects diagram intent) */
  suggestChatMode?: 'design' | 'code';
  /** Text content for 'text' events */
  text?: string;
  /** Tool call details for 'tool_call' events */
  toolCall?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  /** Tool result details for 'tool_result' events */
  toolResult?: {
    id: string;
    toolName: string;
    output: string;
    success: boolean;
    executionTime?: number;
    diff?: {
      filePath: string;
      beforeContent: string;
      afterContent: string;
      changeType: 'created' | 'modified' | 'deleted';
    };
  };
  /** Thinking content for extended thinking */
  thinking?: string;
  /** Error message */
  error?: string;
  /** Accumulated content blocks */
  blocks: ContentBlock[];
}

/**
 * Options for chat streaming
 */
export interface ChatStreamOptions {
  /** Chat mode */
  mode?: 'normal' | 'plan' | 'spec' | 'ship' | 'execute' | 'design' | 'argument' | 'code';
  /** Session type */
  sessionType?: 'chat' | 'gAgent' | 'freeAgent';
  /** Workspace root for tool execution */
  workspaceRoot?: string;
  /** LLM provider */
  provider?: string;
  /** Model ID */
  modelId?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for each event */
  onEvent?: (event: ChatStreamEvent) => void;
  /** Base64 or data URL of image attached to the last user message (e.g. for NIM vision) */
  lastUserMessageImage?: string | null;
  /** Array of enabled skill IDs to activate for this chat request */
  enabledSkillIds?: string[];
  /** User memory context to provide to the AI (from Memory page) */
  memoryContext?: string[];
}

/**
 * Flattens message content to plain text
 */
export function flattenMessageContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is { type: 'text'; content: string } => b.type === 'text')
    .map((b) => b.content)
    .join('');
}

/**
 * Prepares messages for the chat API
 */
export function prepareMessagesForApi(
  messages: Message[],
  options?: { lastUserMessageImage?: string | null; provider?: string }
): Array<{ role: 'user' | 'assistant'; content: string | unknown[] }> {
  const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const isNim = options?.provider === 'nim';
  const image = options?.lastUserMessageImage;
  const lastUserIdx = filtered.map((m) => m.role).lastIndexOf('user');

  return filtered
    .map((m, i) => {
      const role = m.role as 'user' | 'assistant';
      const text = flattenMessageContent(m.content).trim();

      if (role === 'assistant') return { role, content: text };

      // Handle image attachment for NIM provider
      if (isNim && image && i === lastUserIdx) {
        const parts: unknown[] = [];
        if (text) parts.push({ type: 'text', text });
        parts.push({ type: 'image_url', image_url: { url: image } });
        return { role, content: parts };
      }

      return { role, content: text };
    })
    .filter((m) => {
      if (typeof m.content === 'string') return m.content.length > 0;
      return (m.content as { type: string; text?: string }[]).some((p) =>
        p.type === 'text' ? (p.text ?? '').trim().length > 0 : true
      );
    });
}

/**
 * Streams a chat response from the API
 *
 * @example
 * ```typescript
 * const blocks = await streamChat(messages, {
 *   mode: 'normal',
 *   provider: 'nim',
 *   onEvent: (event) => {
 *     if (event.type === 'text') {
 *       console.log('Text:', event.text);
 *     }
 *   }
 * });
 * ```
 */
export async function streamChat(
  messages: Message[],
  options: ChatStreamOptions = {}
): Promise<ContentBlock[]> {
  const {
    mode = 'normal',
    sessionType = 'chat',
    workspaceRoot,
    provider,
    modelId,
    signal,
    onEvent,
    lastUserMessageImage,
    enabledSkillIds,
    memoryContext,
  } = options;

  const apiMessages = prepareMessagesForApi(messages, { provider, lastUserMessageImage });
  if (apiMessages.length === 0) {
    throw new Error('No messages to send');
  }

  const body: Record<string, unknown> = {
    messages: apiMessages,
    mode,
    sessionType,
  };

  if (workspaceRoot) body.workspaceRoot = workspaceRoot;
  if (provider) body.provider = provider;
  if (modelId) body.modelId = modelId;
  if (enabledSkillIds && enabledSkillIds.length > 0) body.enabledSkillIds = enabledSkillIds;
  if (memoryContext && memoryContext.length > 0) body.memoryContext = memoryContext;

  const response = await fetchApi('/api/chat/stream', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Server error (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const blocks: ContentBlock[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);

        try {
          const event = JSON.parse(raw);
          processStreamEvent(event, blocks, onEvent);
        } catch {
          // Ignore parse errors for malformed JSON
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6));
        processStreamEvent(event, blocks, onEvent);
      } catch {
        // Ignore
      }
    }

    // Emit done event
    onEvent?.({ type: 'done', blocks });
  } finally {
    reader.releaseLock();
  }

  return blocks;
}

/**
 * Process a single stream event and update blocks
 */
function processStreamEvent(
  event: Record<string, unknown>,
  blocks: ContentBlock[],
  onEvent?: (event: ChatStreamEvent) => void
): void {
  const type = event.type as string;

  if (type === 'text' && typeof event.text === 'string') {
    // Append to last text block or create new one
    const last = blocks[blocks.length - 1];
    if (last?.type === 'text') {
      (last as { content: string }).content += event.text;
    } else {
      blocks.push({ type: 'text', content: event.text });
    }
    // Pass live reference instead of copying — avoids O(n²) for long streams
    onEvent?.({ type: 'text', text: event.text, blocks });
  } else if (type === 'tool_call' && event.id && event.name) {
    const toolCall = {
      id: event.id as string,
      name: event.name as string,
      input: (event.input as Record<string, unknown>) ?? {},
    };
    blocks.push({
      type: 'tool_call',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
      status: 'executing',
    });
    onEvent?.({ type: 'tool_call', toolCall, blocks });
  } else if (type === 'tool_result' && event.id) {
    const toolResult = {
      id: event.id as string,
      toolName: (event.toolName as string) ?? '',
      output: (event.output as string) ?? '',
      success: (event.success as boolean) ?? false,
      executionTime: event.executionTime as number | undefined,
      diff: event.diff as { filePath: string; beforeContent: string; afterContent: string; changeType: 'created' | 'modified' | 'deleted' } | undefined,
    };
    blocks.push({
      type: 'tool_result',
      id: toolResult.id,
      toolName: toolResult.toolName,
      output: toolResult.output,
      success: toolResult.success,
      executionTime: toolResult.executionTime ?? 0,
      diff: toolResult.diff,
    });
    onEvent?.({ type: 'tool_result', toolResult, blocks });
  } else if (type === 'thinking' && typeof event.thinking === 'string') {
    onEvent?.({ type: 'thinking', thinking: event.thinking, blocks });
  } else if (type === 'error') {
    const errorMessage = (event.message as string) ?? 'Unknown error';
    onEvent?.({ type: 'error', error: errorMessage, blocks });
  }

  // Handle mode suggestion from backend
  if (type === 'suggest_mode' && event.mode) {
    onEvent?.({
      type: 'text',
      suggestChatMode: event.mode as 'design' | 'code',
      blocks,
    });
  }
}

/**
 * Async generator version for more control
 *
 * @example
 * ```typescript
 * for await (const event of streamChatGenerator(messages, options)) {
 *   if (event.type === 'text') {
 *     updateUI(event.text);
 *   }
 * }
 * ```
 */
export async function* streamChatGenerator(
  messages: Message[],
  options: Omit<ChatStreamOptions, 'onEvent'> = {}
): AsyncGenerator<ChatStreamEvent> {
  const events: ChatStreamEvent[] = [];
  let resolveNext: ((value: ChatStreamEvent | null) => void) | null = null;
  let done = false;

  const onEvent = (event: ChatStreamEvent) => {
    if (resolveNext) {
      resolveNext(event);
      resolveNext = null;
    } else {
      events.push(event);
    }
    if (event.type === 'done') {
      done = true;
    }
  };

  // Start streaming in background
  const streamPromise = streamChat(messages, { ...options, onEvent }).catch((err) => {
    onEvent({ type: 'error', error: err.message, blocks: [] });
    onEvent({ type: 'done', blocks: [] });
  });

  // Yield events as they come in
  while (!done) {
    if (events.length > 0) {
      const nextEvent = events.shift();
      if (nextEvent) yield nextEvent;
    } else {
      const event = await new Promise<ChatStreamEvent | null>((resolve) => {
        resolveNext = resolve;
        // Check if we already have events while waiting
        if (events.length > 0) {
          const pending = events.shift();
          if (pending) resolve(pending);
          resolveNext = null;
        }
      });
      if (event) yield event;
    }
  }

  // Yield any remaining events
  while (events.length > 0) {
    const remaining = events.shift();
    if (remaining) yield remaining;
  }

  await streamPromise;
}

/**
 * Calculate total character count for messages
 */
export function calculateMessageChars(messages: Message[]): number {
  return messages.reduce((sum, m) => {
    const content = m.content;
    if (typeof content === 'string') return sum + content.length;
    if (Array.isArray(content)) {
      return (
        sum +
        content.reduce((s, block) => {
          if (block.type === 'text') return s + (block.content?.length ?? 0);
          return s;
        }, 0)
      );
    }
    return sum;
  }, 0);
}
