<script lang="ts">
  import { onMount } from 'svelte';
  import ViewLoading from './ViewLoading.svelte';
  import type { ViewDefinition } from '../lib/viewRegistry';
  import { setCurrentView } from '../stores/uiStore';

  interface Props {
    definition: ViewDefinition;
  }

  let { definition }: Props = $props();

  let loadTimedOut = $state(false);
  let retryKey = $state(0);

  onMount(() => {
    const timeout = setTimeout(() => {
      loadTimedOut = true;
    }, 10000);
    return () => clearTimeout(timeout);
  });

  function handleRetry() {
    loadTimedOut = false;
    retryKey++;
  }
</script>

{#key retryKey}
  {#await definition.loader()}
    <ViewLoading message={definition.loadingLabel} />
    {#if loadTimedOut}
      <div class="load-timeout">
        <p>Taking longer than expected…</p>
        <button type="button" class="retry-btn" onclick={handleRetry}>Retry</button>
        <button type="button" class="back-btn" onclick={() => setCurrentView(definition.backTo)}
          >Go Back</button
        >
      </div>
    {/if}
  {:then { default: Component }}
    <Component
      onBack={() => setCurrentView(definition.backTo)}
      onComplete={definition.backTo === 'settings' ? () => setCurrentView('settings') : undefined}
      onReset={definition.backTo === 'settings' ? () => setCurrentView('chat') : undefined}
      {...definition.extraProps ?? {}}
    />
  {:catch error}
    <div class="load-error">
      <h3>Failed to load view</h3>
      <p class="error-detail">{error?.message || 'Unknown error'}</p>
      <div class="error-actions">
        <button type="button" class="retry-btn" onclick={handleRetry}>Retry</button>
        <button type="button" class="back-btn" onclick={() => setCurrentView(definition.backTo)}
          >Go Back</button
        >
      </div>
    </div>
  {/await}
{/key}

<style>
  .load-timeout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }
  .load-timeout p {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }
  .load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    min-height: 200px;
    text-align: center;
  }
  .load-error h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
    margin: 0;
  }
  .error-detail {
    font-size: 0.8125rem;
    color: var(--color-error, #dc2626);
    margin: 0;
    max-width: 400px;
    word-break: break-word;
  }
  .error-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .retry-btn,
  .back-btn {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .retry-btn {
    background: var(--color-primary, #7c3aed);
    color: white;
    border: 1px solid var(--color-primary, #7c3aed);
  }
  .retry-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
  }
  .back-btn {
    background: transparent;
    color: var(--color-text-muted, #6b7280);
    border: 1px solid var(--color-border, #e5e7eb);
  }
  .back-btn:hover {
    background: var(--color-bg-subtle, #f4f4f5);
    color: var(--color-text, #18181b);
  }
</style>
