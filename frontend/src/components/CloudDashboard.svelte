<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { writable, derived } from 'svelte/store';

  // Props
  interface Props {
    onBack?: () => void;
  }
  let { onBack }: Props = $props();

  // Types
  interface Integration {
    id: string;
    name: string;
    icon: string;
    category: 'deploy' | 'cloud' | 'baas' | 'vcs' | 'pm';
    connected: boolean;
    lastSync?: string;
    status?: 'healthy' | 'warning' | 'error';
  }

  interface Deployment {
    id: string;
    project: string;
    provider: 'vercel' | 'netlify';
    status: 'ready' | 'building' | 'error' | 'queued';
    url?: string;
    branch: string;
    commit: string;
    createdAt: string;
    duration?: number;
  }

  interface CloudResource {
    id: string;
    name: string;
    provider: 'aws' | 'gcp' | 'azure';
    type: 'compute' | 'database' | 'storage' | 'serverless' | 'container';
    status: 'running' | 'stopped' | 'pending' | 'error';
    region: string;
    cost?: number;
  }

  interface CostSummary {
    provider: string;
    current: number;
    forecast: number;
    trend: 'up' | 'down' | 'stable';
    trendPercent: number;
  }

  // State
  const integrations = writable<Integration[]>([]);
  const deployments = writable<Deployment[]>([]);
  const resources = writable<CloudResource[]>([]);
  const costs = writable<CostSummary[]>([]);
  const isLoading = writable(true);
  const activeTab = writable<'overview' | 'deployments' | 'resources' | 'costs'>('overview');

  // Derived
  const connectedIntegrations = derived(integrations, $i => $i.filter(i => i.connected));
  const recentDeployments = derived(deployments, $d => $d.slice(0, 5));
  const totalMonthlyCost = derived(costs, $c => $c.reduce((sum, c) => sum + c.current, 0));

  // Mock data for demo
  function loadMockData() {
    integrations.set([
      { id: 'vercel', name: 'Vercel', icon: 'vercel', category: 'deploy', connected: true, lastSync: new Date().toISOString(), status: 'healthy' },
      { id: 'netlify', name: 'Netlify', icon: 'netlify', category: 'deploy', connected: true, lastSync: new Date().toISOString(), status: 'healthy' },
      { id: 'aws', name: 'AWS', icon: 'aws', category: 'cloud', connected: true, lastSync: new Date().toISOString(), status: 'healthy' },
      { id: 'gcp', name: 'Google Cloud', icon: 'gcp', category: 'cloud', connected: false },
      { id: 'azure', name: 'Azure', icon: 'azure', category: 'cloud', connected: false },
      { id: 'supabase', name: 'Supabase', icon: 'supabase', category: 'baas', connected: true, lastSync: new Date().toISOString(), status: 'healthy' },
      { id: 'firebase', name: 'Firebase', icon: 'firebase', category: 'baas', connected: false },
      { id: 'github', name: 'GitHub', icon: 'github', category: 'vcs', connected: true, lastSync: new Date().toISOString(), status: 'healthy' },
      { id: 'jira', name: 'Jira', icon: 'jira', category: 'pm', connected: true, lastSync: new Date().toISOString(), status: 'warning' },
      { id: 'linear', name: 'Linear', icon: 'linear', category: 'pm', connected: false },
    ]);

    deployments.set([
      { id: 'd1', project: 'g-rump-app', provider: 'vercel', status: 'ready', url: 'https://g-rump.vercel.app', branch: 'main', commit: 'abc123', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), duration: 45 },
      { id: 'd2', project: 'g-rump-docs', provider: 'netlify', status: 'building', branch: 'main', commit: 'def456', createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
      { id: 'd3', project: 'g-rump-api', provider: 'vercel', status: 'ready', url: 'https://api.g-rump.dev', branch: 'main', commit: 'ghi789', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), duration: 62 },
      { id: 'd4', project: 'g-rump-app', provider: 'vercel', status: 'error', branch: 'feature/dark-mode', commit: 'jkl012', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
      { id: 'd5', project: 'landing-page', provider: 'netlify', status: 'ready', url: 'https://grump.io', branch: 'main', commit: 'mno345', createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), duration: 28 },
    ]);

    resources.set([
      { id: 'r1', name: 'prod-api-cluster', provider: 'aws', type: 'container', status: 'running', region: 'us-east-1', cost: 145.50 },
      { id: 'r2', name: 'main-db', provider: 'aws', type: 'database', status: 'running', region: 'us-east-1', cost: 89.99 },
      { id: 'r3', name: 'static-assets', provider: 'aws', type: 'storage', status: 'running', region: 'us-east-1', cost: 12.30 },
      { id: 'r4', name: 'ai-inference', provider: 'gcp', type: 'compute', status: 'running', region: 'us-central1', cost: 234.00 },
      { id: 'r5', name: 'edge-functions', provider: 'aws', type: 'serverless', status: 'running', region: 'global', cost: 45.67 },
    ]);

    costs.set([
      { provider: 'AWS', current: 293.46, forecast: 320.00, trend: 'up', trendPercent: 8 },
      { provider: 'GCP', current: 234.00, forecast: 250.00, trend: 'up', trendPercent: 5 },
      { provider: 'Vercel', current: 20.00, forecast: 20.00, trend: 'stable', trendPercent: 0 },
      { provider: 'Supabase', current: 25.00, forecast: 25.00, trend: 'stable', trendPercent: 0 },
    ]);

    isLoading.set(false);
  }

  onMount(() => {
    loadMockData();
  });

  // Helpers
  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'ready':
      case 'running':
      case 'healthy':
        return 'text-green-500';
      case 'building':
      case 'pending':
      case 'queued':
        return 'text-yellow-500';
      case 'error':
      case 'warning':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  }

  function getStatusBg(status: string): string {
    switch (status) {
      case 'ready':
      case 'running':
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30';
      case 'building':
      case 'pending':
      case 'queued':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'error':
      case 'warning':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  }

  function getProviderIcon(provider: string): string {
    switch (provider) {
      case 'vercel': return 'M12 2L2 20h20L12 2z';
      case 'netlify': return 'M12 2L2 12l10 10 10-10L12 2z';
      case 'aws': return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
      case 'gcp': return 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5';
      case 'azure': return 'M12 2L2 12l10 10 10-10L12 2z';
      default: return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
    }
  }

  function getResourceIcon(type: string): string {
    switch (type) {
      case 'compute': return 'M4 6h16M4 10h16M4 14h16M4 18h16';
      case 'database': return 'M12 2C6.48 2 2 4.5 2 7.5v9C2 19.5 6.48 22 12 22s10-2.5 10-5.5v-9C22 4.5 17.52 2 12 2z';
      case 'storage': return 'M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z';
      case 'serverless': return 'M13 10V3L4 14h7v7l9-11h-7z';
      case 'container': return 'M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM7 12h2M11 12h2M15 12h2';
      default: return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
    }
  }
</script>

<div class="cloud-dashboard" in:fade={{ duration: 200 }}>
  <!-- Header -->
  <header class="dashboard-header">
    <div class="header-left">
      {#if onBack}
        <button class="back-btn" onclick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      {/if}
      <div class="header-title">
        <h1>Cloud Dashboard</h1>
        <span class="subtitle">Unified view of your infrastructure</span>
      </div>
    </div>
    <div class="header-actions">
      <button class="action-btn primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Connect Integration
      </button>
    </div>
  </header>

  <!-- Tabs -->
  <nav class="tabs">
    <button 
      class="tab" 
      class:active={$activeTab === 'overview'}
      onclick={() => activeTab.set('overview')}
    >
      Overview
    </button>
    <button 
      class="tab" 
      class:active={$activeTab === 'deployments'}
      onclick={() => activeTab.set('deployments')}
    >
      Deployments
    </button>
    <button 
      class="tab" 
      class:active={$activeTab === 'resources'}
      onclick={() => activeTab.set('resources')}
    >
      Resources
    </button>
    <button 
      class="tab" 
      class:active={$activeTab === 'costs'}
      onclick={() => activeTab.set('costs')}
    >
      Costs
    </button>
  </nav>

  <!-- Content -->
  <div class="dashboard-content">
    {#if $isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading dashboard...</span>
      </div>
    {:else if $activeTab === 'overview'}
      <!-- Overview Tab -->
      <div class="overview-grid" in:fly={{ y: 20, duration: 200 }}>
        <!-- Stats Cards -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon connected">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{$connectedIntegrations.length}</span>
              <span class="stat-label">Connected</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon deployments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{$deployments.length}</span>
              <span class="stat-label">Deployments</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon resources">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{$resources.length}</span>
              <span class="stat-label">Resources</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon costs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{formatCurrency($totalMonthlyCost)}</span>
              <span class="stat-label">Monthly Cost</span>
            </div>
          </div>
        </div>

        <!-- Integrations Grid -->
        <section class="section">
          <h2 class="section-title">Integrations</h2>
          <div class="integrations-grid">
            {#each $integrations as integration}
              <div 
                class="integration-card" 
                class:connected={integration.connected}
                class:disconnected={!integration.connected}
              >
                <div class="integration-icon {integration.id}">
                  <span class="icon-letter">{integration.name[0]}</span>
                </div>
                <div class="integration-info">
                  <span class="integration-name">{integration.name}</span>
                  {#if integration.connected}
                    <span class="integration-status {getStatusColor(integration.status || 'healthy')}">
                      Connected
                    </span>
                  {:else}
                    <span class="integration-status text-gray-400">Not connected</span>
                  {/if}
                </div>
                {#if integration.connected && integration.status}
                  <div class="status-dot {integration.status}"></div>
                {/if}
              </div>
            {/each}
          </div>
        </section>

        <!-- Recent Deployments -->
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Recent Deployments</h2>
            <button class="view-all-btn" onclick={() => activeTab.set('deployments')}>
              View all
            </button>
          </div>
          <div class="deployments-list">
            {#each $recentDeployments as deployment}
              <div class="deployment-row" transition:slide>
                <div class="deployment-info">
                  <div class="deployment-project">
                    <svg class="provider-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d={getProviderIcon(deployment.provider)}/>
                    </svg>
                    <span>{deployment.project}</span>
                  </div>
                  <div class="deployment-meta">
                    <span class="branch">{deployment.branch}</span>
                    <span class="commit">{deployment.commit.slice(0, 7)}</span>
                    <span class="time">{formatTime(deployment.createdAt)}</span>
                  </div>
                </div>
                <div class="deployment-status">
                  <span class="status-badge {getStatusBg(deployment.status)}">
                    {#if deployment.status === 'building'}
                      <span class="spinner-small"></span>
                    {/if}
                    {deployment.status}
                  </span>
                  {#if deployment.url}
                    <a href={deployment.url} target="_blank" rel="noopener" class="visit-link">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>

        <!-- Cost Overview -->
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Cost Overview</h2>
            <button class="view-all-btn" onclick={() => activeTab.set('costs')}>
              View details
            </button>
          </div>
          <div class="cost-cards">
            {#each $costs as cost}
              <div class="cost-card">
                <div class="cost-provider">{cost.provider}</div>
                <div class="cost-amount">{formatCurrency(cost.current)}</div>
                <div class="cost-trend {cost.trend}">
                  {#if cost.trend === 'up'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>
                  {:else if cost.trend === 'down'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                      <polyline points="17 18 23 18 23 12"/>
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  {/if}
                  <span>{cost.trendPercent}%</span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      </div>

    {:else if $activeTab === 'deployments'}
      <!-- Deployments Tab -->
      <div class="deployments-tab" in:fly={{ y: 20, duration: 200 }}>
        <div class="deployments-table">
          <div class="table-header">
            <span>Project</span>
            <span>Branch</span>
            <span>Commit</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Time</span>
            <span></span>
          </div>
          {#each $deployments as deployment}
            <div class="table-row">
              <span class="project-cell">
                <svg class="provider-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d={getProviderIcon(deployment.provider)}/>
                </svg>
                {deployment.project}
              </span>
              <span class="branch-cell">{deployment.branch}</span>
              <span class="commit-cell">{deployment.commit.slice(0, 7)}</span>
              <span class="status-cell">
                <span class="status-badge {getStatusBg(deployment.status)}">{deployment.status}</span>
              </span>
              <span class="duration-cell">{formatDuration(deployment.duration)}</span>
              <span class="time-cell">{formatTime(deployment.createdAt)}</span>
              <span class="actions-cell">
                {#if deployment.url}
                  <a href={deployment.url} target="_blank" rel="noopener" class="action-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>

    {:else if $activeTab === 'resources'}
      <!-- Resources Tab -->
      <div class="resources-tab" in:fly={{ y: 20, duration: 200 }}>
        <div class="resources-grid">
          {#each $resources as resource}
            <div class="resource-card">
              <div class="resource-header">
                <div class="resource-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d={getResourceIcon(resource.type)}/>
                  </svg>
                </div>
                <span class="status-indicator {resource.status}"></span>
              </div>
              <div class="resource-name">{resource.name}</div>
              <div class="resource-meta">
                <span class="provider">{resource.provider.toUpperCase()}</span>
                <span class="region">{resource.region}</span>
                <span class="type">{resource.type}</span>
              </div>
              {#if resource.cost}
                <div class="resource-cost">{formatCurrency(resource.cost)}/mo</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

    {:else if $activeTab === 'costs'}
      <!-- Costs Tab -->
      <div class="costs-tab" in:fly={{ y: 20, duration: 200 }}>
        <div class="cost-summary-card">
          <div class="summary-header">
            <h3>Total Monthly Cost</h3>
            <span class="summary-period">Current billing period</span>
          </div>
          <div class="summary-amount">{formatCurrency($totalMonthlyCost)}</div>
          <div class="summary-forecast">
            Forecast: {formatCurrency($costs.reduce((sum, c) => sum + c.forecast, 0))}
          </div>
        </div>

        <div class="cost-breakdown">
          <h3>Cost by Provider</h3>
          <div class="breakdown-list">
            {#each $costs as cost}
              <div class="breakdown-item">
                <div class="breakdown-info">
                  <span class="breakdown-provider">{cost.provider}</span>
                  <span class="breakdown-amount">{formatCurrency(cost.current)}</span>
                </div>
                <div class="breakdown-bar">
                  <div 
                    class="breakdown-fill" 
                    style="width: {(cost.current / $totalMonthlyCost) * 100}%"
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
            {#each $resources.filter(r => r.cost).sort((a, b) => (b.cost || 0) - (a.cost || 0)) as resource}
              <div class="resource-cost-item">
                <div class="resource-cost-info">
                  <span class="resource-cost-name">{resource.name}</span>
                  <span class="resource-cost-type">{resource.type} - {resource.provider.toUpperCase()}</span>
                </div>
                <span class="resource-cost-amount">{formatCurrency(resource.cost || 0)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
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
    to { transform: rotate(360deg); }
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
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.1));
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

  .integration-icon.vercel { background: #000; }
  .integration-icon.netlify { background: #00c7b7; }
  .integration-icon.aws { background: #ff9900; }
  .integration-icon.gcp { background: #4285f4; }
  .integration-icon.azure { background: #0078d4; }
  .integration-icon.supabase { background: #3ecf8e; }
  .integration-icon.firebase { background: #ffca28; color: #000; }
  .integration-icon.github { background: #24292e; }
  .integration-icon.jira { background: #0052cc; }
  .integration-icon.linear { background: #5e6ad2; }

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

  .status-dot.healthy { background: #22c55e; }
  .status-dot.warning { background: #eab308; }
  .status-dot.error { background: #ef4444; }

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

  .branch::before { content: ''; }
  .commit { font-family: var(--font-mono, monospace); }

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

  .cost-trend.up { color: #ef4444; }
  .cost-trend.down { color: #22c55e; }
  .cost-trend.stable { color: var(--color-text-muted, #6d28d9); }

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
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.1));
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

  .status-indicator.running { background: #22c55e; }
  .status-indicator.stopped { background: #6b7280; }
  .status-indicator.pending { background: #eab308; }
  .status-indicator.error { background: #ef4444; }

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
    background: linear-gradient(135deg, var(--color-primary, #7c3aed), var(--color-primary-hover, #6d28d9));
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

  .breakdown-trend.up { color: #ef4444; }
  .breakdown-trend.down { color: #22c55e; }
  .breakdown-trend.stable { color: var(--color-text-muted, #6d28d9); }

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
  .text-green-500 { color: #22c55e; }
  .text-yellow-500 { color: #eab308; }
  .text-red-500 { color: #ef4444; }
  .text-gray-400 { color: #9ca3af; }
  .text-gray-500 { color: #6b7280; }

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
</style>
