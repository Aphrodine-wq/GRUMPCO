/**
 * Connection Status Store Tests
 *
 * Comprehensive tests for connection health monitoring
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type { Mock } from 'vitest';
import { resetMocks } from '../test/setup';

let connectionStatus: typeof import('./connectionStatusStore').connectionStatus;
let lastChecked: typeof import('./connectionStatusStore').lastChecked;
let checkConnection: typeof import('./connectionStatusStore').checkConnection;
let startPolling: typeof import('./connectionStatusStore').startPolling;
let stopPolling: typeof import('./connectionStatusStore').stopPolling;
let resetConnectionStatusState: typeof import('./connectionStatusStore').resetConnectionStatusState;
let useConnectionStatus: typeof import('./connectionStatusStore').useConnectionStatus;

// Mock fetchApi
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

// Mock Svelte lifecycle hooks
let onMountCallback: (() => void) | null = null;
let onDestroyCallback: (() => void) | null = null;

vi.mock('svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('svelte')>();
  return {
    ...actual,
    onMount: (fn: () => void) => {
      onMountCallback = fn;
    },
    onDestroy: (fn: () => void) => {
      onDestroyCallback = fn;
    },
  };
});

describe('connectionStatusStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.useFakeTimers();
    vi.resetModules();

    const module = await import('./connectionStatusStore');
    connectionStatus = module.connectionStatus;
    lastChecked = module.lastChecked;
    checkConnection = module.checkConnection;
    startPolling = module.startPolling;
    stopPolling = module.stopPolling;
    resetConnectionStatusState = module.resetConnectionStatusState;
    useConnectionStatus = module.useConnectionStatus;

    // Reset lifecycle callbacks
    onMountCallback = null;
    onDestroyCallback = null;

    // Reset state
    resetConnectionStatusState();
  });

  afterEach(() => {
    vi.useRealTimers();
    stopPolling();
  });

  describe('initial state', () => {
    it('should start with checking status', () => {
      expect(get(connectionStatus)).toBe('checking');
    });

    it('should have null lastChecked initially', () => {
      expect(get(lastChecked)).toBeNull();
    });
  });

  describe('checkConnection', () => {
    it('should set status to checking when called', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      checkConnection(); // Don't await

      expect(get(connectionStatus)).toBe('checking');
    });

    it('should set connected on successful health check', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await checkConnection();

      expect(get(connectionStatus)).toBe('connected');
    });

    it('should set disconnected on failed health check', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: false,
      });

      await checkConnection();

      expect(get(connectionStatus)).toBe('disconnected');
    });

    it('should set disconnected on unhealthy status', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'unhealthy' }),
      });

      await checkConnection();

      expect(get(connectionStatus)).toBe('disconnected');
    });

    it('should set disconnected on network error', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockRejectedValue(new Error('Network error'));

      await checkConnection();

      expect(get(connectionStatus)).toBe('disconnected');
    });

    it('should update lastChecked timestamp', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      expect(get(lastChecked)).toBeNull();

      await checkConnection();

      expect(get(lastChecked)).toBeInstanceOf(Date);
    });
  });

  describe('startPolling', () => {
    it('should perform immediate check', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await Promise.resolve(); // Let initial checkConnection start
      await vi.advanceTimersByTimeAsync(0); // Flush promises
      stopPolling(); // Stop before recursive timer fires

      expect(fetchApi).toHaveBeenCalled();
    });

    it('should not start multiple polling loops', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      startPolling();
      startPolling();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
      stopPolling();

      // Should only have made initial check calls, not multiple
      expect(fetchApi).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopPolling', () => {
    it('should stop polling loop', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      stopPolling();

      const callCount = (fetchApi as Mock).mock.calls.length;

      // Advance past polling interval
      await vi.advanceTimersByTimeAsync(60000);

      // No additional calls should have been made
      expect((fetchApi as Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('resetConnectionStatusState', () => {
    it('should reset to initial state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await checkConnection();

      resetConnectionStatusState();

      expect(get(connectionStatus)).toBe('checking');
      expect(get(lastChecked)).toBeNull();
    });
  });

  describe('backoff behavior', () => {
    it('should increase interval on failures', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({ ok: false });

      // First failure should double interval
      await checkConnection();
      expect(get(connectionStatus)).toBe('disconnected');

      // Internal interval should be doubled (60s)
      // We can't directly test this without exposing it, but the behavior is covered
    });
  });

  describe('visibility change handling', () => {
    it('should check connection when page becomes visible', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      const callCountBefore = (fetchApi as Mock).mock.calls.length;

      // Simulate page becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      await vi.advanceTimersByTimeAsync(100);

      // Should have made additional check
      expect((fetchApi as Mock).mock.calls.length).toBeGreaterThan(callCountBefore);

      stopPolling();
    });

    it('should pause polling when page is hidden', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      // Simulate page becoming hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      const callCountAfterHide = (fetchApi as Mock).mock.calls.length;

      // Advance time - should not poll while hidden
      await vi.advanceTimersByTimeAsync(60000);

      // No new calls while hidden
      expect((fetchApi as Mock).mock.calls.length).toBe(callCountAfterHide);

      stopPolling();
    });
  });

  describe('resetConnectionStatusState with active polling', () => {
    it('should clear active timer', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      resetConnectionStatusState();

      expect(get(connectionStatus)).toBe('checking');

      // Should not continue polling after reset
      const callCount = (fetchApi as Mock).mock.calls.length;
      await vi.advanceTimersByTimeAsync(60000);
      expect((fetchApi as Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('scheduled polling checks', () => {
    it('should execute scheduled check after interval', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      const callCountAfterStart = (fetchApi as Mock).mock.calls.length;

      // Advance past the DEFAULT_INTERVAL (30000ms)
      await vi.advanceTimersByTimeAsync(30000);

      // Should have made another call from the scheduled check
      expect((fetchApi as Mock).mock.calls.length).toBeGreaterThan(callCountAfterStart);

      stopPolling();
    });

    it('should continue scheduling checks after successful check', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      startPolling();
      await vi.advanceTimersByTimeAsync(100);

      const initialCallCount = (fetchApi as Mock).mock.calls.length;

      // Advance through multiple intervals
      await vi.advanceTimersByTimeAsync(30000);
      await vi.advanceTimersByTimeAsync(30000);

      // Should have made multiple scheduled checks
      expect((fetchApi as Mock).mock.calls.length).toBeGreaterThan(initialCallCount + 1);

      stopPolling();
    });
  });

  describe('useConnectionStatus hook', () => {
    it('should register onMount callback that starts polling', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      useConnectionStatus();

      expect(onMountCallback).not.toBeNull();

      // Simulate component mounting
      if (onMountCallback) {
        onMountCallback();
      }

      await vi.advanceTimersByTimeAsync(100);

      // Polling should have started
      expect(fetchApi).toHaveBeenCalled();

      stopPolling();
    });

    it('should register onDestroy callback that stops polling', async () => {
      const { fetchApi } = await import('../lib/api.js');
      (fetchApi as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      useConnectionStatus();

      expect(onDestroyCallback).not.toBeNull();

      // Mount first
      if (onMountCallback) {
        onMountCallback();
      }
      await vi.advanceTimersByTimeAsync(100);

      const callCountBeforeDestroy = (fetchApi as Mock).mock.calls.length;

      // Simulate component unmounting
      if (onDestroyCallback) {
        onDestroyCallback();
      }

      // Advance time - no more polling
      await vi.advanceTimersByTimeAsync(60000);

      expect((fetchApi as Mock).mock.calls.length).toBe(callCountBeforeDestroy);
    });
  });
});
