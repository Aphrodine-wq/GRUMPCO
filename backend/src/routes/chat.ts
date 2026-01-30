/**
 * Chat API Routes with Tool Calling Support
 * Provides endpoint for tool-enabled chat streaming
 */

import { Router, Request, Response } from 'express';
import { claudeServiceWithTools } from '../services/claudeServiceWithTools.js';
import { route } from '../services/modelRouter.js';
import { getCachedChatResponse, setCachedChatResponse } from '../services/chatCache.js';
import { recordLlmRouterSelection } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';
import { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_LENGTH_LARGE, MAX_CHAT_MESSAGES_LARGE } from '../middleware/validator.js';

const router = Router();

/**
 * POST /chat/stream
 * Streaming chat endpoint with tool calling support
 *
 * Request body:
 * {
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>,
 *   workspaceRoot?: string,  // Directory for bash/file tools; paths are relative to this
 *   mode?: 'normal' | 'plan' | 'spec' | 'execute' | 'argument',  // Chat mode
 *   planMode?: boolean,     // Deprecated: use mode='plan'. If true, model outputs a plan only; no tools used
 *   planId?: string,         // For execute mode: plan ID to execute
 *   specSessionId?: string,  // For spec mode: spec session ID
 *   agentProfile?: string,  // 'general' | 'router' | 'frontend' | 'backend' | 'devops' | 'test'
 *   provider?: 'anthropic' | 'zhipu' | 'copilot' | 'openrouter' | 'nim',  // LLM provider
 *   modelId?: string,       // e.g. 'claude-sonnet-4-20250514', 'glm-4', 'anthropic/claude-3.5-sonnet'
 *   modelKey?: string,      // Alternative: single key (provider inferred from prefix, e.g. openrouter:...)
 *   guardRailOptions?: { allowedDirs?: string[] }  // Path policy allowlist; confirmEveryWrite is UX-only
 *   tier?: 'free' | 'pro' | 'team' | 'enterprise'  // For capability list and feature flags in prompt
 *   autonomous?: boolean  // Yolo mode: skip tool confirmations; backend emits { type: 'autonomous', value: true }
 *   preferNim?: boolean   // Prefer NVIDIA NIM (Kimi) when configured; bias to NIM for more request types
 *   maxLatencyMs?: number // Latency budget in ms; when set, NIM is preferred for latency-sensitive requests
 *   modelPreset?: 'fast' | 'quality' | 'balanced'  // Fast = NIM/Kimi, Quality = Claude, Balanced = router default
 * }
 */
const PRESET_FAST = { provider: 'nim' as const, modelId: 'moonshotai/kimi-k2.5' };
const PRESET_QUALITY = { provider: 'anthropic' as const, modelId: 'claude-sonnet-4-20250514' };

