/**
 * Semantic Learning - Real-time feedback and learning delegation
 *
 * Manages user feedback processing, implicit learning signals,
 * anti-pattern detection, and preference tracking. Wraps the
 * RealTimeLearningService for use within SemanticCompiler.
 *
 * @fileoverview Learning/feedback methods extracted from semanticCompiler.ts
 * @module gAgent/semanticLearning
 */

import type {
    RealTimeLearningService,
    FeedbackType,
    LearningMetrics,
    LearningSignal,
} from "../services/agents/realTimeLearning.js";

// ============================================================================
// SEMANTIC LEARNING DELEGATE
// ============================================================================

/**
 * Delegate that adds real-time learning methods to a host class.
 */
export class SemanticLearningDelegate {
    constructor(
        private realTimeLearning: RealTimeLearningService,
        private sessionId: string,
    ) { }

    /**
     * Process user feedback and learn from it
     * This is the main entry point for learning from user corrections
     */
    processFeedback(feedback: {
        query: string;
        compiledContext: string;
        includedUnits: string[];
        type: FeedbackType;
        rating?: number;
        correction?: string;
        missingFiles?: string[];
        unwantedFiles?: string[];
        userComment?: string;
    }): LearningSignal[] {
        return this.realTimeLearning.processFeedback({
            id: "",
            timestamp: Date.now(),
            sessionId: this.sessionId,
            ...feedback,
        });
    }

    /**
     * Record implicit positive feedback (user continued without complaint)
     */
    recordImplicitPositive(query: string, includedUnits: string[]): void {
        this.realTimeLearning.recordImplicitPositive(query, includedUnits);
    }

    /**
     * Get relevance boost for a file based on learned preferences
     */
    getLearnedFileBoost(filePath: string): number {
        return this.realTimeLearning.getFileBoost(filePath);
    }

    /**
     * Get corrected intent based on past corrections
     */
    getLearnedIntent(query: string): string | undefined {
        return this.realTimeLearning.getCorrectedIntent(query);
    }

    /**
     * Get user's preferred detail level
     */
    getPreferredDetailLevel(): { level: string; confidence: number } {
        return this.realTimeLearning.getPreferredDetailLevel();
    }

    /**
     * Get modality weight adjustment from learning
     */
    getLearnedModalityWeight(modality: string): number {
        return this.realTimeLearning.getModalityWeight(modality);
    }

    /**
     * Check if file is in anti-patterns (user rejected it before)
     */
    isAntiPattern(filePath: string): boolean {
        return this.realTimeLearning.isAntiPattern(filePath);
    }

    /**
     * Get query → file associations from learning
     */
    getQueryFileAssociations(query: string): Map<string, number> {
        return this.realTimeLearning.getQueryFileAssociations(query);
    }

    /**
     * Get learning metrics
     */
    getLearningMetrics(): LearningMetrics {
        return this.realTimeLearning.getMetrics();
    }

    /**
     * Get learned user preferences
     */
    getLearningPreferences(): ReturnType<
        RealTimeLearningService["getPreferences"]
    > {
        return this.realTimeLearning.getPreferences();
    }

    /**
     * Apply decay to learned values (call periodically)
     */
    applyLearningDecay(): void {
        this.realTimeLearning.applyDecay();
    }

    /**
     * Export learning model for persistence
     */
    exportLearningModel(): string {
        return this.realTimeLearning.exportModel();
    }

    /**
     * Import learning model from persistence
     */
    importLearningModel(data: string): boolean {
        return this.realTimeLearning.importModel(data);
    }

    /**
     * Reset all learning (use with caution!)
     */
    resetLearning(): void {
        this.realTimeLearning.reset();
    }
}

// Re-export types for convenience
export type { FeedbackType, LearningMetrics, LearningSignal };
