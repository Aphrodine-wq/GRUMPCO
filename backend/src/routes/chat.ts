/**
 * Chat API Routes with Tool Calling Support
 *
 * Provides streaming chat endpoint with tool calling capabilities.
 * Supports multiple LLM providers (NIM, OpenRouter, Anthropic, Ollama).
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

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import { claudeServiceWithTools } from '../services/ai-providers/claudeServiceWithTools.js';
import { route } from '../services/ai-providers/modelRouter.js';
import { getCachedChatResponse, setCachedChatResponse } from '../services/caching/chatCache.js';
import { recordLlmRouterSelection, recordChatRequest } from '../middleware/metrics.js';
import { trace } from '@opentelemetry/api';
import logger from '../middleware/logger.js';
import { sendErrorResponse, ErrorCode, getClientSSEErrorMessage } from '../utils/errorResponse.js';
import { StreamBuffer } from '../services/infra/streamBuffer.js';
import { chatStreamRequestSchema, type ChatStreamRequest } from './chatSchemas.js';
import designWorkflowRouter from './chatDesignWorkflow.js';

/**
 * Extract user identifier from request headers or query params.
 * Falls back to 'default' if not provided.
 *
 * @param req - Express request object
 * @returns User key string
 */
function getUserKey(req: Request): string {
  const header = req.headers['x-user-id'];
  const query = req.query.user;
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof query === 'string' && query.trim()) return query.trim();
  return 'default';
}

import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH_LARGE,
  MAX_CHAT_MESSAGES_LARGE,
  checkSuspiciousInMessages,
} from '../middleware/validator.js';

const router = Router();

// Mount design workflow sub-router
router.use('/design', designWorkflowRouter);

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
// Model presets: optimized for speed vs quality tradeoff
const PRESET_FAST = {
  provider: 'nim' as const,
  modelId: 'moonshotai/kimi-k2.5', // Fastest NIM model — optimized for quick responses
};
const PRESET_QUALITY = {
  provider: 'nim' as const,
  modelId: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
};
const PRESET_BALANCED = {
  provider: 'nim' as const,
  modelId: 'moonshotai/kimi-k2.5',
};

