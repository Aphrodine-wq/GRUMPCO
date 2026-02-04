<script lang="ts">
  /**
   * ErrorState Component
   * Enhanced error display with retry options, helpful messages, and action buttons
   */
  import { fade } from 'svelte/transition';

  interface Props {
    /** Error title */
    title?: string;
    /** Error message */
    message: string;
    /** Error code/type for specific handling */
    code?: string;
    /** Show retry button */
    retryable?: boolean;
    /** Retry button text */
    retryText?: string;
    /** Callback when retry is clicked */
    onRetry?: () => void;
    /** Alternative action button text */
    actionText?: string;
    /** Callback for alternative action */
    onAction?: () => void;
    /** Full screen mode */
    fullscreen?: boolean;
    /** Show technical details */
    showDetails?: boolean;
  }

  let {
    title = 'Something went wrong',
    message,
    code,
    retryable = false,
    retryText = 'Try Again',
    onRetry,
    actionText,
    onAction,
    fullscreen = false,
    showDetails = false,
  }: Props = $props();

  let isRetrying = $state(false);
  let detailsExpanded = $state(false);

  async function handleRetry() {
    if (!onRetry || isRetrying) return;
    isRetrying = true;
    try {
      await onRetry();
    } finally {
      isRetrying = false;
    }
  }

  // Get helpful suggestion based on error code
  function getSuggestion(errorCode?: string): string {
    const suggestions: Record<string, string> = {
      NETWORK_ERROR: 'Check your internet connection and try again.',
      API_ERROR: 'The AI service is temporarily unavailable. Please try again in a moment.',
      TIMEOUT: 'The request took too long. Try simplifying your prompt.',
      RATE_LIMIT: 'Too many requests. Please wait a moment before trying again.',
      AUTH_ERROR: 'Your session may have expired. Try signing in again.',
      INVALID_SYNTAX: 'Check your input format and try again.',
      CIRCUIT_OPEN: 'Service is temporarily unavailable. Please try again shortly.',
      default: 'If this persists, try refreshing the page or contact support.',
    };
    return suggestions[errorCode || ''] || suggestions['default'];
  }
</script>

<div
  class="error-state"
  class:fullscreen
  transition:fade={{ duration: 200 }}
  role="alert"
  aria-live="assertive"
>
  <div class="error-content">
    <!-- Icon -->
    <div class="error-icon-wrapper">
      <svg
        class="error-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>

    <!-- Title -->
    <h2 class="error-title">{title}</h2>

    <!-- Message -->
    <p class="error-message">{message}</p>

    <!-- Suggestion -->
    <p class="error-suggestion">{getSuggestion(code)}</p>

    <!-- Actions -->
    <div class="error-actions">
      {#if retryable && onRetry}
        <button type="button" class="btn btn-primary" onclick={handleRetry} disabled={isRetrying}>
          {#if isRetrying}
            <svg
              class="spinner"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="10" />
            </svg>
            <span>Retrying...</span>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>{retryText}</span>
          {/if}
        </button>
      {/if}

      {#if onAction && actionText}
        <button type="button" class="btn btn-secondary" onclick={onAction}>
          {actionText}
        </button>
      {/if}
    </div>

    <!-- Technical Details (expandable) -->
    {#if showDetails && code}
      <div class="error-details">
        <button
          type="button"
          class="details-toggle"
          onclick={() => (detailsExpanded = !detailsExpanded)}
          aria-expanded={detailsExpanded}
        >
          <span>Technical Details</span>
          <svg
            class="chevron"
            class:expanded={detailsExpanded}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {#if detailsExpanded}
          <div class="details-content" transition:fade={{ duration: 150 }}>
            <code>Error Code: {code}</code>
            <code>Timestamp: {new Date().toISOString()}</code>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--color-bg-card, #ffffff);
    border-radius: var(--radius-lg, 16px);
    border: 1px solid var(--color-error, #ef4444);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }

  .error-state.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    border-radius: 0;
    border: none;
  }

  .error-content {
    max-width: 480px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .error-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-icon {
    width: 32px;
    height: 32px;
    color: var(--color-error, #ef4444);
  }

  .error-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0;
  }

  .error-message {
    font-size: 0.9375rem;
    color: var(--color-text-secondary, #4c1d95);
    line-height: 1.6;
    margin: 0;
  }

  .error-suggestion {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6d28d9);
    margin: 0;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: var(--radius-md, 12px);
    border-left: 3px solid var(--color-primary, #7c3aed);
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn svg {
    width: 16px;
    height: 16px;
  }

  .btn-primary {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
    box-shadow: var(--shadow-glow, 0 6px 26px rgba(124, 58, 237, 0.35));
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-text-secondary, #4c1d95);
    border: 1px solid var(--color-border, #e9d5ff);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle, #f5f3ff);
    border-color: var(--color-border-highlight, #d8b4fe);
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .error-details {
    width: 100%;
    margin-top: 1rem;
  }

  .details-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6d28d9);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }

  .details-toggle:hover {
    color: var(--color-text-secondary, #4c1d95);
  }

  .chevron {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .details-content {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: var(--radius-md, 8px);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .details-content code {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    word-break: break-all;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .btn:hover {
      transform: none;
    }
  }
</style>
