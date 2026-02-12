/**
 * Auth Gate Store Tests
 *
 * Tests for authentication gate state management in Electron
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Store module will be imported dynamically to allow localStorage mocking
let authGateStore: typeof import('./authGateStore').authGateStore;
let authSkippedOnDevice: typeof import('./authGateStore').default;

describe('authGateStore', () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.resetModules();

    // Import fresh module after clearing storage
    const module = await import('./authGateStore');
    authGateStore = module.authGateStore;
    authSkippedOnDevice = module.default;
  });

  describe('initial state', () => {
    it('should start with auth not skipped', () => {
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);
    });

    it('derived store should reflect initial state', () => {
      expect(get(authSkippedOnDevice)).toBe(false);
    });

    it('should not have auth skipped key in localStorage initially', () => {
      expect(localStorage.getItem('g-rump-auth-skipped')).toBeNull();
    });
  });

  describe('markAuthSkipped', () => {
    it('should mark auth as skipped', () => {
      authGateStore.markAuthSkipped();

      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);
    });

    it('should persist to localStorage', () => {
      authGateStore.markAuthSkipped();

      expect(localStorage.getItem('g-rump-auth-skipped')).toBe('true');
    });

    it('should update derived store', () => {
      authGateStore.markAuthSkipped();

      expect(get(authSkippedOnDevice)).toBe(true);
    });

    it('should remain skipped after multiple calls', () => {
      authGateStore.markAuthSkipped();
      authGateStore.markAuthSkipped();

      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);
      expect(localStorage.getItem('g-rump-auth-skipped')).toBe('true');
    });
  });

  describe('resetAuthSkipped', () => {
    it('should reset auth skipped state', () => {
      authGateStore.markAuthSkipped();
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);

      authGateStore.resetAuthSkipped();

      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);
    });

    it('should remove from localStorage', () => {
      authGateStore.markAuthSkipped();
      expect(localStorage.getItem('g-rump-auth-skipped')).toBe('true');

      authGateStore.resetAuthSkipped();

      expect(localStorage.getItem('g-rump-auth-skipped')).toBeNull();
    });

    it('should update derived store', () => {
      authGateStore.markAuthSkipped();
      expect(get(authSkippedOnDevice)).toBe(true);

      authGateStore.resetAuthSkipped();

      expect(get(authSkippedOnDevice)).toBe(false);
    });

    it('should remain reset after multiple calls', () => {
      authGateStore.resetAuthSkipped();
      authGateStore.resetAuthSkipped();

      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);
    });
  });

  describe('persistence across imports', () => {
    it('should load skipped state from localStorage on fresh import', async () => {
      // Set localStorage directly
      localStorage.setItem('g-rump-auth-skipped', 'true');

      // Reset modules and re-import
      vi.resetModules();
      const module = await import('./authGateStore');

      expect(module.authGateStore.isAuthSkippedOnDevice()).toBe(true);
      expect(get(module.default)).toBe(true);
    });

    it('should load non-skipped state from localStorage on fresh import', async () => {
      localStorage.setItem('g-rump-auth-skipped', 'false');

      vi.resetModules();
      const module = await import('./authGateStore');

      expect(module.authGateStore.isAuthSkippedOnDevice()).toBe(false);
    });

    it('should handle missing localStorage key on fresh import', async () => {
      // Ensure key is not set
      localStorage.removeItem('g-rump-auth-skipped');

      vi.resetModules();
      const module = await import('./authGateStore');

      expect(module.authGateStore.isAuthSkippedOnDevice()).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should handle skip -> reset -> skip cycle', () => {
      authGateStore.markAuthSkipped();
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);

      authGateStore.resetAuthSkipped();
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);

      authGateStore.markAuthSkipped();
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);
    });

    it('should handle multiple resets after skip', () => {
      authGateStore.markAuthSkipped();
      authGateStore.resetAuthSkipped();
      authGateStore.resetAuthSkipped();
      authGateStore.resetAuthSkipped();

      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);
      expect(localStorage.getItem('g-rump-auth-skipped')).toBeNull();
    });
  });

  describe('localStorage error handling', () => {
    it('should handle getItem errors gracefully', async () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage not available');
      });

      vi.resetModules();
      const module = await import('./authGateStore');

      // Should default to false on error
      expect(module.authGateStore.isAuthSkippedOnDevice()).toBe(false);

      localStorage.getItem = originalGetItem;
    });

    it('should handle setItem errors gracefully', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => authGateStore.markAuthSkipped()).not.toThrow();

      // In-memory state should still update even if persistence fails
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(true);

      localStorage.setItem = originalSetItem;
    });

    it('should handle removeItem errors gracefully', () => {
      authGateStore.markAuthSkipped();

      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('localStorage error');
      });

      // Should not throw
      expect(() => authGateStore.resetAuthSkipped()).not.toThrow();

      // In-memory state should still update
      expect(authGateStore.isAuthSkippedOnDevice()).toBe(false);

      localStorage.removeItem = originalRemoveItem;
    });

    it('should warn when setItem fails', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      authGateStore.markAuthSkipped();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist auth skipped:', expect.any(Error));

      localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });

    it('should warn when removeItem fails', () => {
      authGateStore.markAuthSkipped();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      authGateStore.resetAuthSkipped();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to reset auth skipped:', expect.any(Error));

      localStorage.removeItem = originalRemoveItem;
      consoleSpy.mockRestore();
    });
  });

  describe('derived store subscription', () => {
    it('should notify subscribers when state changes', () => {
      const values: boolean[] = [];
      const unsubscribe = authSkippedOnDevice.subscribe((v) => values.push(v));

      authGateStore.markAuthSkipped();
      authGateStore.resetAuthSkipped();
      authGateStore.markAuthSkipped();

      unsubscribe();

      // Initial + 3 updates
      expect(values).toEqual([false, true, false, true]);
    });

    it('should not notify after unsubscribe', () => {
      const values: boolean[] = [];
      const unsubscribe = authSkippedOnDevice.subscribe((v) => values.push(v));

      unsubscribe();

      authGateStore.markAuthSkipped();

      // Should only have initial value
      expect(values).toEqual([false]);
    });
  });

  describe('server-side rendering', () => {
    it('should handle missing window object gracefully', async () => {
      // Simulate SSR environment
      const originalWindow = global.window;
      // @ts-expect-error - Simulating SSR
      delete global.window;

      vi.resetModules();
      const module = await import('./authGateStore');

      // Should default to false without window
      expect(module.authGateStore.isAuthSkippedOnDevice()).toBe(false);

      // Operations should not throw
      expect(() => module.authGateStore.markAuthSkipped()).not.toThrow();
      expect(() => module.authGateStore.resetAuthSkipped()).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });
  });
});
