<script lang="ts">
  import { onMount } from 'svelte';
  import { showToast } from '../stores/toastStore';
  import { processError, logError, type ErrorContext } from '../utils/errorHandler';

  interface Props {
    fallback?: (error: ErrorContext) => string;
  }

  let { fallback }: Props = $props();

  let error: ErrorContext | null = $state(null);
  let hasError = $state(false);

  function handleError(event: ErrorEvent) {
    const errorContext = processError(event.error);
    error = errorContext;
    hasError = true;
    logError(errorContext);
    
    showToast(errorContext.userMessage, 'error');
  }

  function reset() {
    error = null;
    hasError = false;
  }

  async function retry() {
    reset();
    // Reload the page to recover from error
    window.location.reload();
  }

  onMount(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', (event) => {
      handleError(new ErrorEvent('error', { error: event.reason }));
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError as any);
    };
  });
</script>

{#if hasError && error}
  <div class="error-boundary">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">{error.userMessage}</p>
      
      {#if error.recovery && error.recovery.length > 0}
        <div class="error-actions">
          {#each error.recovery as option}
            <button
              class="error-action-btn"
              class:primary={option.primary}
              on:click={option.action}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {:else}
        <div class="error-actions">
          <button class="error-action-btn primary" on:click={retry}>
            Reload Page
          </button>
        </div>
      {/if}
      
      {#if error.metadata && error.metadata.stack}
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre class="error-stack">{error.metadata.stack}</pre>
        </details>
      {/if}
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: #0d1117;
  }

  .error-content {
    max-width: 500px;
    text-align: center;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 2rem;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.5rem;
    font-weight: 600;
    color: #c9d1d9;
    margin: 0 0 1rem 0;
  }

  .error-message {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #8b949e;
    margin: 0 0 1.5rem 0;
    line-height: 1.6;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .error-action-btn {
    padding: 0.75rem 1.5rem;
    border: 1px solid #30363d;
    border-radius: 4px;
    background: #21262d;
    color: #c9d1d9;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .error-action-btn:hover {
    background: #30363d;
    border-color: #0ea5e9;
    color: #0ea5e9;
  }

  .error-action-btn.primary {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #ffffff;
  }

  .error-action-btn.primary:hover {
    background: #0052cc;
    border-color: #0052cc;
  }

  .error-details {
    margin-top: 1.5rem;
    text-align: left;
  }

  .error-details summary {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6e7681;
    cursor: pointer;
    margin-bottom: 0.5rem;
  }

  .error-stack {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 0.75rem;
    color: #8b949e;
    background: #0d1117;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
