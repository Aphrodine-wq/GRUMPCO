/**
 * Agent Semantic Compiler Store
 *
 * Svelte store for the 100x Semantic Compiler - the solution to the Data Wall Problem.
 *
 * This store provides:
 * - Context compilation with 10-100x compression
 * - Progressive loading (abstract → summary → detailed → source)
 * - Speculative pre-compilation
 * - Delta streaming (only send changes)
 * - Real-time compilation statistics
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi, getApiBase } from '../lib/api.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CompilationStats {
  originalTokens: number;
  compiledTokens: number;
  compressionRatio: number;
  unitsIncluded: number;
  unitsAvailable: number;
  retrievalTimeMs: number;
  compilationTimeMs: number;
  estimatedCost: number;
}

export interface IncludedUnit {
  id: string;
  type: SemanticType;
  relevance: number;
  detailLevel: string;
  tokenCount: number;
}

export interface ExcludedUnit {
  id: string;
  reason: 'low_relevance' | 'budget_limit' | 'token_limit' | 'redundant';
}

export interface CompilationResult {
  id: string;
  compiledContext: string;
  stats: CompilationStats;
  includedUnits: IncludedUnit[];
  excludedUnits: ExcludedUnit[];
  delta?: {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
  };
}

export interface CompilerStats {
  compilations: number;
  cacheHits: number;
  cacheMisses: number;
  speculativeHits: number;
  tokensCompiled: number;
  tokensSaved: number;
  totalCostSaved: number;
  indexSize: number;
  cacheSize: number;
  speculativeCacheSize: number;
  compressionEfficiency: number;
}

export interface PrefetchMetrics {
  totalPatterns: number;
  activePatterns: number;
  patternHitRate: number;
  prefetchesAttempted: number;
  prefetchesSuccessful: number;
  prefetchesFailed: number;
  prefetchHitRate: number;
  avgPrefetchLatencyMs: number;
  cacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  memoryUsageMb: number;
  queueLength: number;
  backgroundIndexPending: number;
}

export interface QueryPrediction {
  query: string;
  confidence: number;
}

export interface FilePrediction {
  path: string;
  confidence: number;
}

export interface QueryPattern {
  id: string;
  observations: number;
  hitRate: number;
  lastSeen: string;
  predictions: Array<{
    query: string;
    confidence: number;
  }>;
}

// ============================================================================
// MULTI-MODAL TYPES
// ============================================================================

export type ContentModality =
  | 'code'
  | 'test'
  | 'docs'
  | 'config'
  | 'types'
  | 'api'
  | 'data'
  | 'style'
  | 'unknown';

export type UserIntent =
  | 'understand'
  | 'implement'
  | 'debug'
  | 'test'
  | 'document'
  | 'refactor'
  | 'review'
  | 'configure'
  | 'general';

export interface ModalityBreakdown {
  modality: ContentModality;
  count: number;
  percentage: number;
  tokens: number;
}

export interface CrossReference {
  sourceId: string;
  targetId: string;
  type: 'imports' | 'tests' | 'documents' | 'implements' | 'configures' | 'types';
  confidence: number;
}

export interface MultiModalUnit {
  id: string;
  filePath: string;
  modality: ContentModality;
  content: string;
  tokenCount: number;
  relevanceScore: number;
  crossRefs: CrossReference[];
}

export interface MultiModalResult {
  compiledContext: string;
  stats: {
    totalUnits: number;
    includedUnits: number;
    totalTokens: number;
    includedTokens: number;
    compilationTimeMs: number;
    intentDetected: UserIntent;
    crossRefsUsed: number;
  };
  breakdown: ModalityBreakdown[];
  includedUnits: Array<{
    id: string;
    modality: ContentModality;
    path: string;
    relevance: number;
    tokens: number;
  }>;
}

export interface MultiModalMetrics {
  compilations: number;
  unitsProcessed: number;
  crossRefsDetected: number;
  avgModalityBalance: number;
}

// ============================================================================
// HIERARCHICAL CACHE TYPES
// ============================================================================

export interface TierMetrics {
  entries: number;
  memoryUsageMb: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAccessCount: number;
  oldestEntryAge: number;
}

export interface HierarchicalCacheMetrics {
  l1: TierMetrics;
  l2: TierMetrics;
  l3: TierMetrics;
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  promotions: number;
  demotions: number;
  evictions: number;
  persistedEntries: number;
}

export interface CacheEntryInfo {
  key: string;
  size: number;
  accessCount: number;
  lastAccessedAt: string;
  importance: number;
}

// ============================================================================
// REAL-TIME LEARNING TYPES
// ============================================================================

export type FeedbackType =
  | 'helpful'
  | 'not_helpful'
  | 'missing_context'
  | 'too_verbose'
  | 'too_brief'
  | 'wrong_intent'
  | 'wrong_files'
  | 'correction';

export interface LearningSignal {
  type: 'boost' | 'suppress' | 'adjust';
  target: 'file' | 'unit' | 'modality' | 'intent' | 'pattern';
  targetId: string;
  magnitude: number;
  reason: string;
  confidence: number;
  decay: number;
}

export interface LearningMetrics {
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  corrections: number;
  estimatedAccuracy: number;
  lastAccuracyUpdate: number;
  signalsGenerated: number;
  signalsApplied: number;
  learnedFileBoosts: number;
  learnedIntentCorrections: number;
  learnedPatterns: number;
}

export interface UserPreferencesData {
  preferredDetailLevel: 'abstract' | 'summary' | 'detailed' | 'source';
  detailLevelConfidence: number;
  modalityWeights: Record<string, number>;
  fileImportance: Record<string, number>;
  intentVocabulary: Record<string, string>;
  antiPatterns: string[];
  preferredPatterns: string[];
}

export type SemanticType =
  | 'concept'
  | 'function'
  | 'class'
  | 'module'
  | 'component'
  | 'pattern'
  | 'requirement'
  | 'constraint'
  | 'decision'
  | 'conversation'
  | 'task'
  | 'memory';

export interface IndexedUnit {
  id: string;
  type: SemanticType;
  abstract: string;
  importance: number;
}

export interface ProgressiveLevel {
  level: 'abstract' | 'summary' | 'detailed' | 'source';
  loadedUnits: number;
  tokenBudgetUsed: number;
  tokenBudgetRemaining: number;
  units: Array<{
    id: string;
    type: SemanticType;
    preview: string;
  }>;
}

interface GAgentCompilerStoreState {
  // Last compilation result
  lastResult: CompilationResult | null;

  // Compiler statistics
  stats: CompilerStats | null;

  // Prefetch metrics
  prefetchMetrics: PrefetchMetrics | null;

  // Query predictions
  queryPredictions: QueryPrediction[];

  // File predictions
  filePredictions: FilePrediction[];

  // Multi-modal state
  multiModalResult: MultiModalResult | null;
  multiModalMetrics: MultiModalMetrics | null;
  isCompilingMultiModal: boolean;

  // Hierarchical cache state
  cacheMetrics: HierarchicalCacheMetrics | null;

  // Real-time learning state
  learningMetrics: LearningMetrics | null;
  learningPreferences: UserPreferencesData | null;

  // Progressive loading state
  progressiveLevels: ProgressiveLevel[];
  currentLevel: 'abstract' | 'summary' | 'detailed' | 'source' | null;

  // Indexed files
  indexedFiles: Map<string, IndexedUnit[]>;

  // UI state
  isCompiling: boolean;
  isIndexing: boolean;
  isStreaming: boolean;
  isPredicting: boolean;
  error: string | null;

  // Session
  sessionId: string;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: GAgentCompilerStoreState = {
  lastResult: null,
  stats: null,
  prefetchMetrics: null,
  queryPredictions: [],
  filePredictions: [],
  multiModalResult: null,
  multiModalMetrics: null,
  isCompilingMultiModal: false,
  cacheMetrics: null,
  learningMetrics: null,
  learningPreferences: null,
  progressiveLevels: [],
  currentLevel: null,
  indexedFiles: new Map(),
  isCompiling: false,
  isIndexing: false,
  isStreaming: false,
  isPredicting: false,
  error: null,
  sessionId: 'default',
};

// ============================================================================
// STORE
// ============================================================================

const store = writable<GAgentCompilerStoreState>(initialState);

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Last compilation result
 */
