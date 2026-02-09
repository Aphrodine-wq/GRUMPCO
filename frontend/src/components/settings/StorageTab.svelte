<script lang="ts">
  /**
   * StorageTab – Settings tab for configuring local file storage.
   *
   * Lets the user pick a folder on their PC where the AI writes files.
   * Uses the native showDirectoryPicker() API when available (Electron / Chrome),
   * with a text-input fallback for other browsers.
   */
  import { onMount } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore';
  import { showToast } from '../../stores/toastStore';
  import { Card } from '../../lib/design-system';
  import {
    FolderOpen,
    HardDrive,
    Check,
    X,
    RefreshCw,
    AlertCircle,
    FileText,
    FolderPlus,
  } from 'lucide-svelte';

  let currentRoot = $state<string | null>(null);
  let showManualInput = $state(false);
  let manualPath = $state('');
  let syncing = $state(false);
  let syncStatus = $state<'idle' | 'synced' | 'error'>('idle');

  // Subscribe to workspace store
  $effect(() => {
    const unsub = workspaceStore.subscribe((v) => {
      currentRoot = v.root;
    });
    return unsub;
  });

  /**
   * Open native folder picker or fall back to manual input
   */
  async function handlePickFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        // The browser API only gives us the folder name, not the full path.
        // In Electron with contextIsolation we can get the full path.
        // For now, use the name and let the user confirm.
        const fullPath = dirHandle.name;

        // Try to get full path from Electron if available
        if ((window as any).grump?.getPath) {
          // In Electron, showDirectoryPicker returns a handle.
          // We'll fall back to manual input with the name pre-filled.
          showManualInput = true;
          manualPath = fullPath;
          showToast('Enter the full path to your folder below', 'info');
          return;
        }

        // For web with File System Access API, only the name is available
        showManualInput = true;
        manualPath = fullPath;
        showToast('Enter the full absolute path to set your workspace', 'info');
      } catch {
        // User cancelled the picker
      }
    } else {
      showManualInput = true;
    }
  }

  async function handleSetPath() {
    const trimmed = manualPath.trim();
    if (!trimmed) {
      showToast('Please enter a folder path', 'error');
      return;
    }

    syncing = true;
    syncStatus = 'idle';
    try {
      workspaceStore.setWorkspace(trimmed);
      showManualInput = false;
      syncStatus = 'synced';
      showToast(`Workspace set to: ${trimmed}`, 'success');
    } catch (e) {
      syncStatus = 'error';
      showToast(`Failed to set workspace: ${(e as Error).message}`, 'error');
    } finally {
      syncing = false;
    }
  }

  function handleClear() {
    workspaceStore.clear();
    syncStatus = 'idle';
    showManualInput = false;
    manualPath = '';
    showToast('Workspace cleared', 'info');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSetPath();
    if (e.key === 'Escape') {
      showManualInput = false;
      manualPath = '';
    }
  }
</script>

