/**
 * Docker setup logic for the Electron app.
 * Uses IPC (grump.docker, grump.gpu) when in Electron; otherwise returns fallback values.
 */

export interface DockerVersionResult {
  installed: boolean;
  version?: string;
  error?: string;
}

export interface DockerInfoResult {
  running: boolean;
  raw?: string;
  error?: string;
}

export interface NvidiaToolkitResult {
  installed: boolean;
  version?: string;
  error?: string;
}

export interface GpuInfo {
  name: string;
  memoryTotal: string;
  driverVersion: string;
}

export interface GpuDetectResult {
  vendor: 'nvidia' | 'amd' | 'none';
  gpus: GpuInfo[];
  error?: string;
}

declare global {
  interface Window {
    grump?: {
      isElectron?: boolean;
      docker?: {
        getVersion: () => Promise<DockerVersionResult>;
        getInfo: () => Promise<DockerInfoResult>;
        getNvidiaToolkitVersion: () => Promise<NvidiaToolkitResult>;
      };
      gpu?: {
        detect: () => Promise<GpuDetectResult>;
        list: () => Promise<GpuInfo[]>;
      };
      auth?: {
        openGoogleSignIn?: () => Promise<void>;
        notifyComplete?: () => void;
        onComplete?: (callback: () => void) => () => void;
      };
    };
  }
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.grump?.isElectron);
}

export async function getDockerVersion(): Promise<DockerVersionResult> {
  if (!isElectron() || !window.grump?.docker?.getVersion) {
    return { installed: false, error: 'Not in Electron' };
  }
  try {
    return await window.grump.docker.getVersion();
  } catch (e) {
    return { installed: false, error: (e as Error).message };
  }
}

export async function getDockerInfo(): Promise<DockerInfoResult> {
  if (!isElectron() || !window.grump?.docker?.getInfo) {
    return { running: false, error: 'Not in Electron' };
  }
  try {
    return await window.grump.docker.getInfo();
  } catch (e) {
    return { running: false, error: (e as Error).message };
  }
}

export async function getNvidiaToolkitVersion(): Promise<NvidiaToolkitResult> {
  if (!isElectron() || !window.grump?.docker?.getNvidiaToolkitVersion) {
    return { installed: false, error: 'Not in Electron' };
  }
  try {
    return await window.grump.docker.getNvidiaToolkitVersion();
  } catch (e) {
    return { installed: false, error: (e as Error).message };
  }
}

export async function detectGpu(): Promise<GpuDetectResult> {
  if (!isElectron() || !window.grump?.gpu?.detect) {
    return { vendor: 'none', gpus: [] };
  }
  try {
    return await window.grump.gpu.detect();
  } catch (e) {
    return { vendor: 'none', gpus: [], error: (e as Error).message };
  }
}

export async function listGpus(): Promise<GpuInfo[]> {
  if (!isElectron() || !window.grump?.gpu?.list) {
    return [];
  }
  try {
    return await window.grump.gpu.list();
  } catch {
    return [];
  }
}

export function isDockerSetupAvailable(): boolean {
  return isElectron() && Boolean(window.grump?.docker?.getVersion && window.grump?.gpu?.detect);
}
