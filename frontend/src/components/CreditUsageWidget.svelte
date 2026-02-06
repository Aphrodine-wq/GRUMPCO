<script lang="ts">
  /**
   * CreditUsageWidget - Compact display of credit usage for free/Pro/Team users
   * Fetches /api/billing/me and shows usage vs limit
   */
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api.js';
  import { setCurrentView } from '../stores/uiStore';

  interface BillingMe {
    tier?: string | null;
    usage?: number;
    limit?: number | string | null;
  }

  let usage = $state<number | null>(null);
  let limit = $state<number | string | null>(null);
  let tier = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      const res = await fetchApi('/api/billing/me');
      const data = (await res.json()) as BillingMe;
      usage = data.usage ?? 0;
      limit = data.limit ?? null;
      tier = data.tier ?? null;
    } catch {
      usage = null;
      limit = null;
      tier = null;
    } finally {
      loading = false;
    }
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
    title="View credit usage and plans"
  >
    <span class="credit-label">Credits</span>
    <span class="credit-value">
      {usage}
      {#if limit != null && limit !== '∞'}
        / {typeof limit === 'number' ? limit : limit}
      {/if}
    </span>
  </button>
{/if}

<style>
  .credit-widget {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
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

  .credit-label {
    font-weight: 500;
  }

  .credit-value {
    font-weight: 600;
    color: #7c3aed;
  }
</style>
