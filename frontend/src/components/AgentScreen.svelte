<script lang="ts">
  /**
   * AgentScreen – Dedicated full-page Agent workspace.
   *
   * Composes three sub-components:
   *  1. AgentRiskGate  – risk acknowledgment overlay
   *  2. AgentConfigPanel – left sidebar (model, settings, integrations, channels)
   *  3. AgentChatPanel – right chat area (messages, streaming, input)
   */
  import { onMount, onDestroy } from 'svelte';
  import { Button, Badge } from '../lib/design-system';
  import { ArrowLeft, Bot, Play, Square, Shield, DollarSign } from 'lucide-svelte';
  import { autonomyLevel } from '../stores/gAgentConfigStore';
  import AgentRiskGate from './agent/AgentRiskGate.svelte';
  import AgentConfigPanel from './agent/AgentConfigPanel.svelte';
  import AgentChatPanel from './agent/AgentChatPanel.svelte';

  // ── Props ─────────────────────────────────────────────────────────────────
  interface Props {
    onBack?: () => void;
  }
  let { onBack }: Props = $props();

  // ── Risk gate ─────────────────────────────────────────────────────────────
  const RISK_KEY = 'grump_agent_risk_accepted';
  let riskAccepted = $state(false);

  // ── Model selection ───────────────────────────────────────────────────────
  let selectedProvider = $state('');
  let selectedModel = $state('');

  function handleModelSelect(provider: string, modelId: string) {
    selectedProvider = provider;
    selectedModel = modelId;
  }

  // ── Agent running state ───────────────────────────────────────────────────
  let agentRunning = $state(false);
  let runElapsed = $state(0);
  let runTimer: ReturnType<typeof setInterval> | null = null;

  // ── Sub-component references ──────────────────────────────────────────────
  let configPanel: AgentConfigPanel | undefined = $state(undefined);
  let chatPanel: AgentChatPanel | undefined = $state(undefined);

  // ── Agent controls ────────────────────────────────────────────────────────
  function startAgent() {
    agentRunning = true;
    runElapsed = 0;
    runTimer = setInterval(() => (runElapsed += 1), 1000);
  }

  function stopAgent() {
    agentRunning = false;
    if (runTimer) {
      clearInterval(runTimer);
      runTimer = null;
    }
  }

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Defaults for chat config ──────────────────────────────────────────────
  const CONFIG_DEFAULTS = {
    memoryEnabled: true,
    temperature: 0.7,
    maxTurns: 25,
    budgetLimit: 10,
    systemPrompt: '',
    workspaceRoot: '',
    toolAllowlist: [] as string[],
    toolDenylist: [] as string[],
    allowedDirs: [] as string[],
    agentProfile: 'general' as const,
    includeRagContext: false,
    modelPreset: 'balanced' as const,
    largeContextMode: false,
  };

  // ── Build the config object the chat panel needs ──────────────────────────
  let chatConfig = $derived.by(() => {
    const panelConfig = configPanel?.getConfig?.() ?? CONFIG_DEFAULTS;
    return {
      selectedProvider,
      selectedModel,
      enabledSkillIds: configPanel?.getEnabledSkillIds?.() ?? [],
      ...panelConfig,
    };
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    riskAccepted = localStorage.getItem(RISK_KEY) === 'true';
    configPanel?.initialize?.();
  });

  onDestroy(() => {
    if (runTimer) clearInterval(runTimer);
    chatPanel?.destroy?.();
  });

  function acceptRisks() {
    riskAccepted = true;
    localStorage.setItem(RISK_KEY, 'true');
  }
</script>

{#if !riskAccepted}
  <AgentRiskGate onAccept={acceptRisks} onBack={() => onBack?.()} />
{:else}
  <div class="agent-screen">
    <!-- ═══════════ HEADER ═══════════ -->
    <header class="agent-header">
      <div class="header-left">
        <Button variant="ghost" size="sm" onclick={() => onBack?.()}>
          <ArrowLeft size={16} />
        </Button>
        <div class="header-title">
          <Bot size={20} />
          <h1>Agent</h1>
          <Badge variant={agentRunning ? 'success' : 'default'}>
            {agentRunning ? 'Running' : 'Idle'}
          </Badge>
        </div>
      </div>

      <div class="header-controls">
        <div class="budget-pill">
          <DollarSign size={12} />
          <span class="budget-label">Budget</span>
          <span class="budget-value">${configPanel?.getConfig?.().budgetLimit ?? 10}</span>
        </div>

        <Badge variant="info">{$autonomyLevel}</Badge>

        {#if agentRunning}
          <Badge variant="default">{formatElapsed(runElapsed)}</Badge>
          <Button variant="danger" size="sm" onclick={stopAgent}>
            <Square size={14} />
            Stop
          </Button>
        {:else}
          <Button variant="primary" size="sm" onclick={startAgent}>
            <Play size={14} />
            Start Agent
          </Button>
        {/if}
      </div>
    </header>

    <!-- ═══════════ BODY ═══════════ -->
    <div class="agent-body">
      <!-- LEFT: Config Panel -->
      <AgentConfigPanel
        bind:this={configPanel}
        {selectedProvider}
        {selectedModel}
        onModelSelect={handleModelSelect}
      />

      <!-- RIGHT: Chat Panel -->
      <main class="chat-panel">
        <AgentChatPanel bind:this={chatPanel} config={chatConfig} />
      </main>
    </div>
  </div>
{/if}

<style>
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

  .chat-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .agent-body {
      flex-direction: column;
    }
  }
</style>
