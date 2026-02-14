/**
 * Context Compressor Service
 *
 * Implements "Genomic Prompts" - compress massive contexts (100K+ tokens)
 * into fixed-dimension latent vectors that can be used for retrieval and
 * context injection.
 *
 * Key techniques:
 * 1. Hierarchical chunking with overlap
 * 2. Semantic hashing via locality-sensitive hashing (LSH)
 * 3. Weighted superposition based on recency/importance
 * 4. Position-aware encoding for temporal coherence
 *
 * The result: A fixed-size "DNA" of your conversation/document that captures
 * semantic content without storing the full text.
 */

import { HRRVector, HolographicMemory } from '../agents/holographicMemory.js';

/**
 * Token statistics for compression analysis
 */
interface CompressionStats {
  originalTokens: number;
  compressedDimension: number;
  compressionRatio: number;
  chunkCount: number;
  processingTimeMs: number;
}

/**
 * Compressed context representation
 */
export interface CompressedContext {
  id: string;
  vector: HRRVector;
  stats: CompressionStats;
  metadata: {
    source: string;
    createdAt: string;
    chunkHashes: string[];
  };
}

/**
 * Chunk with semantic information
 */
interface SemanticChunk {
  text: string;
  position: number;
  importance: number;
  hash: string;
  keywords: string[];
}

/**
 * Locality-Sensitive Hashing for semantic similarity
 * Uses random hyperplane projections
 */
class LSHIndex {
  private hyperplanes: Float64Array[];
  private dimension: number;
  private numHashes: number;

  constructor(dimension: number = 512, numHashes: number = 64) {
    this.dimension = dimension;
    this.numHashes = numHashes;
    this.hyperplanes = [];

    // Generate random hyperplanes (deterministic seed for consistency)
    const rng = this.seededRandom(42);
    for (let i = 0; i < numHashes; i++) {
      const plane = new Float64Array(dimension);
      let magnitude = 0;
      for (let j = 0; j < dimension; j++) {
        plane[j] = rng() * 2 - 1;
        magnitude += plane[j] * plane[j];
      }
      magnitude = Math.sqrt(magnitude);
      for (let j = 0; j < dimension; j++) {
        plane[j] /= magnitude;
      }
      this.hyperplanes.push(plane);
    }
  }

  /**
   * Hash a vector to a binary signature
   */
  hash(vector: number[]): string {
    // Pad or truncate to match dimension
    const v = new Float64Array(this.dimension);
    for (let i = 0; i < Math.min(vector.length, this.dimension); i++) {
      v[i] = vector[i];
    }

    let signature = '';
    for (const plane of this.hyperplanes) {
      let dot = 0;
      for (let i = 0; i < this.dimension; i++) {
        dot += v[i] * plane[i];
      }
      signature += dot >= 0 ? '1' : '0';
    }
    return signature;
  }

  /**
   * Compute Hamming distance between two hashes
   */
  hammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }

  /**
   * Estimate cosine similarity from Hamming distance
   */
  estimateSimilarity(hash1: string, hash2: string): number {
    const d = this.hammingDistance(hash1, hash2);
    // Approximate: cos(theta) ≈ cos(pi * d / numHashes)
    return Math.cos((Math.PI * d) / this.numHashes);
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }
}

/**
 * Text feature extractor - converts text to numeric vectors
 * Uses TF-IDF-like approach without external dependencies
 */
class TextFeatureExtractor {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private dimension: number;
  private vocabSize: number = 0;

  constructor(dimension: number = 512) {
    this.dimension = dimension;
  }

  /**
   * Extract features from text using character n-grams and word hashing
   */
  extractFeatures(text: string): number[] {
    const features = new Float64Array(this.dimension);
    const words = this.tokenize(text);

    // Character trigram features (position 0 to dimension/2)
    const trigrams = this.getCharNgrams(text, 3);
    for (const trigram of trigrams) {
      const hash = this.hashString(trigram) % (this.dimension / 2);
      features[hash] += 1;
    }

    // Word features (position dimension/2 to dimension)
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    for (const [word, count] of wordCounts) {
      const hash = this.dimension / 2 + (this.hashString(word) % (this.dimension / 2));
      // TF component (log-scaled)
      features[hash] += Math.log(1 + count);
    }

    // L2 normalize
    let magnitude = 0;
    for (let i = 0; i < this.dimension; i++) {
      magnitude += features[i] * features[i];
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < this.dimension; i++) {
        features[i] /= magnitude;
      }
    }

