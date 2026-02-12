/**
 * @fileoverview LLM Gateway - Local/Specialized Provider Stream Generators
 *
 * Contains the Ollama stream handler which interacts with locally-hosted
 * LLM inference servers.
 *
 * @module services/ai-providers/llmGatewayLocal
 */

import logger from '../../middleware/logger.js';
import { env } from '../../config/env.js';
import type { StreamParams, StreamEvent } from './llmGatewayTypes.js';
import { PROVIDER_CONFIGS, getTimeoutMs } from './llmGatewayTypes.js';

// =============================================================================
// Ollama Stream
// =============================================================================

/**
 * Map NIM / cloud model IDs to Ollama-compatible model names.
 * When smart retry falls back to Ollama, the NIM model ID (e.g. "moonshotai/kimi-k2.5")
 * won't exist in Ollama. This table translates them.
 */
const NIM_TO_OLLAMA_MODEL_MAP: Record<string, string> = {
  'moonshotai/kimi-k2.5': 'qwen2.5-coder:32b',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': 'qwen2.5-coder:32b',
  'meta/llama-3.1-405b-instruct': 'llama3.1',
  'meta/llama-3.1-70b-instruct': 'llama3.1',
  'mistralai/mistral-large-2-instruct': 'devstral',
  'mistralai/codestral-22b-instruct-v0.1': 'devstral',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'qwen2.5-coder:32b',
  'claude-sonnet-4-5-20250929': 'qwen2.5-coder:32b',
  'claude-opus-4-6-20260206': 'qwen2.5-coder:32b',
  'gemini-2.5-pro': 'qwen2.5-coder:32b',
  'gemini-2.5-flash': 'qwen2.5-coder',
};

/**
 * Deeply sanitize a JSON Schema object for Ollama's strict validator.
 * Ollama (via Python jsonschema) rejects `null`/`None` where it expects objects.
 * This recursively ensures:
 *  - `properties` is always at least `{}`
 *  - No nested value is `null` or `undefined`
 *  - Sub-schemas in `properties`, `items`, `allOf`, `anyOf`, `oneOf` are cleaned
 */
function sanitizeSchemaForOllama(
  schema: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (value === null || value === undefined) {
      // Replace nulls with sensible defaults per key
      if (key === 'properties') {
        clean[key] = {};
      } else if (key === 'required') {
        clean[key] = [];
      }
      // Skip other null fields entirely (don't include them)
      continue;
    }

    // Recursively sanitize nested schema objects
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      const sanitizedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
        if (propSchema && typeof propSchema === 'object') {
          sanitizedProps[propName] = sanitizeSchemaForOllama(propSchema as Record<string, unknown>);
        } else if (propSchema !== null && propSchema !== undefined) {
          sanitizedProps[propName] = propSchema;
        }
        // Skip null/undefined property definitions
      }
      clean[key] = sanitizedProps;
      continue;
    }

    // Recursively sanitize `items` (for array types)
    if (key === 'items' && typeof value === 'object' && value !== null) {
      clean[key] = sanitizeSchemaForOllama(value as Record<string, unknown>);
      continue;
    }

    // Recursively sanitize schema combinators
    if ((key === 'allOf' || key === 'anyOf' || key === 'oneOf') && Array.isArray(value)) {
      clean[key] = value
        .filter((v) => v !== null && v !== undefined)
        .map((v) =>
          typeof v === 'object' ? sanitizeSchemaForOllama(v as Record<string, unknown>) : v
        );
      continue;
    }

    clean[key] = value;
  }

  // Ensure top-level has `type` and `properties`
  if (!clean.type) clean.type = 'object';
  if (clean.type === 'object' && !clean.properties) clean.properties = {};

  return clean;
}

/**
 * Stream from Ollama (native API) with full tool calling support.
 */
