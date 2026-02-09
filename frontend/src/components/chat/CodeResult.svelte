<script lang="ts">
  import {
    Check,
    X,
    RefreshCw,
    Code2,
    ChevronDown,
    ChevronUp,
    Download,
    FileCode,
  } from 'lucide-svelte';
  import type { PhaseData } from '../../stores/chatPhaseStore';

  interface Props {
    data: PhaseData['code'];
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
  }

  let { data, onApprove, onRequestChanges }: Props = $props();

  let showFeedbackInput = $state(false);
  let feedbackText = $state('');
  let selectedFile = $state<string | null>(null);
  let showFileTree = $state(true);

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

  function selectFile(filePath: string) {
    selectedFile = filePath;
  }

  function getLanguageFromPath(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return languageMap[extension] || 'text';
  }

  async function downloadAllFiles() {
    if (!data?.files) return;

    // Create a zip or download files individually
    for (const file of data.files) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.path.split('/').pop() || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  const selectedFileData = $derived(data?.files?.find((f) => f.path === selectedFile));
</script>

<div class="phase-result code-result">
  <div class="result-header">
    <div class="title-group">
      <Code2 size={18} class="code-icon" />
      <h3 class="result-title">Generated Code</h3>
    </div>
    <div class="header-actions">
      <button class="download-btn" onclick={downloadAllFiles}>
        <Download size={14} />
        <span>Download All</span>
      </button>
      <button class="toggle-btn" onclick={() => (showFileTree = !showFileTree)}>
        {#if showFileTree}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
    </div>
  </div>

  {#if data?.files && data.files.length > 0}
    {#if showFileTree}
      <div class="code-browser">
        <div class="file-tree">
          {#each data.files as file}
            <button
              class="file-item"
              class:selected={selectedFile === file.path}
              onclick={() => selectFile(file.path)}
            >
              <FileCode size={14} />
              <span class="file-path">{file.path}</span>
              <span class="file-language">{getLanguageFromPath(file.path)}</span>
            </button>
          {/each}
        </div>

        {#if selectedFileData}
          <div class="code-preview">
            <div class="preview-header">
              <span class="preview-path">{selectedFileData.path}</span>
              <span class="preview-language">{selectedFileData.language}</span>
            </div>
            <pre class="code-content"><code>{selectedFileData.content}</code></pre>
          </div>
        {:else}
          <div class="no-selection">
            <p>Select a file to view its contents</p>
          </div>
        {/if}
      </div>
    {/if}

    <div class="files-summary">
      <span class="files-count">{data.files.length} files generated</span>
    </div>
  {:else}
    <div class="empty-state">
      <p>No code files generated yet.</p>
    </div>
  {/if}

  <div class="approval-section">
    <p class="approval-question">Does this code meet your requirements?</p>

    {#if !showFeedbackInput}
      <div class="approval-buttons">
        <button class="approve-btn" onclick={handleApprove}>
          <Check size={16} />
          <span>Looks good! Complete workflow</span>
        </button>
        <button class="changes-btn" onclick={() => (showFeedbackInput = true)}>
          <RefreshCw size={16} />
          <span>Request changes</span>
        </button>
      </div>
    {:else}
      <div class="feedback-input-section">
        <textarea
          bind:value={feedbackText}
          placeholder="What would you like me to change about the generated code?"
          rows={3}
        ></textarea>
        <div class="feedback-buttons">
          <button class="submit-feedback-btn" onclick={handleRequestChanges}>
            Submit Feedback
          </button>
          <button class="cancel-btn" onclick={() => (showFeedbackInput = false)}>
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
    background: var(--color-bg-card, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
    box-shadow: var(--shadow-sm);
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

  :global(.code-icon) {
    color: var(--color-primary, #7c3aed);
  }

  .result-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .download-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text, #1f1147);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .download-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
    border-color: var(--color-border-highlight, #d8b4fe);
    color: var(--color-primary, #7c3aed);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 6px;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .toggle-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
    border-color: var(--color-border-highlight, #d8b4fe);
    color: var(--color-primary, #7c3aed);
  }

  .code-browser {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
    margin-bottom: 16px;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    overflow: hidden;
    height: 320px;
  }

  .file-tree {
    background: var(--color-bg-subtle, #f5f3ff);
    border-right: 1px solid var(--color-border, #e9d5ff);
    overflow-y: auto;
    padding: 8px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
    transition: all 120ms ease;
    color: var(--color-text, #1f1147);
    font-size: 12px;
  }

  .file-item:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .file-item.selected {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .file-path {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }

  .file-language {
    font-size: 9px;
    padding: 2px 6px;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-radius: 4px;
    text-transform: uppercase;
    color: var(--color-primary, #7c3aed);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .file-item.selected .file-language {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .code-preview {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-bg-card, #ffffff);
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--color-bg-subtle, #f5f3ff);
    border-bottom: 1px solid var(--color-border-light, #f3e8ff);
  }

  .preview-path {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }

  .preview-language {
    font-size: 9px;
    padding: 3px 8px;
    background: var(--color-primary, #7c3aed);
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .code-content {
    flex: 1;
    margin: 0;
    padding: 14px 16px;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.65;
    color: var(--color-text, #1f1147);
    background: var(--color-bg-inset, #ede9fe);
    overflow: auto;
    white-space: pre;
  }

  .no-selection {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted, #6b7280);
    font-size: 13px;
    font-style: italic;
  }

  .files-summary {
    margin-bottom: 16px;
    padding: 8px 14px;
    background: var(--color-success-subtle, rgba(34, 197, 94, 0.1));
    border-radius: 6px;
    border-left: 3px solid var(--color-success, #22c55e);
  }

  .files-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-success, #22c55e);
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted, #6b7280);
    font-size: 13px;
  }

  .approval-section {
    border-top: 1px solid var(--color-border-light, #f3e8ff);
    padding-top: 16px;
  }

  .approval-question {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1f1147);
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
    background: var(--color-success, #22c55e);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
  }

  .approve-btn:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
  }

  .changes-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text, #1f1147);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .changes-btn:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
    border-color: var(--color-border-highlight, #d8b4fe);
    color: var(--color-primary, #7c3aed);
  }

  .feedback-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  textarea {
    width: 100%;
    padding: 12px;
    background: var(--color-bg-input, #f3e8ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    font-size: 13px;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--color-text, #1f1147);
    resize: vertical;
    transition: border-color 120ms ease;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-border-focus, #7c3aed);
    box-shadow: var(--focus-ring);
  }

  textarea::placeholder {
    color: var(--color-text-muted, #6b7280);
  }

  .feedback-buttons {
    display: flex;
    gap: 8px;
  }

  .submit-feedback-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--color-primary, #7c3aed);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
  }

  .submit-feedback-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: transparent;
    color: var(--color-text-muted, #6b7280);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .cancel-btn:hover {
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text, #1f1147);
  }

  @media (max-width: 768px) {
    .code-browser {
      grid-template-columns: 1fr;
      grid-template-rows: 120px 1fr;
    }

    .file-tree {
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
  }
</style>
