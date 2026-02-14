/**
 * Predictive RAG - Proactively load context before the user asks.
 *
 * Integrates with predictivePrefetch: when a query pattern predicts a follow-up,
 * pre-embed and pre-retrieve that follow-up. Cache in L1 for near-zero latency.
 */

import type { RagContextResult, GetRagContextOptions, DocType } from './ragService.js';
import { getRagContextForPrompt } from './ragService.js';
import {
  setPrefetchCache as setCache,
  clearPrefetchCache as clearCache,
} from '../caching/ragPrefetchCache.js';

/**
 * Prefetch RAG context for predicted queries. Call when predictivePrefetch predicts follow-ups.
 */
export async function prefetchRagContext(
  predictedQuery: string,
  options?: { namespace?: string; types?: DocType[]; maxChunks?: number }
): Promise<void> {
  try {
    const result = await getRagContextForPrompt(predictedQuery, options as GetRagContextOptions);
    if (result) {
      setCache(predictedQuery, result, options as { types?: string[]; namespace?: string });
    }
  } catch {
    // Prefetch is best-effort
  }
}

/**
 * Record a RAG query for pattern learning (hook for predictivePrefetch).
 */
export function recordRagQuery(query: string, _sessionId?: string): void {
  void query;
}

/** Clear prefetch cache (e.g., when index is rebuilt). */
export const clearPrefetchCache = clearCache;