router.post('/stream', async (req: Request, res: Response): Promise<void> => {
  // Validate request body with Zod
  const parseResult = chatStreamRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      firstError?.message ?? 'Invalid request body',
      {
        field: firstError?.path?.join('.'),
      }
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
    freeAgentModelPreference: reqModelPreference, // legacy field
    gAgentModelPreference: reqGAgentModelPreference,
    includeRagContext,
    toolAllowlist,
    toolDenylist,
    memoryContext,
  } = body;

  // Support both 'gAgent' (new) and 'freeAgent' (deprecated) session types
  const sessionType =
    sessionTypeRaw === 'gAgent' || sessionTypeRaw === 'freeAgent' ? 'gAgent' : 'chat';
  recordChatRequest(sessionType);

  // Additional validation: message count and length limits
  const useLargeContext = Boolean(largeContext);
  const maxMessages = useLargeContext ? MAX_CHAT_MESSAGES_LARGE : MAX_CHAT_MESSAGES;
  const maxMessageLength = useLargeContext
    ? MAX_CHAT_MESSAGE_LENGTH_LARGE
    : MAX_CHAT_MESSAGE_LENGTH;

  if (messages.length > maxMessages) {
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      `Too many messages. Maximum ${maxMessages} messages per request.`
    );
    return;
  }

  // Resolve provider for validation (multimodal allowed for nim)
  let providerForValidation: string | undefined = provider;
  if (modelKey && typeof modelKey === 'string') {
    const [prefix, rest] = modelKey.split(':');
    if (prefix === 'nim' && rest) providerForValidation = 'nim';
    else if (!providerForValidation) providerForValidation = 'nim';
  }
  const allowMultimodal = providerForValidation === 'nim';

  // Validate message content length (Zod handles structure, we check length limits)
  for (const msg of messages) {
    if (typeof msg.content === 'string' && msg.content.length > maxMessageLength) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        `Message content exceeds maximum length of ${maxMessageLength} characters.`
      );
      return;
    }
    // For multimodal, ensure provider supports it
    if (Array.isArray(msg.content) && !allowMultimodal) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Multimodal content requires a compatible provider (nim).'
      );
      return;
    }
  }

  // Suspicious-pattern check (prompt injection); when BLOCK_SUSPICIOUS_PROMPTS=true, block and return 400
  const suspiciousCheck = checkSuspiciousInMessages(
    messages as Array<{ role: string; content: unknown }>
  );
  if (suspiciousCheck.block) {
    logger.warn(
      {
        patterns: suspiciousCheck.patterns,
        key: suspiciousCheck.key,
        preview: suspiciousCheck.preview,
      },
      'Suspicious prompt patterns detected; blocking (BLOCK_SUSPICIOUS_PROMPTS=true)'
    );
    sendErrorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      'Request blocked: suspicious prompt patterns detected',
      {
        field: suspiciousCheck.key,
      }
    );
    return;
  }

  logger.debug(
    { messageCount: messages.length, requestId: req.requestId, sessionType },
    'Chat stream request received'
  );

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders(); // Push headers immediately — reduces TTFB by ~50-100ms

  // Handle client disconnect
  let isClientConnected = true;

  req.on('close', () => {
    isClientConnected = false;
    logger.debug({ requestId: req.requestId, sessionType }, 'Client disconnected');
  });

  req.on('error', (error) => {
    isClientConnected = false;
    logger.error({ error, requestId: req.requestId, sessionType }, 'Client error');
  });

  // Create abort controller for cleanup
  const abortController = new AbortController();

  try {
    // Determine mode: prefer new 'mode' parameter, fall back to planMode for backward compatibility
    // Map frontend-only modes to backend stream modes
    const rawMode = mode || (planMode ? 'plan' : 'normal');
    const chatMode =
      rawMode === 'ship' || rawMode === 'argument'
        ? ('normal' as const)
        : (rawMode as 'normal' | 'plan' | 'spec' | 'execute' | 'design' | 'code');
    if (req.body.planMode !== undefined) {
      logger.warn(
        { requestId: req.requestId },
        'planMode is deprecated; use mode="plan" instead. Support removed in v2.0.'
      );
    }
    const profile =
      typeof agentProfile === 'string' &&
      /^(router|frontend|backend|devops|test|general)$/.test(agentProfile)
        ? agentProfile
        : undefined;
    // Model: provider + modelId, or modelKey (e.g. nim:meta/llama-3.1-70b-instruct), or model router when none set
    let reqProvider: import('../services/ai-providers/llmGateway.js').LLMProvider | undefined =
      provider as import('../services/ai-providers/llmGateway.js').LLMProvider | undefined;
    let reqModelId: string | undefined = modelId;
    if (modelKey && typeof modelKey === 'string') {
      const colonIdx = modelKey.indexOf(':');
      if (colonIdx > 0) {
        const prefix = modelKey.slice(0, colonIdx);
        const rest = modelKey.slice(colonIdx + 1);
        const VALID_PROVIDERS = new Set([
          'nim',
          'openrouter',
          'ollama',
          'anthropic',
          'grump',
          'mock',
        ]);
        if (VALID_PROVIDERS.has(prefix) && rest) {
          reqProvider = prefix as import('../services/ai-providers/llmGateway.js').LLMProvider;
          reqModelId = rest;
        } else {
          reqModelId = modelKey;
          if (!reqProvider) reqProvider = 'nim';
        }
      } else {
        reqModelId = modelKey;
        if (!reqProvider) reqProvider = 'nim';
      }
    }
    // Quality vs speed preset: override provider/model when set
    if (modelPreset === 'fast') {
      reqProvider = PRESET_FAST.provider;
      reqModelId = PRESET_FAST.modelId;
    } else if (modelPreset === 'quality') {
      reqProvider = PRESET_QUALITY.provider;
      reqModelId = PRESET_QUALITY.modelId;
    } else if (modelPreset === 'balanced') {
      reqProvider = PRESET_BALANCED.provider;
      reqModelId = PRESET_BALANCED.modelId;
    }

    const guardOpts =
      guardRailOptions &&
      typeof guardRailOptions === 'object' &&
      Array.isArray(guardRailOptions.allowedDirs)
        ? { allowedDirs: guardRailOptions.allowedDirs as string[] }
        : undefined;

    const tierRaw = tier ?? (req.headers['x-tier'] as string);
    const tierOverride =
      typeof tierRaw === 'string' &&
      ['free', 'pro', 'team', 'enterprise'].includes(tierRaw.toLowerCase())
        ? (tierRaw.toLowerCase() as 'free' | 'pro' | 'team' | 'enterprise')
        : undefined;

    // Load settings ONCE and extract everything we need
    let gAgentCapabilities: string[] | undefined;
    let gAgentExternalAllowlist: string[] | undefined;
    let modelPreference:
      | { source?: 'cloud' | 'auto'; provider?: string; modelId?: string }
      | undefined;

    try {
      const userKey = getUserKey(req);
      const db = getDatabase();
      const settings = await db.getSettings(userKey);
      const prefs = settings?.preferences as
        | {
            gAgentCapabilities?: string[];
            gAgentExternalAllowlist?: string[];
            gAgentModelPreference?: { source?: string; provider?: string; modelId?: string };
          }
        | undefined;

      if (sessionType === 'gAgent') {
        gAgentCapabilities = prefs?.gAgentCapabilities as string[] | undefined;
        gAgentExternalAllowlist = prefs?.gAgentExternalAllowlist;
      }

      // Extract model preference (do this once, use for routing)
      if (!reqGAgentModelPreference && !reqModelPreference) {
        const pref = prefs?.gAgentModelPreference;
        const src = pref?.source;
        if (pref && (src === 'cloud' || src === 'auto')) {
          modelPreference = { ...pref, source: src };
        }
      } else {
        modelPreference = reqGAgentModelPreference || reqModelPreference;
      }

      // Load MCP tools from user-configured servers (Pro+ tier) — fire-and-forget only
      const mcpServers = settings?.mcp?.servers;
      if (mcpServers && Array.isArray(mcpServers) && mcpServers.length > 0) {
        import('../mcp/client.js')
          .then(({ loadAllMcpTools }) => {
            loadAllMcpTools(mcpServers as import('../types/settings.js').McpServerConfig[]).catch(
              (e: unknown) =>
                logger.debug({ error: (e as Error).message }, 'MCP tool load failed (non-blocking)')
            );
          })
          .catch(() => {
            /* ignore */
          });
      }
    } catch (err) {
      logger.warn({ err, requestId: req.requestId }, 'Failed to load settings');
    }

    // Route model if not provided
    if (reqProvider == null || reqModelId == null) {
      const messageChars = messages.reduce((sum, m) => {
        const c = m.content;
        if (typeof c === 'string') return sum + c.length;
        if (Array.isArray(c))
          return sum + (c as { text?: string }[]).reduce((s, p) => s + (p?.text?.length ?? 0), 0);
        return sum;
      }, 0);
      const hasImage = messages.some(
        (m) =>
          Array.isArray(m.content) &&
          (m.content as { type?: string }[]).some((p) => p?.type === 'image_url')
      );
      const routed = route({
        messageChars,
        messageCount: messages.length,
        mode: chatMode,
        toolsRequested: chatMode !== 'plan',
        multimodal: hasImage,
        preferNim: preferNim === true,
        maxLatencyMs: typeof maxLatencyMs === 'number' ? maxLatencyMs : undefined,
        sessionType,
        modelPreference,
      });
      reqProvider = routed.provider as import('../services/ai-providers/llmGateway.js').LLMProvider;
      reqModelId = routed.modelId;

      // SPEED OPTIMIZATION: Auto-upgrade from slow local Ollama to NIM cloud for code mode
      // Local Ollama is too slow for code generation — use cloud inference instead
      if (chatMode === 'code' && reqProvider === 'ollama') {
        const prevProvider = reqProvider;
        reqProvider = 'nim';
        reqModelId = 'moonshotai/kimi-k2.5';
        logger.info(
          { from: prevProvider, to: reqProvider, model: reqModelId, mode: chatMode },
          'Auto-upgraded code mode from local Ollama to NIM cloud for speed'
        );
      }

      recordLlmRouterSelection(routed.provider, routed.modelId);
    }

    // OTLP span attributes for G-Agent (Agent Lightning observability)
    if (sessionType === 'gAgent') {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttribute('agent.g_agent', true);
        span.setAttribute('agent.mode', 'agent');
        span.setAttribute('agent.model', `${reqProvider}:${reqModelId}`);
        if (gAgentCapabilities?.length) {
          span.setAttribute('agent.capabilities', gAgentCapabilities.join(','));
        }
      }
    }

    // SPEED OPTIMIZATION: Cache lookup for plan AND normal mode (identical recent queries)
    // Normal mode uses a shorter TTL (2 min) while plan mode uses 10 min
    const cacheableMode = chatMode === 'plan' || chatMode === 'normal';
    if (cacheableMode && provider == null && modelId == null && modelKey == null) {
      const cached = await getCachedChatResponse(chatMode, messages);
      if (cached?.text != null) {
        res.write(`data: ${JSON.stringify({ type: 'from_cache', value: true })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'text', text: cached.text })}\n\n`);
        res.write('data: {"type":"done"}\n\n');
        res.end();
        logger.debug({ requestId: req.requestId, mode: chatMode }, 'Chat stream served from cache');
        return;
      }
    }

    const userId = getUserKey(req);
    const stream = claudeServiceWithTools.generateChatStream(
      messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      abortController.signal,
      typeof workspaceRoot === 'string' && workspaceRoot.trim() ? workspaceRoot.trim() : undefined,
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
      gAgentCapabilities as import('../types/settings.js').GAgentCapabilityKey[] | undefined,
      gAgentExternalAllowlist,
      Boolean(includeRagContext),
      Array.isArray(toolAllowlist) ? toolAllowlist : undefined,
      Array.isArray(toolDenylist) ? toolDenylist : undefined,
      userId
    );

    // Stream events to client; collect full text for plan-mode cache
    let collectedText = '';
    // Use minimal buffering for real-time streaming (2ms delay, 2 chunks max) - OPTIMIZED for instant response
    const batchMs = Number(process.env.STREAM_BATCH_MS ?? 2);
    const batchMax = Number(process.env.STREAM_BATCH_MAX ?? 2);
    const textBuffer = new StreamBuffer(
      (chunk) => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
        } catch (writeError) {
          logger.error(
            { error: writeError, requestId: req.requestId },
            'Failed to write buffered text'
          );
        }
      },
      { maxDelayMs: batchMs, maxBufferSize: batchMax }
    );

    // ── HANG-PROOF: SSE Keepalive ──────────────────────────────────────
    // Send heartbeat comments every 15s to prevent proxy/CDN/firewall
    // from killing idle SSE connections during long tool executions.
    const KEEPALIVE_MS = 15_000;
    const keepaliveInterval = setInterval(() => {
      if (isClientConnected && !res.writableEnded) {
        try {
          res.write(': keepalive\n\n');
        } catch {
          // Client disconnected — cleanup will happen in req.on('close')
        }
      }
    }, KEEPALIVE_MS);

    // ── HANG-PROOF: Stream Idle Watchdog ────────────────────────────────
    // If no event arrives from generateChatStream within the timeout,
    // assume it's stalled and abort with a retryable error.
    // For Ollama (local models), use a massive timeout since model loading
    // can take minutes and inference is hardware-dependent.
    const isOllamaProvider = reqProvider === 'ollama';
    const STREAM_IDLE_TIMEOUT_MS = isOllamaProvider
      ? Number(process.env.STREAM_IDLE_TIMEOUT_OLLAMA_MS ?? 86_400_000) // 24 hours for Ollama — effectively never
      : Number(process.env.STREAM_IDLE_TIMEOUT_MS ?? 60_000); // 60s for cloud providers
    let streamIdleTimer: ReturnType<typeof setTimeout> | null = null;
    let streamTimedOut = false;

    const resetIdleTimer = () => {
      if (streamIdleTimer) clearTimeout(streamIdleTimer);
      streamIdleTimer = setTimeout(() => {
        streamTimedOut = true;
        abortController.abort();
        logger.warn(
          {
            requestId: req.requestId,
            timeoutMs: STREAM_IDLE_TIMEOUT_MS,
            sessionType,
            provider: reqProvider,
          },
          'Stream idle watchdog triggered — aborting stalled stream'
        );
      }, STREAM_IDLE_TIMEOUT_MS);
    };
    resetIdleTimer(); // Start watchdog

    try {
      for await (const event of stream) {
        resetIdleTimer(); // Reset watchdog on every event
        if (!isClientConnected) {
          logger.debug(
            { requestId: req.requestId, sessionType },
            'Client disconnected, stopping stream'
          );
          break;
        }
        if (event.type === 'text' && (event as { text?: string }).text) {
          const text = (event as { text: string }).text;
          if (cacheableMode) collectedText += text;
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
            { error: writeError, requestId: req.requestId },
            'Failed to write to stream'
          );
          break;
        }
      }
    } finally {
      // Cleanup keepalive and watchdog timers
      clearInterval(keepaliveInterval);
      if (streamIdleTimer) clearTimeout(streamIdleTimer);
    }

    // If the watchdog triggered, send a retryable timeout error
    if (streamTimedOut) {
      textBuffer.end();
      try {
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              message: 'Stream timed out — the model stopped responding. Please try again.',
              errorType: 'timeout',
              retryable: true,
              metadata: { requestId: req.requestId, timeoutMs: STREAM_IDLE_TIMEOUT_MS },
            })}\n\n`
          );
          res.end();
        }
      } catch {
        /* client disconnected */
      }
    } else {
      // Flush remaining text and send completion marker
      textBuffer.end();
      try {
        if (!res.writableEnded) {
          res.write('data: {"type":"done"}\n\n');
          res.end();
        }
      } catch (endError) {
        logger.debug(
          { error: endError, requestId: req.requestId },
          'Failed to write done/end to stream (client likely disconnected)'
        );
      }
    }

    // SPEED OPTIMIZATION: Cache responses for plan AND normal mode
    // Avoids re-calling LLM for identical recent queries
    if (cacheableMode && collectedText) {
      setCachedChatResponse(chatMode, messages, collectedText).catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          'Failed to cache chat response'
        );
      });
    }

    logger.debug({ requestId: req.requestId, sessionType }, 'Chat stream completed successfully');
  } catch (error: unknown) {
    if (!isClientConnected) {
      return;
    }

    logger.error({ error, requestId: req.requestId, sessionType }, 'Chat stream error');

    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: unknown;
    };
    const status = err.status ?? err.statusCode ?? 500;
    const errorType =
      status === 401
        ? 'auth_error'
        : status === 429
          ? 'rate_limit'
          : status >= 500
            ? 'service_error'
            : 'api_error';

    // Send structured SSE error event (production-safe message)
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: getClientSSEErrorMessage(error),
          errorType,
          retryable: status >= 500 || status === 429,
          metadata: {
            status,
            code: err.code,
            requestId: req.requestId,
          },
        })}\n\n`
      );
    } catch (writeError) {
      logger.error({ error: writeError }, 'Failed to write error to stream');
    }

    try {
      if (!res.writableEnded) {
        res.end();
      }
    } catch {
      // Socket already destroyed; nothing to do
    }
  } finally {
    // Cleanup
    abortController.abort();
  }
});

export default router;
