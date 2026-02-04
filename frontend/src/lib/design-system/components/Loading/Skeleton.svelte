<script lang="ts">
  /**
   * G-Rump Design System - Skeleton Component
   * Animated loading placeholder
   */

  interface Props {
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string;
    height?: string;
    lines?: number;
    animated?: boolean;
  }

  let { variant = 'text', width = '100%', height, lines = 1, animated = true }: Props = $props();

  const defaultHeight: Record<typeof variant, string> = {
    text: '16px',
    circular: '48px',
    rectangular: '100px',
  };

  const computedHeight = $derived(height || defaultHeight[variant]);
</script>

{#if variant === 'text' && lines > 1}
  <div class="skeleton-lines">
    {#each Array(lines) as _, i}
      <div
        class="skeleton skeleton-text"
        class:animated
        style:width={i === lines - 1 ? '80%' : width}
        style:height={computedHeight}
      ></div>
    {/each}
  </div>
{:else}
  <div
    class="skeleton skeleton-{variant}"
    class:animated
    style:width={variant === 'circular' ? computedHeight : width}
    style:height={computedHeight}
  ></div>
{/if}

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--color-bg-input, #f3e8ff) 25%,
      var(--color-bg-card-hover, #f8f5ff) 50%,
      var(--color-bg-input, #f3e8ff) 75%
    );
    background-size: 200% 100%;
  }

  .skeleton.animated {
    animation: shimmer 1.5s infinite;
  }

  .skeleton-text {
    border-radius: 6px;
  }

  .skeleton-circular {
    border-radius: 50%;
  }

  .skeleton-rectangular {
    border-radius: 12px;
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton.animated {
      animation: none;
      background: var(--color-bg-input, #f3e8ff);
    }
  }
</style>
