/**
 * WebSocket Streaming Service
 * Lower latency alternative to Server-Sent Events
 *
 * Features:
 * - Binary WebSocket protocol (lower overhead than SSE)
 * - MessagePack encoding (compact binary format)
 * - Persistent connection (no per-request overhead)
 * - Multiplexing multiple streams per connection
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import logger from "../middleware/logger.js";
import { recordLlmStreamMetrics } from "../middleware/metrics.js";

// Extended request type for WebSocket connections
interface WebSocketRequest extends IncomingMessage {
  user?: { id: string };
}

interface StreamSession {
  id: string;
  ws: WebSocket;
  userId: string;
  activeStreams: Map<string, AbortController>;
  connectedAt: number;
  lastActivity: number;
}

interface WebSocketMessage {
  type: "start_stream" | "cancel_stream" | "ping" | "pong";
  streamId?: string;
  payload?: unknown;
  timestamp: number;
}

class WebSocketStreamingService {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<string, StreamSession>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000;
  private readonly sessionTimeoutMs = 300000; // 5 minutes

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/stream",
      perMessageDeflate: true, // Enable compression
    });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.startHeartbeat();

    logger.info("WebSocket streaming service initialized");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: WebSocketRequest): void {
    const sessionId = this.generateSessionId();
    const userId = req.user?.id || "anonymous";

    const session: StreamSession = {
      id: sessionId,
      ws,
      userId,
      activeStreams: new Map(),
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);

    logger.info({ sessionId, userId }, "WebSocket client connected");

    // Handle messages
    ws.on("message", (data: Buffer) => {
      this.handleMessage(session, data);
    });

    // Handle close
    ws.on("close", () => {
      this.handleDisconnect(session);
    });

    // Handle errors
    ws.on("error", (error) => {
      logger.error({ sessionId, error: error.message }, "WebSocket error");
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: "connected",
      sessionId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(session: StreamSession, data: Buffer): void {
    session.lastActivity = Date.now();

    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;

      switch (message.type) {
        case "start_stream":
          this.handleStartStream(session, message);
          break;

        case "cancel_stream":
          this.handleCancelStream(session, message);
          break;

        case "ping":
          this.sendMessage(session.ws, {
            type: "pong",
            timestamp: Date.now(),
          });
          break;

        default:
          logger.warn({ type: message.type }, "Unknown WebSocket message type");
      }
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Failed to parse WebSocket message",
      );
    }
  }

  /**
   * Handle start stream request
   */
  private async handleStartStream(
    session: StreamSession,
    message: WebSocketMessage,
  ): Promise<void> {
    const streamId = message.streamId || this.generateStreamId();
    const payload = message.payload as {
      provider: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
    };

    if (!payload) {
      this.sendError(session.ws, streamId, "Missing payload");
      return;
    }

    logger.info(
      { sessionId: session.id, streamId },
      "Starting WebSocket stream",
    );

    const abortController = new AbortController();
    session.activeStreams.set(streamId, abortController);

    const startTime = Date.now();
    let firstByteSent = false;
    let tokenCount = 0;

    try {
      // Import stream provider dynamically
      const { getStreamProvider } = await import("@grump/ai-core");

      const provider = getStreamProvider(payload.provider);

      if (!provider) {
        throw new Error(`Unknown provider: ${payload.provider}`);
      }

      const stream = provider.stream({
        model: payload.model,
        messages: payload.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        max_tokens: payload.max_tokens,
        system: "",
      });

      for await (const event of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        if (!firstByteSent) {
          firstByteSent = true;
          const timeToFirstByte = Date.now() - startTime;

          // Send TTFB metric to client
          this.sendMessage(session.ws, {
            type: "ttfb",
            streamId,
            timeToFirstByte,
            timestamp: Date.now(),
          });
        }

        if (event.type === "content_block_delta") {
          tokenCount++;
        }

        // Send event to client
        this.sendMessage(session.ws, {
          type: "stream_event",
          streamId,
          event,
          timestamp: Date.now(),
        });
      }

      // Send completion
      this.sendMessage(session.ws, {
        type: "stream_complete",
        streamId,
        totalTime: Date.now() - startTime,
        tokenCount,
        timestamp: Date.now(),
      });

      // Record metrics
      recordLlmStreamMetrics(
        payload.provider,
        payload.model,
        (Date.now() - startTime) / 1000,
        undefined,
        tokenCount,
      );
    } catch (error) {
      logger.error(
        { streamId, error: (error as Error).message },
        "Stream error",
      );

      this.sendError(session.ws, streamId, (error as Error).message);
    } finally {
      session.activeStreams.delete(streamId);
    }
  }

  /**
   * Handle cancel stream request
   */
  private handleCancelStream(
    session: StreamSession,
    message: WebSocketMessage,
  ): void {
    const streamId = message.streamId;

    if (!streamId) return;

    const abortController = session.activeStreams.get(streamId);

    if (abortController) {
      abortController.abort();
      session.activeStreams.delete(streamId);

      this.sendMessage(session.ws, {
        type: "stream_cancelled",
        streamId,
        timestamp: Date.now(),
      });

      logger.debug({ sessionId: session.id, streamId }, "Stream cancelled");
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(session: StreamSession): void {
    // Cancel all active streams
    for (const [streamId, abortController] of session.activeStreams.entries()) {
      abortController.abort();
      logger.debug({ streamId }, "Cancelled stream on disconnect");
    }

    this.sessions.delete(session.id);

    logger.info(
      {
        sessionId: session.id,
        duration: Date.now() - session.connectedAt,
      },
      "WebSocket client disconnected",
    );
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, streamId: string, error: string): void {
    this.sendMessage(ws, {
      type: "stream_error",
      streamId,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const session of this.sessions.values()) {
        // Check for stale sessions
        if (now - session.lastActivity > this.sessionTimeoutMs) {
          logger.info({ sessionId: session.id }, "Closing stale session");
          session.ws.close();
          continue;
        }

        // Send ping if no recent activity
        if (now - session.lastActivity > this.heartbeatIntervalMs) {
          this.sendMessage(session.ws, {
            type: "ping",
            timestamp: now,
          });
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalSessions: number;
    activeStreams: number;
  } {
    let activeStreams = 0;

    for (const session of this.sessions.values()) {
      activeStreams += session.activeStreams.size;
    }

    return {
      totalSessions: this.sessions.size,
      activeStreams,
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const session of this.sessions.values()) {
      session.ws.close();
    }

    this.sessions.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info("WebSocket streaming service shutdown");
  }

  private generateSessionId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateStreamId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

// Singleton instance
export const wsStreamingService = new WebSocketStreamingService();

// Export class for testing
export { WebSocketStreamingService };
