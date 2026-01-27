import { writable } from 'svelte/store';

const STORAGE_KEY = 'grump-workspace-root';

function loadStored(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && v.trim() ? v.trim() : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persist(path: string | null) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (path) localStorage.setItem(STORAGE_KEY, path);
      else localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

const { subscribe, set, update } = writable<string | null>(loadStored());

export const workspaceStore = {
  subscribe,
  setWorkspace(path: string | null) {
    persist(path);
    set(path);
  },
  clear() {
    persist(null);
    set(null);
  },
};
