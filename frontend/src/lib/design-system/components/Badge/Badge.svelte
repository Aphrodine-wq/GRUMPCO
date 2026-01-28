<script lang="ts">
  /**
   * G-Rump Design System - Badge Component
   * Clean, professional light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';

  interface Props {
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
    size?: 'sm' | 'md';
    dot?: boolean;
    children: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    dot = false,
    children,
  }: Props = $props();
</script>

<span 
  class="badge badge-{variant} badge-{size}" 
  class:badge-dot={dot}
  style:--bg-default={colors.background.tertiary}
  style:--text-default={colors.text.secondary}
  style:--primary={colors.accent.primary}
  style:--primary-bg={colors.accent.primaryLight}
  style:--success={colors.status.success}
  style:--success-bg={colors.status.successLight}
  style:--error={colors.status.error}
  style:--error-bg={colors.status.errorLight}
  style:--warning={colors.status.warning}
  style:--warning-bg={colors.status.warningLight}
  style:--info={colors.status.info}
  style:--info-bg={colors.status.infoLight}
>
  {#if dot}
    <span class="badge-dot-indicator"></span>
  {/if}
  <span class="badge-content">
    {@render children()}
  </span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    font-weight: 500;
    border-radius: 9999px;
    white-space: nowrap;
  }

  /* Variants */
  .badge-default {
    background-color: var(--bg-default);
    color: var(--text-default);
  }

  .badge-primary {
    background-color: var(--primary-bg);
    color: var(--primary);
  }

  .badge-success {
    background-color: var(--success-bg);
    color: var(--success);
  }

  .badge-warning {
    background-color: var(--warning-bg);
    color: var(--warning);
  }

  .badge-error {
    background-color: var(--error-bg);
    color: var(--error);
  }

  .badge-info {
    background-color: var(--info-bg);
    color: var(--info);
  }

  /* Sizes */
  .badge-sm {
    padding: 0 8px;
    font-size: 11px;
    height: 20px;
    border-radius: 6px;
  }

  .badge-md {
    padding: 4px 12px;
    font-size: 12px;
    height: 24px;
    border-radius: 6px;
  }

  /* Dot indicator */
  .badge-dot-indicator {
    width: 6px;
    height: 6px;
    background-color: currentColor;
    border-radius: 50%;
  }

  .badge-content {
    display: inline-block;
  }
</style>
