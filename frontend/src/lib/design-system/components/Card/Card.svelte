<script lang="ts">
  /**
   * G-Rump Design System - Card Component
   * Container for grouped content
   */
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    variant = 'default',
    padding = 'md',
    interactive = false,
    onclick,
    children,
    header,
    footer,
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
  {#if header}
    <div class="card-header">
      {@render header()}
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
    background-color: var(--color-bg-secondary, #FFFFFF);
    border-radius: var(--radius-lg, 0.5rem);
    overflow: hidden;
  }

  /* Variants */
  .card-default {
    border: 1px solid var(--color-border-light, #F3F4F6);
  }

  .card-outlined {
    border: 1px solid var(--color-border-default, #E5E7EB);
  }

  .card-elevated {
    border: none;
    box-shadow: 0 1px 3px var(--shadow-sm, rgba(0, 0, 0, 0.05)),
                0 4px 6px var(--shadow-md, rgba(0, 0, 0, 0.1));
  }

  /* Padding */
  .card-padding-none .card-content,
  .card-padding-none .card-header,
  .card-padding-none .card-footer {
    padding: 0;
  }

  .card-padding-sm .card-content {
    padding: var(--space-2, 0.5rem);
  }

  .card-padding-sm .card-header,
  .card-padding-sm .card-footer {
    padding: var(--space-2, 0.5rem);
  }

  .card-padding-md .card-content {
    padding: var(--space-4, 1rem);
  }

  .card-padding-md .card-header,
  .card-padding-md .card-footer {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  }

  .card-padding-lg .card-content {
    padding: var(--space-6, 1.5rem);
  }

  .card-padding-lg .card-header,
  .card-padding-lg .card-footer {
    padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  }

  /* Header & Footer */
  .card-header {
    border-bottom: 1px solid var(--color-border-light, #F3F4F6);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.8rem);
  }

  .card-footer {
    border-top: 1px solid var(--color-border-light, #F3F4F6);
    background-color: var(--color-bg-code, #FAFAFA);
  }

  /* Interactive */
  .card-interactive {
    cursor: pointer;
    transition: var(--transition-fast, 150ms ease-out);
  }

  .card-interactive:hover {
    border-color: var(--color-border-dark, #D1D5DB);
  }

  .card-interactive:focus-visible {
    outline: 2px solid var(--color-accent-primary, #0066FF);
    outline-offset: 2px;
  }

  .card-interactive.card-elevated:hover {
    box-shadow: 0 2px 4px var(--shadow-sm, rgba(0, 0, 0, 0.05)),
                0 8px 16px var(--shadow-lg, rgba(0, 0, 0, 0.15));
  }
</style>
