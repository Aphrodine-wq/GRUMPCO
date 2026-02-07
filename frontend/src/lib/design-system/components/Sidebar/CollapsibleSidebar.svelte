<script lang="ts">
  /**
   * G-Rump Design System - CollapsibleSidebar Component
   * Professional, consistent light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';
  import { animations } from '../../tokens/animations';

  interface Props {
    collapsed?: boolean;
    onToggle?: () => void;
    width?: number;
    collapsedWidth?: number;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    collapsed = $bindable(false),
    onToggle,
    width = 230,
    collapsedWidth = 64,
    children,
    header,
    footer,
  }: Props = $props();

  function toggleCollapse() {
    if (onToggle) onToggle();
    else collapsed = !collapsed;
  }
</script>

<aside
  class="sidebar"
  style="width: {collapsed ? collapsedWidth : width}px"
  style:--bg-sidebar={colors.background.sidebar}
  style:--border-color={colors.diff.lineNumber.border}
  style:--bg-header={colors.background.tertiary}
  style:--primary-color={colors.accent.primary}
  style:--text-muted={colors.text.muted}
  style:--transition-default={animations.transition.default}
  style:--transition-micro={animations.transition.fast}
>
  <div class="sidebar-inner">
    {#if header}
      <div class="sidebar-header">
        {@render header()}
      </div>
    {/if}

    <nav class="sidebar-content">
      {@render children()}
    </nav>

    {#if footer}
      <div class="sidebar-footer">
        {@render footer()}
      </div>
    {:else}
      <div class="sidebar-footer-spacer"></div>
    {/if}
  </div>

  <button
    class="collapse-toggle"
    onclick={toggleCollapse}
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="toggle-icon"
      class:is-collapsed={collapsed}
    >
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: calc(100% - 24px);
    margin: 12px;
    background-color: var(--bg-sidebar);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    transition: width var(--transition-default);
    position: relative;
    font-family: inherit;
    z-index: 20;
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-radius: 16px;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--color-bg-card, rgba(255, 255, 255, 0.5)); /* Subtle transparency */
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 8px;
  }

  /* Custom scrollbar for sidebar */
  .sidebar-content::-webkit-scrollbar {
    width: 4px;
  }
  .sidebar-content::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 4px;
  }
  .sidebar-content:hover::-webkit-scrollbar-thumb {
    background: #c7c7cc;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border-color);
    background-color: var(--color-bg-card, rgba(255, 255, 255, 0.5));
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
    min-height: 0;
  }

  .sidebar-footer-spacer {
    height: 16px;
  }

  .collapse-toggle {
    position: absolute;
    right: -12px;
    top: 32px;
    width: 24px;
    height: 24px;
    background-color: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    z-index: 10;
    transition:
      transform var(--transition-micro),
      background-color var(--transition-micro),
      color var(--transition-micro),
      border-color var(--transition-micro);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); /* iOS soft shadow */
  }

  .collapse-toggle:hover {
    background-color: var(--primary-color);
    color: var(--color-text-inverse, #ffffff);
    border-color: var(--primary-color);
    transform: scale(1.05); /* Subtle scale */
  }

  .collapse-toggle:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .toggle-icon {
    transition: transform var(--transition-default);
  }

  .toggle-icon.is-collapsed {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar {
      transition: none;
    }
    .collapse-toggle,
    .toggle-icon {
      transition: none;
    }
  }
</style>
