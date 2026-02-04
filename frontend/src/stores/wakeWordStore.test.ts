import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { wakeWordEnabled, loadWakeWordEnabled, setWakeWordEnabled } from './wakeWordStore';

describe('wakeWordStore', () => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  beforeEach(() => {
    // Reset store to default
    wakeWordEnabled.set(false);
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('wakeWordEnabled store', () => {
    it('should have initial value of false', () => {
      expect(get(wakeWordEnabled)).toBe(false);
    });

    it('should allow setting to true', () => {
      wakeWordEnabled.set(true);
      expect(get(wakeWordEnabled)).toBe(true);
    });

    it('should allow setting back to false', () => {
      wakeWordEnabled.set(true);
      wakeWordEnabled.set(false);
      expect(get(wakeWordEnabled)).toBe(false);
    });
  });

  describe('loadWakeWordEnabled', () => {
    it('should return false when localStorage has no value', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(loadWakeWordEnabled()).toBe(false);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('g-rump-wake-word-enabled');
    });

    it('should return true when localStorage has "true"', () => {
      localStorageMock.getItem.mockReturnValue('true');
      expect(loadWakeWordEnabled()).toBe(true);
    });

    it('should return false when localStorage has "false"', () => {
      localStorageMock.getItem.mockReturnValue('false');
      expect(loadWakeWordEnabled()).toBe(false);
    });

    it('should return false when localStorage throws an error', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      expect(loadWakeWordEnabled()).toBe(false);
    });

    it('should return false when window is undefined', () => {
      // Simulate server-side rendering
      const originalWindow = globalThis.window;
      // @ts-expect-error - Testing undefined window
      delete globalThis.window;
      expect(loadWakeWordEnabled()).toBe(false);
      globalThis.window = originalWindow;
    });
  });

  describe('setWakeWordEnabled', () => {
    it('should update the store to true', () => {
      setWakeWordEnabled(true);
      expect(get(wakeWordEnabled)).toBe(true);
    });

    it('should update the store to false', () => {
      wakeWordEnabled.set(true);
      setWakeWordEnabled(false);
      expect(get(wakeWordEnabled)).toBe(false);
    });

    it('should persist to localStorage when set to true', () => {
      setWakeWordEnabled(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('g-rump-wake-word-enabled', 'true');
    });

    it('should persist to localStorage when set to false', () => {
      setWakeWordEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('g-rump-wake-word-enabled', 'false');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      // Should not throw
      expect(() => setWakeWordEnabled(true)).not.toThrow();
      // Store should still be updated
      expect(get(wakeWordEnabled)).toBe(true);
    });
  });
});
