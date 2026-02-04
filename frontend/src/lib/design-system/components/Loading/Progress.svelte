<script lang="ts">
  /**
   * G-Rump Design System - Progress Component
   * Linear progress bar with animation
   */

  interface Props {
    value?: number;
    max?: number;
    indeterminate?: boolean;
    size?: 'sm' | 'md' | 'lg';
    color?: 'primary' | 'success' | 'warning' | 'error';
    showLabel?: boolean;
    label?: string;
  }

  let {
    value = 0,
    max = 100,
    indeterminate = false,
    size = 'md',
    color = 'primary',
    showLabel = false,
    label,
  }: Props = $props();

  const percentage = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
  const displayLabel = $derived(label || `${Math.round(percentage)}%`);
</script>

<div class="progress-container progress-{size}">
  {#if showLabel}
    <div class="progress-header">
      <span class="progress-label">{displayLabel}</span>
    </div>
  {/if}

  <div
    class="progress-track"
    role="progressbar"
    aria-valuenow={indeterminate ? undefined : value}
    aria-valuemin={0}
    aria-valuemax={max}
  >
    <div
      class="progress-bar progress-{color}"
      class:indeterminate
      style:width={indeterminate ? '100%' : `${percentage}%`}
    ></div>
  </div>
</div>

<style>
  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .progress-header {
    display: flex;
    justify-content: flex-end;
  }

  .progress-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted, #6d28d9);
  }

  .progress-track {
    width: 100%;
    background: var(--color-bg-input, #f3e8ff);
    border-radius: 999px;
    overflow: hidden;
  }

  /* Sizes */
  .progress-sm .progress-track {
    height: 4px;
  }

  .progress-md .progress-track {
    height: 8px;
  }

  .progress-lg .progress-track {
    height: 12px;
  }

  .progress-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 300ms ease;
  }

  .progress-bar.indeterminate {
    width: 40% !important;
    animation: indeterminate 1.5s ease-in-out infinite;
  }

  /* Colors */
  .progress-primary {
    background: var(--color-primary, #7c3aed);
  }

  .progress-success {
    background: var(--color-success, #34c759);
  }

  .progress-warning {
    background: var(--color-warning, #ff9500);
  }

  .progress-error {
    background: var(--color-error, #ff3b30);
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-bar {
      transition: none;
    }

    .progress-bar.indeterminate {
      animation-duration: 2s;
    }
  }
</style>
