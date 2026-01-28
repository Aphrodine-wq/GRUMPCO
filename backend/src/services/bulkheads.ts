/**
 * Bulkheads Service
 * Implements bulkhead pattern with per-service circuit breakers and rate limiting
 * Isolates failures between different service types
 */

import CircuitBreaker from 'opossum';
import { createCircuitBreaker, CIRCUIT_BREAKER_OPTIONS } from './resilience.js';
import logger from '../middleware/logger.js';

export type ServiceType = 
  | 'claude-chat'
  | 'claude-context'
  | 'claude-diagram'
  | 'claude-code'
  | 'claude-agent';

interface ServiceConfig {
  maxConcurrent: number;
  queueSize: number;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

// Service-specific configurations
const SERVICE_CONFIGS: Record<ServiceType, ServiceConfig> = {
  'claude-chat': {
    maxConcurrent: 10,
    queueSize: 50,
    rateLimit: {
      requests: 100,
      windowMs: 60000, // 1 minute
    },
  },
  'claude-context': {
    maxConcurrent: 5,
    queueSize: 20,
    rateLimit: {
      requests: 30,
      windowMs: 60000,
    },
  },
  'claude-diagram': {
    maxConcurrent: 8,
    queueSize: 30,
    rateLimit: {
      requests: 50,
      windowMs: 60000,
    },
  },
  'claude-code': {
    maxConcurrent: 5,
    queueSize: 20,
    rateLimit: {
      requests: 40,
      windowMs: 60000,
    },
  },
  'claude-agent': {
    maxConcurrent: 10,
    queueSize: 50,
    rateLimit: {
      requests: 80,
      windowMs: 60000,
    },
  },
};

// Circuit breakers per service type
const circuitBreakers = new Map<ServiceType, CircuitBreaker<any, any>>();

// Rate limiting state per service
interface RateLimitState {
  requests: number[];
  windowStart: number;
}

const rateLimitStates = new Map<ServiceType, RateLimitState>();

/**
 * Get or create circuit breaker for a service type
 */
export function getCircuitBreaker<T extends unknown[], R>(
  serviceType: ServiceType,
  fn: (...args: T) => Promise<R>
): CircuitBreaker<T, R> {
  if (!circuitBreakers.has(serviceType)) {
    const config = SERVICE_CONFIGS[serviceType];
    const breaker = createCircuitBreaker(fn, serviceType);
    
    circuitBreakers.set(serviceType, breaker);
    logger.info({ serviceType }, 'Circuit breaker created for service');
    return breaker;
  }
  
  return circuitBreakers.get(serviceType) as CircuitBreaker<T, R>;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(serviceType: ServiceType): { allowed: boolean; retryAfter?: number } {
  const config = SERVICE_CONFIGS[serviceType];
  if (!config.rateLimit) {
    return { allowed: true };
  }

  const now = Date.now();
  let state = rateLimitStates.get(serviceType);

  if (!state || now - state.windowStart >= config.rateLimit.windowMs) {
    // Reset window
    state = {
      requests: [],
      windowStart: now,
    };
    rateLimitStates.set(serviceType, state);
  }

  // Remove old requests outside the window
  state.requests = state.requests.filter(
    timestamp => now - timestamp < config.rateLimit.windowMs
  );

  if (state.requests.length >= config.rateLimit.requests) {
    const oldestRequest = state.requests[0];
    const retryAfter = Math.ceil(
      (config.rateLimit.windowMs - (now - oldestRequest)) / 1000
    );
    logger.warn(
      { serviceType, count: state.requests.length, limit: config.rateLimit.requests },
      'Rate limit exceeded'
    );
    return { allowed: false, retryAfter };
  }

  // Record this request
  state.requests.push(now);
  return { allowed: true };
}

/**
 * Get circuit breaker state for a service
 */
export function getServiceState(serviceType: ServiceType): {
  state: 'open' | 'half-open' | 'closed';
  stats: unknown;
  rateLimit: {
    current: number;
    limit: number;
    windowMs: number;
  };
} {
  const breaker = circuitBreakers.get(serviceType);
  const config = SERVICE_CONFIGS[serviceType];
  const rateLimitState = rateLimitStates.get(serviceType);

  const state = breaker
    ? (breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed')
    : 'closed';

  const stats = breaker ? (breaker as any).stats ?? {} : {};

  const rateLimit = {
    current: rateLimitState?.requests.length || 0,
    limit: config.rateLimit?.requests || 0,
    windowMs: config.rateLimit?.windowMs || 0,
  };

  return { state, stats, rateLimit };
}

/**
 * Get all service states (for health checks)
 */
export function getAllServiceStates(): Record<ServiceType, ReturnType<typeof getServiceState>> {
  const states: Record<string, ReturnType<typeof getServiceState>> = {};
  for (const serviceType of Object.keys(SERVICE_CONFIGS) as ServiceType[]) {
    states[serviceType] = getServiceState(serviceType);
  }
  return states as Record<ServiceType, ReturnType<typeof getServiceState>>;
}

/**
 * Reset circuit breaker for a service (for testing/recovery)
 */
export function resetCircuitBreaker(serviceType: ServiceType): void {
  const breaker = circuitBreakers.get(serviceType);
  if (breaker) {
    breaker.close();
    logger.info({ serviceType }, 'Circuit breaker reset');
  }
}

/**
 * Reset rate limit state for a service (for testing)
 */
export function resetRateLimit(serviceType: ServiceType): void {
  rateLimitStates.delete(serviceType);
  logger.info({ serviceType }, 'Rate limit state reset');
}
