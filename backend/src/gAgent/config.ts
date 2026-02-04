/**
 * G-Agent Configuration System
 *
 * Centralized configuration for the entire G-Agent system.
 * Provides:
 * - Unified configuration management
 * - Per-user and per-tier settings
 * - Runtime configuration updates
 * - Environment-aware defaults
 * - Configuration validation
 *
 * @module gAgent/config
 */

import { EventEmitter } from 'events';
import {
  type AutonomyLevel,
  type AutonomyConfig,
  type ConfidenceThresholds,
  AUTONOMY_CONFIGS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from './systemPrompt.js';
import { type BudgetConfig, DEFAULT_BUDGET_CONFIG } from './budgetManager.js';
import type { AgentTier, AgentType } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Environment types
 */
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;

export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

/**
 * Feature flags
 */
export const FEATURES = {
  // Core features
  GOAL_QUEUE: 'goal_queue',
  AGENT_LIGHTNING: 'agent_lightning',
  SELF_HEALING: 'self_healing',
  PATTERN_LEARNING: 'pattern_learning',
  CONFIDENCE_ROUTING: 'confidence_routing',

  // Advanced features
  MULTI_AGENT_SWARM: 'multi_agent_swarm',
  AUTONOMOUS_MODE: 'autonomous_mode',
  BACKGROUND_AGENTS: 'background_agents',

  // Safety features
  KILL_SWITCH: 'kill_switch',
  BUDGET_ENFORCEMENT: 'budget_enforcement',
  RUNAWAY_DETECTION: 'runaway_detection',

  // Experimental features
  VOICE_CONTROL: 'voice_control',
  PROACTIVE_SUGGESTIONS: 'proactive_suggestions',
  CODE_REVIEW_AGENTS: 'code_review_agents',
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// ============================================================================
// TYPES
// ============================================================================

export interface GAgentConfig {
  // Core settings
  version: string;
  environment: Environment;

  // Agent behavior
  autonomyLevel: AutonomyLevel;
  autonomyConfig: AutonomyConfig;
  confidenceThresholds: ConfidenceThresholds;

  // Budget settings
  budget: BudgetConfig;

  // Model preferences
  models: ModelConfig;

  // Feature flags
  features: Record<Feature, boolean>;

  // Safety settings
  safety: SafetyConfig;

  // Performance settings
  performance: PerformanceConfig;

  // Agent registry settings
  agents: AgentRegistryConfig;

  // Logging and telemetry
  logging: LoggingConfig;
}

export interface ModelConfig {
  primary: string;
  fallback: string;
  codegen: string;
  planning: string;
  cheap: string;
  maxTokens: number;
  temperature: number;
}

export interface SafetyConfig {
  // Kill switch
  killSwitchEnabled: boolean;
  autoStopOnBudgetExceeded: boolean;
  autoStopOnRunaway: boolean;

  // Rate limiting
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxCostPerMinute: number;

  // Dangerous operation protection
  requireApprovalForFileDelete: boolean;
  requireApprovalForCodeExecute: boolean;
  requireApprovalForNetworkRequests: boolean;

  // Content filtering
  blockMaliciousPatterns: boolean;
  sanitizeInputs: boolean;
  sanitizeOutputs: boolean;
}

export interface PerformanceConfig {
  // Concurrency
  maxConcurrentAgents: number;
  maxConcurrentGoals: number;
  maxConcurrentTasks: number;

  // Timeouts
  defaultTimeoutMs: number;
  llmTimeoutMs: number;
  toolTimeoutMs: number;

  // Caching
  enableCaching: boolean;
  cacheMaxAge: number;
  cacheMaxSize: number;

  // Batching
  enableBatching: boolean;
  batchSize: number;
  batchDelayMs: number;
}

export interface AgentRegistryConfig {
  // Enabled agents per tier
  tierAccess: Record<AgentTier, AgentType[]>;

  // Custom agent configurations
  agentConfigs: Record<AgentType, Partial<AgentTypeConfig>>;
}

export interface AgentTypeConfig {
  enabled: boolean;
  maxConcurrency: number;
  timeout: number;
  priority: number;
  systemPromptOverride?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableTelemetry: boolean;
  enableAuditLog: boolean;
  logTokenUsage: boolean;
  logCosts: boolean;
  sensitiveFieldMasking: boolean;
}

export interface UserConfig {
  userId: string;
  tier: AgentTier;
  autonomyLevel?: AutonomyLevel;
  budget?: Partial<BudgetConfig>;
  features?: Partial<Record<Feature, boolean>>;
  preferredModel?: string;
}

export type ConfigChangeEvent = {
  type: 'config_changed';
  section: keyof GAgentConfig;
  previous: unknown;
  current: unknown;
  changedBy: string;
  timestamp: string;
};

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  primary: 'claude-3.5-sonnet',
  fallback: 'gpt-4o',
  codegen: 'claude-3.5-sonnet',
  planning: 'claude-3.5-sonnet',
  cheap: 'claude-3.5-haiku',
  maxTokens: 16000,
  temperature: 0.7,
};

/**
 * Default safety configuration
 */
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  killSwitchEnabled: true,
  autoStopOnBudgetExceeded: true,
  autoStopOnRunaway: true,

  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 100000,
  maxCostPerMinute: 100, // $1.00

  requireApprovalForFileDelete: true,
  requireApprovalForCodeExecute: true,
  requireApprovalForNetworkRequests: false,

  blockMaliciousPatterns: true,
  sanitizeInputs: true,
  sanitizeOutputs: true,
};

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxConcurrentAgents: 10,
  maxConcurrentGoals: 5,
  maxConcurrentTasks: 20,

  defaultTimeoutMs: 300000, // 5 minutes
  llmTimeoutMs: 120000, // 2 minutes
  toolTimeoutMs: 60000, // 1 minute

  enableCaching: true,
  cacheMaxAge: 3600000, // 1 hour
  cacheMaxSize: 100,

  enableBatching: false,
  batchSize: 5,
  batchDelayMs: 100,
};

