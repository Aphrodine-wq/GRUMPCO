import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { Session, Message, LegacySession, DiagramVersion } from '../types';

const SESSIONS_KEY = 'mermaid-sessions';
const MAX_SESSIONS = 10;
const MAX_DIAGRAM_VERSIONS = 20; // Limit diagram history per session

// Singleton state
const sessions: Ref<Session[]> = ref([]);
const currentSessionId: Ref<string | null> = ref(null);

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
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    // Truncate to first 40 chars
    if (content.length > 40) {
      return content.substring(0, 40) + '...';
    }
    return content;
  }
  return `Session ${new Date().toLocaleDateString()}`;
}

// Check if session has a diagram
function sessionHasDiagram(session: Session): boolean {
  return session.messages.some(m => 
    m.role === 'assistant' && m.content.includes('```mermaid')
  );
}

// Get first diagram code from session
function getFirstDiagramCode(session: Session): string | null {
  for (const msg of session.messages) {
    if (msg.role === 'assistant' && msg.content.includes('```mermaid')) {
      const match = msg.content.match(/```mermaid\s*([\s\S]*?)```/);
      if (match) return match[1].trim();
    }
  }
  return null;
}

// Load sessions from storage
function loadSessions(): void {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      sessions.value = parsed.sessions || [];
      currentSessionId.value = parsed.currentSessionId || null;
    }
  } catch (e) {
    console.warn('Failed to load sessions:', e);
  }
}

// Save sessions to storage
function saveSessions(): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({
      sessions: sessions.value,
      currentSessionId: currentSessionId.value
    }));
  } catch (e) {
    console.warn('Failed to save sessions:', e);
  }
}

// Migrate legacy session if exists
function migrateLegacySession(legacySession: LegacySession): Session {
  return {
    id: generateId(),
    name: generateSessionName(legacySession.messages),
    messages: legacySession.messages,
    timestamp: legacySession.timestamp,
    updatedAt: legacySession.timestamp
  };
}

export interface UseSessionsReturn {
  // State
  sessions: Ref<Session[]>;
  currentSessionId: Ref<string | null>;
  
  // Computed
  currentSession: ComputedRef<Session | null>;
  sortedSessions: ComputedRef<Session[]>;
  
  // Actions
  createSession: (messages?: Message[]) => Session;
  updateSession: (id: string, messages: Message[]) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  switchSession: (id: string) => void;
  clearCurrentSession: () => void;
  exportSession: (id: string) => void;
  importLegacySession: (legacy: LegacySession) => void;
  
  // Diagram versioning
  addDiagramVersion: (sessionId: string, code: string, userPrompt: string, parentVersionId?: string) => DiagramVersion | null;
  getDiagramVersions: (sessionId: string) => DiagramVersion[];
  getCurrentDiagram: (sessionId: string) => DiagramVersion | null;
  revertToDiagramVersion: (sessionId: string, versionId: string) => boolean;
  
  // Conversation context helpers
  getRecentMessages: (sessionId: string, count?: number) => Message[];
  
  // Helpers
  sessionHasDiagram: (session: Session) => boolean;
  getFirstDiagramCode: (session: Session) => string | null;
}

