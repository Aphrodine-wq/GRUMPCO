import { writable, get } from 'svelte/store';
import { workspaceStore } from './workspaceStore.js';
import { getApiBase } from '../lib/api.js';

export interface DemoStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface DemoState {
  active: boolean;
  workspacePath: string | null;
  steps: DemoStep[];
}

const initialState: DemoState = { active: false, workspacePath: null, steps: [] };
const demoState = writable<DemoState>(initialState);

export const demoStore = {
  subscribe: demoState.subscribe,

  setActive(active: boolean, workspacePath: string | null = null, steps: DemoStep[] = []) {
    demoState.set({ active, workspacePath, steps });
  },

  async startDemo(): Promise<{ ok: boolean; error?: string }> {
    try {
      const base = getApiBase();
      const url = `${base}/api/demo/start`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || `Request failed (${res.status})` };
      }
      const data = await res.json();
      const { workspacePath, steps } = data;
      workspaceStore.setWorkspace(workspacePath, null);
      demoState.set({ active: true, workspacePath, steps: steps || [] });
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start demo';
      return { ok: false, error: message };
    }
  },

  reset() {
    demoState.set(initialState);
  },

  get state() {
    return get(demoState);
  },
};