/**
 * Default agent registry configuration
 */
export const DEFAULT_AGENT_REGISTRY_CONFIG: AgentRegistryConfig = {
  tierAccess: {
    free: ['executor', 'planner'],
    pro: ['executor', 'planner', 'frontend', 'backend', 'test', 'docs'],
    team: [
      'executor',
      'planner',
      'frontend',
      'backend',
      'test',
      'docs',
      'architect',
      'devops',
      'security',
    ],
    enterprise: [
      'executor',
      'planner',
      'frontend',
      'backend',
      'test',
      'docs',
      'architect',
      'devops',
      'security',
      'supervisor',
      'ux',
      'perf',
      'a11y',
      'data',
      'review',
      'i18n',
    ],
  },
  agentConfigs: {} as Record<AgentType, Partial<AgentTypeConfig>>,
};

/**
 * Default logging configuration
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: 'info',
  enableTelemetry: true,
  enableAuditLog: true,
  logTokenUsage: true,
  logCosts: true,
  sensitiveFieldMasking: true,
};

/**
 * Default feature flags by environment
 */
export const DEFAULT_FEATURES: Record<Environment, Record<Feature, boolean>> = {
  development: {
    [FEATURES.GOAL_QUEUE]: true,
    [FEATURES.AGENT_LIGHTNING]: true,
    [FEATURES.SELF_HEALING]: true,
    [FEATURES.PATTERN_LEARNING]: true,
    [FEATURES.CONFIDENCE_ROUTING]: true,
    [FEATURES.MULTI_AGENT_SWARM]: true,
    [FEATURES.AUTONOMOUS_MODE]: true,
    [FEATURES.BACKGROUND_AGENTS]: true,
    [FEATURES.KILL_SWITCH]: true,
    [FEATURES.BUDGET_ENFORCEMENT]: true,
    [FEATURES.RUNAWAY_DETECTION]: true,
    [FEATURES.VOICE_CONTROL]: true,
    [FEATURES.PROACTIVE_SUGGESTIONS]: true,
    [FEATURES.CODE_REVIEW_AGENTS]: true,
  },
  staging: {
    [FEATURES.GOAL_QUEUE]: true,
    [FEATURES.AGENT_LIGHTNING]: true,
    [FEATURES.SELF_HEALING]: true,
    [FEATURES.PATTERN_LEARNING]: true,
    [FEATURES.CONFIDENCE_ROUTING]: true,
    [FEATURES.MULTI_AGENT_SWARM]: true,
    [FEATURES.AUTONOMOUS_MODE]: true,
    [FEATURES.BACKGROUND_AGENTS]: true,
    [FEATURES.KILL_SWITCH]: true,
    [FEATURES.BUDGET_ENFORCEMENT]: true,
    [FEATURES.RUNAWAY_DETECTION]: true,
    [FEATURES.VOICE_CONTROL]: false,
    [FEATURES.PROACTIVE_SUGGESTIONS]: false,
    [FEATURES.CODE_REVIEW_AGENTS]: false,
  },
  production: {
    [FEATURES.GOAL_QUEUE]: true,
    [FEATURES.AGENT_LIGHTNING]: true,
    [FEATURES.SELF_HEALING]: true,
    [FEATURES.PATTERN_LEARNING]: true,
    [FEATURES.CONFIDENCE_ROUTING]: true,
    [FEATURES.MULTI_AGENT_SWARM]: true,
    [FEATURES.AUTONOMOUS_MODE]: false, // Disabled in production by default
    [FEATURES.BACKGROUND_AGENTS]: true,
    [FEATURES.KILL_SWITCH]: true,
    [FEATURES.BUDGET_ENFORCEMENT]: true,
    [FEATURES.RUNAWAY_DETECTION]: true,
    [FEATURES.VOICE_CONTROL]: false,
    [FEATURES.PROACTIVE_SUGGESTIONS]: false,
    [FEATURES.CODE_REVIEW_AGENTS]: false,
  },
};

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

