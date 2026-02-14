/**
 * Connection Store Tests
 *
 * Comprehensive tests for connection state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { connectionStore } from './connectionStore';

describe('connectionStore', () => {
  beforeEach(() => {
    connectionStore.reset();
  });

  describe('initial state', () => {
    it('should have zero latency initially', () => {
      expect(get(connectionStore).latency).toBe(0);
    });

    it('should have empty provider initially', () => {
      expect(get(connectionStore).provider).toBe('');
    });

    it('should have empty model initially', () => {
      expect(get(connectionStore).model).toBe('');
    });

    it('should not be offline initially', () => {
      expect(get(connectionStore).isOffline).toBe(false);
    });

    it('should have null lastConnected initially', () => {
      expect(get(connectionStore).lastConnected).toBeNull();
    });
  });

  describe('updateConnection', () => {
    it('should update latency', () => {
      connectionStore.updateConnection({ latency: 150 });
      expect(get(connectionStore).latency).toBe(150);
    });

    it('should update provider', () => {
      connectionStore.updateConnection({ provider: 'openai' });
      expect(get(connectionStore).provider).toBe('openai');
    });

    it('should update model', () => {
      connectionStore.updateConnection({ model: 'gpt-4' });
      expect(get(connectionStore).model).toBe('gpt-4');
    });

    it('should update isOffline', () => {
      connectionStore.updateConnection({ isOffline: true });
      expect(get(connectionStore).isOffline).toBe(true);
    });

    it('should update lastConnected', () => {
      const timestamp = Date.now();
      connectionStore.updateConnection({ lastConnected: timestamp });
      expect(get(connectionStore).lastConnected).toBe(timestamp);
    });

    it('should update multiple fields at once', () => {
      connectionStore.updateConnection({
        latency: 100,
        provider: 'anthropic',
        model: 'claude-3',
      });
      const state = get(connectionStore);
      expect(state.latency).toBe(100);
      expect(state.provider).toBe('anthropic');
      expect(state.model).toBe('claude-3');
    });

    it('should preserve other fields when updating', () => {
      connectionStore.updateConnection({ provider: 'mistral' });
      connectionStore.updateConnection({ latency: 50 });

      const state = get(connectionStore);
      expect(state.provider).toBe('mistral');
      expect(state.latency).toBe(50);
    });
  });

  describe('setProviderModel', () => {
    it('should set provider and model together', () => {
      connectionStore.setProviderModel('nvidia', 'nemotron-ultra');

      const state = get(connectionStore);
      expect(state.provider).toBe('nvidia');
      expect(state.model).toBe('nemotron-ultra');
    });

    it('should preserve other state when setting provider/model', () => {
      connectionStore.updateConnection({ latency: 200, isOffline: false });
      connectionStore.setProviderModel('openrouter', 'mixtral');

      const state = get(connectionStore);
      expect(state.latency).toBe(200);
      expect(state.provider).toBe('openrouter');
      expect(state.model).toBe('mixtral');
    });
  });

  describe('updateLatency', () => {
    it('should update latency value', () => {
      connectionStore.updateLatency(75);
      expect(get(connectionStore).latency).toBe(75);
    });

    it('should set isOffline to false for normal latency', () => {
      connectionStore.updateLatency(100);
      expect(get(connectionStore).isOffline).toBe(false);
    });

    it('should set isOffline to false for high but acceptable latency', () => {
      connectionStore.updateLatency(4999);
      expect(get(connectionStore).isOffline).toBe(false);
    });

    it('should set isOffline to true for latency over 5000ms', () => {
      connectionStore.updateLatency(5001);
      expect(get(connectionStore).isOffline).toBe(true);
    });

    it('should set isOffline to true for exactly 5001ms latency', () => {
      connectionStore.updateLatency(5001);
      expect(get(connectionStore).isOffline).toBe(true);
    });

    it('should set isOffline to false for exactly 5000ms latency', () => {
      connectionStore.updateLatency(5000);
      expect(get(connectionStore).isOffline).toBe(false);
    });

    it('should update offline status when latency changes', () => {
      connectionStore.updateLatency(6000);
      expect(get(connectionStore).isOffline).toBe(true);

      connectionStore.updateLatency(100);
      expect(get(connectionStore).isOffline).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      connectionStore.updateConnection({
        latency: 500,
        provider: 'test-provider',
        model: 'test-model',
        isOffline: true,
        lastConnected: Date.now(),
      });

      connectionStore.reset();

      const state = get(connectionStore);
      expect(state.latency).toBe(0);
      expect(state.provider).toBe('');
      expect(state.model).toBe('');
      expect(state.isOffline).toBe(false);
      expect(state.lastConnected).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on update', () => {
      let notified = false;
      const unsubscribe = connectionStore.subscribe(() => {
        notified = true;
      });

      connectionStore.updateLatency(100);
      expect(notified).toBe(true);

      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      let count = 0;
      const unsubscribe = connectionStore.subscribe(() => {
        count++;
      });

      // Initial call
      expect(count).toBe(1);

      connectionStore.updateLatency(50);
      expect(count).toBe(2);

      unsubscribe();

      connectionStore.updateLatency(100);
      expect(count).toBe(2); // Should not increase after unsubscribe
    });
  });
});
