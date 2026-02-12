<script lang="ts">
  /**
   * AgentConfigPanel – Left sidebar with model selector, agent settings,
   * integrations/MCPs/skills/memory tabs, autonomy level, and channel setup.
   * Extracted from AgentScreen.svelte.
   */
  import { get } from 'svelte/store';
  import { Button, Card, Badge, Toggle, Spinner } from '../../lib/design-system';
  import {
    Bot,
    Plug2,
    Server,
    BookOpen,
    Brain,
    Hash,
    Plus,
    Trash2,
    Settings2,
    ChevronDown,
    ChevronUp,
    Shield,
    Zap,
    Activity,
    DollarSign,
    Thermometer,
    Repeat,
    FileText,
    Folder,
    Lock,
    User,
    Database,
    Maximize2,
  } from 'lucide-svelte';
  import {
    autonomyLevel,
    AUTONOMY_LEVELS,
    type AutonomyLevel,
  } from '../../stores/gAgentConfigStore';
  import { gAgentConfigStore } from '../../stores/gAgentConfigStore';
  import { settingsStore } from '../../stores/settingsStore';
  import { showToast } from '../../stores/toastStore';
  import { getSkills, type SkillSummary } from '../../lib/api';
  import { listIntegrations, type Integration } from '../../lib/integrationsApi';
  import ModelPicker from '../ModelPicker.svelte';

  // ── Types ─────────────────────────────────────────────────────────────────
  type AgentProfile = 'general' | 'router' | 'frontend' | 'backend' | 'devops' | 'test';
  type ModelPreset = 'fast' | 'balanced' | 'quality';

  interface AgentChannel {
    id: string;
    type: 'slack' | 'discord' | 'github' | 'webhook';
    name: string;
    enabled: boolean;
    config: string;
  }

  const AGENT_PROFILES: { value: AgentProfile; label: string; description: string }[] = [
    { value: 'general', label: 'General', description: 'All-purpose coding assistant' },
    { value: 'router', label: 'Router', description: 'Smart task routing & delegation' },
    { value: 'frontend', label: 'Frontend', description: 'UI/UX, React, CSS, Web' },
    { value: 'backend', label: 'Backend', description: 'APIs, databases, services' },
    { value: 'devops', label: 'DevOps', description: 'CI/CD, Docker, K8s, infra' },
    { value: 'test', label: 'Test', description: 'Testing & QA automation' },
  ];

  // ── Props ─────────────────────────────────────────────────────────────────
  interface Props {
    selectedProvider: string;
    selectedModel: string;
    onModelSelect: (provider: string, id: string) => void;
  }
  let { selectedProvider, selectedModel, onModelSelect }: Props = $props();

  // ── Configuration Panel State ─────────────────────────────────────────────
  let integrations = $state<Integration[]>([]);
  let skills = $state<SkillSummary[]>([]);
  let loadingConfig = $state(true);

  let enabledIntegrations = $state<Record<string, boolean>>({});
  let enabledMcps = $state<Record<string, boolean>>({});
  let enabledSkills = $state<Record<string, boolean>>({});
  let memoryEnabled = $state(true);

  let mcpServers = $state<Array<{ id: string; name: string; enabled: boolean }>>([]);

  // ── Agent Settings ────────────────────────────────────────────────────────
  let budgetLimit = $state<number>(10);
  let maxTurns = $state<number>(25);
  let temperature = $state<number>(0.7);
  let systemPrompt = $state<string>('');
  let showSystemPrompt = $state<boolean>(false);
  let workspaceRoot = $state<string>('');
  let toolAllowlist = $state<string[]>([]);
  let toolDenylist = $state<string[]>([]);
  let allowedDirs = $state<string[]>([]);
  let newAllowedDir = $state<string>('');
  let agentProfile = $state<AgentProfile>('general');
  let includeRagContext = $state<boolean>(false);
  let modelPreset = $state<ModelPreset>('balanced');
  let largeContextMode = $state<boolean>(false);

  // ── Channels ──────────────────────────────────────────────────────────────
  let channelsExpanded = $state(false);
  let channels = $state<AgentChannel[]>([]);
  let newChannelType = $state<AgentChannel['type']>('slack');
  let newChannelName = $state('');
  let newChannelConfig = $state('');

  // ── Config Tab ────────────────────────────────────────────────────────────
  let configTab = $state<'models' | 'settings' | 'integrations' | 'mcps' | 'skills' | 'memory'>(
    'models'
  );

  // ── Public API (called by parent via bind:this) ───────────────────────────
  export function getEnabledSkillIds(): string[] {
    return Object.entries(enabledSkills)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  /** Returns a snapshot of all config values the chat panel needs */
  export function getConfig() {
    return {
      memoryEnabled,
      temperature,
      maxTurns,
      budgetLimit,
      systemPrompt,
      workspaceRoot,
      toolAllowlist,
      toolDenylist,
      allowedDirs,
      agentProfile,
      includeRagContext,
      modelPreset,
      largeContextMode,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  export async function initialize(): Promise<void> {
    // Load channels from localStorage
    try {
      const saved = localStorage.getItem('grump_agent_channels');
      if (saved) channels = JSON.parse(saved);
    } catch {
      /* ignore */
    }

    loadingConfig = true;
    try {
      const [intResult, skillResult] = await Promise.allSettled([listIntegrations(), getSkills()]);

      if (intResult.status === 'fulfilled') {
        integrations = intResult.value;
        for (const i of integrations) {
          enabledIntegrations[i.id] = i.status === 'active';
        }
      }

      if (skillResult.status === 'fulfilled') {
        skills = skillResult.value;
        for (const s of skills) {
          enabledSkills[s.id] = true;
        }
      }

      const settings = get(settingsStore);
      mcpServers = (settings?.mcp?.servers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled ?? true,
      }));
      for (const m of mcpServers) {
        enabledMcps[m.id] = m.enabled;
      }
    } catch (e) {
      console.error('Failed to load agent config:', e);
    } finally {
      loadingConfig = false;
    }
  }

  // ── Settings Helpers ──────────────────────────────────────────────────────
  function addAllowedDir() {
    if (newAllowedDir.trim() && !allowedDirs.includes(newAllowedDir.trim())) {
      allowedDirs = [...allowedDirs, newAllowedDir.trim()];
      newAllowedDir = '';
    }
  }

  function removeAllowedDir(index: number) {
    allowedDirs = allowedDirs.filter((_, i) => i !== index);
  }

  function setModelPreset(preset: ModelPreset) {
    modelPreset = preset;
    switch (preset) {
      case 'fast':
        temperature = 0.5;
        break;
      case 'balanced':
        temperature = 0.7;
        break;
      case 'quality':
        temperature = 0.9;
        break;
    }
  }

  // ── Channel Management ────────────────────────────────────────────────────
  function saveChannels() {
    localStorage.setItem('grump_agent_channels', JSON.stringify(channels));
  }

  function addChannel() {
    if (!newChannelName.trim()) return;
    const channel: AgentChannel = {
      id: `ch-${Date.now()}`,
      type: newChannelType,
      name: newChannelName.trim(),
      enabled: true,
      config: newChannelConfig.trim(),
    };
    channels = [...channels, channel];
    newChannelName = '';
    newChannelConfig = '';
    saveChannels();
    showToast('Channel added', 'success');
  }

  function removeChannel(id: string) {
    channels = channels.filter((c) => c.id !== id);
    saveChannels();
  }

  function toggleChannel(id: string) {
    channels = channels.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
    saveChannels();
  }

  function getChannelIcon(type: AgentChannel['type']): string {
    switch (type) {
      case 'slack':
        return '💬';
      case 'discord':
        return '🎮';
      case 'github':
        return '🐙';
      case 'webhook':
        return '🔗';
      default:
        return '📡';
    }
  }

  function getIntegrationLabel(i: Integration): string {
    return i.displayName ?? i.provider;
  }
</script>

<aside class="config-panel">
  <!-- Model Selector -->
  <Card padding="sm">
    <div class="config-section-header">
      <Bot size={16} />
      <span>Model</span>
    </div>

    <!-- Model Preset Quick Selector -->
    <div class="model-presets">
      {#each [{ value: 'fast', label: 'Fast', icon: Zap }, { value: 'balanced', label: 'Balanced', icon: Activity }, { value: 'quality', label: 'Quality', icon: Maximize2 }] as preset}
        <button
          class="model-preset-btn"
          class:active={modelPreset === preset.value}
          onclick={() => setModelPreset(preset.value as ModelPreset)}
          title="{preset.label} preset (T={preset.value === 'fast'
            ? '0.5'
            : preset.value === 'balanced'
              ? '0.7'
              : '0.9'})"
        >
          <preset.icon size={12} />
          <span>{preset.label}</span>
        </button>
      {/each}
    </div>

    <div class="model-picker-wrapper">
      <ModelPicker
        value={selectedProvider && selectedModel ? `${selectedProvider}:${selectedModel}` : 'auto'}
        onSelect={(provider, modelId) => {
          if (provider && modelId) {
            onModelSelect(provider, modelId);
          }
        }}
        embedded={true}
        showAuto={true}
      />
    </div>
  </Card>

  <!-- Agent Settings -->
  <Card padding="sm">
    <button
      class="config-section-header clickable"
      onclick={() => (showSystemPrompt = !showSystemPrompt)}
    >
      <Settings2 size={16} />
      <span>Settings</span>
      <span class="chevron">
        {#if showSystemPrompt}
          <ChevronUp size={14} />
        {:else}
          <ChevronDown size={14} />
        {/if}
      </span>
    </button>

    {#if showSystemPrompt}
      <div class="settings-content">
        <!-- Budget Limit -->
        <div class="setting-row">
          <label class="setting-label">
            <DollarSign size={12} />
            <span>Budget Limit</span>
          </label>
          <div class="setting-control">
            <input
              type="number"
              class="setting-input number"
              bind:value={budgetLimit}
              min="0"
              max="1000"
              step="1"
            />
            <span class="setting-unit">$</span>
          </div>
        </div>

        <!-- Max Turns -->
        <div class="setting-row">
          <label class="setting-label">
            <Repeat size={12} />
            <span>Max Turns</span>
          </label>
          <div class="setting-control">
            <input type="range" class="setting-slider" bind:value={maxTurns} min="1" max="100" />
            <span class="setting-value">{maxTurns}</span>
          </div>
        </div>

        <!-- Temperature -->
        <div class="setting-row">
          <label class="setting-label">
            <Thermometer size={12} />
            <span>Temperature</span>
          </label>
          <div class="setting-control">
            <input
              type="range"
              class="setting-slider"
              bind:value={temperature}
              min="0"
              max="2"
              step="0.1"
            />
            <span class="setting-value">{temperature.toFixed(1)}</span>
          </div>
        </div>

        <!-- Agent Profile -->
        <div class="setting-row">
          <label class="setting-label">
            <User size={12} />
            <span>Profile</span>
          </label>
          <select class="setting-select" bind:value={agentProfile}>
            {#each AGENT_PROFILES as profile}
              <option value={profile.value}>{profile.label}</option>
            {/each}
          </select>
        </div>
        {#if agentProfile !== 'general'}
          <div class="setting-description">
            {AGENT_PROFILES.find((p) => p.value === agentProfile)?.description}
          </div>
        {/if}

        <!-- System Prompt -->
        <div class="setting-row stacked">
          <label class="setting-label">
            <FileText size={12} />
            <span>System Instructions</span>
          </label>
          <textarea
            class="setting-textarea"
            bind:value={systemPrompt}
            placeholder="Add custom instructions for the agent..."
            rows="3"
          ></textarea>
        </div>

        <!-- Workspace Root -->
        <div class="setting-row stacked">
          <label class="setting-label">
            <Folder size={12} />
            <span>Workspace Root</span>
          </label>
          <input
            type="text"
            class="setting-input"
            bind:value={workspaceRoot}
            placeholder="/path/to/workspace"
          />
        </div>

        <!-- Guardrails - Allowed Directories -->
        <div class="setting-row stacked">
          <label class="setting-label">
            <Lock size={12} />
            <span>Allowed Directories</span>
          </label>
          <div class="allowed-dirs-list">
            {#each allowedDirs as dir, i}
              <div class="allowed-dir-item">
                <span class="dir-path">{dir}</span>
                <button class="dir-remove" onclick={() => removeAllowedDir(i)} title="Remove">
                  <Trash2 size={12} />
                </button>
              </div>
            {/each}
            <div class="add-dir-row">
              <input
                type="text"
                class="setting-input"
                bind:value={newAllowedDir}
                placeholder="/allowed/path"
                onkeydown={(e) => {
                  if (e.key === 'Enter') addAllowedDir();
                }}
              />
              <button class="dir-add-btn" onclick={addAllowedDir} disabled={!newAllowedDir.trim()}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <!-- RAG Context Toggle -->
        <div class="setting-row toggle">
          <label class="setting-label">
            <Database size={12} />
            <span>Include RAG Context</span>
          </label>
          <Toggle
            checked={includeRagContext}
            onchange={() => (includeRagContext = !includeRagContext)}
          />
        </div>
        <div class="setting-row toggle">
          <label class="setting-label">
            <Maximize2 size={12} />
            <span>Large Context Mode</span>
          </label>
          <Toggle
            checked={largeContextMode}
            onchange={() => (largeContextMode = !largeContextMode)}
          />
        </div>
      </div>
    {/if}
  </Card>

  <!-- Autonomy Level -->
  <Card padding="sm">
    <div class="config-section-header">
      <Shield size={16} />
      <span>Autonomy: <strong>{$autonomyLevel}</strong></span>
    </div>
    <div class="autonomy-levels">
      {#each AUTONOMY_LEVELS as level}
        <button
          class="autonomy-option"
          class:active={$autonomyLevel === level.value}
          onclick={() => gAgentConfigStore.setAutonomyLevel(level.value)}
        >
          <span class="autonomy-label">{level.label}</span>
        </button>
      {/each}
    </div>
  </Card>

  <!-- Config Tabs: Integrations / MCPs / Skills / Memory -->
  <Card padding="sm">
    <div class="config-tabs">
      <button
        class="config-tab"
        class:active={configTab === 'integrations'}
        onclick={() => (configTab = 'integrations')}
      >
        <Plug2 size={14} />
        Integrations
      </button>
      <button
        class="config-tab"
        class:active={configTab === 'mcps'}
        onclick={() => (configTab = 'mcps')}
      >
        <Server size={14} />
        MCPs
      </button>
      <button
        class="config-tab"
        class:active={configTab === 'skills'}
        onclick={() => (configTab = 'skills')}
      >
        <BookOpen size={14} />
        Skills
      </button>
      <button
        class="config-tab"
        class:active={configTab === 'memory'}
        onclick={() => (configTab = 'memory')}
      >
        <Brain size={14} />
        Memory
      </button>
    </div>

    <div class="config-tab-content">
      {#if loadingConfig}
        <div class="config-loading">
          <Spinner size="sm" />
          <span>Loading…</span>
        </div>
      {:else if configTab === 'integrations'}
        {#if integrations.length === 0}
          <div class="config-empty">
            <Plug2 size={24} />
            <p>No integrations configured</p>
          </div>
        {:else}
          <div class="config-list">
            {#each integrations as integration}
              <div class="config-item">
                <div class="config-item-info">
                  <span class="config-item-name">{getIntegrationLabel(integration)}</span>
                </div>
                <Toggle
                  checked={enabledIntegrations[integration.id] ?? false}
                  onchange={() =>
                    (enabledIntegrations[integration.id] = !enabledIntegrations[integration.id])}
                />
              </div>
            {/each}
          </div>
        {/if}
      {:else if configTab === 'mcps'}
        {#if mcpServers.length === 0}
          <div class="config-empty">
            <Server size={24} />
            <p>No MCP servers configured</p>
          </div>
        {:else}
          <div class="config-list">
            {#each mcpServers as server}
              <div class="config-item">
                <div class="config-item-info">
                  <span class="config-item-name">{server.name}</span>
                </div>
                <Toggle
                  checked={enabledMcps[server.id] ?? false}
                  onchange={() => (enabledMcps[server.id] = !enabledMcps[server.id])}
                />
              </div>
            {/each}
          </div>
        {/if}
      {:else if configTab === 'skills'}
        {#if skills.length === 0}
          <div class="config-empty">
            <BookOpen size={24} />
            <p>No skills loaded</p>
          </div>
        {:else}
          <div class="config-list">
            {#each skills as skill}
              <div class="config-item">
                <div class="config-item-info">
                  <span class="config-item-name">{skill.name}</span>
                  {#if skill.description}
                    <span class="config-item-desc">{skill.description}</span>
                  {/if}
                </div>
                <Toggle
                  checked={enabledSkills[skill.id] ?? false}
                  onchange={() => (enabledSkills[skill.id] = !enabledSkills[skill.id])}
                />
              </div>
            {/each}
          </div>
        {/if}
      {:else if configTab === 'memory'}
        <div class="config-item memory-toggle">
          <div class="config-item-info">
            <span class="config-item-name">Memory Access</span>
            <span class="config-item-desc"
              >Allow the Agent to read and write to your memory store</span
            >
          </div>
          <Toggle checked={memoryEnabled} onchange={() => (memoryEnabled = !memoryEnabled)} />
        </div>
      {/if}
    </div>
  </Card>

  <!-- Channel Setup (collapsible) -->
  <Card padding="sm">
    <button
      class="config-section-header clickable"
      onclick={() => (channelsExpanded = !channelsExpanded)}
    >
      <Hash size={16} />
      <span>Channels</span>
      <Badge variant="default">{channels.length}</Badge>
      <span class="chevron">
        {#if channelsExpanded}
          <ChevronUp size={14} />
        {:else}
          <ChevronDown size={14} />
        {/if}
      </span>
    </button>

    {#if channelsExpanded}
      <div class="channels-content">
        {#if channels.length === 0}
          <p class="channels-empty">No channels configured. Add one below.</p>
        {:else}
          <div class="channels-list">
            {#each channels as channel}
              <div class="channel-item">
                <span class="channel-icon">{getChannelIcon(channel.type)}</span>
                <div class="channel-info">
                  <span class="channel-name">{channel.name}</span>
                  <span class="channel-type">{channel.type} · {channel.config || 'No config'}</span>
                </div>
                <Toggle checked={channel.enabled} onchange={() => toggleChannel(channel.id)} />
                <button
                  class="channel-remove"
                  onclick={() => removeChannel(channel.id)}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Add Channel Form -->
        <div class="add-channel-form">
          <select class="channel-type-select" bind:value={newChannelType}>
            <option value="slack">Slack</option>
            <option value="discord">Discord</option>
            <option value="github">GitHub</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            type="text"
            class="channel-input"
            placeholder="Channel name"
            bind:value={newChannelName}
          />
          <input
            type="text"
            class="channel-input"
            placeholder={newChannelType === 'webhook' ? 'Webhook URL' : 'Channel ID'}
            bind:value={newChannelConfig}
          />
          <Button
            variant="secondary"
            size="sm"
            onclick={addChannel}
            disabled={!newChannelName.trim()}
          >
            <Plus size={14} />
            Add
          </Button>
        </div>
      </div>
    {/if}
  </Card>
</aside>

<style>
  .config-panel {
    width: 320px;
    min-width: 280px;
    border-right: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--color-bg-subtle, rgba(15, 15, 25, 0.5));
  }

  .config-section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #f0f0f5);
    margin-bottom: 0.5rem;
  }

  .config-section-header.clickable {
    cursor: pointer;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    margin-bottom: 0;
  }

  .config-section-header .chevron {
    margin-left: auto;
    color: var(--color-text-muted, #8b8b9a);
  }

  /* Model */
  .model-picker-wrapper {
    max-height: 280px;
    overflow-y: auto;
  }

  .model-picker-wrapper :global(.model-picker-dropdown) {
    position: static;
    box-shadow: none;
    border: none;
    min-width: 100%;
    max-height: 240px;
  }

  .model-presets {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .model-preset-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.6875rem;
    font-weight: 500;
    transition: all 0.15s ease;
    flex: 1;
    justify-content: center;
  }

  .model-preset-btn:hover {
    border-color: rgba(124, 58, 237, 0.3);
    color: var(--color-text, #f0f0f5);
  }

  .model-preset-btn.active {
    background: rgba(124, 58, 237, 0.12);
    border-color: rgba(124, 58, 237, 0.4);
    color: var(--color-primary, #7c3aed);
  }

  /* Autonomy */
  .autonomy-levels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.375rem;
  }

  .autonomy-option {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.75rem;
    transition: all 0.15s ease;
  }

  .autonomy-option:hover {
    border-color: rgba(124, 58, 237, 0.3);
  }

  .autonomy-option.active {
    background: rgba(124, 58, 237, 0.12);
    border-color: rgba(124, 58, 237, 0.4);
    color: var(--color-primary, #7c3aed);
  }

  .autonomy-label {
    font-weight: 500;
  }

  /* Config Tabs */
  .config-tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    padding-bottom: 0.5rem;
  }

  .config-tab {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.6875rem;
    font-weight: 500;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .config-tab:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .config-tab.active {
    background: rgba(124, 58, 237, 0.12);
    color: var(--color-primary, #7c3aed);
  }

  .config-tab-content {
    max-height: 240px;
    overflow-y: auto;
  }

  .config-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    padding: 1.5rem;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.8125rem;
  }

  .config-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.8125rem;
  }

  .config-empty :global(svg) {
    opacity: 0.4;
  }

  .config-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .config-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.625rem;
    border-radius: 8px;
    transition: background 0.15s;
  }

  .config-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .config-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  .config-item-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #f0f0f5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .config-item-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .memory-toggle {
    padding: 1rem 0.625rem;
  }

  /* Channels */
  .channels-content {
    margin-top: 0.75rem;
  }

  .channels-empty {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #8b8b9a);
    text-align: center;
    padding: 0.75rem;
    margin: 0;
  }

  .channels-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .channel-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .channel-icon {
    font-size: 1rem;
  }
  .channel-info {
    flex: 1;
    min-width: 0;
  }
  .channel-name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #f0f0f5);
  }
  .channel-type {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .channel-remove {
    padding: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    border-radius: 4px;
    transition: color 0.15s;
  }

  .channel-remove:hover {
    color: var(--color-error, #ef4444);
  }

  .add-channel-form {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .channel-type-select,
  .channel-input {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: var(--color-bg-card, #1a1a2e);
    color: var(--color-text, #f0f0f5);
    font-size: 0.75rem;
  }

  .channel-type-select {
    width: 90px;
  }
  .channel-input {
    flex: 1;
    min-width: 80px;
  }

  /* Settings */
  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .setting-row.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .setting-row.toggle {
    justify-content: space-between;
  }

  .setting-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #8b8b9a);
    flex-shrink: 0;
  }

  .setting-control {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
    justify-content: flex-end;
  }

  .setting-input {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: var(--color-bg-card, #1a1a2e);
    color: var(--color-text, #f0f0f5);
    font-size: 0.75rem;
    width: 100%;
  }

  .setting-input.number {
    width: 60px;
    text-align: right;
  }
  .setting-unit {
    font-size: 0.75rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .setting-value {
    font-size: 0.75rem;
    color: var(--color-primary, #7c3aed);
    font-weight: 500;
    min-width: 2rem;
    text-align: right;
  }

  .setting-slider {
    flex: 1;
    max-width: 100px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    outline: none;
  }

  .setting-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-primary, #7c3aed);
    cursor: pointer;
  }

  .setting-select {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: var(--color-bg-card, #1a1a2e);
    color: var(--color-text, #f0f0f5);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .setting-textarea {
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: var(--color-bg-card, #1a1a2e);
    color: var(--color-text, #f0f0f5);
    font-size: 0.75rem;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
  }

  .setting-description {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #8b8b9a);
    margin-top: -0.25rem;
    margin-left: 1rem;
  }

  .allowed-dirs-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .allowed-dir-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .dir-path {
    color: var(--color-text, #f0f0f5);
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dir-remove {
    padding: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    border-radius: 4px;
    transition: color 0.15s;
  }

  .dir-remove:hover {
    color: var(--color-error, #ef4444);
  }

  .add-dir-row {
    display: flex;
    gap: 0.375rem;
  }

  .dir-add-btn {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--color-bg-card, #1a1a2e);
    color: var(--color-primary, #7c3aed);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dir-add-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .config-panel {
      width: 100%;
      min-width: 0;
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    }
  }
</style>
