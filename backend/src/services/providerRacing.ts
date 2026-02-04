/**
 * Parallel Provider Racing
 * Sends requests to multiple providers simultaneously, returns fastest response
 *
 * Features:
 * - Race multiple providers
 * - Cancel slow responses
 * - Automatic winner caching
 * - Provider performance tracking
 */

import { connectionPool as _connectionPool } from "./connectionPool.js";
import { getTieredCache } from "./tieredCache.js";
import logger from "../middleware/logger.js";
import type { LLMProvider, StreamParams, StreamEvent } from "./llmGateway.js";

interface RaceResult {
  provider: LLMProvider;
  events: StreamEvent[];
  timeToFirstByte: number;
  totalTime: number;
}

interface ProviderPerformance {
  wins: number;
  totalRequests: number;
  avgTimeToFirstByte: number;
  lastUsed: number;
}

class ProviderRacingService {
  private cache = getTieredCache();
  private performanceMetrics = new Map<LLMProvider, ProviderPerformance>();
  private readonly maxRacers = 3; // Race top 3 providers

  /**
   * Race multiple providers and return the fastest
   */
  async race(
    providers: LLMProvider[],
    params: StreamParams,
    streamFn: (
      provider: LLMProvider,
      params: StreamParams,
    ) => AsyncGenerator<StreamEvent>,
  ): Promise<RaceResult> {
    // Select top providers to race
    const racers = this.selectRacers(providers);

    logger.info(
      {
        racers,
        model: params.model,
      },
      "Starting provider race",
    );

    const _startTime = Date.now();
    const abortControllers = new Map<LLMProvider, AbortController>();

    // Create abort controllers for each racer
    racers.forEach((provider) => {
      abortControllers.set(provider, new AbortController());
    });

    // Race all providers
    const racePromises = racers.map(
      async (provider): Promise<RaceResult | null> => {
        const providerStart = Date.now();
        let timeToFirstByte = 0;
        const events: StreamEvent[] = [];

        try {
          for await (const event of streamFn(provider, params)) {
            if (timeToFirstByte === 0) {
              timeToFirstByte = Date.now() - providerStart;
            }

            events.push(event);

            // Check if we should abort (another provider won)
            const abortController = abortControllers.get(provider);
            if (abortController?.signal.aborted) {
              logger.debug({ provider }, "Aborting slow provider");
              return null;
            }

            // Stop after first few events if another provider is winning
            if (events.length > 5) {
              // Let it continue, but track
            }
          }

          const totalTime = Date.now() - providerStart;

          return {
            provider,
            events,
            timeToFirstByte,
            totalTime,
          };
        } catch (error) {
          logger.warn(
            { provider, error: (error as Error).message },
            "Provider failed in race",
          );
          return null;
        }
      },
    );

    // Wait for first successful result
    let winner: RaceResult | null = null;

    while (racePromises.length > 0 && !winner) {
      const result = await Promise.race(racePromises);

      if (result) {
        winner = result;

        // Abort other providers
        for (const [provider, controller] of abortControllers.entries()) {
          if (provider !== winner.provider) {
            controller.abort();
          }
        }

        break;
      }

      // Remove completed promise and continue
      racePromises.shift();
    }

    if (!winner) {
      throw new Error("All providers failed in race");
    }

    // Update performance metrics
    this.updateMetrics(winner);

    // Cache winner for future requests
    await this.cacheWinner(params, winner);

    logger.info(
      {
        winner: winner.provider,
        timeToFirstByte: winner.timeToFirstByte,
        totalTime: winner.totalTime,
        racers: racers.length,
      },
      "Provider race completed",
    );

    return winner;
  }

  /**
   * Select top providers to race based on performance history
   */
  private selectRacers(available: LLMProvider[]): LLMProvider[] {
    // Score each provider
    const scored = available.map((provider) => {
      const perf = this.performanceMetrics.get(provider);
      if (!perf) {
        // New provider, give it a chance
        return { provider, score: 100 };
      }

      // Calculate score based on win rate and speed
      const winRate = perf.wins / Math.max(1, perf.totalRequests);
      const speedScore = 1000 / Math.max(1, perf.avgTimeToFirstByte);

      return {
        provider,
        score: winRate * 50 + speedScore * 50,
      };
    });

    // Sort by score and take top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxRacers)
      .map((s) => s.provider);
  }

  /**
   * Update performance metrics for a provider
   */
  private updateMetrics(winner: RaceResult): void {
    const perf = this.performanceMetrics.get(winner.provider) || {
      wins: 0,
      totalRequests: 0,
      avgTimeToFirstByte: 0,
      lastUsed: Date.now(),
    };

    perf.wins++;
    perf.totalRequests++;
    perf.avgTimeToFirstByte =
      (perf.avgTimeToFirstByte * (perf.totalRequests - 1) +
        winner.timeToFirstByte) /
      perf.totalRequests;
    perf.lastUsed = Date.now();

    this.performanceMetrics.set(winner.provider, perf);
  }

  /**
   * Cache winner for future identical requests
   */
  private async cacheWinner(
    params: StreamParams,
    winner: RaceResult,
  ): Promise<void> {
    const cacheKey = this.createCacheKey(params);

    await this.cache.set(
      "race-winner",
      cacheKey,
      {
        provider: winner.provider,
        timestamp: Date.now(),
      },
      300,
    ); // 5 min cache
  }

  /**
   * Get cached winner for params
   */
  async getCachedWinner(params: StreamParams): Promise<LLMProvider | null> {
    const cacheKey = this.createCacheKey(params);
    const cached = await this.cache.get<{
      provider: LLMProvider;
      timestamp: number;
    }>("race-winner", cacheKey);

    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 min
      return cached.provider;
    }

    return null;
  }

  /**
   * Create cache key from params
   */
  private createCacheKey(params: StreamParams): string {
    const content =
      typeof params.messages[0]?.content === "string"
        ? params.messages[0].content
        : "";
    return content.slice(0, 100).replace(/[^a-zA-Z0-9]/g, "");
  }

  /**
   * Get performance statistics
   */
  getStats(): Record<LLMProvider, ProviderPerformance> {
    const stats = {} as Record<LLMProvider, ProviderPerformance>;

    for (const [provider, perf] of this.performanceMetrics.entries()) {
      stats[provider] = perf;
    }

    return stats;
  }
}

// Singleton instance
export const providerRacing = new ProviderRacingService();

// Export class for testing
export { ProviderRacingService };
