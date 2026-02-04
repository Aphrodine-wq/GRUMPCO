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
  class="gagent-status-panel bg-gray-900 rounded-xl shadow-2xl overflow-hidden {compact
    ? 'p-3'
    : 'p-4'}"
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-3">
      <span class="text-2xl"><Bot size={24} /></span>
      <div>
        <h2 class="text-lg font-bold text-white">G-Agent Control</h2>
        <div class="flex items-center gap-2 text-xs">
          <!-- Connection status -->
          <span class="flex items-center gap-1 {$isConnected ? 'text-green-400' : 'text-red-400'}">
            <span
              class="w-2 h-2 rounded-full {$isConnected
                ? 'bg-green-400'
                : 'bg-red-400'} {$isConnected ? 'animate-pulse' : ''}"
            ></span>
            {$isConnected ? 'Connected' : 'Disconnected'}
          </span>

          <!-- Global stop status -->
          {#if $isGlobalStopActive}
            <span class="text-red-400 font-medium">• STOPPED</span>
          {/if}

          <!-- Pending approvals -->
          {#if $pendingApprovalCount > 0}
            <span class="bg-yellow-600 text-black px-2 py-0.5 rounded-full font-medium">
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
    <div class="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
      <button
        class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {activeTab ===
        'overview'
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:text-white'}"
        on:click={() => (activeTab = 'overview')}
      >
        Overview
      </button>
      {#if showBudget}
        <button
          class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {activeTab ===
          'budget'
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-white'}"
          on:click={() => (activeTab = 'budget')}
        >
          Budget
        </button>
      {/if}
      {#if showCompiler}
        <button
          class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {activeTab ===
          'compiler'
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-white'}"
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
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-gray-400 text-xs mb-1">Active Goals</div>
            <div class="text-2xl font-bold text-blue-400">
              {$gAgentStatus.queue.running}
            </div>
            <div class="text-xs text-gray-500">
              {$gAgentStatus.queue.pending} pending
            </div>
          </div>
        {/if}

        <!-- Compiler compression -->
        {#if $compilerStats && showCompiler}
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-gray-400 text-xs mb-1">Compression</div>
            <div class="text-2xl font-bold text-green-400">
              {Math.round($compilerStats.compressionEfficiency * 100)}x
            </div>
            <div class="text-xs text-gray-500">
              {($compilerStats.tokensSaved / 1000).toFixed(1)}K saved
            </div>
          </div>
        {/if}

        <!-- Capabilities -->
        {#if $gAgentStatus?.capabilities}
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-gray-400 text-xs mb-1">Capabilities</div>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each Object.entries($gAgentStatus.capabilities).filter(([_, v]) => v) as [cap]}
                <span class="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                  {cap.replace(/_/g, ' ')}
                </span>
              {/each}
            </div>
          </div>
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

  <!-- Footer with confidence and autonomy -->
  {#if !compact}
    <div class="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
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

      <div class="text-xs text-gray-500">
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
