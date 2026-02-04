<script lang="ts">
  /**
   * EmptyState – one pattern for empty views: FrownyFace + headline + description + CTA.
   */
  import type { Snippet } from 'svelte';
  import FrownyFace from './FrownyFace.svelte';

  interface Props {
    headline: string;
    description?: string;
    variant?: 'default' | 'compact';
    children?: Snippet;
  }

  let { headline, description = '', variant = 'default', children }: Props = $props();
</script>

<div class="empty-state" class:compact={variant === 'compact'} role="status">
  <div class="empty-state-illustration">
    <FrownyFace state="idle" size={variant === 'compact' ? 'md' : 'lg'} />
  </div>
  <h2 class="empty-state-headline">{headline}</h2>
  {#if description}
    <p class="empty-state-description">{description}</p>
  {/if}
  {#if children}
    <div class="empty-state-cta">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 1.5rem;
    min-height: 200px;
  }
  .empty-state-illustration {
    margin-bottom: 1.25rem;
  }
  .empty-state-headline {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text, #111);
    margin: 0 0 0.5rem 0;
  }
  .empty-state-description {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 1.25rem 0;
    max-width: 320px;
    line-height: 1.5;
  }
  .empty-state-cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }

  .empty-state.compact {
    padding: 1rem 0.75rem;
    min-height: 120px;
  }
  .empty-state.compact .empty-state-headline {
    font-size: 1rem;
  }
  .empty-state.compact .empty-state-description {
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }
</style>
