<script lang="ts">
  /**
   * FeatureSpotlight - Contextual hints for feature discovery
   * Shows a pulsing indicator that reveals a tooltip on hover/click
   */
  import { fly } from 'svelte/transition';
  import { Lightbulb, X } from 'lucide-svelte';

  interface Props {
    id: string;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    variant?: 'dot' | 'icon' | 'inline';
    persistent?: boolean;
    onDismiss?: (id: string) => void;
  }

  let {
    id,
    title,
    description,
    position = 'bottom',
    variant = 'dot',
    persistent = false,
    onDismiss,
  }: Props = $props();

  let isOpen = $state(false);
  let dismissed = $state(false);

  function toggleOpen() {
    isOpen = !isOpen;
  }

  function dismiss() {
    dismissed = true;
    isOpen = false;
    onDismiss?.(id);
    // Persist dismissal
    try {
      const key = `grump-hint-dismissed-${id}`;
      localStorage.setItem(key, 'true');
    } catch {}
  }

  // Check if already dismissed
  $effect(() => {
    try {
      const key = `grump-hint-dismissed-${id}`;
      if (localStorage.getItem(key) === 'true') {
        dismissed = true;
      }
    } catch {}
  });

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-white border-x-transparent border-b-transparent',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-b-white border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-white border-y-transparent border-r-transparent',
    right:
      'right-full top-1/2 -translate-y-1/2 border-r-white border-y-transparent border-l-transparent',
  };
</script>

{#if !dismissed}
  <div class="spotlight-container" class:inline={variant === 'inline'}>
    <!-- Trigger -->
    {#if variant === 'dot'}
      <button
        class="spotlight-dot"
        onclick={toggleOpen}
        aria-label="Feature hint"
        aria-expanded={isOpen}
      >
        <span class="dot-pulse"></span>
        <span class="dot-core"></span>
      </button>
    {:else if variant === 'icon'}
      <button
        class="spotlight-icon"
        onclick={toggleOpen}
        aria-label="Feature hint"
        aria-expanded={isOpen}
      >
        <Lightbulb size={16} />
      </button>
    {:else}
      <button class="spotlight-inline" onclick={toggleOpen} aria-expanded={isOpen}>
        <Lightbulb size={14} />
        <span>Tip</span>
      </button>
    {/if}

    <!-- Tooltip -->
    {#if isOpen}
      <div
        class="spotlight-tooltip {positionClasses[position]}"
        transition:fly={{ y: position === 'top' ? 8 : -8, duration: 150 }}
      >
        <div class="tooltip-arrow {arrowClasses[position]}"></div>
        <div class="tooltip-header">
          <h4 class="tooltip-title">{title}</h4>
          {#if !persistent}
            <button class="tooltip-close" onclick={dismiss} aria-label="Dismiss hint">
              <X size={14} />
            </button>
          {/if}
        </div>
        <p class="tooltip-description">{description}</p>
        {#if !persistent}
          <button class="tooltip-dismiss" onclick={dismiss}> Got it </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .spotlight-container {
    position: relative;
    display: inline-flex;
  }

  .spotlight-container.inline {
    display: block;
    margin: 8px 0;
  }

  /* Dot variant */
  .spotlight-dot {
    position: relative;
    width: 12px;
    height: 12px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .dot-core {
    position: absolute;
    inset: 2px;
    background: #7c3aed;
    border-radius: 50%;
  }

  .dot-pulse {
    position: absolute;
    inset: 0;
    background: rgba(124, 58, 237, 0.4);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.4;
    }
    50% {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  /* Icon variant */
  .spotlight-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 50%;
    color: #92400e;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .spotlight-icon:hover {
    background: #fde68a;
    transform: scale(1.1);
  }

  /* Inline variant */
  .spotlight-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    color: #92400e;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .spotlight-inline:hover {
    background: #fde68a;
  }

  /* Tooltip */
  .spotlight-tooltip {
    position: absolute;
    z-index: 1000;
    width: 280px;
    padding: 14px;
    background: white;
    border-radius: 12px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.15),
      0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }

  .tooltip-arrow {
    position: absolute;
    border-width: 6px;
    border-style: solid;
  }

  .tooltip-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .tooltip-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #18181b;
  }

  .tooltip-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #a1a1aa;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .tooltip-close:hover {
    background: #f4f4f5;
    color: #3f3f46;
  }

  .tooltip-description {
    margin: 0 0 12px;
    font-size: 13px;
    color: #71717a;
    line-height: 1.5;
  }

  .tooltip-dismiss {
    width: 100%;
    padding: 8px 12px;
    background: #7c3aed;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .tooltip-dismiss:hover {
    background: #6d28d9;
  }

  @media (prefers-reduced-motion: reduce) {
    .dot-pulse {
      animation: none;
      opacity: 0;
    }
  }
</style>
