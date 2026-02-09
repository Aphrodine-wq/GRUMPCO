/**
 * Agent Unified Store Namespace
 *
 * Single entry point for all Agent stores.
 * Import from this file instead of individual store files.
 *
 * @example
 * ```ts
 * // Instead of:
 * import { gAgentStore } from '../stores/gAgentStore';
 * import { gAgentPlanStore } from '../stores/gAgentPlanStore';
 *
 * // Use:
 * import { gAgentStore, gAgentPlanStore } from '../stores/gAgent';
 * // Or for namespace access:
 * import * as gAgent from '../stores/gAgent';
 * gAgent.gAgentStore.fetchStatus();
 * gAgent.gAgentPlanStore.approvePlan();
 * ```
 */

// ============================================================================
// CORE STORE - Goals, Queue, SSE, Kill Switch
// ============================================================================

export {
  gAgentStore,
  goals,
  queueStats,
  globalStopInfo,
  isGlobalStopActive,
  gAgentStatus,
  isLoading as coreIsLoading,
  isConnected,
  gAgentError,
  lastEvent,
  pendingGoals,
  activeGoals,
  completedGoals,
  type Goal,
  type GoalStatus,
  type GoalPriority,
  type TriggerType,
  type QueueStats,
  type GlobalStopInfo,
  type GAgentStatus,
  type GAgentSSEEvent,
} from '../gAgentStore.js';

// ============================================================================
// PLAN STORE - Execution Plans, Tasks, SSE Streaming
// ============================================================================

export {
  gAgentPlanStore,
  currentPlan,
  isGenerating,
  isExecuting,
  planError,
  currentTasks,
  readyTasks,
  executionProgress,
  type Plan,
  type Task,
  type TaskStatus,
  type PlanStatus,
  type RiskLevel,
  type PlanRiskAssessment,
  type TaskExecutionEvent,
} from '../gAgentPlanStore.js';

// ============================================================================
// CONFIG STORE - Features, Autonomy, Presets
// ============================================================================

export {
  gAgentConfigStore,
  autonomyLevel,
  isAutonomous,
  enabledFeatures,
  isFeatureEnabled,
  environment,
  getAutonomyColor,
  getAutonomyIcon,
  AUTONOMY_LEVELS,
  FEATURE_IDS,
  type AutonomyLevel,
  type Environment,
  type Feature,
  type ConfigPreset,
  type ModelConfig,
  type GAgentConfig,
} from '../gAgentConfigStore.js';

// ============================================================================
// BUDGET STORE - Cost Tracking, Prophecy
// ============================================================================

export {
  gAgentBudgetStore,
  budgetStatus,
  isWarning,
  isExceeded,
  canProceed,
  formattedSessionCost,
  sessionBudgetPercent,
  pendingApprovalCount,
  formatCost,
  getStatusColor,
  getStatusIcon,
  type BudgetStatus,
  type BudgetConfig,
  type CostEstimate,
  type CostBreakdown,
  type ApprovalRequest,
  type CostOperation,
} from '../gAgentBudgetStore.js';

// ============================================================================
// COMPILER STORE - Semantic Compilation, 100x Compression
// ============================================================================

export {
  gAgentCompilerStore,
  compilationResult,
  compiledContext,
  compressionRatio,
  isCompiling,
  compilerStats,
  tokensSaved,
  costSaved,
  indexSize,
  progressiveLevels,
  prefetchMetrics,
  queryPredictions,
  filePredictions,
  prefetchHitRate,
  activePatterns,
  isPredicting,
  multiModalResult,
  multiModalMetrics,
  isCompilingMultiModal,
  modalityBreakdown,
  detectedIntent,
  crossRefsUsed,
  cacheMetrics,
  cacheHitRate,
  l1CacheMetrics,
  l2CacheMetrics,
  l3CacheMetrics,
  persistedEntries,
  learningMetrics,
  learningPreferences,
  learningAccuracy,
  totalFeedback,
  preferredDetailLevel,
  formatCompressionRatio,
  formatTokens,
  getCompressionColor,
  type CompilationStats,
  type CompilationResult,
  type CompilerStats,
  type ProgressiveLevel,
  type SemanticType,
  type IndexedUnit,
  type ContentModality,
  type UserIntent,
  type MultiModalResult,
  type PrefetchMetrics,
  type QueryPrediction,
  type FilePrediction,
  type HierarchicalCacheMetrics,
  type LearningMetrics,
  type FeedbackType,
} from '../gAgentCompilerStore.js';

// ============================================================================
// DEDUP STORE - Pattern Deduplication
// ============================================================================

export {
  gAgentDedupStore,
  dedupStats,
  patterns,
  selectedPattern,
  sessionPatterns,
  totalSaved,
  patternCount,
  type PatternType,
  type PatternRef,
  type PatternSummary,
  type PatternDetails,
  type DeduplicationResult,
  type LibraryStats,
} from '../gAgentDedupStore.js';
