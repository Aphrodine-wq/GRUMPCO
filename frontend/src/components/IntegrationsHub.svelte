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
    getFigmaAuthUrl,
    getFigmaMe,
    PROVIDER_METADATA,
    type Integration,
    type IntegrationProvider,
    type IntegrationStatus,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';
  import { settingsStore } from '../stores/settingsStore';
  import { get } from 'svelte/store';
  import { Button, Card, Badge, Modal, Spinner } from '../lib/design-system';
  import { ArrowLeft, ExternalLink, Settings, Trash2, Power, AlertCircle } from 'lucide-svelte';
  import type { McpServerConfig } from '../types/settings';

  interface Props {
    onBack: () => void;
    /** When true, hide header (for embedding in Settings Integrations tab) */
    embedInTab?: boolean;
  }
  let { onBack, embedInTab = false }: Props = $props();

  let integrations = $state<Integration[]>([]);
  let loading = $state(true);
  let showAddModal = $state(false);
  let selectedProvider = $state<IntegrationProvider | null>(null);
  let apiKeyInput = $state('');
  let botTokenInput = $state('');
  let displayNameInput = $state('');
  let enableMcpForGAgent = $state(false);
  let configuring = $state(false);
  let figmaConnected = $state(false);
  /** Set while redirecting to OAuth so we don't double-submit */
  let oauthRedirecting = $state<IntegrationProvider | null>(null);

  const providers = Object.keys(PROVIDER_METADATA) as IntegrationProvider[];

  // Group providers by category (matches backend IntegrationProviderId where applicable)
  const providerCategories = {
    'Development Tools': ['github', 'gitlab', 'bitbucket', 'jira', 'linear', 'atlassian'],
    Communication: ['slack', 'discord', 'telegram'],
    'Deploy & Cloud': ['vercel', 'netlify', 'aws', 'gcp', 'azure'],
    'Backend as a Service': ['supabase', 'firebase'],
    'Productivity & Design': ['notion', 'figma', 'gmail', 'google_calendar', 'twitter', 'obsidian'],
    'Voice & Messaging': ['elevenlabs', 'twilio', 'sendgrid'],
    'Other': ['home_assistant', 'stripe', 'custom'],
  };

  onMount(async () => {
    await loadIntegrations();
    try {
      const me = await getFigmaMe();
      figmaConnected = me.connected;
    } catch {
      figmaConnected = false;
    }
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
    enableMcpForGAgent = false;
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    selectedProvider = null;
    apiKeyInput = '';
    botTokenInput = '';
    enableMcpForGAgent = false;
    configuring = false;
  }

  async function addMcpForIntegration(provider: IntegrationProvider, integrationId: string) {
    const meta = getProviderMeta(provider);
    const current = get(settingsStore);
    const existing = current?.mcp?.servers ?? [];
    const entry: McpServerConfig = {
      id: `integration_${provider}_${integrationId}`,
      name: `${meta.name} (G-Agent)`,
      enabled: true,
    };
    const next = [...existing.filter((s) => s.id !== entry.id), entry];
    await settingsStore.save({ mcp: { servers: next } });
  }

  async function handleOAuth() {
    if (!selectedProvider) return;
    await runOAuthFlow(selectedProvider);
  }

  /** Start OAuth from modal or from card; redirects (or opens window for Figma). */
  async function runOAuthFlow(provider: IntegrationProvider) {
    try {
      if (provider === 'figma') {
        const { url } = await getFigmaAuthUrl();
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast('Complete connection in the new window, then refresh', 'info');
        return;
      }
      oauthRedirecting = provider;
      const { authUrl } = await getOAuthUrl(provider);
      window.location.href = authUrl;
    } catch (e) {
      oauthRedirecting = null;
      showToast('Failed to start OAuth flow', 'error');
      console.error(e);
    }
  }

  async function handleApiKey() {
    if (!selectedProvider || !apiKeyInput.trim()) return;
    configuring = true;
    try {
      await setApiKey(selectedProvider, apiKeyInput.trim());
      const list = await listIntegrations();
      const added = list.find((i) => i.provider === selectedProvider);
      if (enableMcpForGAgent && added) {
        await addMcpForIntegration(selectedProvider, added.id);
      }
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
      const list = await listIntegrations();
      const added = list.find((i) => i.provider === selectedProvider);
      if (enableMcpForGAgent && added) {
        await addMcpForIntegration(selectedProvider, added.id);
      }
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
    if (provider === 'figma') return figmaConnected;
    return integrations.some((i) => i.provider === provider);
  }

  function getAvailableProvidersByCategory(category: string): IntegrationProvider[] {
    const categoryProviders = providerCategories[category as keyof typeof providerCategories] || [];
    return categoryProviders.filter(
      (p) => providers.includes(p as IntegrationProvider) && !isConnected(p as IntegrationProvider)
    ) as IntegrationProvider[];
  }
</script>

<div class="integrations-hub" class:embed={embedInTab}>
  {#if !embedInTab}
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
  {/if}

  {#if loading}
    <div class="loading-state">
      <Spinner size="lg" />
      <p>Loading integrations...</p>
    </div>
  {:else}
    <div class="two-column-layout">
      <!-- Left: Connected Integrations -->
      <aside class="column-left">
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
            <Card padding="sm">
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
    {:else}
      <section class="section">
        <h2>Connected</h2>
        <p class="empty-column-text">No integrations connected yet.</p>
      </section>
    {/if}
      </aside>

      <!-- Right: Available Integrations by Category -->
      <main class="column-right">
    {#each Object.keys(providerCategories) as category}
      {@const availableInCategory = getAvailableProvidersByCategory(category)}
      {#if availableInCategory.length > 0}
        <section class="section">
          <h2>{category}</h2>
          <div class="integrations-grid">
            {#each availableInCategory as provider}
              {@const meta = getProviderMeta(provider)}
              <Card padding="sm">
                <div class="card-content available">
                  <div class="card-top card-top-centered">
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
                  {#if meta.authType === 'oauth'}
                    <Button
                      variant="primary"
                      size="sm"
                      onclick={() => runOAuthFlow(provider)}
                      disabled={oauthRedirecting === provider}
                      fullWidth
                    >
                      <ExternalLink size={14} />
                      {oauthRedirecting === provider ? 'Redirecting…' : 'Sign in'}
                    </Button>
                  {:else}
                    <Button
                      variant="primary"
                      size="sm"
                      onclick={() => openAddModal(provider)}
                      fullWidth
                    >
                      Connect
                    </Button>
                  {/if}
                </div>
              </Card>
            {/each}
          </div>
        </section>
      {/if}
    {/each}
      </main>
    </div>
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

      <div class="mcp-option">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={enableMcpForGAgent} />
          <span>Also add this integration's MCP for G-Agent to automatically control</span>
        </label>
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
          onclick={async () => {
            try {
              const created = await createIntegration(selectedProvider!);
              if (enableMcpForGAgent && created?.id) {
                await addMcpForIntegration(selectedProvider!, created.id);
              }
              showToast(`${getProviderMeta(selectedProvider!).name} connected!`, 'success');
            } catch (e) {
              showToast('Failed to enable integration', 'error');
              console.error(e);
              return;
            }
            closeModal();
            await loadIntegrations();
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
    max-width: none;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .integrations-hub.embed {
    padding: 0;
    max-width: none;
    margin: 0;
  }

  .two-column-layout {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .two-column-layout {
      grid-template-columns: 1fr;
    }
  }

  .column-left {
    position: sticky;
    top: 0;
  }

  .column-right {
    min-width: 0;
  }

  .empty-column-text {
    color: #a1a1aa;
    font-size: 14px;
    margin: 0;
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
    margin-bottom: 24px;
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
    text-align: center;
    width: 100%;
    margin: 0;
  }

  .column-left .integrations-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .column-right .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-content.available {
    align-items: center;
    text-align: center;
  }

  .card-content.available .card-top.card-top-centered {
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }

  .card-content.available h3 {
    text-align: center;
    width: 100%;
  }

  .card-content.available .description {
    text-align: center;
  }

  .provider-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .provider-icon.large {
    width: 52px;
    height: 52px;
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
    font-size: 14px;
    font-weight: 600;
    color: #18181b;
    margin: 0;
  }

  .description {
    font-size: 12px;
    color: #71717a;
    margin: 0;
    line-height: 1.45;
    flex: 1;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
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

  .mcp-option {
    margin: 0.75rem 0;
  }

  .mcp-option .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: normal;
    cursor: pointer;
  }

  .mcp-option .checkbox-label input {
    margin-top: 0.2rem;
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
