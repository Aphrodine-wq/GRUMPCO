/**
 * Heartbeat Background Service
 *
 * A proactive background service that periodically checks for conditions
 * and initiates tasks autonomously. Transforms the AI from a passive chat
 * tool into an active worker.
 *
 * Supported triggers:
 *  - CI/CD build failures (GitHub Actions webhook)
 *  - File system changes in watched directories
 *  - Scheduled cron-like tasks
 *  - Custom event listeners (webhooks, database changes)
 *
 * @module services/infra/heartbeat
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type HeartbeatEventType = 'ci_failure' | 'file_change' | 'scheduled' | 'webhook' | 'custom';

export interface HeartbeatEvent {
  id: string;
  type: HeartbeatEventType;
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface HeartbeatHandler {
  /** Unique handler ID */
  id: string;
  /** Event types this handler responds to */
  eventTypes: HeartbeatEventType[];
  /** Priority filter — only handle events at or above this priority */
  minPriority?: HeartbeatEvent['priority'];
  /** Handler function — receives the event and returns an action description */
  handle: (event: HeartbeatEvent) => Promise<HeartbeatAction | null>;
}

export interface HeartbeatAction {
  /** What action to take */
  type: 'create_task' | 'send_notification' | 'run_command' | 'trigger_agent';
  /** Human-readable description of the action */
  description: string;
  /** Action parameters */
  params: Record<string, unknown>;
}

export interface HeartbeatConfig {
  /** Interval in ms between heartbeat checks. @default 1_800_000 (30 min) */
  intervalMs: number;
  /** Maximum number of events to process per heartbeat cycle. @default 10 */
  maxEventsPerCycle: number;
  /** Whether the heartbeat service is enabled. @default false */
  enabled: boolean;
  /** Event retention period in ms. @default 86_400_000 (24 hours) */
  retentionMs: number;
}

// ============================================================================
// Priority helpers
// ============================================================================

const PRIORITY_ORDER: Record<HeartbeatEvent['priority'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function meetsMinPriority(
  eventPriority: HeartbeatEvent['priority'],
  minPriority?: HeartbeatEvent['priority']
): boolean {
  if (!minPriority) return true;
  return PRIORITY_ORDER[eventPriority] >= PRIORITY_ORDER[minPriority];
}

// ============================================================================
// Heartbeat Service
// ============================================================================

export class HeartbeatService extends EventEmitter {
  private config: HeartbeatConfig;
  private handlers: Map<string, HeartbeatHandler> = new Map();
  private eventQueue: HeartbeatEvent[] = [];
  private processedEvents: Set<string> = new Set();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config?: Partial<HeartbeatConfig>) {
    super();
    this.config = {
      intervalMs: config?.intervalMs ?? 1_800_000, // 30 minutes
      maxEventsPerCycle: config?.maxEventsPerCycle ?? 10,
      enabled: config?.enabled ?? false,
      retentionMs: config?.retentionMs ?? 86_400_000, // 24 hours
    };
  }

  /**
   * Start the heartbeat loop.
   */
  start(): void {
    if (this.running || !this.config.enabled) {
      logger.info({ enabled: this.config.enabled }, 'Heartbeat service skip start');
      return;
    }

    this.running = true;
    logger.info(
      { intervalMs: this.config.intervalMs, handlers: this.handlers.size },
      'Heartbeat service started'
    );

    // Run immediately on start, then on interval
    this.tick();
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
  }

  /**
   * Stop the heartbeat loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info({}, 'Heartbeat service stopped');
  }

  /**
   * Register an event handler.
   */
  registerHandler(handler: HeartbeatHandler): void {
    this.handlers.set(handler.id, handler);
    logger.info(
      { handlerId: handler.id, eventTypes: handler.eventTypes },
      'Heartbeat handler registered'
    );
  }

  /**
   * Remove a handler.
   */
  removeHandler(handlerId: string): void {
    this.handlers.delete(handlerId);
  }

  /**
   * Push an event onto the queue for processing in the next cycle.
   * Can also be called externally (e.g., from a webhook route).
   */
  pushEvent(event: HeartbeatEvent): void {
    // Deduplicate
    if (this.processedEvents.has(event.id)) return;

    this.eventQueue.push(event);

    // Sort by priority (highest first)
    this.eventQueue.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);

    this.emit('event:received', event);

    // If critical, process immediately
    if (event.priority === 'critical' && this.running) {
      this.processSingleEvent(event).catch((err) =>
        logger.error({ err, eventId: event.id }, 'Critical event processing failed')
      );
    }
  }

  /**
   * Get pending events count.
   */
  getPendingCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get service status.
   */
  getStatus(): {
    running: boolean;
    handlers: number;
    pendingEvents: number;
    processedEvents: number;
  } {
    return {
      running: this.running,
      handlers: this.handlers.size,
      pendingEvents: this.eventQueue.length,
      processedEvents: this.processedEvents.size,
    };
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  /**
   * Main heartbeat tick — processes queued events.
   */
  private async tick(): Promise<void> {
    if (this.eventQueue.length === 0) {
      this.emit('tick:idle');
      return;
    }

    const batch = this.eventQueue.splice(0, this.config.maxEventsPerCycle);
    logger.info({ batchSize: batch.length }, 'Heartbeat tick processing');

    for (const event of batch) {
      await this.processSingleEvent(event);
    }

    // Cleanup old processed events
    this.cleanupRetention();
    this.emit('tick:complete', batch.length);
  }

  /**
   * Process a single event through all matching handlers.
   */
  private async processSingleEvent(event: HeartbeatEvent): Promise<void> {
    if (this.processedEvents.has(event.id)) return;
    this.processedEvents.add(event.id);

    for (const handler of this.handlers.values()) {
      if (!handler.eventTypes.includes(event.type)) continue;
      if (!meetsMinPriority(event.priority, handler.minPriority)) continue;

      try {
        const action = await handler.handle(event);
        if (action) {
          this.emit('action:created', { event, action, handlerId: handler.id });
          logger.info(
            { eventId: event.id, handlerId: handler.id, actionType: action.type },
            'Heartbeat action created'
          );
        }
      } catch (err) {
        logger.error({ err, eventId: event.id, handlerId: handler.id }, 'Heartbeat handler error');
      }
    }
  }

  /**
   * Remove old event IDs to prevent memory growth.
   */
  private cleanupRetention(): void {
    // Simple approach: keep the set bounded
    if (this.processedEvents.size > 10_000) {
      this.processedEvents.clear();
    }
  }
}

