/**
 * Predictive Prefetch Service
 *
 * Learns user patterns and proactively prefetches likely context before it's needed.
 * This dramatically reduces perceived latency by having context ready when the user asks.
 *
 * Key Features:
 * 1. Query Pattern Learning - Learns common query sequences
 * 2. File Access Prediction - Predicts which files user will access next
 * 3. Topic Clustering - Groups related topics for batch prefetch
 * 4. Temporal Patterns - Learns time-of-day and session-based patterns
 * 5. Background Indexing - Indexes predicted files before they're needed
 *
 * @module services/predictivePrefetch
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * A learned query pattern representing a common query sequence
 */
export interface QueryPattern {
  id: string;

  // The trigger query that predicts follow-ups
  trigger: {
    type: PatternTriggerType;
    value: string | RegExp;
    embedding?: number[]; // Neural embedding for semantic matching
  };

  // Predicted follow-up queries
  predictions: Array<{
    query: string;
    confidence: number; // 0-1, how likely is this follow-up
    avgDelayMs: number; // Average time between trigger and this query
    embedding?: number[]; // For semantic matching
  }>;

  // Pattern statistics
  stats: {
    observations: number; // Times this pattern was observed
    hits: number; // Times prediction was correct
    hitRate: number; // hits / observations
    lastSeen: string; // ISO timestamp
    createdAt: string;
  };
}

export type PatternTriggerType =
  | 'exact' // Exact query match
  | 'prefix' // Query starts with this
  | 'intent' // Same intent type (explore, implement, etc.)
  | 'file' // Accessing specific file
  | 'topic' // Related topic cluster
  | 'semantic'; // Semantic similarity > threshold

/**
 * File access prediction
 */
export interface FileAccessPattern {
  sourceFile: string;

  // Files commonly accessed after this one
  relatedFiles: Array<{
    path: string;
    coAccessCount: number; // Times accessed together
    avgDelayMs: number; // Time between accesses
    relationship: FileRelationship;
  }>;

  // Pattern statistics
  accessCount: number;
  lastAccessed: string;
}

export type FileRelationship =
  | 'import' // File imports the other
  | 'export' // File exports to the other
  | 'test' // File is a test for the other
  | 'sibling' // Files in same directory
  | 'temporal'; // Co-accessed in time

/**
 * Topic cluster for batch prefetching
 */
export interface TopicCluster {
  id: string;
  name: string;

  // Semantic centroid of the cluster
  centroid: number[];

  // Members of this cluster
  members: Array<{
    id: string;
    type: 'query' | 'file' | 'concept';
    content: string;
    embedding: number[];
  }>;

  // Files commonly accessed for this topic
  relevantFiles: string[];

  // Statistics
  accessCount: number;
  lastAccessed: string;
}

/**
 * Prefetch request
 */
export interface PrefetchRequest {
  type: 'query' | 'file' | 'topic';
  value: string;
  priority: 'high' | 'medium' | 'low';
  context?: {
    sessionId: string;
    currentFile?: string;
    recentQueries?: string[];
  };
}

/**
 * Prefetch result
 */
export interface PrefetchResult {
  requestId: string;
  type: 'query' | 'file' | 'topic';
  value: string;

  // Prefetched items
  prefetched: Array<{
    type: 'compiled_context' | 'indexed_file' | 'cached_embedding';
    key: string;
    size: number; // Bytes or tokens
    latencyMs: number;
  }>;

  // What was predicted but not yet prefetched
  pending: string[];

  // Overall stats
  totalPrefetchedSize: number;
  totalLatencyMs: number;
  cacheHitRate: number;
}

/**
 * Prefetch configuration
 */
export interface PrefetchConfig {
  // Pattern learning
  minObservationsForPattern: number; // Min observations before using pattern
  patternConfidenceThreshold: number; // Min confidence to prefetch
  maxPatternsPerSession: number; // Limit patterns per session
  patternDecayRate: number; // How fast old patterns fade

  // Prefetching
  maxConcurrentPrefetches: number; // Parallel prefetch limit
  prefetchTimeoutMs: number; // Max time for single prefetch
  maxPrefetchQueueSize: number; // Queue size limit
  prefetchAheadMs: number; // How far ahead to prefetch

