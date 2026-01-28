import { writable } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';
import { fetchApi } from '../lib/api.js';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api_key_configured: boolean;
    server_responsive: boolean;
  };
  timestamp: string;
}

// Polling configuration
const DEFAULT_INTERVAL = 30000; // 30 seconds
const MAX_INTERVAL = 120000; // 2 minutes
const BACKOFF_MULTIPLIER = 2;
const REQUEST_TIMEOUT = 5000; // 5 seconds

async function performHealthCheck(): Promise<boolean> {
  try {
    const response = await fetchApi('/health/quick', {
      method: 'GET',
      timeout: REQUEST_TIMEOUT,
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data: HealthResponse = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

// Create stores
export const connectionStatus = writable<ConnectionStatus>('checking');
export const lastChecked = writable<Date | null>(null);

let currentInterval = DEFAULT_INTERVAL;
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

export async function checkConnection(): Promise<void> {
  connectionStatus.set('checking');
  
  const isHealthy = await performHealthCheck();
  
  connectionStatus.set(isHealthy ? 'connected' : 'disconnected');
  lastChecked.set(new Date());
  
  // Adjust polling interval based on result
  if (isHealthy) {
    currentInterval = DEFAULT_INTERVAL;
  } else {
    currentInterval = Math.min(currentInterval * BACKOFF_MULTIPLIER, MAX_INTERVAL);
  }
}

function scheduleNextCheck(): void {
  if (!isPolling) return;
  
  pollingTimer = setTimeout(async () => {
    await checkConnection();
    scheduleNextCheck();
  }, currentInterval);
}

export function startPolling(): void {
  if (isPolling) return;
  
  isPolling = true;
  currentInterval = DEFAULT_INTERVAL;
  
  // Do an immediate check
  checkConnection().then(() => {
    scheduleNextCheck();
  });
  
  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopPolling(): void {
  isPolling = false;
  
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    // Page became visible - do immediate check and resume polling
    checkConnection().then(() => {
      if (isPolling && !pollingTimer) {
        scheduleNextCheck();
      }
    });
  } else {
    // Page hidden - pause polling to save resources
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
  }
}

// Auto-start polling (can be used in components)
export function useConnectionStatus() {
  onMount(() => {
    startPolling();
  });

  onDestroy(() => {
    stopPolling();
  });
}

export function resetConnectionStatusState(): void {
  connectionStatus.set('checking');
  lastChecked.set(null);
  currentInterval = DEFAULT_INTERVAL;
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  isPolling = false;
}
