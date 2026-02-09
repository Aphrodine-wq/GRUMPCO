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
  import { ArrowLeft, ExternalLink, Trash2, Power, AlertCircle, Plug2 } from 'lucide-svelte';
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
  let enableMcpForAgent = $state(false);
  let configuring = $state(false);
  let figmaConnected = $state(false);
  /** Set while redirecting to OAuth so we don't double-submit */
  let oauthRedirecting = $state<IntegrationProvider | null>(null);

  const providers = Object.keys(PROVIDER_METADATA) as IntegrationProvider[];

  // Group providers by category (matches backend IntegrationProviderId where applicable)
  const providerCategories = {
    'For developers': ['sentry', 'datadog', 'postman'],
    'Development Tools': ['github', 'gitlab', 'bitbucket', 'jira', 'linear', 'atlassian'],
    Communication: ['slack', 'discord', 'telegram'],
    'Deploy & Cloud': ['vercel', 'netlify', 'aws', 'gcp', 'azure'],
    'Backend as a Service': ['supabase', 'firebase'],
    'Productivity & Design': ['notion', 'figma', 'gmail', 'google_calendar', 'twitter', 'obsidian'],
    'Voice & Messaging': ['elevenlabs', 'twilio', 'sendgrid'],
    Other: ['home_assistant', 'stripe', 'custom'],
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
    enableMcpForAgent = false;
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    selectedProvider = null;
    apiKeyInput = '';
    botTokenInput = '';
    enableMcpForAgent = false;
    configuring = false;
  }

  async function addMcpForIntegration(provider: IntegrationProvider, integrationId: string) {
    const meta = getProviderMeta(provider);
    const current = get(settingsStore);
    const existing = current?.mcp?.servers ?? [];
    const entry: McpServerConfig = {
      id: `integration_${provider}_${integrationId}`,
      name: `${meta.name} (Agent)`,
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
      const { url } = await getOAuthUrl(provider);
      window.location.href = url;
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
      if (enableMcpForAgent && added) {
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
      if (enableMcpForAgent && added) {
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

  const hasAnyAvailable = $derived(providers.some((p) => !isConnected(p)));

  const QUICK_CONNECT = [
    'github',
    'slack',
    'figma',
    'linear',
    'notion',
    'discord',
    'vercel',
    'netlify',
    'jira',
    'gitlab',
    'bitbucket',
    'supabase',
    'gmail',
  ] as IntegrationProvider[];
  const quickConnectAvailable = $derived(
    QUICK_CONNECT.filter((p) => providers.includes(p) && !isConnected(p))
  );
</script>

<div class="integrations-hub" class:embed={embedInTab}>
  {#if !embedInTab}
    <header class="hub-header">
      <Button variant="ghost" size="sm" onclick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>
      <div class="hero">
        <div class="hero-icon">
          <Plug2 size={32} strokeWidth={2} />
        </div>
        <div class="hero-text">
          <h1>Integrations</h1>
          <p class="hero-subtitle">
            Connect your favorite tools and supercharge your workflow. One click to connect GitHub,
            Slack, Figma, and more.
          </p>
        </div>
      </div>
      {#if quickConnectAvailable.length > 0}
        <section class="quick-connect">
          <h2 class="quick-connect-title">Quick connect</h2>
          <div class="quick-connect-buttons">
            {#each quickConnectAvailable as provider}
              {@const meta = getProviderMeta(provider)}
              {#if meta.authType === 'oauth'}
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() => runOAuthFlow(provider)}
                  disabled={oauthRedirecting === provider}
                >
                  <span class="quick-icon" style="background: {meta.color}20; color: {meta.color}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d={meta.icon} />
                    </svg>
                  </span>
                  {meta.name}
                </Button>
              {:else}
                <Button variant="secondary" size="sm" onclick={() => openAddModal(provider)}>
                  <span class="quick-icon" style="background: {meta.color}20; color: {meta.color}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d={meta.icon} />
                    </svg>
                  </span>
                  {meta.name}
                </Button>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    </header>
  {/if}

  {#if loading}
    <div class="loading-state">
      <Spinner size="lg" />
      <p>Loading integrations...</p>
    </div>
  {:else}
    <div class="single-column-layout">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => removeIntegration(integration)}
                    >
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
          <div class="section-header">
            <h2>Connected</h2>
          </div>
          <div class="empty-state">
            <div class="empty-state-icon">
              <Plug2 size={48} strokeWidth={1.5} />
            </div>
            <h3 class="empty-state-title">No integrations yet</h3>
            <p class="empty-state-hint">
              Use Quick connect above or browse Available Integrations below to get started.
            </p>
          </div>
        </section>
      {/if}

      <!-- Available Integrations by Category -->
      {#if hasAnyAvailable}
        {#each Object.keys(providerCategories) as category}
          {#if getAvailableProvidersByCategory(category).length > 0}
            <section class="section">
              <h2>{category}</h2>
              <div class="integrations-grid">
                {#each getAvailableProvidersByCategory(category) as provider}
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
      {:else}
        <section class="section">
          <h2>All connected</h2>
          <div class="empty-state">
            <div class="empty-state-icon">
              <Plug2 size={40} strokeWidth={1.5} />
            </div>
            <h3 class="empty-state-title">You're all set</h3>
            <p class="empty-state-text">
              All available integrations are connected. Manage them above.
            </p>
          </div>
        </section>
      {/if}
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
          <input type="checkbox" bind:checked={enableMcpForAgent} />
          <span>Also add this integration's MCP for the agent to automatically control</span>
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
              if (enableMcpForAgent && created?.id) {
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
    padding: var(--space-content, 24px);
    max-width: none;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    background: var(--color-bg-app, #fafafa);
  }

  .integrations-hub.embed {
    padding: 0;
    max-width: none;
    margin: 0;
    background: transparent;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-content, 24px);
    text-align: center;
    border-radius: 12px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px dashed var(--color-border, #e9d5ff);
  }

  .empty-state-icon {
    color: var(--color-text-muted, #6b7280);
    opacity: 0.7;
    margin-bottom: 1rem;
  }

  .empty-state-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0 0 0.5rem;
  }

  .empty-state-hint {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    max-width: 320px;
  }

  .empty-state-text {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.5;
    margin: 0;
    max-width: 280px;
  }

  .hub-header {
    margin-bottom: var(--space-content, 24px);
  }

  .hero {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    margin-top: 1rem;
  }

  .hero-icon {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.06));
    color: var(--color-primary, #7c3aed);
    border-radius: 14px;
  }

  .hero-text {
    flex: 1;
    min-width: 0;
  }

  .hero-text h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .hero-subtitle {
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  .quick-connect {
    margin-top: 1.5rem;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
  }

  .quick-connect-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.75rem;
  }

  .quick-connect-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .quick-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .quick-icon svg {
    width: 24px;
    height: 24px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5rem;
    gap: 1rem;
    color: var(--color-text-muted, #6b7280);
  }

  .section {
    margin-bottom: var(--space-content, 24px);
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .section h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
    text-align: center;
    width: 100%;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .single-column-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
    padding: 0 0.5rem 1rem;
  }

  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
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
    font-size: 0.6875rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle, #f3f4f6);
    border-radius: 6px;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .card-content h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .description {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.5;
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
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    transition:
      border-color 150ms,
      box-shadow 150ms;
    background: var(--color-bg, #fff);
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-muted, #9ca3af);
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
