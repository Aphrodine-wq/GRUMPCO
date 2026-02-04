/**
 * Unified GPU detection (NVIDIA + AMD) for the Electron app.
 * Detection runs in the main process via IPC; this module exposes typed APIs to the renderer.
 */

export interface GpuInfo {
  name: string;
  memoryTotal: string;
  driverVersion: string;
}

export interface GpuDetectResult {
  vendor: 'nvidia' | 'amd' | 'none';
  gpus: GpuInfo[];
}

// Window.grump is declared in lib/dockerSetup.ts

/**
 * Detect GPU vendor and list GPUs (NVIDIA or AMD). Returns { vendor: 'none', gpus: [] } if not in Electron or no GPU.
 */
export async function detectGpu(): Promise<GpuDetectResult> {
  if (typeof window === 'undefined' || !window.grump?.gpu?.detect) {
    return { vendor: 'none', gpus: [] };
  }
  return window.grump.gpu.detect();
}

/**
 * List all detected GPUs (NVIDIA and/or AMD). Empty array if not in Electron or no GPU.
 */
export async function listGpus(): Promise<GpuInfo[]> {
  if (typeof window === 'undefined' || !window.grump?.gpu?.list) {
    return [];
  }
  return window.grump.gpu.list();
}

/**
 * Check if we are in Electron and have GPU detection available.
 */
export function isGpuDetectionAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.grump?.gpu?.detect);
}
