<script lang="ts">
  /**
   * ArchitectureApprovalModal — Inline Chat Card
   *
   * Appears as a compact card in the chat flow after a mermaid diagram is generated.
   * Non-disruptive: blends with the chat interface instead of blocking the view.
   */
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Check, Pencil, X } from 'lucide-svelte';

  interface Props {
    open?: boolean;
    mermaidCode?: string;
  }

  let { open = $bindable(false), mermaidCode = '' }: Props = $props();

  const dispatch = createEventDispatcher();
  let feedbackMode = $state(false);
  let feedbackText = $state('');
  let feedbackRef: HTMLTextAreaElement | null = $state(null);

  $effect(() => {
    if (feedbackMode && feedbackRef) {
      feedbackRef.focus();
    }
  });

  function handleApprove() {
    dispatch('approve', { mermaidCode });
  }

  function handleRequestChanges() {
    if (!feedbackMode) {
      feedbackMode = true;
      return;
    }
    if (feedbackText.trim()) {
      dispatch('request-changes', { mermaidCode, feedback: feedbackText.trim() });
      feedbackMode = false;
      feedbackText = '';
    }
  }

  function handleClose() {
    open = false;
    feedbackMode = false;
    feedbackText = '';
  }
</script>

{#if open}
  <div
    class="approval-card"
    role="region"
    aria-label="Architecture review"
    transition:fly={{ y: 8, duration: 160 }}
  >
    <div class="card-row">
      <div class="card-main">
        <div class="card-title-row">
          <div class="card-icon">
            <Check size={14} />
          </div>
          <p class="card-title">Architecture ready</p>
        </div>
        <p class="card-body">Looks good to continue, or should I revise it first?</p>
      </div>

      <div class="card-actions">
        <button class="btn btn-approve" onclick={handleApprove}>
          <Check size={14} />
          Continue
        </button>
        <button class="btn btn-change" onclick={handleRequestChanges}>
          <Pencil size={14} />
          {feedbackMode ? 'Send' : 'Revise'}
        </button>
        <button class="close-btn" onclick={handleClose} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>

    {#if feedbackMode}
      <div class="feedback-area" transition:fly={{ y: 6, duration: 140 }}>
        <textarea
          bind:this={feedbackRef}
          bind:value={feedbackText}
          class="feedback-input"
          placeholder="Tell me what to change..."
          rows="2"
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleRequestChanges();
            }
          }}
        ></textarea>
        <p class="feedback-hint">Press Enter to send, Shift+Enter for a new line.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .approval-card {
    margin: 0.25rem 0;
    padding: 0.625rem 0.75rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 3px solid var(--color-primary, #7c3aed);
    border-radius: 0 0.5rem 0.5rem 0;
    width: min(100%, 860px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    contain: layout style paint;
    content-visibility: auto;
  }

  .card-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .card-main {
    min-width: 0;
    flex: 1;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .card-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
  }
  .close-btn:hover {
    border-color: #d1d5db;
    background: #f9fafb;
    color: #374151;
  }

  .card-body {
    font-size: 0.72rem;
    color: #6b7280;
    margin: 0.25rem 0 0;
    line-height: 1.35;
  }

  .feedback-area {
    margin-top: 0.5rem;
  }

  .feedback-input {
    width: 100%;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #374151;
    font-size: 0.72rem;
    padding: 0.35rem 0.5rem;
    resize: none;
    outline: none;
    transition: border-color 0.12s;
  }
  .feedback-input:focus {
    border-color: rgba(124, 58, 237, 0.4);
  }
  .feedback-input::placeholder {
    color: var(--color-text-muted, #64748b);
  }

  .feedback-hint {
    margin: 0.35rem 0 0;
    font-size: 0.68rem;
    color: var(--color-text-muted, #64748b);
  }

  .card-actions {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn-approve {
    background: color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent);
    color: var(--color-primary, #60a5fa);
    border-color: color-mix(in srgb, var(--color-primary, #3b82f6) 28%, transparent);
  }
  .btn-approve:hover {
    background: color-mix(in srgb, var(--color-primary, #3b82f6) 28%, transparent);
  }

  .btn-change {
    background: transparent;
    color: var(--color-text-secondary, #94a3b8);
    border-color: var(--color-border-light, rgba(148, 163, 184, 0.25));
  }
  .btn-change:hover {
    background: color-mix(in srgb, var(--color-bg-card, #0f172a) 88%, transparent);
    color: var(--color-text, #e2e8f0);
  }

  @media (max-width: 820px) {
    .card-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.6rem;
    }

    .card-actions {
      width: 100%;
    }

    .btn {
      flex: 1;
      justify-content: center;
    }

    .close-btn {
      width: 2rem;
      height: 2rem;
      align-self: center;
      flex: 0 0 auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .approval-card {
      transition: none;
    }
  }
</style>
