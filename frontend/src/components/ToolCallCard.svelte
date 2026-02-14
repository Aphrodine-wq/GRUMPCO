<script lang="ts">
  /**
   * ToolCallCard — Claude Code-inspired design
   *
   * Shows what tool the AI is calling, the file being worked on,
   * and a diff count when applicable. Dark terminal aesthetic.
   */

  interface Props {
    toolCall?: {
      type: 'tool_call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status?: string;
    };
  }

  let { toolCall }: Props = $props();

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
  const EDIT_TOOLS = new Set([
    'file_edit',
    'edit_file',
    'replace_file_content',
    'multi_replace_file_content',
  ]);
  const READ_TOOLS = new Set(['read_file', 'view_file', 'view_file_outline', 'view_code_item']);
  const SEARCH_TOOLS = new Set(['grep_search', 'find_by_name', 'codebase_search', 'search_web']);
  const EXEC_TOOLS = new Set(['bash_execute', 'run_command', 'execute_command', 'terminal']);

  type ToolCategory = 'write' | 'read' | 'search' | 'exec' | 'other';

  function getCategory(name?: string): ToolCategory {
    if (!name) return 'other';
    if (FILE_TOOLS.has(name)) return 'write';
    if (READ_TOOLS.has(name)) return 'read';
    if (SEARCH_TOOLS.has(name)) return 'search';
    if (EXEC_TOOLS.has(name)) return 'exec';
    return 'other';
  }

  // ── Input extraction ─────────────────────────────────────────────────
  function getFilePath(input?: Record<string, unknown>): string | null {
    const candidates = ['path', 'TargetFile', 'AbsolutePath', 'file_path', 'filePath', 'File'];
    for (const key of candidates) {
      const val = input?.[key];
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
    return null;
  }

  function getShortPath(fullPath: string): string {
    // Show last 3-4 path segments for readability
    const segments = fullPath.replace(/\\/g, '/').split('/');
    if (segments.length <= 4) return segments.join('/');
    return '…/' + segments.slice(-4).join('/');
  }

  function getDiffCounts(
    input?: Record<string, unknown>
  ): { added: number; removed: number } | null {
    // Try to extract diff counts from various input shapes
    const content = input?.content ?? input?.CodeContent ?? input?.ReplacementContent;
    const target = input?.TargetContent ?? input?.beforeContent;

    if (typeof content === 'string' && typeof target === 'string') {
      const addedLines = content.split('\n').length;
      const removedLines = target.split('\n').length;
      return { added: addedLines, removed: removedLines };
    }

    // For replacements array
    const chunks = input?.ReplacementChunks ?? input?.operations;
    if (Array.isArray(chunks)) {
      let added = 0;
      let removed = 0;
      for (const chunk of chunks) {
        if (typeof chunk === 'object' && chunk !== null) {
          const rep = (chunk as any).ReplacementContent ?? (chunk as any).replacement ?? '';
          const tgt = (chunk as any).TargetContent ?? (chunk as any).target ?? '';
          if (typeof rep === 'string') added += rep.split('\n').length;
          if (typeof tgt === 'string') removed += tgt.split('\n').length;
        }
      }
      return { added, removed };
    }

    // For new file writes, count content lines
    if (typeof content === 'string') {
      return { added: content.split('\n').length, removed: 0 };
    }

    return null;
  }

  function getCommand(input?: Record<string, unknown>): string | null {
    const cmd = input?.command ?? input?.CommandLine ?? input?.cmd;
    if (typeof cmd === 'string' && cmd.trim().length > 0) return cmd.trim();
    return null;
  }

  function getDescription(input?: Record<string, unknown>): string | null {
    const desc = input?.Description ?? input?.Instruction ?? input?.description;
    if (typeof desc === 'string' && desc.trim().length > 0) {
      return desc.length > 120 ? desc.slice(0, 117) + '…' : desc;
    }
    return null;
  }

  function getSearchQuery(input?: Record<string, unknown>): string | null {
    const query = input?.Query ?? input?.query ?? input?.Pattern ?? input?.pattern;
    if (typeof query === 'string' && query.trim().length > 0) return query.trim();
    return null;
  }

  // ── Derived state ────────────────────────────────────────────────────
  const category = $derived(getCategory(toolCall?.name));
  const filePath = $derived(getFilePath(toolCall?.input));
  const shortPath = $derived(filePath ? getShortPath(filePath) : null);
  const diffCounts = $derived(getDiffCounts(toolCall?.input));
  const command = $derived(getCommand(toolCall?.input));
  const description = $derived(getDescription(toolCall?.input));
  const searchQuery = $derived(getSearchQuery(toolCall?.input));

  const statusLabel = $derived(
    toolCall?.status === 'executing'
      ? 'Running'
      : toolCall?.status === 'success'
        ? 'Done'
        : toolCall?.status === 'error'
          ? 'Failed'
          : (toolCall?.status ?? 'Pending')
  );

  const isExecuting = $derived(toolCall?.status === 'executing');

  const categoryIcon = $derived(
    category === 'write'
      ? CREATE_TOOLS.has(toolCall?.name ?? '')
        ? '+'
        : '✎'
      : category === 'read'
        ? '$'
        : category === 'search'
          ? '?'
          : category === 'exec'
            ? '#'
            : '~'
  );

  const categoryLabel = $derived(
    category === 'write'
      ? CREATE_TOOLS.has(toolCall?.name ?? '')
        ? 'Create'
        : 'Edit'
      : category === 'read'
        ? 'Read'
        : category === 'search'
          ? 'Search'
          : category === 'exec'
            ? 'Execute'
            : 'Tool'
  );

  let showRawInput = $state(false);
</script>

{#if toolCall}
  <div
    class="tool-card"
    class:executing={isExecuting}
    class:write={category === 'write'}
    class:read={category === 'read'}
    class:search={category === 'search'}
    class:exec={category === 'exec'}
  >
    <!-- Main row: icon + info + status -->
    <div class="tool-row">
      <div class="tool-left">
        <span class="tool-icon" class:spin={isExecuting}>{categoryIcon}</span>
        <span
          class="category-chip"
          class:create={CREATE_TOOLS.has(toolCall.name)}
          class:edit={EDIT_TOOLS.has(toolCall.name)}>{categoryLabel}</span
        >
        {#if filePath}
          <code class="inline-path" title={filePath}>{shortPath}</code>
        {:else}
          <span class="tool-name">{toolCall.name}</span>
        {/if}
      </div>
      <div class="tool-right">
        {#if diffCounts}
          <span class="diff-stat">
            <span class="diff-added">+{diffCounts.added}</span>
            <span class="diff-removed">-{diffCounts.removed}</span>
          </span>
        {/if}
        <span
          class="status-badge"
          class:executing={toolCall.status === 'executing'}
          class:success={toolCall.status === 'success'}
          class:error={toolCall.status === 'error'}
        >
          {#if isExecuting}
            <span class="spinner"></span>
          {/if}
          {statusLabel}
        </span>
      </div>
    </div>

    <!-- File path row -->
    {#if filePath && !shortPath}
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

    <!-- Command row for exec tools -->
    {#if command}
      <div class="command-row">
        <span class="prompt-char">$</span>
        <code class="command-text">{command}</code>
      </div>
    {/if}

    <!-- Search query -->
    {#if searchQuery}
      <div class="search-row">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <code class="search-text">{searchQuery}</code>
      </div>
    {/if}

    <!-- Description if available -->
    {#if description}
      <div class="desc-row">{description}</div>
    {/if}

    <!-- Raw input toggle -->
    {#if toolCall.input && Object.keys(toolCall.input).length > 0}
      <button class="raw-toggle" onclick={() => (showRawInput = !showRawInput)}>
        {showRawInput ? '▾ Hide' : '▸ Raw'} input
      </button>
      {#if showRawInput}
        <pre class="raw-input">{JSON.stringify(toolCall.input, null, 2)}</pre>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .tool-card {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
    border: 1px solid rgba(124, 58, 237, 0.12);
    border-left: 3px solid var(--color-primary, #7c3aed);
    border-radius: 6px;
    overflow: hidden;
    margin: 3px 0;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.75rem;
    transition: border-color 0.08s ease-out;
  }

  .tool-card.executing {
    border-color: rgba(124, 58, 237, 0.3);
    border-left-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.08);
  }

  /* All categories use purple — no per-category border colors */
  .tool-card.write,
  .tool-card.read,
  .tool-card.search,
  .tool-card.exec {
    border-left-color: var(--color-primary, #7c3aed);
  }

  /* ── Main row ─────────────────────────────────────────────────────── */
  .tool-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    gap: 6px;
  }

  .tool-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .tool-icon {
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .tool-icon.spin {
    animation: toolSpin 1.5s linear infinite;
  }

  @keyframes toolSpin {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .tool-name {
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .category-chip {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.1);
  }

  /* Per-operation colored chips */
  .category-chip.create {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.12);
  }

  .category-chip.edit {
    color: #d97706;
    background: rgba(217, 119, 6, 0.12);
  }

  .tool-card.write .category-chip:not(.create):not(.edit),
  .tool-card.read .category-chip,
  .tool-card.search .category-chip,
  .tool-card.exec .category-chip {
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.1);
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

  .tool-right {
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

  /* ── Status badge ─────────────────────────────────────────────────── */
  .status-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--color-text-muted, #6b7280);
    background: rgba(124, 58, 237, 0.06);
  }

  .status-badge.executing {
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.12);
  }

  .status-badge.success {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .status-badge.error {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .spinner {
    width: 7px;
    height: 7px;
    border: 1.5px solid rgba(124, 58, 237, 0.3);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.4s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── File row ─────────────────────────────────────────────────────── */
  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 8px;
    color: var(--color-text-muted, #6b7280);
  }

  .file-row svg {
    flex-shrink: 0;
    color: var(--color-primary, #7c3aed);
  }

  .file-path {
    color: var(--color-primary, #7c3aed);
    font-size: 0.72rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
  }

  /* ── Command row ──────────────────────────────────────────────────── */
  .command-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 8px;
    color: var(--color-text-secondary, #64748b);
  }

  .prompt-char {
    color: var(--color-primary, #7c3aed);
    font-weight: 700;
    flex-shrink: 0;
  }

  .command-text {
    font-size: 0.72rem;
    color: var(--color-text-secondary, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
  }

  /* ── Search row ───────────────────────────────────────────────────── */
  .search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 8px;
    color: var(--color-primary, #7c3aed);
  }

  .search-row svg {
    flex-shrink: 0;
  }

  .search-text {
    font-size: 0.72rem;
    color: var(--color-primary-hover, #6d28d9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
  }

  /* ── Description ──────────────────────────────────────────────────── */
  .desc-row {
    padding: 2px 12px 8px;
    font-size: 0.7rem;
    color: var(--color-text-muted, #6b7280);
    font-family: 'Inter', system-ui, sans-serif;
    line-height: 1.4;
  }

  /* ── Raw input toggle ─────────────────────────────────────────────── */
  .raw-toggle {
    display: block;
    width: 100%;
    padding: 4px 12px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(124, 58, 237, 0.08);
    color: var(--color-text-muted, #9ca3af);
    font-family: inherit;
    font-size: 0.65rem;
    cursor: pointer;
    text-align: left;
    transition: color 0.1s;
  }

  .raw-toggle:hover {
    color: var(--color-primary, #7c3aed);
  }

  .raw-input {
    margin: 0;
    padding: 8px 12px;
    background: rgba(124, 58, 237, 0.03);
    color: var(--color-text-muted, #6b7280);
    font-size: 0.68rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
    border-top: 1px solid rgba(124, 58, 237, 0.06);
  }
</style>
