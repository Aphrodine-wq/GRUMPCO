<script lang="ts">
  /**
   * G-Rump Design System - Modal/Dialog Component
   * Accessible, animated modal with backdrop
   */
  import type { Snippet } from 'svelte';
  import { X } from 'lucide-svelte';
  import { fade, scale } from 'svelte/transition';

  interface Props {
    open?: boolean;
    onClose?: () => void;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(false),
    onClose,
    title,
    description,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    children,
    footer,
  }: Props = $props();

  let dialogRef: HTMLDialogElement | null = $state(null);

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (closeOnBackdrop && e.target === dialogRef) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEscape && e.key === 'Escape') {
      handleClose();
    }
  }

  $effect(() => {
    if (open && dialogRef) {
      dialogRef.showModal();
      document.body.style.overflow = 'hidden';
    } else if (dialogRef) {
      dialogRef.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  });

  const sizeClasses: Record<typeof size, string> = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg',
    xl: 'modal-xl',
    full: 'modal-full',
  };
</script>

{#if open}
  <dialog
    bind:this={dialogRef}
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    aria-labelledby={title ? 'modal-title' : undefined}
    aria-describedby={description ? 'modal-description' : undefined}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="modal-container {sizeClasses[size]}"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      {#if title || showCloseButton}
        <header class="modal-header">
          <div class="modal-header-text">
            {#if title}
              <h2 id="modal-title" class="modal-title">{title}</h2>
            {/if}
            {#if description}
              <p id="modal-description" class="modal-description">{description}</p>
            {/if}
          </div>
          {#if showCloseButton}
            <button
              type="button"
              class="modal-close"
              onclick={handleClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          {/if}
        </header>
      {/if}

      <div class="modal-body">
        {@render children()}
      </div>

      {#if footer}
        <footer class="modal-footer">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </dialog>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    border: none;
    padding: 16px;
    margin: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    z-index: 1000;
  }

  .modal-backdrop::backdrop {
    display: none;
  }

  .modal-container {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    max-height: calc(100vh - 32px);
    overflow: hidden;
  }

  /* Sizes */
  .modal-sm {
    width: 100%;
    max-width: 400px;
  }

  .modal-md {
    width: 100%;
    max-width: 500px;
  }

  .modal-lg {
    width: 100%;
    max-width: 680px;
  }

  .modal-xl {
    width: 100%;
    max-width: 900px;
  }

  .modal-full {
    width: calc(100vw - 32px);
    height: calc(100vh - 32px);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .modal-header-text {
    flex: 1;
    min-width: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    line-height: 1.3;
  }

  .modal-description {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--color-text-muted, #6d28d9);
    line-height: 1.5;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--color-text-muted, #6d28d9);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .modal-close:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
    color: var(--color-text, #1f1147);
  }

  .modal-close:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--color-border-light, #f3e8ff);
    background: var(--color-bg-card, rgba(255, 255, 255, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-container {
      transition: none;
    }
  }
</style>
