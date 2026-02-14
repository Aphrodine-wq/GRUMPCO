/**
 * G-Agent Module
 *
 * Unified G-Agent system that provides:
 * - Single entry point for all agent operations
 * - Agent registry with capability discovery
 * - Supervisor for agent lifecycle management
 * - Message bus for inter-agent communication
 *
 * @module gAgent
 */

// Core service
export { GAgentCore, gAgentCore } from './core.js';
export type { CoreOptions, Session } from './core.js';

// Agent registry
export { AgentRegistry, agentRegistry } from './registry.js';

// Supervisor
export { Supervisor, supervisor } from './supervisor.js';
export type { SpawnOptions, WorkflowOptions } from './supervisor.js';

// Message bus
export { MessageBus, messageBus, CHANNELS } from './messageBus.js';
export type {
  Channel,
  BusMessage,
  AgentSpawnMessage,
  AgentStatusMessage,
  AgentResultMessage,
  TaskAssignMessage,
  TaskProgressMessage,
  TaskCompleteMessage,
  TaskFailedMessage,
  GoalCreatedMessage,
  GoalUpdatedMessage,
  GoalCompletedMessage,
  BroadcastMessage,
  SystemErrorMessage,
} from './messageBus.js';

// Goal repository (persistence layer)
export { goalRepository } from './goalRepository.js';
export type { GoalCreateInput, GoalUpdateInput, GoalFilter, GoalStats } from './goalRepository.js';

// Security layer
export {
  // Constants
  GAGENT_MAX_MESSAGE_LENGTH,
  GAGENT_MAX_DESCRIPTION_LENGTH,
  GAGENT_MAX_PATH_LENGTH,
  GAGENT_SUSPICIOUS_PATTERNS,
  // Pattern checking
  checkGAgentSuspiciousPatterns,
  checkSuspiciousInGAgentBody,
  // Sanitization
  sanitizeControlChars,
  sanitizeGAgentMessage,
  sanitizeGoalDescription,
  sanitizePath,
  sanitizeTags,
  sanitizeContext,
  // Schemas
  agentProcessRequestSchema,
  goalCreateRequestSchema,
  recurringGoalRequestSchema,
  followUpGoalRequestSchema,
  // Middleware
  validateGAgentRequest,
  validateAgentProcessRequest,
  validateGoalCreateRequest,
  validateRecurringGoalRequest,
  validateFollowUpGoalRequest,
} from './security.js';
export type {
  SecurityCheckResult,
  ValidatedRequest,
  AgentProcessRequest,
  GoalCreateRequest,
  RecurringGoalRequest,
  FollowUpGoalRequest,
} from './security.js';

// Agent Lightning Bridge
export { agentLightningBridge, generateCodeFromGoal } from './agentLightningBridge.js';
export type {
  CodeGenFromGoalOptions,
  CodeGenProgressEvent,
  CodeGenResult,
} from './agentLightningBridge.js';

// System Prompt (G-Agent identity and personality)
export {
  GAGENT_IDENTITY,
  GAGENT_SYSTEM_PROMPT,
  AGENT_PROMPTS,
  AUTONOMY_CONFIGS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  RISK_FACTORS,
  calculateRiskLevel,
  PROMPT_TEMPLATES,
} from './systemPrompt.js';
export type {
  AutonomyLevel,
  AutonomyConfig,
  ConfidenceThresholds,
  RiskLevel,
  RiskAssessment,
} from './systemPrompt.js';

// Budget Manager (cost tracking and wallet respect)
export {
  budgetManager,
  BudgetManager,
  MODEL_PRICING,
  DEFAULT_BUDGET_CONFIG,
  RUNAWAY_THRESHOLDS,
  prophecyCost,
  quickCostCheck,
  canAfford,
  formatBudgetMessage,
} from './budgetManager.js';
export type {
  BudgetConfig,
  CostOperation,
  CostTracker,
  CostEstimate,
  CostBreakdown,
  BudgetStatus,
  ApprovalRequest,
  BudgetEvent,
  RunawayMetrics,
} from './budgetManager.js';

// Kill Switch (emergency stop system)
export {
  killSwitch,
  KillSwitch,
  STOP_REASONS,
  DEFAULT_GRACE_PERIOD_MS,
  MAX_STOP_WAIT_MS,
  emergencyStopAll,
  stopGoal,
  stopAgent,
  isGlobalStopActive,
  createAbortController,
  shouldContinue,
  canStartOperation,
} from './killSwitch.js';
export type {
  StopReason,
  StopResult,
  StopEvent,
  KillSwitchState,
  GracefulShutdownOptions,
  KillSwitchEvent,
} from './killSwitch.js';

