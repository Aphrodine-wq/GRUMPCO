import { writable } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import type { Settings } from '../types/settings.js';

let current: Settings | null = null;
const { subscribe, set: writableSet } = writable<Settings | null>(null);
function set(v: Settings | null) {
  current = v;
  writableSet(v);
}

export const settingsStore = {
  subscribe,

  getCurrent(): Settings | null {
    return current;
  },

  async load(): Promise<Settings | null> {
    try {
      const res = await fetchApi('/api/settings');
      if (!res.ok) {
        set(null);
        return null;
      }
      const json = await res.json();
      const s = (json.settings ?? {}) as Settings;
      set(s);
      return s;
    } catch {
      set(null);
      return null;
    }
  },

  async save(partial: Partial<Settings>): Promise<boolean> {
    try {
      const res = await fetchApi('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(partial),
      });
      if (!res.ok) return false;
      const json = await res.json();
      const s = (json.settings ?? {}) as Settings;
      set(s);
      return true;
    } catch {
      return false;
    }
  },

  set,
};