router.post('/stream', async (req: Request, res: Response) => {
  const { messages, workspaceRoot, mode, planMode, planId, specSessionId, agentProfile, provider, modelId, modelKey, guardRailOptions, tier, autonomous, largeContext, preferNim, maxLatencyMs, modelPreset } = req.body;

  // Validate request
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'messages array is required and must not be empty',
    });
  }

  const useLargeContext = Boolean(largeContext);
  const maxMessages = useLargeContext ? MAX_CHAT_MESSAGES_LARGE : MAX_CHAT_MESSAGES;
  const maxMessageLength = useLargeContext ? MAX_CHAT_MESSAGE_LENGTH_LARGE : MAX_CHAT_MESSAGE_LENGTH;

  if (messages.length > maxMessages) {
    return res.status(400).json({
      error: 'Invalid request',
      message: `Too many messages. Maximum ${maxMessages} messages per request.`,
      type: 'validation_error',
    });
  }

  // Resolve provider for validation (multimodal allowed only for nim)
  let providerForValidation: 'anthropic' | 'zhipu' | 'copilot' | 'openrouter' | 'nim' | undefined = provider;
  if (modelKey && typeof modelKey === 'string') {
    const [prefix, rest] = modelKey.split(':');
    if (prefix === 'nim' && rest) providerForValidation = 'nim';
    else if (prefix === 'openrouter' && rest) providerForValidation = 'openrouter';
    else if (!providerForValidation) providerForValidation = /^glm/i.test(modelKey) ? 'zhipu' : /^copilot/i.test(modelKey) ? 'copilot' : 'anthropic';
  }
  const allowMultimodal = providerForValidation === 'nim';

  // Validate message format and length
  for (const msg of messages) {
    if (!msg.role || msg.content == null) {
      return res.status(400).json({
        error: 'Invalid message format',
        message: 'Each message must have role and content',
        type: 'validation_error',
      });
    }
    if (allowMultimodal && Array.isArray(msg.content)) {
      let ok = true;
      for (const p of msg.content as { type?: string; text?: string; image_url?: { url?: string } }[]) {
        if (p?.type !== 'text' && p?.type !== 'image_url') {
          ok = false;
          break;
        }
        if (p.type === 'image_url' && !p.image_url?.url) ok = false;
      }
      if (!ok) {
        return res.status(400).json({
          error: 'Invalid message format',
          message: 'Multimodal content must be [{ type: "text", text }] or [{ type: "image_url", image_url: { url } }]',
          type: 'validation_error',
        });
      }
      continue;
    }
    const content = typeof msg.content === 'string' ? msg.content : String(msg.content);
    if (content.length > maxMessageLength) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Message content exceeds maximum length of ${maxMessageLength} characters.`,
        type: 'validation_error',
      });
    }
  }

  logger.debug(
    { messageCount: messages.length, requestId: req.id },
    'Chat stream request received'
  );

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Handle client disconnect
  let isClientConnected = true;

  req.on('close', () => {
    isClientConnected = false;
    logger.debug({ requestId: req.id }, 'Client disconnected');
  });

  req.on('error', (error) => {
    isClientConnected = false;
    logger.error({ error, requestId: req.id }, 'Client error');
  });

  // Create abort controller for cleanup
  const abortController = new AbortController();

  try {
    // Determine mode: prefer new 'mode' parameter, fall back to planMode for backward compatibility
    const chatMode = mode || (planMode ? 'plan' : 'normal');
    const profile = typeof agentProfile === 'string' && /^(router|frontend|backend|devops|test|general)$/.test(agentProfile)
      ? agentProfile
      : undefined;
    // Model: provider + modelId, or modelKey (e.g. glm-4 → zhipu, copilot-* → copilot, openrouter:* → openrouter, nim:* → nim), or model router when none set
    let reqProvider: 'anthropic' | 'zhipu' | 'copilot' | 'openrouter' | 'nim' | undefined = provider;
    let reqModelId: string | undefined = modelId;
    if (modelKey && typeof modelKey === 'string') {
      const [prefix, rest] = modelKey.split(':');
      if (prefix === 'openrouter' && rest) {
        reqProvider = 'openrouter';
        reqModelId = rest;
      } else if (prefix === 'nim' && rest) {
        reqProvider = 'nim';
        reqModelId = rest;
      } else {
        reqModelId = modelKey;
        if (!reqProvider) reqProvider = /^glm/i.test(modelKey) ? 'zhipu' : /^copilot/i.test(modelKey) ? 'copilot' : 'anthropic';
      }
    }
    // Quality vs speed preset: override provider/model when set
    if (modelPreset === 'fast') {
      reqProvider = PRESET_FAST.provider;
      reqModelId = PRESET_FAST.modelId;
    } else if (modelPreset === 'quality') {
      reqProvider = PRESET_QUALITY.provider;
      reqModelId = PRESET_QUALITY.modelId;
    }
    if (reqProvider == null || reqModelId == null) {
      const messageChars = messages.reduce((sum, m) => {
        const c = m.content;
        if (typeof c === 'string') return sum + c.length;
        if (Array.isArray(c)) return sum + (c as { text?: string }[]).reduce((s, p) => s + (p?.text?.length ?? 0), 0);
        return sum;
      }, 0);
      const hasImage = messages.some((m) => Array.isArray(m.content) && (m.content as { type?: string }[]).some((p) => p?.type === 'image_url'));
      const routed = route({
        messageChars,
        messageCount: messages.length,
        mode: chatMode,
        toolsRequested: chatMode !== 'plan',
        multimodal: hasImage,
        preferNim: preferNim === true,
        maxLatencyMs: typeof maxLatencyMs === 'number' ? maxLatencyMs : undefined,
      });
      reqProvider = routed.provider;
      reqModelId = routed.modelId;
      recordLlmRouterSelection(routed.provider, routed.modelId);
    }
    const guardOpts =
      guardRailOptions && typeof guardRailOptions === 'object' && Array.isArray(guardRailOptions.allowedDirs)
        ? { allowedDirs: guardRailOptions.allowedDirs as string[] }
        : undefined;

    const tierRaw = tier ?? (req.headers['x-tier'] as string);
    const tierOverride =
      typeof tierRaw === 'string' && ['free', 'pro', 'team', 'enterprise'].includes(tierRaw.toLowerCase())
        ? tierRaw.toLowerCase() as 'free' | 'pro' | 'team' | 'enterprise'
        : undefined;

    // Plan-only cache: when mode is plan and no provider/model override, try cache first
    if (chatMode === 'plan' && provider == null && modelId == null && modelKey == null) {
      const cached = await getCachedChatResponse(chatMode, messages);
      if (cached?.text != null) {
        res.write(`data: ${JSON.stringify({ type: 'from_cache', value: true })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'text', text: cached.text })}\n\n`);
        res.write('data: {"type":"done"}\n\n');
        res.end();
        logger.debug({ requestId: req.id }, 'Chat stream served from cache (plan mode)');
        return;
      }
    }

    const stream = claudeServiceWithTools.generateChatStream(
      messages,
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
      Boolean(autonomous)
    );

      // Stream events to client; collect full text for plan-mode cache
      let collectedText = '';
      for await (const event of stream) {
        if (!isClientConnected) {
          logger.debug({ requestId: req.id }, 'Client disconnected, stopping stream');
          break;
        }
        if (chatMode === 'plan' && event.type === 'text' && (event as { text?: string }).text) {
          collectedText += (event as { text: string }).text;
        }
        // Send event to client
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (writeError) {
          logger.error({ error: writeError, requestId: req.id }, 'Failed to write to stream');
          break;
        }
      }

    // Send completion marker
    res.write('data: {"type":"done"}\n\n');
    res.end();

    // Cache plan-mode response for future identical requests
    if (chatMode === 'plan' && collectedText) {
      setCachedChatResponse(chatMode, messages, collectedText).catch((err) => {
        logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to cache plan response');
      });
    }

    logger.debug({ requestId: req.id }, 'Chat stream completed successfully');
  } catch (error: unknown) {
    if (!isClientConnected) {
      return;
    }

    logger.error({ error, requestId: req.id }, 'Chat stream error');

    const err = error as { status?: number; statusCode?: number; message?: string };
    const status = err.status ?? err.statusCode ?? 500;
    const errorType = status === 401 ? 'auth_error' : 
                     status === 429 ? 'rate_limit' :
                     status >= 500 ? 'service_error' : 'api_error';
    
    // Send structured error event
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: err.message ?? (error instanceof Error ? error.message : 'An error occurred'),
          errorType,
          retryable: status >= 500 || status === 429,
          metadata: {
            status,
            code: (error as { code?: unknown }).code,
            requestId: req.id,
          },
        })}\n\n`
      );
    } catch (writeError) {
      logger.error({ error: writeError }, 'Failed to write error to stream');
    }

    res.end();
  } finally {
    // Cleanup
    abortController.abort();
  }
});

export default router;
