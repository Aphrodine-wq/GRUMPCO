<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import ScreenLayout from './ScreenLayout.svelte';

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

<ScreenLayout title="Cost dashboard" {onBack}>
  {#if err}
    <p class="lazy-cost-dashboard__error">Failed to load cost dashboard: {err}</p>
  {:else if CostDashboard}
    <div class="lazy-cost-dashboard__content">
      <CostDashboard />
    </div>
  {:else}
    <p class="lazy-cost-dashboard__loading">Loading cost dashboard…</p>
  {/if}
</ScreenLayout>

<style>
  .lazy-cost-dashboard__content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .lazy-cost-dashboard__loading {
    padding: 24px;
    color: var(--color-text-muted, #6b7280);
  }
</style>
