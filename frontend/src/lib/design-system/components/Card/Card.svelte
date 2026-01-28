<script lang="ts">
  /**
   * G-Rump Design System - Card Component
   * Dark terminal/Claude Code aesthetic - Rigid box style
   */
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'outlined' | 'double';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
    title?: string;
  }

  let {
    variant = 'default',
    padding = 'md',
    interactive = false,
    onclick,
    children,
    header,
    footer,
    title = '',
  }: Props = $props();
</script>

<div
  class="card card-{variant} card-padding-{padding}"
  class:card-interactive={interactive}
  onclick={interactive ? onclick : undefined}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
  onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onclick?.(e as any); } : undefined}
>
  {#if title || header}
    <div class="card-header">
      {#if title}
        <span class="header-prefix">⏺</span>
        <span class="header-title">{title}</span>
      {:else if header}
        {@render header()}
      {/if}
    </div>
  {/if}

  <div class="card-content">
    {@render children()}
  </div>

  {#if footer}
    <div class="card-footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .card {
    background-color: var(--color-bg-secondary, #1A1A1A);
    border-radius: 0; /* Sharp corners */
    overflow: hidden;
    font-family: 'JetBrains Mono', monospace;
    position: relative;
    border: 1px solid var(--color-border-default, #333);
  }

  /* Variants */
  .card-default {
    border-color: #222;
  }

  .card-outlined {
    border-color: #444;
  }

  .card-double {
    border: 2px double #444;
  }

  /* Padding */
  .card-padding-none .card-content { padding: 0; }
  .card-padding-sm .card-content { padding: 8px; }
  .card-padding-md .card-content { padding: 16px; }
  .card-padding-lg .card-content { padding: 24px; }

  /* Header & Footer */
  .card-header {
    background-color: #121212;
    border-bottom: 1px solid #222;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-prefix {
    color: var(--color-accent-secondary, #00E5FF);
  }

  .header-title {
    color: #A3A3A3;
  }

  .card-footer {
    border-top: 1px solid #222;
    background-color: #0D0D0D;
    padding: 8px 12px;
    font-size: 11px;
    color: #525252;
  }

  /* Interactive */
  .card-interactive {
    cursor: pointer;
    transition: all 100ms ease;
  }

  .card-interactive:hover {
    border-color: var(--color-accent-primary, #00FF41);
    background-color: rgba(0, 255, 65, 0.02);
  }

  .card-interactive:focus-visible {
    outline: none;
    border-color: var(--color-accent-primary, #00FF41);
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.1);
  }
</style>
