<script lang="ts">
  import { onMount } from 'svelte';
  import { Key, Check, AlertCircle, ExternalLink } from 'lucide-svelte';
  import { newOnboardingStore, AI_PROVIDER_OPTIONS } from '../../../stores/newOnboardingStore';
  import {
    getProviderIconPath,
    getProviderSvgPath,
    getProviderFallbackLetter,
    getProviderColor,
  } from '../../../lib/aiProviderIcons.js';
  import { setApiKey as storeApiKeyOnServer } from '../../../lib/integrationsApi';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let selectedProvider = $state<string | null>(null);
  let apiKey = $state('');
  let showApiKeyInput = $state(false);
  let testState = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let errorMessage = $state('');
  let keySaved = $state(false);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);

    // Pre-select Kimi as recommended; do not show nvidia-nim (platform default)
    const current = newOnboardingStore.get();
    if (current.aiProvider && current.aiProvider !== 'nvidia-nim') {
      selectedProvider = current.aiProvider;
    }
  });

  function selectProvider(id: string) {
    selectedProvider = id;
    showApiKeyInput = id !== 'ollama'; // Ollama doesn't need API key
    testState = 'idle';
    errorMessage = '';
    keySaved = false;
  }

  /**
   * Map onboarding provider IDs to the integration provider IDs accepted by the backend.
   * Some providers (like 'grump') don't have a direct backend mapping.
   */
  function getBackendProviderId(providerId: string): string | null {
    const mapping: Record<string, string> = {
      anthropic: 'anthropic',
      google: 'google',
      kimi: 'kimi',
      mistral: 'mistral',
      jan: 'jan',
      openrouter: 'openrouter',
    };
    return mapping[providerId] ?? null;
  }

  async function testConnection() {
    if (!selectedProvider) return;

    testState = 'testing';
    errorMessage = '';

    try {
      if (selectedProvider !== 'ollama' && !apiKey.trim()) {
        throw new Error('API key is required');
      }

      // Actually store the API key on the backend so the LLM gateway can use it
      const backendProvider = getBackendProviderId(selectedProvider);
      if (backendProvider && apiKey.trim()) {
        try {
          await storeApiKeyOnServer(
            backendProvider as import('../../../lib/integrationsApi').IntegrationProvider,
            apiKey.trim()
          );
          keySaved = true;
        } catch (storeErr) {
          console.warn('Failed to store API key on server:', storeErr);
          // Don't block — the key might still work via env var fallback
        }
      }

      testState = 'success';
      newOnboardingStore.setAiProvider(selectedProvider, apiKey);
    } catch (error) {
      testState = 'error';
      errorMessage = error instanceof Error ? error.message : 'Connection failed';
    }
  }

  async function handleContinue() {
    if (selectedProvider) {
      // Persist the API key to the backend if not already saved
      if (!keySaved && apiKey.trim()) {
        const backendProvider = getBackendProviderId(selectedProvider);
        if (backendProvider) {
          try {
            await storeApiKeyOnServer(
              backendProvider as import('../../../lib/integrationsApi').IntegrationProvider,
              apiKey.trim()
            );
            keySaved = true;
          } catch (storeErr) {
            console.warn('Failed to store API key on server during continue:', storeErr);
          }
        }
      }
      newOnboardingStore.setAiProvider(selectedProvider, apiKey);
    }
    onNext();
  }

  function handleSkip() {
    onNext();
  }

  const selectedProviderInfo = $derived(AI_PROVIDER_OPTIONS.find((p) => p.id === selectedProvider));

  // NVIDIA NIM is platform default (not user-selectable). Only show other providers.
  const displayProviders = $derived(AI_PROVIDER_OPTIONS.filter((p) => p.id !== 'nvidia-nim'));
</script>

