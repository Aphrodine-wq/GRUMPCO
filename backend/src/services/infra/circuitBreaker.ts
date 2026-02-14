/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services are down
 * States: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Failures before opening
  resetTimeout: number; // Time before attempting reset (ms)
  halfOpenMaxCalls: number; // Max calls in half-open state
  successThreshold: number; // Successes needed to close
  timeoutDuration: number; // Request timeout (ms)
  monitorInterval: number; // Health check interval (ms)
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalCalls: number;
  rejectedCalls: number;
  slowCalls: number;
  avgResponseTime: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
  successThreshold: 2,
  timeoutDuration: 10000, // 10 seconds
  monitorInterval: 5000, // 5 seconds
};

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private halfOpenCalls = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttempt: number = Date.now();
  private totalCalls = 0;
  private rejectedCalls = 0;
  private slowCalls = 0;
  private responseTimes: number[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;
  private name: string;
  private options: CircuitBreakerOptions;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startMonitoring();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.rejectedCalls++;
        logger.warn(
          {
            circuit: this.name,
            state: this.state,
            context,
          },
          `Circuit breaker OPEN - request rejected`
        );
        throw new CircuitBreakerError(`Circuit breaker is OPEN for ${this.name}`);
      }
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenCalls = 0;
      logger.info({ circuit: this.name }, 'Circuit breaker transitioning to HALF_OPEN');
      this.emit('halfOpen', { name: this.name });
    }

    if (
      this.state === CircuitState.HALF_OPEN &&
      this.halfOpenCalls >= this.options.halfOpenMaxCalls
    ) {
      this.rejectedCalls++;
      throw new CircuitBreakerError(`Circuit breaker HALF_OPEN limit reached for ${this.name}`);
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(fn);
      const responseTime = Date.now() - startTime;

      this.recordResponseTime(responseTime);

      if (responseTime > this.options.timeoutDuration / 2) {
        this.slowCalls++;
        logger.warn(
          {
            circuit: this.name,
            responseTime,
            threshold: this.options.timeoutDuration / 2,
          },
          'Slow call detected'
        );
      }

      this.onSuccess();
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      this.onFailure(error as Error, context);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError()), this.options.timeoutDuration)
      ),
    ]);
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.close();
      }
    }

    logger.debug({ circuit: this.name, state: this.state }, 'Circuit breaker call succeeded');
  }

  private onFailure(error: Error, context?: Record<string, unknown>): void {
    this.failures++;
    this.lastFailureTime = new Date();

    logger.error(
      {
        circuit: this.name,
        error: error.message,
        failures: this.failures,
        threshold: this.options.failureThreshold,
        context,
      },
      'Circuit breaker call failed'
    );

    if (this.failures >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    this.successes = 0;
    this.halfOpenCalls = 0;

    logger.error(
      {
        circuit: this.name,
        resetTimeout: this.options.resetTimeout,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      },
      'Circuit breaker OPENED'
    );

    this.emit('open', {
      name: this.name,
      failures: this.failures,
      nextAttempt: this.nextAttempt,
    });
  }

  private close(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;

    logger.info(
      {
        circuit: this.name,
        previousState,
      },
      'Circuit breaker CLOSED'
    );

    this.emit('close', { name: this.name });
  }

  private recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      const metrics = this.getMetrics();

      if (this.state === CircuitState.OPEN) {
        logger.info(
          {
            circuit: this.name,
            metrics,
            timeUntilRetry: Math.max(0, this.nextAttempt - Date.now()),
          },
          'Circuit breaker health check'
        );
      }

      this.emit('healthCheck', { name: this.name, metrics });
    }, this.options.monitorInterval);
  }

  getMetrics(): CircuitBreakerMetrics {
    const avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls,
      slowCalls: this.slowCalls,
      avgResponseTime: Math.round(avgResponseTime),
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  forceOpen(): void {
    this.open();
  }

  forceClose(): void {
    this.close();
  }

  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.removeAllListeners();
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timeout');
    this.name = 'TimeoutError';
  }
}

// Global circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  const breaker = circuitBreakers.get(name);
  if (!breaker) {
    throw new Error(`Circuit breaker ${name} not found`);
  }
  return breaker;
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return new Map(circuitBreakers);
}

export function clearCircuitBreakers(): void {
  circuitBreakers.forEach((cb) => cb.destroy());
  circuitBreakers.clear();
}

export default CircuitBreaker;
