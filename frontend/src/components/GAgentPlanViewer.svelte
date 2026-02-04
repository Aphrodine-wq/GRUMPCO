<script lang="ts">
  /**
   * GAgentPlanViewer - Plan visualization component for G-Agent
   * Shows task DAG, parallel batches, progress, and approval controls
   * Supports real-time SSE execution updates
   */
  import {
    gAgentPlanStore,
    currentPlan,
    executionProgress,
    readyTasks,
    isExecuting,
    type PlanStatus,
    type RiskLevel,
  } from '../stores/gAgentPlanStore';
  import GAgentTaskCard from './GAgentTaskCard.svelte';

  interface Props {
    onApprove?: () => void;
    onCancel?: () => void;
    onExecuteTask?: (taskId: string) => void;
    onSkipTask?: (taskId: string) => void;
    workspaceRoot?: string;
    compact?: boolean;
  }

  let {
    onApprove,
    onCancel,
    onExecuteTask,
    onSkipTask,
    workspaceRoot,
    compact = false,
  }: Props = $props();

  let expandedBatch = $state<number | null>(0);
  let executionError = $state<string | null>(null);

  // Status configuration
  const statusConfig: Record<
    PlanStatus,
    { icon: string; color: string; bg: string; label: string }
  > = {
    awaiting_approval: { icon: '⏳', color: '#F59E0B', bg: '#FEF3C7', label: 'Awaiting Approval' },
    approved: { icon: '✓', color: '#10B981', bg: '#D1FAE5', label: 'Approved' },
    executing: { icon: '▶', color: '#3B82F6', bg: '#DBEAFE', label: 'Executing' },
    completed: { icon: '●', color: '#10B981', bg: '#D1FAE5', label: 'Completed' },
    failed: { icon: '✕', color: '#EF4444', bg: '#FEE2E2', label: 'Failed' },
    cancelled: { icon: '⊘', color: '#6B7280', bg: '#F3F4F6', label: 'Cancelled' },
  };

  const riskConfig: Record<RiskLevel, { color: string; bg: string; label: string }> = {
    safe: { color: '#059669', bg: '#D1FAE5', label: 'Low Risk' },
    moderate: { color: '#D97706', bg: '#FEF3C7', label: 'Moderate Risk' },
    risky: { color: '#DC2626', bg: '#FEE2E2', label: 'High Risk' },
  };

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
  }

  function toggleBatch(index: number) {
    expandedBatch = expandedBatch === index ? null : index;
  }

  function handleApprove() {
    gAgentPlanStore.approvePlan();
    if (onApprove) onApprove();
  }

  async function handleStartExecution() {
    executionError = null;
    try {
      await gAgentPlanStore.executeCurrentPlan(workspaceRoot);
    } catch (error) {
      executionError = error instanceof Error ? error.message : 'Execution failed';
    }
  }

  async function handleCancel() {
    if ($isExecuting) {
      await gAgentPlanStore.cancelExecution();
    } else {
      gAgentPlanStore.cancelPlan();
    }
    if (onCancel) onCancel();
  }

  function handleClear() {
    gAgentPlanStore.clearPlan();
  }

  function handleExecuteTask(taskId: string) {
    gAgentPlanStore.updateTaskStatus(taskId, 'in_progress');
    if (onExecuteTask) onExecuteTask(taskId);
  }

  function handleSkipTask(taskId: string) {
    gAgentPlanStore.updateTaskStatus(taskId, 'skipped');
    gAgentPlanStore.updateReadyTasks();
    if (onSkipTask) onSkipTask(taskId);
  }

  // Derived values
  let plan = $derived($currentPlan);
  let progress = $derived($executionProgress);
  let ready = $derived($readyTasks);
  let executing = $derived($isExecuting);
  let statusCfg = $derived(plan ? statusConfig[plan.status] : null);
  let riskCfg = $derived(plan ? riskConfig[plan.risk.level] : null);
  let canApprove = $derived(plan?.status === 'awaiting_approval');
  let canExecute = $derived(plan?.status === 'approved' && !executing);
  let canCancel = $derived(
    plan && ['awaiting_approval', 'approved', 'executing'].includes(plan.status)
  );
  let isDone = $derived(plan && ['completed', 'failed', 'cancelled'].includes(plan.status));
