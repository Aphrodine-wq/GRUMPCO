<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    connectionStatus,
    startPolling,
    stopPolling,
    checkConnection,
  } from '../stores/connectionStatusStore';
  import { WifiOff, RefreshCw } from 'lucide-svelte';

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
  <div class="connection-banner" role="alert" aria-live="polite">
    <WifiOff class="banner-icon" size={18} />
    <span>Backend disconnected. Retrying…</span>
    <button
      type="button"
      class="retry-btn"
      onclick={handleRetry}
      disabled={retrying}
      aria-label="Retry connection"
    >
      <span class="retry-icon" class:spin={retrying}>
        <RefreshCw size={16} />
      </span>
      {retrying ? 'Retrying…' : 'Retry'}
    </button>
  </div>
{/if}

<style>
  .connection-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%);
    color: #92400e;
    font-size: 0.875rem;
    font-weight: 500;
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

  .retry-btn:hover:not(:disabled) {
    background: #d97706;
  }

  .retry-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .retry-icon {
    display: inline-flex;
    align-items: center;
  }

  .retry-icon.spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
