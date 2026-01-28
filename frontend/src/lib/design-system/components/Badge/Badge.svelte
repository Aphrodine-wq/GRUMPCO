<script lang="ts">
  /**
   * G-Rump Design System - Badge Component
   * Status indicators and labels
   */
  import type { Snippet } from 'svelte';

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

<span class="badge badge-{variant} badge-{size}" class:badge-dot={dot}>
  {#if dot}
    <span class="badge-dot-indicator"></span>
  {/if}
  {@render children()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    font-family: var(--font-mono);
    font-weight: 500;
    border-radius: var(--radius-full, 9999px);
    white-space: nowrap;
  }

  /* Variants */
  .badge-default {
    background-color: var(--color-bg-tertiary, #EBEBEB);
    color: var(--color-text-secondary, #4B5563);
  }

  .badge-primary {
    background-color: var(--color-accent-primary-light, #E6F0FF);
    color: var(--color-accent-primary, #0066FF);
  }

  .badge-success {
    background-color: var(--color-status-success-light, #D1FAE5);
    color: var(--color-status-success, #059669);
  }

  .badge-warning {
    background-color: var(--color-status-warning-light, #FEF3C7);
    color: var(--color-status-warning, #F59E0B);
  }

  .badge-error {
    background-color: var(--color-status-error-light, #FEE2E2);
    color: var(--color-status-error, #DC2626);
  }

  .badge-info {
    background-color: var(--color-status-info-light, #DBEAFE);
    color: var(--color-status-info, #3B82F6);
  }

  /* Sizes */
  .badge-sm {
    padding: var(--space-0\.5, 0.125rem) var(--space-2, 0.5rem);
    font-size: var(--font-size-xs, 0.7rem);
  }

  .badge-md {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    font-size: var(--font-size-sm, 0.8rem);
  }

  /* Dot indicator */
  .badge-dot-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .badge-success .badge-dot-indicator {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
