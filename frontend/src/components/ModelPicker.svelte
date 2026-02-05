<script lang="ts">
  /**
   * Model Picker - provider-organized model selection with icons
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { ChevronDown, Settings } from 'lucide-svelte';
  import { setCurrentView, settingsInitialTab } from '../stores/uiStore';

  interface ModelItem {
    id: string;
    provider: string;
    capabilities: string[];
    contextWindow: number;
    costPerMillionInput?: number;
    costPerMillionOutput?: number;
    description?: string;
    publisher?: string;
    parameters?: string;
    isRecommended?: boolean;
  }

  interface ModelGroup {
    provider: string;
    displayName: string;
    icon: string;
    models: ModelItem[];
  }

  interface Props {
    value?: string; // provider:modelId or 'auto'
    onSelect?: (provider: string, modelId?: string) => void;
    compact?: boolean;
    showAuto?: boolean;
    embedded?: boolean; // If true, hide trigger and show list immediately (controlled by parent)
  }

  let {
    value = 'auto',
    onSelect,
    compact = false,
    showAuto = true,
    embedded = false,
  }: Props = $props();

  let groups = $state<ModelGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let open = $state(embedded ? true : false);

  function formatCost(m: ModelItem): string {
    const inCost = m.costPerMillionInput ?? 0;
    const outCost = m.costPerMillionOutput ?? 0;
    if (inCost === 0 && outCost === 0) return '';
    const avg = (inCost + outCost) / 2;
    if (avg < 0.1) return '$';
    if (avg < 1) return '$$';
    return '$$$';
  }

  function getCostTooltip(m: ModelItem): string {
    const inCost = m.costPerMillionInput;
    const outCost = m.costPerMillionOutput;
    if (inCost === undefined && outCost === undefined) return 'Cost unknown';
    if (inCost === 0 && outCost === 0) return 'Free';

    const parts = [];
    if (inCost !== undefined) parts.push(`Input: $${inCost}/M`);
    if (outCost !== undefined) parts.push(`Output: $${outCost}/M`);

    return parts.join(', ');
  }

  onMount(async () => {
    try {
      const res = await fetchApi('/api/models/list');
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      groups = data.groups ?? [];
    } catch (e) {
      error = (e as Error).message;
      groups = [];
    } finally {
      loading = false;
    }
  });

  function selectAuto() {
    onSelect?.('nim', undefined);
    if (!embedded) open = false;
  }

  function selectModel(provider: string, modelId: string) {
    onSelect?.(provider, modelId);
    if (!embedded) open = false;
  }

  function getDisplayValue(): string {
    if (value === 'auto' || !value) return 'Auto (smart routing)';
    const parts = value.split(':');
    if (parts.length >= 2) {
      const modelId = parts.slice(1).join(':');
      return modelId ?? value;
    }
    return value;
  }
</script>

<div class="model-picker" class:compact>
  {#if !embedded}
    <button
      type="button"
      class="model-picker-trigger"
      onclick={() => (open = !open)}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label="Select AI model"
    >
      {#if loading}
        <span class="model-picker-value">Loading...</span>
      {:else}
        <span class="model-picker-value">{getDisplayValue()}</span>
        <span class="model-picker-chevron" class:open>
          <ChevronDown width={16} height={16} />
        </span>
      {/if}
    </button>
  {/if}

  {#if open || embedded}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="model-picker-dropdown"
      class:embedded-dropdown={embedded}
      role="listbox"
      tabindex="-1"
      onmouseleave={() => (!embedded ? (open = false) : null)}
      onkeydown={(e) => !embedded && e.key === 'Escape' && (open = false)}
    >
      {#if showAuto}
        <button
          type="button"
          class="model-option model-option-auto"
          class:selected={value === 'auto' || !value}
          onclick={selectAuto}
          role="option"
          aria-selected={value === 'auto' || !value}
        >
          <span class="model-option-label">Auto (smart routing)</span>
        </button>
        <div class="model-picker-divider"></div>
      {/if}

      {#if error}
        <div class="model-picker-error">{error}</div>
      {:else}
        {#each groups as group}
          <div class="model-group">
            {#if group.displayName}
              <div class="model-group-header">{group.displayName}</div>
            {/if}
            {#each group.models as model}
              <button
                type="button"
                class="model-option"
                class:selected={value === `${group.provider}:${model.id}`}
                onclick={() => selectModel(group.provider, model.id)}
                role="option"
                aria-selected={value === `${group.provider}:${model.id}`}
              >
                <span class="model-option-label">{model.id}</span>
                {#if formatCost(model)}
                  <span
                    class="model-option-cost"
                    title={getCostTooltip(model)}
                    aria-label={`Cost: ${getCostTooltip(model)}`}
                  >
                    {formatCost(model)}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
        <div class="model-picker-divider"></div>
        <button
          type="button"
          class="model-option model-option-connect"
          role="option"
          aria-selected="false"
          onclick={() => {
            if (!embedded) open = false;
            settingsInitialTab.set('ai');
            setCurrentView('settings');
          }}
        >
          <Settings size={14} />
          <span class="model-option-label">Connect more models…</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .model-picker {
    position: relative;
  }

  .model-picker-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--color-text, #111);
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    cursor: pointer;
    min-width: 180px;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .model-picker-trigger:hover {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.1);
  }

  .model-picker.compact .model-picker-trigger {
    min-width: 120px;
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .model-picker-value {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-picker-chevron {
    flex-shrink: 0;
    color: var(--color-text-muted, #6b7280);
    transition: transform 0.2s;
  }

  .model-picker-chevron.open {
    transform: rotate(180deg);
  }

  .model-picker-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    min-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
    z-index: 1000;
    padding: 0.5rem 0;
  }

  .model-picker-dropdown.embedded-dropdown {
    position: static;
    box-shadow: none;
    border: none;
    min-width: 100%;
    margin: 0;
    padding: 0;
  }

  .model-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .model-group-header {
    padding: 0.25rem 0.85rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.025em;
    background: var(--color-bg-card, #fff);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .model-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.55rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--color-text, #111);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .model-option:hover,
  .model-option:focus-visible {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
    outline: none;
  }

  .model-option:focus-visible {
    box-shadow: inset 3px 0 0 0 var(--color-primary, #7c3aed);
  }

  .model-option.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.12));
    color: var(--color-primary, #7c3aed);
    font-weight: 600;
  }

  .model-option-auto {
    font-weight: 500;
  }

  .model-option-connect {
    color: var(--color-primary, #7c3aed);
    font-weight: 500;
  }

  .model-option-connect:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .model-option-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .model-option-cost {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .model-picker-divider {
    height: 1px;
    background: var(--color-border, #e5e7eb);
    margin: 0.25rem 0;
  }

  .model-picker-error {
    padding: 1rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-error, #dc2626);
  }
</style>
