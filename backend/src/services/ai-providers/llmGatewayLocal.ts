/**
 * @fileoverview LLM Gateway - Local/Specialized Provider Stream Generators
 *
 * Contains Ollama and Jan stream handlers which interact with locally-hosted
 * LLM inference servers.
 *
 * @module services/ai-providers/llmGatewayLocal
 */

import logger from "../../middleware/logger.js";
import { env } from "../../config/env.js";
import type { StreamParams, StreamEvent } from "./llmGatewayTypes.js";
import { PROVIDER_CONFIGS, getTimeoutMs } from "./llmGatewayTypes.js";

// =============================================================================
// Ollama Stream
// =============================================================================

/**
 * Map NIM / cloud model IDs to Ollama-compatible model names.
 * When smart retry falls back to Ollama, the NIM model ID (e.g. "moonshotai/kimi-k2.5")
 * won't exist in Ollama. This table translates them.
 */
const NIM_TO_OLLAMA_MODEL_MAP: Record<string, string> = {
    "moonshotai/kimi-k2.5": "mistral",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5": "llama3.2",
    "meta/llama-3.1-405b-instruct": "llama3.1",
    "meta/llama-3.1-70b-instruct": "llama3.1",
    "mistralai/mistral-large-2-instruct": "mistral",
    "mistralai/codestral-22b-instruct-v0.1": "deepseek-coder",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1": "llama3.1",
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
    schema: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    if (!schema || typeof schema !== "object") {
        return { type: "object", properties: {} };
    }

    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
        if (value === null || value === undefined) {
            // Replace nulls with sensible defaults per key
            if (key === "properties") {
                clean[key] = {};
            } else if (key === "required") {
                clean[key] = [];
            }
            // Skip other null fields entirely (don't include them)
            continue;
        }

        // Recursively sanitize nested schema objects
        if (key === "properties" && typeof value === "object" && value !== null) {
            const sanitizedProps: Record<string, unknown> = {};
            for (const [propName, propSchema] of Object.entries(
                value as Record<string, unknown>,
            )) {
                if (propSchema && typeof propSchema === "object") {
                    sanitizedProps[propName] = sanitizeSchemaForOllama(
                        propSchema as Record<string, unknown>,
                    );
                } else if (propSchema !== null && propSchema !== undefined) {
                    sanitizedProps[propName] = propSchema;
                }
                // Skip null/undefined property definitions
            }
            clean[key] = sanitizedProps;
            continue;
        }

        // Recursively sanitize `items` (for array types)
        if (key === "items" && typeof value === "object" && value !== null) {
            clean[key] = sanitizeSchemaForOllama(
                value as Record<string, unknown>,
            );
            continue;
        }

        // Recursively sanitize schema combinators
        if (
            (key === "allOf" || key === "anyOf" || key === "oneOf") &&
            Array.isArray(value)
        ) {
            clean[key] = value
                .filter((v) => v !== null && v !== undefined)
                .map((v) =>
                    typeof v === "object"
                        ? sanitizeSchemaForOllama(v as Record<string, unknown>)
                        : v,
                );
            continue;
        }

        clean[key] = value;
    }

    // Ensure top-level has `type` and `properties`
    if (!clean.type) clean.type = "object";
    if (clean.type === "object" && !clean.properties) clean.properties = {};

    return clean;
}

/**
 * Stream from Ollama (native API) with full tool calling support.
 */
