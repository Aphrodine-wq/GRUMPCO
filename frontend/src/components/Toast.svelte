<script lang="ts">
  import { toasts, dismissToast } from '../stores/toastStore';
</script>

{#if document.body}
  <svelte:body>
    <div class="toast-container" aria-live="polite">
      {#each $toasts as toast (toast.id)}
        <div
          class="toast toast--{toast.type}"
          role="alert"
        >
          <div class="toast-icon">
            {#if toast.type === 'success'}
              <span>&#10003;</span>
            {:else if toast.type === 'error'}
              <span>&#10005;</span>
            {:else}
              <span>&#8505;</span>
            {/if}
          </div>
          <span class="toast-message">{toast.message}</span>
          {#if toast.actions && toast.actions.length > 0}
            <div class="toast-actions">
              {#each toast.actions as action}
                <button
                  class="toast-action-btn"
                  class:primary={action.primary}
                  on:click={() => {
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
          <button 
            class="toast-dismiss" 
            on:click={() => {
              if (toast.onDismiss) {
                toast.onDismiss();
              }
              dismissToast(toast.id);
            }}
            aria-label="Dismiss notification"
          >
            &#10005;
          </button>
          {#if toast.duration > 0}
            <div 
              class="toast-progress"
              style="animation-duration: {toast.duration}ms"
            ></div>
          {/if}
        </div>
      {/each}
    </div>
  </svelte:body>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 360px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #E5E5E5;
    pointer-events: auto;
    position: relative;
    overflow: hidden;
    animation: toast-slide-in 250ms ease-out forwards;
  }

  .toast--success {
    border-color: #0066FF;
  }

  .toast--success .toast-icon {
    color: #0066FF;
  }

  .toast--error {
    border-color: #DC2626;
  }

  .toast--error .toast-icon {
    color: #DC2626;
  }

  .toast--info {
    border-color: #6B7280;
  }

  .toast--info .toast-icon {
    color: #9CA3AF;
  }

  .toast-icon {
    flex-shrink: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: 0.5rem;
  }

  .toast-action-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid currentColor;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    opacity: 0.8;
  }

  .toast-action-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .toast-action-btn.primary {
    background: currentColor;
    color: #1a1a1a;
    opacity: 1;
  }

  .toast-action-btn.primary:hover {
    opacity: 0.9;
  }

  .toast-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #6B7280;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 0.75rem;
    line-height: 1;
    transition: color 150ms ease;
  }

  .toast-dismiss:hover {
    color: #E5E5E5;
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: currentColor;
    transform-origin: left;
    animation: toast-progress linear forwards;
  }

  .toast--success .toast-progress {
    background: #0066FF;
  }

  .toast--error .toast-progress {
    background: #DC2626;
  }

  .toast--info .toast-progress {
    background: #6B7280;
  }

  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
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
    .toast {
      animation: none;
      transition: opacity 150ms ease;
    }
    
    .toast-progress {
      animation: none;
      display: none;
    }
  }

  @media (max-width: 480px) {
    .toast-container {
      left: 1rem;
      right: 1rem;
      max-width: none;
    }
  }
</style>