    return Array.from(features);
  }

  /**
   * Extract keywords using TF-based scoring
   */
  extractKeywords(text: string, topK: number = 10): string[] {
    const words = this.tokenize(text);
    const counts = new Map<string, number>();

    for (const word of words) {
      if (word.length > 2) {
        counts.set(word, (counts.get(word) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([word]) => word);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  private getCharNgrams(text: string, n: number): string[] {
    const ngrams: string[] = [];
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.push(normalized.slice(i, i + n));
    }
    return ngrams;
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
  }
}

/**
 * Hierarchical Context Compressor
 * Compresses arbitrary length text into fixed-dimension vectors
 */
export class ContextCompressor {
  private dimension: number;
  private chunkSize: number;
  private chunkOverlap: number;
  private featureExtractor: TextFeatureExtractor;
  private lshIndex: LSHIndex;
  private holoMemory: HolographicMemory;

  constructor(
    options: {
      dimension?: number;
      chunkSize?: number;
      chunkOverlap?: number;
    } = {}
  ) {
    this.dimension = options.dimension || 4096;
    this.chunkSize = options.chunkSize || 512; // tokens/words per chunk
    this.chunkOverlap = options.chunkOverlap || 64;
    this.featureExtractor = new TextFeatureExtractor(512);
    this.lshIndex = new LSHIndex(512, 64);
    this.holoMemory = new HolographicMemory(this.dimension);
  }

  /**
   * Compress a long text into a fixed-dimension vector
   */
  compress(text: string, source: string = 'unknown'): CompressedContext {
    const startTime = Date.now();

    // Chunk the text
    const chunks = this.chunkText(text);

    // Process each chunk
    const semanticChunks: SemanticChunk[] = chunks.map((chunk, idx) => {
      const features = this.featureExtractor.extractFeatures(chunk);
      const hash = this.lshIndex.hash(features);
      const keywords = this.featureExtractor.extractKeywords(chunk, 5);

      // Compute importance based on keyword density and position
      const importance = this.computeImportance(chunk, idx, chunks.length);

      return {
        text: chunk,
        position: idx,
        importance,
        hash,
        keywords,
      };
    });

    // Create holographic superposition of all chunks
    const resultVector = new HRRVector(this.dimension);

    for (const chunk of semanticChunks) {
      // Create position-aware key
      const positionKey = HRRVector.fromText(`chunk_${chunk.position}`, this.dimension);

      // Create content vector from chunk
      const features = this.featureExtractor.extractFeatures(chunk.text);
      const contentVector = HRRVector.fromEmbedding(features, this.dimension);

      // Bind position and content
      const boundChunk = positionKey.bind(contentVector);

      // Weight by importance and add to result
      const weighted = boundChunk.scale(chunk.importance);
      resultVector.addInPlace(weighted);
    }

    // Normalize final vector
    const normalizedResult = resultVector.normalize();

    const endTime = Date.now();
    const originalTokens = text.split(/\s+/).length;

    return {
      id: this.generateId(),
      vector: normalizedResult,
      stats: {
        originalTokens,
        compressedDimension: this.dimension,
        compressionRatio: originalTokens / this.dimension,
        chunkCount: chunks.length,
        processingTimeMs: endTime - startTime,
      },
      metadata: {
        source,
        createdAt: new Date().toISOString(),
        chunkHashes: semanticChunks.map((c) => c.hash),
      },
    };
  }

  /**
   * Compute similarity between two compressed contexts
   */
  similarity(ctx1: CompressedContext, ctx2: CompressedContext): number {
    return ctx1.vector.similarity(ctx2.vector);
  }

  /**
   * Query similarity between compressed context and new text
   */
  querySimilarity(ctx: CompressedContext, queryText: string): number {
    const queryFeatures = this.featureExtractor.extractFeatures(queryText);
    const queryVector = HRRVector.fromEmbedding(queryFeatures, this.dimension);
    return ctx.vector.similarity(queryVector);
  }

  /**
   * Merge multiple compressed contexts into one
   * Useful for combining conversation history
   */
  merge(contexts: CompressedContext[], weights?: number[]): CompressedContext {
    const startTime = Date.now();
    const w = weights || contexts.map(() => 1 / contexts.length);

    const resultVector = new HRRVector(this.dimension);
    const allHashes: string[] = [];
    let totalTokens = 0;
    let totalChunks = 0;

    for (let i = 0; i < contexts.length; i++) {
      const scaled = contexts[i].vector.scale(w[i]);
      resultVector.addInPlace(scaled);
      allHashes.push(...contexts[i].metadata.chunkHashes);
      totalTokens += contexts[i].stats.originalTokens;
      totalChunks += contexts[i].stats.chunkCount;
    }

    const normalizedResult = resultVector.normalize();
    const endTime = Date.now();

    return {
      id: this.generateId(),
      vector: normalizedResult,
      stats: {
        originalTokens: totalTokens,
        compressedDimension: this.dimension,
        compressionRatio: totalTokens / this.dimension,
        chunkCount: totalChunks,
        processingTimeMs: endTime - startTime,
      },
      metadata: {
        source: `merged_${contexts.length}_contexts`,
        createdAt: new Date().toISOString(),
        chunkHashes: allHashes,
      },
    };
  }

  /**
   * Extract the most relevant portions of original text given a query
   * Uses the compressed context for efficient retrieval
   */
  retrieveRelevant(
    originalText: string,
    query: string,
    topK: number = 3
  ): { chunk: string; score: number; position: number }[] {
    const chunks = this.chunkText(originalText);
    const queryFeatures = this.featureExtractor.extractFeatures(query);
    const queryHash = this.lshIndex.hash(queryFeatures);

    const scored = chunks.map((chunk, position) => {
      const chunkFeatures = this.featureExtractor.extractFeatures(chunk);
      const chunkHash = this.lshIndex.hash(chunkFeatures);
      const score = this.lshIndex.estimateSimilarity(queryHash, chunkHash);
      return { chunk, score, position };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Serialize compressed context for storage
   */
  serialize(ctx: CompressedContext): string {
    return JSON.stringify({
      id: ctx.id,
      vector: ctx.vector.toJSON(),
      stats: ctx.stats,
      metadata: ctx.metadata,
    });
  }

  /**
   * Deserialize compressed context
   */
  deserialize(data: string): CompressedContext {
    const parsed = JSON.parse(data);
    return {
      id: parsed.id,
      vector: HRRVector.fromJSON(parsed.vector),
      stats: parsed.stats,
      metadata: parsed.metadata,
    };
  }

  // Private helpers

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += this.chunkSize - this.chunkOverlap) {
      const chunk = words.slice(i, i + this.chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private computeImportance(chunk: string, position: number, totalChunks: number): number {
    // Factors: position (recent = more important), density, special markers

    // Position factor: more recent chunks get higher weight
    const recencyWeight = 0.5 + 0.5 * (position / totalChunks);

    // Density factor: chunks with more unique words are more informative
    const words = new Set(chunk.toLowerCase().split(/\s+/));
    const densityWeight = Math.min(1, words.size / 50);

    // Special markers: code, questions, imperatives
    let markerWeight = 1.0;
    if (chunk.includes('```') || chunk.includes('function') || chunk.includes('class')) {
      markerWeight = 1.3; // Code is important
    }
    if (chunk.includes('?')) {
      markerWeight = 1.2; // Questions are important
    }
    if (/\b(must|should|need|require|important)\b/i.test(chunk)) {
      markerWeight = 1.25; // Imperatives are important
    }

    return recencyWeight * densityWeight * markerWeight;
  }

  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Context Compressor Service singleton
 */
export class ContextCompressorService {
  private static instance: ContextCompressorService;
  private compressor: ContextCompressor;
  private cache: Map<string, CompressedContext> = new Map();

  private constructor() {
    this.compressor = new ContextCompressor({
      dimension: 4096,
      chunkSize: 512,
      chunkOverlap: 64,
    });
  }

  static getInstance(): ContextCompressorService {
    if (!ContextCompressorService.instance) {
      ContextCompressorService.instance = new ContextCompressorService();
    }
    return ContextCompressorService.instance;
  }

  /**
   * Compress text and cache the result
   */
  compress(text: string, source: string = 'unknown'): CompressedContext {
    const ctx = this.compressor.compress(text, source);
    this.cache.set(ctx.id, ctx);
    return ctx;
  }

  /**
   * Get cached context by ID
   */
  get(id: string): CompressedContext | undefined {
    return this.cache.get(id);
  }

  /**
   * Compute similarity between cached context and query
   */
  querySimilarity(contextId: string, query: string): number | null {
    const ctx = this.cache.get(contextId);
    if (!ctx) return null;
    return this.compressor.querySimilarity(ctx, query);
  }

  /**
   * Find most similar cached contexts to a query
   */
  findSimilar(query: string, topK: number = 5): { id: string; similarity: number }[] {
    const queryFeatures = new TextFeatureExtractor(512).extractFeatures(query);
    const queryVector = HRRVector.fromEmbedding(queryFeatures, 4096);

    const results: { id: string; similarity: number }[] = [];
    for (const [id, ctx] of this.cache) {
      const similarity = ctx.vector.similarity(queryVector);
      results.push({ id, similarity });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Merge multiple cached contexts
   */
  merge(contextIds: string[], weights?: number[]): CompressedContext | null {
    const contexts = contextIds
      .map((id) => this.cache.get(id))
      .filter((c): c is CompressedContext => c !== undefined);

    if (contexts.length === 0) return null;

    const merged = this.compressor.merge(contexts, weights);
    this.cache.set(merged.id, merged);
    return merged;
  }

  /**
   * Get all cached contexts
   */
  listAll(): { id: string; stats: CompressionStats; source: string }[] {
    return Array.from(this.cache.values()).map((ctx) => ({
      id: ctx.id,
      stats: ctx.stats,
      source: ctx.metadata.source,
    }));
  }

  /**
   * Delete a cached context
   */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /**
   * Clear all cached contexts
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedContexts: number;
    totalOriginalTokens: number;
    totalCompressedBytes: number;
    avgCompressionRatio: number;
  } {
    let totalTokens = 0;
    let totalBytes = 0;
    let totalRatio = 0;

    for (const ctx of this.cache.values()) {
      totalTokens += ctx.stats.originalTokens;
      totalBytes += ctx.stats.compressedDimension * 16; // Complex float64
      totalRatio += ctx.stats.compressionRatio;
    }

    return {
      cachedContexts: this.cache.size,
      totalOriginalTokens: totalTokens,
      totalCompressedBytes: totalBytes,
      avgCompressionRatio: this.cache.size > 0 ? totalRatio / this.cache.size : 0,
    };
  }
}

export default ContextCompressorService;
