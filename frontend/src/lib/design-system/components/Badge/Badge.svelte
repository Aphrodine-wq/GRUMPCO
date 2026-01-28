<script lang="ts">
  /**
   * G-Rump Design System - Badge Component
   * Dark terminal/Claude Code aesthetic - Tag style
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
  <span class="badge-content">
    {@render children()}
  </span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 0; /* Square for terminal feel */
    white-space: nowrap;
    border: 1px solid transparent;
  }

  /* Variants */
  .badge-default {
    background-color: #262626;
    color: #A3A3A3;
    border-color: #404040;
  }

  .badge-primary {
    background-color: rgba(0, 255, 65, 0.1);
    color: var(--color-accent-primary, #00FF41);
    border-color: var(--color-accent-primary, #00FF41);
  }

  .badge-success {
    background-color: rgba(0, 255, 65, 0.1);
    color: #00FF41;
    border-color: #00FF41;
  }

  .badge-warning {
    background-color: rgba(255, 215, 0, 0.1);
    color: #FFD700;
    border-color: #FFD700;
  }

  .badge-error {
    background-color: rgba(255, 49, 49, 0.1);
    color: #FF3131;
    border-color: #FF3131;
  }

  .badge-info {
    background-color: rgba(0, 229, 255, 0.1);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  /* Sizes */
  .badge-sm {
    padding: 0 6px;
    font-size: 10px;
    height: 18px;
  }

  .badge-md {
    padding: 2px 8px;
    font-size: 11px;
    height: 22px;
  }

  /* Dot indicator */
  .badge-dot-indicator {
    width: 6px;
    height: 6px;
    background-color: currentColor;
    border-radius: 0; /* Square dot */
  }

  .badge-success .badge-dot-indicator {
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .badge-content {
    display: inline-block;
  }
</style>