/**
 * Centralized configuration manager for G-Agent
 */
export class ConfigManager extends EventEmitter {
  private config: GAgentConfig;
  private userConfigs: Map<string, UserConfig> = new Map();
  private static instance: ConfigManager;

  private constructor() {
    super();
    this.config = this.createDefaultConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Create default configuration based on environment
   */
  private createDefaultConfig(): GAgentConfig {
    const env = this.detectEnvironment();

    return {
      version: '2.0.0',
      environment: env,

      autonomyLevel: 'semi-autonomous',
      autonomyConfig: AUTONOMY_CONFIGS['semi-autonomous'],
      confidenceThresholds: { ...DEFAULT_CONFIDENCE_THRESHOLDS },

      budget: { ...DEFAULT_BUDGET_CONFIG },
      models: { ...DEFAULT_MODEL_CONFIG },
      features: { ...DEFAULT_FEATURES[env] },
      safety: { ...DEFAULT_SAFETY_CONFIG },
      performance: { ...DEFAULT_PERFORMANCE_CONFIG },
      agents: { ...DEFAULT_AGENT_REGISTRY_CONFIG },
      logging: { ...DEFAULT_LOGGING_CONFIG },
    };
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'production') return ENVIRONMENTS.PRODUCTION;
    if (nodeEnv === 'staging') return ENVIRONMENTS.STAGING;
    return ENVIRONMENTS.DEVELOPMENT;
  }

  // --------------------------------------------------------------------------
  // GETTERS
  // --------------------------------------------------------------------------

  /**
   * Get full configuration
   */
  getConfig(): Readonly<GAgentConfig> {
    return this.config;
  }

