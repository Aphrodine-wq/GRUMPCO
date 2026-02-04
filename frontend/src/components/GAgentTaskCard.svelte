<script lang="ts">
  /**
   * GAgentTaskCard - Individual task card for the G-Agent plan visualization
   * Shows task details, status, risk, dependencies, and real-time progress
   */
  import type { Task, TaskStatus, RiskLevel } from '../stores/gAgentPlanStore';

  interface Props {
    task: Task;
    isReady?: boolean;
    showDependencies?: boolean;
    onExecute?: (taskId: string) => void;
    onSkip?: (taskId: string) => void;
  }

  let { task, isReady = false, showDependencies = true, onExecute, onSkip }: Props = $props();

  // Status icon and color mapping
  const statusConfig: Record<
    TaskStatus,
    { icon: string; color: string; bg: string; label: string }
  > = {
    pending: { icon: '○', color: '#6B7280', bg: '#F3F4F6', label: 'Pending' },
    approved: { icon: '◎', color: '#3B82F6', bg: '#DBEAFE', label: 'Ready' },
    in_progress: { icon: '◉', color: '#F59E0B', bg: '#FEF3C7', label: 'Running' },
    completed: { icon: '●', color: '#10B981', bg: '#D1FAE5', label: 'Complete' },
    failed: { icon: '✕', color: '#EF4444', bg: '#FEE2E2', label: 'Failed' },
    skipped: { icon: '⊘', color: '#9CA3AF', bg: '#F3F4F6', label: 'Skipped' },
  };

  // Risk badge colors
  const riskConfig: Record<RiskLevel, { color: string; bg: string; label: string }> = {
    safe: { color: '#059669', bg: '#D1FAE5', label: 'Safe' },
    moderate: { color: '#D97706', bg: '#FEF3C7', label: 'Moderate' },
    risky: { color: '#DC2626', bg: '#FEE2E2', label: 'Risky' },
  };

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
  }

  function handleExecute() {
    if (onExecute) onExecute(task.id);
  }

  function handleSkip() {
    if (onSkip) onSkip(task.id);
  }

  // Computed properties
  let status = $derived(task.status ?? 'pending');
  let statusCfg = $derived(statusConfig[status]);
  let riskCfg = $derived(riskConfig[task.risk]);
  let isRunning = $derived(status === 'in_progress');
  let canExecute = $derived(isReady && status === 'approved' && onExecute);
  let canSkip = $derived(['pending', 'approved'].includes(status) && onSkip);
</script>

<div
  class="task-card"
  class:is-ready={isReady && status === 'approved'}
  class:is-running={isRunning}
  class:is-completed={status === 'completed'}
  class:is-failed={status === 'failed'}
  class:is-skipped={status === 'skipped'}
