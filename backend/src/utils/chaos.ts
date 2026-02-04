/**
 * Chaos Engineering Utilities for G-Rump
 * Provides controlled failure injection for testing system resilience.
 *
 * IMPORTANT: Only enable in non-production environments!
 *
 * @module chaos
 */

import { logger } from '../middleware/logger.js';
import { env } from '../config/env.js';

// ============================================================================
// Types
// ============================================================================

export interface ChaosConfig {
  /** Enable chaos engineering (default: false) */
  enabled: boolean;
  /** Probability of injecting latency (0-1) */
  latencyProbability: number;
  /** Latency range in ms [min, max] */
  latencyRange: [number, number];
  /** Probability of injecting errors (0-1) */
  errorProbability: number;
  /** Types of errors to inject */
  errorTypes: ('timeout' | 'network' | 'server' | 'rate_limit')[];
  /** Services to target (empty = all) */
  targetServices: string[];
  /** Endpoints to exclude */
  excludeEndpoints: string[];
}

export interface ChaosEvent {
  timestamp: string;
  type: 'latency' | 'error';
  service?: string;
  endpoint?: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ChaosConfig = {
  enabled: false,
  latencyProbability: 0.1,
  latencyRange: [100, 2000],
  errorProbability: 0.05,
  errorTypes: ['timeout', 'network', 'server'],
  targetServices: [],
  excludeEndpoints: ['/health', '/metrics', '/ready', '/live'],
};

// ============================================================================
// Chaos Monkey Implementation
// ============================================================================

class ChaosMonkey {
  private config: ChaosConfig;
  private events: ChaosEvent[] = [];
  private maxEvents = 1000;

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Safety: Never enable in production unless explicitly overridden
    if (env.NODE_ENV === 'production' && !process.env.CHAOS_FORCE_PRODUCTION) {
      this.config.enabled = false;
      logger.warn({}, 'Chaos engineering disabled in production');
    }
  }

  /**
   * Update chaos configuration.
   */
  configure(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Chaos configuration updated');
  }

  /**
   * Enable chaos engineering.
   */
  enable(): void {
    if (env.NODE_ENV === 'production' && !process.env.CHAOS_FORCE_PRODUCTION) {
      logger.error({}, 'Cannot enable chaos in production');
      return;
    }
    this.config.enabled = true;
    logger.warn({}, 'Chaos engineering ENABLED');
  }

  /**
   * Disable chaos engineering.
   */
  disable(): void {
    this.config.enabled = false;
    logger.info({}, 'Chaos engineering disabled');
  }

