<script lang="ts">
  /**
   * CloudCostsTab – Cost breakdown panel for CloudDashboard.
   */
  import { fly } from 'svelte/transition';
  import { formatCurrency, type CostSummary, type CloudResource } from './cloudUtils';

  interface Props {
    costs: CostSummary[];
    resources: CloudResource[];
    totalMonthlyCost: number;
  }
  let { costs, resources, totalMonthlyCost }: Props = $props();
</script>

<div class="costs-tab" in:fly={{ y: 20, duration: 200 }}>
  <div class="cost-summary-card">
    <div class="summary-header">
      <h3>Total Monthly Cost</h3>
      <span class="summary-period">Current billing period</span>
    </div>
    <div class="summary-amount">{formatCurrency(totalMonthlyCost)}</div>
    <div class="summary-forecast">
      Forecast: {formatCurrency(costs.reduce((sum, c) => sum + c.forecast, 0))}
    </div>
  </div>

  <div class="cost-breakdown">
    <h3>Cost by Provider</h3>
    <div class="breakdown-list">
      {#each costs as cost}
        <div class="breakdown-item">
          <div class="breakdown-info">
            <span class="breakdown-provider">{cost.provider}</span>
            <span class="breakdown-amount">{formatCurrency(cost.current)}</span>
          </div>
          <div class="breakdown-bar">
            <div
              class="breakdown-fill"
              style="width: {(cost.current / totalMonthlyCost) * 100}%"
            ></div>
          </div>
          <div class="breakdown-trend {cost.trend}">
            {#if cost.trend === 'up'}+{/if}{cost.trendPercent}%
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="cost-by-resource">
    <h3>Cost by Resource</h3>
    <div class="resource-cost-list">
      {#each resources
        .filter((r) => r.cost)
        .sort((a, b) => (b.cost || 0) - (a.cost || 0)) as resource}
        <div class="resource-cost-item">
          <div class="resource-cost-info">
            <span class="resource-cost-name">{resource.name}</span>
            <span class="resource-cost-type"
              >{resource.type} - {resource.provider.toUpperCase()}</span
            >
          </div>
          <span class="resource-cost-amount">{formatCurrency(resource.cost || 0)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
