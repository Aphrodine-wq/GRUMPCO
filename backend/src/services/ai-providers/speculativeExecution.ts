/**
 * Speculative Execution Engine
 * Predicts and executes user requests before they're confirmed
 *
 * Features:
 * - Intent prediction based on typing patterns
 * - Parallel speculative execution
 * - Cache speculation results
 * - Cancel on actual request diverge
 */

import { getTieredCache } from '../caching/tieredCache.js';
import logger from '../../middleware/logger.js';
import type { LLMProvider, StreamParams, StreamEvent } from './llmGateway.js';

interface Speculation {
  id: string;
  predictedIntent: string;
  params: StreamParams;
  provider: LLMProvider;
  promise: Promise<StreamEvent[]>;
  timestamp: number;
  confidence: number;
  aborted: boolean;
}

interface PredictionResult {
  intent: string;
  confidence: number;
  params: Partial<StreamParams>;
}

class SpeculativeExecutionEngine {
  private activeSpeculations = new Map<string, Speculation>();
  private cache = getTieredCache();
  private readonly maxSpeculations = 5;
  private readonly speculationTTL = 10000; // 10 seconds
  private readonly minConfidence = 0.6;

  /**
   * Analyze user input and predict intent
   */
  predictIntent(
    input: string,
    _context: string[],
    _cursorPosition: number
  ): PredictionResult | null {
    // Don't speculate on very short inputs
    if (input.length < 10) return null;

    const predictions: PredictionResult[] = [];

    // Pattern 1: Code generation intent
    if (this.isCodeGenerationIntent(input)) {
      predictions.push({
        intent: 'codegen',
        confidence: 0.85,
        params: {
          system: 'You are a code generation assistant. Generate clean, production-ready code.',
          max_tokens: 2000,
        },
      });
    }

    // Pattern 2: Explanation intent
    if (this.isExplanationIntent(input)) {
      predictions.push({
        intent: 'explain',
        confidence: 0.75,
        params: {
          system: 'Explain the following in clear, concise terms.',
          max_tokens: 1000,
        },
      });
    }

    // Pattern 3: Debug intent
    if (this.isDebugIntent(input)) {
      predictions.push({
        intent: 'debug',
        confidence: 0.8,
        params: {
          system: 'Help debug this issue. Identify the problem and suggest fixes.',
          max_tokens: 1500,
        },
      });
    }

    // Pattern 4: Refactor intent
    if (this.isRefactorIntent(input)) {
      predictions.push({
        intent: 'refactor',
        confidence: 0.78,
        params: {
          system: 'Refactor this code to improve readability, performance, and maintainability.',
          max_tokens: 2000,
        },
      });
    }

    // Return highest confidence prediction
    return predictions.length > 0
      ? predictions.sort((a, b) => b.confidence - a.confidence)[0]
      : null;
  }

  /**
   * Start speculative execution
   */
  async speculate(
    userId: string,
    predictedIntent: string,
    partialInput: string,
    streamFn: (params: StreamParams) => AsyncGenerator<StreamEvent>
  ): Promise<string | null> {
    // Check if we already have a speculation for this
    const cacheKey = `spec:${userId}:${this.hashInput(partialInput)}`;
    const existing = this.activeSpeculations.get(cacheKey);

    if (existing && !existing.aborted) {
      return existing.id;
    }

    // Limit active speculations
    if (this.activeSpeculations.size >= this.maxSpeculations) {
      this.cleanupOldestSpeculation();
    }

    // Build prediction parameters
    const params: StreamParams = {
      model: 'moonshotai/kimi-k2.5', // Fast model for speculation
      max_tokens: 1500,
      system: 'Generate a quick preliminary response.',
      messages: [{ role: 'user', content: partialInput }],
    };

    const speculation: Speculation = {
      id: cacheKey,
      predictedIntent,
      params,
      provider: 'nim', // Primary provider
      promise: this.executeSpeculation(streamFn, params, cacheKey),
      timestamp: Date.now(),
      confidence: 0.7,
      aborted: false,
    };

    this.activeSpeculations.set(cacheKey, speculation);

    logger.debug(
      {
        id: speculation.id,
        intent: predictedIntent,
        confidence: speculation.confidence,
      },
      'Started speculative execution'
    );

    return speculation.id;
  }

  /**
   * Execute speculation in background
   */
  private async executeSpeculation(
    streamFn: (params: StreamParams) => AsyncGenerator<StreamEvent>,
    params: StreamParams,
    cacheKey: string
  ): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    const speculation = this.activeSpeculations.get(cacheKey);

    if (!speculation) return events;

