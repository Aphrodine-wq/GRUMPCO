/**
 * Usage Tracking Middleware
 * Automatically records API usage for all requests
 *
 * NOTE: Local AI models (Ollama, etc.) are automatically excluded from
 * billing/credit tracking via isLocalModel check in usageTracker.
 */

import { type Request, type Response, type NextFunction } from 'express';
import logger from './logger.js';
import { recordApiCall } from '../services/platform/usageTracker.js';

// Track which endpoints to skip (health checks, metrics, etc.)
const SKIP_TRACKING = ['/health', '/metrics', '/api/health'];

// Extend Express Request type to track response data (user/userId from auth middleware)
interface AuthRequest extends Request {
  user?: { id?: string };
  userId?: string;
}
interface TrackingRequest extends Request {
  startTime?: number;
  userId?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  model?: string;
  provider?: string;
}

/**
 * Middleware to track API usage for billing and analytics
 * Must be placed after apiAuthMiddleware to have access to userId
 *
 * Local AI models (Ollama, local LLMs) are automatically excluded from
 * credit tracking via the isLocalModel check in usageTracker.
 */
export function usageTrackingMiddleware(req: TrackingRequest, res: Response, next: NextFunction) {
  // Skip tracking for certain endpoints
  if (SKIP_TRACKING.some((skip) => req.path.startsWith(skip))) {
    return next();
  }

  // Record start time
  req.startTime = Date.now();

  // Try to extract user ID from request
  const authReq = req as AuthRequest;
  req.userId = authReq.user?.id ?? authReq.userId ?? 'anonymous';

  // Intercept response to capture status and data
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody: unknown = null;

  res.json = function (data: unknown) {
    responseBody = data;
    return originalJson(data);
  };

  res.send = function (data: string | object) {
    if (typeof data === 'string') {
      try {
        responseBody = JSON.parse(data);
      } catch {
        responseBody = { raw: data };
      }
    } else {
      responseBody = data;
    }
    return originalSend(data);
  };

  // Hook into response finish event to record usage
  res.on('finish', async () => {
    const latencyMs = Date.now() - (req.startTime || Date.now());
    const success = res.statusCode >= 200 && res.statusCode < 400;

    try {
      // Extract tokens from response if available (Claude API responses)
      let estimatedInputTokens = req.estimatedInputTokens;
      let estimatedOutputTokens = req.estimatedOutputTokens;

      const usage =
        responseBody && typeof responseBody === 'object' && 'usage' in responseBody
          ? (
              responseBody as {
                usage?: { input_tokens?: number; output_tokens?: number };
              }
            ).usage
          : undefined;
      if (usage) {
        estimatedInputTokens = usage.input_tokens;
        estimatedOutputTokens = usage.output_tokens;
      }

      // Record the API call (local models are auto-excluded in recordApiCall)
      await recordApiCall({
        userId: req.userId ?? 'anonymous',
        endpoint: req.path,
        method: req.method ?? 'GET',
        model: req.model,
        provider: req.provider,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        latencyMs,
        success,
      });
    } catch (error) {
      // Fail silently - tracking errors shouldn't affect the response
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: req.userId,
          endpoint: req.path,
        },
        'Failed to record API usage'
      );
    }
  });

  next();
}

/**
 * Helper to set token information on request for later tracking
 * Call this in route handlers that have token information
 *
 * @param req - The tracking request
 * @param inputTokens - Number of input tokens used
 * @param outputTokens - Number of output tokens generated
 * @param model - Optional model identifier
 * @param provider - Optional provider (e.g. "ollama", "nim", "anthropic")
 */
export function setTokenInfo(
  req: TrackingRequest,
  inputTokens: number,
  outputTokens: number,
  model?: string,
  provider?: string
) {
  req.estimatedInputTokens = inputTokens;
  req.estimatedOutputTokens = outputTokens;
  if (model) {
    req.model = model;
  }
  if (provider) {
    req.provider = provider;
  }
}
