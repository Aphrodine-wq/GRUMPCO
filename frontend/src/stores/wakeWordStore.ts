import { writable } from 'svelte/store';

/** Whether wake word detection is enabled (Electron only) */
export const wakeWordEnabled = writable<boolean>(false);

/** Load persisted state from localStorage */
export function loadWakeWordEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem('g-rump-wake-word-enabled');
    return stored === 'true';
  } catch {
    return false;
  }
}

/** Persist wake word enabled state */
export function setWakeWordEnabled(enabled: boolean): void {
  wakeWordEnabled.set(enabled);
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('g-rump-wake-word-enabled', String(enabled));
    }
  } catch {
    // ignore
  }
}
