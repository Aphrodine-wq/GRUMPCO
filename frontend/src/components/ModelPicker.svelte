<script lang="ts">
  /**
   * Model Picker - provider-organized model selection with icons
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { ChevronDown, Sparkles } from 'lucide-svelte';

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

  function formatContext(n: number): string {
    if (n >= 1_000_000) return `${n / 1_000_000}M`;
    if (n >= 1000) return `${n / 1000}K`;
    return String(n);
  }

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
      const group = groups.find((g) => g.provider === parts[0]);
      const model = group?.models.find((m) => m.id === modelId);
      return model?.description ?? modelId ?? value;
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
          <Sparkles class="model-option-icon" width={18} height={18} />
          <span class="model-option-label">Auto (smart routing)</span>
          <span class="model-option-badge">Recommended</span>
        </button>
        <div class="model-picker-divider"></div>
      {/if}

      {#if error}
        <div class="model-picker-error">{error}</div>
      {:else}
        {#each groups as group}
          <div class="model-group">
            <div class="model-group-header">
              <img
                src={group.icon}
                alt=""
                class="model-group-icon"
                onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              />
              <span class="model-group-name">{group.displayName}</span>
            </div>
            {#each group.models as model}
              <button
                type="button"
                class="model-option"
                class:selected={value === `${group.provider}:${model.id}`}
                onclick={() => selectModel(group.provider, model.id)}
                role="option"
                aria-selected={value === `${group.provider}:${model.id}`}
              >
                <img
                  src={group.icon}
                  alt=""
                  class="model-option-icon"
                  onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                />
                <div class="model-option-content">
                  <span class="model-option-label">{model.description ?? model.id}</span>
                  <span class="model-option-meta">
                    {formatContext(model.contextWindow)} ctx
                    {#if model.parameters}
                      · {model.parameters}
                    {/if}
                    {#if formatCost(model)}
                      · {formatCost(model)}
                    {/if}
                  </span>
                </div>
                {#if model.isRecommended}
                  <span class="model-option-badge">Default</span>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
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
    gap: 0.35rem;
    padding: 0.4rem 0.6rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text, #111);
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    cursor: pointer;
    min-width: 160px;
  }

  .model-picker-trigger:hover {
    border-color: var(--color-border-highlight, #d1d5db);
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
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    min-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
    z-index: 1000;
    padding: 0.5rem 0;
  }

  .model-group .model-option {
    padding-left: 1rem;
  }

  .model-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text, #111);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .model-option:hover {
    background: var(--color-bg-subtle, #f5f5f5);
  }

  .model-option.selected {
    background: rgba(124, 58, 237, 0.1);
    color: #7c3aed;
  }

  .model-option-auto {
    font-weight: 500;
  }

  .model-option-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 4px;
  }

  .model-option-content {
    flex: 1;
    min-width: 0;
  }

  .model-option-label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-option-meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.1rem;
  }

  .model-option-badge {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    background: #7c3aed;
    color: white;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .model-group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem 0.35rem;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    letter-spacing: 0.02em;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .model-group-header:first-child {
    margin-top: 0;
  }

  .model-group-icon {
    width: 18px;
    height: 18px;
    border-radius: 4px;
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
