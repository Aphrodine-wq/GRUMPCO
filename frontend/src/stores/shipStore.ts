import { writable } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import type { ShipSession, ShipPhase, ShipStartRequest, ShipStreamEvent } from '../types/ship.js';

export interface ExecuteStreamOptions {
  resumeFromPhase?: ShipPhase;
}

interface ShipState {
  session: ShipSession | null;
  phase: ShipPhase;
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  error: string | null;
  isStreaming: boolean;
}

const initialState: ShipState = {
  session: null,
  phase: 'design',
  status: 'idle',
  error: null,
  isStreaming: false,
};

const state = writable<ShipState>(initialState);
const EVENT_MODE = import.meta.env?.VITE_EVENT_MODE ?? 'sse';
const USE_POLLING = EVENT_MODE === 'poll';

export const shipStore = {
  subscribe: state.subscribe,

  /**
   * Start a new SHIP mode session
   */
  async start(request: ShipStartRequest): Promise<ShipSession> {
    try {
      state.update((s) => ({ ...s, status: 'running', error: null }));

      const response = await fetchApi('/api/ship/start', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start SHIP mode');
      }

      const data = await response.json();
      const session: ShipSession = {
        id: data.sessionId,
        projectDescription: request.projectDescription,
        phase: data.phase,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.createdAt,
        preferences: request.preferences,
      };

      state.update((s) => ({ ...s, session, phase: session.phase }));
      return session;
    } catch (error) {
      const err = error as Error;
      state.update((s) => ({ ...s, status: 'failed', error: err.message }));
      throw error;
    }
  },

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<ShipSession> {
    try {
      const response = await fetchApi(`/api/ship/${sessionId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get session');
      }

      const data = await response.json();
      const session: ShipSession = {
        id: data.sessionId,
        projectDescription: data.projectDescription || '',
        phase: data.phase,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        designResult: data.designResult,
        specResult: data.specResult,
        planResult: data.planResult,
        codeResult: data.codeResult,
        error: data.error,
        preferences: data.preferences,
      };

      state.update((s) => ({ ...s, session, phase: session.phase, status: session.status }));
      return session;
    } catch (error) {
      const err = error as Error;
      state.update((s) => ({ ...s, error: err.message }));
      throw error;
    }
  },

  /**
   * Execute SHIP mode workflow (non-streaming)
   */
  async execute(sessionId: string): Promise<void> {
    try {
      state.update((s) => ({ ...s, status: 'running', error: null }));

      const response = await fetchApi(`/api/ship/${sessionId}/execute`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute SHIP mode');
      }

      // Poll for status updates
      this.pollStatus(sessionId);
    } catch (error) {
      const err = error as Error;
      state.update((s) => ({ ...s, status: 'failed', error: err.message }));
      throw error;
    }
  },

  /**
   * Execute SHIP mode workflow with streaming
   * @param options.resumeFromPhase - Optional phase to resume from (design, spec, plan, code)
   */
  async executeStream(
    sessionId: string,
    onUpdate?: (data: ShipStreamEvent) => void,
    options?: ExecuteStreamOptions
  ): Promise<void> {
    try {
      if (USE_POLLING) {
        await this.execute(sessionId);
        return;
      }
      state.update((s) => ({ ...s, status: 'running', isStreaming: true, error: null }));
      const query = options?.resumeFromPhase
        ? `?resumeFromPhase=${encodeURIComponent(options.resumeFromPhase)}`
        : '';
      const response = await fetchApi(`/api/ship/${sessionId}/execute/stream${query}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start streaming execution');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          state.update((s) => ({ ...s, isStreaming: false, status: 'completed' }));
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onUpdate?.(data);

              // Update state based on events
              if (data.type === 'phase_start') {
                state.update((s) => ({ ...s, phase: data.phase }));
              } else if (data.type === 'phase_complete') {
                state.update((s) => ({
                  ...s,
                  phase: data.phase,
                  session: s.session
                    ? {
                        ...s.session,
                        [`${data.phase}Result`]: data.result,
                        phase: data.nextPhase || s.session.phase,
                      }
                    : s.session,
                }));
              } else if (data.type === 'complete') {
                state.update((s) => ({ ...s, status: 'completed', isStreaming: false }));
              } else if (data.type === 'error') {
                state.update((s) => ({
                  ...s,
                  status: 'failed',
                  error: data.error,
                  isStreaming: false,
                  ...(data.phase && { phase: data.phase }),
                }));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      state.update((s) => ({ ...s, status: 'failed', error: err.message, isStreaming: false }));
      throw error;
    }
  },

  /**
   * Poll for session status updates
   */
  pollStatus(sessionId: string): void {
    const interval = setInterval(async () => {
      try {
        const session = await this.getSession(sessionId);

        if (session.status === 'completed' || session.status === 'failed') {
          clearInterval(interval);
          state.update((s) => ({ ...s, status: session.status }));
        }
      } catch (error) {
        console.error('Failed to poll session status:', error);
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds
  },

  /**
   * Reset store to initial state
   */
  reset(): void {
    state.set(initialState);
  },
};

export const shipSession = {
  subscribe: state.subscribe,
  get value(): ShipState {
    let val: ShipState = initialState;
    state.subscribe((v) => (val = v))();
    return val;
  },
};