export const compilationResult = derived(store, ($s) => $s.lastResult);

/**
 * Compiled context (ready to send to LLM)
 */
export const compiledContext = derived(store, ($s) => $s.lastResult?.compiledContext ?? '');

/**
 * Compression ratio (how much we saved)
 */
export const compressionRatio = derived(store, ($s) => $s.lastResult?.stats.compressionRatio ?? 0);

/**
 * Is currently compiling?
 */
export const isCompiling = derived(store, ($s) => $s.isCompiling);

/**
 * Compiler statistics
 */
export const compilerStats = derived(store, ($s) => $s.stats);

/**
 * Tokens saved (cumulative)
 */
export const tokensSaved = derived(store, ($s) => $s.stats?.tokensSaved ?? 0);

/**
 * Cost saved (cumulative, in cents)
 */
export const costSaved = derived(store, ($s) => $s.stats?.totalCostSaved ?? 0);

/**
 * Index size (number of semantic units)
 */
export const indexSize = derived(store, ($s) => $s.stats?.indexSize ?? 0);

/**
 * Progressive levels for streaming UI
 */
export const progressiveLevels = derived(store, ($s) => $s.progressiveLevels);

/**
 * Prefetch metrics
 */
export const prefetchMetrics = derived(store, ($s) => $s.prefetchMetrics);