  // Resource limits
  maxMemoryMb: number; // Memory limit for prefetch cache
  maxCacheEntries: number; // Max cached items
  cacheExpiryMs: number; // Cache TTL

  // Background indexing
  enableBackgroundIndexing: boolean;
  backgroundIndexBatchSize: number;
  backgroundIndexIntervalMs: number;
}

/**
 * Prefetch metrics
 */
export interface PrefetchMetrics {
  // Pattern stats
  totalPatterns: number;
  activePatterns: number;
  patternHitRate: number;

  // Prefetch stats
  prefetchesAttempted: number;
  prefetchesSuccessful: number;
  prefetchesFailed: number;
  prefetchHitRate: number;
  avgPrefetchLatencyMs: number;

  // Cache stats
  cacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;

  // Resource usage
  memoryUsageMb: number;
  queueLength: number;
  backgroundIndexPending: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_PREFETCH_CONFIG: PrefetchConfig = {
  // Pattern learning
  minObservationsForPattern: 3,
  patternConfidenceThreshold: 0.5,
  maxPatternsPerSession: 100,
  patternDecayRate: 0.95, // 5% decay per day

  // Prefetching
  maxConcurrentPrefetches: 4,
  prefetchTimeoutMs: 5000,
  maxPrefetchQueueSize: 50,
  prefetchAheadMs: 30000, // Prefetch 30s ahead

  // Resource limits
  maxMemoryMb: 256,
  maxCacheEntries: 1000,
  cacheExpiryMs: 10 * 60 * 1000, // 10 minutes

  // Background indexing
  enableBackgroundIndexing: true,
  backgroundIndexBatchSize: 5,
  backgroundIndexIntervalMs: 5000,
};

// ============================================================================
// PREDICTIVE PREFETCH SERVICE
// ============================================================================

export class PredictivePrefetchService extends EventEmitter {
  private config: PrefetchConfig;
  private sessionId: string;

  // Pattern storage
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private filePatterns: Map<string, FileAccessPattern> = new Map();
  private topicClusters: Map<string, TopicCluster> = new Map();

  // Query history for pattern learning
  private queryHistory: Array<{
    query: string;
    timestamp: number;
    embedding?: number[];
    intent?: string;
    files?: string[];
  }> = [];

  // Prefetch cache
  private prefetchCache: Map<
    string,
    {
      data: unknown;
      type: string;
      size: number;
      createdAt: number;
      accessCount: number;
      lastAccessed: number;
    }
  > = new Map();

  // Prefetch queue
  private prefetchQueue: PrefetchRequest[] = [];
  private activePrefetches = 0;
  private prefetchTimer: NodeJS.Timeout | null = null;

  // Background indexing
  private backgroundIndexQueue: string[] = [];
  private backgroundIndexTimer: NodeJS.Timeout | null = null;

  // Metrics
  private metrics: PrefetchMetrics = {
    totalPatterns: 0,
    activePatterns: 0,
    patternHitRate: 0,
    prefetchesAttempted: 0,
    prefetchesSuccessful: 0,
    prefetchesFailed: 0,
    prefetchHitRate: 0,
    avgPrefetchLatencyMs: 0,
    cacheSize: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    memoryUsageMb: 0,
    queueLength: 0,
    backgroundIndexPending: 0,
  };

  // Embedding function (injected)
  private embedFn: ((text: string) => Promise<number[]>) | null = null;
  private compileFn: ((query: string, context?: object) => Promise<unknown>) | null = null;
  private indexFileFn: ((filePath: string) => Promise<void>) | null = null;

  constructor(sessionId: string, config: Partial<PrefetchConfig> = {}) {
    super();
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_PREFETCH_CONFIG, ...config };

    // Start background processes
    this.startPrefetchProcessor();
    if (this.config.enableBackgroundIndexing) {
      this.startBackgroundIndexer();
    }
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  /**
   * Set the embedding function (from neural embedding service)
   */
  setEmbedFunction(fn: (text: string) => Promise<number[]>): void {
    this.embedFn = fn;
  }

  /**
   * Set the compile function (from semantic compiler)
   */
  setCompileFunction(fn: (query: string, context?: object) => Promise<unknown>): void {
    this.compileFn = fn;
  }