  /**
   * Get specific section
   */
  getSection<K extends keyof GAgentConfig>(section: K): Readonly<GAgentConfig[K]> {
    return this.config[section];
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.config.environment;
  }

  /**
   * Get autonomy level
   */
  getAutonomyLevel(): AutonomyLevel {
    return this.config.autonomyLevel;
  }

  /**
   * Get autonomy config
   */
  getAutonomyConfig(): AutonomyConfig {
    return this.config.autonomyConfig;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: Feature): boolean {
    return this.config.features[feature] ?? false;
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): Feature[] {
    return Object.entries(this.config.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature as Feature);
  }

  /**
   * Get model for a specific purpose
   */
  getModel(purpose: keyof ModelConfig = 'primary'): string {
    return (this.config.models[purpose] as string) || this.config.models.primary;
  }

  // --------------------------------------------------------------------------
  // SETTERS
  // --------------------------------------------------------------------------

  /**
   * Update configuration section
   */
  updateSection<K extends keyof GAgentConfig>(
    section: K,
    updates: Partial<GAgentConfig[K]>,
    changedBy: string = 'system'
  ): void {
    const currentValue = this.config[section];
    const previous =
      typeof currentValue === 'object' && currentValue !== null
        ? { ...(currentValue as object) }
        : currentValue;

    if (typeof currentValue === 'object' && currentValue !== null) {
      this.config[section] = {
        ...(currentValue as object),
        ...(updates as object),
      } as GAgentConfig[K];
    } else {
      this.config[section] = updates as GAgentConfig[K];
    }

    this.emitChange(section, previous, this.config[section], changedBy);
  }

  /**
   * Set autonomy level
   */
  setAutonomyLevel(level: AutonomyLevel, changedBy: string = 'system'): void {
    const previous = this.config.autonomyLevel;
    this.config.autonomyLevel = level;
    this.config.autonomyConfig = AUTONOMY_CONFIGS[level];

    this.emitChange('autonomyLevel', previous, level, changedBy);
  }

  /**
   * Enable/disable a feature
   */
  setFeature(feature: Feature, enabled: boolean, changedBy: string = 'system'): void {
    const previous = this.config.features[feature];
    this.config.features[feature] = enabled;

    this.emitChange('features', { [feature]: previous }, { [feature]: enabled }, changedBy);
  }

  /**
   * Update budget config
   */
  updateBudget(updates: Partial<BudgetConfig>, changedBy: string = 'system'): void {
    this.updateSection('budget', updates, changedBy);
  }

  /**
   * Update safety config
   */
  updateSafety(updates: Partial<SafetyConfig>, changedBy: string = 'system'): void {
    this.updateSection('safety', updates, changedBy);
  }

  /**
   * Update model config
   */
  updateModels(updates: Partial<ModelConfig>, changedBy: string = 'system'): void {
    this.updateSection('models', updates, changedBy);
  }

  // --------------------------------------------------------------------------
  // USER CONFIGURATION
  // --------------------------------------------------------------------------

  /**
   * Get user-specific configuration
   */
  getUserConfig(userId: string): UserConfig | undefined {
    return this.userConfigs.get(userId);
  }

  /**
   * Set user-specific configuration
   */
  setUserConfig(config: UserConfig): void {
    this.userConfigs.set(config.userId, config);
  }

  /**
   * Get effective config for a user (merges global + user)
   */
  getEffectiveConfig(userId: string): {
    autonomyLevel: AutonomyLevel;
    budget: BudgetConfig;
    features: Record<Feature, boolean>;
    model: string;
  } {
    const userConfig = this.userConfigs.get(userId);

    return {
      autonomyLevel: userConfig?.autonomyLevel || this.config.autonomyLevel,
      budget: { ...this.config.budget, ...userConfig?.budget },
      features: { ...this.config.features, ...userConfig?.features },
      model: userConfig?.preferredModel || this.config.models.primary,
    };
  }

