<script lang="ts">
  /**
   * CreditUsageWidget - Compact display of credit usage with high accuracy
   * Fetches /api/billing/me and shows cost used, limit, call count, and progress bar
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api.js';
  import { setCurrentView } from '../stores/uiStore';

  interface BillingMe {
    tier?: string | null;
    usage?: number;
    usageCalls?: number;
    limit?: number | string | null;
    costUsedUsd?: number;
    costLimitUsd?: number | null;
    tokenCredits?: number;
  }

  let usage = $state<number | null>(null);
  let limit = $state<number | string | null>(null);
  let costUsedUsd = $state<number | null>(null);
  let costLimitUsd = $state<number | null>(null);
  let usageCalls = $state<number>(0);
  let _tier = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      const res = await fetchApi('/api/billing/me');
      const data = (await res.json()) as BillingMe;
      usage = data.usage ?? 0;
      limit = data.limit ?? null;
      costUsedUsd = data.costUsedUsd ?? null;
      costLimitUsd = data.costLimitUsd ?? null;
      usageCalls = data.usageCalls ?? 0;
      _tier = data.tier ?? null;
    } catch {
      usage = null;
      limit = null;
      costUsedUsd = null;
      costLimitUsd = null;
      usageCalls = 0;
      _tier = null;
    } finally {
      loading = false;
    }
  });

  const displayText = $derived.by(() => {
    if (costUsedUsd != null) {
      const used = `$${costUsedUsd.toFixed(4)}`;
      const lim =
        costLimitUsd != null && Number.isFinite(costLimitUsd)
          ? ` / $${costLimitUsd.toFixed(2)}`
          : '';
      return used + lim;
    }
    if (usage != null) {
      const lim =
        limit != null && limit !== '∞' ? ` / ${typeof limit === 'number' ? limit : limit}` : '';
      return `${usage}${lim}`;
    }
    return '';
  });

  const percentUsed = $derived.by(() => {
    if (costUsedUsd != null && costLimitUsd != null && costLimitUsd > 0) {
      return Math.min(100, (costUsedUsd / costLimitUsd) * 100);
    }
    if (usage != null && limit != null && typeof limit === 'number' && limit > 0) {
      return Math.min(100, (usage / limit) * 100);
    }
    return 0;
  });

  const barColor = $derived.by(() => {
    if (percentUsed >= 90) return '#ef4444'; // red
    if (percentUsed >= 70) return '#f59e0b'; // amber
    return '#7c3aed'; // purple
  });

  function goToCredits() {
    setCurrentView('credits');
  }
</script>

{#if !loading && usage != null}
  <button
    type="button"
    class="credit-widget"
    onclick={goToCredits}
    title="View usage and budget — {usageCalls} API calls this month"
  >
    <div class="credit-top">
      <span class="credit-label">{costUsedUsd != null ? 'Usage' : 'Credits'}</span>
      <span class="credit-value">{displayText}</span>
    </div>
    <div class="credit-bar-track">
      <div class="credit-bar-fill" style:width="{percentUsed}%" style:background={barColor}></div>
    </div>
    <div class="credit-bottom">
      <span class="credit-calls">{usageCalls} calls</span>
      <span class="credit-pct">{percentUsed.toFixed(1)}%</span>
    </div>
  </button>
{/if}

<style>
  .credit-widget {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: rgba(124, 58, 237, 0.06);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: 8px;
    font-size: 0.75rem;
    color: #4b5563;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .credit-widget:hover {
    background: rgba(124, 58, 237, 0.1);
    border-color: rgba(124, 58, 237, 0.25);
  }

  .credit-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .credit-label {
    font-weight: 500;
  }

  .credit-value {
    font-weight: 700;
    color: #7c3aed;
    font-variant-numeric: tabular-nums;
  }

  .credit-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .credit-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .credit-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.625rem;
    color: #9ca3af;
    font-variant-numeric: tabular-nums;
  }

  .credit-calls {
    font-weight: 400;
  }

  .credit-pct {
    font-weight: 500;
  }
</style>
