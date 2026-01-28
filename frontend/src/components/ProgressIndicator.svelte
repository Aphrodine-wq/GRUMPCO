<script lang="ts">
  interface Stage {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    timeEstimate?: number; // in seconds
  }

  interface Props {
    stages: Stage[];
    showTimeEstimates?: boolean;
  }

  let { stages, showTimeEstimates = false }: Props = $props();

  function getStageIndex(id: string): number {
    return stages.findIndex(s => s.id === id);
  }

  function getCompletedCount(): number {
    return stages.filter(s => s.status === 'completed').length;
  }

  function getProgressPercentage(): number {
    if (stages.length === 0) return 0;
    return (getCompletedCount() / stages.length) * 100;
  }

  function hasError(): boolean {
    return stages.some(s => s.status === 'error');
  }
</script>

<div class="progress-indicator">
  <div class="progress-header">
    <div class="progress-title">
      Progress: {getCompletedCount()} / {stages.length} stages
    </div>
    {#if hasError()}
      <div class="progress-error-badge">Error</div>
    {/if}
  </div>

  <div class="progress-bar-container">
    <div class="progress-bar">
      <div 
        class="progress-fill"
        class:error={hasError()}
        style="width: {getProgressPercentage()}%"
      ></div>
    </div>
  </div>

  <div class="stages-list">
    {#each stages as stage, index (stage.id)}
      <div 
        class="stage-item"
        class:pending={stage.status === 'pending'}
        class:active={stage.status === 'active'}
        class:completed={stage.status === 'completed'}
        class:error={stage.status === 'error'}
      >
        <div class="stage-indicator">
          {#if stage.status === 'completed'}
            <span class="stage-icon">✓</span>
          {:else if stage.status === 'error'}
            <span class="stage-icon">✗</span>
          {:else if stage.status === 'active'}
            <span class="stage-spinner"></span>
          {:else}
            <span class="stage-icon">{index + 1}</span>
          {/if}
        </div>
        <div class="stage-content">
          <div class="stage-label">{stage.label}</div>
          {#if showTimeEstimates && stage.timeEstimate}
            <div class="stage-time">~{stage.timeEstimate}s</div>
          {/if}
        </div>
        {#if stage.status === 'active'}
          <div class="stage-pulse"></div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .progress-indicator {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 1rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .progress-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #E5E5E5;
  }

  .progress-error-badge {
    padding: 0.25rem 0.5rem;
    background: #DC2626;
    color: #fff;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .progress-bar-container {
    margin-bottom: 1rem;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: #0d0d0d;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #0EA5E9;
    transition: width 0.3s ease;
    border-radius: 2px;
  }

  .progress-fill.error {
    background: #DC2626;
  }

  .stages-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stage-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #0d0d0d;
    border: 1px solid #404040;
    border-radius: 4px;
    position: relative;
    transition: all 0.2s;
  }

  .stage-item.pending {
    opacity: 0.6;
  }

  .stage-item.active {
    border-color: #0EA5E9;
    background: rgba(0, 102, 255, 0.1);
  }

  .stage-item.completed {
    border-color: #0EA5E9;
    background: rgba(0, 102, 255, 0.05);
  }

  .stage-item.error {
    border-color: #DC2626;
    background: rgba(220, 38, 38, 0.1);
  }

  .stage-indicator {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #262626;
    border: 2px solid #404040;
  }

  .stage-item.pending .stage-indicator {
    background: #0d0d0d;
    border-color: #404040;
  }

  .stage-item.active .stage-indicator {
    border-color: #0EA5E9;
  }

  .stage-item.completed .stage-indicator {
    background: #0EA5E9;
    border-color: #0EA5E9;
  }

  .stage-item.error .stage-indicator {
    background: #DC2626;
    border-color: #DC2626;
  }

  .stage-icon {
    font-size: 0.75rem;
    font-weight: 600;
    color: #E5E5E5;
  }

  .stage-item.completed .stage-icon,
  .stage-item.error .stage-icon {
    color: #fff;
  }

  .stage-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 102, 255, 0.3);
    border-top-color: #0EA5E9;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .stage-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stage-label {
    font-size: 0.875rem;
    color: #E5E5E5;
  }

  .stage-item.pending .stage-label {
    color: #6B7280;
  }

  .stage-time {
    font-size: 0.75rem;
    color: #6B7280;
  }

  .stage-pulse {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 4px;
    background: rgba(0, 102, 255, 0.1);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
  }
</style>
