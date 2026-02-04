<!--
  BudgetWidget.svelte
  
  Real-time budget tracking widget for G-Agent.
  Shows cost usage, warnings, and enables budget respect.
  
  KEY DIFFERENTIATOR: We respect the user's wallet.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    gAgentBudgetStore,
    budgetStatus,
    isWarning,
    isExceeded,
    formattedSessionCost,
    sessionBudgetPercent,
    formatCost,
    getStatusColor,
    getStatusIcon,
  } from '../../stores/gAgentBudgetStore';
  import { Wallet, Ban, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-svelte';

  // Props
  export let sessionId: string = 'default';
  export let compact: boolean = false;
  export let showDetails: boolean = true;

  // State
  let isExpanded = false;
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Computed
  $: progressColor =
    $budgetStatus?.status === 'ok'
      ? 'bg-green-500'
      : $budgetStatus?.status === 'warning'
        ? 'bg-yellow-500'
        : $budgetStatus?.status === 'critical'
          ? 'bg-orange-500'
          : 'bg-red-500';

  $: progressPercent = Math.min($sessionBudgetPercent * 100, 100);

  // Fetch status on mount
  onMount(async () => {
    await gAgentBudgetStore.fetchStatus(sessionId);

    // Refresh every 10 seconds
    refreshInterval = setInterval(() => {
      gAgentBudgetStore.fetchStatus(sessionId);
    }, 10000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
</script>

<div
  class="budget-widget bg-gray-800 rounded-lg shadow-lg overflow-hidden {compact ? 'p-2' : 'p-4'}"
>
  <!-- Header -->
  <button
    class="w-full flex items-center justify-between gap-2 text-left"
    on:click={toggleExpanded}
  >
    <div class="flex items-center gap-2">
      <span class="text-lg">
        {#if $budgetStatus}
          {#if getStatusIcon($budgetStatus.status)}
            {@const StatusIcon = getStatusIcon($budgetStatus.status)}
            <StatusIcon size={20} />
          {/if}
        {:else}
          <Wallet size={20} />
        {/if}
      </span>
      <span class="font-semibold text-white {compact ? 'text-sm' : 'text-base'}">
        {$formattedSessionCost}
      </span>
      {#if !compact}
        <span class="text-gray-400 text-sm">spent this session</span>
      {/if}
    </div>

    <!-- Status indicator -->
    {#if $budgetStatus}
      <span class="{getStatusColor($budgetStatus.status)} text-sm font-medium uppercase">
        {$budgetStatus.status}
      </span>
    {/if}
  </button>

  <!-- Progress bar -->
  <div class="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
    <div
      class="h-full {progressColor} transition-all duration-500 ease-out"
      style="width: {progressPercent}%"
    ></div>
  </div>

  <!-- Warning banner -->
  {#if $isWarning || $isExceeded}
    <div class="mt-2 p-2 rounded {$isExceeded ? 'bg-red-900/50' : 'bg-yellow-900/50'} text-sm">
      <div class="flex items-center gap-2">
        <span>
          {#if $isExceeded}
            <Ban size={16} />
          {:else}
            <AlertTriangle size={16} />
          {/if}
        </span>
        <span class={$isExceeded ? 'text-red-300' : 'text-yellow-300'}>
          {$budgetStatus?.message || ($isExceeded ? 'Budget exceeded' : 'Approaching budget limit')}
        </span>
      </div>
    </div>
  {/if}

  <!-- Expanded details -->
  {#if isExpanded && showDetails && $budgetStatus}
    <div class="mt-4 pt-4 border-t border-gray-700 space-y-3">
      <!-- Session budget -->
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Session</span>
        <span class="text-white">
          {formatCost($budgetStatus.sessionUsed)} / {formatCost(
            $budgetStatus.sessionUsed + $budgetStatus.sessionRemaining
          )}
        </span>
      </div>

      <!-- Daily budget -->
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Today</span>
        <span class="text-white">
          {formatCost($budgetStatus.dailyUsed)} / {formatCost(
            $budgetStatus.dailyUsed + $budgetStatus.dailyRemaining
          )}
        </span>
      </div>
      <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-500 transition-all duration-300"
          style="width: {Math.min($budgetStatus.dailyPercent * 100, 100)}%"
        ></div>
      </div>

      <!-- Monthly budget -->
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">This Month</span>
        <span class="text-white">
          {formatCost($budgetStatus.monthlyUsed)} / {formatCost(
            $budgetStatus.monthlyUsed + $budgetStatus.monthlyRemaining
          )}
        </span>
      </div>
      <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-purple-500 transition-all duration-300"
          style="width: {Math.min($budgetStatus.monthlyPercent * 100, 100)}%"
        ></div>
      </div>

      <!-- Quick estimate helper -->
      <div class="mt-4 p-3 bg-gray-900/50 rounded text-sm">
        <div class="text-gray-400 mb-1">Estimated cost per operation:</div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-500">Chat message:</span>
            <span class="text-gray-300">~2-5¢</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Code generation:</span>
            <span class="text-gray-300">~5-15¢</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">File analysis:</span>
            <span class="text-gray-300">~1-3¢</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Goal execution:</span>
            <span class="text-gray-300">~10-50¢</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Expand/collapse indicator -->
  {#if showDetails}
    <div class="mt-2 text-center">
      <button
        class="text-gray-500 hover:text-gray-400 text-xs flex items-center justify-center gap-1 mx-auto"
        on:click={toggleExpanded}
      >
        {#if isExpanded}
          <ChevronUp size={14} /> Less
        {:else}
          <ChevronDown size={14} /> More
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .budget-widget {
    min-width: 200px;
  }
</style>
