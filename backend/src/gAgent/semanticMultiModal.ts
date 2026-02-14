/**
 * Semantic Multi-Modal Compilation
 *
 * Delegate that handles multi-modal context compilation — combining
 * code, docs, tests, and other content types with weighted relevance.
 * Wraps the MultiModalCompilerService for use within SemanticCompiler.
 *
 * @fileoverview Multi-modal compilation extracted from semanticCompiler.ts
 * @module gAgent/semanticMultiModal
 */

import type {
  MultiModalCompilerService,
  ContentModality,
  UserIntent,
  MultiModalResult,
} from '../services/intent/multiModalCompiler.js';

// ============================================================================
// SEMANTIC MULTI-MODAL DELEGATE
// ============================================================================

/**
 * Delegate that adds multi-modal compilation methods to a host class.
 */
export class SemanticMultiModalDelegate {
  constructor(private multiModalCompiler: MultiModalCompilerService) {}

  /**
   * Index a file with multi-modal awareness
   * Automatically detects content type (code, test, docs, etc.) and tracks cross-references
   */
  indexMultiModal(
    filePath: string,
    content: string,
    options: {
      modality?: ContentModality;
      embedding?: number[];
      importance?: number;
    } = {}
  ): { unitId: string; modality: ContentModality; crossRefs: number } {
    const unit = this.multiModalCompiler.indexUnit(filePath, content, options);
    return {
      unitId: unit.id,
      modality: unit.modality,
      crossRefs: unit.crossRefs.length,
    };
  }

  /**
   * Compile multi-modal context - combines code, docs, tests with weighted relevance
   * This is the intelligent way to get context that includes related tests and docs
   */
  compileMultiModal(request: {
    query: string;
    intent?: UserIntent;
    modalities?: ContentModality[];
    maxTokens?: number;
    includeCrossRefs?: boolean;
    balanceModalities?: boolean;
  }): MultiModalResult {
    return this.multiModalCompiler.compile({
      query: request.query,
      intent: request.intent,
      modalities: request.modalities,
      constraints: {
        maxTokens: request.maxTokens || 8000,
      },
      options: {
        includeCrossRefs: request.includeCrossRefs !== false,
        balanceModalities: request.balanceModalities !== false,
      },
    });
  }

  /**
   * Get units by modality (code, test, docs, etc.)
   */
  getUnitsByModality(
    modality: ContentModality
  ): ReturnType<MultiModalCompilerService['getUnitsByModality']> {
    return this.multiModalCompiler.getUnitsByModality(modality);
  }

  /**
   * Get cross-references for a unit
   */
  getCrossReferences(unitId: string): ReturnType<MultiModalCompilerService['getCrossRefs']> {
    return this.multiModalCompiler.getCrossRefs(unitId);
  }

  /**
   * Get multi-modal compiler metrics
   */
  getMultiModalMetrics(): ReturnType<MultiModalCompilerService['getMetrics']> {
    return this.multiModalCompiler.getMetrics();
  }

  /**
   * Detect content modality from file path
   */
  detectModality(filePath: string, content?: string): ContentModality {
    return this.multiModalCompiler.detectModality(filePath, content);
  }
}

// Re-export types for convenience
export type { ContentModality, UserIntent, MultiModalResult };
