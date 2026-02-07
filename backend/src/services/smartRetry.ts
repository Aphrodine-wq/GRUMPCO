/**
 * Smart Retry with Provider Fallback
 * Automatically retries failed requests with exponential backoff and provider failover
 *
 * Features:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Automatic provider fallback chain
 * - Circuit breaker pattern per provider
 * - Detailed logging and metrics
 * - Integration with provider health monitoring
 */

import logger from "../middleware/logger.js";
import type { LLMProvider, StreamParams, StreamEvent } from "./llmGateway.js";
import { getConfiguredProviders, getProviderConfig } from "./llmGateway.js";

// Lazy import to avoid circular dependency
let providerHealthModule: typeof import("./providerHealth.js") | undefined;

/**
 * Safely get provider health module (lazy loaded to avoid circular deps)
 */
async function getProviderHealth() {
  if (!providerHealthModule) {
    providerHealthModule = await import("./providerHealth.js");
  }
  return providerHealthModule;
}

/**
 * Check if provider is healthy (safe wrapper)
 */
async function isProviderHealthy(provider: LLMProvider): Promise<boolean> {
  try {
    const { providerHealth } = await getProviderHealth();
    return providerHealth?.isHealthy(provider) ?? true;
  } catch {
    return true; // Default to healthy if module not available
  }
}

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  enableJitter: boolean;
  enableProviderFallback: boolean;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,        // Reduced from 3: fail-fast for streaming
  baseDelayMs: 200,      // Reduced from 1000: don't wait a full second  
  maxDelayMs: 10000,     // Reduced from 30000: cap at 10s not 30s
  backoffMultiplier: 2,
  enableJitter: true,
  enableProviderFallback: true,
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

// Provider performance characteristics (fastest → slowest for fallback ordering)
const PROVIDER_SPEED_RANKING: LLMProvider[] = [
  "groq", // Fastest inference (custom silicon)
  "nim", // NVIDIA NIM — fast cloud inference
  "kimi", // Fast long-context
  "github-copilot", // Fast for code generation
  "mistral", // Fast European provider
  "anthropic", // Good balance
  "openrouter", // Variable by model
  "ollama", // Depends on hardware
];

class SmartRetryService {
  private config: RetryConfig;
  private circuitBreakers = new Map<LLMProvider, CircuitBreakerState>();

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a streaming request with smart retry and fallback
   */
  async *executeWithRetry(
    primaryProvider: LLMProvider,
    params: StreamParams,
    streamFn: (
      provider: LLMProvider,
      params: StreamParams,
    ) => AsyncGenerator<StreamEvent>,
    customConfig?: Partial<RetryConfig>,
  ): AsyncGenerator<StreamEvent> {
    const config = { ...this.config, ...customConfig };
    const providers = await this.buildProviderChain(primaryProvider);

    let lastError: Error | null = null;
    let attempt = 0;

    for (const provider of providers) {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(provider)) {
        logger.warn({ provider }, "Circuit breaker open, skipping provider");
        continue;
      }

      // Check provider health if enabled (skip in test environments where providerHealth may not be fully initialized)
      if (config.enableProviderFallback) {
        const healthy = await isProviderHealthy(provider);
        if (!healthy) {
          logger.warn({ provider }, "Provider unhealthy, skipping");
          continue;
        }
      }

      for (
        let providerAttempt = 0;
        providerAttempt < Math.ceil(config.maxAttempts / providers.length);
        providerAttempt++
      ) {
        attempt++;

        try {
          logger.info(
            {
              attempt,
              provider,
              model: params.model,
              maxAttempts: config.maxAttempts,
            },
            "Streaming attempt",
          );

          const startTime = Date.now();
          let _hasYielded = false;
          let tokenCount = 0;

          for await (const event of streamFn(provider, params)) {
            _hasYielded = true;
            tokenCount++;

            // Emit event (metadata tracked separately for metrics)
            yield event;
          }

          // Success! Reset circuit breaker
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.recordSuccess(provider);

          logger.info(
            {
              attempt,
              provider,
              duration: durationSeconds,
              tokenCount,
            },
            "Streaming completed successfully",
          );

          return;
        } catch (error) {
          lastError = error as Error;
          this.recordFailure(provider);

          logger.warn(
            {
              attempt,
              provider,
              error: lastError.message,
              stack: lastError.stack,
            },
            "Streaming attempt failed",
          );

          // Check if we should retry
          const shouldRetry =
            attempt < config.maxAttempts && this.isRetryableError(lastError);

          if (shouldRetry) {
            const delay = this.calculateDelay(attempt, config);
            logger.info(
              { delay, nextAttempt: attempt + 1 },
              "Retrying after delay",
            );
            await this.sleep(delay);
          } else {
            // Move to next provider
            break;
          }
        }
      }
    }

