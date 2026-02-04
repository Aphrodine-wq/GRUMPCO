/**
 * Spec Service unit tests.
 * Mocks getDatabase and getCompletion to test spec session CRUD and workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SpecSession, SpecQuestion, SpecAnswer } from '../../src/types/spec.js';

const mockSessions = new Map<string, SpecSession>();

const mockDb = {
  saveSpec: vi.fn().mockImplementation(async (session: SpecSession) => {
    mockSessions.set(session.id, { ...session });
  }),
  getSpec: vi.fn().mockImplementation(async (sessionId: string) => {
    const s = mockSessions.get(sessionId);
    return s ? { ...s } : null;
  }),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: vi.fn()
    .mockResolvedValueOnce({
      text: JSON.stringify([
        { id: 'q1', question: 'What framework?', type: 'choice', options: ['React', 'Vue'], required: true, order: 1 },
        { id: 'q2', question: 'Describe goal', type: 'text', required: true, order: 2 },
      ]),
      error: null,
    })
    .mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Test Spec',
        description: 'A test spec',
        sections: {
          overview: 'Overview',
          requirements: [],
          technicalSpecs: [],
          dataModels: [],
          apis: [],
          uiComponents: [],
          constraints: [],
          assumptions: [],
        },
      }),
      error: null,
    }),
}));

const {
  getSpecSession,
  submitAnswer,
  isSessionComplete,
  getNextQuestion,
  startSpecSession,
  generateSpecification,
} = await import('../../src/services/specService.js');

function sessionFixture(overrides: Partial<SpecSession> = {}): SpecSession {
  return {
    id: 'spec_1',
    status: 'collecting',
    originalRequest: 'Build a todo app',
    questions: [
      { id: 'q1', question: 'Framework?', type: 'choice', options: ['React', 'Vue'], required: true, order: 1 },
      { id: 'q2', question: 'Goal?', type: 'text', required: false, order: 2 },
    ],
    answers: {},
    specification: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('specService', () => {
  beforeEach(() => {
    mockSessions.clear();
    vi.clearAllMocks();
    mockDb.getSpec.mockImplementation(async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      return s ? { ...s } : null;
    });
    mockDb.saveSpec.mockImplementation(async (session: SpecSession) => {
      mockSessions.set(session.id, { ...session });
    });
  });

  describe('getSpecSession', () => {
    it('returns null for unknown session', async () => {
      const session = await getSpecSession('unknown');
      expect(session).toBeNull();
    });

    it('returns session when found', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      const got = await getSpecSession(session.id);
      expect(got).not.toBeNull();
      expect(got?.id).toBe(session.id);
      expect(got?.status).toBe('collecting');
    });
  });

  describe('submitAnswer', () => {
    it('throws when session not found', async () => {
      await expect(submitAnswer('missing', { questionId: 'q1', value: 'React' })).rejects.toThrow('not found');
    });

    it('throws when session not collecting', async () => {
      const session = sessionFixture({ status: 'generating' });
      mockSessions.set(session.id, session);
      await expect(submitAnswer(session.id, { questionId: 'q1', value: 'React' })).rejects.toThrow('Cannot submit');
    });

    it('throws when question not found', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      await expect(submitAnswer(session.id, { questionId: 'q99', value: 'x' })).rejects.toThrow('Question');
    });

    it('submits answer for choice question', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      const updated = await submitAnswer(session.id, { questionId: 'q1', value: 'React' });
      expect(updated.answers['q1']).toBeDefined();
      expect(updated.answers['q1'].value).toBe('React');
    });

    it('throws for invalid choice', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      await expect(submitAnswer(session.id, { questionId: 'q1', value: 'Angular' })).rejects.toThrow('one of');
    });
  });

  describe('isSessionComplete', () => {
    it('returns false when session not found', async () => {
      const complete = await isSessionComplete('missing');
      expect(complete).toBe(false);
    });

    it('returns false when required question unanswered', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      const complete = await isSessionComplete(session.id);
      expect(complete).toBe(false);
    });

    it('returns true when all required answered', async () => {
      const session = sessionFixture({
        answers: {
          q1: { questionId: 'q1', value: 'React', answeredAt: new Date().toISOString() },
        },
      });
      mockSessions.set(session.id, session);
      const complete = await isSessionComplete(session.id);
      expect(complete).toBe(true);
    });
  });

  describe('getNextQuestion', () => {
    it('returns null when session not found', async () => {
      const next = await getNextQuestion('missing');
      expect(next).toBeNull();
    });

    it('returns first question when none answered', async () => {
      const session = sessionFixture();
      mockSessions.set(session.id, session);
      const next = await getNextQuestion(session.id);
      expect(next?.id).toBe('q1');
    });

    it('returns null when all answered', async () => {
      const session = sessionFixture({
        answers: {
          q1: { questionId: 'q1', value: 'React', answeredAt: new Date().toISOString() },
          q2: { questionId: 'q2', value: 'Goal', answeredAt: new Date().toISOString() },
        },
      });
      mockSessions.set(session.id, session);
      const next = await getNextQuestion(session.id);
      expect(next).toBeNull();
    });
  });

  describe('startSpecSession', () => {
    it('starts session and saves to db', async () => {
      const session = await startSpecSession({ userRequest: 'Build a todo app' });
      expect(session.id).toBeDefined();
      expect(session.status).toBe('collecting');
      expect(session.questions.length).toBeGreaterThan(0);
      expect(mockDb.saveSpec).toHaveBeenCalled();
    });
  });

  describe('generateSpecification', () => {
    it('throws when session not found', async () => {
      await expect(generateSpecification({ sessionId: 'missing' })).rejects.toThrow('not found');
    });

    it('throws when session not collecting', async () => {
      const session = sessionFixture({ status: 'generating' });
      mockSessions.set(session.id, session);
      await expect(generateSpecification({ sessionId: session.id })).rejects.toThrow('Cannot generate');
    });

    it('generates spec when session complete', async () => {
      const session = sessionFixture({
        answers: {
          q1: { questionId: 'q1', value: 'React', answeredAt: new Date().toISOString() },
          q2: { questionId: 'q2', value: 'Goal', answeredAt: new Date().toISOString() },
        },
      });
      mockSessions.set(session.id, session);
      const { specification, session: updated } = await generateSpecification({ sessionId: session.id });
      expect(specification.title).toBe('Test Spec');
      expect(updated.status).toBe('completed');
      expect(updated.specification).not.toBeNull();
    });
  });
});
