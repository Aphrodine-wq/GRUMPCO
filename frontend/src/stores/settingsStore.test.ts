/**
 * Tests for settingsStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { settingsStore } from './settingsStore';
import type { Settings } from '../types/settings';

// Mock the api module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from '../lib/api.js';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.set(null);
  });

  describe('initial state', () => {
    it('should start with null settings', () => {
      expect(get(settingsStore)).toBeNull();
      expect(settingsStore.getCurrent()).toBeNull();
    });
  });

  describe('load', () => {
    it('should load settings from API', async () => {
      const mockSettings: Settings = {
        user: { displayName: 'Test User', email: 'test@test.com' },
        models: { defaultProvider: 'nim', defaultModelId: 'claude-sonnet' },
      };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ settings: mockSettings }),
      });

      const result = await settingsStore.load();

      expect(result).toEqual(mockSettings);
      expect(get(settingsStore)).toEqual(mockSettings);
      expect(settingsStore.getCurrent()).toEqual(mockSettings);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/settings');
    });

    it('should set null and return null on API error', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await settingsStore.load();

      expect(result).toBeNull();
      expect(get(settingsStore)).toBeNull();
    });

    it('should set null and return null on network error', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const result = await settingsStore.load();

      expect(result).toBeNull();
      expect(get(settingsStore)).toBeNull();
    });

    it('should handle empty settings response', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await settingsStore.load();

      expect(result).toEqual({});
      expect(get(settingsStore)).toEqual({});
    });
  });

  describe('save', () => {
    it('should save partial settings to API', async () => {
      const partialSettings: Partial<Settings> = {
        user: { displayName: 'Updated Name' },
      };

      const mockResponse: Settings = {
        user: { displayName: 'Updated Name', email: 'test@test.com' },
        models: { defaultProvider: 'nim' },
      };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ settings: mockResponse }),
      });

      const result = await settingsStore.save(partialSettings);

      expect(result).toBe(true);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(partialSettings),
      });
      expect(get(settingsStore)).toEqual(mockResponse);
    });

    it('should return false on API error', async () => {
      const partialSettings: Partial<Settings> = {
        user: { displayName: 'Test' },
      };

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await settingsStore.save(partialSettings);

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const partialSettings: Partial<Settings> = {
        user: { displayName: 'Test' },
      };

      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const result = await settingsStore.save(partialSettings);

      expect(result).toBe(false);
    });
  });

  describe('set', () => {
    it('should set settings directly', () => {
      const mockSettings: Settings = {
        user: { displayName: 'Direct Set', email: 'direct@test.com' },
      };

      settingsStore.set(mockSettings);

      expect(get(settingsStore)).toEqual(mockSettings);
      expect(settingsStore.getCurrent()).toEqual(mockSettings);
    });

    it('should set null settings', () => {
      settingsStore.set({ user: { displayName: 'Test' } });
      settingsStore.set(null);

      expect(get(settingsStore)).toBeNull();
      expect(settingsStore.getCurrent()).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('should allow subscription to store changes', () => {
      const mockSettings: Settings = { user: { displayName: 'Subscriber' } };
      const subscriber = vi.fn();

      const unsubscribe = settingsStore.subscribe(subscriber);

      settingsStore.set(mockSettings);

      expect(subscriber).toHaveBeenCalledWith(mockSettings);

      unsubscribe();
    });
  });
});
