import { writable, derived, get } from 'svelte/store';
import type { Session, Message, LegacySession, DiagramVersion } from '../types';
import { getCurrentProjectId } from './projectStore.js';

const SESSIONS_KEY = 'mermaid-sessions';
const MAX_SESSIONS = 10;
const MAX_DIAGRAM_VERSIONS = 20;

// Generate unique ID
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate diagram version ID
function generateVersionId(): string {
  return `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate session name from first user message
function generateSessionName(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const content =
      typeof firstUserMessage.content === 'string'
        ? firstUserMessage.content
        : JSON.stringify(firstUserMessage.content);
    if (content.length > 40) {
      return content.substring(0, 40) + '...';
    }
    return content;
  }
  return `Session ${new Date().toLocaleDateString()}`;
}

// Check if session has a diagram
export function sessionHasDiagram(session: Session): boolean {
  return session.messages.some((m) => {
    if (m.role !== 'assistant') return false;
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return content.includes('```mermaid');
  });
}

// Get first diagram code from session
export function getFirstDiagramCode(session: Session): string | null {
  for (const msg of session.messages) {
    if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (content.includes('```mermaid')) {
        const match = content.match(/```mermaid\s*([\s\S]*?)```/);
        if (match) return match[1].trim();
      }
    }
  }
  return null;
}

// Create stores
const sessions = writable<Session[]>([]);
const currentSessionId = writable<string | null>(null);

// Derived stores
export const currentSession = derived(
  [sessions, currentSessionId],
  ([$sessions, $currentSessionId]) => {
    if (!$currentSessionId) return null;
    return $sessions.find((s) => s.id === $currentSessionId) || null;
  }
);

export const sortedSessions = derived(sessions, ($sessions) => {
  return [...$sessions].sort((a, b) => b.updatedAt - a.updatedAt);
});

// Load sessions from storage
function loadSessions(): void {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      sessions.set(parsed.sessions || []);
      currentSessionId.set(parsed.currentSessionId || null);
    }
  } catch (e) {
    console.warn('Failed to load sessions:', e);
  }
}

// Save sessions to storage (uses get() to avoid memory leaks)
function saveSessions(): void {
  try {
    const s = get(sessions);
    const id = get(currentSessionId);
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify({
        sessions: s,
        currentSessionId: id,
      })
    );
  } catch (e) {
    console.warn('Failed to save sessions:', e);
  }
}

// Auto-save on changes
sessions.subscribe(() => saveSessions());
currentSessionId.subscribe(() => saveSessions());

// Migrate legacy session if exists
function migrateLegacySession(legacySession: LegacySession): Session {
  return {
    id: generateId(),
    name: generateSessionName(legacySession.messages),
    messages: legacySession.messages,
    timestamp: legacySession.timestamp,
    updatedAt: legacySession.timestamp,
  };
}

