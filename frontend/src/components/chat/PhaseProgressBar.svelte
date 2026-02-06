<script lang="ts">
  import { Check, Circle, Loader2 } from 'lucide-svelte';
  import { chatPhaseStore, workflowProgress, type DesignPhase } from '../../stores/chatPhaseStore';

  const phases: { id: DesignPhase; label: string }[] = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'prd', label: 'PRD' },
    { id: 'plan', label: 'Plan' },
    { id: 'code', label: 'Code' },
  ];

  const currentPhase = $derived($chatPhaseStore.currentPhase);
  const progress = $derived($workflowProgress);
  const isCompleted = $derived(currentPhase === 'completed');

  function getPhaseStatus(phaseId: DesignPhase): 'completed' | 'active' | 'pending' {
    const phaseOrder: DesignPhase[] = ['architecture', 'prd', 'plan', 'code', 'completed'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseId);

    if (phaseIndex < currentIndex || (phaseId === 'code' && isCompleted)) {
      return 'completed';
    } else if (phaseIndex === currentIndex) {
      return 'active';
    } else {
      return 'pending';
    }
  }
</script>

<div class="phase-progress-bar">
  <div class="progress-header">
    <span class="progress-title">Design Workflow</span>
    <span class="progress-percentage">{Math.round(progress)}%</span>
  </div>
  
  <div class="progress-track">
    <div 
      class="progress-fill" 
      style="width: {progress}%"
      class:completed={isCompleted}
    ></div>
  </div>

  <div class="phases">
    {#each phases as phase, index}
      {@const status = getPhaseStatus(phase.id)}
      <div class="phase" class:completed={status === 'completed'} class:active={status === 'active'}>
        <div class="phase-indicator">
          {#if status === 'completed'}
            <Check size={14} strokeWidth={3} />
          {:else if status === 'active'}
            <Loader2 size={14} class="spin" />
          {:else}
            <Circle size={14} />
          {/if}
        </div>
        <span class="phase-label">{phase.label}</span>
        {#if index < phases.length - 1}
          <div class="phase-connector" class:completed={status === 'completed'}></div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .phase-progress-bar {
    background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-card-hover) 100%);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .progress-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }

  .progress-percentage {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-primary);
  }

  .progress-track {
    height: 4px;
    background: var(--color-border-light);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    border-radius: 2px;
    transition: width 300ms ease;
  }

  .progress-fill.completed {
    background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  }

  .phases {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    position: relative;
  }

  .phase-indicator {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
    transition: all 200ms ease;
  }

  .phase:not(.completed):not(.active) .phase-indicator {
    background: var(--color-border-light);
    color: var(--color-text-muted);
  }

  .phase.active .phase-indicator {
    background: var(--color-primary);
    color: white;
  }

  .phase.completed .phase-indicator {
    background: #22c55e;
    color: white;
  }

  .phase-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    text-align: center;
    transition: color 200ms ease;
  }

  .phase.active .phase-label {
    color: var(--color-primary);
    font-weight: 600;
  }

  .phase.completed .phase-label {
    color: #22c55e;
  }

  .phase-connector {
    position: absolute;
    top: 14px;
    right: -50%;
    width: 100%;
    height: 2px;
    background: var(--color-border-light);
    transform: translateX(-50%);
    z-index: 0;
  }

  .phase-connector.completed {
    background: #22c55e;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @media (max-width: 640px) {
    .phase-label {
      font-size: 9px;
    }

    .phase-indicator {
      width: 24px;
      height: 24px;
    }

    .phase-connector {
      top: 12px;
    }
  }
</style>
