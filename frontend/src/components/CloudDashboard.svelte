<script lang="ts">
  /**
   * Cloud Dashboard – unified view of infrastructure.
   * Data from API only; no client-side mock.
   */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { writable, derived } from 'svelte/store';
  import { fetchApi } from '$lib/api.js';
  import { setCurrentView } from '../stores/uiStore';
  import {
    type Integration,
    type Deployment,
    type CloudResource,
    type CostSummary,
  } from './cloud/cloudUtils';
  import CloudOverviewTab from './cloud/CloudOverviewTab.svelte';
  import CloudDeploymentsTab from './cloud/CloudDeploymentsTab.svelte';
  import CloudResourcesTab from './cloud/CloudResourcesTab.svelte';
  import CloudCostsTab from './cloud/CloudCostsTab.svelte';

  // Props
  interface Props {
    onBack?: () => void;
  }
  let { onBack }: Props = $props();

  // State
  const integrations = writable<Integration[]>([]);
  const deployments = writable<Deployment[]>([]);
  const resources = writable<CloudResource[]>([]);
  const costs = writable<CostSummary[]>([]);
  const isLoading = writable(true);
  const activeTab = writable<'overview' | 'deployments' | 'resources' | 'costs'>('overview');

  // Derived
  const connectedIntegrations = derived(integrations, ($i) => $i.filter((i) => i.connected));
  const recentDeployments = derived(deployments, ($d) => $d.slice(0, 5));
  const totalMonthlyCost = derived(costs, ($c) => $c.reduce((sum, c) => sum + c.current, 0));

  async function loadDashboardData() {
    isLoading.set(true);
    try {
      const response = await fetchApi('/api/cloud/dashboard');
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const json = await response.json();
      const payload = json.data ?? {};
      integrations.set(Array.isArray(payload.integrations) ? payload.integrations : []);
      deployments.set(Array.isArray(payload.deployments) ? payload.deployments : []);
      resources.set(Array.isArray(payload.resources) ? payload.resources : []);
      costs.set(Array.isArray(payload.costs) ? payload.costs : []);
    } catch (error) {
      console.warn('Failed to fetch cloud dashboard data:', error);
      integrations.set([]);
      deployments.set([]);
      resources.set([]);
      costs.set([]);
    } finally {
      isLoading.set(false);
    }
  }

  onMount(() => {
    loadDashboardData();
  });
</script>

