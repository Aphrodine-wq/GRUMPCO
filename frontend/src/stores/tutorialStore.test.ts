/**
 * Tutorial Store Tests
 *
 * Comprehensive tests for tutorial state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMocks } from '../test/setup';

type TutorialState = {
  activeTutorial: string | null;
  showQuickStart: boolean;
  completedTutorials: string[];
};

function getState(store: {
  subscribe: (fn: (s: TutorialState) => void) => () => void;
}): TutorialState {
  let state: TutorialState = { activeTutorial: null, showQuickStart: true, completedTutorials: [] };
  store.subscribe((s) => {
    state = s;
  })();
  return state;
}

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

describe('tutorialStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    localStorageMock.clear();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  describe('TUTORIALS config', () => {
    it('should have first-time tutorial', async () => {
      const { TUTORIALS } = await import('./tutorialStore');
      expect(TUTORIALS['first-time']).toBeDefined();
      expect(TUTORIALS['first-time'].steps.length).toBeGreaterThan(0);
    });

    it('should have ship-mode tutorial', async () => {
      const { TUTORIALS } = await import('./tutorialStore');
      expect(TUTORIALS['ship-mode']).toBeDefined();
    });

    it('should have code-mode tutorial', async () => {
      const { TUTORIALS } = await import('./tutorialStore');
      expect(TUTORIALS['code-mode']).toBeDefined();
    });
  });

  describe('QUICK_START_TEMPLATES', () => {
    it('should have todo-app template', async () => {
      const { QUICK_START_TEMPLATES } = await import('./tutorialStore');
      const todoApp = QUICK_START_TEMPLATES.find((t) => t.id === 'todo-app');
      expect(todoApp).toBeDefined();
      expect(todoApp?.mode).toBe('ship');
    });

    it('should have multiple templates', async () => {
      const { QUICK_START_TEMPLATES } = await import('./tutorialStore');
      expect(QUICK_START_TEMPLATES.length).toBeGreaterThan(5);
    });
  });

  describe('initial state', () => {
    it('should have no active tutorial', async () => {
      const { tutorialStore } = await import('./tutorialStore');
      const state = getState(tutorialStore);
      expect(state.activeTutorial).toBeNull();
    });

    it('should show quick start by default', async () => {
      const { tutorialStore } = await import('./tutorialStore');
      const state = getState(tutorialStore);
      expect(state.showQuickStart).toBe(true);
    });

    it('should have no completed tutorials', async () => {
      const { tutorialStore } = await import('./tutorialStore');
      const state = getState(tutorialStore);
      expect(state.completedTutorials).toEqual([]);
    });
  });

  describe('startTutorial', () => {
    it('should set active tutorial', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.startTutorial('first-time');

      const state = getState(tutorialStore);
      expect(state.activeTutorial).toBe('first-time');
    });
  });

  describe('completeTutorial', () => {
    it('should mark tutorial as completed', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.startTutorial('first-time');
      tutorialStore.completeTutorial('first-time');

      const state = getState(tutorialStore);
      expect(state.activeTutorial).toBeNull();
      expect(state.completedTutorials).toContain('first-time');
    });

    it('should not duplicate completed tutorials', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.completeTutorial('first-time');
      tutorialStore.completeTutorial('first-time');

      const state = getState(tutorialStore);
      expect(state.completedTutorials.filter((t: string) => t === 'first-time')).toHaveLength(1);
    });
  });

  describe('skipTutorial', () => {
    it('should clear active tutorial without completing', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.startTutorial('first-time');
      tutorialStore.skipTutorial();

      const state = getState(tutorialStore);
      expect(state.activeTutorial).toBeNull();
      expect(state.completedTutorials).not.toContain('first-time');
    });
  });

  describe('hideQuickStart', () => {
    it('should hide quick start panel', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.hideQuickStart();

      const state = getState(tutorialStore);
      expect(state.showQuickStart).toBe(false);
    });
  });

  describe('showQuickStart', () => {
    it('should show quick start panel', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.hideQuickStart();
      tutorialStore.showQuickStart();

      const state = getState(tutorialStore);
      expect(state.showQuickStart).toBe(true);
    });
  });

  describe('isTutorialCompleted', () => {
    it('should return false for incomplete tutorial', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      expect(tutorialStore.isTutorialCompleted('first-time')).toBe(false);
    });

    it('should return true for completed tutorial', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.completeTutorial('first-time');
      expect(tutorialStore.isTutorialCompleted('first-time')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.startTutorial('first-time');
      tutorialStore.completeTutorial('first-time');
      tutorialStore.hideQuickStart();

      tutorialStore.reset();

      const state = getState(tutorialStore);
      expect(state.activeTutorial).toBeNull();
      expect(state.completedTutorials).toEqual([]);
      expect(state.showQuickStart).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist state to localStorage', async () => {
      const { tutorialStore } = await import('./tutorialStore');

      tutorialStore.completeTutorial('first-time');

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockStorage['g-rump-tutorials'] || '{}');
      expect(saved.completedTutorials).toContain('first-time');
    });
  });
});
