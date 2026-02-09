/**
 * Real-Time Learning Service for G-Agent Semantic Compiler
 *
 * Learns from user corrections and feedback to improve future compilations:
 *
 * 1. CORRECTION LEARNING
 *    - When user says "that's not what I meant" → learn from correction
 *    - Track which context was useful vs. not useful
 *    - Adjust relevance scoring based on feedback
 *
 * 2. PREFERENCE LEARNING
 *    - Learn user's preferred level of detail
 *    - Learn which file types matter most to this user
 *    - Learn naming patterns and coding style preferences
 *
 * 3. INTENT REFINEMENT
 *    - Improve intent detection based on corrections
 *    - Build user-specific intent vocabulary
 *    - Learn common query → intent mappings
 *
 * 4. RELEVANCE BOOSTING
 *    - Files the user frequently references get boosted
 *    - Patterns the user likes get reinforced
 *    - Anti-patterns (user rejected) get suppressed
 *
 * 5. SESSION CONTINUITY
 *    - Learn within session (immediate feedback)
 *    - Persist across sessions (long-term learning)
 *    - Share learnings across similar projects
 */

import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackType =
  | "helpful" // User found the context helpful
  | "not_helpful" // Context wasn't useful
  | "missing_context" // User needed something not included
  | "too_verbose" // Too much detail
  | "too_brief" // Not enough detail
  | "wrong_intent" // Misunderstood user's intent
  | "wrong_files" // Wrong files included
  | "correction"; // User provided explicit correction

export interface UserFeedback {
  id: string;
  timestamp: number;
  sessionId: string;

  // What was the context?
  query: string;
  compiledContext: string;
  includedUnits: string[];

  // What was the feedback?
  type: FeedbackType;
  rating?: number; // 1-5 star rating
  correction?: string; // User's corrected intent or context
  missingFiles?: string[]; // Files user needed but weren't included
  unwantedFiles?: string[]; // Files that shouldn't have been included

  // Metadata
  responseQuality?: "good" | "acceptable" | "poor";
  userComment?: string;
}

export interface LearningSignal {
  type: "boost" | "suppress" | "adjust";
  target: "file" | "unit" | "modality" | "intent" | "pattern";
  targetId: string;
  magnitude: number; // -1 to 1
  reason: string;
  confidence: number;
  decay: number; // How quickly this signal should decay
}

export interface UserPreferences {
  // Detail level preferences
  preferredDetailLevel: "abstract" | "summary" | "detailed" | "source";
  detailLevelConfidence: number;

  // Modality weights (learned)
  modalityWeights: Record<string, number>;

  // File importance (learned)
  fileImportance: Map<string, number>;

  // Intent vocabulary (query patterns → intents)
  intentVocabulary: Map<string, string>;

  // Anti-patterns (things to avoid)
  antiPatterns: Set<string>;

  // Preferred patterns
  preferredPatterns: Set<string>;
}

export interface LearningModel {
  // File relevance adjustments
  fileBoosts: Map<string, number>; // file path → boost factor

  // Unit type adjustments
  unitTypeBoosts: Map<string, number>; // unit type → boost factor

  // Query → file associations
  queryFileAssociations: Map<string, Map<string, number>>; // query pattern → file → score

  // Intent corrections
  intentCorrections: Map<string, string>; // original intent → corrected intent

  // Pattern scores
  patternScores: Map<string, number>; // pattern → learned score

  // Training data
  feedbackHistory: UserFeedback[];
  signalHistory: LearningSignal[];

  // Model metadata
  version: number;
  lastUpdated: number;
  totalFeedback: number;
  accuracy: number; // Estimated accuracy based on feedback
}

export interface LearningConfig {
  // Learning rates
  boostLearningRate: number;
  suppressLearningRate: number;
  decayRate: number;

  // Thresholds
  minConfidenceToApply: number;
  minFeedbackToLearn: number;
  maxHistorySize: number;

  // Features
  enableCrossSessionLearning: boolean;
  enableAntiPatternDetection: boolean;
  enableIntentRefinement: boolean;
}

export interface LearningMetrics {
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  corrections: number;

  // Model quality
  estimatedAccuracy: number;
  lastAccuracyUpdate: number;

  // Learning activity
  signalsGenerated: number;
  signalsApplied: number;

