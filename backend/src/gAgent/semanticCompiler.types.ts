/**
 * Semantic Compiler Types & Interfaces
 *
 * Shared type definitions for the Semantic Compiler module.
 * Extracted from the monolithic semanticCompiler.ts for maintainability.
 *
 * @fileoverview Type definitions for semantic compilation, indexing, and retrieval.
 * @module gAgent/semanticCompiler.types
 */

import type { HolographicMemory } from '../services/agents/holographicMemory.js';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Semantic Unit - The atomic unit of compiled meaning
 * Like a "token" but for concepts, not characters
 */
export interface SemanticUnit {
  id: string;
  type: SemanticType;

  // Content at different abstraction levels
  levels: {
    abstract: string; // 1-2 sentences (10-20 tokens)
    summary: string; // Paragraph (50-100 tokens)
    detailed: string; // Full content (100-500 tokens)
    source?: string; // Original source (if needed)
  };

  // Semantic relationships
  relationships: {
    parent?: string; // Parent unit ID
    children: string[]; // Child unit IDs
    related: string[]; // Semantically related units
    dependencies: string[]; // Required context for understanding
  };

  // Metadata
  meta: {
    importance: number; // 0-1, how critical is this?
    volatility: number; // 0-1, how often does this change?
    accessCount: number; // Times accessed
    lastAccessed: string; // Last access timestamp
    createdAt: string;
    sourceFile?: string;
    lineRange?: [number, number];
  };

  // Vector representations
  vectors: {
    semantic: number[]; // Semantic embedding
    structural: number[]; // Structural embedding (for code)
    contextual: number[]; // Context-aware embedding
  };

  // Compiled cache
  compiledForm?: CompiledForm;
}

export type SemanticType =
  | 'concept' // Abstract idea
  | 'function' // Callable unit
  | 'class' // Class/type definition
  | 'module' // File/module
  | 'component' // UI component
  | 'pattern' // Design pattern
  | 'requirement' // Business requirement
  | 'constraint' // Limitation/rule
  | 'decision' // Architectural decision
  | 'conversation' // Chat context
  | 'task' // Active task/goal
  | 'memory'; // Long-term memory

/**
 * Compiled Form - Optimized representation for LLM consumption
 */
export interface CompiledForm {
  id: string;
  tokenCount: number;

  // The actual compiled prompt fragment
  prompt: string;

  // What level of detail is included
  detailLevel: 'abstract' | 'summary' | 'detailed' | 'source';

  // Dependencies that must be included for this to make sense
  requiredContext: string[];

  // Validity
  compiledAt: string;
  validUntil: string; // When to recompile
  hash: string; // For change detection
}

/**
 * Compilation Request
 */
export interface CompilationRequest {
  query: string;
  context?: {
    currentFile?: string;
    currentFunction?: string;
    recentFiles?: string[];
    conversationHistory?: string[];
  };
  constraints: {
    maxTokens: number;
    maxCost: number; // in cents
    maxLatency: number; // in ms
    qualityThreshold: number; // 0-1, minimum relevance
  };
  options: {
    speculative?: boolean; // Pre-compile likely follow-ups
    streaming?: boolean; // Stream results progressively
    cacheResults?: boolean; // Cache for reuse
  };
}

/**
 * Compilation Result
 */
export interface CompilationResult {
  id: string;

  // The compiled context to send to LLM
  compiledContext: string;

  // Statistics
  stats: {
    originalTokens: number;
    compiledTokens: number;
    compressionRatio: number;
    unitsIncluded: number;
    unitsAvailable: number;
    retrievalTimeMs: number;
    compilationTimeMs: number;
    estimatedCost: number;
  };

  // What's included
  includedUnits: Array<{
    id: string;
    type: SemanticType;
    relevance: number;
    detailLevel: string;
    tokenCount: number;
  }>;

  // What was excluded (for transparency)
  excludedUnits: Array<{
    id: string;
    reason: 'low_relevance' | 'budget_limit' | 'token_limit' | 'redundant';
  }>;

  // Speculative pre-compilations
  speculativeResults?: Array<{
    query: string;
    confidence: number;
    compiledContext: string;
  }>;

  // Delta from previous compilation
  delta?: {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
  };
}

/**
 * Progressive Loading State
 */
export interface ProgressiveLoadState {
  currentLevel: 'abstract' | 'summary' | 'detailed' | 'source';
  loadedUnits: Map<string, SemanticUnit>;
  pendingUnits: string[];
  tokenBudgetUsed: number;
  tokenBudgetRemaining: number;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Semantic Index - Efficient lookup structure
 */
export interface SemanticIndex {
  byId: Map<string, SemanticUnit>;
  byType: Map<SemanticType, Set<string>>;
  byFile: Map<string, Set<string>>;
  byImportance: SemanticUnit[]; // Sorted by importance
  holoMemory: HolographicMemory;
  vectorIndex: VectorIndex;
}

/**
 * Vector Index for similarity search
 */
export interface VectorIndex {
  dimension: number;
  vectors: Map<string, Float32Array>;
  inverted: Map<number, Set<string>>; // LSH buckets
}

/**
 * Parsed intent from user query
 */
export interface ParsedIntent {
  queryText: string;
  intentType: 'explore' | 'implement' | 'debug' | 'modify' | 'test' | 'review';
  entities: {
    files: string[];
    functions: string[];
    concepts: string[];
  };
  contextHints?: CompilationRequest['context'];
}

/**
 * Parsed code chunk for indexing
 */
export interface ParsedChunk {
  content: string;
  name: string;
  lineRange: [number, number];
  dependencies: string[];
}

/**
 * Compiler configuration
 */
export interface SemanticCompilerConfig {
  maxCacheSize: number;
  maxSpeculativeQueries: number;
  cacheExpiryMs: number;
  minRelevanceThreshold: number;
  enableSpeculativeCompilation: boolean;
  enableDeltaStreaming: boolean;
}

/**
 * Default compiler configuration
 */
export const DEFAULT_COMPILER_CONFIG: SemanticCompilerConfig = {
  maxCacheSize: 100,
  maxSpeculativeQueries: 5,
  cacheExpiryMs: 5 * 60 * 1000,
  minRelevanceThreshold: 0.3,
  enableSpeculativeCompilation: true,
  enableDeltaStreaming: true,
};
