/**
 * PredictivePreloader Service
 *
 * Anticipates user queries based on conversation patterns and pre-warms context caches.
 * Uses Markov chains and n-gram models to predict likely next queries.
 *
 * Key Features:
 * - Query pattern learning from conversation history
 * - N-gram based next-query prediction
 * - Markov chain for topic transition modeling
 * - Pre-warming of context compressor and holographic memory
 * - Temporal pattern recognition (time-of-day, session patterns)
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface QueryPattern {
  query: string;
  timestamp: number;
  sessionId: string;
  topics: string[];
  followUp?: string;
  responseTime?: number;
}

export interface PredictionResult {
  query: string;
  confidence: number;
  source: 'ngram' | 'markov' | 'temporal' | 'semantic' | 'frequent';
  topics: string[];
  preloadedAt?: number;
}

export interface TopicTransition {
  from: string;
  to: string;
  count: number;
  avgTimeGap: number;
}

export interface TemporalPattern {
  hourOfDay: number;
  dayOfWeek: number;
  topics: Map<string, number>;
  queries: string[];
}

export interface PreloaderStats {
  totalQueries: number;
  predictionsGenerated: number;
  accuratePredictions: number;
  cacheHits: number;
  avgPredictionConfidence: number;
  topTopics: Array<{ topic: string; count: number }>;
}

// ============================================================================
// N-Gram Model for Query Prediction
// ============================================================================

export class NGramPredictor {
  private unigrams: Map<string, number> = new Map();
  private bigrams: Map<string, Map<string, number>> = new Map();
  private trigrams: Map<string, Map<string, number>> = new Map();
  private totalTokens: number = 0;

  constructor(private n: number = 3) {}

  /**
   * Tokenize a query into words/phrases
   */
  private tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Train on a sequence of queries
   */
  train(queries: string[]): void {
    for (let i = 0; i < queries.length; i++) {
      const tokens = this.tokenize(queries[i]);

      // Train unigrams
      for (const token of tokens) {
        this.unigrams.set(token, (this.unigrams.get(token) || 0) + 1);
        this.totalTokens++;
      }

      // Train bigrams (query pairs)
      if (i > 0) {
        const prevQuery = queries[i - 1];
        const currQuery = queries[i];

        if (!this.bigrams.has(prevQuery)) {
          this.bigrams.set(prevQuery, new Map());
        }
        const bigramMap = this.bigrams.get(prevQuery);
        if (bigramMap) {
          bigramMap.set(currQuery, (bigramMap.get(currQuery) || 0) + 1);
        }
      }

      // Train trigrams (query triplets)
      if (i > 1) {
        const key = `${queries[i - 2]}|||${queries[i - 1]}`;
        const currQuery = queries[i];

        if (!this.trigrams.has(key)) {
          this.trigrams.set(key, new Map());
        }
        const trigramMap = this.trigrams.get(key);
        if (trigramMap) {
          trigramMap.set(currQuery, (trigramMap.get(currQuery) || 0) + 1);
        }
      }
    }
  }

  /**
   * Predict next query given history
   */
  predict(history: string[], topK: number = 5): PredictionResult[] {
    const predictions: Map<string, number> = new Map();

    // Trigram predictions (highest weight)
    if (history.length >= 2) {
      const key = `${history[history.length - 2]}|||${history[history.length - 1]}`;
      const trigramNext = this.trigrams.get(key);
      if (trigramNext) {
        const total = Array.from(trigramNext.values()).reduce((a, b) => a + b, 0);
        for (const [query, count] of trigramNext) {
          const score = (count / total) * 3.0; // Triple weight for trigrams
          predictions.set(query, (predictions.get(query) || 0) + score);
        }
      }
    }

    // Bigram predictions
    if (history.length >= 1) {
      const prevQuery = history[history.length - 1];
      const bigramNext = this.bigrams.get(prevQuery);
      if (bigramNext) {
        const total = Array.from(bigramNext.values()).reduce((a, b) => a + b, 0);
        for (const [query, count] of bigramNext) {
          const score = (count / total) * 2.0; // Double weight for bigrams
          predictions.set(query, (predictions.get(query) || 0) + score);
        }
      }
    }

    // Sort and return top K
    return Array.from(predictions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([query, score]) => ({
        query,
        confidence: Math.min(score, 1.0),
        source: 'ngram' as const,
        topics: this.extractTopics(query),
      }));
  }

  /**
   * Extract likely topics from a query
   */
  private extractTopics(query: string): string[] {
    const tokens = this.tokenize(query);
    const topics: string[] = [];

    // Find high-frequency tokens that might be topics
    for (const token of tokens) {
      const freq = this.unigrams.get(token) || 0;
      if (freq > 2 && token.length > 3) {
        topics.push(token);
      }
    }

    return topics.slice(0, 5);
  }

  /**
   * Get vocabulary size
   */
  getVocabSize(): number {
    return this.unigrams.size;
  }
}

