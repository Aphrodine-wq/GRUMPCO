/**
 * Mermaid to Code Store Tests
 *
 * Comprehensive tests for Mermaid diagram to code conversion state management
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

describe('mermaidToCodeStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    localStorageMock.clear();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  describe('initial state', () => {
    it('should have empty mermaid code', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');
      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('');
    });

    it('should have default framework as react', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');
      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.framework).toBe('react');
    });

    it('should have default language as typescript', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');
      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.language).toBe('typescript');
    });

    it('should be idle status', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');
      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.status).toBe('idle');
    });

    it('should have empty history', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');
      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.history).toEqual([]);
    });
  });

  describe('setMermaidCode', () => {
    it('should update mermaid code', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('graph TD\nA-->B');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('graph TD\nA-->B');
    });

    it('should persist to localStorage', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('graph LR\nA-->B');

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('setFramework', () => {
    it('should update framework', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setFramework('vue');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.framework).toBe('vue');
    });
  });

  describe('setLanguage', () => {
    it('should update language', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setLanguage('javascript');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.language).toBe('javascript');
    });
  });

  describe('startGeneration', () => {
    it('should set status to generating', async () => {
      const { mermaidToCodeStore, isGenerating } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.startGeneration();

      expect(get(isGenerating)).toBe(true);
    });

    it('should clear previous error', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setError('Previous error');
      mermaidToCodeStore.startGeneration();

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.error).toBeUndefined();
    });
  });

  describe('completeGeneration', () => {
    it('should set generated code', async () => {
      const { mermaidToCodeStore, isCompleted } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('graph TD\nA-->B');
      mermaidToCodeStore.startGeneration();
      mermaidToCodeStore.completeGeneration('const component = () => {}');

      expect(get(isCompleted)).toBe(true);

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.generatedCode).toBe('const component = () => {}');
    });

    it('should add to history', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('graph TD\nA-->B');
      mermaidToCodeStore.completeGeneration('code1');

      mermaidToCodeStore.setMermaidCode('graph LR\nC-->D');
      mermaidToCodeStore.completeGeneration('code2');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      const history = state?.history as Array<Record<string, unknown>>;
      expect(history.length).toBe(2);
      expect(history[0].generatedCode).toBe('code2');
    });

    it('should limit history to 50 entries', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      // Generate 55 entries
      for (let i = 0; i < 55; i++) {
        mermaidToCodeStore.setMermaidCode(`graph ${i}`);
        mermaidToCodeStore.completeGeneration(`code${i}`);
      }

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      const history = state?.history as Array<unknown>;
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('setError', () => {
    it('should set error status', async () => {
      const { mermaidToCodeStore, hasError } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setError('Generation failed');

      expect(get(hasError)).toBe(true);
    });

    it('should add error entry to history', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('invalid mermaid');
      mermaidToCodeStore.setError('Parse error');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      const history = state?.history as Array<Record<string, unknown>>;
      expect(history[0].error).toBe('Parse error');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('some code');
      mermaidToCodeStore.setFramework('vue');
      mermaidToCodeStore.completeGeneration('generated');

      mermaidToCodeStore.reset();

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('');
      expect(state?.framework).toBe('react');
      expect(state?.status).toBe('idle');
      expect(state?.history).toEqual([]);
    });
  });

  describe('loadFromHistory', () => {
    it('should load state from history entry', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('original code');
      mermaidToCodeStore.setFramework('vue');
      mermaidToCodeStore.completeGeneration('original generated');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      const history = state?.history as Array<Record<string, unknown>>;
      const historyId = history[0].id;

      // Change state
      mermaidToCodeStore.setMermaidCode('new code');
      mermaidToCodeStore.setFramework('react');

      // Load from history
      mermaidToCodeStore.loadFromHistory(historyId as string);

      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('original code');
      expect(state?.framework).toBe('vue');
      expect(state?.generatedCode).toBe('original generated');
    });

    it('should not change state for unknown history id', async () => {
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      mermaidToCodeStore.setMermaidCode('current code');
      mermaidToCodeStore.loadFromHistory('unknown-id');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('current code');
    });
  });

  describe('derived stores', () => {
    it('isGenerating should reflect status', async () => {
      const { mermaidToCodeStore, isGenerating } = await import('./mermaidToCodeStore');

      expect(get(isGenerating)).toBe(false);
      mermaidToCodeStore.startGeneration();
      expect(get(isGenerating)).toBe(true);
    });

    it('recentHistory should return last 10', async () => {
      const { mermaidToCodeStore, recentHistory } = await import('./mermaidToCodeStore');

      for (let i = 0; i < 15; i++) {
        mermaidToCodeStore.completeGeneration(`code${i}`);
      }

      expect(get(recentHistory).length).toBe(10);
    });
  });

  describe('localStorage persistence', () => {
    it('should load stored state from localStorage', async () => {
      const storedState = {
        mermaidCode: 'graph TD\nStored-->Code',
        framework: 'angular',
        language: 'javascript',
        history: [{ id: 'h1', mermaidCode: 'old', generatedCode: 'oldgen' }],
      };
      mockStorage['mermaid-to-code-state'] = JSON.stringify(storedState);

      vi.resetModules();
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      expect(state?.mermaidCode).toBe('graph TD\nStored-->Code');
      expect(state?.framework).toBe('angular');
      expect(state?.language).toBe('javascript');
      // Status should always be idle on load
      expect(state?.status).toBe('idle');
    });

    it('should handle invalid JSON in localStorage gracefully', async () => {
      mockStorage['mermaid-to-code-state'] = 'not-valid-json{';

      vi.resetModules();
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();

      // Should fall back to defaults
      expect(state?.mermaidCode).toBe('');
      expect(state?.framework).toBe('react');
    });

    it('should handle localStorage.setItem errors gracefully', async () => {
      vi.resetModules();
      const { mermaidToCodeStore } = await import('./mermaidToCodeStore');

      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => mermaidToCodeStore.setMermaidCode('new code')).not.toThrow();

      let state: Record<string, unknown> | undefined;
      mermaidToCodeStore.subscribe((s) => {
        state = s as unknown as Record<string, unknown>;
      })();
      expect(state?.mermaidCode).toBe('new code');

      // Restore
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        mockStorage[key] = value;
      });
    });
  });
});