  /**
   * Set the file indexing function (from semantic compiler)
   */
  setIndexFileFunction(fn: (filePath: string) => Promise<void>): void {
    this.indexFileFn = fn;
  }

  // --------------------------------------------------------------------------
  // PATTERN LEARNING
  // --------------------------------------------------------------------------

  /**
   * Record a user query and learn patterns from it
   */
  async recordQuery(
    query: string,
    context?: {
      intent?: string;
      files?: string[];
      embedding?: number[];
    }
  ): Promise<void> {
    const timestamp = Date.now();

    // Get embedding if not provided
    let embedding = context?.embedding;
    if (!embedding && this.embedFn) {
      try {
        embedding = await this.embedFn(query);
      } catch {
        // Ignore embedding failures
      }
    }

    // Add to history
    this.queryHistory.push({
      query,
      timestamp,
      embedding,
      intent: context?.intent,
      files: context?.files,
    });

    // Trim history to prevent memory bloat
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-500);
    }

    // Learn patterns from recent history
    this.learnPatternsFromHistory();

    // Record file access patterns
    if (context?.files) {
      for (const file of context.files) {
        this.recordFileAccess(file, context.files);
      }
    }

    // Trigger prefetch for predicted follow-ups
    await this.prefetchPredictedFollowUps(query, embedding);

