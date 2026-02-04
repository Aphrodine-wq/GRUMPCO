<script lang="ts">
  /**
   * ViewError – full-page error state within screen layout: message + Retry button.
   */
  import { AlertTriangle } from 'lucide-svelte';

  interface Props {
    message: string;
    title?: string;
    onRetry?: () => void;
  }

  let { message, title = 'Something went wrong', onRetry }: Props = $props();
</script>

<div class="view-error" role="alert">
  <div class="view-error-icon">
    <AlertTriangle width={48} height={48} strokeWidth={1.5} />
  </div>
  <h2 class="view-error-title">{title}</h2>
  <p class="view-error-message">{message}</p>
  {#if onRetry}
    <button type="button" class="view-error-retry" onclick={onRetry}>Retry</button>
  {/if}
</div>

<style>
  .view-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 1.5rem;
    min-height: 200px;
  }
  .view-error-icon {
    color: var(--color-error, #dc2626);
    margin-bottom: 1rem;
  }
  .view-error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text, #111);
    margin: 0 0 0.5rem 0;
  }
  .view-error-message {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 1.25rem 0;
    max-width: 400px;
    line-height: 1.5;
  }
  .view-error-retry {
    padding: 8px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: white;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .view-error-retry:hover {
    background: var(--color-primary-hover, #4f46e5);
  }
</style>
