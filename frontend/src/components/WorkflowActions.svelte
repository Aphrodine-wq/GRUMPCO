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
    isStreaming,
  }: Props = $props();

  const dispatch = createEventDispatcher();

  let repoNameInput = $state('');
  let showGitHubPrompt = $state(false);

  function handlePushToGitHubClick() {
    showGitHubPrompt = true;
  }

  function submitPushToGitHub() {
    const name = repoNameInput.trim();
    if (name) {
      dispatch('pushToGitHub', { repoName: name });
      showGitHubPrompt = false;
      repoNameInput = '';
    }
  }

  function cancelGitHubPrompt() {
    showGitHubPrompt = false;
    repoNameInput = '';
  }

  const showActions = $derived(
    !isStreaming && (
      canProceedToPrd ||
      canProceedToCodegen ||
      canDownload ||
      phase !== 'idle'
    )
  );

  const canRefine = $derived(phase !== 'idle' && phase !== 'complete');
  const canReset = $derived(phase !== 'idle');
</script>

{#if showGitHubPrompt}
  <div class="github-prompt-overlay" role="dialog" aria-label="Push to GitHub">
    <div class="github-prompt">
      <label for="repo-name-input" class="github-prompt-label">Repository name</label>
      <input
        id="repo-name-input"
        type="text"
        class="github-prompt-input"
        placeholder="my-project"
        bind:value={repoNameInput}
        onkeydown={(e) => e.key === 'Enter' && submitPushToGitHub()}
      />
      <div class="github-prompt-actions">
        <button type="button" class="action-btn primary" onclick={submitPushToGitHub} disabled={!repoNameInput.trim()}>
          Push to GitHub
        </button>
        <button type="button" class="action-btn subtle" onclick={cancelGitHubPrompt}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if showActions}
  <div class="workflow-actions">
    <div class="actions-container">
      {#if canProceedToPrd}
        <button 
          onclick={() => dispatch('proceed-prd')}
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
          onclick={() => dispatch('proceed-codegen')}
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
          onclick={() => dispatch('download')}
          class="action-btn success"
          title="Download project as ZIP"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download
        </button>
        <button 
          onclick={handlePushToGitHubClick}
          class="action-btn primary"
          title="Push generated code to a new GitHub repo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
          Push to GitHub
        </button>
        <button 
          onclick={() => dispatch('openInIde', { ide: 'cursor' })}
          class="action-btn secondary"
          title="Download and open folder in Cursor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
          Cursor
        </button>
        <button 
          onclick={() => dispatch('openInIde', { ide: 'vscode' })}
          class="action-btn secondary"
          title="Download and open folder in VS Code"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
          VS Code
        </button>
        <button 
          onclick={() => dispatch('openInIde', { ide: 'jetbrains' })}
          class="action-btn secondary"
          title="Download and open folder in IntelliJ / WebStorm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
          JetBrains
        </button>
      {/if}

      {#if canRefine}
        <button 
          onclick={() => dispatch('refine')}
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
          onclick={() => dispatch('reset')}
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
    background: transparent;
    padding: 1rem 0;
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
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn.primary {
    background: #0066FF;
    color: #FFFFFF;
  }

  .action-btn.primary:hover {
    background: #0052CC;
  }

  .action-btn.success {
    background: #10B981;
    color: #FFFFFF;
  }

  .action-btn.success:hover {
    background: #059669;
  }

  .action-btn.secondary {
    background: #EBEBEB;
    color: #0066FF;
  }

  .action-btn.secondary:hover {
    background: #0066FF;
    color: #FFFFFF;
  }

  .action-btn.subtle {
    background: #EBEBEB;
    color: #6B7280;
  }

  .action-btn.subtle:hover {
    background: #E0E0E0;
    color: #374151;
  }

  .github-prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .github-prompt {
    background: #fff;
    padding: 1.25rem;
    border-radius: 8px;
    min-width: 280px;
    font-family: 'JetBrains Mono', monospace;
  }

  .github-prompt-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .github-prompt-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .github-prompt-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.25);
  }

  .github-prompt-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
