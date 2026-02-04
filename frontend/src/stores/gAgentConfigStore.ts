/**
 * G-Agent Config Store
 *
 * Svelte store for G-Agent configuration management including:
 * - Feature flags
 * - Autonomy level control
 * - Config presets
 * - Model configuration
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import type { ComponentType } from 'svelte';
import { Lock, Unlock, Bot, Zap, HelpCircle } from 'lucide-svelte';

// ============================================================================
// TYPES
// ============================================================================

export type AutonomyLevel = 'supervised' | 'semi-autonomous' | 'autonomous' | 'full-autonomous';
export type Environment = 'development' | 'staging' | 'production';

export interface Feature {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

export interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
}

export interface ModelConfig {
  primary: string;
  fallback: string;
  fast: string;
  embedding: string;
}

export interface GAgentConfig {
  autonomyLevel: AutonomyLevel;
  environment: Environment;
  features: Record<string, boolean>;
  model: ModelConfig;
}

interface GAgentConfigStoreState {
  config: GAgentConfig | null;
  features: Feature[];
  presets: ConfigPreset[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const AUTONOMY_LEVELS: { value: AutonomyLevel; label: string; description: string }[] = [
  {
    value: 'supervised',
    label: 'Supervised',
    description: 'All actions require human approval',
  },
  {
    value: 'semi-autonomous',
    label: 'Semi-Autonomous',
    description: 'Low-risk actions auto-approved, high-risk need approval',
  },
  {
    value: 'autonomous',
    label: 'Autonomous',
    description: 'Most actions auto-approved with safety limits',
  },
  {
    value: 'full-autonomous',
    label: 'Full Autonomous',
    description: 'All actions auto-approved (use with caution)',
  },
];

export const FEATURE_IDS = {
  GOAL_QUEUE: 'goal_queue',
  AGENT_LIGHTNING: 'agent_lightning',
  SELF_HEALING: 'self_healing',
  PATTERN_LEARNING: 'pattern_learning',
  CONFIDENCE_ROUTING: 'confidence_routing',
  MULTI_AGENT_SWARM: 'multi_agent_swarm',
  COST_PROPHECY: 'cost_prophecy',
  SEMANTIC_COMPILER: 'semantic_compiler',
} as const;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: GAgentConfigStoreState = {
  config: null,
  features: [],
  presets: [],
  isLoading: false,
  error: null,
};

// ============================================================================
// STORE
// ============================================================================

const store = writable<GAgentConfigStoreState>(initialState);

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Current autonomy level
 */
export const autonomyLevel = derived(store, ($s) => $s.config?.autonomyLevel ?? 'supervised');

/**
 * Is autonomous mode?
 */
export const isAutonomous = derived(
  store,
  ($s) =>
    $s.config?.autonomyLevel === 'autonomous' || $s.config?.autonomyLevel === 'full-autonomous'
);

/**
 * Enabled features
 */
export const enabledFeatures = derived(store, ($s) => $s.features.filter((f) => f.enabled));

/**
 * Is feature enabled helper
 */
export const isFeatureEnabled = derived(store, ($s) => {
  return (featureId: string): boolean => {
    const feature = $s.features.find((f) => f.id === featureId);
    return feature?.enabled ?? false;
  };
});

/**
 * Current environment
 */
export const environment = derived(store, ($s) => $s.config?.environment ?? 'development');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color for autonomy level
 */
export function getAutonomyColor(level: AutonomyLevel): string {
  switch (level) {
    case 'supervised':
      return 'text-blue-500';
    case 'semi-autonomous':
      return 'text-green-500';
    case 'autonomous':
      return 'text-yellow-500';
    case 'full-autonomous':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get icon for autonomy level
 */
export function getAutonomyIcon(level: AutonomyLevel): ComponentType {
  switch (level) {
    case 'supervised':
      return Lock;
    case 'semi-autonomous':
      return Unlock;
    case 'autonomous':
      return Bot;
    case 'full-autonomous':
      return Zap;
    default:
      return HelpCircle;
  }
}

// ============================================================================
// STORE ACTIONS
// ============================================================================

export const gAgentConfigStore = {
  subscribe: store.subscribe,

  /**
   * Fetch current configuration
   */
  async fetchConfig(sessionId: string = 'default'): Promise<GAgentConfig | null> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/config?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const data = await response.json();
      const config = data.config as GAgentConfig;

      store.update((s) => ({ ...s, config, isLoading: false }));
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch config';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return null;
    }
  },

  /**
   * Fetch feature flags
   */
  async fetchFeatures(): Promise<Feature[]> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi('/api/gagent/config/features');

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const data = await response.json();
      const features = data.features as Feature[];

      store.update((s) => ({ ...s, features, isLoading: false }));
      return features;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch features';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return [];
    }
  },

  /**
   * Fetch available presets
   */
  async fetchPresets(): Promise<ConfigPreset[]> {
    try {
      const response = await fetchApi('/api/gagent/config/presets');

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const presets = data.presets as ConfigPreset[];

      store.update((s) => ({ ...s, presets }));
      return presets;
    } catch {
      return [];
    }
  },

  /**
   * Toggle a feature flag
   */
  async toggleFeature(featureId: string, enabled: boolean): Promise<boolean> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(`/api/gagent/config/feature/${featureId}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to toggle feature: ${response.status}`);
      }

      // Update local state
      store.update((s) => ({
        ...s,
        features: s.features.map((f) => (f.id === featureId ? { ...f, enabled } : f)),
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle feature';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return false;
    }
  },

  /**
   * Set autonomy level
   */
  async setAutonomyLevel(level: AutonomyLevel): Promise<boolean> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi('/api/gagent/config/autonomy', {
        method: 'PUT',
        body: JSON.stringify({ level }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to set autonomy level: ${response.status}`);
      }

      const data = await response.json();

      store.update((s) => ({
        ...s,
        config: s.config ? { ...s.config, autonomyLevel: data.autonomyLevel } : null,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set autonomy level';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return false;
    }
  },

  /**
   * Apply a config preset
   */
  async applyPreset(presetId: string): Promise<boolean> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi('/api/gagent/config/preset', {
        method: 'POST',
        body: JSON.stringify({ preset: presetId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to apply preset: ${response.status}`);
      }

      // Refresh config after applying preset
      await this.fetchConfig();
      await this.fetchFeatures();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply preset';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return false;
    }
  },

  /**
   * Check if a specific feature is enabled
   */
  isEnabled(featureId: string): boolean {
    const { features } = get(store);
    const feature = features.find((f) => f.id === featureId);
    return feature?.enabled ?? false;
  },

  /**
   * Get current autonomy level
   */
  getAutonomyLevel(): AutonomyLevel {
    const { config } = get(store);
    return config?.autonomyLevel ?? 'supervised';
  },

  /**
   * Clear error
   */
  clearError(): void {
    store.update((s) => ({ ...s, error: null }));
  },

  /**
   * Get current state
   */
  getState(): GAgentConfigStoreState {
    return get(store);
  },

  /**
   * Reset store
   */
  reset(): void {
    store.set(initialState);
  },

  /**
   * Initialize - fetch all config data
   */
  async initialize(sessionId: string = 'default'): Promise<void> {
    await Promise.all([this.fetchConfig(sessionId), this.fetchFeatures(), this.fetchPresets()]);
  },
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default gAgentConfigStore;
