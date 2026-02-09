/**
 * Agent Config Store Tests
 *
 * Tests for configuration management, feature flags, and autonomy levels
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock lucide-svelte - SVG parsing fails in jsdom
vi.mock('lucide-svelte', () => {
  const MockIcon = () => null;
  return new Proxy({} as Record<string, unknown>, {
    get: () => MockIcon,
  });
});

// Mock fetch and fetchApi
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
  getApiBase: vi.fn(() => 'http://localhost:3000'),
}));

// Dynamic import in beforeAll to avoid slow repeated imports - mocks are hoisted
let agentConfigStore: typeof import('./agentConfigStore').agentConfigStore;
let autonomyLevel: typeof import('./agentConfigStore').autonomyLevel;
let isAutonomous: typeof import('./agentConfigStore').isAutonomous;
let enabledFeatures: typeof import('./agentConfigStore').enabledFeatures;
let environment: typeof import('./agentConfigStore').environment;
let getAutonomyColor: typeof import('./agentConfigStore').getAutonomyColor;
let getAutonomyIcon: typeof import('./agentConfigStore').getAutonomyIcon;
let AUTONOMY_LEVELS: typeof import('./agentConfigStore').AUTONOMY_LEVELS;
let FEATURE_IDS: typeof import('./agentConfigStore').FEATURE_IDS;
let fetchApi: typeof import('../lib/api.js').fetchApi;

describe('agentConfigStore', () => {
  beforeAll(async () => {
    const storeMod = await import('./agentConfigStore');
    const apiMod = await import('../lib/api.js');
    agentConfigStore = storeMod.agentConfigStore;
    autonomyLevel = storeMod.autonomyLevel;
    isAutonomous = storeMod.isAutonomous;
    enabledFeatures = storeMod.enabledFeatures;
    environment = storeMod.environment;
    getAutonomyColor = storeMod.getAutonomyColor;
    getAutonomyIcon = storeMod.getAutonomyIcon;
    AUTONOMY_LEVELS = storeMod.AUTONOMY_LEVELS;
    FEATURE_IDS = storeMod.FEATURE_IDS;
    fetchApi = apiMod.fetchApi;
  });
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    agentConfigStore.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockConfig = (overrides = {}) => ({
    autonomyLevel: 'supervised' as const,
    environment: 'development' as const,
    features: {
      goal_queue: true,
      agent_lightning: false,
    },
    model: {
      primary: 'claude-3.5-sonnet',
      fallback: 'gpt-4o',
      fast: 'claude-3-haiku',
      embedding: 'text-embedding-3-small',
    },
    ...overrides,
  });

  const createMockFeatures = () => [
    { id: 'goal_queue', name: 'Goal Queue', enabled: true, description: 'Enable goal queue' },
    {
      id: 'agent_lightning',
      name: 'Agent Lightning',
      enabled: false,
      description: 'Multi-agent orchestration',
    },
    { id: 'self_healing', name: 'Self Healing', enabled: true, description: 'Auto-fix errors' },
  ];

  const createMockPresets = () => [
    {
      id: 'conservative',
      name: 'Conservative',
      description: 'Safe mode',
      autonomyLevel: 'supervised' as const,
    },
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'Balanced mode',
      autonomyLevel: 'semi-autonomous' as const,
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      description: 'Full auto',
      autonomyLevel: 'full-autonomous' as const,
    },
  ];

  describe('initial state', () => {
    it('should have null config initially', () => {
      const state = agentConfigStore.getState();
      expect(state.config).toBeNull();
    });

    it('should have empty features initially', () => {
      const state = agentConfigStore.getState();
      expect(state.features).toEqual([]);
    });

    it('should have empty presets initially', () => {
      const state = agentConfigStore.getState();
      expect(state.presets).toEqual([]);
    });

    it('should not be loading initially', () => {
      const state = agentConfigStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = agentConfigStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('derived stores', () => {
    it('autonomyLevel should default to supervised', () => {
      expect(get(autonomyLevel)).toBe('supervised');
    });

    it('isAutonomous should be false when supervised', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ config: createMockConfig({ autonomyLevel: 'supervised' }) }),
      });

      await agentConfigStore.fetchConfig();
      expect(get(isAutonomous)).toBe(false);
    });

    it('isAutonomous should be true when autonomous', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ config: createMockConfig({ autonomyLevel: 'autonomous' }) }),
      });

      await agentConfigStore.fetchConfig();
      expect(get(isAutonomous)).toBe(true);
    });

    it('enabledFeatures should filter enabled features', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: createMockFeatures() }),
      });

      await agentConfigStore.fetchFeatures();
      const enabled = get(enabledFeatures);
      expect(enabled.length).toBe(2);
      expect(enabled.every((f) => f.enabled)).toBe(true);
    });

    it('environment should default to development', () => {
      expect(get(environment)).toBe('development');
    });
  });

  describe('fetchConfig', () => {
    it('should fetch and store config', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockConfig = createMockConfig();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

      const result = await agentConfigStore.fetchConfig('test-session');

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/config?sessionId=test-session');
      expect(result).toEqual(mockConfig);
      expect(agentConfigStore.getState().config).toEqual(mockConfig);
    });

    it('should handle fetch error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await agentConfigStore.fetchConfig();

      expect(result).toBeNull();
      expect(agentConfigStore.getState().error).toBe('Failed to fetch config: 500');
    });

    it('should handle network error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const result = await agentConfigStore.fetchConfig();

      expect(result).toBeNull();
      expect(agentConfigStore.getState().error).toBe('Network error');
    });
  });

  describe('fetchFeatures', () => {
    it('should fetch and store features', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockFeatures = createMockFeatures();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: mockFeatures }),
      });

      const result = await agentConfigStore.fetchFeatures();

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/config/features');
      expect(result).toEqual(mockFeatures);
      expect(agentConfigStore.getState().features).toEqual(mockFeatures);
    });

    it('should return empty array on error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await agentConfigStore.fetchFeatures();

      expect(result).toEqual([]);
    });
  });

  describe('fetchPresets', () => {
    it('should fetch and store presets', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPresets = createMockPresets();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presets: mockPresets }),
      });

      const result = await agentConfigStore.fetchPresets();

      expect(result).toEqual(mockPresets);
      expect(agentConfigStore.getState().presets).toEqual(mockPresets);
    });

    it('should return empty array on error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await agentConfigStore.fetchPresets();

      expect(result).toEqual([]);
    });
  });

  describe('toggleFeature', () => {
    it('should toggle feature and update local state', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // First fetch features
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: createMockFeatures() }),
      });
      await agentConfigStore.fetchFeatures();

      // Then toggle
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await agentConfigStore.toggleFeature('agent_lightning', true);

      expect(result).toBe(true);
      expect(mockFetchApi).toHaveBeenLastCalledWith('/api/gagent/config/feature/agent_lightning', {
        method: 'PUT',
        body: JSON.stringify({ enabled: true }),
      });

      const feature = agentConfigStore.getState().features.find((f) => f.id === 'agent_lightning');
      expect(feature?.enabled).toBe(true);
    });

    it('should handle toggle error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Feature not found' }),
      });

      const result = await agentConfigStore.toggleFeature('invalid_feature', true);

      expect(result).toBe(false);
      expect(agentConfigStore.getState().error).toBe('Feature not found');
    });
  });

  describe('setAutonomyLevel', () => {
    it('should set autonomy level', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // First set up config
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: createMockConfig() }),
      });
      await agentConfigStore.fetchConfig();

      // Then set autonomy level
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ autonomyLevel: 'autonomous' }),
      });

      const result = await agentConfigStore.setAutonomyLevel('autonomous');

      expect(result).toBe(true);
      expect(get(autonomyLevel)).toBe('autonomous');
    });

    it('should handle set autonomy error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Not authorized' }),
      });

      const result = await agentConfigStore.setAutonomyLevel('full-autonomous');

      expect(result).toBe(false);
      expect(agentConfigStore.getState().error).toBe('Not authorized');
    });
  });

  describe('applyPreset', () => {
    it('should apply preset and refresh config', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Apply preset
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      // Refresh config
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: createMockConfig({ autonomyLevel: 'autonomous' }) }),
      });
      // Refresh features
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: createMockFeatures() }),
      });

      const result = await agentConfigStore.applyPreset('aggressive');

      expect(result).toBe(true);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/config/preset', {
        method: 'POST',
        body: JSON.stringify({ preset: 'aggressive' }),
      });
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled feature', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: createMockFeatures() }),
      });
      await agentConfigStore.fetchFeatures();

      expect(agentConfigStore.isEnabled('goal_queue')).toBe(true);
    });

    it('should return false for disabled feature', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: createMockFeatures() }),
      });
      await agentConfigStore.fetchFeatures();

      expect(agentConfigStore.isEnabled('agent_lightning')).toBe(false);
    });

    it('should return false for unknown feature', () => {
      expect(agentConfigStore.isEnabled('unknown_feature')).toBe(false);
    });
  });

  describe('getAutonomyLevel', () => {
    it('should return current autonomy level', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ config: createMockConfig({ autonomyLevel: 'semi-autonomous' }) }),
      });
      await agentConfigStore.fetchConfig();

      expect(agentConfigStore.getAutonomyLevel()).toBe('semi-autonomous');
    });

    it('should return supervised when no config', () => {
      expect(agentConfigStore.getAutonomyLevel()).toBe('supervised');
    });
  });

  describe('helper functions', () => {
    it('getAutonomyColor should return correct colors', () => {
      expect(getAutonomyColor('supervised')).toBe('text-blue-500');
      expect(getAutonomyColor('semi-autonomous')).toBe('text-green-500');
      expect(getAutonomyColor('autonomous')).toBe('text-yellow-500');
      expect(getAutonomyColor('full-autonomous')).toBe('text-red-500');
    });

    it('getAutonomyIcon should return correct icons', () => {
      // Stores return ComponentType (Svelte components), not emoji strings
      expect(typeof getAutonomyIcon('supervised')).toBe('function');
      expect(getAutonomyIcon('supervised')).toBeDefined();
      expect(typeof getAutonomyIcon('semi-autonomous')).toBe('function');
      expect(typeof getAutonomyIcon('autonomous')).toBe('function');
      expect(typeof getAutonomyIcon('full-autonomous')).toBe('function');
    });
  });

  describe('clearError', () => {
    it('should clear error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Cause an error
      mockFetchApi.mockResolvedValue({ ok: false, status: 500 });
      await agentConfigStore.fetchConfig();
      expect(agentConfigStore.getState().error).not.toBeNull();

      // Clear error
      agentConfigStore.clearError();
      expect(agentConfigStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Populate state
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ config: createMockConfig() }),
      });
      await agentConfigStore.fetchConfig();

      // Reset
      agentConfigStore.reset();

      const state = agentConfigStore.getState();
      expect(state.config).toBeNull();
      expect(state.features).toEqual([]);
      expect(state.presets).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should fetch all config data in parallel', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ config: createMockConfig() }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ features: createMockFeatures() }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ presets: createMockPresets() }),
        });

      await agentConfigStore.initialize('test-session');

      expect(mockFetchApi).toHaveBeenCalledTimes(3);
      expect(agentConfigStore.getState().config).not.toBeNull();
      expect(agentConfigStore.getState().features.length).toBe(3);
      expect(agentConfigStore.getState().presets.length).toBe(3);
    });
  });

  describe('AUTONOMY_LEVELS constant', () => {
    it('should export correct autonomy levels', () => {
      expect(AUTONOMY_LEVELS).toHaveLength(4);
      expect(AUTONOMY_LEVELS.map((l) => l.value)).toEqual([
        'supervised',
        'semi-autonomous',
        'autonomous',
        'full-autonomous',
      ]);
    });
  });

  describe('FEATURE_IDS constant', () => {
    it('should export feature IDs', () => {
      expect(FEATURE_IDS.GOAL_QUEUE).toBe('goal_queue');
      expect(FEATURE_IDS.AGENT_LIGHTNING).toBe('agent_lightning');
      expect(FEATURE_IDS.SELF_HEALING).toBe('self_healing');
    });
  });
});
