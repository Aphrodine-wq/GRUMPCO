<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '../stores/settingsStore';
  import { setCurrentView } from '../stores/uiStore';
  import { sessionsStore } from '../stores/sessionsStore';
  import { runMode as runModeStore } from '../stores/runModeStore';
  import {
    preferencesStore,
    gAgentCapabilities,
    gAgentExternalAllowlist,
    gAgentPreferredModelSource,
    gAgentOllamaModel,
  } from '../stores/preferencesStore';
  import type { GAgentCapabilityKey } from '../stores/preferencesStore';
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
    Plus,
    X,
    Server,
    Brain,
    Target,
    Puzzle,
    Settings,
  } from 'lucide-svelte';
  import ScreenLayout from './ScreenLayout.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import GAgentGoalQueue from './GAgentGoalQueue.svelte';
  import GAgentMemoryPanel from './GAgentMemoryPanel.svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  const CAPABILITY_LABELS: Record<GAgentCapabilityKey, string> = {
    file: 'File system',
    git: 'Git',
    bash: 'Bash',
    npm: 'npm',
    docker: 'Docker',
    cloud: 'Cloud',
    webhooks: 'Webhooks',
    heartbeats: 'Scheduled tasks',
    internet_search: 'Internet Search',
    database: 'Database',
    api_call: 'API calls',
    monitoring: 'Monitoring',
    cicd: 'CI/CD',
    skills_self_edit: 'Self-edit skills',
    task_planning: 'Task Planning',
    memory: 'Persistent Memory',
    self_improve: 'Self-Improvement',
  };
  const CAPABILITY_KEYS: GAgentCapabilityKey[] = [
    'file',
    'git',
    'bash',
    'npm',
    'docker',
    'cloud',
    'webhooks',
    'heartbeats',
    'internet_search',
    'skills_self_edit',
    'task_planning',
    'memory',
    'self_improve',
  ];

  let newDomain = $state('');
  let enabledCapabilities = $state<GAgentCapabilityKey[]>(CAPABILITY_KEYS);
  let allowlist = $state<string[]>([]);

  $effect(() => {
    enabledCapabilities = get(gAgentCapabilities);
    allowlist = get(gAgentExternalAllowlist);
  });

  function isCapabilityEnabled(key: GAgentCapabilityKey): boolean {
    return enabledCapabilities.includes(key);
  }

  function toggleCapability(key: GAgentCapabilityKey) {
    preferencesStore.toggleGAgentCapability(key);
  }

  function addDomain() {
    if (!newDomain.trim()) return;
    preferencesStore.addGAgentAllowlistDomain(newDomain);
    newDomain = '';
  }

  function removeDomain(domain: string) {
    preferencesStore.removeGAgentAllowlistDomain(domain);
  }

  function getCloudModelValue(): string {
    const prefs = preferencesStore.getCurrent();
    const pref = prefs.gAgentModelPreference ?? prefs.freeAgentModelPreference;
    if (pref?.provider && pref?.modelId) return `${pref.provider}:${pref.modelId}`;
    return 'nim:moonshotai/kimi-k2.5';
  }

  function applyCapabilityPreset(preset: 'safe' | 'standard' | 'full' | 'autonomous') {
    const safe: GAgentCapabilityKey[] = ['file', 'git', 'bash'];
    const standard: GAgentCapabilityKey[] = [
      'file',
      'git',
      'bash',
      'npm',
      'docker',
      'webhooks',
      'heartbeats',
    ];
    const full: GAgentCapabilityKey[] = CAPABILITY_KEYS.filter(
      (k) => !['task_planning', 'memory', 'self_improve'].includes(k)
    );
    const autonomous: GAgentCapabilityKey[] = CAPABILITY_KEYS;
    const cap =
      preset === 'safe'
        ? safe
        : preset === 'standard'
          ? standard
          : preset === 'autonomous'
            ? autonomous
            : full;
    preferencesStore.setGAgentCapabilities(cap);
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
  subtitle="Autonomous agent: plans tasks, uses tools, and learns over time. Docker recommended for sandboxing."
  onBack={handleBack}
>
  <p class="intro-line">
    What is G-Agent? An AI that runs goals in the background, uses your tools (files, git, Docker, etc.), and remembers patterns. Open from chat header or <kbd>Ctrl</kbd>+<kbd>K</kbd>.
  </p>
  <h3 class="block-heading">Status</h3>
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
        {runMode === 'docker' ? 'Docker (recommended)' : runMode === 'local' ? 'Local' : 'Unknown'}
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

  <!-- MCP Servers (connected tools for G-Agent) -->
  <div class="gagent-section mcp-section">
    <div class="section-header mcp-section-header">
      <div class="section-header-left">
        <Puzzle width={20} height={20} strokeWidth={2} />
        <h3 class="section-title">MCP servers</h3>
      </div>
      <p class="section-desc">
        Tools G-Agent can use from your configured MCP servers. Add and manage in Settings → Integrations.
      </p>
      <button type="button" class="mcp-settings-link" onclick={handleOpenSettingsMcp}>
        <Settings width={16} height={16} strokeWidth={2} />
        Manage in Settings
      </button>
    </div>
    <div class="section-content mcp-section-content">
      {#if mcpServers.length === 0}
        <p class="mcp-empty">No MCP servers configured. Add one in Settings → Integrations to let G-Agent use external tools.</p>
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
  </div>

  <!-- Goal Queue Section (primary) -->
  <div class="gagent-section goal-queue-section">
    <div class="section-header">
      <div class="section-header-left">
        <Target width={20} height={20} strokeWidth={2} />
        <h3 class="section-title">Goal Queue</h3>
      </div>
      <p class="section-desc">
        Tasks G-Agent runs in the background. Add goals here; the agent works on them even when you're away.
      </p>
    </div>
    <div class="section-content goal-queue-container">
      <GAgentGoalQueue workspaceRoot={undefined} />
    </div>
  </div>

  <!-- Memory Section (primary) -->
  <div class="gagent-section memory-section">
    <div class="section-header">
      <div class="section-header-left">
        <Brain width={20} height={20} strokeWidth={2} />
        <h3 class="section-title">Agent Memory</h3>
      </div>
      <p class="section-desc">
        Patterns and skills G-Agent has learned from past runs. Use this to see what it remembers.
      </p>
    </div>
    <div class="section-content memory-container">
      <GAgentMemoryPanel compact={false} />
    </div>
  </div>

  <!-- Quick actions -->
  <div class="quick-actions">
    <h3 class="section-title">Quick actions</h3>
    <div class="actions-row">
      <button type="button" class="action-btn" onclick={handleOpenChat}>
        <MessageCircle width={20} height={20} strokeWidth={2} />
        <span>Chat</span>
      </button>
      <button type="button" class="action-btn primary" onclick={handleOpenShip}>
        <Rocket width={20} height={20} strokeWidth={2} />
        <span>SHIP</span>
      </button>
    </div>
  </div>

  <!-- Model preference (secondary) -->
  <details class="secondary-block" open>
    <summary class="block-heading">Model preference</summary>
    <div class="model-preference-section">
    <p class="section-desc">
      Where G-Agent runs: local Ollama (no API cost) or cloud models.
    </p>
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
  </details>

  <!-- Capabilities (secondary) -->
  <details class="secondary-block">
    <summary class="block-heading">Capabilities</summary>
  <div class="capabilities-section">
    <div class="info-icon">
      <AlertTriangle width={20} height={20} strokeWidth={2} />
    </div>
    <div class="info-body">
      <h4 class="info-title">G-Agent runs best in Docker</h4>
      <p class="info-desc">
        Docker provides sandboxing and isolation. If you run locally, the AI has full access to your
        system. Use the Docker setup wizard to get started.
      </p>
      <div class="info-actions">
        <button type="button" class="info-action" onclick={handleOpenDockerSetup}>
          Open Docker Setup
        </button>
        {#if !dockerDetected}
          <button type="button" class="info-skip" onclick={() => runModeStore.set('local')}>
            Continue without Docker (not recommended)
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Capabilities -->
  <div class="capabilities-section">
    <h3 class="section-title">Capabilities</h3>
    <p class="section-desc">
      Choose which tool categories G-Agent can use. Disabled categories are not available in G-Agent
      sessions.
    </p>
    <div class="capability-presets">
      <button type="button" class="preset-btn" onclick={() => applyCapabilityPreset('safe')}
        >Safe</button
      >
      <button type="button" class="preset-btn" onclick={() => applyCapabilityPreset('standard')}
        >Standard</button
      >
      <button type="button" class="preset-btn" onclick={() => applyCapabilityPreset('full')}
        >Full</button
      >
      <button
        type="button"
        class="preset-btn autonomous"
        onclick={() => applyCapabilityPreset('autonomous')}>Autonomous</button
      >
    </div>
    <p class="preset-hint">
      Safe: file, git, bash. Standard: + Docker, webhooks. Full: all standard caps. Autonomous: +
      planning, memory, self-improvement.
    </p>
    <div class="capabilities-grid">
      {#each CAPABILITY_KEYS as key}
        <label class="capability-toggle">
          <input
            type="checkbox"
            checked={isCapabilityEnabled(key)}
            onchange={() => toggleCapability(key)}
          />
          <span class="capability-label">{CAPABILITY_LABELS[key]}</span>
        </label>
      {/each}
    </div>
    <p class="section-hint">See docs for more capabilities and tool details.</p>
  </div>
  </details>

  <!-- External APIs allowlist -->
  <details class="secondary-block">
    <summary class="block-heading">External APIs</summary>
  <div class="allowlist-section">
    <h3 class="section-title">External APIs</h3>
    <p class="section-desc">
      G-Agent can only call external URLs whose host is listed here. Add domains you trust (e.g.
      api.example.com).
    </p>
    <div class="allowlist-input-row">
      <input
        type="text"
        class="allowlist-input"
        placeholder="api.example.com"
        bind:value={newDomain}
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
      />
      <button
        type="button"
        class="allowlist-add"
        onclick={addDomain}
        disabled={!newDomain.trim()}
        aria-label="Add domain"
      >
        <Plus width={18} height={18} strokeWidth={2} />
      </button>
    </div>
    {#if allowlist.length > 0}
      <ul class="allowlist-list">
        {#each allowlist as domain}
          <li class="allowlist-item">
            <span class="allowlist-domain">{domain}</span>
            <button
              type="button"
              class="allowlist-remove"
              onclick={() => removeDomain(domain)}
              aria-label="Remove {domain}"
            >
              <X width={14} height={14} strokeWidth={2} />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="allowlist-empty">
        No domains added. Add domains to allow G-Agent to call external APIs.
      </p>
    {/if}
  </div>
  </details>

  <!-- Docker-first messaging -->
  <div class="info-box">
    <div class="info-icon">
      <AlertTriangle width={20} height={20} strokeWidth={2} />
    </div>
    <div class="info-body">
      <h4 class="info-title">G-Agent runs best in Docker</h4>
      <p class="info-desc">
        Docker provides sandboxing and isolation. If you run locally, the AI has full access to your
        system. Use the Docker setup wizard to get started.
      </p>
      <div class="info-actions">
        <button type="button" class="info-action" onclick={handleOpenDockerSetup}>
          Open Docker Setup
        </button>
        {#if !dockerDetected}
          <button type="button" class="info-skip" onclick={() => runModeStore.set('local')}>
            Continue without Docker (not recommended)
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Local option warning -->
  {#if runMode === 'local'}
    <div class="local-warning">
      <p>
        <strong>Running locally:</strong> You've chosen to run without Docker. The AI has full access
        to your system. Use Docker for sandboxing and security.
      </p>
    </div>
  {/if}
</ScreenLayout>

<style>
  .pathway-hint {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 1rem 0;
  }

  .pathway-hint kbd {
    padding: 0.125rem 0.375rem;
    font-size: 0.75rem;
    background: var(--color-bg-subtle);
    border-radius: 4px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .status-card {
    padding: 1.25rem;
    background: white;
    border: 1px solid #e9d5ff;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.06);
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #f5f3ff;
    color: #7c3aed;
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
    background: white;
    border: 1px solid #e9d5ff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.06);
  }

  .info-icon {
    flex-shrink: 0;
    color: var(--color-warning, #ff9500);
  }

  .info-body {
    flex: 1;
    min-width: 0;
  }

  .info-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.5rem 0;
  }

  .info-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .info-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .info-action {
    padding: 8px 16px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    background: var(--color-primary);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .info-action:hover {
    background: var(--color-primary-hover);
  }

  .info-skip {
    padding: 6px 12px;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .info-skip:hover {
    color: var(--color-text);
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

  .section-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0.5rem 0 0 0;
  }

  .capabilities-section,
  .allowlist-section,
  .model-preference-section {
    margin-bottom: 2rem;
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

  .capability-presets {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .preset-btn {
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: var(--color-bg-card);
    border-color: var(--color-border-highlight);
  }

  .preset-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem 0;
  }

  .capabilities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .capability-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--color-text);
    cursor: pointer;
  }

  .capability-toggle input {
    cursor: pointer;
  }

  .capability-label {
    user-select: none;
  }

  .allowlist-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 0.75rem;
  }

  .allowlist-input {
    flex: 1;
    max-width: 280px;
    padding: 8px 12px;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-card);
    color: var(--color-text);
  }

  .allowlist-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .allowlist-add:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .allowlist-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .allowlist-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .allowlist-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    margin-bottom: 4px;
    font-size: 0.875rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .allowlist-domain {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .allowlist-remove {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .allowlist-remove:hover {
    background: var(--color-error-light, rgba(239, 68, 68, 0.15));
    color: var(--color-error);
  }

  .allowlist-empty {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .actions-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-bg-card);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    border-color: var(--color-border-highlight);
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.06));
  }

  .action-btn.primary {
    color: white;
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  .action-btn.primary:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .local-warning {
    padding: 1rem;
    background: rgba(255, 149, 0, 0.1);
    border: 1px solid var(--color-warning, #ff9500);
    border-radius: var(--radius-md);
  }

  .local-warning p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text);
  }

  /* G-Agent Sections */
  .gagent-section {
    margin-bottom: 2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .section-header {
    padding: 1rem 1.25rem;
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0.5rem;
  }

  .section-header-left .section-title {
    margin: 0;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .section-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .section-content {
    background: var(--color-bg-card);
  }

  .goal-queue-container,
  .memory-container {
    height: 400px;
    overflow: hidden;
  }

  .mcp-section-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
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
    background: #fef2f2;
    color: #b91c1c;
  }
</style>