    try {
      for await (const event of streamFn(params)) {
        if (speculation.aborted) {
          logger.debug({ cacheKey }, 'Speculation aborted');
          return events;
        }

        events.push(event);

        // Limit speculation size
        if (events.length > 100) break;
      }

      // Cache successful speculation
      if (events.length > 0 && !speculation.aborted) {
        await this.cache.set('speculation', cacheKey, events, 60); // 1 min cache
      }

      return events;
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Speculation failed');
      return events;
    }
  }

  /**
   * Retrieve speculation result if available
   */
  async getSpeculationResult(speculationId: string): Promise<StreamEvent[] | null> {
    // Check active speculations
    const active = this.activeSpeculations.get(speculationId);
    if (active && !active.aborted) {
      const events = await active.promise;

      // If we got results, cache and return
      if (events.length > 0) {
        return events;
      }
    }

    // Check cache
    const cached = await this.cache.get<StreamEvent[]>('speculation', speculationId);
    if (cached) {
      logger.debug({ speculationId }, 'Retrieved speculation from cache');
      return cached;
    }

    return null;
  }

  /**
   * Cancel a speculation
   */
  cancelSpeculation(speculationId: string): void {
    const speculation = this.activeSpeculations.get(speculationId);
    if (speculation) {
      speculation.aborted = true;
      this.activeSpeculations.delete(speculationId);
      logger.debug({ speculationId }, 'Cancelled speculation');
    }
  }

  /**
   * Cancel all speculations for a user
   */
  cancelUserSpeculations(userId: string): void {
    for (const [id, speculation] of this.activeSpeculations.entries()) {
      if (id.startsWith(`spec:${userId}:`)) {
        speculation.aborted = true;
        this.activeSpeculations.delete(id);
      }
    }
  }

  /**
   * Check if speculation matches actual request
   */
  isSpeculationValid(speculationId: string, actualInput: string): boolean {
    const speculation = this.activeSpeculations.get(speculationId);
    if (!speculation) return false;

    // Check if input diverged significantly
    const content = speculation.params.messages[0]?.content;
    const textContent = typeof content === 'string' ? content : '';
    const similarity = this.calculateSimilarity(textContent, actualInput);

    return similarity > 0.8;
  }

  /**
   * Cleanup oldest speculation when at capacity
   */
  private cleanupOldestSpeculation(): void {
    let oldest: Speculation | null = null;
    let oldestKey = '';

    for (const [key, speculation] of this.activeSpeculations.entries()) {
      if (!oldest || speculation.timestamp < oldest.timestamp) {
        oldest = speculation;
        oldestKey = key;
      }
    }

    if (oldest) {
      oldest.aborted = true;
      this.activeSpeculations.delete(oldestKey);
    }
  }

  /**
   * Periodic cleanup of old speculations
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, speculation] of this.activeSpeculations.entries()) {
      if (now - speculation.timestamp > this.speculationTTL) {
        speculation.aborted = true;
        this.activeSpeculations.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up old speculations');
    }
  }

  // Intent detection helpers
  private isCodeGenerationIntent(input: string): boolean {
    const patterns = [
      /write|create|generate|implement/i,
      /function|class|component/i,
      /code|script/i,
      /\b\w+\s*\(.*\)\s*{/,
    ];
    return patterns.some((p) => p.test(input));
  }

  private isExplanationIntent(input: string): boolean {
    const patterns = [/explain|how|what|why/i, /understand|clarify/i, /mean|does/i];
    return patterns.some((p) => p.test(input));
  }

  private isDebugIntent(input: string): boolean {
    const patterns = [
      /debug|fix|error|bug|issue/i,
      /not working|broken|fails/i,
      /exception|crash/i,
    ];
    return patterns.some((p) => p.test(input));
  }

  private isRefactorIntent(input: string): boolean {
    const patterns = [
      /refactor|improve|optimize|clean/i,
      /better|simpler|shorter/i,
      /rename|restructure/i,
    ];
    return patterns.some((p) => p.test(input));
  }

  private calculateSimilarity(a: string, b: string): number {
    // Simple Jaccard similarity
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  private hashInput(input: string): string {
    return input
      .slice(0, 50)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  getStats(): {
    activeSpeculations: number;
    maxSpeculations: number;
  } {
    return {
      activeSpeculations: this.activeSpeculations.size,
      maxSpeculations: this.maxSpeculations,
    };
  }
}

// Singleton instance
export const speculativeEngine = new SpeculativeExecutionEngine();

// Export class for testing
export { SpeculativeExecutionEngine };

// Start periodic cleanup
setInterval(() => {
  speculativeEngine.cleanup();
}, 30000);
