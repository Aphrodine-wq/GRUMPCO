/**
 * @fileoverview Provider Health Monitoring
 *
 * Monitors the health of all configured AI providers:
 * - Ping each provider periodically
 * - Track success rates
 * - Auto-disable failing providers
 * - Re-enable when healthy
 *
 * @module services/providerHealth
 */

import logger from "../../middleware/logger.js";
import { env } from "../../config/env.js";
import {
  type LLMProvider,
  getConfiguredProviders,
  getProviderConfig,
  getApiKeyForProvider,
} from "./llmGateway.js";

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Health status for a provider */
export interface ProviderHealth {
  provider: LLMProvider;
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  lastCheck: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  errorRate: number;
}

/** Health check configuration */
interface HealthCheckConfig {
  checkIntervalMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  degradedThreshold: number;
  autoDisable: boolean;
  autoEnable: boolean;
  maxLatencyMs: number;
}

/** Health check result */
interface HealthCheckResult {
  provider: LLMProvider;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: HealthCheckConfig = {
  checkIntervalMs: 60000, // 1 minute
  failureThreshold: 5,
  recoveryThreshold: 3,
  degradedThreshold: 2,
  autoDisable: true,
  autoEnable: true,
  maxLatencyMs: 30000, // 30 seconds
};

/** Provider endpoints for health checks */
const HEALTH_CHECK_ENDPOINTS: Record<Exclude<LLMProvider, "mock">, string> = {
  nim:
    env.NVIDIA_NIM_URL?.replace("/chat/completions", "/models") ??
    "https://integrate.api.nvidia.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  ollama: `${env.OLLAMA_BASE_URL}/api/tags`,
  "github-copilot": "https://api.githubcopilot.com/models",
  kimi: "https://api.moonshot.cn/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  jan: `${process.env.JAN_BASE_URL || "http://localhost:1337"}/v1/models`,
  google: "https://generativelanguage.googleapis.com/v1beta/openai/models",
  grump: "https://integrate.api.nvidia.com/v1/models", // meta-provider, uses sub-provider health
};

// =============================================================================
// Provider Health Service
// =============================================================================

class ProviderHealthService {
  private healthStatus = new Map<LLMProvider, ProviderHealth>();
  private config: HealthCheckConfig;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private enabledProviders = new Set<LLMProvider>();

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeHealthStatus();
  }

  /**
   * Initialize health status for all configured providers.
   */
  private initializeHealthStatus(): void {
    const providers = getConfiguredProviders();

    for (const provider of providers) {
      this.healthStatus.set(provider, {
        provider,
        status: "healthy",
        lastCheck: 0,
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatencyMs: 0,
        errorRate: 0,
      });
      this.enabledProviders.add(provider);
    }

    logger.info(
      { providers: Array.from(providers) },
      "Provider health service initialized",
    );
  }

  /**
   * Start periodic health checks.
   */
  startHealthChecks(): void {
    if (this.checkInterval) {
      logger.warn("Health checks already running");
      return;
    }

    // Run initial check
    this.runHealthChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkIntervalMs);

