<!--
  GAgentStatusPanel.svelte
  
  Comprehensive G-Agent status panel combining all widgets:
  - Kill Switch (emergency stop)
  - Budget Widget (cost tracking)
  - Compiler Stats (100x savings)
  - Confidence indicator
  - Connection status
  
  This is the central control panel for G-Agent operations.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    gAgentStore,
    isConnected,
    isGlobalStopActive,
    gAgentStatus,
  } from '../../stores/gAgentStore';
  import {
    gAgentBudgetStore,
    pendingApprovalCount,
    type ApprovalRequest,
  } from '../../stores/gAgentBudgetStore';
  import { gAgentCompilerStore, compilerStats } from '../../stores/gAgentCompilerStore';
  import { Bot } from 'lucide-svelte';

  import KillSwitchButton from './KillSwitchButton.svelte';
  import BudgetWidget from './BudgetWidget.svelte';
  import CompilerStatsWidget from './CompilerStatsWidget.svelte';
  import ApprovalDialog from './ApprovalDialog.svelte';

  // Props
  export let sessionId: string = 'default';
  export let compact: boolean = false;
  export let showCompiler: boolean = true;
  export let showBudget: boolean = true;

  // State
  let activeTab: 'overview' | 'budget' | 'compiler' = 'overview';
  let currentApproval: ApprovalRequest | null = null;
  let showApprovalDialog = false;

  // Subscribe to SSE events
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Connect to SSE stream
    gAgentStore.connect(sessionId);

    // Initialize stores
    gAgentStore.fetchStatus(sessionId);
    gAgentBudgetStore.fetchStatus(sessionId);
    gAgentCompilerStore.setSessionId(sessionId);
    gAgentCompilerStore.fetchStats();

    // Listen for approval requests
    unsubscribe = gAgentStore.onSSEEvent((event) => {
      if (event.type === 'approval_required') {
        const request = (event as { type: 'approval_required'; request: ApprovalRequest }).request;
        currentApproval = request;
        showApprovalDialog = true;
      }
    });
  });

  onDestroy(() => {
    gAgentStore.disconnect();
    if (unsubscribe) {
      unsubscribe();
    }
  });

  function handleApprovalClose() {
    showApprovalDialog = false;
    currentApproval = null;
  }
</script>

