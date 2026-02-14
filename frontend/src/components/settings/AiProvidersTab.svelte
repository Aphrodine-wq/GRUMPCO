<script lang="ts">
  /**
   * AiProvidersTab – Extracted from TabbedSettingsScreen.svelte (tab: 'ai')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Button } from '../../lib/design-system';
  import { AlertCircle, Check, ExternalLink } from 'lucide-svelte';
  import type { ModelsSettings } from '../../types/settings';

  interface Props {
    AI_PROVIDER_OPTIONS: any;
    cancelConfiguringProvider: any;
    configuringApiKey: any;
    configuringErrorMessage: any;
    configuringProvider: any;
    configuringProviderInfo: any;
    configuringTestState: any;
    getProviderFallbackLetter: any;
    getProviderIconPath: any;
    modelGroups: any;
    modelGroupsLoading: any;
    openIntegrationsTab: any;
    preferencesStore: any;
    saveModels: any;
    saving: any;
    selectedProviderInAiTab: any;
    settings: any;
    startConfiguringProvider: any;
    testAndSaveAiProvider: any;
  }

  let {
    AI_PROVIDER_OPTIONS,
    cancelConfiguringProvider,
    configuringApiKey,
    configuringErrorMessage,
    configuringProvider,
    configuringProviderInfo,
    configuringTestState,
    getProviderFallbackLetter,
    getProviderIconPath,
    modelGroups,
    modelGroupsLoading,
    openIntegrationsTab,
    preferencesStore,
    saveModels,
    saving,
    selectedProviderInAiTab,
    settings,
    startConfiguringProvider,
    testAndSaveAiProvider,
  }: Props = $props();
</script>

<div class="tab-section models-tab ai-providers-tab">
  <p class="ai-tab-quick-start">
    Pick a provider below and add an API key to get started. Then choose your default model for chat
    and code.
  </p>
  <Card title="Default model" padding="md" class="ai-providers-default-card">
    <p class="field-hint models-provider-intro">
      Select a configured provider, then pick the model for chat and code.
    </p>
    {#if modelGroupsLoading}
      <p class="models-provider-loading">Loading model list…</p>
    {:else if modelGroups.length === 0}
      <p class="field-hint">
        No providers available. Configure API keys in AI Providers (below) or in your backend .env.
      </p>
    {:else}
      <div class="providers-grid settings-providers-grid">
        {#each modelGroups as group}
          {@const iconPath = getProviderIconPath(group.provider)}
          {@const fallbackLetter = getProviderFallbackLetter(group.provider)}
          {@const isSelected =
            selectedProviderInAiTab === group.provider ||
            (settings?.models?.defaultProvider === group.provider && !selectedProviderInAiTab)}
          <div class="provider-card-wrap" class:selected={isSelected}>
            <button
              type="button"
              class="provider-card settings-provider-card"
              class:selected={isSelected}
              onclick={() => {
                selectedProviderInAiTab = group.provider;
              }}
              aria-pressed={isSelected}
            >
              <span class="provider-icon" aria-hidden="true">
                {#if group.icon && group.icon.startsWith('http')}
                  <img
                    src={group.icon}
                    alt=""
                    class="provider-icon-img"
                    onerror={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                {:else if iconPath}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" role="img">
                    <path d={iconPath} />
                  </svg>
                {:else}
                  <span class="provider-icon-fallback">{fallbackLetter}</span>
                {/if}
              </span>
              <span class="provider-name">{group.displayName}</span>
            </button>
            {#if modelGroups.length > 1 && settings?.models?.defaultProvider !== group.provider}
              <Button
                variant="ghost"
                size="sm"
                class="set-default-btn"
                onclick={(e) => {
                  e.stopPropagation();
                  if (group.models?.[0]?.id) {
                    saveModels({
                      ...settings?.models,
                      defaultProvider: group.provider as ModelsSettings['defaultProvider'],
                      defaultModelId: group.models[0].id,
                    });
                  }
                }}
                disabled={saving}
              >
                Set as default
              </Button>
            {/if}
          </div>
        {/each}
      </div>
      {#if selectedProviderInAiTab}
        {@const group = modelGroups.find((g: any) => g.provider === selectedProviderInAiTab)}
        {#if group}
          <div class="models-section provider-model-select">
            <label class="field-label" for="ai-provider-model">Model for {group.displayName}</label>
            <select
              id="ai-provider-model"
              class="custom-select"
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
            {#if group.provider === 'nim' || group.displayName?.toLowerCase().includes('nim')}
              <p class="field-hint nim-model-hint">
                NIM: 405B = flagship, 70B = balanced, 49B = fast.
              </p>
            {/if}
          </div>
        {/if}
      {/if}
    {/if}
  </Card>
  <Card title="Add more providers" padding="md" class="ai-providers-add-card">
    <p class="section-desc ai-providers-add-desc">
      Supported providers appear here once configured. Add API keys in this tab (AI Providers) or
      set them in your backend <code>.env</code>.
    </p>
    <div class="providers-grid settings-providers-grid add-more-providers-grid">
      {#each AI_PROVIDER_OPTIONS as option}
        {@const iconPath = getProviderIconPath(option.id)}
        {@const fallbackLetter = getProviderFallbackLetter(option.id)}
        {@const isConfigured = modelGroups.some(
          (g: any) =>
            g.provider === option.id || (option.id === 'nvidia-nim' && g.provider === 'nim')
        )}
        <div
          class="provider-card settings-provider-card add-more-card"
          class:configured={isConfigured}
        >
          <span class="provider-icon" aria-hidden="true">
            {#if iconPath}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" role="img">
                <path d={iconPath} />
              </svg>
            {:else}
              <span class="provider-icon-fallback">{fallbackLetter}</span>
            {/if}
          </span>
          <span class="provider-name">{option.name}</span>
          {#if option.description}
            <span class="provider-desc">{option.description}</span>
          {/if}
          {#if isConfigured}
            <span class="configured-badge">Configured</span>
          {:else}
            <Button variant="ghost" size="sm" onclick={() => startConfiguringProvider(option.id)}>
              Configure provider
            </Button>
          {/if}
        </div>
      {/each}
    </div>
    {#if configuringProvider}
      <div class="ai-provider-inline-config">
        {#if configuringProvider === 'ollama'}
          <div class="ollama-inline-notice">
            <p>Make sure Ollama is running locally on your machine.</p>
            <a href="https://ollama.ai" target="_blank" rel="noopener" class="help-link">
              <ExternalLink size={14} />
              Download Ollama
            </a>
          </div>
        {:else}
          <div class="inline-config-input-group">
            <label for="ai-provider-api-key" class="field-label">
              {configuringProviderInfo?.name ?? configuringProvider} API Key
            </label>
            <div class="inline-config-input-row">
              <input
                id="ai-provider-api-key"
                type="password"
                value={configuringApiKey}
                oninput={(e) => {
                  configuringApiKey = (e.target as HTMLInputElement).value;
                }}
                placeholder="Enter your API key..."
                class="custom-input"
                class:error={configuringTestState === 'error'}
              />
              <Button
                variant="secondary"
                size="sm"
                onclick={testAndSaveAiProvider}
                disabled={configuringTestState === 'testing' ||
                  (configuringProvider !== 'ollama' && !configuringApiKey.trim())}
              >
                {#if configuringTestState === 'testing'}
                  <span class="inline-spinner"></span>
                  Testing…
                {:else if configuringTestState === 'success'}
                  <Check size={14} />
                  Saved
                {:else}
                  Test & Save
                {/if}
              </Button>
            </div>
            {#if configuringTestState === 'error' && configuringErrorMessage}
              <p class="inline-config-error">
                <AlertCircle size={14} />
                {configuringErrorMessage}
              </p>
            {/if}
            <a
              href="https://docs.g-rump.dev/providers/{configuringProvider}"
              target="_blank"
              rel="noopener"
              class="help-link"
            >
              <ExternalLink size={14} />
              How to get a {configuringProviderInfo?.name ?? configuringProvider} API key
            </a>
          </div>
        {/if}
        <div class="inline-config-actions">
          <Button variant="ghost" size="sm" onclick={cancelConfiguringProvider}>Cancel</Button>
          {#if configuringProvider === 'ollama'}
            <Button variant="primary" size="sm" onclick={testAndSaveAiProvider}>Save</Button>
          {/if}
        </div>
      </div>
    {/if}
    <div class="open-integrations-wrap">
      <Button variant="secondary" size="sm" onclick={openIntegrationsTab}>
        Need GitHub or OAuth? Open Integrations tab
      </Button>
    </div>
  </Card>
  <Card title="Connect OpenClaw" padding="md" class="ai-providers-openclaw-card">
    <div class="openclaw-connect-wrap">
      <div class="openclaw-info">
        <span class="openclaw-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444" role="img">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
            />
          </svg>
        </span>
        <div class="openclaw-text">
          <span class="openclaw-name">OpenClaw</span>
          <span class="openclaw-desc">
            Connect OpenClaw autonomous agent to G-Rump. Allows OpenClaw to interact with your
            workspace through the G-Agent API.
          </span>
        </div>
      </div>
      <div class="openclaw-actions">
        <a
          href="https://openclaw.ai"
          target="_blank"
          rel="noopener"
          class="help-link openclaw-docs-link"
        >
          <ExternalLink size={14} />
          Learn more
        </a>
        <Button variant="primary" size="sm" onclick={openIntegrationsTab}>Connect OpenClaw</Button>
      </div>
    </div>
  </Card>
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

  .models-provider-loading {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }

  .models-provider-intro {
    margin-bottom: 1rem;
  }

  .ai-tab-quick-start {
    margin: 0 0 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-subtle, #f8fafc);
    border-radius: 10px;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #6b7280);
    line-height: 1.5;
  }

  .ai-providers-tab .models-provider-intro {
    color: var(--color-text-secondary, #6b7280);
    line-height: 1.5;
  }

  .ai-providers-tab .provider-card-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .ai-providers-tab .settings-providers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .ai-providers-tab .settings-provider-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 1.25rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 14px;
    background: var(--color-bg-card, #ffffff);
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04));
    cursor: pointer;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      background 0.2s;
    text-align: center;
  }

  .ai-providers-tab .settings-provider-card:hover {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
  }

  .ai-providers-tab .settings-provider-card.selected {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(124, 58, 237, 0.25));
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
  }

  .ai-providers-tab .provider-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text-secondary, #6b7280);
  }

  .ai-providers-tab .settings-provider-card.selected .provider-icon {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.15));
    color: var(--color-primary, #7c3aed);
  }

  .ai-providers-tab .provider-icon svg {
    width: 24px;
    height: 24px;
  }

  .ai-providers-tab .provider-icon-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .ai-providers-tab .provider-icon-fallback {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
  }

  .ai-providers-tab .add-more-providers-grid {
    margin-bottom: 1rem;
  }

  .ai-providers-tab .add-more-card {
    cursor: default;
    min-height: 120px;
    background: var(--color-bg-subtle, #f9fafb);
  }

  .ai-providers-tab .add-more-card .provider-icon {
    background: var(--color-bg-card, #ffffff);
  }

  .ai-providers-tab .add-more-card .provider-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
    max-width: 140px;
  }

  .ai-providers-tab .add-more-card .configured-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    background: var(--color-success-subtle, rgba(16, 185, 129, 0.15));
    color: var(--color-success, #10b981);
  }

  .ai-providers-tab .section-desc.ai-providers-add-desc {
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }

  .ai-providers-tab .open-integrations-wrap {
    margin-top: 1rem;
  }

  .ai-provider-inline-config {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f9fafb);
    border-radius: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .ai-provider-inline-config .ollama-inline-notice {
    padding: 0.5rem 0;
  }

  .ai-provider-inline-config .ollama-inline-notice p {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #6b7280);
  }

  .inline-config-input-group {
    margin-bottom: 0.75rem;
  }

  .inline-config-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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

  .inline-config-error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0.5rem 0 0 0;
    font-size: 0.8125rem;
    color: #ef4444;
  }

  .inline-config-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .ai-provider-inline-config .help-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-primary, #7c3aed);
    text-decoration: none;
  }

  .ai-provider-inline-config .help-link:hover {
    text-decoration: underline;
  }

  .inline-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: ai-config-spin 0.8s linear infinite;
  }

  .ai-providers-tab .provider-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    line-height: 1.2;
  }

  .ai-providers-tab .provider-model-select {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
    max-width: 360px;
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

  .field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
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

  .custom-model-form .custom-input {
    padding: 8px 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    font-size: 14px;
  }

  .channel-status-dot.configured {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
  }

  /* OpenClaw connect card */
  .openclaw-connect-wrap {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .openclaw-info {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .openclaw-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 10px;
  }

  .openclaw-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .openclaw-name {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--color-text, #111827);
  }

  .openclaw-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.4;
  }

  .openclaw-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.25rem;
  }

  .openclaw-docs-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-primary, #7c3aed);
    text-decoration: none;
  }

  .openclaw-docs-link:hover {
    text-decoration: underline;
  }
</style>
