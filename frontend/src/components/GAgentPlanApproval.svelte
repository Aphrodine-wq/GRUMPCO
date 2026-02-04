<script lang="ts">
  /**
   * GAgentPlanApproval - Modal for reviewing and approving G-Agent plans
   */
  import { gAgentPlanStore, currentPlan, type RiskLevel } from '../stores/gAgentPlanStore';

  interface Props {
    open?: boolean;
    onClose?: () => void;
    onApproved?: () => void;
    onRejected?: () => void;
  }

  let { open = false, onClose, onApproved, onRejected }: Props = $props();

  let rejectReason = $state('');

  const riskColors: Record<RiskLevel, { text: string; bg: string }> = {
    safe: { text: '#059669', bg: '#D1FAE5' },
    moderate: { text: '#D97706', bg: '#FEF3C7' },
    risky: { text: '#DC2626', bg: '#FEE2E2' },
  };

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  function handleApprove() {
    gAgentPlanStore.approvePlan();
    if (onApproved) onApproved();
    if (onClose) onClose();
  }

  function handleReject() {
    gAgentPlanStore.cancelPlan();
    if (onRejected) onRejected();
    if (onClose) onClose();
  }

  function handleClose() {
    if (onClose) onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  // Derived values
  let plan = $derived($currentPlan);
  let riskStyle = $derived(plan ? riskColors[plan.risk.level] : null);
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && plan}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    onclick={handleBackdropClick}
    onkeydown={() => {}}
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Review Execution Plan</h2>
        <button class="close-btn" onclick={handleClose} aria-label="Close">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Plan Summary -->
        <div class="plan-summary">
          <h3 class="plan-goal">{plan.goal}</h3>
          <div class="plan-meta">
            <span class="meta-chip">
              <strong>{plan.tasks.length}</strong> tasks
            </span>
            <span class="meta-chip">
              <strong>{plan.parallel_batches.length}</strong> batches
            </span>
            <span class="meta-chip">
              <strong>{formatDuration(plan.estimated_duration)}</strong>
            </span>
            <span class="meta-chip">
              <strong>{Math.round(plan.confidence * 100)}%</strong> confidence
            </span>
          </div>
        </div>

        <!-- Risk Assessment -->
        <div class="risk-section">
          <div class="risk-header">
            <span class="risk-badge" style="color: {riskStyle?.text}; background: {riskStyle?.bg}">
              {plan.risk.level.toUpperCase()} RISK
            </span>
            {#if plan.risk.auto_approvable}
              <span class="auto-approve">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Auto-approvable
              </span>
            {/if}
          </div>

          <div class="risk-breakdown">
            <div class="risk-stat safe">
              <span class="stat-count">{plan.risk.safe_count}</span>
              <span class="stat-label">Safe</span>
            </div>
            <div class="risk-stat moderate">
              <span class="stat-count">{plan.risk.moderate_count}</span>
              <span class="stat-label">Moderate</span>
            </div>
            <div class="risk-stat risky">
              <span class="stat-count">{plan.risk.risky_count}</span>
              <span class="stat-label">Risky</span>
            </div>
          </div>

          {#if plan.risk.risk_factors.length > 0}
            <div class="risk-factors">
              <div class="factors-label">Risk factors:</div>
              <ul>
                {#each plan.risk.risk_factors as factor}
                  <li>{factor}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <!-- Task Preview -->
        <div class="tasks-preview">
          <div class="preview-header">
            <span class="preview-title">Tasks</span>
          </div>
          <div class="tasks-list">
            {#each plan.tasks.slice(0, 5) as task, idx}
              <div class="task-row">
                <span class="task-num">{idx + 1}</span>
                <span class="task-desc">{task.description}</span>
                <span
                  class="task-risk"
                  style="color: {riskColors[task.risk].text}; background: {riskColors[task.risk]
                    .bg}"
                >
                  {task.risk}
                </span>
              </div>
            {/each}
            {#if plan.tasks.length > 5}
              <div class="tasks-more">
                +{plan.tasks.length - 5} more tasks
              </div>
            {/if}
          </div>
        </div>

        <!-- Tech Stack -->
        <div class="tech-section">
          <span class="tech-label">Tech stack:</span>
          <div class="tech-tags">
            {#each plan.tech_stack as tech}
              <span class="tech-tag">{tech}</span>
            {/each}
          </div>
        </div>

        <!-- Reject Reason (optional) -->
        <div class="reject-section">
          <label for="reject-reason" class="reject-label"> Reason for rejection (optional): </label>
          <textarea
            id="reject-reason"
            class="reject-input"
            bind:value={rejectReason}
            placeholder="Enter reason if rejecting..."
            rows="2"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-reject" onclick={handleReject}> Reject Plan </button>
        <button class="btn btn-approve" onclick={handleApprove}> Approve & Execute </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--bg-primary, #ffffff);
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e5e5);
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .close-btn {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: var(--text-primary, #111827);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .plan-summary {
    text-align: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e5e5);
  }

  .plan-goal {
    margin: 0 0 0.75rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    line-height: 1.4;
  }

  .plan-meta {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .meta-chip {
    padding: 0.25rem 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 9999px;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .meta-chip strong {
    color: var(--text-primary, #111827);
  }

  .risk-section {
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
    padding: 1rem;
  }

  .risk-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .risk-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .auto-approve {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #059669;
    font-weight: 500;
  }

  .risk-breakdown {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .risk-stat {
    flex: 1;
    text-align: center;
    padding: 0.5rem;
    border-radius: 6px;
  }

  .risk-stat.safe {
    background: rgba(5, 150, 105, 0.1);
  }
  .risk-stat.moderate {
    background: rgba(217, 119, 6, 0.1);
  }
  .risk-stat.risky {
    background: rgba(220, 38, 38, 0.1);
  }

  .stat-count {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .risk-stat.safe .stat-count {
    color: #059669;
  }
  .risk-stat.moderate .stat-count {
    color: #d97706;
  }
  .risk-stat.risky .stat-count {
    color: #dc2626;
  }

  .stat-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, #6b7280);
  }

  .risk-factors {
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .factors-label {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .risk-factors ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .risk-factors li {
    margin-bottom: 0.125rem;
  }

  .tasks-preview {
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 8px;
    overflow: hidden;
  }

  .preview-header {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e5e5e5);
  }

  .preview-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
  }

  .tasks-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .task-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e5e5);
  }

  .task-row:last-child {
    border-bottom: none;
  }

  .task-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-tertiary, #f3f4f6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary, #6b7280);
    flex-shrink: 0;
  }

  .task-desc {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--text-primary, #111827);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task-risk {
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .tasks-more {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    text-align: center;
    background: var(--bg-secondary, #f9fafb);
  }

  .tech-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .tech-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
  }

  .tech-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tech-tag {
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary, #f3f4f6);
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }

  .reject-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reject-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .reject-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.8125rem;
    resize: vertical;
    transition: border-color 0.15s ease;
  }

  .reject-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #e5e5e5);
    background: var(--bg-secondary, #f9fafb);
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reject {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn-reject:hover {
    background: #fecaca;
  }

  .btn-approve {
    background: #10b981;
    color: white;
  }

  .btn-approve:hover {
    background: #059669;
  }
</style>
