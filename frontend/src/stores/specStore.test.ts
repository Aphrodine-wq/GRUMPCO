/**
 * Spec Store Tests
 *
 * Comprehensive tests for specification session state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

describe('specStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
  });

  describe('initial state', () => {
    it('should have null current session', async () => {
      const { currentSession } = await import('./specStore');
      expect(get(currentSession)).toBeNull();
    });

    it('should not be loading', async () => {
      const { isSpecLoading } = await import('./specStore');
      expect(get(isSpecLoading)).toBe(false);
    });

    it('should have no error', async () => {
      const { specError } = await import('./specStore');
      expect(get(specError)).toBeNull();
    });

    it('should have empty questions', async () => {
      const { currentQuestions } = await import('./specStore');
      expect(get(currentQuestions)).toEqual([]);
    });

    it('should have empty answers', async () => {
      const { currentAnswers } = await import('./specStore');
      expect(get(currentAnswers)).toEqual({});
    });

    it('should not be complete', async () => {
      const { isComplete } = await import('./specStore');
      expect(get(isComplete)).toBe(false);
    });
  });

  describe('startSpecSession', () => {
    it('should set loading state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, isSpecLoading, clearSession } = await import('./specStore');

      type ResolveType = {
        ok: boolean;
        json: () => Promise<{
          session: { id: string; questions: unknown[]; answers: Record<string, unknown> };
        }>;
      };
      let resolvePromise: ((value: ResolveType) => void) | undefined;
      const promise = new Promise<ResolveType>((resolve) => {
        resolvePromise = resolve;
      });
      (fetchApi as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      const startPromise = startSpecSession({ userRequest: 'Test' });
      expect(get(isSpecLoading)).toBe(true);

      if (resolvePromise)
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ session: { id: '1', questions: [], answers: {} } }),
        });

      await startPromise;
      expect(get(isSpecLoading)).toBe(false);
      clearSession();
    });

    it('should update current session on success', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, currentSession, clearSession } = await import('./specStore');

      const mockSession = {
        id: 'session-1',
        questions: [{ id: 'q1', question: 'What?', required: true, order: 1 }],
        answers: {},
      };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      await startSpecSession({ userRequest: 'Build an app' });

      expect(get(currentSession)).toEqual(mockSession);
      clearSession();
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, specError, clearSession } = await import('./specStore');

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Session start failed' }),
      });

      await expect(startSpecSession({ userRequest: 'Test' })).rejects.toThrow();
      expect(get(specError)).toBe('Session start failed');
      clearSession();
    });
  });

  describe('loadSpecSession', () => {
    it('should load session by ID', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { loadSpecSession, currentSession, clearSession } = await import('./specStore');

      const mockSession = { id: 'session-123', questions: [], answers: {} };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      await loadSpecSession('session-123');

      expect(get(currentSession)?.id).toBe('session-123');
      clearSession();
    });

    it('should set error when session not found', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { loadSpecSession, specError, clearSession } = await import('./specStore');

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Session not found' }),
      });

      await expect(loadSpecSession('nonexistent')).rejects.toThrow();
      expect(get(specError)).toBe('Session not found');
      clearSession();
    });
  });

  describe('submitAnswer', () => {
    it('should submit answer and update session', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { submitAnswer, currentSession, clearSession } = await import('./specStore');

      const updatedSession = {
        id: 'session-1',
        questions: [{ id: 'q1', question: 'What?', required: true, order: 1 }],
        answers: { q1: 'My answer' },
      };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: updatedSession }),
      });

      await submitAnswer('session-1', { questionId: 'q1', value: 'My answer' });

      expect(get(currentSession)?.answers.q1).toBe('My answer');
      clearSession();
    });

    it('should set error on submission failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { submitAnswer, specError, clearSession } = await import('./specStore');

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Submission failed' }),
      });

      await expect(submitAnswer('session-1', { questionId: 'q1', value: 'x' })).rejects.toThrow();
      expect(get(specError)).toBe('Submission failed');
      clearSession();
    });
  });

  describe('generateSpecification', () => {
    it('should generate specification from session', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateSpecification, clearSession } = await import('./specStore');

      const mockSpec = { id: 'spec-1', title: 'Project Spec' };
      const updatedSession = { id: 'session-1', questions: [], answers: {} };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ specification: mockSpec, session: updatedSession }),
      });

      const result = await generateSpecification('session-1');

      expect(result.specification).toEqual(mockSpec);
      clearSession();
    });

    it('should set error on generation failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { generateSpecification, specError, clearSession } = await import('./specStore');

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Generation failed' }),
      });

      await expect(generateSpecification('session-1')).rejects.toThrow();
      expect(get(specError)).toBe('Generation failed');
      clearSession();
    });
  });

  describe('isComplete derived', () => {
    it('should be true when all required questions answered', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, isComplete, clearSession } = await import('./specStore');

      const mockSession = {
        id: 'session-1',
        questions: [
          { id: 'q1', question: 'Q1?', required: true, order: 1 },
          { id: 'q2', question: 'Q2?', required: false, order: 2 },
        ],
        answers: { q1: 'answer1' },
      };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      await startSpecSession({ userRequest: 'Test' });

      expect(get(isComplete)).toBe(true);
      clearSession();
    });

    it('should be false when required questions unanswered', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, isComplete, clearSession } = await import('./specStore');

      const mockSession = {
        id: 'session-1',
        questions: [{ id: 'q1', question: 'Q1?', required: true, order: 1 }],
        answers: {},
      };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      await startSpecSession({ userRequest: 'Test' });

      expect(get(isComplete)).toBe(false);
      clearSession();
    });
  });

  describe('getNextQuestion', () => {
    it('should return first unanswered question', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, getNextQuestion, clearSession } = await import('./specStore');

      const mockSession = {
        id: 'session-1',
        questions: [
          { id: 'q1', question: 'Q1?', required: true, order: 1 },
          { id: 'q2', question: 'Q2?', required: true, order: 2 },
        ],
        answers: { q1: 'answered' },
      };

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      await startSpecSession({ userRequest: 'Test' });

      const next = getNextQuestion();
      expect(next?.id).toBe('q2');
      clearSession();
    });

    it('should return null when no session', async () => {
      const { getNextQuestion } = await import('./specStore');
      expect(getNextQuestion()).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should reset all state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const { startSpecSession, clearSession, currentSession, isSpecLoading, specError } =
        await import('./specStore');

      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ session: { id: '1', questions: [], answers: {} } }),
      });

      await startSpecSession({ userRequest: 'Test' });
      clearSession();

      expect(get(currentSession)).toBeNull();
      expect(get(isSpecLoading)).toBe(false);
      expect(get(specError)).toBeNull();
    });
  });
});
