<script lang="ts">
  /**
   * FileExplorerPanel – professional right-side file tree when workspace or project is active.
   * Recursively expands directories, uses proper file/folder icons.
   */
  import { getWorkspaceTree, type WorkspaceTreeEntry } from '../lib/api.js';
  import { workspaceStore } from '../stores/workspaceStore';
  import { showToast } from '../stores/toastStore';
  import {
    FolderOpen,
    FolderClosed,
    FileText,
    FileCode,
    FileImage,
    FileJson,
    ChevronRight,
    ChevronDown,
    X,
    RefreshCw,
    File,
    FolderPlus,
  } from 'lucide-svelte';

  interface Props {
    workspaceRoot: string | null;
    onClose?: () => void;
  }

  let { workspaceRoot, onClose }: Props = $props();
  const root = $derived(workspaceRoot ?? null);

  let loading = $state(false);
  let error = $state<string | null>(null);
  let currentPath = $state<string>('');
  let entries = $state<WorkspaceTreeEntry[]>([]);
  let expanded = $state<Set<string>>(new Set());
  let childrenCache = $state<Map<string, WorkspaceTreeEntry[]>>(new Map());
  let showManualPath = $state(false);
  let manualPathInput = $state('');

  async function loadTree(path: string | null) {
    if (!path?.trim()) {
      entries = [];
      currentPath = '';
      return;
    }
    loading = true;
    error = null;
    try {
      const data = await getWorkspaceTree(path);
      currentPath = data.path;
      entries = data.entries;
    } catch (e) {
      const msg = (e as Error).message || 'Unknown error';
      if (msg.includes('404') || msg.includes('not found')) {
        error = 'Directory not found. The workspace path may have moved or been deleted.';
      } else if (msg.includes('403') || msg.includes('Forbidden')) {
        error = 'Access denied to this directory.';
      } else {
        error = `Could not access workspace: ${msg}`;
      }
      entries = [];
    } finally {
      loading = false;
    }
  }

  async function toggleDir(entry: WorkspaceTreeEntry) {
    if (!entry.isDirectory) return;
    const key = entry.path;
    if (expanded.has(key)) {
      expanded = new Set(expanded);
      expanded.delete(key);
      return;
    }
    if (childrenCache.has(key)) {
      expanded = new Set(expanded);
      expanded.add(key);
      return;
    }
    loading = true;
    error = null;
    try {
      const data = await getWorkspaceTree(entry.path);
      childrenCache = new Map(childrenCache);
      childrenCache.set(key, data.entries);
      expanded = new Set(expanded);
      expanded.add(key);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function getChildren(path: string): WorkspaceTreeEntry[] {
    return childrenCache.get(path) ?? [];
  }

  function getFileExtension(name: string): string {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  function getRootName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
  }

  $effect(() => {
    if (root) {
      currentPath = root;
      loadTree(root);
    } else {
      entries = [];
      currentPath = '';
      error = null;
    }
  });

  async function handlePickFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        // showDirectoryPicker doesn't give the full path in all contexts;
        // fall through to the manual input for now.
      } catch {
        // cancelled
        return;
      }
    }
    showManualPath = true;
  }

  function handleSetManualPath() {
    const trimmed = manualPathInput.trim();
    if (!trimmed) return;
    workspaceStore.setWorkspace(trimmed);
    showManualPath = false;
    manualPathInput = '';
    showToast(`Workspace set to: ${trimmed}`, 'success');
  }

  function handleManualKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSetManualPath();
    if (e.key === 'Escape') {
      showManualPath = false;
      manualPathInput = '';
    }
  }
</script>

