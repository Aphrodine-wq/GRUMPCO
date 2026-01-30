<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface CostSummary {
    totalCost: number;
    totalRequests: number;
    cacheHitRate: number;
    cacheSavings: number;
    modelRoutingSavings: number;
    totalSavings: number;
    costByModel: Record<string, number>;
    costByOperation: Record<string, number>;
    costByDay: Array<{ date: string; cost: number }>;
  }

  interface BudgetStatus {
    withinBudget: boolean;
    dailyUsed: number;
    dailyLimit?: number;
    monthlyUsed: number;
    monthlyLimit?: number;
    alertTriggered: boolean;
  }

  let summary: CostSummary | null = null;
  let budget: BudgetStatus | null = null;
  let recommendations: string[] = [];
  let realtime: { last24Hours: number; lastHour: number; currentRate: number } | null = null;
  let savings: { totalRequests: number; cheapModelUsed: number; cheapModelPercentage: number; estimatedSavings: number } | null = null;
  let statsData: {
    cache?: { byNamespace?: Record<string, { hits: number; misses: number; hitRate: number }> };
    gpu?: { utilization: number; memoryUsed: number; memoryTotal: number } | null;
  } | null = null;
  let loading = true;
  let error: string | null = null;
  let refreshInterval: number | null = null;

  const API_BASE = 'http://localhost:3000/api/cost';

  async function fetchData() {
    try {
      loading = true;
      error = null;

      const [summaryRes, budgetRes, recommendationsRes, realtimeRes, savingsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/summary`),
        fetch(`${API_BASE}/budget`),
        fetch(`${API_BASE}/recommendations`),
        fetch(`${API_BASE}/realtime`),
        fetch(`${API_BASE}/savings`),
        fetch(`${API_BASE}/stats`),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        summary = data.data;
      }

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        budget = data.data;
      }

      if (recommendationsRes.ok) {
        const data = await recommendationsRes.json();
        recommendations = data.data.recommendations;
      }

      if (realtimeRes.ok) {
        const data = await realtimeRes.json();
        realtime = data.data;
      }

      if (savingsRes.ok) {
        const data = await savingsRes.json();
        savings = data.data;
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        statsData = data.data ?? null;
      }

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load cost data';
      loading = false;
    }
  }

  onMount(() => {
    fetchData();
    // Refresh every 30 seconds
    refreshInterval = setInterval(fetchData, 30000) as unknown as number;
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }
</script>

<div class="cost-dashboard">
  <div class="header">
    <h1>Cost Analytics Dashboard</h1>
    <button on:click={fetchData} disabled={loading}>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
  </div>

  {#if error}
    <div class="error-banner">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  {#if !loading && summary}
    <!-- Real-time metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Total Cost</h3>
        <div class="metric-value">{formatCurrency(summary.totalCost)}</div>
        <div class="metric-label">{summary.totalRequests} requests</div>
      </div>

      <div class="metric-card">
        <h3>Cache Hit Rate</h3>
        <div class="metric-value">{formatPercent(summary.cacheHitRate)}</div>
        <div class="metric-label">Cache savings: {formatCurrency(summary.cacheSavings)}</div>
      </div>

      <div class="metric-card">
        <h3>Total Savings</h3>
        <div class="metric-value success">{formatCurrency(summary.totalSavings)}</div>
        <div class="metric-label">
          Cache + Routing: {formatCurrency(summary.cacheSavings + summary.modelRoutingSavings)}
        </div>
      </div>

      {#if realtime}
        <div class="metric-card">
          <h3>Current Rate</h3>
          <div class="metric-value">{formatCurrency(realtime.currentRate)}/hr</div>
          <div class="metric-label">Last 24h: {formatCurrency(realtime.last24Hours)}</div>
        </div>
      {/if}
    </div>

    <!-- Budget status -->
    {#if budget}
      <div class="budget-section">
        <h2>Budget Status</h2>
        <div class="budget-grid">
          <div class="budget-card {budget.withinBudget ? 'success' : 'danger'}">
            <h4>Daily Budget</h4>
            <div class="budget-bar">
              <div
                class="budget-fill"
                style="width: {budget.dailyLimit ? Math.min(100, (budget.dailyUsed / budget.dailyLimit) * 100) : 0}%"
              ></div>
            </div>
            <div class="budget-text">
              {formatCurrency(budget.dailyUsed)}
              {#if budget.dailyLimit}
                / {formatCurrency(budget.dailyLimit)}
              {/if}
            </div>
          </div>

          <div class="budget-card {budget.withinBudget ? 'success' : 'danger'}">
            <h4>Monthly Budget</h4>
            <div class="budget-bar">
              <div
                class="budget-fill"
                style="width: {budget.monthlyLimit ? Math.min(100, (budget.monthlyUsed / budget.monthlyLimit) * 100) : 0}%"
              ></div>
            </div>
            <div class="budget-text">
              {formatCurrency(budget.monthlyUsed)}
              {#if budget.monthlyLimit}
                / {formatCurrency(budget.monthlyLimit)}
              {/if}
            </div>
          </div>
        </div>

        {#if budget.alertTriggered}
          <div class="alert warning">
            Budget alert triggered! You're approaching your limit.
          </div>
        {/if}

        {#if !budget.withinBudget}
          <div class="alert danger">
            Budget exceeded! Consider optimizing usage or increasing limits.
          </div>
        {/if}
      </div>
    {/if}

    <!-- Cost breakdown -->
    <div class="breakdown-section">
      <h2>Cost Breakdown</h2>
      
      <div class="breakdown-grid">
        <div class="breakdown-card">
          <h3>By Model</h3>
          <div class="breakdown-list">
            {#each Object.entries(summary.costByModel).sort((a, b) => b[1] - a[1]) as [model, cost]}
              <div class="breakdown-item">
                <span class="breakdown-label">{model}</span>
                <span class="breakdown-value">{formatCurrency(cost)}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="breakdown-card">
          <h3>By Operation</h3>
          <div class="breakdown-list">
            {#each Object.entries(summary.costByOperation).sort((a, b) => b[1] - a[1]) as [operation, cost]}
              <div class="breakdown-item">
                <span class="breakdown-label">{operation}</span>
                <span class="breakdown-value">{formatCurrency(cost)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Cost over time -->
    {#if summary.costByDay.length > 0}
      <div class="chart-section">
        <h2>Cost Over Time</h2>
        <div class="simple-chart">
          {#each summary.costByDay as day}
            <div class="chart-bar">
              <div class="bar-fill" style="height: {(day.cost / Math.max(...summary.costByDay.map(d => d.cost))) * 100}%"></div>
              <div class="bar-label">{day.date.split('-')[2]}</div>
              <div class="bar-value">{formatCurrency(day.cost)}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Optimization recommendations -->
    {#if recommendations.length > 0}
      <div class="recommendations-section">
        <h2>Optimization Recommendations</h2>
        <div class="recommendations-list">
          {#each recommendations as recommendation}
            <div class="recommendation-item">
              <span class="recommendation-icon">💡</span>
              <span class="recommendation-text">{recommendation}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Savings summary -->
    {#if savings}
      <div class="savings-section">
        <h2>Cost Optimization Impact</h2>
        <div class="savings-grid">
          <div class="savings-card">
            <h4>Requests Using Cheap Model</h4>
            <div class="savings-value">{savings.cheapModelPercentage.toFixed(1)}%</div>
            <div class="savings-label">{savings.cheapModelUsed} / {savings.totalRequests} requests</div>
          </div>
          <div class="savings-card">
            <h4>Estimated Savings</h4>
            <div class="savings-value success">{formatCurrency(savings.estimatedSavings)}</div>
            <div class="savings-label">From smart model routing</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- GPU utilization (NIM/local); placeholder when not available -->
    <div class="gpu-section">
      <h2>GPU Utilization</h2>
      {#if statsData?.gpu}
        <div class="gpu-grid">
          <div class="metric-card">
            <h3>Utilization</h3>
            <div class="metric-value">{((statsData.gpu.utilization ?? 0) * 100).toFixed(1)}%</div>
            <div class="metric-label">NIM / local GPU</div>
          </div>
          <div class="metric-card">
            <h3>Memory</h3>
            <div class="metric-value">
              {statsData.gpu.memoryTotal
                ? `${((statsData.gpu.memoryUsed ?? 0) / 1024).toFixed(1)} / ${(statsData.gpu.memoryTotal / 1024).toFixed(1)} GB`
                : '—'}
            </div>
            <div class="metric-label">Used / Total</div>
          </div>
        </div>
      {:else}
        <div class="gpu-placeholder">
          <p>GPU utilization is shown here when NVIDIA NIM or local GPU inference is enabled.</p>
          <p class="gpu-hint">Set <code>NVIDIA_NIM_API_KEY</code> (or configure local GPU) to see metrics.</p>
        </div>
      {/if}
    </div>
  {:else if loading}
    <div class="loading">Loading cost data...</div>
  {/if}
</div>

<style>
  .cost-dashboard {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
  }

  button {
    padding: 0.5rem 1rem;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  button:hover:not(:disabled) {
    background: #0052a3;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .metric-card h3 {
    font-size: 0.9rem;
    color: #666;
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: #333;
    margin-bottom: 0.25rem;
  }

  .metric-value.success {
    color: #28a745;
  }

  .metric-label {
    font-size: 0.85rem;
    color: #888;
  }

  .cache-namespace-section {
    margin-bottom: 2rem;
  }

  .cache-namespace-table-wrap {
    overflow-x: auto;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  .cache-namespace-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .cache-namespace-table th,
  .cache-namespace-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .cache-namespace-table th {
    background: #f8f9fa;
    color: #666;
    font-weight: 600;
  }

  .cache-namespace-table tbody tr:hover {
    background: #f8f9fa;
  }

  .budget-section,
  .breakdown-section,
  .chart-section,
  .recommendations-section,
  .savings-section {
    margin-bottom: 2rem;
  }

  .gpu-section {
    margin-bottom: 2rem;
  }

  .gpu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .gpu-placeholder {
    background: #f8f9fa;
    border: 1px dashed #dee2e6;
    border-radius: 8px;
    padding: 1.5rem;
    color: #6c757d;
    font-size: 0.9rem;
  }

  .gpu-placeholder p {
    margin: 0 0 0.5rem 0;
  }

  .gpu-hint {
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  .gpu-hint code {
    background: #e9ecef;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .budget-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .budget-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .budget-card.success {
    border-left: 4px solid #28a745;
  }

  .budget-card.danger {
    border-left: 4px solid #dc3545;
  }

  .budget-card h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }

  .budget-bar {
    height: 8px;
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .budget-fill {
    height: 100%;
    background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
    transition: width 0.3s ease;
  }

  .budget-text {
    font-size: 0.9rem;
    color: #666;
  }

  .alert {
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
  }

  .alert.warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
    color: #856404;
  }

  .alert.danger {
    background: #f8d7da;
    border: 1px solid #dc3545;
    color: #721c24;
  }

  .breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1rem;
  }

  .breakdown-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .breakdown-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .breakdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .breakdown-label {
    font-size: 0.9rem;
    color: #333;
  }

  .breakdown-value {
    font-weight: 600;
    color: #0066cc;
  }

  .simple-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 200px;
    padding: 1rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  .chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .bar-fill {
    width: 100%;
    background: linear-gradient(180deg, #0066cc, #0052a3);
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: height 0.3s ease;
  }

  .bar-label {
    font-size: 0.75rem;
    color: #666;
  }

  .bar-value {
    font-size: 0.7rem;
    color: #999;
  }

  .recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .recommendation-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-left: 4px solid #ffc107;
    border-radius: 4px;
  }

  .recommendation-icon {
    font-size: 1.5rem;
  }

  .recommendation-text {
    flex: 1;
    font-size: 0.95rem;
    color: #333;
    line-height: 1.5;
  }

  .savings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .savings-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .savings-card h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #666;
  }

  .savings-value {
    font-size: 2rem;
    font-weight: 700;
    color: #333;
    margin-bottom: 0.25rem;
  }

  .savings-value.success {
    color: #28a745;
  }

  .savings-label {
    font-size: 0.85rem;
    color: #888;
  }

  .loading {
    text-align: center;
    padding: 4rem;
    color: #666;
  }

  .error-banner {
    background: #f8d7da;
    border: 1px solid #dc3545;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
</style>
