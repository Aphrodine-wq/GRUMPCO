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
  import ConfidenceIndicator from './ConfidenceIndicator.svelte';

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

<div
  class="gagent-status-panel site-style rounded-xl overflow-hidden {compact
    ? 'p-3'
    : 'p-4'}"
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-3">
      <span class="panel-icon"><Bot size={24} /></span>
      <div>
        <h2 class="panel-title">G-Agent Control</h2>
        <div class="flex items-center gap-2 text-xs panel-meta">
          <!-- Connection status -->
          <span class="flex items-center gap-1 {$isConnected ? 'status-connected' : 'status-disconnected'}">
            <span
              class="w-2 h-2 rounded-full status-dot {$isConnected ? 'animate-pulse' : ''}"
            ></span>
            {$isConnected ? 'Connected' : 'Disconnected'}
          </span>

          <!-- Global stop status -->
          {#if $isGlobalStopActive}
            <span class="status-stopped">• STOPPED</span>
          {/if}

          <!-- Pending approvals -->
          {#if $pendingApprovalCount > 0}
            <span class="badge-pending">
              {$pendingApprovalCount} pending
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Kill Switch - Always visible -->
    <KillSwitchButton size="md" showLabel={!compact} />
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
      <!-- Quick stats grid -->
      <div class="grid {compact ? 'grid-cols-2' : 'grid-cols-3'} gap-3">
        <!-- Queue stats -->
        {#if $gAgentStatus?.queue}
          <div class="stat-card">
            <div class="stat-label">Active Goals</div>
            <div class="stat-value stat-value-blue">
              {$gAgentStatus.queue.running}
            </div>
            <div class="stat-sublabel">
              {$gAgentStatus.queue.pending} pending
            </div>
          </div>
        {/if}

        <!-- Compiler compression -->
        {#if $compilerStats && showCompiler}
          <div class="stat-card">
            <div class="stat-label">Compression</div>
            <div class="stat-value stat-value-green">
              {Math.round($compilerStats.compressionEfficiency * 100)}x
            </div>
            <div class="stat-sublabel">
              {($compilerStats.tokensSaved / 1000).toFixed(1)}K saved
            </div>
          </div>
        {/if}

        <!-- Capabilities -->
        {#if $gAgentStatus?.capabilities}
          <div class="stat-card">
            <div class="stat-label">Capabilities</div>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each Object.entries($gAgentStatus.capabilities).filter(([_, v]) => v) as [cap]}
                <span class="cap-tag">
                  {cap.replace(/_/g, ' ')}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Optional stack/frameworks line (placeholder until session/store provides it) -->
      <div class="stat-card stack-line">
        <div class="stat-label">Stack</div>
        <div class="stat-sublabel">—</div>
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

  <!-- Footer with confidence and autonomy -->
  {#if !compact}
    <div class="panel-footer">
      <div class="flex items-center gap-4">
        <ConfidenceIndicator
          confidence={0.75}
          size="sm"
          showLabel
          factors={[
            { name: 'Pattern Match', value: 0.85, weight: 0.3 },
            { name: 'Context Quality', value: 0.7, weight: 0.25 },
            { name: 'History', value: 0.6, weight: 0.2 },
            { name: 'Risk Assessment', value: 0.8, weight: 0.25 },
          ]}
        />
      </div>

      <div class="footer-session">
        Session: {sessionId}
      </div>
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
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .gagent-status-panel.site-style .panel-icon {
    color: #374151;
  }

  .gagent-status-panel.site-style .panel-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
  }

  .gagent-status-panel.site-style .panel-meta {
    color: #6b7280;
  }

  .gagent-status-panel.site-style .status-connected {
    color: #059669;
  }

  .gagent-status-panel.site-style .status-disconnected {
    color: #dc2626;
  }

  .gagent-status-panel.site-style span.status-connected .status-dot {
    background: #059669;
  }

  .gagent-status-panel.site-style span.status-disconnected .status-dot {
    background: #dc2626;
  }

  .gagent-status-panel.site-style .status-stopped {
    color: #dc2626;
    font-weight: 500;
  }

  .gagent-status-panel.site-style .badge-pending {
    background: #fef3c7;
    color: #92400e;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .gagent-status-panel.site-style .tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px;
  }

  .gagent-status-panel.site-style .tab-btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
  }

  .gagent-status-panel.site-style .tab-btn:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .gagent-status-panel.site-style .tab-btn.tab-active {
    background: #ffffff;
    color: #111827;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .gagent-status-panel.site-style .stat-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
  }

  .gagent-status-panel.site-style .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .gagent-status-panel.site-style .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .gagent-status-panel.site-style .stat-value-blue {
    color: #2563eb;
  }

  .gagent-status-panel.site-style .stat-value-green {
    color: #059669;
  }

  .gagent-status-panel.site-style .stat-sublabel {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .gagent-status-panel.site-style .cap-tag {
    font-size: 0.75rem;
    background: #e5e7eb;
    color: #374151;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .gagent-status-panel.site-style .panel-footer {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gagent-status-panel.site-style .footer-session {
    font-size: 0.75rem;
    color: #6b7280;
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
