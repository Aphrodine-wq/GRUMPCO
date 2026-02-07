<script lang="ts">
  /**
   * Model Picker - provider-organized model selection with collapsible groups
   * Models are grouped by provider with expandable sections showing model details
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { ChevronDown, ChevronRight, Settings, Sparkles, Zap, Lock } from 'lucide-svelte';
  import { setCurrentView, settingsInitialTab } from '../stores/uiStore';
  import {
    getProviderIconPath,
    getProviderSvgPath,
    getProviderColor,
    getProviderFallbackLetter,
  } from '../lib/aiProviderIcons.js';

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
    configured: boolean;
    configNote?: string;
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
  let open = $state(false);
  // If embedded, always start open
  $effect(() => {
    if (embedded) open = true;
  });
  let expandedProviders = $state<Set<string>>(new Set());
  let searchQuery = $state('');

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

  function formatContextWindow(ctx: number): string {
    if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(0)}M`;
    if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
    return `${ctx}`;
  }

  /** Auto-expand the provider that contains the currently selected model */
  function autoExpandSelected() {
    if (value && value !== 'auto') {
      const parts = value.split(':');
      if (parts.length >= 1) {
        expandedProviders = new Set([parts[0]]);
      }
    }
  }

  $effect(() => {
    if (groups.length > 0) {
      autoExpandSelected();
    }
  });

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
    onSelect?.('grump', 'g-compn1-auto');
    if (!embedded) open = false;
  }

  function selectModel(provider: string, modelId: string, configured: boolean) {
    if (!configured) return; // Don't allow selecting unconfigured providers
    onSelect?.(provider, modelId);
    if (!embedded) open = false;
  }

  function toggleProvider(provId: string) {
    const next = new Set(expandedProviders);
    if (next.has(provId)) {
      next.delete(provId);
    } else {
      next.add(provId);
    }
    expandedProviders = next;
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

  function filteredGroups(): ModelGroup[] {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        models: g.models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            (m.description ?? '').toLowerCase().includes(q) ||
            g.displayName.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.models.length > 0);
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
      <!-- Search input -->
      <div class="model-search-wrap">
        <input
          type="text"
          class="model-search-input"
          placeholder="Search models…"
          bind:value={searchQuery}
        />
      </div>

      {#if showAuto}
        <button
          type="button"
          class="model-option model-option-auto"
          class:selected={value === 'auto' || !value}
          onclick={selectAuto}
          role="option"
          aria-selected={value === 'auto' || !value}
        >
          <span class="model-auto-icon"><Zap size={14} /></span>
          <span class="model-option-label">Auto (smart routing)</span>
          <span class="model-auto-badge">Recommended</span>
        </button>
        <div class="model-picker-divider"></div>
      {/if}

      {#if error}
        <div class="model-picker-error">{error}</div>
      {:else}
        {#each filteredGroups() as group}
          <div class="model-group" class:unconfigured={!group.configured}>
            <button
              type="button"
              class="model-group-header"
              class:disabled-provider={!group.configured}
              onclick={() => toggleProvider(group.provider)}
              aria-expanded={expandedProviders.has(group.provider)}
            >
              <span class="model-group-chevron">
                {#if expandedProviders.has(group.provider)}
                  <ChevronDown size={14} />
                {:else}
                  <ChevronRight size={14} />
                {/if}
              </span>
              <span class="model-group-icon">
                {#if getProviderIconPath(group.provider)}
                  <img
                    src={getProviderIconPath(group.provider)}
                    alt=""
                    width="18"
                    height="18"
                    onerror={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        const fb = document.createElement('span');
                        fb.className = 'model-group-fallback';
                        fb.textContent = getProviderFallbackLetter(group.provider);
                        parent.appendChild(fb);
                      }
                    }}
                  />
                {:else if getProviderSvgPath(group.provider)}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={getProviderColor(group.provider)}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="model-provider-svg"
                  >
                    <path d={getProviderSvgPath(group.provider)} />
                  </svg>
                {:else}
                  <span class="model-group-fallback"
                    >{getProviderFallbackLetter(group.provider)}</span
                  >
                {/if}
              </span>
              <span class="model-group-name">{group.displayName}</span>
              {#if !group.configured}
                <span class="model-locked-badge" title={group.configNote ?? 'Requires API key'}>
                  <Lock size={11} />
                  <span>Requires key</span>
                </span>
              {:else}
                <span class="model-group-count">{group.models.length}</span>
              {/if}
            </button>

            {#if expandedProviders.has(group.provider)}
              <div class="model-group-models">
                {#if !group.configured}
                  <div class="model-unconfigured-notice">
                    {group.configNote ??
                      'Add your API key in Settings → AI Providers to use these models.'}
                    <button
                      type="button"
                      class="model-option model-option-connect"
                      style="padding: 0.35rem 0.75rem; margin-top: 0.25rem;"
                      role="option"
                      aria-selected="false"
                      onclick={() => {
                        if (!embedded) open = false;
                        settingsInitialTab.set('ai');
                        setCurrentView('settings');
                      }}
                    >
                      <Settings size={12} />
                      <span class="model-option-label">Configure API key…</span>
                    </button>
                  </div>
                {/if}
                {#each group.models as model}
                  <button
                    type="button"
                    class="model-option"
                    class:selected={value === `${group.provider}:${model.id}`}
                    class:disabled-model={!group.configured}
                    disabled={!group.configured}
                    onclick={() => selectModel(group.provider, model.id, group.configured)}
                    role="option"
                    aria-selected={value === `${group.provider}:${model.id}`}
                  >
                    <div class="model-option-main">
                      <span class="model-option-label">
                        <span class="model-inline-icon">
                          {#if getProviderIconPath(group.provider)}
                            <img
                              src={getProviderIconPath(group.provider)}
                              alt=""
                              width="14"
                              height="14"
                              class="model-mini-icon"
                            />
                          {:else if getProviderSvgPath(group.provider)}
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={getProviderColor(group.provider)}
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="model-mini-svg"
                            >
                              <path d={getProviderSvgPath(group.provider)} />
                            </svg>
                          {:else}
                            <span
                              class="model-mini-fallback"
                              style="background: {getProviderColor(group.provider)}"
                              >{getProviderFallbackLetter(group.provider)}</span
                            >
                          {/if}
                        </span>
                        {model.id}
                        {#if model.isRecommended}
                          <span class="model-recommended" title="Recommended">
                            <Sparkles size={12} />
                          </span>
                        {/if}
                      </span>
                      {#if model.description}
                        <span class="model-option-desc">{model.description}</span>
                      {/if}
                    </div>
                    <div class="model-option-meta">
                      {#if model.contextWindow}
                        <span
                          class="model-context"
                          title="Context window: {model.contextWindow.toLocaleString()} tokens"
                        >
                          {formatContextWindow(model.contextWindow)}
                        </span>
                      {/if}
                      {#if formatCost(model)}
                        <span
                          class="model-option-cost"
                          title={getCostTooltip(model)}
                          aria-label={`Cost: ${getCostTooltip(model)}`}
                        >
                          {formatCost(model)}
                        </span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
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
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
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
    min-width: 380px;
    max-height: 480px;
    overflow-y: auto;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.12),
      0 0 0 1px rgba(0, 0, 0, 0.04);
    z-index: 1000;
    padding: 0.375rem 0;
  }

  .model-picker-dropdown.embedded-dropdown {
    position: static;
    box-shadow: none;
    border: none;
    min-width: 100%;
    margin: 0;
    padding: 0;
  }

  /* Search */
  .model-search-wrap {
    padding: 0.375rem 0.5rem;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--color-bg-card, #fff);
  }

  .model-search-input {
    width: 100%;
    padding: 0.4rem 0.625rem;
    font-size: 0.8125rem;
    font-family: inherit;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    background: var(--color-bg-secondary, #f9fafb);
    color: var(--color-text, #111);
    outline: none;
    transition: border-color 0.15s;
  }

  .model-search-input:focus {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
  }

  .model-search-input::placeholder {
    color: var(--color-text-muted, #9ca3af);
  }

  /* Provider group */
  .model-group {
    display: flex;
    flex-direction: column;
  }

  .model-group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
    background: transparent;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s;
    border-bottom: 1px solid transparent;
  }

  .model-group-header:hover {
    background: var(--color-bg-secondary, #f3f4f6);
  }

  .model-group-chevron {
    flex-shrink: 0;
    color: var(--color-text-muted, #6b7280);
    display: flex;
    align-items: center;
  }

  .model-group-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .model-group-icon img {
    border-radius: 4px;
    object-fit: contain;
  }

  .model-group-fallback {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary, #7c3aed);
    color: white;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
  }

  :global(.model-provider-svg) {
    flex-shrink: 0;
  }

  .model-inline-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  :global(.model-mini-icon) {
    border-radius: 3px;
    object-fit: contain;
    width: 14px;
    height: 14px;
  }

  :global(.model-mini-svg) {
    flex-shrink: 0;
  }

  .model-mini-fallback {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border-radius: 3px;
    font-size: 0.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .model-group-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-group-count {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-muted, #9ca3af);
    background: var(--color-bg-secondary, #f3f4f6);
    padding: 0.125rem 0.375rem;
    border-radius: 999px;
  }

  .model-group-models {
    display: flex;
    flex-direction: column;
    padding-left: 0.5rem;
    border-left: 2px solid var(--color-border, #e5e7eb);
    margin-left: 1.125rem;
    margin-bottom: 0.25rem;
  }

  /* Model options */
  .model-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
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

  .model-auto-icon {
    display: flex;
    align-items: center;
    color: #eab308;
    flex-shrink: 0;
  }

  .model-auto-badge {
    flex-shrink: 0;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .model-option-connect {
    color: var(--color-primary, #7c3aed);
    font-weight: 500;
  }

  .model-option-connect:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .model-option-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    overflow: hidden;
  }

  .model-option-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .model-recommended {
    color: #eab308;
    display: inline-flex;
    align-items: center;
  }

  .model-option-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #9ca3af);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  .model-option-meta {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .model-context {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-muted, #9ca3af);
    font-variant-numeric: tabular-nums;
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

  /* Unconfigured / locked provider styles */
  .model-group.unconfigured {
    opacity: 0.7;
  }

  .model-group-header.disabled-provider {
    opacity: 0.75;
  }

  .model-locked-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted, #9ca3af);
    background: var(--color-bg-secondary, #f3f4f6);
    border: 1px solid var(--color-border, #e5e7eb);
    padding: 0.1rem 0.375rem;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .model-unconfigured-notice {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #9ca3af);
    border-left: 2px solid var(--color-border, #e5e7eb);
    margin-left: 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .model-option.disabled-model {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