export async function* streamOllama(params: StreamParams): AsyncGenerator<StreamEvent> {
  const config = PROVIDER_CONFIGS.ollama;
  // Map NIM-style model IDs to Ollama-compatible names
  const rawModel = params.model || config.defaultModel;
  const model = NIM_TO_OLLAMA_MODEL_MAP[rawModel] || rawModel;

  if (model !== rawModel) {
    logger.info(
      { originalModel: rawModel, mappedModel: model },
      '[Ollama] Mapped NIM model ID to Ollama model'
    );
  }

  logger.debug(
    { model, provider: 'ollama', hasTools: Boolean(params.tools?.length) },
    '[Ollama] Starting stream request'
  );

  // Build messages array, handling both string and multimodal content
  const ollamaMessages = [
    ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
    ...params.messages.map((m) => {
      const role = m.role;
      if (typeof m.content === 'string') {
        return { role, content: m.content };
      }
      // For multimodal content, extract text and images
      if (Array.isArray(m.content)) {
        const textParts = (m.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n');
        const images = (m.content as Array<{ type: string; image_url?: { url: string } }>)
          .filter((p) => p.type === 'image_url' && p.image_url?.url)
          .map((p) => {
            const url = p.image_url!.url;
            // Ollama expects base64 images without the data URI prefix
            if (url.startsWith('data:')) {
              const base64Part = url.split(',')[1];
              return base64Part ?? url;
            }
            return url;
          });
        return {
          role,
          content: textParts || 'Image content attached',
          ...(images.length > 0 ? { images } : {}),
        };
      }
      return { role, content: 'Unsupported content format' };
    }),
  ];

  // Handle tool_calls in assistant messages and tool results in the conversation
  // Ollama expects tool results as role:"tool" messages
  const processedMessages: Array<Record<string, unknown>> = [];
  for (const msg of ollamaMessages) {
    const m = msg as Record<string, unknown>;
    if (m.role === 'tool' && m.tool_call_id) {
      // Pass tool results through directly
      processedMessages.push(m);
    } else if (m.tool_calls && Array.isArray(m.tool_calls)) {
      // Assistant message with tool calls — pass through
      processedMessages.push(m);
    } else {
      processedMessages.push(m);
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages: processedMessages,
    stream: true,
    keep_alive: -1, // Keep model loaded in memory forever (until Ollama stops)
    options: {
      num_predict: params.max_tokens,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.9,
    },
  };

  // Pass tools to Ollama when provided — Ollama uses OpenAI-compatible tool format
  // Ollama is STRICT about JSON Schema validation: any null/undefined value where
  // it expects an object will cause "None is not of type 'object'" errors.
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools
      .filter((t) => t && t.name) // Skip invalid tool definitions
      .map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description ?? '',
          parameters: sanitizeSchemaForOllama(t.input_schema ?? { type: 'object', properties: {} }),
        },
      }));
    logger.debug(
      {
        toolCount: (body.tools as unknown[]).length,
        toolNames: params.tools.map((t) => t.name).slice(0, 10),
      },
      '[Ollama] Sending tools to model'
    );
  }

  const timeoutMs = getTimeoutMs('ollama', params.max_tokens);

  try {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' },
      body: JSON.stringify(body),
      signal: params.signal
        ? AbortSignal.any([params.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      keepalive: true,
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500), model }, 'Ollama API error');
      throw new Error(`Ollama API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Ollama: no response body');

    const dec = new TextDecoder();
    let buf = '';
    let chunkCount = 0;
    let toolCallIndex = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkCount++;
      const decoded = dec.decode(value, { stream: true });
      buf += decoded;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line) as {
            message?: {
              content?: string;
              role?: string;
              tool_calls?: Array<{
                id?: string;
                function?: { name: string; arguments: string | Record<string, unknown> };
              }>;
            };
            done?: boolean;
            error?: string;
          };

          if (j.error) {
            logger.warn({ error: j.error }, 'Ollama stream error');
            yield { type: 'message_stop' as const };
            return;
          }

          // Handle text content
          if (j.message?.content) {
            yield {
              type: 'content_block_delta' as const,
              delta: { type: 'text_delta' as const, text: j.message.content },
            };
          }

          // Handle tool calls from Ollama
          if (j.message?.tool_calls && Array.isArray(j.message.tool_calls)) {
            for (const toolCall of j.message.tool_calls) {
              if (!toolCall.function?.name) continue;

              const toolId = toolCall.id ?? `ollama-tool-${toolCallIndex++}`;
              const toolName = toolCall.function.name;

              // Ollama may return arguments as string or object
              let toolInput: Record<string, unknown>;
              if (typeof toolCall.function.arguments === 'string') {
                try {
                  toolInput = JSON.parse(toolCall.function.arguments);
                } catch {
                  toolInput = { raw: toolCall.function.arguments };
                }
              } else {
                toolInput = (toolCall.function.arguments as Record<string, unknown>) ?? {};
              }

              logger.debug(
                { toolId, toolName, inputKeys: Object.keys(toolInput) },
                '[Ollama] Tool call received'
              );

              // Emit content_block_start with full tool input populated.
              // claudeServiceWithTools.ts reads input directly from content_block.input
              yield {
                type: 'content_block_start' as const,
                content_block: {
                  type: 'tool_use' as const,
                  id: toolId,
                  name: toolName,
                  input: toolInput,
                },
              };
            }
          }

          if (j.done) {
            yield { type: 'message_stop' as const };
            return;
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    logger.debug({ chunkCount, model, toolCallIndex }, '[Ollama] Stream complete');
    yield { type: 'message_stop' as const };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn({ error: errMsg, model }, 'Ollama request failed');

    // If this is a JSON Schema validation error (e.g. tool schema rejected),
    // retry WITHOUT tools so the model can still respond with text.
    if (
      errMsg.includes('JSON Schema') ||
      errMsg.includes('SchemaError') ||
      errMsg.includes('not of type')
    ) {
      logger.info({ model }, '[Ollama] JSON Schema validation failed — retrying without tools');
      try {
        const retryBody = { ...body }; // Inherits keep_alive: -1 from original body
        delete retryBody.tools;
        const retryRes = await fetch(config.baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' },
          body: JSON.stringify(retryBody),
          signal: params.signal
            ? AbortSignal.any([
                params.signal,
                AbortSignal.timeout(getTimeoutMs('ollama', params.max_tokens)),
              ])
            : AbortSignal.timeout(getTimeoutMs('ollama', params.max_tokens)),
          keepalive: true,
        });
        if (retryRes.ok) {
          const retryReader = retryRes.body?.getReader();
          if (retryReader) {
            const retryDec = new TextDecoder();
            let retryBuf = '';
            while (true) {
              const { done, value } = await retryReader.read();
              if (done) break;
              retryBuf += retryDec.decode(value, { stream: true });
              const retryLines = retryBuf.split('\n');
              retryBuf = retryLines.pop() ?? '';
              for (const line of retryLines) {
                if (!line.trim()) continue;
                try {
                  const j = JSON.parse(line) as {
                    message?: { content?: string };
                    done?: boolean;
                  };
                  if (j.message?.content) {
                    yield {
                      type: 'content_block_delta' as const,
                      delta: { type: 'text_delta' as const, text: j.message.content },
                    };
                  }
                  if (j.done) {
                    yield { type: 'message_stop' as const };
                    return;
                  }
                } catch {
                  // skip malformed
                }
              }
            }
            yield { type: 'message_stop' as const };
            return;
          }
        }
      } catch (retryErr) {
        logger.warn(
          { error: retryErr instanceof Error ? retryErr.message : String(retryErr) },
          '[Ollama] Retry without tools also failed'
        );
      }
    }

    // Provide a specific, actionable error message
    let userMessage: string;
    if (errMsg.includes('model') || errMsg.includes('not found') || errMsg.includes('404')) {
      userMessage = `[Ollama error: model "${model}" not found. Run \`ollama pull ${model}\` or select a different model. Available models can be listed with \`ollama list\`.]`;
    } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
      userMessage = `[Ollama connection refused — ensure Ollama is running at ${env.OLLAMA_BASE_URL}. Start it with \`ollama serve\`.]`;
    } else if (
      errMsg.includes('ollama.com') ||
      errMsg.includes('remote_host') ||
      errMsg.includes(':cloud')
    ) {
      userMessage = `[Ollama cloud proxy error: The model "${model}" requires a connection to ollama.com which failed. Try a local model instead (e.g. llama3.2, mistral). Run \`ollama list\` to see available models.]`;
    } else if (errMsg.includes('aborted') || errMsg.includes('timeout')) {
      userMessage = `[Ollama request timed out. The model may be loading or the request was too large. Try again.]`;
    } else if (errMsg.includes('JSON Schema') || errMsg.includes('SchemaError')) {
      userMessage = `[Ollama error: Tool schema validation failed. The model may not support function calling. Retrying without tools failed.]`;
    } else {
      userMessage = `[Ollama error: ${errMsg.slice(0, 200)}. Ensure Ollama is running at ${env.OLLAMA_BASE_URL}.]`;
    }

    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: userMessage,
      },
    };
    yield { type: 'message_stop' as const };
  }
}
