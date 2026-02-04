<script lang="ts">
  /**
   * G-Rump Design System - Card Component
   * Clean, professional light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';
  import { animations } from '../../tokens/animations';

  interface Props {
    variant?: 'default' | 'outlined' | 'flat';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
    title?: string;
    class?: string;
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
    class: className = '',
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="card card-{variant} card-padding-{padding} {className}"
  class:card-interactive={interactive}
  onclick={interactive ? onclick : undefined}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
  onkeydown={interactive
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') onclick?.(e as any);
      }
    : undefined}
  style:--bg-card={colors.background.secondary}
  style:--border-color={colors.border.default}
  style:--text-primary={colors.text.primary}
  style:--text-secondary={colors.text.secondary}
  style:--shadow-md={colors.shadow.md}
  style:--primary-color={colors.accent.primary}
  style:--transition-micro={animations.transition.fast}
>
  {#if title || header}
    <div class="card-header">
      {#if title}
        <h3 class="header-title">{title}</h3>
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
    background-color: var(--bg-card);
    border-radius: 16px;
    overflow: hidden;
    font-family: inherit;
    position: relative;
    border: 0;
    transition:
      transform var(--transition-micro),
      box-shadow var(--transition-micro);
  }

  /* Variants */
  .card-default {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  }

  .card-outlined {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .card-flat {
    background-color: #f5f5f5;
    border: 0;
    box-shadow: none;
  }

  /* Padding */
  .card-padding-none .card-content {
    padding: 0;
  }
  .card-padding-sm .card-content {
    padding: 12px;
  }
  .card-padding-md .card-content {
    padding: 20px;
  }
  .card-padding-lg .card-content {
    padding: 32px;
  }

  /* Header & Footer */
  .card-header {
    border-bottom: 1px solid #f0f0f0;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .card-footer {
    border-top: 1px solid #f0f0f0;
    background-color: #f9f9f9;
    padding: 12px 20px;
  }

  /* Interactive */
  .card-interactive {
    cursor: pointer;
  }

  .card-interactive:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  .card-interactive:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .card-interactive:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
    .card-interactive:hover,
    .card-interactive:active {
      transform: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
  }
</style>
