<script lang="ts">
  /**
   * AgentScreen – Dedicated full-page Agent workspace.
   *
   * Six functional areas, all on one screen:
   *  1. Risk Acknowledgment gate
   *  2. Configuration panel (Integrations, MCPs, Skills, Memory)
   *  3. Model Selector
   *  4. Start / Stop controls
   *  5. Agent Chat panel
   *  6. Channel Setup
   */
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { Button, Card, Badge, Toggle, Spinner, Tabs } from '../lib/design-system';
  import {
    ArrowLeft,
    Bot,
    AlertTriangle,
    Play,
    Square,
    Plug2,
    Server,
    BookOpen,
    Brain,
    Send,
    Hash,
    Webhook,
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
    Wrench,
    Lock,
    User,
    Database,
    ZapOff,
    Maximize2,
  } from 'lucide-svelte';

  // Stores
  import {
    gAgentStore,
    isConnected,
    isGlobalStopActive,
    gAgentStatus,
    goals,
    activeGoals,
  } from '../stores/gAgentStore';
  import { gAgentConfigStore, autonomyLevel, AUTONOMY_LEVELS } from '../stores/gAgentConfigStore';
  import {
    gAgentBudgetStore,
    budgetStatus,
    formattedSessionCost,
    sessionBudgetPercent,
  } from '../stores/gAgentBudgetStore';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';

  // Components
  import ModelPicker from './ModelPicker.svelte';
  import CodeBlock from './chat/CodeBlock.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import DiagramRenderer from './DiagramRenderer.svelte';

  // APIs
  import { getSkills, type SkillSummary } from '../lib/api';
  import { listIntegrations, type Integration } from '../lib/integrationsApi';
  import { streamChat, type ChatStreamEvent } from '../lib/chatStreaming';
  import type { ContentBlock, Message } from '../types';

  // Local message type with id for keying
  interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    timestamp: number;
  }

  // Props
  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  // ─── Risk Acknowledgment Gate ─────────────────────────────────────────────
  const RISK_KEY = 'grump_agent_risk_accepted';
  let riskAccepted = $state(false);

  // ─── Configuration Panel State ────────────────────────────────────────────
  let integrations = $state<Integration[]>([]);
  let skills = $state<SkillSummary[]>([]);
  let loadingConfig = $state(true);

  // Toggles for what the agent can access
  let enabledIntegrations = $state<Record<string, boolean>>({});
  let enabledMcps = $state<Record<string, boolean>>({});
  let enabledSkills = $state<Record<string, boolean>>({});
  let memoryEnabled = $state(true);

  // MCP servers from settings
  let mcpServers = $state<Array<{ id: string; name: string; enabled: boolean }>>([]);

  // ─── Model Selector ───────────────────────────────────────────────────────
  let selectedProvider = $state('');
  let selectedModel = $state('');

  // ─── Agent Settings ───────────────────────────────────────────────────────
  // 3a. Budget Limit Control
  let budgetLimit = $state<number>(10); // Default $10
  
  // 3b. Max Turns
  let maxTurns = $state<number>(25);
  
  // 3c. Temperature
  let temperature = $state<number>(0.7);
  
  // 3d. System Prompt / Custom Instructions
  let systemPrompt = $state<string>('');
  let showSystemPrompt = $state<boolean>(false);
  
  // 3e. Workspace Root
  let workspaceRoot = $state<string>('');
  
  // 3f. Tool Allowlist/Denylist
  let toolAllowlist = $state<string[]>([]);
  let toolDenylist = $state<string[]>([]);
  let showToolConfig = $state<boolean>(false);
  
  // 3g. Guardrails - Allowed Directories
  let allowedDirs = $state<string[]>([]);
  let newAllowedDir = $state<string>('');
  
  // 3h. Agent Profile Selector
  type AgentProfile = 'general' | 'router' | 'frontend' | 'backend' | 'devops' | 'test';
  let agentProfile = $state<AgentProfile>('general');
  const AGENT_PROFILES: { value: AgentProfile; label: string; description: string }[] = [
    { value: 'general', label: 'General', description: 'All-purpose coding assistant' },
    { value: 'router', label: 'Router', description: 'Smart task routing & delegation' },
    { value: 'frontend', label: 'Frontend', description: 'UI/UX, React, CSS, Web' },
    { value: 'backend', label: 'Backend', description: 'APIs, databases, services' },
    { value: 'devops', label: 'DevOps', description: 'CI/CD, Docker, K8s, infra' },
    { value: 'test', label: 'Test', description: 'Testing & QA automation' },
  ];
  
  // 3i. RAG Context Toggle
  let includeRagContext = $state<boolean>(false);
  
  // 3j. Model Preset Quick Selector
  type ModelPreset = 'fast' | 'balanced' | 'quality';
  let modelPreset = $state<ModelPreset>('balanced');
  
  // 3k. Large Context Mode Toggle
  let largeContextMode = $state<boolean>(false);

  // ─── Agent Status ─────────────────────────────────────────────────────────
  let agentRunning = $state(false);
  let starting = $state(false);
  let stopping = $state(false);

  // ─── Chat Panel ───────────────────────────────────────────────────────────
  let chatMessages = $state<AgentMessage[]>([]);
  let chatInput = $state('');
  let chatStreaming = $state(false);
  let chatAbortController = $state<AbortController | null>(null);
  let chatScrollContainer: HTMLDivElement | null = $state(null);

  // ─── Channel Setup ────────────────────────────────────────────────────────
  let channelsExpanded = $state(false);

  interface AgentChannel {
    id: string;
    type: 'slack' | 'discord' | 'github' | 'webhook';
    name: string;
    enabled: boolean;
    config: string; // channel name / webhook URL
  }
  let channels = $state<AgentChannel[]>([]);
  let newChannelType = $state<AgentChannel['type']>('slack');
  let newChannelName = $state('');
  let newChannelConfig = $state('');

  // ─── Config Tab ──────────────────────────────────────────────────────────
  let configTab = $state<'models' | 'settings' | 'integrations' | 'mcps' | 'skills' | 'memory'>('models');

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  onMount(async () => {
    // Check risk acceptance
    riskAccepted = localStorage.getItem(RISK_KEY) === 'true';

    // Load channels from localStorage
    try {
      const saved = localStorage.getItem('grump_agent_channels');
      if (saved) channels = JSON.parse(saved);
    } catch {
      /* ignore */
    }

    // Load model preference
    const savedModel = localStorage.getItem('grump_agent_model');
    if (savedModel) {
      try {
        const parsed = JSON.parse(savedModel);
        selectedProvider = parsed.provider || '';
        selectedModel = parsed.id || '';
      } catch {
        /* ignore */
      }
    }
    if (!selectedModel) {
      // Default to grump auto-routing if no model selected
      selectedProvider = 'grump';
      selectedModel = 'g-compn1-auto';
    }

    // Load all config data
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

      // Load MCP servers
      const settings = get(settingsStore);
      mcpServers = (settings?.mcp?.servers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled ?? true,
      }));
      for (const m of mcpServers) {
        enabledMcps[m.id] = m.enabled;
      }

      // Init agent stores
      await Promise.allSettled([gAgentConfigStore.initialize(), gAgentBudgetStore.fetchStatus()]);
    } catch (e) {
      console.error('Failed to load agent config:', e);
    } finally {
      loadingConfig = false;
    }

    // Connect SSE
    gAgentStore.connect('agent-screen');
  });

  onDestroy(() => {
    gAgentStore.disconnect();
    if (chatAbortController) chatAbortController.abort();
  });

  // ─── Risk Gate Handlers ────────────────────────────────────────────────────
  function acceptRisks() {
    riskAccepted = true;
    localStorage.setItem(RISK_KEY, 'true');
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────
  async function handleStart() {
    starting = true;
    try {
      await gAgentStore.startQueue();
      agentRunning = true;
      showToast('Agent started', 'success');
    } catch (e) {
      showToast('Failed to start agent', 'error');
      console.error(e);
    } finally {
      starting = false;
    }
  }

  async function handleStop() {
    stopping = true;
    try {
      await gAgentStore.emergencyStop('User stopped agent from Agent Screen');
      agentRunning = false;
      showToast('Agent stopped', 'info');
    } catch (e) {
      showToast('Failed to stop agent', 'error');
      console.error(e);
    } finally {
      stopping = false;
    }
  }

  // ─── Model Selection ──────────────────────────────────────────────────────
  function selectModel(provider: string, id: string) {
    selectedProvider = provider;
    selectedModel = id;
    localStorage.setItem('grump_agent_model', JSON.stringify({ provider, id }));
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────
  function scrollToBottom() {
    if (chatScrollContainer) {
      requestAnimationFrame(() => {
        chatScrollContainer!.scrollTop = chatScrollContainer!.scrollHeight;
      });
    }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatStreaming) return;

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    chatMessages = [...chatMessages, userMessage];
    chatInput = '';
    chatStreaming = true;
    scrollToBottom();

    const assistantMessage: AgentMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: [],
      timestamp: Date.now(),
    };
    chatMessages = [...chatMessages, assistantMessage];

    const abortCtrl = new AbortController();
    chatAbortController = abortCtrl;

    try {
      const enabledSkillIds = Object.entries(enabledSkills)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const apiMessages: Message[] = chatMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      const blocks = await streamChat(apiMessages, {
        mode: 'code',
        sessionType: 'gAgent',
        provider: selectedProvider || undefined,
        modelId: selectedModel || undefined,
        signal: abortCtrl.signal,
        enabledSkillIds: enabledSkillIds.length > 0 ? enabledSkillIds : undefined,
        memoryContext: memoryEnabled ? undefined : [],
        // New settings from Section 3
        temperature,
        maxTurns,
        budgetLimit,
        systemPrompt: systemPrompt || undefined,
        workspaceRoot: workspaceRoot || undefined,
        toolAllowlist: toolAllowlist.length > 0 ? toolAllowlist : undefined,
        toolDenylist: toolDenylist.length > 0 ? toolDenylist : undefined,
        guardRailOptions: allowedDirs.length > 0 ? { allowedDirs } : undefined,
        agentProfile,
        includeRagContext,
        modelPreset,
        largeContext: largeContextMode,
        onEvent: (event: ChatStreamEvent) => {
          // Update the last assistant message with latest blocks
          chatMessages = chatMessages.map((m, i) =>
            i === chatMessages.length - 1 ? { ...m, content: [...event.blocks] } : m
          );
          scrollToBottom();
        },
      });

      // Final update
      chatMessages = chatMessages.map((m, i) =>
        i === chatMessages.length - 1 ? { ...m, content: blocks } : m
      );
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        chatMessages = chatMessages.map((m, i) =>
          i === chatMessages.length - 1
            ? { ...m, content: [{ type: 'text', content: `❌ Error: ${errMsg}` }] }
            : m
        );
      }
    } finally {
      chatStreaming = false;
      chatAbortController = null;
      scrollToBottom();
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  function stopStreaming() {
    if (chatAbortController) {
      chatAbortController.abort();
      chatAbortController = null;
      chatStreaming = false;
    }
  }

  // ─── Channel Management ───────────────────────────────────────────────────
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

  // ─── Content Block Rendering ──────────────────────────────────────────────
  function renderContentBlock(block: ContentBlock): string {
    if (block.type === 'text') return (block as { content: string }).content || '';
    if (block.type === 'tool_call') return `🔧 Tool: ${(block as { name: string }).name}`;
    if (block.type === 'tool_result') {
      const result = block as { success: boolean; toolName: string };
      return `${result.success ? '✅' : '❌'} ${result.toolName}`;
    }
    return '';
  }

  function getMessageText(content: string | ContentBlock[]): string {
    if (typeof content === 'string') return content;
    return content.map(renderContentBlock).join('\n');
  }

  // ─── Markdown Parsing for Code Blocks ─────────────────────────────────────
  interface ParsedBlock {
    type: 'text' | 'code' | 'mermaid';
    content: string;
    language?: string;
  }

  function parseMarkdownContent(text: string): ParsedBlock[] {
    const blocks: ParsedBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textContent = text.slice(lastIndex, match.index).trim();
        if (textContent) {
          blocks.push({ type: 'text', content: textContent });
        }
      }

      const language = match[1] || 'text';
      const code = match[2].trim();
      
      if (language === 'mermaid') {
        blocks.push({ type: 'mermaid', content: code });
      } else {
        blocks.push({ type: 'code', content: code, language });
      }
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining) {
        blocks.push({ type: 'text', content: remaining });
      }
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', content: text }];
  }

  // ─── Settings Helpers ─────────────────────────────────────────────────────
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
    // Adjust temperature based on preset
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

  // ─── Channel Icon ─────────────────────────────────────────────────────────
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
</script>

