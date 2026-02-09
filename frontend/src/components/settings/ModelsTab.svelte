<script lang="ts">
  /**
   * ModelsTab – Extracted from TabbedSettingsScreen.svelte (tab: 'models')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Button } from '../../lib/design-system';
  import type { ModelPreset, ModelsSettings } from '../../types/settings';
  import ModelPicker from '../ModelPicker.svelte';

  interface Props {
    addCustomModel: any;
    customModelDraft: any;
    modelGroups: any;
    modelGroupsLoading: any;
    modelValue: any;
    removeCustomModel: any;
    saveCustomModel: any;
    saveModels: any;
    saving: any;
    settings: any;
    showCustomModelForm: any;
  }

  let { addCustomModel, customModelDraft, modelGroups, modelGroupsLoading, modelValue, removeCustomModel, saveCustomModel, saveModels, saving, settings, showCustomModelForm }: Props = $props();
</script>

<div class="tab-section models-tab">
  <Card title="Chat model" padding="md" class="chat-model-card">
    <div class="preset-segmented">
      <span class="preset-label">Preset</span>
      <div class="preset-options" role="group" aria-label="Model preset">
        {#each ['balanced', 'fast', 'quality'] as preset}
          {@const label =
            preset === 'balanced' ? 'Balanced' : preset === 'fast' ? 'Fast' : 'Quality'}
          {@const desc =
            preset === 'balanced'
              ? 'Auto by task'
              : preset === 'fast'
                ? 'Lower cost'
                : 'Best quality'}
          <button
            type="button"
            class="preset-option"
            class:selected={(settings?.models?.modelPreset ?? 'balanced') === preset}
            onclick={() =>
              saveModels({ ...settings?.models, modelPreset: preset as ModelPreset })}
            disabled={saving}
            title={desc}
          >
            {label}
          </button>
        {/each}
      </div>
    </div>
    <div class="default-model-row">
      <span class="field-label">Default model</span>
      <ModelPicker
        value={modelValue()}
        compact={true}
        showAuto={true}
        onSelect={(provider, modelId) => {
          saveModels({
            ...settings?.models,
            defaultProvider: provider as 'nim',
            defaultModelId: modelId ?? undefined,
          });
        }}
      />
    </div>
    <p class="field-hint chat-model-hint">Override when needed.</p>
    <div class="advanced-finetuning">
      <span class="field-label">Advanced (finetuning)</span>
      <div class="advanced-row">
        <label class="advanced-field">
          <span>Temperature</span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={settings?.models?.temperature ?? 0.7}
            onchange={(e) => {
              const v = parseFloat((e.currentTarget as HTMLInputElement).value);
              if (!Number.isNaN(v)) saveModels({ ...settings?.models, temperature: v });
            }}
          />
        </label>
        <label class="advanced-field">
          <span>Max tokens</span>
          <input
            type="number"
            min="256"
            max="128000"
            step="256"
            value={settings?.models?.maxTokens ?? 4096}
            onchange={(e) => {
              const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
              if (!Number.isNaN(v)) saveModels({ ...settings?.models, maxTokens: v });
            }}
          />
        </label>
      </div>
      <p class="field-hint">
        Temperature: higher = more creative. Max tokens: cap per response.
      </p>
    </div>
  </Card>

  <!-- Provider-first: all providers and models from backend -->
  <Card title="Models by provider" padding="md" class="models-provider-list-card">
    {#if modelGroupsLoading}
      <p class="models-provider-loading">Loading model list…</p>
    {:else if modelGroups.length === 0}
      <p class="field-hint">
        No providers available. Configure API keys in AI Providers (below) or in your
        backend .env.
      </p>
    {:else}
      <p class="field-hint models-provider-intro">
        Pick a model per provider; selecting one sets it as the default chat/code model.
      </p>
      <div class="models-provider-list">
        {#each modelGroups as group}
          <div class="models-provider-row">
            <div class="models-provider-heading">
              <img
                src={group.icon}
                alt=""
                class="models-provider-icon"
                onerror={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              />
              <span class="models-provider-name">{group.displayName}</span>
            </div>
            <select
              class="custom-select models-provider-select"
              value={settings?.models?.defaultProvider === group.provider
                ? (settings?.models?.defaultModelId ?? '')
                : ''}
              onchange={(e) => {
                const modelId = (e.target as HTMLSelectElement).value;
                if (!modelId) return;
                saveModels({
                  ...settings?.models,
                  defaultProvider: group.provider as ModelsSettings['defaultProvider'],
                  defaultModelId: modelId,
                });
              }}
              disabled={saving}
              aria-label="Model for {group.displayName}"
            >
              <option value="">— Select model —</option>
              {#each group.models as model}
                <option value={model.id}>
                  {model.description ?? model.id}
                  {#if model.contextWindow}
                    ({model.contextWindow >= 1000
                      ? `${model.contextWindow / 1000}K`
                      : model.contextWindow} ctx)
                  {/if}
                  {#if model.isRecommended}
                    ★{/if}
                </option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <Card title="Embedding" padding="md" class="models-embedding-card">
    <label class="field-label" for="embedding-model">RAG / semantic search</label>
    <select
      id="embedding-model"
      class="custom-select"
      value={settings?.models?.embeddingModelId ?? 'BAAI/bge-small-en-v1.5'}
      onchange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        saveModels({ ...settings?.models, embeddingModelId: v || undefined });
      }}
      disabled={saving}
    >
      <option value="BAAI/bge-small-en-v1.5">BAAI/bge-small-en-v1.5</option>
      <option value="nvidia/nv-embed-v2">nvidia/nv-embed-v2</option>
      <option value="">Default (backend)</option>
    </select>
    <p class="field-hint">Used for RAG. Test connection in backend.</p>
  </Card>

  <details class="models-custom-details">
    <summary>Custom models</summary>
    <div class="models-custom-inner">
      <p class="section-desc">Add a model by ID, API endpoint, and optional API key.</p>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => addCustomModel()}
        disabled={saving}
      >
        Add Custom Model
      </Button>
      {#if showCustomModelForm}
        <div class="custom-model-form">
          <input
            type="text"
            class="custom-input"
            placeholder="Model ID"
            bind:value={customModelDraft.modelId}
          />
          <input
            type="text"
            class="custom-input"
            placeholder="API endpoint (e.g. https://api.example.com/v1)"
            bind:value={customModelDraft.apiEndpoint}
          />
          <input
            type="password"
            class="custom-input"
            placeholder="API key (optional)"
            bind:value={customModelDraft.apiKey}
          />
          <input
            type="number"
            class="custom-input"
            placeholder="Context length"
            bind:value={customModelDraft.contextLength}
          />
          <div class="custom-model-form-actions">
            <Button
              variant="primary"
              size="sm"
              onclick={saveCustomModel}
              disabled={!customModelDraft.modelId?.trim() ||
                !customModelDraft.apiEndpoint?.trim()}>Save</Button
            >
            <Button
              variant="ghost"
              size="sm"
              onclick={() => {
                showCustomModelForm = false;
                customModelDraft = {};
              }}>Cancel</Button
            >
          </div>
        </div>
      {/if}
      {#if (settings?.models?.customModels ?? []).length > 0}
        <ul class="custom-models-list">
          {#each settings?.models?.customModels ?? [] as model (model.id)}
            <li class="custom-model-item">
              <span class="custom-model-id">{model.modelId}</span>
              <span class="custom-model-endpoint">{model.apiEndpoint}</span>
              <Button variant="ghost" size="sm" onclick={() => removeCustomModel(model.id)}
                >Remove</Button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </details>
</div>

<style>

.tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

.tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

.models-tab {
    max-width: 720px;
  }

.preset-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 0.5rem;
  }

.preset-options {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

.preset-option {
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: var(--color-bg-inset, #f3f4f6);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

.preset-option:hover {
    background: var(--color-bg-secondary, #f9fafb);
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

.preset-option.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

.default-model-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

.default-model-row .field-label {
    flex-shrink: 0;
  }

.chat-model-hint {
    margin: 0;
    font-size: 0.8125rem;
  }

.advanced-finetuning {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

.advanced-finetuning .field-label {
    display: block;
    margin-bottom: 0.5rem;
  }

.advanced-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

.advanced-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

.advanced-field input {
    width: 100px;
    padding: 0.35rem 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
  }

.models-tab .models-section {
    margin-bottom: 1.25rem;
  }

.models-tab .models-section:last-child {
    margin-bottom: 0;
  }

.models-provider-loading {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }

.models-provider-intro {
    margin-bottom: 1rem;
  }

.inline-config-input-group .field-label {
    margin-bottom: 0.5rem;
  }

.inline-config-input-row .custom-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    font-size: 0.875rem;
  }

.inline-config-input-row .custom-input.error {
    border-color: #ef4444;
  }

.models-provider-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 360px;
    overflow-y: auto;
  }

.models-provider-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

.models-provider-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 140px;
  }

.models-provider-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

.models-provider-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary, #374151);
  }

.models-provider-select {
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }

.models-custom-details {
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    overflow: hidden;
  }

.models-custom-details summary {
    padding: 0.875rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-secondary, #374151);
    cursor: pointer;
    background: var(--color-bg-subtle, #f9fafb);
    list-style: none;
  }

.models-custom-details summary::-webkit-details-marker {
    display: none;
  }

.models-custom-details summary::before {
    content: '▸ ';
    display: inline-block;
    margin-right: 0.375rem;
    transition: transform 0.2s;
  }

.models-custom-details[open] summary::before {
    transform: rotate(90deg);
  }

.models-custom-inner {
    padding: 1rem 1rem 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

.models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

.section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
  }

.field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

.field-label-row .field-label {
    margin-bottom: 0;
  }

.field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

.theme-card.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

.accent-swatch.selected {
    border-color: var(--color-text, #111827);
    box-shadow:
      0 0 0 2px white,
      0 0 0 4px var(--color-text, #111827);
  }

.custom-select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 6px;
    background-color: var(--color-bg-elevated, #ffffff);
    color: var(--color-text, #18181b);
    font-size: 14px;
    outline: none;
    transition: border-color 150ms;
  }

.custom-select:focus {
    border-color: var(--color-primary, #7c3aed);
  }

.field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

.custom-model-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background: var(--color-bg-subtle, #f9fafb);
    border-radius: 8px;
  }

.custom-model-form .custom-input {
    padding: 8px 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    font-size: 14px;
  }

.custom-model-form-actions {
    display: flex;
    gap: 8px;
  }

.custom-models-list {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
  }

.custom-model-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    margin-bottom: 4px;
  }

.custom-model-id {
    font-family: monospace;
    font-weight: 600;
    font-size: 13px;
  }

.custom-model-endpoint {
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
