/**
 * BM25 Sparse Index for hybrid RAG retrieval.
 * Complements dense vector search with keyword-based matching.
 */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export interface BM25Chunk {
  id: string;
  content: string;
  source: string;
  type: string;
}

export interface BM25SearchResult {
  chunk: BM25Chunk;
  score: number;
}

const K1 = 1.2;
const B = 0.75;

/**
 * In-memory BM25 index over RAG chunks.
 */
export class BM25ChunkIndex {
  private chunks: BM25Chunk[] = [];
  private docLengths: number[] = [];
  private avgDocLength = 0;
  private termDocFreq = new Map<string, Map<number, number>>();
  private docFreq = new Map<string, number>();

  addChunks(chunks: BM25Chunk[]): void {
    this.chunks = chunks;
    this.docLengths = chunks.map((c) => tokenize(c.content).length);
    this.avgDocLength =
      this.docLengths.length > 0
        ? this.docLengths.reduce((a, b) => a + b, 0) / this.docLengths.length
        : 0;
    this.termDocFreq = new Map();
    this.docFreq = new Map();

    for (let i = 0; i < chunks.length; i++) {
      const terms = tokenize(chunks[i].content);
      const termCount = new Map<string, number>();
      for (const t of terms) {
        termCount.set(t, (termCount.get(t) ?? 0) + 1);
      }
      for (const [term, count] of termCount) {
        if (!this.termDocFreq.has(term)) {
          this.termDocFreq.set(term, new Map());
        }
        this.termDocFreq.get(term)!.set(i, count);
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }
  }

  search(query: string, topK: number): BM25SearchResult[] {
    const terms = [...new Set(tokenize(query))].filter((t) => t.length > 1);
    if (terms.length === 0 || this.chunks.length === 0) return [];

    const n = this.chunks.length;
    const scores = new Map<number, number>();

    for (const term of terms) {
      const df = this.docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const postings = this.termDocFreq.get(term);
      if (!postings) continue;

      for (const [docIdx, tf] of postings) {
        const docLen = this.docLengths[docIdx] ?? 1;
        const norm = 1 - B + (B * docLen) / (this.avgDocLength || 1);
        const bm25 = (idf * (tf * (K1 + 1))) / (tf + K1 * norm);
        scores.set(docIdx, (scores.get(docIdx) ?? 0) + bm25);
      }
    }

    return Array.from(scores.entries())
      .map(([docIndex, score]) => ({ chunk: this.chunks[docIndex], score }))
      .filter((r) => r.chunk)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  get size(): number {
    return this.chunks.length;
  }
}