// ============================================================================
// Built-in Handlers
// ============================================================================

/**
 * Handler that detects CI/CD failures from GitHub Actions webhooks.
 */
export const ciFailureHandler: HeartbeatHandler = {
  id: 'ci-failure-detector',
  eventTypes: ['ci_failure', 'webhook'],
  minPriority: 'medium',
  async handle(event) {
    const payload = event.payload as {
      action?: string;
      conclusion?: string;
      workflow?: string;
      repository?: string;
      html_url?: string;
    };

    if (payload.conclusion === 'failure' || payload.action === 'completed') {
      return {
        type: 'create_task',
        description: `CI failure detected: ${payload.workflow ?? 'unknown workflow'} in ${payload.repository ?? 'repo'}`,
        params: {
          workflow: payload.workflow,
          repository: payload.repository,
          url: payload.html_url,
          priority: 'high',
        },
      };
    }
    return null;
  },
};

/**
 * Handler for file system change events (e.g., new files in a watch directory).
 */
export const fileChangeHandler: HeartbeatHandler = {
  id: 'file-change-detector',
  eventTypes: ['file_change'],
  async handle(event) {
    const payload = event.payload as {
      path?: string;
      changeType?: string;
    };

    return {
      type: 'send_notification',
      description: `File ${payload.changeType ?? 'changed'}: ${payload.path ?? 'unknown'}`,
      params: {
        path: payload.path,
        changeType: payload.changeType,
      },
    };
  },
};

// ============================================================================
// Singleton
// ============================================================================

let _heartbeat: HeartbeatService | null = null;

export function getHeartbeatService(config?: Partial<HeartbeatConfig>): HeartbeatService {
  if (!_heartbeat || config) {
    _heartbeat = new HeartbeatService(config);
    // Register built-in handlers
    _heartbeat.registerHandler(ciFailureHandler);
    _heartbeat.registerHandler(fileChangeHandler);
  }
  return _heartbeat;
}
