<script lang="ts">
  /**
   * OnboardingDots - Simple step indicator dots.
   * Shared by onboarding flows and project wizard.
   */
  interface Props {
    total: number;
    current: number;
    onDotClick?: (index: number) => void;
    background?: string;
  }

  let { total, current, onDotClick, background = 'transparent' }: Props = $props();
</script>

<div class="dots" style:--dot-bg={background}>
  {#each Array(total) as _, i}
    <button
      type="button"
      class="dot"
      class:active={i === current}
      class:visited={i < current}
      onclick={() => onDotClick?.(i)}
      aria-label={`Step ${i + 1} of ${total}`}
    ></button>
  {/each}
</div>

<style>
  .dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    padding: 0;
    cursor: pointer;
    background: rgba(124, 58, 237, 0.2);
    transition: all 0.2s ease;
  }

  .dot:hover {
    background: rgba(124, 58, 237, 0.4);
    transform: scale(1.2);
  }

  .dot.active {
    width: 24px;
    border-radius: 4px;
    background: var(--color-primary, #7c3aed);
  }

  .dot.visited {
    background: rgba(124, 58, 237, 0.5);
  }
</style>