<div class="gagent-status-panel site-style rounded-xl overflow-hidden {compact ? 'p-3' : 'p-4'}">
  <!-- Header: one clear status line + emergency stop -->
  <div class="panel-header-simple">
    <div class="panel-header-top">
      <span class="panel-icon"><Bot size={20} /></span>
      <h2 class="panel-title">G-Agent</h2>
    </div>
    <div class="panel-status-line">
      <span
        class="status-dot {$isConnected ? 'status-connected animate-pulse' : 'status-disconnected'}"
      ></span>
      <span class="status-text">{$isConnected ? 'Connected' : 'Disconnected'}</span>
      {#if $isGlobalStopActive}
        <span class="status-stopped">· Stopped</span>
      {/if}
      {#if $pendingApprovalCount > 0}
        <span class="badge-pending">{$pendingApprovalCount} approval(s)</span>
      {/if}
    </div>
    <div class="panel-emergency">
      <KillSwitchButton size="md" showLabel={!compact} />
      {#if !compact}
        <span class="emergency-hint">Emergency stop: Ctrl+Shift+K</span>
      {/if}
    </div>
  </div>

  <!-- Tab navigation -->
  {#if !compact}
    <div class="tab-bar">
      <button
        class="tab-btn {activeTab === 'overview' ? 'tab-active' : ''}"
        on:click={() => (activeTab = 'overview')}
      >
        Overview
      </button>
      {#if showBudget}
        <button
          class="tab-btn {activeTab === 'budget' ? 'tab-active' : ''}"
          on:click={() => (activeTab = 'budget')}
        >
          Budget
        </button>
      {/if}
      {#if showCompiler}
        <button
          class="tab-btn {activeTab === 'compiler' ? 'tab-active' : ''}"
          on:click={() => (activeTab = 'compiler')}
        >
          Compiler
        </button>
      {/if}
    </div>
  {/if}

  <!-- Tab content -->
  <div class="space-y-4">
    {#if activeTab === 'overview' || compact}
      <!-- Simple one-line stats -->
      <div class="stats-row-simple">
        {#if $gAgentStatus?.queue}
          <span class="stat-inline"
            >Goals: {$gAgentStatus.queue.running} active, {$gAgentStatus.queue.pending} pending</span
          >
        {/if}
        {#if $compilerStats && showCompiler}
          <span class="stat-inline"
            >Compression: {Math.round($compilerStats.compressionEfficiency * 100)}x</span
          >
        {/if}
      </div>

      <!-- Mini widgets in compact mode -->
      {#if compact}
        <div class="grid grid-cols-2 gap-3">
          {#if showBudget}
            <BudgetWidget {sessionId} compact showDetails={false} />
          {/if}
          {#if showCompiler}
            <CompilerStatsWidget {sessionId} compact />
          {/if}
        </div>
      {/if}
    {/if}

    {#if activeTab === 'budget' && !compact}
      <BudgetWidget {sessionId} showDetails />
    {/if}

    {#if activeTab === 'compiler' && !compact}
      <CompilerStatsWidget {sessionId} showAnimation />
    {/if}
  </div>

  <!-- Footer: minimal session id; details in tabs -->
  {#if !compact}
    <div class="panel-footer panel-footer-simple">
      <span class="footer-session">Session: {sessionId}</span>
      <span class="footer-details-hint">Budget &amp; compiler details in tabs above.</span>
    </div>
  {/if}
</div>

<!-- Approval Dialog -->
{#if currentApproval}
  <ApprovalDialog
    request={currentApproval}
    show={showApprovalDialog}
    on:close={handleApprovalClose}
    on:approve={handleApprovalClose}
    on:deny={handleApprovalClose}
  />
{/if}

<style>
  .gagent-status-panel {
    min-width: 300px;
    max-width: 500px;
  }

  /* Site style: neutral palette #f9fafb, #ffffff, #e5e7eb, #111827, #374151 */
  .gagent-status-panel.site-style {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .gagent-status-panel.site-style .panel-icon {
    color: var(--color-text-secondary);
  }

  .gagent-status-panel.site-style .panel-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .panel-header-simple {
    margin-bottom: 0.75rem;
  }

  .panel-header-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .panel-status-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .panel-status-line .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .panel-status-line .status-text {
    font-weight: 500;
  }

  .panel-emergency {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .emergency-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .stats-row-simple {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .stat-inline {
    white-space: nowrap;
  }

  .panel-footer-simple {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .footer-details-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .gagent-status-panel.site-style .status-connected {
    color: var(--color-success);
  }

  .gagent-status-panel.site-style .status-disconnected {
    color: var(--color-error);
  }

  .gagent-status-panel.site-style .status-dot.status-connected {
    background: var(--color-success);
  }

  .gagent-status-panel.site-style .status-dot.status-disconnected {
    background: var(--color-error);
  }

  .gagent-status-panel.site-style .panel-status-line .status-connected {
    color: var(--color-success);
  }

  .gagent-status-panel.site-style .panel-status-line .status-disconnected {
    color: var(--color-error);
  }

  .gagent-status-panel.site-style .status-stopped {
    color: var(--color-error);
    font-weight: 500;
  }

  .gagent-status-panel.site-style .badge-pending {
    background: var(--color-warning-subtle);
    color: var(--color-warning);
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .gagent-status-panel.site-style .tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 4px;
  }

  .gagent-status-panel.site-style .tab-btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    transition:
      background 0.15s,
      color 0.15s;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .gagent-status-panel.site-style .tab-btn:hover {
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
  }

  .gagent-status-panel.site-style .tab-btn.tab-active {
    background: var(--color-bg-card);
    color: var(--color-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s ease-in-out infinite;
  }
</style>
