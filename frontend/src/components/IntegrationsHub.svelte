<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    getOAuthUrl,
    setApiKey,
    setBotToken,
    PROVIDER_METADATA,
    type Integration,
    type IntegrationProvider,
    type IntegrationStatus,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  let integrations = $state<Integration[]>([]);
  let loading = $state(true);
  let showAddModal = $state(false);
  let selectedProvider = $state<IntegrationProvider | null>(null);
  let apiKeyInput = $state('');
  let botTokenInput = $state('');
  let displayNameInput = $state('');
  let configuring = $state(false);

  const providers = Object.keys(PROVIDER_METADATA) as IntegrationProvider[];

  onMount(async () => {
    await loadIntegrations();
  });

  async function loadIntegrations() {
    loading = true;
    try {
      integrations = await listIntegrations();
    } catch (e) {
      showToast('Failed to load integrations', 'error');
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function getProviderMeta(provider: IntegrationProvider) {
    return PROVIDER_METADATA[provider] || PROVIDER_METADATA.custom;
  }

  function getStatusColor(status: IntegrationStatus): string {
    switch (status) {
      case 'active': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'disabled': return '#6B7280';
      default: return '#6B7280';
    }
  }

  function openAddModal(provider: IntegrationProvider) {
    selectedProvider = provider;
    apiKeyInput = '';
    botTokenInput = '';
    displayNameInput = getProviderMeta(provider).name;
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    selectedProvider = null;
    apiKeyInput = '';
    botTokenInput = '';
    configuring = false;
  }

  async function handleOAuth() {
    if (!selectedProvider) return;
    try {
      const { url } = await getOAuthUrl(selectedProvider);
      window.location.href = url;
    } catch (e) {
      showToast('Failed to start OAuth flow', 'error');
      console.error(e);
    }
  }

  async function handleApiKey() {
    if (!selectedProvider || !apiKeyInput.trim()) return;
    configuring = true;
    try {
      await setApiKey(selectedProvider, apiKeyInput.trim());
      showToast(`${getProviderMeta(selectedProvider).name} connected!`, 'success');
      closeModal();
      await loadIntegrations();
    } catch (e) {
      showToast('Failed to save API key', 'error');
      console.error(e);
    } finally {
      configuring = false;
    }
  }

  async function handleBotToken() {
    if (!selectedProvider || !botTokenInput.trim()) return;
    configuring = true;
    try {
      await setBotToken(selectedProvider, botTokenInput.trim());
      showToast(`${getProviderMeta(selectedProvider).name} connected!`, 'success');
      closeModal();
      await loadIntegrations();
    } catch (e) {
      showToast('Failed to save bot token', 'error');
      console.error(e);
    } finally {
      configuring = false;
    }
  }

  async function toggleIntegration(integration: Integration) {
    const newStatus: IntegrationStatus = integration.status === 'active' ? 'disabled' : 'active';
    try {
      await updateIntegration(integration.id, { status: newStatus });
      showToast(`Integration ${newStatus === 'active' ? 'enabled' : 'disabled'}`, 'success');
      await loadIntegrations();
    } catch (e) {
      showToast('Failed to update integration', 'error');
      console.error(e);
    }
  }

  async function removeIntegration(integration: Integration) {
    if (!confirm(`Remove ${getProviderMeta(integration.provider as IntegrationProvider).name} integration?`)) return;
    try {
      await deleteIntegration(integration.id);
      showToast('Integration removed', 'success');
      await loadIntegrations();
    } catch (e) {
      showToast('Failed to remove integration', 'error');
      console.error(e);
    }
  }

  function isConnected(provider: IntegrationProvider): boolean {
    return integrations.some(i => i.provider === provider);
  }
</script>

<div class="integrations-hub">
  <header class="hub-header">
    <button class="back-btn" onclick={onBack}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
    <h1>Integrations Hub</h1>
    <p class="subtitle">Connect your favorite tools and services</p>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading integrations...</p>
    </div>
  {:else}
    <!-- Connected Integrations -->
    {#if integrations.length > 0}
      <section class="section">
        <h2>Connected</h2>
        <div class="integrations-grid">
          {#each integrations as integration}
            {@const meta = getProviderMeta(integration.provider as IntegrationProvider)}
            <div class="integration-card connected">
              <div class="card-header">
                <div class="provider-icon" style="background: {meta.color}20; color: {meta.color}">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d={meta.icon}/>
                  </svg>
                </div>
                <div class="status-indicator" style="background: {getStatusColor(integration.status)}" title={integration.status}></div>
              </div>
              <h3>{integration.displayName || meta.name}</h3>
              <p class="status-text">{integration.status}</p>
              <div class="card-actions">
                <button 
                  class="action-btn" 
                  class:active={integration.status === 'active'}
                  onclick={() => toggleIntegration(integration)}
                >
                  {integration.status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button class="action-btn danger" onclick={() => removeIntegration(integration)}>
                  Remove
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Available Integrations -->
    <section class="section">
      <h2>Available Integrations</h2>
      <div class="integrations-grid">
        {#each providers.filter(p => !isConnected(p)) as provider}
          {@const meta = getProviderMeta(provider)}
          <div class="integration-card available">
            <div class="card-header">
              <div class="provider-icon" style="background: {meta.color}20; color: {meta.color}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d={meta.icon}/>
                </svg>
              </div>
              <span class="auth-badge">{meta.authType.replace('_', ' ')}</span>
            </div>
            <h3>{meta.name}</h3>
            <p class="description">{meta.description}</p>
            <button class="connect-btn" onclick={() => openAddModal(provider)}>
              Connect
            </button>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<!-- Add Integration Modal -->
{#if showAddModal && selectedProvider}
  {@const meta = getProviderMeta(selectedProvider)}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <button class="close-btn" onclick={closeModal}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <div class="modal-header">
        <div class="provider-icon large" style="background: {meta.color}20; color: {meta.color}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d={meta.icon}/>
          </svg>
        </div>
        <h2>Connect {meta.name}</h2>
        <p>{meta.description}</p>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input 
            type="text" 
            id="displayName"
            bind:value={displayNameInput}
            placeholder="My {meta.name}"
          />
        </div>

        {#if meta.authType === 'oauth'}
          <button class="oauth-btn" onclick={handleOAuth} disabled={configuring}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
            </svg>
            Sign in with {meta.name}
          </button>
        {:else if meta.authType === 'api_key'}
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input 
              type="password" 
              id="apiKey"
              bind:value={apiKeyInput}
              placeholder="Enter your API key"
            />
            <p class="hint">You can find this in your {meta.name} settings</p>
          </div>
          <button 
            class="submit-btn" 
            onclick={handleApiKey} 
            disabled={!apiKeyInput.trim() || configuring}
          >
            {configuring ? 'Connecting...' : 'Connect'}
          </button>
        {:else if meta.authType === 'bot_token'}
          <div class="form-group">
            <label for="botToken">Bot Token</label>
            <input 
              type="password" 
              id="botToken"
              bind:value={botTokenInput}
              placeholder="Enter your bot token"
            />
            <p class="hint">Create a bot in the {meta.name} developer portal</p>
          </div>
          <button 
            class="submit-btn" 
            onclick={handleBotToken} 
            disabled={!botTokenInput.trim() || configuring}
          >
            {configuring ? 'Connecting...' : 'Connect'}
          </button>
        {:else if meta.authType === 'local'}
          <div class="local-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <p>This integration connects to a local service. Make sure {meta.name} is running on your machine.</p>
          </div>
          <button class="submit-btn" onclick={() => { createIntegration(selectedProvider!); closeModal(); loadIntegrations(); }}>
            Enable Integration
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .integrations-hub {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .hub-header {
    margin-bottom: 2rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: #f9fafb;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1rem;
  }

  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .integration-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.2s;
  }

  .integration-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .integration-card.connected {
    border-color: #10b98140;
    background: linear-gradient(to bottom right, white, #f0fdf4);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .provider-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .provider-icon.large {
    width: 64px;
    height: 64px;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .auth-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 4px;
    color: #6b7280;
    text-transform: capitalize;
  }

  .integration-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem;
  }

  .status-text {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem;
    text-transform: capitalize;
  }

  .description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #f9fafb;
  }

  .action-btn.active {
    background: #fef3c7;
    border-color: #fcd34d;
    color: #92400e;
  }

  .action-btn.danger:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .connect-btn {
    width: 100%;
    padding: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    background: #6366f1;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .connect-btn:hover {
    background: #4f46e5;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-header {
    padding: 2rem 2rem 1rem;
    text-align: center;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 1rem 0 0.5rem;
  }

  .modal-header p {
    color: #6b7280;
    margin: 0;
  }

  .modal-body {
    padding: 1rem 2rem 2rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .hint {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0.5rem 0 0;
  }

  .oauth-btn, .submit-btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .oauth-btn {
    background: #111827;
    color: white;
  }

  .oauth-btn:hover:not(:disabled) {
    background: #1f2937;
  }

  .submit-btn {
    background: #6366f1;
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: #4f46e5;
  }

  .submit-btn:disabled, .oauth-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .local-info {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #f0f9ff;
    border-radius: 8px;
    margin-bottom: 1.25rem;
    color: #0369a1;
  }

  .local-info svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .local-info p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .integrations-hub {
      padding: 1rem;
    }

    .integrations-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
