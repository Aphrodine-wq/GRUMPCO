<script lang="ts">
  /**
   * ToolResultCard — Claude Code-inspired design
   *
   * Shows the result of a tool execution with file path,
   * diff counts, execution time, and inline diff viewer.
   * Matches the dark terminal aesthetic.
   */

  import CodeDiffViewer from './CodeDiffViewer.svelte';
  import type { FileDiff } from '../types';

  interface Props {
    toolResult?: {
      type: 'tool_result';
      id: string;
      toolName: string;
      output: string;
      success: boolean;
      executionTime?: number;
      diff?: FileDiff;
    };
  }

  let { toolResult }: Props = $props();

  // ── Tool classification ──────────────────────────────────────────────
  const FILE_TOOLS = new Set([
    'file_write',
    'file_edit',
    'write_file',
    'edit_file',
    'replace_file_content',
    'multi_replace_file_content',
    'write_to_file',
  ]);
  const CREATE_TOOLS = new Set(['file_write', 'write_file', 'write_to_file']);
  const READ_TOOLS = new Set(['read_file', 'view_file', 'view_file_outline', 'view_code_item']);
  const EXEC_TOOLS = new Set(['bash_execute', 'run_command', 'execute_command', 'terminal']);

  type ToolCategory = 'write' | 'read' | 'exec' | 'other';

  function getCategory(name?: string): ToolCategory {
    if (!name) return 'other';
    if (FILE_TOOLS.has(name)) return 'write';
    if (READ_TOOLS.has(name)) return 'read';
    if (EXEC_TOOLS.has(name)) return 'exec';
    return 'other';
  }

  // ── Data extraction ──────────────────────────────────────────────────
  function getFilePath(): string | null {
    if (!toolResult) return null;
    if (toolResult.diff?.filePath) return toolResult.diff.filePath;
    // Try to extract from output
    const match = toolResult.output?.match(
      /(?:File|Path|Wrote|Created|Updated|Modified):\s*([^\n\r]+)/im
    );
    return match?.[1]?.trim() || null;
  }

  function getShortPath(fullPath: string): string {
    const segments = fullPath.replace(/\\/g, '/').split('/');
    if (segments.length <= 4) return segments.join('/');
    return '…/' + segments.slice(-4).join('/');
  }

  function getDiffStats(): { added: number; removed: number } | null {
    if (!toolResult?.diff) return null;
    const before = toolResult.diff.beforeContent || '';
    const after = toolResult.diff.afterContent || '';
    const beforeLines = before ? before.split('\n').length : 0;
    const afterLines = after ? after.split('\n').length : 0;
    if (toolResult.diff.changeType === 'created') {
      return { added: afterLines, removed: 0 };
    }
    if (toolResult.diff.changeType === 'deleted') {
      return { added: 0, removed: beforeLines };
    }
    // For modified: compute rough diff
    const added = Math.max(0, afterLines - beforeLines);
    const removed = Math.max(0, beforeLines - afterLines);
    return { added: added || afterLines, removed: removed || beforeLines };
  }

  function getChangeLabel(): string {
    const type = toolResult?.diff?.changeType;
    if (type === 'created') return 'Created';
    if (type === 'modified') return 'Modified';
    if (type === 'deleted') return 'Deleted';
    // Fallback based on tool name
    if (CREATE_TOOLS.has(toolResult?.toolName ?? '')) return 'Created';
    if (FILE_TOOLS.has(toolResult?.toolName ?? '')) return 'Modified';
    return 'Changed';
  }

  function formatTime(ms?: number): string {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  // ── Derived ──────────────────────────────────────────────────────────
  const category = $derived(getCategory(toolResult?.toolName));
  const isFileOp = $derived(FILE_TOOLS.has(toolResult?.toolName ?? ''));
  const filePath = $derived(getFilePath());
  const shortPath = $derived(filePath ? getShortPath(filePath) : null);
  const diffStats = $derived(getDiffStats());
  const changeLabel = $derived(getChangeLabel());
  const execTime = $derived(formatTime(toolResult?.executionTime));

  let showOutput = $state(false);
  let showDiff = $state(true);
  /** When true, output is expanded; when false, long output is truncated with "Show more". */
  let outputExpanded = $state(false);

  const OUTPUT_MAX_LINES = 24;
  const outputLines = $derived((toolResult?.output ?? '').split('\n').length);
  const outputTruncated = $derived(outputLines > OUTPUT_MAX_LINES);
</script>

{#if toolResult}
  <div
    class="result-card"
    class:is-success={toolResult.success}
    class:is-error={!toolResult.success}
    class:write={category === 'write'}
    class:read={category === 'read'}
    class:exec={category === 'exec'}
  >
    <!-- Header row -->
    <div class="result-row">
      <div class="result-left">
        {#if toolResult.success}
          <span class="result-icon success">✓</span>
        {:else}
          <span class="result-icon error">✗</span>
        {/if}
        {#if isFileOp && changeLabel}
          <span
            class="change-chip"
            class:created={changeLabel === 'Created'}
            class:modified={changeLabel === 'Modified'}
            class:deleted={changeLabel === 'Deleted'}
          >
            {changeLabel}
          </span>
        {/if}
        {#if filePath}
          <code class="inline-path" title={filePath}>{shortPath}</code>
        {:else}
          <span class="tool-name">{toolResult.toolName}</span>
        {/if}
      </div>
      <div class="result-right">
        {#if diffStats}
          <span class="diff-stat">
            <span class="diff-added">+{diffStats.added}</span>
            <span class="diff-removed">-{diffStats.removed}</span>
          </span>
        {/if}
        {#if execTime}
          <span class="exec-time">{execTime}</span>
        {/if}
        <span
          class="status-badge"
          class:success={toolResult.success}
          class:error={!toolResult.success}
        >
          {toolResult.success ? 'Success' : 'Error'}
        </span>
      </div>
    </div>

    <!-- File path row -->
    {#if filePath}
      <div class="file-row">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <code class="file-path" title={filePath}>{shortPath}</code>
      </div>
    {/if}

    <!-- Diff viewer (shown by default for file operations) -->
    {#if toolResult.diff && isFileOp}
      <div class="diff-section">
        <button class="section-toggle" onclick={() => (showDiff = !showDiff)}>
          {showDiff ? '▾' : '▸'} Diff
          {#if diffStats}
            <span class="toggle-stats">
              <span class="diff-added">+{diffStats.added}</span>
              <span class="diff-removed">-{diffStats.removed}</span>
            </span>
          {/if}
        </button>
        {#if showDiff}
          <div class="diff-wrapper">
            <CodeDiffViewer diff={toolResult.diff} />
          </div>
        {/if}
      </div>
    {/if}

    <!-- Output (for non-file operations, or errors) -->
    {#if toolResult.output && (!isFileOp || !toolResult.success)}
      <div class="output-section">
        {#if isFileOp}
          <button class="section-toggle" onclick={() => (showOutput = !showOutput)}>
            {showOutput ? '▾' : '▸'} Output
          </button>
        {/if}
        {#if !isFileOp || showOutput}
          <pre
            class="output-text"
            class:error-output={!toolResult.success}
            class:output-collapsed={outputTruncated && !outputExpanded}>{toolResult.output}</pre>
          {#if outputTruncated}
            <button
              type="button"
              class="output-expand-btn"
              onclick={() => (outputExpanded = !outputExpanded)}
            >
              {outputExpanded ? 'Show less' : 'Show more'}
            </button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .result-card {
    background: #0d1117;
    border: 1px solid rgba(99, 102, 241, 0.12);
    border-radius: 8px;
    overflow: hidden;
    margin: 6px 0;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.78rem;
  }

  .result-card.write {
    border-left: 3px solid #22c55e;
  }
  .result-card.read {
    border-left: 3px solid #3b82f6;
  }
  .result-card.exec {
    border-left: 3px solid #a855f7;
  }
  .result-card.is-error {
    border-left: 3px solid #ef4444;
  }

  /* ── Header row ───────────────────────────────────────────────────── */
  .result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    gap: 8px;
  }

  .result-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .result-icon {
    font-size: 0.9rem;
    font-weight: 600;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
  }

  .result-icon.success {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.12);
  }

  .result-icon.error {
    color: #f87171;
    background: rgba(248, 113, 113, 0.12);
  }

  .tool-name {
    font-weight: 600;
    color: #e6edf3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .change-chip {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .change-chip.created {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .change-chip.modified {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .change-chip.deleted {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .inline-path {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.75rem;
    color: #c9d1d9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .result-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* ── Diff stat ────────────────────────────────────────────────────── */
  .diff-stat {
    display: flex;
    gap: 4px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .diff-added {
    color: #22c55e;
  }

  .diff-removed {
    color: #f87171;
  }

  /* ── Execution time ───────────────────────────────────────────────── */
  .exec-time {
    font-size: 0.65rem;
    color: #484f58;
    font-weight: 500;
  }

  /* ── Status badge ─────────────────────────────────────────────────── */
  .status-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-badge.success {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .status-badge.error {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  /* ── File row ─────────────────────────────────────────────────────── */
  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 12px 8px;
    color: #8b949e;
  }

  .file-row svg {
    flex-shrink: 0;
    color: #58a6ff;
  }

  .file-path {
    color: #58a6ff;
    font-size: 0.72rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
  }

  /* ── Section toggles ──────────────────────────────────────────────── */
  .section-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(99, 102, 241, 0.06);
    color: #8b949e;
    font-family: inherit;
    font-size: 0.68rem;
    cursor: pointer;
    text-align: left;
    transition: color 0.1s;
  }

  .section-toggle:hover {
    color: #c9d1d9;
  }

  .toggle-stats {
    display: flex;
    gap: 4px;
    font-weight: 600;
  }

  /* ── Diff wrapper ─────────────────────────────────────────────────── */
  .diff-wrapper {
    border-top: 1px solid rgba(99, 102, 241, 0.06);
    max-height: 500px;
    overflow-y: auto;
  }

  /* ── Output ───────────────────────────────────────────────────────── */
  .output-section {
    border-top: 1px solid rgba(99, 102, 241, 0.06);
  }

  .output-text {
    margin: 0;
    padding: 8px 12px;
    font-size: 0.72rem;
    line-height: 1.5;
    color: #c9d1d9;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-y: auto;
  }

  .output-text.output-collapsed {
    max-height: 10rem;
  }

  .output-text:not(.output-collapsed) {
    max-height: 300px;
  }

  .output-expand-btn {
    display: block;
    width: 100%;
    padding: 6px 12px;
    margin: 0;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6366f1;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(99, 102, 241, 0.1);
    cursor: pointer;
    text-align: center;
  }

  .output-expand-btn:hover {
    background: rgba(99, 102, 241, 0.06);
  }

  .output-text.error-output {
    color: #fca5a5;
    background: rgba(248, 113, 113, 0.04);
  }
</style>
