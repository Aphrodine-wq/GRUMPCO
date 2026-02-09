<script lang="ts">
  import { trackFeedback } from '$lib/analytics';
  import { X, Check, MessageCircle } from 'lucide-svelte';

  interface Props {
    diagramId?: string;
    onSubmit?: (helpful: boolean, comment?: string) => void;
  }

  let { diagramId = '', onSubmit }: Props = $props();

  let isExpanded = $state(false);
  let showRating = $state(false);
  let helpful = $state<boolean | null>(null);
  let comment = $state('');
  let isSubmitting = $state(false);
  let isSubmitted = $state(false);
  let errorMessage = $state('');

  async function handleSubmit() {
    if (helpful === null) return;

    isSubmitting = true;
    errorMessage = '';

    try {
      // Track analytics
      trackFeedback(diagramId, helpful, comment || undefined);

      // Call parent callback if provided
      if (onSubmit) {
        await onSubmit(helpful, comment || undefined);
      }

      isSubmitted = true;

      // Auto-collapse after 2 seconds
      setTimeout(() => {
        isExpanded = false;
        // Reset after animation
        setTimeout(() => {
          isSubmitted = false;
          helpful = null;
          comment = '';
          showRating = false;
        }, 300);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      errorMessage = 'Failed to submit feedback. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleHelpfulYes() {
    helpful = true;
    isSubmitting = true;
    handleSubmit();
  }

  function handleHelpfulNo() {
    helpful = false;
    showRating = false;
    comment = '';
  }

  function toggleExpanded() {
    if (isSubmitted) return;
    isExpanded = !isExpanded;
    if (isExpanded && !showRating) {
      showRating = true;
    }
  }

  function close() {
    isExpanded = false;
    helpful = null;
    comment = '';
    showRating = false;
  }
</script>

<div class="fixed bottom-4 right-4 z-40 font-sans">
  {#if isExpanded}
    <!-- Expanded card -->
    <div
      class="bg-white rounded-lg shadow-lg border border-gray-200 w-80 overflow-hidden animate-slideUp"
    >
      <!-- Header -->
      <div class="bg-blue-600 px-4 py-3 flex justify-between items-center">
        <h3 class="text-white font-semibold text-sm">Feedback</h3>
        <button
          type="button"
          onclick={close}
          class="text-white hover:bg-white/20 rounded p-1 transition-colors"
          aria-label="Close feedback"
        >
          <X class="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <!-- Content -->
      <div class="p-4">
        {#if isSubmitted}
          <!-- Success state -->
          <div class="text-center py-6">
            <div class="flex justify-center mb-2">
              <Check class="w-10 h-10 text-green-600" strokeWidth={2} />
            </div>
            <p class="text-gray-700 font-medium">Thank you for your feedback!</p>
          </div>
        {:else if errorMessage}
          <!-- Error state -->
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p class="text-red-700 text-sm">{errorMessage}</p>
          </div>
          <button
            type="button"
            onclick={() => (errorMessage = '')}
            class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        {:else if helpful !== null && !helpful}
          <!-- Comment state -->
          <div>
            <p class="text-gray-700 text-sm mb-3">
              <strong>What could we improve?</strong>
            </p>
            <textarea
              bind:value={comment}
              placeholder="Tell us what went wrong..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="3"
              disabled={isSubmitting}
            ></textarea>
            <div class="flex gap-2 mt-3">
              <button
                type="button"
                onclick={() => {
                  helpful = null;
                  comment = '';
                }}
                class="flex-1 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="button"
                onclick={handleSubmit}
                disabled={isSubmitting}
                class="flex-1 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        {:else}
          <!-- Rating state -->
          <p class="text-gray-700 text-sm mb-4 font-medium">Was this helpful?</p>
          <div class="flex gap-3">
            <button
              type="button"
              onclick={handleHelpfulYes}
              disabled={isSubmitting}
              class="flex-1 px-4 py-3 bg-green-50 hover:bg-green-100 border-2 border-green-200 text-green-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
              aria-label="Yes, this was helpful"
            >
              Yes
            </button>
            <button
              type="button"
              onclick={handleHelpfulNo}
              disabled={isSubmitting}
              class="flex-1 px-4 py-3 bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
              aria-label="No, this was not helpful"
            >
              No
            </button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Collapsed button -->
    <button
      type="button"
      onclick={toggleExpanded}
      class="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-all font-medium text-sm flex items-center gap-2 active:scale-95"
      aria-label="Give feedback"
    >
      <MessageCircle size={16} />
      <span>Feedback?</span>
    </button>
  {/if}
</div>

<style>
  :global(.animate-slideUp) {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
