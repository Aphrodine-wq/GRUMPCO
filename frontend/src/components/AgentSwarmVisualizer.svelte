<script lang="ts">
  import { Button, Card } from '../lib/design-system';
  import { getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { colors } from '../lib/design-system/tokens/colors.js';

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

<div class="swarm-screen" style:--bg-primary={colors.background.primary}>
  <header class="swarm-header">
    <div class="header-left">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <h1 class="swarm-title">Agent swarm</h1>
    </div>
  </header>

  <div class="swarm-container">
    <Card title="Prompt" padding="md">
      <p class="section-desc">Describe what you want. Kimi will decompose it into subtasks and run specialist agents (arch, frontend, backend, test, docs, etc.) in parallel.</p>
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
      </div>
    </Card>

    {#if error}
      <div class="result-card error">
        <p class="result-label">Error</p>
        <p class="result-text">{error}</p>
      </div>
    {/if}

    {#if tasks.length > 0}
      <Card title="Tasks" padding="md">
        <ul class="task-list">
          {#each tasks as t}
            <li class="task-item" class:done={agentStatus[t.agentId] === 'done'} class:running={agentStatus[t.agentId] === 'running'}>
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
      <Card title="Summary" padding="md">
        <div class="result-text markdown-ish">{summary}</div>
      </Card>
    {/if}
  </div>
</div>

<style>
  .swarm-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .swarm-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color, #e4e4e7);
    padding: 12px 24px;
    display: flex;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .swarm-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .swarm-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }

  .section-desc {
    font-size: 14px;
    color: #71717a;
    margin-bottom: 16px;
  }

  .prompt-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 12px;
  }

  .actions {
    margin-top: 8px;
  }

  .result-card {
    margin-top: 24px;
    padding: 20px;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }

  .result-card.error {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .result-label {
    font-size: 12px;
    font-weight: 600;
    color: #71717a;
    margin: 0 0 8px;
    text-transform: uppercase;
  }

  .result-text {
    font-size: 14px;
    line-height: 1.6;
    color: #18181b;
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
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #f4f4f5;
  }

  .task-item:last-child {
    border-bottom: none;
  }

  .agent-id {
    font-weight: 600;
    color: #52525b;
    min-width: 80px;
  }

  .task-desc {
    flex: 1;
    font-size: 13px;
    color: #18181b;
  }

  .status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .status-badge.pending {
    background: #f4f4f5;
    color: #71717a;
  }

  .status-badge.running {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-badge.done {
    background: #dcfce7;
    color: #15803d;
  }
</style>
