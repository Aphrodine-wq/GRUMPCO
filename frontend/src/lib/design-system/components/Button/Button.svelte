<script lang="ts">
  /**
   * G-Rump Design System - Button Component
   * Professional, consistent light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';

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
  style:--primary-color={colors.accent.primary}
  style:--primary-hover={colors.accent.primaryHover}
  style:--text-primary={colors.text.primary}
  style:--text-inverse={colors.text.inverse}
  style:--border-default={colors.border.default}
  style:--error-color={colors.status.error}
  style:--radius-md={colors.shadow.md ? '6px' : '4px'} 
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
    font-family: inherit;
    font-weight: 500;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    position: relative;
    white-space: nowrap;
    user-select: none;
  }

  .btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Variants */
  .btn-primary {
    background-color: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .btn-secondary {
    background-color: #fff;
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #d1d5db;
  }

  .btn-ghost {
    background-color: transparent;
    color: #4b5563;
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: #f3f4f6;
    color: var(--text-primary);
  }

  .btn-danger {
    background-color: #fff;
    color: var(--error-color);
    border-color: #fee2e2;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #fef2f2;
    border-color: var(--error-color);
  }

  /* Sizes */
  .btn-sm {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }

  .btn-md {
    height: 40px;
    padding: 0 16px;
    font-size: 14px;
  }

  .btn-lg {
    height: 48px;
    padding: 0 24px;
    font-size: 16px;
  }

  .btn-full-width {
    width: 100%;
  }

  .btn-spinner {
    position: absolute;
    width: 16px;
    height: 16px;
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
