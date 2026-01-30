/**
 * Workspace Store Tests
 * 
 * Comprehensive tests for workspace state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// We need to re-import after mocking
let workspaceStore: typeof import('./workspaceStore').workspaceStore;

describe('workspaceStore', () => {
  beforeEach(async () => {
    resetMocks();
    // Clear localStorage
    localStorage.clear();
    // Re-import to get fresh store
    vi.resetModules();
    const module = await import('./workspaceStore');
    workspaceStore = module.workspaceStore;
  });

  describe('initial state', () => {
    it('should default to null root when no stored value', () => {
      const state = get(workspaceStore);
      expect(state.root).toBeNull();
    });

    it('should default to null repoUrl when no stored value', () => {
      const state = get(workspaceStore);
      expect(state.repoUrl).toBeNull();
    });

    it('should default isRemote to false', () => {
      const state = get(workspaceStore);
      expect(state.isRemote).toBe(false);
    });
  });

  describe('setWorkspace', () => {
    it('should set local workspace root', () => {
      workspaceStore.setWorkspace('/path/to/project', null);
      
      const state = get(workspaceStore);
      expect(state.root).toBe('/path/to/project');
      expect(state.repoUrl).toBeNull();
      expect(state.isRemote).toBe(false);
    });

    it('should set remote workspace with repo URL', () => {
      workspaceStore.setWorkspace('/cloned/repo', 'https://github.com/user/repo');
      
      const state = get(workspaceStore);
      expect(state.root).toBe('/cloned/repo');
      expect(state.repoUrl).toBe('https://github.com/user/repo');
      expect(state.isRemote).toBe(true);
    });

    it('should persist to localStorage', () => {
      workspaceStore.setWorkspace('/my/project', null);
      
      expect(localStorage.getItem('grump-workspace-root')).toBe('/my/project');
    });

    it('should persist repo URL to localStorage', () => {
      workspaceStore.setWorkspace('/repo', 'https://github.com/test/repo');
      
      expect(localStorage.getItem('grump-workspace-repo-url')).toBe('https://github.com/test/repo');
    });

    it('should allow updating workspace', () => {
      workspaceStore.setWorkspace('/first', null);
      workspaceStore.setWorkspace('/second', null);
      
      const state = get(workspaceStore);
      expect(state.root).toBe('/second');
    });

    it('should handle null root', () => {
      workspaceStore.setWorkspace('/project', null);
      workspaceStore.setWorkspace(null, null);
      
      const state = get(workspaceStore);
      expect(state.root).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear workspace state', () => {
      workspaceStore.setWorkspace('/project', 'https://github.com/user/repo');
      workspaceStore.clear();
      
      const state = get(workspaceStore);
      expect(state.root).toBeNull();
      expect(state.repoUrl).toBeNull();
      expect(state.isRemote).toBe(false);
    });

    it('should remove from localStorage', () => {
      workspaceStore.setWorkspace('/project', 'https://github.com/user/repo');
      workspaceStore.clear();
      
      expect(localStorage.getItem('grump-workspace-root')).toBeNull();
      expect(localStorage.getItem('grump-workspace-repo-url')).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('should load stored workspace on initialization', async () => {
      localStorage.setItem('grump-workspace-root', '/stored/path');
      localStorage.setItem('grump-workspace-repo-url', 'https://github.com/stored/repo');
      
      vi.resetModules();
      const module = await import('./workspaceStore');
      const state = get(module.workspaceStore);
      
      expect(state.root).toBe('/stored/path');
      expect(state.repoUrl).toBe('https://github.com/stored/repo');
      expect(state.isRemote).toBe(true);
    });

    it('should handle empty stored values', async () => {
      localStorage.setItem('grump-workspace-root', '  ');
      
      vi.resetModules();
      const module = await import('./workspaceStore');
      const state = get(module.workspaceStore);
      
      expect(state.root).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in paths', () => {
      workspaceStore.setWorkspace('/path/with spaces/and-dashes', null);
      
      const state = get(workspaceStore);
      expect(state.root).toBe('/path/with spaces/and-dashes');
    });

    it('should handle Windows-style paths', () => {
      workspaceStore.setWorkspace('C:\\Users\\test\\project', null);
      
      const state = get(workspaceStore);
      expect(state.root).toBe('C:\\Users\\test\\project');
    });

    it('should handle SSH git URLs', () => {
      workspaceStore.setWorkspace('/local', 'git@github.com:user/repo.git');
      
      const state = get(workspaceStore);
      expect(state.repoUrl).toBe('git@github.com:user/repo.git');
      expect(state.isRemote).toBe(true);
    });
  });
});
