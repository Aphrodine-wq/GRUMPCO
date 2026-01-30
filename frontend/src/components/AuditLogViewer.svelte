<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listAuditLogs,
    type AuditLogEntry,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  let logs = $state<AuditLogEntry[]>([]);
  let loading = $state(true);
  let filterCategory = $state<AuditLogEntry['category'] | 'all'>('all');
  let currentPage = $state(0);
  let hasMore = $state(true);
  const pageSize = 50;

  const categories: { value: AuditLogEntry['category']; label: string; icon: string; color: string }[] = [
    { value: 'integration', label: 'Integration', icon: 'M12 2v4M12 18v4m-7.07-3.93l2.83-2.83m8.48 2.83l2.83 2.83M2 12h4m12 0h4m-3.93-7.07l-2.83 2.83m-5.66 5.66l-2.83 2.83', color: '#6366f1' },
    { value: 'system', label: 'System', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: '#8b5cf6' },
    { value: 'security', label: 'Security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#ef4444' },
    { value: 'automation', label: 'Automation', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: '#10b981' },
    { value: 'billing', label: 'Billing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#f59e0b' },
    { value: 'agent', label: 'Agent', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: '#ec4899' },
  ];

  onMount(async () => {
    await loadLogs();
  });

  async function loadLogs(reset = true) {
    loading = true;
    try {
      const category = filterCategory === 'all' ? undefined : filterCategory;
      const offset = reset ? 0 : currentPage * pageSize;
      const newLogs = await listAuditLogs({ category, limit: pageSize, offset });
      
      if (reset) {
        logs = newLogs;
        currentPage = 0;
      } else {
        logs = [...logs, ...newLogs];
      }
      hasMore = newLogs.length === pageSize;
    } catch (e) {
      showToast('Failed to load audit logs', 'error');
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function loadMore() {
    currentPage++;
    loadLogs(false);
  }

  function getCategoryInfo(category: AuditLogEntry['category']) {
    return categories.find(c => c.value === category) || categories[0];
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  function formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  $effect(() => {
    if (filterCategory) {
      loadLogs();
    }
  });
</script>

<div class="audit-log-viewer">
  <header class="header">
    <button class="back-btn" onclick={onBack}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>Audit Log</h1>
      <p class="subtitle">Security and compliance activity trail (90-day retention)</p>
    </div>
  </header>

  <!-- Category Filter -->
  <div class="controls">
    <div class="category-filter">
      <button 
        class="filter-btn" 
        class:active={filterCategory === 'all'}
        onclick={() => (filterCategory = 'all')}
      >
        All Events
      </button>
      {#each categories as cat}
        <button 
          class="filter-btn" 
          class:active={filterCategory === cat.value}
          style="--color: {cat.color}"
          onclick={() => (filterCategory = cat.value)}
        >
          {cat.label}
        </button>
      {/each}
    </div>
  </div>

  {#if loading && logs.length === 0}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading audit logs...</p>
    </div>
  {:else if logs.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <h3>No audit events yet</h3>
      <p>Activity will appear here as you use integrations and features.</p>
    </div>
  {:else}
    <div class="stats-bar">
      <span>{logs.length} events loaded</span>
      {#if filterCategory !== 'all'}
        <span>|</span>
        <span>Filtered by: {filterCategory}</span>
      {/if}
    </div>

    <div class="log-table">
      <div class="table-header">
        <div class="col-time">Time</div>
        <div class="col-category">Category</div>
        <div class="col-action">Action</div>
        <div class="col-actor">Actor</div>
        <div class="col-target">Target</div>
      </div>
      
      {#each logs as log}
        {@const catInfo = getCategoryInfo(log.category)}
        <div class="log-row">
          <div class="col-time">
            <span class="time-value">{formatDate(log.createdAt)}</span>
          </div>
          <div class="col-category">
            <span class="category-badge" style="background: {catInfo.color}15; color: {catInfo.color}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d={catInfo.icon}/>
              </svg>
              {catInfo.label}
            </span>
          </div>
          <div class="col-action">
            <span class="action-text">{formatAction(log.action)}</span>
          </div>
          <div class="col-actor">
            <span class="actor-text">{log.actor || 'System'}</span>
          </div>
          <div class="col-target">
            <span class="target-text">{log.target || '-'}</span>
          </div>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <div class="load-more">
        <button class="load-more-btn" onclick={loadMore} disabled={loading}>
          {#if loading}
            <div class="spinner-small"></div>
            Loading...
          {:else}
            Load More
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .audit-log-viewer {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: #f9fafb;
  }

  .header-content {
    flex: 1;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  .controls {
    margin-bottom: 1.5rem;
  }

  .category-filter {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #d1d5db;
  }

  .filter-btn.active {
    background: var(--color, #6366f1);
    border-color: var(--color, #6366f1);
    color: white;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    background: #f3f4f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
  }

  .empty-state h3 {
    margin: 0;
    font-size: 1.125rem;
    color: #374151;
  }

  .empty-state p {
    margin: 0;
    color: #6b7280;
  }

  .stats-bar {
    display: flex;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }

  .log-table {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 180px 120px 1fr 150px 200px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .log-row {
    display: grid;
    grid-template-columns: 180px 120px 1fr 150px 200px;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    align-items: center;
  }

  .log-row:last-child {
    border-bottom: none;
  }

  .log-row:hover {
    background: #f9fafb;
  }

  .time-value {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: ui-monospace, monospace;
  }

  .category-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .action-text {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 500;
  }

  .actor-text {
    font-size: 0.875rem;
    color: #374151;
  }

  .target-text {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: ui-monospace, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .load-more {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
  }

  .load-more-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .load-more-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .table-header, .log-row {
      grid-template-columns: 140px 100px 1fr 120px;
    }
    
    .col-target {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .audit-log-viewer {
      padding: 1rem;
    }

    .table-header {
      display: none;
    }

    .log-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
    }

    .col-time {
      order: 1;
    }

    .col-category {
      order: 0;
    }

    .col-action {
      order: 2;
    }

    .col-actor {
      order: 3;
    }

    .col-target {
      display: block;
      order: 4;
    }
  }
</style>
