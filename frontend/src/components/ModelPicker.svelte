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
  }

  let { value = 'auto', onSelect, compact = false, showAuto = true }: Props = $props();

  let groups = $state<ModelGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let open = $state(false);

  function formatCost(m: ModelItem): string {
    const inCost = m.costPerMillionInput ?? 0;
    const outCost = m.costPerMillionOutput ?? 0;
    if (inCost === 0 && outCost === 0) return '';
    const avg = (inCost + outCost) / 2;
    if (avg < 0.1) return '$';
    if (avg < 1) return '$$';
    return '$$$';
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
    open = false;
  }

  function selectModel(provider: string, modelId: string) {
    onSelect?.(provider, modelId);
    open = false;
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

  {#if open}
    <div
      class="model-picker-dropdown"
      role="listbox"
      tabindex="-1"
      onmouseleave={() => (open = false)}
      onkeydown={(e) => e.key === 'Escape' && (open = false)}
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
                  <span class="model-option-cost">{formatCost(model)}</span>
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
            open = false;
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

  .model-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
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

  .model-option:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
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
