<script lang="ts">
  /**
   * CloudResourcesTab – Resource cards grid for CloudDashboard.
   */
  import { fly } from 'svelte/transition';
  import { setCurrentView } from '../../stores/uiStore';
  import { formatCurrency, getResourceIcon, type CloudResource } from './cloudUtils';

  interface Props {
    resources: CloudResource[];
  }
  let { resources }: Props = $props();
</script>

<div class="resources-tab" in:fly={{ y: 20, duration: 200 }}>
  <div class="resources-grid">
    {#each resources as resource}
      <div class="resource-card">
        <div class="resource-header">
          <div class="resource-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d={getResourceIcon(resource.type)} />
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
    {:else}
      <div class="empty-state">
        <p>No resources</p>
        <p class="empty-state-hint">Connect a cloud provider to see resources here.</p>
        <button class="action-btn primary" onclick={() => setCurrentView('integrations')}>
          Connect to see data
        </button>
      </div>
    {/each}
  </div>
</div>