<div class="file-explorer-panel">
  <!-- Header -->
  <div class="panel-header">
    <div class="header-left">
      <FolderOpen size={15} class="header-icon" />
      <span class="panel-title">Explorer</span>
    </div>
    <div class="header-actions">
      <button
        type="button"
        class="header-btn open-folder-btn"
        onclick={handlePickFolder}
        title="Open Folder"
        aria-label="Open a local folder"
      >
        <FolderPlus size={13} />
      </button>
      <button
        type="button"
        class="header-btn"
        onclick={() => loadTree(root)}
        title="Refresh"
        aria-label="Refresh file tree"
      >
        <RefreshCw size={13} />
      </button>
      {#if onClose}
        <button
          type="button"
          class="header-btn"
          onclick={onClose}
          title="Close"
          aria-label="Close file explorer"
        >
          <X size={14} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Path breadcrumb -->
  {#if currentPath}
    <div class="path-breadcrumb">
      <span class="breadcrumb-text">{getRootName(currentPath)}</span>
    </div>
  {/if}

  <!-- Body -->
  <div class="panel-body">
    {#if showManualPath}
      <div class="manual-path-bar">
        <input
          type="text"
          class="manual-path-input"
          bind:value={manualPathInput}
          onkeydown={handleManualKeydown}
          placeholder="C:\Users\You\Projects"
        />
        <button class="manual-path-set" onclick={handleSetManualPath}>Set</button>
        <button
          class="manual-path-cancel"
          onclick={() => {
            showManualPath = false;
            manualPathInput = '';
          }}>×</button
        >
      </div>
    {/if}

    {#if !root}
      <div class="empty-state">
        <FolderOpen size={28} class="empty-icon" />
        <p class="empty-text">No workspace folder selected.</p>
        <button class="pick-folder-btn" onclick={handlePickFolder}>
          <FolderPlus size={14} />
          <span>Open Folder</span>
        </button>
      </div>
    {:else if loading && entries.length === 0}
      <div class="loading-state">
        <RefreshCw size={16} class="spin" />
        <span>Loading…</span>
      </div>
    {:else if error}
      <p class="error-hint">{error}</p>
    {:else}
      <div class="tree-root">
        {#each entries as entry (entry.path)}
          {@const ext = getFileExtension(entry.name)}
          <div class="tree-item" class:directory={entry.isDirectory}>
            {#if entry.isDirectory}
              <button
                type="button"
                class="tree-row dir-row"
                onclick={() => toggleDir(entry)}
                aria-expanded={expanded.has(entry.path)}
              >
                <span class="tree-chevron">
                  {#if expanded.has(entry.path)}
                    <ChevronDown size={14} />
                  {:else}
                    <ChevronRight size={14} />
                  {/if}
                </span>
                <span class="tree-icon folder-icon">
                  {#if expanded.has(entry.path)}
                    <FolderOpen size={15} />
                  {:else}
                    <FolderClosed size={15} />
                  {/if}
                </span>
                <span class="tree-name">{entry.name}</span>
              </button>
              {#if expanded.has(entry.path)}
                <div class="tree-children">
                  {#each getChildren(entry.path) as child (child.path)}
                    {@const childExt = getFileExtension(child.name)}
                    <div class="tree-item" class:directory={child.isDirectory}>
                      {#if child.isDirectory}
                        <button
                          type="button"
                          class="tree-row dir-row"
                          onclick={() => toggleDir(child)}
                          aria-expanded={expanded.has(child.path)}
                        >
                          <span class="tree-chevron">
                            {#if expanded.has(child.path)}
                              <ChevronDown size={14} />
                            {:else}
                              <ChevronRight size={14} />
                            {/if}
                          </span>
                          <span class="tree-icon folder-icon">
                            {#if expanded.has(child.path)}
                              <FolderOpen size={15} />
                            {:else}
                              <FolderClosed size={15} />
                            {/if}
                          </span>
                          <span class="tree-name">{child.name}</span>
                        </button>
                        {#if expanded.has(child.path)}
                          <div class="tree-children">
                            {#each getChildren(child.path) as grandchild (grandchild.path)}
                              <div class="tree-item">
                                <span class="tree-row leaf-row">
                                  <span class="tree-chevron-placeholder"></span>
                                  <span class="tree-icon file-icon">
                                    {#if grandchild.isDirectory}
                                      <FolderClosed size={15} />
                                    {:else if ['ts', 'tsx', 'js', 'jsx', 'svelte', 'py', 'go', 'rs', 'java', 'css', 'scss', 'html'].includes(getFileExtension(grandchild.name))}
                                      <FileCode size={15} />
                                    {:else if ['json', 'yaml', 'yml', 'toml'].includes(getFileExtension(grandchild.name))}
                                      <FileJson size={15} />
                                    {:else if ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(getFileExtension(grandchild.name))}
                                      <FileImage size={15} />
                                    {:else}
                                      <File size={15} />
                                    {/if}
                                  </span>
                                  <span class="tree-name">{grandchild.name}</span>
                                </span>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {:else}
                        <span class="tree-row leaf-row">
                          <span class="tree-chevron-placeholder"></span>
                          <span class="tree-icon file-icon">
                            {#if ['ts', 'tsx', 'js', 'jsx', 'svelte', 'py', 'go', 'rs', 'java', 'css', 'scss', 'html'].includes(childExt)}
                              <FileCode size={15} />
                            {:else if ['json', 'yaml', 'yml', 'toml'].includes(childExt)}
                              <FileJson size={15} />
                            {:else if ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(childExt)}
                              <FileImage size={15} />
                            {:else}
                              <File size={15} />
                            {/if}
                          </span>
                          <span class="tree-name">{child.name}</span>
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            {:else}
              <span class="tree-row leaf-row">
                <span class="tree-chevron-placeholder"></span>
                <span class="tree-icon file-icon">
                  {#if ['ts', 'tsx', 'js', 'jsx', 'svelte', 'py', 'go', 'rs', 'java', 'css', 'scss', 'html'].includes(ext)}
                    <FileCode size={15} />
                  {:else if ['json', 'yaml', 'yml', 'toml'].includes(ext)}
                    <FileJson size={15} />
                  {:else if ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)}
                    <FileImage size={15} />
                  {:else}
                    <File size={15} />
                  {/if}
                </span>
                <span class="tree-name">{entry.name}</span>
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .file-explorer-panel {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 260px;
    height: 100%;
    border-left: 1px solid var(--color-border-light, #e8e8ec);
    background: var(--color-bg-card, #ffffff);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideInRight 0.25s ease;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .file-explorer-panel {
      animation: none;
    }
  }

  /* ── Header ───────────────────────────────────── */
  .panel-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border-light, #e8e8ec);
    background: var(--color-bg-subtle, #fafafa);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-left :global(.header-icon) {
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1a1a2e);
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #71717a);
    border-radius: 6px;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .header-btn:hover {
    background: var(--color-bg-card-hover, #f0f0f4);
    color: var(--color-text, #1a1a2e);
  }

  /* ── Breadcrumb ───────────────────────────────── */
  .path-breadcrumb {
    flex-shrink: 0;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border-light, #e8e8ec);
    background: var(--color-bg-subtle, #fafafa);
  }

  .breadcrumb-text {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #71717a);
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Body ──────────────────────────────────────── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  .panel-body::-webkit-scrollbar {
    width: 6px;
  }

  .panel-body::-webkit-scrollbar-thumb {
    background: var(--color-border, #d4d4d8);
    border-radius: 3px;
  }

  .panel-body::-webkit-scrollbar-track {
    background: transparent;
  }

  /* ── Empty / Loading / Error states ────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 2rem 1rem;
    text-align: center;
  }

  .empty-state :global(.empty-icon) {
    color: var(--color-text-muted, #a1a1aa);
    opacity: 0.5;
  }

  .empty-text {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    margin: 0;
    line-height: 1.4;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 1.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

  .loading-state :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-hint {
    font-size: 0.8125rem;
    color: var(--color-error, #dc2626);
    padding: 1rem 0.75rem;
    margin: 0;
    line-height: 1.4;
  }

  /* ── Tree ──────────────────────────────────────── */
  .tree-root {
    display: flex;
    flex-direction: column;
  }

  .tree-item {
    display: flex;
    flex-direction: column;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 10px;
    font-size: 0.8125rem;
    color: var(--color-text, #1a1a2e);
    text-align: left;
    width: 100%;
    border: none;
    background: transparent;
    cursor: default;
    transition: background 80ms ease;
    user-select: none;
    line-height: 1.35;
    min-height: 28px;
  }

  .dir-row {
    cursor: pointer;
    font-weight: 500;
  }

  .dir-row:hover {
    background: var(--color-bg-card-hover, #f4f4f8);
  }

  .leaf-row:hover {
    background: var(--color-bg-card-hover, #f4f4f8);
  }

  .tree-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    flex-shrink: 0;
    color: var(--color-text-muted, #a1a1aa);
  }

  .tree-chevron-placeholder {
    width: 16px;
    flex-shrink: 0;
  }

  .tree-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    flex-shrink: 0;
  }

  .folder-icon {
    color: var(--color-primary, #7c3aed);
  }

  .file-icon {
    color: var(--color-text-muted, #a1a1aa);
  }

  .tree-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-children {
    padding-left: 12px;
    margin-left: 10px;
    border-left: 1px solid var(--color-border-light, #ececf0);
  }

  /* ── Folder picker additions ─────────── */
  .open-folder-btn {
    color: var(--color-primary, #7c3aed) !important;
  }

  .manual-path-bar {
    display: flex;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--color-border-light, #ececf0);
    background: var(--color-bg-subtle, #fafafa);
  }

  .manual-path-input {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: var(--color-text, #1a1a2e);
    background: var(--color-bg-card, #fff);
    outline: none;
  }

  .manual-path-input:focus {
    border-color: var(--color-primary, #7c3aed);
  }

  .manual-path-set {
    padding: 3px 8px;
    border: none;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--color-primary, #7c3aed);
    color: #fff;
    cursor: pointer;
  }

  .manual-path-cancel {
    padding: 3px 6px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #a1a1aa);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .pick-folder-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-primary, #7c3aed);
    color: #fff;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pick-folder-btn:hover {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  }
</style>
