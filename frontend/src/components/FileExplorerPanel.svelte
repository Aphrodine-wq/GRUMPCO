<script lang="ts">
  /**
   * FileExplorerPanel – right-side file tree when workspace or project is active.
   * Lists directory entries from GET /api/workspace/tree; expand dirs on demand.
   */
  import { getWorkspaceTree, type WorkspaceTreeEntry } from '../lib/api.js';

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
</script>

<div class="file-explorer-panel">
  <div class="panel-header">
    <span class="panel-title">Files</span>
    {#if onClose}
      <button type="button" class="panel-close" onclick={onClose} aria-label="Close file explorer"
        >×</button
      >
    {/if}
  </div>
  <div class="panel-body">
    {#if !root}
      <p class="empty-hint">Open a folder or load a repo to see files.</p>
    {:else if loading && entries.length === 0}
      <p class="loading-hint">Loading…</p>
    {:else if error}
      <p class="error-hint">{error}</p>
    {:else}
      <div class="tree-root">
        {#each entries as entry (entry.path)}
          <div class="tree-item" class:directory={entry.isDirectory}>
            {#if entry.isDirectory}
              <button
                type="button"
                class="tree-row"
                onclick={() => toggleDir(entry)}
                aria-expanded={expanded.has(entry.path)}
              >
                <span class="tree-icon">{expanded.has(entry.path) ? '−' : '+'}</span>
                <span class="tree-name">{entry.name}</span>
              </button>
              {#if expanded.has(entry.path)}
                <div class="tree-children">
                  {#each getChildren(entry.path) as child (child.path)}
                    <div class="tree-item" class:directory={child.isDirectory}>
                      <span class="tree-row leaf">
                        <span class="tree-icon"></span>
                        <span class="tree-name">{child.name}</span>
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            {:else}
              <span class="tree-row leaf">
                <span class="tree-icon"></span>
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
    border-left: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-subtle, #f4f4f5);
    overflow: hidden;
  }

  .panel-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-card, #fff);
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .panel-close {
    padding: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    border-radius: 4px;
  }

  .panel-close:hover {
    background: var(--color-bg-subtle, #f4f4f5);
    color: var(--color-text, #18181b);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .empty-hint,
  .loading-hint,
  .error-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    padding: 1rem 0.75rem;
    margin: 0;
  }

  .error-hint {
    color: var(--color-error, #dc2626);
  }

  .tree-root {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .tree-item {
    display: flex;
    flex-direction: column;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-text, #18181b);
    text-align: left;
    width: 100%;
    border: none;
    background: transparent;
    cursor: default;
  }

  .tree-row:not(.leaf) {
    cursor: pointer;
  }

  .tree-row:not(.leaf):hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .tree-icon {
    display: inline-block;
    width: 1rem;
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
  }

  .tree-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-children {
    padding-left: 1rem;
    border-left: 1px solid var(--color-border-light, #e5e7eb);
    margin-left: 0.5rem;
  }
</style>
