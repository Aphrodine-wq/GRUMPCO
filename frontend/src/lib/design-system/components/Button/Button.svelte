<script lang="ts">
  /**
   * G-Rump Design System - Button Component
   * Dark terminal/Claude Code aesthetic
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
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
    border-radius: 0; /* Square corners for terminal feel */
    cursor: pointer;
    transition: all 100ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    white-space: nowrap;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent-primary, #00FF41);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    border-color: #333;
    background-color: transparent;
    color: #666;
  }

  /* Variants */
  .btn-primary {
    background-color: var(--color-accent-primary, #00FF41);
    color: #000000;
    border-color: var(--color-accent-primary, #00FF41);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: transparent;
    color: var(--color-accent-primary, #00FF41);
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.2);
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--color-text-primary, #D4D4D4);
    border-color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-accent-secondary, #00E5FF);
    color: var(--color-accent-secondary, #00E5FF);
    background-color: rgba(0, 229, 255, 0.05);
  }

  .btn-ghost {
    background-color: transparent;
    color: #666;
    border-color: transparent;
  }

  .btn-ghost:hover:not(:disabled) {
    color: var(--color-text-primary, #D4D4D4);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .btn-danger {
    background-color: transparent;
    color: #FF3131;
    border-color: #FF3131;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #FF3131;
    color: #000;
  }

  /* Sizes */
  .btn-sm {
    height: 32px;
    padding: 0 12px;
    font-size: 11px;
  }

  .btn-md {
    height: 40px;
    padding: 0 16px;
    font-size: 13px;
  }

  .btn-lg {
    height: 48px;
    padding: 0 24px;
    font-size: 15px;
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
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .btn-content-hidden {
    visibility: hidden;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
