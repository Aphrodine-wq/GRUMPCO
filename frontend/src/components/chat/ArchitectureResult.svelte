<script lang="ts">
  import { Check, X, RefreshCw, ChevronDown, ChevronUp, Copy } from 'lucide-svelte';
  import type { PhaseData } from '../../stores/chatPhaseStore';

  interface Props {
    data: PhaseData['architecture'];
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
  }

  let { data, onApprove, onRequestChanges }: Props = $props();

  let showFeedbackInput = $state(false);
  let feedbackText = $state('');
  let showMermaid = $state(true);
  let copied = $state(false);

  function handleApprove() {
    onApprove();
  }

  function handleRequestChanges() {
    if (feedbackText.trim()) {
      onRequestChanges(feedbackText.trim());
      showFeedbackInput = false;
      feedbackText = '';
    }
  }

  async function copyMermaid() {
    if (data?.mermaidCode) {
      await navigator.clipboard.writeText(data.mermaidCode);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }
</script>

<div class="phase-result architecture-result">
  <div class="result-header">
    <h3 class="result-title">System Architecture</h3>
    <button 
      class="toggle-btn"
      onclick={() => showMermaid = !showMermaid}
    >
      {#if showMermaid}
        <ChevronUp size={16} />
      {:else}
        <ChevronDown size={16} />
      {/if}
      <span>{showMermaid ? 'Hide' : 'Show'} Diagram</span>
    </button>
  </div>

  {#if data?.mermaidCode && showMermaid}
    <div class="mermaid-section">
      <div class="mermaid-header">
        <span class="mermaid-label">Mermaid Diagram</span>
        <button class="copy-btn" onclick={copyMermaid}>
          {#if copied}
            <Check size={14} />
            <span>Copied!</span>
          {:else}
            <Copy size={14} />
            <span>Copy</span>
          {/if}
        </button>
      </div>
      <pre class="mermaid-code"><code>{data.mermaidCode}</code></pre>
    </div>
  {/if}

  {#if data?.description}
    <div class="description-section">
      <h4>Architecture Overview</h4>
      <div class="description-content">
        {data.description}
      </div>
    </div>
  {/if}

  <div class="approval-section">
    <p class="approval-question">Does this architecture look good?</p>
    
    {#if !showFeedbackInput}
      <div class="approval-buttons">
        <button class="approve-btn" onclick={handleApprove}>
          <Check size={16} />
          <span>Looks good! Continue to PRD</span>
        </button>
        <button class="changes-btn" onclick={() => showFeedbackInput = true}>
          <RefreshCw size={16} />
          <span>Request changes</span>
        </button>
      </div>
    {:else}
      <div class="feedback-input-section">
        <textarea
          bind:value={feedbackText}
          placeholder="What would you like me to change about the architecture?"
          rows={3}
        ></textarea>
        <div class="feedback-buttons">
          <button class="submit-feedback-btn" onclick={handleRequestChanges}>
            Submit Feedback
          </button>
          <button class="cancel-btn" onclick={() => showFeedbackInput = false}>
            <X size={16} />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .phase-result {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .result-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .mermaid-section {
    background: var(--color-bg-subtle);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .mermaid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--color-bg-card-hover);
    border-bottom: 1px solid var(--color-border-light);
  }

  .mermaid-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    font-size: 11px;
    color: var(--color-primary);
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .copy-btn:hover {
    opacity: 0.8;
  }

  .mermaid-code {
    margin: 0;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .description-section {
    margin-bottom: 16px;
  }

  .description-section h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 8px 0;
  }

  .description-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
  }

  .approval-section {
    border-top: 1px solid var(--color-border-light);
    padding-top: 16px;
  }

  .approval-question {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 12px 0;
  }

  .approval-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .approve-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .approve-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }

  .changes-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .changes-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .feedback-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  textarea {
    width: 100%;
    padding: 12px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: var(--color-text);
    resize: vertical;
    transition: border-color 150ms ease;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  textarea::placeholder {
    color: var(--color-text-muted);
  }

  .feedback-buttons {
    display: flex;
    gap: 8px;
  }

  .submit-feedback-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .submit-feedback-btn:hover {
    background: var(--color-primary-hover);
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .cancel-btn:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }
</style>