    this.emit('query_recorded', { query, timestamp });
  }

  /**
   * Learn query patterns from history
   */
  private learnPatternsFromHistory(): void {
    const recentQueries = this.queryHistory.slice(-20);

    if (recentQueries.length < 2) return;

    // Look for sequential patterns
    for (let i = 0; i < recentQueries.length - 1; i++) {
      const trigger = recentQueries[i];
      const followUp = recentQueries[i + 1];

      // Only consider queries within reasonable time window
      const delay = followUp.timestamp - trigger.timestamp;
      if (delay > 300000) continue; // 5 minute max gap

      // Create or update pattern
      const patternKey = this.hashPattern(trigger.query, trigger.intent);
      let pattern = this.queryPatterns.get(patternKey);

      if (!pattern) {
        pattern = {
          id: patternKey,
          trigger: {
            type: trigger.intent ? 'intent' : 'semantic',
            value: trigger.intent || trigger.query.slice(0, 50),
            embedding: trigger.embedding,
          },
          predictions: [],
          stats: {
            observations: 0,
            hits: 0,
            hitRate: 0,
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        };
      }

      // Update or add prediction
      const existingPred = pattern.predictions.find(
        (p) => this.querySimilarity(p.query, followUp.query) > 0.8
      );

      if (existingPred) {
        // Update existing prediction
        const count = pattern.stats.observations + 1;
        existingPred.avgDelayMs =
          (existingPred.avgDelayMs * pattern.stats.observations + delay) / count;
        existingPred.confidence = Math.min(1, existingPred.confidence + 0.1);
      } else {
        // Add new prediction
        pattern.predictions.push({
          query: followUp.query,
          confidence: 0.3,
          avgDelayMs: delay,
          embedding: followUp.embedding,
        });
      }

      // Update stats
      pattern.stats.observations++;
      pattern.stats.lastSeen = new Date().toISOString();

      // Decay old predictions
      pattern.predictions = pattern.predictions
        .map((p) => ({ ...p, confidence: p.confidence * 0.99 }))
        .filter((p) => p.confidence > 0.1)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Keep top 10

      this.queryPatterns.set(patternKey, pattern);
    }

    // Update metrics
    this.metrics.totalPatterns = this.queryPatterns.size;
    this.metrics.activePatterns = Array.from(this.queryPatterns.values()).filter(
      (p) => p.stats.observations >= this.config.minObservationsForPattern
    ).length;
  }

  /**
   * Record file access pattern
   */
  private recordFileAccess(file: string, coAccessedFiles: string[]): void {
    let pattern = this.filePatterns.get(file);

    if (!pattern) {
      pattern = {
        sourceFile: file,
        relatedFiles: [],
        accessCount: 0,
        lastAccessed: new Date().toISOString(),
      };
    }

    pattern.accessCount++;
    pattern.lastAccessed = new Date().toISOString();

    // Record co-accessed files
    for (const coFile of coAccessedFiles) {
      if (coFile === file) continue;

      const existing = pattern.relatedFiles.find((r) => r.path === coFile);
      if (existing) {
        existing.coAccessCount++;
      } else {
        pattern.relatedFiles.push({
          path: coFile,
          coAccessCount: 1,
          avgDelayMs: 0,
          relationship: this.inferRelationship(file, coFile),
        });
      }
    }

    // Sort by co-access count and limit
    pattern.relatedFiles = pattern.relatedFiles
      .sort((a, b) => b.coAccessCount - a.coAccessCount)
      .slice(0, 20);

    this.filePatterns.set(file, pattern);
  }

  /**
   * Infer relationship between files
   */
  private inferRelationship(file1: string, file2: string): FileRelationship {
    // Simple heuristics
    if (file2.includes('.test.') || file2.includes('.spec.') || file2.includes('__tests__')) {
      return 'test';
    }

    const dir1 = file1.split('/').slice(0, -1).join('/');
    const dir2 = file2.split('/').slice(0, -1).join('/');
    if (dir1 === dir2) {
      return 'sibling';
    }

    return 'temporal';
  }

  // --------------------------------------------------------------------------
  // PREDICTION
  // --------------------------------------------------------------------------

  /**
   * Predict follow-up queries based on current query
   */
  async predictFollowUps(
    query: string,
    embedding?: number[]
  ): Promise<Array<{ query: string; confidence: number }>> {
    const predictions: Array<{ query: string; confidence: number }> = [];

    // Get embedding if needed
    if (!embedding && this.embedFn) {
      try {
        embedding = await this.embedFn(query);
      } catch {
        // Continue without embedding
      }
    }

    // Check all patterns for matches
    for (const pattern of this.queryPatterns.values()) {
      if (pattern.stats.observations < this.config.minObservationsForPattern) continue;

      // Check if pattern matches
      const matchScore = await this.matchPattern(query, embedding, pattern);
      if (matchScore < 0.5) continue;

      // Add weighted predictions
      for (const pred of pattern.predictions) {
        if (pred.confidence < this.config.patternConfidenceThreshold) continue;

        const adjustedConfidence =
          pred.confidence * matchScore * pattern.stats.hitRate || pred.confidence * matchScore;

        // Check if already in predictions
        const existing = predictions.find((p) => this.querySimilarity(p.query, pred.query) > 0.8);

        if (existing) {
          existing.confidence = Math.max(existing.confidence, adjustedConfidence);
        } else {
          predictions.push({
            query: pred.query,
            confidence: adjustedConfidence,
          });
        }
      }
    }

    // Add heuristic predictions
    const heuristicPreds = this.getHeuristicPredictions(query);
    for (const pred of heuristicPreds) {
      const existing = predictions.find((p) => this.querySimilarity(p.query, pred.query) > 0.8);

      if (!existing) {
        predictions.push(pred);
      }
    }

    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  /**
   * Predict files likely to be accessed next
   */
  predictFilesToAccess(currentFile?: string): Array<{ path: string; confidence: number }> {
    const predictions: Array<{ path: string; confidence: number }> = [];

    if (currentFile) {
      const pattern = this.filePatterns.get(currentFile);
      if (pattern) {
        for (const related of pattern.relatedFiles) {
          const confidence = Math.min(1, related.coAccessCount / pattern.accessCount);
          if (confidence >= 0.3) {
            predictions.push({
              path: related.path,
              confidence,
            });
          }
        }
      }
    }

    // Add recently accessed files with high access counts
    const frequentFiles = Array.from(this.filePatterns.values())
      .filter((p) => p.accessCount >= 5)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    for (const pattern of frequentFiles) {
      if (predictions.find((p) => p.path === pattern.sourceFile)) continue;

      predictions.push({
        path: pattern.sourceFile,
        confidence: 0.3,
      });
    }

    return predictions.slice(0, 20);
  }

  /**
   * Match a query against a pattern
   */
  private async matchPattern(
    query: string,
    embedding: number[] | undefined,
    pattern: QueryPattern
  ): Promise<number> {
    switch (pattern.trigger.type) {
      case 'exact':
        return query === pattern.trigger.value ? 1 : 0;

      case 'prefix':
        return query.toLowerCase().startsWith(String(pattern.trigger.value).toLowerCase())
          ? 0.9
          : 0;

      case 'intent':
        // Would need intent parsing
        return 0.5;

      case 'semantic':
        if (embedding && pattern.trigger.embedding) {
          return this.cosineSimilarity(embedding, pattern.trigger.embedding);
        }
        // Fallback to text similarity
        return this.querySimilarity(query, String(pattern.trigger.value));

      default:
        return 0;
    }
  }

  /**
   * Heuristic predictions based on query patterns
   */
  private getHeuristicPredictions(query: string): Array<{ query: string; confidence: number }> {
    const predictions: Array<{ query: string; confidence: number }> = [];
    const lowerQuery = query.toLowerCase();

    // "How" questions often lead to "Can you" or implementation questions
    if (lowerQuery.startsWith('how')) {
      predictions.push({
        query: 'Can you show me an example?',
        confidence: 0.6,
      });
      predictions.push({
        query: 'What are the best practices?',
        confidence: 0.5,
      });
    }

    // Error/debug questions lead to fix questions
    if (
      lowerQuery.includes('error') ||
      lowerQuery.includes('bug') ||
      lowerQuery.includes('not working')
    ) {
      predictions.push({
        query: 'How do I fix this?',
        confidence: 0.7,
      });
      predictions.push({
        query: 'Why is this happening?',
        confidence: 0.6,
      });
    }

    // Exploration leads to modification
    if (lowerQuery.includes('what does') || lowerQuery.includes('explain')) {
      predictions.push({
        query: 'How do I modify this?',
        confidence: 0.5,
      });
      predictions.push({
        query: 'What are the dependencies?',
        confidence: 0.5,
      });
    }

    // Implementation leads to testing
    if (
      lowerQuery.includes('implement') ||
      lowerQuery.includes('create') ||
      lowerQuery.includes('add')
    ) {
      predictions.push({
        query: 'How do I test this?',
        confidence: 0.6,
      });
      predictions.push({
        query: 'What should I consider?',
        confidence: 0.5,
      });
    }

    return predictions;
  }

  // --------------------------------------------------------------------------
  // PREFETCHING
  // --------------------------------------------------------------------------

  /**
   * Prefetch predicted follow-up queries
   */
  private async prefetchPredictedFollowUps(query: string, embedding?: number[]): Promise<void> {
    const predictions = await this.predictFollowUps(query, embedding);

    for (const pred of predictions) {
      if (pred.confidence < this.config.patternConfidenceThreshold) continue;

      this.queuePrefetch({
        type: 'query',
        value: pred.query,
        priority: pred.confidence > 0.7 ? 'high' : pred.confidence > 0.5 ? 'medium' : 'low',
        context: { sessionId: this.sessionId },
      });
    }
  }

  /**
   * Queue a prefetch request
   */
  queuePrefetch(request: PrefetchRequest): void {
    // Check if already in queue
    if (this.prefetchQueue.find((r) => r.type === request.type && r.value === request.value)) {
      return;
    }

    // Check queue size limit
    if (this.prefetchQueue.length >= this.config.maxPrefetchQueueSize) {
      // Remove lowest priority item
      const lowestIdx = this.prefetchQueue.findIndex((r) => r.priority === 'low');
      if (lowestIdx >= 0 && request.priority !== 'low') {
        this.prefetchQueue.splice(lowestIdx, 1);
      } else {
        return; // Queue full
      }
    }

    // Insert based on priority
    if (request.priority === 'high') {
      this.prefetchQueue.unshift(request);
    } else if (request.priority === 'medium') {
      const highCount = this.prefetchQueue.filter((r) => r.priority === 'high').length;
      this.prefetchQueue.splice(highCount, 0, request);
    } else {
      this.prefetchQueue.push(request);
    }

    this.metrics.queueLength = this.prefetchQueue.length;
  }

  /**
   * Queue file for background indexing
   */
  queueBackgroundIndex(filePath: string): void {
    if (!this.backgroundIndexQueue.includes(filePath)) {
      this.backgroundIndexQueue.push(filePath);
      this.metrics.backgroundIndexPending = this.backgroundIndexQueue.length;
    }
  }

  /**
   * Start the prefetch processor
   */
  private startPrefetchProcessor(): void {
    this.prefetchTimer = setInterval(() => {
      this.processPrefetchQueue();
    }, 100);
  }

  /**
   * Process prefetch queue
   */
  private async processPrefetchQueue(): Promise<void> {
    while (
      this.prefetchQueue.length > 0 &&
      this.activePrefetches < this.config.maxConcurrentPrefetches
    ) {
      const request = this.prefetchQueue.shift();
      if (!request) break;

      this.activePrefetches++;
      this.metrics.queueLength = this.prefetchQueue.length;

      this.executePrefetch(request)
        .catch((err) => {
          this.emit('prefetch_error', { request, error: err });
        })
        .finally(() => {
          this.activePrefetches--;
        });
    }
  }

  /**
   * Execute a single prefetch
   */
  private async executePrefetch(request: PrefetchRequest): Promise<PrefetchResult> {
    const startTime = performance.now();
    const requestId = `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.metrics.prefetchesAttempted++;

    const result: PrefetchResult = {
      requestId,
      type: request.type,
      value: request.value,
      prefetched: [],
      pending: [],
      totalPrefetchedSize: 0,
      totalLatencyMs: 0,
      cacheHitRate: 0,
    };

    try {
      switch (request.type) {
        case 'query':
          await this.prefetchQuery(request, result);
          break;

        case 'file':
          await this.prefetchFile(request, result);
          break;

        case 'topic':
          await this.prefetchTopic(request, result);
          break;
      }

      this.metrics.prefetchesSuccessful++;
    } catch (error) {
      this.metrics.prefetchesFailed++;
      this.emit('prefetch_failed', { request, error });
    }

    result.totalLatencyMs = performance.now() - startTime;

    // Update average latency
    const total = this.metrics.prefetchesAttempted;
    this.metrics.avgPrefetchLatencyMs =
      (this.metrics.avgPrefetchLatencyMs * (total - 1) + result.totalLatencyMs) / total;

    // Update hit rate
    this.metrics.prefetchHitRate =
      this.metrics.prefetchesSuccessful / this.metrics.prefetchesAttempted;

    this.emit('prefetch_complete', result);
    return result;
  }

  /**
   * Prefetch context for a query
   */
  private async prefetchQuery(request: PrefetchRequest, result: PrefetchResult): Promise<void> {
    const cacheKey = `query:${request.value}`;

    // Check cache first
    if (this.prefetchCache.has(cacheKey)) {
      result.cacheHitRate = 1;
      this.metrics.cacheHits++;
      return;
    }

    this.metrics.cacheMisses++;

    if (this.compileFn) {
      const startTime = performance.now();
      const compiled = await Promise.race([
        this.compileFn(request.value, request.context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Prefetch timeout')), this.config.prefetchTimeoutMs)
        ),
      ]);

      const size = JSON.stringify(compiled).length;

      this.addToCache(cacheKey, compiled, 'compiled_context', size);

      result.prefetched.push({
        type: 'compiled_context',
        key: cacheKey,
        size,
        latencyMs: performance.now() - startTime,
      });
      result.totalPrefetchedSize += size;
    }
  }

  /**
   * Prefetch/index a file
   */
  private async prefetchFile(request: PrefetchRequest, result: PrefetchResult): Promise<void> {
    const cacheKey = `file:${request.value}`;

    if (this.prefetchCache.has(cacheKey)) {
      result.cacheHitRate = 1;
      this.metrics.cacheHits++;
      return;
    }

    this.metrics.cacheMisses++;

    if (this.indexFileFn) {
      const startTime = performance.now();
      await Promise.race([
        this.indexFileFn(request.value),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Index timeout')), this.config.prefetchTimeoutMs)
        ),
      ]);

      this.addToCache(cacheKey, true, 'indexed_file', 1);

      result.prefetched.push({
        type: 'indexed_file',
        key: cacheKey,
        size: 1,
        latencyMs: performance.now() - startTime,
      });
    }
  }

  /**
   * Prefetch all items in a topic cluster
   */
  private async prefetchTopic(request: PrefetchRequest, result: PrefetchResult): Promise<void> {
    const cluster = this.topicClusters.get(request.value);
    if (!cluster) return;

    // Prefetch relevant files
    for (const file of cluster.relevantFiles.slice(0, 5)) {
      this.queuePrefetch({
        type: 'file',
        value: file,
        priority: 'medium',
        context: request.context,
      });
      result.pending.push(`file:${file}`);
    }
  }

  /**
   * Start background indexer
   */
  private startBackgroundIndexer(): void {
    this.backgroundIndexTimer = setInterval(() => {
      this.processBackgroundIndex();
    }, this.config.backgroundIndexIntervalMs);
  }

  /**
   * Process background index queue
   */
  private async processBackgroundIndex(): Promise<void> {
    if (!this.indexFileFn || this.backgroundIndexQueue.length === 0) return;

    const batch = this.backgroundIndexQueue.splice(0, this.config.backgroundIndexBatchSize);

    for (const filePath of batch) {
      try {
        await this.indexFileFn(filePath);
        this.emit('background_indexed', { filePath });
      } catch (error) {
        this.emit('background_index_error', { filePath, error });
      }
    }

    this.metrics.backgroundIndexPending = this.backgroundIndexQueue.length;
  }

  // --------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Add item to prefetch cache
   */
  private addToCache(key: string, data: unknown, type: string, size: number): void {
    // Check memory limit
    this.enforceMemoryLimit(size);

    // Check entry limit
    if (this.prefetchCache.size >= this.config.maxCacheEntries) {
      this.evictLeastUsed();
    }

    this.prefetchCache.set(key, {
      data,
      type,
      size,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    });

    this.metrics.cacheSize = this.prefetchCache.size;
  }

  /**
   * Get item from prefetch cache
   */
  getFromCache<T>(key: string): T | null {
    const entry = this.prefetchCache.get(key);
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check expiry
    if (Date.now() - entry.createdAt > this.config.cacheExpiryMs) {
      this.prefetchCache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.metrics.cacheHits++;
    this.updateCacheHitRate();

    return entry.data as T;
  }

  /**
   * Check if query result is cached
   */
  hasCachedQuery(query: string): boolean {
    const key = `query:${query}`;
    const entry = this.prefetchCache.get(key);
    if (!entry) return false;

    return Date.now() - entry.createdAt < this.config.cacheExpiryMs;
  }

  /**
   * Enforce memory limit by evicting entries
   */
  private enforceMemoryLimit(newSize: number): void {
    let currentSize = Array.from(this.prefetchCache.values()).reduce((sum, e) => sum + e.size, 0);

    const maxBytes = this.config.maxMemoryMb * 1024 * 1024;

    while (currentSize + newSize > maxBytes && this.prefetchCache.size > 0) {
      this.evictLeastUsed();
      currentSize = Array.from(this.prefetchCache.values()).reduce((sum, e) => sum + e.size, 0);
    }

    this.metrics.memoryUsageMb = currentSize / (1024 * 1024);
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastUsed(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.prefetchCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }

    if (oldest) {
      this.prefetchCache.delete(oldest);
      this.metrics.cacheSize = this.prefetchCache.size;
    }
  }

  /**
   * Update cache hit rate metric
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
  }

  // --------------------------------------------------------------------------
  // PATTERN FEEDBACK
  // --------------------------------------------------------------------------

  /**
   * Record when a prediction was correct
   */
  recordPredictionHit(triggerQuery: string, predictedQuery: string): void {
    // Find the pattern
    for (const pattern of this.queryPatterns.values()) {
      const matchScore = this.querySimilarity(String(pattern.trigger.value), triggerQuery);
      if (matchScore > 0.7) {
        // Update hit stats
        pattern.stats.hits++;
        pattern.stats.hitRate = pattern.stats.hits / pattern.stats.observations;

        // Boost prediction confidence
        const pred = pattern.predictions.find(
          (p) => this.querySimilarity(p.query, predictedQuery) > 0.8
        );
        if (pred) {
          pred.confidence = Math.min(1, pred.confidence + 0.05);
        }

        break;
      }
    }

    // Update overall pattern hit rate
    const allPatterns = Array.from(this.queryPatterns.values());
    const totalHits = allPatterns.reduce((sum, p) => sum + p.stats.hits, 0);
    const totalObs = allPatterns.reduce((sum, p) => sum + p.stats.observations, 0);
    this.metrics.patternHitRate = totalObs > 0 ? totalHits / totalObs : 0;
  }

  /**
   * Record when a prediction was wrong (user asked something different)
   */
  recordPredictionMiss(triggerQuery: string): void {
    // Slightly decay confidence on patterns that matched the trigger
    for (const pattern of this.queryPatterns.values()) {
      const matchScore = this.querySimilarity(String(pattern.trigger.value), triggerQuery);
      if (matchScore > 0.7) {
        for (const pred of pattern.predictions) {
          pred.confidence *= 0.98;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Simple cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Simple text similarity (Jaccard on words)
   */
  private querySimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Hash a pattern for keying
   */
  private hashPattern(query: string, intent?: string): string {
    const base = intent || query.toLowerCase().slice(0, 30);
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash = hash & hash;
    }
    return `pat_${Math.abs(hash).toString(36)}`;
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Get current metrics
   */
  getMetrics(): PrefetchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all learned patterns
   */
  getPatterns(): QueryPattern[] {
    return Array.from(this.queryPatterns.values());
  }

  /**
   * Get file access patterns
   */
  getFilePatterns(): FileAccessPattern[] {
    return Array.from(this.filePatterns.values());
  }

  /**
   * Clear all caches and patterns
   */
  clear(): void {
    this.prefetchCache.clear();
    this.queryPatterns.clear();
    this.filePatterns.clear();
    this.topicClusters.clear();
    this.queryHistory = [];
    this.prefetchQueue = [];
    this.backgroundIndexQueue = [];

    this.metrics = {
      totalPatterns: 0,
      activePatterns: 0,
      patternHitRate: 0,
      prefetchesAttempted: 0,
      prefetchesSuccessful: 0,
      prefetchesFailed: 0,
      prefetchHitRate: 0,
      avgPrefetchLatencyMs: 0,
      cacheSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      memoryUsageMb: 0,
      queueLength: 0,
      backgroundIndexPending: 0,
    };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.prefetchTimer) {
      clearInterval(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    if (this.backgroundIndexTimer) {
      clearInterval(this.backgroundIndexTimer);
      this.backgroundIndexTimer = null;
    }
    this.clear();
  }

  /**
   * Export patterns for persistence
   */
  exportPatterns(): {
    queryPatterns: QueryPattern[];
    filePatterns: FileAccessPattern[];
    topicClusters: TopicCluster[];
  } {
    return {
      queryPatterns: Array.from(this.queryPatterns.values()),
      filePatterns: Array.from(this.filePatterns.values()),
      topicClusters: Array.from(this.topicClusters.values()),
    };
  }

  /**
   * Import patterns from persistence
   */
  importPatterns(data: {
    queryPatterns?: QueryPattern[];
    filePatterns?: FileAccessPattern[];
    topicClusters?: TopicCluster[];
  }): void {
    if (data.queryPatterns) {
      for (const pattern of data.queryPatterns) {
        this.queryPatterns.set(pattern.id, pattern);
      }
    }
    if (data.filePatterns) {
      for (const pattern of data.filePatterns) {
        this.filePatterns.set(pattern.sourceFile, pattern);
      }
    }
    if (data.topicClusters) {
      for (const cluster of data.topicClusters) {
        this.topicClusters.set(cluster.id, cluster);
      }
    }

    this.metrics.totalPatterns = this.queryPatterns.size;
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

const prefetchInstances = new Map<string, PredictivePrefetchService>();

/**
 * Get or create a predictive prefetch service for a session
 */
export function getPredictivePrefetch(
  sessionId: string,
  config?: Partial<PrefetchConfig>
): PredictivePrefetchService {
  let instance = prefetchInstances.get(sessionId);
  if (!instance) {
    instance = new PredictivePrefetchService(sessionId, config);
    prefetchInstances.set(sessionId, instance);
  }
  return instance;
}

/**
 * Create a new predictive prefetch service
 */
export function createPredictivePrefetch(
  sessionId: string,
  config?: Partial<PrefetchConfig>
): PredictivePrefetchService {
  const existing = prefetchInstances.get(sessionId);
  if (existing) {
    existing.shutdown();
  }

  const instance = new PredictivePrefetchService(sessionId, config);
  prefetchInstances.set(sessionId, instance);
  return instance;
}

/**
 * Destroy a predictive prefetch service
 */
export function destroyPredictivePrefetch(sessionId: string): void {
  const instance = prefetchInstances.get(sessionId);
  if (instance) {
    instance.shutdown();
    prefetchInstances.delete(sessionId);
  }
}
