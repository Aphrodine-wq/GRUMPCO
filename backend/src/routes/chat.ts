/**
 * Chat API Routes with Tool Calling Support
 *
 * Provides streaming chat endpoint with tool calling capabilities.
 * Supports multiple LLM providers (NIM/Kimi, OpenRouter, Anthropic, Gemini, Ollama).
 *
 * ## Features
 * - SSE streaming responses with tool execution events
 * - Model routing based on request characteristics
 * - G-Agent mode with capability restrictions
 * - Plan/Spec/Execute modes for structured workflows
 * - Caching for plan-mode responses
 * - Multimodal support (images) for compatible providers
 *
 * @module routes/chat
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getDatabase } from "../db/database.js";
import { claudeServiceWithTools } from "../services/claudeServiceWithTools.js";
import { route } from "../services/modelRouter.js";
import {
  getCachedChatResponse,
  setCachedChatResponse,
} from "../services/chatCache.js";
import {
  recordLlmRouterSelection,
  recordChatRequest,
} from "../middleware/metrics.js";
import { trace } from "@opentelemetry/api";
import logger from "../middleware/logger.js";
import {
  sendErrorResponse,
  ErrorCode,
  getClientSSEErrorMessage,
} from "../utils/errorResponse.js";
import { StreamBuffer } from "../services/streamBuffer.js";

/**
 * Extract user identifier from request headers or query params.
 * Falls back to 'default' if not provided.
 *
 * @param req - Express request object
 * @returns User key string
 */
function getUserKey(req: Request): string {
  const header = req.headers["x-user-id"];
  const query = req.query.user;
  if (typeof header === "string" && header.trim()) return header.trim();
  if (typeof query === "string" && query.trim()) return query.trim();
  return "default";
}

import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH_LARGE,
  MAX_CHAT_MESSAGES_LARGE,
  checkSuspiciousInMessages,
} from "../middleware/validator.js";

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Schema for multimodal content blocks (text or image_url).
 */
const multimodalContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({
      url: z.string().url("Invalid image URL"),
    }),
  }),
]);

/**
 * Schema for a single chat message.
 * Content can be a string or multimodal array.
 */
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(multimodalContentBlockSchema)]),
});

/**
 * Schema for guard rail options.
 */
const guardRailOptionsSchema = z
  .object({
    allowedDirs: z.array(z.string()).optional(),
  })
  .optional();

/**
 * Schema for model preference (G-Agent).
 */
const modelPreferenceSchema = z
  .object({
    source: z.enum(["cloud", "auto"]).optional(),
    provider: z.string().optional(),
    modelId: z.string().optional(),
  })
  .optional();

/**
 * Main schema for chat stream request body.
 */
const chatStreamRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, "messages array must not be empty"),
  workspaceRoot: z.string().optional(),
  mode: z.enum(["normal", "plan", "spec", "execute", "design"]).optional(),
  planMode: z.boolean().optional(), // Deprecated
  planId: z.string().optional(),
  specSessionId: z.string().optional(),
  agentProfile: z
    .enum(["general", "router", "frontend", "backend", "devops", "test"])
    .optional(),
  provider: z.enum(["nim", "mock"]).optional(),
  modelId: z.string().optional(),
  modelKey: z.string().optional(),
  guardRailOptions: guardRailOptionsSchema,
  tier: z.enum(["free", "pro", "team", "enterprise"]).optional(),
  autonomous: z.boolean().optional(),
  largeContext: z.boolean().optional(),
  preferNim: z.boolean().optional(),
  maxLatencyMs: z.number().positive().optional(),
  modelPreset: z.enum(["fast", "quality", "balanced"]).optional(),
  sessionType: z.enum(["chat", "gAgent", "freeAgent"]).optional(),
  freeAgentModelPreference: modelPreferenceSchema, // Deprecated
  gAgentModelPreference: modelPreferenceSchema,
  includeRagContext: z.boolean().optional(),
  toolAllowlist: z.array(z.string()).optional(),
  toolDenylist: z.array(z.string()).optional(),
});

/** Type inferred from the chat stream request schema */
type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;

const router = Router();

/**
 * POST /chat/stream
 * Streaming chat endpoint with tool calling support.
 *
 * @route POST /chat/stream
 * @group Chat - Chat streaming operations
 * @param {ChatStreamRequest} req.body - Chat stream request
 * @returns {SSE} 200 - Server-Sent Events stream with chat events
 * @returns {ApiErrorResponse} 400 - Validation error
 * @returns {ApiErrorResponse} 500 - Server error
 */
