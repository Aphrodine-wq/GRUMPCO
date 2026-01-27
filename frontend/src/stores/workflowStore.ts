import { writable, derived } from 'svelte/store';
import type {
  WorkflowState,
  WorkflowPhase,
  GenerationPreferences,
  SystemArchitecture,
  PRD,
  CodeGenSession,
  DEFAULT_PREFERENCES
} from '../types/workflow';

// API Base URL
const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:3000';

// Create store
const state = writable<WorkflowState>({
  phase: 'idle',
  isStreaming: false,
  error: null,
  architecture: null,
  architectureRaw: '',
  prd: null,
  prdRaw: '',
  codegenSession: null,
  preferences: DEFAULT_PREFERENCES,
});

// Polling interval for codegen status
let statusPollingInterval: ReturnType<typeof setInterval> | null = null;

// Derived stores
export const phase = derived(state, s => s.phase);
export const isStreaming = derived(state, s => s.isStreaming);
export const error = derived(state, s => s.error);
export const architecture = derived(state, s => s.architecture);
export const architectureRaw = derived(state, s => s.architectureRaw);
export const prd = derived(state, s => s.prd);
export const prdRaw = derived(state, s => s.prdRaw);
export const codegenSession = derived(state, s => s.codegenSession);
export const preferences = derived(state, s => s.preferences);

export const canProceedToPrd = derived(
  [phase, architecture, isStreaming],
  ([$phase, $architecture, $isStreaming]) =>
    $phase === 'architecture' && $architecture !== null && !$isStreaming
);

export const canProceedToCodegen = derived(
  [phase, prd, isStreaming],
  ([$phase, $prd, $isStreaming]) =>
    $phase === 'prd' && $prd !== null && !$isStreaming
);

export const canDownload = derived(
  [phase, codegenSession],
  ([$phase, $codegenSession]) =>
    $phase === 'complete' && $codegenSession?.status === 'completed'
);

