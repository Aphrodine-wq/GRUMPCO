<script lang="ts">
  import { type ErrorContext } from '../utils/errorHandler';
  import { AlertTriangle, AlertCircle } from 'lucide-svelte';
  import { showToast } from '../stores/toastStore';

  interface Props {
    error: ErrorContext;
    onRetry?: () => void | Promise<void>;
    onDismiss?: () => void;
    showDetails?: boolean;
  }

  let { error, onRetry, onDismiss, showDetails = false }: Props = $props();

  let detailsExpanded = $state(false);

  function handleRetry() {
    if (onRetry) {
      onRetry();
    }
  }

  function handleDismiss() {
    if (onDismiss) {
      onDismiss();
    }
  }

  function copyErrorDetails() {
    const details = `Error: ${error.message}\nType: ${error.type}\nSeverity: ${error.severity}\n${error.metadata ? JSON.stringify(error.metadata, null, 2) : ''}`;
    navigator.clipboard
      .writeText(details)
      .then(() => {
        showToast('Error details copied to clipboard', 'success');
      })
      .catch(() => {
        showToast('Failed to copy error details', 'error');
      });
  }

  function getSeverityColor(): string {
    switch (error.severity) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#F97316';
      case 'low':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  }
</script>

<div class="error-recovery">
  <div class="error-header">
    <div class="error-icon" style="color: {getSeverityColor()}">
      {#if error.severity === 'critical'}
        <AlertTriangle size={20} />
      {:else if error.severity === 'high'}
        <AlertCircle size={20} />
      {:else}
        <AlertCircle size={20} />
      {/if}
    </div>
    <div class="error-content">
      <div class="error-message">{error.userMessage}</div>
      <div class="error-type">Error Type: {error.type}</div>
    </div>
  </div>

  {#if error.recovery && error.recovery.length > 0}
    <div class="error-recovery-actions">
      {#each error.recovery as recoveryOption (recoveryOption.label)}
        <button
          class="recovery-btn"
          class:primary={recoveryOption.primary}
          onclick={() => {
            recoveryOption.action();
            if (!error.retryable || recoveryOption.label !== 'Retry') {
              handleDismiss();
            }
          }}
        >
          {recoveryOption.label}
        </button>
      {/each}
      {#if !error.retryable}
        <button class="recovery-btn dismiss-btn" onclick={handleDismiss}> Dismiss </button>
      {/if}
    </div>
  {:else}
    <div class="error-recovery-actions">
      {#if error.retryable && onRetry}
        <button class="recovery-btn primary" onclick={handleRetry}> Retry </button>
      {/if}
      <button class="recovery-btn dismiss-btn" onclick={handleDismiss}> Dismiss </button>
    </div>
  {/if}

  {#if showDetails || detailsExpanded}
    <div class="error-details">
      <button class="details-toggle" onclick={() => (detailsExpanded = !detailsExpanded)}>
        {detailsExpanded ? '▼' : '▶'} Error Details
      </button>
      {#if detailsExpanded}
        <div class="details-content">
          <div class="detail-item">
            <strong>Message:</strong>
            {error.message}
          </div>
          <div class="detail-item">
            <strong>Type:</strong>
            {error.type}
          </div>
          <div class="detail-item">
            <strong>Severity:</strong>
            {error.severity}
          </div>
          <div class="detail-item">
            <strong>Retryable:</strong>
            {error.retryable ? 'Yes' : 'No'}
          </div>
          {#if error.metadata}
            <div class="detail-item">
              <strong>Metadata:</strong>
              <pre class="metadata-pre">{JSON.stringify(error.metadata, null, 2)}</pre>
            </div>
          {/if}
          <button class="copy-details-btn" onclick={copyErrorDetails}> 📋 Copy Details </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .error-recovery {
    background: #1a1a1a;
    border: 1px solid #dc2626;
    border-radius: 8px;
    padding: 1rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .error-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .error-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .error-content {
    flex: 1;
  }

  .error-message {
    font-size: 0.875rem;
    color: #e5e5e5;
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .error-type {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .error-recovery-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .recovery-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #404040;
    background: #0d0d0d;
    color: #e5e5e5;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .recovery-btn:hover {
    background: #262626;
    border-color: var(--color-primary);
    color: #fff;
  }

  .recovery-btn.primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }

  .recovery-btn.primary:hover {
    background: #0052cc;
  }

  .recovery-btn.dismiss-btn {
    background: transparent;
    border-color: #6b7280;
    color: #6b7280;
  }

  .recovery-btn.dismiss-btn:hover {
    background: #262626;
    border-color: #9ca3af;
    color: #9ca3af;
  }

  .error-details {
    border-top: 1px solid #404040;
    padding-top: 1rem;
  }

  .details-toggle {
    background: transparent;
    border: none;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.5rem 0;
    transition: color 0.15s;
  }

  .details-toggle:hover {
    color: #e5e5e5;
  }

  .details-content {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #0d0d0d;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .detail-item {
    margin-bottom: 0.5rem;
    color: #e5e5e5;
  }

  .detail-item strong {
    color: #9ca3af;
    margin-right: 0.5rem;
  }

  .metadata-pre {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #000;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.7rem;
    color: #9ca3af;
  }

  .copy-details-btn {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #404040;
    color: #6b7280;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-details-btn:hover {
    background: #262626;
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
</style>
