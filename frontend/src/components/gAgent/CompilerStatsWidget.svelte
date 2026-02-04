<!--
  CompilerStatsWidget.svelte
  
  Shows 100x Semantic Compiler statistics.
  Visualizes compression savings and efficiency.
  
  The 100x solution to the Data Wall Problem!
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Rocket } from 'lucide-svelte';
  import {
    gAgentCompilerStore,
    compilerStats,
    compressionRatio,
    tokensSaved,
    costSaved,
    formatCompressionRatio,
    formatTokens,
    getCompressionColor,
  } from '../../stores/gAgentCompilerStore';
  import { formatCost } from '../../stores/gAgentBudgetStore';

  // Props
  export let sessionId: string = 'default';
  export let compact: boolean = false;
  export let showAnimation: boolean = true;

  // State
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let animatedRatio = 0;

  // Animate compression ratio on change
  $: if ($compressionRatio > 0 && showAnimation) {
    animateRatio($compressionRatio);
  }

  function animateRatio(target: number) {
    const duration = 1000; // 1 second
    const start = animatedRatio;
    const startTime = performance.now();

    function update(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      animatedRatio = start + (target - start) * eased;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  onMount(() => {
    gAgentCompilerStore.setSessionId(sessionId);
    gAgentCompilerStore.fetchStats();

    // Refresh every 30 seconds
    refreshInterval = setInterval(() => {
      gAgentCompilerStore.fetchStats();
    }, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div
  class="compiler-stats-widget bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg overflow-hidden {compact
    ? 'p-3'
    : 'p-4'}"
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <span class="text-xl"><Rocket size={20} /></span>
      <span class="font-semibold text-white {compact ? 'text-sm' : 'text-base'}">
        Semantic Compiler
      </span>
    </div>
    <span class="text-xs text-gray-400">100x Solution</span>
  </div>

  <!-- Main compression ratio display -->
  <div class="text-center py-4">
    <div class="relative inline-block">
      <!-- Animated compression ratio -->
      <div
        class="{getCompressionColor(
          animatedRatio
        )} text-5xl font-bold transition-colors duration-500"
      >
        {formatCompressionRatio(animatedRatio)}
      </div>
      <div class="text-gray-400 text-sm mt-1">compression ratio</div>

      <!-- Pulsing ring animation for high compression -->
      {#if animatedRatio >= 50}
        <div
          class="absolute inset-0 -m-4 rounded-full border-2 border-green-500/30 animate-ping"
        ></div>
      {/if}
    </div>
  </div>

  <!-- Stats grid -->
  {#if $compilerStats}
    <div class="grid grid-cols-2 gap-3 {compact ? 'text-xs' : 'text-sm'}">
      <!-- Tokens saved -->
      <div class="bg-gray-700/50 rounded p-2">
        <div class="text-gray-400">Tokens Saved</div>
        <div class="text-green-400 font-semibold text-lg">
          {formatTokens($tokensSaved)}
        </div>
      </div>

      <!-- Cost saved -->
      <div class="bg-gray-700/50 rounded p-2">
        <div class="text-gray-400">Cost Saved</div>
        <div class="text-emerald-400 font-semibold text-lg">
          {formatCost($costSaved)}
        </div>
      </div>

      <!-- Compilations -->
      <div class="bg-gray-700/50 rounded p-2">
        <div class="text-gray-400">Compilations</div>
        <div class="text-blue-400 font-semibold">
          {$compilerStats.compilations}
        </div>
      </div>

      <!-- Cache hit rate -->
      <div class="bg-gray-700/50 rounded p-2">
        <div class="text-gray-400">Cache Hits</div>
        <div class="text-purple-400 font-semibold">
          {#if $compilerStats.compilations > 0}
            {Math.round(($compilerStats.cacheHits / $compilerStats.compilations) * 100)}%
          {:else}
            0%
          {/if}
        </div>
      </div>
    </div>

    <!-- Detailed stats (non-compact) -->
    {#if !compact}
      <div class="mt-4 pt-4 border-t border-gray-700 space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-gray-500">Index Size</span>
          <span class="text-gray-300">{$compilerStats.indexSize} units</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Speculative Hits</span>
          <span class="text-gray-300">{$compilerStats.speculativeHits}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Cache Size</span>
          <span class="text-gray-300">{$compilerStats.cacheSize} entries</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Efficiency</span>
          <span
            class={$compilerStats.compressionEfficiency > 0.7
              ? 'text-green-400'
              : 'text-yellow-400'}
          >
            {Math.round($compilerStats.compressionEfficiency * 100)}%
          </span>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Loading state -->
    <div class="text-center py-4 text-gray-500">
      <div class="animate-pulse">Loading stats...</div>
    </div>
  {/if}

  <!-- Visual representation of compression -->
  <div class="mt-4 flex items-center gap-2 text-xs text-gray-400">
    <div
      class="flex-1 h-6 bg-red-900/30 rounded flex items-center justify-center border border-red-500/30"
    >
      <span>Raw: ~85K tokens</span>
    </div>
    <span class="text-gray-500">→</span>
    <div
      class="w-8 h-6 bg-green-900/50 rounded flex items-center justify-center border border-green-500/30"
    >
      <span class="text-green-400">850</span>
    </div>
  </div>
</div>

<style>
  .compiler-stats-widget {
    min-width: 240px;
  }

  @keyframes ping {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    75%,
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  .animate-ping {
    animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
</style>
