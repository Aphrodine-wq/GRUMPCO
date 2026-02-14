<script lang="ts">
  /**
   * FilesChangedSummary Component
   *
   * Shows a summary of all files created/modified during a code generation turn.
   * Displayed at the end of agentic code generation, similar to Claude Code's output.
   */

  interface FileChange {
    path: string;
    changeType: 'created' | 'modified' | 'deleted';
    linesAdded: number;
    linesRemoved: number;
  }

  interface Props {
    files: FileChange[];
    commandsRun?: number;
    commandsPassed?: number;
    totalTurns?: number;
  }

  let { files = [], commandsRun = 0, commandsPassed = 0, totalTurns = 0 }: Props = $props();

  function getShortPath(fullPath: string): string {
    const segments = fullPath.replace(/\\/g, '/').split('/');
    if (segments.length <= 4) return segments.join('/');
    return '…/' + segments.slice(-4).join('/');
  }

  function getChangeIcon(type: FileChange['changeType']): string {
    switch (type) {
      case 'created':
        return '+';
      case 'modified':
        return '~';
      case 'deleted':
        return '-';
      default:
        return '·';
    }
  }

  const totalAdded = $derived(files.reduce((s, f) => s + f.linesAdded, 0));
  const totalRemoved = $derived(files.reduce((s, f) => s + f.linesRemoved, 0));
  const created = $derived(files.filter((f) => f.changeType === 'created').length);
  const modified = $derived(files.filter((f) => f.changeType === 'modified').length);
  const deleted = $derived(files.filter((f) => f.changeType === 'deleted').length);

  let expanded = $state(true);
</script>

{#if files.length > 0 || commandsRun > 0}
  <div class="summary-card">
    <button class="summary-header" onclick={() => (expanded = !expanded)}>
      <div class="header-left">
        <span class="header-icon">▷</span>
        <span class="header-title">Files Changed</span>
        <span class="header-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="header-right">
        {#if totalAdded > 0}
          <span class="total-added">+{totalAdded}</span>
        {/if}
        {#if totalRemoved > 0}
          <span class="total-removed">-{totalRemoved}</span>
        {/if}
        <span class="expand-icon">{expanded ? '▾' : '▸'}</span>
      </div>
    </button>

    {#if expanded}
      <div class="summary-body">
        <!-- File list -->
        <div class="file-list">
          {#each files as file}
            <div
              class="file-row"
              class:created={file.changeType === 'created'}
              class:modified={file.changeType === 'modified'}
              class:deleted={file.changeType === 'deleted'}
            >
              <span
                class="change-icon"
                class:created={file.changeType === 'created'}
                class:modified={file.changeType === 'modified'}
                class:deleted={file.changeType === 'deleted'}
              >
                {getChangeIcon(file.changeType)}
              </span>
              <code class="file-path" title={file.path}>{getShortPath(file.path)}</code>
              <span class="file-diff">
                {#if file.linesAdded > 0}
                  <span class="diff-added">+{file.linesAdded}</span>
                {/if}
                {#if file.linesRemoved > 0}
                  <span class="diff-removed">-{file.linesRemoved}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        <!-- Stats bar -->
        <div class="stats-bar">
          <div class="stats-left">
            {#if created > 0}
              <span class="stat created">{created} created</span>
            {/if}
            {#if modified > 0}
              <span class="stat modified">{modified} modified</span>
            {/if}
            {#if deleted > 0}
              <span class="stat deleted">{deleted} deleted</span>
            {/if}
          </div>
          <div class="stats-right">
            {#if commandsRun > 0}
              <span class="stat commands" class:all-passed={commandsPassed === commandsRun}>
                Commands: {commandsPassed}/{commandsRun} passed
              </span>
            {/if}
            {#if totalTurns > 0}
              <span class="stat turns">{totalTurns} turn{totalTurns !== 1 ? 's' : ''}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .summary-card {
    background: #0d1117;
    border: 1px solid rgba(34, 197, 94, 0.15);
    border-radius: 8px;
    overflow: hidden;
    margin: 8px 0;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.75rem;
  }

  .summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(34, 197, 94, 0.04);
    border: none;
    width: 100%;
    cursor: pointer;
    color: #e6edf3;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
    transition: background 50ms;
  }

  .summary-header:hover {
    background: rgba(34, 197, 94, 0.08);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-icon {
    font-size: 0.85rem;
  }

  .header-title {
    font-weight: 600;
    color: #e6edf3;
  }

  .header-count {
    font-size: 0.65rem;
    color: #8b949e;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .total-added {
    color: #22c55e;
    font-weight: 600;
    font-size: 0.7rem;
  }

  .total-removed {
    color: #f87171;
    font-weight: 600;
    font-size: 0.7rem;
  }

  .expand-icon {
    color: #484f58;
    font-size: 0.7rem;
  }

  .summary-body {
    border-top: 1px solid rgba(34, 197, 94, 0.08);
  }

  .file-list {
    padding: 6px 0;
  }

  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 12px;
    transition: background 50ms;
  }

  .file-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .change-icon {
    width: 14px;
    flex-shrink: 0;
    font-weight: 700;
    text-align: center;
  }

  .change-icon.created {
    color: #22c55e;
  }
  .change-icon.modified {
    color: #fbbf24;
  }
  .change-icon.deleted {
    color: #f87171;
  }

  .file-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #e6edf3;
    font-size: 0.7rem;
    background: none;
    padding: 0;
  }

  .file-diff {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 600;
  }

  .diff-added {
    color: #22c55e;
  }
  .diff-removed {
    color: #f87171;
  }

  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-top: 1px solid rgba(34, 197, 94, 0.06);
    background: rgba(34, 197, 94, 0.02);
  }

  .stats-left,
  .stats-right {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .stat {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8b949e;
  }

  .stat.created {
    color: #22c55e;
  }
  .stat.modified {
    color: #fbbf24;
  }
  .stat.deleted {
    color: #f87171;
  }
  .stat.commands {
    color: #8b949e;
  }
  .stat.commands.all-passed {
    color: #22c55e;
  }
  .stat.turns {
    color: #484f58;
  }
</style>