// Power Expansion (advanced AI capabilities)
export {
  powerExpansion,
  PowerExpansion,
  ConfidenceRouter,
  SelfHealingEngine,
  TaskDecomposer,
  StrategySelector,
  PatternMatcher,
  MAX_HEALING_RETRIES,
  STRATEGIES,
} from './powerExpansion.js';
export type {
  Strategy,
  ConfidenceAnalysis,
  ConfidenceFactor,
  ConfidenceAction,
  HealingAttempt,
  ErrorType,
  SelfHealingContext,
  TaskDecomposition,
  DecomposedTask,
  StrategySelection,
  LearningRecord,
  PowerEvent,
} from './powerExpansion.js';

// Configuration System (centralized settings)
export {
  configManager,
  ConfigManager,
  ENVIRONMENTS,
  FEATURES,
  CONFIG_PRESETS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SAFETY_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_AGENT_REGISTRY_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  DEFAULT_FEATURES,
  getConfig,
  isEnabled,
  getAutonomyLevel,
  getModel,
  applyPreset,
} from './config.js';
export type {
  Environment,
  Feature,
  GAgentConfig,
  ModelConfig,
  SafetyConfig,
  PerformanceConfig,
  AgentRegistryConfig,
  AgentTypeConfig,
  LoggingConfig,
  UserConfig,
  ConfigChangeEvent,
  ConfigPreset,
} from './config.js';

// Semantic Compiler (100x solution to Data Wall Problem)
export {
  SemanticCompiler,
  getSemanticCompiler,
  destroySemanticCompiler,
} from './semanticCompiler.js';
export type {
  SemanticUnit,
  SemanticType,
  CompiledForm,
  CompilationRequest,
  CompilationResult,
  ProgressiveLoadState,
} from './semanticCompiler.js';

// Semantic Deduplication (cross-session pattern sharing)
export { SemanticDeduplicationService, getSemanticDedup } from './semanticDedup.js';
export type {
  SemanticPattern,
  PatternType,
  PatternRef,
  DeduplicationResult,
  LibraryStats,
} from './semanticDedup.js';

// Predictive Prefetch (ML-based query and file prediction)
export {
  PredictivePrefetchService,
  getPredictivePrefetch,
  createPredictivePrefetch,
  destroyPredictivePrefetch,
  DEFAULT_PREFETCH_CONFIG,
} from '../services/caching/predictivePrefetch.js';
export type {
  QueryPattern,
  PatternTriggerType,
  FileAccessPattern,
  FileRelationship,
  TopicCluster,
  PrefetchRequest,
  PrefetchResult,
  PrefetchConfig,
  PrefetchMetrics,
} from '../services/caching/predictivePrefetch.js';

// Multi-Modal Compiler (code + docs + tests unified context)
export {
  MultiModalCompilerService,
  getMultiModalCompiler,
  destroyMultiModalCompiler,
  DEFAULT_MODALITY_WEIGHTS,
  INTENT_MODIFIERS,
  MODALITY_PATTERNS,
} from '../services/intent/multiModalCompiler.js';
export type {
  ContentModality,
  MultiModalUnit,
  CrossReference,
  CrossRefType,
  UserIntent,
  ModalityWeights,
  MultiModalRequest,
  MultiModalResult,
  MultiModalConfig,
} from '../services/intent/multiModalCompiler.js';

// Hierarchical Cache (3-tier: L1 hot → L2 warm → L3 persistent)
export {
  HierarchicalCacheService,
  getHierarchicalCache,
  destroyHierarchicalCache,
  destroyAllHierarchicalCaches,
} from '../services/caching/hierarchicalCache.js';
export type {
  CacheEntry,
  CacheTierConfig,
  HierarchicalCacheConfig,
  CacheMetrics,
  TierMetrics,
} from '../services/caching/hierarchicalCache.js';

// Real-Time Learning (feedback-based model refinement)
export {
  RealTimeLearningService,
  getRealTimeLearning,
  destroyRealTimeLearning,
  destroyAllRealTimeLearning,
  DEFAULT_LEARNING_CONFIG,
} from '../services/agents/realTimeLearning.js';
export type {
  FeedbackType,
  UserFeedback,
  LearningSignal,
  UserPreferences,
  LearningModel,
  LearningConfig,
  LearningMetrics,
} from '../services/agents/realTimeLearning.js';

// Types (re-export all)
export * from './types.js';
