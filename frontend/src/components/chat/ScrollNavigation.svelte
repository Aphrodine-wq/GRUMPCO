<script lang="ts">
  /**
   * ScrollNavigation Component
   *
   * Shows scroll to top/bottom buttons for long message threads.
   * Appears when user scrolls away from endpoints.
   */
  import { Tooltip } from '../../lib/design-system';

  interface Props {
    /** Scroll container element reference */
    scrollContainer: HTMLElement | null;
    /** Show threshold in pixels from top */
    showTopThreshold?: number;
    /** Show threshold in pixels from bottom */
    showBottomThreshold?: number;
  }

  let { scrollContainer, showTopThreshold = 200, showBottomThreshold = 200 }: Props = $props();

  let showScrollTop = $state(false);
  let showScrollBottom = $state(false);
  let isNearBottom = $state(true);

  $effect(() => {
    if (!scrollContainer) return;

    function handleScroll() {
      if (!scrollContainer) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

      // Show top button when scrolled down
      showScrollTop = scrollTop > showTopThreshold;

      // Show bottom button when not near bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      showScrollBottom = distanceFromBottom > showBottomThreshold;
      isNearBottom = distanceFromBottom < 50;
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  });

  function scrollToTop() {
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    scrollContainer?.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'smooth',
    });
  }
</script>

{#if showScrollTop || showScrollBottom}
  <div class="scroll-nav">
    {#if showScrollTop}
      <Tooltip content="Scroll to top" position="left">
        <button type="button" class="scroll-btn" onclick={scrollToTop} aria-label="Scroll to top">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      </Tooltip>
    {/if}

    {#if showScrollBottom}
      <Tooltip content="Scroll to bottom" position="left">
        <button
          type="button"
          class="scroll-btn"
          class:highlight={!isNearBottom}
          onclick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </Tooltip>
    {/if}
  </div>
{/if}

<style>
  .scroll-nav {
    position: fixed;
    right: 24px;
    bottom: 140px; /* Above the input area */
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 50;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .scroll-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 50%;
    color: #6b7280;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.15s;
  }

  .scroll-btn:hover {
    background: #f9fafb;
    border-color: #d1d5db;
    color: #374151;
    transform: scale(1.05);
  }

  .scroll-btn:active {
    transform: scale(0.95);
  }

  .scroll-btn.highlight {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
    color: white;
    animation: pulse 2s ease-in-out infinite;
  }

  .scroll-btn.highlight:hover {
    background: var(--color-primary-dark, #6d28d9);
    border-color: var(--color-primary-dark, #6d28d9);
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    50% {
      box-shadow: 0 2px 16px rgba(124, 58, 237, 0.3);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-nav {
      animation: none;
    }

    .scroll-btn {
      transition: none;
    }

    .scroll-btn:hover,
    .scroll-btn:active {
      transform: none;
    }

    .scroll-btn.highlight {
      animation: none;
    }
  }
</style>
