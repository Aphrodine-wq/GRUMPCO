<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    listApprovals,
    approveRequest,
    rejectRequest,
    type ApprovalRequest,
    type ApprovalStatus,
    type RiskLevel,
  } from '../lib/integrationsApi';
  import { showToast } from '../stores/toastStore';
  import EmptyState from './EmptyState.svelte';

  interface Props {
    onBack: () => void;
  }
  let { onBack }: Props = $props();

  let approvals = $state<ApprovalRequest[]>([]);
  let loading = $state(true);
  let filter = $state<ApprovalStatus | 'all'>('pending');
  let processingId = $state<string | null>(null);
  let rejectReason = $state('');
  let showRejectModal = $state(false);
  let selectedApproval = $state<ApprovalRequest | null>(null);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    loadApprovals();
  });

  onMount(() => {
    // Poll for new approvals every 10 seconds
    pollingInterval = setInterval(loadApprovals, 10000);
  });

  onDestroy(() => {
    if (pollingInterval) clearInterval(pollingInterval);
  });

  async function loadApprovals() {
    try {
      if (filter === 'all') {
        approvals = await listApprovals();
      } else {
        approvals = await listApprovals(filter);
      }
    } catch (e) {
      if (loading) showToast('Failed to load approvals', 'error');
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function getRiskColor(level: RiskLevel): string {
    switch (level) {
      case 'low':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'high':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }

  function getRiskBg(level: RiskLevel): string {
    switch (level) {
      case 'low':
        return '#D1FAE5';
      case 'medium':
        return '#FEF3C7';
      case 'high':
        return '#FEE2E2';
      default:
        return '#F3F4F6';
    }
  }

  function getStatusColor(status: ApprovalStatus): string {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return '#10B981';
      case 'rejected':
        return '#EF4444';
      case 'expired':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function getExpiryText(approval: ApprovalRequest): string | null {
    if (!approval.expiresAt || approval.status !== 'pending') return null;
    const expires = new Date(approval.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff < 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
    return `Expires in ${minutes}m`;
  }

  async function handleApprove(approval: ApprovalRequest) {
    processingId = approval.id;
    try {
      await approveRequest(approval.id, 'user');
      showToast('Request approved', 'success');
      await loadApprovals();
    } catch (e) {
      showToast('Failed to approve request', 'error');
      console.error(e);
    } finally {
      processingId = null;
    }
  }

  function openRejectModal(approval: ApprovalRequest) {
    selectedApproval = approval;
    rejectReason = '';
    showRejectModal = true;
  }

  function closeRejectModal() {
    showRejectModal = false;
    selectedApproval = null;
    rejectReason = '';
  }

  async function handleReject() {
    if (!selectedApproval) return;
    processingId = selectedApproval.id;
    try {
      await rejectRequest(selectedApproval.id, rejectReason || undefined);
      showToast('Request rejected', 'success');
      closeRejectModal();
      await loadApprovals();
    } catch (e) {
      showToast('Failed to reject request', 'error');
      console.error(e);
    } finally {
      processingId = null;
    }
  }

  function formatPayload(payload: Record<string, unknown> | undefined): string {
    if (!payload) return '';
    return JSON.stringify(payload, null, 2);
  }

  const pendingCount = $derived(approvals.filter((a) => a.status === 'pending').length);
</script>

<div class="approvals-center">
  <header class="header">
    <button class="back-btn" onclick={onBack}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>
        Approvals Center
        {#if pendingCount > 0}
          <span class="pending-badge">{pendingCount}</span>
        {/if}
      </h1>
      <p class="subtitle">Review and approve AI agent actions</p>
    </div>
  </header>

  <!-- Filter tabs -->
  <div class="filter-tabs">
    <button
      class="tab"
      class:active={filter === 'pending'}
      onclick={() => {
        filter = 'pending';
        loadApprovals();
      }}
    >
      Pending
      {#if pendingCount > 0}
        <span class="tab-count">{pendingCount}</span>
      {/if}
    </button>
    <button
      class="tab"
      class:active={filter === 'approved'}
      onclick={() => {
        filter = 'approved';
        loadApprovals();
      }}
    >
      Approved
    </button>
    <button
      class="tab"
      class:active={filter === 'rejected'}
      onclick={() => {
        filter = 'rejected';
        loadApprovals();
      }}
    >
      Rejected
    </button>
    <button
      class="tab"
      class:active={filter === 'all'}
      onclick={() => {
        filter = 'all';
        loadApprovals();
      }}
    >
      All
    </button>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading approvals...</p>
    </div>
  {:else if approvals.length === 0}
    <EmptyState
      headline={filter === 'all' ? 'No approvals' : `No ${filter} approvals`}
      description={filter === 'pending'
        ? 'All caught up! There are no pending requests.'
        : `No ${filter} requests to show.`}
    />
  {:else}
    <div class="approvals-list">
      {#each approvals as approval}
        <div class="approval-card" class:pending={approval.status === 'pending'}>
          <div class="card-header">
            <div class="action-info">
              <span
                class="risk-badge"
                style="background: {getRiskBg(approval.riskLevel)}; color: {getRiskColor(
                  approval.riskLevel
                )}"
              >
                {approval.riskLevel} risk
              </span>
              <h3>{approval.action}</h3>
            </div>
            <div class="status-time">
              <span class="status" style="color: {getStatusColor(approval.status)}"
                >{approval.status}</span
              >
              <span class="time">{formatTime(approval.createdAt)}</span>
            </div>
          </div>

          {#if approval.reason}
            <p class="reason">{approval.reason}</p>
          {/if}

          {#if approval.payload && Object.keys(approval.payload).length > 0}
            <details class="payload-details">
              <summary>View Details</summary>
              <pre>{formatPayload(approval.payload)}</pre>
            </details>
          {/if}

          {#if approval.status === 'pending'}
            {@const expiry = getExpiryText(approval)}
            <div class="card-footer">
              {#if expiry}
                <span class="expiry" class:warning={expiry.includes('Expires in')}>{expiry}</span>
              {/if}
              <div class="actions">
                <button
                  class="reject-btn"
                  onclick={() => openRejectModal(approval)}
                  disabled={processingId === approval.id}
                >
                  Reject
                </button>
                <button
                  class="approve-btn"
                  onclick={() => handleApprove(approval)}
                  disabled={processingId === approval.id}
                >
                  {processingId === approval.id ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          {:else if approval.resolvedAt}
            <div class="resolution-info">
              <span>
                {approval.status === 'approved' ? 'Approved' : 'Rejected'}
                {approval.resolvedBy ? `by ${approval.resolvedBy}` : ''}
                on {new Date(approval.resolvedAt).toLocaleDateString()}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Reject Modal -->
{#if showRejectModal && selectedApproval}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={closeRejectModal}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeRejectModal()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2>Reject Request</h2>
      <p class="modal-desc">
        Are you sure you want to reject the action "{selectedApproval.action}"?
      </p>
      <div class="form-group">
        <label for="reason">Reason (optional)</label>
        <textarea
          id="reason"
          bind:value={rejectReason}
          placeholder="Why are you rejecting this request?"
          rows="3"
        ></textarea>
      </div>
      <div class="modal-actions">
        <button class="cancel-btn" onclick={closeRejectModal}>Cancel</button>
        <button class="confirm-reject-btn" onclick={handleReject} disabled={processingId !== null}>
          {processingId ? 'Rejecting...' : 'Reject Request'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .approvals-center {
    padding: 2rem;
    max-width: none;
    width: 100%;
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    margin-bottom: 1rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-secondary);
    cursor: pointer;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--color-bg-secondary);
  }

  h1 {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pending-badge {
    background: #ef4444;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
  }

  .subtitle {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .filter-tabs {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.375rem;
  }

  .tab {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-muted);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .tab:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .tab.active {
    background: #6366f1;
    color: white;
  }

  .tab-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .loading-state {
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
    border: 3px solid var(--color-border);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .approvals-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .approval-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.875rem 1rem;
    transition: all 0.2s;
  }

  .approval-card.pending {
    border-color: #fcd34d;
    background: linear-gradient(to right, #fffbeb, white);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .action-info {
    flex: 1;
  }

  .risk-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    margin-bottom: 0.375rem;
  }

  .action-info h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .status-time {
    text-align: right;
  }

  .status {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .time {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }

  .reason {
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    line-height: 1.45;
    margin: 0 0 0.75rem;
  }

  .payload-details {
    margin-bottom: 0.75rem;
  }

  .payload-details summary {
    cursor: pointer;
    color: #6366f1;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .payload-details pre {
    margin: 0.375rem 0 0;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: 6px;
    font-size: 0.6875rem;
    overflow-x: auto;
    color: var(--color-text-secondary);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  .expiry {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }

  .expiry.warning {
    color: #f59e0b;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .approve-btn,
  .reject-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .approve-btn {
    background: #10b981;
    color: white;
  }

  .approve-btn:hover:not(:disabled) {
    background: #059669;
  }

  .reject-btn {
    background: #fee2e2;
    color: #dc2626;
  }

  .reject-btn:hover:not(:disabled) {
    background: #fecaca;
  }

  .approve-btn:disabled,
  .reject-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .resolution-info {
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: var(--color-bg-card);
    border-radius: 16px;
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
  }

  .modal h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--color-text);
  }

  .modal-desc {
    color: var(--color-text-muted);
    margin: 0 0 1.25rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 0.875rem;
    resize: vertical;
    font-family: inherit;
  }

  .form-group textarea:focus {
    outline: none;
    border-color: #6366f1;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .cancel-btn,
  .confirm-reject-btn {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .cancel-btn:hover {
    background: var(--color-bg-secondary);
  }

  .confirm-reject-btn {
    background: #ef4444;
    color: white;
  }

  .confirm-reject-btn:hover:not(:disabled) {
    background: #dc2626;
  }

  .confirm-reject-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .approvals-center {
      padding: 1rem;
    }

    .card-header {
      flex-direction: column;
      gap: 0.5rem;
    }

    .status-time {
      text-align: left;
    }

    .card-footer {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .actions {
      justify-content: stretch;
    }

    .actions button {
      flex: 1;
    }
  }
</style>
