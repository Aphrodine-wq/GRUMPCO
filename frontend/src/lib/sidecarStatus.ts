/**
 * Sidecar Status Store — reactive health monitoring for the local backend sidecar.
 *
 * In Electron mode, polls the backend health endpoint at a configurable interval
 * and exposes reactive state for UI indicators (connection badge, status bar, etc.).
 *
 * @module lib/sidecarStatus
 */

// Determine if we're running in Electron
function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { grump?: { isElectron?: boolean } };
  return w.grump?.isElectron === true;
}

// ── Reactive state ──────────────────────────────────────────────────────────

let connected = $state(false);
let latencyMs = $state(0);
let backendPid = $state<number | null>(null);
let lastCheck = $state<number>(0);
let checking = $state(false);

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const HEALTH_URL = 'http://localhost:3000/health/live';

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Perform a single health check against the local sidecar.
 */
async function checkHealth(): Promise<void> {
  if (checking) return;
  checking = true;

  const start = performance.now();
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
    connected = res.ok;
    latencyMs = Math.round(performance.now() - start);
  } catch {
    connected = false;
    latencyMs = 0;
  }

  // Also check IPC-level backend status in Electron
  if (isElectron()) {
    try {
      const w = window as unknown as {
        grump?: { backend?: { status: () => Promise<{ ready: boolean; pid: number | null }> } };
      };
      const status = await w.grump?.backend?.status?.();
      if (status) {
        backendPid = status.pid;
        // If IPC says not ready but HTTP succeeded, trust HTTP
        if (!status.ready && connected) {
          /* backend might be starting up — HTTP is more authoritative */
        }
      }
    } catch {
      /* IPC not available */
    }
  }

  lastCheck = Date.now();
  checking = false;
}

/**
 * Start polling (idempotent — calling twice does nothing).
 */
function startPolling(): void {
  if (pollTimer) return;
  checkHealth(); // immediate first check
  pollTimer = setInterval(checkHealth, POLL_INTERVAL_MS);
}

/**
 * Stop polling.
 */
function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Auto-start polling in Electron mode
if (typeof window !== 'undefined' && isElectron()) {
  startPolling();
}

// ── Exports ─────────────────────────────────────────────────────────────────

export const sidecarStatus = {
  get connected() {
    return connected;
  },
  get latencyMs() {
    return latencyMs;
  },
  get backendPid() {
    return backendPid;
  },
  get lastCheck() {
    return lastCheck;
  },
  get checking() {
    return checking;
  },
  checkHealth,
  startPolling,
  stopPolling,
};