  /**
   * Check if chaos should be applied to this request.
   */
  shouldApply(service?: string, endpoint?: string): boolean {
    if (!this.config.enabled) return false;

    // Check endpoint exclusions
    if (endpoint && this.config.excludeEndpoints.some((e) => endpoint.startsWith(e))) {
      return false;
    }

    // Check service targeting
    if (this.config.targetServices.length > 0 && service) {
      if (!this.config.targetServices.includes(service)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Maybe inject latency into an operation.
   */
  async maybeInjectLatency(service?: string, endpoint?: string): Promise<void> {
    if (!this.shouldApply(service, endpoint)) return;

    if (Math.random() < this.config.latencyProbability) {
      const [min, max] = this.config.latencyRange;
      const delay = min + Math.random() * (max - min);

      this.recordEvent({
        type: 'latency',
        service,
        endpoint,
        details: { delayMs: Math.round(delay) },
      });

      logger.warn({ service, endpoint, delayMs: delay }, 'Chaos: Injecting latency');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Maybe throw an error.
   */
  maybeInjectError(service?: string, endpoint?: string): void {
    if (!this.shouldApply(service, endpoint)) return;

    if (Math.random() < this.config.errorProbability) {
      const errorType =
        this.config.errorTypes[Math.floor(Math.random() * this.config.errorTypes.length)];

      this.recordEvent({
        type: 'error',
        service,
        endpoint,
        details: { errorType },
      });

      logger.warn({ service, endpoint, errorType }, 'Chaos: Injecting error');

      switch (errorType) {
        case 'timeout':
          throw new ChaosError('ETIMEDOUT', 'Chaos: Connection timed out');
        case 'network':
          throw new ChaosError('ECONNREFUSED', 'Chaos: Connection refused');
        case 'server':
          throw new ChaosError('INTERNAL_ERROR', 'Chaos: Internal server error');
        case 'rate_limit':
          throw new ChaosError('RATE_LIMITED', 'Chaos: Rate limit exceeded');
      }
    }
  }

  /**
   * Wrap a function with chaos injection.
   */
  wrap<T>(
    fn: () => Promise<T>,
    options?: { service?: string; endpoint?: string }
  ): () => Promise<T> {
    return async () => {
      await this.maybeInjectLatency(options?.service, options?.endpoint);
      this.maybeInjectError(options?.service, options?.endpoint);
      return fn();
    };
  }

  /**
   * Get recorded chaos events.
   */
  getEvents(limit?: number): ChaosEvent[] {
    const events = [...this.events].reverse();
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Clear recorded events.
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get current configuration.
   */
  getConfig(): ChaosConfig {
    return { ...this.config };
  }

  /**
   * Get statistics about chaos injection.
   */
  getStats(): {
    enabled: boolean;
    totalEvents: number;
    latencyEvents: number;
    errorEvents: number;
    eventsByService: Record<string, number>;
  } {
    const latencyEvents = this.events.filter((e) => e.type === 'latency').length;
    const errorEvents = this.events.filter((e) => e.type === 'error').length;

    const eventsByService: Record<string, number> = {};
    for (const event of this.events) {
      const service = event.service || 'unknown';
      eventsByService[service] = (eventsByService[service] || 0) + 1;
    }

    return {
      enabled: this.config.enabled,
      totalEvents: this.events.length,
      latencyEvents,
      errorEvents,
      eventsByService,
    };
  }

  private recordEvent(event: Omit<ChaosEvent, 'timestamp'>): void {
    const fullEvent: ChaosEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }
}

// ============================================================================
// Chaos Error
// ============================================================================

export class ChaosError extends Error {
  public readonly code: string;
  public readonly isChaos = true;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ChaosError';
    this.code = code;
  }
}

/**
 * Check if an error was injected by chaos engineering.
 */
export function isChaosError(error: unknown): error is ChaosError {
  return error instanceof ChaosError || (error as ChaosError)?.isChaos === true;
}

// ============================================================================
// Express Middleware
// ============================================================================

import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware for chaos injection.
 */
export function chaosMiddleware(
  chaos: ChaosMonkey
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await chaos.maybeInjectLatency('http', req.path);
      chaos.maybeInjectError('http', req.path);
      next();
    } catch (err) {
      if (isChaosError(err)) {
        const statusCode =
          err.code === 'RATE_LIMITED' ? 429 : err.code === 'INTERNAL_ERROR' ? 500 : 503;

        res.status(statusCode).json({
          error: err.message,
          code: err.code,
          chaos: true,
        });
        return;
      }
      next(err);
    }
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let chaosInstance: ChaosMonkey | null = null;

/**
 * Get the chaos monkey instance.
 */
export function getChaosMonkey(): ChaosMonkey {
  if (!chaosInstance) {
    chaosInstance = new ChaosMonkey({
      enabled: process.env.CHAOS_ENABLED === 'true',
      latencyProbability: parseFloat(process.env.CHAOS_LATENCY_PROB || '0.1'),
      errorProbability: parseFloat(process.env.CHAOS_ERROR_PROB || '0.05'),
    });
  }
  return chaosInstance;
}

/**
 * Create a new chaos monkey instance with custom config.
 */
export function createChaosMonkey(config?: Partial<ChaosConfig>): ChaosMonkey {
  return new ChaosMonkey(config);
}

// ============================================================================
// Chaos Scenarios
// ============================================================================

/**
 * Pre-defined chaos scenarios for common testing patterns.
 */
export const ChaosScenarios = {
  /** High latency simulation */
  highLatency: {
    enabled: true,
    latencyProbability: 0.5,
    latencyRange: [1000, 5000] as [number, number],
    errorProbability: 0,
    errorTypes: [],
    targetServices: [],
    excludeEndpoints: ['/health', '/metrics'],
  },

  /** Network instability */
  networkInstability: {
    enabled: true,
    latencyProbability: 0.3,
    latencyRange: [100, 1000] as [number, number],
    errorProbability: 0.2,
    errorTypes: ['network', 'timeout'] as const,
    targetServices: [],
    excludeEndpoints: ['/health', '/metrics'],
  },

  /** LLM service degradation */
  llmDegradation: {
    enabled: true,
    latencyProbability: 0.4,
    latencyRange: [2000, 10000] as [number, number],
    errorProbability: 0.15,
    errorTypes: ['timeout', 'server'] as const,
    targetServices: ['llm', 'nim', 'openrouter'],
    excludeEndpoints: [],
  },

  /** Cache failures */
  cacheFailures: {
    enabled: true,
    latencyProbability: 0.1,
    latencyRange: [50, 200] as [number, number],
    errorProbability: 0.3,
    errorTypes: ['server'] as const,
    targetServices: ['redis', 'cache'],
    excludeEndpoints: [],
  },

  /** Rate limit simulation */
  rateLimitSimulation: {
    enabled: true,
    latencyProbability: 0,
    latencyRange: [0, 0] as [number, number],
    errorProbability: 0.25,
    errorTypes: ['rate_limit'] as const,
    targetServices: [],
    excludeEndpoints: ['/health', '/metrics'],
  },
} as const;

export type ChaosScenarioName = keyof typeof ChaosScenarios;

/**
 * Apply a pre-defined chaos scenario.
 */
export function applyChaosScenario(chaos: ChaosMonkey, scenario: ChaosScenarioName): void {
  const config = ChaosScenarios[scenario];
  // Deep clone to convert readonly arrays to mutable
  chaos.configure({
    enabled: config.enabled,
    latencyProbability: config.latencyProbability,
    latencyRange: [...config.latencyRange] as [number, number],
    errorProbability: config.errorProbability,
    errorTypes: [...config.errorTypes] as ('timeout' | 'network' | 'server' | 'rate_limit')[],
    targetServices: [...config.targetServices],
    excludeEndpoints: [...config.excludeEndpoints],
  });
  logger.info({ scenario }, 'Applied chaos scenario');
}
