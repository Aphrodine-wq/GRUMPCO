<!--
  ApprovalDialog.svelte
  
  Request user approval for expensive operations.
  Shows cost estimate, impact, and options.
  
  Part of the "Wallet Respect" system.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    gAgentBudgetStore,
    formatCost,
    type ApprovalRequest,
  } from '../../stores/gAgentBudgetStore';
  import { AlertTriangle } from 'lucide-svelte';

  // Props
  export let request: ApprovalRequest;
  export let show: boolean = true;

  // Events
  const dispatch = createEventDispatcher<{
    approve: { requestId: string };
    deny: { requestId: string };
    close: void;
  }>();

  // State
  let isProcessing = false;
  let selectedAction: 'approve' | 'deny' | null = null;

  // Computed
  $: remainingAfter = request.budgetRemaining - request.estimatedCost;
  $: wouldExceed = remainingAfter < 0;
  $: percentOfBudget = Math.round((request.estimatedCost / request.budgetRemaining) * 100);

  // Countdown for auto-expire
  $: expiresIn = Math.max(0, new Date(request.expiresAt).getTime() - Date.now());
  $: expiresInSeconds = Math.round(expiresIn / 1000);

  async function handleApprove() {
    if (isProcessing) return;
    isProcessing = true;
    selectedAction = 'approve';

    try {
      const success = await gAgentBudgetStore.approveRequest(request.id);
      if (success) {
        dispatch('approve', { requestId: request.id });
        dispatch('close');
      }
    } finally {
      isProcessing = false;
      selectedAction = null;
    }
  }

  async function handleDeny() {
    if (isProcessing) return;
    isProcessing = true;
    selectedAction = 'deny';

    try {
      const success = await gAgentBudgetStore.denyRequest(request.id);
      if (success) {
        dispatch('deny', { requestId: request.id });
        dispatch('close');
      }
    } finally {
      isProcessing = false;
      selectedAction = null;
    }
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click|self={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="approval-title"
    tabindex="-1"
  >
    <!-- Dialog -->
    <div
      class="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
    >
      <!-- Header -->
      <div class="bg-yellow-600 px-6 py-4">
        <div class="flex items-center gap-3">
          <span class="text-3xl">💰</span>
          <div>
            <h2 id="approval-title" class="text-xl font-bold text-white">Approval Required</h2>
            <p class="text-yellow-100 text-sm">This operation requires your approval</p>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-4">
        <!-- Operation description -->
        <div class="bg-gray-700/50 rounded-lg p-4">
          <div class="text-gray-400 text-sm mb-1">Operation</div>
          <div class="text-white font-medium">{request.operation}</div>
          <div class="text-gray-400 text-sm mt-2">{request.reason}</div>
        </div>

        <!-- Cost breakdown -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-700/50 rounded-lg p-3">
            <div class="text-gray-400 text-xs mb-1">Estimated Cost</div>
            <div class="text-2xl font-bold text-yellow-400">
              {formatCost(request.estimatedCost)}
            </div>
          </div>

          <div class="bg-gray-700/50 rounded-lg p-3">
            <div class="text-gray-400 text-xs mb-1">Current Spent</div>
            <div class="text-xl font-semibold text-gray-300">
              {formatCost(request.currentSpent)}
            </div>
          </div>
        </div>

        <!-- Budget impact -->
        <div class="bg-gray-700/50 rounded-lg p-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-400 text-sm">Budget Impact</span>
            <span class="text-sm {wouldExceed ? 'text-red-400' : 'text-green-400'}">
              {percentOfBudget}% of remaining
            </span>
          </div>

          <!-- Visual bar -->
          <div class="h-3 bg-gray-600 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-300 {wouldExceed
                ? 'bg-red-500'
                : 'bg-yellow-500'}"
              style="width: {Math.min(percentOfBudget, 100)}%"
            ></div>
          </div>

          <div class="flex justify-between mt-2 text-xs">
            <span class="text-gray-500">
              Remaining: {formatCost(request.budgetRemaining)}
            </span>
            <span class={wouldExceed ? 'text-red-400' : 'text-gray-400'}>
              After: {wouldExceed
                ? 'Exceeded by ' + formatCost(Math.abs(remainingAfter))
                : formatCost(remainingAfter)}
            </span>
          </div>
        </div>

        <!-- Warning for budget exceed -->
        {#if wouldExceed}
          <div class="bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-start gap-3">
            <span class="text-xl"><AlertTriangle size={20} /></span>
            <div class="text-sm text-red-300">
              This operation will exceed your budget. Consider adjusting your budget limits or
              breaking the task into smaller parts.
            </div>
          </div>
        {/if}

        <!-- Expiration countdown -->
        {#if expiresInSeconds > 0}
          <div class="text-center text-sm text-gray-500">
            Expires in {expiresInSeconds}s
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="bg-gray-900/50 px-6 py-4 flex gap-3">
        <button
          on:click={handleDeny}
          disabled={isProcessing}
          class="
            flex-1 px-4 py-3 rounded-lg font-medium
            bg-gray-700 hover:bg-gray-600 text-gray-200
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {#if isProcessing && selectedAction === 'deny'}
            Denying...
          {:else}
            Deny
          {/if}
        </button>

        <button
          on:click={handleApprove}
          disabled={isProcessing}
          class="
            flex-1 px-4 py-3 rounded-lg font-medium
            bg-yellow-600 hover:bg-yellow-500 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {#if isProcessing && selectedAction === 'approve'}
            Approving...
          {:else}
            Approve {formatCost(request.estimatedCost)}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Animation for dialog entry */
  :global(.approval-dialog-enter) {
    animation: dialog-enter 0.2s ease-out;
  }

  @keyframes dialog-enter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
