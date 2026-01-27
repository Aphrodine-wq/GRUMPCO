/**
 * Chat API Routes with Tool Calling Support
 * Provides endpoint for tool-enabled chat streaming
 */

import { Router, Request, Response } from 'express';
import { claudeServiceWithTools } from '../services/claudeServiceWithTools.js';
import { logger } from '../utils/logger.js';

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
 *   agentProfile?: string   // 'general' | 'router' | 'frontend' | 'backend' | 'devops' | 'test'
 * }
 */
router.post('/stream', async (req: Request, res: Response) => {
  const { messages, workspaceRoot, mode, planMode, planId, specSessionId, agentProfile } = req.body;

  // Validate request
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'messages array is required and must not be empty',
    });
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return res.status(400).json({
        error: 'Invalid message format',
        message: 'Each message must have role and content',
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
    const stream = claudeServiceWithTools.generateChatStream(
      messages,
      abortController.signal,
      typeof workspaceRoot === 'string' && workspaceRoot.trim() ? workspaceRoot.trim() : undefined,
      chatMode,
      profile,
      planId,
      specSessionId
    );

      // Stream events to client
      for await (const event of stream) {
        if (!isClientConnected) {
          logger.debug({ requestId: req.id }, 'Client disconnected, stopping stream');
          break;
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

    logger.debug({ requestId: req.id }, 'Chat stream completed successfully');
  } catch (error: any) {
    if (!isClientConnected) {
      return;
    }

    logger.error({ error, requestId: req.id }, 'Chat stream error');

    // Enhanced error handling
    const status = error.status || error.statusCode || 500;
    const errorType = status === 401 ? 'auth_error' : 
                     status === 429 ? 'rate_limit' :
                     status >= 500 ? 'service_error' : 'api_error';
    
    // Send structured error event
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'An error occurred',
          errorType,
          retryable: status >= 500 || status === 429,
          metadata: {
            status,
            code: error.code,
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
