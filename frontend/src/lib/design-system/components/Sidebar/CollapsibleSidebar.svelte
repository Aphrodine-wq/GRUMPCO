<script lang="ts">
  /**
   * G-Rump Design System - Collapsible Sidebar Component
   * Two-panel layout sidebar with collapse/expand functionality
   */
  import type { Snippet } from 'svelte';

  interface Props {
    collapsed?: boolean;
    width?: string;
    collapsedWidth?: string;
    position?: 'left' | 'right';
    ontoggle?: (collapsed: boolean) => void;
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    collapsed = $bindable(false),
    width = '280px',
    collapsedWidth = '48px',
    position = 'left',
    ontoggle,
    header,
    children,
    footer,
  }: Props = $props();

  function toggle() {
    collapsed = !collapsed;
    ontoggle?.(collapsed);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggle();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
  class="sidebar"
  class:sidebar-collapsed={collapsed}
  class:sidebar-left={position === 'left'}
  class:sidebar-right={position === 'right'}
  style="--sidebar-width: {width}; --sidebar-collapsed-width: {collapsedWidth};"
>
  <button
    class="sidebar-toggle"
    onclick={toggle}
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    title={collapsed ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'}
  >
    <svg
      class="sidebar-toggle-icon"
      class:sidebar-toggle-icon-flipped={position === 'right' ? !collapsed : collapsed}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path d="M10 4L6 8L10 12" />
    </svg>
  </button>

  {#if header}
    <div class="sidebar-header" class:sidebar-section-hidden={collapsed}>
      {@render header()}
    </div>
  {/if}

  <div class="sidebar-content" class:sidebar-section-hidden={collapsed}>
    {@render children()}
  </div>

  {#if footer}
    <div class="sidebar-footer" class:sidebar-section-hidden={collapsed}>
      {@render footer()}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-sidebar, #FAFAFA);
    border-color: var(--color-border-default, #E5E7EB);
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    height: 100%;
    position: relative;
    transition: width var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1)),
                min-width var(--duration-normal, 250ms) var(--ease-out),
                max-width var(--duration-normal, 250ms) var(--ease-out);
    overflow: hidden;
  }

  .sidebar-left {
    border-right: 1px solid var(--color-border-default, #E5E7EB);
  }

  .sidebar-right {
    border-left: 1px solid var(--color-border-default, #E5E7EB);
  }

  .sidebar-collapsed {
    width: var(--sidebar-collapsed-width);
    min-width: var(--sidebar-collapsed-width);
    max-width: var(--sidebar-collapsed-width);
  }

  .sidebar-toggle {
    position: absolute;
    top: var(--space-2, 0.5rem);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background-color: var(--color-bg-secondary, #FFFFFF);
    border: 1px solid var(--color-border-default, #E5E7EB);
    border-radius: var(--radius-md, 0.375rem);
    cursor: pointer;
    transition: var(--transition-fast, 150ms ease-out);
    color: var(--color-text-muted, #9CA3AF);
  }

  .sidebar-left .sidebar-toggle {
    right: var(--space-2, 0.5rem);
  }

  .sidebar-right .sidebar-toggle {
    left: var(--space-2, 0.5rem);
  }

  .sidebar-toggle:hover {
    background-color: var(--color-bg-tertiary, #EBEBEB);
    color: var(--color-text-primary, #000000);
  }

  .sidebar-toggle:focus-visible {
    outline: 2px solid var(--color-accent-primary, #0066FF);
    outline-offset: 2px;
  }

  .sidebar-toggle-icon {
    transition: transform var(--duration-normal, 250ms) var(--ease-out);
  }

  .sidebar-toggle-icon-flipped {
    transform: rotate(180deg);
  }

  .sidebar-header {
    padding: var(--space-4, 1rem);
    padding-top: var(--space-10, 2.5rem);
    border-bottom: 1px solid var(--color-border-light, #F3F4F6);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.8rem);
    flex-shrink: 0;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-3, 0.75rem);
  }

  .sidebar-footer {
    padding: var(--space-3, 0.75rem);
    border-top: 1px solid var(--color-border-light, #F3F4F6);
    flex-shrink: 0;
  }

  .sidebar-section-hidden {
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--duration-quick, 150ms) var(--ease-out),
                visibility var(--duration-quick, 150ms) var(--ease-out);
  }

  /* Scrollbar styling */
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background-color: var(--color-border-default, #E5E7EB);
    border-radius: 3px;
  }

  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-border-dark, #D1D5DB);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .sidebar-toggle-icon,
    .sidebar-section-hidden {
      transition: none;
    }
  }
</style>
