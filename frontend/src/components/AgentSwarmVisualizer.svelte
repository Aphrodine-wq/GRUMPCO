<script lang="ts">
  import { Button, Card } from '../lib/design-system';
  import { getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { Users } from 'lucide-svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let prompt = $state('');
  let loading = $state(false);
  let status = $state<string>('');
  let tasks = $state<Array<{ agentId: string; task: string }>>([]);
  let agentStatus = $state<Record<string, 'pending' | 'running' | 'done'>>({});
  let agentOutputs = $state<Record<string, string>>({});
  let summary = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function runSwarm() {
    if (!prompt.trim()) {
      showToast('Enter a prompt', 'error');
      return;
    }
    loading = true;
    status = 'Starting…';
    tasks = [];
    agentStatus = {};
    agentOutputs = {};
    summary = null;
    error = null;

    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/agents/swarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(5).trim();
          if (raw === '{"type":"done"}') continue;
          try {
            const ev = JSON.parse(raw) as {
              type: string;
              tasks?: Array<{ agentId: string; task: string }>;
              agentId?: string;
              task?: string;
              output?: string;
              text?: string;
              message?: string;
            };
            if (ev.type === 'decompose_start') status = 'Decomposing request…';
            if (ev.type === 'decompose_done' && ev.tasks) {
              tasks = ev.tasks;
              for (const t of ev.tasks) {
                agentStatus = { ...agentStatus, [t.agentId]: 'pending' };
              }
              status = `Running ${ev.tasks.length} agents…`;
            }
            if (ev.type === 'agent_start' && ev.agentId) {
              agentStatus = { ...agentStatus, [ev.agentId]: 'running' };
            }
            if (ev.type === 'agent_done' && ev.agentId) {
              agentStatus = { ...agentStatus, [ev.agentId]: 'done' };
              if (ev.output != null) agentOutputs = { ...agentOutputs, [ev.agentId]: ev.output };
            }
            if (ev.type === 'summary_start') status = 'Summarizing…';
            if (ev.type === 'summary_done' && ev.text != null) {
              summary = ev.text;
              status = 'Done';
            }
            if (ev.type === 'error' && ev.message) error = ev.message;
          } catch {
            // skip malformed line
          }
        }
      }
      if (!summary && !error) status = 'Done';
      showToast('Swarm completed', 'success');
    } catch (e) {
      error = (e as Error).message;
      showToast('Swarm failed', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="swarm-screen">
  <header class="swarm-header">
    <div class="header-left">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <div class="hero-section">
        <div class="hero-icon">
          <Users size={28} strokeWidth={2} />
        </div>
        <div>
          <h1 class="swarm-title">Agent Swarm</h1>
          <p class="swarm-subtitle">
            Enter a prompt → Run swarm → See decomposition, agent status, and summary. Specialist
            agents (arch, frontend, backend, test, docs) work in parallel.
          </p>
        </div>
      </div>
    </div>
  </header>

  <div class="swarm-container">
    <Card padding="md" variant="outlined" class="prompt-card">
      <h2 class="card-title">Prompt</h2>
      <p class="section-desc">
        Describe what you want. The system decomposes it into subtasks and runs specialist agents in
        parallel.
      </p>
      <textarea
        class="prompt-input"
        bind:value={prompt}
        placeholder="e.g. Design a todo app with auth and unit tests"
        rows="3"
        disabled={loading}
      ></textarea>
      <div class="actions">
        <Button variant="primary" size="md" onclick={runSwarm} disabled={loading}>
          {#if loading}
            {status}
          {:else}
            Run swarm
          {/if}
        </Button>
        {#if (summary !== null || error) && !loading}
          <Button
            variant="secondary"
            size="md"
            onclick={runSwarm}
            title="Run again with same prompt"
          >
            Run again
          </Button>
        {/if}
      </div>
    </Card>

    {#if error}
      <Card padding="md" variant="outlined" class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
        <p class="error-hint">
          Check your prompt and try again. Ensure the backend is running and API keys are
          configured.
        </p>
      </Card>
    {/if}

    {#if tasks.length > 0}
      <Card padding="md" variant="outlined">
        <h3 class="card-title">Decomposition & Agent Status</h3>
        <ul class="task-list">
          {#each tasks as t}
            <li
              class="task-item"
              class:done={agentStatus[t.agentId] === 'done'}
              class:running={agentStatus[t.agentId] === 'running'}
            >
              <span class="agent-id">{t.agentId}</span>
              <span class="task-desc">{t.task}</span>
              {#if agentStatus[t.agentId] === 'running'}
                <span class="status-badge running">running</span>
              {:else if agentStatus[t.agentId] === 'done'}
                <span class="status-badge done">done</span>
              {:else}
                <span class="status-badge pending">pending</span>
              {/if}
            </li>
          {/each}
        </ul>
      </Card>
    {/if}

    {#if summary !== null}
      <Card padding="md" variant="outlined" class="summary-card">
        <h3 class="card-title">Summary</h3>
        <div class="result-text markdown-ish">{summary}</div>
      </Card>
    {/if}

    {#if !loading && !error && tasks.length === 0 && summary === null && prompt.trim() === ''}
      <div class="empty-state">
        <p>Enter a prompt above and click <strong>Run swarm</strong> to start.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .swarm-screen {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--color-bg-subtle, #f9fafb);
    overflow: hidden;
  }

  .swarm-header {
    flex-shrink: 0;
    background: var(--color-bg-card, #ffffff);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hero-section {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .hero-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.06));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .swarm-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--color-text, #111827);
  }

  .swarm-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.5;
  }

  .swarm-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.5rem;
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 1rem;
  }

  .prompt-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
    resize: vertical;
    margin-bottom: 1rem;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #111827);
  }

  .prompt-input:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .result-card.error {
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.06));
    border-color: var(--color-error, #ef4444);
  }

  .result-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-error, #dc2626);
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }

  .error-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.75rem;
  }

  .result-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--color-text, #18181b);
    margin: 0;
    white-space: pre-wrap;
  }

  .task-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--color-border-light, #f4f4f5);
  }

  .task-item:last-child {
    border-bottom: none;
  }

  .agent-id {
    font-weight: 600;
    color: var(--color-text-muted, #52525b);
    min-width: 80px;
    font-size: 0.8125rem;
  }

  .task-desc {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--color-text, #18181b);
  }

  .status-badge {
    font-size: 0.6875rem;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .status-badge.pending {
    background: var(--color-bg-subtle, #f4f4f5);
    color: var(--color-text-muted, #71717a);
  }

  .status-badge.running {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-primary, #1d4ed8);
  }

  .status-badge.done {
    background: rgba(34, 197, 94, 0.15);
    color: #15803d;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
  }
</style>
