<script lang="ts">
  /**
   * Minimal UI for scheduled agents (24/7 SHIP runs).
   * List, create, cancel. Uses GET/POST/DELETE /api/agents/scheduled.
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { Card, Button, Input } from '../lib/design-system';

  interface ScheduledAgent {
    id: string;
    name: string;
    cronExpression: string;
    action: string;
    params: { projectDescription?: string; [k: string]: unknown };
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  let agents = $state<ScheduledAgent[]>([]);
  let loading = $state(true);
  let submitting = $state(false);
  let name = $state('');
  let cronExpression = $state('0 9 * * *');
  let projectDescription = $state('');

  async function load() {
    loading = true;
    try {
      const r = await fetchApi('/api/agents/scheduled');
      const data = await r.json();
      agents = Array.isArray(data) ? data : [];
    } catch {
      agents = [];
      showToast('Failed to load scheduled agents', 'error');
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  async function handleCreate() {
    const n = name.trim();
    const cron = cronExpression.trim();
    const desc = projectDescription.trim();
    if (!n || !cron) {
      showToast('Name and cron expression are required', 'error');
      return;
    }
    if (desc.length === 0) {
      showToast('Project description is required for SHIP', 'error');
      return;
    }
    submitting = true;
    try {
      const r = await fetchApi('/api/agents/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: n,
          cronExpression: cron,
          action: 'ship',
          params: { projectDescription: desc },
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        showToast(err?.error ?? 'Failed to create schedule', 'error');
        return;
      }
      showToast('Scheduled agent created', 'success');
      name = '';
      cronExpression = '0 9 * * *';
      projectDescription = '';
      await load();
    } catch {
      showToast('Failed to create scheduled agent', 'error');
    } finally {
      submitting = false;
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this scheduled agent? It will stop running.')) return;
    try {
      const r = await fetchApi(`/api/agents/scheduled/${id}`, { method: 'DELETE' });
      if (r.status === 204 || r.ok) {
        showToast('Scheduled agent cancelled', 'success');
        await load();
      } else {
        showToast('Failed to cancel', 'error');
      }
    } catch {
      showToast('Failed to cancel scheduled agent', 'error');
    }
  }
</script>

<Card title="Scheduled agents (24/7)" padding="md">
  <p class="section-desc">Run SHIP (design → spec → plan → code) on a cron schedule. Requires backend with optional Redis.</p>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else}
    <div class="agents-list">
      {#each agents as agent (agent.id)}
        <div class="agent-item">
          <div class="agent-info">
            <strong>{agent.name}</strong>
            <span class="cron">{agent.cronExpression}</span>
            {#if agent.action === 'ship' && agent.params?.projectDescription}
              <span class="desc">{agent.params.projectDescription.slice(0, 60)}{agent.params.projectDescription.length > 60 ? '…' : ''}</span>
            {/if}
          </div>
          {#if agent.enabled}
            <Button variant="ghost" size="sm" onclick={() => handleCancel(agent.id)}>Cancel</Button>
          {/if}
        </div>
      {/each}
      {#if agents.length === 0}
        <p class="muted">No scheduled agents. Add one below.</p>
      {/if}
    </div>

    <form class="add-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
      <div class="field-group">
        <label class="field-label" for="sched-name">Name</label>
        <input id="sched-name" type="text" class="custom-input" placeholder="Daily build" bind:value={name} />
      </div>
      <div class="field-group">
        <label class="field-label" for="sched-cron">Cron (e.g. 0 9 * * * = daily 9am)</label>
        <input id="sched-cron" type="text" class="custom-input" placeholder="0 9 * * *" bind:value={cronExpression} />
      </div>
      <div class="field-group">
        <label class="field-label" for="sched-desc">Project description (for SHIP)</label>
        <textarea id="sched-desc" class="custom-textarea" rows="2" placeholder="A todo app with auth" bind:value={projectDescription}></textarea>
      </div>
      <Button type="submit" variant="primary" size="sm" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add scheduled agent'}
      </Button>
    </form>
  {/if}
</Card>

<style>
  .section-desc {
    font-size: 0.875rem;
    color: var(--muted, #666);
    margin-bottom: 1rem;
  }
  .agents-list {
    margin-bottom: 1rem;
  }
  .agent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border, #eee);
  }
  .agent-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .cron {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--muted, #666);
  }
  .desc {
    font-size: 0.8rem;
    color: var(--muted, #666);
  }
  .muted {
    color: var(--muted, #666);
    font-size: 0.875rem;
  }
  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
  }
  .custom-input,
  .custom-textarea {
    padding: 0.5rem;
    border: 1px solid var(--border, #ddd);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  .custom-textarea {
    resize: vertical;
    min-height: 2.5rem;
  }
</style>
