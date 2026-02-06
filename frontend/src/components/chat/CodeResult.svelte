<script lang="ts">
  import { Check, X, RefreshCw, Code2, ChevronDown, ChevronUp, Download, FileCode } from 'lucide-svelte';
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

  function getFileIcon(path: string) {
    const extension = path.split('.').pop()?.toLowerCase();
    return FileCode;
  }

  function getLanguageFromPath(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
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

  const selectedFileData = $derived(
    data?.files?.find(f => f.path === selectedFile)
  );
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
      <button 
        class="toggle-btn"
        onclick={() => showFileTree = !showFileTree}
      >
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
        <button class="changes-btn" onclick={() => showFeedbackInput = true}>
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

  :global(.code-icon) {
    color: var(--color-primary);
  }

  .result-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
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
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .download-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-btn:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .code-browser {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 12px;
    margin-bottom: 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    height: 300px;
  }

  .file-tree {
    background: var(--color-bg-subtle);
    border-right: 1px solid var(--color-border);
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
    transition: all 150ms ease;
    color: var(--color-text);
  }

  .file-item:hover {
    background: var(--color-bg-card-hover);
  }

  .file-item.selected {
    background: var(--color-primary);
    color: white;
  }

  .file-path {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-language {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .file-item.selected .file-language {
    background: rgba(255, 255, 255, 0.2);
  }

  .code-preview {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--color-bg-card-hover);
    border-bottom: 1px solid var(--color-border-light);
  }

  .preview-path {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
  }

  .preview-language {
    font-size: 10px;
    padding: 2px 8px;
    background: var(--color-primary);
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .code-content {
    flex: 1;
    margin: 0;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    overflow: auto;
    white-space: pre;
  }

  .no-selection {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .files-summary {
    margin-bottom: 16px;
    padding: 8px 12px;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.02) 100%);
    border-radius: 6px;
    border-left: 3px solid #22c55e;
  }

  .files-count {
    font-size: 13px;
    font-weight: 600;
    color: #22c55e;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted);
    font-size: 13px;
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
    background: #22c55e;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .approve-btn:hover {
    background: #16a34a;
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
