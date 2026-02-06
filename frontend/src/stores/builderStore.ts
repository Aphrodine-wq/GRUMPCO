/**
 * Builder store – session list and current Builder session state.
 * Loads list from GET /api/builder/sessions; create/get session, mermaid, build stream, git.
 */

import { writable, get } from 'svelte/store';
import { fetchApi, getApiBase } from '../lib/api.js';

export type BuilderDestination = 'local' | 'git';

export interface BuilderSessionSummary {
  id: string;
  projectName: string;
  path: string;
  destination: BuilderDestination;
  status: string;
  defaultProvider?: string;
  defaultModelId?: string;
  updatedAt?: string;
}

export interface BuilderSession extends BuilderSessionSummary {
  mermaid?: string;
  sections?: Array<{ id: string; title: string }>;
  completedSectionIds?: string[];
}

export interface BuildStreamEvent {
  type: 'narrative' | 'file';
  text?: string;
  path?: string;
  snippet?: string;
}

const sessions = writable<BuilderSessionSummary[]>([]);
const currentSession = writable<BuilderSession | null>(null);
const loading = writable(false);
const error = writable<string | null>(null);

export const builderSessions = { subscribe: sessions.subscribe };
export const builderCurrentSession = { subscribe: currentSession.subscribe };
export const builderLoading = { subscribe: loading.subscribe };
export const builderError = { subscribe: error.subscribe };

export function setBuilderCurrentSession(session: BuilderSession | null): void {
  currentSession.set(session);
}

export function clearBuilderError(): void {
  error.set(null);
}

/**
 * Load list of Builder sessions from API.
 */
export async function loadBuilderSessions(): Promise<void> {
  loading.set(true);
  error.set(null);
  try {
    const res = await fetchApi('/api/builder/sessions');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { sessions: BuilderSessionSummary[] };
    sessions.set(data.sessions ?? []);
  } catch (e) {
    error.set((e as Error).message);
    sessions.set([]);
  } finally {
    loading.set(false);
  }
}

/**
 * Create a new Builder session (project folder + session record).
 */
export async function createBuilderSession(params: {
  projectName: string;
  workspaceRoot: string;
  destination: BuilderDestination;
  defaultProvider?: string;
  defaultModelId?: string;
}): Promise<BuilderSession> {
  loading.set(true);
  error.set(null);
  try {
    const res = await fetchApi('/api/builder/sessions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const session = (await res.json()) as BuilderSession;
    sessions.update((list) => [session, ...list]);
    currentSession.set(session);
    return session;
  } catch (e) {
    error.set((e as Error).message);
    throw e;
  } finally {
    loading.set(false);
  }
}

/**
 * Get a single Builder session by id (full details including mermaid, sections, completedSectionIds).
 */
export async function getBuilderSession(sessionId: string): Promise<BuilderSession> {
  loading.set(true);
  error.set(null);
  try {
    const res = await fetchApi(`/api/builder/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const session = (await res.json()) as BuilderSession;
    currentSession.set(session);
    return session;
  } catch (e) {
    error.set((e as Error).message);
    throw e;
  } finally {
    loading.set(false);
  }
}

/**
 * Generate Mermaid diagram from initial prompt and optional refinement messages.
 */
export async function generateBuilderMermaid(
  sessionId: string,
  prompt: string,
  refinementMessages: string[] = []
): Promise<{ mermaid: string }> {
  loading.set(true);
  error.set(null);
  try {
    const res = await fetchApi(`/api/builder/sessions/${encodeURIComponent(sessionId)}/mermaid`, {
      method: 'POST',
      body: JSON.stringify({ prompt, refinementMessages }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { mermaid: string };
    const session = get(currentSession);
    if (session && session.id === sessionId) {
      currentSession.update((s) => (s ? { ...s, mermaid: data.mermaid } : s));
    }
    return data;
  } catch (e) {
    error.set((e as Error).message);
    throw e;
  } finally {
    loading.set(false);
  }
}

/**
 * Stream build for a section: call onEvent for each narrative/file event.
 * Optional provider/modelId override for this section; otherwise uses project default.
 */
export async function buildBuilderSection(
  sessionId: string,
  sectionId: string,
  onEvent: (event: BuildStreamEvent) => void,
  options?: { provider?: string; modelId?: string }
): Promise<void> {
  error.set(null);
  const url = `${getApiBase()}/api/builder/sessions/${encodeURIComponent(sessionId)}/build`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GRump-Client': 'desktop' },
    body: JSON.stringify({
      sectionId,
      provider: options?.provider,
      modelId: options?.modelId,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      try {
        const event = JSON.parse(trimmed) as BuildStreamEvent;
        onEvent(event);
      } catch {
        // ignore non-JSON lines
      }
    }
  }
  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as BuildStreamEvent;
      onEvent(event);
    } catch {
      // ignore
    }
  }
  // Refresh session so completedSectionIds is updated
  await getBuilderSession(sessionId);
}

/**
 * Initialize Git and optionally create remote and push.
 */
export async function builderGit(
  sessionId: string,
  options: { createRemote?: boolean } = {}
): Promise<{ repoUrl?: string; pushed?: boolean }> {
  loading.set(true);
  error.set(null);
  try {
    const res = await fetchApi(`/api/builder/sessions/${encodeURIComponent(sessionId)}/git`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as { repoUrl?: string; pushed?: boolean };
  } catch (e) {
    error.set((e as Error).message);
    throw e;
  } finally {
    loading.set(false);
  }
}
