<script lang="ts">
  /**
   * IntegrationsHub - Central place to manage all external integrations
   * Refactored to use design system components for consistency
   */
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
  import { Button, Card, Badge, Modal, Spinner } from '../lib/design-system';
  import { ArrowLeft, ExternalLink, Settings, Trash2, Power, AlertCircle } from 'lucide-svelte';

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

  // Group providers by category
  const providerCategories = {
    'Development Tools': ['github', 'gitlab', 'bitbucket', 'jira', 'linear'],
    Communication: ['slack', 'discord', 'telegram'],
    'AI & Models': ['openai', 'anthropic', 'huggingface'],
    'Local Services': ['ollama', 'docker'],
    Other: ['custom'],
  };

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

  function getStatusVariant(
    status: IntegrationStatus
  ): 'success' | 'warning' | 'error' | 'default' {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'error':
        return 'error';
      case 'disabled':
        return 'default';
      default:
        return 'default';
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
    if (
      !confirm(
        `Remove ${getProviderMeta(integration.provider as IntegrationProvider).name} integration?`
      )
    )
      return;
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
    return integrations.some((i) => i.provider === provider);
  }

  function getAvailableProvidersByCategory(category: string): IntegrationProvider[] {
    const categoryProviders = providerCategories[category as keyof typeof providerCategories] || [];
    return categoryProviders.filter(
      (p) => providers.includes(p as IntegrationProvider) && !isConnected(p as IntegrationProvider)
    ) as IntegrationProvider[];
  }
</script>

