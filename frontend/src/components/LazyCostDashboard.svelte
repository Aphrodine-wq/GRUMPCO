<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  let CostDashboard: Component | null = $state(null);
  let err = $state<string | null>(null);

  onMount(() => {
    import('./CostDashboard.svelte')
      .then((m) => {
        CostDashboard = m.default;
      })
      .catch((e) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });
</script>

<div class="lazy-cost-dashboard">
  <header class="lazy-cost-dashboard__header">
    <button type="button" class="lazy-cost-dashboard__back" onclick={onBack}>← Back</button>
  </header>
  {#if err}
    <p class="lazy-cost-dashboard__error">Failed to load cost dashboard: {err}</p>
  {:else if CostDashboard}
    <div class="lazy-cost-dashboard__content">
      <CostDashboard />
    </div>
  {:else}
    <p class="lazy-cost-dashboard__loading">Loading cost dashboard…</p>
  {/if}
</div>

<style>
  .lazy-cost-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .lazy-cost-dashboard__header {
    flex: 0 0 auto;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }
  .lazy-cost-dashboard__back {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-secondary, #6b7280);
  }
  .lazy-cost-dashboard__back:hover {
    color: var(--color-text, #111);
  }
  .lazy-cost-dashboard__content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .lazy-cost-dashboard__loading,
  .lazy-cost-dashboard__error {
    padding: 24px;
    color: var(--color-text-secondary, #6b7280);
  }
  .lazy-cost-dashboard__error {
    color: var(--color-error, #dc2626);
  }
</style>
