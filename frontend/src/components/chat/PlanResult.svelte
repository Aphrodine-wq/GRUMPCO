<script lang="ts">
  import { Check, X, RefreshCw, ListTodo, ChevronDown, ChevronUp } from 'lucide-svelte';
  import type { PhaseData } from '../../stores/chatPhaseStore';

  interface Props {
    data: PhaseData['plan'];
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
  }

  let { data, onApprove, onRequestChanges }: Props = $props();

  let showFeedbackInput = $state(false);
  let feedbackText = $state('');
  let expandedTasks = $state<Set<string>>(new Set());
  let showAllTasks = $state(true);

  function handleApprove() {
    onApprove();
  }

  function handleRequestChanges() {
    if (feedbackText.trim()) {
      onRequestChanges(feedbackText.trim());
      showFeedbackInput = false;
      feedbackText = '';
    }
  }

  function toggleTask(taskId: string) {
    const newSet = new Set(expandedTasks);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    expandedTasks = newSet;
  }

  function getTaskStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in-progress':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }
</script>

<div class="phase-result plan-result">
  <div class="result-header">
    <div class="title-group">
      <ListTodo size={18} class="plan-icon" />
      <h3 class="result-title">Implementation Plan</h3>
    </div>
    <button 
      class="toggle-btn"
      onclick={() => showAllTasks = !showAllTasks}
    >
      {#if showAllTasks}
        <ChevronUp size={16} />
      {:else}
        <ChevronDown size={16} />
      {/if}
      <span>{showAllTasks ? 'Hide' : 'Show'} Tasks</span>
    </button>
  </div>

  {#if data?.tasks && data.tasks.length > 0}
    <div class="tasks-summary">
      <span class="task-count">{data.tasks.length} tasks</span>
      <span class="task-breakdown">
        {data.tasks.filter(t => t.status === 'completed').length} completed, 
        {data.tasks.filter(t => t.status === 'in-progress').length} in progress, 
        {data.tasks.filter(t => t.status === 'pending').length} pending
      </span>
    </div>

    {#if showAllTasks}
      <div class="tasks-list">
        {#each data.tasks as task, index}
          <div class="task-item" class:expanded={expandedTasks.has(task.id)}>
            <button 
              class="task-header"
              onclick={() => toggleTask(task.id)}
            >
              <div class="task-left">
                <span class="task-number">{index + 1}</span>
                <div class="task-status" style="background-color: {getTaskStatusColor(task.status)}"></div>
                <span class="task-title">{task.title}</span>
              </div>
              {#if task.description}
                {#if expandedTasks.has(task.id)}
                  <ChevronUp size={14} />
                {:else}
                  <ChevronDown size={14} />
                {/if}
              {/if}
            </button>
            
            {#if expandedTasks.has(task.id) && task.description}
              <div class="task-description">
                {task.description}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>No tasks generated yet.</p>
    </div>
  {/if}

  <div class="approval-section">
    <p class="approval-question">Does this implementation plan look good?</p>
    
    {#if !showFeedbackInput}
      <div class="approval-buttons">
        <button class="approve-btn" onclick={handleApprove}>
          <Check size={16} />
          <span>Looks good! Continue to Code</span>
        </button>
        <button class="changes-btn" onclick={() => showFeedbackInput = true}>
          <RefreshCw size={16} />
          <span>Request changes</span>
        </button>
      </div>
    {:else}
      <div class="feedback-input-section">
        <textarea
          bind:value={feedbackText}
          placeholder="What would you like me to change about the implementation plan?"
          rows={3}
        ></textarea>
        <div class="feedback-buttons">
          <button class="submit-feedback-btn" onclick={handleRequestChanges}>
            Submit Feedback
          </button>
          <button class="cancel-btn" onclick={() => showFeedbackInput = false}>
            <X size={16} />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .phase-result {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.plan-icon) {
    color: var(--color-primary);
  }

  .result-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .tasks-summary {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: var(--color-bg-subtle);
    border-radius: 6px;
  }

  .task-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .task-breakdown {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
    max-height: 300px;
    overflow-y: auto;
  }

  .task-item {
    background: var(--color-bg-subtle);
    border-radius: 8px;
    overflow: hidden;
    transition: all 150ms ease;
  }

  .task-item.expanded {
    background: var(--color-bg-card-hover);
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
    transition: background 150ms ease;
  }

  .task-header:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .task-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .task-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--color-primary);
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .task-description {
    padding: 0 12px 12px 42px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .approval-section {
    border-top: 1px solid var(--color-border-light);
    padding-top: 16px;
  }

  .approval-question {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 12px 0;
  }

  .approval-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .approve-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .approve-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }

  .changes-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .changes-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .feedback-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  textarea {
    width: 100%;
    padding: 12px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: var(--color-text);
    resize: vertical;
    transition: border-color 150ms ease;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  textarea::placeholder {
    color: var(--color-text-muted);
  }

  .feedback-buttons {
    display: flex;
    gap: 8px;
  }

  .submit-feedback-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .submit-feedback-btn:hover {
    background: var(--color-primary-hover);
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .cancel-btn:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }
</style>