// Store actions
export const sessionsStore = {
  // State
  get sessions() {
    return sessions;
  },
  get currentSessionId() {
    return currentSessionId;
  },
  get currentSession() {
    return currentSession;
  },
  get sortedSessions() {
    return sortedSessions;
  },

  // Initialize
  init() {
    loadSessions();
  },

  // Actions
  createSession(
    messages: Message[] = [],
    projectId?: string | null,
    sessionType?: Session['sessionType']
  ): Session {
    const session: Session = {
      id: generateId(),
      name: messages.length > 0 ? generateSessionName(messages) : 'New Session',
      messages,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      projectId: projectId !== undefined ? projectId : (getCurrentProjectId() ?? undefined),
      sessionType,
    };

    sessions.update((s) => {
      const updated = [session, ...s];
      // Trim old sessions if over limit
      if (updated.length > MAX_SESSIONS) {
        return updated.slice(0, MAX_SESSIONS);
      }
      return updated;
    });

    currentSessionId.set(session.id);
    return session;
  },

  updateSession(id: string, messages: Message[]): void {
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === id);
      if (session) {
        session.messages = messages;
        session.updatedAt = Date.now();

        // Update name if it was default
        if (session.name === 'New Session' && messages.length > 0) {
          session.name = generateSessionName(messages);
        }
      }
      return [...s];
    });
  },

  deleteSession(id: string): void {
    sessions.update((s) => {
      const filtered = s.filter((sess) => sess.id !== id);
      // If deleted current session, switch to most recent
      currentSessionId.update((currentId) => {
        if (currentId === id) {
          return filtered[0]?.id || null;
        }
        return currentId;
      });
      return filtered;
    });
  },

  setSessionType(id: string, sessionType: Session['sessionType']): void {
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === id);
      if (session) {
        session.sessionType = sessionType;
      }
      return [...s];
    });
  },

  renameSession(id: string, name: string): void {
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === id);
      if (session) {
        session.name = name.trim() || 'Untitled Session';
      }
      return [...s];
    });
  },

  /** Set or clear the project id for a chat session; used when starting ship/codegen from chat. */
  setSessionProjectId(id: string, projectId: string | null): void {
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === id);
      if (session) {
        session.projectId = projectId ?? undefined;
      }
      return [...s];
    });
  },

  switchSession(id: string): void {
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === id);
      if (session) {
        currentSessionId.set(id);
      }
      return s;
    });
  },

  clearCurrentSession(): void {
    currentSessionId.set(null);
  },

  exportSession(id: string): void {
    const session = get(sessions).find((sess) => sess.id === id);

    if (!session) return;

    // Collect all SVG diagrams
    const diagrams: string[] = [];
    for (const msg of session.messages) {
      if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (content.includes('```mermaid')) {
          const matches = content.matchAll(/```mermaid\s*([\s\S]*?)```/g);
          for (const match of matches) {
            diagrams.push(match[1].trim());
          }
        }
      }
    }

    // Export as JSON with session data
    const exportData = {
      name: session.name,
      exportedAt: new Date().toISOString(),
      messages: session.messages,
      diagramCodes: diagrams,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importLegacySession(legacy: LegacySession): void {
    const session = migrateLegacySession(legacy);
    sessions.update((s) => {
      const updated = [session, ...s];
      if (updated.length > MAX_SESSIONS) {
        return updated.slice(0, MAX_SESSIONS);
      }
      return updated;
    });
    currentSessionId.set(session.id);
  },

  // Diagram versioning
  addDiagramVersion(
    sessionId: string,
    code: string,
    userPrompt: string,
    parentVersionId?: string
  ): DiagramVersion | null {
    let version: DiagramVersion | null = null;

    sessions.update((s) => {
      const session = s.find((sess) => sess.id === sessionId);
      if (!session) return s;

      version = {
        id: generateVersionId(),
        code,
        timestamp: Date.now(),
        userPrompt,
        parentVersionId,
      };

      // Initialize versions array if needed
      if (!session.diagramVersions) {
        session.diagramVersions = [];
      }

      session.diagramVersions.push(version);
      session.currentDiagramId = version.id;

      // Trim old versions if over limit
      if (session.diagramVersions.length > MAX_DIAGRAM_VERSIONS) {
        session.diagramVersions = session.diagramVersions.slice(-MAX_DIAGRAM_VERSIONS);
      }

      return [...s];
    });

    return version;
  },

  getDiagramVersions(sessionId: string): DiagramVersion[] {
    const session = get(sessions).find((sess) => sess.id === sessionId);
    return session?.diagramVersions || [];
  },

  getCurrentDiagram(sessionId: string): DiagramVersion | null {
    const session = get(sessions).find((sess) => sess.id === sessionId);
    if (!session?.currentDiagramId || !session.diagramVersions) {
      return null;
    }
    return session.diagramVersions.find((v) => v.id === session.currentDiagramId) || null;
  },

  revertToDiagramVersion(sessionId: string, versionId: string): boolean {
    let success = false;
    sessions.update((s) => {
      const session = s.find((sess) => sess.id === sessionId);
      if (!session?.diagramVersions) return s;

      const version = session.diagramVersions.find((v) => v.id === versionId);
      if (!version) return s;

      session.currentDiagramId = versionId;
      success = true;
      return [...s];
    });
    return success;
  },

  // Conversation context helpers
  getRecentMessages(sessionId: string, count: number = 10): Message[] {
    const session = get(sessions).find((sess) => sess.id === sessionId);
    return session ? session.messages.slice(-count) : [];
  },
};

// Initialize on load
sessionsStore.init();