/**
 * Predicted follow-up queries
 */
export const queryPredictions = derived(store, ($s) => $s.queryPredictions);

/**
 * Predicted files to access
 */
export const filePredictions = derived(store, ($s) => $s.filePredictions);

/**
 * Prefetch hit rate (percentage)
 */
export const prefetchHitRate = derived(store, ($s) => $s.prefetchMetrics?.prefetchHitRate ?? 0);

/**
 * Active learned patterns count
 */
export const activePatterns = derived(store, ($s) => $s.prefetchMetrics?.activePatterns ?? 0);

/**
 * Is currently predicting?
 */
export const isPredicting = derived(store, ($s) => $s.isPredicting);

// ============================================================================
// MULTI-MODAL DERIVED STORES
// ============================================================================

/**
 * Multi-modal compilation result
 */
export const multiModalResult = derived(store, ($s) => $s.multiModalResult);

/**
 * Multi-modal metrics
 */
export const multiModalMetrics = derived(store, ($s) => $s.multiModalMetrics);

/**
 * Is currently compiling multi-modal?
 */
export const isCompilingMultiModal = derived(store, ($s) => $s.isCompilingMultiModal);

/**
 * Modality breakdown from last multi-modal compilation
 */
export const modalityBreakdown = derived(store, ($s) => $s.multiModalResult?.breakdown ?? []);

/**
 * Detected intent from last multi-modal compilation
 */
export const detectedIntent = derived(
  store,
  ($s) => $s.multiModalResult?.stats.intentDetected ?? 'general'
);

/**
 * Cross-references used in last compilation
 */
export const crossRefsUsed = derived(store, ($s) => $s.multiModalResult?.stats.crossRefsUsed ?? 0);

// ============================================================================
// HIERARCHICAL CACHE DERIVED STORES
// ============================================================================

/**
 * Hierarchical cache metrics
 */
export const cacheMetrics = derived(store, ($s) => $s.cacheMetrics);

/**
 * Overall cache hit rate (percentage)
 */
export const cacheHitRate = derived(store, ($s) => ($s.cacheMetrics?.overallHitRate ?? 0) * 100);

/**
 * L1 (hot) cache metrics
 */
export const l1CacheMetrics = derived(store, ($s) => $s.cacheMetrics?.l1);

