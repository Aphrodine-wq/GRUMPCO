<script lang="ts">
  /**
   * CodeDiffViewer — Claude Code-inspired dark diff viewer
   *
   * Shows diffs with a dark terminal aesthetic, file path header,
   * diff stats, side-by-side or unified view, and quick actions.
   */
  import { onMount } from 'svelte';
  import {
    computeLineDiff,
    formatDiffSummary,
    detectLanguage,
    type FileDiff,
  } from '../utils/diffUtils';
  import { showToast } from '../stores/toastStore';

  interface Props {
    diff: FileDiff;
  }

  let { diff }: Props = $props();

  let viewMode: 'unified' | 'side-by-side' = $state('unified');
  let diffLines = $state<Array<import('../utils/diffUtils').DiffLine>>([]);
  let isCollapsed = $state(false);
  let language = $derived(detectLanguage(diff.filePath));
  let summary = $state('');
  let _isLoading = $state(true);

  // ── Diff stats ───────────────────────────────────────────────────────
  const addedCount = $derived(diffLines.filter((l) => l.type === 'added').length);
  const removedCount = $derived(diffLines.filter((l) => l.type === 'removed').length);

  // ── Short path ───────────────────────────────────────────────────────
  function getShortPath(fp: string): string {
    const segs = fp.replace(/\\/g, '/').split('/');
    if (segs.length <= 3) return segs.join('/');
    return '…/' + segs.slice(-3).join('/');
  }

  const shortPath = $derived(getShortPath(diff.filePath));

  // ── Data loading ─────────────────────────────────────────────────────
  async function loadDiffData() {
    _isLoading = true;
    try {
      const [lines, diffSummary] = await Promise.all([
        computeLineDiff(diff.beforeContent, diff.afterContent),
        formatDiffSummary(diff),
      ]);
      diffLines = lines;
      summary = diffSummary;
    } catch (error) {
      console.error('Failed to load diff data:', error);
    } finally {
      _isLoading = false;
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────
  async function copyAfter() {
    try {
      await navigator.clipboard.writeText(diff.afterContent);
      showToast('Code copied', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }

  async function copyPatch() {
    try {
      let patch = `--- a/${diff.filePath}\n+++ b/${diff.filePath}\n`;
      for (const line of diffLines) {
        if (line.type === 'removed') patch += `-${line.content}\n`;
        else if (line.type === 'added') patch += `+${line.content}\n`;
        else patch += ` ${line.content}\n`;
      }
      await navigator.clipboard.writeText(patch);
      showToast('Patch copied', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }

  // ── Watch ────────────────────────────────────────────────────────────
  $effect(() => {
    if (diff) loadDiffData();
  });

  onMount(() => {
    /* Nothing extra needed */
  });
</script>

<div class="diff-viewer">
  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <div class="diff-header">
    <div class="header-left">
      <button class="collapse-btn" onclick={() => (isCollapsed = !isCollapsed)}>
        {isCollapsed ? '▸' : '▾'}
      </button>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="file-icon"
      >
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
      <span class="file-path" title={diff.filePath}>{shortPath}</span>
      <span
        class="change-badge"
        class:created={diff.changeType === 'created'}
        class:modified={diff.changeType === 'modified'}
        class:deleted={diff.changeType === 'deleted'}>{diff.changeType}</span
      >
    </div>
    <div class="header-right">
      {#if addedCount > 0 || removedCount > 0}
        <span class="diff-stats">
          {#if addedCount > 0}<span class="stat-added">+{addedCount}</span>{/if}
          {#if removedCount > 0}<span class="stat-removed">-{removedCount}</span>{/if}
        </span>
      {/if}
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={viewMode === 'unified'}
          onclick={() => (viewMode = 'unified')}
        >
          Unified
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'side-by-side'}
          onclick={() => (viewMode = 'side-by-side')}
        >
          Split
        </button>
      </div>
      <button class="action-btn" onclick={copyAfter} title="Copy final code">Copy</button>
      <button class="action-btn" onclick={copyPatch} title="Copy as patch">Patch</button>
    </div>
  </div>

  {#if !isCollapsed}
    {#if viewMode === 'unified'}
      <!-- ── Unified view ─────────────────────────────────────────── -->
      <div class="diff-body">
        {#each diffLines as line, idx (idx)}
          <div
            class="diff-line"
            class:added={line.type === 'added'}
            class:removed={line.type === 'removed'}
            class:unchanged={line.type === 'unchanged'}
          >
            <span class="line-num old">{line.oldLineNumber ?? ''}</span>
            <span class="line-num new">{line.newLineNumber ?? ''}</span>
            <span class="line-marker">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span class="line-code">{line.content}</span>
          </div>
        {/each}
      </div>
    {:else}
      <!-- ── Side-by-side view ────────────────────────────────────── -->
      <div class="split-view">
        <div class="split-pane">
          <div class="pane-label">Before</div>
          <div class="pane-body">
            {#each diffLines as line, idx (idx)}
              {#if line.type === 'removed' || line.type === 'unchanged'}
                <div
                  class="diff-line"
                  class:removed={line.type === 'removed'}
                  class:unchanged={line.type === 'unchanged'}
                >
                  <span class="line-num">{line.oldLineNumber ?? ''}</span>
                  <span class="line-code">{line.content}</span>
                </div>
              {:else}
                <div class="diff-line empty">
                  <span class="line-num"></span><span class="line-code"></span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
        <div class="split-pane">
          <div class="pane-label">After</div>
          <div class="pane-body">
            {#each diffLines as line, idx (idx)}
              {#if line.type === 'added' || line.type === 'unchanged'}
                <div
                  class="diff-line"
                  class:added={line.type === 'added'}
                  class:unchanged={line.type === 'unchanged'}
                >
                  <span class="line-num">{line.newLineNumber ?? ''}</span>
                  <span class="line-code">{line.content}</span>
                </div>
              {:else}
                <div class="diff-line empty">
                  <span class="line-num"></span><span class="line-code"></span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Container ────────────────────────────────────────────────────── */
  .diff-viewer {
    background: #0d1117;
    border-radius: 6px;
    overflow: hidden;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.75rem;
    line-height: 1.6;
  }

  /* ── Header ───────────────────────────────────────────────────────── */
  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #161b22;
    border-bottom: 1px solid rgba(99, 102, 241, 0.08);
    gap: 12px;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    padding: 0 2px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .collapse-btn:hover {
    color: #c9d1d9;
  }

  .file-icon {
    color: #58a6ff;
    flex-shrink: 0;
  }

  .file-path {
    color: #e6edf3;
    font-weight: 600;
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .change-badge {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .change-badge.created {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.12);
  }
  .change-badge.modified {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.12);
  }
  .change-badge.deleted {
    color: #f87171;
    background: rgba(248, 113, 113, 0.12);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* ── Diff stats ───────────────────────────────────────────────────── */
  .diff-stats {
    display: flex;
    gap: 4px;
    font-weight: 700;
    font-size: 0.72rem;
  }

  .stat-added {
    color: #22c55e;
  }
  .stat-removed {
    color: #f87171;
  }

  /* ── View toggle ──────────────────────────────────────────────────── */
  .view-toggle {
    display: flex;
    background: rgba(99, 102, 241, 0.06);
    border-radius: 4px;
    overflow: hidden;
  }

  .toggle-btn {
    padding: 3px 10px;
    border: none;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.65rem;
    transition: all 0.1s;
  }

  .toggle-btn:hover {
    color: #c9d1d9;
  }

  .toggle-btn.active {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: #8b949e;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 0.85rem;
    transition: all 0.1s;
  }

  .action-btn:hover {
    color: #c9d1d9;
    background: rgba(99, 102, 241, 0.06);
  }

  /* ── Diff body (unified) ──────────────────────────────────────────── */
  .diff-body {
    max-height: 500px;
    overflow: auto;
  }

  .diff-line {
    display: flex;
    align-items: stretch;
    min-height: 22px;
    line-height: 22px;
  }

  .diff-line.added {
    background: rgba(34, 197, 94, 0.08);
  }

  .diff-line.removed {
    background: rgba(248, 113, 113, 0.08);
  }

  .diff-line.unchanged {
    background: transparent;
  }

  .diff-line.empty {
    background: rgba(13, 17, 23, 0.3);
    min-height: 22px;
  }

  .line-num {
    display: inline-block;
    min-width: 36px;
    padding: 0 6px;
    text-align: right;
    color: #484f58;
    user-select: none;
    flex-shrink: 0;
    font-size: 0.68rem;
  }

  .line-num.old {
    min-width: 32px;
    border-right: 1px solid rgba(99, 102, 241, 0.04);
  }

  .line-num.new {
    min-width: 32px;
    border-right: 1px solid rgba(99, 102, 241, 0.04);
  }

  .diff-line.added .line-num {
    color: rgba(34, 197, 94, 0.6);
  }
  .diff-line.removed .line-num {
    color: rgba(248, 113, 113, 0.6);
  }

  .line-marker {
    display: inline-block;
    width: 16px;
    text-align: center;
    color: #484f58;
    user-select: none;
    flex-shrink: 0;
    font-weight: 600;
  }

  .diff-line.added .line-marker {
    color: #22c55e;
  }
  .diff-line.removed .line-marker {
    color: #f87171;
  }

  .line-code {
    flex: 1;
    padding: 0 8px;
    white-space: pre;
    color: #c9d1d9;
    overflow-x: auto;
  }

  .diff-line.added .line-code {
    color: #b8e6c8;
  }
  .diff-line.removed .line-code {
    color: #f5b3b3;
    text-decoration: line-through;
    text-decoration-color: rgba(248, 113, 113, 0.3);
  }

  /* ── Split view ───────────────────────────────────────────────────── */
  .split-view {
    display: flex;
    max-height: 500px;
    overflow: auto;
  }

  .split-pane {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  .split-pane:first-child {
    border-right: 1px solid rgba(99, 102, 241, 0.08);
  }

  .pane-label {
    padding: 4px 12px;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #484f58;
    background: #161b22;
    border-bottom: 1px solid rgba(99, 102, 241, 0.06);
  }

  .pane-body {
    overflow-x: auto;
  }

  .split-pane .diff-line .line-num {
    min-width: 36px;
  }

  .split-pane .diff-line .line-code {
    padding: 0 8px;
  }
</style>