    logger.info(
      { intervalMs: this.config.checkIntervalMs },
      "Provider health checks started",
    );
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("Provider health checks stopped");
    }
  }

  /**
   * Run health checks for all configured providers.
   */
  private async runHealthChecks(): Promise<void> {
    const providers = Array.from(this.enabledProviders);

    logger.debug("Running health checks");

    const results = await Promise.allSettled(
      providers.map((provider) => this.checkProvider(provider)),
    );

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const result = results[i];

      if (result.status === "fulfilled") {
        this.updateHealthStatus(provider, result.value);
      } else {
        this.updateHealthStatus(provider, {
          provider,
          healthy: false,
          latencyMs: 0,
          error: result.reason?.message || "Unknown error",
        });
      }
    }
  }

  /**
   * Check the health of a single provider.
   */
  private async checkProvider(
    provider: LLMProvider,
  ): Promise<HealthCheckResult> {
    if (provider === "mock") {
      return { provider, healthy: true, latencyMs: 0 };
    }

    const endpoint = HEALTH_CHECK_ENDPOINTS[provider];
    const config = getProviderConfig(provider);

    if (!endpoint || !config) {
      return {
        provider,
        healthy: false,
        latencyMs: 0,
        error: "No endpoint configured",
      };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.maxLatencyMs,
      );

      const headers: Record<string, string> = {};
      if (config.apiKeyEnvVar) {
        const apiKey = getApiKeyForProvider(provider);
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          provider,
          healthy: false,
          latencyMs,
          error: `HTTP ${response.status}: ${await response.text().catch(() => "Unknown error")}`,
        };
      }

      return { provider, healthy: true, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        provider,
        healthy: false,
        latencyMs,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update health status based on check result.
   */
  private updateHealthStatus(
    provider: LLMProvider,
    result: HealthCheckResult,
  ): void {
    const current = this.healthStatus.get(provider);
    if (!current) return;

    const now = Date.now();
    const updated: ProviderHealth = {
      ...current,
      lastCheck: now,
      totalRequests: current.totalRequests + 1,
    };

    if (result.healthy) {
      updated.successfulRequests++;
      updated.lastSuccess = now;
      updated.consecutiveFailures = 0;

      // Update average latency
      updated.averageLatencyMs =
        (current.averageLatencyMs * current.totalRequests + result.latencyMs) /
        (current.totalRequests + 1);

      // Check if provider should recover from degraded/unhealthy
      if (
        (current.status === "unhealthy" || current.status === "degraded") &&
        this.config.autoEnable
      ) {
        const recentSuccesses = this.countRecentSuccesses(provider);
        if (recentSuccesses >= this.config.recoveryThreshold) {
          updated.status = "healthy";
          logger.info({ provider }, "Provider recovered to healthy status");
        }
      }
    } else {
      updated.failedRequests++;
      updated.lastFailure = now;
      updated.consecutiveFailures = current.consecutiveFailures + 1;

      // Check if provider should be marked as degraded
      if (
        current.status === "healthy" &&
        updated.consecutiveFailures >= this.config.degradedThreshold
      ) {
        updated.status = "degraded";
        logger.warn(
          { provider, consecutiveFailures: updated.consecutiveFailures },
          "Provider marked as degraded",
        );
      }

      // Check if provider should be disabled
      if (
        updated.consecutiveFailures >= this.config.failureThreshold &&
        this.config.autoDisable
      ) {
        updated.status = "unhealthy";
        this.enabledProviders.delete(provider);
        logger.error(
          { provider, consecutiveFailures: updated.consecutiveFailures },
          "Provider marked as unhealthy and disabled",
        );
      }
    }

    // Calculate error rate (last 100 requests)
    updated.errorRate =
      updated.totalRequests > 0
        ? updated.failedRequests / updated.totalRequests
        : 0;

    this.healthStatus.set(provider, updated);
  }

  /**
   * Count recent successful checks for recovery logic.
   */
  private countRecentSuccesses(provider: LLMProvider): number {
    const status = this.healthStatus.get(provider);
    if (!status || !status.lastSuccess) return 0;

    // Simple heuristic: if last failure was a while ago, we're recovering
    const timeSinceLastFailure = status.lastFailure
      ? Date.now() - status.lastFailure
      : Infinity;

    return timeSinceLastFailure > this.config.checkIntervalMs * 2 ? 1 : 0;
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Get health status for all providers.
   */
  getAllHealth(): ProviderHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health status for a specific provider.
   */
  getProviderHealth(provider: LLMProvider): ProviderHealth | undefined {
    return this.healthStatus.get(provider);
  }

  /**
   * Check if a provider is healthy and enabled.
   */
  isHealthy(provider: LLMProvider): boolean {
    const status = this.healthStatus.get(provider);
    // If no status recorded, assume healthy and enabled (lazy initialization)
    if (!status) {
      return true;
    }
    return status.status === "healthy" && this.enabledProviders.has(provider);
  }

  /**
   * Check if a provider is enabled.
   */
  isEnabled(provider: LLMProvider): boolean {
    return this.enabledProviders.has(provider);
  }

  /**
   * Get all enabled providers.
   */
  getEnabledProviders(): LLMProvider[] {
    return Array.from(this.enabledProviders);
  }

  /**
   * Get all healthy providers.
   */
  getHealthyProviders(): LLMProvider[] {
    return this.getAllHealth()
      .filter(
        (h) => h.status === "healthy" && this.enabledProviders.has(h.provider),
      )
      .map((h) => h.provider);
  }

  /**
   * Manually disable a provider.
   */
  disableProvider(provider: LLMProvider): void {
    this.enabledProviders.delete(provider);
    const status = this.healthStatus.get(provider);
    if (status) {
      status.status = "disabled";
      this.healthStatus.set(provider, status);
    }
    logger.info({ provider }, "Provider manually disabled");
  }

  /**
   * Manually enable a provider.
   */
  enableProvider(provider: LLMProvider): void {
    if (!getConfiguredProviders().includes(provider)) {
      logger.warn({ provider }, "Cannot enable provider - not configured");
      return;
    }

    this.enabledProviders.add(provider);
    const status = this.healthStatus.get(provider);
    if (status) {
      status.status = "healthy";
      status.consecutiveFailures = 0;
      this.healthStatus.set(provider, status);
    }
    logger.info({ provider }, "Provider manually enabled");
  }

  /**
   * Force a health check for a provider.
   */
  async forceCheck(provider: LLMProvider): Promise<ProviderHealth | undefined> {
    const result = await this.checkProvider(provider);
    this.updateHealthStatus(provider, result);
    return this.healthStatus.get(provider);
  }

  /**
   * Reset health status for a provider.
   */
  resetProvider(provider: LLMProvider): void {
    const config = getProviderConfig(provider);
    this.healthStatus.set(provider, {
      provider,
      status: "healthy",
      lastCheck: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      errorRate: 0,
    });
    this.enabledProviders.add(provider);
    logger.info({ provider }, "Provider health reset");
  }

  /**
   * Get health check configuration.
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Update health check configuration.
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, "Health check config updated");
  }

  /**
   * Get a summary of all provider health.
   */
  getSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    disabled: number;
    enabled: number;
  } {
    const statuses = this.getAllHealth();
    return {
      total: statuses.length,
      healthy: statuses.filter((s) => s.status === "healthy").length,
      degraded: statuses.filter((s) => s.status === "degraded").length,
      unhealthy: statuses.filter((s) => s.status === "unhealthy").length,
      disabled: statuses.filter((s) => s.status === "disabled").length,
      enabled: this.enabledProviders.size,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const providerHealth = new ProviderHealthService();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Start health monitoring.
 */
export function startHealthMonitoring(): void {
  providerHealth.startHealthChecks();
}

/**
 * Stop health monitoring.
 */
export function stopHealthMonitoring(): void {
  providerHealth.stopHealthChecks();
}

/**
 * Get health status for all providers.
 */
export function getAllProviderHealth(): ProviderHealth[] {
  return providerHealth.getAllHealth();
}

/**
 * Check if a provider is healthy.
 */
export function isProviderHealthy(provider: LLMProvider): boolean {
  return providerHealth.isHealthy(provider);
}

/**
 * Get healthy providers for routing.
 */
export function getHealthyProvidersForRouting(): LLMProvider[] {
  return providerHealth.getHealthyProviders();
}

/**
 * Filter providers by health status for routing.
 */
export function filterHealthyProviders(
  providers: LLMProvider[],
): LLMProvider[] {
  return providers.filter((p) => providerHealth.isHealthy(p));
}
