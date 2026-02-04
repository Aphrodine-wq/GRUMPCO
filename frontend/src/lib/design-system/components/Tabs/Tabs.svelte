<script lang="ts">
  /**
   * G-Rump Design System - Tabs Component
   * Accessible tab navigation with animated indicator
   */
  import type { Snippet } from 'svelte';

  interface Tab {
    id: string;
    label: string;
    icon?: typeof import('lucide-svelte').Icon;
    disabled?: boolean;
    badge?: string | number;
  }

  interface Props {
    tabs: Tab[];
    activeTab?: string;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    onTabChange?: (tabId: string) => void;
    children?: Snippet<[string]>;
  }

  let {
    tabs,
    activeTab = $bindable(tabs[0]?.id ?? ''),
    variant = 'default',
    size = 'md',
    fullWidth = false,
    onTabChange,
    children,
  }: Props = $props();

  let tabsRef: HTMLDivElement | null = $state(null);
  let indicatorStyle = $state('');

  function selectTab(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.disabled) return;
    activeTab = tabId;
    onTabChange?.(tabId);
  }

  function handleKeydown(e: KeyboardEvent, currentIndex: number) {
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabs.length - 1;
    }

    // Skip disabled tabs
    while (tabs[newIndex]?.disabled && newIndex !== currentIndex) {
      newIndex =
        e.key === 'ArrowLeft'
          ? (newIndex - 1 + tabs.length) % tabs.length
          : (newIndex + 1) % tabs.length;
    }

    if (newIndex !== currentIndex) {
      selectTab(tabs[newIndex].id);
      const buttons = tabsRef?.querySelectorAll('button');
      (buttons?.[newIndex] as HTMLButtonElement)?.focus();
    }
  }

  // Update indicator position
  $effect(() => {
    if (variant !== 'underline' || !tabsRef) return;

    const activeButton = tabsRef.querySelector(
      `button[data-tab-id="${activeTab}"]`
    ) as HTMLButtonElement;
    if (activeButton) {
      const tabsRect = tabsRef.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      indicatorStyle = `left: ${buttonRect.left - tabsRect.left}px; width: ${buttonRect.width}px`;
    }
  });
</script>

<div class="tabs-container tabs-{variant} tabs-{size}" class:full-width={fullWidth}>
  <div bind:this={tabsRef} class="tabs-list" role="tablist">
    {#each tabs as tab, i (tab.id)}
      <button
        type="button"
        role="tab"
        data-tab-id={tab.id}
        class="tab"
        class:active={activeTab === tab.id}
        class:disabled={tab.disabled}
        aria-selected={activeTab === tab.id}
        aria-disabled={tab.disabled}
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => selectTab(tab.id)}
        onkeydown={(e) => handleKeydown(e, i)}
        disabled={tab.disabled}
      >
        {#if tab.icon}
          {@const IconComponent = tab.icon}
          <IconComponent size={16} />
        {/if}
        <span class="tab-label">{tab.label}</span>
        {#if tab.badge}
          <span class="tab-badge">{tab.badge}</span>
        {/if}
      </button>
    {/each}

    {#if variant === 'underline'}
      <span class="tab-indicator" style={indicatorStyle}></span>
    {/if}
  </div>

  {#if children}
    <div class="tabs-content" role="tabpanel" aria-labelledby={activeTab}>
      {@render children(activeTab)}
    </div>
  {/if}
</div>

<style>
  .tabs-container {
    display: flex;
    flex-direction: column;
  }

  .tabs-container.full-width {
    width: 100%;
  }

  .tabs-list {
    display: flex;
    position: relative;
    gap: 4px;
  }

  .full-width .tabs-list {
    width: 100%;
  }

  .full-width .tab {
    flex: 1;
  }

  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    border: none;
    font-weight: 500;
    color: var(--color-text-muted, #6d28d9);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .tab:hover:not(.disabled) {
    color: var(--color-text, #1f1147);
  }

  .tab.active {
    color: var(--color-primary, #7c3aed);
  }

  .tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab:focus-visible {
    outline: 2px solid var(--color-primary, #7c3aed);
    outline-offset: 2px;
    border-radius: 6px;
  }

  /* Sizes */
  .tabs-sm .tab {
    padding: 6px 12px;
    font-size: 13px;
  }

  .tabs-md .tab {
    padding: 8px 16px;
    font-size: 14px;
  }

  .tabs-lg .tab {
    padding: 12px 20px;
    font-size: 15px;
  }

  /* Variants */
  .tabs-default .tabs-list {
    background: var(--color-bg-input, #f3e8ff);
    padding: 4px;
    border-radius: 12px;
  }

  .tabs-default .tab {
    border-radius: 8px;
  }

  .tabs-default .tab.active {
    background: white;
    color: var(--color-text, #1f1147);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .tabs-pills .tab {
    border-radius: 999px;
    background: transparent;
  }

  .tabs-pills .tab:hover:not(.disabled) {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .tabs-pills .tab.active {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .tabs-underline .tabs-list {
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .tabs-underline .tab {
    padding-bottom: 12px;
    border-radius: 0;
  }

  .tab-indicator {
    position: absolute;
    bottom: 0;
    height: 2px;
    background: var(--color-primary, #7c3aed);
    border-radius: 1px;
    transition:
      left 200ms ease,
      width 200ms ease;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--color-primary-glow, rgba(124, 58, 237, 0.2));
    color: var(--color-primary, #7c3aed);
    font-size: 11px;
    font-weight: 600;
    border-radius: 9px;
  }

  .tab.active .tab-badge {
    background: rgba(255, 255, 255, 0.2);
    color: currentColor;
  }

  .tabs-content {
    padding-top: 16px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab,
    .tab-indicator {
      transition: none;
    }
  }
</style>
