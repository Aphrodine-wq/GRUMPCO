<script lang="ts">
  /**
   * Toast - Enhanced notification component with design system integration
   * Features: Slide-in/out animations, progress indicator, action buttons
   */
  import { toasts, dismissToast } from '../stores/toastStore';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { CheckCircle, XCircle, Info, X } from 'lucide-svelte';
</script>

<div class="toast-container" aria-live="polite" aria-atomic="true">
  {#each $toasts as toast (toast.id)}
    <div
      class="toast toast--{toast.type}"
      role="alert"
      in:fly={{ x: 300, duration: 200 }}
      out:fly={{ x: 300, duration: 150 }}
      animate:flip={{ duration: 200 }}
    >
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <CheckCircle size={20} />
        {:else if toast.type === 'error'}
          <XCircle size={20} />
        {:else}
          <Info size={20} />
        {/if}
      </div>
      <div class="toast-content">
        <span class="toast-message">{toast.message}</span>
        {#if toast.actions && toast.actions.length > 0}
          <div class="toast-actions">
            {#each toast.actions as action}
              <button
                class="toast-action-btn"
                class:primary={action.primary}
                onclick={() => {
                  action.action();
                  if (!toast.persistent) {
                    dismissToast(toast.id);
                  }
                }}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button
        class="toast-dismiss"
        onclick={() => {
          if (toast.onDismiss) {
            toast.onDismiss();
          }
          dismissToast(toast.id);
        }}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
      {#if toast.duration > 0}
        <div class="toast-progress" style="animation-duration: {toast.duration}ms"></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
    max-width: 400px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--color-bg-elevated, #ffffff);
    border-radius: 12px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    font-size: 14px;
    color: var(--color-text, #18181b);
    pointer-events: auto;
    position: relative;
    overflow: hidden;
  }

  .toast--success {
    border-left: 4px solid #10b981;
  }

  .toast--success .toast-icon {
    color: #10b981;
  }

  .toast--error {
    border-left: 4px solid #ef4444;
  }

  .toast--error .toast-icon {
    color: #ef4444;
  }

  .toast--info {
    border-left: 4px solid #7c3aed;
  }

  .toast--info .toast-icon {
    color: #7c3aed;
  }

  .toast-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    display: block;
    line-height: 1.5;
    word-wrap: break-word;
  }

  .toast-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .toast-action-btn {
    padding: 6px 12px;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 6px;
    background: var(--color-bg-elevated, #ffffff);
    color: var(--color-text-secondary, #3f3f46);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toast-action-btn:hover {
    background: var(--color-bg-card-hover, #f4f4f5);
    border-color: var(--color-border, #d4d4d8);
  }

  .toast-action-btn.primary {
    background: #7c3aed;
    border-color: #7c3aed;
    color: white;
  }

  .toast-action-btn.primary:hover {
    background: #6d28d9;
    border-color: #6d28d9;
  }

  .toast-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--color-text-muted, #a1a1aa);
    cursor: pointer;
    padding: 4px;
    margin: -4px -4px -4px 0;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;
  }

  .toast-dismiss:hover {
    color: var(--color-text-secondary, #3f3f46);
    background: var(--color-bg-card-hover, #f4f4f5);
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: currentColor;
    opacity: 0.2;
    transform-origin: left;
    animation: toast-progress linear forwards;
  }

  .toast--success .toast-progress {
    background: #10b981;
  }

  .toast--error .toast-progress {
    background: #ef4444;
  }

  .toast--info .toast-progress {
    background: #7c3aed;
  }

  @keyframes toast-progress {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-progress {
      animation: none;
      display: none;
    }
  }
</style>
