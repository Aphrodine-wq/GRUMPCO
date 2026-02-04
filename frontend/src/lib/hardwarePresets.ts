/**
 * Hardware presets for Docker/GPU setup (NVIDIA/AMD/CPU).
 * Used by DockerSetupWizard and settings.
 */

export type PresetId = 'gaming' | 'workstation' | 'laptop' | 'cloud';

export interface HardwarePreset {
  id: PresetId;
  label: string;
  description: string;
  /** Preferred GPU count (0 = CPU-only) */
  gpuCount: number;
  /** Minimum VRAM in GB (0 = any / CPU) */
  vramMinGb: number;
  /** System RAM in GB */
  ramGb: number;
  /** Resource tier for containers */
  resourceTier: 'low' | 'medium' | 'high';
  /** Suggested compose overlay: '' | 'gpu' | 'rocm' */
  composeOverlay: '' | 'gpu' | 'rocm';
}

export const HARDWARE_PRESETS: Record<PresetId, HardwarePreset> = {
  gaming: {
    id: 'gaming',
    label: 'Gaming PC',
    description: '1 GPU (NVIDIA or AMD), 8GB VRAM, 16GB RAM',
    gpuCount: 1,
    vramMinGb: 8,
    ramGb: 16,
    resourceTier: 'medium',
    composeOverlay: 'gpu', // user can switch to rocm if AMD
  },
  workstation: {
    id: 'workstation',
    label: 'Workstation',
    description: 'Multi-GPU (NVIDIA and/or AMD), 24GB+ VRAM, 64GB RAM',
    gpuCount: 2,
    vramMinGb: 24,
    ramGb: 64,
    resourceTier: 'high',
    composeOverlay: 'gpu',
  },
  laptop: {
    id: 'laptop',
    label: 'Laptop',
    description: 'CPU-only or integrated GPU, 8GB RAM',
    gpuCount: 0,
    vramMinGb: 0,
    ramGb: 8,
    resourceTier: 'low',
    composeOverlay: '',
  },
  cloud: {
    id: 'cloud',
    label: 'Cloud Server',
    description: 'High CPU, optional GPU (vendor depends on cloud)',
    gpuCount: 0,
    vramMinGb: 0,
    ramGb: 32,
    resourceTier: 'high',
    composeOverlay: '',
  },
};

export const PRESET_IDS: PresetId[] = ['gaming', 'workstation', 'laptop', 'cloud'];

export function getPreset(id: PresetId): HardwarePreset {
  return HARDWARE_PRESETS[id];
}

export function getPresetForGpu(
  vendor: 'nvidia' | 'amd' | 'none',
  gpuCount: number,
  vramGb: number
): PresetId {
  if (vendor === 'none' || gpuCount === 0) return 'laptop';
  if (gpuCount >= 2 || vramGb >= 24) return 'workstation';
  if (vramGb >= 8) return 'gaming';
  return 'laptop';
}
