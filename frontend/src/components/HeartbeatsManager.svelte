<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listHeartbeats,
    createHeartbeat,
    deleteHeartbeat,
    enableHeartbeat,
    disableHeartbeat,
    getHeartbeatTemplates,
    createFromTemplate,
    type Heartbeat,
    type HeartbeatTemplate,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';
  import EmptyState from './EmptyState.svelte';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  let heartbeats = $state<Heartbeat[]>([]);
  let templates = $state<HeartbeatTemplate[]>([]);
  let loading = $state(true);
  let showAddModal = $state(false);
  let showTemplatesModal = $state(false);
  let processing = $state(false);

  // Form state
  let name = $state('');
  let cronExpression = $state('0 9 * * *'); // Default: 9 AM daily
  let payload = $state('{}');

  // Common cron presets
  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at 9 AM', value: '0 9 * * *' },
    { label: 'Every day at 6 PM', value: '0 18 * * *' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
    { label: 'First of month at 9 AM', value: '0 9 1 * *' },
  ];

  onMount(async () => {
    await Promise.all([loadHeartbeats(), loadTemplates()]);
  });

  async function loadHeartbeats() {
    loading = true;
    try {
      heartbeats = await listHeartbeats();
    } catch (e) {
      showToast('Failed to load scheduled tasks', 'error');
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function loadTemplates() {
    try {
      templates = await getHeartbeatTemplates();
    } catch (e) {
      console.error('Failed to load templates', e);
    }
  }

  function openAddModal() {
    name = '';
    cronExpression = '0 9 * * *';
    payload = '{}';
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function handleCreate() {
    if (!name.trim() || !cronExpression.trim()) return;
    processing = true;
    try {
      let payloadObj = {};
      if (payload.trim()) {
        try {
          payloadObj = JSON.parse(payload);
        } catch {
          showToast('Invalid JSON payload', 'error');
          return;
        }
      }
      await createHeartbeat(name.trim(), cronExpression.trim(), payloadObj);
      showToast('Scheduled task created', 'success');
      closeAddModal();
      await loadHeartbeats();
    } catch (e) {
      showToast('Failed to create task', 'error');
      console.error(e);
    } finally {
      processing = false;
    }
  }

  async function handleToggle(heartbeat: Heartbeat) {
    try {
      if (heartbeat.enabled) {
        await disableHeartbeat(heartbeat.id);
        showToast('Task disabled', 'success');
      } else {
        await enableHeartbeat(heartbeat.id);
        showToast('Task enabled', 'success');
      }
      await loadHeartbeats();
    } catch (e) {
      showToast('Failed to update task', 'error');
      console.error(e);
    }
  }

  async function handleDelete(heartbeat: Heartbeat) {
    if (!confirm(`Delete "${heartbeat.name}"?`)) return;
    try {
      await deleteHeartbeat(heartbeat.id);
      showToast('Task deleted', 'success');
      await loadHeartbeats();
    } catch (e) {
      showToast('Failed to delete task', 'error');
      console.error(e);
    }
  }

  async function handleUseTemplate(template: HeartbeatTemplate) {
    processing = true;
    try {
      await createFromTemplate(template.id);
      showToast(`Created "${template.name}"`, 'success');
      showTemplatesModal = false;
      await loadHeartbeats();
    } catch (e) {
      showToast('Failed to create from template', 'error');
      console.error(e);
    } finally {
      processing = false;
    }
  }

  function formatNextRun(dateStr: string | undefined): string {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return 'Overdue';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours < 1) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h ${minutes}m`;
    return date.toLocaleDateString();
  }

  function formatLastRun(dateStr: string | undefined): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  function describeCron(cron: string): string {
    const preset = cronPresets.find((p) => p.value === cron);
    if (preset) return preset.label;
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;
    const [, hour, day, , dow] = parts;
    let desc = '';
    if (dow !== '*') desc = 'Weekly';
    else if (day !== '*') desc = 'Monthly';
    else if (hour !== '*') desc = 'Daily';
    else desc = 'Hourly';
    return desc;
  }
</script>

<div class="heartbeats-manager">
  <header class="header">
    <button class="back-btn" onclick={onBack}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>Scheduled Tasks</h1>
      <p class="subtitle">Automate recurring AI-powered tasks</p>
    </div>
    <div class="header-actions">
      {#if templates.length > 0}
        <button class="secondary-btn" onclick={() => (showTemplatesModal = true)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Templates
        </button>
      {/if}
      <button class="primary-btn" onclick={openAddModal}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Task
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading scheduled tasks...</p>
    </div>
  {:else if heartbeats.length === 0}
    <EmptyState
      headline="No scheduled tasks"
      description="Create your first automated task to get started."
    >
      <button class="primary-btn" onclick={openAddModal}>Create Task</button>
    </EmptyState>
  {:else}
    <div class="tasks-list">
      {#each heartbeats as heartbeat}
        <div class="task-card" class:disabled={!heartbeat.enabled}>
          <div class="task-header">
            <div class="task-info">
              <h3>{heartbeat.name}</h3>
              <span class="cron-badge">{describeCron(heartbeat.cronExpression)}</span>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                checked={heartbeat.enabled}
                onchange={() => handleToggle(heartbeat)}
              />
              <span class="slider"></span>
            </label>
          </div>

          <div class="task-meta">
            <div class="meta-item">
              <span class="meta-label">Schedule</span>
              <code>{heartbeat.cronExpression}</code>
            </div>
            <div class="meta-item">
              <span class="meta-label">Next Run</span>
              <span class:warning={heartbeat.enabled && heartbeat.nextRunAt}>
                {formatNextRun(heartbeat.nextRunAt)}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Last Run</span>
              <span>{formatLastRun(heartbeat.lastRunAt)}</span>
            </div>
          </div>

          <div class="task-actions">
            <button class="icon-btn" title="Edit" disabled>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="icon-btn danger" title="Delete" onclick={() => handleDelete(heartbeat)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Task Modal -->
{#if showAddModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={closeAddModal}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeAddModal()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2>New Scheduled Task</h2>

      <div class="form-group">
        <label for="name">Task Name</label>
        <input type="text" id="name" bind:value={name} placeholder="e.g., Daily standup summary" />
      </div>

      <div class="form-group">
        <label for="cron">Schedule</label>
        <select id="cron" bind:value={cronExpression}>
          {#each cronPresets as preset}
            <option value={preset.value}>{preset.label}</option>
          {/each}
        </select>
        <input type="text" bind:value={cronExpression} placeholder="0 9 * * *" class="cron-input" />
        <p class="hint">Cron expression (minute hour day month day-of-week)</p>
      </div>

      <div class="form-group">
        <label for="payload">Payload (JSON)</label>
        <textarea
          id="payload"
          bind:value={payload}
          rows="3"
          placeholder={'{"action": "summarize", "target": "slack"}'}
        ></textarea>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick={closeAddModal}>Cancel</button>
        <button
          class="submit-btn"
          onclick={handleCreate}
          disabled={!name.trim() || !cronExpression.trim() || processing}
        >
          {processing ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Templates Modal -->
{#if showTemplatesModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={() => (showTemplatesModal = false)}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showTemplatesModal = false)}
  >
    <div
      class="modal templates-modal"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2>Task Templates</h2>
      <p class="modal-desc">Quick-start with pre-configured automated tasks</p>

      <div class="templates-list">
        {#each templates as template}
          <div class="template-card">
            <h4>{template.name}</h4>
            <p>{template.description}</p>
            <div class="template-meta">
              <code>{template.cronExpression}</code>
            </div>
            <button
              class="use-template-btn"
              onclick={() => handleUseTemplate(template)}
              disabled={processing}
            >
              Use Template
            </button>
          </div>
        {/each}
      </div>

      <button class="cancel-btn full-width" onclick={() => (showTemplatesModal = false)}>
        Close
      </button>
    </div>
  </div>
{/if}

<style>
  .heartbeats-manager {
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: #f9fafb;
  }

  .header-content {
    flex: 1;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .primary-btn,
  .secondary-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn {
    background: #6366f1;
    color: white;
  }

  .primary-btn:hover {
    background: #4f46e5;
  }

  .secondary-btn {
    background: white;
    border: 1px solid #e5e7eb;
    color: #374151;
  }

  .secondary-btn:hover {
    background: #f9fafb;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .task-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.2s;
  }

  .task-card.disabled {
    opacity: 0.6;
    background: #f9fafb;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .task-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .task-info h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .cron-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #ede9fe;
    color: #7c3aed;
    border-radius: 4px;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #e5e7eb;
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #10b981;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .task-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-label {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .meta-item code {
    font-size: 0.75rem;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .warning {
    color: #f59e0b;
  }

  .task-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .icon-btn {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background: #f9fafb;
    color: #374151;
  }

  .icon-btn.danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .templates-modal {
    max-width: 600px;
  }

  .modal h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: #111827;
  }

  .modal-desc {
    color: #6b7280;
    margin: -0.5rem 0 1.25rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #6366f1;
  }

  .cron-input {
    margin-top: 0.5rem;
    font-family: monospace;
  }

  .hint {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0.5rem 0 0;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .cancel-btn,
  .submit-btn {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: #f3f4f6;
    color: #374151;
  }

  .cancel-btn:hover {
    background: #e5e7eb;
  }

  .cancel-btn.full-width {
    width: 100%;
    margin-top: 1rem;
  }

  .submit-btn {
    background: #6366f1;
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: #4f46e5;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .templates-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .template-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
  }

  .template-card h4 {
    margin: 0 0 0.5rem;
    color: #111827;
  }

  .template-card p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .template-meta {
    margin-bottom: 0.75rem;
  }

  .template-meta code {
    font-size: 0.75rem;
    background: #e5e7eb;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .use-template-btn {
    width: 100%;
    padding: 0.5rem;
    font-size: 0.875rem;
    background: white;
    border: 1px solid #6366f1;
    color: #6366f1;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .use-template-btn:hover:not(:disabled) {
    background: #6366f1;
    color: white;
  }

  .use-template-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .heartbeats-manager {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .task-meta {
      grid-template-columns: 1fr;
    }
  }
</style>
