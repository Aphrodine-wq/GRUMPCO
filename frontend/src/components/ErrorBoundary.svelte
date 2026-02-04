<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import FrownyFace from './FrownyFace.svelte';
  import { Button, Card } from '$lib/design-system';
  import { showToast } from '../stores/toastStore';
  import { processError, logError, type ErrorContext } from '../utils/errorHandler';

  interface Props {
    fallback?: (error: ErrorContext) => string;
    children?: Snippet;
  }

  let { fallback: _fallback, children }: Props = $props();

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
      window.removeEventListener('unhandledrejection', handleError as EventListener);
    };
  });
</script>

{#if hasError && error}
  <div class="error-boundary">
    <div class="error-card-wrap">
      <Card title="Something went wrong" padding="lg">
        <div class="error-content">
          <div class="error-icon-wrap">
            <FrownyFace size="lg" state="error" />
          </div>
          <p class="error-message">{error.userMessage}</p>

          {#if error.recovery && error.recovery.length > 0}
            <div class="error-actions">
              {#each error.recovery as option}
                <Button
                  variant={option.primary ? 'primary' : 'secondary'}
                  size="sm"
                  onclick={option.action}
                >
                  {option.label}
                </Button>
              {/each}
            </div>
          {:else}
            <div class="error-actions">
              <Button variant="primary" size="sm" onclick={retry}>Reload Page</Button>
            </div>
          {/if}

          {#if error.metadata && error.metadata.stack}
            <details class="error-details">
              <summary>Technical Details</summary>
              <pre class="error-stack">{error.metadata.stack}</pre>
            </details>
          {/if}
        </div>
      </Card>
    </div>
  </div>
{:else if children}
  {@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .error-card-wrap {
    max-width: 500px;
    width: 100%;
  }

  .error-content {
    text-align: center;
  }

  .error-icon-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .error-icon-wrap :global(svg) {
    width: 3rem;
    height: 3rem;
    color: var(--color-error, #ff3b30);
  }

  .error-message {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6d28d9);
    margin: 0 0 1.5rem 0;
    line-height: 1.6;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .error-details {
    margin-top: 1.5rem;
    text-align: left;
  }

  .error-details summary {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    cursor: pointer;
    margin-bottom: 0.5rem;
  }

  .error-stack {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    background: var(--color-bg-subtle, #f5f3ff);
    padding: 1rem;
    border-radius: var(--radius-sm, 8px);
    overflow-x: auto;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid var(--color-border, #e9d5ff);
  }
</style>
