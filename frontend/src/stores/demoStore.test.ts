/**
 * Demo Store Tests
 *
 * Comprehensive tests for demo mode state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMocks } from '../test/setup';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as typeof fetch;

// Mock the API module
vi.mock('../lib/api.js', () => ({
  getApiBase: vi.fn(() => 'http://localhost:3000'),
}));

// Mock workspaceStore
vi.mock('./workspaceStore.js', () => ({
  workspaceStore: {
    setWorkspace: vi.fn(),
  },
}));

describe('demoStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should not be active initially', async () => {
      const { demoStore } = await import('./demoStore');
      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state.active).toBe(false);
    });

    it('should have null workspace path', async () => {
      const { demoStore } = await import('./demoStore');
      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state.workspacePath).toBeNull();
    });

    it('should have empty steps', async () => {
      const { demoStore } = await import('./demoStore');
      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state.steps).toEqual([]);
    });
  });

  describe('setActive', () => {
    it('should set active state', async () => {
      const { demoStore } = await import('./demoStore');

      demoStore.setActive(true, '/demo/workspace', [
        { target: '.chat', title: 'Welcome', content: 'Start here' },
      ]);

      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      expect(state.active).toBe(true);
      expect(state.workspacePath).toBe('/demo/workspace');
      expect(state.steps).toHaveLength(1);
    });

    it('should deactivate demo', async () => {
      const { demoStore } = await import('./demoStore');

      demoStore.setActive(true, '/demo', []);
      demoStore.setActive(false);

      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      expect(state.active).toBe(false);
    });
  });

  describe('startDemo', () => {
    it('should start demo successfully', async () => {
      const { demoStore } = await import('./demoStore');
      const { workspaceStore } = await import('./workspaceStore.js');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            workspacePath: '/demo/project',
            steps: [{ target: '.input', title: 'Step 1', content: 'Do this' }],
          }),
      });

      const result = await demoStore.startDemo();

      expect(result.ok).toBe(true);
      expect(workspaceStore.setWorkspace).toHaveBeenCalledWith('/demo/project', null);

      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      expect(state.active).toBe(true);
      expect(state.workspacePath).toBe('/demo/project');
    });

    it('should handle API error', async () => {
      const { demoStore } = await import('./demoStore');

      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Demo unavailable' }),
      });

      const result = await demoStore.startDemo();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Demo unavailable');
    });

    it('should handle network error', async () => {
      const { demoStore } = await import('./demoStore');

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await demoStore.startDemo();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error throws', async () => {
      const { demoStore } = await import('./demoStore');

      mockFetch.mockRejectedValue('Unknown failure');

      const result = await demoStore.startDemo();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Failed to start demo');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const { demoStore } = await import('./demoStore');

      demoStore.setActive(true, '/demo', [{ target: '.x', title: 'T', content: 'C' }]);
      demoStore.reset();

      let state: Record<string, unknown> = {};
      demoStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      expect(state.active).toBe(false);
      expect(state.workspacePath).toBeNull();
      expect(state.steps).toEqual([]);
    });
  });

  describe('state getter', () => {
    it('should return current state', async () => {
      const { demoStore } = await import('./demoStore');

      demoStore.setActive(true, '/test', []);

      const state = demoStore.state;
      expect(state.active).toBe(true);
      expect(state.workspacePath).toBe('/test');
    });
  });
});
