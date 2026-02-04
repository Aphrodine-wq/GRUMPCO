import { writable } from 'svelte/store';

export type ChatMode = 'design' | 'code' | 'argument' | 'none';

const STORAGE_KEY = 'grump-chat-mode';

function loadStored(): ChatMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY) as ChatMode | null;
      if (v === 'design' || v === 'code' || v === 'argument') return v;
    }
  } catch {
    /* ignore */
  }
  return 'design';
}

function persist(mode: ChatMode) {
  if (mode === 'none') return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    /* ignore */
  }
}

const { subscribe, set } = writable<ChatMode>(loadStored());

export const chatModeStore = {
  subscribe,
  setMode(mode: ChatMode) {
    persist(mode);
    set(mode);
  },
  /** Clear mode so no Architecture/Code button is active (not persisted). */
  clearMode() {
    set('none');
  },
};
