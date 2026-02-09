/**
 * Preferences Store Tests
 *
 * Comprehensive tests for user preferences state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

// Mock authStore
vi.mock('./authStore.js', () => ({
  session: {
    subscribe: vi.fn((cb: (value: null) => void) => {
      cb(null); // Default to logged out
      return () => { };
    }),
  },
}));

describe('preferencesStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    localStorageMock.clear();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  describe('initial state', () => {
    it('should have default diagram style', async () => {
      const { diagramStyle } = await import('./preferencesStore');
      expect(get(diagramStyle)).toBe('detailed');
    });

    it('should have default tech stack', async () => {
      const { primaryTechStack } = await import('./preferencesStore');
      expect(get(primaryTechStack)).toEqual(['React', 'Node.js', 'PostgreSQL']);
    });

    it('should have analytics opt-in by default', async () => {
      const { analyticsOptIn } = await import('./preferencesStore');
      expect(get(analyticsOptIn)).toBe(true);
    });

    it('should not be setup complete by default', async () => {
      const { setupComplete } = await import('./preferencesStore');
      expect(get(setupComplete)).toBe(false);
    });
  });

  describe('preferencesStore.update', () => {
    it('should update preferences', async () => {
      const { preferencesStore, diagramStyle } = await import('./preferencesStore');

      preferencesStore.update({ diagramStyle: 'minimal' });

      expect(get(diagramStyle)).toBe('minimal');
    });

    it('should merge with existing preferences', async () => {
      const { preferencesStore, analyticsOptIn, diagramStyle } = await import('./preferencesStore');

      preferencesStore.update({ analyticsOptIn: false });
      preferencesStore.update({ diagramStyle: 'minimal' });

      expect(get(analyticsOptIn)).toBe(false);
      expect(get(diagramStyle)).toBe('minimal');
    });
  });

  describe('setDiagramStyle', () => {
    it('should update diagram style', async () => {
      const { preferencesStore, diagramStyle } = await import('./preferencesStore');

      preferencesStore.setDiagramStyle('comprehensive');

      expect(get(diagramStyle)).toBe('comprehensive');
    });
  });

  describe('setTechStack', () => {
    it('should update tech stack', async () => {
      const { preferencesStore, primaryTechStack } = await import('./preferencesStore');

      preferencesStore.setTechStack(['Vue', 'Python', 'MongoDB']);

      expect(get(primaryTechStack)).toEqual(['Vue', 'Python', 'MongoDB']);
    });
  });

  describe('setAnalyticsOptIn', () => {
    it('should update analytics opt-in', async () => {
      const { preferencesStore, analyticsOptIn } = await import('./preferencesStore');

      preferencesStore.setAnalyticsOptIn(false);

      expect(get(analyticsOptIn)).toBe(false);
    });
  });

  describe('setApiKey', () => {
    it('should update API key', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setApiKey('sk-test-key');

      const current = preferencesStore.getCurrent();
      expect(current.apiKey).toBe('sk-test-key');
    });
  });

  describe('completeSetup', () => {
    it('should mark setup as complete', async () => {
      const { preferencesStore, setupComplete } = await import('./preferencesStore');

      preferencesStore.completeSetup();

      expect(get(setupComplete)).toBe(true);
    });
  });

  describe('isSetupComplete', () => {
    it('should return false initially', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      expect(preferencesStore.isSetupComplete()).toBe(false);
    });

    it('should return true after completing setup', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.completeSetup();

      expect(preferencesStore.isSetupComplete()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to default values', async () => {
      const { preferencesStore, diagramStyle, primaryTechStack, analyticsOptIn } =
        await import('./preferencesStore');

      preferencesStore.setDiagramStyle('minimal');
      preferencesStore.setTechStack(['Vue']);
      preferencesStore.setAnalyticsOptIn(false);

      preferencesStore.reset();

      expect(get(diagramStyle)).toBe('detailed');
      expect(get(primaryTechStack)).toEqual(['React', 'Node.js', 'PostgreSQL']);
      expect(get(analyticsOptIn)).toBe(true);
    });
  });

  describe('getCurrent', () => {
    it('should return current preferences', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setDiagramStyle('minimal');

      const current = preferencesStore.getCurrent();
      expect(current.diagramStyle).toBe('minimal');
    });
  });

  describe('localStorage persistence', () => {
    it('should persist to localStorage on change', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setDiagramStyle('comprehensive');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'g-rump-preferences',
        expect.any(String)
      );
    });

    it('should load from localStorage on init', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        diagramStyle: 'comprehensive',
        setupComplete: true,
      });

      vi.resetModules();
      const { diagramStyle, setupComplete } = await import('./preferencesStore');

      expect(get(diagramStyle)).toBe('comprehensive');
      expect(get(setupComplete)).toBe(true);
    });

    it('should merge with defaults for missing properties', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        diagramStyle: 'minimal',
      });

      vi.resetModules();
      const { diagramStyle, primaryTechStack } = await import('./preferencesStore');

      expect(get(diagramStyle)).toBe('minimal');
      expect(get(primaryTechStack)).toEqual(['React', 'Node.js', 'PostgreSQL']);
    });
  });

  describe('store.store', () => {
    it('should expose writable store', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      expect(preferencesStore.store).toBeDefined();
      expect(typeof preferencesStore.store.subscribe).toBe('function');
    });
  });

  describe('setDensity', () => {
    it('should update density to compact', async () => {
      const { preferencesStore, density } = await import('./preferencesStore');

      preferencesStore.setDensity('compact');

      expect(get(density)).toBe('compact');
    });

    it('should update density to comfortable', async () => {
      const { preferencesStore, density } = await import('./preferencesStore');

      preferencesStore.setDensity('comfortable');

      expect(get(density)).toBe('comfortable');
    });
  });

  describe('setIncludeRagContext', () => {
    it('should enable RAG context', async () => {
      const { preferencesStore, includeRagContext } = await import('./preferencesStore');

      preferencesStore.setIncludeRagContext(true);

      expect(get(includeRagContext)).toBe(true);
    });

    it('should disable RAG context', async () => {
      const { preferencesStore, includeRagContext } = await import('./preferencesStore');

      preferencesStore.setIncludeRagContext(true);
      preferencesStore.setIncludeRagContext(false);

      expect(get(includeRagContext)).toBe(false);
    });
  });

  describe('Agent capability methods', () => {
    it('setGAgentCapabilities should set capabilities', async () => {
      const { preferencesStore, gAgentCapabilities } = await import('./preferencesStore');

      preferencesStore.setGAgentCapabilities(['file', 'git', 'bash']);

      expect(get(gAgentCapabilities)).toEqual(['file', 'git', 'bash']);
    });

    it('toggleGAgentCapability should add capability when not present', async () => {
      const { preferencesStore, gAgentCapabilities } = await import('./preferencesStore');

      preferencesStore.setGAgentCapabilities(['file', 'git']);
      preferencesStore.toggleGAgentCapability('bash');

      expect(get(gAgentCapabilities)).toContain('bash');
    });

    it('toggleGAgentCapability should remove capability when present', async () => {
      const { preferencesStore, gAgentCapabilities } = await import('./preferencesStore');

      preferencesStore.setGAgentCapabilities(['file', 'git', 'bash']);
      preferencesStore.toggleGAgentCapability('bash');

      expect(get(gAgentCapabilities)).not.toContain('bash');
    });
  });

  describe('Agent allowlist methods', () => {
    it('setGAgentExternalAllowlist should set allowlist', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist(['api.example.com', 'api.test.com']);

      expect(get(gAgentExternalAllowlist)).toEqual(['api.example.com', 'api.test.com']);
    });

    it('addGAgentAllowlistDomain should add domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist([]);
      preferencesStore.addGAgentAllowlistDomain('api.example.com');

      expect(get(gAgentExternalAllowlist)).toContain('api.example.com');
    });

    it('addGAgentAllowlistDomain should trim and lowercase domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist([]);
      preferencesStore.addGAgentAllowlistDomain('  API.EXAMPLE.COM  ');

      expect(get(gAgentExternalAllowlist)).toContain('api.example.com');
    });

    it('addGAgentAllowlistDomain should not add empty domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist([]);
      preferencesStore.addGAgentAllowlistDomain('   ');

      expect(get(gAgentExternalAllowlist)).toEqual([]);
    });

    it('addGAgentAllowlistDomain should not add duplicate domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist(['api.example.com']);
      preferencesStore.addGAgentAllowlistDomain('api.example.com');

      expect(get(gAgentExternalAllowlist)).toEqual(['api.example.com']);
    });

    it('removeGAgentAllowlistDomain should remove domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist(['api.example.com', 'api.test.com']);
      preferencesStore.removeGAgentAllowlistDomain('api.example.com');

      expect(get(gAgentExternalAllowlist)).not.toContain('api.example.com');
      expect(get(gAgentExternalAllowlist)).toContain('api.test.com');
    });
  });

  describe('Agent model source methods', () => {
    it('setGAgentPreferredModelSource should set cloud source', async () => {
      const { preferencesStore, gAgentPreferredModelSource } = await import('./preferencesStore');

      preferencesStore.setGAgentPreferredModelSource('cloud');

      expect(get(gAgentPreferredModelSource)).toBe('cloud');
    });

    it('setGAgentPreferredModelSource should set ollama source with model preference', async () => {
      const { preferencesStore, gAgentPreferredModelSource } = await import('./preferencesStore');

      preferencesStore.setGAgentPreferredModelSource('ollama');

      expect(get(gAgentPreferredModelSource)).toBe('ollama');
      const current = preferencesStore.getCurrent();
      expect(current.gAgentModelPreference?.source).toBe('ollama');
    });

    it('setGAgentPreferredModelSource should set auto source', async () => {
      const { preferencesStore, gAgentPreferredModelSource } = await import('./preferencesStore');

      preferencesStore.setGAgentPreferredModelSource('auto');

      expect(get(gAgentPreferredModelSource)).toBe('auto');
    });

    it('setGAgentOllamaModel should set model', async () => {
      const { preferencesStore, gAgentOllamaModel } = await import('./preferencesStore');

      preferencesStore.setGAgentOllamaModel('llama2');

      expect(get(gAgentOllamaModel)).toBe('llama2');
    });

    it('setGAgentOllamaModel should update model preference when source is ollama', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setGAgentPreferredModelSource('ollama');
      preferencesStore.setGAgentOllamaModel('codellama');

      const current = preferencesStore.getCurrent();
      expect(current.gAgentModelPreference?.modelId).toBe('codellama');
    });
  });

  describe('Agent persona and goals', () => {
    it('setGAgentPersona should set persona', async () => {
      const { preferencesStore, gAgentPersona } = await import('./preferencesStore');

      const persona = { tone: 'professional', style: 'concise', expertise: ['backend', 'devops'] };
      preferencesStore.setGAgentPersona(persona);

      expect(get(gAgentPersona)).toEqual(persona);
    });

    it('setGAgentGoals should set goals', async () => {
      const { preferencesStore, gAgentGoals } = await import('./preferencesStore');

      const goals = ['Build API', 'Deploy to cloud'];
      preferencesStore.setGAgentGoals(goals);

      expect(get(gAgentGoals)).toEqual(goals);
    });

    it('setGAgentAutoApprove should enable auto approve', async () => {
      const { preferencesStore, gAgentAutoApprove } = await import('./preferencesStore');

      preferencesStore.setGAgentAutoApprove(true);

      expect(get(gAgentAutoApprove)).toBe(true);
    });

    it('setGAgentPersistent should enable persistent mode', async () => {
      const { preferencesStore, gAgentPersistent } = await import('./preferencesStore');

      preferencesStore.setGAgentPersistent(true);

      expect(get(gAgentPersistent)).toBe(true);
    });
  });

  describe('Agent methods (formerly deprecated Free Agent methods)', () => {
    it('setGAgentCapabilities should update capabilities', async () => {
      const { preferencesStore, gAgentCapabilities } = await import('./preferencesStore');

      preferencesStore.setGAgentCapabilities(['file', 'git']);

      expect(get(gAgentCapabilities)).toEqual(['file', 'git']);
    });

    it('setGAgentExternalAllowlist should update allowlist', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist(['example.com']);

      expect(get(gAgentExternalAllowlist)).toEqual(['example.com']);
    });

    it('toggleGAgentCapability should toggle capability', async () => {
      const { preferencesStore, gAgentCapabilities } = await import('./preferencesStore');

      preferencesStore.setGAgentCapabilities(['file']);
      preferencesStore.toggleGAgentCapability('git');

      expect(get(gAgentCapabilities)).toContain('git');
    });

    it('addGAgentAllowlistDomain should add domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist([]);
      preferencesStore.addGAgentAllowlistDomain('api.test.com');

      expect(get(gAgentExternalAllowlist)).toContain('api.test.com');
    });

    it('removeGAgentAllowlistDomain should remove domain', async () => {
      const { preferencesStore, gAgentExternalAllowlist } = await import('./preferencesStore');

      preferencesStore.setGAgentExternalAllowlist(['api.test.com']);
      preferencesStore.removeGAgentAllowlistDomain('api.test.com');

      expect(get(gAgentExternalAllowlist)).not.toContain('api.test.com');
    });

    it('setGAgentPreferredModelSource should update source', async () => {
      const { preferencesStore, gAgentPreferredModelSource } = await import('./preferencesStore');

      preferencesStore.setGAgentPreferredModelSource('ollama');

      expect(get(gAgentPreferredModelSource)).toBe('ollama');
    });

    it('setGAgentOllamaModel should update model', async () => {
      const { preferencesStore, gAgentOllamaModel } = await import('./preferencesStore');

      preferencesStore.setGAgentOllamaModel('mistral');

      expect(get(gAgentOllamaModel)).toBe('mistral');
    });

    it('setGAgentPersona should update persona', async () => {
      const { preferencesStore, gAgentPersona } = await import('./preferencesStore');

      preferencesStore.setGAgentPersona({ tone: 'casual' });

      expect(get(gAgentPersona)).toEqual({ tone: 'casual' });
    });

    it('setGAgentGoals should update goals', async () => {
      const { preferencesStore, gAgentGoals } = await import('./preferencesStore');

      preferencesStore.setGAgentGoals(['goal1', 'goal2']);

      expect(get(gAgentGoals)).toEqual(['goal1', 'goal2']);
    });
  });

  describe('derived stores with fallbacks', () => {
    it('density should default to comfortable', async () => {
      const { density } = await import('./preferencesStore');

      expect(get(density)).toBe('comfortable');
    });

    it('includeRagContext should default to false', async () => {
      const { includeRagContext } = await import('./preferencesStore');

      expect(get(includeRagContext)).toBe(false);
    });

    it('gAgentCapabilities should return defaults when not set', async () => {
      // The derived store checks gAgentCapabilities, then defaults
      const { gAgentCapabilities } = await import('./preferencesStore');

      const current = get(gAgentCapabilities);
      expect(Array.isArray(current)).toBe(true);
      expect(current.length).toBeGreaterThan(0);
    });

    it('gAgentExternalAllowlist should default to empty array', async () => {
      // The default preferences set gAgentExternalAllowlist to empty array
      const { gAgentExternalAllowlist } = await import('./preferencesStore');

      // Verify it returns an array (empty by default)
      expect(get(gAgentExternalAllowlist)).toEqual([]);
    });

    it('gAgentPreferredModelSource should load from storage', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        gAgentPreferredModelSource: 'ollama',
      });

      vi.resetModules();
      const { gAgentPreferredModelSource } = await import('./preferencesStore');

      expect(get(gAgentPreferredModelSource)).toBe('ollama');
    });

    it('gAgentOllamaModel should load from storage', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        gAgentOllamaModel: 'mistral',
      });

      vi.resetModules();
      const { gAgentOllamaModel } = await import('./preferencesStore');

      expect(get(gAgentOllamaModel)).toBe('mistral');
    });

    it('gAgentPersona should load from storage', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        gAgentPersona: { tone: 'friendly' },
      });

      vi.resetModules();
      const { gAgentPersona } = await import('./preferencesStore');

      expect(get(gAgentPersona)).toEqual({ tone: 'friendly' });
    });

    it('gAgentGoals should load from storage', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        gAgentGoals: ['goal-1'],
      });

      vi.resetModules();
      const { gAgentGoals } = await import('./preferencesStore');

      expect(get(gAgentGoals)).toEqual(['goal-1']);
    });

    it('gAgentAutoApprove should default to false', async () => {
      const { gAgentAutoApprove } = await import('./preferencesStore');

      expect(get(gAgentAutoApprove)).toBe(false);
    });

    it('gAgentPersistent should default to false', async () => {
      const { gAgentPersistent } = await import('./preferencesStore');

      expect(get(gAgentPersistent)).toBe(false);
    });
  });

  describe('syncPreferences', () => {
    it('should call sync function', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      // sync is exposed on the store
      expect(typeof preferencesStore.sync).toBe('function');

      // Calling sync when not logged in should not throw
      await expect(preferencesStore.sync()).resolves.toBeUndefined();
    });
  });
});
