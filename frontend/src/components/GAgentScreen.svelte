<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '../stores/settingsStore';
  import { setCurrentView, settingsInitialTab } from '../stores/uiStore';
  import { sessionsStore } from '../stores/sessionsStore';
  import { runMode as runModeStore } from '../stores/runModeStore';
  import {
    preferencesStore,
    gAgentPreferredModelSource,
    gAgentOllamaModel,
  } from '../stores/preferencesStore';
  import { getDockerVersion } from '$lib/dockerSetup';
  import { getApiBase } from '$lib/api';
  import { detectOllama } from '$lib/ollamaDetection';
  import {
    Bot,
    Container,
    Cpu,
    Rocket,
    MessageCircle,
    AlertTriangle,
    ExternalLink,
    Server,
    Brain,
    Target,
    Puzzle,
    Settings,
    FolderOpen,
  } from 'lucide-svelte';
  import ScreenLayout from './ScreenLayout.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import { Button, Card } from '../lib/design-system';
  import GAgentGoalQueue from './GAgentGoalQueue.svelte';
  import GAgentMemoryPanel from './GAgentMemoryPanel.svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  function getCloudModelValue(): string {
    const prefs = preferencesStore.getCurrent();
    const pref = prefs.gAgentModelPreference ?? prefs.freeAgentModelPreference;
    if (pref?.provider && pref?.modelId) return `${pref.provider}:${pref.modelId}`;
    return 'nim:moonshotai/kimi-k2.5';
  }

  let dockerDetected = $state(false);
  let dockerLoading = $state(true);
  let backendHealthy = $state(false);
  let backendLoading = $state(true);
  let runMode = $state<'docker' | 'local' | 'unknown'>('unknown');
  let ollamaDetected = $state(false);
  let ollamaModels = $state<string[]>([]);
  let ollamaLoading = $state(true);

  onMount(async () => {
    try {
      const dockerResult = await getDockerVersion();
      dockerDetected = dockerResult?.installed ?? false;
      runMode = dockerResult?.installed ? 'docker' : 'local';
      runModeStore.set(runMode);
    } catch {
      dockerDetected = false;
      runMode = 'local';
      runModeStore.set('local');
    } finally {
      dockerLoading = false;
    }

    try {
      const base = getApiBase();
      const res = await fetch(`${base}/health/quick`);
      backendHealthy = res.ok;
    } catch {
      backendHealthy = false;
    } finally {
      backendLoading = false;
    }

    try {
      const base = getApiBase();
      const apiBase = base ? `${base}/api` : undefined;
      const status = await detectOllama(apiBase);
      ollamaDetected = status.detected;
      ollamaModels = status.models ?? [];
    } catch {
      ollamaDetected = false;
      ollamaModels = [];
    } finally {
      ollamaLoading = false;
    }
  });

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }

  function handleOpenDockerSetup() {
    setCurrentView('docker-setup');
  }

  function handleOpenShip() {
    setCurrentView('chat');
    window.dispatchEvent(new CustomEvent('open-ship-mode'));
  }

  function handleOpenChat() {
    sessionsStore.createSession([], undefined, 'gAgent');
    setCurrentView('chat');
  }

  function handleOpenSettingsMcp() {
    settingsInitialTab.set('mcp');
    setCurrentView('settings');
  }

  let mcpServers = $state<Array<{ id: string; name: string; enabled?: boolean }>>([]);
  onMount(() => {
    mcpServers = get(settingsStore)?.mcp?.servers ?? [];
    const unsub = settingsStore.subscribe((s) => {
      mcpServers = s?.mcp?.servers ?? [];
    });
    return unsub;
  });
</script>

<ScreenLayout
  title="G-Agent"
  subtitle="Run goals in the background. The agent uses your tools and learns over time."
  onBack={handleBack}
