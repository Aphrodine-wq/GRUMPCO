/**
 * Agent Unified Store Namespace
 *
 * Single entry point for all Agent stores.
 * Import from this file instead of individual store files.
 *
 * @example
 * ```ts
 * // Instead of:
 * import { agentStore } from '../stores/agentStore';
 * import { agentPlanStore } from '../stores/agentPlanStore';
 *
 * // Use:
 * import { agentStore, agentPlanStore } from '../stores/Agent';
 * // Or for namespace access:
 * import * as Agent from '../stores/Agent';
 * Agent.agentStore.fetchStatus();
 * Agent.agentPlanStore.approvePlan();
 * ```
 */

// ============================================================================
// CORE STORE - Goals, Queue, SSE, Kill Switch
// ============================================================================

export {
  agentStore,
  goals,
  queueStats,
  globalStopInfo,
  isGlobalStopActive,
  isLoading as coreIsLoading,
  isConnected,
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
  type agentStatus,
  type agentSSEEvent,
} from '../agentStore.js';

// ============================================================================
// PLAN STORE - Execution Plans, Tasks, SSE Streaming
// ============================================================================

export {
  agentPlanStore,
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
} from '../agentPlanStore.js';

// ============================================================================
// CONFIG STORE - Features, Autonomy, Presets
// ============================================================================

export {
  agentConfigStore,
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
  type AgentConfig,
} from '../agentConfigStore.js';

// ============================================================================
// BUDGET STORE - Cost Tracking, Prophecy
// ============================================================================

export {
  agentBudgetStore,
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
} from '../agentBudgetStore.js';

// ============================================================================
// COMPILER STORE - Semantic Compilation, 100x Compression
// ============================================================================

export {
  agentCompilerStore,
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
} from '../agentCompilerStore.js';

// ============================================================================
// DEDUP STORE - Pattern Deduplication
// ============================================================================

export {
  agentDedupStore,
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
} from '../agentDedupStore.js';