<!-- ========================= RISK ACKNOWLEDGMENT GATE ========================= -->
{#if !riskAccepted}
  <div class="risk-gate">
    <div class="risk-card">
      <div class="risk-icon-wrapper">
        <div class="risk-icon">
          <Shield size={48} strokeWidth={1.5} />
        </div>
      </div>

      <h1 class="risk-title">Autonomous Agent</h1>
      <p class="risk-subtitle">Before you proceed, please read and understand the following:</p>

      <div class="risk-items">
        <div class="risk-item">
          <AlertTriangle size={20} />
          <div>
            <strong>File System Access</strong>
            <p>The Agent can create, modify, and delete files in your workspace autonomously.</p>
          </div>
        </div>
        <div class="risk-item">
          <Zap size={20} />
          <div>
            <strong>API Calls & External Services</strong>
            <p>
              The Agent may make external API calls, run commands, and interact with connected
              integrations.
            </p>
          </div>
        </div>
        <div class="risk-item">
          <Activity size={20} />
          <div>
            <strong>Cost Implications</strong>
            <p>
              Autonomous operations consume API tokens. Budget limits are enforced but costs can
              accumulate.
            </p>
          </div>
        </div>
      </div>

      <div class="risk-actions">
        <Button variant="ghost" onclick={onBack}>Go Back</Button>
        <Button variant="primary" onclick={acceptRisks}>
          <Shield size={16} />
          I Understand the Risks — Continue
        </Button>
      </div>
    </div>
  </div>

  <!-- ========================= MAIN AGENT SCREEN ========================= -->
{:else}
  <div class="agent-screen">
    <!-- Header -->
    <header class="agent-header">
      <div class="header-left">
        <Button variant="ghost" size="sm" onclick={onBack}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <div class="header-title">
          <Bot size={24} />
          <h1>Agent</h1>
          {#if $isConnected}
            <Badge variant="success">Connected</Badge>
          {:else}
            <Badge variant="default">Offline</Badge>
          {/if}
        </div>
      </div>

      <div class="header-controls">
        <!-- Budget Info -->
        <div class="budget-pill">
          <span class="budget-label">Session</span>
          <span class="budget-value">{$formattedSessionCost}</span>
        </div>

        <!-- Start / Stop -->
        {#if agentRunning}
          <Button variant="danger" onclick={handleStop} disabled={stopping}>
            <Square size={16} />
            {stopping ? 'Stopping…' : 'Stop Agent'}
          </Button>
        {:else}
          <Button variant="primary" onclick={handleStart} disabled={starting}>
            <Play size={16} />
            {starting ? 'Starting…' : 'Start Agent'}
          </Button>
        {/if}
      </div>
    </header>

    <!-- Main Content: Config Panel + Chat -->
    <div class="agent-body">
      <!-- ═══════════ LEFT: CONFIG PANEL ═══════════ -->
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
                title="{preset.label} preset (T={preset.value === 'fast' ? '0.5' : preset.value === 'balanced' ? '0.7' : '0.9'})"
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
                  selectModel(provider, modelId);
                }
              }}
              embedded={true}
              showAuto={true}
            />
          </div>
        </Card>

        <!-- Agent Settings -->
        <Card padding="sm">
          <div class="config-section-header clickable" onclick={() => showSystemPrompt = !showSystemPrompt}>
            <Settings2 size={16} />
            <span>Settings</span>
            <span class="chevron">
              {#if showSystemPrompt}
                <ChevronUp size={14} />
              {:else}
                <ChevronDown size={14} />
              {/if}
            </span>
          </div>
          
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
                  <input
                    type="range"
                    class="setting-slider"
                    bind:value={maxTurns}
                    min="1"
                    max="100"
                  />
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
                  {AGENT_PROFILES.find(p => p.value === agentProfile)?.description}
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
              <div class="setting-row">
                <label class="setting-label">
                  <Folder size={12} />
                  <span>Workspace</span>
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
                      <button class="dir-remove" onclick={() => removeAllowedDir(i)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  {/each}
                </div>
                <div class="add-dir-row">
                  <input
                    type="text"
                    class="setting-input"
                    bind:value={newAllowedDir}
                    placeholder="Add directory path..."
                    onkeydown={(e) => e.key === 'Enter' && addAllowedDir()}
                  />
                  <button class="dir-add-btn" onclick={addAllowedDir} disabled={!newAllowedDir.trim()}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <!-- RAG Context Toggle -->
              <div class="setting-row toggle">
                <label class="setting-label">
                  <Database size={12} />
                  <span>Include RAG Context</span>
                </label>
                <Toggle checked={includeRagContext} onchange={() => includeRagContext = !includeRagContext} />
              </div>

              <!-- Large Context Mode -->
              <div class="setting-row toggle">
                <label class="setting-label">
                  <Maximize2 size={12} />
                  <span>Large Context Mode</span>
                </label>
                <Toggle checked={largeContextMode} onchange={() => largeContextMode = !largeContextMode} />
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
                title={level.description}
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
                  <p>No integrations connected</p>
                </div>
              {:else}
                <div class="config-list">
                  {#each integrations as integration}
                    <div class="config-item">
                      <span class="config-item-name"
                        >{integration.displayName || integration.provider}</span
                      >
                      <Toggle
                        checked={enabledIntegrations[integration.id] ?? false}
                        onchange={() =>
                          (enabledIntegrations[integration.id] =
                            !enabledIntegrations[integration.id])}
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
                      <span class="config-item-name">{server.name}</span>
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
                        <span class="channel-type"
                          >{channel.type} · {channel.config || 'No config'}</span
                        >
                      </div>
                      <Toggle
                        checked={channel.enabled}
                        onchange={() => toggleChannel(channel.id)}
                      />
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

      <!-- ═══════════ RIGHT: CHAT PANEL ═══════════ -->
      <main class="chat-panel">
        {#if chatMessages.length === 0}
          <div class="chat-empty">
            <div class="chat-empty-icon">
              <Bot size={48} strokeWidth={1.5} />
            </div>
            <h2>Agent Chat</h2>
            <p>Send a message to start a conversation with your autonomous agent.</p>
            <p class="chat-hint">
              The agent uses the model, skills, and integrations you've configured on the left.
            </p>
          </div>
        {:else}
          <div class="chat-messages" bind:this={chatScrollContainer}>
            {#each chatMessages as message (message.id)}
              <div class="chat-bubble {message.role}">
                <div class="bubble-header">
                  {#if message.role === 'user'}
                    <span class="bubble-role">You</span>
                  {:else}
                    <Bot size={14} />
                    <span class="bubble-role">Agent</span>
                  {/if}
                </div>
                <div class="bubble-content">
                  {#if typeof message.content === 'string'}
                    <!-- Parse markdown content for code blocks -->
                    {#each parseMarkdownContent(message.content) as parsedBlock}
                      {#if parsedBlock.type === 'text'}
                        <p class="chat-text">{parsedBlock.content}</p>
                      {:else if parsedBlock.type === 'code'}
                        <CodeBlock code={parsedBlock.content} language={parsedBlock.language || 'text'} />
                      {:else if parsedBlock.type === 'mermaid'}
                        <DiagramRenderer code={parsedBlock.content} compact={true} />
                      {/if}
                    {/each}
                  {:else if Array.isArray(message.content)}
                    {#each message.content as block}
                      {#if block.type === 'text'}
                        <!-- Parse markdown in text blocks for code -->
                        {#each parseMarkdownContent((block as { content: string }).content || '') as parsedBlock}
                          {#if parsedBlock.type === 'text'}
                            <p class="chat-text">{parsedBlock.content}</p>
                          {:else if parsedBlock.type === 'code'}
                            <CodeBlock code={parsedBlock.content} language={parsedBlock.language || 'text'} />
                          {:else if parsedBlock.type === 'mermaid'}
                            <DiagramRenderer code={parsedBlock.content} compact={true} />
                          {/if}
                        {/each}
                      {:else if block.type === 'code'}
                        <CodeBlock 
                          code={(block as { code: string }).code} 
                          language={(block as { language: string }).language || 'text'} 
                        />
                      {:else if block.type === 'mermaid'}
                        <DiagramRenderer 
                          code={(block as { content: string }).content} 
                          compact={true} 
                        />
                      {:else if block.type === 'tool_call'}
                        <ToolCallCard toolCall={block} />
                      {:else if block.type === 'tool_result'}
                        <ToolResultCard toolResult={block} />
                      {/if}
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}

            {#if chatStreaming}
              <div class="streaming-indicator">
                <Spinner size="sm" />
                <span>Agent is thinking…</span>
                <Button variant="ghost" size="sm" onclick={stopStreaming}>Stop</Button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Chat Input -->
        <div class="chat-input-area">
          <div class="chat-input-wrapper">
            <textarea
              class="chat-textarea"
              placeholder="Message the Agent…"
              bind:value={chatInput}
              onkeydown={handleChatKeydown}
              rows={1}
              disabled={chatStreaming}
            ></textarea>
            <button
              class="send-btn"
              onclick={sendChatMessage}
              disabled={!chatInput.trim() || chatStreaming}
              title="Send"
            >
              <Send size={18} />
            </button>
          </div>
          <div class="chat-input-meta">
            <span class="meta-model">{selectedProvider ? `${selectedProvider}:${selectedModel}` : 'Auto'}</span>
            <span class="meta-dot">·</span>
            <span class="meta-mode">Agent Mode</span>
            {#if temperature !== 0.7}
              <span class="meta-dot">·</span>
              <span class="meta-temp">T={temperature}</span>
            {/if}
            {#if maxTurns !== 25}
              <span class="meta-dot">·</span>
              <span class="meta-turns">{maxTurns} turns</span>
            {/if}
          </div>
        </div>
      </main>
    </div>
  </div>
{/if}

<style>
  /* ═══════════ RISK GATE ═══════════ */
  .risk-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    background: var(--color-bg-app, #0a0a0f);
    background-image: radial-gradient(
      ellipse at center,
      rgba(124, 58, 237, 0.08) 0%,
      transparent 60%
    );
  }

  .risk-card {
    max-width: 520px;
    width: 100%;
    background: var(--color-bg-card, #141420);
    border: 1px solid var(--color-border, rgba(124, 58, 237, 0.2));
    border-radius: 20px;
    padding: 2.5rem;
    text-align: center;
  }

  .risk-icon-wrapper {
    margin-bottom: 1.5rem;
  }

  .risk-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(239, 68, 68, 0.1));
    color: var(--color-primary, #7c3aed);
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(124, 58, 237, 0.2);
    }
    50% {
      box-shadow: 0 0 40px rgba(124, 58, 237, 0.35);
    }
  }

  .risk-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text, #f0f0f5);
    margin: 0 0 0.5rem;
    letter-spacing: -0.03em;
  }

  .risk-subtitle {
    color: var(--color-text-muted, #8b8b9a);
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .risk-items {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .risk-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--color-text-muted, #aaa);
  }

  .risk-item :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-warning, #f59e0b);
  }

  .risk-item strong {
    display: block;
    color: var(--color-text, #f0f0f5);
    font-size: 0.9375rem;
    margin-bottom: 0.25rem;
  }

  .risk-item p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .risk-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  /* ═══════════ MAIN SCREEN ═══════════ */
  .agent-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-app, #0a0a0f);
    overflow: hidden;
  }

  /* Header */
  .agent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-bg-card, rgba(20, 20, 32, 0.95));
    backdrop-filter: blur(12px);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text, #f0f0f5);
  }

  .header-title h1 {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .budget-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.2);
    font-size: 0.75rem;
  }

  .budget-label {
    color: var(--color-text-muted, #8b8b9a);
  }

  .budget-value {
    color: var(--color-primary, #7c3aed);
    font-weight: 600;
  }

  /* Body: Two-column layout */
  .agent-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ═══════════ CONFIG PANEL ═══════════ */
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

  /* Model Selector */
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

  .model-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.8125rem;
    transition: all 0.15s ease;
  }

  .model-option:hover {
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-text, #f0f0f5);
  }

  .model-option.selected {
    background: rgba(124, 58, 237, 0.12);
    border-color: rgba(124, 58, 237, 0.3);
    color: var(--color-primary, #7c3aed);
  }

  .model-name {
    font-weight: 500;
  }

  .model-provider {
    font-size: 0.6875rem;
    text-transform: capitalize;
    opacity: 0.7;
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

  /* ═══════════ CHANNELS ═══════════ */
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

  /* ═══════════ CHAT PANEL ═══════════ */
  .chat-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .chat-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.04));
    color: var(--color-primary, #7c3aed);
    margin-bottom: 1.5rem;
  }

  .chat-empty h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #f0f0f5);
    margin: 0 0 0.5rem;
  }

  .chat-empty p {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    max-width: 400px;
    line-height: 1.5;
  }

  .chat-hint {
    font-size: 0.8125rem !important;
    opacity: 0.7;
    margin-top: 0.5rem !important;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Chat Bubbles */
  .chat-bubble {
    max-width: 85%;
    border-radius: 16px;
    padding: 0.75rem 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-bubble.user {
    align-self: flex-end;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.1));
    border: 1px solid rgba(124, 58, 237, 0.2);
  }

  .chat-bubble.assistant {
    align-self: flex-start;
    background: var(--color-bg-card, rgba(20, 20, 32, 0.8));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
  }

  .bubble-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-muted, #8b8b9a);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bubble-role {
    font-size: 0.6875rem;
  }

  .bubble-content {
    font-size: 0.875rem;
    color: var(--color-text, #f0f0f5);
    line-height: 1.6;
  }

  .bubble-content p {
    margin: 0;
  }

  .chat-text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .tool-call-inline {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    margin: 0.375rem 0;
    border-radius: 6px;
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.15);
    font-size: 0.75rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .tool-call-inline code {
    font-family: 'SF Mono', monospace;
    color: var(--color-primary, #7c3aed);
  }

  .tool-result-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    margin: 0.25rem 0;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .tool-result-inline.success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .tool-result-inline.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.8125rem;
  }

  /* Chat Input */
  .chat-input-area {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    background: var(--color-bg-card, rgba(20, 20, 32, 0.5));
  }

  .chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: var(--color-bg-subtle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    padding: 0.625rem 0.75rem;
    transition: border-color 0.2s;
  }

  .chat-input-wrapper:focus-within {
    border-color: rgba(124, 58, 237, 0.4);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
  }

  .chat-textarea {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text, #f0f0f5);
    font-size: 0.9375rem;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
    max-height: 120px;
    min-height: 24px;
  }

  .chat-textarea::placeholder {
    color: var(--color-text-muted, #5a5a6e);
  }

  .send-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: none;
    background: var(--color-primary, #7c3aed);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chat-input-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-top: 0.5rem;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #5a5a6e);
  }

  .meta-dot {
    opacity: 0.5;
  }

  .meta-temp,
  .meta-turns {
    color: var(--color-primary, #7c3aed);
  }

  /* ═══════════ MODEL PRESETS ═══════════ */
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

  /* ═══════════ SETTINGS ═══════════ */
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

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (max-width: 768px) {
    .agent-body {
      flex-direction: column;
    }

    .config-panel {
      width: 100%;
      min-width: 0;
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    }
  }
</style>