  /**
   * Get available agents for a user's tier
   */
  getAvailableAgents(tier: AgentTier): AgentType[] {
    return this.config.agents.tierAccess[tier] || [];
  }

  /**
   * Check if user has access to an agent type
   */
  hasAgentAccess(tier: AgentTier, agentType: AgentType): boolean {
    return this.config.agents.tierAccess[tier]?.includes(agentType) ?? false;
  }

  // --------------------------------------------------------------------------
  // VALIDATION
  // --------------------------------------------------------------------------

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate budget limits
    if (this.config.budget.sessionLimit < 0) {
      errors.push('Session budget limit cannot be negative');
    }
    if (this.config.budget.dailyLimit < this.config.budget.sessionLimit) {
      errors.push('Daily limit should be >= session limit');
    }

    // Validate confidence thresholds
    const ct = this.config.confidenceThresholds;
    if (ct.autoExecute <= ct.suggestAndWait) {
      errors.push('autoExecute threshold should be > suggestAndWait');
    }
    if (ct.suggestAndWait <= ct.askExplicitly) {
      errors.push('suggestAndWait threshold should be > askExplicitly');
    }

    // Validate safety settings
    if (this.config.safety.maxRequestsPerMinute < 1) {
      errors.push('maxRequestsPerMinute must be at least 1');
    }

