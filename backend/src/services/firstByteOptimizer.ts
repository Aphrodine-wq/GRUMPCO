/**
 * First Byte Optimization Service
 * Minimizes time-to-first-byte (TTFB) by sending headers immediately
 *
 * Features:
 * - Immediate header flush
 * - Streaming JSON (JSONL format)
 * - Progress indicators
 * - Early metadata delivery
 */

import type { Response } from 'express';
import logger from '../middleware/logger.js';

interface FirstByteConfig {
  sendProgress: boolean;
  metadata: Record<string, unknown>;
}

class FirstByteOptimizer {
  /**
   * Send headers immediately to establish connection
   */
  sendHeadersImmediately(res: Response, config: Partial<FirstByteConfig> = {}): void {
    const fullConfig: FirstByteConfig = {
      sendProgress: true,
      metadata: {},
      ...config,
    };

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.setHeader('Cache-Control', 'no-cache');

    // Send immediate TTFB optimization headers
    res.setHeader('X-TTFB-Optimization', 'enabled');
    res.setHeader('X-Response-Start', Date.now().toString());

    // Flush headers immediately
    res.flushHeaders();

    // Send initial metadata chunk
    if (fullConfig.sendProgress) {
      res.write(
        JSON.stringify({
          type: 'init',
          timestamp: Date.now(),
          metadata: fullConfig.metadata,
        }) + '\n'
      );
    }

    logger.debug('Headers flushed for TTFB optimization');
  }

  /**
   * Send progress update
   */
  sendProgress(res: Response, progress: number, message?: string): void {
    res.write(
      JSON.stringify({
        type: 'progress',
        progress: Math.min(100, Math.max(0, progress)),
        message,
        timestamp: Date.now(),
      }) + '\n'
    );
  }

  /**
   * Send data chunk
   */
  sendChunk(res: Response, data: unknown): void {
    res.write(
      JSON.stringify({
        type: 'data',
        data,
        timestamp: Date.now(),
      }) + '\n'
    );
  }

  /**
   * Send error
   */
  sendError(res: Response, error: string, code?: string): void {
    res.write(
      JSON.stringify({
        type: 'error',
        error,
        code,
        timestamp: Date.now(),
      }) + '\n'
    );
  }

  /**
   * Complete response
   */
  complete(res: Response, metadata?: Record<string, unknown>): void {
    res.write(
      JSON.stringify({
        type: 'complete',
        timestamp: Date.now(),
        metadata,
      }) + '\n'
    );

    res.end();
  }
}

// Singleton instance
export const firstByteOptimizer = new FirstByteOptimizer();
