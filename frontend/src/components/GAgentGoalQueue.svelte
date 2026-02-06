<script lang="ts">
  /**
   * GAgentGoalQueue - Shows the G-Agent's pending and scheduled goals
   * Enables true 24/7 autonomous operation
   */
  import { onMount, onDestroy } from 'svelte';
  import type { ComponentType } from 'svelte';
  import { getApiBase } from '../lib/api.js';
  import {
    Target,
    Clock,
    Calendar,
    Brain,
    Play,
    CheckCircle,
    XCircle,
    Ban,
    Zap,
    Link,
    RefreshCw,
    Folder,
    Bot,
    Pause,
    Plus,
    X,
    RotateCcw,
    Timer,
  } from 'lucide-svelte';

  interface Goal {
    id: string;
    description: string;
    status:
      | 'pending'
      | 'scheduled'
      | 'planning'
      | 'executing'
      | 'completed'
      | 'failed'
      | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    triggerType: 'immediate' | 'scheduled' | 'webhook' | 'cron' | 'file_change' | 'self_scheduled';
    scheduledAt?: string;
    cronExpression?: string;
    nextRunAt?: string;
    parentGoalId?: string;
    tags: string[];
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    result?: string;
    error?: string;
  }

  interface QueueStats {
    pending: number;
    scheduled: number;
    planning: number;
    executing: number;
    completed: number;
    failed: number;
    totalProcessed: number;
    avgExecutionTimeMs: number;
  }

  interface Props {
    onGoalSelect?: (goal: Goal) => void;
    workspaceRoot?: string;
  }

  let { onGoalSelect, workspaceRoot }: Props = $props();

  let loading = $state(true);
  let goals = $state<Goal[]>([]);
  let stats = $state<QueueStats | null>(null);
  let queueRunning = $state(false);
  let showNewGoalForm = $state(false);
  let newGoalDescription = $state('');
  let newGoalPriority = $state<'low' | 'normal' | 'high' | 'urgent'>('normal');
  let newGoalScheduled = $state(false);
  let newGoalScheduledAt = $state('');
  let filterStatus = $state<'all' | 'active' | 'completed'>('all');
  let error = $state<string | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  const API_BASE = `${getApiBase()}/api/gagent`;

  const statusConfig: Record<string, { icon: ComponentType; color: string; label: string }> = {
    pending: { icon: Clock, color: '#f59e0b', label: 'Pending' },
    scheduled: { icon: Calendar, color: '#8b5cf6', label: 'Scheduled' },
    planning: { icon: Brain, color: '#3b82f6', label: 'Planning' },
    executing: { icon: Play, color: '#10b981', label: 'Executing' },
    completed: { icon: CheckCircle, color: '#059669', label: 'Completed' },
    failed: { icon: XCircle, color: '#ef4444', label: 'Failed' },
    cancelled: { icon: Ban, color: '#6b7280', label: 'Cancelled' },
  };

  const priorityConfig = {
    low: { color: '#6b7280', bg: '#1f2937' },
    normal: { color: '#3b82f6', bg: '#1e3a5f' },
    high: { color: '#f59e0b', bg: '#422006' },
    urgent: { color: '#ef4444', bg: '#450a0a' },
  };

  const triggerIconMap: Record<string, ComponentType> = {
    immediate: Zap,
    scheduled: Calendar,
    webhook: Link,
    cron: RefreshCw,
    file_change: Folder,
    self_scheduled: Bot,
  };

  async function fetchGoals() {
    try {
      let url = `${API_BASE}/goals`;
      if (filterStatus === 'active') {
        url += '?status=pending,scheduled,planning,executing';
      } else if (filterStatus === 'completed') {
        url += '?status=completed,failed,cancelled';
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        goals = data.goals || [];
      }
    } catch (e) {
      console.error('Failed to fetch goals:', e);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/queue/stats`);
      if (res.ok) {
        stats = await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }

  async function createGoal() {
    if (!newGoalDescription.trim()) {
      error = 'Please enter a goal description';
      return;
    }

    error = null;

    try {
      const body: Record<string, unknown> = {
        description: newGoalDescription,
        priority: newGoalPriority,
        workspaceRoot,
      };

      if (newGoalScheduled && newGoalScheduledAt) {
        body.scheduledAt = new Date(newGoalScheduledAt).toISOString();
        body.triggerType = 'scheduled';
      }

      const res = await fetch(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showNewGoalForm = false;
        newGoalDescription = '';
        newGoalPriority = 'normal';
        newGoalScheduled = false;
        newGoalScheduledAt = '';
        await fetchGoals();
        await fetchStats();
      } else {
        const data = await res.json();
        error = data.error || 'Failed to create goal';
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function cancelGoal(goalId: string) {
    try {
      const res = await fetch(`${API_BASE}/goals/${goalId}/cancel`, { method: 'POST' });
      if (res.ok) {
        await fetchGoals();
        await fetchStats();
      }
    } catch (e) {
      console.error('Failed to cancel goal:', e);
    }
  }

  async function retryGoal(goalId: string) {
    try {
      const res = await fetch(`${API_BASE}/goals/${goalId}/retry`, { method: 'POST' });
      if (res.ok) {
        await fetchGoals();
        await fetchStats();
      }
    } catch (e) {
      console.error('Failed to retry goal:', e);
    }
  }

  async function toggleQueue() {
    try {
      const endpoint = queueRunning ? 'stop' : 'start';
      const res = await fetch(`${API_BASE}/queue/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        queueRunning = !queueRunning;
      }
    } catch (e) {
      console.error('Failed to toggle queue:', e);
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (Math.abs(diffMs) < 60000) return 'just now';
    if (diffMs > 0 && diffMs < 3600000) return `in ${Math.round(diffMs / 60000)}m`;
    if (diffMs < 0 && diffMs > -3600000) return `${Math.round(-diffMs / 60000)}m ago`;

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function getFilteredGoals(): Goal[] {
    return goals;
  }

  onMount(async () => {
    loading = true;
    await Promise.all([fetchGoals(), fetchStats()]);
    loading = false;

    // Refresh every 10 seconds
    refreshInterval = setInterval(() => {
      fetchGoals();
      fetchStats();
    }, 10000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
</script>

<div class="goal-queue-panel">
  <div class="panel-header">
    <div class="header-left">
      <span class="panel-icon">
        <Target size={24} />
      </span>
      <h3>Goal Queue</h3>
      <button
        class="queue-toggle"
        class:running={queueRunning}
        onclick={toggleQueue}
        title={queueRunning ? 'Stop queue processing' : 'Start queue processing'}
      >
        {#if queueRunning}
          <Pause size={12} />
        {:else}
          <Play size={12} />
        {/if}
      </button>
    </div>

    {#if stats}
      <div class="stats-pills">
        <span class="pill pending" title="Pending">{stats.pending}</span>
        <span class="pill executing" title="Executing">{stats.executing}</span>
        <span class="pill completed" title="Completed">{stats.completed}</span>
        {#if stats.avgExecutionTimeMs > 0}
          <span class="pill avg-time" title="Avg execution time">
            <Timer size={12} />
            {formatDuration(stats.avgExecutionTimeMs)}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="toolbar">
    <div class="filter-tabs">
      <button
        class:active={filterStatus === 'all'}
        onclick={() => {
          filterStatus = 'all';
          fetchGoals();
        }}
      >
        All
      </button>
      <button
        class:active={filterStatus === 'active'}
        onclick={() => {
          filterStatus = 'active';
          fetchGoals();
        }}
      >
        Active
      </button>
      <button
        class:active={filterStatus === 'completed'}
        onclick={() => {
          filterStatus = 'completed';
          fetchGoals();
        }}
      >
        Done
      </button>
    </div>

    <button class="add-btn" onclick={() => (showNewGoalForm = true)}>
      <Plus size={14} /> New Goal
    </button>
  </div>

  {#if showNewGoalForm}
    <div class="new-goal-form">
      <div class="form-header">
        <h4>Add New Goal</h4>
        <button class="close-btn" onclick={() => (showNewGoalForm = false)}>
          <X size={18} />
        </button>
      </div>

      <textarea
        placeholder="Describe what you want G-Agent to accomplish..."
        bind:value={newGoalDescription}
        rows="3"
      ></textarea>

      <div class="form-row">
        <label>Priority:</label>
        <select bind:value={newGoalPriority}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div class="form-row">
        <label>
          <input type="checkbox" bind:checked={newGoalScheduled} />
          Schedule for later
        </label>
        {#if newGoalScheduled}
          <input type="datetime-local" bind:value={newGoalScheduledAt} />
        {/if}
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-actions">
        <button class="cancel-btn" onclick={() => (showNewGoalForm = false)}>Cancel</button>
        <button class="submit-btn" onclick={createGoal}>Add Goal</button>
      </div>
    </div>
  {/if}

  <div class="goals-list">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading goals...</p>
      </div>
    {:else if getFilteredGoals().length === 0}
      <div class="empty-state">
        <span class="empty-icon">
          <Target size={48} />
        </span>
        <p>No goals in queue</p>
        <p class="hint">Add a goal for G-Agent to work on</p>
      </div>
    {:else}
      {#each getFilteredGoals() as goal}
        <div
          class="goal-card"
          class:executing={goal.status === 'executing'}
          class:failed={goal.status === 'failed'}
          class:completed={goal.status === 'completed'}
          onclick={() => onGoalSelect?.(goal)}
          role="button"
          tabindex="0"
        >
          <div class="goal-header">
            <span class="status-icon" title={statusConfig[goal.status].label}>
              {#if statusConfig[goal.status].icon}
                {@const StatusIcon = statusConfig[goal.status].icon}
                <StatusIcon size={16} />
              {/if}
            </span>
            <span
              class="priority-badge"
              style="background: {priorityConfig[goal.priority].bg}; color: {priorityConfig[
                goal.priority
              ].color}"
            >
              {goal.priority}
            </span>
            <span class="trigger-icon" title={goal.triggerType}>
              {#if triggerIconMap[goal.triggerType]}
                {@const TriggerIcon = triggerIconMap[goal.triggerType]}
                <TriggerIcon size={12} />
              {/if}
            </span>
            {#if goal.parentGoalId}
              <span class="child-indicator" title="Created by another goal">↳</span>
            {/if}
            <span class="timestamp">{formatTime(goal.createdAt)}</span>
          </div>

          <p class="goal-description">{goal.description}</p>

          {#if goal.nextRunAt && goal.status === 'scheduled'}
            <div class="scheduled-info">
              <Calendar size={12} /> Scheduled: {formatTime(goal.nextRunAt)}
            </div>
          {/if}

          {#if goal.cronExpression}
            <div class="cron-info">
              <RefreshCw size={12} /> Repeats: <code>{goal.cronExpression}</code>
            </div>
          {/if}

          {#if goal.error}
            <div class="error-info">
              <XCircle size={12} />
              {goal.error}
            </div>
          {/if}

          {#if goal.tags.length > 0}
            <div class="tags">
              {#each goal.tags.slice(0, 3) as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          <div class="goal-actions">
            {#if goal.status === 'failed'}
              <button
                class="action-btn retry"
                onclick={(e) => {
                  e.stopPropagation();
                  retryGoal(goal.id);
                }}
              >
                <RotateCcw size={12} /> Retry
              </button>
            {/if}
            {#if ['pending', 'scheduled', 'planning', 'executing'].includes(goal.status)}
              <button
                class="action-btn cancel"
                onclick={(e) => {
                  e.stopPropagation();
                  cancelGoal(goal.id);
                }}
              >
                <X size={12} /> Cancel
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .goal-queue-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-card);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .panel-icon {
    font-size: 24px;
    color: var(--color-text-secondary);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .queue-toggle {
    width: 28px;
    height: 28px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--color-text-secondary);
    transition: all 0.2s;
  }

  .queue-toggle:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .queue-toggle.running {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
    color: #059669;
    animation: pulse-running 2s ease-in-out infinite;
  }

  @keyframes pulse-running {
    0%,
    100% {
      box-shadow: 0 0 5px rgba(16, 185, 129, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
    }
  }

  .stats-pills {
    display: flex;
    gap: 8px;
  }

  .pill {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 12px;
  }

  .pill.pending {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .pill.executing {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .pill.completed {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .pill.avg-time {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-card);
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--color-bg-secondary);
    padding: 3px;
    border-radius: 8px;
  }

  .filter-tabs button {
    padding: 6px 14px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-tabs button.active {
    background: var(--color-bg-card);
    color: var(--color-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .add-btn {
    padding: 8px 16px;
    background: #374151;
    border: none;
    color: white;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-btn:hover {
    background: #4b5563;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .new-goal-form {
    padding: 16px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .form-header h4 {
    margin: 0;
    color: var(--color-text);
    font-size: 14px;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 18px;
    cursor: pointer;
  }

  .new-goal-form textarea {
    width: 100%;
    padding: 12px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text);
    font-size: 13px;
    resize: none;
    margin-bottom: 12px;
  }

  .new-goal-form textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .form-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-row label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .form-row select,
  .form-row input[type='datetime-local'] {
    padding: 6px 12px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 12px;
  }

  .error-message {
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #ef4444;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .cancel-btn {
    padding: 8px 16px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
  }

  .submit-btn {
    padding: 8px 20px;
    background: #3b82f6;
    border: none;
    color: white;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }

  .goals-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--color-text-muted);
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(59, 130, 246, 0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .hint {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .goal-card {
    padding: 14px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .goal-card:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
  }

  .goal-card.executing {
    border-color: rgba(16, 185, 129, 0.4);
    animation: executing-glow 2s ease-in-out infinite;
  }

  @keyframes executing-glow {
    0%,
    100% {
      box-shadow: 0 0 5px rgba(16, 185, 129, 0.2);
    }
    50% {
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
    }
  }

  .goal-card.failed {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .goal-card.completed {
    opacity: 0.7;
  }

  .goal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .status-icon {
    font-size: 16px;
  }

  .priority-badge {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .trigger-icon {
    font-size: 12px;
  }

  .child-indicator {
    color: #8b5cf6;
    font-size: 14px;
  }

  .timestamp {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 11px;
  }

  .goal-description {
    margin: 0 0 10px;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.4;
  }

  .scheduled-info,
  .cron-info,
  .error-info {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    margin-bottom: 8px;
  }

  .scheduled-info {
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
  }

  .cron-info {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }

  .cron-info code {
    background: var(--color-bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--color-text);
  }

  .error-info {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .tags {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tag {
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    font-size: 10px;
    border-radius: 4px;
  }

  .goal-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .action-btn {
    padding: 4px 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 11px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .action-btn.retry {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .action-btn.cancel {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
</style>