// PHASE 1: ARCHITECTURE GENERATION
export async function* streamArchitecture(
  projectDescription: string,
  options?: {
    projectType?: string;
    techStack?: string[];
    complexity?: string;
  }
): AsyncGenerator<string> {
  state.update(s => ({
    ...s,
    phase: 'architecture',
    isStreaming: true,
    error: null,
    architectureRaw: '',
    architecture: null,
  }));

  try {
    const response = await fetch(`${API_BASE}/api/architecture/generate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectDescription,
        projectType: options?.projectType || 'fullstack',
        techStack: options?.techStack || [],
        complexity: options?.complexity || 'mvp',
      }),
    });

    if (!response.ok) {
      throw new Error(`Architecture generation failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              state.update(s => ({
                ...s,
                architectureRaw: s.architectureRaw + parsed.text,
              }));
              yield parsed.text;
            }
            if (parsed.type === 'complete' && parsed.architecture) {
              state.update(s => ({
                ...s,
                architecture: parsed.architecture,
              }));
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    state.update(s => ({ ...s, isStreaming: false }));
  } catch (err) {
    state.update(s => ({
      ...s,
      error: err instanceof Error ? err.message : 'Unknown error',
      isStreaming: false,
    }));
    throw err;
  }
}

// PHASE 2: PRD GENERATION
export async function* streamPrd(): AsyncGenerator<string> {
  let currentArchitecture: SystemArchitecture | null = null;
  architecture.subscribe(a => {
    currentArchitecture = a;
  })();

  if (!currentArchitecture) {
    throw new Error('No architecture available - generate architecture first');
  }

  state.update(s => ({
    ...s,
    phase: 'prd',
    isStreaming: true,
    error: null,
    prdRaw: '',
    prd: null,
  }));

  try {
    const response = await fetch(`${API_BASE}/api/prd/generate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        architectureId: currentArchitecture.id,
        projectName: currentArchitecture.projectName,
        projectDescription: currentArchitecture.projectDescription,
      }),
    });

    if (!response.ok) {
      throw new Error(`PRD generation failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              state.update(s => ({
                ...s,
                prdRaw: s.prdRaw + parsed.text,
              }));
              yield parsed.text;
            }
            if (parsed.type === 'complete' && parsed.prd) {
              state.update(s => ({
                ...s,
                prd: parsed.prd,
              }));
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    state.update(s => ({ ...s, isStreaming: false }));
  } catch (err) {
    state.update(s => ({
      ...s,
      error: err instanceof Error ? err.message : 'Unknown error',
      isStreaming: false,
    }));
    throw err;
  }
}

// PHASE 3: CODE GENERATION
export async function startCodeGeneration(): Promise<void> {
  let currentArchitecture: SystemArchitecture | null = null;
  let currentPrd: PRD | null = null;
  let currentPreferences: GenerationPreferences = DEFAULT_PREFERENCES;

  architecture.subscribe(a => {
    currentArchitecture = a;
  })();
  prd.subscribe(p => {
    currentPrd = p;
  })();
  preferences.subscribe(p => {
    currentPreferences = p;
  })();

  if (!currentArchitecture || !currentPrd) {
    throw new Error('Architecture and PRD required before code generation');
  }

  state.update(s => ({
    ...s,
    phase: 'codegen',
    error: null,
  }));

  try {
    const response = await fetch(`${API_BASE}/api/codegen/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prdId: currentPrd.id,
        architectureId: currentArchitecture.id,
        preferences: currentPreferences,
        prd: currentPrd,
        architecture: currentArchitecture,
      }),
    });

    if (!response.ok) {
      throw new Error(`Code generation failed: ${response.status}`);
    }

    const data = await response.json();

    state.update(s => ({
      ...s,
      codegenSession: {
        sessionId: data.sessionId,
        status: data.status,
        progress: 0,
        agents: data.agents,
        generatedFileCount: 0,
      },
    }));

    // Start polling for status
    startStatusPolling(data.sessionId);
  } catch (err) {
    state.update(s => ({
      ...s,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
    throw err;
  }
}

function startStatusPolling(sessionId: string) {
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
  }

  statusPollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/codegen/status/${sessionId}`);
      if (!response.ok) return;

      const data = await response.json();

      state.update(s => ({
        ...s,
        codegenSession: {
          sessionId: data.sessionId,
          status: data.status,
          progress: data.progress || 0,
          agents: data.agents,
          generatedFileCount: data.generatedFileCount || 0,
          error: data.error,
        },
      }));

      if (data.status === 'completed') {
        state.update(s => ({ ...s, phase: 'complete' }));
        stopStatusPolling();
      } else if (data.status === 'failed') {
        state.update(s => ({
          ...s,
          error: data.error || 'Code generation failed',
        }));
        stopStatusPolling();
      }
    } catch (err) {
      console.error('Status polling error:', err);
    }
  }, 2000);
}

function stopStatusPolling() {
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
    statusPollingInterval = null;
  }
}

// DOWNLOAD
export async function downloadProject(): Promise<void> {
  let currentSession: CodeGenSession | null = null;
  codegenSession.subscribe(s => {
    currentSession = s;
  })();

  if (!currentSession?.sessionId) {
    throw new Error('No code generation session');
  }

  const sessionId = currentSession.sessionId;

  // TODO: Implement actual ZIP download when backend supports it
  const response = await fetch(`${API_BASE}/api/codegen/download/${sessionId}`);
  const data = await response.json();

  console.log('Download info:', data);
  alert(`Download ready: ${data.fileCount} files generated`);
}

// UTILITIES
export function reset() {
  stopStatusPolling();
  state.set({
    phase: 'idle',
    isStreaming: false,
    error: null,
    architecture: null,
    architectureRaw: '',
    prd: null,
    prdRaw: '',
    codegenSession: null,
    preferences: DEFAULT_PREFERENCES,
  });
}

export function setPreferences(prefs: Partial<GenerationPreferences>) {
  state.update(s => ({
    ...s,
    preferences: { ...s.preferences, ...prefs },
  }));
}
