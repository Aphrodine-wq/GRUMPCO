/**
 * @grump/rag - Vector store and RAG implementation for G-Rump.
 * Provides multiple vector store adapters and document chunking utilities.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type DocType = 'doc' | 'code' | 'spec' | 'grump';

export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  type: DocType;
  metadata?: Record<string, unknown>;
}

export interface VectorQueryOptions {
  topK?: number;
  types?: DocType | DocType[];
  namespace?: string;
  threshold?: number;
}

export interface ChunkWithScore {
  chunk: VectorChunk;
  score: number;
}

export interface IVectorStore {
  query(embedding: number[], options?: VectorQueryOptions): Promise<ChunkWithScore[]>;
  upsert(chunks: VectorChunk[]): Promise<void>;
  delete(ids: string[]): Promise<void>;
  clear?(namespace?: string): Promise<void>;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export interface Document {
  id?: string;
  content: string;
  source: string;
  type: DocType;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// In-Memory Vector Store
// ============================================================================

/**
 * Simple in-memory vector store for development and testing.
 * Uses cosine similarity for matching.
 */
export class InMemoryVectorStore implements IVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private namespaces: Map<string, Set<string>> = new Map();

  async query(
    embedding: number[],
    options: VectorQueryOptions = {}
  ): Promise<ChunkWithScore[]> {
    const { topK = 10, types, namespace, threshold = 0 } = options;

    const typeFilter = types
      ? Array.isArray(types)
        ? new Set(types)
        : new Set([types])
      : null;

    const namespaceIds = namespace
      ? this.namespaces.get(namespace) || new Set()
      : null;

    const results: ChunkWithScore[] = [];

    for (const chunk of this.chunks.values()) {
      // Apply filters
      if (typeFilter && !typeFilter.has(chunk.type)) continue;
      if (namespaceIds && !namespaceIds.has(chunk.id)) continue;

      const score = this.cosineSimilarity(embedding, chunk.embedding);
      if (score >= threshold) {
        results.push({ chunk, score });
      }
    }

    // Sort by score descending and take topK
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async upsert(chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);

      // Index by namespace if metadata.namespace exists
      const ns = chunk.metadata?.namespace as string | undefined;
      if (ns) {
        if (!this.namespaces.has(ns)) {
          this.namespaces.set(ns, new Set());
        }
        this.namespaces.get(ns)!.add(chunk.id);
      }
    }
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.chunks.delete(id);
      // Remove from namespace indices
      for (const nsIds of this.namespaces.values()) {
        nsIds.delete(id);
      }
    }
  }

  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      const ids = this.namespaces.get(namespace);
      if (ids) {
        for (const id of ids) {
          this.chunks.delete(id);
        }
        this.namespaces.delete(namespace);
      }
    } else {
      this.chunks.clear();
      this.namespaces.clear();
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /** Get stats about the store */
  getStats(): { totalChunks: number; namespaces: string[] } {
    return {
      totalChunks: this.chunks.size,
      namespaces: Array.from(this.namespaces.keys()),
    };
  }
}

// ============================================================================
// Document Chunker
// ============================================================================

/**
 * Splits documents into chunks for vector embedding.
 * Supports recursive character splitting with configurable separators.
 */
