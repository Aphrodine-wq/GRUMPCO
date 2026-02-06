<script lang="ts">
  import Card from '$lib/design-system/components/Card/Card.svelte';
  import { fetchApi } from '$lib/api.js';

  interface CostEstimate {
    estimatedCost: number;
    breakdown: {
      inputCost: number;
      outputCost: number;
      inputTokens: number;
      outputTokens: number;
    };
    model: string;
    confidence: 'high' | 'medium' | 'low';
  }

  interface Props {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    show?: boolean;
  }

  let { messages, model, show = true }: Props = $props();

  let estimate = $state<CostEstimate | null>(null);
  let loading = $state(false);

  async function fetchEstimate() {
    if (!messages || messages.length === 0) {
      estimate = null;
      return;
    }

    loading = true;
    try {
      const response = await fetchApi('/api/cost/estimate', {
        method: 'POST',
        body: JSON.stringify({ messages, model }),
      });

      if (response.ok) {
        estimate = await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch cost estimate:', error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (show && messages.length > 0) {
      fetchEstimate();
    }
  });

  function getConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  function formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(4)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  }
</script>

{#if show && estimate}
  <div class="cost-preview">
    <Card>
      <div class="p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <svg
              class="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm font-semibold">Estimated Cost</span>
          </div>
          <span class={`text-xs font-medium ${getConfidenceColor(estimate.confidence)}`}>
            {estimate.confidence} confidence
          </span>
        </div>

        <div class="flex items-baseline gap-2 mb-3">
          <span class="text-2xl font-bold text-gray-900">
            {formatCost(estimate.estimatedCost)}
          </span>
          <span class="text-xs text-gray-500">per request</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="flex flex-col">
            <span class="text-gray-500">Input</span>
            <span class="font-medium">
              {estimate.breakdown.inputTokens.toLocaleString()} tokens
            </span>
            <span class="text-gray-600">{formatCost(estimate.breakdown.inputCost)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-500">Output (est.)</span>
            <span class="font-medium">
              {estimate.breakdown.outputTokens.toLocaleString()} tokens
            </span>
            <span class="text-gray-600">{formatCost(estimate.breakdown.outputCost)}</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-gray-200">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">Model: {estimate.model}</span>
            <button class="text-blue-600 hover:text-blue-700 font-medium">
              Compare models →
            </button>
          </div>
        </div>
      </div>
    </Card>
  </div>
{:else if loading}
  <div class="cost-preview">
    <Card>
      <div class="p-3">
        <div class="flex items-center gap-2">
          <div
            class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"
          ></div>
          <span class="text-sm text-gray-600">Calculating cost...</span>
        </div>
      </div>
    </Card>
  </div>
{/if}

<style>
  .cost-preview {
    position: sticky;
    bottom: 80px;
    z-index: 10;
    margin: 0 auto;
    max-width: 400px;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .cost-preview {
      bottom: 140px; /* Account for mobile nav */
    }
  }
</style>
