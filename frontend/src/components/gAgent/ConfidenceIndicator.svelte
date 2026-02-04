<!--
  ConfidenceIndicator.svelte
  
  Visual indicator for G-Agent confidence levels.
  Shows how confident the agent is in its actions.
  
  Confidence determines autonomy:
  - High (>80%): Autonomous execution
  - Medium (50-80%): Execute with logging
  - Low (<50%): Ask for confirmation
-->
<script lang="ts">
  // Props
  export let confidence: number = 0.5; // 0-1
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showLabel: boolean = true;
  export let showDetails: boolean = false;
  export let factors: Array<{ name: string; value: number; weight: number }> = [];

  // State
  let isHovered = false;

  // Computed
  $: confidencePercent = Math.round(confidence * 100);

  $: confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  $: confidenceColor =
    confidenceLevel === 'high'
      ? 'text-green-400'
      : confidenceLevel === 'medium'
        ? 'text-yellow-400'
        : 'text-red-400';

  $: bgColor =
    confidenceLevel === 'high'
      ? 'bg-green-500'
      : confidenceLevel === 'medium'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  $: borderColor =
    confidenceLevel === 'high'
      ? 'border-green-500'
      : confidenceLevel === 'medium'
        ? 'border-yellow-500'
        : 'border-red-500';

  $: action =
    confidenceLevel === 'high'
      ? 'Will execute autonomously'
      : confidenceLevel === 'medium'
        ? 'Will execute with logging'
        : 'Will ask for confirmation';

  // Size classes
  const sizes = {
    sm: { ring: 'w-6 h-6', text: 'text-xs', icon: 'text-sm' },
    md: { ring: 'w-10 h-10', text: 'text-sm', icon: 'text-lg' },
    lg: { ring: 'w-14 h-14', text: 'text-base', icon: 'text-2xl' },
  };
</script>

<div
  class="confidence-indicator inline-flex items-center gap-2"
  on:mouseenter={() => (isHovered = true)}
  on:mouseleave={() => (isHovered = false)}
  role="group"
  aria-label="Confidence indicator"
>
  <!-- Circular progress indicator -->
  <div class="relative {sizes[size].ring}">
    <!-- Background ring -->
    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        class="text-gray-700"
      />
      <!-- Progress ring -->
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        class="{confidenceColor} transition-all duration-500"
        stroke-dasharray="{confidencePercent} 100"
      />
    </svg>

    <!-- Center content -->
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="{sizes[size].icon} {confidenceColor}">
        {#if confidenceLevel === 'high'}
          ✓
        {:else if confidenceLevel === 'medium'}
          ~
        {:else}
          ?
        {/if}
      </span>
    </div>
  </div>

  <!-- Label -->
  {#if showLabel}
    <div class="flex flex-col">
      <span class="{sizes[size].text} font-medium {confidenceColor}">
        {confidencePercent}%
      </span>
      <span class="text-xs text-gray-500 capitalize">
        {confidenceLevel} confidence
      </span>
    </div>
  {/if}

  <!-- Hover tooltip with details -->
  {#if isHovered && showDetails && factors.length > 0}
    <div
      class="absolute top-full left-0 mt-2 p-3 bg-gray-800 rounded-lg shadow-xl border {borderColor} min-w-48 z-50"
    >
      <div class="text-xs text-gray-400 mb-2">Confidence Factors</div>

      <div class="space-y-2">
        {#each factors as factor}
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm text-gray-300">{factor.name}</span>
            <div class="flex items-center gap-2">
              <div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full {factor.value >= 0.7
                    ? 'bg-green-500'
                    : factor.value >= 0.4
                      ? 'bg-yellow-500'
                      : 'bg-red-500'}"
                  style="width: {factor.value * 100}%"
                ></div>
              </div>
              <span class="text-xs text-gray-400">
                {Math.round(factor.value * 100)}%
              </span>
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-3 pt-2 border-t border-gray-700">
        <div class="text-xs {confidenceColor}">
          {action}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Inline confidence bar variant -->
{#if size === 'lg' && showDetails}
  <div class="mt-2 space-y-1">
    <!-- Full width bar -->
    <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        class="h-full {bgColor} transition-all duration-500 ease-out"
        style="width: {confidencePercent}%"
      ></div>
    </div>

    <!-- Scale labels -->
    <div class="flex justify-between text-xs text-gray-500">
      <span>Low</span>
      <span>Medium</span>
      <span>High</span>
    </div>

    <!-- Action label -->
    <div class="text-center text-sm {confidenceColor}">
      {action}
    </div>
  </div>
{/if}

<style>
  .confidence-indicator {
    position: relative;
  }

  /* Animate the progress ring on mount */
  :global(.confidence-indicator svg circle:last-child) {
    animation: ring-progress 0.8s ease-out;
  }

  @keyframes ring-progress {
    from {
      stroke-dasharray: 0 100;
    }
  }
</style>