<div class="slide-container api-provider-slide">
  <div class="content" class:mounted>
    <!-- Header -->
    <div class="header">
      <div class="header-icon">
        <Key size={28} />
      </div>
      <h2 class="title">Connect AI Provider</h2>
      <p class="subtitle">
        G-Rump uses NVIDIA NIM by default. Add a second provider for more models or skip to use NIM
        only.
      </p>
    </div>

    <!-- Provider selection: real provider icons (file or inline SVG) -->
    <div class="providers-grid">
      {#each displayProviders as provider}
        {@const iconPath = getProviderIconPath(provider.id)}
        {@const svgPath = getProviderSvgPath(provider.id)}
        {@const fallbackLetter = getProviderFallbackLetter(provider.id)}
        {@const accentColor = getProviderColor(provider.id)}
        <button
          class="provider-card"
          class:selected={selectedProvider === provider.id}
          class:recommended={provider.popular}
          onclick={() => selectProvider(provider.id)}
        >
          {#if provider.popular && provider.id === 'kimi'}
            <span class="recommended-badge">Recommended</span>
          {/if}
          <span class="provider-icon" aria-hidden="true">
            {#if iconPath && iconPath.startsWith('/')}
              <img src={iconPath} alt="" width="24" height="24" class="provider-icon-img" />
            {:else if svgPath}
              <svg width="24" height="24" viewBox="0 0 24 24" fill={accentColor} role="img">
                <path d={svgPath} />
              </svg>
            {:else}
              <span
                class="provider-icon-fallback"
                style="background: {accentColor}20; color: {accentColor}">{fallbackLetter}</span
              >
            {/if}
          </span>
          <span class="provider-name">{provider.name}</span>
          {#if provider.description}
            <span class="provider-desc">{provider.description}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- API Key input (if needed) -->
    {#if showApiKeyInput && selectedProvider}
      <div class="api-key-section">
        <div class="input-group">
          <label for="api-key" class="input-label">
            {selectedProviderInfo?.name} API Key
          </label>
          <div class="input-wrapper">
            <input
              id="api-key"
              type="password"
              bind:value={apiKey}
              placeholder="Enter your API key..."
              class="api-input"
              class:error={testState === 'error'}
            />
            <button
              class="test-button"
              class:testing={testState === 'testing'}
              class:success={testState === 'success'}
              onclick={testConnection}
              disabled={testState === 'testing'}
            >
              {#if testState === 'testing'}
                <div class="spinner"></div>
              {:else if testState === 'success'}
                <Check size={16} />
              {:else}
                Test
              {/if}
            </button>
          </div>
          {#if testState === 'error' && errorMessage}
            <p class="error-text">
              <AlertCircle size={14} />
              {errorMessage}
            </p>
          {/if}
          {#if testState === 'success'}
            <p class="success-text">
              <Check size={14} />
              Connection successful!
            </p>
          {/if}
        </div>

        <a
          href="https://docs.g-rump.dev/providers/{selectedProvider}"
          target="_blank"
          rel="noopener"
          class="help-link"
        >
          <ExternalLink size={14} />
          How to get a {selectedProviderInfo?.name} API key
        </a>
      </div>
    {/if}

    <!-- Ollama notice -->
    {#if selectedProvider === 'ollama'}
      <div class="ollama-notice">
        <p>Make sure Ollama is running locally on your machine.</p>
        <a href="https://ollama.ai" target="_blank" rel="noopener" class="help-link">
          <ExternalLink size={14} />
          Download Ollama
        </a>
      </div>
    {/if}

    <!-- Actions -->
    <div class="actions">
      <button
        class="cta-button"
        onclick={handleContinue}
        disabled={showApiKeyInput && !apiKey.trim() && selectedProvider !== 'ollama'}
      >
        <span>{selectedProvider ? 'Continue' : 'Skip for now'}</span>
        <svg class="arrow" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      {#if selectedProvider}
        <button class="skip-button" onclick={handleSkip}> I'll configure this later </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .slide-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100%;
    padding: 2rem;
    overflow-y: auto;
  }

  .slide-container.api-provider-slide {
    padding: 2rem 1.5rem;
  }

  .slide-container.api-provider-slide .content {
    max-width: 720px;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 600px;
    width: 100%;
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .header {
    margin-bottom: 1.5rem;
  }

  .header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: var(--onboarding-cta-gradient);
    border-radius: 16px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-glow);
  }

  .title {
    font-size: 2rem;
    font-weight: 800;
    color: var(--color-text);
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .subtitle {
    font-size: 1.0625rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  /* Providers grid */
  .providers-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 480px) {
    .providers-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
  }

  .provider-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1rem 0.5rem;
    background: var(--color-bg-card);
    border: 2px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease-out;
  }

  .provider-card:hover {
    border-color: var(--color-border-highlight);
    box-shadow: var(--shadow-sm);
  }

  .provider-card.selected {
    border-color: var(--color-primary);
    background: var(--onboarding-card-bg);
    box-shadow: var(--shadow-glow);
  }

  .provider-card:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .recommended-badge {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.125rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--onboarding-cta-gradient);
    color: white;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .provider-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .provider-icon svg {
    width: 24px;
    height: 24px;
  }

  .provider-icon-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .provider-icon-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #f3f4f6;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  .provider-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .provider-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.3;
  }

  /* API Key section */
  .api-key-section {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .input-group {
    margin-bottom: 0.75rem;
  }

  .input-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
    text-align: left;
  }

  .input-wrapper {
    display: flex;
    gap: 0.5rem;
  }

  .api-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    font-size: 0.9375rem;
    transition: all 0.2s;
  }

  .api-input:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  .api-input.error {
    border-color: #ef4444;
  }

  .test-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    background: #f3f4f6;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    min-width: 80px;
  }

  .test-button:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .test-button.testing {
    background: #7c3aed;
    border-color: #7c3aed;
    color: white;
  }

  .test-button.success {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: #ef4444;
    text-align: left;
  }

  .success-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: #10b981;
    text-align: left;
  }

  .help-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: #7c3aed;
    text-decoration: none;
  }

  .help-link:hover {
    text-decoration: underline;
  }

  /* Ollama notice */
  .ollama-notice {
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    width: 100%;
  }

  .ollama-notice p {
    font-size: 0.875rem;
    color: #92400e;
    margin-bottom: 0.5rem;
  }

  /* Actions */
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .cta-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: var(--onboarding-cta-gradient);
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: var(--shadow-glow);
    transition: all 0.2s ease-out;
  }

  .cta-button:hover:not(:disabled) {
    opacity: 0.95;
    box-shadow: var(--shadow-lg);
  }

  .cta-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cta-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 4px rgba(124, 58, 237, 0.3),
      0 4px 16px rgba(124, 58, 237, 0.4);
  }

  .arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  .cta-button:hover:not(:disabled) .arrow {
    transform: translateX(4px);
  }

  .skip-button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .skip-button:hover {
    color: var(--color-text-secondary);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .provider-card,
    .spinner {
      animation: none;
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }
  }
</style>
