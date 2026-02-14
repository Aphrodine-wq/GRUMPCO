<script lang="ts">
  /**
   * CloudDeploymentsTab – Deployments table for CloudDashboard.
   */
  import { fly } from 'svelte/transition';
  import {
    formatTime,
    formatDuration,
    getStatusBg,
    getProviderIcon,
    type Deployment,
  } from './cloudUtils';

  interface Props {
    deployments: Deployment[];
  }
  let { deployments }: Props = $props();
</script>

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
    {#each deployments as deployment}
      <div class="table-row">
        <span class="project-cell">
          <svg
            class="provider-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d={getProviderIcon(deployment.provider)} />
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
            <a
              href={deployment.url}
              target="_blank"
              rel="noopener"
              class="action-icon"
              aria-label="Visit deployment"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          {/if}
        </span>
      </div>
    {/each}
  </div>
</div>
