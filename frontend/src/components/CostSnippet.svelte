<script lang="ts">
  import { onMount } from 'svelte';
  import { getApiBase } from '../lib/api.js';
  import { showCostDashboard } from '../stores/uiStore';

  interface Props {
    /** When true, show compact one-line format */
    compact?: boolean;
    /** Refresh interval in ms (0 = no refresh) */
    refreshMs?: number;
  }

  let { compact = true, refreshMs = 60000 }: Props = $props();

  let todayUsd = $state<number | null>(null);
  let requestCount = $state<number>(0);
  let loading = $state(true);
  let error = $state(false);

  async function fetchSnippet() {
    try {
      loading = true;
      error = false;
      const base = getApiBase();
      const res = await fetch(`${base}/api/cost/snippet`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      todayUsd = data.todayUsd ?? 0;
      requestCount = data.requestCount ?? 0;
    } catch {
      error = true;
      todayUsd = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchSnippet();
    if (refreshMs > 0) {
      const t = setInterval(fetchSnippet, refreshMs);
      return () => clearInterval(t);
    }
    return undefined;
  });

  function formatUsd(n: number): string {
    if (n < 0.01) return `$${(n * 100).toFixed(2)}¢`;
    return `$${n.toFixed(2)}`;
  }

  function openCostDashboard() {
    showCostDashboard.set(true);
  }
</script>

{#if loading}
  <div class="cost-snippet cost-snippet--loading" class:compact>
    <span class="cost-snippet-dot"></span>
    {#if !compact}<span>Cost…</span>{/if}
  </div>
{:else if error}
  <div class="cost-snippet cost-snippet--error" class:compact title="Cost API unavailable">
    {#if !compact}<span>Cost unavailable</span>{/if}
  </div>
{:else if todayUsd !== null}
  <button
    type="button"
    class="cost-snippet cost-snippet--ok"
    class:compact
    title="Today's usage. Open Settings for full cost dashboard."
    onclick={openCostDashboard}
  >
    <span class="cost-snippet-label">Today</span>
    <span class="cost-snippet-value">{formatUsd(todayUsd)}</span>
    {#if requestCount > 0 && !compact}
      <span class="cost-snippet-count">({requestCount})</span>
    {/if}
  </button>
{/if}

<style>
  .cost-snippet {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    background: var(--color-bg-subtle, #f3f4f6);
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary, #6b7280);
  }
  .cost-snippet.compact {
    padding: 4px 8px;
    font-size: 11px;
  }
  .cost-snippet--ok:hover {
    background: var(--color-bg-card-hover, #e5e7eb);
    color: var(--color-text, #111);
  }
  .cost-snippet--loading .cost-snippet-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary, #3b82f6);
    animation: pulse 1s ease-in-out infinite;
  }
  .cost-snippet--error {
    opacity: 0.7;
  }
  .cost-snippet-label {
    font-weight: 500;
  }
  .cost-snippet-value {
    font-weight: 600;
    color: var(--color-text, #111);
  }
  .cost-snippet-count {
    font-size: 11px;
    color: var(--color-text-muted, #9ca3af);
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
