/**
 * Ship Store Tests
 * 
 * Comprehensive tests for SHIP mode state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

describe('shipStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have null session', async () => {
      const { shipStore } = await import('./shipStore');
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.session).toBeNull();
    });

    it('should be idle status', async () => {
      const { shipStore } = await import('./shipStore');
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.status).toBe('idle');
    });

    it('should start at design phase', async () => {
      const { shipStore } = await import('./shipStore');
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.phase).toBe('design');
    });

    it('should have no error', async () => {
      const { shipStore } = await import('./shipStore');
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.error).toBeNull();
    });

    it('should not be streaming', async () => {
      const { shipStore } = await import('./shipStore');
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('start', () => {
    it('should start a new SHIP session', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sessionId: 'ship-123',
          phase: 'design',
          status: 'running',
          createdAt: new Date().toISOString()
        }),
      });

      const session = await shipStore.start({
        projectDescription: 'Build a todo app',
        preferences: {}
      });

      expect(session.id).toBe('ship-123');
      expect(session.phase).toBe('design');
      
      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.session?.id).toBe('ship-123');
      expect(state.status).toBe('running');
      shipStore.reset();
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to start' }),
      });

      await expect(shipStore.start({ projectDescription: 'Test' })).rejects.toThrow();

      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.status).toBe('failed');
      expect(state.error).toBe('Failed to start');
      shipStore.reset();
    });
  });

  describe('getSession', () => {
    it('should get session status', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sessionId: 'ship-123',
          phase: 'spec',
          status: 'running',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          designResult: { architecture: {} }
        }),
      });

      const session = await shipStore.getSession('ship-123');

      expect(session.id).toBe('ship-123');
      expect(session.phase).toBe('spec');
      expect(session.designResult).toBeDefined();
      shipStore.reset();
    });

    it('should set error when session not found', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Session not found' }),
      });

      await expect(shipStore.getSession('nonexistent')).rejects.toThrow();

      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.error).toBe('Session not found');
      shipStore.reset();
    });
  });

  describe('execute', () => {
    it('should execute workflow and start polling', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await shipStore.execute('ship-123');

      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.status).toBe('running');
      shipStore.reset();
    });

    it('should set error on execute failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Execute failed' }),
      });

      await expect(shipStore.execute('ship-123')).rejects.toThrow();

      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.status).toBe('failed');
      shipStore.reset();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { shipStore } = await import('./shipStore');

      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sessionId: 'ship-123',
          phase: 'design',
          status: 'running',
          createdAt: new Date().toISOString()
        }),
      });

      await shipStore.start({ projectDescription: 'Test' });
      shipStore.reset();

      let state: any;
      shipStore.subscribe(s => { state = s; })();
      expect(state.session).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.phase).toBe('design');
      expect(state.error).toBeNull();
    });
  });

  describe('shipSession accessor', () => {
    it('should get current state value', async () => {
      const { shipSession, shipStore } = await import('./shipStore');

      const value = shipSession.value;
      expect(value.status).toBe('idle');
      expect(value.session).toBeNull();
    });
  });
});