  // Preferences learned
  learnedFileBoosts: number;
  learnedIntentCorrections: number;
  learnedPatterns: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  boostLearningRate: 0.1,
  suppressLearningRate: 0.15, // Learn faster from negative feedback
  decayRate: 0.01, // Daily decay
  minConfidenceToApply: 0.5,
  minFeedbackToLearn: 3,
  maxHistorySize: 1000,
  enableCrossSessionLearning: true,
  enableAntiPatternDetection: true,
  enableIntentRefinement: true,
};

// ============================================================================
// REAL-TIME LEARNING SERVICE
// ============================================================================

export class RealTimeLearningService extends EventEmitter {
  private model: LearningModel;
  private preferences: UserPreferences;
  private config: LearningConfig;
  private sessionId: string;
  private metrics: LearningMetrics;

  constructor(sessionId: string, config: Partial<LearningConfig> = {}) {
    super();
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };

    this.model = {
      fileBoosts: new Map(),
      unitTypeBoosts: new Map(),
      queryFileAssociations: new Map(),
      intentCorrections: new Map(),
      patternScores: new Map(),
      feedbackHistory: [],
      signalHistory: [],
      version: 1,
      lastUpdated: Date.now(),
      totalFeedback: 0,
      accuracy: 0.5, // Start at 50% assumed accuracy
    };

    this.preferences = {
      preferredDetailLevel: "detailed",
      detailLevelConfidence: 0,
      modalityWeights: {},
      fileImportance: new Map(),
      intentVocabulary: new Map(),
      antiPatterns: new Set(),
      preferredPatterns: new Set(),
    };

