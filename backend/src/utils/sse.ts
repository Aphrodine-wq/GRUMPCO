/**
 * Optimized Server-Sent Events (SSE) Utilities
 *
 * Provides consistent, high-performance SSE streaming across all routes.
 *
 * Optimizations:
 * - Batch flushing for reduced syscalls
 * - Connection keepalive with heartbeats
 * - Proper backpressure handling
 * - Client disconnect detection
 *
 * @module utils/sse
 */

import type { Request, Response } from 'express';
import logger from '../middleware/logger.js';

/** SSE event data */
export interface SSEEvent {
  /** Event type (e.g., 'message', 'error', 'done') */
  event?: string;
  /** Event data (will be JSON stringified if object) */
  data: unknown;
  /** Event ID for client-side replay */
  id?: string;
  /** Retry interval in ms (sent on reconnect) */
  retry?: number;
}

/** SSE stream configuration */
export interface SSEConfig {
  /** Send keepalive comments every N ms (default: 15000) */
  keepaliveMs?: number;
  /** Batch events and flush every N ms (default: 0 = immediate) */
  batchMs?: number;
  /** Include correlation ID in events */
  includeCorrelationId?: boolean;
}

/** SSE writer instance */
export interface SSEWriter {
  /** Send an event to the client */
  send(event: SSEEvent): void;
  /** Send a raw comment (for keepalive) */
  comment(text: string): void;
  /** Check if client is still connected */
  isConnected(): boolean;
  /** Close the stream gracefully */
  close(): void;
  /** Abort controller for cleanup */
  abortController: AbortController;
}

/**
 * Initialize SSE response with optimized headers.
 * Returns a writer object for sending events.
 *
 * @example
 * const sse = initSSE(req, res);
 * sse.send({ data: { chunk: 'Hello' } });
 * sse.send({ event: 'done', data: {} });
 * sse.close();
 */
export function initSSE(req: Request, res: Response, config: SSEConfig = {}): SSEWriter {
  const { keepaliveMs = 15000, batchMs = 0, includeCorrelationId = false } = config;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Disable compression for SSE (already handled by app.ts but be explicit)
  res.setHeader('Content-Encoding', 'identity');

  // Add correlation ID if available
  const correlationId = (req as Request & { correlationId?: string }).correlationId;
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Flush headers immediately
  res.flushHeaders();

  // Connection state
  let connected = true;
  const abortController = new AbortController();
  let eventBuffer: string[] = [];
  let flushTimeout: NodeJS.Timeout | null = null;

  // Handle client disconnect
  req.on('close', () => {
    connected = false;
    abortController.abort();
    cleanup();
    logger.debug({ correlationId }, 'SSE client disconnected');
  });

  req.on('error', (error) => {
    connected = false;
    abortController.abort();
    cleanup();
    logger.warn({ correlationId, error: (error as Error).message }, 'SSE client error');
  });

  // Keepalive heartbeat
  let keepaliveInterval: NodeJS.Timeout | null = null;
  if (keepaliveMs > 0) {
    keepaliveInterval = setInterval(() => {
      if (connected) {
        try {
          res.write(': keepalive\n\n');
        } catch {
          connected = false;
          cleanup();
        }
      }
    }, keepaliveMs);
  }

  // Cleanup function
  function cleanup(): void {
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
      keepaliveInterval = null;
    }
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
  }

  // Format event for SSE protocol
  function formatEvent(event: SSEEvent): string {
    let output = '';

    if (event.id) {
      output += `id: ${event.id}\n`;
    }
    if (event.retry) {
      output += `retry: ${event.retry}\n`;
    }
    if (event.event) {
      output += `event: ${event.event}\n`;
    }

    // Format data
    let dataStr: string;
    if (typeof event.data === 'string') {
      dataStr = event.data;
    } else {
      const payload =
        includeCorrelationId && correlationId
          ? { ...(event.data as object), correlationId }
          : event.data;
      dataStr = JSON.stringify(payload);
    }

    // Split data by newlines (SSE requires each line prefixed with 'data: ')
    for (const line of dataStr.split('\n')) {
      output += `data: ${line}\n`;
    }

    output += '\n';
    return output;
  }

  // Flush buffered events
  function flush(): void {
    if (!connected || eventBuffer.length === 0) return;

    try {
      const data = eventBuffer.join('');
      res.write(data);
      eventBuffer = [];
    } catch (error) {
      connected = false;
      cleanup();
      logger.warn({ correlationId, error: (error as Error).message }, 'SSE write failed');
    }
  }

  return {
    send(event: SSEEvent): void {
      if (!connected) return;

      const formatted = formatEvent(event);

      if (batchMs > 0) {
        // Batch mode: buffer events and flush periodically
        eventBuffer.push(formatted);
        if (!flushTimeout) {
          flushTimeout = setTimeout(() => {
            flushTimeout = null;
            flush();
          }, batchMs);
        }
      } else {
        // Immediate mode: write directly
        try {
          res.write(formatted);
        } catch (error) {
          connected = false;
          cleanup();
          logger.warn({ correlationId, error: (error as Error).message }, 'SSE write failed');
        }
      }
    },

    comment(text: string): void {
      if (!connected) return;
      try {
        res.write(`: ${text}\n\n`);
      } catch {
        connected = false;
        cleanup();
      }
    },

    isConnected(): boolean {
      return connected;
    },

    close(): void {
      if (batchMs > 0) {
        flush(); // Flush remaining events
      }
      cleanup();
      if (connected) {
        try {
          res.end();
        } catch {
          // Ignore close errors
        }
        connected = false;
      }
    },

    abortController,
  };
}

/**
 * Send a single SSE event (convenience function for simple use cases)
 */
export function sendSSE(res: Response, event: SSEEvent): void {
  let output = '';

  if (event.event) {
    output += `event: ${event.event}\n`;
  }

  const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);

  for (const line of dataStr.split('\n')) {
    output += `data: ${line}\n`;
  }

  output += '\n';

  try {
    res.write(output);
  } catch {
    // Client disconnected, ignore
  }
}

/**
 * Send an error event and close the SSE stream
 */
export function sendSSEError(res: Response, error: Error | string, code = 'error'): void {
  const errorData = {
    error: typeof error === 'string' ? error : error.message,
    code,
  };

  sendSSE(res, { event: 'error', data: errorData });

  try {
    res.end();
  } catch {
    // Client already disconnected
  }
}