    // All attempts exhausted
    yield {
      type: "error",
      error: `All ${attempt} attempts failed across ${providers.length} providers. Last error: ${lastError?.message}`,
    };
    yield { type: "message_stop" };
  }

  /**
   * Build provider fallback chain
   */
  private async buildProviderChain(
    primary: LLMProvider,
  ): Promise<LLMProvider[]> {
    const chain: LLMProvider[] = [];

    // Add primary if healthy
    const primaryHealthy = await isProviderHealthy(primary);
    if (primaryHealthy && !this.isCircuitBreakerOpen(primary)) {
      chain.push(primary);
    }

    if (this.config.enableProviderFallback) {
      // Add remaining providers sorted by speed, filtered by health
      const otherProviders: LLMProvider[] = [];
      for (const p of PROVIDER_SPEED_RANKING) {
        if (p !== primary) {
          const healthy = await isProviderHealthy(p);
          if (healthy && !this.isCircuitBreakerOpen(p)) {
            otherProviders.push(p);
          }
        }
      }
      chain.push(...otherProviders);

      // If still no providers, try unhealthy ones as last resort
      if (chain.length === 0) {
        const lastResort = PROVIDER_SPEED_RANKING.filter((p) => p !== primary);
        chain.push(...lastResort);
      }
    }

    // Ensure we have at least the primary
    if (chain.length === 0) {
      chain.push(primary);
    }

    return chain;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      "timeout",
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "network error",
      "rate limit",
      "429",
      "503",
      "502",
      "504",
      "fetch failed",
      "connection",
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponential =
      config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const capped = Math.min(exponential, config.maxDelayMs);

    if (config.enableJitter) {
      // Add 0-20% jitter to prevent thundering herd
      const jitter = capped * 0.2 * Math.random();
      return Math.floor(capped + jitter);
    }

    return Math.floor(capped);
  }

  /**
   * Check if circuit breaker is open for a provider
   */
  private isCircuitBreakerOpen(provider: LLMProvider): boolean {
    const state = this.circuitBreakers.get(provider);
    if (!state) return false;

    if (state.isOpen) {
      // Check if we should attempt reset
      if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
        logger.info(
          { provider },
          "Circuit breaker reset timeout elapsed, allowing retry",
        );
        state.isOpen = false;
        state.failures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record successful request
   */
  private recordSuccess(provider: LLMProvider): void {
    const state = this.circuitBreakers.get(provider);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
    }
  }

  /**
   * Record failed request
   */
  private recordFailure(provider: LLMProvider): void {
    let state = this.circuitBreakers.get(provider);

    if (!state) {
      state = { failures: 0, lastFailure: 0, isOpen: false };
      this.circuitBreakers.set(provider, state);
    }

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      logger.warn(
        {
          provider,
          failures: state.failures,
          resetIn: CIRCUIT_BREAKER_RESET_MS / 1000,
        },
        "Circuit breaker opened",
      );
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<
    LLMProvider,
    { isOpen: boolean; failures: number; lastFailure: number }
  > {
    const status = {} as Record<
      LLMProvider,
      { isOpen: boolean; failures: number; lastFailure: number }
    >;

    // Use Array.from to avoid downlevelIteration issues
    Array.from(this.circuitBreakers.entries()).forEach(([provider, state]) => {
      status[provider] = {
        isOpen: state.isOpen,
        failures: state.failures,
        lastFailure: state.lastFailure,
      };
    });

    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
    logger.info("All circuit breakers reset");
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(provider: LLMProvider): void {
    this.circuitBreakers.delete(provider);
    logger.info({ provider }, "Circuit breaker reset");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const smartRetry = new SmartRetryService();

// Export class for testing
export { SmartRetryService };

/**
 * Convenience function for executing with retry
 */
export async function* streamWithRetry(
  provider: LLMProvider,
  params: StreamParams,
  streamFn: (
    provider: LLMProvider,
    params: StreamParams,
  ) => AsyncGenerator<StreamEvent>,
  config?: Partial<RetryConfig>,
): AsyncGenerator<StreamEvent> {
  yield* smartRetry.executeWithRetry(provider, params, streamFn, config);
}

/**
 * Get retry service status
 */
export function getRetryStatus(): {
  circuitBreakers: ReturnType<typeof smartRetry.getCircuitBreakerStatus>;
  config: typeof DEFAULT_RETRY_CONFIG;
} {
  return {
    circuitBreakers: smartRetry.getCircuitBreakerStatus(),
    config: DEFAULT_RETRY_CONFIG,
  };
}
