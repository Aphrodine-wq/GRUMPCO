/**
 * Chat Mode Store Tests
 *
 * Comprehensive tests for chat mode state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

let chatModeStore: typeof import('./chatModeStore').chatModeStore;

describe('chatModeStore', () => {
  beforeEach(async () => {
    resetMocks();
    localStorage.clear();
    vi.resetModules();

    const module = await import('./chatModeStore');
    chatModeStore = module.chatModeStore;
  });

  describe('initial state', () => {
    it('should default to design mode', () => {
      expect(get(chatModeStore)).toBe('design');
    });

    it('should load stored mode from localStorage', async () => {
      localStorage.setItem('grump-chat-mode', 'code');

      vi.resetModules();
      const module = await import('./chatModeStore');

      expect(get(module.chatModeStore)).toBe('code');
    });

    it('should default to design for invalid stored value', async () => {
      localStorage.setItem('grump-chat-mode', 'invalid');

      vi.resetModules();
      const module = await import('./chatModeStore');

      expect(get(module.chatModeStore)).toBe('design');
    });
  });

  describe('setMode', () => {
    it('should set design mode', () => {
      chatModeStore.setMode('design');
      expect(get(chatModeStore)).toBe('design');
    });

    it('should set code mode', () => {
      chatModeStore.setMode('code');
      expect(get(chatModeStore)).toBe('code');
    });

    it('should set argument mode', () => {
      chatModeStore.setMode('argument');
      expect(get(chatModeStore)).toBe('argument');
    });

    it('should persist to localStorage', () => {
      chatModeStore.setMode('code');

      expect(localStorage.getItem('grump-chat-mode')).toBe('code');
    });

    it('should update subscribers', () => {
      const values: string[] = [];
      const unsubscribe = chatModeStore.subscribe((v) => values.push(v));

      chatModeStore.setMode('code');
      chatModeStore.setMode('argument');
      chatModeStore.setMode('design');

      unsubscribe();

      // Initial + 3 updates
      expect(values).toEqual(['design', 'code', 'argument', 'design']);
    });
  });

  describe('mode switching', () => {
    it('should allow switching between all modes', () => {
      chatModeStore.setMode('design');
      expect(get(chatModeStore)).toBe('design');

      chatModeStore.setMode('code');
      expect(get(chatModeStore)).toBe('code');

      chatModeStore.setMode('argument');
      expect(get(chatModeStore)).toBe('argument');

      chatModeStore.setMode('design');
      expect(get(chatModeStore)).toBe('design');
    });
  });

  describe('localStorage error handling', () => {
    it('should default to design when localStorage.getItem throws', async () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage not available');
      });

      vi.resetModules();
      const module = await import('./chatModeStore');

      expect(get(module.chatModeStore)).toBe('design');

      localStorage.getItem = originalGetItem;
    });

    it('should silently ignore localStorage.setItem errors', async () => {
      vi.resetModules();
      const module = await import('./chatModeStore');

      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => module.chatModeStore.setMode('code')).not.toThrow();
      expect(get(module.chatModeStore)).toBe('code');

      localStorage.setItem = originalSetItem;
    });
  });
});
