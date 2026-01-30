/**
 * Code Sessions Store Tests
 * 
 * Comprehensive tests for code session persistence state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('codeSessionsStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    localStorageMock.clear();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  describe('initial state', () => {
    it('should start with empty sessions', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');
      expect(codeSessionsStore.list()).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save a new session', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' }
      ];

      const id = codeSessionsStore.save('Test Session', messages, '/workspace');

      expect(id).toBeDefined();
      expect(id).toMatch(/^code-/);
    });

    it('should persist to localStorage', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      codeSessionsStore.save('Session 1', [], '/workspace');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'grump-code-sessions',
        expect.any(String)
      );
    });

    it('should use default name if empty', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      codeSessionsStore.save('', [], '/workspace');

      const sessions = codeSessionsStore.list();
      expect(sessions[0].name).toContain('Session');
    });

    it('should include agent profile', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      codeSessionsStore.save('Session', [], '/workspace', 'frontend-specialist');

      const sessions = codeSessionsStore.list();
      expect(sessions[0].agentProfile).toBe('frontend-specialist');
    });

    it('should limit to 20 sessions', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      // Save 25 sessions
      for (let i = 0; i < 25; i++) {
        codeSessionsStore.save(`Session ${i}`, [], '/workspace');
      }

      const sessions = codeSessionsStore.list();
      expect(sessions.length).toBeLessThanOrEqual(20);
    });

    it('should add new sessions at the beginning', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      codeSessionsStore.save('First', [], '/workspace');
      codeSessionsStore.save('Second', [], '/workspace');

      const sessions = codeSessionsStore.list();
      expect(sessions[0].name).toBe('Second');
      expect(sessions[1].name).toBe('First');
    });
  });

  describe('load', () => {
    it('should load session by ID', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const messages = [{ role: 'user' as const, content: 'Test' }];
      const id = codeSessionsStore.save('My Session', messages, '/workspace');

      const loaded = codeSessionsStore.load(id);

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('My Session');
      expect(loaded?.messages).toHaveLength(1);
    });

    it('should return null for unknown ID', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const loaded = codeSessionsStore.load('unknown-id');

      expect(loaded).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove session by ID', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const id = codeSessionsStore.save('To Remove', [], '/workspace');
      expect(codeSessionsStore.list()).toHaveLength(1);

      codeSessionsStore.remove(id);

      expect(codeSessionsStore.list()).toHaveLength(0);
    });

    it('should not affect other sessions', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const id1 = codeSessionsStore.save('Keep', [], '/workspace');
      const id2 = codeSessionsStore.save('Remove', [], '/workspace');

      codeSessionsStore.remove(id2);

      const sessions = codeSessionsStore.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(id1);
    });
  });

  describe('list', () => {
    it('should return all sessions', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      codeSessionsStore.save('Session 1', [], '/workspace');
      codeSessionsStore.save('Session 2', [], '/workspace');
      codeSessionsStore.save('Session 3', [], '/workspace');

      const sessions = codeSessionsStore.list();
      expect(sessions).toHaveLength(3);
    });
  });

  describe('subscribe', () => {
    it('should notify on changes', async () => {
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const updates: any[] = [];
      const unsubscribe = codeSessionsStore.subscribe(sessions => {
        updates.push([...sessions]);
      });

      codeSessionsStore.save('New Session', [], '/workspace');

      expect(updates.length).toBeGreaterThan(1);
      expect(updates[updates.length - 1]).toHaveLength(1);

      unsubscribe();
    });
  });

  describe('persistence', () => {
    it('should load sessions from localStorage on init', async () => {
      // Pre-populate localStorage
      const existingSession = {
        id: 'code-existing',
        name: 'Existing Session',
        messages: [],
        workspaceRoot: '/old-workspace',
        updatedAt: Date.now()
      };
      mockStorage['grump-code-sessions'] = JSON.stringify([existingSession]);

      // Re-import to pick up localStorage data
      vi.resetModules();
      const { codeSessionsStore } = await import('./codeSessionsStore');

      const sessions = codeSessionsStore.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Existing Session');
    });
  });
});
