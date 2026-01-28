<script lang="ts">
  /**
   * G-Rump Design System - Button Component
   * Consistent button styling across the application
   */
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    type = 'button',
    onclick,
    children,
  }: Props = $props();

  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  class="btn btn-{variant} btn-{size}"
  class:btn-full-width={fullWidth}
  class:btn-loading={loading}
  disabled={isDisabled}
  onclick={onclick}
>
  {#if loading}
    <span class="btn-spinner"></span>
  {/if}
  <span class="btn-content" class:btn-content-hidden={loading}>
    {@render children()}
  </span>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 0.5rem);
    font-family: var(--font-mono);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md, 0.375rem);
    cursor: pointer;
    transition: var(--transition-fast, 150ms ease-out);
    position: relative;
    white-space: nowrap;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent-primary, #0066FF);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Variants */
  .btn-primary {
    background-color: var(--color-accent-primary, #0066FF);
    color: var(--color-text-inverse, #FFFFFF);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-accent-primary-hover, #0052CC);
  }

  .btn-secondary {
    background-color: var(--color-bg-tertiary, #EBEBEB);
    color: var(--color-text-primary, #000000);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-border-default, #E5E7EB);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--color-text-primary, #000000);
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary, #EBEBEB);
  }

  .btn-danger {
    background-color: var(--color-status-error, #DC2626);
    color: var(--color-text-inverse, #FFFFFF);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #B91C1C;
  }

  /* Sizes */
  .btn-sm {
    height: var(--space-7, 1.75rem);
    padding: 0 var(--space-3, 0.75rem);
    font-size: var(--font-size-xs, 0.7rem);
  }

  .btn-md {
    height: var(--space-9, 2.25rem);
    padding: 0 var(--space-4, 1rem);
    font-size: var(--font-size-sm, 0.8rem);
  }

  .btn-lg {
    height: var(--space-11, 2.75rem);
    padding: 0 var(--space-6, 1.5rem);
    font-size: var(--font-size-base, 0.875rem);
  }

  /* Full width */
  .btn-full-width {
    width: 100%;
  }

  /* Loading state */
  .btn-loading {
    pointer-events: none;
  }

  .btn-spinner {
    position: absolute;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .btn-content-hidden {
    visibility: hidden;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
