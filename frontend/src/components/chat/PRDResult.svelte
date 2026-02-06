<script lang="ts">
  import { Check, X, RefreshCw, ChevronDown, ChevronUp, FileText } from 'lucide-svelte';
  import type { PhaseData } from '../../stores/chatPhaseStore';

  interface Props {
    data: PhaseData['prd'];
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
  }

  let { data, onApprove, onRequestChanges }: Props = $props();

  let showFeedbackInput = $state(false);
  let feedbackText = $state('');
  let showContent = $state(true);

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
</script>

<div class="phase-result prd-result">
  <div class="result-header">
    <div class="title-group">
      <FileText size={18} class="prd-icon" />
      <h3 class="result-title">Product Requirements Document</h3>
    </div>
    <button 
      class="toggle-btn"
      onclick={() => showContent = !showContent}
    >
      {#if showContent}
        <ChevronUp size={16} />
      {:else}
        <ChevronDown size={16} />
      {/if}
      <span>{showContent ? 'Hide' : 'Show'} Content</span>
    </button>
  </div>

  {#if data?.summary}
    <div class="summary-section">
      <h4>Summary</h4>
      <div class="summary-content">{data.summary}</div>
    </div>
  {/if}

  {#if data?.content && showContent}
    <div class="content-section">
      <div class="content-header">
        <span class="content-label">Full PRD</span>
      </div>
      <pre class="prd-content"><code>{data.content}</code></pre>
    </div>
  {/if}

  <div class="approval-section">
    <p class="approval-question">Does this PRD capture your requirements?</p>
    
    {#if !showFeedbackInput}
      <div class="approval-buttons">
        <button class="approve-btn" onclick={handleApprove}>
          <Check size={16} />
          <span>Looks good! Continue to Plan</span>
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
          placeholder="What would you like me to change about the PRD?"
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

  .title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.prd-icon) {
    color: var(--color-primary);
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

  .summary-section {
    margin-bottom: 16px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(124, 58, 237, 0.02) 100%);
    border-radius: 8px;
    border-left: 3px solid var(--color-primary);
  }

  .summary-section h4 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin: 0 0 8px 0;
  }

  .summary-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text);
    white-space: pre-wrap;
  }

  .content-section {
    background: var(--color-bg-subtle);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .content-header {
    padding: 8px 12px;
    background: var(--color-bg-card-hover);
    border-bottom: 1px solid var(--color-border-light);
  }

  .content-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .prd-content {
    margin: 0;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
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
