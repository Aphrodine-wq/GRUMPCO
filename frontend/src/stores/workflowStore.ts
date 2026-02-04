import { writable, derived, get } from 'svelte/store';
import { fetchApi, getApiBase } from '../lib/api.js';
import { getCurrentProjectId } from './projectStore.js';
import { DEFAULT_PREFERENCES } from '../types/workflow';
import type { WorkflowState, GenerationPreferences } from '../types/workflow';

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
// SSE for codegen.ready / codegen.failed
let codegenEventSource: EventSource | null = null;

// Derived stores
export const phase = derived(state, (s) => s.phase);
export const isStreaming = derived(state, (s) => s.isStreaming);
export const error = derived(state, (s) => s.error);
export const architecture = derived(state, (s) => s.architecture);
export const architectureRaw = derived(state, (s) => s.architectureRaw);
export const prd = derived(state, (s) => s.prd);
export const prdRaw = derived(state, (s) => s.prdRaw);
export const codegenSession = derived(state, (s) => s.codegenSession);
export const preferences = derived(state, (s) => s.preferences);

const EVENT_MODE = import.meta.env?.VITE_EVENT_MODE ?? 'sse';

export const canProceedToPrd = derived(
  [phase, architecture, isStreaming],
  ([$phase, $architecture, $isStreaming]) =>
    $phase === 'architecture' && $architecture !== null && !$isStreaming
);

export const canProceedToCodegen = derived(
  [phase, prd, isStreaming],
  ([$phase, $prd, $isStreaming]) => $phase === 'prd' && $prd !== null && !$isStreaming
);

export const canDownload = derived(
  [phase, codegenSession],
  ([$phase, $codegenSession]) => $phase === 'complete' && $codegenSession?.status === 'completed'
);

