<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    connectionStatus,
    startPolling,
    stopPolling,
    checkConnection,
  } from '../stores/connectionStatusStore';

  let retrying = $state(false);

  async function handleRetry() {
    retrying = true;
    await checkConnection();
    retrying = false;
  }

  onMount(() => {
    startPolling();
  });

  onDestroy(() => {
    stopPolling();
  });
</script>

{#if $connectionStatus === 'disconnected'}
  <div
    class="connection-banner disconnected"
    role="alert"
    aria-live="polite"
    title="Backend disconnected. Click to retry."
  >
    <span class="status-dot status-dot--disconnected"></span>
    <button
      type="button"
      class="retry-btn retry-btn--minimal"
      onclick={handleRetry}
      disabled={retrying}
      aria-label="Retry connection"
    >
      {retrying ? '…' : 'Retry'}
    </button>
  </div>
{:else if $connectionStatus === 'connected'}
  <div class="connection-banner connected" role="status" aria-live="polite" title="Connected">
    <span class="status-dot"></span>
  </div>
{/if}

<style>
  .connection-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 2px 8px;
    min-height: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    margin: 0;
  }

  .connection-banner.connected {
    background: transparent;
    border-top: none;
  }

  .connection-banner.connected .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    flex-shrink: 0;
  }

  .connection-banner.disconnected {
    background: transparent;
  }

  .connection-banner.disconnected .status-dot--disconnected {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
  }

  .connection-banner :global(.banner-icon) {
    flex-shrink: 0;
  }

  .retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .retry-btn--minimal {
    padding: 1px 4px;
    font-size: 0.625rem;
    background: transparent;
    color: #92400e;
  }

  .retry-btn--minimal:hover:not(:disabled) {
    text-decoration: underline;
  }

  .retry-btn:hover:not(:disabled) {
    background: #d97706;
  }

  .retry-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