/**
 * L2 (warm) cache metrics
 */
export const l2CacheMetrics = derived(store, ($s) => $s.cacheMetrics?.l2);

/**
 * L3 (persistent) cache metrics
 */
export const l3CacheMetrics = derived(store, ($s) => $s.cacheMetrics?.l3);

/**
 * Total persisted entries count
 */
export const persistedEntries = derived(store, ($s) => $s.cacheMetrics?.persistedEntries ?? 0);

// ============================================================================
// REAL-TIME LEARNING DERIVED STORES
// ============================================================================

/**
 * Learning metrics
 */
export const learningMetrics = derived(store, ($s) => $s.learningMetrics);

/**
 * Learned user preferences
 */
export const learningPreferences = derived(store, ($s) => $s.learningPreferences);

/**
 * Estimated learning accuracy (percentage)
 */
export const learningAccuracy = derived(
  store,
  ($s) => ($s.learningMetrics?.estimatedAccuracy ?? 0) * 100
);

/**
 * Total feedback count
 */
export const totalFeedback = derived(store, ($s) => $s.learningMetrics?.totalFeedback ?? 0);

/**
 * Preferred detail level
 */
export const preferredDetailLevel = derived(
  store,
  ($s) => $s.learningPreferences?.preferredDetailLevel ?? 'detailed'
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format compression ratio for display
 */
export function formatCompressionRatio(ratio: number): string {
  if (ratio >= 100) {
    return `${Math.round(ratio)}x`;
  }
  return `${ratio.toFixed(1)}x`;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Get color for compression ratio
 */
export function getCompressionColor(ratio: number): string {
  if (ratio >= 50) return 'text-green-500';
  if (ratio >= 20) return 'text-emerald-500';
  if (ratio >= 10) return 'text-blue-500';
  if (ratio >= 5) return 'text-yellow-500';
  return 'text-gray-500';
}

// ============================================================================
// STORE ACTIONS
// ============================================================================

export const gAgentCompilerStore = {
  subscribe: store.subscribe,

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    store.update((s) => ({ ...s, sessionId }));
  },

  /**
   * Compile context for a query - THE 100x MAGIC
   */
  async compile(
    query: string,
    options: {
      context?: {
        currentFile?: string;
        currentFunction?: string;
        recentFiles?: string[];
      };
      constraints?: {
        maxTokens?: number;
        maxCost?: number;
        maxLatency?: number;
        qualityThreshold?: number;
      };
      speculative?: boolean;
      streaming?: boolean;
    } = {}
  ): Promise<CompilationResult | null> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isCompiling: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/compile?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            query,
            context: options.context || {},
            constraints: {
              maxTokens: options.constraints?.maxTokens || 8000,
              maxCost: options.constraints?.maxCost || 100,
              maxLatency: options.constraints?.maxLatency || 5000,
              qualityThreshold: options.constraints?.qualityThreshold || 0.3,
            },
            options: {
              speculative: options.speculative !== false,
              streaming: false,
              cacheResults: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Compilation failed: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result as CompilationResult;

      store.update((s) => ({
        ...s,
        lastResult: result,
        isCompiling: false,
      }));

      // Fetch updated stats
      this.fetchStats();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Compilation failed';
      store.update((s) => ({ ...s, isCompiling: false, error: message }));
      return null;
    }
  },

  /**
   * Progressive streaming compilation
   * Returns context in phases: abstract → summary → detailed → source
   */
  async compileStream(
    query: string,
    onLevel: (level: ProgressiveLevel) => void,
    options: {
      context?: Record<string, unknown>;
      constraints?: {
        maxTokens?: number;
        maxCost?: number;
      };
    } = {}
  ): Promise<void> {
    const { sessionId } = get(store);
    store.update((s) => ({
      ...s,
      isStreaming: true,
      isCompiling: true,
      error: null,
      progressiveLevels: [],
    }));

    try {
      const response = await fetch(
        `${getApiBase()}/api/gagent/compiler/compile/stream?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            query,
            context: options.context || {},
            constraints: {
              maxTokens: options.constraints?.maxTokens || 8000,
              maxCost: options.constraints?.maxCost || 100,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent.startsWith('level_')) {
                const level = data as ProgressiveLevel;
                store.update((s) => ({
                  ...s,
                  progressiveLevels: [...s.progressiveLevels, level],
                  currentLevel: level.level,
                }));
                onLevel(level);
              } else if (currentEvent === 'done') {
                store.update((s) => ({ ...s, isStreaming: false, isCompiling: false }));
              } else if (currentEvent === 'error') {
                throw new Error(data.error);
              }
            } catch (_e) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Streaming failed';
      store.update((s) => ({
        ...s,
        isStreaming: false,
        isCompiling: false,
        error: message,
      }));
      throw error;
    }
  },

  /**
   * Index a file into the semantic compiler
   */
  async indexFile(
    filePath: string,
    content: string,
    options: { type?: SemanticType; forceReindex?: boolean } = {}
  ): Promise<IndexedUnit[]> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isIndexing: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/index/file?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            filePath,
            content,
            type: options.type,
            forceReindex: options.forceReindex || false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Indexing failed: ${response.status}`);
      }

      const data = await response.json();
      const units = data.units as IndexedUnit[];

      store.update((s) => {
        const newIndexedFiles = new Map(s.indexedFiles);
        newIndexedFiles.set(filePath, units);
        return { ...s, indexedFiles: newIndexedFiles, isIndexing: false };
      });

      return units;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Indexing failed';
      store.update((s) => ({ ...s, isIndexing: false, error: message }));
      return [];
    }
  },

  /**
   * Index a conversation
   */
  async indexConversation(
    conversationId: string,
    messages: Array<{ role: string; content: string; timestamp?: string }>
  ): Promise<number> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isIndexing: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/index/conversation?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ conversationId, messages }),
        }
      );

      if (!response.ok) {
        throw new Error(`Conversation indexing failed: ${response.status}`);
      }

      const data = await response.json();
      store.update((s) => ({ ...s, isIndexing: false }));

      return data.unitsCreated as number;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Conversation indexing failed';
      store.update((s) => ({ ...s, isIndexing: false, error: message }));
      return 0;
    }
  },

  /**
   * Fetch compiler statistics
   */
  async fetchStats(): Promise<CompilerStats | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/stats?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const stats = data.stats as CompilerStats;

      store.update((s) => ({ ...s, stats }));
      return stats;
    } catch {
      return null;
    }
  },

  /**
   * Compute delta from previous result
   */
  async compileDelta(
    currentQuery: string,
    options: {
      context?: Record<string, unknown>;
      constraints?: {
        maxTokens?: number;
        maxCost?: number;
      };
    } = {}
  ): Promise<{
    delta: CompilationResult['delta'];
    deltaUpdate: string;
    fullContext?: string;
  } | null> {
    const { sessionId, lastResult } = get(store);
    store.update((s) => ({ ...s, isCompiling: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/delta?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            previousResult: lastResult,
            currentQuery,
            context: options.context || {},
            constraints: options.constraints || {},
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Delta compilation failed: ${response.status}`);
      }

      const data = await response.json();
      store.update((s) => ({ ...s, isCompiling: false }));

      return {
        delta: data.delta,
        deltaUpdate: data.deltaUpdate,
        fullContext: data.fullContext,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delta compilation failed';
      store.update((s) => ({ ...s, isCompiling: false, error: message }));
      return null;
    }
  },

  /**
   * Clear compiler caches
   */
  async clearCaches(options: { index?: boolean; destroy?: boolean } = {}): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/clear?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            caches: true,
            index: options.index || false,
            destroy: options.destroy || false,
          }),
        }
      );

      if (response.ok) {
        if (options.destroy || options.index) {
          store.update((s) => ({
            ...s,
            indexedFiles: new Map(),
            stats: null,
          }));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Clear error
   */
  clearError(): void {
    store.update((s) => ({ ...s, error: null }));
  },

  // ==========================================================================
  // PREDICTIVE PREFETCH METHODS
  // ==========================================================================

  /**
   * Fetch prefetch metrics
   */
  async fetchPrefetchMetrics(): Promise<PrefetchMetrics | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/metrics?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const metrics = data.metrics as PrefetchMetrics;

      store.update((s) => ({ ...s, prefetchMetrics: metrics }));
      return metrics;
    } catch {
      return null;
    }
  },

  /**
   * Predict follow-up queries based on current query
   */
  async predictNextQueries(query: string): Promise<QueryPrediction[]> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isPredicting: true }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/predict?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        store.update((s) => ({ ...s, isPredicting: false }));
        return [];
      }

      const data = await response.json();
      const predictions = data.predictions as QueryPrediction[];

      store.update((s) => ({
        ...s,
        queryPredictions: predictions,
        isPredicting: false,
      }));

      return predictions;
    } catch {
      store.update((s) => ({ ...s, isPredicting: false }));
      return [];
    }
  },

  /**
   * Predict files likely to be accessed next
   */
  async predictFilesToAccess(currentFile?: string): Promise<FilePrediction[]> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isPredicting: true }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/files?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ currentFile }),
        }
      );

      if (!response.ok) {
        store.update((s) => ({ ...s, isPredicting: false }));
        return [];
      }

      const data = await response.json();
      const predictions = data.predictions as FilePrediction[];

      store.update((s) => ({
        ...s,
        filePredictions: predictions,
        isPredicting: false,
      }));

      return predictions;
    } catch {
      store.update((s) => ({ ...s, isPredicting: false }));
      return [];
    }
  },

  /**
   * Queue a file for background indexing
   */
  async queueBackgroundIndex(filePath: string): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/queue?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ filePath }),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Get learned query patterns
   */
  async getQueryPatterns(): Promise<QueryPattern[]> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/patterns?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.patterns.map((p: Record<string, unknown>) => ({
        id: p.id,
        observations:
          p.stats && typeof p.stats === 'object'
            ? ((p.stats as Record<string, unknown>).observations ?? 0)
            : 0,
        hitRate:
          p.stats && typeof p.stats === 'object'
            ? ((p.stats as Record<string, unknown>).hitRate ?? 0)
            : 0,
        lastSeen:
          p.stats && typeof p.stats === 'object'
            ? ((p.stats as Record<string, unknown>).lastSeen ?? '')
            : '',
        predictions: p.predictions ?? [],
      })) as QueryPattern[];
    } catch {
      return [];
    }
  },

  /**
   * Export prefetch patterns for persistence
   */
  async exportPatterns(): Promise<unknown | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/export?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data;
    } catch {
      return null;
    }
  },

  /**
   * Import prefetch patterns from persistence
   */
  async importPatterns(data: unknown): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/prefetch/import?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ data }),
        }
      );

      if (response.ok) {
        // Refresh metrics after import
        this.fetchPrefetchMetrics();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ==========================================================================
  // MULTI-MODAL COMPILATION METHODS
  // ==========================================================================

  /**
   * Compile context using multi-modal analysis
   * Combines code, docs, tests with weighted relevance
   */
  async compileMultiModal(
    query: string,
    options: {
      intent?: UserIntent;
      modalityWeights?: Partial<Record<ContentModality, number>>;
      maxTokens?: number;
      maxModalityPercentage?: number;
      boostCrossRefs?: boolean;
    } = {}
  ): Promise<MultiModalResult | null> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isCompilingMultiModal: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/compile?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            query,
            intent: options.intent,
            modalityWeights: options.modalityWeights,
            maxTokens: options.maxTokens || 8000,
            maxModalityPercentage: options.maxModalityPercentage || 60,
            boostCrossRefs: options.boostCrossRefs !== false,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Multi-modal compilation failed: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result as MultiModalResult;

      store.update((s) => ({
        ...s,
        multiModalResult: result,
        isCompilingMultiModal: false,
      }));

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Multi-modal compilation failed';
      store.update((s) => ({ ...s, isCompilingMultiModal: false, error: message }));
      return null;
    }
  },

  /**
   * Index a file with multi-modal analysis
   */
  async indexMultiModal(
    filePath: string,
    content: string,
    options: { forceModality?: ContentModality } = {}
  ): Promise<{ unitId: string; modality: ContentModality; crossRefs: CrossReference[] } | null> {
    const { sessionId } = get(store);
    store.update((s) => ({ ...s, isIndexing: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/index?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            filePath,
            content,
            forceModality: options.forceModality,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Multi-modal indexing failed: ${response.status}`);
      }

      const data = await response.json();
      store.update((s) => ({ ...s, isIndexing: false }));

      return {
        unitId: data.unitId,
        modality: data.modality,
        crossRefs: data.crossRefs || [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Multi-modal indexing failed';
      store.update((s) => ({ ...s, isIndexing: false, error: message }));
      return null;
    }
  },

  /**
   * Detect content modality for a file
   */
  async detectModality(filePath: string, content?: string): Promise<ContentModality> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/detect?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ filePath, content }),
        }
      );

      if (!response.ok) {
        return 'unknown';
      }

      const data = await response.json();
      return data.modality as ContentModality;
    } catch {
      return 'unknown';
    }
  },

  /**
   * Get units by modality
   */
  async getUnitsByModality(modality: ContentModality): Promise<MultiModalUnit[]> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/units?sessionId=${encodeURIComponent(sessionId)}&modality=${encodeURIComponent(modality)}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.units as MultiModalUnit[];
    } catch {
      return [];
    }
  },

  /**
   * Get cross-references for a unit
   */
  async getCrossReferences(unitId: string): Promise<CrossReference[]> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/crossrefs/${encodeURIComponent(unitId)}?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.crossRefs as CrossReference[];
    } catch {
      return [];
    }
  },

  /**
   * Fetch multi-modal metrics
   */
  async fetchMultiModalMetrics(): Promise<MultiModalMetrics | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/multimodal/metrics?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const metrics = data.metrics as MultiModalMetrics;

      store.update((s) => ({ ...s, multiModalMetrics: metrics }));
      return metrics;
    } catch {
      return null;
    }
  },

  // ==========================================================================
  // HIERARCHICAL CACHE METHODS
  // ==========================================================================

  /**
   * Fetch hierarchical cache metrics
   */
  async fetchCacheMetrics(): Promise<HierarchicalCacheMetrics | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/metrics?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const metrics = data.metrics as HierarchicalCacheMetrics;

      store.update((s) => ({ ...s, cacheMetrics: metrics }));
      return metrics;
    } catch {
      return null;
    }
  },

  /**
   * Get cached value by key
   */
  async getCached<T = unknown>(
    key: string,
    namespace: string = 'compilation'
  ): Promise<T | undefined> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/get?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ key, namespace }),
        }
      );

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      return data.found ? (data.value as T) : undefined;
    } catch {
      return undefined;
    }
  },

  /**
   * Set cached value
   */
  async setCached<T = unknown>(
    key: string,
    value: T,
    options: {
      namespace?: string;
      ttl?: number;
      importance?: number;
      tier?: 'l1' | 'l2' | 'l3';
    } = {}
  ): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/set?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            key,
            value,
            namespace: options.namespace || 'compilation',
            ttl: options.ttl,
            importance: options.importance,
            tier: options.tier || 'l2',
          }),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async deleteCached(key: string, namespace: string = 'compilation'): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/delete?sessionId=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(key)}&namespace=${encodeURIComponent(namespace)}`,
        { method: 'DELETE' }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Clear cache by tier or namespace
   */
  async clearCache(
    options: { l1?: boolean; l2?: boolean; l3?: boolean; namespace?: string } = {}
  ): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/clear?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify(options),
        }
      );

      if (response.ok) {
        // Refresh metrics
        this.fetchCacheMetrics();
      }

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Warm cache from persistent L3
   */
  async warmCache(limit: number = 100): Promise<number> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/warm?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ limit }),
        }
      );

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.warmed as number;
    } catch {
      return 0;
    }
  },

  /**
   * Preload entries into cache
   */
  async preloadCache<T = unknown>(
    entries: Array<{ key: string; value: T; namespace?: string; importance?: number }>
  ): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/preload?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ entries }),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Get cached entries by namespace
   */
  async getCacheEntriesByNamespace(namespace: string): Promise<CacheEntryInfo[]> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/namespace/${encodeURIComponent(namespace)}?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.entries as CacheEntryInfo[];
    } catch {
      return [];
    }
  },

  /**
   * Shutdown cache (persist all data)
   */
  async shutdownCache(): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/cache/shutdown?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  // ==========================================================================
  // REAL-TIME LEARNING METHODS
  // ==========================================================================

  /**
   * Submit user feedback for learning
   */
  async submitFeedback(feedback: {
    query: string;
    compiledContext?: string;
    includedUnits?: string[];
    type: FeedbackType;
    rating?: number;
    correction?: string;
    missingFiles?: string[];
    unwantedFiles?: string[];
    userComment?: string;
  }): Promise<LearningSignal[]> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/feedback?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify(feedback),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Refresh learning metrics
      this.fetchLearningMetrics();

      return data.signals as LearningSignal[];
    } catch {
      return [];
    }
  },

  /**
   * Record implicit positive feedback
   */
  async recordImplicitPositive(query: string, includedUnits: string[] = []): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/implicit?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ query, includedUnits }),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch learning metrics
   */
  async fetchLearningMetrics(): Promise<LearningMetrics | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/metrics?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const metrics = data.metrics as LearningMetrics;

      store.update((s) => ({ ...s, learningMetrics: metrics }));
      return metrics;
    } catch {
      return null;
    }
  },

  /**
   * Fetch learned user preferences
   */
  async fetchLearningPreferences(): Promise<UserPreferencesData | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/preferences?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const preferences = data.preferences as UserPreferencesData;

      store.update((s) => ({ ...s, learningPreferences: preferences }));
      return preferences;
    } catch {
      return null;
    }
  },

  /**
   * Get learned boost for a file
   */
  async getFileBoost(filePath: string): Promise<{ boost: number; isAntiPattern: boolean }> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/file-boost?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        return { boost: 0, isAntiPattern: false };
      }

      const data = await response.json();
      return { boost: data.boost, isAntiPattern: data.isAntiPattern };
    } catch {
      return { boost: 0, isAntiPattern: false };
    }
  },

  /**
   * Get corrected intent based on learning
   */
  async getLearnedIntent(query: string): Promise<{
    correctedIntent?: string;
    preferredDetailLevel: { level: string; confidence: number };
  } | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/intent?sessionId=${encodeURIComponent(sessionId)}&query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        correctedIntent: data.correctedIntent,
        preferredDetailLevel: data.preferredDetailLevel,
      };
    } catch {
      return null;
    }
  },

  /**
   * Export learning model for persistence
   */
  async exportLearningModel(): Promise<string | null> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/export?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data;
    } catch {
      return null;
    }
  },

  /**
   * Import learning model from persistence
   */
  async importLearningModel(data: string): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/import?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ data }),
        }
      );

      if (response.ok) {
        // Refresh learning state
        this.fetchLearningMetrics();
        this.fetchLearningPreferences();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Apply decay to learned values
   */
  async applyLearningDecay(): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/decay?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Reset all learning (use with caution!)
   */
  async resetLearning(): Promise<boolean> {
    const { sessionId } = get(store);

    try {
      const response = await fetchApi(
        `/api/gagent/compiler/learning/reset?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        }
      );

      if (response.ok) {
        store.update((s) => ({
          ...s,
          learningMetrics: null,
          learningPreferences: null,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Get current state
   */
  getState(): GAgentCompilerStoreState {
    return get(store);
  },

  /**
   * Reset store
   */
  reset(): void {
    store.set(initialState);
  },
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default gAgentCompilerStore;
