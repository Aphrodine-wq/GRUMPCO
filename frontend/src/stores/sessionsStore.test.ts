/**
 * Sessions Store Tests
 *
 * Comprehensive tests for chat session management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

let sessionsStore: typeof import('./sessionsStore').sessionsStore;
let sessionHasDiagram: typeof import('./sessionsStore').sessionHasDiagram;
let getFirstDiagramCode: typeof import('./sessionsStore').getFirstDiagramCode;
let currentSession: typeof import('./sessionsStore').currentSession;
let sortedSessions: typeof import('./sessionsStore').sortedSessions;

describe('sessionsStore', () => {
  beforeEach(async () => {
    resetMocks();
    localStorage.clear();
    vi.resetModules();

    const module = await import('./sessionsStore');
    sessionsStore = module.sessionsStore;
    sessionHasDiagram = module.sessionHasDiagram;
    getFirstDiagramCode = module.getFirstDiagramCode;
    currentSession = module.currentSession;
    sortedSessions = module.sortedSessions;
  });

  describe('createSession', () => {
    it('should create a new session with empty messages', () => {
      const session = sessionsStore.createSession([]);

      expect(session.id).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(session.name).toBe('New Chat');
      expect(session.messages).toEqual([]);
    });

    it('should create session with provided messages', () => {
      const messages = [{ role: 'user' as const, content: 'Hello AI' }];
      const session = sessionsStore.createSession(messages);

      expect(session.messages).toEqual(messages);
      expect(session.name).toBe('Hello AI');
    });

    it('should truncate long message for session name', () => {
      const longMessage = 'A'.repeat(50);
      const messages = [{ role: 'user' as const, content: longMessage }];
      const session = sessionsStore.createSession(messages);

      expect(session.name).toBe('A'.repeat(40) + '...');
    });

    it('should set session as current', () => {
      const session = sessionsStore.createSession([]);

      expect(get(currentSession)?.id).toBe(session.id);
    });

    it('should add session to list', () => {
      sessionsStore.createSession([]);
      sessionsStore.createSession([]);

      expect(get(sessionsStore.sessions)).toHaveLength(2);
    });

    it('should limit sessions to MAX_SESSIONS (10)', () => {
      for (let i = 0; i < 15; i++) {
        sessionsStore.createSession([]);
      }

      expect(get(sessionsStore.sessions)).toHaveLength(10);
    });
  });

  describe('updateSession', () => {
    it('should update session messages', () => {
      const session = sessionsStore.createSession([]);
      const newMessages = [{ role: 'user' as const, content: 'Updated' }];

      sessionsStore.updateSession(session.id, newMessages);

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.messages).toEqual(newMessages);
    });

    it('should update session name from default', () => {
      const session = sessionsStore.createSession([]);
      expect(session.name).toBe('New Chat');

      sessionsStore.updateSession(session.id, [
        { role: 'user' as const, content: 'My first message' },
      ]);

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.name).toBe('My first message');
    });

    it('should update updatedAt timestamp', () => {
      const session = sessionsStore.createSession([]);
      sessionsStore.updateSession(session.id, [{ role: 'user' as const, content: 'Update' }]);
      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.updatedAt).toBeDefined();
      expect(typeof updated?.updatedAt).toBe('number');
    });
  });

  describe('deleteSession', () => {
    it('should remove session from list', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.deleteSession(session.id);

      expect(get(sessionsStore.sessions)).toHaveLength(0);
    });

    it('should switch to next session if current deleted', () => {
      const session1 = sessionsStore.createSession([]);
      const session2 = sessionsStore.createSession([]);

      // session2 is current
      sessionsStore.deleteSession(session2.id);

      expect(get(currentSession)?.id).toBe(session1.id);
    });

    it('should clear current if no sessions remain', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.deleteSession(session.id);

      expect(get(currentSession)).toBeNull();
    });
  });

  describe('renameSession', () => {
    it('should rename session', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.renameSession(session.id, 'My Custom Name');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.name).toBe('My Custom Name');
    });

    it('should default to Untitled if empty name', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.renameSession(session.id, '   ');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.name).toBe('Untitled Session');
    });

    it('should trim whitespace from name', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.renameSession(session.id, '  Trimmed Name  ');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.name).toBe('Trimmed Name');
    });
  });

  describe('switchSession', () => {
    it('should switch to specified session', () => {
      const session1 = sessionsStore.createSession([]);
      const _session2 = sessionsStore.createSession([]);

      sessionsStore.switchSession(session1.id);

      expect(get(currentSession)?.id).toBe(session1.id);
    });

    it('should not change if session not found', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.switchSession('non-existent');

      expect(get(currentSession)?.id).toBe(session.id);
    });
  });

  describe('clearCurrentSession', () => {
    it('should clear current session', () => {
      sessionsStore.createSession([]);

      sessionsStore.clearCurrentSession();

      expect(get(currentSession)).toBeNull();
    });
  });

  describe('setSessionProjectId', () => {
    it('should set project ID on session', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.setSessionProjectId(session.id, 'project-123');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.projectId).toBe('project-123');
    });

    it('should clear project ID when null', () => {
      const session = sessionsStore.createSession([], 'project-123');

      sessionsStore.setSessionProjectId(session.id, null);

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.projectId).toBeUndefined();
    });
  });

  describe('sortedSessions', () => {
    it('should sort by updatedAt descending', async () => {
      const session1 = sessionsStore.createSession([]);

      // Advance time
      await new Promise((r) => setTimeout(r, 10));

      const session2 = sessionsStore.createSession([]);

      const sorted = get(sortedSessions);
      expect(sorted[0].id).toBe(session2.id);
      expect(sorted[1].id).toBe(session1.id);
    });
  });

  describe('sessionHasDiagram', () => {
    it('should return true if session has mermaid diagram', () => {
      const session = sessionsStore.createSession([
        { role: 'user' as const, content: 'Create diagram' },
        { role: 'assistant' as const, content: '```mermaid\ngraph TD\nA-->B\n```' },
      ]);

      expect(sessionHasDiagram(session)).toBe(true);
    });

    it('should return false if no diagram', () => {
      const session = sessionsStore.createSession([
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ]);

      expect(sessionHasDiagram(session)).toBe(false);
    });
  });

  describe('getFirstDiagramCode', () => {
    it('should extract first diagram code', () => {
      const session = sessionsStore.createSession([
        { role: 'assistant' as const, content: '```mermaid\ngraph TD\nA-->B\n```' },
      ]);

      expect(getFirstDiagramCode(session)).toBe('graph TD\nA-->B');
    });

    it('should return null if no diagram', () => {
      const session = sessionsStore.createSession([
        { role: 'assistant' as const, content: 'No diagram here' },
      ]);

      expect(getFirstDiagramCode(session)).toBeNull();
    });
  });

  describe('diagram versioning', () => {
    it('should add diagram version', () => {
      const session = sessionsStore.createSession([]);

      const version = sessionsStore.addDiagramVersion(
        session.id,
        'graph TD\nA-->B',
        'Create flowchart'
      );

      expect(version).not.toBeNull();
      expect(version?.code).toBe('graph TD\nA-->B');
      expect(version?.userPrompt).toBe('Create flowchart');
    });

    it('should track parent version', () => {
      const session = sessionsStore.createSession([]);

      const v1 = sessionsStore.addDiagramVersion(session.id, 'v1', 'first');
      const v2 = sessionsStore.addDiagramVersion(session.id, 'v2', 'second', v1?.id);

      expect(v2?.parentVersionId).toBe(v1?.id);
    });

    it('should get diagram versions', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.addDiagramVersion(session.id, 'v1', 'first');
      sessionsStore.addDiagramVersion(session.id, 'v2', 'second');

      const versions = sessionsStore.getDiagramVersions(session.id);
      expect(versions).toHaveLength(2);
    });

    it('should get current diagram', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.addDiagramVersion(session.id, 'v1', 'first');
      const v2 = sessionsStore.addDiagramVersion(session.id, 'v2', 'second');

      const current = sessionsStore.getCurrentDiagram(session.id);
      expect(current?.id).toBe(v2?.id);
    });

    it('should revert to diagram version', () => {
      const session = sessionsStore.createSession([]);

      const v1 = sessionsStore.addDiagramVersion(session.id, 'v1', 'first');
      sessionsStore.addDiagramVersion(session.id, 'v2', 'second');

      const success = v1 && sessionsStore.revertToDiagramVersion(session.id, v1.id);

      expect(success).toBe(true);
      expect(sessionsStore.getCurrentDiagram(session.id)?.id).toBe(v1?.id);
    });

    it('should limit diagram versions to MAX (20)', () => {
      const session = sessionsStore.createSession([]);

      for (let i = 0; i < 25; i++) {
        sessionsStore.addDiagramVersion(session.id, `v${i}`, `prompt ${i}`);
      }

      const versions = sessionsStore.getDiagramVersions(session.id);
      expect(versions).toHaveLength(20);
    });
  });

  describe('getRecentMessages', () => {
    it('should return last N messages', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      }));
      const session = sessionsStore.createSession(messages);

      const recent = sessionsStore.getRecentMessages(session.id, 5);

      expect(recent).toHaveLength(5);
      expect(recent[0].content).toBe('Message 15');
    });

    it('should return empty array for non-existent session', () => {
      const recent = sessionsStore.getRecentMessages('non-existent');
      expect(recent).toEqual([]);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist sessions to localStorage', () => {
      sessionsStore.createSession([{ role: 'user' as const, content: 'Test' }]);

      const stored = localStorage.getItem('mermaid-sessions');
      expect(stored).not.toBeNull();

      const parsed = stored ? JSON.parse(stored) : null;
      expect(parsed?.sessions).toHaveLength(1);
    });
  });

  describe('importLegacySession', () => {
    it('should import legacy session format', () => {
      const legacySession = {
        messages: [
          { role: 'user' as const, content: 'Legacy message' },
          { role: 'assistant' as const, content: 'Legacy response' },
        ],
        timestamp: Date.now() - 10000,
      };

      sessionsStore.importLegacySession(legacySession);

      const sessions = get(sessionsStore.sessions);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Legacy message');
      expect(sessions[0].messages).toEqual(legacySession.messages);
    });

    it('should set imported session as current', () => {
      const legacySession = {
        messages: [{ role: 'user' as const, content: 'Test' }],
        timestamp: Date.now(),
      };

      sessionsStore.importLegacySession(legacySession);

      expect(get(currentSession)?.name).toBe('Test');
    });

    it('should respect MAX_SESSIONS limit when importing', () => {
      // Create 10 sessions first
      for (let i = 0; i < 10; i++) {
        sessionsStore.createSession([{ role: 'user' as const, content: `Session ${i}` }]);
      }

      const legacySession = {
        messages: [{ role: 'user' as const, content: 'Imported legacy' }],
        timestamp: Date.now(),
      };

      sessionsStore.importLegacySession(legacySession);

      const sessions = get(sessionsStore.sessions);
      expect(sessions).toHaveLength(10);
      // Imported session should be at the front
      expect(sessions[0].name).toBe('Imported legacy');
    });
  });

  describe('getCurrentDiagram edge cases', () => {
    it('should return null for non-existent session', () => {
      const result = sessionsStore.getCurrentDiagram('non-existent-session');
      expect(result).toBeNull();
    });

    it('should return null when session has no diagram versions', () => {
      const session = sessionsStore.createSession([]);
      // Session exists but has no diagramVersions
      const result = sessionsStore.getCurrentDiagram(session.id);
      expect(result).toBeNull();
    });

    it('should return null when currentDiagramId does not match any version', () => {
      const session = sessionsStore.createSession([]);
      // Add a version so diagramVersions exists
      sessionsStore.addDiagramVersion(session.id, 'v1', 'prompt1');

      // Manually update session to have non-matching currentDiagramId
      sessionsStore.sessions.update((s) => {
        const sess = s.find((ss) => ss.id === session.id);
        if (sess) {
          sess.currentDiagramId = 'non-existent-version-id';
        }
        return [...s];
      });

      const result = sessionsStore.getCurrentDiagram(session.id);
      expect(result).toBeNull();
    });
  });

  describe('setSessionType', () => {
    it('should set session type', () => {
      const session = sessionsStore.createSession([]);

      sessionsStore.setSessionType(session.id, 'gAgent');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.sessionType).toBe('gAgent');
    });

    it('should update existing session type', () => {
      const session = sessionsStore.createSession([], null, 'chat');

      sessionsStore.setSessionType(session.id, 'gAgent');

      const updated = get(sessionsStore.sessions).find((s) => s.id === session.id);
      expect(updated?.sessionType).toBe('gAgent');
    });
  });

  describe('exportSession', () => {
    it('should export session with diagrams', () => {
      const mockClick = vi.fn();
      const mockRevokeObjectURL = vi.fn();
      const mockCreateObjectURL = vi.fn(() => 'blob:url');
      const mockCreateElement = vi.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      }));

      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });

      const originalCreateElement = document.createElement.bind(document);
      document.createElement = vi.fn((tag: string) => {
        if (tag === 'a') {
          return mockCreateElement() as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      const session = sessionsStore.createSession([
        { role: 'user' as const, content: 'Create diagram' },
        {
          role: 'assistant' as const,
          content:
            'Here is your diagram:\n```mermaid\ngraph TD\nA-->B\n```\nAnd another:\n```mermaid\nflowchart LR\nX-->Y\n```',
        },
      ]);

      sessionsStore.exportSession(session.id);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      // Cleanup
      vi.unstubAllGlobals();
      document.createElement = originalCreateElement;
    });

    it('should do nothing for non-existent session', () => {
      const mockCreateObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL });

      sessionsStore.exportSession('non-existent');

      expect(mockCreateObjectURL).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
