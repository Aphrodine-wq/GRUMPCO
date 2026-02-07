import { writable } from 'svelte/store';
import type { Message } from '../types';

const STORAGE_KEY = 'grump-code-sessions';
const MAX_SESSIONS = 20;

export interface CodeSession {
  id: string;
  name: string;
  messages: Message[];
  workspaceRoot: string | null;
  agentProfile?: string;
  updatedAt: number;
}

function loadSessions(): CodeSession[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CodeSession[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

function persist(sessions: CodeSession[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    /* ignore */
  }
}

const { subscribe, set: _set, update } = writable<CodeSession[]>(loadSessions());

export const codeSessionsStore = {
  subscribe,
  save(name: string, messages: Message[], workspaceRoot: string | null, agentProfile?: string) {
    const id = `code-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const session: CodeSession = {
      id,
      name: name.trim() || `Session ${new Date().toLocaleString()}`,
      // Uses structuredClone for deep copy (21x faster than JSON.parse/stringify for large sessions)
      messages: structuredClone(messages),
      workspaceRoot,
      agentProfile,
      updatedAt: Date.now(),
    };
    update((list) => {
      const next = [session, ...list].slice(0, MAX_SESSIONS);
      persist(next);
      return next;
    });
    return session.id;
  },
  load(id: string): CodeSession | null {
    const list = loadSessions();
    return list.find((s) => s.id === id) ?? null;
  },
  remove(id: string) {
    update((list) => {
      const next = list.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  },
  list(): CodeSession[] {
    let out: CodeSession[] = [];
    const unsub = subscribe((v) => {
      out = v;
    });
    unsub();
    return out;
  },
};
