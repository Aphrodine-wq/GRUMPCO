<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    title = 'Confirm',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onClose,
  }: Props = $props();
</script>

{#if open}
  <div class="confirm-overlay" onclick={onClose} role="presentation">
    <div class="confirm-container" onclick={(e) => e.stopPropagation()}>
      <h2 class="confirm-title">{title}</h2>
      {#if message}
        <p class="confirm-message">{message}</p>
      {/if}
      <div class="confirm-actions">
        <button type="button" class="btn-cancel" onclick={onClose}>{cancelLabel}</button>
        <button type="button" class="btn-confirm" onclick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 200ms ease-out;
  }

  .confirm-container {
    background: var(--color-bg-elevated, #1e1e2e);
    border: 1px solid var(--color-border-light, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
    animation: slideIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .confirm-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text, #e4e4e7);
    margin: 0 0 0.75rem;
  }

  .confirm-message {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    color: var(--color-text-muted, #a1a1aa);
    line-height: 1.5;
    margin: 0 0 1.25rem;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn-cancel {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-bg-subtle, #2a2a3c);
    color: var(--color-text, #e4e4e7);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover {
    background: var(--color-bg-card-hover, #333348);
  }

  .btn-confirm {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    background: var(--color-primary, #7c3aed);
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  }

  .btn-confirm:hover {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: scale(0.95) translateY(10px);
    }
    to {
      transform: scale(1) translateY(0);
    }
  }
</style>