// ============================================================================
// Markov Chain for Topic Transitions
// ============================================================================

export class TopicMarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map();
  private topicCounts: Map<string, number> = new Map();
  private transitionTimes: Map<string, number[]> = new Map();

  /**
   * Record a topic transition
   */
  recordTransition(fromTopic: string, toTopic: string, timeGap: number = 0): void {
    // Update transition counts
    if (!this.transitions.has(fromTopic)) {
      this.transitions.set(fromTopic, new Map());
    }
    const fromMap = this.transitions.get(fromTopic);
    if (fromMap) {
      fromMap.set(toTopic, (fromMap.get(toTopic) || 0) + 1);
    }

    // Update topic counts
    this.topicCounts.set(fromTopic, (this.topicCounts.get(fromTopic) || 0) + 1);
    this.topicCounts.set(toTopic, (this.topicCounts.get(toTopic) || 0) + 1);

    // Record transition time
    const key = `${fromTopic}|||${toTopic}`;
    if (!this.transitionTimes.has(key)) {
      this.transitionTimes.set(key, []);
    }
    const transitionTimesArray = this.transitionTimes.get(key);
    if (transitionTimesArray) {
      transitionTimesArray.push(timeGap);
    }
  }

  /**
   * Get probability of transitioning to a topic
   */
  getTransitionProbability(fromTopic: string, toTopic: string): number {
    const fromMap = this.transitions.get(fromTopic);
    if (!fromMap) return 0;

    const total = Array.from(fromMap.values()).reduce((a, b) => a + b, 0);
    return (fromMap.get(toTopic) || 0) / total;
  }

  /**
   * Predict next topics given current topic
   */
  predictNextTopics(
    currentTopic: string,
    topK: number = 5
  ): Array<{ topic: string; probability: number; avgTimeGap: number }> {
    const fromMap = this.transitions.get(currentTopic);
    if (!fromMap) return [];

    const total = Array.from(fromMap.values()).reduce((a, b) => a + b, 0);

    return Array.from(fromMap.entries())
      .map(([topic, count]) => {
        const key = `${currentTopic}|||${topic}`;
        const times = this.transitionTimes.get(key) || [];
        const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

        return {
          topic,
          probability: count / total,
          avgTimeGap: avgTime,
        };
      })
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topK);
  }

  /**
   * Get most common topics overall
   */
  getTopTopics(topK: number = 10): Array<{ topic: string; count: number }> {
    return Array.from(this.topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * Get all transition data for analysis
   */
  getTransitions(): TopicTransition[] {
    const result: TopicTransition[] = [];

    for (const [from, toMap] of this.transitions) {
      for (const [to, count] of toMap) {
        const key = `${from}|||${to}`;
        const times = this.transitionTimes.get(key) || [];
        const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

        result.push({ from, to, count, avgTimeGap: avgTime });
      }
    }

    return result;
  }
}

// ============================================================================
// Temporal Pattern Analyzer
// ============================================================================

export class TemporalPatternAnalyzer {
  // 24 hours x 7 days = 168 time slots
  private patterns: TemporalPattern[] = [];
  private hourlyTopics: Map<number, Map<string, number>> = new Map();
  private hourlyQueries: Map<number, string[]> = new Map();

  constructor() {
    // Initialize hourly maps
    for (let h = 0; h < 24; h++) {
      this.hourlyTopics.set(h, new Map());
      this.hourlyQueries.set(h, []);
    }
  }

  /**
   * Record a query at a specific time
   */
  recordQuery(query: string, topics: string[], timestamp: number = Date.now()): void {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    // Update hourly topics
    const topicMap = this.hourlyTopics.get(hour);
    if (topicMap) {
      for (const topic of topics) {
        topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
      }
    }

    // Store query
    const queries = this.hourlyQueries.get(hour);
    if (queries) {
      queries.push(query);
      // Keep only last 100 queries per hour
      if (queries.length > 100) {
        queries.shift();
      }
    }

    // Update patterns
    const existingPattern = this.patterns.find((p) => p.hourOfDay === hour && p.dayOfWeek === day);
    if (existingPattern) {
      for (const topic of topics) {
        existingPattern.topics.set(topic, (existingPattern.topics.get(topic) || 0) + 1);
      }
      existingPattern.queries.push(query);
      if (existingPattern.queries.length > 50) {
        existingPattern.queries.shift();
      }
    } else {
      this.patterns.push({
        hourOfDay: hour,
        dayOfWeek: day,
        topics: new Map(topics.map((t) => [t, 1])),
        queries: [query],
      });
    }
  }

  /**
   * Predict likely topics for current time
   */
  predictForCurrentTime(topK: number = 5): Array<{ topic: string; score: number }> {
    const now = new Date();
    const hour = now.getHours();

    const topicMap = this.hourlyTopics.get(hour);
    if (!topicMap || topicMap.size === 0) {
      return [];
    }

    const total = Array.from(topicMap.values()).reduce((a, b) => a + b, 0);

    return Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, score: count / total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get queries typically asked at current time
   */
  getTypicalQueriesForTime(timestamp: number = Date.now(), limit: number = 10): string[] {
    const hour = new Date(timestamp).getHours();
    const queries = this.hourlyQueries.get(hour) || [];

    // Return most recent unique queries
    const seen = new Set<string>();
    const unique: string[] = [];

    for (let i = queries.length - 1; i >= 0 && unique.length < limit; i--) {
      if (!seen.has(queries[i])) {
        seen.add(queries[i]);
        unique.push(queries[i]);
      }
    }

    return unique;
  }

  /**
   * Get pattern summary
   */
  getPatternSummary(): Array<{ hour: number; day: number; topTopics: string[] }> {
    return this.patterns.map((p) => ({
      hour: p.hourOfDay,
      day: p.dayOfWeek,
      topTopics: Array.from(p.topics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t),
    }));
  }
}

// ============================================================================
// Semantic Similarity Cache (for fast approximate matching)
// ============================================================================

export class SemanticQueryCache {
  private queryVectors: Map<string, Float64Array> = new Map();
  private dimension: number;
  private randomProjection: Float64Array;

  constructor(dimension: number = 256) {
    this.dimension = dimension;
    this.randomProjection = new Float64Array(dimension * 1000); // For hashing
    for (let i = 0; i < this.randomProjection.length; i++) {
      this.randomProjection[i] = (Math.random() - 0.5) * 2;
    }
  }

  /**
   * Create a simple vector from query text (TF-IDF-like)
   */
  private vectorize(query: string): Float64Array {
    const vector = new Float64Array(this.dimension);
    const tokens = query.toLowerCase().split(/\s+/);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Hash token to positions
      for (let j = 0; j < 3; j++) {
        const hash = this.hashString(`${token}:${j}`);
        const pos = Math.abs(hash) % this.dimension;
        const sign = hash > 0 ? 1 : -1;
        vector[pos] += sign * (1 / (i + 1)); // Position-weighted
      }
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0)) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] /= norm;
    }

    return vector;
  }

  /**
   * Simple string hash
   */
  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Add a query to cache
   */
  addQuery(query: string): void {
    if (!this.queryVectors.has(query)) {
      this.queryVectors.set(query, this.vectorize(query));
    }
  }

  /**
   * Find similar queries
   */
  findSimilar(
    query: string,
    topK: number = 5,
    threshold: number = 0.3
  ): Array<{ query: string; similarity: number }> {
    const queryVec = this.vectorize(query);
    const results: Array<{ query: string; similarity: number }> = [];

    for (const [cachedQuery, cachedVec] of this.queryVectors) {
      if (cachedQuery === query) continue;

      // Cosine similarity
      let dot = 0;
      for (let i = 0; i < this.dimension; i++) {
        dot += queryVec[i] * cachedVec[i];
      }

      if (dot >= threshold) {
        results.push({ query: cachedQuery, similarity: dot });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.queryVectors.size;
  }
}

// ============================================================================
// Preload Cache
// ============================================================================

export interface PreloadedContext {
  query: string;
  prediction: PredictionResult;
  preloadedAt: number;
  context?: unknown; // The actual preloaded data
  used: boolean;
  usedAt?: number;
}

export class PreloadCache {
  private cache: Map<string, PreloadedContext> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 50, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  /**
   * Add preloaded context
   */
  set(query: string, prediction: PredictionResult, context?: unknown): void {
    // Evict expired entries
    this.cleanup();

    // Evict least confident if at capacity
    if (this.cache.size >= this.maxSize) {
      let minConfidence = 1.0;
      let minKey: string | null = null;

      for (const [key, value] of this.cache) {
        if (!value.used && value.prediction.confidence < minConfidence) {
          minConfidence = value.prediction.confidence;
          minKey = key;
        }
      }

      if (minKey) {
        this.cache.delete(minKey);
      }
    }

    this.cache.set(query, {
      query,
      prediction: { ...prediction, preloadedAt: Date.now() },
      preloadedAt: Date.now(),
      context,
      used: false,
    });
  }

  /**
   * Get preloaded context
   */
  get(query: string): PreloadedContext | undefined {
    const entry = this.cache.get(query);
    if (entry) {
      entry.used = true;
      entry.usedAt = Date.now();
    }
    return entry;
  }

  /**
   * Check if query is preloaded
   */
  has(query: string): boolean {
    return this.cache.has(query);
  }

  /**
   * Find approximate match using normalized query
   */
  findApproximate(query: string, threshold: number = 0.8): PreloadedContext | undefined {
    const normalizedQuery = query.toLowerCase().trim();

    for (const [key, value] of this.cache) {
      const normalizedKey = key.toLowerCase().trim();

      // Exact prefix match
      if (normalizedKey.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedKey)) {
        return value;
      }

      // Word overlap
      const queryWords = new Set(normalizedQuery.split(/\s+/));
      const keyWords = new Set(normalizedKey.split(/\s+/));
      const intersection = new Set([...queryWords].filter((w) => keyWords.has(w)));
      const overlap = intersection.size / Math.max(queryWords.size, keyWords.size);

      if (overlap >= threshold) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (now - value.preloadedAt > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; used: number; hitRate: number } {
    let used = 0;
    for (const value of this.cache.values()) {
      if (value.used) used++;
    }

    return {
      size: this.cache.size,
      used,
      hitRate: this.cache.size > 0 ? used / this.cache.size : 0,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Main Predictive Preloader
// ============================================================================

export class PredictivePreloader extends EventEmitter {
  private ngramPredictor: NGramPredictor;
  private topicMarkov: TopicMarkovChain;
  private temporalAnalyzer: TemporalPatternAnalyzer;
  private semanticCache: SemanticQueryCache;
  private preloadCache: PreloadCache;

  private queryHistory: QueryPattern[] = [];
  private sessionHistory: Map<string, string[]> = new Map();
  private currentSession: string;

  private isPreloading: boolean = false;
  private preloadInterval: ReturnType<typeof setInterval> | null = null;

  private stats: PreloaderStats = {
    totalQueries: 0,
    predictionsGenerated: 0,
    accuratePredictions: 0,
    cacheHits: 0,
    avgPredictionConfidence: 0,
    topTopics: [],
  };

  constructor(sessionId?: string) {
    super();
    this.ngramPredictor = new NGramPredictor(3);
    this.topicMarkov = new TopicMarkovChain();
    this.temporalAnalyzer = new TemporalPatternAnalyzer();
    this.semanticCache = new SemanticQueryCache(256);
    this.preloadCache = new PreloadCache(50, 5 * 60 * 1000);
    this.currentSession = sessionId || `session_${Date.now()}`;
    this.sessionHistory.set(this.currentSession, []);
  }

  /**
   * Extract topics from query (simple keyword extraction)
   */
  private extractTopics(query: string): string[] {
    const stopwords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'if',
      'or',
      'because',
      'until',
      'while',
      'this',
      'that',
      'these',
      'those',
      'what',
      'which',
      'who',
      'whom',
      'it',
      'its',
      'i',
      'me',
      'my',
      'you',
      'your',
      'he',
      'him',
      'his',
      'she',
      'her',
      'we',
      'they',
      'them',
      'their',
    ]);

    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    // Return unique words as topics (simple approach)
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Record a query and learn from it
   */
  recordQuery(query: string, sessionId?: string): void {
    const session = sessionId || this.currentSession;
    const timestamp = Date.now();
    const topics = this.extractTopics(query);

    // Add to query history
    const pattern: QueryPattern = {
      query,
      timestamp,
      sessionId: session,
      topics,
    };
    this.queryHistory.push(pattern);

    // Keep history bounded
    if (this.queryHistory.length > 10000) {
      this.queryHistory = this.queryHistory.slice(-5000);
    }

    // Add to session history
    if (!this.sessionHistory.has(session)) {
      this.sessionHistory.set(session, []);
    }
    const sessionQueries = this.sessionHistory.get(session);
    if (sessionQueries) {
      sessionQueries.push(query);

      // Link follow-up to previous query
      if (sessionQueries.length > 1) {
        const prevIndex = this.queryHistory.length - 2;
        if (prevIndex >= 0 && this.queryHistory[prevIndex].sessionId === session) {
          this.queryHistory[prevIndex].followUp = query;

          // Record topic transition
          const prevTopics = this.queryHistory[prevIndex].topics;
          const timeGap = timestamp - this.queryHistory[prevIndex].timestamp;
          for (const fromTopic of prevTopics) {
            for (const toTopic of topics) {
              this.topicMarkov.recordTransition(fromTopic, toTopic, timeGap);
            }
          }
        }
      }
    }

    // Train n-gram predictor
    this.ngramPredictor.train([query]);

    // Add to semantic cache
    this.semanticCache.addQuery(query);

    // Record temporal pattern
    this.temporalAnalyzer.recordQuery(query, topics, timestamp);

    // Update stats
    this.stats.totalQueries++;

    // Check if we predicted this query
    if (this.preloadCache.has(query) || this.preloadCache.findApproximate(query)) {
      this.stats.cacheHits++;
      this.stats.accuratePredictions++;
    }

    // Emit event
    this.emit('queryRecorded', pattern);
  }

  /**
   * Generate predictions based on current state
   */
  generatePredictions(topK: number = 10): PredictionResult[] {
    const predictions: Map<string, PredictionResult> = new Map();
    const sessionQueries = this.sessionHistory.get(this.currentSession) || [];

    // 1. N-gram predictions (based on query sequence)
    if (sessionQueries.length > 0) {
      const ngramPreds = this.ngramPredictor.predict(sessionQueries, 5);
      for (const pred of ngramPreds) {
        predictions.set(pred.query, pred);
      }
    }

    // 2. Topic-based Markov predictions
    if (sessionQueries.length > 0) {
      const lastQuery = sessionQueries[sessionQueries.length - 1];
      const lastTopics = this.extractTopics(lastQuery);

      for (const topic of lastTopics) {
        const nextTopics = this.topicMarkov.predictNextTopics(topic, 3);
        for (const next of nextTopics) {
          // Find queries with this topic
          const matchingQueries = this.queryHistory
            .filter((q) => q.topics.includes(next.topic))
            .map((q) => q.query);

          if (matchingQueries.length > 0) {
            const query = matchingQueries[Math.floor(Math.random() * matchingQueries.length)];
            if (!predictions.has(query)) {
              predictions.set(query, {
                query,
                confidence: next.probability * 0.8,
                source: 'markov',
                topics: [next.topic],
              });
            }
          }
        }
      }
    }

    // 3. Temporal predictions
    const _temporalTopics = this.temporalAnalyzer.predictForCurrentTime(5);
    const typicalQueries = this.temporalAnalyzer.getTypicalQueriesForTime(Date.now(), 5);

    for (const query of typicalQueries) {
      if (!predictions.has(query)) {
        predictions.set(query, {
          query,
          confidence: 0.5,
          source: 'temporal',
          topics: this.extractTopics(query),
        });
      }
    }

    // 4. Semantic similarity (find similar to recent queries)
    if (sessionQueries.length > 0) {
      const lastQuery = sessionQueries[sessionQueries.length - 1];
      const similar = this.semanticCache.findSimilar(lastQuery, 5, 0.3);

      for (const sim of similar) {
        if (!predictions.has(sim.query)) {
          predictions.set(sim.query, {
            query: sim.query,
            confidence: sim.similarity * 0.7,
            source: 'semantic',
            topics: this.extractTopics(sim.query),
          });
        }
      }
    }

    // 5. Frequent queries
    const topTopics = this.topicMarkov.getTopTopics(5);
    for (const { topic } of topTopics) {
      const topicQueries = this.queryHistory
        .filter((q) => q.topics.includes(topic))
        .slice(-3)
        .map((q) => q.query);

      for (const query of topicQueries) {
        if (!predictions.has(query)) {
          predictions.set(query, {
            query,
            confidence: 0.4,
            source: 'frequent',
            topics: [topic],
          });
        }
      }
    }

    // Sort by confidence and return top K
    const result = Array.from(predictions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);

    this.stats.predictionsGenerated += result.length;
    if (result.length > 0) {
      this.stats.avgPredictionConfidence =
        result.reduce((a, b) => a + b.confidence, 0) / result.length;
    }

    return result;
  }

  /**
   * Preload context for predicted queries
   */
  async preload(preloadFn?: (query: string) => Promise<unknown>): Promise<number> {
    const predictions = this.generatePredictions(10);
    let preloaded = 0;

    for (const pred of predictions) {
      if (!this.preloadCache.has(pred.query) && pred.confidence >= 0.3) {
        let context: unknown = undefined;

        if (preloadFn) {
          try {
            context = await preloadFn(pred.query);
          } catch {
            // Ignore preload errors
          }
        }

        this.preloadCache.set(pred.query, pred, context);
        preloaded++;

        this.emit('contextPreloaded', pred);
      }
    }

    return preloaded;
  }

  /**
   * Get preloaded context for a query
   */
  getPreloaded(query: string): PreloadedContext | undefined {
    const exact = this.preloadCache.get(query);
    if (exact) return exact;

    return this.preloadCache.findApproximate(query, 0.7);
  }

  /**
   * Start automatic preloading loop
   */
  startAutoPreload(
    intervalMs: number = 30000,
    preloadFn?: (query: string) => Promise<unknown>
  ): void {
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
    }

    this.isPreloading = true;
    this.preloadInterval = setInterval(async () => {
      if (this.isPreloading) {
        await this.preload(preloadFn);
      }
    }, intervalMs);

    this.emit('autoPreloadStarted', { intervalMs });
  }

  /**
   * Stop automatic preloading
   */
  stopAutoPreload(): void {
    this.isPreloading = false;
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
      this.preloadInterval = null;
    }
    this.emit('autoPreloadStopped');
  }

  /**
   * Start a new session
   */
  startSession(sessionId?: string): string {
    this.currentSession = sessionId || `session_${Date.now()}`;
    this.sessionHistory.set(this.currentSession, []);
    this.emit('sessionStarted', { sessionId: this.currentSession });
    return this.currentSession;
  }

  /**
   * Get current session ID
   */
  getCurrentSession(): string {
    return this.currentSession;
  }

  /**
   * Get statistics
   */
  getStats(): PreloaderStats & { cacheStats: ReturnType<PreloadCache['getStats']> } {
    return {
      ...this.stats,
      topTopics: this.topicMarkov.getTopTopics(10),
      cacheStats: this.preloadCache.getStats(),
    };
  }

  /**
   * Get topic transitions for visualization
   */
  getTopicTransitions(): TopicTransition[] {
    return this.topicMarkov.getTransitions();
  }

  /**
   * Get temporal patterns for visualization
   */
  getTemporalPatterns(): Array<{ hour: number; day: number; topTopics: string[] }> {
    return this.temporalAnalyzer.getPatternSummary();
  }

  /**
   * Get query history for session
   */
  getSessionHistory(sessionId?: string): QueryPattern[] {
    const session = sessionId || this.currentSession;
    return this.queryHistory.filter((q) => q.sessionId === session);
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.ngramPredictor = new NGramPredictor(3);
    this.topicMarkov = new TopicMarkovChain();
    this.temporalAnalyzer = new TemporalPatternAnalyzer();
    this.semanticCache = new SemanticQueryCache(256);
    this.preloadCache.clear();
    this.queryHistory = [];
    this.sessionHistory.clear();
    this.stats = {
      totalQueries: 0,
      predictionsGenerated: 0,
      accuratePredictions: 0,
      cacheHits: 0,
      avgPredictionConfidence: 0,
      topTopics: [],
    };
    this.emit('reset');
  }

  /**
   * Export state for persistence
   */
  exportState(): {
    queryHistory: QueryPattern[];
    stats: PreloaderStats;
  } {
    return {
      queryHistory: this.queryHistory,
      stats: this.stats,
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: { queryHistory: QueryPattern[]; stats?: PreloaderStats }): void {
    // Re-train from history
    for (const pattern of state.queryHistory) {
      this.queryHistory.push(pattern);
      this.ngramPredictor.train([pattern.query]);
      this.semanticCache.addQuery(pattern.query);
      this.temporalAnalyzer.recordQuery(pattern.query, pattern.topics, pattern.timestamp);

      // Add to session history
      if (!this.sessionHistory.has(pattern.sessionId)) {
        this.sessionHistory.set(pattern.sessionId, []);
      }
      const sessionHistoryForPattern = this.sessionHistory.get(pattern.sessionId);
      if (sessionHistoryForPattern) {
        sessionHistoryForPattern.push(pattern.query);
      }
    }

    // Rebuild topic transitions
    for (let i = 1; i < state.queryHistory.length; i++) {
      const prev = state.queryHistory[i - 1];
      const curr = state.queryHistory[i];

      if (prev.sessionId === curr.sessionId) {
        const timeGap = curr.timestamp - prev.timestamp;
        for (const fromTopic of prev.topics) {
          for (const toTopic of curr.topics) {
            this.topicMarkov.recordTransition(fromTopic, toTopic, timeGap);
          }
        }
      }
    }

    if (state.stats) {
      this.stats = { ...this.stats, ...state.stats };
    }

    this.emit('stateImported');
  }
}

// ============================================================================
// Singleton Service
// ============================================================================

export class PredictivePreloaderService {
  private static instance: PredictivePreloaderService;
  private preloaders: Map<string, PredictivePreloader> = new Map();
  private defaultPreloader: PredictivePreloader;

  private constructor() {
    this.defaultPreloader = new PredictivePreloader('default');
  }

  static getInstance(): PredictivePreloaderService {
    if (!PredictivePreloaderService.instance) {
      PredictivePreloaderService.instance = new PredictivePreloaderService();
    }
    return PredictivePreloaderService.instance;
  }

  /**
   * Get or create a preloader for a user/context
   */
  getPreloader(userId?: string): PredictivePreloader {
    if (!userId) return this.defaultPreloader;

    if (!this.preloaders.has(userId)) {
      this.preloaders.set(userId, new PredictivePreloader(`${userId}_session`));
    }
    const preloader = this.preloaders.get(userId);
    if (!preloader) {
      throw new Error(`Preloader for userId ${userId} not found`);
    }
    return preloader;
  }

  /**
   * Get the default preloader
   */
  getDefault(): PredictivePreloader {
    return this.defaultPreloader;
  }

  /**
   * Get all preloaders stats
   */
  getAllStats(): Map<string, ReturnType<PredictivePreloader['getStats']>> {
    const stats = new Map<string, ReturnType<PredictivePreloader['getStats']>>();
    stats.set('default', this.defaultPreloader.getStats());

    for (const [userId, preloader] of this.preloaders) {
      stats.set(userId, preloader.getStats());
    }

    return stats;
  }
}

export default PredictivePreloaderService;
