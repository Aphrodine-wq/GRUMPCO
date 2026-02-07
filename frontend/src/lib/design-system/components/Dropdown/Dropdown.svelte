<script lang="ts">
  /**
   * G-Rump Design System - Dropdown/Select Component
   * Accessible dropdown with search and custom rendering
   */
  import type { Snippet } from 'svelte';
  import { ChevronDown, Check, Search } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  interface Option {
    value: string;
    label: string;
    description?: string;
    icon?: string;
    disabled?: boolean;
  }

  interface Props {
    options: Option[];
    value?: string;
    placeholder?: string;
    searchable?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    onSelect?: (option: Option) => void;
    renderOption?: Snippet<[Option]>;
  }

  let {
    options,
    value = $bindable(''),
    placeholder = 'Select...',
    searchable = false,
    disabled = false,
    size = 'md',
    fullWidth = false,
    onSelect,
    renderOption,
  }: Props = $props();

  let open = $state(false);
  let searchQuery = $state('');
  let highlightedIndex = $state(0);
  let triggerRef: HTMLButtonElement | null = $state(null);
  let listRef: HTMLDivElement | null = $state(null);

  const selectedOption = $derived(options.find((o) => o.value === value));

  const filteredOptions = $derived(
    searchable && searchQuery.trim()
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options
  );

  function toggle() {
    if (disabled) return;
    open = !open;
    if (open) {
      searchQuery = '';
      highlightedIndex = filteredOptions.findIndex((o) => o.value === value);
      if (highlightedIndex < 0) highlightedIndex = 0;
    }
  }

  function selectOption(option: Option) {
    if (option.disabled) return;
    value = option.value;
    open = false;
    onSelect?.(option);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        open = true;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        open = false;
        triggerRef?.focus();
        break;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (
      triggerRef &&
      !triggerRef.contains(e.target as Node) &&
      listRef &&
      !listRef.contains(e.target as Node)
    ) {
      open = false;
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return undefined;
  });

  const sizeClasses: Record<typeof size, string> = {
    sm: 'dropdown-sm',
    md: 'dropdown-md',
    lg: 'dropdown-lg',
  };
</script>

<div class="dropdown {sizeClasses[size]}" class:full-width={fullWidth}>
  <button
    bind:this={triggerRef}
    type="button"
    class="dropdown-trigger"
    class:open
    class:disabled
    onclick={toggle}
    onkeydown={handleKeydown}
    aria-haspopup="listbox"
    aria-expanded={open}
    {disabled}
  >
    <span class="dropdown-value">
      {#if selectedOption}
        {selectedOption.label}
      {:else}
        <span class="dropdown-placeholder">{placeholder}</span>
      {/if}
    </span>
    <ChevronDown size={16} class="dropdown-chevron" />
  </button>

  {#if open}
    <div
      bind:this={listRef}
      class="dropdown-menu"
      role="listbox"
      transition:slide={{ duration: 150 }}
    >
      {#if searchable}
        <div class="dropdown-search">
          <Search size={16} class="search-icon" />
          <input
            type="text"
            placeholder="Search..."
            bind:value={searchQuery}
            class="search-input"
            onkeydown={handleKeydown}
          />
        </div>
      {/if}

      <div class="dropdown-options">
        {#if filteredOptions.length === 0}
          <div class="dropdown-empty">No options found</div>
        {:else}
          {#each filteredOptions as option, i (option.value)}
            <button
              type="button"
              class="dropdown-option"
              class:selected={option.value === value}
              class:highlighted={i === highlightedIndex}
              class:disabled={option.disabled}
              role="option"
              aria-selected={option.value === value}
              onclick={() => selectOption(option)}
              onmouseenter={() => (highlightedIndex = i)}
              disabled={option.disabled}
            >
              {#if renderOption}
                {@render renderOption(option)}
              {:else}
                <div class="option-content">
                  <span class="option-label">{option.label}</span>
                  {#if option.description}
                    <span class="option-description">{option.description}</span>
                  {/if}
                </div>
              {/if}
              {#if option.value === value}
                <Check size={16} class="option-check" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
    display: inline-flex;
    flex-direction: column;
  }

  .dropdown.full-width {
    width: 100%;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .dropdown-trigger:hover:not(.disabled) {
    border-color: var(--color-primary, #7c3aed);
  }

  .dropdown-trigger.open {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 3px var(--color-primary-glow, rgba(124, 58, 237, 0.2));
  }

  .dropdown-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  /* Sizes */
  .dropdown-sm .dropdown-trigger {
    height: 32px;
    padding: 0 10px;
    font-size: 13px;
  }

  .dropdown-md .dropdown-trigger {
    height: 40px;
    padding: 0 12px;
  }

  .dropdown-lg .dropdown-trigger {
    height: 48px;
    padding: 0 16px;
    font-size: 16px;
  }

  .dropdown-value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-placeholder {
    color: var(--color-text-muted, #6d28d9);
    opacity: 0.7;
  }

  .dropdown-trigger :global(.dropdown-chevron) {
    color: var(--color-text-muted, #6d28d9);
    transition: transform 150ms ease;
    flex-shrink: 0;
  }

  .dropdown-trigger.open :global(.dropdown-chevron) {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }

  .dropdown-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .dropdown-search :global(.search-icon) {
    color: var(--color-text-muted, #6d28d9);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--color-text, #1f1147);
    outline: none;
  }

  .dropdown-options {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
  }

  .dropdown-empty {
    padding: 12px 16px;
    text-align: center;
    color: var(--color-text-muted, #6d28d9);
    font-size: 14px;
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 100ms ease;
    text-align: left;
  }

  .dropdown-option:hover:not(.disabled),
  .dropdown-option.highlighted:not(.disabled) {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .dropdown-option.selected {
    background: var(--color-primary-glow, rgba(124, 58, 237, 0.1));
  }

  .dropdown-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-content {
    flex: 1;
    min-width: 0;
  }

  .option-label {
    display: block;
    font-weight: 500;
  }

  .option-description {
    display: block;
    font-size: 12px;
    color: var(--color-text-muted, #6d28d9);
    margin-top: 2px;
  }

  .dropdown-option :global(.option-check) {
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .dropdown-trigger,
    .dropdown-trigger :global(.dropdown-chevron),
    .dropdown-option {
      transition: none;
    }
  }
</style>