export async function* streamOllama(
    params: StreamParams,
): AsyncGenerator<StreamEvent> {
    const config = PROVIDER_CONFIGS.ollama;
    // Map NIM-style model IDs to Ollama-compatible names
    const rawModel = params.model || config.defaultModel;
    const model = NIM_TO_OLLAMA_MODEL_MAP[rawModel] || rawModel;

    if (model !== rawModel) {
        logger.info(
            { originalModel: rawModel, mappedModel: model },
            "[Ollama] Mapped NIM model ID to Ollama model",
        );
    }

    logger.debug(
        { model, provider: "ollama", hasTools: Boolean(params.tools?.length) },
        "[Ollama] Starting stream request",
    );

    // Build messages array, handling both string and multimodal content
    const ollamaMessages = [
        ...(params.system
            ? [{ role: "system" as const, content: params.system }]
            : []),
        ...params.messages.map((m) => {
            const role = m.role;
            if (typeof m.content === "string") {
                return { role, content: m.content };
            }
            // For multimodal content, extract text and images
            if (Array.isArray(m.content)) {
                const textParts = (m.content as Array<{ type: string; text?: string }>)
                    .filter((p) => p.type === "text")
                    .map((p) => p.text ?? "")
                    .join("\n");
                const images = (m.content as Array<{ type: string; image_url?: { url: string } }>)
                    .filter((p) => p.type === "image_url" && p.image_url?.url)
                    .map((p) => {
                        const url = p.image_url!.url;
                        // Ollama expects base64 images without the data URI prefix
                        if (url.startsWith("data:")) {
                            const base64Part = url.split(",")[1];
                            return base64Part ?? url;
                        }
                        return url;
                    });
                return {
                    role,
                    content: textParts || "Image content attached",
                    ...(images.length > 0 ? { images } : {}),
                };
            }
            return { role, content: "Unsupported content format" };
        }),
    ];

    // Handle tool_calls in assistant messages and tool results in the conversation
    // Ollama expects tool results as role:"tool" messages
    const processedMessages: Array<Record<string, unknown>> = [];
    for (const msg of ollamaMessages) {
        const m = msg as Record<string, unknown>;
        if (m.role === "tool" && m.tool_call_id) {
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
                type: "function" as const,
                function: {
                    name: t.name,
                    description: t.description ?? "",
                    parameters: sanitizeSchemaForOllama(
                        t.input_schema ?? { type: "object", properties: {} },
                    ),
                },
            }));
        logger.debug(
            { toolCount: (body.tools as unknown[]).length, toolNames: params.tools.map((t) => t.name).slice(0, 10) },
            "[Ollama] Sending tools to model",
        );
    }

    const timeoutMs = getTimeoutMs("ollama", params.max_tokens);

    try {
        const res = await fetch(config.baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
            body: JSON.stringify(body),
            signal: params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
            keepalive: true,
        });

        if (!res.ok) {
            const t = await res.text();
            logger.warn(
                { status: res.status, body: t.slice(0, 500), model },
                "Ollama API error",
            );
            throw new Error(`Ollama API error: ${res.status} ${t.slice(0, 200)}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Ollama: no response body");

        const dec = new TextDecoder();
        let buf = "";
        let chunkCount = 0;
        let toolCallIndex = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunkCount++;
            const decoded = dec.decode(value, { stream: true });
            buf += decoded;
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

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
                        logger.warn({ error: j.error }, "Ollama stream error");
                        yield { type: "message_stop" as const };
                        return;
                    }

                    // Handle text content
                    if (j.message?.content) {
                        yield {
                            type: "content_block_delta" as const,
                            delta: { type: "text_delta" as const, text: j.message.content },
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
                            if (typeof toolCall.function.arguments === "string") {
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
                                "[Ollama] Tool call received",
                            );

                            // Emit content_block_start with full tool input populated.
                            // claudeServiceWithTools.ts reads input directly from content_block.input
                            yield {
                                type: "content_block_start" as const,
                                content_block: {
                                    type: "tool_use" as const,
                                    id: toolId,
                                    name: toolName,
                                    input: toolInput,
                                },
                            };
                        }
                    }

                    if (j.done) {
                        yield { type: "message_stop" as const };
                        return;
                    }
                } catch {
                    // skip malformed chunk
                }
            }
        }

        logger.debug({ chunkCount, model, toolCallIndex }, "[Ollama] Stream complete");
        yield { type: "message_stop" as const };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn({ error: errMsg, model }, "Ollama request failed");

        // If this is a JSON Schema validation error (e.g. tool schema rejected),
        // retry WITHOUT tools so the model can still respond with text.
        if (
            errMsg.includes("JSON Schema") ||
            errMsg.includes("SchemaError") ||
            errMsg.includes("not of type")
        ) {
            logger.info(
                { model },
                "[Ollama] JSON Schema validation failed — retrying without tools",
            );
            try {
                const retryBody = { ...body };
                delete retryBody.tools;
                const retryRes = await fetch(config.baseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
                    body: JSON.stringify(retryBody),
                    signal: params.signal
                        ? AbortSignal.any([params.signal, AbortSignal.timeout(getTimeoutMs("ollama", params.max_tokens))])
                        : AbortSignal.timeout(getTimeoutMs("ollama", params.max_tokens)),
                    keepalive: true,
                });
                if (retryRes.ok) {
                    const retryReader = retryRes.body?.getReader();
                    if (retryReader) {
                        const retryDec = new TextDecoder();
                        let retryBuf = "";
                        while (true) {
                            const { done, value } = await retryReader.read();
                            if (done) break;
                            retryBuf += retryDec.decode(value, { stream: true });
                            const retryLines = retryBuf.split("\n");
                            retryBuf = retryLines.pop() ?? "";
                            for (const line of retryLines) {
                                if (!line.trim()) continue;
                                try {
                                    const j = JSON.parse(line) as {
                                        message?: { content?: string };
                                        done?: boolean;
                                    };
                                    if (j.message?.content) {
                                        yield {
                                            type: "content_block_delta" as const,
                                            delta: { type: "text_delta" as const, text: j.message.content },
                                        };
                                    }
                                    if (j.done) {
                                        yield { type: "message_stop" as const };
                                        return;
                                    }
                                } catch {
                                    // skip malformed
                                }
                            }
                        }
                        yield { type: "message_stop" as const };
                        return;
                    }
                }
            } catch (retryErr) {
                logger.warn(
                    { error: retryErr instanceof Error ? retryErr.message : String(retryErr) },
                    "[Ollama] Retry without tools also failed",
                );
            }
        }

        // Provide a specific, actionable error message
        let userMessage: string;
        if (errMsg.includes("model") || errMsg.includes("not found") || errMsg.includes("404")) {
            userMessage = `[Ollama error: model "${model}" not found. Run \`ollama pull ${model}\` or select a different model. Available models can be listed with \`ollama list\`.]`;
        } else if (errMsg.includes("ECONNREFUSED") || errMsg.includes("fetch failed")) {
            userMessage = `[Ollama connection refused — ensure Ollama is running at ${env.OLLAMA_BASE_URL}. Start it with \`ollama serve\`.]`;
        } else if (errMsg.includes("ollama.com") || errMsg.includes("remote_host") || errMsg.includes(":cloud")) {
            userMessage = `[Ollama cloud proxy error: The model "${model}" requires a connection to ollama.com which failed. Try a local model instead (e.g. llama3.2, mistral). Run \`ollama list\` to see available models.]`;
        } else if (errMsg.includes("aborted") || errMsg.includes("timeout")) {
            userMessage = `[Ollama request timed out. The model may be loading or the request was too large. Try again.]`;
        } else if (errMsg.includes("JSON Schema") || errMsg.includes("SchemaError")) {
            userMessage = `[Ollama error: Tool schema validation failed. The model may not support function calling. Retrying without tools failed.]`;
        } else {
            userMessage = `[Ollama error: ${errMsg.slice(0, 200)}. Ensure Ollama is running at ${env.OLLAMA_BASE_URL}.]`;
        }

        yield {
            type: "content_block_delta" as const,
            delta: {
                type: "text_delta" as const,
                text: userMessage,
            },
        };
        yield { type: "message_stop" as const };
    }
}