export function useSessions(): UseSessionsReturn {
  // Load on first use
  loadSessions();

  // Auto-save on changes
  watch([sessions, currentSessionId], saveSessions, { deep: true });

  const currentSession = computed(() => {
    if (!currentSessionId.value) return null;
    return sessions.value.find(s => s.id === currentSessionId.value) || null;
  });

  const sortedSessions = computed(() => {
    return [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt);
  });

  function createSession(messages: Message[] = []): Session {
    const session: Session = {
      id: generateId(),
      name: messages.length > 0 ? generateSessionName(messages) : 'New Session',
      messages,
      timestamp: Date.now(),
      updatedAt: Date.now()
    };

    sessions.value.unshift(session);
    currentSessionId.value = session.id;

    // Trim old sessions if over limit
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value = sessions.value.slice(0, MAX_SESSIONS);
    }

    return session;
  }

  function updateSession(id: string, messages: Message[]): void {
    const session = sessions.value.find(s => s.id === id);
    if (session) {
      session.messages = messages;
      session.updatedAt = Date.now();
      
      // Update name if it was default
      if (session.name === 'New Session' && messages.length > 0) {
        session.name = generateSessionName(messages);
      }
    }
  }

  function deleteSession(id: string): void {
    const index = sessions.value.findIndex(s => s.id === id);
    if (index !== -1) {
      sessions.value.splice(index, 1);
      
      // If deleted current session, switch to most recent
      if (currentSessionId.value === id) {
        currentSessionId.value = sessions.value[0]?.id || null;
      }
    }
  }

  function renameSession(id: string, name: string): void {
    const session = sessions.value.find(s => s.id === id);
    if (session) {
      session.name = name.trim() || 'Untitled Session';
    }
  }

  function switchSession(id: string): void {
    const session = sessions.value.find(s => s.id === id);
    if (session) {
      currentSessionId.value = id;
    }
  }

  function clearCurrentSession(): void {
    currentSessionId.value = null;
  }

  function exportSession(id: string): void {
    const session = sessions.value.find(s => s.id === id);
    if (!session) return;

    // Collect all SVG diagrams
    const diagrams: string[] = [];
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.content.includes('```mermaid')) {
        const matches = msg.content.matchAll(/```mermaid\s*([\s\S]*?)```/g);
        for (const match of matches) {
          diagrams.push(match[1].trim());
        }
      }
    }

    // Export as JSON with session data
    const exportData = {
      name: session.name,
      exportedAt: new Date().toISOString(),
      messages: session.messages,
      diagramCodes: diagrams
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importLegacySession(legacy: LegacySession): void {
    const session = migrateLegacySession(legacy);
    sessions.value.unshift(session);
    currentSessionId.value = session.id;

    // Trim old sessions if over limit
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value = sessions.value.slice(0, MAX_SESSIONS);
    }
  }

  // Diagram versioning functions
  function addDiagramVersion(
    sessionId: string, 
    code: string, 
    userPrompt: string, 
    parentVersionId?: string
  ): DiagramVersion | null {
    const session = sessions.value.find(s => s.id === sessionId);
    if (!session) return null;

    const version: DiagramVersion = {
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

    return version;
  }

  function getDiagramVersions(sessionId: string): DiagramVersion[] {
    const session = sessions.value.find(s => s.id === sessionId);
    return session?.diagramVersions || [];
  }

  function getCurrentDiagram(sessionId: string): DiagramVersion | null {
    const session = sessions.value.find(s => s.id === sessionId);
    if (!session?.currentDiagramId || !session.diagramVersions) return null;
    return session.diagramVersions.find(v => v.id === session.currentDiagramId) || null;
  }

  function revertToDiagramVersion(sessionId: string, versionId: string): boolean {
    const session = sessions.value.find(s => s.id === sessionId);
    if (!session?.diagramVersions) return false;

    const version = session.diagramVersions.find(v => v.id === versionId);
    if (!version) return false;

    session.currentDiagramId = versionId;
    return true;
  }

  // Get recent messages for conversation context (limited window)
  function getRecentMessages(sessionId: string, count: number = 10): Message[] {
    const session = sessions.value.find(s => s.id === sessionId);
    if (!session) return [];
    return session.messages.slice(-count);
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    sortedSessions,
    createSession,
    updateSession,
    deleteSession,
    renameSession,
    switchSession,
    clearCurrentSession,
    exportSession,
    importLegacySession,
    // Diagram versioning
    addDiagramVersion,
    getDiagramVersions,
    getCurrentDiagram,
    revertToDiagramVersion,
    // Conversation context
    getRecentMessages,
    // Helpers
    sessionHasDiagram,
    getFirstDiagramCode
  };
}
