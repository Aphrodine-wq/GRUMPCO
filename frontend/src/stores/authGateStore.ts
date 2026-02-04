/**
 * Tracks whether user skipped Google Auth in Electron.
 * Used to avoid re-prompting until next launch or reset.
 */
import { writable, derived, get } from 'svelte/store';

const AUTH_SKIPPED_KEY = 'g-rump-auth-skipped';

function loadAuthSkipped(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(AUTH_SKIPPED_KEY) === 'true';
  } catch {
    return false;
  }
}

const authSkipped = writable<boolean>(loadAuthSkipped());

export const authSkippedOnDevice = derived(authSkipped, ($v) => $v);

export const authGateStore = {
  isAuthSkippedOnDevice: (): boolean => get(authSkipped),

  markAuthSkipped: (): void => {
    authSkipped.set(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_SKIPPED_KEY, 'true');
      }
    } catch (e) {
      console.warn('Failed to persist auth skipped:', e);
    }
  },

  resetAuthSkipped: (): void => {
    authSkipped.set(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_SKIPPED_KEY);
      }
    } catch (e) {
      console.warn('Failed to reset auth skipped:', e);
    }
  },
};

export default authSkippedOnDevice;
