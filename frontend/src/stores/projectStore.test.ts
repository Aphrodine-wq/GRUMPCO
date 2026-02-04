/**
 * Project Store Tests
 *
 * Comprehensive tests for project identity management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// We need to re-import after resetting
let currentProjectId: typeof import('./projectStore').currentProjectId;
let setCurrentProjectId: typeof import('./projectStore').setCurrentProjectId;
let getCurrentProjectId: typeof import('./projectStore').getCurrentProjectId;

describe('projectStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./projectStore');
    currentProjectId = module.currentProjectId;
    setCurrentProjectId = module.setCurrentProjectId;
    getCurrentProjectId = module.getCurrentProjectId;
    // Reset to null
    currentProjectId.set(null);
  });

  describe('currentProjectId store', () => {
    it('should default to null', () => {
      expect(get(currentProjectId)).toBeNull();
    });

    it('should allow setting project ID', () => {
      currentProjectId.set('project-123');
      expect(get(currentProjectId)).toBe('project-123');
    });

    it('should allow setting back to null', () => {
      currentProjectId.set('project-123');
      currentProjectId.set(null);
      expect(get(currentProjectId)).toBeNull();
    });
  });

  describe('setCurrentProjectId', () => {
    it('should set the project ID', () => {
      setCurrentProjectId('my-project');
      expect(get(currentProjectId)).toBe('my-project');
    });

    it('should clear the project ID when null', () => {
      setCurrentProjectId('my-project');
      setCurrentProjectId(null);
      expect(get(currentProjectId)).toBeNull();
    });

    it('should handle UUID-style project IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      setCurrentProjectId(uuid);
      expect(get(currentProjectId)).toBe(uuid);
    });
  });

  describe('getCurrentProjectId', () => {
    it('should return null when no project set', () => {
      expect(getCurrentProjectId()).toBeNull();
    });

    it('should return current project ID', () => {
      setCurrentProjectId('test-project');
      expect(getCurrentProjectId()).toBe('test-project');
    });

    it('should return updated value after change', () => {
      setCurrentProjectId('first');
      setCurrentProjectId('second');
      expect(getCurrentProjectId()).toBe('second');
    });

    it('should be synchronous', () => {
      setCurrentProjectId('sync-test');
      const result = getCurrentProjectId();
      expect(result).toBe('sync-test');
    });
  });

  describe('reactivity', () => {
    it('should notify subscribers on change', () => {
      const values: (string | null)[] = [];
      const unsubscribe = currentProjectId.subscribe((v) => values.push(v));

      setCurrentProjectId('project-1');
      setCurrentProjectId('project-2');
      setCurrentProjectId(null);

      unsubscribe();

      // Initial null + 3 updates
      expect(values).toEqual([null, 'project-1', 'project-2', null]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as project ID', () => {
      currentProjectId.set('');
      expect(get(currentProjectId)).toBe('');
    });

    it('should handle special characters in project ID', () => {
      const specialId = 'project/with:special@chars#123';
      setCurrentProjectId(specialId);
      expect(getCurrentProjectId()).toBe(specialId);
    });
  });
});