    // Validate performance settings
    if (this.config.performance.maxConcurrentAgents < 1) {
      errors.push('maxConcurrentAgents must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // --------------------------------------------------------------------------
  // PRESETS
  // --------------------------------------------------------------------------

  /**
   * Apply a preset configuration
   */
  applyPreset(preset: ConfigPreset, changedBy: string = 'system'): void {
    const presetConfig = CONFIG_PRESETS[preset];
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    // Apply each section from the preset
    for (const [key, value] of Object.entries(presetConfig)) {
      if (value !== undefined && key in this.config) {
        this.updateSection(key as keyof GAgentConfig, value as any, changedBy);
      }
    }
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Emit configuration change event
   */
  private emitChange(
    section: keyof GAgentConfig | string,
    previous: unknown,
    current: unknown,
    changedBy: string
  ): void {
    const event: ConfigChangeEvent = {
      type: 'config_changed',
      section: section as keyof GAgentConfig,
      previous,
      current,
      changedBy,
      timestamp: new Date().toISOString(),
    };
    this.emit('change', event);
  }

  /**
   * Export configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  fromJSON(json: string, changedBy: string = 'system'): void {
    try {
      const parsed = JSON.parse(json) as Partial<GAgentConfig>;

      // Validate and merge each section
      for (const [key, value] of Object.entries(parsed)) {
        if (key in this.config && value !== undefined) {
          this.updateSection(key as keyof GAgentConfig, value as any, changedBy);
        }
      }
    } catch (err) {
      throw new Error(`Invalid configuration JSON: ${(err as Error).message}`);
    }
  }

  /**
   * Reset to defaults
   */
  reset(changedBy: string = 'system'): void {
    const previous = { ...this.config };
    this.config = this.createDefaultConfig();
    this.emitChange('*' as any, previous, this.config, changedBy);
  }
}

// ============================================================================
// CONFIGURATION PRESETS
// ============================================================================

export type ConfigPreset =
  | 'conservative' // Maximum safety, minimum risk
  | 'balanced' // Good balance of safety and capability
  | 'aggressive' // Maximum capability, higher risk tolerance
  | 'enterprise' // Enterprise-grade settings
  | 'development'; // Development-friendly settings

export const CONFIG_PRESETS: Record<ConfigPreset, Partial<GAgentConfig>> = {
  conservative: {
    autonomyLevel: 'supervised',
    safety: {
      ...DEFAULT_SAFETY_CONFIG,
      requireApprovalForFileDelete: true,
      requireApprovalForCodeExecute: true,
      requireApprovalForNetworkRequests: true,
      autoStopOnBudgetExceeded: true,
      autoStopOnRunaway: true,
    },
    budget: {
      ...DEFAULT_BUDGET_CONFIG,
      sessionLimit: 100, // $1.00 max per session
      dailyLimit: 500, // $5.00 max per day
      autoApproveUnder: 5, // Only auto-approve under 5 cents
    },
    features: {
      ...DEFAULT_FEATURES.production,
      [FEATURES.AUTONOMOUS_MODE]: false,
      [FEATURES.BACKGROUND_AGENTS]: false,
    },
  },

  balanced: {
    autonomyLevel: 'semi-autonomous',
    safety: { ...DEFAULT_SAFETY_CONFIG },
    budget: { ...DEFAULT_BUDGET_CONFIG },
    features: { ...DEFAULT_FEATURES.staging },
  },

  aggressive: {
    autonomyLevel: 'autonomous',
    safety: {
      ...DEFAULT_SAFETY_CONFIG,
      requireApprovalForFileDelete: false,
      requireApprovalForCodeExecute: false,
      requireApprovalForNetworkRequests: false,
      maxRequestsPerMinute: 120,
      maxTokensPerMinute: 200000,
    },
    budget: {
      ...DEFAULT_BUDGET_CONFIG,
      sessionLimit: 2000, // $20.00 max per session
      dailyLimit: 10000, // $100.00 max per day
      autoApproveUnder: 100, // Auto-approve under $1.00
    },
    features: { ...DEFAULT_FEATURES.development },
  },

  enterprise: {
    autonomyLevel: 'semi-autonomous',
    safety: {
      ...DEFAULT_SAFETY_CONFIG,
      requireApprovalForFileDelete: true,
      requireApprovalForCodeExecute: true,
    },
    budget: {
      ...DEFAULT_BUDGET_CONFIG,
      sessionLimit: 5000, // $50.00 max per session
      dailyLimit: 50000, // $500.00 max per day
      monthlyLimit: 500000, // $5000.00 max per month
    },
    performance: {
      ...DEFAULT_PERFORMANCE_CONFIG,
      maxConcurrentAgents: 20,
      maxConcurrentGoals: 10,
      maxConcurrentTasks: 50,
    },
    logging: {
      ...DEFAULT_LOGGING_CONFIG,
      enableAuditLog: true,
      logTokenUsage: true,
      logCosts: true,
    },
    features: {
      ...DEFAULT_FEATURES.production,
      [FEATURES.AUTONOMOUS_MODE]: true,
      [FEATURES.BACKGROUND_AGENTS]: true,
    },
  },

  development: {
    autonomyLevel: 'autonomous',
    safety: {
      ...DEFAULT_SAFETY_CONFIG,
      requireApprovalForFileDelete: false,
      requireApprovalForCodeExecute: false,
      requireApprovalForNetworkRequests: false,
    },
    budget: {
      ...DEFAULT_BUDGET_CONFIG,
      sessionLimit: 10000, // High limit for dev
      hardStop: false, // Warn but don't stop
    },
    logging: {
      ...DEFAULT_LOGGING_CONFIG,
      level: 'debug',
    },
    features: { ...DEFAULT_FEATURES.development },
  },
};

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const configManager = ConfigManager.getInstance();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the global configuration
 */
export function getConfig(): Readonly<GAgentConfig> {
  return configManager.getConfig();
}

/**
 * Check if a feature is enabled
 */
export function isEnabled(feature: Feature): boolean {
  return configManager.isFeatureEnabled(feature);
}

/**
 * Get the current autonomy level
 */
export function getAutonomyLevel(): AutonomyLevel {
  return configManager.getAutonomyLevel();
}

/**
 * Get the preferred model
 */
export function getModel(purpose?: keyof ModelConfig): string {
  return configManager.getModel(purpose);
}

/**
 * Apply a preset
 */
export function applyPreset(preset: ConfigPreset): void {
  configManager.applyPreset(preset);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default configManager;
