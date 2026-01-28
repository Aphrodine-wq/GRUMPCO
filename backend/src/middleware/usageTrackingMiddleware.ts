/**
 * Usage Tracking Middleware
 * Automatically records API usage for all requests
 */

import { Request, Response, NextFunction } from 'express';
import logger from './logger.js';
import { recordApiCall } from '../services/usageTracker.js';

// Track which endpoints to skip (health checks, metrics, etc.)
const SKIP_TRACKING = ['/health', '/metrics', '/api/health'];

// Extend Express Request type to track response data
interface TrackingRequest extends Request {
  startTime?: number;
  userId?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  model?: string;
}

/**
 * Middleware to track API usage for billing and analytics
 * Must be placed after apiAuthMiddleware to have access to userId
 */
export function usageTrackingMiddleware(req: TrackingRequest, res: Response, next: NextFunction) {
  // Skip tracking for certain endpoints
  if (SKIP_TRACKING.some((skip) => req.path.startsWith(skip))) {
    return next();
  }

  // Record start time
  req.startTime = Date.now();

  // Try to extract user ID from request
  req.userId = (req as any).user?.id || (req as any).userId || 'anonymous';

  // Intercept response to capture status and data
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody: any = null;

  res.json = function (data: any) {
    responseBody = data;
    return originalJson(data);
  };

  res.send = function (data: any) {
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

      if (responseBody?.usage) {
        estimatedInputTokens = responseBody.usage.input_tokens;
        estimatedOutputTokens = responseBody.usage.output_tokens;
      }

      // Record the API call
      await recordApiCall({
        userId: req.userId,
        endpoint: req.path,
        method: req.method,
        model: req.model,
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
 */
export function setTokenInfo(
  req: TrackingRequest,
  inputTokens: number,
  outputTokens: number,
  model?: string
) {
  req.estimatedInputTokens = inputTokens;
  req.estimatedOutputTokens = outputTokens;
  if (model) {
    req.model = model;
  }
}
