<script lang="ts">
  /**
   * CloudOverviewTab – Overview panel for CloudDashboard.
   * Shows stats cards, integrations grid, recent deployments, and cost overview.
   */
  import { fly, slide } from 'svelte/transition';
  import { setCurrentView } from '../../stores/uiStore';
  import {
    formatTime,
    formatCurrency,
    getStatusColor,
    getStatusBg,
    getProviderIcon,
    type Integration,
    type Deployment,
    type CloudResource,
    type CostSummary,
  } from './cloudUtils';

  interface Props {
    connectedIntegrations: Integration[];
    integrations: Integration[];
    deployments: Deployment[];
    recentDeployments: Deployment[];
    resources: CloudResource[];
    costs: CostSummary[];
    totalMonthlyCost: number;
    onSwitchTab: (tab: 'deployments' | 'costs') => void;
  }

  let {
    connectedIntegrations,
    integrations,
    deployments,
    recentDeployments,
    resources,
    costs,
    totalMonthlyCost,
    onSwitchTab,
  }: Props = $props();
</script>

<div class="overview-grid" in:fly={{ y: 20, duration: 200 }}>
  <!-- Stats Cards -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-icon connected">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div class="stat-info">
        <span class="stat-value">{connectedIntegrations.length}</span>
        <span class="stat-label">Connected</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon deployments">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          />
        </svg>
      </div>
      <div class="stat-info">
        <span class="stat-value">{deployments.length}</span>
        <span class="stat-label">Deployments</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon resources">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      </div>
      <div class="stat-info">
        <span class="stat-value">{resources.length}</span>
        <span class="stat-label">Resources</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon costs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div class="stat-info">
        <span class="stat-value">{formatCurrency(totalMonthlyCost)}</span>
        <span class="stat-label">Monthly Cost</span>
      </div>
    </div>
  </div>

  <!-- Integrations Grid -->
  <section class="section">
    <h2 class="section-title">Integrations</h2>
    <div class="integrations-grid">
      {#each integrations as integration}
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
      {:else}
        <div class="empty-state">
          <p>No integrations connected</p>
          <button class="action-btn primary" onclick={() => setCurrentView('integrations')}>
            Connect integration
          </button>
        </div>
      {/each}
    </div>
  </section>

  <!-- Recent Deployments -->
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Recent Deployments</h2>
      <button class="view-all-btn" onclick={() => onSwitchTab('deployments')}> View all </button>
    </div>
    <div class="deployments-list">
      {#each recentDeployments as deployment}
        <div class="deployment-row" transition:slide>
          <div class="deployment-info">
            <div class="deployment-project">
              <svg
                class="provider-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d={getProviderIcon(deployment.provider)} />
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
              <a
                href={deployment.url}
                target="_blank"
                rel="noopener"
                class="visit-link"
                aria-label="Visit deployment"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <p>No deployments yet</p>
          <p class="empty-state-hint">
            Connect a provider (e.g. Vercel, Netlify) to see deployments here.
          </p>
          <button class="action-btn primary" onclick={() => setCurrentView('integrations')}>
            Connect to see data
          </button>
        </div>
      {/each}
    </div>
  </section>

  <!-- Cost Overview -->
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Cost Overview</h2>
      <button class="view-all-btn" onclick={() => onSwitchTab('costs')}> View details </button>
    </div>
    <div class="cost-cards">
      {#each costs as cost}
        <div class="cost-card">
          <div class="cost-provider">{cost.provider}</div>
          <div class="cost-amount">{formatCurrency(cost.current)}</div>
          <div class="cost-trend {cost.trend}">
            {#if cost.trend === 'up'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            {:else if cost.trend === 'down'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            {/if}
            <span>{cost.trendPercent}%</span>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <p>No cost data</p>
          <p class="empty-state-hint">Connect cloud providers to see usage and costs.</p>
          <button class="action-btn primary" onclick={() => setCurrentView('integrations')}>
            Connect to see data
          </button>
        </div>
      {/each}
    </div>
  </section>
</div>