<div class="integrations-hub">
  <header class="hub-header">
    <Button variant="ghost" size="sm" onclick={onBack}>
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-text">
      <h1>Integrations Hub</h1>
      <p class="subtitle">Connect your favorite tools and services to supercharge your workflow</p>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <Spinner size="lg" />
      <p>Loading integrations...</p>
    </div>
  {:else}
    <!-- Connected Integrations -->
    {#if integrations.length > 0}
      <section class="section">
        <div class="section-header">
          <h2>Connected Integrations</h2>
          <Badge variant="success"
            >{integrations.filter((i) => i.status === 'active').length} active</Badge
          >
        </div>
        <div class="integrations-grid">
          {#each integrations as integration}
            {@const meta = getProviderMeta(integration.provider as IntegrationProvider)}
            <Card padding="md">
              <div class="card-content connected">
                <div class="card-top">
                  <div
                    class="provider-icon"
                    style="background: {meta.color}15; color: {meta.color}"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d={meta.icon} />
                    </svg>
                  </div>
                  <Badge variant={getStatusVariant(integration.status)}>
                    {integration.status}
                  </Badge>
                </div>
                <h3>{integration.displayName || meta.name}</h3>
                <p class="description">{meta.description}</p>
                <div class="card-actions">
                  <Button
                    variant={integration.status === 'active' ? 'secondary' : 'primary'}
                    size="sm"
                    onclick={() => toggleIntegration(integration)}
                  >
                    <Power size={14} />
                    {integration.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => removeIntegration(integration)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Available Integrations by Category -->
    {#each Object.keys(providerCategories) as category}
      {@const availableInCategory = getAvailableProvidersByCategory(category)}
      {#if availableInCategory.length > 0}
        <section class="section">
          <h2>{category}</h2>
          <div class="integrations-grid">
            {#each availableInCategory as provider}
              {@const meta = getProviderMeta(provider)}
              <Card padding="md">
                <div class="card-content available">
                  <div class="card-top">
                    <div
                      class="provider-icon"
                      style="background: {meta.color}15; color: {meta.color}"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d={meta.icon} />
                      </svg>
                    </div>
                    <span class="auth-type">{meta.authType.replace('_', ' ')}</span>
                  </div>
                  <h3>{meta.name}</h3>
                  <p class="description">{meta.description}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onclick={() => openAddModal(provider)}
                    fullWidth
                  >
                    Connect
                  </Button>
                </div>
              </Card>
            {/each}
          </div>
        </section>
      {/if}
    {/each}

    <!-- Empty State -->
    {#if integrations.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Settings size={48} />
        </div>
        <h3>No integrations yet</h3>
        <p>Connect your first integration to get started</p>
      </div>
    {/if}
  {/if}
</div>

<!-- Add Integration Modal -->
<Modal
  open={showAddModal && !!selectedProvider}
  onClose={closeModal}
  title={selectedProvider
    ? `Connect ${getProviderMeta(selectedProvider).name}`
    : 'Connect Integration'}
  size="sm"
>
  {#if selectedProvider}
    {@const meta = getProviderMeta(selectedProvider)}
    <div class="modal-content">
      <div class="modal-icon">
        <div class="provider-icon large" style="background: {meta.color}15; color: {meta.color}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d={meta.icon} />
          </svg>
        </div>
      </div>
      <p class="modal-description">{meta.description}</p>

      <div class="form-group">
        <label for="displayName">Display Name</label>
        <input
          type="text"
          id="displayName"
          bind:value={displayNameInput}
          placeholder="My {meta.name}"
          class="text-input"
        />
      </div>

      {#if meta.authType === 'oauth'}
        <Button variant="primary" onclick={handleOAuth} disabled={configuring} fullWidth>
          <ExternalLink size={16} />
          Sign in with {meta.name}
        </Button>
      {:else if meta.authType === 'api_key'}
        <div class="form-group">
          <label for="apiKey">API Key</label>
          <input
            type="password"
            id="apiKey"
            bind:value={apiKeyInput}
            placeholder="Enter your API key"
            class="text-input"
          />
          <p class="hint">You can find this in your {meta.name} settings</p>
        </div>
        <Button
          variant="primary"
          onclick={handleApiKey}
          disabled={!apiKeyInput.trim() || configuring}
          fullWidth
        >
          {configuring ? 'Connecting...' : 'Connect'}
        </Button>
      {:else if meta.authType === 'bot_token'}
        <div class="form-group">
          <label for="botToken">Bot Token</label>
          <input
            type="password"
            id="botToken"
            bind:value={botTokenInput}
            placeholder="Enter your bot token"
            class="text-input"
          />
          <p class="hint">Create a bot in the {meta.name} developer portal</p>
        </div>
        <Button
          variant="primary"
          onclick={handleBotToken}
          disabled={!botTokenInput.trim() || configuring}
          fullWidth
        >
          {configuring ? 'Connecting...' : 'Connect'}
        </Button>
      {:else if meta.authType === 'local'}
        <div class="local-notice">
          <AlertCircle size={20} />
          <p>
            This integration connects to a local service. Make sure {meta.name} is running on your machine.
          </p>
        </div>
        <Button
          variant="primary"
          onclick={() => {
            createIntegration(selectedProvider!);
            closeModal();
            loadIntegrations();
          }}
          fullWidth
        >
          Enable Integration
        </Button>
      {/if}
    </div>
  {/if}
</Modal>

<style>
  .integrations-hub {
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .hub-header {
    margin-bottom: 32px;
  }

  .header-text {
    margin-top: 16px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #18181b;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #71717a;
    margin: 0;
    font-size: 15px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    gap: 16px;
    color: #71717a;
  }

  .section {
    margin-bottom: 32px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .section h2 {
    font-size: 16px;
    font-weight: 600;
    color: #3f3f46;
    margin: 0;
  }

  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .auth-type {
    font-size: 11px;
    padding: 4px 8px;
    background: #f4f4f5;
    border-radius: 4px;
    color: #71717a;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .card-content h3 {
    font-size: 15px;
    font-weight: 600;
    color: #18181b;
    margin: 0;
  }

  .description {
    font-size: 13px;
    color: #71717a;
    margin: 0;
    line-height: 1.5;
    flex: 1;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 40px;
    text-align: center;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: #f4f4f5;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a1aa;
    margin-bottom: 24px;
  }

  .empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: #18181b;
    margin: 0 0 8px;
  }

  .empty-state p {
    font-size: 14px;
    color: #71717a;
    margin: 0;
  }

  /* Modal Content */
  .modal-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modal-icon {
    display: flex;
    justify-content: center;
  }

  .modal-description {
    text-align: center;
    color: #71717a;
    font-size: 14px;
    margin: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: #3f3f46;
  }

  .text-input {
    width: 100%;
    padding: 10px 14px;
    font-size: 14px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    transition:
      border-color 150ms,
      box-shadow 150ms;
    background: white;
  }

  .text-input:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  .hint {
    font-size: 12px;
    color: #a1a1aa;
    margin: 0;
  }

  .local-notice {
    display: flex;
    gap: 12px;
    padding: 14px;
    background: #eff6ff;
    border-radius: 10px;
    color: #1d4ed8;
    align-items: flex-start;
  }

  .local-notice p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
  }
</style>