// =============================================================================
// Jan (Local) Stream
// =============================================================================

/**
 * Stream from Jan (OpenAI-compatible local inference at localhost:1337).
 */
export async function* streamJan(params: StreamParams): AsyncGenerator<StreamEvent> {
    const config = PROVIDER_CONFIGS.jan;
    const model = params.model || config.defaultModel;
    const janBaseUrl =
        params.janBaseUrlOverride ||
        process.env.JAN_BASE_URL ||
        "http://localhost:1337";
    const url = `${janBaseUrl}/v1/chat/completions`;

    logger.debug({ model, url, hasTools: Boolean(params.tools?.length) }, "[Jan] Starting local stream request");

    try {
        const body: Record<string, unknown> = {
            model,
            max_tokens: params.max_tokens,
            stream: true,
            messages: [
                ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
                ...params.messages.map((m) => {
                    // Tool result messages (role="tool")
                    if (m.role === "tool" && m.tool_call_id) {
                        return {
                            role: "tool" as const,
                            tool_call_id: m.tool_call_id,
                            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                        };
                    }
                    // Assistant messages with tool_calls
                    if (m.role === "assistant" && m.tool_calls?.length) {
                        return {
                            role: "assistant" as const,
                            content: typeof m.content === "string" ? (m.content || null) : null,
                            tool_calls: m.tool_calls,
                        };
                    }
                    // Regular user/assistant messages
                    return {
                        role: m.role as "user" | "assistant",
                        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                    };
                }),
            ],
        };
        if (params.temperature !== undefined) body.temperature = params.temperature;

        // Add tools if provided (OpenAI function calling format)
        if (params.tools && params.tools.length > 0 && config.supportsTools) {
            body.tools = params.tools.map((t) => ({
                type: "function" as const,
                function: {
                    name: t.name,
                    description: t.description ?? "",
                    parameters: t.input_schema ?? { type: "object", properties: {} },
                },
            }));
        }

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(getTimeoutMs("jan", params.max_tokens)),
            keepalive: true,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            logger.warn({ status: response.status, error: errText }, "Jan request failed");
            yield {
                type: "content_block_delta" as const,
                delta: { type: "text_delta" as const, text: `[Jan error ${response.status}: ${errText}]` },
            };
            yield { type: "message_stop" as const };
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Jan: no response body");

        const dec = new TextDecoder();
        let buf = "";

        // Track streamed tool calls and emit only after finish_reason=tool_calls
        const toolCalls: Map<number, { id: string; name: string; args: string }> =
            new Map();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                    // Flush any remaining tool calls
                    if (toolCalls.size > 0) {
                        for (const [, acc] of [...toolCalls.entries()].sort((a, b) => a[0] - b[0])) {
                            if (!acc.id || !acc.name) continue;
                            let input: Record<string, unknown> = {};
                            try {
                                if (acc.args.trim()) input = JSON.parse(acc.args) as Record<string, unknown>;
                            } catch {
                                input = { raw: acc.args };
                            }
                            yield {
                                type: "content_block_start" as const,
                                content_block: { type: "tool_use" as const, id: acc.id, name: acc.name, input },
                            };
                        }
                        toolCalls.clear();
                    }
                    yield { type: "message_stop" as const };
                    return;
                }
                try {
                    const parsed = JSON.parse(data) as {
                        choices?: Array<{
                            delta?: {
                                content?: string;
                                tool_calls?: Array<{
                                    index: number;
                                    id?: string;
                                    type?: string;
                                    function?: { name?: string; arguments?: string };
                                }>;
                            };
                            finish_reason?: string | null;
                        }>;
                    };

                    const choice = parsed.choices?.[0];
                    const delta = choice?.delta;
                    const finishReason = choice?.finish_reason;

                    // Text content
                    if (delta?.content) {
                        yield { type: "content_block_delta" as const, delta: { type: "text_delta" as const, text: delta.content } };
                    }

                    // Accumulate tool calls
                    if (delta?.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index;
                            if (!toolCalls.has(idx)) {
                                toolCalls.set(idx, { id: tc.id ?? "", name: "", args: "" });
                            }
                            const acc = toolCalls.get(idx)!;
                            if (tc.id) acc.id = tc.id;
                            if (tc.function?.name) acc.name = tc.function.name;
                            if (tc.function?.arguments) acc.args += tc.function.arguments;
                        }
                    }

                    // Emit tool calls when finish_reason signals completion
                    if (finishReason === "tool_calls" && toolCalls.size > 0) {
                        for (const [, acc] of [...toolCalls.entries()].sort((a, b) => a[0] - b[0])) {
                            if (!acc.id || !acc.name) continue;
                            let input: Record<string, unknown> = {};
                            try {
                                if (acc.args.trim()) input = JSON.parse(acc.args) as Record<string, unknown>;
                            } catch {
                                input = { raw: acc.args };
                            }
                            yield {
                                type: "content_block_start" as const,
                                content_block: { type: "tool_use" as const, id: acc.id, name: acc.name, input },
                            };
                        }
                        toolCalls.clear();
                    }
                } catch { /* skip malformed chunk */ }
            }
        }

        // Flush any remaining tool calls at stream end
        if (toolCalls.size > 0) {
            for (const [, acc] of [...toolCalls.entries()].sort((a, b) => a[0] - b[0])) {
                if (!acc.id || !acc.name) continue;
                let input: Record<string, unknown> = {};
                try {
                    if (acc.args.trim()) input = JSON.parse(acc.args) as Record<string, unknown>;
                } catch {
                    input = { raw: acc.args };
                }
                yield {
                    type: "content_block_start" as const,
                    content_block: { type: "tool_use" as const, id: acc.id, name: acc.name, input },
                };
            }
            toolCalls.clear();
        }

        yield { type: "message_stop" as const };
    } catch (error) {
        logger.warn({ error, model }, "Jan request failed");
        yield {
            type: "content_block_delta" as const,
            delta: { type: "text_delta" as const, text: `[Jan connection failed - ensure Jan is running at ${process.env.JAN_BASE_URL || "http://localhost:1337"}]` },
        };
        yield { type: "message_stop" as const };
    }
}
