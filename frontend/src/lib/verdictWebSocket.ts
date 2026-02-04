//! WebSocket Real-time Streaming for Verdicts
//! Push verdict updates, outcome events, and model improvements in real-time

/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
/* global WebSocket */

export interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface VerdictUpdateMessage extends WebSocketMessage {
  type: 'verdict:created' | 'verdict:updated' | 'verdict:cached';
  data: {
    request_id: string;
    verdict: string;
    confidence: number;
    success_probability: number;
  };
}

export interface OutcomeEventMessage extends WebSocketMessage {
  type: 'outcome:discovered' | 'outcome:confirmed' | 'outcome:analyzed';
  data: {
    founder_id: string;
    event_type: string;
    event_date: string;
    confidence: number;
  };
}

export interface ModelUpdateMessage extends WebSocketMessage {
  type: 'model:trained' | 'model:promoted' | 'model:performance_improved';
  data: {
    model_id: string;
    model_version: number;
    accuracy?: number;
    improvement?: number;
  };
}

export interface BatchProgressMessage extends WebSocketMessage {
  type: 'batch:started' | 'batch:progress' | 'batch:completed';
  data: {
    batch_id: string;
    status: string;
    processed: number;
    total: number;
    percent_complete: number;
  };
}

// ============================================================================
// WebSocket Client
// ============================================================================

export class VerdictWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private listeners: Map<string, Set<(msg: WebSocketMessage) => void>> = new Map();
  private isConnected = false;

  constructor(url: string) {
    this.url = url;
  }

  /// Connect to WebSocket server
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.emit(message.type, message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('⚠️  WebSocket disconnected');
          this.isConnected = false;
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /// Attempt to reconnect
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch(() => {
          // Retry on failure
        });
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  /// Subscribe to message type
  public on(type: string, callback: (msg: WebSocketMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const callbacks = this.listeners.get(type)!;
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
    };
  }

  /// Emit message to listeners
  private emit(type: string, message: WebSocketMessage): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(message));
    }

    // Also emit to wildcard listeners
    const wildcards = this.listeners.get('*');
    if (wildcards) {
      wildcards.forEach((callback) => callback(message));
    }
  }

  /// Send message to server
  public send(message: WebSocketMessage): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }

  /// Disconnect
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /// Check if connected
  public connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// Real-time Dashboard Updates
// ============================================================================

export class RealTimeDashboard {
  private wsClient: VerdictWebSocketClient;
  private updateCallbacks: Set<() => void> = new Set();

  constructor(wsUrl: string) {
    this.wsClient = new VerdictWebSocketClient(wsUrl);
  }

  /// Initialize real-time dashboard
  public async initialize(): Promise<void> {
    await this.wsClient.connect();

    // Subscribe to verdict updates
    this.wsClient.on('verdict:created', (msg: WebSocketMessage) => {
      console.log('📊 New verdict created:', msg.data);
      this.notifyUpdate();
    });

    // Subscribe to outcome events
    this.wsClient.on('outcome:discovered', (msg: WebSocketMessage) => {
      console.log('🎯 Outcome discovered:', msg.data);
      this.notifyUpdate();
    });

    // Subscribe to model updates
    this.wsClient.on('model:trained', (msg: WebSocketMessage) => {
      console.log('🤖 Model trained:', msg.data);
      this.notifyUpdate();
    });

    // Subscribe to batch progress
    this.wsClient.on('batch:progress', (msg: WebSocketMessage) => {
      const batchMsg = msg as BatchProgressMessage;
      console.log(`⚙️  Batch progress: ${batchMsg.data.processed}/${batchMsg.data.total}`);
      this.notifyUpdate();
    });

    console.log('✅ Real-time dashboard initialized');
  }

  /// Register update listener
  public onUpdate(callback: () => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /// Notify listeners of update
  private notifyUpdate(): void {
    this.updateCallbacks.forEach((callback) => callback());
  }

  /// Request verdict via WebSocket
  public requestVerdict(intent: string, options?: Record<string, unknown>): void {
    this.wsClient.send({
      type: 'verdict:request',
      data: {
        intent,
        ...options,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /// Request batch analysis
  public requestBatchAnalysis(batch_id: string, founders: unknown[]): void {
    this.wsClient.send({
      type: 'batch:start',
      data: {
        batch_id,
        founders,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /// Disconnect
  public disconnect(): void {
    this.wsClient.disconnect();
  }
}

// ============================================================================
// Server-Sent Events Alternative
// ============================================================================

export class VerdictSSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  /// Connect to SSE stream
  public connect(): void {
    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.addEventListener('verdict:created', (event) => {
        const data = JSON.parse(event.data);
        this.emit('verdict:created', data);
      });

      this.eventSource.addEventListener('outcome:discovered', (event) => {
        const data = JSON.parse(event.data);
        this.emit('outcome:discovered', data);
      });

      this.eventSource.addEventListener('error', () => {
        console.error('SSE connection error');
        this.reconnect();
      });

      console.log('✅ SSE connected');
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
    }
  }

  /// Subscribe to event type
  public on(type: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const callbacks = this.listeners.get(type)!;
    callbacks.add(callback);

    return () => callbacks.delete(callback);
  }

  /// Emit event
  private emit(type: string, data: unknown): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /// Reconnect
  private reconnect(): void {
    setTimeout(() => {
      this.connect();
    }, 3000);
  }

  /// Disconnect
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// ============================================================================
// Live Metrics Stream
// ============================================================================

export class LiveMetricsStream {
  private wsClient: VerdictWebSocketClient;
  private metrics = {
    verdicts_processed: 0,
    avg_confidence: 0.75,
    avg_success_probability: 0.73,
    accuracy: 0.79,
    outcomes_discovered: 0,
  };

  constructor(wsUrl: string) {
    this.wsClient = new VerdictWebSocketClient(wsUrl);
  }

  /// Initialize metrics stream
  public async initialize(): Promise<void> {
    await this.wsClient.connect();

    // Update metrics on verdict creation
    this.wsClient.on('verdict:created', () => {
      this.metrics.verdicts_processed++;
    });

    // Update on outcome discovery
    this.wsClient.on('outcome:discovered', () => {
      this.metrics.outcomes_discovered++;
    });
  }

  /// Get current metrics
  public getMetrics() {
    return { ...this.metrics };
  }

  /// Disconnect
  public disconnect(): void {
    this.wsClient.disconnect();
  }
}
