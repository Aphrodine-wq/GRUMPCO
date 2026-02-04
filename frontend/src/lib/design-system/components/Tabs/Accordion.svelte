<script lang="ts">
  /**
   * G-Rump Design System - Accordion Component
   * Accessible collapsible accordion sections
   */
  import type { Snippet } from 'svelte';
  import { ChevronDown } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  interface AccordionItem {
    id: string;
    title: string;
    subtitle?: string;
    icon?: typeof import('lucide-svelte').Icon;
    disabled?: boolean;
  }

  interface Props {
    items: AccordionItem[];
    expandedIds?: string[];
    allowMultiple?: boolean;
    variant?: 'default' | 'bordered' | 'separated';
    onExpand?: (id: string, expanded: boolean) => void;
    children: Snippet<[AccordionItem]>;
  }

  let {
    items,
    expandedIds = $bindable([]),
    allowMultiple = false,
    variant = 'default',
    onExpand,
    children,
  }: Props = $props();

  function toggleItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.disabled) return;

    const isExpanded = expandedIds.includes(id);

    if (isExpanded) {
      expandedIds = expandedIds.filter((i) => i !== id);
    } else {
      expandedIds = allowMultiple ? [...expandedIds, id] : [id];
    }

    onExpand?.(id, !isExpanded);
  }

  function isExpanded(id: string): boolean {
    return expandedIds.includes(id);
  }
</script>

<div class="accordion accordion-{variant}">
  {#each items as item (item.id)}
    {@const expanded = isExpanded(item.id)}
    <div class="accordion-item" class:expanded class:disabled={item.disabled}>
      <button
        type="button"
        class="accordion-trigger"
        aria-expanded={expanded}
        aria-controls={`accordion-content-${item.id}`}
        onclick={() => toggleItem(item.id)}
        disabled={item.disabled}
      >
        {#if item.icon}
          {@const IconComponent = item.icon}
          <IconComponent size={20} class="accordion-icon" />
        {/if}
        <div class="accordion-header-text">
          <span class="accordion-title">{item.title}</span>
          {#if item.subtitle}
            <span class="accordion-subtitle">{item.subtitle}</span>
          {/if}
        </div>
        <ChevronDown size={20} class="accordion-chevron" />
      </button>

      {#if expanded}
        <div
          id={`accordion-content-${item.id}`}
          class="accordion-content"
          role="region"
          aria-labelledby={item.id}
          transition:slide={{ duration: 200 }}
        >
          <div class="accordion-body">
            {@render children(item)}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .accordion {
    display: flex;
    flex-direction: column;
  }

  /* Variants */
  .accordion-default .accordion-item {
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .accordion-default .accordion-item:last-child {
    border-bottom: none;
  }

  .accordion-bordered {
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    overflow: hidden;
  }

  .accordion-bordered .accordion-item {
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .accordion-bordered .accordion-item:last-child {
    border-bottom: none;
  }

  .accordion-separated {
    gap: 8px;
  }

  .accordion-separated .accordion-item {
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    overflow: hidden;
  }

  .accordion-item.disabled {
    opacity: 0.5;
  }

  .accordion-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 16px;
    background: transparent;
    border: none;
    font-size: 15px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .accordion-trigger:hover:not(:disabled) {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .accordion-trigger:focus-visible {
    outline: 2px solid var(--color-primary, #7c3aed);
    outline-offset: -2px;
  }

  .accordion-trigger:disabled {
    cursor: not-allowed;
  }

  .accordion-trigger :global(.accordion-icon) {
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .accordion-header-text {
    flex: 1;
    min-width: 0;
  }

  .accordion-title {
    display: block;
    font-weight: 600;
    color: var(--color-text, #1f1147);
  }

  .accordion-subtitle {
    display: block;
    font-size: 13px;
    color: var(--color-text-muted, #6d28d9);
    margin-top: 2px;
  }

  .accordion-trigger :global(.accordion-chevron) {
    color: var(--color-text-muted, #6d28d9);
    flex-shrink: 0;
    transition: transform 200ms ease;
  }

  .accordion-item.expanded .accordion-trigger :global(.accordion-chevron) {
    transform: rotate(180deg);
  }

  .accordion-content {
    overflow: hidden;
  }

  .accordion-body {
    padding: 0 16px 16px;
    color: var(--color-text, #1f1147);
    font-size: 14px;
    line-height: 1.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .accordion-trigger,
    .accordion-trigger :global(.accordion-chevron) {
      transition: none;
    }
  }
</style>
