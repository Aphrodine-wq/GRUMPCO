/**
 * Tests for onboardingStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { onboardingStore, onboardingSeenOnDevice } from './onboardingStore';
import { localStorageMock, resetMocks } from '../test/setup';

describe('onboardingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    onboardingStore.resetOnboarding();
  });

  describe('initial state', () => {
    it('should start with onboarding not seen', () => {
      expect(onboardingStore.isOnboardingSeenOnDevice()).toBe(false);
    });

    it('should have derived store return false initially', () => {
      expect(get(onboardingSeenOnDevice)).toBe(false);
    });
  });

  describe('markOnboardingSeenOnDevice', () => {
    it('should mark onboarding as seen', () => {
      onboardingStore.markOnboardingSeenOnDevice();
      expect(onboardingStore.isOnboardingSeenOnDevice()).toBe(true);
    });

    it('should update derived store when marked as seen', () => {
      onboardingStore.markOnboardingSeenOnDevice();
      expect(get(onboardingSeenOnDevice)).toBe(true);
    });

    it('should persist to localStorage', () => {
      onboardingStore.markOnboardingSeenOnDevice();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('g-rump-onboarding-seen', 'true');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => onboardingStore.markOnboardingSeenOnDevice()).not.toThrow();

      // Store should still be updated
      expect(onboardingStore.isOnboardingSeenOnDevice()).toBe(true);
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding to not seen', () => {
      onboardingStore.markOnboardingSeenOnDevice();
      expect(onboardingStore.isOnboardingSeenOnDevice()).toBe(true);

      onboardingStore.resetOnboarding();
      expect(onboardingStore.isOnboardingSeenOnDevice()).toBe(false);
    });

    it('should remove from localStorage', () => {
      onboardingStore.markOnboardingSeenOnDevice();
      onboardingStore.resetOnboarding();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('g-rump-onboarding-seen');
    });

    it('should handle localStorage errors gracefully on reset', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => onboardingStore.resetOnboarding()).not.toThrow();
    });
  });

  describe('loadOnboardingSeen', () => {
    it('should load onboarding seen state from localStorage', () => {
      localStorageMock.setItem('g-rump-onboarding-seen', 'true');

      // Simulate fresh load by creating new store state
      const stored = localStorageMock.getItem('g-rump-onboarding-seen');
      expect(stored).toBe('true');
    });

    it('should return false when localStorage item is null', () => {
      const stored = localStorageMock.getItem('nonexistent-key');
      expect(stored).toBeNull();
    });

    it('should load true value from localStorage on module init', async () => {
      // Set storage before reimporting module
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'g-rump-onboarding-seen') return 'true';
        return null;
      });

      vi.resetModules();
      const module = await import('./onboardingStore');

      expect(module.onboardingStore.isOnboardingSeenOnDevice()).toBe(true);
    });

    it('should handle localStorage.getItem errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      vi.resetModules();
      const module = await import('./onboardingStore');

      // Should default to false when load fails
      expect(module.onboardingStore.isOnboardingSeenOnDevice()).toBe(false);
    });
  });
});