<div class="cloud-dashboard" in:fade={{ duration: 200 }}>
  <!-- Header -->
  <header class="dashboard-header">
    <div class="header-left">
      {#if onBack}
        <button class="back-btn" onclick={onBack} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      {/if}
      <div class="header-title">
        <h1>Cloud Dashboard</h1>
        <span class="subtitle">Manage deployments, infrastructure & costs</span>
      </div>
    </div>
    <button class="action-btn primary" onclick={() => setCurrentView('integrations')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Connect Integration
    </button>
  </header>

  <!-- Tabs -->
  <nav class="tabs">
    <button
      class="tab"
      class:active={$activeTab === 'overview'}
      onclick={() => activeTab.set('overview')}>Overview</button
    >
    <button
      class="tab"
      class:active={$activeTab === 'deployments'}
      onclick={() => activeTab.set('deployments')}>Deployments</button
    >
    <button
      class="tab"
      class:active={$activeTab === 'resources'}
      onclick={() => activeTab.set('resources')}>Resources</button
    >
    <button class="tab" class:active={$activeTab === 'costs'} onclick={() => activeTab.set('costs')}
      >Costs</button
    >
  </nav>

  <!-- Content — each tab is its own component -->
  <div class="dashboard-content">
    {#if $isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading dashboard...</span>
      </div>
    {:else if $activeTab === 'overview'}
      <CloudOverviewTab
        connectedIntegrations={$connectedIntegrations}
        integrations={$integrations}
        deployments={$deployments}
        recentDeployments={$recentDeployments}
        resources={$resources}
        costs={$costs}
        totalMonthlyCost={$totalMonthlyCost}
        onSwitchTab={(tab) => activeTab.set(tab)}
      />
    {:else if $activeTab === 'deployments'}
      <CloudDeploymentsTab deployments={$deployments} />
    {:else if $activeTab === 'resources'}
      <CloudResourcesTab resources={$resources} />
    {:else if $activeTab === 'costs'}
      <CloudCostsTab costs={$costs} resources={$resources} totalMonthlyCost={$totalMonthlyCost} />
    {/if}
  </div>
</div>

<style>
  .cloud-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-app, #fff);
    color: var(--color-text, #1f1147);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--color-border, #e9d5ff);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: var(--color-text-secondary, #4c1d95);
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;
  }

  .back-btn:hover {
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .back-btn svg {
    width: 20px;
    height: 20px;
  }

  .header-title h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6d28d9);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    background: transparent;
    color: var(--color-text, #1f1147);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn.primary {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
    color: white;
  }

  .action-btn.primary:hover {
    background: var(--color-primary-hover, #6d28d9);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .tab {
    padding: 0.875rem 1.25rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted, #6d28d9);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--color-text, #1f1147);
  }

  .tab.active {
    color: var(--color-primary, #7c3aed);
    border-bottom-color: var(--color-primary, #7c3aed);
  }

  .dashboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--color-text-muted, #6d28d9);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e9d5ff);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Overview Grid */
  .overview-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    transition: all 0.2s;
  }

  .stat-card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
  }

  .stat-icon.connected {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .stat-icon.deployments {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .stat-icon.resources {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
  }

  .stat-icon.costs {
    background: rgba(234, 179, 8, 0.1);
    color: #eab308;
  }

  .stat-icon svg {
    width: 24px;
    height: 24px;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6d28d9);
  }

  /* Sections */
  .section {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .section-header .section-title {
    margin: 0;
  }

  .view-all-btn {
    font-size: 0.8125rem;
    color: var(--color-primary, #7c3aed);
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 500;
  }

  .view-all-btn:hover {
    text-decoration: underline;
  }

  /* Integrations Grid */
  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
  }

  .empty-state p {
    margin: 0 0 0.75rem;
  }

  .empty-state .empty-state-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #9ca3af);
    margin-bottom: 1rem;
  }

  .empty-state .action-btn {
    margin-top: 0.5rem;
  }

  .integration-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 10px;
    transition: all 0.2s;
    position: relative;
  }

  .integration-card.connected {
    background: var(--color-bg-card, #fff);
  }

  .integration-card.disconnected {
    background: var(--color-bg-subtle, #f5f3ff);
    opacity: 0.7;
  }

  .integration-card:hover {
    border-color: var(--color-primary, #7c3aed);
  }

  .integration-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--color-primary, #7c3aed);
    color: white;
    font-weight: 600;
    font-size: 1rem;
  }

  .integration-icon.vercel {
    background: #000;
  }
  .integration-icon.netlify {
    background: #00c7b7;
  }
  .integration-icon.aws {
    background: #ff9900;
  }
  .integration-icon.gcp {
    background: #4285f4;
  }
  .integration-icon.azure {
    background: #0078d4;
  }
  .integration-icon.supabase {
    background: #3ecf8e;
  }
  .integration-icon.firebase {
    background: #ffca28;
    color: #000;
  }
  .integration-icon.github {
    background: #24292e;
  }
  .integration-icon.jira {
    background: #0052cc;
  }
  .integration-icon.linear {
    background: #5e6ad2;
  }

  .integration-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .integration-name {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .integration-status {
    font-size: 0.75rem;
  }

  .status-dot {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.healthy {
    background: #22c55e;
  }
  .status-dot.warning {
    background: #eab308;
  }
  .status-dot.error {
    background: #ef4444;
  }

  /* Deployments List */
  .deployments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .deployment-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 8px;
  }

  .deployment-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .deployment-project {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .provider-icon {
    width: 16px;
    height: 16px;
    color: var(--color-text-muted, #6d28d9);
  }

  .deployment-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
  }

  .branch::before {
    content: '';
  }
  .commit {
    font-family: var(--font-mono, monospace);
  }

  .deployment-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border: 1px solid;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .spinner-small {
    width: 10px;
    height: 10px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .visit-link {
    padding: 0.375rem;
    color: var(--color-text-muted, #6d28d9);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .visit-link:hover {
    background: var(--color-bg-card, #fff);
    color: var(--color-primary, #7c3aed);
  }

  .visit-link svg {
    width: 16px;
    height: 16px;
  }

  /* Cost Cards */
  .cost-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .cost-card {
    padding: 1rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 10px;
    text-align: center;
  }

  .cost-provider {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    margin-bottom: 0.25rem;
  }

  .cost-amount {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .cost-trend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .cost-trend.up {
    color: #ef4444;
  }
  .cost-trend.down {
    color: #22c55e;
  }
  .cost-trend.stable {
    color: var(--color-text-muted, #6d28d9);
  }

  .cost-trend svg {
    width: 12px;
    height: 12px;
  }

  /* Deployments Table */
  .deployments-table {
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 60px;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background: var(--color-bg-subtle, #f5f3ff);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted, #6d28d9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 60px;
    gap: 1rem;
    padding: 0.875rem 1rem;
    align-items: center;
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
    font-size: 0.875rem;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .project-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .commit-cell {
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
  }

  .action-icon {
    padding: 0.375rem;
    color: var(--color-text-muted, #6d28d9);
    border-radius: 6px;
  }

  .action-icon:hover {
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-primary, #7c3aed);
  }

  .action-icon svg {
    width: 16px;
    height: 16px;
  }

  /* Resources Grid */
  .resources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .resource-card {
    padding: 1.25rem;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    transition: all 0.2s;
  }

  .resource-card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }

  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .resource-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 10px;
    color: var(--color-primary, #7c3aed);
  }

  .resource-icon svg {
    width: 20px;
    height: 20px;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-indicator.running {
    background: #22c55e;
  }
  .status-indicator.stopped {
    background: #6b7280;
  }
  .status-indicator.pending {
    background: #eab308;
  }
  .status-indicator.error {
    background: #ef4444;
  }

  .resource-name {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.375rem;
  }

  .resource-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    margin-bottom: 0.75rem;
  }

  .resource-meta span {
    padding: 0.125rem 0.375rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 4px;
  }

  .resource-cost {
    font-weight: 600;
    color: var(--color-text-secondary, #4c1d95);
  }

  /* Costs Tab */
  .costs-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .cost-summary-card {
    padding: 2rem;
    background: linear-gradient(
      135deg,
      var(--color-primary, #7c3aed),
      var(--color-primary-hover, #6d28d9)
    );
    border-radius: 16px;
    color: white;
    text-align: center;
  }

  .summary-header h3 {
    font-size: 1rem;
    font-weight: 500;
    opacity: 0.9;
    margin: 0;
    color: white;
  }

  .summary-period {
    font-size: 0.8125rem;
    opacity: 0.7;
  }

  .summary-amount {
    font-size: 3rem;
    font-weight: 700;
    margin: 0.5rem 0;
  }

  .summary-forecast {
    font-size: 0.9375rem;
    opacity: 0.8;
  }

  .cost-breakdown,
  .cost-by-resource {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .cost-breakdown h3,
  .cost-by-resource h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .breakdown-item {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    gap: 1rem;
    align-items: center;
  }

  .breakdown-info {
    display: flex;
    justify-content: space-between;
  }

  .breakdown-provider {
    font-weight: 500;
  }

  .breakdown-amount {
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #6d28d9);
  }

  .breakdown-bar {
    height: 8px;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 4px;
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    background: var(--color-primary, #7c3aed);
    border-radius: 4px;
    transition: width 0.3s;
  }

  .breakdown-trend {
    font-size: 0.8125rem;
    font-weight: 500;
    min-width: 50px;
    text-align: right;
  }

  .breakdown-trend.up {
    color: #ef4444;
  }
  .breakdown-trend.down {
    color: #22c55e;
  }
  .breakdown-trend.stable {
    color: var(--color-text-muted, #6d28d9);
  }

  .resource-cost-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .resource-cost-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border-radius: 8px;
  }

  .resource-cost-name {
    font-weight: 500;
  }

  .resource-cost-type {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
  }

  .resource-cost-amount {
    font-weight: 600;
    font-family: var(--font-mono, monospace);
  }

  /* Text colors */
  .text-green-500 {
    color: #22c55e;
  }
  .text-yellow-500 {
    color: #eab308;
  }
  .text-red-500 {
    color: #ef4444;
  }
  .text-gray-400 {
    color: #9ca3af;
  }
  .text-gray-500 {
    color: #6b7280;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .dashboard-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .tabs {
      overflow-x: auto;
      padding: 0 1rem;
    }

    .dashboard-content {
      padding: 1rem;
    }

    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .table-header,
    .table-row {
      display: none;
    }

    .deployments-table {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .deployment-row,
    .stat-card,
    .tab-btn {
      transition: none !important;
    }
  }
</style>