<div class="storage-tab">
  <!-- Main storage card -->
  <Card title="File Output Location" padding="md">
    <p class="section-desc">
      Choose where the AI writes files on your PC. When you set a workspace folder, all generated
      code, configs, and project files will be saved directly to that location.
    </p>

    <!-- Current status -->
    <div class="storage-status" class:active={!!currentRoot} class:inactive={!currentRoot}>
      <div class="status-icon-wrap">
        {#if currentRoot}
          <HardDrive size={20} />
        {:else}
          <AlertCircle size={20} />
        {/if}
      </div>
      <div class="status-info">
        <span class="status-label">
          {currentRoot ? 'Active Workspace' : 'No Workspace Set'}
        </span>
        {#if currentRoot}
          <span class="status-path">{currentRoot}</span>
        {:else}
          <span class="status-hint">
            Pick a local folder so the AI writes files directly to your PC.
          </span>
        {/if}
      </div>
      {#if currentRoot}
        <div class="status-badge synced">
          <Check size={12} />
          <span>Active</span>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="storage-actions">
      <button class="action-btn primary" onclick={handlePickFolder} disabled={syncing}>
        <FolderPlus size={16} />
        <span>{currentRoot ? 'Change Folder' : 'Choose Folder'}</span>
      </button>

      {#if currentRoot}
        <button class="action-btn secondary" onclick={handleClear} disabled={syncing}>
          <X size={16} />
          <span>Clear</span>
        </button>
      {/if}
    </div>

    <!-- Manual path input -->
    {#if showManualInput}
      <div class="manual-input-section">
        <label class="input-label" for="storage-path-input"> Enter the full folder path: </label>
        <div class="input-row">
          <div class="input-wrapper">
            <FolderOpen size={14} class="input-icon" />
            <input
              id="storage-path-input"
              type="text"
              class="path-input"
              bind:value={manualPath}
              onkeydown={handleKeydown}
              placeholder="C:\Users\You\Projects\my-app"
              disabled={syncing}
            />
          </div>
          <button
            class="action-btn primary compact"
            onclick={handleSetPath}
            disabled={syncing || !manualPath.trim()}
          >
            {#if syncing}
              <RefreshCw size={14} class="spin" />
            {:else}
              <Check size={14} />
            {/if}
            <span>Set</span>
          </button>
          <button
            class="action-btn secondary compact"
            onclick={() => {
              showManualInput = false;
              manualPath = '';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    {/if}
  </Card>

  <!-- Info card -->
  <Card title="How It Works" padding="md">
    <div class="info-list">
      <div class="info-item">
        <div class="info-icon">
          <FolderOpen size={16} />
        </div>
        <div class="info-content">
          <span class="info-title">Select a Local Folder</span>
          <span class="info-desc">
            Choose any folder on your PC — like your Projects directory or a new empty folder.
          </span>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">
          <FileText size={16} />
        </div>
        <div class="info-content">
          <span class="info-title">AI Writes Real Files</span>
          <span class="info-desc">
            When the AI generates code, it creates actual files and folders in your chosen
            directory. You can open them in VS Code, run builds, commit to Git — just like any other
            project.
          </span>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">
          <HardDrive size={16} />
        </div>
        <div class="info-content">
          <span class="info-title">Browse from File Explorer</span>
          <span class="info-desc">
            The right-side File Explorer panel shows your workspace's folder tree in real-time. You
            can also pick a folder directly from the Explorer header.
          </span>
        </div>
      </div>
    </div>
  </Card>
</div>

<style>
  .storage-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.5;
    margin: 0 0 1rem 0;
  }

  /* ── Status card ──────────────────────────────── */
  .storage-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid var(--color-border-light, #e8e8ec);
    background: var(--color-bg-subtle, #fafafa);
    margin-bottom: 1rem;
    transition: all 200ms ease;
  }

  .storage-status.active {
    border-color: rgba(124, 58, 237, 0.2);
    background: rgba(124, 58, 237, 0.04);
  }

  .storage-status.inactive {
    border-color: rgba(245, 158, 11, 0.2);
    background: rgba(245, 158, 11, 0.04);
  }

  .status-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 0.5rem;
    flex-shrink: 0;
  }

  .storage-status.active .status-icon-wrap {
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary, #7c3aed);
  }

  .storage-status.inactive .status-icon-wrap {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .status-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .status-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1a1a2e);
  }

  .status-path {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: var(--color-text-muted, #71717a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted, #a1a1aa);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.6875rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .status-badge.synced {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  /* ── Action buttons ──────────────────────────── */
  .storage-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 150ms ease;
    font-family: inherit;
  }

  .action-btn.primary {
    background: var(--color-primary, #7c3aed);
    color: #fff;
    border-color: var(--color-primary, #7c3aed);
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  }

  .action-btn.secondary {
    background: transparent;
    color: var(--color-text-muted, #71717a);
    border-color: var(--color-border, #e5e7eb);
  }

  .action-btn.secondary:hover:not(:disabled) {
    background: var(--color-bg-card-hover, #f4f4f8);
    color: var(--color-text, #1a1a2e);
  }

  .action-btn.compact {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Manual input ────────────────────────────── */
  .manual-input-section {
    margin-top: 0.75rem;
    padding: 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border-light, #e8e8ec);
    background: var(--color-bg-subtle, #fafafa);
  }

  .input-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text, #1a1a2e);
    margin-bottom: 0.5rem;
  }

  .input-row {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-wrapper :global(.input-icon) {
    position: absolute;
    left: 0.625rem;
    color: var(--color-text-muted, #a1a1aa);
    pointer-events: none;
  }

  .path-input {
    width: 100%;
    padding: 0.5rem 0.625rem 0.5rem 2rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: var(--color-text, #1a1a2e);
    background: var(--color-bg-card, #fff);
    outline: none;
    transition: border-color 150ms ease;
  }

  .path-input:focus {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
  }

  .path-input::placeholder {
    color: var(--color-text-muted, #a1a1aa);
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Info list ───────────────────────────────── */
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .info-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .info-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 0.5rem;
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .info-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1a1a2e);
  }

  .info-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.45;
  }
</style>