>
  <div class="gagent-cards">
    <!-- Goals first: primary CTA -->
    <Card
      padding="md"
      variant="outlined"
      class="gagent-section-card goal-queue-section goal-queue-primary"
    >
      <div class="card-header-with-icon">
        <div class="step-icon">
          <Target width={24} height={24} strokeWidth={2} />
        </div>
        <div class="card-header-text">
          <h3 class="section-title">Goal Queue</h3>
          <p class="section-desc">
            Add goals here; G-Agent works on them in the background. Run tasks even when you're
            away.
          </p>
        </div>
      </div>
      <div class="section-content goal-queue-container">
        <GAgentGoalQueue workspaceRoot={undefined} />
      </div>
    </Card>

    <Card padding="md" variant="outlined" class="gagent-section-card memory-section">
      <div class="card-header-with-icon">
        <div class="step-icon">
          <Brain width={24} height={24} strokeWidth={2} />
        </div>
        <div class="card-header-text">
          <h3 class="section-title">Agent Memory</h3>
          <p class="section-desc">
            What G-Agent has learned from past runs. View and manage persistent memory.
          </p>
        </div>
      </div>
      <div class="section-content memory-container">
        <GAgentMemoryPanel compact={false} />
      </div>
    </Card>

    <!-- Quick actions -->
    <Card padding="md" variant="outlined" class="gagent-section-card quick-actions">
      <div class="card-header-with-icon">
        <div class="step-icon">
          <Rocket width={24} height={24} strokeWidth={2} />
        </div>
        <h3 class="section-title">Quick actions</h3>
      </div>
      <div class="actions-row">
        <Button variant="secondary" size="md" onclick={handleOpenChat}>
          <MessageCircle width={20} height={20} strokeWidth={2} />
          Chat
        </Button>
        <Button variant="primary" size="md" onclick={handleOpenShip}>
          <Rocket width={20} height={20} strokeWidth={2} />
          SHIP
        </Button>
        <Button variant="secondary" size="md" onclick={() => setCurrentView('projects')}>
          <FolderOpen width={20} height={20} strokeWidth={2} />
          Projects
        </Button>
      </div>
    </Card>

    <Card padding="md" variant="outlined" class="gagent-section-card status-card-wrapper">
      <div class="card-header-with-icon">
        <div class="step-icon step-icon-status">
          <Container width={24} height={24} strokeWidth={2} />
        </div>
        <h3 class="block-heading">Status</h3>
      </div>
      <div class="status-grid">
        <div class="status-card">
          <div class="status-icon" class:loading={dockerLoading}>
            {#if dockerLoading}
              <span class="status-spinner" aria-hidden="true">…</span>
            {:else}
              <Container class="icon" width={24} height={24} strokeWidth={2} />
            {/if}
          </div>
          <h3 class="status-label">Docker</h3>
          <p class="status-value">
            {#if dockerLoading}
              Checking…
            {:else if dockerDetected}
              <span class="status-ok">Detected</span>
            {:else}
              <span class="status-warn">Not detected</span>
            {/if}
          </p>
          {#if !dockerLoading && !dockerDetected}
            <button type="button" class="status-action" onclick={handleOpenDockerSetup}>
              Set up Docker
              <ExternalLink width={14} height={14} strokeWidth={2} />
            </button>
          {/if}
        </div>

        <div class="status-card">
          <div class="status-icon" class:loading={backendLoading}>
            {#if backendLoading}
              <span class="status-spinner" aria-hidden="true">…</span>
            {:else}
              <Cpu class="icon" width={24} height={24} strokeWidth={2} />
            {/if}
          </div>
          <h3 class="status-label">Backend</h3>
          <p class="status-value">
            {#if backendLoading}
              Checking…
            {:else if backendHealthy}
              <span class="status-ok">Connected</span>
            {:else}
              <span class="status-error">Offline</span>
            {/if}
          </p>
        </div>

        <div class="status-card">
          <div class="status-icon">
            <Bot class="icon" width={24} height={24} strokeWidth={2} />
          </div>
          <h3 class="status-label">Run mode</h3>
          <p class="status-value">
            {runMode === 'docker'
              ? 'Docker (recommended)'
              : runMode === 'local'
                ? 'Local'
                : 'Unknown'}
          </p>
        </div>

        <div class="status-card">
          <div class="status-icon" class:loading={ollamaLoading}>
            {#if ollamaLoading}
              <span class="status-spinner" aria-hidden="true">…</span>
            {:else}
              <Server class="icon" width={24} height={24} strokeWidth={2} />
            {/if}
          </div>
          <h3 class="status-label">Local Ollama</h3>
          <p class="status-value">
            {#if ollamaLoading}
              Checking…
            {:else if ollamaDetected}
              <span class="status-ok">Detected</span>
            {:else}
              <span class="status-warn">Not detected</span>
            {/if}
          </p>
          {#if ollamaDetected && ollamaModels.length > 0}
            <p class="status-models">
              {ollamaModels.length} model(s): {ollamaModels
                .slice(0, 3)
                .join(', ')}{ollamaModels.length > 3 ? '…' : ''}
            </p>
          {/if}
        </div>
      </div>
    </Card>

    <!-- Connect more tools (Integrations CTA: Twilio, GitHub, Slack, etc.) -->
    <div class="integrations-cta gagent-step-card">
      <Puzzle width={22} height={22} strokeWidth={2} />
      <div class="integrations-cta-text">
        <strong>Connect more tools</strong>
        <span>Twilio, GitHub, Slack, Figma, and more in Integrations.</span>
      </div>
      <Button variant="secondary" size="sm" onclick={() => setCurrentView('integrations')}>
        Open Integrations
      </Button>
    </div>

    <!-- MCP Servers (Settings → MCP) -->
    <Card padding="md" variant="outlined" class="gagent-section-card mcp-section">
      <div class="card-header-with-icon">
        <div class="step-icon">
          <Puzzle width={24} height={24} strokeWidth={2} />
        </div>
        <div class="card-header-text">
          <h3 class="section-title">MCP servers</h3>
          <p class="section-desc">
            Tools G-Agent can use from your configured MCP servers. Add and manage in Settings →
            MCP.
          </p>
        </div>
        <button type="button" class="mcp-settings-link" onclick={handleOpenSettingsMcp}>
          <Settings width={16} height={16} strokeWidth={2} />
          Manage in Settings
        </button>
      </div>
      <div class="section-content mcp-section-content">
        {#if mcpServers.length === 0}
          <p class="mcp-empty">
            No MCP servers configured. Add one in Settings → MCP to let G-Agent use external tools.
          </p>
        {:else}
          <ul class="mcp-status-list">
            {#each mcpServers as server (server.id)}
              <li class="mcp-status-item">
                <span class="mcp-status-name">{server.name}</span>
                {#if server.enabled === false}
                  <span class="mcp-status-badge disabled">Disabled</span>
                {:else}
                  <span class="mcp-status-badge">Configured</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </Card>

    <!-- Model preference (secondary) -->
    <Card padding="md" variant="outlined" class="gagent-section-card model-preference-card">
      <div class="card-header-with-icon">
        <div class="step-icon">
          <Cpu width={24} height={24} strokeWidth={2} />
        </div>
        <div class="card-header-text">
          <h3 class="block-heading">Model preference</h3>
          <p class="section-desc">
            Where G-Agent runs: local Ollama (no API cost) or cloud models.
          </p>
        </div>
      </div>
      <div class="model-preference-section">
        <span class="field-label model-source-label">Source</span>
        <div class="model-preference-options">
          <label class="model-option">
            <input
              type="radio"
              name="modelSource"
              value="auto"
              checked={get(gAgentPreferredModelSource) === 'auto'}
              onchange={() => preferencesStore.setGAgentPreferredModelSource('auto')}
            />
            <span>Auto (cloud when available, Ollama as fallback)</span>
          </label>
          <label class="model-option">
            <input
              type="radio"
              name="modelSource"
              value="ollama"
              checked={get(gAgentPreferredModelSource) === 'ollama'}
              onchange={() => preferencesStore.setGAgentPreferredModelSource('ollama')}
            />
            <span>Use Ollama (local, no API cost)</span>
          </label>
          <label class="model-option">
            <input
              type="radio"
              name="modelSource"
              value="cloud"
              checked={get(gAgentPreferredModelSource) === 'cloud'}
              onchange={() => preferencesStore.setGAgentPreferredModelSource('cloud')}
            />
            <span>Cloud only (Claude, Gemini, Kimi)</span>
          </label>
        </div>
        {#if ollamaDetected && ollamaModels.length > 0 && get(gAgentPreferredModelSource) === 'ollama'}
          <div class="ollama-model-select">
            <label for="ollama-model">Ollama model:</label>
            <select
              id="ollama-model"
              class="ollama-select"
              value={get(gAgentOllamaModel)}
              onchange={(e) =>
                preferencesStore.setGAgentOllamaModel((e.currentTarget as HTMLSelectElement).value)}
            >
              {#each ollamaModels as model}
                <option value={model}>{model}</option>
              {/each}
            </select>
          </div>
        {/if}
        {#if get(gAgentPreferredModelSource) === 'cloud'}
          <div class="cloud-model-select">
            <span class="field-label">Cloud model:</span>
            <ModelPicker
              value={getCloudModelValue()}
              compact={false}
              showAuto={false}
              onSelect={(provider, modelId) => {
                if (modelId) {
                  preferencesStore.update({
                    ...preferencesStore.getCurrent(),
                    gAgentModelPreference: { source: 'cloud', provider, modelId },
                    freeAgentModelPreference: { source: 'cloud', provider, modelId },
                  });
                }
              }}
            />
          </div>
        {/if}
      </div>
    </Card>
  </div>
  <!-- /gagent-cards -->

  <!-- Capabilities & security: single link to Settings -->
  <Card padding="md" variant="outlined" class="gagent-section-card capabilities-link-card">
    <div class="capabilities-link-inner">
      <div class="step-icon">
        <Puzzle width={24} height={24} strokeWidth={2} />
      </div>
      <div class="capabilities-link-text">
        <h3 class="section-title">Capabilities &amp; security</h3>
        <p class="section-desc">
          Choose which tools G-Agent can use (file, git, Docker, etc.) and which external API
          domains are allowed. Managed in Settings.
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => {
          settingsInitialTab.set('security');
          setCurrentView('settings');
        }}
      >
        Open Settings → Security
      </Button>
    </div>
  </Card>

  <!-- Docker hint when not detected -->
  {#if !dockerDetected && !dockerLoading}
    <div class="info-box gagent-docker-hint">
      <div class="info-icon">
        <AlertTriangle width={20} height={20} strokeWidth={2} />
      </div>
      <div class="info-body">
        <p class="info-desc">
          G-Agent runs best in Docker for sandboxing. <button
            type="button"
            class="info-inline-link"
            onclick={handleOpenDockerSetup}>Set up Docker</button
          > or continue locally (Settings → Security for capabilities).
        </p>
      </div>
    </div>
  {/if}
</ScreenLayout>

<style>
  .gagent-cards {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-header-with-icon {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .card-header-with-icon .card-header-text {
    flex: 1;
    min-width: 0;
  }

  .card-header-with-icon .section-title,
  .card-header-with-icon .block-heading {
    margin: 0 0 0.25rem 0;
  }

  .card-header-with-icon .section-desc {
    margin: 0;
  }

  .step-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .step-icon-status {
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .gagent-section-card {
    margin-bottom: 0;
  }

  .gagent-section-card .section-content {
    margin-top: 0;
  }

  .mcp-section .card-header-with-icon {
    flex-wrap: wrap;
  }

  .mcp-section .mcp-settings-link {
    margin-left: auto;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 0;
  }

  .status-card-wrapper {
    margin-bottom: 1.5rem;
  }

  .capabilities-link-card {
    margin-top: 0.5rem;
  }

  .capabilities-link-inner {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .capabilities-link-text {
    flex: 1;
    min-width: 0;
  }

  .capabilities-link-text .section-desc {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }

  .info-inline-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    text-decoration: underline;
    cursor: pointer;
  }

  .info-inline-link:hover {
    color: var(--color-primary-hover, #6d28d9);
  }

  .gagent-docker-hint .info-desc {
    margin: 0;
  }

  .integrations-cta {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.08));
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
  }

  .integrations-cta-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .integrations-cta-text strong {
    font-size: 0.9375rem;
    color: var(--color-text, #1f1147);
  }

  .integrations-cta-text span {
    font-size: 0.8125rem;
    color: var(--color-text-secondary, #6b7280);
  }

  .status-card {
    padding: 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e9d5ff);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04));
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-primary, #7c3aed);
  }

  .status-icon.loading {
    color: var(--color-text-muted);
  }

  .status-spinner {
    font-size: 1.5rem;
  }

  .status-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted);
    margin: 0;
  }

  .status-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .status-models {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0 0 0;
  }

  .status-ok {
    color: var(--color-success, #34c759);
  }

  .status-warn {
    color: var(--color-warning, #ff9500);
  }

  .status-error {
    color: var(--color-error, #ff3b30);
  }

  .status-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 0.5rem;
    padding: 6px 12px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-primary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .status-action:hover {
    background: var(--color-primary);
    color: white;
  }

  .info-box {
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    margin-bottom: 2rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e9d5ff);
    border-radius: 12px;
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04));
  }

  .info-icon {
    flex-shrink: 0;
    color: var(--color-warning, #ff9500);
  }

  .info-body {
    flex: 1;
    min-width: 0;
  }

  .info-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .quick-actions {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.5rem 0;
  }

  .section-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .model-preference-section {
    margin-bottom: 0;
  }

  .model-source-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 0.5rem;
  }

  .model-preference-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .model-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--color-text);
    cursor: pointer;
  }

  .model-option input {
    cursor: pointer;
  }

  .ollama-model-select {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 0.75rem;
  }

  .ollama-model-select label,
  .cloud-model-select .field-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .cloud-model-select {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 0.75rem;
  }

  .ollama-select {
    padding: 6px 10px;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-card);
    color: var(--color-text);
  }

  .actions-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .section-content {
    background: var(--color-bg-card);
  }

  .goal-queue-container,
  .memory-container {
    height: 400px;
    overflow: hidden;
  }

  .mcp-settings-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  .mcp-settings-link:hover {
    background: var(--color-bg-subtle);
  }

  .mcp-section-content {
    padding: 1rem 1.25rem;
  }

  .mcp-empty {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .mcp-status-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .mcp-status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.875rem;
  }

  .mcp-status-item:last-child {
    border-bottom: none;
  }

  .mcp-status-name {
    font-weight: 500;
    color: var(--color-text);
  }

  .mcp-status-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: var(--color-bg-subtle);
    color: var(--color-text-muted);
  }

  .mcp-status-badge.disabled {
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.1));
    color: var(--color-error, #b91c1c);
  }
</style>
