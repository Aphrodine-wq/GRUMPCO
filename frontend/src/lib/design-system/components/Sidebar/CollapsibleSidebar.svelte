<script lang="ts">
  /**
   * G-Rump Design System - CollapsibleSidebar Component
   * Professional, consistent light theme
   */
  import type { Snippet } from 'svelte';
  import { colors } from '../../tokens/colors';

  interface Props {
    collapsed?: boolean;
    width?: number;
    collapsedWidth?: number;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    collapsed = $bindable(false),
    width = 260,
    collapsedWidth = 64,
    children,
    header,
    footer,
  }: Props = $props();

  function toggleCollapse() {
    collapsed = !collapsed;
  }
</script>

<aside
  class="sidebar"
  style="width: {collapsed ? collapsedWidth : width}px"
  style:--bg-sidebar={colors.background.sidebar}
  style:--border-color={colors.border.default}
  style:--bg-header={colors.background.tertiary}
  style:--primary-color={colors.accent.primary}
  style:--text-muted={colors.text.muted}
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
    height: 100%;
    background-color: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    font-family: inherit;
    z-index: 20;
  }

  .sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
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
    background: var(--border-color);
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border-color);
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
    background-color: #fff;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    z-index: 10;
    transition: all 150ms ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .collapse-toggle:hover {
    background-color: var(--primary-color);
    color: #fff;
    border-color: var(--primary-color);
    transform: scale(1.1);
  }

  .toggle-icon {
    transition: transform 200ms ease;
  }

  .toggle-icon.is-collapsed {
    transform: rotate(180deg);
  }
</style>
