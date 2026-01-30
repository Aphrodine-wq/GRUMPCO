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
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

// Mock authStore
vi.mock('./authStore.js', () => ({
  session: {
    subscribe: vi.fn((cb: any) => {
      cb(null); // Default to logged out
      return () => {};
    }),
  },
}));

describe('preferencesStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    localStorageMock.clear();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
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

    it('should have default theme', async () => {
      const { theme } = await import('./preferencesStore');
      expect(get(theme)).toBe('auto');
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
      const { preferencesStore, theme } = await import('./preferencesStore');

      preferencesStore.update({ theme: 'dark' });

      expect(get(theme)).toBe('dark');
    });

    it('should merge with existing preferences', async () => {
      const { preferencesStore, theme, diagramStyle } = await import('./preferencesStore');

      preferencesStore.update({ theme: 'light' });
      preferencesStore.update({ diagramStyle: 'minimal' });

      expect(get(theme)).toBe('light');
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

  describe('setTheme', () => {
    it('should update theme', async () => {
      const { preferencesStore, theme } = await import('./preferencesStore');

      preferencesStore.setTheme('dark');

      expect(get(theme)).toBe('dark');
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
      const { preferencesStore, theme, diagramStyle, primaryTechStack } = await import('./preferencesStore');

      preferencesStore.setTheme('dark');
      preferencesStore.setDiagramStyle('minimal');
      preferencesStore.setTechStack(['Vue']);

      preferencesStore.reset();

      expect(get(theme)).toBe('auto');
      expect(get(diagramStyle)).toBe('detailed');
      expect(get(primaryTechStack)).toEqual(['React', 'Node.js', 'PostgreSQL']);
    });
  });

  describe('getCurrent', () => {
    it('should return current preferences', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setTheme('dark');

      const current = preferencesStore.getCurrent();
      expect(current.theme).toBe('dark');
      expect(current.diagramStyle).toBe('detailed');
    });
  });

  describe('localStorage persistence', () => {
    it('should persist to localStorage on change', async () => {
      const { preferencesStore } = await import('./preferencesStore');

      preferencesStore.setTheme('light');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'g-rump-preferences',
        expect.any(String)
      );
    });

    it('should load from localStorage on init', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        theme: 'dark',
        diagramStyle: 'comprehensive',
        setupComplete: true
      });

      vi.resetModules();
      const { theme, diagramStyle, setupComplete } = await import('./preferencesStore');

      expect(get(theme)).toBe('dark');
      expect(get(diagramStyle)).toBe('comprehensive');
      expect(get(setupComplete)).toBe(true);
    });

    it('should merge with defaults for missing properties', async () => {
      mockStorage['g-rump-preferences'] = JSON.stringify({
        theme: 'dark'
      });

      vi.resetModules();
      const { theme, primaryTechStack } = await import('./preferencesStore');

      expect(get(theme)).toBe('dark');
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
});
