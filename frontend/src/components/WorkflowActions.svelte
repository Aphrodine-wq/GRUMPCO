<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkflowPhase } from '../types/workflow';

  interface Props {
    phase: WorkflowPhase;
    canProceedToPrd: boolean;
    canProceedToCodegen: boolean;
    canDownload: boolean;
    isStreaming: boolean;
  }

  let {
    phase,
    canProceedToPrd,
    canProceedToCodegen,
    canDownload,
    isStreaming
  }: Props = $props();

  const dispatch = createEventDispatcher();

  const showActions = !isStreaming && (
    canProceedToPrd || 
    canProceedToCodegen || 
    canDownload ||
    phase !== 'idle'
  );

  const canRefine = phase !== 'idle' && phase !== 'complete';
  const canReset = phase !== 'idle';
</script>

{#if showActions}
  <div class="workflow-actions">
    <div class="actions-container">
      {#if canProceedToPrd}
        <button 
          on:click={() => dispatch('proceed-prd')}
          class="action-btn primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
          Continue to PRD
        </button>
      {/if}

      {#if canProceedToCodegen}
        <button 
          on:click={() => dispatch('proceed-codegen')}
          class="action-btn primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          Generate Code
        </button>
      {/if}

      {#if canDownload}
        <button 
          on:click={() => dispatch('download')}
          class="action-btn success"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Project
        </button>
      {/if}

      {#if canRefine}
        <button 
          on:click={() => dispatch('refine')}
          class="action-btn secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Refine
        </button>
      {/if}

      {#if canReset}
        <button 
          on:click={() => dispatch('reset')}
          class="action-btn subtle"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Start Over
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .workflow-actions {
    background: #FFFFFF;
    border-top: 1px solid #E5E5E5;
    padding: 1rem 1.5rem;
  }

  .actions-container {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn.primary {
    background: #0066FF;
    color: #FFFFFF;
    border-color: #0066FF;
  }

  .action-btn.primary:hover {
    background: #0052CC;
    border-color: #0052CC;
  }

  .action-btn.success {
    background: #10B981;
    color: #FFFFFF;
    border-color: #10B981;
  }

  .action-btn.success:hover {
    background: #059669;
    border-color: #059669;
  }

  .action-btn.secondary {
    background: transparent;
    color: #0066FF;
    border-color: #0066FF;
  }

  .action-btn.secondary:hover {
    background: #0066FF;
    color: #FFFFFF;
  }

  .action-btn.subtle {
    background: transparent;
    color: #6B7280;
    border-color: #E5E5E5;
  }

  .action-btn.subtle:hover {
    background: #F5F5F5;
    border-color: #9CA3AF;
  }
</style>
