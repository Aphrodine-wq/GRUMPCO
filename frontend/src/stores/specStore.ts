import { writable, derived } from 'svelte/store';
import type {
  SpecSession,
  SpecQuestion,
  SpecAnswer,
  Specification,
  SpecStartRequest,
  SpecAnswerRequest,
} from '../types/spec';

const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:3000';

// Spec state
interface SpecState {
  currentSession: SpecSession | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SpecState = {
  currentSession: null,
  isLoading: false,
  error: null,
};

const state = writable<SpecState>(initialState);

// Derived stores
export const currentSession = derived(state, s => s.currentSession);
export const isSpecLoading = derived(state, s => s.isLoading);
export const specError = derived(state, s => s.error);
export const currentQuestions = derived(state, s => s.currentSession?.questions || []);
export const currentAnswers = derived(state, s => s.currentSession?.answers || {});
export const isComplete = derived(state, s => {
  if (!s.currentSession) return false;
  const required = s.currentSession.questions.filter(q => q.required);
  return required.every(q => s.currentSession!.answers[q.id] !== undefined);
});

/**
 * Start a new spec session
 */
export async function startSpecSession(request: SpecStartRequest): Promise<SpecSession> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/spec/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Spec session start failed');
    }

    const data = await response.json();
    const session = data.session;

    state.update(s => ({
      ...s,
      currentSession: session,
      isLoading: false,
      error: null,
    }));

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Load spec session by ID
 */
export async function loadSpecSession(sessionId: string): Promise<SpecSession> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/spec/${sessionId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load spec session');
    }

    const data = await response.json();
    const session = data.session;

    state.update(s => ({
      ...s,
      currentSession: session,
      isLoading: false,
      error: null,
    }));

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Submit answer to a question
 */
export async function submitAnswer(sessionId: string, answer: SpecAnswerRequest): Promise<SpecSession> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/spec/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answer),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Answer submission failed');
    }

    const data = await response.json();
    const session = data.session;

    state.update(s => ({
      ...s,
      currentSession: session,
      isLoading: false,
      error: null,
    }));

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Generate specification from answered questions
 */
export async function generateSpecification(sessionId: string): Promise<{ specification: Specification; session: SpecSession }> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/spec/${sessionId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Specification generation failed');
    }

    const data = await response.json();
    const { specification, session } = data;

    state.update(s => ({
      ...s,
      currentSession: session,
      isLoading: false,
      error: null,
    }));

    return { specification, session };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Get next unanswered question
 */
export function getNextQuestion(): SpecQuestion | null {
  let session: SpecSession | null = null;
  currentSession.subscribe(s => { session = s; })();

  if (!session) return null;

  const unanswered = session.questions
    .filter(q => !session!.answers[q.id])
    .sort((a, b) => a.order - b.order);

  return unanswered[0] || null;
}

/**
 * Clear current session
 */
export function clearSession() {
  state.set(initialState);
}
