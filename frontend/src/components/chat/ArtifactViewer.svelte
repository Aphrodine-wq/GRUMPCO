<script lang="ts">
  import { X, Download, FileCode, FileText, LayoutGrid, ListTodo, Check } from 'lucide-svelte';
  import { chatPhaseStore } from '../../stores/chatPhaseStore';
  import { completeDesignWorkflow } from '../../lib/api';
  import { showToast } from '../../stores/toastStore';

  interface Props {
    open: boolean;
    onClose: () => void;
    sessionId?: string;
  }

  let { open, onClose, sessionId }: Props = $props();

  let activeTab = $state<'architecture' | 'prd' | 'plan' | 'code'>('architecture');
  let downloading = $state(false);

  const phaseData = $derived($chatPhaseStore.phaseData);
  const currentPhase = $derived($chatPhaseStore.currentPhase);
  const isCompleted = $derived(currentPhase === 'completed');

  async function handleDownloadAll() {
    if (!phaseData.code?.files) return;

    downloading = true;
    try {
      for (const file of phaseData.code.files) {
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
      showToast('All files downloaded!', 'success');
    } catch (err) {
      showToast('Failed to download files', 'error');
    } finally {
      downloading = false;
    }
  }

  async function handleCompleteWorkflow() {
    if (!sessionId) {
      showToast('Session ID required', 'error');
      return;
    }

    try {
      const result = await completeDesignWorkflow(sessionId);
      if (result.success) {
        chatPhaseStore.complete();
        showToast('Workflow completed successfully!', 'success');
        onClose();
      }
    } catch (err) {
      showToast('Failed to complete workflow', 'error');
    }
  }

  const tabs = $derived([
    {
      id: 'architecture' as const,
      label: 'Architecture',
      icon: LayoutGrid,
      available: !!phaseData.architecture,
    },
    { id: 'prd' as const, label: 'PRD', icon: FileText, available: !!phaseData.prd },
    { id: 'plan' as const, label: 'Plan', icon: ListTodo, available: !!phaseData.plan },
    { id: 'code' as const, label: 'Code', icon: FileCode, available: !!phaseData.code },
  ]);
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="artifact-viewer-overlay"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="artifact-viewer"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Design Workflow Artifacts"
      tabindex="-1"
    >
      <div class="viewer-header">
        <h2 class="viewer-title">Design Workflow Artifacts</h2>
        <button class="close-btn" onclick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div class="viewer-tabs">
        {#each tabs as tab}
          <button
            class="tab"
            class:active={activeTab === tab.id}
            class:disabled={!tab.available}
            disabled={!tab.available}
            onclick={() => tab.available && (activeTab = tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {#if tab.available}
              <Check size={12} class="tab-check" />
            {/if}
          </button>
        {/each}
      </div>

      <div class="viewer-content">
        {#if activeTab === 'architecture' && phaseData.architecture}
          <div class="artifact-section">
            <h3>System Architecture</h3>
            {#if phaseData.architecture.mermaidCode}
              <div class="mermaid-block">
                <pre><code>{phaseData.architecture.mermaidCode}</code></pre>
              </div>
            {/if}
            {#if phaseData.architecture.description}
              <div class="description-block">
                {phaseData.architecture.description}
              </div>
            {/if}
          </div>
        {:else if activeTab === 'prd' && phaseData.prd}
          <div class="artifact-section">
            <h3>Product Requirements Document</h3>
            <div class="prd-summary">
              {phaseData.prd.summary}
            </div>
            <pre class="prd-content"><code>{phaseData.prd.content}</code></pre>
          </div>
        {:else if activeTab === 'plan' && phaseData.plan}
          <div class="artifact-section">
            <h3>Implementation Plan</h3>
            <div class="tasks-list">
              {#each phaseData.plan.tasks as task, index}
                <div class="task-item">
                  <span class="task-number">{index + 1}</span>
                  <div class="task-content">
                    <div class="task-title">{task.title}</div>
                    {#if task.description}
                      <div class="task-description">{task.description}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if activeTab === 'code' && phaseData.code}
          <div class="artifact-section">
            <h3>Generated Code</h3>
            <div class="files-list">
              {#each phaseData.code.files as file}
                <div class="file-item">
                  <FileCode size={14} />
                  <span class="file-path">{file.path}</span>
                  <span class="file-language">{file.language}</span>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No data available for this phase yet.</p>
          </div>
        {/if}
      </div>

      <div class="viewer-footer">
        {#if isCompleted}
          <button class="complete-btn" onclick={handleCompleteWorkflow}>
            <Check size={16} />
            <span>Workflow Completed</span>
          </button>
        {/if}
        {#if phaseData.code?.files}
          <button class="download-btn" onclick={handleDownloadAll} disabled={downloading}>
            <Download size={16} />
            <span>{downloading ? 'Downloading...' : 'Download All Files'}</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .artifact-viewer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .artifact-viewer {
    background: var(--color-bg-card);
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .viewer-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .close-btn:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .viewer-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .tab:hover:not(.disabled) {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .tab.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.tab-check) {
    margin-left: 4px;
  }

  .viewer-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .artifact-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 16px 0;
  }

  .mermaid-block {
    background: var(--color-bg-subtle);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    overflow-x: auto;
  }

  .mermaid-block pre {
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .description-block {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
  }

  .prd-summary {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(124, 58, 237, 0.02) 100%);
    border-left: 3px solid var(--color-primary);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .prd-content {
    background: var(--color-bg-subtle);
    border-radius: 8px;
    padding: 16px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: var(--color-bg-subtle);
    border-radius: 8px;
  }

  .task-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--color-primary);
    color: white;
    font-size: 11px;
    font-weight: 600;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-content {
    flex: 1;
  }

  .task-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .task-description {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .files-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--color-bg-subtle);
    border-radius: 6px;
    font-size: 13px;
  }

  .file-path {
    flex: 1;
    color: var(--color-text);
  }

  .file-language {
    font-size: 10px;
    padding: 2px 8px;
    background: var(--color-primary);
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--color-text-muted);
  }

  .viewer-footer {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .complete-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #22c55e;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .complete-btn:hover {
    background: #16a34a;
  }

  .download-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .download-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .download-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .artifact-viewer {
      max-height: 90vh;
      border-radius: 12px;
    }

    .viewer-tabs {
      padding: 8px 12px;
    }

    .tab {
      padding: 6px 12px;
      font-size: 12px;
    }

    .viewer-content {
      padding: 12px;
    }
  }
</style>
