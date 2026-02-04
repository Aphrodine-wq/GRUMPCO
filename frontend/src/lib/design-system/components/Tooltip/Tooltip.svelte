<script lang="ts">
  /**
   * G-Rump Design System - Tooltip Component
   * Lightweight, accessible tooltip with positioning
   */
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  interface Props {
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    disabled?: boolean;
    children: Snippet;
  }

  let { content, position = 'top', delay = 200, disabled = false, children }: Props = $props();

  let visible = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function show() {
    if (disabled) return;
    timeoutId = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hide() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    visible = false;
  }
</script>

<div
  class="tooltip-wrapper"
  role="button"
  tabindex="0"
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      show();
    }
  }}
>
  {@render children()}

  {#if visible && content}
    <div class="tooltip tooltip-{position}" role="tooltip" transition:fade={{ duration: 100 }}>
      <span class="tooltip-content">{content}</span>
      <span class="tooltip-arrow"></span>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
    white-space: nowrap;
  }

  .tooltip-content {
    display: block;
    padding: 6px 10px;
    background: var(--color-text, #1f1147);
    color: white;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .tooltip-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--color-text, #1f1147);
    transform: rotate(45deg);
  }

  /* Positions */
  .tooltip-top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-top .tooltip-arrow {
    bottom: -4px;
    left: 50%;
    margin-left: -4px;
  }

  .tooltip-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-bottom .tooltip-arrow {
    top: -4px;
    left: 50%;
    margin-left: -4px;
  }

  .tooltip-left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  .tooltip-left .tooltip-arrow {
    right: -4px;
    top: 50%;
    margin-top: -4px;
  }

  .tooltip-right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  .tooltip-right .tooltip-arrow {
    left: -4px;
    top: 50%;
    margin-top: -4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tooltip {
      transition: none;
    }
  }
</style>
