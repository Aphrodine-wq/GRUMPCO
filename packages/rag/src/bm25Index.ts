/**
 * BM25 Sparse Index for hybrid retrieval.
 * Complements dense vector search with keyword-based matching.
 * Excels at exact phrases, error codes, API names.
 */

export interface BM25Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BM25IndexOptions {
  /** BM25 k1 parameter (term frequency saturation). Default 1.2. */
  k1?: number;
  /** BM25 b parameter (length normalization). Default 0.75. */
  b?: number;
}

const DEFAULT_K1 = 1.2;
const DEFAULT_B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * BM25 sparse index. Build index from documents, query with keywords.
 */
export class BM25Index {
  private documents: BM25Document[] = [];
  private docLengths: number[] = [];
  private avgDocLength = 0;
  private termDocFreq: Map<string, Map<number, number>> = new Map();
  private docFreq: Map<string, number> = new Map();
  private k1: number;
  private b: number;

  constructor(options?: BM25IndexOptions) {
    this.k1 = options?.k1 ?? DEFAULT_K1;
    this.b = options?.b ?? DEFAULT_B;
  }

  /**
   * Add documents to the index. Rebuilds the full index.
   */
  addDocuments(docs: BM25Document[]): void {
    this.documents = docs;
    this.docLengths = docs.map((d) => tokenize(d.content).length);
    this.avgDocLength =
      this.docLengths.length > 0
        ? this.docLengths.reduce((a, b) => a + b, 0) / this.docLengths.length
        : 0;
    this.termDocFreq = new Map();
    this.docFreq = new Map();

    for (let i = 0; i < docs.length; i++) {
      const terms = tokenize(docs[i].content);
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

  /**
   * Query the index. Returns doc indices and BM25 scores, sorted by score descending.
   */
  search(query: string, topK = 20): Array<{ docIndex: number; score: number }> {
    const terms = [...new Set(tokenize(query))].filter((t) => t.length > 1);
    if (terms.length === 0 || this.documents.length === 0) return [];

    const n = this.documents.length;
    const scores = new Map<number, number>();

    for (const term of terms) {
      const df = this.docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const postings = this.termDocFreq.get(term);
      if (!postings) continue;

      for (const [docIdx, tf] of postings) {
        const docLen = this.docLengths[docIdx] ?? 1;
        const norm = 1 - this.b + (this.b * docLen) / (this.avgDocLength || 1);
        const bm25 = (idf * (tf * (this.k1 + 1))) / (tf + this.k1 * norm);
        scores.set(docIdx, (scores.get(docIdx) ?? 0) + bm25);
      }
    }

    return Array.from(scores.entries())
      .map(([docIndex, score]) => ({ docIndex, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Get document by index. */
  getDocument(docIndex: number): BM25Document | undefined {
    return this.documents[docIndex];
  }

  /** Number of indexed documents. */
  get size(): number {
    return this.documents.length;
  }
}
