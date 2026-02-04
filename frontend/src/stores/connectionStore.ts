/**
 * Connection Store
 * Manages connection state including latency, provider, and model info
 */

import { writable } from 'svelte/store';

export interface ConnectionState {
  latency: number;
  provider: string;
  model: string;
  isOffline: boolean;
  lastConnected: number | null;
}

const initialState: ConnectionState = {
  latency: 0,
  provider: '',
  model: '',
  isOffline: false,
  lastConnected: null,
};

function createConnectionStore() {
  const { subscribe, set, update } = writable<ConnectionState>(initialState);

  return {
    subscribe,

    // Update connection metrics
    updateConnection(partial: Partial<ConnectionState>) {
      update((state) => ({ ...state, ...partial }));
    },

    // Set current provider and model
    setProviderModel(provider: string, model: string) {
      update((state) => ({ ...state, provider, model }));
    },

    // Update just the latency
    updateLatency(latency: number) {
      update((state) => ({
        ...state,
        latency,
        isOffline: latency > 5000,
      }));
    },

    // Reset to initial state
    reset() {
      set(initialState);
    },
  };
}

export const connectionStore = createConnectionStore();
