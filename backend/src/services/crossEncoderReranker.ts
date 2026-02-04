/**
 * Cross-Encoder Re-Ranker for RAG.
 * Upgrades re-ranking from cosine similarity to cross-encoder for better relevance.
 * Pipeline: retrieve top-K (e.g., 20-50) with hybrid -> re-rank with cross-encoder -> top-N to LLM.
 */

import logger from '../middleware/logger.js';
import type { ChunkWithScore } from './vectorStoreAdapter.js';

export interface CrossEncoderRerankerOptions {
  /** External re-ranker URL (POST with { query, documents[] } returns { scores[] or order[] }). */
  url?: string;
  /** Top-K to retrieve before re-ranking. */
  rerankTopK?: number;
  /** Timeout in ms. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Re-rank candidates using an external cross-encoder service.
 * Expects POST { query, documents: string[] } -> { scores?: number[], order?: number[] }
 */
export async function rerankWithCrossEncoder(
  query: string,
  candidates: ChunkWithScore[],
  topK: number,
  options?: CrossEncoderRerankerOptions
): Promise<ChunkWithScore[]> {
  if (candidates.length === 0) return [];
  const url = options?.url ?? process.env.RAG_CROSS_ENCODER_URL;
  if (!url) return candidates.slice(0, topK);

  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        documents: candidates.map((c) => c.chunk.content),
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Cross-encoder re-ranker non-OK response');
      return candidates.slice(0, topK);
    }
    const data = (await res.json()) as { scores?: number[]; order?: number[] };
    const scores = data.scores;
    const order =
      data.order ??
      (scores
        ? scores.map((_, i) => i).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
        : undefined);
    if (!order?.length) return candidates.slice(0, topK);
    const out: ChunkWithScore[] = order
      .slice(0, topK)
      .map((i) => candidates[i])
      .filter((c): c is ChunkWithScore => c !== undefined);
    return out;
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Cross-encoder re-ranker failed');
    return candidates.slice(0, topK);
  }
}