// PHASE 1: ARCHITECTURE GENERATION
export async function* streamArchitecture(
  projectDescription: string,
  options?: {
    projectType?: string;
    techStack?: string[];
    complexity?: string;
    demo?: boolean;
  }
): AsyncGenerator<string> {
  state.update((s) => ({
    ...s,
    phase: 'architecture',
    isStreaming: true,
    error: null,
    architectureRaw: '',
    architecture: null,
  }));

  try {
    const response = await fetchApi('/api/architecture/generate-stream', {
      method: 'POST',
      body: JSON.stringify({
        projectDescription,
        projectType: options?.projectType || 'fullstack',
        techStack: options?.techStack || [],
        complexity: options?.complexity || 'mvp',
        demo: options?.demo === true,
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
              state.update((s) => ({
                ...s,
                architectureRaw: s.architectureRaw + parsed.text,
              }));
              yield parsed.text;
            }
            if (parsed.type === 'complete' && parsed.architecture) {
              state.update((s) => ({
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

    state.update((s) => ({ ...s, isStreaming: false }));
  } catch (err) {
    state.update((s) => ({
      ...s,
      error: err instanceof Error ? err.message : 'Unknown error',
      isStreaming: false,
    }));
    throw err;
  }
}

// PHASE 2: PRD GENERATION
export async function* streamPrd(options?: { demo?: boolean }): AsyncGenerator<string> {
  const currentArchitecture = get(architecture);

  if (!currentArchitecture) {
    throw new Error('No architecture available - generate architecture first');
  }

  state.update((s) => ({
    ...s,
    phase: 'prd',
    isStreaming: true,
    error: null,
    prdRaw: '',
    prd: null,
  }));

  try {
    const response = await fetchApi('/api/prd/generate-stream', {
      method: 'POST',
      body: JSON.stringify({
        architectureId: currentArchitecture.id,
        projectName: currentArchitecture.projectName,
        projectDescription: currentArchitecture.projectDescription,
        architecture: currentArchitecture,
        demo: options?.demo === true,
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
              state.update((s) => ({
                ...s,
                prdRaw: s.prdRaw + parsed.text,
              }));
              yield parsed.text;
            }
            if (parsed.type === 'complete' && parsed.prd) {
              state.update((s) => ({
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

    state.update((s) => ({ ...s, isStreaming: false }));
  } catch (err) {
    state.update((s) => ({
      ...s,
      error: err instanceof Error ? err.message : 'Unknown error',
      isStreaming: false,
    }));
    throw err;
  }
}

// PHASE 3: CODE GENERATION
/** projectIdOverride: when starting from chat, pass currentSession.projectId to unify project context. */
export async function startCodeGeneration(projectIdOverride?: string | null): Promise<void> {
  const currentArchitecture = get(architecture);
  const currentPrd = get(prd);
  const currentPreferences = get(preferences);

  if (!currentArchitecture || !currentPrd) {
    throw new Error('Architecture and PRD required before code generation');
  }

  const projectId = projectIdOverride ?? getCurrentProjectId() ?? undefined;

  state.update((s) => ({
    ...s,
    phase: 'codegen',
    error: null,
  }));

  try {
    const response = await fetchApi('/api/codegen/start', {
      method: 'POST',
      body: JSON.stringify({
        prdId: currentPrd.id,
        architectureId: currentArchitecture.id,
        preferences: currentPreferences,
        prd: currentPrd,
        architecture: currentArchitecture,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Code generation failed: ${response.status}`);
    }

    const data = await response.json();

    state.update((s) => ({
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
    // Subscribe to SSE for codegen.ready / codegen.failed
    if (EVENT_MODE !== 'poll' && typeof EventSource !== 'undefined') {
      const url =
        getApiBase() + '/api/events/stream?sessionId=' + encodeURIComponent(data.sessionId);
      const es = new EventSource(url);
      codegenEventSource = es;
      es.onmessage = (e: MessageEvent) => {
        try {
          const { event, payload } = JSON.parse(e.data);
          if (payload?.sessionId !== data.sessionId) return;
          if (event === 'codegen.ready') {
            fetchApi(`/api/codegen/status/${data.sessionId}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                if (d) {
                  state.update((s) => ({
                    ...s,
                    codegenSession: {
                      sessionId: d.sessionId,
                      status: d.status,
                      progress: d.progress || 0,
                      agents: d.agents,
                      generatedFileCount: d.generatedFileCount || 0,
                      error: d.error,
                    },
                    phase: 'complete',
                  }));
                  if (typeof window !== 'undefined')
                    (
                      window as {
                        grump?: { notify?: (t: string, b: string, tag?: string) => void };
                      }
                    ).grump?.notify?.('G-Rump', 'Code generation ready', 'codegen');
                }
                stopCodegenEventSource();
                stopStatusPolling();
              });
          } else if (event === 'codegen.failed') {
            const errMsg = (payload.error as string) || 'Code generation failed';
            state.update((s) => ({
              ...s,
              error: errMsg,
            }));
            if (typeof window !== 'undefined')
              (
                window as { grump?: { notify?: (t: string, b: string, tag?: string) => void } }
              ).grump?.notify?.('G-Rump', errMsg, 'codegen');
            stopCodegenEventSource();
            stopStatusPolling();
          }
        } catch (err) {
          // Failed to parse codegen event from stream - don't break event handling
          console.warn(
            'Failed to parse codegen event:',
            err instanceof Error ? err.message : String(err)
          );
        }
      };
      es.onerror = () => stopCodegenEventSource();
    }
  } catch (err) {
    state.update((s) => ({
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
      const response = await fetchApi(`/api/codegen/status/${sessionId}`);
      if (!response.ok) return;

      const data = await response.json();

      state.update((s) => ({
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
        state.update((s) => ({ ...s, phase: 'complete' }));
        if (typeof window !== 'undefined')
          (
            window as { grump?: { notify?: (t: string, b: string, tag?: string) => void } }
          ).grump?.notify?.('G-Rump', 'Code generation ready', 'codegen');
        stopStatusPolling();
        stopCodegenEventSource();
      } else if (data.status === 'failed') {
        const errMsg = data.error || 'Code generation failed';
        state.update((s) => ({
          ...s,
          error: errMsg,
        }));
        if (typeof window !== 'undefined')
          (
            window as { grump?: { notify?: (t: string, b: string, tag?: string) => void } }
          ).grump?.notify?.('G-Rump', errMsg, 'codegen');
        stopStatusPolling();
        stopCodegenEventSource();
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

function stopCodegenEventSource() {
  if (codegenEventSource) {
    codegenEventSource.close();
    codegenEventSource = null;
  }
}

// DOWNLOAD
function parseDownloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'generated-project.zip';
  const quoted = contentDisposition.match(/filename="([^"]*)"/);
  if (quoted?.[1]) return decodeURIComponent(quoted[1].replace(/^"(.*)"$/, '$1'));
  const encoded = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/);
  if (encoded?.[1]) return decodeURIComponent(encoded[1].trim());
  return 'generated-project.zip';
}

export async function downloadProject(): Promise<void> {
  const currentSession = get(codegenSession);

  if (!currentSession?.sessionId) {
    throw new Error('No code generation session');
  }

  const sessionId = currentSession.sessionId;

  try {
    const response = await fetchApi(`/api/codegen/download/${sessionId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: string }).error ?? `Download failed: ${response.status}`;
      state.update((s) => ({ ...s, error: message }));
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    const filename = parseDownloadFilename(disposition);

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    if (
      err instanceof Error &&
      !(err.message.startsWith('Download failed') || err.message.startsWith('No code generation'))
    ) {
      state.update((s) => ({ ...s, error: err.message }));
    }
    throw err;
  }
}

/**
 * Run demo mode: Architecture → PRD with prebaked sample data (no LLM calls).
 * Call this then read architecture/prd from the store to show in UI.
 */
export async function runDemo(): Promise<void> {
  const DEMO_DESCRIPTION = 'A simple todo app with user authentication and real-time sync.';
  for await (const _ of streamArchitecture(DEMO_DESCRIPTION, { demo: true })) {
    // consume stream
  }
  for await (const _ of streamPrd({ demo: true })) {
    // consume stream
  }
}

/**
 * Run full demo: Architecture → Spec (PRD) → Plan → Code.
 * Uses prebaked Architecture and PRD, then starts code generation.
 * Single "Run full demo" flow for guided walkthrough.
 */
export async function runFullDemoMode(): Promise<void> {
  await runDemo();
  await startCodeGeneration();
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
  state.update((s) => ({
    ...s,
    preferences: { ...s.preferences, ...prefs },
  }));
}

/** Export current architecture as JSON download. */
export function exportArchitectureJson(): void {
  const arch = get(architecture);
  if (!arch) return;
  const blob = new Blob([JSON.stringify(arch, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `architecture-${arch.id || 'export'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export current PRD as Markdown download. */
export function exportPrdMarkdown(): void {
  const prdDoc = get(prd);
  if (!prdDoc) return;
  const lines: string[] = [`# ${prdDoc.projectName}`, '', prdDoc.projectDescription, '', '---', ''];
  const o = prdDoc.sections?.overview;
  if (o) {
    lines.push('## Overview');
    lines.push('');
    lines.push(`**Vision:** ${o.vision}`);
    lines.push('');
    lines.push(`**Problem:** ${o.problem}`);
    lines.push('');
    lines.push(`**Solution:** ${o.solution}`);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prd-${prdDoc.id || 'export'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Create shareable link for architecture. Returns full URL or null on error. */
export async function shareArchitectureLink(): Promise<string | null> {
  const arch = get(architecture);
  if (!arch) return null;
  try {
    const { createShareLink, getApiBase } = await import('../lib/api.js');
    const base = getApiBase();
    const mermaidCode = arch.c4Diagrams?.context ?? arch.c4Diagrams?.container ?? '';
    const { shareId } = await createShareLink({
      type: 'architecture',
      content: JSON.stringify(arch),
      title: arch.projectName,
      mermaidCode: mermaidCode || undefined,
      expiresIn: 168,
    });
    return `${base}/api/share/${shareId}`;
  } catch {
    return null;
  }
}

/** Create shareable link for PRD. Returns full URL or null on error. */
export async function sharePrdLink(): Promise<string | null> {
  const prdDoc = get(prd);
  if (!prdDoc) return null;
  const lines: string[] = [`# ${prdDoc.projectName}`, '', prdDoc.projectDescription, '', '---', ''];
  const o = prdDoc.sections?.overview;
  if (o) {
    lines.push('## Overview');
    lines.push('');
    lines.push(`**Vision:** ${o.vision}`);
    lines.push('');
    lines.push(`**Problem:** ${o.problem}`);
    lines.push('');
    lines.push(`**Solution:** ${o.solution}`);
  }
  const content = lines.join('\n');
  try {
    const { createShareLink, getApiBase } = await import('../lib/api.js');
    const base = getApiBase();
    const { shareId } = await createShareLink({
      type: 'prd',
      content,
      title: prdDoc.projectName,
      expiresIn: 168,
    });
    return `${base}/api/share/${shareId}`;
  } catch {
    return null;
  }
}