>
  <div class="task-header">
    <div class="status-indicator" style="color: {statusCfg.color}">
      <span class="status-icon" class:pulse={isRunning}>{statusCfg.icon}</span>
    </div>

    <div class="task-info">
      <div class="task-title">{task.description}</div>
      <div class="task-meta">
        <span class="task-feature">{task.feature}</span>
        <span class="task-action">/{task.action}</span>
      </div>
    </div>

    <div class="task-badges">
      <span class="risk-badge" style="color: {riskCfg.color}; background: {riskCfg.bg}">
        {riskCfg.label}
      </span>
      <span class="status-badge" style="color: {statusCfg.color}; background: {statusCfg.bg}">
        {statusCfg.label}
      </span>
    </div>
  </div>

  <div class="task-body">
    <div class="task-tools">
      <span class="tools-label">Tools:</span>
      <div class="tools-list">
        {#each task.tools as tool}
          <span class="tool-tag">{tool}</span>
        {/each}
      </div>
    </div>

    <div class="task-estimate">
      <svg class="clock-icon" viewBox="0 0 16 16" fill="currentColor">
        <path
          d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"
        />
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
      </svg>
      <span class="estimate-time">{formatDuration(task.estimated_seconds)}</span>
    </div>
  </div>

  {#if showDependencies && (task.depends_on.length > 0 || task.blocks.length > 0)}
    <div class="task-deps">
      {#if task.depends_on.length > 0}
        <div class="deps-group">
          <span class="deps-label">Depends on:</span>
          <span class="deps-list">{task.depends_on.join(', ')}</span>
        </div>
      {/if}
      {#if task.blocks.length > 0}
        <div class="deps-group">
          <span class="deps-label">Blocks:</span>
          <span class="deps-list">{task.blocks.join(', ')}</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if task.output}
    <div class="task-output">
      <div class="output-label">Output:</div>
      <pre class="output-text">{task.output}</pre>
    </div>
  {/if}

  {#if task.error}
    <div class="task-error">
      <div class="error-label">Error:</div>
      <pre class="error-text">{task.error}</pre>
    </div>
  {/if}

  {#if canExecute || canSkip}
    <div class="task-actions">
      {#if canExecute}
        <button class="btn btn-execute" onclick={handleExecute}> Execute </button>
      {/if}
      {#if canSkip}
        <button class="btn btn-skip" onclick={handleSkip}> Skip </button>
      {/if}
    </div>
  {/if}

  {#if isRunning}
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
  {/if}
</div>

<style>
  .task-card {
    background: var(--bg-secondary, #ffffff);
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .task-card:hover {
    border-color: var(--border-hover, #d1d5db);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .task-card.is-ready {
    border-color: #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
  }

  .task-card.is-running {
    border-color: #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%);
  }

  .task-card.is-completed {
    border-color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
  }

  .task-card.is-failed {
    border-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%);
  }

  .task-card.is-skipped {
    opacity: 0.6;
  }

  .task-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .status-indicator {
    flex-shrink: 0;
    font-size: 1.25rem;
    line-height: 1;
    margin-top: 2px;
  }

  .status-icon {
    display: inline-block;
  }

  .status-icon.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }

  .task-info {
    flex: 1;
    min-width: 0;
  }

  .task-title {
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }

  .task-meta {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    display: flex;
    gap: 0.25rem;
  }

  .task-feature {
    font-weight: 500;
  }

  .task-action {
    opacity: 0.7;
  }

  .task-badges {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .risk-badge,
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    text-align: center;
  }

  .task-body {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .task-tools {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .tools-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .tools-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tool-tag {
    padding: 0.125rem 0.375rem;
    background: var(--bg-tertiary, #f3f4f6);
    border-radius: 4px;
    font-size: 0.625rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary, #6b7280);
  }

  .task-estimate {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
    color: var(--text-secondary, #6b7280);
  }

  .clock-icon {
    width: 14px;
    height: 14px;
  }

  .estimate-time {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .task-deps {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-color, #e5e5e5);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .deps-group {
    display: flex;
    gap: 0.25rem;
  }

  .deps-label {
    font-weight: 500;
  }

  .deps-list {
    font-family: 'JetBrains Mono', monospace;
    opacity: 0.8;
  }

  .task-output,
  .task-error {
    margin-top: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .task-output {
    background: var(--bg-tertiary, #f3f4f6);
  }

  .task-error {
    background: #fee2e2;
  }

  .output-label,
  .error-label {
    font-weight: 600;
    margin-bottom: 0.25rem;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .error-label {
    color: #dc2626;
  }

  .output-text,
  .error-text {
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
  }

  .error-text {
    color: #991b1b;
  }

  .task-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #e5e5e5);
  }

  .btn {
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-execute {
    background: #3b82f6;
    color: white;
  }

  .btn-execute:hover {
    background: #2563eb;
  }

  .btn-skip {
    background: var(--bg-tertiary, #f3f4f6);
    color: var(--text-secondary, #6b7280);
  }

  .btn-skip:hover {
    background: #e5e7eb;
  }

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(245, 158, 11, 0.2);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    width: 30%;
    background: #f59e0b;
    animation: progress 2s ease-in-out infinite;
  }

  @keyframes progress {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }
</style>
