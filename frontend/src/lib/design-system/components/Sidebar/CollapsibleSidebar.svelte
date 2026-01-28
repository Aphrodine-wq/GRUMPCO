<script lang="ts">
  import type { Snippet } from 'svelte';

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
    collapsedWidth = 56,
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
    {/if}
  </div>

  <button
    class="collapse-toggle"
    onclick={toggleCollapse}
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    <span class="toggle-icon">{collapsed ? '»' : '«'}</span>
  </button>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #0D0D0D;
    border-right: 1px solid #222;
    transition: width 150ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    font-family: 'JetBrains Mono', monospace;
  }

  .sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 12px;
    border-bottom: 1px solid #222;
    background-color: #0A0A0A;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid #222;
    background-color: #0A0A0A;
  }

  .collapse-toggle {
    position: absolute;
    right: -12px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 48px;
    background-color: #1A1A1A;
    border: 1px solid #333;
    border-radius: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 12px;
    z-index: 10;
    transition: all 100ms ease;
  }

  .collapse-toggle:hover {
    background-color: #262626;
    color: var(--color-accent-primary, #00FF41);
    border-color: var(--color-accent-primary, #00FF41);
  }

  .toggle-icon {
    font-weight: bold;
  }
</style>