    this.metrics = {
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      corrections: 0,
      estimatedAccuracy: 0.5,
      lastAccuracyUpdate: Date.now(),
      signalsGenerated: 0,
      signalsApplied: 0,
      learnedFileBoosts: 0,
      learnedIntentCorrections: 0,
      learnedPatterns: 0,
    };
  }

  // ==========================================================================
  // FEEDBACK PROCESSING
  // ==========================================================================

  /**
   * Process user feedback and generate learning signals
   */
  processFeedback(feedback: UserFeedback): LearningSignal[] {
    // Validate and store feedback
    feedback.id = feedback.id || this.generateId();
    feedback.timestamp = feedback.timestamp || Date.now();
    feedback.sessionId = this.sessionId;

    this.model.feedbackHistory.push(feedback);
    this.trimHistory();

    this.model.totalFeedback++;
    this.model.lastUpdated = Date.now();

    // Update metrics
    this.metrics.totalFeedback++;
    if (feedback.rating && feedback.rating >= 4) {
      this.metrics.positiveFeedback++;
    } else if (feedback.rating && feedback.rating <= 2) {
      this.metrics.negativeFeedback++;
    }
    if (feedback.type === "correction") {
      this.metrics.corrections++;
    }

    // Generate learning signals based on feedback type
    const signals: LearningSignal[] = [];

    switch (feedback.type) {
      case "helpful":
        signals.push(...this.processPositiveFeedback(feedback));
        break;
      case "not_helpful":
        signals.push(...this.processNegativeFeedback(feedback));
        break;
      case "missing_context":
        signals.push(...this.processMissingContextFeedback(feedback));
        break;
      case "too_verbose":
        signals.push(...this.processVerbosityFeedback(feedback, "less"));
        break;
      case "too_brief":
        signals.push(...this.processVerbosityFeedback(feedback, "more"));
        break;
      case "wrong_intent":
        signals.push(...this.processIntentCorrectionFeedback(feedback));
        break;
      case "wrong_files":
        signals.push(...this.processWrongFilesFeedback(feedback));
        break;
      case "correction":
        signals.push(...this.processExplicitCorrection(feedback));
        break;
    }

    // Store and apply signals
    for (const signal of signals) {
      this.model.signalHistory.push(signal);
      this.applySignal(signal);
      this.metrics.signalsGenerated++;
    }

    // Update accuracy estimate
    this.updateAccuracyEstimate();

    // Emit learning event
    this.emit("learned", { feedback, signals });

    return signals;
  }

  /**
   * Record implicit feedback (user continued without complaint)
   */
  recordImplicitPositive(query: string, includedUnits: string[]): void {
    // Slight boost to units that were used without complaint
    for (const unitId of includedUnits) {
      const currentBoost = this.model.fileBoosts.get(unitId) || 0;
      this.model.fileBoosts.set(unitId, currentBoost + 0.01); // Very small boost
    }

    // Associate query with these units
    if (!this.model.queryFileAssociations.has(query)) {
      this.model.queryFileAssociations.set(query, new Map());
    }
    const associations = this.model.queryFileAssociations.get(query)!;
    for (const unitId of includedUnits) {
      const current = associations.get(unitId) || 0;
      associations.set(unitId, current + 0.05);
    }
  }

  // ==========================================================================
  // SIGNAL GENERATION
  // ==========================================================================

  private processPositiveFeedback(feedback: UserFeedback): LearningSignal[] {
    const signals: LearningSignal[] = [];
    const boostMagnitude =
      ((feedback.rating || 4) / 5) * this.config.boostLearningRate;

    // Boost all included units
    for (const unitId of feedback.includedUnits) {
      signals.push({
        type: "boost",
        target: "unit",
        targetId: unitId,
        magnitude: boostMagnitude,
        reason: "positive_feedback",
        confidence: 0.8,
        decay: 0.001,
      });
    }

    return signals;
  }

  private processNegativeFeedback(feedback: UserFeedback): LearningSignal[] {
    const signals: LearningSignal[] = [];
    const suppressMagnitude = this.config.suppressLearningRate;

    // Suppress all included units (they weren't helpful)
    for (const unitId of feedback.includedUnits) {
      signals.push({
        type: "suppress",
        target: "unit",
        targetId: unitId,
        magnitude: -suppressMagnitude,
        reason: "negative_feedback",
        confidence: 0.7,
        decay: 0.005,
      });
    }

    return signals;
  }

  private processMissingContextFeedback(
    feedback: UserFeedback,
  ): LearningSignal[] {
    const signals: LearningSignal[] = [];

    // Boost missing files significantly
    if (feedback.missingFiles) {
      for (const file of feedback.missingFiles) {
        signals.push({
          type: "boost",
          target: "file",
          targetId: file,
          magnitude: this.config.boostLearningRate * 2,
          reason: "user_requested_missing",
          confidence: 0.95,
          decay: 0.0001, // Slow decay - user explicitly wanted this
        });

        // Add to preferred patterns
        this.preferences.preferredPatterns.add(file);
      }
    }

    return signals;
  }

  private processVerbosityFeedback(
    feedback: UserFeedback,
    direction: "more" | "less",
  ): LearningSignal[] {
    const signals: LearningSignal[] = [];

    // Adjust detail level preference
    const levels: Array<UserPreferences["preferredDetailLevel"]> = [
      "abstract",
      "summary",
      "detailed",
      "source",
    ];
    const currentIdx = levels.indexOf(this.preferences.preferredDetailLevel);

    if (direction === "more" && currentIdx < levels.length - 1) {
      this.preferences.preferredDetailLevel = levels[currentIdx + 1];
    } else if (direction === "less" && currentIdx > 0) {
      this.preferences.preferredDetailLevel = levels[currentIdx - 1];
    }

    this.preferences.detailLevelConfidence = Math.min(
      1,
      this.preferences.detailLevelConfidence + 0.2,
    );

    signals.push({
      type: "adjust",
      target: "pattern",
      targetId: `detail_level_${direction}`,
      magnitude: direction === "more" ? 0.2 : -0.2,
      reason: "verbosity_feedback",
      confidence: 0.8,
      decay: 0.01,
    });

    return signals;
  }

  private processIntentCorrectionFeedback(
    feedback: UserFeedback,
  ): LearningSignal[] {
    const signals: LearningSignal[] = [];

    if (feedback.correction) {
      // Learn the intent correction
      this.model.intentCorrections.set(feedback.query, feedback.correction);
      this.preferences.intentVocabulary.set(
        feedback.query,
        feedback.correction,
      );
      this.metrics.learnedIntentCorrections++;

      signals.push({
        type: "adjust",
        target: "intent",
        targetId: feedback.query,
        magnitude: 1,
        reason: "intent_correction",
        confidence: 1.0, // User explicitly corrected
        decay: 0.0001, // Very slow decay
      });
    }

    return signals;
  }

  private processWrongFilesFeedback(feedback: UserFeedback): LearningSignal[] {
    const signals: LearningSignal[] = [];

    // Suppress unwanted files
    if (feedback.unwantedFiles) {
      for (const file of feedback.unwantedFiles) {
        signals.push({
          type: "suppress",
          target: "file",
          targetId: file,
          magnitude: -this.config.suppressLearningRate * 2,
          reason: "user_rejected_file",
          confidence: 0.95,
          decay: 0.0001,
        });

        // Add to anti-patterns
        if (this.config.enableAntiPatternDetection) {
          this.preferences.antiPatterns.add(file);
        }
      }
    }

    // Boost missing files
    if (feedback.missingFiles) {
      for (const file of feedback.missingFiles) {
        signals.push({
          type: "boost",
          target: "file",
          targetId: file,
          magnitude: this.config.boostLearningRate * 2,
          reason: "user_requested_file",
          confidence: 0.95,
          decay: 0.0001,
        });
      }
    }

    return signals;
  }

  private processExplicitCorrection(feedback: UserFeedback): LearningSignal[] {
    const signals: LearningSignal[] = [];

    if (feedback.correction) {
      // This is the most valuable type of feedback
      // Store the full correction for future reference
      this.model.intentCorrections.set(feedback.query, feedback.correction);

      signals.push({
        type: "adjust",
        target: "pattern",
        targetId: `correction_${this.generateId()}`,
        magnitude: 1,
        reason: "explicit_correction",
        confidence: 1.0,
        decay: 0.00001, // Almost permanent
      });

      this.metrics.learnedPatterns++;
    }

    return signals;
  }

  // ==========================================================================
  // SIGNAL APPLICATION
  // ==========================================================================

  private applySignal(signal: LearningSignal): void {
    if (signal.confidence < this.config.minConfidenceToApply) {
      return;
    }

    switch (signal.target) {
      case "file":
      case "unit":
        this.applyBoostSignal(signal);
        break;
      case "modality":
        this.applyModalitySignal(signal);
        break;
      case "intent":
        // Already handled in generation
        break;
      case "pattern":
        this.applyPatternSignal(signal);
        break;
    }

    this.metrics.signalsApplied++;
  }

  private applyBoostSignal(signal: LearningSignal): void {
    const current = this.model.fileBoosts.get(signal.targetId) || 0;
    const newValue = Math.max(-1, Math.min(1, current + signal.magnitude));
    this.model.fileBoosts.set(signal.targetId, newValue);
    this.preferences.fileImportance.set(signal.targetId, 0.5 + newValue * 0.5);
    this.metrics.learnedFileBoosts = this.model.fileBoosts.size;
  }

  private applyModalitySignal(signal: LearningSignal): void {
    const current = this.preferences.modalityWeights[signal.targetId] || 1;
    this.preferences.modalityWeights[signal.targetId] = Math.max(
      0.1,
      Math.min(2, current + signal.magnitude),
    );
  }

  private applyPatternSignal(signal: LearningSignal): void {
    const current = this.model.patternScores.get(signal.targetId) || 0;
    this.model.patternScores.set(signal.targetId, current + signal.magnitude);
  }

  // ==========================================================================
  // RELEVANCE ADJUSTMENTS
  // ==========================================================================

  /**
   * Get relevance boost for a file based on learned preferences
   */
  getFileBoost(filePath: string): number {
    const boost = this.model.fileBoosts.get(filePath) || 0;

    // Check if in anti-patterns
    if (this.preferences.antiPatterns.has(filePath)) {
      return boost - 0.3;
    }

    // Check if in preferred patterns
    if (this.preferences.preferredPatterns.has(filePath)) {
      return boost + 0.2;
    }

    return boost;
  }

  /**
   * Get relevance boosts for a query based on past associations
   */
  getQueryFileAssociations(query: string): Map<string, number> {
    // Exact match
    if (this.model.queryFileAssociations.has(query)) {
      return this.model.queryFileAssociations.get(query)!;
    }

    // Fuzzy match based on similar queries
    const similar = new Map<string, number>();
    const queryWords = new Set(query.toLowerCase().split(/\s+/));

    for (const [storedQuery, associations] of this.model
      .queryFileAssociations) {
      const storedWords = new Set(storedQuery.toLowerCase().split(/\s+/));
      const overlap = [...queryWords].filter((w) => storedWords.has(w)).length;
      const similarity = overlap / Math.max(queryWords.size, storedWords.size);

      if (similarity > 0.5) {
        for (const [file, score] of associations) {
          const current = similar.get(file) || 0;
          similar.set(file, current + score * similarity);
        }
      }
    }

    return similar;
  }

  /**
   * Get corrected intent if available
   */
  getCorrectedIntent(query: string): string | undefined {
    // Exact match
    if (this.model.intentCorrections.has(query)) {
      return this.model.intentCorrections.get(query);
    }

    // Check vocabulary
    if (this.preferences.intentVocabulary.has(query)) {
      return this.preferences.intentVocabulary.get(query);
    }

    return undefined;
  }

  /**
   * Get modality weight adjustment
   */
  getModalityWeight(modality: string): number {
    return this.preferences.modalityWeights[modality] || 1;
  }

  /**
   * Get preferred detail level
   */
  getPreferredDetailLevel(): {
    level: UserPreferences["preferredDetailLevel"];
    confidence: number;
  } {
    return {
      level: this.preferences.preferredDetailLevel,
      confidence: this.preferences.detailLevelConfidence,
    };
  }

  /**
   * Check if file is in anti-patterns
   */
  isAntiPattern(filePath: string): boolean {
    return this.preferences.antiPatterns.has(filePath);
  }

  // ==========================================================================
  // ACCURACY & METRICS
  // ==========================================================================

  private updateAccuracyEstimate(): void {
    if (this.metrics.totalFeedback < this.config.minFeedbackToLearn) {
      return;
    }

    const total = this.metrics.positiveFeedback + this.metrics.negativeFeedback;
    if (total > 0) {
      this.metrics.estimatedAccuracy = this.metrics.positiveFeedback / total;
      this.model.accuracy = this.metrics.estimatedAccuracy;
    }
    this.metrics.lastAccuracyUpdate = Date.now();
  }

  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  getPreferences(): UserPreferences {
    return {
      ...this.preferences,
      fileImportance: new Map(this.preferences.fileImportance),
      intentVocabulary: new Map(this.preferences.intentVocabulary),
      antiPatterns: new Set(this.preferences.antiPatterns),
      preferredPatterns: new Set(this.preferences.preferredPatterns),
    };
  }

  // ==========================================================================
  // DECAY & MAINTENANCE
  // ==========================================================================

  /**
   * Apply decay to all learned values (call periodically)
   */
  applyDecay(): void {
    // Decay file boosts
    for (const [file, boost] of this.model.fileBoosts) {
      const newBoost = boost * (1 - this.config.decayRate);
      if (Math.abs(newBoost) < 0.01) {
        this.model.fileBoosts.delete(file);
      } else {
        this.model.fileBoosts.set(file, newBoost);
      }
    }

    // Decay pattern scores
    for (const [pattern, score] of this.model.patternScores) {
      const newScore = score * (1 - this.config.decayRate);
      if (Math.abs(newScore) < 0.01) {
        this.model.patternScores.delete(pattern);
      } else {
        this.model.patternScores.set(pattern, newScore);
      }
    }

    // Decay detail level confidence
    this.preferences.detailLevelConfidence *= 1 - this.config.decayRate;
  }

  private trimHistory(): void {
    if (this.model.feedbackHistory.length > this.config.maxHistorySize) {
      this.model.feedbackHistory = this.model.feedbackHistory.slice(
        -this.config.maxHistorySize,
      );
    }
    if (this.model.signalHistory.length > this.config.maxHistorySize * 3) {
      this.model.signalHistory = this.model.signalHistory.slice(
        -this.config.maxHistorySize * 3,
      );
    }
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Export model for persistence
   */
  exportModel(): string {
    const exportData = {
      model: {
        fileBoosts: Object.fromEntries(this.model.fileBoosts),
        unitTypeBoosts: Object.fromEntries(this.model.unitTypeBoosts),
        queryFileAssociations: Object.fromEntries(
          Array.from(this.model.queryFileAssociations.entries()).map(
            ([k, v]) => [k, Object.fromEntries(v)],
          ),
        ),
        intentCorrections: Object.fromEntries(this.model.intentCorrections),
        patternScores: Object.fromEntries(this.model.patternScores),
        version: this.model.version,
        lastUpdated: this.model.lastUpdated,
        totalFeedback: this.model.totalFeedback,
        accuracy: this.model.accuracy,
      },
      preferences: {
        preferredDetailLevel: this.preferences.preferredDetailLevel,
        detailLevelConfidence: this.preferences.detailLevelConfidence,
        modalityWeights: this.preferences.modalityWeights,
        fileImportance: Object.fromEntries(this.preferences.fileImportance),
        intentVocabulary: Object.fromEntries(this.preferences.intentVocabulary),
        antiPatterns: Array.from(this.preferences.antiPatterns),
        preferredPatterns: Array.from(this.preferences.preferredPatterns),
      },
      metrics: this.metrics,
    };

    return JSON.stringify(exportData);
  }

  /**
   * Import model from persistence
   */
  importModel(data: string): boolean {
    try {
      const parsed = JSON.parse(data);

      // Import model
      if (parsed.model) {
        this.model.fileBoosts = new Map(
          Object.entries(parsed.model.fileBoosts || {}),
        );
        this.model.unitTypeBoosts = new Map(
          Object.entries(parsed.model.unitTypeBoosts || {}),
        );
        this.model.queryFileAssociations = new Map(
          Object.entries(parsed.model.queryFileAssociations || {}).map(
            ([k, v]) => [
              k,
              new Map(Object.entries(v as Record<string, number>)),
            ],
          ),
        );
        this.model.intentCorrections = new Map(
          Object.entries(parsed.model.intentCorrections || {}),
        );
        this.model.patternScores = new Map(
          Object.entries(parsed.model.patternScores || {}),
        );
        this.model.version = parsed.model.version || 1;
        this.model.lastUpdated = parsed.model.lastUpdated || Date.now();
        this.model.totalFeedback = parsed.model.totalFeedback || 0;
        this.model.accuracy = parsed.model.accuracy || 0.5;
      }

      // Import preferences
      if (parsed.preferences) {
        this.preferences.preferredDetailLevel =
          parsed.preferences.preferredDetailLevel || "detailed";
        this.preferences.detailLevelConfidence =
          parsed.preferences.detailLevelConfidence || 0;
        this.preferences.modalityWeights =
          parsed.preferences.modalityWeights || {};
        this.preferences.fileImportance = new Map(
          Object.entries(parsed.preferences.fileImportance || {}),
        );
        this.preferences.intentVocabulary = new Map(
          Object.entries(parsed.preferences.intentVocabulary || {}),
        );
        this.preferences.antiPatterns = new Set(
          parsed.preferences.antiPatterns || [],
        );
        this.preferences.preferredPatterns = new Set(
          parsed.preferences.preferredPatterns || [],
        );
      }

      // Import metrics
      if (parsed.metrics) {
        this.metrics = { ...this.metrics, ...parsed.metrics };
      }

      this.emit("imported", { success: true });
      return true;
    } catch (error) {
      console.error("[RealTimeLearning] Import failed:", error);
      return false;
    }
  }

  /**
   * Reset all learning
   */
  reset(): void {
    this.model = {
      fileBoosts: new Map(),
      unitTypeBoosts: new Map(),
      queryFileAssociations: new Map(),
      intentCorrections: new Map(),
      patternScores: new Map(),
      feedbackHistory: [],
      signalHistory: [],
      version: this.model.version + 1,
      lastUpdated: Date.now(),
      totalFeedback: 0,
      accuracy: 0.5,
    };

    this.preferences = {
      preferredDetailLevel: "detailed",
      detailLevelConfidence: 0,
      modalityWeights: {},
      fileImportance: new Map(),
      intentVocabulary: new Map(),
      antiPatterns: new Set(),
      preferredPatterns: new Set(),
    };

    this.metrics = {
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      corrections: 0,
      estimatedAccuracy: 0.5,
      lastAccuracyUpdate: Date.now(),
      signalsGenerated: 0,
      signalsApplied: 0,
      learnedFileBoosts: 0,
      learnedIntentCorrections: 0,
      learnedPatterns: 0,
    };

    this.emit("reset");
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

const learningInstances = new Map<string, RealTimeLearningService>();

/**
 * Get or create a learning service for a session
 */
export function getRealTimeLearning(
  sessionId: string = "default",
  config?: Partial<LearningConfig>,
): RealTimeLearningService {
  const existing = learningInstances.get(sessionId);
  if (existing) return existing;

  const instance = new RealTimeLearningService(sessionId, config);
  learningInstances.set(sessionId, instance);
  return instance;
}

/**
 * Destroy a learning service instance
 */
export function destroyRealTimeLearning(sessionId: string): void {
  const instance = learningInstances.get(sessionId);
  if (instance) {
    instance.reset();
    learningInstances.delete(sessionId);
  }
}

/**
 * Destroy all learning service instances
 */
export function destroyAllRealTimeLearning(): void {
  for (const id of Array.from(learningInstances.keys())) {
    destroyRealTimeLearning(id);
  }
}

export default RealTimeLearningService;
