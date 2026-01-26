import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api_key_configured: boolean;
    server_responsive: boolean;
  };
  timestamp: string;
}

// Singleton state
const connectionStatus: Ref<ConnectionStatus> = ref('checking');
const lastChecked: Ref<Date | null> = ref(null);

// Polling configuration
const DEFAULT_INTERVAL = 30000; // 30 seconds
const MAX_INTERVAL = 120000; // 2 minutes
const BACKOFF_MULTIPLIER = 2;
const REQUEST_TIMEOUT = 5000; // 5 seconds

let currentInterval = DEFAULT_INTERVAL;
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

// Get the API base URL
function getApiBaseUrl(): string {
  // Try Vite env var first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  // Default to localhost
  return 'http://localhost:3000';
}

async function performHealthCheck(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/health/quick`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return false;
    }
    
    const data: HealthResponse = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    clearTimeout(timeoutId);
    return false;
  }
}

export interface UseConnectionStatusReturn {
  connectionStatus: Ref<ConnectionStatus>;
  lastChecked: Ref<Date | null>;
  checkConnection: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useConnectionStatus(): UseConnectionStatusReturn {
  async function checkConnection(): Promise<void> {
    connectionStatus.value = 'checking';
    
    const isHealthy = await performHealthCheck();
    
    connectionStatus.value = isHealthy ? 'connected' : 'disconnected';
    lastChecked.value = new Date();
    
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
  
  function startPolling(): void {
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
  
  function stopPolling(): void {
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
  
  // Auto-cleanup on component unmount
  onMounted(() => {
    startPolling();
  });
  
  onUnmounted(() => {
    stopPolling();
  });
  
  return {
    connectionStatus,
    lastChecked,
    checkConnection,
    startPolling,
    stopPolling
  };
}