// Model presets: all use NVIDIA NIM (Powered by NVIDIA)
const PRESET_FAST = {
  provider: "nim" as const,
  modelId: "mistralai/mixtral-8x22b-instruct-v0.1",
};
const PRESET_QUALITY = {
  provider: "nim" as const,
  modelId: "meta/llama-3.1-405b-instruct",
};

router.post("/stream", async (req: Request, res: Response): Promise<void> => {
  // Validate request body with Zod
  const parseResult = chatStreamRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      firstError?.message ?? "Invalid request body",
      {
        field: firstError?.path?.join("."),
      },
    );
    return;
  }

  const body: ChatStreamRequest = parseResult.data;
  const {
    messages,
    workspaceRoot,
    mode,
    planMode,
    planId,
    specSessionId,
    agentProfile,
    provider,
    modelId,
    modelKey,
    guardRailOptions,
    tier,
    autonomous,
    largeContext,
    preferNim,
    maxLatencyMs,
    modelPreset,
    sessionType: sessionTypeRaw,
    freeAgentModelPreference: reqModelPreference,
    gAgentModelPreference: reqGAgentModelPreference,
    includeRagContext,
    toolAllowlist,
    toolDenylist,
  } = body;

  // Support both 'gAgent' (new) and 'freeAgent' (deprecated) session types
  const sessionType =
    sessionTypeRaw === "gAgent" || sessionTypeRaw === "freeAgent"
      ? "gAgent"
      : "chat";
  recordChatRequest(sessionType);

  // Additional validation: message count and length limits
  const useLargeContext = Boolean(largeContext);
  const maxMessages = useLargeContext
    ? MAX_CHAT_MESSAGES_LARGE
    : MAX_CHAT_MESSAGES;
  const maxMessageLength = useLargeContext
    ? MAX_CHAT_MESSAGE_LENGTH_LARGE
    : MAX_CHAT_MESSAGE_LENGTH;

  if (messages.length > maxMessages) {
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      `Too many messages. Maximum ${maxMessages} messages per request.`,
    );
    return;
  }

  // Resolve provider for validation (multimodal allowed for nim)
  let providerForValidation: "nim" | "mock" | undefined = provider;
  if (modelKey && typeof modelKey === "string") {
    const [prefix, rest] = modelKey.split(":");
    if (prefix === "nim" && rest) providerForValidation = "nim";
    else if (!providerForValidation) providerForValidation = "nim";
  }
  const allowMultimodal = providerForValidation === "nim";

  // Validate message content length (Zod handles structure, we check length limits)
  for (const msg of messages) {
    if (
      typeof msg.content === "string" &&
      msg.content.length > maxMessageLength
    ) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        `Message content exceeds maximum length of ${maxMessageLength} characters.`,
      );
      return;
    }
    // For multimodal, ensure provider supports it
    if (Array.isArray(msg.content) && !allowMultimodal) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        "Multimodal content requires a compatible provider (nim).",
      );
      return;
    }
  }

  // Suspicious-pattern check (prompt injection); when BLOCK_SUSPICIOUS_PROMPTS=true, block and return 400
  const suspiciousCheck = checkSuspiciousInMessages(
    messages as Array<{ role: string; content: unknown }>,
  );
  if (suspiciousCheck.block) {
    logger.warn(
      {
        patterns: suspiciousCheck.patterns,
        key: suspiciousCheck.key,
        preview: suspiciousCheck.preview,
      },
      "Suspicious prompt patterns detected; blocking (BLOCK_SUSPICIOUS_PROMPTS=true)",
    );
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      "Request blocked: suspicious prompt patterns detected",
      {
        field: suspiciousCheck.key,
      },
    );
    return;
  }

  logger.debug(
    { messageCount: messages.length, requestId: req.id, sessionType },
    "Chat stream request received",
  );

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Handle client disconnect
  let isClientConnected = true;

  req.on("close", () => {
    isClientConnected = false;
    logger.debug({ requestId: req.id, sessionType }, "Client disconnected");
  });

  req.on("error", (error) => {
    isClientConnected = false;
    logger.error({ error, requestId: req.id, sessionType }, "Client error");
  });

  // Create abort controller for cleanup
  const abortController = new AbortController();

  try {
    // Determine mode: prefer new 'mode' parameter, fall back to planMode for backward compatibility
    const chatMode = mode || (planMode ? "plan" : "normal");
    if (req.body.planMode !== undefined) {
      logger.warn(
        { requestId: req.id },
        'planMode is deprecated; use mode="plan" instead. Support removed in v2.0.',
      );
    }
    const profile =
      typeof agentProfile === "string" &&
      /^(router|frontend|backend|devops|test|general)$/.test(agentProfile)
        ? agentProfile
        : undefined;
    // Model: provider + modelId, or modelKey (e.g. nim:meta/llama-3.1-70b-instruct), or model router when none set
    let reqProvider: "nim" | "mock" | undefined = provider;
    let reqModelId: string | undefined = modelId;
    if (modelKey && typeof modelKey === "string") {
      const [prefix, rest] = modelKey.split(":");
      if (prefix === "nim" && rest) {
        reqProvider = "nim";
        reqModelId = rest;
      } else {
        reqModelId = modelKey;
        if (!reqProvider) reqProvider = "nim";
      }
    }
    // Quality vs speed preset: override provider/model when set
    if (modelPreset === "fast") {
      reqProvider = PRESET_FAST.provider;
      reqModelId = PRESET_FAST.modelId;
    } else if (modelPreset === "quality") {
      reqProvider = PRESET_QUALITY.provider;
      reqModelId = PRESET_QUALITY.modelId;
    }
    if (reqProvider == null || reqModelId == null) {
      let modelPreference:
        | { source?: "cloud" | "auto"; provider?: string; modelId?: string }
        | undefined;
      if (sessionType === "gAgent") {
        // Use request body preference (from frontend) if provided; else load from DB
        // Support both new gAgentModelPreference and deprecated freeAgentModelPreference
        const modelPref = reqGAgentModelPreference || reqModelPreference;
        if (modelPref && typeof modelPref === "object") {
          modelPreference = modelPref;
        } else {
          try {
            const userKey = getUserKey(req);
            const db = getDatabase();
            const settings = await db.getSettings(userKey);
            const prefs = settings?.preferences as
              | {
                  gAgentModelPreference?: {
                    source?: string;
                    provider?: string;
                    modelId?: string;
                  };
                  freeAgentModelPreference?: {
                    source?: string;
                    provider?: string;
                    modelId?: string;
                  };
                }
              | undefined;
            // Support both new and deprecated preference keys
            const pref =
              prefs?.gAgentModelPreference || prefs?.freeAgentModelPreference;
            const src = pref?.source;
            modelPreference =
              pref && (src === "cloud" || src === "auto")
                ? { ...pref, source: src }
                : undefined;
          } catch {
            // ignore
          }
        }
      }
      const messageChars = messages.reduce((sum, m) => {
        const c = m.content;
        if (typeof c === "string") return sum + c.length;
        if (Array.isArray(c))
          return (
            sum +
            (c as { text?: string }[]).reduce(
              (s, p) => s + (p?.text?.length ?? 0),
              0,
            )
          );
        return sum;
      }, 0);
      const hasImage = messages.some(
        (m) =>
          Array.isArray(m.content) &&
          (m.content as { type?: string }[]).some(
            (p) => p?.type === "image_url",
          ),
      );
      const routed = route({
        messageChars,
        messageCount: messages.length,
        mode: chatMode,
        toolsRequested: chatMode !== "plan",
        multimodal: hasImage,
        preferNim: preferNim === true,
        maxLatencyMs:
          typeof maxLatencyMs === "number" ? maxLatencyMs : undefined,
        sessionType,
        modelPreference,
      });
      reqProvider = routed.provider as "nim" | "mock";
      reqModelId = routed.modelId;
      recordLlmRouterSelection(routed.provider, routed.modelId);
    }

    const guardOpts =
      guardRailOptions &&
      typeof guardRailOptions === "object" &&
      Array.isArray(guardRailOptions.allowedDirs)
        ? { allowedDirs: guardRailOptions.allowedDirs as string[] }
        : undefined;

    const tierRaw = tier ?? (req.headers["x-tier"] as string);
    const tierOverride =
      typeof tierRaw === "string" &&
      ["free", "pro", "team", "enterprise"].includes(tierRaw.toLowerCase())
        ? (tierRaw.toLowerCase() as "free" | "pro" | "team" | "enterprise")
        : undefined;

    let gAgentCapabilities: string[] | undefined;
    let gAgentExternalAllowlist: string[] | undefined;
    try {
      const userKey = getUserKey(req);
      const db = getDatabase();
      const settings = await db.getSettings(userKey);
      if (sessionType === "gAgent") {
        const prefs = settings?.preferences;
        // Support both new gAgent* and deprecated freeAgent* preference keys
        gAgentCapabilities = (prefs?.gAgentCapabilities ??
          prefs?.freeAgentCapabilities) as string[] | undefined;
        gAgentExternalAllowlist =
          prefs?.gAgentExternalAllowlist ?? prefs?.freeAgentExternalAllowlist;
      }
      // Load MCP tools from user-configured servers (Pro+ tier)
      const mcpServers = settings?.mcp?.servers;
      if (mcpServers && Array.isArray(mcpServers) && mcpServers.length > 0) {
        const { loadAllMcpTools } = await import("../mcp/client.js");
        await loadAllMcpTools(
          mcpServers as import("../types/settings.js").McpServerConfig[],
        );
      }
    } catch (err) {
      logger.warn({ err, requestId: req.id }, "Failed to load settings");
    }

    // OTLP span attributes for G-Agent (Agent Lightning observability)
    if (sessionType === "gAgent") {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttribute("agent.g_agent", true);
        span.setAttribute("agent.mode", "agent");
        span.setAttribute("agent.model", `${reqProvider}:${reqModelId}`);
        if (gAgentCapabilities?.length) {
          span.setAttribute("agent.capabilities", gAgentCapabilities.join(","));
        }
      }
    }

    // Plan-only cache: when mode is plan and no provider/model override, try cache first
    if (
      chatMode === "plan" &&
      provider == null &&
      modelId == null &&
      modelKey == null
    ) {
      const cached = await getCachedChatResponse(chatMode, messages);
      if (cached?.text != null) {
        res.write(
          `data: ${JSON.stringify({ type: "from_cache", value: true })}\n\n`,
        );
        res.write(
          `data: ${JSON.stringify({ type: "text", text: cached.text })}\n\n`,
        );
        res.write('data: {"type":"done"}\n\n');
        res.end();
        logger.debug(
          { requestId: req.id },
          "Chat stream served from cache (plan mode)",
        );
        return;
      }
    }

    const stream = claudeServiceWithTools.generateChatStream(
      messages as Array<{ role: "user" | "assistant"; content: string }>,
      abortController.signal,
      typeof workspaceRoot === "string" && workspaceRoot.trim()
        ? workspaceRoot.trim()
        : undefined,
      chatMode,
      profile,
      planId,
      specSessionId,
      reqProvider,
      reqModelId,
      guardOpts,
      tierOverride,
      Boolean(autonomous),
      sessionType,
      gAgentCapabilities as
        | import("../types/settings.js").GAgentCapabilityKey[]
        | undefined,
      gAgentExternalAllowlist,
      Boolean(includeRagContext),
      Array.isArray(toolAllowlist) ? toolAllowlist : undefined,
      Array.isArray(toolDenylist) ? toolDenylist : undefined,
    );

    // Stream events to client; collect full text for plan-mode cache
    let collectedText = "";
    const batchMs = Number(process.env.STREAM_BATCH_MS ?? 50);
    const batchMax = Number(process.env.STREAM_BATCH_MAX ?? 10);
    const textBuffer = new StreamBuffer(
      (chunk) => {
        try {
          res.write(
            `data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`,
          );
        } catch (writeError) {
          logger.error(
            { error: writeError, requestId: req.id },
            "Failed to write buffered text",
          );
        }
      },
      { maxDelayMs: batchMs, maxBufferSize: batchMax },
    );

    for await (const event of stream) {
      if (!isClientConnected) {
        logger.debug(
          { requestId: req.id, sessionType },
          "Client disconnected, stopping stream",
        );
        break;
      }
      if (event.type === "text" && (event as { text?: string }).text) {
        const text = (event as { text: string }).text;
        if (chatMode === "plan") collectedText += text;
        textBuffer.push(text);
        continue;
      }

      // Flush buffered text before non-text events
      textBuffer.flush();

      // Send event to client
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (writeError) {
        logger.error(
          { error: writeError, requestId: req.id },
          "Failed to write to stream",
        );
        break;
      }
    }

    // Flush remaining text and send completion marker
    textBuffer.end();
    res.write('data: {"type":"done"}\n\n');
    res.end();

    // Cache plan-mode response for future identical requests
    if (chatMode === "plan" && collectedText) {
      setCachedChatResponse(chatMode, messages, collectedText).catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to cache plan response",
        );
      });
    }

    logger.debug(
      { requestId: req.id, sessionType },
      "Chat stream completed successfully",
    );
  } catch (error: unknown) {
    if (!isClientConnected) {
      return;
    }

    logger.error(
      { error, requestId: req.id, sessionType },
      "Chat stream error",
    );

    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: unknown;
    };
    const status = err.status ?? err.statusCode ?? 500;
    const errorType =
      status === 401
        ? "auth_error"
        : status === 429
          ? "rate_limit"
          : status >= 500
            ? "service_error"
            : "api_error";

    // Send structured SSE error event (production-safe message)
    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: getClientSSEErrorMessage(error),
          errorType,
          retryable: status >= 500 || status === 429,
          metadata: {
            status,
            code: err.code,
            requestId: req.id,
          },
        })}\n\n`,
      );
    } catch (writeError) {
      logger.error({ error: writeError }, "Failed to write error to stream");
    }

    res.end();
  } finally {
    // Cleanup
    abortController.abort();
  }
});

export default router;
