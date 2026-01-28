<script lang="ts">
  /**
   * G-Rump Design System - Card Component
   * Clean, professional light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';

  interface Props {
    variant?: 'default' | 'outlined' | 'flat';
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
  style:--bg-card={colors.background.secondary}
  style:--border-color={colors.border.default}
  style:--text-primary={colors.text.primary}
  style:--text-secondary={colors.text.secondary}
  style:--shadow-md={colors.shadow.md}
  style:--primary-color={colors.accent.primary}
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
    border-radius: 8px;
    overflow: hidden;
    font-family: inherit;
    position: relative;
    border: 1px solid var(--border-color);
    transition: all 200ms ease;
  }

  /* Variants */
  .card-default {
    box-shadow: var(--shadow-md);
  }

  .card-outlined {
    box-shadow: none;
  }

  .card-flat {
    background-color: #f9fafb;
    border: none;
    box-shadow: none;
  }

  /* Padding */
  .card-padding-none .card-content { padding: 0; }
  .card-padding-sm .card-content { padding: 12px; }
  .card-padding-md .card-content { padding: 20px; }
  .card-padding-lg .card-content { padding: 32px; }

  /* Header & Footer */
  .card-header {
    border-bottom: 1px solid var(--border-color);
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
    border-top: 1px solid var(--border-color);
    background-color: #f9fafb;
    padding: 12px 20px;
  }

  /* Interactive */
  .card-interactive {
    cursor: pointer;
  }

  .card-interactive:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .card-interactive:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
</style>
