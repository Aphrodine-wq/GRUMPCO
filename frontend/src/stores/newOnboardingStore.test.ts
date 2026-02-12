/**
 * Tests for newOnboardingStore (v2 onboarding)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  newOnboardingStore,
  currentStep,
  currentStepIndex,
  isOnboardingComplete,
  progress,
  STEP_ORDER,
  FRONTEND_OPTIONS,
  BACKEND_LANGUAGE_OPTIONS,
  AI_PROVIDER_OPTIONS,
  type OnboardingStep,
} from './newOnboardingStore';
import { localStorageMock, resetMocks } from '../test/setup';

describe('newOnboardingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    newOnboardingStore.reset();
  });

  describe('initial state', () => {
    it('should start at welcome step', () => {
      expect(get(currentStep)).toBe('welcome');
    });

    it('should have step index 0 initially', () => {
      expect(get(currentStepIndex)).toBe(0);
    });

    it('should not be complete initially', () => {
      expect(get(isOnboardingComplete)).toBe(false);
    });

    it('should have correct initial progress', () => {
      const expectedProgress = (1 / STEP_ORDER.length) * 100;
      expect(get(progress)).toBeCloseTo(expectedProgress, 1);
    });

    it('should have empty tech stack selections', () => {
      const data = newOnboardingStore.get();
      expect(data.frontend).toEqual([]);
      expect(data.backendLanguage).toEqual([]);
      expect(data.backendFramework).toEqual([]);
      expect(data.database).toEqual([]);
      expect(data.cloud).toEqual([]);
      expect(data.infrastructure).toEqual([]);
      expect(data.gitProvider).toEqual([]);
      expect(data.ide).toEqual([]);
      expect(data.mobile).toEqual([]);
      expect(data.styling).toEqual([]);
    });

    it('should have default preferences', () => {
      const data = newOnboardingStore.get();
      expect(data.theme).toBe('system');
      expect(data.telemetryOptIn).toBe(true);
      expect(data.isAuthenticated).toBe(false);
    });
  });

  describe('STEP_ORDER', () => {
    it('should have 12 steps', () => {
      expect(STEP_ORDER.length).toBe(12);
    });

    it('should start with welcome and end with next-steps', () => {
      expect(STEP_ORDER[0]).toBe('welcome');
      expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('next-steps');
    });

    it('should include all expected steps in order', () => {
      const expectedOrder: OnboardingStep[] = [
        'welcome',
        'ship-workflow',
        'agent',
        'auth',
        'api-provider',
        'frontend-stack',
        'backend-stack',
        'infrastructure',
        'tooling',
        'app-preferences',
        'review',
        'next-steps',
      ];
      expect(STEP_ORDER).toEqual(expectedOrder);
    });
  });

  describe('navigation', () => {
    describe('nextStep', () => {
      it('should advance to next step', () => {
        expect(get(currentStep)).toBe('welcome');
        newOnboardingStore.nextStep();
        expect(get(currentStep)).toBe('ship-workflow');
      });

      it('should update step index', () => {
        expect(get(currentStepIndex)).toBe(0);
        newOnboardingStore.nextStep();
        expect(get(currentStepIndex)).toBe(1);
      });

      it('should update progress', () => {
        const initialProgress = get(progress);
        newOnboardingStore.nextStep();
        expect(get(progress)).toBeGreaterThan(initialProgress);
      });

      it('should add current step to completed steps', () => {
        newOnboardingStore.nextStep();
        const data = newOnboardingStore.get();
        expect(data.completedSteps).toContain('welcome');
      });

      it('should not exceed last step', () => {
        // Go to last step
        for (let i = 0; i < STEP_ORDER.length; i++) {
          newOnboardingStore.nextStep();
        }
        expect(get(currentStep)).toBe('next-steps');

        // Try to go beyond
        newOnboardingStore.nextStep();
        expect(get(currentStep)).toBe('next-steps');
      });
    });

    describe('prevStep', () => {
      it('should go back to previous step', () => {
        newOnboardingStore.nextStep();
        expect(get(currentStep)).toBe('ship-workflow');
        newOnboardingStore.prevStep();
        expect(get(currentStep)).toBe('welcome');
      });

      it('should not go before first step', () => {
        expect(get(currentStep)).toBe('welcome');
        newOnboardingStore.prevStep();
        expect(get(currentStep)).toBe('welcome');
      });
    });

    describe('goToStep', () => {
      it('should jump to specific step', () => {
        newOnboardingStore.goToStep('api-provider');
        expect(get(currentStep)).toBe('api-provider');
      });

      it('should work for any valid step', () => {
        STEP_ORDER.forEach((step) => {
          newOnboardingStore.goToStep(step);
          expect(get(currentStep)).toBe(step);
        });
      });
    });
  });

  describe('tech stack selections', () => {
    describe('toggleSelection', () => {
      it('should add selection when not selected', () => {
        newOnboardingStore.toggleSelection('frontend', 'react');
        const data = newOnboardingStore.get();
        expect(data.frontend).toContain('react');
      });

      it('should remove selection when already selected', () => {
        newOnboardingStore.toggleSelection('frontend', 'react');
        newOnboardingStore.toggleSelection('frontend', 'react');
        const data = newOnboardingStore.get();
        expect(data.frontend).not.toContain('react');
      });

      it('should allow multiple selections', () => {
        newOnboardingStore.toggleSelection('frontend', 'react');
        newOnboardingStore.toggleSelection('frontend', 'vue');
        newOnboardingStore.toggleSelection('frontend', 'svelte');
        const data = newOnboardingStore.get();
        expect(data.frontend).toEqual(['react', 'vue', 'svelte']);
      });

      it('should work for all categories', () => {
        const categories = [
          'frontend',
          'backendLanguage',
          'backendFramework',
          'database',
          'cloud',
          'infrastructure',
          'gitProvider',
          'ide',
          'mobile',
          'styling',
        ] as const;

        categories.forEach((category) => {
          newOnboardingStore.toggleSelection(category, 'test-option');
          const data = newOnboardingStore.get();
          expect(data[category]).toContain('test-option');
        });
      });
    });

    describe('setSelections', () => {
      it('should set entire selection array', () => {
        newOnboardingStore.setSelections('frontend', ['react', 'nextjs', 'vue']);
        const data = newOnboardingStore.get();
        expect(data.frontend).toEqual(['react', 'nextjs', 'vue']);
      });

      it('should replace existing selections', () => {
        newOnboardingStore.toggleSelection('frontend', 'angular');
        newOnboardingStore.setSelections('frontend', ['react']);
        const data = newOnboardingStore.get();
        expect(data.frontend).toEqual(['react']);
        expect(data.frontend).not.toContain('angular');
      });
    });
  });

  describe('auth', () => {
    it('should set auth provider', () => {
      newOnboardingStore.setAuthProvider('github');
      const data = newOnboardingStore.get();
      expect(data.authProvider).toBe('github');
    });

    it('should set authenticated state', () => {
      newOnboardingStore.setAuthenticated(true);
      const data = newOnboardingStore.get();
      expect(data.isAuthenticated).toBe(true);
    });
  });

  describe('AI provider', () => {
    it('should set AI provider', () => {
      newOnboardingStore.setAiProvider('anthropic');
      const data = newOnboardingStore.get();
      expect(data.aiProvider).toBe('anthropic');
    });

    it('should set AI provider with API key', () => {
      newOnboardingStore.setAiProvider('openai', 'sk-test-key');
      const data = newOnboardingStore.get();
      expect(data.aiProvider).toBe('openai');
      expect(data.aiProviderApiKey).toBe('sk-test-key');
    });
  });

  describe('preferences', () => {
    describe('theme', () => {
      it('should set theme to light', () => {
        newOnboardingStore.setTheme('light');
        const data = newOnboardingStore.get();
        expect(data.theme).toBe('light');
      });

      it('should set theme to dark', () => {
        newOnboardingStore.setTheme('dark');
        const data = newOnboardingStore.get();
        expect(data.theme).toBe('dark');
      });

      it('should set theme to system', () => {
        newOnboardingStore.setTheme('light');
        newOnboardingStore.setTheme('system');
        const data = newOnboardingStore.get();
        expect(data.theme).toBe('system');
      });
    });

    describe('telemetry', () => {
      it('should set telemetry opt-in', () => {
        newOnboardingStore.setTelemetry(true);
        const data = newOnboardingStore.get();
        expect(data.telemetryOptIn).toBe(true);
      });

      it('should set telemetry opt-out', () => {
        newOnboardingStore.setTelemetry(false);
        const data = newOnboardingStore.get();
        expect(data.telemetryOptIn).toBe(false);
      });
    });
  });

  describe('completion', () => {
    describe('complete', () => {
      it('should mark onboarding as complete', () => {
        newOnboardingStore.complete();
        expect(get(isOnboardingComplete)).toBe(true);
      });

      it('should mark all steps as completed', () => {
        newOnboardingStore.complete();
        const data = newOnboardingStore.get();
        expect(data.completedSteps).toEqual(STEP_ORDER);
      });

      it('should set isComplete flag', () => {
        newOnboardingStore.complete();
        const data = newOnboardingStore.get();
        expect(data.isComplete).toBe(true);
      });
    });

    describe('skip', () => {
      it('should mark onboarding as complete when skipped', () => {
        newOnboardingStore.skip();
        expect(get(isOnboardingComplete)).toBe(true);
      });

      it('should set skipped flag', () => {
        newOnboardingStore.skip();
        const data = newOnboardingStore.get();
        expect(data.skipped).toBe(true);
      });
    });

    describe('isOnboardingSeenOnDevice', () => {
      it('should return false initially', () => {
        expect(newOnboardingStore.isOnboardingSeenOnDevice()).toBe(false);
      });

      it('should return true after complete', () => {
        newOnboardingStore.complete();
        expect(newOnboardingStore.isOnboardingSeenOnDevice()).toBe(true);
      });

      it('should return true after skip', () => {
        newOnboardingStore.skip();
        expect(newOnboardingStore.isOnboardingSeenOnDevice()).toBe(true);
      });
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // Make some changes
      newOnboardingStore.nextStep();
      newOnboardingStore.toggleSelection('frontend', 'react');
      newOnboardingStore.setTheme('dark');
      newOnboardingStore.setAiProvider('openai', 'key');
      newOnboardingStore.complete();

      // Reset
      newOnboardingStore.reset();

      // Verify reset
      expect(get(currentStep)).toBe('welcome');
      expect(get(isOnboardingComplete)).toBe(false);
      const data = newOnboardingStore.get();
      expect(data.frontend).toEqual([]);
      expect(data.theme).toBe('system');
      expect(data.aiProvider).toBeUndefined();
      expect(data.isComplete).toBe(false);
    });

    it('should remove from localStorage', () => {
      newOnboardingStore.complete();
      newOnboardingStore.reset();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('g-rump-onboarding-v2');
    });
  });

  describe('persistence', () => {
    it('should persist to localStorage on changes', () => {
      newOnboardingStore.nextStep();
      expect(localStorageMock.setItem).toHaveBeenCalled();

      const lastCall =
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
      expect(lastCall[0]).toBe('g-rump-onboarding-v2');

      const savedData = JSON.parse(lastCall[1]);
      expect(savedData.currentStep).toBe('ship-workflow');
    });

    it('should persist tech stack selections', () => {
      newOnboardingStore.toggleSelection('frontend', 'react');

      const lastCall =
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[1]);
      expect(savedData.frontend).toContain('react');
    });
  });

  describe('tech options', () => {
    it('should have G-CompN1 marked as popular/recommended', () => {
      const grump = AI_PROVIDER_OPTIONS.find((o) => o.id === 'grump');
      expect(grump).toBeDefined();
      expect(grump?.popular).toBe(true);
    });

    it('should have popular frontend frameworks marked', () => {
      const popularFrontend = FRONTEND_OPTIONS.filter((o) => o.popular);
      expect(popularFrontend.length).toBeGreaterThan(0);
      expect(popularFrontend.map((o) => o.id)).toContain('react');
      expect(popularFrontend.map((o) => o.id)).toContain('svelte');
    });

    it('should have popular backend languages marked', () => {
      const popularBackend = BACKEND_LANGUAGE_OPTIONS.filter((o) => o.popular);
      expect(popularBackend.length).toBeGreaterThan(0);
      expect(popularBackend.map((o) => o.id)).toContain('typescript');
      expect(popularBackend.map((o) => o.id)).toContain('python');
    });
  });
});
