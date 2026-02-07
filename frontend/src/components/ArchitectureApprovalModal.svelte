<script lang="ts">
  /**
   * ArchitectureApprovalModal — Inline Chat Card
   *
   * Appears as a compact card in the chat flow after a mermaid diagram is generated.
   * Non-disruptive: blends with the chat interface instead of blocking the view.
   */
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
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
  <div class="approval-card" transition:fly={{ y: 12, duration: 200 }}>
    <div class="card-header">
      <div class="card-icon">
        <Check size={16} />
      </div>
      <div class="card-title">Architecture Review</div>
      <button class="close-btn" onclick={handleClose} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>

    <p class="card-body">
      Does this architecture look right? Approve to pick a section, or request changes.
    </p>

    {#if feedbackMode}
      <div class="feedback-area" transition:fly={{ y: 6, duration: 150 }}>
        <textarea
          bind:this={feedbackRef}
          bind:value={feedbackText}
          class="feedback-input"
          placeholder="Describe the changes you'd like..."
          rows="2"
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleRequestChanges();
            }
          }}
        ></textarea>
      </div>
    {/if}

    <div class="card-actions">
      <button class="btn btn-approve" onclick={handleApprove}>
        <Check size={14} />
        Approve
      </button>
      <button class="btn btn-change" onclick={handleRequestChanges}>
        <Pencil size={14} />
        {feedbackMode ? 'Send Feedback' : 'Request Changes'}
      </button>
    </div>
  </div>
{/if}

<style>
  .approval-card {
    margin: 0.5rem 0;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card, #1a1a2e);
    border: 1px solid var(--color-border-light, rgba(255, 255, 255, 0.06));
    border-radius: 14px;
    max-width: 480px;
    will-change: transform, opacity;
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    background: rgba(124, 58, 237, 0.15);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .card-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #e2e8f0);
    flex: 1;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: none;
    border: none;
    border-radius: 0.25rem;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    padding: 0;
    transition: color 0.12s;
  }
  .close-btn:hover {
    color: var(--color-text, #e2e8f0);
  }

  .card-body {
    font-size: 0.8125rem;
    color: var(--color-text-secondary, #94a3b8);
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .feedback-area {
    margin-bottom: 0.75rem;
  }

  .feedback-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
    color: var(--color-text, #e2e8f0);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8125rem;
    padding: 0.5rem 0.625rem;
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

  .card-actions {
    display: flex;
    gap: 0.375rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn-approve {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.2);
  }
  .btn-approve:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.35);
  }

  .btn-change {
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-text-secondary, #94a3b8);
    border-color: rgba(255, 255, 255, 0.06);
  }
  .btn-change:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text, #e2e8f0);
  }

  @media (prefers-reduced-motion: reduce) {
    .approval-card {
      transition: none;
    }
  }
</style>