export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: ChunkingOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.chunkOverlap = options.chunkOverlap ?? 200;
    this.separators = options.separators ?? ['\n\n', '\n', '. ', ' ', ''];
  }

  /**
   * Chunk a single document into multiple pieces.
   */
  chunk(doc: Document): Omit<VectorChunk, 'embedding'>[] {
    const chunks: Omit<VectorChunk, 'embedding'>[] = [];
    const textChunks = this.splitText(doc.content);

    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        id: doc.id ? `${doc.id}_${i}` : `${this.generateId()}_${i}`,
        content: textChunks[i],
        source: doc.source,
        type: doc.type,
        metadata: {
          ...doc.metadata,
          chunkIndex: i,
          totalChunks: textChunks.length,
        },
      });
    }

    return chunks;
  }

  /**
   * Chunk multiple documents.
   */
  chunkMany(docs: Document[]): Omit<VectorChunk, 'embedding'>[] {
    return docs.flatMap((doc) => this.chunk(doc));
  }

  private splitText(text: string): string[] {
    return this.recursiveSplit(text, this.separators);
  }

  private recursiveSplit(text: string, separators: string[]): string[] {
    if (text.length <= this.chunkSize) {
      return [text.trim()].filter(Boolean);
    }

    const separator = separators[0];
    const remainingSeparators = separators.slice(1);

    if (separator === '') {
      // Base case: split by character
      return this.splitBySize(text);
    }

    const splits = text.split(separator);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const split of splits) {
      const potentialChunk = currentChunk
        ? currentChunk + separator + split
        : split;

      if (potentialChunk.length <= this.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        if (split.length > this.chunkSize && remainingSeparators.length > 0) {
          // Recursively split with finer separators
          const subChunks = this.recursiveSplit(split, remainingSeparators);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = split;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Apply overlap
    return this.applyOverlap(chunks);
  }

  private splitBySize(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkSize - this.chunkOverlap) {
      chunks.push(text.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  private applyOverlap(chunks: string[]): string[] {
    if (this.chunkOverlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];

      // Add overlap from previous chunk
      if (i > 0 && chunks[i - 1].length > this.chunkOverlap) {
        const overlap = chunks[i - 1].slice(-this.chunkOverlap);
        chunk = overlap + chunk;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }

  private generateId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================================
// Code-aware Chunker
// ============================================================================

/**
 * Specialized chunker for source code that respects function/class boundaries.
 */
export class CodeChunker extends DocumentChunker {
  private languagePatterns: Map<string, RegExp[]>;

  constructor(options: ChunkingOptions = {}) {
    super({
      ...options,
      chunkSize: options.chunkSize ?? 2000,
      separators: ['\n\n', '\n'],
    });

    // Patterns to detect function/class boundaries
    this.languagePatterns = new Map([
      [
        'typescript',
        [
          /^(export\s+)?(async\s+)?function\s+\w+/gm,
          /^(export\s+)?(abstract\s+)?class\s+\w+/gm,
          /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/gm,
          /^(export\s+)?interface\s+\w+/gm,
          /^(export\s+)?type\s+\w+/gm,
        ],
      ],
      [
        'python',
        [
          /^(async\s+)?def\s+\w+/gm,
          /^class\s+\w+/gm,
        ],
      ],
      [
        'rust',
        [
          /^(pub\s+)?(async\s+)?fn\s+\w+/gm,
          /^(pub\s+)?struct\s+\w+/gm,
          /^(pub\s+)?enum\s+\w+/gm,
          /^(pub\s+)?impl\s+/gm,
        ],
      ],
    ]);
  }

  /**
   * Chunk code while trying to keep functions/classes together.
   */
  chunkCode(
    code: string,
    language: string,
    source: string
  ): Omit<VectorChunk, 'embedding'>[] {
    const patterns = this.languagePatterns.get(language) || [];
    const boundaries = this.findBoundaries(code, patterns);

    if (boundaries.length === 0) {
      // Fall back to regular chunking
      return this.chunk({
        content: code,
        source,
        type: 'code',
        metadata: { language },
      });
    }

    const chunks: Omit<VectorChunk, 'embedding'>[] = [];

    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1] ?? code.length;
      const content = code.slice(start, end).trim();

      if (content) {
        chunks.push({
          id: `${source}_${i}`,
          content,
          source,
          type: 'code',
          metadata: {
            language,
            chunkIndex: i,
            totalChunks: boundaries.length,
          },
        });
      }
    }

    return chunks;
  }

  private findBoundaries(code: string, patterns: RegExp[]): number[] {
    const boundaries = new Set<number>();
    boundaries.add(0);

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(code)) !== null) {
        boundaries.add(match.index);
      }
    }

    return Array.from(boundaries).sort((a, b) => a - b);
  }
}

// ============================================================================
// Embedding Provider Interface
// ============================================================================

export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
  getDimension(): number;
}

// ============================================================================
// RAG Pipeline
// ============================================================================

export interface RAGPipelineOptions {
  vectorStore: IVectorStore;
  embeddingProvider: IEmbeddingProvider;
  chunker?: DocumentChunker;
}

/**
 * Complete RAG pipeline that combines chunking, embedding, and retrieval.
 */
export class RAGPipeline {
  private vectorStore: IVectorStore;
  private embeddingProvider: IEmbeddingProvider;
  private chunker: DocumentChunker;

  constructor(options: RAGPipelineOptions) {
    this.vectorStore = options.vectorStore;
    this.embeddingProvider = options.embeddingProvider;
    this.chunker = options.chunker ?? new DocumentChunker();
  }

  /**
   * Index documents into the vector store.
   */
  async index(documents: Document[]): Promise<number> {
    const chunks = this.chunker.chunkMany(documents);
    const contents = chunks.map((c) => c.content);
    const embeddings = await this.embeddingProvider.embedMany(contents);

    const vectorChunks: VectorChunk[] = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    await this.vectorStore.upsert(vectorChunks);
    return vectorChunks.length;
  }

  /**
   * Query for relevant chunks.
   */
  async query(
    query: string,
    options?: VectorQueryOptions
  ): Promise<ChunkWithScore[]> {
    const embedding = await this.embeddingProvider.embed(query);
    return this.vectorStore.query(embedding, options);
  }

  /**
   * Query and format as context string for LLM.
   */
  async getContext(
    query: string,
    options?: VectorQueryOptions & { maxTokens?: number }
  ): Promise<string> {
    const results = await this.query(query, options);

    const contextParts: string[] = [];
    let totalLength = 0;
    const maxLength = options?.maxTokens ? options.maxTokens * 4 : 8000; // Rough char estimate

    for (const { chunk, score } of results) {
      if (totalLength + chunk.content.length > maxLength) break;

      contextParts.push(
        `[Source: ${chunk.source} | Score: ${score.toFixed(2)}]\n${chunk.content}`
      );
      totalLength += chunk.content.length;
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Delete documents by source.
   */
  async deleteBySource(source: string): Promise<void> {
    // This requires the vector store to support filtering by metadata
    // For now, this is a placeholder that would need store-specific implementation
    console.warn('deleteBySource not fully implemented for all stores');
  }

  /**
   * Clear all indexed documents.
   */
  async clear(namespace?: string): Promise<void> {
    await this.vectorStore.clear?.(namespace);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an in-memory RAG pipeline for development.
 */
export function createInMemoryPipeline(
  embeddingProvider: IEmbeddingProvider,
  options?: { chunkSize?: number; chunkOverlap?: number }
): RAGPipeline {
  return new RAGPipeline({
    vectorStore: new InMemoryVectorStore(),
    embeddingProvider,
    chunker: new DocumentChunker(options),
  });
}
