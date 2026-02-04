/**
 * ColBERT-Style Late Interaction Retriever
 *
 * Multi-vector per chunk with MaxSim scoring for better retrieval quality.
 * Falls back to single-vector when multi-vector embeddings unavailable.
 */

type DocType = 'doc' | 'code' | 'spec' | 'grump';

export interface MultiVectorChunk {
  id: string;
  content: string;
  source: string;
  type: DocType;
  /** Token/sentence-level embeddings. When empty, use single embedding. */
  tokenEmbeddings?: number[][];
  /** Fallback: single chunk embedding. */
  embedding: number[];
}

export interface ColBERTRetrieverOptions {
  /** Max tokens per sub-chunk when splitting for multi-vector. Default 64. */
  tokenChunkSize?: number;
  /** Use single-vector fallback. Default true when no multi-vector provider. */
  fallbackToSingleVector?: boolean;
}

/**
 * MaxSim scoring: for each query token, max similarity over passage tokens;
 * sum over query tokens, optionally normalize.
 */
export function maxSimScore(
  queryEmbeddings: number[][],
  passageEmbeddings: number[][]
): number {
  if (queryEmbeddings.length === 0 || passageEmbeddings.length === 0) return 0;

  let total = 0;
  for (const qEmb of queryEmbeddings) {
    let maxSim = -Infinity;
    for (const pEmb of passageEmbeddings) {
      const sim = cosineSim(qEmb, pEmb);
      if (sim > maxSim) maxSim = sim;
    }
    total += maxSim;
  }
  return total / queryEmbeddings.length;
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

/**
 * Split text into sentence-level chunks for multi-vector embedding.
 */
export function splitIntoSentences(text: string, maxTokens = 64): string[] {
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const result: string[] = [];
  let current = '';
  let tokenCount = 0;

  for (const s of sentences) {
    const tokens = s.split(/\s+/).length;
    if (tokenCount + tokens > maxTokens && current) {
      result.push(current.trim());
      current = s;
      tokenCount = tokens;
    } else {
      current = current ? `${current} ${s}` : s;
      tokenCount += tokens;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result.length > 0 ? result : [text];
}

/**
 * ColBERT-style retriever. Uses multi-vector when available, else single-vector.
 */
export class ColBERTRetriever {
  private chunks: MultiVectorChunk[] = [];
  private fallbackToSingle: boolean;

  constructor(options?: ColBERTRetrieverOptions) {
    this.fallbackToSingle = options?.fallbackToSingleVector ?? true;
  }

  addChunks(chunks: MultiVectorChunk[]): void {
    this.chunks = chunks;
  }

  /**
   * Score query vs chunks. Uses MaxSim when both have token embeddings, else cosine.
   */
  search(
    queryEmbedding: number[],
    queryTokenEmbeddings?: number[][],
    topK = 10
  ): Array<{ chunk: MultiVectorChunk; score: number }> {
    const useMaxSim =
      queryTokenEmbeddings &&
      queryTokenEmbeddings.length > 0 &&
      this.chunks.some((c) => c.tokenEmbeddings && c.tokenEmbeddings.length > 0);

    const results = this.chunks.map((chunk) => {
      let score: number;
      if (useMaxSim && chunk.tokenEmbeddings && chunk.tokenEmbeddings.length > 0) {
        score = maxSimScore(queryTokenEmbeddings!, chunk.tokenEmbeddings);
      } else {
        score = cosineSim(queryEmbedding, chunk.embedding);
      }
      return { chunk, score };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
