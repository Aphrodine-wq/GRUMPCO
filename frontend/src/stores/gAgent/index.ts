/**
 * gAgent Unified Store Namespace
 *
 * Single entry point for gAgent stores.
 * Currently only re-exports gAgentConfigStore (the only store
 * actively imported by components).
 */

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