</script>

{#if plan}
  <div class="plan-viewer" class:compact>
    <!-- Header -->
    <div class="plan-header">
      <div class="plan-info">
        <h3 class="plan-goal">{plan.goal}</h3>
        <div class="plan-meta">
          <span class="meta-item">
            <span class="meta-label">Tasks:</span>
            <span class="meta-value">{plan.tasks.length}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">Est:</span>
            <span class="meta-value">{formatDuration(plan.estimated_duration)}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">Confidence:</span>
            <span class="meta-value">{Math.round(plan.confidence * 100)}%</span>
          </span>
          <span class="meta-item tech-stack">
            {#each plan.tech_stack.slice(0, 3) as tech}
              <span class="tech-tag">{tech}</span>
            {/each}
            {#if plan.tech_stack.length > 3}
              <span class="tech-more">+{plan.tech_stack.length - 3}</span>
            {/if}
          </span>
        </div>
      </div>

      <div class="plan-badges">
        {#if statusCfg}
          <span class="status-badge" style="color: {statusCfg.color}; background: {statusCfg.bg}">
            <span class="badge-icon">{statusCfg.icon}</span>
            {statusCfg.label}
          </span>
        {/if}
        {#if riskCfg}
          <span class="risk-badge" style="color: {riskCfg.color}; background: {riskCfg.bg}">
            {riskCfg.label}
          </span>
        {/if}
      </div>
    </div>

    <!-- Risk Assessment -->
    {#if plan.status === 'awaiting_approval' && plan.risk.risk_factors.length > 0}
      <div class="risk-assessment">
        <div class="risk-header">
          <span class="risk-title">Risk Assessment</span>
          {#if plan.risk.auto_approvable}
            <span class="auto-approve-badge">Auto-approvable</span>
          {/if}
        </div>
        <ul class="risk-factors">
          {#each plan.risk.risk_factors as factor}
            <li>{factor}</li>
          {/each}
        </ul>
        <div class="risk-counts">
          <span class="risk-count safe">{plan.risk.safe_count} Safe</span>
          <span class="risk-count moderate">{plan.risk.moderate_count} Moderate</span>
          <span class="risk-count risky">{plan.risk.risky_count} Risky</span>
        </div>
      </div>
    {/if}

    <!-- Progress Bar -->
    {#if plan.status === 'executing' || isDone}
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Progress</span>
          <span class="progress-count">{progress.completed} / {progress.total}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            class:completed={plan.status === 'completed'}
            class:failed={plan.status === 'failed'}
            style="width: {progress.percent}%"
          ></div>
        </div>
      </div>
    {/if}

    <!-- Parallel Batches -->
    <div class="batches-section">
      <div class="batches-header">
        <span class="batches-title">Execution Plan</span>
        <span class="batches-info">{plan.parallel_batches.length} batches</span>
      </div>

      <div class="batches-list">
        {#each plan.parallel_batches as batch, batchIndex (batchIndex)}
          {@const batchTasks = batch
            .map((id) => plan.tasks.find((t) => t.id === id))
            .filter(Boolean)}
          {@const isExpanded = expandedBatch === batchIndex}
          {@const completedCount = batchTasks.filter((t) => t?.status === 'completed').length}
          {@const isCurrentBatch = plan.current_batch === batchIndex}

          <div class="batch" class:expanded={isExpanded} class:current={isCurrentBatch}>
            <div
              class="batch-header"
              role="button"
              tabindex="0"
              onclick={() => toggleBatch(batchIndex)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleBatch(batchIndex);
                }
              }}
            >
              <div class="batch-info">
                <span class="batch-number">Batch {batchIndex + 1}</span>
                <span class="batch-count">{batch.length} task{batch.length !== 1 ? 's' : ''}</span>
                {#if batch.length > 1}
                  <span class="parallel-badge">Parallel</span>
                {/if}
              </div>
              <div class="batch-status">
                <span class="batch-progress">{completedCount}/{batch.length}</span>
                <svg
                  class="expand-icon"
                  class:expanded={isExpanded}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {#if isExpanded}
              <div class="batch-tasks">
                {#each batchTasks as task (task?.id)}
                  {#if task}
                    <GAgentTaskCard
                      {task}
                      isReady={ready.some((t) => t.id === task.id)}
                      showDependencies={!compact}
                      onExecute={handleExecuteTask}
                      onSkip={handleSkipTask}
                    />
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    {#if executionError}
      <div class="plan-error" role="alert">{executionError}</div>
    {/if}
    <div class="plan-actions">
      {#if canApprove}
        <button class="btn btn-primary" onclick={handleApprove}> Approve Plan </button>
      {/if}
      {#if canExecute}
        <button class="btn btn-primary" onclick={handleStartExecution}> Start Execution </button>
      {/if}
      {#if canCancel}
        <button class="btn btn-danger" onclick={handleCancel}> Cancel </button>
      {/if}
      {#if isDone}
        <button class="btn btn-secondary" onclick={handleClear}> Clear </button>
      {/if}
    </div>
  </div>
{:else}
  <div class="no-plan">
    <div class="no-plan-icon">📋</div>
    <p class="no-plan-text">No active plan</p>
    <p class="no-plan-hint">Enter a goal to generate an execution plan</p>
  </div>
{/if}

<style>
  .plan-viewer {
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .plan-viewer.compact {
    padding: 1rem;
    gap: 1rem;
  }

  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .plan-info {
    flex: 1;
    min-width: 0;
  }

  .plan-goal {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    line-height: 1.3;
  }

  .plan-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-label {
    opacity: 0.7;
  }

  .meta-value {
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .tech-stack {
    display: flex;
    gap: 0.25rem;
  }

  .tech-tag {
    padding: 0.125rem 0.375rem;
    background: var(--bg-tertiary, #f3f4f6);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 500;
  }

  .tech-more {
    padding: 0.125rem 0.25rem;
    color: var(--text-secondary, #6b7280);
    font-size: 0.625rem;
  }

  .plan-badges {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .status-badge,
  .risk-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .badge-icon {
    font-size: 0.875rem;
  }

  .risk-assessment {
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 8px;
    padding: 1rem;
  }

  .risk-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .risk-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
  }

  .auto-approve-badge {
    padding: 0.25rem 0.5rem;
    background: #d1fae5;
    color: #059669;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .risk-factors {
    margin: 0 0 0.75rem 0;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .risk-factors li {
    margin-bottom: 0.25rem;
  }

  .risk-counts {
    display: flex;
    gap: 1rem;
  }

  .risk-count {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .risk-count.safe {
    color: #059669;
  }
  .risk-count.moderate {
    color: #d97706;
  }
  .risk-count.risky {
    color: #dc2626;
  }

  .progress-section {
    padding: 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
  }

  .progress-label {
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .progress-count {
    color: var(--text-secondary, #6b7280);
    font-family: 'JetBrains Mono', monospace;
  }

  .progress-bar {
    height: 6px;
    background: var(--bg-tertiary, #e5e7eb);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-fill.completed {
    background: #10b981;
  }

  .progress-fill.failed {
    background: #ef4444;
  }

  .batches-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .batches-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .batches-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
  }

  .batches-info {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .batches-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .batch {
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .batch.current {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .batch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #f9fafb);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .batch-header:hover {
    background: var(--bg-tertiary, #f3f4f6);
  }

  .batch-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .batch-number {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
  }

  .batch-count {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .parallel-badge {
    padding: 0.125rem 0.375rem;
    background: #dbeafe;
    color: #1d4ed8;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .batch-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .batch-progress {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary, #6b7280);
  }

  .expand-icon {
    transition: transform 0.2s ease;
    color: var(--text-secondary, #6b7280);
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  .batch-tasks {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--bg-primary, #ffffff);
  }

  .plan-error {
    padding: 0.5rem 0.75rem;
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .plan-actions {
    display: flex;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #e5e5e5);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: var(--bg-tertiary, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-danger {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn-danger:hover {
    background: #fecaca;
  }

  .no-plan {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--text-secondary, #6b7280);
  }

  .no-plan-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .no-plan-text {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }

  .no-plan-hint {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.7;
  }
</style>
