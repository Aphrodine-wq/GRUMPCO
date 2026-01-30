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
      expect(session.name).toBe('New Session');
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
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.messages).toEqual(newMessages);
    });

    it('should update session name from default', () => {
      const session = sessionsStore.createSession([]);
      expect(session.name).toBe('New Session');
      
      sessionsStore.updateSession(session.id, [
        { role: 'user' as const, content: 'My first message' }
      ]);
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.name).toBe('My first message');
    });

    it('should update updatedAt timestamp', () => {
      const session = sessionsStore.createSession([]);
      const originalTime = session.updatedAt;
      
      // Wait a tiny bit
      vi.advanceTimersByTime(100);
      
      sessionsStore.updateSession(session.id, [
        { role: 'user' as const, content: 'Update' }
      ]);
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalTime);
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
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.name).toBe('My Custom Name');
    });

    it('should default to Untitled if empty name', () => {
      const session = sessionsStore.createSession([]);
      
      sessionsStore.renameSession(session.id, '   ');
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.name).toBe('Untitled Session');
    });

    it('should trim whitespace from name', () => {
      const session = sessionsStore.createSession([]);
      
      sessionsStore.renameSession(session.id, '  Trimmed Name  ');
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.name).toBe('Trimmed Name');
    });
  });

  describe('switchSession', () => {
    it('should switch to specified session', () => {
      const session1 = sessionsStore.createSession([]);
      const session2 = sessionsStore.createSession([]);
      
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
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.projectId).toBe('project-123');
    });

    it('should clear project ID when null', () => {
      const session = sessionsStore.createSession([], 'project-123');
      
      sessionsStore.setSessionProjectId(session.id, null);
      
      const updated = get(sessionsStore.sessions).find(s => s.id === session.id);
      expect(updated?.projectId).toBeUndefined();
    });
  });

  describe('sortedSessions', () => {
    it('should sort by updatedAt descending', async () => {
      const session1 = sessionsStore.createSession([]);
      
      // Advance time
      await new Promise(r => setTimeout(r, 10));
      
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
        { role: 'assistant' as const, content: '```mermaid\ngraph TD\nA-->B\n```' }
      ]);
      
      expect(sessionHasDiagram(session)).toBe(true);
    });

    it('should return false if no diagram', () => {
      const session = sessionsStore.createSession([
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]);
      
      expect(sessionHasDiagram(session)).toBe(false);
    });
  });

  describe('getFirstDiagramCode', () => {
    it('should extract first diagram code', () => {
      const session = sessionsStore.createSession([
        { role: 'assistant' as const, content: '```mermaid\ngraph TD\nA-->B\n```' }
      ]);
      
      expect(getFirstDiagramCode(session)).toBe('graph TD\nA-->B');
    });

    it('should return null if no diagram', () => {
      const session = sessionsStore.createSession([
        { role: 'assistant' as const, content: 'No diagram here' }
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
      
      const success = sessionsStore.revertToDiagramVersion(session.id, v1!.id);
      
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
        content: `Message ${i}`
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
      
      const parsed = JSON.parse(stored!);
      expect(parsed.sessions).toHaveLength(1);
    });
  });
});
